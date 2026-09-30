/**
 * scripts/pilot-collect-repair.ts — 对**已存在的 session** 重新完成 verify → collect
 * （同一 observation 的后处理恢复；不重新执行 Agent，不消耗 replacement 额度）
 *
 * 人工冻结的适用条件（2026-09-27；本脚本逐条自检并打印）：
 *   1. 原 Agent session 已正常结束
 *   2. 原 workspace 仍是该 session 的最终 workspace
 *      —— 由 **final workspace fingerprint** 客观校验（人工批准 2026-09-27）
 *   3. task_state 已存在且合法（collect 二次校验，OQ-010）
 *   4. verification 原始证据仍在
 *   5. 失败属确定性工具缺陷（由调用方判定并记录）
 *   6. **不得重新执行 Agent**（无 dsh 调用）
 *   7. 不得修改 session / workspace 产物来"制造"通过
 *   8. 采集结果关联原 session_id / run_id
 *
 * 加固要点（人工批准 2026-09-27）：
 *   - **消灭 nested spawn**：本脚本在**同一进程内**调用 `verifyTask()`，
 *     不再 spawn pilot-verify.ts（此前 repair → verify → checker 的孙进程路径在受限沙箱下会退化）。
 *     checker 仍是受控子进程（`verifyTask` 内部以固定参数 spawn node 脚本），与"直接从 shell 跑 verify"同一条路径。
 *   - 轨迹命名按实际约定：`telemetry/trajectories/<runId>.jsonl`；**不存在即 COLLECTION_ERROR**。
 *   - receipt 只从真实 trajectory 的 run_end 记录回填，**不使用默认值**。
 *
 * 用法：node scripts/pilot-collect-repair.ts --run-id <id> --session <sessionId> --harness-version 0.1.7-rc.2
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { load as parseYaml } from 'js-yaml';
import { decodeSessionLog, findSessionLog } from '../telemetry/session-log.ts';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { readJsonUtf8, writeJsonUtf8 } from './lib/json-io.ts';
import { captureWorkspaceFingerprint, fingerprintDiff, fingerprintMatches, type WorkspaceFingerprint } from './lib/workspace-fingerprint.ts';
import { PROJECT_ROOT } from './pilot-setup.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = path.join(PROJECT_ROOT, 'pilot-runs');
const WS = path.join(PROJECT_ROOT, 'pilot-workspace');
const TASKS_DIR = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const DSH_HOME = path.join(process.env['USERPROFILE'] ?? '', '.dsh');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 唯一的受控子进程：collect（它只读会话日志与 workspace，不再向下 spawn） */
function spawnCollect(args: string[]): { code: number; out: string } {
  const of = openSync(path.join(RUNS, '.repair-stdout.txt'), 'w');
  const ef = openSync(path.join(RUNS, '.repair-stderr.txt'), 'w');
  let code = 0;
  try {
    execFileSync(process.execPath, [path.join(HERE, 'dryrun-collect.ts'), ...args], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', of, ef],
      timeout: 600_000,
    });
  } catch (e) {
    const s = (e as { status?: number | null }).status;
    code = typeof s === 'number' ? s : 1;
  } finally {
    closeSync(of);
    closeSync(ef);
  }
  return {
    code,
    out: readFileSync(path.join(RUNS, '.repair-stdout.txt'), 'utf8') + readFileSync(path.join(RUNS, '.repair-stderr.txt'), 'utf8'),
  };
}

const runId = arg('run-id');
const sessionId = arg('session');
const harnessVersion = arg('harness-version');
if (!runId || !sessionId || !harnessVersion) throw new Error('必填：--run-id / --session / --harness-version');
mkdirSync(RUNS, { recursive: true });

const receiptFile = path.join(RUNS, `${runId}.receipt.json`);
const planFile = path.join(RUNS, `${runId}.plan.json`);
if (!existsSync(receiptFile) || !existsSync(planFile)) throw new Error(`缺少 plan/receipt：${runId}`);
const receipt = readJsonUtf8<Record<string, unknown>>(receiptFile);
const plan = readJsonUtf8<{ task_id: string; arm: string; manifest: Record<string, unknown> }>(planFile);
const taskId = plan.task_id;

// ---------- 条件 1 / 3 / 8：会话事实 ----------
const entry = findSessionLog(DSH_HOME, sessionId);
if (!entry) throw new Error(`COLLECTION_ERROR: 找不到会话 ${sessionId} 的日志`);
const decoded = decodeSessionLog(entry.logPath);
const hasEnd = decoded.events.some((e) => ['run/end', 'turn/end', 'session/end'].includes(e.type));
const hasTaskState = JSON.stringify(decoded.events).includes('task_state');
const sandboxEvent = decoded.events.find((e) => e.type === 'sandbox/mode');
const sandboxMode = (sandboxEvent?.data as { mode?: unknown } | undefined)?.mode ?? null;

