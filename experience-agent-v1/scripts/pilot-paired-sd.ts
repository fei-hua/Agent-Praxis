/**
 * scripts/pilot-paired-sd.ts — 第 ② 项：配对差异 / paired SD（只读）
 *
 * 冻结口径（人工要求 2026-09-30，已确认）：
 *   分析集一律用 **evidence-eligible**：
 *     B−A        nominal 9 / valid 9 / eligible 9
 *     C_frozen−B nominal 9 / valid 9 / eligible 8   （排除 B01 那一对：C 侧无工作区指纹）
 *   二元量（CDA / Task Success）：**只报配对差异方向与计数**（B>A / B=A / B<A + 比例），不做 SD/CI
 *   连续量（elapsed_ms / tokens）：difference mean + paired SD + 95% CI（t 分布，df = n−1）
 *   **不插补**：某侧缺值时该对剔除，并在报告中列出被剔除的对与原因
 *
 * 用法：node scripts/pilot-paired-sd.ts
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, '..', 'pilot-runs');

interface Obs {
  group: string; arm: string; run_id: string;
  cda: number | null; task_success: boolean | null;
  elapsed_ms: number | null; tokens: number | null;
  pair_eligible: boolean; evidence_status: string;
}

const rows = readJsonUtf8<{ rows: Obs[] }>(path.join(RUNS, 'pilot-observations.json')).rows;
const byGroup = new Map<string, Map<string, Obs>>();
for (const r of rows) {
  if (!byGroup.has(r.group)) byGroup.set(r.group, new Map());
  byGroup.get(r.group)!.set(r.arm, r);
}
const groups = [...byGroup.keys()].sort();
const elig = (g: string, arm: string): boolean => byGroup.get(g)?.get(arm)?.pair_eligible === true;

/** t 分布 97.5% 分位（双侧 95% CI） */
const T975: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
};

const md: string[] = ['# Pilot 配对差异 / paired SD（冻结口径：evidence-eligible 集，不插补）', ''];
const log: string[] = [];
const say = (s: string): void => { console.log(s); log.push(s); };

function pairs(aArm: string, bArm: string): Array<{ g: string; a: Obs; b: Obs }> {
  return groups.filter((g) => elig(g, aArm) && elig(g, bArm)).map((g) => ({ g, a: byGroup.get(g)!.get(aArm)!, b: byGroup.get(g)!.get(bArm)! }));
}

function binary(name: string, get: (o: Obs) => boolean | null, aArm: string, bArm: string): void {
  const ps = pairs(aArm, bArm);
  const usable: Array<{ g: string; a: boolean; b: boolean }> = [];
  const dropped: string[] = [];
  for (const p of ps) {
    const av = get(p.a), bv = get(p.b);
    if (av === null || bv === null) dropped.push(`${p.g}（${av === null ? aArm : bArm} 侧无记录）`);
    else usable.push({ g: p.g, a: av, b: bv });
  }
  const up = usable.filter((u) => u.b && !u.a).length;
  const same = usable.filter((u) => u.b === u.a).length;
  const down = usable.filter((u) => !u.b && u.a).length;
  const n = usable.length;
  say(`\n--- ${name}：${bArm} − ${aArm}（二元，只报方向与计数）---`);
  say(`  nominal=${ps.length + (groups.filter((g) => elig(g, aArm) && elig(g, bArm)).length - ps.length)}  eligible_pairs=${ps.length}  usable_pairs=${n}`);
  say(`  ${bArm}>${aArm} : ${up}  (${n ? ((up / n) * 100).toFixed(1) : '-'}%)`);
  say(`  ${bArm}=${aArm} : ${same}  (${n ? ((same / n) * 100).toFixed(1) : '-'}%)`);
  say(`  ${bArm}<${aArm} : ${down}  (${n ? ((down / n) * 100).toFixed(1) : '-'}%)`);
  if (dropped.length) say(`  剔除的对（不插补）：${dropped.join(', ')}`);
  const dir = usable.map((u) => `${u.g}:${aArm}=${u.a ? 1 : 0}→${bArm}=${u.b ? 1 : 0}`).join('  ');
  say(`  逐对：${dir}`);
  md.push(`## ${name}（${bArm} − ${aArm}，二元）`, '', `- eligible_pairs = ${ps.length}，usable_pairs = ${n}`, `- ${bArm}>${aArm} = ${up}（${n ? ((up / n) * 100).toFixed(1) : '-'}%）`, `- ${bArm}=${aArm} = ${same}（${n ? ((same / n) * 100).toFixed(1) : '-'}%）`, `- ${bArm}<${aArm} = ${down}（${n ? ((down / n) * 100).toFixed(1) : '-'}%）`, dropped.length ? `- 剔除（不插补）：${dropped.join(', ')}` : '', '');
}

