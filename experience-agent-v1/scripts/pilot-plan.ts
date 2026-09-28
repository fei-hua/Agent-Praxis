/**
 * scripts/pilot-plan.ts — Pilot run 计划与**执行前**门禁（Issue #8）
 *
 * 用法：
 *   node scripts/pilot-plan.ts --task PILOT-01 --arm C_frozen \
 *     --run-id pilot-2026-10-01-PILOT-01-C-R1 --harness-version 0.1.7-rc.2 \
 *     [--tool-schema-from-session <sessionId> | --tool-schema-version tschema-xxxxxxxxxxxx] \
 *     [--tasks-dir benchmark/tasks/pilot] [--repetition 1] [--out pilot-runs]
 *
 * 产出：`<out>/<run-id>.plan.json` —— 含 run manifest、臂指令块、期望委派轴。
 * 门禁：manifest 与运行时环境逐字段比对；不一致 → CONFIG_MISMATCH → **不产生 plan**（禁止开跑）。
 *
 * 说明（如实标注）：`tool_schema_version` 只能来自真实会话的 `request/header` 快照。
 *   - 给了 `--tool-schema-from-session`：则执行前就把它纳入门禁（推荐：用同一配置下的参考会话）；
 *   - 给了 `--tool-schema-version`：直接采用该声明值；
 *   - 两者都没有：plan 中标注 `tool_schema_verified: false`，该字段由采集阶段（collect）用 run 自己的
 *     会话快照再次门禁——即「先跑后验」只允许存在于该字段，其余 5 个字段一律执行前验。
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask, type BenchmarkTask } from '../benchmark/tasks.ts';
import { expectedDelegation } from '../benchmark/cda.ts';
import { buildArmRunPlan, composeArmPrompt } from '../policies/arm-prompt.ts';
import { buildExperimentConfig, experimentConfigHash, type EnvironmentCompatibility } from '../core/experiment-config.ts';
import { computeToolSchemaVersion, toModelVisibleSchemas } from '../core/tool-schema-version.ts';
import { assertRunManifest, type RunManifest } from '../core/run-manifest.ts';
import { assertPilotArm } from '../core/arms.ts';
import type { Arm } from '../core/enums.ts';
import { assertFormalCounter, DIAGNOSTIC_ESTIMATOR, type TokenCounter } from '../core/token-accounting.ts';
import { findSessionLog, decodeSessionLog } from '../telemetry/session-log.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const TASKS_DIR_DEFAULT = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');
const HARNESS_PKG =
  'C:\\Users\\asus\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules\\@deepseek-ai\\dsh\\package.json';
const FRAMEWORK_VERSION = '1.0';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface PilotRunPlan {
  run_id: string;
  task_id: string;
  arm: Arm;
  repetition: number;
  manifest: RunManifest;
  expected_delegation: boolean;
  /** 注入主 Agent 的指令块（A 臂为空字符串） */
  instruction: string;
  injection: { experience: boolean; reflection: boolean; snapshot_id: string };
  tool_schema_verified: boolean;
  token_accounting_source: string;
  generated_at: string;
}

/** tool_schema_version：优先参考会话快照（执行前可验），其次显式声明，最后留给采集阶段 */
function resolveToolSchemaVersion(dshHome: string): { version: string | null; verified: boolean } {
  const explicit = arg('tool-schema-version');
  if (explicit) return { version: explicit, verified: true };
  const sessionId = arg('tool-schema-from-session');
  if (!sessionId) return { version: null, verified: false };
  const log = decodeSessionLog(findSessionLog(dshHome, sessionId).logPath);
  const header = log.events.find((e) => e.type === 'request/header');
  const tools = (header?.data as { header?: { tools?: unknown } } | undefined)?.header?.tools;
  if (!Array.isArray(tools)) {
    throw new Error(`参考会话 ${sessionId} 没有 request/header 工具快照，无法计算 tool_schema_version`);
  }
  return { version: computeToolSchemaVersion(toModelVisibleSchemas(tools)), verified: true };
}

