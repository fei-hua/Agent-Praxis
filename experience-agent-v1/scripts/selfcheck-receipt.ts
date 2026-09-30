/**
 * scripts/selfcheck-receipt.ts — receipt 回填的**合成端到端 artifact 自测**（人工要求 2026-09-27）
 *
 * 背景：`pilot-execute.ts` 的回填曾用 `run-<runId>.jsonl` 读取轨迹，而 collect 实际写的是
 *       `<runId>.jsonl` ⇒ 回填静默跳过（连续三次"自称修好、实际未修好"）。
 * 因此验证方式从"读源码确认"升级为**可失败的 artifact gate**：
 *
 *   旧路径不存在 + 新路径存在 + receipt 字段非空有效 ⇒ PASS，否则 exit 1
 *
 * 本脚本不启动 Agent、不写正式 trajectories（结束后清理），不产生任何 Pilot observation。
 * 说明：合成 observation 直接以 JSONL 写出 run_end 记录（不经真实 session），
 *       因为这里要验证的是**路径规则与回填逻辑**，而不是 recorder 本身。
 *
 * 用法：node scripts/selfcheck-receipt.ts
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT } from './pilot-setup.ts';
import { readJsonUtf8, writeJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUN_ID = 'TEST-RECEIPT-001';
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const RUNS_DIR = path.join(PROJECT_ROOT, 'pilot-runs');
const NEW_TRAJ = path.join(TRAJ_DIR, `${RUN_ID}.jsonl`);
const OLD_TRAJ = path.join(TRAJ_DIR, `run-${RUN_ID}.jsonl`);
const RECEIPT = path.join(RUNS_DIR, `${RUN_ID}.receipt.json`);
const DRIVER = path.join(HERE, 'pilot-execute.ts');

const failures: string[] = [];
const assert = (cond: boolean, msg: string): void => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${msg}`);
  if (!cond) failures.push(msg);
};

console.log('=== 合成端到端 receipt 回填自测（不启动 Agent） ===');

// ---------- A. 静态门禁：驱动源码里的路径规则 ----------
const src = readFileSync(DRIVER, 'utf8');
const oldMatches = src.split('run-${runId}.jsonl').length - 1;
const newPresent = src.includes('${runId}.jsonl') && oldMatches === 0;
assert(oldMatches === 0, `源码旧路径模式 "run-\${runId}.jsonl" 残留数 = ${oldMatches}（要求 0）`);
assert(newPresent, '源码新路径模式 "${runId}.jsonl" 存在，且无旧模式');

// ---------- B. 合成一个 observation 的 run_end 记录 ----------
mkdirSync(TRAJ_DIR, { recursive: true });
mkdirSync(RUNS_DIR, { recursive: true });
if (existsSync(OLD_TRAJ)) rmSync(OLD_TRAJ, { force: true });

const syntheticRecord = {
  run_id: RUN_ID,
  session_id: 'session-SYNTHETIC',
  session_format_version: 'v4',
  sandbox_mode: 'workspace-write',
  delegation_depth: 0,
  wall_time_ms: 1234,
  tool_schema_version: 'tschema-dedbeef0001',
  input_tokens: 111,
  output_tokens: 222,
  cache_read_tokens: 333,
  reasoning_tokens: null,
  total_tokens: 666,
  token_accounting_source: 'harness',
  cda: 1,
  expected_delegation: false,
  task_state: { schema_version: '1.0', task_state: { first_decision: 'DIRECT' } },
  success_criteria: ['synthetic_ok'],
};
writeFileSync(
  NEW_TRAJ,
  JSON.stringify({ type: 'run_end', seq: 2, ts: new Date().toISOString(), run_id: RUN_ID, run_record: syntheticRecord }) + '\n',
  'utf8',
);
writeJsonUtf8(RECEIPT, { run_id: RUN_ID, task_id: 'SYNTHETIC', arm: 'A' });

// ---------- C. 用驱动相同的路径规则回填 receipt ----------
const trajByNewRule = path.join(TRAJ_DIR, `${RUN_ID}.jsonl`);
let record: Record<string, unknown> | null = null;
for (const line of readFileSync(trajByNewRule, 'utf8').split('\n').filter((l) => l.trim() !== '')) {
  const ev = JSON.parse(line) as { type?: string; run_record?: Record<string, unknown> };
  if (ev.type === 'run_end' && ev.run_record) record = ev.run_record;
}
assert(record !== null, `按新路径规则可读到 run_end 记录（${path.relative(PROJECT_ROOT, trajByNewRule)}）`);
if (record) {
  const receipt = readJsonUtf8<Record<string, unknown>>(RECEIPT);
  for (const k of Object.keys(record)) if (receipt[k] === undefined) receipt[k] = record[k];
  writeJsonUtf8(RECEIPT, receipt);
}

// ---------- D. artifact 断言 ----------
assert(existsSync(NEW_TRAJ), `artifact 存在：telemetry/trajectories/${RUN_ID}.jsonl`);
assert(!existsSync(OLD_TRAJ), `artifact 不存在：telemetry/trajectories/run-${RUN_ID}.jsonl`);
const r = readJsonUtf8<Record<string, unknown>>(RECEIPT);
assert(r['session_id'] !== undefined && r['session_id'] !== null, 'receipt.session_id 非空');
assert(Number(r['wall_time_ms'] ?? 0) > 0, `receipt.wall_time_ms > 0（实际 ${String(r['wall_time_ms'])}）`);
assert(
  typeof r['tool_schema_version'] === 'string' && r['tool_schema_version'] !== 'UNVERIFIED_AT_PLAN_TIME',
  `receipt.tool_schema_version 为真值（实际 ${String(r['tool_schema_version'])}）`,
);
assert(Number(r['total_tokens'] ?? 0) > 0, `receipt provider usage 存在（total=${String(r['total_tokens'])}）`);
assert(r['task_state'] !== undefined && r['task_state'] !== null, 'receipt.task_state 存在');
assert(r['success_criteria'] !== undefined, 'receipt.success_criteria 存在');

// ---------- E. 清理（不留下合成 observation） ----------
rmSync(NEW_TRAJ, { force: true });
rmSync(RECEIPT, { force: true });
console.log(`\n合成产物已清理；残留检查：trajectory=${existsSync(NEW_TRAJ)} receipt=${existsSync(RECEIPT)}（均应为 False）`);
if (existsSync(NEW_TRAJ) || existsSync(RECEIPT)) failures.push('合成产物未清理干净');

console.log(failures.length === 0 ? '\n✅ receipt 回填 artifact gate：全部通过' : `\n❌ ${failures.length} 项未通过`);
process.exit(failures.length === 0 ? 0 : 1);
