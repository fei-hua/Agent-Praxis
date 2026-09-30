/**
 * scripts/pilot-mde.ts — 反向 MDE（最小可检出效应）@ N = 100 / 120 / 150（只读）
 *
 * 冻结设定：α=0.05 双侧，power=0.80。
 *   连续指标：MDE 以 |d_z| 表示，并换算成实际单位（用 Pilot 的 paired SD 作为**方差锚点**；
 *            Pilot 的 mean diff 只用于方差规划，不作为"真正重要的效应"）。
 *   CDA（二元）：不使用连续型 MDE；用 McNemar 情景回答
 *            "在给定 N 下，需要多强的不一致效应（π_d，方向 q）才能达到 80% power"。
 *
 * 交叉校验：用同一份统计实现复算 Power Analysis 已报告的 N（π_d=0.125/q=1 → 62；
 *            π_d=0.2/q=0.75 → 168），若不一致则报错——防止两处实现分叉。
 *
 * 用法：node scripts/pilot-mde.ts
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonUtf8 } from './lib/json-io.ts';
import { mcnemarN, mcnemarPower, mdeDzForN } from './lib/stats.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(HERE, '..', 'pilot-runs');
const NS = [100, 120, 150];

interface Obs { group: string; arm: string; elapsed_ms: number | null; tokens: number | null; pair_eligible: boolean }
const rows = readJsonUtf8<{ rows: Obs[] }>(path.join(RUNS, 'pilot-observations.json')).rows;
const byGroup = new Map<string, Map<string, Obs>>();
for (const r of rows) { if (!byGroup.has(r.group)) byGroup.set(r.group, new Map()); byGroup.get(r.group)!.set(r.arm, r); }
const groups = [...byGroup.keys()].sort();
const elig = (g: string, arm: string): boolean => byGroup.get(g)?.get(arm)?.pair_eligible === true;

/** Pilot 的 paired SD（仅作方差锚点） */
function pilotSd(aArm: string, bArm: string, metric: 'elapsed_ms' | 'tokens'): number {
  const ds: number[] = [];
  for (const g of groups) {
    if (!elig(g, aArm) || !elig(g, bArm)) continue;
    const a = byGroup.get(g)!.get(aArm)![metric];
    const b = byGroup.get(g)!.get(bArm)![metric];
    if (a === null || b === null) continue;
    ds.push(b - a);
  }
  const mean = ds.reduce((x, y) => x + y, 0) / ds.length;
  return Math.sqrt(ds.reduce((x, y) => x + (y - mean) ** 2, 0) / (ds.length - 1));
}

const out: string[] = [];
const say = (s: string): void => { console.log(s); out.push(s); };
const pad = (s: string | number, w: number): string => String(s).padEnd(w).slice(0, w);

say('=== 反向 MDE（α=0.05 双侧，power=0.80；N = 100 / 120 / 150） ===');

// ---------- 交叉校验 ----------
const check1 = mcnemarN(0.125, 1.0);
const check2 = mcnemarN(0.2, 0.75);
say(`\n交叉校验（与 Power Analysis 报告值比对）：π_d=0.125/q=1.0 → ${check1}（期望 62）；π_d=0.2/q=0.75 → ${check2}（期望 168）`);
if (check1 !== 62 || check2 !== 168) {
  console.error('❌ 交叉校验失败：统计实现与 Power Analysis 不一致，拒绝输出 MDE');
  process.exit(3);
}
say('  ✅ 一致（同一实现，无分叉）');

// ---------- 连续指标 MDE ----------
say('\n--- 连续指标：MDE = 最小可检出 |d_z|（括号内为换算成实际单位） ---');
say('  比较   指标        SD(锚点)      N=100                N=120                N=150');
const contRows: Array<[string, string, number, ...string[]]> = [];
for (const [aArm, bArm, label] of [['A', 'B', 'B−A'], ['B', 'C_frozen', 'C−B']] as const) {
  for (const metric of ['elapsed_ms', 'tokens'] as const) {
    const sd = pilotSd(aArm, bArm, metric);
    const cells = NS.map((n) => {
      const dz = mdeDzForN(n);
      return `d_z=${dz.toFixed(4)} (${Math.round(dz * sd).toLocaleString('en-US')})`;
    });
    say(`  ${pad(label, 7)} ${pad(metric, 10)} ${pad(String(Math.round(sd)), 12)} ${pad(cells[0]!, 20)} ${pad(cells[1]!, 20)} ${cells[2]!}`);
    contRows.push([label, metric, Math.round(sd), ...cells]);
  }
}
say('  说明：单位换算用 Pilot 的 paired SD 作为方差锚点；**Pilot 的 mean diff 不参与**（只做方差规划）。');

