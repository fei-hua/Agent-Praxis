/**
 * tests/deterministic.test.ts — 确定性组件测试（Phase 0 证据）
 *
 * 覆盖：canonical JSON / experiment_config_hash / tool_schema_version / reliability 与
 * 环境分类 / task_state 直读 / 检索公式链（冻结阈值）/ Deterministic Gate（OQ-005/OQ-012
 * 裁决规则）/ benchmark 判定（§9.2–§9.3）/ agents 注册表（OQ-006）/ 轨迹验收检查器。
 *
 * 运行：npm test（node --test tests/）
 * 全部为纯函数测试，无外部状态依赖、无网络、无 LLM。
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../core/canonical-json.ts';
import { buildExperimentConfig, checkConfigHash, experimentConfigHash } from '../core/experiment-config.ts';
import { computeToolSchemaVersion } from '../core/tool-schema-version.ts';
import { FROZEN } from '../core/frozen-constants.ts';
import { readFirstDecision, validateTaskStateEnvelope, extractTaskStateFromFirstTurnText } from '../core/task-state.ts';
import {
  classifyEnvironment,
  conflictFactor,
  environmentFactor,
  reliabilityScore,
  supportFactor,
} from '../experience/reliability.ts';
import {
  contraindicationFactor,
  finalScore,
  isContraindicationHit,
  lexicalMatch,
  relevanceScore,
  retrieve,
  ruledContraindicationSimilarity,
  structuredMatch,
  type CandidateExperience,
  type RetrievalQuery,
} from '../experience/retrieval.ts';
import { PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';
import { evaluateDuplicate, runDeterministicGate, type GateContext, type RunMetadata } from '../experience/gate.ts';
import type { Experience } from '../experience/schema.ts';
import { evaluateCostOk, evaluateTaskChecks, isActionChange, type ActionProfile } from '../benchmark/judge.ts';
import { loadTask } from '../benchmark/tasks.ts';
import { DECISION_TO_SUBAGENTS, SUBAGENT_NAMES } from '../agents/registry.ts';
import { checkFailureReconstructable, checkToolPairing } from '../telemetry/acceptance.ts';
import type { TrajectoryEvent } from '../telemetry/trajectory.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRAJ_DIR = path.resolve(HERE, '..', 'telemetry', 'trajectories');

const ENV = {
  harness_version: '0.1.5-rc.3',
  tool_schema_version: 'tschema-19751aa066b9',
  framework_version: '1.0',
};

// ---------- canonical JSON 与 experiment_config_hash（OQ-009） ----------

test('canonicalJson：递归 key 排序、数组保序、无空白', () => {
  const a = canonicalJson({ b: 1, a: { d: [3, 1, 2], c: null } });
  assert.equal(a, '{"a":{"c":null,"d":[3,1,2]},"b":1}');
  assert.ok(!/\s/.test(a));
});

test('experiment_config_hash：确定性 + 环境变化敏感 + CONFIG_MISMATCH', () => {
  const h1 = experimentConfigHash(buildExperimentConfig(ENV));
  const h2 = experimentConfigHash(buildExperimentConfig({ ...ENV }));
  assert.equal(h1, h2, '同一配置必须得到同一 hash');
  assert.match(h1, /^sha256:[0-9a-f]{64}$/);

  const h3 = experimentConfigHash(buildExperimentConfig({ ...ENV, tool_schema_version: 'tschema-aaaaaaaaaaaa' }));
  assert.notEqual(h1, h3, '环境版本变化必须产生新 hash');
  assert.equal(checkConfigHash(h1, buildExperimentConfig(ENV)), 'match');
  assert.equal(checkConfigHash(h1, buildExperimentConfig({ ...ENV, harness_version: '0.2.0' })), 'CONFIG_MISMATCH');
});

test('experiment_config 含 OQ-009 要求的全部区块与冻结阈值', () => {
  const cfg = buildExperimentConfig(ENV) as Record<string, Record<string, unknown>>;
  for (const section of ['protocol', 'thresholds', 'retrieval', 'vocabulary', 'experience', 'experiments', 'statistical_protocol']) {
    assert.ok(cfg[section], `缺少区块 ${section}`);
  }
  const t = cfg['thresholds']!;
  assert.equal(t['relevance_low_threshold'], 0.3);
  assert.equal(t['top_k'], 5);
  assert.equal(t['experience_context_token_budget'], 800);
  assert.equal(t['single_experience_token_limit'], 160);
  assert.equal(t['lesson_character_limit'], 60);
  assert.equal(t['power'], 0.8);
  assert.equal(t['planning_alpha'], 0.025);
  assert.equal((cfg['statistical_protocol'] as Record<string, unknown>)['primary_metric'], 'CDA');
});

// ---------- tool_schema_version（OQ-016） ----------

test('tool_schema_version：tschema-<12位>、name 排序无关、内容敏感', () => {
  const a = { name: 'read', description: 'd', parameters: { type: 'object' } };
  const b = { name: 'write', description: 'd2', parameters: { type: 'object' } };
  const v1 = computeToolSchemaVersion([a, b]);
  const v2 = computeToolSchemaVersion([b, a]); // 顺序不同，同一集合
  assert.equal(v1, v2);
  assert.match(v1, /^tschema-[0-9a-f]{12}$/);

  const v3 = computeToolSchemaVersion([a, { ...b, description: 'changed' }]);
  assert.notEqual(v1, v3, '模型可见 description 变化必须得到新 version');

  const v4 = computeToolSchemaVersion([{ ...a, parameters: { type: 'object', required: ['x'] } }, b]);
  assert.notEqual(v1, v4, '参数 schema 变化必须得到新 version');
});

// ---------- reliability 与环境分类（§5.4 + OQ-003/OQ-016） ----------

test('reliability_score：§5.4 公式逐项', () => {
  assert.ok(Math.abs(supportFactor(1) - (1 - Math.exp(-0.5))) < 1e-12);
  assert.ok(Math.abs(supportFactor(2) - (1 - Math.exp(-1))) < 1e-12);
  assert.equal(conflictFactor(2, 1), 0.5);
  assert.equal(conflictFactor(3, 0), 1);
  assert.equal(conflictFactor(0, 5), 0, 'max(1, support) 保护');

  const r1 = reliabilityScore({ independent_support: 1, conflict_count: 0, environment: 'compatible' });
  assert.ok(Math.abs(r1 - 0.3934693402873666) < 1e-6, `support=1 上限约 0.393，实际 ${r1}`);
  assert.equal(environmentFactor('compatible'), 1.0);
  assert.equal(environmentFactor('minor_compatible'), 0.7);
  assert.equal(environmentFactor('major_parseable'), 0.3);
  assert.equal(environmentFactor('unusable'), 0.0);
});

test('classifyEnvironment：OQ-003/OQ-016 规则与未覆盖组合抛错', () => {
  const same = { ...ENV };
  assert.equal(classifyEnvironment(ENV, same), 'compatible');
  // 规则 2：Harness 相同 + ToolSchema hash 不同 + Experience 明确声明兼容
  const otherHash = { ...ENV, tool_schema_version: 'tschema-bbbbbbbbbbbb' };
  assert.equal(classifyEnvironment(ENV, otherHash, { experienceDeclaresCompatibility: true }), 'minor_compatible');
  assert.throws(() => classifyEnvironment(ENV, otherHash), /OQ-003/);
  // 规则 4 / 规则 3
  assert.equal(classifyEnvironment(ENV, { ...ENV, harness_version: '0.2.0' }, { toolSchemaUnparseableOrExperienceUnusable: true }), 'unusable');
  assert.equal(classifyEnvironment(ENV, { ...ENV, harness_version: '0.2.0' }, { harnessMajorIncompatible: true }), 'major_parseable');
  assert.throws(() => classifyEnvironment(ENV, { ...ENV, harness_version: '0.2.0' }), /OQ-003/);
});

// ---------- task_state（OQ-010 / T3 / T8） ----------

test('task_state：schema 校验、first_decision 代码直读、首轮文本提取', () => {
  const good = {
    schema_version: '1.0',
    task_state: {
      task_type: 'bugfix',
      complexity: 'medium',
      characteristics: ['multi_file'],
      scope: 'project',
      constraints: ['scope_limited'],
      first_decision: 'REPLAN',
    },
  };
  const v = validateTaskStateEnvelope(good);
  assert.ok(v.ok);
  if (v.ok) assert.equal(readFirstDecision(v.value), 'REPLAN');

  const bad = JSON.parse(JSON.stringify(good)) as typeof good;
  (bad.task_state as { first_decision: string }).first_decision = 'PLAN'; // 非冻结 enum
  assert.equal(validateTaskStateEnvelope(bad).ok, false);

  const text = '前置说明\n```json\n' + JSON.stringify(good) + '\n```\n后续';
  const extracted = extractTaskStateFromFirstTurnText(text);
  assert.ok(extracted.ok, '恰好一个 ```json 块 ⇒ 提取成功');
  if (extracted.ok) assert.equal(readFirstDecision(extracted.value), 'REPLAN');

  // 两个块 ⇒ 拒绝（不猜哪个是 task_state）
  const twoBlocks = extractTaskStateFromFirstTurnText(text + '\n```json\n{}\n```');
  assert.equal(twoBlocks.ok, false);
});

// ---------- 检索公式链（§5.2–§5.7，冻结阈值） ----------

const candidate: CandidateExperience = {
  id: 'EXP-T1',
  task_type: 'bugfix',
  complexity: 'medium',
  characteristics: ['multi_file', 'shared_state'],
  constraints: ['scope_limited'],
  scope: 'project',
  project_id: 'p1',
  situation: 's',
  lesson: 'l',
  decision: 'EXPLORE',
  contraindications: [],
  independent_support: 3,
  conflict_count: 0,
};

const query: RetrievalQuery = {
  task_type: 'bugfix',
  complexity: 'medium',
  characteristics: ['multi_file', 'shared_state'],
  constraints: ['scope_limited'],
  scope: 'project',
  project_id: 'p1',
};

test('structured_match：权重与 Jaccard 规则（∅∩∅→1.0）', () => {
  assert.equal(structuredMatch(query, candidate), 1.0);
  const noChar: RetrievalQuery = { ...query, characteristics: [] };
  const candNoChar: CandidateExperience = { ...candidate, characteristics: [] };
  assert.equal(structuredMatch(noChar, candNoChar), 1.0, '两侧皆空 ⇒ 1.0（∅∩∅ 规则）');
  const half: RetrievalQuery = { ...query, characteristics: ['multi_file'] };
  assert.ok(Math.abs(structuredMatch(half, candidate) - (0.35 + 0.15 + 0.30 * 0.5 + 0.20)) < 1e-12);
});

test('lexical_match / relevance / contraindication / final_score 冻结公式', () => {
  const calib = PLACEHOLDER_CALIBRATION;
  assert.equal(lexicalMatch(null, false, calib), 0);
  assert.equal(lexicalMatch(calib.p95, true, calib), 0, 'P95 → 0');
  assert.equal(lexicalMatch(calib.p05, true, calib), 1, 'P05 → 1');
  assert.equal(lexicalMatch(calib.p95 + 100, true, calib), 0, 'clamp 下界');

  assert.ok(Math.abs(relevanceScore(1, 1) - 1.0) < 1e-12);
  assert.ok(Math.abs(relevanceScore(0, 0) - 0.0) < 1e-12);
  assert.equal(contraindicationFactor(0, 3), 1.0);
  assert.equal(contraindicationFactor(1, 2), 0.5);
  assert.equal(contraindicationFactor(0, 0), 1.0, 'max(1,total) 保护');
  assert.equal(finalScore(1, 1, 1), 1.0);

  assert.equal(isContraindicationHit(0.6), true, '冻结阈值 0.60 含等号');
  assert.equal(isContraindicationHit(0.59), false);
  assert.equal(ruledContraindicationSimilarity(query, 'multi_file'), 1.0);
  assert.equal(ruledContraindicationSimilarity(query, 'no_new_dependency'), 0.0);
});

test('retrieve：阈值 0.30、Top-K=5、LOW_RELEVANCE≤2 与状态分档', () => {
  const many: CandidateExperience[] = Array.from({ length: 8 }, (_, i) => ({
    ...candidate,
    id: `EXP-${i}`,
    independent_support: 3,
  }));
  const res = retrieve({
    query,
    candidates: many,
    lexical: new Map(),
    calibration: PLACEHOLDER_CALIBRATION,
    environment: 'compatible',
    contraindicationSimilarity: ruledContraindicationSimilarity,
  });
  assert.ok(res.in_context.length <= FROZEN.top_k);
  for (const e of res.in_context) assert.ok(e.final_score >= FROZEN.final_score_threshold);
  const lowRel = res.in_context.filter((e) => e.retrieval_status === 'LOW_RELEVANCE');
  assert.ok(lowRel.length <= FROZEN.low_relevance_max, 'LOW_RELEVANCE 条数受冻结上限约束');
});

// ---------- Deterministic Gate（OQ-005 / OQ-012 裁决） ----------

function makeExperience(over: Partial<Experience> = {}): Experience {
  const base: Experience = {
    id: 'EXP-GATE-1',
    status: 'candidate',
    scope: 'project',
    task_type: 'bugfix',
    complexity: 'medium',
    characteristics: ['multi_file'],
    constraints: ['scope_limited'],
    situation: '失败后需要重新规划',
    decision: 'EXPLORE',
    delegation: { mode: 'serial', agents: ['explorer'] },
    outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 1000, subagent_calls: 1, wall_time_s: 10 },
    evidence: {
      run_id: 'run-2026-09-27-DRY-05',
      trajectory_ref: 'run-2026-09-27-DRY-05.jsonl',
      harness_version: ENV.harness_version,
      tool_schema_version: ENV.tool_schema_version,
      framework_version: ENV.framework_version,
      evidence_complete: true,
    },
    lesson: '失败后先更新 task state 再重规划',
    contraindications: [],
    conflict_count: 0,
    independent_support: 1,
  };
  return { ...base, ...over };
}

const runMeta: RunMetadata = {
  task_id: 'DRY-05',
  harness_version: ENV.harness_version,
  tool_schema_version: ENV.tool_schema_version,
  framework_version: ENV.framework_version,
};

function ctx(over: Partial<GateContext> = {}): GateContext {
  return {
    trajectoryRoot: TRAJ_DIR,
    resolveRun: () => runMeta,
    existing: [],
    ...over,
  };
}

test('Gate：完整 Experience 通过全部 9 项检查', () => {
  const r = runDeterministicGate(makeExperience(), ctx());
  assert.equal(r.passed, true, JSON.stringify(r.checks.filter((c) => c.status !== 'pass'), null, 2));
  assert.equal(r.checks.length, 9);
});

test('Gate：duplicate 判定含大小写与列表顺序规范化（OQ-005）', () => {
  const other = {
    ...makeExperience({ id: 'EXP-DUP', characteristics: ['MULTI_FILE'] }),
    // 规范化测试：运行期数据可能来自 JSON（未经 schema 强约束），故此处显式构造大小写差异
    delegation: { mode: 'SERIAL', agents: ['explorer'] },
  } as unknown as Experience;
  const r = runDeterministicGate(makeExperience(), ctx({ existing: [other] }));
  const dup = r.checks.find((c) => c.check === 'duplicate_detection')!;
  assert.equal(dup.status, 'fail');
  assert.match(dup.detail, /duplicate/);
  assert.equal(r.passed, false);
});

test('Gate：exact conflict 规则 (a) action 不同 / (b) 同 action 下 mode 互斥', () => {
  const actionDiff = makeExperience({ id: 'EXP-C-A', decision: 'DELEGATE', delegation: { mode: 'serial', agents: ['explorer'] } });
  const rA = runDeterministicGate(makeExperience(), ctx({ existing: [actionDiff] }));
  assert.equal(rA.checks.find((c) => c.check === 'exact_conflict_detection')!.status, 'fail');
  assert.match(rA.checks.find((c) => c.check === 'exact_conflict_detection')!.detail, /action_differs/);

  const modeDiff = makeExperience({ id: 'EXP-C-B', decision: 'EXPLORE', delegation: { mode: 'parallel', agents: ['explorer'] } });
  const rB = runDeterministicGate(makeExperience(), ctx({ existing: [modeDiff] }));
  assert.equal(rB.checks.find((c) => c.check === 'exact_conflict_detection')!.status, 'fail');
  assert.match(rB.checks.find((c) => c.check === 'exact_conflict_detection')!.detail, /mode_mutually_exclusive/);
});

test('Gate：exact conflict (c) —— 同条件 + 同决策 + 相反 outcome，唯一判定（OQ-020）', () => {
  const opposite = makeExperience({
    id: 'EXP-C-C1',
    outcome: { success: false, task_success_criteria_met: false, forbidden_violation: false, tokens: 900, subagent_calls: 1, wall_time_s: 9 },
  });
  const r = runDeterministicGate(makeExperience(), ctx({ existing: [opposite] }));
  const conflict = r.checks.find((c) => c.check === 'exact_conflict_detection')!;
  assert.equal(conflict.status, 'fail');
  assert.match(conflict.detail, /outcome_opposite/);
  // Conflict 优先：不再同时判 duplicate
  const dup = r.checks.find((c) => c.check === 'duplicate_detection')!;
  assert.equal(dup.status, 'pass');
  assert.match(dup.detail, /Conflict 优先/);
});

test('Gate：仅 lesson 不同（outcome 相同）⇒ 既非 conflict 也非 duplicate，两条分别保留', () => {
  const other = makeExperience({ id: 'EXP-L', lesson: '完全不同的教训文本' });
  const r = runDeterministicGate(makeExperience(), ctx({ existing: [other] }));
  assert.equal(r.checks.find((c) => c.check === 'exact_conflict_detection')!.status, 'pass');
  assert.equal(r.checks.find((c) => c.check === 'duplicate_detection')!.status, 'pass');
});

test('Gate：outcome 缺失/不可确定 ⇒ 不得判定 duplicate（OQ-020）', () => {
  // 路径 1（真实路径）：outcome 是 §3 必填字段，缺失对象先被 schema 校验挡下 ⇒ Gate 失败，
  // 且失败原因不是 duplicate 判定（不把「缺 outcome」误记为「重复」）。
  const noOutcome = { ...makeExperience({ id: 'EXP-NO-OUTCOME' }) } as unknown as Experience;
  delete (noOutcome as { outcome?: unknown }).outcome;
  const r = runDeterministicGate(noOutcome, ctx({ existing: [makeExperience()] }));
  assert.equal(r.checks.find((c) => c.check === 'schema_completeness')!.status, 'fail');
  assert.equal(r.passed, false);

  // 路径 2（防御层，单元级）：若未过 schema 的数据抵达比对层，evaluateDuplicate 必须
  // 明确拒绝判定 duplicate 并要求人工复核，而不是静默按 dedup key 判重。
  const blocked = evaluateDuplicate(noOutcome, [makeExperience()], false);
  assert.equal(blocked.status, 'blocked_by_oq');
  assert.equal(blocked.oq_id, 'OQ-020');

  // 对方 outcome 不可确定时同样不判 duplicate
  const blockedOther = evaluateDuplicate(makeExperience(), [noOutcome], false);
  assert.equal(blockedOther.status, 'blocked_by_oq');

  // 两侧 outcome 均可确定 + dedup key 一致 ⇒ duplicate
  const dup = evaluateDuplicate(makeExperience(), [makeExperience({ id: 'EXP-DUP-2' })], false);
  assert.equal(dup.status, 'fail');
});

test('Gate：task_id 与版本三元组缺失 ⇒ 失败（OQ-012 证据链）', () => {
  const noRun = runDeterministicGate(makeExperience(), ctx({ resolveRun: () => undefined }));
  assert.equal(noRun.checks.find((c) => c.check === 'task_id_exists')!.status, 'fail');
  assert.equal(noRun.checks.find((c) => c.check === 'version_field_exists')!.status, 'fail');
  assert.equal(noRun.passed, false);

  const badVersion = runDeterministicGate(
    makeExperience(),
    ctx({ resolveRun: () => ({ ...runMeta, tool_schema_version: '' }) }),
  );
  assert.equal(badVersion.checks.find((c) => c.check === 'version_field_exists')!.status, 'fail');
});

test('Gate：轨迹引用不可解析 ⇒ 失败', () => {
  const r = runDeterministicGate(makeExperience({ evidence: { ...makeExperience().evidence, trajectory_ref: 'not-exist.jsonl' } }), ctx());
  assert.equal(r.checks.find((c) => c.check === 'trajectory_reference_resolvable')!.status, 'fail');
});

// ---------- benchmark 判定（§9.2 / §9.3） ----------

test('judge：§9.2 四条检查与 §9.3 cost_ok 硬门', () => {
  const ok = evaluateTaskChecks({
    success_criteria_results: [{ criterion: 'a', passed: true }],
    forbidden_file_changes: [],
    verification_tool_called: true,
    expected_delegation: true,
    subagent_invocations: 2,
  });
  assert.equal(ok.task_success, true);

  const noSub = evaluateTaskChecks({
    success_criteria_results: [{ criterion: 'a', passed: true }],
    forbidden_file_changes: [],
    verification_tool_called: true,
    expected_delegation: true,
    subagent_invocations: 0,
  });
  assert.equal(noSub.task_success, false, '期望委派但无 subagent 调用 ⇒ 不通过');

  const base = { tokens: 1000, tokens_effective: 900, subagent_calls: 1, task_success: true, no_forbidden_violation: true };
  const withinBound = evaluateCostOk(base, { ...base, tokens: 1.5 * 1000 + 1000, subagent_calls: 2 }, { baseline_ms: 1, treatment_ms: 2 });
  assert.equal(withinBound.cost_ok, true, '恰好等于上限 ⇒ 通过（≤ 语义）');
  const overTokens = evaluateCostOk(base, { ...base, tokens: 1.5 * 1000 + 1001, subagent_calls: 1 }, { baseline_ms: 1, treatment_ms: 2 });
  assert.equal(overTokens.cost_ok, false);
  const overSubs = evaluateCostOk(base, { ...base, tokens: 1000, subagent_calls: 3 }, { baseline_ms: 1, treatment_ms: 2 });
  assert.equal(overSubs.cost_ok, false);
});

test('judge：Action Change 规则 (a)–(d) 与不计项', () => {
  const base: ActionProfile = { first_decision: 'DIRECT', delegation_agents: [], delegation_execution_mode: null, verification_present: false };
  assert.equal(isActionChange(base, base).changed, false);

  assert.equal(isActionChange(base, { ...base, first_decision: 'EXPLORE' }).changed, true); // (a)
  assert.equal(isActionChange(base, { ...base, delegation_agents: ['explorer'] }).changed, true); // (b)
  const serial: ActionProfile = { ...base, first_decision: 'PARALLEL', delegation_agents: ['a', 'b'], delegation_execution_mode: 'serial' };
  assert.equal(isActionChange(serial, { ...serial, delegation_execution_mode: 'parallel' }).changed, true); // (c)
  assert.equal(isActionChange(base, { ...base, verification_present: true }).changed, true); // (d)
  // mode 非 serial↔parallel 的变化不计入 (c)
  const wf: ActionProfile = { ...serial, delegation_execution_mode: 'workflow' };
  const r = isActionChange(serial, wf);
  assert.equal(r.changed, false);
  assert.match(r.excluded_notes.join(' '), /serial ↔ parallel/);
});

test('tasks：受控词表校验拒绝非法取值', () => {
  const bad = loadTask({
    id: 'X-1',
    source: 'synthetic',
    task_type: '不存在的类型',
    complexity: 'huge',
    scope: 'project',
    characteristics: ['multi_file'],
    constraints: ['scope_limited'],
    prompt: 'p',
    expected_first_decisions: ['DELEGATE'],
    success_criteria: ['c'],
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    const fields = bad.issues.map((i) => i.field);
    assert.ok(fields.includes('task_type') && fields.includes('complexity'));
  }
});

// ---------- agents 注册表（OQ-006） ----------

test('agents：5 个 Subagent 与 first_decision 统一关系（冻结）', () => {
  assert.deepEqual([...SUBAGENT_NAMES], ['explorer', 'researcher', 'ui-reviewer', 'code-reviewer', 'tester']);
  assert.deepEqual([...DECISION_TO_SUBAGENTS.DIRECT], []);
  assert.deepEqual([...DECISION_TO_SUBAGENTS.EXPLORE], ['explorer']);
  assert.deepEqual([...DECISION_TO_SUBAGENTS.VERIFY], ['tester']);
  assert.deepEqual([...DECISION_TO_SUBAGENTS.REPLAN], []);
  assert.ok(DECISION_TO_SUBAGENTS.PARALLEL.length >= 2, 'PARALLEL 需要两个以上可选 Subagent');
});

// ---------- 验收检查器自身的正确性 ----------

test('acceptance：配对检查能识别孤儿 result 与未配对 call', () => {
  const mk = (type: string, callId: string, seq: number): TrajectoryEvent =>
    (type === 'tool_call'
      ? { type: 'tool_call', seq, ts: '', run_id: 'r', call: { call_id: callId, tool_name: 'read', arguments: {} } }
      : { type: 'tool_result', seq, ts: '', run_id: 'r', result: { call_id: callId, ok: true, result_summary: '' } }) as TrajectoryEvent;

  assert.equal(checkToolPairing([mk('tool_call', 'c1', 1), mk('tool_result', 'c1', 2)]).status, 'PASS');
  assert.equal(checkToolPairing([mk('tool_call', 'c1', 1), mk('tool_result', 'c2', 2)]).status, 'FAIL');
});

test('acceptance：failure 检查要求上下文指向真实 tool_call', () => {
  const events: TrajectoryEvent[] = [
    {
      type: 'failure',
      seq: 1,
      ts: '',
      run_id: 'r',
      failure: { failure_id: 'fail-c9', reason: 'boom', kind: 'tool_error', context: { tool_call_id: 'c9' } },
    },
  ];
  assert.equal(checkFailureReconstructable(events).status, 'FAIL', '悬空上下文必须判 FAIL');

  const withCall: TrajectoryEvent[] = [
    { type: 'tool_call', seq: 1, ts: '', run_id: 'r', call: { call_id: 'c9', tool_name: 'pwsh', arguments: {} } },
    ...events,
  ];
  assert.equal(checkFailureReconstructable(withCall).status, 'PASS');
});
