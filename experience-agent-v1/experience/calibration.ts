/**
 * experience/calibration.ts — BM25 标定代码路径（spec/frozen.md §5.5 / tasks/phase0.md T6）
 *
 * 规格要求：
 *   标定必须在最终 SNAPSHOT_01 上做，绝不能在 Acquisition 生长过程中做。
 *   标定查询集 = Acquisition Set 的任务查询（不允许 Validation / Transfer / Pilot 参与标定）。
 *   Phase 0 阶段 P05/P95 可以先用占位常数，但标定代码路径必须存在。
 *
 * OQ-013（open）：P05/P95 的百分位算法（最近秩 / 线性插值 / 其他）未定义。
 * 因此 calibrate() 必须显式传入 percentile 方法，不设默认值；
 * 正式标定（Phase 1）运行前由人工指定口径。
 */

export interface Bm25Calibration {
  p05: number;
  p95: number;
}

/** 百分位算法签名；OQ-013 未裁决，不提供默认实现。 */
export type PercentileMethod = (sortedAscending: number[], p: number) => number;

/**
 * Phase 0 占位常数（spec/frozen.md §5.5 明确允许）。
 * 标注：占位，未标定。Phase 1 在 SNAPSHOT_01 上跑正式标定后由 FREEZE 的 P05/P95 替换。
 * 只要 P95 > P05，公式路径即被完整执行。
 */
export const PLACEHOLDER_CALIBRATION: Bm25Calibration = {
  p05: -10,
  p95: -1,
};

/**
 * 标定：对 Acquisition Set 的任务查询收集 raw_bm25，得到 P05 / P95。
 * @param rawScores 所有标定查询产生的 raw_bm25 样本
 * @param percentile 百分位算法（OQ-013 未裁决，由调用方显式给出，无默认）
 */
export function calibrate(rawScores: number[], percentile: PercentileMethod): Bm25Calibration {
  if (rawScores.length === 0) {
    throw new Error('标定样本为空：至少需要一个 Acquisition Set 查询的 raw_bm25');
  }
  const sorted = [...rawScores].sort((a, b) => a - b);
  return {
    p05: percentile(sorted, 0.05),
    p95: percentile(sorted, 0.95),
  };
}
