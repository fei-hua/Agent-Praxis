/**
 * scripts/dryrun-accept.ts — Phase 0 验收（tasks/phase0.md §4.2 五条 + §4.3 + 重放证据）
 *
 * 用法：node scripts/dryrun-accept.ts [--write-report]
 * 读取 telemetry/trajectories/run-2026-09-27-DRY-0*.jsonl 全部 5 条轨迹：
 *   - §4.2 五条检查（全部 PASS 才允许 Pilot）；
 *   - §4.3 额外检查（非门禁）；
 *   - telemetry/replay 离线决策链重放（§4.2-5 证据）；
 *   - 冻结阈值原样记录（0.30 / Top-K=5 / 160 tokens / lesson 60 字）。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAcceptanceAll } from '../telemetry/acceptance.ts';
import { replayTrajectory } from '../telemetry/replay.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const REPORT_DIR = path.join(PROJECT_ROOT, 'docs');

function main(): void {
  const ids = ['DRY-01', 'DRY-02', 'DRY-03', 'DRY-04', 'DRY-05'];
  const paths = ids.map((id) => path.join(TRAJ_DIR, `run-2026-09-27-${id}.jsonl`));
  const missing = paths.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    console.error('缺少轨迹文件：\n' + missing.join('\n'));
    process.exit(2);
  }

  const { reports, gate_passed, frozen_thresholds_recorded } = runAcceptanceAll(paths);
  const replays = paths.map((p) => replayTrajectory(p));

  const lines: string[] = [];
  lines.push('# Phase 0 Dry-run 验收报告');
  lines.push('');
  lines.push(`生成时间：${new Date().toISOString()}`);
  lines.push('');
  lines.push('## §4.2 五条验收（全部 PASS 才允许 Pilot）');
  lines.push('');
  for (const r of reports) {
    lines.push(`### ${r.run_id}`);
    for (const c of r.checks) {
      lines.push(`- [${c.status}] **${c.id}** ${c.title} — ${c.detail}`);
    }
    lines.push('#### §4.3 额外检查（非门禁）');
    for (const c of r.extra_checks) {
      lines.push(`- [${c.status}] **${c.id}** ${c.title} — ${c.detail}`);
    }
    lines.push('');
  }
  lines.push('## 冻结阈值（原样记录，不得调整）');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(frozen_thresholds_recorded, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## 离线决策链重放（§4.2-5 证据，无外部状态依赖）');
  lines.push('');
  for (const rp of replays) {
    lines.push(`### ${rp.run_id}（chain_complete=${rp.chain_complete}）`);
    lines.push('```');
    for (const step of rp.chain) {
      lines.push(`[${String(step.seq).padStart(4, ' ')}] ${step.stage.padEnd(14)} ${step.detail}`);
    }
    lines.push('```');
    lines.push('');
  }
  lines.push('## 结论');
  lines.push('');
  lines.push(gate_passed
    ? '✅ 5 个 dry-run 任务全部满足 §4.2 五条验收 —— Phase 0 exit gate 通过，可进入 Pilot（需人工确认后）。'
    : '❌ 存在未通过项 —— 不允许进入 Pilot。');
  lines.push('');

  console.log(lines.join('\n'));
  if (process.argv.includes('--write-report')) {
    mkdirSync(REPORT_DIR, { recursive: true });
    const outPath = path.join(REPORT_DIR, 'phase0-acceptance-report.md');
    writeFileSync(outPath, lines.join('\n'));
    console.log(`\n报告写入：${outPath}`);
  }
  const summary = {
    gate_passed,
    runs: reports.map((r) => ({ run_id: r.run_id, passed: r.all_passed, checks: r.checks.map((c) => `${c.id}:${c.status}`) })),
  };
  writeFileSync(path.join(TRAJ_DIR, 'acceptance-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  process.exit(gate_passed ? 0 : 1);
}

main();
