/**
 * tests/protocol-contract.test.ts — PROTOCOL_CONTRACT_TEST（纯代码）
 *
 * 目的：杜绝「提示词允许一个东西 → validator 禁止它」这类契约漂移。
 *   A. 合法 token → PASS；
 *   B. 未知 / 自造 token → FAIL；
 *   C. 缺字段 → FAIL；
 *   D. 非法 first_decision → FAIL；
 *   E. **反漂移**：实际生成的执行提示必须逐字枚举全部受控词表
 *      （提示词给不出合法取值，或给多了非法取值，都必须在这里被抓住）。
 *
 * 本测试只验证"输出空间"的合法性，绝不检查 first_decision 该取什么值。
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { validateTaskStateEnvelope } from '../core/task-state.ts';
import { FROZEN } from '../core/frozen-constants.ts';
import { COMPLEXITY, CONSTRAINTS_VOCAB, FIRST_DECISION, SCOPE } from '../core/enums.ts';
import { SPEC_EXAMPLE_VOCAB } from '../core/vocab.ts';
import { composeRunPrompt } from '../scripts/pilot-prompt.ts';

const envelope = (task_state: Record<string, unknown>): Record<string, unknown> => ({
  schema_version: FROZEN.task_state_schema_version,
  task_state,
});

const legalState = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  task_type: SPEC_EXAMPLE_VOCAB.task_type[0],
  complexity: COMPLEXITY[0],
  characteristics: [SPEC_EXAMPLE_VOCAB.characteristics[0]],
  scope: SCOPE[0],
  constraints: [CONSTRAINTS_VOCAB[0]],
  first_decision: FIRST_DECISION[0],
  ...over,
});

test('A. 合法 token 的 envelope 必须通过校验', () => {
  const r = validateTaskStateEnvelope(envelope(legalState()));
  assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.issues));
});

test('B1. 自造 constraints token → 必须被拒（真实 run 1 的失败形态）', () => {
  const r = validateTaskStateEnvelope(
    envelope(legalState({ constraints: ['only_modify_pilot_workspace_impl', 'do_not_modify_verify_script'] })),
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.issues.map((i) => i.message).join(' '), /受控词表/);
});

test('B2. 未知 characteristics token → 必须被拒', () => {
  const r = validateTaskStateEnvelope(envelope(legalState({ characteristics: ['made_up_characteristic'] })));
  assert.equal(r.ok, false);
});

test('C. 缺字段（少了 scope）→ 必须被拒', () => {
  const s = legalState();
  delete s['scope'];
  const r = validateTaskStateEnvelope(envelope(s));
  assert.equal(r.ok, false);
});

test('D. 非法 first_decision → 必须被拒', () => {
  const r = validateTaskStateEnvelope(envelope(legalState({ first_decision: 'PLAN_AND_ACT' })));
  assert.equal(r.ok, false);
});

test('E. 反漂移：执行提示必须逐字枚举全部受控词表，且不含自造占位符', () => {
  // 用已冻结的 A 臂 plan 生成提示（A 臂不注入经验，无需快照）
  const composed = composeRunPrompt({ runId: 'pilotdry-PILOT-A01-R1-A' });
  const p = composed.prompt;
  for (const token of CONSTRAINTS_VOCAB) {
    assert.ok(p.includes(token), `提示未枚举 constraints 词表项：${token}`);
  }
  for (const token of FIRST_DECISION) {
    assert.ok(p.includes(token), `提示未枚举 first_decision 取值：${token}`);
  }
  for (const token of SPEC_EXAMPLE_VOCAB.task_type) assert.ok(p.includes(token), `缺 task_type：${token}`);
  for (const token of SPEC_EXAMPLE_VOCAB.characteristics) assert.ok(p.includes(token), `缺 characteristic：${token}`);
  for (const token of SCOPE) assert.ok(p.includes(token), `缺 scope：${token}`);
  for (const token of COMPLEXITY) assert.ok(p.includes(token), `缺 complexity：${token}`);

  // 旧占位符必须彻底消失（正是 run 1 采集失败的直接原因）
  assert.ok(!p.includes('<约束 token 子集>'), '仍存在占位符：<约束 token 子集>');
  assert.ok(!p.includes('<∈'), '仍存在占位符：<∈');

  // 硬性取值规则必须写明
  assert.ok(/逐字选自/.test(p), '缺少「逐字选自」规则');
  assert.ok(/不得自创 token/.test(p), '缺少「不得自创 token」规则');
});
