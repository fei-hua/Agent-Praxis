/**
 * experience/retrieval.ts — Experience Retrieval 公式链（spec/frozen.md §5，冻结）
 *
 * 实现顺序（§5.1）：
 *   Eligibility Filter (scope)
 *     → structured_match + lexical_match (FTS5/BM25)
 *     → relevance_score → reliability_score → contraindication_factor
 *     → final_score → Top-K=5 → 阈值 0.30 → 序列化进上下文
 *
 * 硬约束（tasks/phase0.md 三条硬约束之 3）：
 *   阈值 0.30 / Top-K=5 / 单条 ≤160 tokens / lesson ≤60 字不得调整。
 *
 * 规格未定义处（不猜测）：
 *   OQ-004  禁忌命中判定 —— 已由人工裁决（2026-09-27）：token 精确匹配（见下）
 *   OQ-011  token 计数口径 —— 已由人工裁决（2026-09-27）：正式口径为 Harness/Provider 侧
 *           accounting；离线 tokenizer 仅限开发诊断（诊断口径会写入 token_accounting_source）
 *   OQ-013  P05/P95 百分位 —— 已由人工裁决（2026-09-27）：nearest-rank
 *   OQ-014  task.scope 与 experience.scope 在 Eligibility Filter 中的组合规则未定义
 */

import { FROZEN } from '../core/frozen-constants.ts';
import type { Complexity, FirstDecision, RetrievalStatus, Scope, ConstraintToken } from '../core/enums.ts';
import {
  accountExperienceTokens,
  DIAGNOSTIC_ESTIMATOR,
  type ExperienceTokenAccounting,
  type TokenCounter,
} from '../core/token-accounting.ts';
import { reliabilityScore, type EnvironmentClass } from './reliability.ts';

// ---------- 检索输入画像 ----------

/** §5.3 structured_match 比对所需的结构化画像（与 Task State 同形） */
export interface MatchProfile {
  task_type: string;
  complexity: Complexity;
  characteristics: string[];
  constraints: ConstraintToken[];
}

export interface RetrievalQuery extends MatchProfile {
  scope: Scope;
  /** 用于 Eligibility Filter 的项目标识；单项目 Phase 0 dry-run 下所有候选同项目 */
  project_id: string;
}

export interface CandidateExperience extends MatchProfile {
  id: string;
  scope: Scope;
  project_id: string;
  situation: string;
  lesson: string;
  decision: FirstDecision;
  contraindications: string[];
  independent_support: number;
  conflict_count: number;
}

// ---------- §5.3 structured_match（冻结） ----------

export function taskTypeMatch(a: string, b: string): number {
  return a === b ? FROZEN.complexity_match.same : 0.0;
}

export function complexityMatch(a: Complexity, b: Complexity): number {
  const order: readonly Complexity[] = ['simple', 'medium', 'high'];
  const dist = Math.abs(order.indexOf(a) - order.indexOf(b));
  if (dist === 0) return FROZEN.complexity_match.same;
  if (dist === 1) return FROZEN.complexity_match.adjacent;
  return FROZEN.complexity_match.apart;
}

/** §5.3：|A ∩ B| / |A ∪ B|；A = B = ∅ → 1.0（避免 NaN） */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 1.0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  return inter / union.size;
}

/** §5.3：0.35×task_type + 0.15×complexity + 0.30×characteristics + 0.20×constraints */
export function structuredMatch(a: MatchProfile, b: MatchProfile): number {
  const w = FROZEN.structured_match_weights;
  return (
    w.task_type * taskTypeMatch(a.task_type, b.task_type) +
    w.complexity * complexityMatch(a.complexity, b.complexity) +
    w.characteristics * jaccard(a.characteristics, b.characteristics) +
    w.constraints * jaccard(a.constraints, b.constraints)
  );
}

// ---------- §5.5 lexical_match（冻结） ----------

export interface Bm25Calibration {
  p05: number;
  p95: number;
}

/**
 * §5.5：lexical_match = clamp((P95 − raw_bm25) / (P95 − P05), 0, 1)
 * SQLite FTS5 的 bm25() 越低越相关，故 (P95 − raw) 方向正确。
 * 无命中：0。P95 == P05：matched → 1.0，unmatched → 0.0。
 */
export function lexicalMatch(rawBm25: number | null, matched: boolean, calib: Bm25Calibration): number {
  if (!matched || rawBm25 === null) return 0.0;
  if (calib.p95 === calib.p05) return matched ? 1.0 : 0.0;
  const v = (calib.p95 - rawBm25) / (calib.p95 - calib.p05);
  return Math.min(1, Math.max(0, v));
}

// ---------- §5.6 relevance_score 与 contraindication_factor（冻结） ----------

/** §5.6：relevance_score = 0.60 × structured_match + 0.40 × lexical_match ∈ [0,1] */
export function relevanceScore(structured: number, lexical: number): number {
  return FROZEN.relevance_weights.structured * structured + FROZEN.relevance_weights.lexical * lexical;
}

/**
 * §5.6：contraindication_factor = 1 − matched_count / max(1, total_count)，clamp 到 [0,1]。
 * 无禁忌（total_count = 0）→ 1.0。
 */
