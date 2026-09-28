/**
 * core/run-manifest.ts — Run isolation 硬规则（人工冻结，2026-09-27）
 *
 * 裁决原文要点：
 *   每个 run 启动时记录：
 *     { arm, snapshot_id, policy_hash, experiment_config_hash, harness_version, tool_schema_version }
 *   然后在**执行前**检查 runtime config 与声明是否一致；不一致 → CONFIG_MISMATCH → abort。
 *   **不允许**「半跑完发现版本错」——那会污染实验。
 *
 * 本模块只做「声明 vs 运行时」的一致性判定（纯函数），abort 由调用方执行（Pilot 编排）。
 */

import type { Arm } from './enums.ts';

export interface RunManifest {
  arm: Arm;
  /** 'none' 表示该臂不使用经验（A / B） */
  snapshot_id: string;
  /** A 臂无 Policy ⇒ null；B / C_frozen / C_static / D_online ⇒ policyFingerprint() */
  policy_hash: string | null;
  experiment_config_hash: string;
  harness_version: string;
  tool_schema_version: string;
}

export interface ManifestMismatch {
  field: keyof RunManifest;
  declared: string | null;
  runtime: string | null;
}

export type ManifestCheckResult =
  | { status: 'ok'; mismatches: [] }
  | { status: 'CONFIG_MISMATCH'; mismatches: ManifestMismatch[] };

const MANIFEST_FIELDS: Array<keyof RunManifest> = [
  'arm',
  'snapshot_id',
  'policy_hash',
  'experiment_config_hash',
  'harness_version',
  'tool_schema_version',
];

/** 构造 run manifest（启动时记录；字段全部来自冻结配置与运行时环境） */
export function buildRunManifest(input: RunManifest): RunManifest {
  return { ...input };
}

/**
 * 执行前门禁：逐字段比对声明 manifest 与运行时 manifest。
 * 任一字段不一致 → CONFIG_MISMATCH（不得开跑、不得半跑）。
 */
export function verifyRunManifest(declared: RunManifest, runtime: RunManifest): ManifestCheckResult {
  const mismatches: ManifestMismatch[] = [];
  for (const field of MANIFEST_FIELDS) {
    const d = declared[field];
    const r = runtime[field];
    if (d !== r) {
      mismatches.push({ field, declared: d === null ? null : String(d), runtime: r === null ? null : String(r) });
    }
  }
  return mismatches.length === 0
    ? { status: 'ok', mismatches: [] }
    : { status: 'CONFIG_MISMATCH', mismatches };
}

/**
 * 门禁断言：不一致即抛错（调用方在任何执行动作之前调用）。
 * 错误信息包含逐字段差异，便于直接把 run 标记为排除（excluded），而不是修数据。
 */
export function assertRunManifest(declared: RunManifest, runtime: RunManifest): void {
  const result = verifyRunManifest(declared, runtime);
  if (result.status === 'CONFIG_MISMATCH') {
    const detail = result.mismatches
      .map((m) => `${m.field}: declared=${m.declared ?? 'null'} runtime=${m.runtime ?? 'null'}`)
      .join('; ');
    throw new Error(`CONFIG_MISMATCH：run 声明与运行时配置不一致，已中止（不得半跑）→ ${detail}`);
  }
}
