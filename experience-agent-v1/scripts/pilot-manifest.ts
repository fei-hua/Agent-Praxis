/**
 * scripts/pilot-manifest.ts — 预注册式 Pilot Manifest（冻结后再运行）
 *
 * 人工要求（2026-09-27）：
 *   正式运行之前一次性生成并**冻结** task × replicate × arm 全表（90 条），
 *   把随机化的臂执行顺序也写进去；运行之后可审计 planned / actual / missing / duplicate。
 *   **随机化只决定执行顺序，不改变 task / replicate 的配对身份**：
 *     同一 task + 同一 replicate → A/B/C 三臂为同一配对，只是运行先后顺序随机。
 *
 * 随机化实现：对每个配对组（task × replicate），用 sha256(frozen_seed | group_id | arm)
 * 作为排序键对臂排序——与遍历顺序无关，因此完全确定性、可重放。
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..');
export const TASKS_DIR_DEFAULT = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');

export type ArmId = 'A' | 'B' | 'C_frozen';
export const PILOT_ARM_IDS: readonly ArmId[] = ['A', 'B', 'C_frozen'];

export const PILOT_DATASET_FORMAL = 'pilot';
export const PILOT_DATASET_DRY_EXECUTION = 'pilot_dry_execution';
/** 随机化种子：冻结后不得更改（改了就是新的 manifest） */
export const FROZEN_RANDOMIZATION_SEED = 'pilot-arm-order-2026-09-27';
export const PILOT_SNAPSHOT_ID = 'SNAPSHOT_01';

export interface PlannedRun {
  run_id: string;
  task_id: string;
  replicate: number;
  arm: ArmId;
  /** 该臂在配对组内的执行次序（0 起）——由冻结随机化决定 */
  arm_order_index: number;
  /** 配对组标识：同一组内三臂构成 paired observations */
  group_id: string;
}

export interface PilotManifest {
  dataset: string;
  created_at: string;
  frozen_randomization_seed: string;
  snapshot_id: string;
  arms: ArmId[];
  tasks: string[];
  replicates: number;
  planned_count: number;
  planned_runs: PlannedRun[];
  /** 上述全部内容的 canonical JSON 的 SHA-256（冻结凭据） */
  manifest_hash: string;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 稳定的 canonical JSON（对象键排序，递归） */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
      .join(',') +
    '}'
  );
}

