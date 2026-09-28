/**
 * scripts/pilot-verify.ts — 通用判定器（唯一实现，替代 dry-run 的硬编码判定）
 *
 * 人工验收标准（2026-09-27）：
 *   #2 Verification 必须与 Agent 解耦：只检查**任务结果**，不检查 Agent 是否采取了某种动作。
 *   #3 Forbidden 反向检查：成功 ⇔ 全部 required = PASS 且全部 forbidden = 未触发；
 *      边界依据 = 种子基线 + 最终 diff（protected_paths 哈希比对）。
 *   #4 **Verification 配置错误不得伪装成 FAIL**：缺 checker / 类型不存在 / 基线缺失 /
 *      参数非法 → `VERIFICATION_CONFIG_ERROR`（实验基础设施错误，不能算到模型头上）。
 *   #5 Acquisition / Pilot / Validation 共用本判定器，不得各写一套。
 *
 * 用法：
 *   node scripts/pilot-verify.ts --task PILOT-A01 [--tasks-dir benchmark/tasks/pilot] [--out pilot-workspace]
 * 产出：<out>/judge-<task-id>.json（字段与 dryrun-collect 期望的 judge 输入兼容）
 *
 * 命令执行：stdio 重定向到临时文件（受限沙箱禁止子进程管道）。
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { load as parseYaml } from 'js-yaml';
import { loadTask, type BenchmarkTask, type TaskVerificationCheck } from '../benchmark/tasks.ts';
import { PROJECT_ROOT, PILOT_WORKSPACE, currentHash, loadSeedHashes } from './pilot-setup.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TASKS_DIR_DEFAULT = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');

type CheckStatus = 'PASS' | 'FAIL' | 'CONFIG_ERROR';

interface CheckOutcome {
  id: string;
  kind: string;
  status: CheckStatus;
  detail: string;
}

export interface VerifyResult {
  task_id: string;
  /** required 标签 → PASS/FAIL（不含 CONFIG_ERROR：那属于基础设施错误） */
  required: Record<string, 'PASS' | 'FAIL'>;
  /** forbidden 标签 → 是否触发（true = 违规） */
  forbidden: Record<string, boolean>;
  /** 任务成功；存在 CONFIG_ERROR 时为 null（不得当作模型失败） */
  success: boolean | null;
  verification_status: 'OK' | 'VERIFICATION_CONFIG_ERROR';
  config_errors: string[];
  /** 保护路径的基线哈希比对结果（边界依据） */
  protected_path_violations: string[];
  checks: CheckOutcome[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 展开 `**` / `*` 通配（相对项目根；以基线清单为全集，保证确定性） */
function expandPattern(pattern: string, universe: string[]): string[] {
  const rx = new RegExp(
    '^' +
      pattern
        .split('**')
        .map((part) => part.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
        .join('.*') +
      '$',
  );
  return universe.filter((p) => rx.test(p));
}

/** 执行 `node <script>` 形式的检查命令，输出重定向到文件（规避沙箱管道限制） */
function runNodeCommand(command: string): { exitCode: number; output: string } {
  const parts = command.trim().split(/\s+/);
  if (parts[0] !== 'node' || parts.length < 2) {
    throw new Error(`VERIFICATION_CONFIG_ERROR: 只支持 "node <script>" 形式的 command，收到「${command}」`);
  }
  const script = path.join(PROJECT_ROOT, parts[1]!);
  if (!existsSync(script)) {
    throw new Error(`VERIFICATION_CONFIG_ERROR: 检查脚本不存在：${parts[1]}`);
  }
  const outTmp = path.join(PILOT_WORKSPACE, '.verify-stdout.txt');
  const errTmp = path.join(PILOT_WORKSPACE, '.verify-stderr.txt');
  mkdirSync(PILOT_WORKSPACE, { recursive: true });
  const outFd = openSync(outTmp, 'w');
  const errFd = openSync(errTmp, 'w');
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [script, ...parts.slice(2)], {
      cwd: path.dirname(script),
      stdio: ['ignore', outFd, errFd],
      timeout: 60_000,
    });
  } catch (e) {
    const status = (e as { status?: number | null }).status;
    exitCode = typeof status === 'number' ? status : 1;
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
  return { exitCode, output: readFileSync(outTmp, 'utf8') + readFileSync(errTmp, 'utf8') };
}

function evaluateCheck(
  task: BenchmarkTask,
  check: TaskVerificationCheck,
  baseline: Record<string, string>,
): CheckOutcome {
  const id = check.id;
  const kind = check.kind;
  try {
    switch (kind) {
      case 'command_exit_zero': {
        const r = runNodeCommand(check.command!);
        return { id, kind, status: r.exitCode === 0 ? 'PASS' : 'FAIL', detail: `exit=${r.exitCode}` };
      }
      case 'output_contains': {
        const r = runNodeCommand(check.command!);
        const hit = r.output.includes(check.expect!);
        return {
          id,
          kind,
          status: hit ? 'PASS' : 'FAIL',
          detail: `exit=${r.exitCode}, 输出${hit ? '包含' : '不含'}「${check.expect}」`,
        };
      }
      case 'file_exists':
        return {
          id,
          kind,
          status: existsSync(path.join(PROJECT_ROOT, check.path!)) ? 'PASS' : 'FAIL',
          detail: existsSync(path.join(PROJECT_ROOT, check.path!)) ? '存在' : '不存在',
        };
      case 'file_changed': {
        if (baseline[check.path!] === undefined) {
          return { id, kind, status: 'CONFIG_ERROR', detail: `基线中不存在 ${check.path!}（配置错误）` };
        }
        const now = currentHash(check.path!);
        if (now === null) return { id, kind, status: 'FAIL', detail: '文件已被删除' };
        return { id, kind, status: now !== baseline[check.path!] ? 'PASS' : 'FAIL', detail: now !== baseline[check.path!] ? '已修改' : '与基线一致（未修改）' };
      }
      case 'file_unchanged': {
        if (baseline[check.path!] === undefined) {
          return { id, kind, status: 'CONFIG_ERROR', detail: `基线中不存在 ${check.path!}（配置错误）` };
        }
        const now = currentHash(check.path!);
        return {
          id,
          kind,
          status: now === baseline[check.path!] ? 'PASS' : 'FAIL',
          detail: now === null ? '文件被删除' : now === baseline[check.path!] ? '未被修改' : '已被修改',
        };
      }
      case 'files_unchanged': {
        const targets = (check.paths ?? []).flatMap((p) => expandPattern(p, Object.keys(baseline)));
        if (targets.length === 0) {
          return { id, kind, status: 'CONFIG_ERROR', detail: `patterns 未匹配到任何基线文件：${(check.paths ?? []).join(', ')}` };
        }
        const changed = targets.filter((p) => currentHash(p) !== baseline[p]);
        return {
          id,
          kind,
          status: changed.length === 0 ? 'PASS' : 'FAIL',
          detail: changed.length === 0 ? `${targets.length} 个文件均未改动` : `被改动：${changed.join(', ')}`,
        };
      }
      case 'file_contains': {
        const abs = path.join(PROJECT_ROOT, check.path!);
        if (!existsSync(abs)) return { id, kind, status: 'FAIL', detail: '文件不存在' };
        const text = readFileSync(abs, 'utf8');
        const count = text.split(check.expect!).length - 1;
        const min = check.min_count ?? 1;
        return { id, kind, status: count >= min ? 'PASS' : 'FAIL', detail: `「${check.expect}」出现 ${count} 次（要求 ≥ ${min}）` };
      }
      default:
        return { id, kind, status: 'CONFIG_ERROR', detail: `未知检查类型「${kind}」（配置错误）` };
    }
  } catch (e) {
    return { id, kind, status: 'CONFIG_ERROR', detail: (e as Error).message };
  }
  void task;
}

/** 通用判定：读任务 YAML 的 verification，产出 §9.2 判定结果 */
export function verifyTask(task: BenchmarkTask): VerifyResult {
  const config_errors: string[] = [];
  const seed = loadSeedHashes();
  if (!seed) {
    return {
      task_id: task.id,
      required: {},
      forbidden: {},
      success: null,
      verification_status: 'VERIFICATION_CONFIG_ERROR',
      config_errors: ['未找到种子基线 pilot-workspace/seed-hashes.json：请先运行 scripts/pilot-setup.ts（Run 间必须重建）'],
      protected_path_violations: [],
      checks: [],
    };
  }

  if (task.verification.length === 0) {
    config_errors.push(`任务 ${task.id} 未提供 verification（配置错误，不得当作 FAIL）`);
  }

  const checks = task.verification.map((c) => evaluateCheck(task, c, seed.files));
  for (const c of checks) {
    if (c.status === 'CONFIG_ERROR') config_errors.push(`[${c.id}] ${c.detail}`);
  }

  // required：每个标签必须有检查，否则配置错误
  const required: Record<string, 'PASS' | 'FAIL'> = {};
  for (const label of task.success_criteria_required) {
    const c = checks.find((x) => x.id === label);
    if (!c) {
      config_errors.push(`required 标签「${label}」缺少对应检查（配置错误）`);
      continue;
    }
    required[label] = c.status === 'PASS' ? 'PASS' : 'FAIL';
  }

  // forbidden：每个标签必须有检查；检查通过 = 未触发（false）
  const forbidden: Record<string, boolean> = {};
  for (const label of task.success_criteria_forbidden) {
    const c = checks.find((x) => x.id === label);
    if (!c) {
      config_errors.push(`forbidden 标签「${label}」缺少对应检查（配置错误）`);
      continue;
    }
    forbidden[label] = c.status !== 'PASS';
  }

  // 边界依据：protected_paths 的基线哈希比对（与声明的 forbidden 互为独立证据）
  const protected_path_violations: string[] = [];
  for (const pattern of task.protected_paths) {
    for (const p of expandPattern(pattern, Object.keys(seed.files))) {
      if (currentHash(p) !== seed.files[p]) protected_path_violations.push(p);
    }
  }

  const hasConfigError = config_errors.length > 0;
  const success = hasConfigError
    ? null
    : Object.values(required).every((v) => v === 'PASS') &&
      Object.values(forbidden).every((v) => v === false) &&
      protected_path_violations.length === 0;

  return {
    task_id: task.id,
    required,
    forbidden,
    success,
    verification_status: hasConfigError ? 'VERIFICATION_CONFIG_ERROR' : 'OK',
    config_errors,
    protected_path_violations,
    checks,
  };
}

if (process.argv[1]?.endsWith('pilot-verify.ts')) {
  const taskId = arg('task');
  if (!taskId) throw new Error('必填参数：--task');
  const tasksDir = arg('tasks-dir') ?? TASKS_DIR_DEFAULT;
  const loaded = loadTask(parseYaml(readFileSync(path.join(tasksDir, `${taskId}.yaml`), 'utf8')));
  if (!loaded.ok) throw new Error(`任务 ${taskId} 校验失败：${loaded.issues.map((i) => i.field).join(', ')}`);
  const result = verifyTask(loaded.task);

  const outDir = path.join(PROJECT_ROOT, arg('out') ?? 'pilot-workspace');
  mkdirSync(outDir, { recursive: true });
  const judge = {
    task_id: result.task_id,
    success_criteria_results: [
      ...Object.entries(result.required).map(([criterion, v]) => ({ criterion, passed: v === 'PASS' })),
      ...Object.entries(result.forbidden).map(([criterion, violated]) => ({ criterion, passed: !violated })),
    ],
    forbidden_file_changes: result.protected_path_violations,
    verification_tool_called: true,
    subagent_invocations: 0, // 由采集阶段按轨迹覆盖
    wall_time_ms: 0, // 由采集阶段按会话覆盖
    verification_status: result.verification_status,
    config_errors: result.config_errors,
  };
  writeFileSync(path.join(outDir, `judge-${taskId}.json`), JSON.stringify(judge, null, 2) + '\n', 'utf8');

  console.log(`判定写入：${path.join(outDir, `judge-${taskId}.json`)}`);
  for (const c of result.checks) console.log(`  [${c.status}] ${c.id} (${c.kind}) — ${c.detail}`);
  if (result.config_errors.length) {
    console.log(`\n⚠️ VERIFICATION_CONFIG_ERROR（实验基础设施错误，不得算作模型失败）：`);
    for (const e of result.config_errors) console.log(`  - ${e}`);
    process.exit(3);
  }
  console.log(`\ntask_success = ${String(result.success)}（protected 违规：${result.protected_path_violations.length}）`);
  process.exit(result.success ? 0 : 1);
}