function continuous(name: string, get: (o: Obs) => number | null, aArm: string, bArm: string): void {
  const ps = pairs(aArm, bArm);
  const diffs: Array<{ g: string; a: number; b: number; d: number }> = [];
  const dropped: string[] = [];
  for (const p of ps) {
    const av = get(p.a), bv = get(p.b);
    if (av === null || bv === null) dropped.push(`${p.g}（缺值）`);
    else diffs.push({ g: p.g, a: av, b: bv, d: bv - av });
  }
  const n = diffs.length;
  const ds = diffs.map((x) => x.d);
  const mean = ds.reduce((x, y) => x + y, 0) / n;
  const sd = n > 1 ? Math.sqrt(ds.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1)) : Number.NaN;
  const se = sd / Math.sqrt(n);
  const t = T975[n - 1] ?? 1.96;
  say(`\n--- ${name}：${bArm} − ${aArm}（连续，均值/SD/95%CI）---`);
  say(`  eligible_pairs=${ps.length}  usable_pairs=${n}   difference_mean=${mean.toFixed(1)}   paired_SD=${Number.isFinite(sd) ? sd.toFixed(1) : '-'}   95%CI=[${(mean - t * se).toFixed(1)}, ${(mean + t * se).toFixed(1)}]   (t=${t}, df=${n - 1})`);
  if (dropped.length) say(`  剔除的对（不插补）：${dropped.join(', ')}`);
  say('  逐对差值：' + diffs.map((x) => `${x.g}: ${x.a}→${x.b} (${x.d > 0 ? '+' : ''}${x.d})`).join('  '));
  md.push(`## ${name}（${bArm} − ${aArm}，连续）`, '', `- eligible_pairs = ${ps.length}，usable_pairs = ${n}`, `- difference mean = ${mean.toFixed(1)}`, `- paired SD = ${Number.isFinite(sd) ? sd.toFixed(1) : '-'}`, `- 95% CI = [${(mean - t * se).toFixed(1)}, ${(mean + t * se).toFixed(1)}]（t=${t}, df=${n - 1}）`, dropped.length ? `- 剔除（不插补）：${dropped.join(', ')}` : '', '');
}

say('=== Pilot 配对差异 / paired SD（冻结口径） ===');
say(`分析集：B−A eligible=${groups.filter((g) => elig(g, 'A') && elig(g, 'B')).length}   C_frozen−B eligible=${groups.filter((g) => elig(g, 'C_frozen') && elig(g, 'B')).length}`);
say(`（nominal 9 / valid 9；B−A eligible 9，C−B eligible 8 ——B01|R1|C_frozen 保留 valid 但不进配对）`);

binary('CDA', (o) => (o.cda === null ? null : o.cda === 1), 'A', 'B');
binary('CDA', (o) => (o.cda === null ? null : o.cda === 1), 'B', 'C_frozen');
binary('Task Success', (o) => o.task_success, 'A', 'B');
binary('Task Success', (o) => o.task_success, 'B', 'C_frozen');

continuous('elapsed_ms', (o) => o.elapsed_ms, 'A', 'B');
continuous('elapsed_ms', (o) => o.elapsed_ms, 'B', 'C_frozen');
continuous('tokens', (o) => o.tokens, 'A', 'B');
continuous('tokens', (o) => o.tokens, 'B', 'C_frozen');

say('\n注：二元量只报方向/计数（按要求）；Power Analysis 若以 CDA 为主要指标，须按二元检验单独定样本量，不得套用连续量的 paired SD。');
md.push('', '> 注：二元量只报方向/计数；Power Analysis 若以 CDA 为主要指标，须按二元检验单独定样本量，不得套用连续量的 paired SD。', '');
writeFileSync(path.join(RUNS, 'pilot-paired-sd.md'), md.join('\n'), 'utf8');
console.log('\n已写出：pilot-runs/pilot-paired-sd.md');