/** 配对组内臂顺序（确定性；与遍历顺序无关） */
export function armOrderForGroup(seed: string, groupId: string, arms: readonly ArmId[]): ArmId[] {
  return [...arms].sort((a, b) => {
    const ka = sha256(`${seed}|${groupId}|${a}`);
    const kb = sha256(`${seed}|${groupId}|${b}`);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export function listFrozenTasks(tasksDir: string = TASKS_DIR_DEFAULT): string[] {
  const dir = tasksDir;
  if (!existsSync(dir)) throw new Error(`任务目录不存在：${dir}`);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => path.basename(f, '.yaml'))
    .sort();
}

export interface BuildManifestOptions {
  tasks?: string[];
  replicates?: number;
  dataset?: string;
  seed?: string;
  tasksDir?: string;
  createdAt?: string;
  /** run_id 前缀（默认由 dataset 推导） */
  tag?: string;
}

export function buildPilotManifest(opts: BuildManifestOptions = {}): PilotManifest {
  const tasks = (opts.tasks ?? listFrozenTasks(opts.tasksDir)).slice().sort();
  const replicates = opts.replicates ?? 3;
  const dataset = opts.dataset ?? PILOT_DATASET_FORMAL;
  const seed = opts.seed ?? FROZEN_RANDOMIZATION_SEED;
  const tag = opts.tag ?? (dataset === PILOT_DATASET_DRY_EXECUTION ? 'pilotdry' : 'pilot');

  if (!Number.isInteger(replicates) || replicates < 1) throw new Error(`replicates 必须为正整数，收到 ${replicates}`);

  const planned_runs: PlannedRun[] = [];
  for (const task_id of tasks) {
    for (let r = 1; r <= replicates; r++) {
      const group_id = `${task_id}|R${r}`;
      const order = armOrderForGroup(seed, group_id, PILOT_ARM_IDS);
      order.forEach((arm, idx) => {
        planned_runs.push({
          run_id: `${tag}-${task_id}-R${r}-${arm}`,
          task_id,
          replicate: r,
          arm,
          arm_order_index: idx,
          group_id,
        });
      });
    }
  }

  const body = {
    dataset,
    created_at: opts.createdAt ?? new Date().toISOString(),
    frozen_randomization_seed: seed,
    snapshot_id: PILOT_SNAPSHOT_ID,
    arms: [...PILOT_ARM_IDS],
    tasks,
    replicates,
    planned_count: planned_runs.length,
    planned_runs,
  };
  return { ...body, manifest_hash: sha256(canonicalJson(body)) };
}

export function writePilotManifest(file: string, manifest: PilotManifest): void {
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function loadPilotManifest(file: string): PilotManifest {
  const m = JSON.parse(readFileSync(file, 'utf8')) as PilotManifest;
  const body = { ...m } as Record<string, unknown>;
  delete body['manifest_hash'];
  const expect = sha256(canonicalJson(body));
  if (expect !== m.manifest_hash) {
    throw new Error(
      `MANIFEST_HASH_MISMATCH: 文件内容与 manifest_hash 不符（期望 ${expect.slice(0, 12)}…，实际 ${String(m.manifest_hash).slice(0, 12)}…）——manifest 冻结后不得手工修改`,
    );
  }
  return m;
}

export interface ManifestAudit {
  planned_count: number;
  actual_count: number;
  missing: string[];
  duplicate: string[];
  unexpected: string[];
  ok: boolean;
}

export function auditRunsAgainstManifest(manifest: PilotManifest, actualRunIds: readonly string[]): ManifestAudit {
  const planned = new Set(manifest.planned_runs.map((r) => r.run_id));
  const seen = new Map<string, number>();
  for (const id of actualRunIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  const missing = [...planned].filter((id) => !seen.has(id));
  const duplicate = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const unexpected = [...seen.keys()].filter((id) => !planned.has(id));
  return {
    planned_count: planned.size,
    actual_count: actualRunIds.length,
    missing,
    duplicate,
    unexpected,
    ok: missing.length === 0 && duplicate.length === 0 && unexpected.length === 0,
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1]?.endsWith('pilot-manifest.ts')) {
  if (process.argv.includes('--freeze')) {
    const out = arg('out') ?? path.join(PROJECT_ROOT, 'pilot-manifest.json');
    const m = buildPilotManifest({
      dataset: arg('dataset') ?? PILOT_DATASET_FORMAL,
      replicates: arg('replicates') ? Number(arg('replicates')) : undefined,
      tasksDir: arg('tasks-dir'),
    });
    writePilotManifest(out, m);
    console.log(`已冻结 Pilot manifest：${out}`);
    console.log(`  dataset=${m.dataset} tasks=${m.tasks.length} replicates=${m.replicates} planned=${m.planned_count}`);
    console.log(`  manifest_hash=sha256:${m.manifest_hash.slice(0, 16)}…`);
    const groups = new Set(m.planned_runs.map((r) => r.group_id));
    console.log(`  配对组=${groups.size}（每组 ${m.arms.length} 臂）`);
    for (const g of [...groups].slice(0, 3)) {
      const runs = m.planned_runs.filter((r) => r.group_id === g).sort((a, b) => a.arm_order_index - b.arm_order_index);
      console.log(`  例：${g} 执行顺序 → ${runs.map((r) => r.arm).join(' → ')}`);
    }
  } else if (process.argv.includes('--verify')) {
    const mf = arg('manifest') ?? path.join(PROJECT_ROOT, 'pilot-manifest.json');
    const m = loadPilotManifest(mf);
    const runsFile = arg('runs');
    const actual = runsFile ? (JSON.parse(readFileSync(runsFile, 'utf8')) as string[]) : [];
    const audit = auditRunsAgainstManifest(m, actual);
    console.log(`planned=${audit.planned_count} actual=${audit.actual_count} missing=${audit.missing.length} duplicate=${audit.duplicate.length} unexpected=${audit.unexpected.length}`);
    console.log(audit.ok ? '✅ manifest 审计通过' : '❌ manifest 审计失败');
    process.exit(audit.ok ? 0 : 1);
  } else {
    console.log('用法：--freeze [--dataset pilot|pilot_dry_execution] [--replicates N] [--out file] | --verify [--manifest file] [--runs runs.json]');
  }
}
