/**
 * tests/pilot-prep.test.ts — Pilot 前裁决落地测试（OQ-011 / OQ-013 / OQ-018 / OQ-021）
 *
 * 覆盖：
 *   - OQ-013 nearest-rank 百分位与 calibrate()（含 N 记录）
 *   - OQ-011/018 token 口径契约（权威来源、诊断口径拒绝、三个记录字段、usage 归一）
 *   - OQ-021 B 臂 Frozen Delegation Policy（7 条优先级、约束、指纹、指令装配）
 *
 * 运行：npm test（node --test --test-isolation=none，进程内、无 spawn）
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calibrate, nearestRankPercentile, PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';
import {
  retrieve,
  ruledContraindicationSimilarity,
  type CandidateExperience,
  type RetrievalQuery,
} from '../experience/retrieval.ts';
import {
  accountExperienceTokens,
  assertFormalCounter,
  DIAGNOSTIC_ESTIMATOR,
  normalizeUsage,
  sumUsage,
  TOKEN_BUDGET,
  type TokenCounter,
} from '../core/token-accounting.ts';
import {
  B_ARM_RUN_CONSTRAINTS,
  buildPolicyInstruction,
  DELEGATION_POLICY_RULES,
  POLICY_ID,
  POLICY_VERSION,
  policyFingerprint,
} from '../policies/delegation-policy.ts';
import { FROZEN } from '../core/frozen-constants.ts';

// ---------- OQ-013：nearest-rank ----------

test('OQ-013：nearest-rank 定义 P05 = x(ceil(0.05N))、P95 = x(ceil(0.95N))', () => {
  const v20 = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
  assert.equal(nearestRankPercentile(v20, 0.05), v20[Math.ceil(0.05 * 20) - 1]); // x(1) = 1
  assert.equal(nearestRankPercentile(v20, 0.95), v20[Math.ceil(0.95 * 20) - 1]); // x(19) = 19
  assert.equal(nearestRankPercentile(v20, 0.05), 1);
  assert.equal(nearestRankPercentile(v20, 0.95), 19);

  const v100 = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(nearestRankPercentile(v100, 0.05), 5);
  assert.equal(nearestRankPercentile(v100, 0.95), 95);

  // 小样本：N=3 ⇒ P05 = x(1)、P95 = x(3)
  const v3 = [10, 20, 30];
  assert.equal(nearestRankPercentile(v3, 0.05), 10);
  assert.equal(nearestRankPercentile(v3, 0.95), 30);
});

test('OQ-013：校准入口固定为 nearest-rank 并记录 N', () => {
  const calib = calibrate([5, 1, 4, 2, 3]); // 未排序输入
  assert.equal(calib.method, 'nearest-rank');
  assert.equal(calib.n, 5);
  assert.equal(calib.p05, 1); // x(ceil(0.25)) = x(1)
  assert.equal(calib.p95, 5); // x(ceil(4.75)) = x(5)
  assert.throws(() => calibrate([]), /标定样本为空/);
});

test('OQ-013：百分位实现拒绝非法输入（未排序 / 空 / 越界 p）', () => {
  assert.throws(() => nearestRankPercentile([], 0.05), /非空样本/);
  assert.throws(() => nearestRankPercentile([2, 1], 0.05), /升序/);
  assert.throws(() => nearestRankPercentile([1, 2], 0), /\(0, 1\]/);
  assert.throws(() => nearestRankPercentile([1, 2], 1.5), /\(0, 1\]/);
});

test('OQ-013：占位常数标注为未标定且 N 为空', () => {
  assert.equal(PLACEHOLDER_CALIBRATION.method, 'placeholder');
  assert.equal(PLACEHOLDER_CALIBRATION.n, null);
  assert.ok(PLACEHOLDER_CALIBRATION.p95 > PLACEHOLDER_CALIBRATION.p05);
});

// ---------- OQ-011 / OQ-018：token 口径 ----------

test('OQ-011：正式口径拒绝诊断计数器，接受 Harness/Provider 计数器', () => {
  assert.throws(() => assertFormalCounter(DIAGNOSTIC_ESTIMATOR), /OQ-011/);
  const harnessCounter: TokenCounter = { source: 'harness', label: 'harness usage', count: () => 1 };
  const providerCounter: TokenCounter = { source: 'provider', label: 'provider usage', count: () => 1 };
  assert.doesNotThrow(() => assertFormalCounter(harnessCounter));
  assert.doesNotThrow(() => assertFormalCounter(providerCounter));
});

test('OQ-011：记录 experience_item_tokens / experience_context_tokens / experience_count', () => {
  const counter: TokenCounter = { source: 'provider', label: 'test', count: (t: string) => t.length };
  const items = ['abc', 'de'];
  const acc = accountExperienceTokens(items, 'abc||de', counter);
  assert.deepEqual(acc.experience_item_tokens, [3, 2]);
  assert.equal(acc.experience_context_tokens, 7);
  assert.equal(acc.experience_count, 2);
  assert.equal(acc.token_accounting_source, 'provider');
});

test('OQ-011：预算常量与冻结值一致（160 / 800）', () => {
  assert.equal(TOKEN_BUDGET.item_max, 160);
  assert.equal(TOKEN_BUDGET.context_max, 800);
  assert.equal(TOKEN_BUDGET.item_max, FROZEN.experience_token_budget_item);
  assert.equal(TOKEN_BUDGET.context_max, FROZEN.experience_context_total_budget);
});

test('OQ-018：usage 归一（provider total 优先；缺 total 时 input+output+cacheRead；reasoning 不重复计入）', () => {
  const withTotal = normalizeUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, totalTokens: 115, reasoningTokens: 3 });
  assert.equal(withTotal.total_tokens, 115);
  assert.equal(withTotal.source, 'provider');
  assert.equal(withTotal.reasoning_tokens, 3, 'reasoning 单独记录');

  const noTotal = normalizeUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 100 });
  assert.equal(noTotal.total_tokens, 115, 'total = input + output + cache_read');
  assert.equal(noTotal.source, 'derived');
  assert.equal(noTotal.reasoning_tokens, null, 'provider 未单独提供时记 null');

  // reasoning 存在但不得叠加进 total
  const reasoningPresent = normalizeUsage({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, reasoningTokens: 7 });
  assert.equal(reasoningPresent.total_tokens, 15, 'reasoning 不重复计入 total');
  assert.equal(reasoningPresent.reasoning_tokens, 7);
});

test('OQ-018：usage 求和保持同一口径', () => {
  const sum = sumUsage([
    normalizeUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    normalizeUsage({ inputTokens: 4, outputTokens: 5, totalTokens: 9 }),
  ]);
  assert.deepEqual(
    { i: sum.input_tokens, o: sum.output_tokens, t: sum.total_tokens, src: sum.source },
    { i: 5, o: 7, t: 12, src: 'provider' },
  );
  const derived = sumUsage([normalizeUsage({ inputTokens: 1, outputTokens: 1 }), normalizeUsage({ inputTokens: 1, outputTokens: 1, totalTokens: 2 })]);
  assert.equal(derived.source, 'derived', '任一条为派生口径则整体标记 derived');
});

// ---------- OQ-011 + §5.7：预算真的按注入的计数器执行 ----------

function makeCandidate(id: string): CandidateExperience {
  return {
    id,
    task_type: 'bugfix',
    complexity: 'medium',
    characteristics: ['multi_file'],
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
}

const budgetQuery: RetrievalQuery = {
  task_type: 'bugfix',
  complexity: 'medium',
  characteristics: ['multi_file'],
  constraints: ['scope_limited'],
  scope: 'project',
  project_id: 'p1',
};

/**
 * 测试用计数器：按序列化文本里的经验条目数计费（每条序列化文本含一个 "[id]" 标记）。
 * 与文本内容相关（空上下文 → 0），因此能真实检验 §5.7 的 160 / 800 预算执行。
 */
