/**
 * scripts/pilot-audit.ts — Pilot 数据审计（第 1 项；只读 + 产出两张表）
 *
 * 产出：
 *   pilot-runs/pilot-observations.json  机器可读主表
 *   pilot-runs/pilot-observation-table.md  人读主表（28 行 observation）
 *
 * 口径定义（写死在脚本里，避免"算完再挑口径"）：
 *   evidence_status = COMPLETE / EVIDENCE_INCOMPLETE
 *     判定依据 = **Agent-exit 指纹是否在记录卡中**（workspace_sha256 + workspace_final_fingerprint_capture）
 *     以及环境/判定字段（session_format_version / sandbox_mode / delegation_depth / tool_schema_version /
 *     wall_time_ms / total_tokens / cda / task_state / success_criteria / expected_delegation）。
 *     说明：`retrieved_experiences` 在记录卡中的缺失属**记录层缺口**（轨迹为权威），
 *     单独用 receipt_retrieved_field 列标注，**不**据此把 observation 判成 EVIDENCE_INCOMPLETE。
 *   valid observation    = 按冻结规则结账为有效的 observation（本表为其全体）
 *   pair-eligible        = 配对分析可用性（另列 pair_eligible，二者不得混用）
 *
 * 用法：node scripts/pilot-audit.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { readJsonUtf8 } from './lib/json-io.ts';
import { PROJECT_ROOT } from './pilot-setup.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(PROJECT_ROOT, 'pilot-runs');
const TRAJ = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const TASKS = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');

const FINGERPRINT_FIELDS = ['workspace_sha256', 'workspace_final_fingerprint_capture'];
/** 观测完整性判据：记录卡里**必须**齐备的环境字段 */
const EVIDENCE_ENV_FIELDS = [
  'session_format_version', 'sandbox_mode', 'delegation_depth', 'tool_schema_version', 'wall_time_ms',
];
/** 可由**轨迹（权威）**补读的派生字段：记录卡缺失只算"记录层缺口"，不判为证据不完整 */
const DERIVED_FIELDS = [
  'total_tokens', 'cda', 'task_state', 'success_criteria', 'expected_delegation',
  'experience_context_tokens', 'retrieved_experiences',
];

interface Row {
  group: string; arm: string; run_id: string;
  first_decision: string | null; expected_decision: string; cda: number | null; mode_hit: boolean | null;
  task_success: boolean | null;
  snapshot: string | null; policy: number; reflection: boolean;
  retrieved_traj: number; retrieved_ids: string[]; ctx_tokens: number | null;
  elapsed_ms: number | null; tokens: number | null;
  fingerprint: string | null; evidence_status: 'COMPLETE' | 'COMPLETE_POST_HOC' | 'EVIDENCE_INCOMPLETE';
  fingerprint_status: 'EXIT_NATIVE' | 'POST_HOC' | 'MISSING';
  receipt_retrieved_field: boolean;
  receipt_derived_missing: number;
  receipt_source: 'live' | 'archive';
  receipt_fields: number;
  receipt_traj_consistent: boolean;
  pair_eligible: boolean;
}

const manifest = readJsonUtf8<{ planned_runs: Array<{ run_id: string; task_id: string; replicate: number; arm: string }> }>(
  path.join(PROJECT_ROOT, 'pilot-manifest-dry.json'),
);
const registry = readJsonUtf8<{ cells?: Record<string, { replacement?: string }> }>(path.join(RUNS, 'replacements.json'));
const dispositions = readJsonUtf8<{ cells?: Record<string, { status?: string; evidence_status?: string }> }>(
  path.join(RUNS, 'cell-dispositions.json'),
);
const cells = registry.cells ?? {};
const disp = dispositions.cells ?? {};

const rows: Row[] = [];
const excluded: string[] = [];
const missing: string[] = [];

