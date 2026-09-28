/**
 * experience/calibration.ts — BM25 标定（spec/frozen.md §5.5 + OQ-013 裁决）
 *
 * 规格要求：
 *   标定必须在最终 SNAPSHOT_01 上做，绝不能在 Acquisition 生长过程中做。
 *   标定查询集 = Acquisition Set 的任务查询（不允许 Validation / Transfer / Pilot 参与标定）。
 *
 * OQ-013 人工裁决（2026-09-27）：采用 **nearest-rank percentile**。
 *   SNAPSHOT_01 上的 calibration raw_bm25 升序为 x(1) ≤ x(2) ≤ … ≤ x(N)，则
 *     P05 = x(ceil(0.05 × N))
 *     P95 = x(ceil(0.95 × N))
 *   **N 必须写入 experiment_config**；P05/P95 只在 SNAPSHOT_01 最终冻结后计算一次，
 *   Formal 期间禁止重新估计。
 *
 * 因此本模块不再接受「可注入的百分位方法」（那会引入口径漂移），只提供裁决口径。
 */

export interface Bm25Calibration {
  /** 'nearest-rank' = OQ-013 裁决口径；'placeholder' = Phase 0 占位常数（未标定） */
  method: 'nearest-rank' | 'placeholder';
  /** 标定样本量 N（OQ-013：必须写入 experiment_config）；占位常数为 null */
  n: number | null;
  p05: number;
  p95: number;
}

/**
 * Phase 0 占位常数（spec/frozen.md §5.5 明确允许；OQ-013 允许先用占位）。
 * 标注：占位、未标定。Phase 1 在 SNAPSHOT_01 上按 nearest-rank 正式标定后替换。
 * 只要 P95 > P05，公式路径即被完整执行。
 */
export const PLACEHOLDER_CALIBRATION: Bm25Calibration = {
  method: 'placeholder',
  n: null,
  p05: -10,
  p95: -1,
};

/**
 * OQ-013 裁决口径：nearest-rank percentile。
 * @param sortedAscending 已升序排序的样本
 * @param p 目标分位（0 < p ≤ 1）
 */
export function nearestRankPercentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) {
    throw new Error('nearest-rank 百分位需要非空样本');
  }
  if (!(p > 0 && p <= 1)) {
    throw new Error(`分位 p 必须落在 (0, 1]：${p}`);
  }
  for (let i = 1; i < sortedAscending.length; i++) {
    if (sortedAscending[i]! < sortedAscending[i - 1]!) {
      throw new Error('nearest-rank 百分位要求输入已升序排列');
    }
  }
  const rank = Math.ceil(p * sortedAscending.length);
  const idx = Math.min(Math.max(rank, 1), sortedAscending.length) - 1;
  return sortedAscending[idx]!;
}

/**
 * 正式标定（OQ-013 裁决）：对 SNAPSHOT_01 的 calibration raw_bm25 样本计算 P05 / P95。
 * @param rawScores 标定查询产生的 raw_bm25 样本（未排序即可）
 */
export function calibrate(rawScores: number[]): Bm25Calibration {
  if (rawScores.length === 0) {
    throw new Error('标定样本为空：至少需要一个标定查询的 raw_bm25');
  }
  const sorted = [...rawScores].sort((a, b) => a - b);
  return {
    method: 'nearest-rank',
    n: sorted.length,
    p05: nearestRankPercentile(sorted, 0.05),
    p95: nearestRankPercentile(sorted, 0.95),
  };
}
