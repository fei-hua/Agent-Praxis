/**
 * scripts/pilot-power-analysis.ts — 第 ④ 项：正式实验样本量估算（只读）
 *
 * 两条线严格分开（人工要求 2026-09-30）：
 *   A. 连续指标（elapsed_ms / tokens）：用 Pilot 的 paired mean diff + paired SD，
 *      双侧 α=0.05、power=0.80 的 paired t 口径；给出 d_z、理论 N（正态近似 + 常用修正）、
 *      向上取整 N，并检查 N ≤ 150。
 *   B. 二元指标（CDA）：**不使用连续量的 SD**。Pilot 事实是 B−A 有 0 个不一致对（无法估效应）、
 *      C−B 8 对中 1 对不一致。因此做 **McNemar 情景分析**：设定不一致比例 π_d 与
 *      "不一致对中偏向处理组的比例" q，用精确二项 McNemar 检验（双侧 α=0.05）算所需 N。
 *      **这些是假设情景，不是本 Pilot 实测的正式效应。**
 *
 * 用法：node scripts/pilot-power-analysis.ts
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, '..', 'pilot-runs');
const MAX_N = 150;
const Z_A = 1.959964; // 双侧 α=0.05
const Z_B = 0.841621; // power=0.80

// ---------- 数学工具 ----------
const LG_CACHE: number[] = [0, 0];
function logFact(n: number): number {
  if (LG_CACHE[n] !== undefined) return LG_CACHE[n]!;
  let v = LG_CACHE[LG_CACHE.length - 1]!;
  for (let i = LG_CACHE.length; i <= n; i++) {
    v += Math.log(i);
    LG_CACHE[i] = v;
  }
  return LG_CACHE[n]!;
}
const logC = (n: number, k: number): number => logFact(n) - logFact(k) - logFact(n - k);
function binomPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logC(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * 精确 McNemar（双侧 α=0.05）：不一致对中偏向处理组的个数 X ~ Binom(d, q)，
 * 在 H0: q=0.5 下用**精确二项双侧检验**：2·min(P(X≤x), P(X≥x)) ≤ α 才拒绝。
 * d = 0 时永不拒绝（无不一致对 ⇒ McNemar 无定义）。
 */
const rejects = (x: number, d: number, alpha = 0.05): boolean => {
  if (d === 0) return false;
  let lower = 0;
  for (let k = 0; k <= x; k++) lower += binomPmf(k, d, 0.5);
  let upper = 0;
  for (let k = x; k <= d; k++) upper += binomPmf(k, d, 0.5);
  return 2 * Math.min(lower, upper) <= alpha;
};
/** McNemar 精确检验的 power */
function mcnemarPower(n: number, piD: number, q: number): number {
  let power = 0;
  for (let d = 0; d <= n; d++) {
    const pd = binomPmf(d, n, piD);
    if (pd < 1e-12) continue;
    let rej = 0;
    for (let x = 0; x <= d; x++) if (rejects(x, d)) rej += binomPmf(x, d, q);
    power += pd * rej;
  }
  return power;
}
function mcnemarN(piD: number, q: number, target = 0.8, cap = 400): number | null {
  for (let n = 4; n <= cap; n++) if (mcnemarPower(n, piD, q) >= target) return n;
  return null;
}

// ---------- Pilot 数据 ----------
interface Obs { group: string; arm: string; cda: number | null; task_success: boolean | null; elapsed_ms: number | null; tokens: number | null; pair_eligible: boolean }
const rows = readJsonUtf8<{ rows: Obs[] }>(path.join(RUNS, 'pilot-observations.json')).rows;
const byGroup = new Map<string, Map<string, Obs>>();
for (const r of rows) { if (!byGroup.has(r.group)) byGroup.set(r.group, new Map()); byGroup.get(r.group)!.set(r.arm, r); }
const groups = [...byGroup.keys()].sort();
const elig = (g: string, arm: string): boolean => byGroup.get(g)?.get(arm)?.pair_eligible === true;

