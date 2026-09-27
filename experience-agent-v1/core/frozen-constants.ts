/**
 * core/frozen-constants.ts — 冻结数值常量（不得调整）
 *
 * 来源：spec/frozen.md §5.3/§5.4/§5.6/§5.7/§5.8/§4.1。
 *
 * 硬约束（tasks/phase0.md「三条硬约束」之 3）：
 *   阈值 0.30 / Top-K=5 / 单条 ≤160 tokens / lesson ≤60 字
 *   属于实验设计的一部分，不得调整。
 * 任何修改本文件数值的行为都违反 Frozen Specification 阶段规则。
 */

export const FROZEN = {
  /** §5.3 structured_match 权重 */
  structured_match_weights: {
    task_type: 0.35,
    complexity: 0.15,
    characteristics: 0.30,
    constraints: 0.20,
  },
  /** §5.3 complexity_match 取值 */
  complexity_match: { same: 1.0, adjacent: 0.5, apart: 0.0 },
  /** §5.5 lexical_match = clamp((P95 − raw_bm25) / (P95 − P05), 0, 1) */
  /** §5.6 relevance_score 权重 */
  relevance_weights: { structured: 0.60, lexical: 0.40 },
  /** §5.6 禁忌命中阈值（作用于二值相似度）：token ∈ task.characteristics → 1.0 ≥ 0.60 命中（OQ-004 裁决口径） */
  contraindication_hit_threshold: 0.60,
  /** §5.4 reliability：support_factor = 1 − exp(−independent_support / 2) */
  reliability_support_decay: 2,
  /** §5.4 environment_factor 四档（分类规则边界见 OQ-003） */
  environment_factor: {
    compatible: 1.0,        // harness/tool_schema 完全兼容（同 major，tool_schema 相同）
    minor_compatible: 0.7,  // minor-compatible（同 major，tool_schema 小改）
    major_parseable: 0.3,   // major 不兼容但仍可解析
    unusable: 0.0,          // 不可用（结构性变化，经验无法解析）
  },
  /** §5.7 final_score / Top-K / 预算 */
  final_score_threshold: 0.30,   // final_score < 0.30 → 不进入主 Agent 上下文
  top_k: 5,
  low_relevance_max: 2,          // LOW_RELEVANCE 最多 2 条
  experience_token_budget_item: 160,  // 单条 Experience ≤ 160 tokens
  experience_context_total_budget: 800, // 总 Experience Context ≤ 800 tokens
  lesson_max_chars: 60,          // lesson ≤ 60 字，超长截断
  /** §5.8 retrieval_status 由 relevance 决定（不由 final_score 决定） */
  retrieval_status_bands: { low: 0.30, matched: 0.60, high: 0.80 },
  /** §4.1 生命周期支持数阈值（Phase 0 不执行自动迁移，仅登记冻结值） */
  lifecycle: { validated_min_support: 2, active_min_support: 3 },
  /** §2 schema_version */
  task_state_schema_version: '1.0',
} as const;
