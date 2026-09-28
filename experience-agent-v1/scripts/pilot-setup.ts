/**
 * scripts/pilot-setup.ts — Pilot 工作区确定性重建（人工验收标准 #1）
 *
 * 规则：Run 之间**不得继承**任何改动。
 *   本脚本先整体删除 `pilot-workspace/`，再按 benchmark/pilot-seeds.ts 重建基线，
 *   并写出 SHA-256 基线清单 `pilot-workspace/seed-hashes.json`。
 *   每个 run 开跑前都必须先执行本脚本（Pilot 编排会把这一步作为前置条件）。
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PILOT_SEEDS, PILOT_TASK_IDS_WITH_SEEDS } from '../benchmark/pilot-seeds.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..');
export const PILOT_WORKSPACE = path.join(PROJECT_ROOT, 'pilot-workspace');
export const SEED_HASH_FILE = path.join(PILOT_WORKSPACE, 'seed-hashes.json');

export interface SeedHashManifest {
  seeded_at: string;
  algorithm: 'sha256';
  /** 有种子覆盖的任务 id（其余任务的种子尚未实现，见 Issue #6） */
  tasks: string[];
  /** 相对项目根的路径 → 基线 SHA-256 */
  files: Record<string, string>;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 确定性重建：清空后按种子写入，返回基线清单 */
export function seedPilotWorkspace(): SeedHashManifest {
  if (existsSync(PILOT_WORKSPACE)) {
    rmSync(PILOT_WORKSPACE, { recursive: true, force: true });
  }
  mkdirSync(PILOT_WORKSPACE, { recursive: true });

  const files: Record<string, string> = {};
  for (const seed of PILOT_SEEDS) {
    const abs = path.join(PROJECT_ROOT, seed.path);
    if (!abs.startsWith(PILOT_WORKSPACE)) {
      throw new Error(`种子路径必须位于 pilot-workspace/ 下：${seed.path}`);
    }
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, seed.content, 'utf8');
    files[seed.path] = sha256(seed.content);
  }

  const manifest: SeedHashManifest = {
    seeded_at: new Date().toISOString(),
    algorithm: 'sha256',
    tasks: [...PILOT_TASK_IDS_WITH_SEEDS],
    files,
  };
  writeFileSync(SEED_HASH_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

export function loadSeedHashes(): SeedHashManifest | null {
  if (!existsSync(SEED_HASH_FILE)) return null;
  return JSON.parse(readFileSync(SEED_HASH_FILE, 'utf8')) as SeedHashManifest;
}

/** 当前文件的 SHA-256（相对项目根路径）；不存在返回 null */
export function currentHash(relPath: string): string | null {
  const abs = path.join(PROJECT_ROOT, relPath);
  if (!existsSync(abs)) return null;
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

if (process.argv[1]?.endsWith('pilot-setup.ts')) {
  const m = seedPilotWorkspace();
  const taskCount = m.tasks.length;
  console.log(`pilot-workspace 已确定性重建：${Object.keys(m.files).length} 个种子文件，覆盖 ${taskCount} 个任务`);
  console.log(`基线清单：${SEED_HASH_FILE}`);
  if (taskCount < 10) {
    console.log(`⚠️ 注意：当前仅覆盖 ${taskCount}/10 个任务的种子（其余见 Issue #6），未覆盖任务的判定器会报 VERIFICATION_CONFIG_ERROR`);
  }
}
