/**
 * scripts/snapshot-audit.ts — SNAPSHOT_01 污染审计（人工要求，2026-09-27）
 *
 * 目的：验证**数据隔离真的成立**——SNAPSHOT_01 不得包含 Pilot benchmark 的
 * 直接答案或任务特定信息，否则形式上 dataset 不重叠、实际上已构成答案泄漏。
 *
 * 审计项（任一命中即 FAIL）：
 *   1. Pilot task_id（PILOT-A01 … PILOT-E02）
 *   2. Pilot 种子文件名（heartbeat.js / parser.js / a11y.css / auth.js / run-migration.js …）
 *   3. Pilot benchmark 专属路径（pilot-workspace/**）
 *   4. expected_first_decision 的"答案式"表述（如 "应 REPLAN" / "expected DELEGATE"）
 *   5. expected answer / expected artifact 关键词（verify-heartbeat / module-graph 等验收产物名）
 *   6. 任务书特有短语（逐任务 prompt 的显著片段）
 *
 * 用法：node scripts/snapshot-audit.ts [--snapshot SNAPSHOT_01] [--tasks-dir benchmark/tasks/pilot]
 * 退出码：0 = PASS（允许启动正式 Pilot）；1 = FAIL（禁止启动）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { ExperienceStore } from '../experience/store.ts';
import { loadSnapshot } from '../experience/snapshot.ts';
import { PILOT_SEEDS } from '../benchmark/pilot-seeds.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const SNAP_DIR = path.join(PROJECT_ROOT, 'snapshots');
const TASKS_DIR_DEFAULT = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');

interface Finding {
  experience_id: string;
  field: string;
  pattern: string;
  excerpt: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 收集禁止出现在快照中的模式 */
function forbiddenPatterns(tasksDir: string): Array<{ pattern: string; why: string }> {
  const out: Array<{ pattern: string; why: string }> = [];
  const push = (pattern: string, why: string) => {
    const p = pattern.trim();
    if (p.length >= 4) out.push({ pattern: p, why });
  };

  // 1) task_id + 3) 专属路径
  if (existsSync(tasksDir)) {
    for (const f of readdirSync(tasksDir).filter((x) => x.endsWith('.yaml'))) {
      const doc = parseYaml(readFileSync(path.join(tasksDir, f), 'utf8')) as Record<string, unknown> | null;
      const id = doc && typeof doc['id'] === 'string' ? doc['id'] : path.basename(f, '.yaml');
      push(id, 'Pilot task_id');
      const prompt = doc && typeof doc['prompt'] === 'string' ? doc['prompt'] : '';
      const expected = Array.isArray(doc?.['expected_first_decisions'])
        ? (doc!['expected_first_decisions'] as unknown[]).map(String)
        : [];
      for (const e of expected) {
        push(`应 ${e}`, 'expected_first_decision 答案式表述');
        push(`expected ${e}`, 'expected_first_decision 答案式表述');
        push(`期望 ${e}`, 'expected_first_decision 答案式表述');
      }
      // 6) 任务书显著短语（取长度 ≥ 8 的片段）
      for (const seg of prompt.split(/[\n。；;]/)) {
        const s = seg.trim();
        if (s.length >= 12) push(s, 'Pilot 任务书特有短语');
      }
    }
  }

  // 2) 种子文件名 + 5) 验收产物名
  for (const seed of PILOT_SEEDS) {
    const base = path.basename(seed.path);
    if (base !== 'package.json') push(base, 'Pilot 种子文件名');
  }
  push('pilot-workspace', 'Pilot benchmark 专属路径');
  for (const extra of [
    'heartbeat',
    'findings.md',
    'impact.md',
    'module-graph',
    'test-report',
    'upgrade-notes',
    'compat-result',
    'a11y-review',
    'security-review',
    'verify-heartbeat',
    'verify-a11y',
    'verify-auth',
    'verify-migration',
    'verify-build',
    'check-doc',
    'check-findings',
    'check-impact',
    'check-graph',
    'check-notes',
    'check-selectors',
    'check-behavior',
    'check-api',
  ]) {
    push(extra, 'expected artifact / 验收产物名');
  }
  return out;
}

function main(): void {
  const snapshotId = arg('snapshot') ?? 'SNAPSHOT_01';
  const snapPath = path.join(SNAP_DIR, `${snapshotId}.db`);
  if (!existsSync(snapPath)) {
    console.error(`AUDIT CONFIG_ERROR：快照不存在 ${snapPath}`);
    process.exit(2);
  }
  const snap = loadSnapshot(SNAP_DIR, snapshotId);
  const store: ExperienceStore = snap.openReadOnly();
  // 参与检索的经验（deprecated / rejected / conflict 按 §4.2 权重 0、硬过滤，不参与检索）
  const experiences = store.listRetrievable();

  const patterns = forbiddenPatterns(arg('tasks-dir') ?? TASKS_DIR_DEFAULT);
  const findings: Finding[] = [];

  for (const e of experiences) {
    const fields: Array<[string, string]> = [
      ['id', e.id],
      ['situation', e.situation],
      ['lesson', e.lesson],
      ['task_type', e.task_type],
      ['characteristics', e.characteristics.join(' ')],
      ['constraints', e.constraints.join(' ')],
      ['contraindications', e.contraindications.join(' ')],
      ['delegation.agents', e.delegation.agents.join(' ')],
      ['evidence.run_id', e.evidence.run_id],
    ];
    for (const [field, text] of fields) {
      const hay = text.toLowerCase();
      for (const { pattern } of patterns) {
        if (hay.includes(pattern.toLowerCase())) {
          findings.push({ experience_id: e.id, field, pattern, excerpt: text.slice(0, 120) });
        }
      }
    }
  }

  console.log(`=== ${snapshotId} 污染审计 ===`);
  console.log(`快照条目：${experiences.length}；审计模式：${patterns.length} 条（task_id / 种子文件名 / 专属路径 / 答案式表述 / 验收产物名 / 任务书短语）`);
  if (findings.length === 0) {
    console.log('✅ PASS：未发现 Pilot 直接答案或任务特定信息');
    process.exit(0);
  }
  console.log(`❌ FAIL：命中 ${findings.length} 处`);
  for (const f of findings.slice(0, 40)) {
    console.log(`  [${f.experience_id}] ${f.field} ← 模式「${f.pattern}」| ${f.excerpt}`);
  }
  if (findings.length > 40) console.log(`  … 其余 ${findings.length - 40} 处省略`);
  process.exit(1);
}

if (process.argv[1]?.endsWith('snapshot-audit.ts')) {
  main();
}
