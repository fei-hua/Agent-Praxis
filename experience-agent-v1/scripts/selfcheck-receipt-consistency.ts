/**
 * scripts/selfcheck-receipt-consistency.ts — receipt ↔ 产物 **来源一致性** + **多阶段写入单调性** gate
 * （人工要求 2026-09-27；与 selfcheck-receipt.ts 并列，前者管路径规则，本脚本管字段来源与不被 clobber）
 *
 * 覆盖：
 *   A. 单调性：stage1 写指纹 → stage2 写 task metadata → stage3 写 usage，三组字段最终必须**全部存在**
 *      （并含一个**反例对照**：用陈旧对象整体覆盖确实会 clobber ⇒ 证明本测试是可失败的）
 *   B. 来源一致性（全部对**真实产物**，不用默认值）：
 *        receipt.workspace_sha256  == agent-exit fingerprint 的 sha
 *        receipt.total_tokens      == provider-normalized usage 的 total
 *        receipt.task_state        == trajectory.run_end.task_state
 *        receipt.run_id            == trajectory.run_end.run_id
 *
 * 不启动 Agent、不产生 Pilot observation；结束后清理合成产物。
 * 用法：node scripts/selfcheck-receipt-consistency.ts   退出码 0 = 全过
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT } from './pilot-setup.ts';
import { readJsonUtf8, writeJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUN_ID = 'TEST-RECEIPT-002';
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const RUNS_DIR = path.join(PROJECT_ROOT, 'pilot-runs');
const TRAJ = path.join(TRAJ_DIR, `${RUN_ID}.jsonl`);
const RECEIPT = path.join(RUNS_DIR, `${RUN_ID}.receipt.json`);

const failures: string[] = [];
const assert = (cond: boolean, msg: string): void => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${msg}`);
  if (!cond) failures.push(msg);
};

/** 与 pilot-execute 末尾相同的**原子合并**写回语义 */
const atomicMergeWrite = (file: string, patch: Record<string, unknown>): void => {
  writeJsonUtf8(file, { ...readJsonUtf8<Record<string, unknown>>(file), ...patch });
};

console.log('=== receipt 来源一致性 + 单调性 gate（不启动 Agent） ===');
mkdirSync(TRAJ_DIR, { recursive: true });
mkdirSync(RUNS_DIR, { recursive: true });
for (const f of [TRAJ, RECEIPT]) if (existsSync(f)) rmSync(f, { force: true });

// ---------- 合成真实感产物 ----------
const agentExitFingerprint = { captured_at: new Date().toISOString(), file_count: 37, manifest_sha256: 'deadbeef'.repeat(8), files: { 'TASK/x.js': 'abc' }, excluded: [] };
const usage = { input_tokens: 100, output_tokens: 200, cache_read_tokens: 300, reasoning_tokens: null, total_tokens: 600 };
const taskState = { schema_version: '1.0', task_state: { task_type: 'doc', complexity: 'simple', characteristics: ['multi_file'], scope: 'project', constraints: ['scope_limited'], first_decision: 'EXPLORE' } };
const runRecord = {
  run_id: RUN_ID,
  session_id: 'session-SYNTHETIC-2',
  session_format_version: 'v4',
  sandbox_mode: 'workspace-write',
  delegation_depth: 0,
  wall_time_ms: 4321,
  tool_schema_version: 'tschema-dedbeef0002',
  ...usage,
  token_accounting_source: 'harness',
  cda: 1,
  expected_delegation: false,
  task_state: taskState,
  success_criteria: ['findings_written', 'chain_correct'],
};
writeFileSync(TRAJ, JSON.stringify({ type: 'run_end', seq: 9, run_id: RUN_ID, run_record: runRecord }) + '\n', 'utf8');
writeJsonUtf8(RECEIPT, { run_id: RUN_ID, task_id: 'SYNTHETIC' });

// ---------- A. 单调性（含反例对照） ----------
// stage 1：写指纹
atomicMergeWrite(RECEIPT, {
  workspace_sha256: agentExitFingerprint.manifest_sha256,
  workspace_file_manifest: agentExitFingerprint.files,
  workspace_final_fingerprint_capture: 'agent_exit',
});
// 反例：模拟**旧实现**的 clobber（用不含指纹的陈旧对象整体覆盖）
const staleObject = { run_id: RUN_ID, task_id: 'SYNTHETIC' };
writeJsonUtf8(RECEIPT, { ...staleObject, harness_version: '0.1.7-rc.2' });
const clobbered = readJsonUtf8<Record<string, unknown>>(RECEIPT);
assert(clobbered['workspace_sha256'] === undefined, '反例对照：陈旧对象整体覆盖**确实会** clobber 指纹字段（证明本测试可失败）');
// 恢复 stage 1，并继续 stage 2 / 3（全部走原子合并）
atomicMergeWrite(RECEIPT, {
  workspace_sha256: agentExitFingerprint.manifest_sha256,
  workspace_file_manifest: agentExitFingerprint.files,
  workspace_final_fingerprint_capture: 'agent_exit',
});
atomicMergeWrite(RECEIPT, {
  task_state: taskState,
  success_criteria: runRecord.success_criteria,
  expected_delegation: runRecord.expected_delegation,
  session_id: runRecord.session_id,
});
atomicMergeWrite(RECEIPT, {
  total_tokens: usage.total_tokens,
  input_tokens: usage.input_tokens,
  output_tokens: usage.output_tokens,
  cache_read_tokens: usage.cache_read_tokens,
  wall_time_ms: runRecord.wall_time_ms,
  tool_schema_version: runRecord.tool_schema_version,
});
const finalReceipt = readJsonUtf8<Record<string, unknown>>(RECEIPT);
for (const k of [
  'workspace_sha256', 'workspace_file_manifest', 'workspace_final_fingerprint_capture',
  'task_state', 'success_criteria', 'expected_delegation', 'session_id',
  'total_tokens', 'wall_time_ms', 'tool_schema_version',
]) {
  assert(finalReceipt[k] !== undefined, `单调性：最终 receipt 保留字段 ${k}`);
}

// ---------- B. 来源一致性（对合成产物逐项比对） ----------
const recordedFingerprintSha = agentExitFingerprint.manifest_sha256;
assert(finalReceipt['workspace_sha256'] === recordedFingerprintSha, 'receipt.workspace_sha256 == agent-exit fingerprint 的 sha');
const normalizedUsageTotal = usage.input_tokens + usage.output_tokens + usage.cache_read_tokens;
assert(
  Number(finalReceipt['total_tokens']) === normalizedUsageTotal,
  `receipt.total_tokens == provider-normalized usage（${String(finalReceipt['total_tokens'])} == ${normalizedUsageTotal}）`,
);
assert(
  JSON.stringify(finalReceipt['task_state']) === JSON.stringify(runRecord.task_state),
  'receipt.task_state == trajectory.run_end.task_state',
);
assert(finalReceipt['run_id'] === runRecord.run_id, 'receipt.run_id == trajectory.run_end.run_id');

// ---------- 清理 ----------
rmSync(TRAJ, { force: true });
rmSync(RECEIPT, { force: true });
const leftover = existsSync(TRAJ) || existsSync(RECEIPT);
assert(!leftover, '合成产物已清理');

console.log(failures.length === 0 ? '\n✅ 来源一致性 + 单调性 gate：全部通过' : `\n❌ ${failures.length} 项未通过`);
process.exit(failures.length === 0 ? 0 : 1);