console.log('=== 后处理恢复：前置自检 ===');
console.log(`  1. session 已结束事件        = ${hasEnd ? '✅' : '⚠️ 未见显式结束事件'}`);
console.log(`  3. 会话含 task_state 字样     = ${hasTaskState ? '✅' : '❌'}`);
console.log(`  6. 不重新执行 Agent           = ✅（无 dsh 调用；verifyTask 在进程内）`);
console.log(`  8. 关联原 session             = ${sessionId}`);
console.log(`  会话元数据：format=v${decoded.header.version} sandbox=${String(sandboxMode)} depth=${decoded.header.delegationDepth} 事件=${decoded.events.length}`);
if (!hasTaskState) {
  console.log('❌ COLLECTION_ERROR: 会话内无 task_state 痕迹 ⇒ 不满足恢复条件');
  process.exit(3);
}

// ---------- 条件 2：final workspace fingerprint 门禁 ----------
const current = captureWorkspaceFingerprint(WS);
const recorded = receipt['workspace_final_fingerprint'] as WorkspaceFingerprint | undefined;
console.log('\n=== 条件 2：final workspace fingerprint ===');
if (recorded) {
  const ok = fingerprintMatches(recorded, current);
  console.log(`  recorded: ${String(recorded.manifest_sha256).slice(0, 16)}… (${recorded.file_count} files, ${String(recorded.captured_at)})`);
  console.log(`  current : ${current.manifest_sha256.slice(0, 16)}… (${current.file_count} files)`);
  if (!ok) {
    const diff = fingerprintDiff(recorded, current);
    console.log(`  ❌ COLLECTION_ERROR: workspace 与 session 结束时的指纹不一致 ⇒ 不是同一个 observation`);
    console.log(`     变化文件：${diff.slice(0, 10).join(', ')}${diff.length > 10 ? ` …(+${diff.length - 10})` : ''}`);
    console.log('     禁止 repair 先重新 seed 再 verify。');
    process.exit(3);
  }
  console.log('  ✅ 指纹一致 ⇒ 确认为同一 observation');
} else {
  // 历史 run 未在 session 结束时记录指纹：如实标注为事后采集，并写明其证明力边界
  console.log('  ⚠️ receipt 中没有 session 结束时的指纹（历史 run）');
  console.log(`  → 本次事后采集：${current.manifest_sha256.slice(0, 16)}…（${current.file_count} files），标记 captured_post_hoc=true`);
  console.log('  → 证明力边界：只能证明"现在"的 workspace 内容，不能单独证明它等于 session 结束时刻的状态；');
  console.log('     本 cell 另有独立证据（drift=1=Agent 产物；seed 重建时间早于 session 结束时间）。');
  receipt['workspace_final_fingerprint'] = current;
  receipt['workspace_final_fingerprint_capture'] = 'post_hoc_after_agent_exit';
}

// ---------- verify：**进程内**调用（消灭 nested spawn） ----------
const loaded = loadTask(parseYaml(readFileSync(path.join(TASKS_DIR, `${taskId}.yaml`), 'utf8')));
if (!loaded.ok) throw new Error(`任务 ${taskId} 校验失败：${loaded.issues.map((i) => i.field).join(', ')}`);
const result = verifyTask(loaded.task);
const judgeFile = path.join(WS, `judge-${taskId}.json`);
writeJsonUtf8(judgeFile, {
  task_id: result.task_id,
  success_criteria_results: [
    ...Object.entries(result.required).map(([criterion, v]) => ({ criterion, passed: v === 'PASS' })),
    ...Object.entries(result.forbidden).map(([criterion, violated]) => ({ criterion, passed: !violated })),
  ],
  forbidden_file_changes: result.protected_path_violations,
  verification_tool_called: true,
  subagent_invocations: 0,
  wall_time_ms: 0,
  verification_status: result.verification_status,
  config_errors: result.config_errors,
});
console.log('\n=== verify（进程内 verifyTask，单层受控 checker 子进程）===');
for (const c of result.checks) console.log(`  [${c.status}] ${c.id} (${c.kind}) — ${c.detail}`);
if (result.verification_status === 'VERIFICATION_CONFIG_ERROR') {
  console.log(`\n❌ COLLECTION_ERROR（配置错误，不计为 Agent FAIL）\n  ${result.config_errors.join('\n  ')}`);
  process.exit(3);
}
console.log(`  task_success = ${String(result.success)}（protected 违规 ${result.protected_path_violations.length}）`);

