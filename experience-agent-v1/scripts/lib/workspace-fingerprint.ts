/**
 * scripts/lib/workspace-fingerprint.ts — 最终 workspace 指纹（人工批准 2026-09-27）
 *
 * 目的：把"这是同一个 observation"从**脚本自述**变成**可验证的实验事实**。
 *   Agent session 结束那一刻 → 记录 workspace_file_manifest + workspace_sha256 + 时间；
 *   之后任何 post-processing repair 必须先比对一致，否则 COLLECTION_ERROR。
 *   **禁止 repair 先重新 seed 再 verify**（那已经不是原 observation）。
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface WorkspaceFingerprint {
  captured_at: string;
  file_count: number;
  manifest_sha256: string;
  files: Record<string, string>;
  /** 明确记录排除项，避免"指纹不一致"被误解为产物被改 */
  excluded: string[];
}

/** 排除易变/工具产物：它们不属于 Agent 的任务产物 */
const EXCLUDE_PATTERNS: RegExp[] = [
  /(^|[\\/])judge-.*\.json$/,
  /(^|[\\/])seed-hashes\.json$/,
  /(^|[\\/])\..*\.txt$/, // .verify-stdout.txt / .exec-*.txt / .repair-*.txt
];

export function captureWorkspaceFingerprint(root: string, now = new Date().toISOString()): WorkspaceFingerprint {
  const files: Record<string, string> = {};
  const excluded: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (EXCLUDE_PATTERNS.some((rx) => rx.test(rel))) {
        excluded.push(rel);
        continue;
      }
      files[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
    }
  };
  walk(root);
  const manifest_sha256 = createHash('sha256')
    .update(
      Object.keys(files)
        .sort()
        .map((k) => `${k}:${files[k]}`)
        .join('\n'),
      'utf8',
    )
    .digest('hex');
  return { captured_at: now, file_count: Object.keys(files).length, manifest_sha256, files, excluded };
}

/** 比对两个指纹的 manifest 摘要（文件集 + 内容哈希） */
export function fingerprintMatches(a: WorkspaceFingerprint, b: WorkspaceFingerprint): boolean {
  return a.manifest_sha256 === b.manifest_sha256;
}

/** 列出两份指纹之间发生变化的文件（用于报告证据） */
export function fingerprintDiff(a: WorkspaceFingerprint, b: WorkspaceFingerprint): string[] {
  const names = new Set([...Object.keys(a.files), ...Object.keys(b.files)]);
  return [...names].filter((n) => a.files[n] !== b.files[n]).sort();
}
