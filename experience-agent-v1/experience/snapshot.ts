/**
 * experience/snapshot.ts — Snapshot 机制（spec/frozen.md §10 / tasks/phase0.md T9）
 *
 * 冻结流程：
 *   Experience Store → SNAPSHOT_01（只读）→ 正式评测只读 SNAPSHOT_01
 *   每次 run 记录 experience_snapshot_id。
 *   禁止 Reflection 写回 SNAPSHOT_01。
 *
 * 「若不锁快照，配对反事实不成立」（§10）。
 * Phase 0 不做 BM25 正式标定，但 Snapshot 只读语义必须实现——本模块强制：
 *   1) 快照创建 = Store 文件的字节级拷贝（创建后 Store 再写入不影响快照）；
 *   2) 快照文件置只读属性；
 *   3) 快照连接只能以 SQLite readOnly 模式打开，写操作在驱动层直接失败。
 */

import { copyFileSync, chmodSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ExperienceStore } from './store.ts';

export interface SnapshotHandle {
  readonly snapshot_id: string;
  readonly db_path: string;
  /** 只读 Store 视图（SQLite readOnly 连接，写操作必然失败） */
  openReadOnly(): ExperienceStore;
}

export interface SnapshotManifestEntry {
  snapshot_id: string;
  source_store: string;
  db_path: string;
  created_at: string;
}

export function createSnapshot(opts: {
  storeDbPath: string;
  snapshotId: string;
  snapshotsDir: string;
}): SnapshotHandle {
  if (!existsSync(opts.storeDbPath)) {
    throw new Error(`Experience Store 不存在：${opts.storeDbPath}`);
  }
  mkdirSync(opts.snapshotsDir, { recursive: true });
  const dbPath = path.join(opts.snapshotsDir, `${opts.snapshotId}.db`);
  if (existsSync(dbPath)) {
    throw new Error(`快照已存在，拒绝覆盖（快照语义要求不可变）：${dbPath}`);
  }
  copyFileSync(opts.storeDbPath, dbPath);
  // 只读属性（Windows 下为 readonly attribute）；SQLite 层由 readOnly 连接兜底
  chmodSync(dbPath, 0o444);

  const entry: SnapshotManifestEntry = {
    snapshot_id: opts.snapshotId,
    source_store: opts.storeDbPath,
    db_path: dbPath,
    created_at: new Date().toISOString(),
  };
  const manifestPath = path.join(opts.snapshotsDir, 'manifest.jsonl');
  writeFileSync(manifestPath, JSON.stringify(entry) + '\n', { flag: 'a' });

  return {
    snapshot_id: opts.snapshotId,
    db_path: dbPath,
    openReadOnly(): ExperienceStore {
      return new ExperienceStore(dbPath, { readOnly: true });
    },
  };
}

export function loadSnapshot(snapshotsDir: string, snapshotId: string): SnapshotHandle {
  const dbPath = path.join(snapshotsDir, `${snapshotId}.db`);
  if (!existsSync(dbPath)) {
    throw new Error(`快照不存在：${dbPath}`);
  }
  return {
    snapshot_id: snapshotId,
    db_path: dbPath,
    openReadOnly(): ExperienceStore {
      return new ExperienceStore(dbPath, { readOnly: true });
    },
  };
}

export function listSnapshots(snapshotsDir: string): SnapshotManifestEntry[] {
  const manifestPath = path.join(snapshotsDir, 'manifest.jsonl');
  if (!existsSync(manifestPath)) return [];
  return readFileSync(manifestPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as SnapshotManifestEntry);
}
