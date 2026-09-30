/**
 * scripts/lib/stats.ts — 统计工具的**唯一实现**（Power Analysis 与 MDE 共用）
 *
 * 目的（人工要求 2026-09-30）：统计公式只写一份，避免"两处实现分叉"——
 * 上一轮 McNemar 的拒绝域 bug 正是这类分叉的典型风险。
 *
 * 提供：
 *   - 二项 pmf（log-gamma 防溢出）
 *   - 精确 McNemar 拒绝域与 power（双侧 α=0.05；d=0 永不拒绝）
 *   - 给定 (π_d, q) 反查所需 N
 *   - 连续指标的 paired-t 样本量 / MDE 互反公式（正态近似 + 常用修正）
 *   - t 分布 97.5% 分位小表
 */

export const Z_A = 1.959964; // 双侧 α=0.05
export const Z_B = 0.841621; // power = 0.80

export const T975: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
};

const LF: number[] = [0, 0];
export function logFact(n: number): number {
  if (LF[n] !== undefined) return LF[n]!;
  let v = LF[LF.length - 1]!;
  for (let i = LF.length; i <= n; i++) { v += Math.log(i); LF[i] = v; }
  return LF[n]!;
}
export const logC = (n: number, k: number): number => logFact(n) - logFact(k) - logFact(n - k);

export function binomPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logC(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** 精确二项 McNemar（双侧）：2·min(P(X≤x), P(X≥x)) ≤ α；d=0 永不拒绝 */
export function mcnemarRejects(x: number, d: number, alpha = 0.05): boolean {
  if (d === 0) return false;
  let lower = 0;
  for (let k = 0; k <= x; k++) lower += binomPmf(k, d, 0.5);
  let upper = 0;
  for (let k = x; k <= d; k++) upper += binomPmf(k, d, 0.5);
  return 2 * Math.min(lower, upper) <= alpha;
}

/** power：π_d = 不一致对比例，q = 不一致对中偏向处理组的比例 */
export function mcnemarPower(n: number, piD: number, q: number, alpha = 0.05): number {
  let power = 0;
  for (let d = 0; d <= n; d++) {
    const pd = binomPmf(d, n, piD);
    if (pd < 1e-12) continue;
    let rej = 0;
    for (let x = 0; x <= d; x++) if (mcnemarRejects(x, d, alpha)) rej += binomPmf(x, d, q);
    power += pd * rej;
  }
  return power;
}

/** 给定 (π_d, q) 反查达到 target power 的最小 N（cap 内无解返回 null） */
export function mcnemarN(piD: number, q: number, target = 0.8, cap = 400): number | null {
  for (let n = 4; n <= cap; n++) if (mcnemarPower(n, piD, q) >= target) return n;
  return null;
}

// ---------- 连续指标（paired t 口径，正态近似 + 常用修正） ----------
/** N = ((zα+zβ)/dz)² + zα²/2 */
export function pairedNForDz(dz: number): number {
  const nApprox = ((Z_A + Z_B) / dz) ** 2;
  return nApprox + (Z_A * Z_A) / 2;
}
/** 反解：N 固定时的最小可检出 |d_z| */
export function mdeDzForN(n: number): number {
  const denom = n - (Z_A * Z_A) / 2;
  if (denom <= 0) return Number.NaN;
  return (Z_A + Z_B) / Math.sqrt(denom);
}