for (const planned of manifest.planned_runs) {
  const cellKey = `${planned.task_id}|R${planned.replicate}|${planned.arm}`;
  const replacement = cells[cellKey]?.replacement;
  const runId = replacement ?? planned.run_id;
  const receiptFile = path.join(RUNS, `${runId}.receipt.json`);
  const trajFile = path.join(TRAJ, `${runId}.jsonl`);

  // 作废 cell：按 disposition 记账，不进入 observation 主表
  if (disp[cellKey]?.status === 'EXCLUDED' || (!existsSync(receiptFile) && !existsSync(trajFile))) {
    if (disp[cellKey]?.status === 'EXCLUDED') excluded.push(cellKey);
    else missing.push(cellKey);
    continue;
  }

  // 记录卡来源解析：prepare 重生成曾覆盖已完成 run 的在线记录卡（空壳）⇒ 回退到归档原件并标注来源
  const ARCHIVE_DIR = path.join(RUNS, 'pre-rematerialization-backup');
  let receiptSource: 'live' | 'archive' = 'live';
  let receipt = readJsonUtf8<Record<string, unknown>>(receiptFile);
  if (receipt['session_id'] === undefined && Object.keys(receipt).length < 20) {
    const archived = path.join(ARCHIVE_DIR, `${runId}.receipt.json`);
    if (existsSync(archived)) {
      receipt = readJsonUtf8<Record<string, unknown>>(archived);
      receiptSource = 'archive';
    }
  }
  // 任务判定：记录卡优先，缺失时取 judge 判定文件（权威产物）
  const judgeFile = path.join(RUNS, `judge-${runId}.json`);
  let taskSuccess: boolean | null = receipt['task_success'] === undefined ? null : receipt['task_success'] === true;
  if (taskSuccess === null && existsSync(judgeFile)) {
    taskSuccess = (readJsonUtf8<{ verdict?: string }>(judgeFile).verdict ?? '') === 'PASS';
  }
  let record: Record<string, unknown> | null = null;
  for (const line of readFileSync(trajFile, 'utf8').split('\n').filter((l) => l.trim() !== '')) {
    const ev = JSON.parse(line) as { type?: string; run_record?: Record<string, unknown> };
    if (ev.type === 'run_end' && ev.run_record) record = ev.run_record;
  }
  if (!record) {
    missing.push(`${cellKey}（轨迹无 run_end）`);
    continue;
  }

  const taskLoaded = loadTask(parseYaml(readFileSync(path.join(TASKS, `${planned.task_id}.yaml`), 'utf8')));
  const expected = taskLoaded.ok ? taskLoaded.task.expected_first_decisions : [];
  const ts = (record['task_state'] as { task_state?: { first_decision?: string } } | undefined)?.task_state;
  const first = ts?.first_decision ?? null;
  const trajRetrieved = (record['retrieved_experiences'] as unknown[] | undefined) ?? [];
  const retrievedIds = (trajRetrieved as Array<{ id?: string }>).map((r) => String(r.id ?? '?'));

  // 指纹类型三分（人工要求：valid ≠ pair-eligible，且指纹类型必须可见）
  const nativeExit = receipt['workspace_sha256'] !== undefined && receipt['workspace_final_fingerprint_capture'] === 'agent_exit';
  const postHoc =
    !nativeExit &&
    (receipt['workspace_final_fingerprint'] !== undefined ||
      String(receipt['workspace_final_fingerprint_capture'] ?? '').startsWith('post_hoc'));
  const fingerprintStatus: Row['fingerprint_status'] = nativeExit ? 'EXIT_NATIVE' : postHoc ? 'POST_HOC' : 'MISSING';

  const missingEnv = EVIDENCE_ENV_FIELDS.filter((f) => receipt[f] === undefined);
  const trajCoreOk = record['cda'] !== undefined && record['task_state'] !== undefined && record['wall_time_ms'] !== undefined;
  const missingDerived = DERIVED_FIELDS.filter((f) => receipt[f] === undefined);
  const evidence: Row['evidence_status'] =
    missingEnv.length > 0 || !trajCoreOk
      ? 'EVIDENCE_INCOMPLETE'
      : fingerprintStatus === 'MISSING'
        ? 'EVIDENCE_INCOMPLETE'
        : fingerprintStatus === 'POST_HOC'
          ? 'COMPLETE_POST_HOC'
          : 'COMPLETE';

  const receiptRetrieved = receipt['retrieved_experiences'] as unknown[] | undefined;
  // 一致性只在**两层都有的字段**上比较；缺失的派生字段属"记录层缺口"，单列统计
  const consistent =
    (receipt['experience_context_tokens'] === undefined ||
      String(receipt['experience_context_tokens']) === String(record['experience_context_tokens'] ?? '')) &&
    (!receiptRetrieved || receiptRetrieved.length === trajRetrieved.length);

  rows.push({
    group: planned.task_id,
    arm: planned.arm,
    run_id: runId,
    first_decision: first,
    expected_decision: expected.join('|'),
    cda: (record['cda'] as number | null) ?? null,
    mode_hit: first === null ? null : expected.includes(first as never),
    task_success: taskSuccess,
    snapshot: (receipt['experience_snapshot_id'] as string | null) ?? (record['experience_snapshot_id'] as string | null) ?? null,
    policy: planned.arm === 'A' ? 0 : 1,
    reflection: false,
    retrieved_traj: trajRetrieved.length,
    retrieved_ids: retrievedIds,
    ctx_tokens: (record['experience_context_tokens'] as number | null) ?? null,
    elapsed_ms: (record['wall_time_ms'] as number | null) ?? null,
    tokens: (record['total_tokens'] as number | null) ?? null,
    fingerprint: (receipt['workspace_sha256'] as string | null) ?? ((receipt['workspace_final_fingerprint'] as { manifest_sha256?: string } | undefined)?.manifest_sha256 ?? null),
    evidence_status: evidence,
    fingerprint_status: fingerprintStatus,
    receipt_retrieved_field: receiptRetrieved !== undefined,
    receipt_derived_missing: missingDerived.length,
    receipt_source: receiptSource,
    receipt_fields: Object.keys(receipt).length,
    receipt_traj_consistent: consistent,
    // 证据不完整的 observation 仍计 valid，但**不进入配对分析**
    pair_eligible: evidence !== 'EVIDENCE_INCOMPLETE' && consistent && fingerprintStatus !== 'MISSING',
  });
}

