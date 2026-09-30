/**
 * scripts/pilot-execute.ts — 单个 Pilot run 的执行闭环（真实会话）
 *
 * 严格按冻结 manifest 的顺序执行一个 run：
 *   seed（确定性重建） → plan/manifest 门禁（读取已冻结的 plan）
 *   → 顶层 `dsh headless` 会话执行（depth 0，跑完即退出 ⇒ 会话日志可采集）
 *   → verify（generic verifier） → collect（写轨迹 + manifest 二次门禁）
 *   → 回填 receipt（harness/ tool_schema/ session_format/ sandbox_mode/ delegation_depth）
 *
 * 关键纪律：
 *   - 只在**开始**时重建 workspace；run 之后**不得**重建（否则 verify 会验到基线而非 Agent 产物）；
 *   - 基础设施问题（找不到会话 / 无事件 / 无 tool snapshot）与 Agent 失败严格区分；
 *   - 不修改任何任务定义 / ground truth / Policy / Experience。
 *
 * 用法：node scripts/pilot-execute.ts --run-id <id> --harness-version 0.1.7-rc.2
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decodeSessionLog, listSessions } from '../telemetry/session-log.ts';
import { seedPilotWorkspace, loadSeedHashes, currentHash, PROJECT_ROOT } from './pilot-setup.ts';
import { readJsonUtf8, writeJsonUtf8 } from './lib/json-io.ts';
import { resolveDshBinary } from './lib/dsh-resolver.ts';
import { captureWorkspaceFingerprint } from './lib/workspace-fingerprint.ts';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { load as parseYaml } from 'js-yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(PROJECT_ROOT, 'pilot-runs');
const WS = path.join(PROJECT_ROOT, 'pilot-workspace');
const TASKS_DIR = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const DSH_HOME = path.join(process.env['USERPROFILE'] ?? '', '.dsh');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * 依据 plan 声明的 harness_version 解析 exact binary（人工要求 2026-09-29）。
 * 实现**只有一份**：scripts/lib/dsh-resolver.ts（与 preflight #12 共用）。
 * 四种状态里除 RESOLVED 外一律中止，绝不"扫到哪个用哪个"。
 */
function resolveDshBin(declaredVersion: string): { bin: string; resolvedVersion: string; probed: string[] } {
  const r = resolveDshBinary(declaredVersion, { explicitBin: arg('dsh-bin') });
  if (r.status === 'RESOLVED') return { bin: r.binaryPath, resolvedVersion: r.resolvedVersion, probed: r.probed };
  if (r.status === 'VERSION_MISMATCH') {
    throw new Error(`CONFIG_MISMATCH：声明 ${r.declared} 但 binary 自报 ${r.probedVersion}（${r.binaryPath}）—— 不得启动`);
  }
  if (r.status === 'NOT_FOUND') {
    throw new Error(`CONFIG_MISMATCH：本机没有声明版本 ${r.declared}（可用：${r.available.join(', ') || '无'}）—— 不得启动`);
  }
  throw new Error(`RESOLVER_ERROR：${r.message} —— 不得启动`);
}

function run(script: string, args: string[], timeoutMs = 900_000): { code: number; out: string } {
  const outTmp = path.join(RUNS_DIR, '.exec-stdout.txt');
  const errTmp = path.join(RUNS_DIR, '.exec-stderr.txt');
  const of = openSync(outTmp, 'w');
  const ef = openSync(errTmp, 'w');
  let code = 0;
  try {
    execFileSync(process.execPath, [path.join(HERE, script), ...args], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', of, ef],
      timeout: timeoutMs,
    });
  } catch (e) {
    const s = (e as { status?: number | null }).status;
    code = typeof s === 'number' ? s : 1;
  } finally {
    closeSync(of);
    closeSync(ef);
  }
  return { code, out: readFileSync(outTmp, 'utf8') + readFileSync(errTmp, 'utf8') };
}

const runId = arg('run-id');
const harnessVersion = arg('harness-version');
if (!runId || !harnessVersion) throw new Error('必填：--run-id 与 --harness-version');

mkdirSync(RUNS_DIR, { recursive: true });
const report: Record<string, unknown> = { run_id: runId, harness_version: harnessVersion };

