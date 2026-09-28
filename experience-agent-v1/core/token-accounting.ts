/**
 * core/token-accounting.ts — token 口径契约（OQ-011 + OQ-018 人工裁决，2026-09-27）
 *
 * OQ-011 裁决：
 *   160 tokens / Experience 与 800 tokens / Experience Context 的正式口径，
 *   采用**实际 DeepSeek 模型 / Harness 侧 token accounting**；
 *   **禁止**使用 o200k_base 等通用 tokenizer 作为正式实验口径；
 *   必须记录 experience_item_tokens / experience_context_tokens / experience_count；
 *   离线 tokenizer 只能用于开发诊断，不能作为正式实验结果。
 *
 * OQ-018 裁决：
 *   正式实验以 Harness / Provider 返回的 usage 为 token 统计权威来源；
 *   记录 input_tokens / output_tokens / cache_read_tokens / reasoning_tokens（若 provider 单独提供）/ total_tokens；
 *   若 provider 没有 total：total = input + output + cache_read；
 *   若 reasoning 已包含在 output：**不得重复计算**；
 *   所有实验臂必须使用完全相同的口径。
 */

import { FROZEN } from './frozen-constants.ts';

/** token 计数来源。'diagnostic' 仅限开发诊断，正式实验禁止使用。 */
export type TokenAccountingSource = 'harness' | 'provider' | 'diagnostic';

export interface TokenCounter {
  source: TokenAccountingSource;
  /** 人类可读标注（写入报告，便于区分正式口径与诊断口径） */
  label: string;
  count(text: string): number;
}

/**
 * 诊断用字符近似计数器（**非正式口径**）。
 * CJK 1 字/token、其余 4 字符/token——仅用于开发期自检与单元测试。
 */
export const DIAGNOSTIC_ESTIMATOR: TokenCounter = {
  source: 'diagnostic',
  label: 'char-approx（CJK 1 字/token、其余 4 字符/token）——仅开发诊断',
  count(text: string): number {
    let cjk = 0;
    let other = 0;
    for (const ch of text) {
      if (/[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(ch)) cjk++;
      else other++;
    }
    return cjk + Math.ceil(other / 4);
  },
};

/** 正式实验前必须断言计数器为权威口径（OQ-011：离线 tokenizer 不得作为正式口径） */
export function assertFormalCounter(counter: TokenCounter): void {
  if (counter.source === 'diagnostic') {
    throw new Error(
      `OQ-011 裁决：正式实验必须使用 Harness / Provider 侧 token accounting，` +
        `禁止使用诊断口径（${counter.label}）。请注入 source 为 'harness' 或 'provider' 的计数器。`,
    );
  }
}

export interface ExperienceTokenAccounting {
  /** 每条经验序列化后的 token 数（逐条记录） */
  experience_item_tokens: number[];
  /** 整段 Experience Context 的 token 数 */
  experience_context_tokens: number;
  /** 实际注入的经验条数 */
  experience_count: number;
  /** 本次计数使用的口径来源（正式实验必须为 harness / provider） */
  token_accounting_source: TokenAccountingSource;
}

/** OQ-011：对注入上下文的经验逐条 + 整体计数（记录三个字段） */
export function accountExperienceTokens(
  itemTexts: string[],
  contextText: string,
  counter: TokenCounter,
): ExperienceTokenAccounting {
  const itemTokens = itemTexts.map((t) => counter.count(t));
  return {
    experience_item_tokens: itemTokens,
    experience_context_tokens: counter.count(contextText),
    experience_count: itemTexts.length,
    token_accounting_source: counter.source,
  };
}

/** 冻结预算（§5.7，不得调整） */
export const TOKEN_BUDGET = {
  item_max: FROZEN.experience_token_budget_item,
  context_max: FROZEN.experience_context_total_budget,
} as const;

// ---------- OQ-018：usage 口径 ----------

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  reasoningTokens?: number;
}

export interface UsageRecord {
  /** Harness/Provider 权威来源：'provider' 表示原始 usage，'derived' 表示由公式补齐 total */
  source: 'provider' | 'derived';
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  /** provider 未单独提供时为 null（**不得**把 output 内的 reasoning 重复计入） */
  reasoning_tokens: number | null;
  total_tokens: number;
}

/**
 * OQ-018 裁决口径：
 *   - total 由 provider 提供则直接采用；
 *   - provider 没有 total ⇒ total = input + output + cache_read；
 *   - reasoning 单独提供时**只记录**，不叠加进 total（它通常已包含在 output 内）。
 */
export function normalizeUsage(u: ProviderUsage): UsageRecord {
  const input = u.inputTokens ?? 0;
  const output = u.outputTokens ?? 0;
  const cacheRead = u.cacheReadTokens ?? 0;
  const providerTotal = typeof u.totalTokens === 'number' ? u.totalTokens : null;
  return {
    source: providerTotal === null ? 'derived' : 'provider',
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead,
    reasoning_tokens: typeof u.reasoningTokens === 'number' ? u.reasoningTokens : null,
    total_tokens: providerTotal ?? input + output + cacheRead,
  };
}

/** 多条 usage 求和（同一口径，不做语义重定义） */
export function sumUsage(records: UsageRecord[]): UsageRecord {
  let sawDerived = false;
  let reasoning: number | null = null;
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let total = 0;
  for (const r of records) {
    if (r.source === 'derived') sawDerived = true;
    if (r.reasoning_tokens !== null) reasoning = (reasoning ?? 0) + r.reasoning_tokens;
    input += r.input_tokens;
    output += r.output_tokens;
    cacheRead += r.cache_read_tokens;
    total += r.total_tokens;
  }
  return {
    source: sawDerived ? 'derived' : 'provider',
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead,
    reasoning_tokens: reasoning,
    total_tokens: total,
  };
}
