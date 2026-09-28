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

/** 定位 dsh 可执行入口（bin.js），不依赖 PATH */
function findDshBin(): string {
  const explicit = arg('dsh-bin');
  if (explicit && existsSync(explicit)) return explicit;
  const base = path.join(process.env['LOCALAPPDATA'] ?? '', 'npm-cache', '_npx');
  for (const dir of readdirSync(base)) {
    const p = path.join(base, dir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
    if (existsSync(p)) return p;
  }
  throw new Error('未找到 dsh bin.js（可用 --dsh-bin 显式指定）');
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
const bin = findDshBin();
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

// ---------- 5) verify（generic verifier；在 Agent 产物上运行） ----------
const verify = run('pilot-verify.ts', ['--task', plan.task_id, '--tasks-dir', TASKS_DIR, '--out', WS], 300_000);
report['verify_exit'] = verify.code;
const judgeFile = path.join(WS, `judge-${plan.task_id}.json`);
if (verify.code === 3) {
  console.log(`[基础设施/配置错误] VERIFICATION_CONFIG_ERROR —— 不计入正式数据\n${verify.out.split('\n').slice(-5).join('\n')}`);
  process.exit(3);
}
report['verdict'] = verify.code === 0 ? 'PASS' : 'FAIL';

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
const trajFile = path.join(TRAJ_DIR, `run-${runId}.jsonl`);
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
  receipt['task_success'] = record['success_criteria'] ? undefined : undefined;
  receipt['tool_schema_verified'] = record['tool_schema_version'] !== 'UNVERIFIED_AT_PLAN_TIME';
  receipt['session_id'] = sessionId;
  receipt['collected_at'] = new Date().toISOString();
  writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
}

// 边界复查：protected_paths 是否被改动（与基线比对；verify 已判过，这里只报告事实）
const drifted = Object.entries(seed.files)
  .filter(([p, h]) => currentHash(p) !== h)
  .map(([p]) => p);
report['seed_drift_files'] = drifted.length;

console.log(`=== run ${runId} ===`);
console.log(`  arm=${plan.arm} task=${plan.task_id} session=${sessionId}`);
console.log(`  format=${sessionMeta['session_format_version']} sandbox=${sessionMeta['sandbox_mode']} depth=${sessionMeta['delegation_depth']}`);
console.log(`  verify=${report['verdict']}（exit=${verify.code}）  collect=OK`);
if (record) {
  console.log(`  wall_time_ms=${record['wall_time_ms']} tool_schema=${record['tool_schema_version']} tokens=${record['total_tokens']} cda=${record['cda']}`);
  console.log(`  success_criteria=${JSON.stringify(record['success_criteria'])}`);
}
console.log(`  workspace 与基线不同的文件=${drifted.length}${drifted.length ? '：' + drifted.join(', ') : ''}`);