// ---------- CDA：McNemar 情景 MDE ----------
say('\n--- CDA（二元）：在给定 N 下达到 80% power 所需的最弱不一致效应 π_d ---');
say('  （q = 不一致对中偏向处理组的比例；q=1.00 表示方向完全一致）');
say('  比较   q      N=100                       N=120                       N=150');
const cdaRows: Array<[string, string, ...string[]]> = [];
for (const [cmp] of [['B−A'], ['C−B']] as const) {
  for (const q of [1.0, 0.8, 0.75]) {
    const cells = NS.map((n) => {
      // 网格搜索最小 π_d
      let best: number | null = null;
      for (let pi = 0.005; pi <= 0.6001; pi += 0.0025) {
        if (mcnemarPower(n, pi, q) >= 0.8) { best = pi; break; }
      }
      if (best === null) return '>0.60（不现实）';
      const expectedDiscordant = best * n;
      return `π_d≈${best.toFixed(4)}（约 ${expectedDiscordant.toFixed(1)} 对不一致）`;
    });
    say(`  ${pad(cmp, 6)} ${pad(q.toFixed(2), 6)} ${pad(cells[0]!, 27)} ${pad(cells[1]!, 27)} ${cells[2]!}`);
    cdaRows.push([cmp, q.toFixed(2), ...cells]);
  }
}
say('  ⚠️ 这些是**情景值**：Pilot 对 B−A 是 0 个不一致对、对 C−B 是 1/8，均不足以估计真实效应。');

say('\n--- 结论性描述（不做挑选） ---');
say('  · N=150 时连续指标的可检出下限：' + NS.slice(-1).map((n) => `|d_z|≥${mdeDzForN(n).toFixed(4)}`).join('、'));
for (const [aArm, bArm, label] of [['A', 'B', 'B−A'], ['B', 'C_frozen', 'C−B']] as const) {
  for (const metric of ['elapsed_ms', 'tokens'] as const) {
    const sd = pilotSd(aArm, bArm, metric);
    say(`    ${label} / ${metric}：N=150 只能检出 ≥ ${Math.round(mdeDzForN(150) * sd).toLocaleString('en-US')} 的差异（Pilot SD=${Math.round(sd).toLocaleString('en-US')}）`);
  }
}
say('  · 若正式实验以 CDA 为主要指标，必须在**事先**规定"最小有意义的不一致效应（π_d, q）"，');
say('    再用本表反查 N；不得用 Pilot 的 0/9 或 1/8 直接外推。');

const md = [
  '# 反向 MDE @ N = 100 / 120 / 150（α=0.05 双侧，power=0.80）',
  '',
  `交叉校验：π_d=0.125/q=1.0 → ${check1}（期望 62）、π_d=0.2/q=0.75 → ${check2}（期望 168）—— 同一实现，无分叉。`,
  '',
  '## 连续指标：最小可检出 |d_z|（括号为实际单位，用 Pilot paired SD 作方差锚点）',
  '',
  '| 比较 | 指标 | SD(锚点) | N=100 | N=120 | N=150 |',
  '|---|---|---|---|---|---|',
  ...contRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5]} |`),
  '',
  '## CDA（二元）：达到 80% power 所需的最弱不一致效应',
  '',
  '| 比较 | q | N=100 | N=120 | N=150 |',
  '|---|---|---|---|---|',
  ...cdaRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`),
  '',
  '> 情景值：Pilot 对 B−A 为 0 个不一致对、对 C−B 为 1/8，均不足以估计真实效应。',
  '> Pilot 的 mean diff 仅用于方差规划，不作为"真正重要的效应"。',
  '',
].join('\n');
writeFileSync(path.join(RUNS, 'pilot-mde.md'), md, 'utf8');
console.log('\n已写出：pilot-runs/pilot-mde.md');