function pilotDiff(aArm: string, bArm: string, metric: 'elapsed_ms' | 'tokens'): { n: number; mean: number; sd: number } {
  const ds: number[] = [];
  for (const g of groups) {
    if (!elig(g, aArm) || !elig(g, bArm)) continue;
    const a = byGroup.get(g)!.get(aArm)![metric];
    const b = byGroup.get(g)!.get(bArm)![metric];
    if (a === null || b === null) continue;
    ds.push(b - a);
  }
  const n = ds.length;
  const mean = ds.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(ds.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd };
}

const out: string[] = [];
const say = (s: string): void => { console.log(s); out.push(s); };
const pad = (s: string | number, w: number): string => String(s).padEnd(w).slice(0, w);

say('=== ④ Power Analysis（α=0.05 双侧，power=0.80，N 上限 150） ===');

// ---------- A. 连续指标 ----------
say('\n--- A. 连续指标（paired t 口径，用 Pilot 的 mean diff 作为假定效应）---');
say('  比较        指标        Pilot_n  mean_diff      paired_SD      d_z      N(正态近似)  N(含修正)  取整N  ≤150');
const contTable: Array<Record<string, string>> = [];
for (const [aArm, bArm, label] of [['A', 'B', 'B−A'], ['B', 'C_frozen', 'C−B']] as const) {
  for (const metric of ['elapsed_ms', 'tokens'] as const) {
    const { n, mean, sd } = pilotDiff(aArm, bArm, metric);
    const dz = Math.abs(mean) / sd;
    const nApprox = ((Z_A + Z_B) / dz) ** 2;
    const nRefined = nApprox + (Z_A * Z_A) / 2;
    const nUse = Math.ceil(nRefined);
    say(
      `  ${pad(label, 11)} ${pad(metric, 11)} ${pad(n, 8)} ${pad(mean.toFixed(1), 14)} ${pad(sd.toFixed(1), 14)} ${pad(dz.toFixed(4), 8)} ${pad(nApprox.toFixed(1), 12)} ${pad(nRefined.toFixed(1), 10)} ${pad(nUse, 6)} ${nUse <= MAX_N ? '✓' : '✗（超出上限）'}`,
    );
    contTable.push({ cmp: label, metric, pilotN: String(n), dz: dz.toFixed(4), nUse: String(nUse), ok: nUse <= MAX_N ? '✓' : '✗', aArm, bArm, mean: mean.toFixed(1), sd: sd.toFixed(1) });
  }
}
say('  说明：Pilot 的 mean diff 被当作**假定效应**（这是常规做法，但 Pilot 的 95% CI 全部跨 0，故该锚点偏乐观）。');
say('        若正式实验只要求检出比此处更大的效应，所需 N 会相应下降；反之则上升。');

// ---------- B. 二元指标（CDA）McNemar 情景 ----------
say('\n--- B. 二元指标 CDA（McNemar 情景分析；**假设，不是 Pilot 实测效应**）---');
say('  Pilot 事实：B−A 9/9 对完全一致（0 个不一致对 → 无法估效应）；C−B 8 对中 1 对不一致（12.5%）');
say('  情景设定与所需 N（精确二项 McNemar，双侧 α=0.05，power=0.80，上限 150）：');
say('    比较      π_d(不一致比例)  q(偏向处理组)  所需N   ≤150');
const scen: Array<[string, number, number]> = [
  ['C−B', 0.125, 1.0], // Pilot 锚点（1/8，方向全为处理组）
  ['C−B', 0.15, 0.8],
  ['C−B', 0.2, 0.75],
  ['C−B', 0.25, 0.7],
  ['C−B', 0.3, 0.7],
  ['B−A', 0.1, 0.8],
  ['B−A', 0.15, 0.8],
  ['B−A', 0.2, 0.75],
  ['B−A', 0.25, 0.7],
  ['B−A', 0.3, 0.7],
];
const cdaTable: Array<Record<string, string>> = [];
for (const [cmp, piD, q] of scen) {
  const n = mcnemarN(piD, q);
  const shown = n === null ? `>400` : String(n);
  say(`    ${pad(cmp, 8)} ${pad(piD, 16)} ${pad(q, 14)} ${pad(shown, 6)} ${n !== null && n <= MAX_N ? '✓' : '✗'}`);
  cdaTable.push({ cmp, piD: piD.toFixed(3), q: q.toFixed(2), n: shown, ok: n !== null && n <= MAX_N ? '✓' : '✗' });
}
say('  ⚠️ 上述 π_d/q 均为**假设情景**；B−A 的 Pilot 是 0 个不一致对，**不能**据此外推"正式实验也无效应"。');