// ---------- 账面核对 ----------
const plannedCount = manifest.planned_runs.length;
const uniqueCells = new Set(manifest.planned_runs.map((r) => `${r.task_id}|R${r.replicate}|${r.arm}`));
const unexpected = rows.map((r) => r.run_id).filter((id) => !manifest.planned_runs.some((p) => p.run_id === id || cells[`${p.task_id}|R${p.replicate}|${p.arm}`]?.replacement === id));

console.log('=== Pilot 数据审计 ===');
console.log(`planned_cells   = ${plannedCount}`);
console.log(`valid_cells     = ${rows.length}`);
console.log(`excluded_cells  = ${excluded.length}  ${excluded.join(', ')}`);
console.log(`missing_cells   = ${missing.length}${missing.length ? '  → ' + missing.join(', ') : '（每个 planned cell 都有最终处置）'}`);
console.log(`unexpected_cells= ${unexpected.length}`);
console.log(`主表行数(observation) = ${rows.length}`);
console.log('');
console.log('receipt ↔ trajectory 一致性：');
console.log(`  一致 = ${rows.filter((r) => r.receipt_traj_consistent).length} / ${rows.length}`);
console.log(`  记录卡缺 retrieved_experiences 字段（记录层缺口）= ${rows.filter((r) => !r.receipt_retrieved_field).length}`);
console.log('');
console.log('记录卡来源（prepare 重生成曾覆盖 9 条已完成 run 的在线卡 ⇒ 归档原件）：');
console.log(`  live = ${rows.filter((r) => r.receipt_source === 'live').length}   archive = ${rows.filter((r) => r.receipt_source === 'archive').length}`);
console.log('');
console.log('evidence_status：');
console.log(`  COMPLETE            = ${rows.filter((r) => r.evidence_status === 'COMPLETE').length}`);
console.log(`  COMPLETE_POST_HOC   = ${rows.filter((r) => r.evidence_status === 'COMPLETE_POST_HOC').length}`);
console.log(`  EVIDENCE_INCOMPLETE = ${rows.filter((r) => r.evidence_status === 'EVIDENCE_INCOMPLETE').length}`);
for (const r of rows.filter((x) => x.evidence_status === 'EVIDENCE_INCOMPLETE')) {
  console.log(`    - ${r.group}|${r.arm}  run=${r.run_id}（valid 保留；pair_eligible=${r.pair_eligible}）`);
}
console.log('');
console.log('pair-eligible（与 valid 分开统计）：');
for (const arm of ['A', 'C_frozen', 'B']) {
  const all = rows.filter((r) => r.arm === arm);
  console.log(`  ${arm}: valid=${all.length}  pair-eligible=${all.filter((r) => r.pair_eligible).length}`);
}
const groups = [...new Set(rows.map((r) => r.group))].sort();
const elig = (g: string, a: string): boolean => rows.some((r) => r.group === g && r.arm === a && r.pair_eligible);
const ba = groups.filter((g) => elig(g, 'A') && elig(g, 'B')).length;
const cb = groups.filter((g) => elig(g, 'C_frozen') && elig(g, 'B')).length;
console.log(`  可配对（pair-eligible）：B−A = ${ba}   C_frozen−B = ${cb}`);