export function contraindicationFactor(matchedCount: number, totalCount: number): number {
  const raw = 1 - matchedCount / Math.max(1, totalCount);
  return Math.min(1, Math.max(0, raw));
}

/**
 * OQ-004（已裁决，2026-09-27）：
 * §5.6 原判定式「structured_match(当前任务, 该禁忌) ≥ 0.60」与 §3.1（禁忌是单个
 * characteristics 词表 token，非完整剖面）自相矛盾。人工裁决：
 *   命中 ⇔ 该 contraindication token 出现在当前任务 characteristics（词表精确匹配）。
 * §5.6 已按裁决同步（2026-09-27），规格与实现现为同一口径。
 * 实现为二值相似度（成员=1.0，非成员=0.0），冻结阈值 0.60 原样保留并作用于该相似度
 * （语义等价：1.0 ≥ 0.60 命中，0.0 < 0.60 不命中）。阈值本身未做任何调整。
 */
export type ContraindicationSimilarityFn = (task: MatchProfile, contraindication: string) => number;

/** 人工裁决口径：token ∈ 当前任务 characteristics → 1.0，否则 0.0 */
export const ruledContraindicationSimilarity: ContraindicationSimilarityFn = (task, contraindication) =>
  task.characteristics.includes(contraindication) ? 1.0 : 0.0;

export function isContraindicationHit(similarity: number): boolean {
  return similarity >= FROZEN.contraindication_hit_threshold;
}

// ---------- §5.4 reliability_score（代码计算） ----------

export interface ReliabilityEnv {
  environment: EnvironmentClass;
}

// ---------- §5.7 final_score、Top-K、阈值与序列化（冻结） ----------

/** §5.7：final_score = relevance_score × reliability_score × contraindication_factor */
export function finalScore(relevance: number, reliability: number, contraindication: number): number {
  return relevance * reliability * contraindication;
}

/** §5.8：retrieval_status 由 relevance 决定（不由 final_score 决定） */
export function retrievalStatusFromRelevance(relevance: number): RetrievalStatus {
  const b = FROZEN.retrieval_status_bands;
  if (relevance < b.low) return 'NO_MATCH';
  if (relevance < b.matched) return 'LOW_RELEVANCE';
  if (relevance < b.high) return 'MATCHED';
  return 'HIGH_RELEVANCE';
}

export interface ScoredExperience {
  candidate: CandidateExperience;
  structured_match: number;
  lexical_match: number;
  relevance_score: number;
  reliability_score: number;
  contraindication_factor: number;
  final_score: number;
  retrieval_status: RetrievalStatus;
}

export interface RetrievalResult {
  scored: ScoredExperience[];
  /** 进入主 Agent 上下文的条目（§5.7：Top-K=5、final_score ≥ 0.30、LOW_RELEVANCE ≤ 2、预算约束） */
  in_context: ScoredExperience[];
  serialized_context: string;
  /** OQ-011 裁决：注入上下文的 token 记账（experience_item_tokens / experience_context_tokens / experience_count） */
  token_accounting: ExperienceTokenAccounting;
}

export interface RetrievalInput {
  query: RetrievalQuery;
  candidates: CandidateExperience[];
  /** BM25 原始分（FTS5 命中项）；未命中项不出现或传 matched=false */
  lexical: Map<string, { raw_bm25: number | null; matched: boolean }>;
  calibration: Bm25Calibration;
  /** OQ-003：environment 分类；Phase 0 同环境 ⇒ 'compatible' */
  environment: EnvironmentClass;
  /** OQ-004：禁忌相似度函数；未注入且候选含 contraindications 时抛错 */
  contraindicationSimilarity?: ContraindicationSimilarityFn;
  /**
   * OQ-011 裁决：token 计数器。正式实验**必须**注入 Harness / Provider 侧口径
   * （source = 'harness' | 'provider'）；未注入时使用诊断口径，并在
   * `token_accounting.token_accounting_source` 中如实标注为 'diagnostic'。
   */
  tokenCounter?: TokenCounter;
}

/**
 * §5.2 Eligibility Filter（scope）——硬过滤，**不参与任何评分**。
 *
 * OQ-014 人工裁决（2026-09-27，正式冻结）：
 *   scope = project → 仅当 current_project == experience.project_id 时 eligible；
 *   scope = generic → 所有 project 均 eligible；
 *   scope 只决定 eligibility，不进入 relevance/reliability/final_score
 *   （不得给 project 加 bonus、不得给 generic 加 penalty）。
 *   冻结细节：project 经验的 project_id 缺失 ⇒ **视为无效/配置错误**，
 *   不得 fallback 为 generic（不得绕过 scope）。
 */
export function isEligible(query: RetrievalQuery, candidate: CandidateExperience): boolean {
  if (candidate.scope === 'project' && (candidate.project_id ?? '').trim() === '') {
    throw new Error(
      'OQ-014 裁决：project 经验的 project_id 缺失 ⇒ 视为无效/配置错误（不得 fallback 为 generic，不得绕过 scope）。',
    );
  }
  if (candidate.scope === 'generic') return true; // generic ⇒ 所有 project eligible
  return query.project_id === candidate.project_id; // project ⇒ 仅同项目
}