// ---------- 1) 读取已冻结的 plan / receipt（prepare 阶段产物 + 门禁结果） ----------
const planFile = path.join(RUNS_DIR, `${runId}.plan.json`);
const receiptFile = path.join(RUNS_DIR, `${runId}.receipt.json`);
if (!existsSync(planFile) || !existsSync(receiptFile)) {
  throw new Error(`缺少 plan/receipt：${runId}（请先 pilot-run --mode prepare）`);
}
const plan = JSON.parse(readFileSync(planFile, 'utf8')) as {
  task_id: string;
  arm: string;
  manifest: Record<string, unknown>;
};
const receipt = JSON.parse(readFileSync(receiptFile, 'utf8')) as Record<string, unknown>;
// collect 需要 manifest-only 文件（整份 plan 不是 manifest）
const manifestFile = path.join(RUNS_DIR, `${runId}.manifest.json`);
writeFileSync(manifestFile, JSON.stringify(plan.manifest, null, 2) + '\n', 'utf8');
report['task_id'] = plan.task_id;
report['arm'] = plan.arm;

// ---------- 2) seed（仅此一次；run 之后不得重建） ----------
seedPilotWorkspace();
const seed = loadSeedHashes()!;
report['workspace_baseline_hash'] = receipt['workspace_baseline_hash'];
report['seed_id'] = receipt['seed_id'];

// ---------- 3) 顶层 headless 执行（depth 0） ----------
const promptFile = path.join(RUNS_DIR, `${runId}.prompt.md`);
if (!existsSync(promptFile)) throw new Error(`缺少执行提示：${promptFile}（请先 pilot-prompt --run-id ${runId}）`);
const prompt = readFileSync(promptFile, 'utf8');

const known = new Set(listSessions(DSH_HOME).map((s) => s.sessionId));
const startedAt = Date.now();
const { bin, resolvedVersion, probed } = resolveDshBin(harnessVersion);
console.log(`  启动器解析：declared=${harnessVersion} resolved=${resolvedVersion}（探测到：${probed.join(' | ')}）`);
// 立刻把"到底用哪个 binary"写入 receipt（即便后续采集失败也留证）
writeJsonUtf8(receiptFile, {
  ...readJsonUtf8<Record<string, unknown>>(receiptFile),
  declared_harness_version: harnessVersion,
  resolved_harness_version: resolvedVersion,
  resolved_binary_path: bin,
});
report['declared_harness_version'] = harnessVersion;
report['resolved_harness_version'] = resolvedVersion;
report['resolved_binary_path'] = bin;
const execLog = path.join(RUNS_DIR, `${runId}.exec.log`);
{
  const fd = openSync(execLog, 'w');
  try {
    execFileSync(process.execPath, [bin, 'headless', prompt], {
      cwd: path.dirname(PROJECT_ROOT),
      stdio: ['ignore', fd, fd],
      timeout: 1_800_000,
    });
  } catch (e) {
    report['execute_error'] = (e as Error).message;
  } finally {
    closeSync(fd);
  }
}
report['executed_at'] = new Date().toISOString();

// ---------- 3.5) Agent-exit final workspace fingerprint（人工要求 2026-09-27） ----------
// 在 **Agent 进程退出的瞬间**采集 workspace 文件清单 + SHA-256，并立即写入 receipt。
// 之后任何 post-processing repair 都必须先比对：current == recorded，否则 COLLECTION_ERROR；
// 禁止 repair 先重新 seed 再 verify（那已经不是原 observation）。
const fingerprint = captureWorkspaceFingerprint(WS);
{
  const r = readJsonUtf8<Record<string, unknown>>(receiptFile);
  Object.assign(r, {
    workspace_final_fingerprint: fingerprint,
    workspace_fingerprint_time: fingerprint.captured_at,
    workspace_sha256: fingerprint.manifest_sha256,
    workspace_file_manifest: fingerprint.files,
    workspace_file_count: fingerprint.file_count,
    workspace_final_fingerprint_capture: 'agent_exit',
  });
  writeJsonUtf8(receiptFile, r);
}
report['workspace_sha256'] = fingerprint.manifest_sha256;
console.log(`  Agent-exit fingerprint 已记录：${fingerprint.manifest_sha256.slice(0, 16)}…（${fingerprint.file_count} files @ ${fingerprint.captured_at}）`);

