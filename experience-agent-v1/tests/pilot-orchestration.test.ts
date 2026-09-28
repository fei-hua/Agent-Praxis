/**
 * tests/pilot-orchestration.test.ts — Pilot 编排前置冻结项测试
 *
 * 覆盖：
 *   - Arm 定义（人工冻结表）与 Pilot 三臂限制
 *   - Run isolation 门禁（CONFIG_MISMATCH → 中止，不得半跑）
 *   - CDA 冻结口径（只评价委派轴，不是 mode accuracy）
 *   - OQ-019 failure 分类（四类）与 failure_count 根因去重
 *   - 验收检查器对 failure class / event_seq 上下文的核对
 *
 * 运行：npm test（进程内，无 spawn）
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ARM_DEFINITIONS, PILOT_ARMS, armDefinition, assertPilotArm } from '../core/arms.ts';
import { assertRunManifest, verifyRunManifest, type RunManifest } from '../core/run-manifest.ts';
import { armCda, cdaScore, expectedDelegation, isDelegationAction, taskCda } from '../benchmark/cda.ts';
import { countFailures, deriveFailures } from '../telemetry/extract.ts';
import { checkFailureReconstructable } from '../telemetry/acceptance.ts';
import { FAILURE_CLASSES, type TrajectoryEvent } from '../telemetry/trajectory.ts';
import type { RawSessionEvent } from '../telemetry/session-log.ts';

// ---------- Arm 定义 ----------

test('arms：5 条臂与人工表格一致，Pilot 只跑 A/B/C_frozen', () => {
  assert.deepEqual(ARM_DEFINITIONS.map((a) => a.arm), ['A', 'B', 'C_frozen', 'C_static', 'D_online']);
  assert.deepEqual([...PILOT_ARMS], ['A', 'B', 'C_frozen']);

  const a = armDefinition('A');
  assert.equal(a.decision_input, 'harness');
  assert.equal(a.experience, 'none');
  assert.equal(a.reflection, false);

  const c = armDefinition('C_frozen');
  assert.equal(c.decision_input, 'policy');
  assert.equal(c.experience, 'SNAPSHOT_01');
  assert.equal(c.reflection, false);

  const d = armDefinition('D_online');
  assert.equal(d.reflection, true);
  assert.equal(d.experience, 'evolving_store');
  assert.equal(d.pilot, false);

  assert.doesNotThrow(() => assertPilotArm('C_frozen'));
  assert.throws(() => assertPilotArm('C_static'), /Pilot 只允许/);
  assert.throws(() => assertPilotArm('D_online'), /Pilot 只允许/);
});

// ---------- Run isolation 门禁 ----------

const DECLARED: RunManifest = {
  arm: 'C_frozen',
  snapshot_id: 'SNAPSHOT_01',
  policy_hash: 'sha256:91185f5bbf72ae4af0fb07486968962d2e8cb12e095053a00c5e721bbe0bea42',
  experiment_config_hash: 'sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0',
  harness_version: '0.1.5-rc.3',
  tool_schema_version: 'tschema-19751aa066b9',
};

test('run-manifest：声明与运行时一致 ⇒ ok', () => {
  const r = verifyRunManifest(DECLARED, { ...DECLARED });
  assert.equal(r.status, 'ok');
  assert.doesNotThrow(() => assertRunManifest(DECLARED, { ...DECLARED }));
});

test('run-manifest：任一字段不一致 ⇒ CONFIG_MISMATCH 并中止（不得半跑）', () => {
  for (const patch of [
    { harness_version: '0.1.7-rc.2' },
    { tool_schema_version: 'tschema-aaaaaaaaaaaa' },
    { experiment_config_hash: 'sha256:deadbeef' },
    { policy_hash: null },
    { snapshot_id: 'none' },
    { arm: 'B' as const },
  ]) {
    const runtime = { ...DECLARED, ...patch };
    const r = verifyRunManifest(DECLARED, runtime);
    assert.equal(r.status, 'CONFIG_MISMATCH', `字段变化未被检出：${JSON.stringify(patch)}`);
    assert.throws(() => assertRunManifest(DECLARED, runtime), /CONFIG_MISMATCH/);
  }
});

// ---------- CDA 冻结口径 ----------

test('cda：人工冻结的映射表逐行核对（只评价委派轴）', () => {
  const T = expectedDelegation(['DIRECT']);
  const D = expectedDelegation(['DELEGATE']);
  assert.equal(cdaScore(T, 'DIRECT'), 1);
  assert.equal(cdaScore(T, 'DELEGATE'), 0);
  assert.equal(cdaScore(D, 'DELEGATE'), 1);
  assert.equal(cdaScore(D, 'PARALLEL'), 1, 'DELEGATE vs PARALLEL 都得 1（CDA ≠ mode accuracy）');
  assert.equal(cdaScore(D, 'DIRECT'), 0);
});

test('cda：委派轴定义与 mode 无关；非委派动作一律计 0 分（当期望委派时）', () => {
  assert.equal(isDelegationAction('DELEGATE'), true);
  assert.equal(isDelegationAction('PARALLEL'), true);
  assert.equal(isDelegationAction('WORKFLOW'), true);
  assert.equal(isDelegationAction('DIRECT'), false);
  assert.equal(isDelegationAction('EXPLORE'), false);
  assert.equal(isDelegationAction('VERIFY'), false);
  assert.equal(isDelegationAction('REPLAN'), false);

  assert.equal(cdaScore(true, 'WORKFLOW'), 1);
  assert.equal(cdaScore(true, 'EXPLORE'), 0);
  assert.equal(cdaScore(false, 'WORKFLOW'), 0);
});

test('cda：任务级取重复均值、臂级取任务均值', () => {
  const vals = [cdaScore(true, 'DELEGATE'), cdaScore(true, 'DIRECT'), cdaScore(true, 'PARALLEL')];
  const t = taskCda(true, ['DELEGATE', 'DIRECT', 'PARALLEL']);
  assert.ok(Math.abs(t - 2 / 3) < 1e-12, `3 次重复均值应在 {0,1/3,2/3,1}：${t}`);
  assert.equal(vals.length, 3);
  assert.equal(taskCda(false, ['DIRECT', 'DIRECT', 'DIRECT']), 1);
  assert.equal(armCda([1, 2 / 3, 1 / 3]), 2 / 3);
  assert.throws(() => expectedDelegation([]), /不能为空/);
});

// ---------- OQ-019：failure 分类与计数 ----------

let seq = 0;
function toolResult(opts: {
  callId: string;
  toolName?: string;
  text?: string;
  isError?: boolean;
  errorName?: string;
}): RawSessionEvent {
  return {
    type: 'tool/result',
    seq: ++seq,
    time: Date.now(),
    data: {
      turn: 1,
      step: seq,
      ...(opts.errorName ? { error: { name: opts.errorName } } : {}),
      message: {
        source: { kind: 'tool', callId: opts.callId },
        content: [
          {
            type: 'tool-result',
            toolCallId: opts.callId,
            isError: opts.isError === true,
            content: [{ type: 'text', text: opts.text ?? '' }],
          },
        ],
      },
    },
  } as unknown as RawSessionEvent;
}

function turnEndError(message: string, code: string): RawSessionEvent {
  return {
    type: 'turn/end',
    seq: ++seq,
    time: Date.now(),
    data: { turn: 1, reason: { kind: 'error', error: { message, code } } },
  } as unknown as RawSessionEvent;
}

test('OQ-019：tool error / 非零退出 / provider 异常分别落到三类', () => {
  const events = [
    toolResult({ callId: 'c1', isError: true, errorName: 'FsError', text: 'Error: cannot read x' }),
    toolResult({ callId: 'c2', text: 'boom\n[exit code: 1]' }),
    toolResult({ callId: 'c3', isError: true, errorName: 'RATE_LIMIT', text: '429 Too many requests' }),
    turnEndError('429: Too many requests', 'RATE_LIMIT'),
  ];
  const failures = deriveFailures(events);
  const byCall = new Map(failures.filter((f) => f.context.tool_call_id).map((f) => [f.context.tool_call_id!, f]));
  assert.equal(byCall.get('c1')!.class, 'tool_execution');
  assert.equal(byCall.get('c2')!.class, 'command_execution');
  assert.equal(byCall.get('c2')!.kind, 'command_exit_nonzero');
  assert.equal(byCall.get('c3')!.class, 'infrastructure', 'provider 异常归入 infrastructure');

  const turnFailure = failures.find((f) => f.class === 'infrastructure' && f.context.event_seq !== undefined);
  assert.ok(turnFailure, 'turn 以 error 结束必须产生 run 级 failure');
  assert.equal(turnFailure!.kind, 'RATE_LIMIT');
});

test('OQ-019：UUID/哈希里的数字串不得被误判为 infrastructure（回归）', () => {
  const events = [
    toolResult({
      callId: 'u1',
      isError: true,
      errorName: 'tool_error',
      text: 'Error: unknown job 095e21a5-3c25-42aa-8a48-2534e8610b5c',
    }),
  ];
  const f = deriveFailures(events)[0]!;
  assert.equal(f.class, 'tool_execution', 'harness 的 job 查询错误属于 tool 返回错误，不是 provider 异常');
});

test('OQ-019：deliberate verification failure 可按 callId 显式排除', () => {
  const events = [toolResult({ callId: 'v1', text: 'expected failure\n[exit code: 1]' })];
  assert.equal(deriveFailures(events).length, 1);
  assert.equal(deriveFailures(events, { deliberateVerificationCallIds: ['v1'] }).length, 0);
});

test('OQ-019：failure_count 对同一根因的重复日志只计一次', () => {
  const events = [
    toolResult({ callId: 'd1', isError: true, errorName: 'FsError', text: 'Error: cannot read "a.json": not found' }),
    toolResult({ callId: 'd2', isError: true, errorName: 'FsError', text: 'Error: cannot read "a.json": not found' }),
    toolResult({ callId: 'd3', text: 'x\n[exit code: 2]' }),
  ];
  const failures = deriveFailures(events);
  assert.equal(failures.length, 3, '事件级仍是 3 条 failure');
  assert.equal(countFailures(failures), 2, '同一根因（同一 kind + 同一归一化原因）只计一次');
});

test('OQ-019：四类之外的值会被验收检查器拒绝', () => {
  assert.deepEqual([...FAILURE_CLASSES], ['tool_execution', 'command_execution', 'agent_action', 'infrastructure']);
});

// ---------- 验收检查器：failure 上下文（含 run 级 event_seq） ----------

test('acceptance：failure 上下文可用 event_seq 指向真实会话事件', () => {
  const withSeq: TrajectoryEvent[] = [
    { type: 'failure', seq: 1, ts: '', run_id: 'r', failure: { failure_id: 'fail-turn-9', class: 'infrastructure', reason: '429', kind: 'RATE_LIMIT', context: { event_seq: 9 } } },
    { type: 'failure', seq: 9, ts: '', run_id: 'r', failure: { failure_id: 'anchor', class: 'infrastructure', reason: 'anchor', kind: 'anchor', context: { event_seq: 9 } } },
  ];
  assert.equal(checkFailureReconstructable(withSeq).status, 'PASS');

  const badSeq: TrajectoryEvent[] = [
    { type: 'failure', seq: 1, ts: '', run_id: 'r', failure: { failure_id: 'f', class: 'infrastructure', reason: 'x', kind: 'y', context: { event_seq: 999 } } },
  ];
  assert.equal(checkFailureReconstructable(badSeq).status, 'FAIL', '指向不存在的 event_seq 必须 FAIL');
});

test('acceptance：failure class 非四类之一会被拒绝', () => {
  const badClass: TrajectoryEvent[] = [
    {
      type: 'failure',
      seq: 1,
      ts: '',
      run_id: 'r',
      failure: {
        failure_id: 'f',
        class: 'whatever' as unknown as (typeof FAILURE_CLASSES)[number],
        reason: 'x',
        kind: 'y',
        context: { event_seq: 1 },
      },
    },
  ];
  const r = checkFailureReconstructable(badClass);
  assert.equal(r.status, 'FAIL');
  assert.match(r.detail, /不是 OQ-019 的四类之一/);
});