/** §5 检索主流程（冻结公式，无任何可调参数） */
export function retrieve(input: RetrievalInput): RetrievalResult {
  const scored: ScoredExperience[] = [];

  for (const candidate of input.candidates) {
    if (!isEligible(input.query, candidate)) continue;

    // OQ-004（已裁决 2026-09-27）：命中 ⇔ token ∈ 当前任务 characteristics（词表精确匹配）；
    // 默认使用裁决口径，调用方可显式注入其他相似度函数（阈值 0.60 仍由 isContraindicationHit 应用）。
    const similarityFn = input.contraindicationSimilarity ?? ruledContraindicationSimilarity;
    let matchedContra = 0;
    for (const c of candidate.contraindications) {
      const sim = similarityFn(input.query, c);
      if (isContraindicationHit(sim)) matchedContra++;
    }

    const lex = input.lexical.get(candidate.id) ?? { raw_bm25: null, matched: false };

    const sm = structuredMatch(input.query, candidate);
    const lm = lexicalMatch(lex.raw_bm25, lex.matched, input.calibration);
    const rel = relevanceScore(sm, lm);
    const reliability = reliabilityScore({
      independent_support: candidate.independent_support,
      conflict_count: candidate.conflict_count,
      environment: input.environment,
    });
    const cf = contraindicationFactor(matchedContra, candidate.contraindications.length);
    const fs = finalScore(rel, reliability, cf);

    scored.push({
      candidate,
      structured_match: sm,
      lexical_match: lm,
      relevance_score: rel,
      reliability_score: reliability,
      contraindication_factor: cf,
      final_score: fs,
      retrieval_status: retrievalStatusFromRelevance(rel),
    });
  }

  // §5.7：final_score 降序 → 阈值 0.30 过滤 → Top-K = 5 → LOW_RELEVANCE 最多 2 条 → 预算
  // OQ-014 裁决的同分 tie-break（仅排序，不是评分项）：project-specific 优先 → experience_id 升序
  const above = scored
    .filter((s) => s.final_score >= FROZEN.final_score_threshold)
    .sort((a, b) => {
      if (b.final_score !== a.final_score) return b.final_score - a.final_score;
      const rank = (s: ScoredExperience): number => (s.candidate.scope === 'project' ? 0 : 1);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0;
    });

  const topK = above.slice(0, FROZEN.top_k);

  const counter: TokenCounter = input.tokenCounter ?? DIAGNOSTIC_ESTIMATOR;

  const ordered: ScoredExperience[] = [];
  let lowRelevanceCount = 0;
  for (const s of topK) {
    if (s.retrieval_status === 'LOW_RELEVANCE') {
      if (lowRelevanceCount >= FROZEN.low_relevance_max) continue;
      lowRelevanceCount++;
    }
    ordered.push(s);
  }

  // §5.7 冻结预算（OQ-011 裁决口径计数）：
  //   单条 Experience > 160 tokens → 丢弃该条；
  //   总 Experience Context > 800 tokens → 按 final_score 降序在此截断。
  const in_context: ScoredExperience[] = [];
  for (const s of ordered) {
    const itemText = serializeExperience(s);
    if (counter.count(itemText) > FROZEN.experience_token_budget_item) continue;
    const nextContext = serializeContext([...in_context, s]);
    if (counter.count(nextContext) > FROZEN.experience_context_total_budget) break;
    in_context.push(s);
  }

  const serialized_context = serializeContext(in_context);
  return {
    scored,
    in_context,
    serialized_context,
    token_accounting: accountExperienceTokens(
      in_context.map((s) => serializeExperience(s)),
      serialized_context,
      counter,
    ),
  };
}

// ---------- §5.7 序列化与 token 记账（冻结格式，不发整个 YAML） ----------

/**
 * OQ-011（已裁决 2026-09-27）：正式口径为 Harness / Provider 侧 token accounting。
 * 本函数仅提供**诊断用**字符近似计数（CJK 1 字/token、其余 4 字符/token），
 * 委托 core/token-accounting.ts 的 DIAGNOSTIC_ESTIMATOR，保持单一实现。
 * lesson ≤60 字的截断按字符计数，由规格明确定义（§5.7），不受本 OQ 影响。
 */
export function estimateTokensPlaceholder(text: string): number {
  return DIAGNOSTIC_ESTIMATOR.count(text);
}

export function serializeExperience(s: ScoredExperience): string {
  const c = s.candidate;
  const lines = [
    `[${c.id}]`,
    `task_type: ${c.task_type}`,
    `characteristics: ${c.characteristics.join(',')}`,
    `decision: ${c.decision}`,
    `lesson: ${c.lesson}`,
    `contraindications: ${c.contraindications.join(',')}`,
    `reliability: ${s.reliability_score.toFixed(2)}`,
  ];
  return lines.join('\n');
}

export function serializeContext(items: ScoredExperience[]): string {
  return items.map(serializeExperience).join('\n');
}