// ---------- 产出 ----------
writeFileSync(path.join(RUNS, 'pilot-observations.json'), JSON.stringify({ generated_at: new Date().toISOString(), counts: { planned: plannedCount, valid: rows.length, excluded: excluded.length, missing: missing.length, unexpected: unexpected.length }, rows }, null, 2) + '\n', 'utf8');

const md: string[] = [
  '# Pilot observation 主表（28 行 · 只记录事实）',
  '',
  '> 口径：`evidence_status` 依据 **Agent-exit 指纹 + 环境/判定字段** 是否齐备；',
  '> `retrieved_experiences` 在记录卡中的缺失属**记录层缺口**（轨迹为权威），单列 `rcpt_ret`，不据此判为证据不完整。',
  '> `pair_eligible` 与 `valid` 严格分开：证据不完整的 observation 仍计 valid，但不进配对分析。',
  '',
  '| group | arm | first_decision | expected | CDA | mode_hit | TaskOK | snapshot | Policy | refl | rcpt_ret | retrieved | ctx_tokens | elapsed_ms | tokens | fingerprint | evidence | pair_elig |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    [
      r.group, r.arm, r.first_decision ?? '?', r.expected_decision, String(r.cda), String(r.mode_hit),
      String(r.task_success), r.snapshot ?? 'null', String(r.policy), String(r.reflection),
      r.receipt_retrieved_field ? 'Y' : 'N', `${r.retrieved_traj}${r.retrieved_ids.length ? '(' + r.retrieved_ids.join(',') + ')' : ''}`,
      String(r.ctx_tokens), String(r.elapsed_ms), String(r.tokens), r.fingerprint ? r.fingerprint.slice(0, 8) : 'MISSING',
      r.evidence_status === 'COMPLETE' ? 'ok' : 'INCOMPLETE', String(r.pair_eligible),
    ].join(' | '),
  ).map((l) => `| ${l} |`),
  '',
];
writeFileSync(path.join(RUNS, 'pilot-observation-table.md'), md.join('\n'), 'utf8');
console.log('');
console.log('已写出：pilot-runs/pilot-observations.json 与 pilot-runs/pilot-observation-table.md');
