/**
 * scripts/formal-setup.ts — 正式实验的**播种 + 基线**机制（人工要求 2026-09-30 第 1 步）
 *
 * 顺序被强制为（与 Pilot 一致，且不可颠倒）：
 *     seed（写入正式任务种子）
 *       ↓
 *     baseline（对**未被 Agent 修改过**的种子计算哈希并落盘）
 *       ↓
 *     run（Agent 修改工作区）
 *       ↓
 *     verifyTask（file_changed / file_unchanged 对照 baseline）
 *
 * 硬性规则：
 *   · 基线带 dataset / task_set identity / baseline_hash / generated_at；
 *   · **基线不得被 run 覆盖**：已存在则拒绝写入（除非显式 force，供人工重播种使用）；
 *   · pilot 与 formal 基线物理分离（seed-hashes.json vs seed-hashes.formal.json）；
 *   · 数据集不匹配 ⇒ 上游 loadSeedHashes() 返回 null ⇒ verifyTask 给出 CONFIG_ERROR（不回退）。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PILOT_WORKSPACE, PROJECT_ROOT, seedHashFileFor } from './pilot-setup.ts';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FORMAL_WORKSPACE_PREFIX = 'pilot-workspace/';

export interface FormalSeed {
  path: string;
  content: string;
}

export interface FormalBaseline {
  dataset: 'formal';
  algorithm: 'sha256';
  seeded_at: string;
  task_set: { id: string; task_ids: string[]; count: number; seed_files: number };
  baseline_hash: string;
  files: Record<string, string>;
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** 规范化 JSON（键排序）后取 sha256 —— baseline_hash 的确定性来源 */
function canonicalHash(obj: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, walk((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return sha256(JSON.stringify(walk(obj)));
}

/**
 * 播种正式任务集并写出**正式基线**。
 * 只触碰 `pilot-workspace/FORMAL-*` 与 `pilot-workspace/package.json`，
 * 不动 Pilot 的种子与 Pilot 基线（seed-hashes.json）。
 */
export function seedFormalWorkspace(
  seeds: FormalSeed[],
  identity: { taskSetId: string; taskIds: string[] },
  opts: { force?: boolean } = {},
): FormalBaseline {
  const baselineFile = seedHashFileFor('formal');
  if (existsSync(baselineFile) && !opts.force) {
    throw new Error(
      `Refusing to overwrite formal baseline: ${path.relative(PROJECT_ROOT, baselineFile)}\n` +
        `Use force only for intentional re-seeding.`,
    );
  }

  // 清理旧的正式任务目录（保留 Pilot 的 PILOT-* 目录与 Pilot 基线）
  mkdirSync(PILOT_WORKSPACE, { recursive: true });
  for (const prefix of new Set(seeds.map((s) => s.path.split('/').slice(0, 2).join('/')))) {
    const abs = path.join(PROJECT_ROOT, prefix);
    if (abs.startsWith(PILOT_WORKSPACE) && existsSync(abs)) rmSync(abs, { recursive: true, force: true });
  }

  const files: Record<string, string> = {};
  for (const seed of seeds) {
    const abs = path.join(PROJECT_ROOT, seed.path);
    if (!abs.startsWith(PILOT_WORKSPACE)) throw new Error(`种子路径必须在 pilot-workspace/ 下：${seed.path}`);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, seed.content, 'utf8');
    files[seed.path] = sha256(seed.content);
  }

  const baseline: FormalBaseline = {
    dataset: 'formal',
    algorithm: 'sha256',
    seeded_at: new Date().toISOString(),
    task_set: { id: identity.taskSetId, task_ids: [...identity.taskIds].sort(), count: identity.taskIds.length, seed_files: Object.keys(files).length },
    baseline_hash: canonicalHash(files),
    files,
  };
  mkdirSync(path.dirname(baselineFile), { recursive: true });
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  return baseline;
}

/** 读取正式基线（不存在 ⇒ null；上游据此给出 CONFIG_ERROR） */
export function loadFormalBaseline(): FormalBaseline | null {
  const f = seedHashFileFor('formal');
  if (!existsSync(f)) return null;
  return readJsonUtf8<FormalBaseline>(f);
}

/** 校验：正式基线必须与给定任务集 identity 一致，否则 CONFIG_ERROR */
export function assertBaselineIdentity(baseline: FormalBaseline, identity: { taskSetId: string; taskIds: string[] }): string | null {
  if (baseline.dataset !== 'formal') return `基线 dataset=${String(baseline.dataset)}，期望 formal`;
  if (baseline.task_set.id !== identity.taskSetId) return `基线 task_set=${baseline.task_set.id}，期望 ${identity.taskSetId}`;
  const a = [...baseline.task_set.task_ids].sort().join(',');
  const b = [...identity.taskIds].sort().join(',');
  if (a !== b) return `基线任务集与当前任务集不一致（${baseline.task_set.count} vs ${identity.taskIds.length} 个任务）`;
  return null;
}

/**
 * 从**当前工作区实际状态**冻结基线（人工要求 2026-09-30）：
 * 预跑产生失败日志之后必须调用本函数，使 baseline 代表 Agent 实际接手的完整状态。
 * 只统计给定任务目录 + pilot-workspace/package.json 下的文件；不修改任何文件。
 */
export function buildBaselineFromWorkspace(
  identity: { taskSetId: string; taskIds: string[] },
  opts: { force?: boolean } = {},
): FormalBaseline {
  const baselineFile = seedHashFileFor('formal');
  if (existsSync(baselineFile) && !opts.force) {
    throw new Error('Refusing to overwrite formal baseline: ' + path.relative(PROJECT_ROOT, baselineFile));
  }
  const files: Record<string, string> = {};
  const addFile = (abs: string) => {
    const rel = path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');
    files[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
  };
  const pkg = path.join(PILOT_WORKSPACE, 'package.json');
  if (existsSync(pkg)) addFile(pkg);
  for (const id of identity.taskIds) {
    const dir = path.join(PILOT_WORKSPACE, id);
    if (!existsSync(dir)) continue;
    for (const cur of (function walk(d: string): string[] {
      const out: string[] = [];
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) out.push(...walk(p));
        else out.push(p);
      }
      return out;
    })(dir)) addFile(cur);
  }
  const baseline: FormalBaseline = {
    dataset: 'formal',
    algorithm: 'sha256',
    seeded_at: new Date().toISOString(),
    task_set: { id: identity.taskSetId, task_ids: [...identity.taskIds].sort(), count: identity.taskIds.length, seed_files: Object.keys(files).length },
    baseline_hash: canonicalHash(files),
    files,
  };
  mkdirSync(path.dirname(baselineFile), { recursive: true });
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  return baseline;
}
