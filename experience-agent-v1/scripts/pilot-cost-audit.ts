/**
 * scripts/pilot-cost-audit.ts — 第 ③ 项：成本 / 延迟分布审计（只读，不剔除任何观测）
 *
 * 口径（人工要求 2026-09-30）：
 *   - 使用**全部 28 条 valid observation**（含 B01|R1|C_frozen：它的 elapsed/tokens 有权威轨迹证据，
 *     虽不具备 C−B 配对资格，但成本审计不应删除它）；
 *   - 按 A / C_frozen / B 分组报告：n, mean, median, SD(样本, n−1), Q1, Q3, P90, P95, max；
 *   - 分位数用线性插值（numpy 默认口径），在报告中注明；
 *   - 高值只**标注**（> Q3 + 1.5·IQR），一律不剔除。
 *
 * 用法：node scripts/pilot-cost-audit.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, '..', 'pilot-runs');

interface Obs {
  group: string; arm: string; run_id: string;
  elapsed_ms: number | null; tokens: number | null;
  evidence_status: string; pair_eligible: boolean;
}

const data = readJsonUtf8<{ rows: Obs[] }>(path.join(RUNS, 'pilot-observations.json'));
const rows = data.rows;

/** 线性插值分位数（numpy 默认） */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

interface Stats { n: number; mean: number; median: number; sd: number; q1: number; q3: number; p90: number; p95: number; max: number; min: number }

function stats(values: number[]): Stats {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n, mean, median: quantile(s, 0.5), sd: Math.sqrt(variance),
    q1: quantile(s, 0.25), q3: quantile(s, 0.75), p90: quantile(s, 0.9), p95: quantile(s, 0.95),
    max: s[n - 1]!, min: s[0]!,
  };
}

const fmt = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '-');
const arms = ['A', 'C_frozen', 'B'];

const md: string[] = [
  '# Pilot 成本 / 延迟分布审计（28 条 valid observation · 未剔除任何观测）',
  '',
  '> 口径：分位数用线性插值（numpy 默认）；SD 为样本标准差（n−1）；',
  '> 高值定义 = 超过 Q3 + 1.5·IQR，仅**标注**，**不剔除**。',
  '> B01|R1|C_frozen 虽无配对资格，但其 elapsed/tokens 有权威轨迹证据，纳入本审计。',
  '',
];

console.log('=== Pilot 成本 / 延迟分布审计（n=28，未剔除） ===');
for (const metric of ['elapsed_ms', 'tokens'] as const) {
  const label = metric === 'elapsed_ms' ? '耗时 elapsed_ms' : 'Token 用量 tokens';
  console.log(`\n--- ${label} ---`);
  console.log('  arm        n   mean        median      SD          Q1          Q3          P90         P95         max');
  md.push(`## ${label}`, '', '| arm | n | mean | median | SD | Q1 | Q3 | P90 | P95 | max |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const arm of arms) {
    const vals = rows.filter((r) => r.arm === arm && r[metric] !== null).map((r) => r[metric] as number);
    const st = stats(vals);
    const line = `  ${arm.padEnd(10)} ${String(st.n).padEnd(3)} ${fmt(st.mean).padEnd(11)} ${fmt(st.median).padEnd(11)} ${fmt(st.sd).padEnd(11)} ${fmt(st.q1).padEnd(11)} ${fmt(st.q3).padEnd(11)} ${fmt(st.p90).padEnd(11)} ${fmt(st.p95).padEnd(11)} ${fmt(st.max)}`;
    console.log(line);
    md.push(`| ${arm} | ${st.n} | ${fmt(st.mean)} | ${fmt(st.median)} | ${fmt(st.sd)} | ${fmt(st.q1)} | ${fmt(st.q3)} | ${fmt(st.p90)} | ${fmt(st.p95)} | ${fmt(st.max)} |`);
    // 高值标注（不剔除）
    const hi = st.q3 + 1.5 * (st.q3 - st.q1);
    const flagged = rows.filter((r) => r.arm === arm && r[metric] !== null && (r[metric] as number) > hi);
    if (flagged.length) {
      console.log(`     标注（> Q3+1.5·IQR = ${fmt(hi)}，保留不剔除）：` + flagged.map((r) => `${r.group}|${r.arm}=${fmt(r[metric] as number, 0)}`).join(', '));
      md.push('', `> ${label} 高值标注（阈值 ${fmt(hi)}，**保留不剔除**）：` + flagged.map((r) => `${r.group}|${r.arm}=${fmt(r[metric] as number, 0)}`).join(', '));
    }
  }
}

// 全样本 top5（不分组）
for (const metric of ['elapsed_ms', 'tokens'] as const) {
  const top = [...rows].filter((r) => r[metric] !== null).sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 5);
  console.log(`\n--- 全样本 top5（${metric}） ---`);
  for (const r of top) console.log(`  ${r.group}|${r.arm}  ${fmt(r[metric] as number, 0)}  （${r.evidence_status}）`);
}

// 配对口径复核（冻结值）
const groups = [...new Set(rows.map((r) => r.group))].sort();
const elig = (g: string, a: string): boolean => rows.some((r) => r.group === g && r.arm === a && r.pair_eligible);
console.log('\n--- 冻结的配对口径复核 ---');
console.log(`  B−A eligible = ${groups.filter((g) => elig(g, 'A') && elig(g, 'B')).length}（冻结值 9）`);
console.log(`  C−B eligible = ${groups.filter((g) => elig(g, 'C_frozen') && elig(g, 'B')).length}（冻结值 8）`);
console.log(`  成本审计样本量 = ${rows.length}（全部 valid observation）`);

md.push('', '## 冻结的配对口径复核', '', `- B−A eligible = ${groups.filter((g) => elig(g, 'A') && elig(g, 'B')).length}（冻结值 9）`, `- C−B eligible = ${groups.filter((g) => elig(g, 'C_frozen') && elig(g, 'B')).length}（冻结值 8）`, `- 成本审计样本量 = ${rows.length}（全部 valid observation）`, '');
writeFileSync(path.join(RUNS, 'pilot-cost-audit.md'), md.join('\n'), 'utf8');
console.log('\n已写出：pilot-runs/pilot-cost-audit.md');
console.log('（只读引用，未修改任何 observation / 记录卡 / 轨迹）');