// ---------- 4) 定位本次 run 的会话（新增 + depth 0 + 含 task_state） ----------
const fresh = listSessions(DSH_HOME)
  .filter((s) => !known.has(s.sessionId) && existsSync(s.logPath) && statSync(s.logPath).mtimeMs >= startedAt - 5000)
  .map((s) => ({ ...s, mtime: statSync(s.logPath).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

let sessionId: string | null = null;
let sessionMeta: Record<string, unknown> = {};
for (const s of fresh) {
  try {
    const d = decodeSessionLog(s.logPath);
    const marked = d.events.some((e) => JSON.stringify(e.data ?? {}).includes('task_state'));
    if (!marked) continue;
    sessionId = s.sessionId;
    const sb = d.events.find((e) => e.type === 'sandbox/mode');
    sessionMeta = {
      session_format_version: `v${d.header.version}`,
      sandbox_mode: (sb?.data as { mode?: unknown } | undefined)?.mode ?? null,
      delegation_depth: d.header.delegationDepth,
      events: d.events.length,
    };
    break;
  } catch {
    continue;
  }
}
if (!sessionId) {
  console.log(`[基础设施失败] 未找到本次 run 的会话（新增会话 ${fresh.length} 个，均不含 task_state）——不计入正式数据`);
  console.log(`  执行日志：${execLog}`);
  process.exit(3);
}
report['session_id'] = sessionId;
Object.assign(report, sessionMeta);

// ---------- 5) verify（**进程内** verifyTask；与 pilot-collect-repair 共用同一实现） ----------
// 人工要求（2026-09-27）：消除 execute → spawn pilot-verify → checker 的 nested spawn 路径。
// 经验证据：同 workspace / 同 session 下，nested spawn 会让 command 类检查退化为 FAIL，
// 而进程内调用给出正确判定。checker 仍是单层受控子进程（verifyTask 内部）。
const loadedTask = loadTask(parseYaml(readFileSync(path.join(TASKS_DIR, `${plan.task_id}.yaml`), 'utf8')));
if (!loadedTask.ok) throw new Error(`任务 ${plan.task_id} 校验失败：${loadedTask.issues.map((i) => i.field).join(', ')}`);
const verifyResult = verifyTask(loadedTask.task);
const judgeFile = path.join(WS, `judge-${plan.task_id}.json`);
writeJsonUtf8(judgeFile, {
  task_id: verifyResult.task_id,
  success_criteria_results: [
    ...Object.entries(verifyResult.required).map(([criterion, v]) => ({ criterion, passed: v === 'PASS' })),
    ...Object.entries(verifyResult.forbidden).map(([criterion, violated]) => ({ criterion, passed: !violated })),
  ],
  forbidden_file_changes: verifyResult.protected_path_violations,
  verification_tool_called: true,
  subagent_invocations: 0,
  wall_time_ms: 0,
  verification_status: verifyResult.verification_status,
  config_errors: verifyResult.config_errors,
});
console.log('  verify（进程内 verifyTask）：');
for (const c of verifyResult.checks) console.log(`    [${c.status}] ${c.id} (${c.kind}) — ${c.detail}`);
if (verifyResult.verification_status === 'VERIFICATION_CONFIG_ERROR') {
  console.log(`[基础设施/配置错误] VERIFICATION_CONFIG_ERROR —— 不计为 Agent FAIL，不计入正式数据`);
  for (const e of verifyResult.config_errors) console.log(`    - ${e}`);
  process.exit(3);
}
report['verify_result'] = verifyResult.success;
report['verdict'] = verifyResult.success ? 'PASS' : 'FAIL';

// ---------- 6) collect（写轨迹 + manifest 二次门禁） ----------
const collect = run('dryrun-collect.ts', [
  '--task', plan.task_id,
  '--tasks-dir', TASKS_DIR,
  '--run-id', runId,
  '--arm', plan.arm,
  '--manifest', manifestFile,
  '--primary', sessionId,
  '--judge', judgeFile,
  '--harness-version', harnessVersion,
], 600_000);
report['collect_exit'] = collect.code;
if (collect.code !== 0) {
  const tail = collect.out.split('\n').slice(-6).join('\n');
  const kind = /CONFIG_MISMATCH/.test(collect.out) ? '配置不一致(CONFIG_MISMATCH)' : 'COLLECTION_ERROR';
  console.log(`[${kind}] 采集失败（exit=${collect.code}）—— 不计入正式数据\n${tail}`);
  process.exit(collect.code);
}

// ---------- 7) 从产出的 run record 读回环境事实，回填 receipt ----------
const trajFile = path.join(TRAJ_DIR, `${runId}.jsonl`);
let record: Record<string, unknown> | null = null;
if (existsSync(trajFile)) {
  const lines = readFileSync(trajFile, 'utf8').split('\n').filter((l) => l.trim() !== '');
  for (const l of lines) {
    const ev = JSON.parse(l) as { type?: string; run_record?: Record<string, unknown> };
    if (ev.type === 'run_end' && ev.run_record) record = ev.run_record;
  }
}
if (record) {
  receipt['harness_version'] = record['harness_version'] ?? harnessVersion;
  receipt['tool_schema_version'] = record['tool_schema_version'];
  receipt['session_format_version'] = record['session_format_version'];
  receipt['sandbox_mode'] = record['sandbox_mode'];
  receipt['delegation_depth'] = record['delegation_depth'];
  receipt['wall_time_ms'] = record['wall_time_ms'];
  receipt['input_tokens'] = record['input_tokens'];
  receipt['output_tokens'] = record['output_tokens'];
  receipt['cache_read_tokens'] = record['cache_read_tokens'];
  receipt['reasoning_tokens'] = record['reasoning_tokens'];
  receipt['token_accounting_source'] = record['token_accounting_source'];
  receipt['cda'] = record['cda'];
  // 人工要求（2026-09-27）：扩充回填清单（全部来自真实 session/trajectory，不使用默认值）
  receipt['total_tokens'] = record['total_tokens'];
  receipt['task_state'] = record['task_state'];
  receipt['success_criteria'] = record['success_criteria'];
  receipt['expected_delegation'] = record['expected_delegation'];
  receipt['experience_context_tokens'] = record['experience_context_tokens'];
  // 人工要求 2026-09-30：C 臂已出现实际经验注入 ⇒ 注入明细必须在**记录卡层**与轨迹层一致
  receipt['retrieved_experiences'] = record['retrieved_experiences'];
  receipt['task_success'] = verifyResult.success;
  receipt['tool_schema_verified'] = record['tool_schema_version'] !== 'UNVERIFIED_AT_PLAN_TIME';
  receipt['session_id'] = sessionId;
  receipt['collected_at'] = new Date().toISOString();
  // **关键修复（clobber）**：不得用进程早期读取的陈旧 receipt 对象整体覆盖——
  // 那会抹掉 step 3.5 写入的 Agent-exit 指纹字段（workspace_sha256 / file_manifest / capture）。
  // 语义：以磁盘上的最新 receipt（含指纹）为基线，本次回填字段覆盖其上，一次写入。
  writeJsonUtf8(receiptFile, { ...readJsonUtf8<Record<string, unknown>>(receiptFile), ...receipt });
}

// 边界复查：protected_paths 是否被改动（与基线比对；verify 已判过，这里只报告事实）
const drifted = Object.entries(seed.files)
  .filter(([p, h]) => currentHash(p) !== h)
  .map(([p]) => p);
report['seed_drift_files'] = drifted.length;

console.log(`=== run ${runId} ===`);
console.log(`  arm=${plan.arm} task=${plan.task_id} session=${sessionId}`);
console.log(`  format=${sessionMeta['session_format_version']} sandbox=${sessionMeta['sandbox_mode']} depth=${sessionMeta['delegation_depth']}`);
console.log(`  verify=${report['verdict']}（exit=${verifyResult.verification_status}）  collect=OK`);
if (record) {
  console.log(`  wall_time_ms=${record['wall_time_ms']} tool_schema=${record['tool_schema_version']} tokens=${record['total_tokens']} cda=${record['cda']}`);
  console.log(`  success_criteria=${JSON.stringify(record['success_criteria'])}`);
}
console.log(`  workspace 与基线不同的文件=${drifted.length}${drifted.length ? '：' + drifted.join(', ') : ''}`);