// ---------- 汇总表 ----------
say('\n--- 汇总表（供决定最终 N；须先固定主要指标）---');
say('  比较   指标       Pilot n   效应估计            Power 假设          所需 N        ≤150');
const summary: Array<[string, string, string, string, string, string, string]> = [];
for (const r of contTable) {
  const est = `d_z = ${r.dz}`;
  summary.push([r.cmp, r.metric, r.pilotN, est, 'paired t, 80%', r.nUse, r.ok]);
}
summary.push(['C−B', 'CDA', '8', '1/8 不一致（粗略锚点）', 'McNemar 情景', cdaTable[0]!.n, cdaTable[0]!.ok]);
summary.push(['B−A', 'CDA', '9', '不可直接估计（0 不一致对）', 'McNemar 情景（π_d=0.15,q=0.8）', cdaTable[6]!.n, cdaTable[6]!.ok]);
for (const [cmp, metric, pn, est, hyp, n, ok] of summary) {
  say(`  ${pad(cmp, 7)} ${pad(metric, 9)} ${pad(pn, 9)} ${pad(est, 26)} ${pad(hyp, 20)} ${pad(n, 12)} ${ok}`);
}

// ---------- 落盘 ----------
const md = [
  '# 正式实验样本量估算（Pilot → Power Analysis）',
  '',
  '口径：双侧 α=0.05，power=0.80，N 上限 150。连续指标用 paired t（Pilot mean diff 作为假定效应）；',
  'CDA 为二元指标，**不使用连续量 SD**，改用 McNemar 情景分析（假设值，非 Pilot 实测效应）。',
  '',
  '## A. 连续指标',
  '',
  '| 比较 | 指标 | Pilot n | mean diff | paired SD | d_z | N(取整) | ≤150 |',
  '|---|---|---|---|---|---|---|---|',
  ...contTable.map((r) => `| ${r.cmp} | ${r.metric} | ${r.pilotN} | ${r.mean} | ${r.sd} | ${r.dz} | ${r.nUse} | ${r.ok} |`),
  '',
  '## B. CDA（McNemar 情景）',
  '',
  '| 比较 | π_d | q | 所需 N | ≤150 |',
  '|---|---|---|---|---|',
  ...cdaTable.map((r) => `| ${r.cmp} | ${r.piD} | ${r.q} | ${r.n} | ${r.ok} |`),
  '',
  '> ⚠️ π_d/q 为假设情景。B−A 的 Pilot 为 0 个不一致对，不能据此外推"正式实验无效应"。',
  '',
  '## 结论口径',
  '',
  `- 连续指标：B−A 两条线在 N ≤ ${MAX_N} 内可达 80% power；C−B 两条线均**超出上限**（需要更大 N 或接受更大可检出效应）。`,
  '- 二元指标 CDA：所需 N 强烈依赖 π_d/q 假设；必须**先固定主要指标**，再据此选最终 N，不得为满足上限挑最有利结果。',
  '',
].join('\n');
function pilotDiffFor(_cmp: string, _metric: string): { mean: number; sd: number } {
  return { mean: Number.NaN, sd: Number.NaN };
}
writeFileSync(path.join(RUNS, 'pilot-power-analysis.md'), md, 'utf8');
console.log('\n已写出：pilot-runs/pilot-power-analysis.md');