function perItemCounter(source: 'harness' | 'provider', tokensPerItem: number): TokenCounter {
  return {
    source,
    label: `per-item-${tokensPerItem}`,
    count: (text: string) => ((text.match(/\[/g) ?? []).length) * tokensPerItem,
  };
}

test('§5.7：单条 > 160 tokens 的经验被丢弃（计数用注入的权威口径）', () => {
  const res = retrieve({
    query: budgetQuery,
    candidates: Array.from({ length: 5 }, (_, i) => makeCandidate(`EXP-B${i}`)),
    lexical: new Map(),
    calibration: PLACEHOLDER_CALIBRATION,
    environment: 'compatible',
    contraindicationSimilarity: ruledContraindicationSimilarity,
    tokenCounter: perItemCounter('harness', 200),
  });
  assert.equal(res.in_context.length, 0, '每条 200 tokens > 160 ⇒ 全部丢弃');
  assert.equal(res.token_accounting.experience_context_tokens, 0);
  assert.equal(res.token_accounting.experience_count, 0);
  assert.equal(res.token_accounting.token_accounting_source, 'harness');
});

test('§5.7：单条恰好 160 tokens 通过（≤ 语义），上下文合计不超 800', () => {
  const res = retrieve({
    query: budgetQuery,
    candidates: Array.from({ length: 5 }, (_, i) => makeCandidate(`EXP-C${i}`)),
    lexical: new Map(),
    calibration: PLACEHOLDER_CALIBRATION,
    environment: 'compatible',
    contraindicationSimilarity: ruledContraindicationSimilarity,
    tokenCounter: perItemCounter('provider', 160),
  });
  assert.equal(res.in_context.length, 5, 'Top-K=5 且每条 160 ≤ 单条上限');
  assert.equal(res.token_accounting.experience_count, 5);
  assert.equal(res.token_accounting.experience_context_tokens, 800, '合计恰好等于上下文预算上限（≤ 语义不截断）');
  assert.deepEqual(res.token_accounting.experience_item_tokens, [160, 160, 160, 160, 160]);
  assert.equal(res.token_accounting.token_accounting_source, 'provider');
});

test('§5.7：未注入计数器时使用诊断口径并如实标注 diagnostic', () => {
  const res = retrieve({
    query: budgetQuery,
    candidates: [makeCandidate('EXP-D0')],
    lexical: new Map(),
    calibration: PLACEHOLDER_CALIBRATION,
    environment: 'compatible',
    contraindicationSimilarity: ruledContraindicationSimilarity,
  });
  assert.equal(res.token_accounting.token_accounting_source, 'diagnostic');
  assert.ok(res.token_accounting.experience_item_tokens.length === res.in_context.length);
});

// ---------- OQ-021：B 臂 Frozen Delegation Policy ----------

test('OQ-021：7 条规则按优先级排列，决策序列固定', () => {
  assert.deepEqual(
    DELEGATION_POLICY_RULES.map((r) => r.priority),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    DELEGATION_POLICY_RULES.map((r) => r.decision),
    ['REPLAN', 'VERIFY', 'WORKFLOW', 'PARALLEL', 'DELEGATE', 'EXPLORE', 'DIRECT'],
  );
  // 每条规则都必须有非空条件说明
  for (const r of DELEGATION_POLICY_RULES) assert.ok(r.condition.length > 0);
});

test('OQ-021：B 臂运行约束为裁决原文的 5 条', () => {
  assert.deepEqual([...B_ARM_RUN_CONSTRAINTS], [
    '不读取 Experience Store',
    '不使用 Reflection 产生的经验',
    '不在线更新 Policy',
    '不根据历史轨迹修改规则',
    '可以正常使用 Harness Tool / Subagent / Workflow',
  ]);
});

test('OQ-021：策略指纹稳定可复现（sha256:64hex），指令文本覆盖全部决策', () => {
  const fp1 = policyFingerprint();
  const fp2 = policyFingerprint();
  assert.equal(fp1, fp2, '同一版本必须得到同一指纹');
  assert.match(fp1, /^sha256:[0-9a-f]{64}$/);
  assert.equal(POLICY_ID, 'frozen-delegation-policy');
  assert.equal(POLICY_VERSION, '1.0');

  const text = buildPolicyInstruction();
  for (const d of ['REPLAN', 'VERIFY', 'WORKFLOW', 'PARALLEL', 'DELEGATE', 'EXPLORE', 'DIRECT']) {
    assert.ok(text.includes(d), `指令文本缺少决策 ${d}`);
  }
  for (const c of B_ARM_RUN_CONSTRAINTS) assert.ok(text.includes(c), `指令文本缺少约束「${c}」`);
  // 优先级顺序必须在文本中体现
  assert.ok(text.indexOf('REPLAN') < text.indexOf('DIRECT'), '优先级顺序应自上而下');
});