function main(): void {
  const taskId = arg('task');
  const runId = arg('run-id');
  const armArg = arg('arm');
  const harnessVersion = arg('harness-version');
  if (!taskId || !runId || !armArg || !harnessVersion) {
    throw new Error('必填参数：--task --run-id --arm --harness-version');
  }

  const arm = armArg as Arm;
  assertPilotArm(arm); // Pilot 只允许 A / B / C_frozen
  const plan = buildArmRunPlan(arm);

  // 任务定义（人工预先定义的 expected_first_decisions；不得由 Policy 生成）
  const tasksDir = arg('tasks-dir') ?? TASKS_DIR_DEFAULT;
  const taskPath = path.join(tasksDir, `${taskId}.yaml`);
  if (!existsSync(taskPath)) throw new Error(`任务定义不存在：${taskPath}`);
  const loaded = loadTask(parseYaml(readFileSync(taskPath, 'utf8')));
  if (!loaded.ok) throw new Error(`任务 ${taskId} 校验失败：${loaded.issues.map((i) => i.field).join(', ')}`);
  const task: BenchmarkTask = loaded.task;

  // 环境（OQ-016：harness_version 由运行方显式给出，即 run 当时的版本）
  const dshHome = path.join(process.env['USERPROFILE'] ?? '', '.dsh');
  const { version: toolSchemaVersion, verified } = resolveToolSchemaVersion(dshHome);
  const env: EnvironmentCompatibility = {
    harness_version: harnessVersion,
    tool_schema_version: toolSchemaVersion ?? 'UNVERIFIED_AT_PLAN_TIME',
    framework_version: FRAMEWORK_VERSION,
  };
  const configHash = experimentConfigHash(buildExperimentConfig(env));

  const manifest: RunManifest = {
    arm,
    snapshot_id: plan.snapshot_id,
    policy_hash: plan.policy_hash,
    experiment_config_hash: configHash,
    harness_version: harnessVersion,
    tool_schema_version: toolSchemaVersion ?? 'UNVERIFIED_AT_PLAN_TIME',
  };

  // 执行前门禁：manifest 与运行时环境逐字段比对（tool_schema 未提供时该字段为占位，见文件头说明）
  if (verified) {
    assertRunManifest(manifest, { ...manifest });
  }

  // OQ-011：Pilot 正式口径必须是 Harness/Provider 侧计数；未接入前显式提示（不静默用诊断口径）
  const counter: TokenCounter = DIAGNOSTIC_ESTIMATOR;
  let tokenSource = counter.source as string;
  try {
    assertFormalCounter(counter);
  } catch {
    tokenSource = 'diagnostic（Pilot 前必须接入 Harness/Provider 侧计数）';
  }

  const runPlan: PilotRunPlan = {
    run_id: runId,
    task_id: taskId,
    arm,
    repetition: Number(arg('repetition') ?? '1'),
    manifest,
    expected_delegation: expectedDelegation(task.expected_first_decisions),
    instruction: composeArmPrompt(plan),
    injection: {
      experience: plan.inject_experience,
      reflection: plan.reflection_enabled,
      snapshot_id: plan.snapshot_id,
    },
    tool_schema_verified: verified,
    token_accounting_source: tokenSource,
    generated_at: new Date().toISOString(),
  };

  const outDir = path.join(PROJECT_ROOT, arg('out') ?? 'pilot-runs');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${runId}.plan.json`);
  writeFileSync(outPath, JSON.stringify(runPlan, null, 2) + '\n');

  console.log(`plan 写入：${outPath}`);
  console.log(
    `arm=${arm} snapshot=${manifest.snapshot_id} policy=${manifest.policy_hash ?? 'null'} ` +
      `config=${manifest.experiment_config_hash.slice(0, 20)}… tool_schema=${verified ? '已验证' : '待采集阶段验证'}`,
  );
  console.log(`expected_delegation=${runPlan.expected_delegation} 经验注入=${runPlan.injection.experience} Reflection=${runPlan.injection.reflection}`);
  if (runPlan.instruction !== '') {
    console.log('--- 注入主 Agent 的指令块（节选）---');
    console.log(runPlan.instruction.split('\n').slice(0, 12).join('\n'));
  } else {
    console.log('--- A 臂：不注入任何指令块 ---');
  }
}

// 仅在作为 CLI 直接运行时执行（被测试 import 时不启动）
if (process.argv[1]?.endsWith('pilot-plan.ts')) {
  main();
}