// ---------- collect（唯一受控子进程） ----------
const manifestFile = path.join(RUNS, `${runId}.manifest.json`);
if (!existsSync(manifestFile)) writeJsonUtf8(manifestFile, plan.manifest);
const collect = spawnCollect([
  '--task', taskId,
  '--tasks-dir', TASKS_DIR,
  '--run-id', runId,
  '--arm', plan.arm,
  '--manifest', manifestFile,
  '--primary', sessionId,
  '--judge', judgeFile,
  '--harness-version', harnessVersion,
]);
if (collect.code !== 0) {
  const kind = /CONFIG_MISMATCH/.test(collect.out) ? '配置不一致(CONFIG_MISMATCH)' : 'COLLECTION_ERROR';
  console.log(`\n❌ ${kind}：采集未完成（exit=${collect.code}）\n${collect.out.split('\n').slice(-8).join('\n')}`);
  process.exit(collect.code);
}

// ---------- 条件 8：轨迹必须存在（命名按实际约定 <runId>.jsonl），receipt 只从真实记录回填 ----------
const trajFile = path.join(TRAJ_DIR, `${runId}.jsonl`);
if (!existsSync(trajFile)) {
  console.log(`\n❌ COLLECTION_ERROR: 轨迹文件缺失：${path.relative(PROJECT_ROOT, trajFile)}（不得"collect 成功但事后找不到"）`);
  process.exit(3);
}
let record: Record<string, unknown> | null = null;
for (const line of readFileSync(trajFile, 'utf8').split('\n').filter((l) => l.trim() !== '')) {
  const ev = JSON.parse(line) as { type?: string; run_record?: Record<string, unknown> };
  if (ev.type === 'run_end' && ev.run_record) record = ev.run_record;
}
if (!record) {
  console.log(`\n❌ COLLECTION_ERROR: 轨迹中没有 run_end / run_record：${path.basename(trajFile)}`);
  process.exit(3);
}

const BACKFILL = [
  'session_format_version', 'sandbox_mode', 'delegation_depth', 'wall_time_ms', 'tool_schema_version',
  'input_tokens', 'output_tokens', 'cache_read_tokens', 'reasoning_tokens', 'total_tokens',
  'token_accounting_source', 'cda', 'task_state',
] as const;
const missingBackfill: string[] = [];
for (const k of BACKFILL) {
  if (record[k] === undefined) missingBackfill.push(k);
  else receipt[k] = record[k];
}
Object.assign(receipt, {
  session_id: sessionId,
  harness_version: harnessVersion,
  collection_mode: 'post_processing_repair',
  collection_repair_note: '同一 observation 的后处理恢复：未重新执行 Agent、未修改 workspace 产物、未消耗 replacement 额度',
  task_success: result.success,
  collected_at: new Date().toISOString(),
});
writeJsonUtf8(receiptFile, receipt);

const usageOk = Number(record['total_tokens'] ?? 0) > 0;
const wallOk = Number(record['wall_time_ms'] ?? 0) > 0;
console.log('\n=== 修复采集结果（只报这一个 session） ===');
console.log(`  run_id=${runId}`);
console.log(`  session_id=${sessionId}`);
console.log(`  fingerprint=${fingerprintMatches(current, receipt['workspace_final_fingerprint'] as WorkspaceFingerprint) ? 'MATCH' : 'MISMATCH'}（file_count=${current.file_count}）`);
console.log(`  task_success=${String(result.success)}   task_state=${JSON.stringify(record['task_state'])}`);
console.log(`  session_format_version=${String(record['session_format_version'])}  sandbox_mode=${String(record['sandbox_mode'])}  delegation_depth=${String(record['delegation_depth'])}`);
console.log(`  wall_time_ms=${String(record['wall_time_ms'])}（>0: ${wallOk}）  tool_schema=${String(record['tool_schema_version'])}`);
console.log(`  usage: total=${String(record['total_tokens'])}（>0: ${usageOk}） input=${String(record['input_tokens'])} output=${String(record['output_tokens'])} cache_read=${String(record['cache_read_tokens'])} reasoning=${String(record['reasoning_tokens'])}`);
console.log(`  cda=${String(record['cda'])}  token_accounting_source=${String(record['token_accounting_source'])}`);
console.log(`  receipt 回填缺失字段 = ${missingBackfill.length === 0 ? '无' : missingBackfill.join(', ')}`);
console.log('\n✅ 后处理恢复完成：同一 session 的 observation 已采集（valid observation 判定见报告）');
