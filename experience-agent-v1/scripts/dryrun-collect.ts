/**
 * scripts/dryrun-collect.ts — 单个 dry-run 的轨迹组装（T2/T8/T10 采集侧）
 *
 * 用法：
 *   node scripts/dryrun-collect.ts --task DRY-01 --run-id run-2026-09-27-DRY-01 \
 *     --primary <sessionId> [--children <id1,id2>] --judge <judge-DRY-01.json>
 *
 * 流程（全部真实记录，不做 LLM 推断）：
 *   会话日志 → task_state 提取（代码直读 first_decision）→ SNAPSHOT_01 检索
 *   → env 版本（OQ-016：tool_schema_version = 运行时 ToolSchema canonical hash）
 *   → experiment_config_hash（OQ-009）→ assembleRun → typed JSONL 落盘
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask, type BenchmarkTask } from '../benchmark/tasks.ts';
import { loadSnapshot } from '../experience/snapshot.ts';
import {
  retrieve,
  ruledContraindicationSimilarity,
  type CandidateExperience,
  type RetrievalQuery,
} from '../experience/retrieval.ts';
import { PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';
import type { Experience } from '../experience/schema.ts';
import { buildExperimentConfig, experimentConfigHash, type EnvironmentCompatibility } from '../core/experiment-config.ts';
import { computeToolSchemaVersion, toModelVisibleSchemas } from '../core/tool-schema-version.ts';
import { extractTaskStates } from '../telemetry/extract.ts';
import { findSessionLog, decodeSessionLog } from '../telemetry/session-log.ts';
import { assembleRun } from '../telemetry/assemble.ts';
import { TrajectoryRecorder, type RetrievedExperienceRef, type TrajectoryEvent } from '../telemetry/trajectory.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const TASKS_DIR = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'dry-run');
const SNAP_DIR = path.join(PROJECT_ROOT, 'snapshots');
const TRAJ_DIR = path.join(PROJECT_ROOT, 'telemetry', 'trajectories');
const HARNESS_PKG = 'C:\\Users\\asus\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules\\@deepseek-ai\\dsh\\package.json';
const FRAMEWORK_VERSION = '1.0'; // Agent Praxis schema/protocol version（OQ-016 裁决来源）

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const taskId = arg('task');
  const runId = arg('run-id');
  const primaryId = arg('primary');
  const judgePath = arg('judge');
  if (!taskId || !runId || !primaryId || !judgePath) {
    throw new Error('必填参数：--task --run-id --primary --judge');
  }
  const explicitChildren = (arg('children') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  // 任务定义
  const taskDoc = parseYaml(readFileSync(path.join(TASKS_DIR, `${taskId}.yaml`), 'utf8'));
  const loaded = loadTask(taskDoc);
  if (!loaded.ok) throw new Error(`任务 ${taskId} 校验失败：${loaded.issues.map((i) => i.field).join(', ')}`);
  const task: BenchmarkTask = loaded.task;

  // 会话日志
  const dshHome = path.join(process.env['USERPROFILE'] ?? '', '.dsh');
  const primaryLog = decodeSessionLog(findSessionLog(dshHome, primaryId).logPath);
  // 子会话：显式参数优先，否则从执行会话的 subagent/catalog 自动派生
  const catalogChildren = primaryLog.events
    .filter((e) => e.type === 'subagent/catalog')
    .map((e) => String((e.data as { childId?: unknown }).childId ?? ''))
    .filter(Boolean);
  const childIds = explicitChildren.length > 0 ? explicitChildren : catalogChildren;
  const childLogs = childIds.map((cid) => decodeSessionLog(findSessionLog(dshHome, cid).logPath));

  // task_state（第一条 = 初始；代码直读 first_decision）
  const taskStates = extractTaskStates(primaryLog.events);
  if (taskStates.length === 0) throw new Error(`run ${runId}：会话中没有可校验的 task_state（OQ-010）`);
  const profile = taskStates[0]!.envelope.task_state;

  // 检索（SNAPSHOT_01 只读；冻结公式链 §5.2–§5.7）
  const snap = loadSnapshot(SNAP_DIR, 'SNAPSHOT_01');
  const store = snap.openReadOnly();
  const query: RetrievalQuery = {
    task_type: profile.task_type,
    complexity: profile.complexity,
    characteristics: profile.characteristics,
    constraints: profile.constraints,
    scope: profile.scope,
    project_id: 'experience-agent-v1', // OQ-014：Phase 0 单项目，全部候选同项目
  };
  const toCandidate = (e: Experience): CandidateExperience => ({
    id: e.id,
    task_type: e.task_type,
    complexity: e.complexity,
    characteristics: e.characteristics,
    constraints: e.constraints,
    scope: e.scope,
    project_id: 'experience-agent-v1',
    situation: e.situation,
    lesson: e.lesson,
    decision: e.decision,
    contraindications: e.contraindications,
    independent_support: e.independent_support,
    conflict_count: e.conflict_count,
  });
  const candidates = store.listRetrievable().map(toCandidate);
  const queryText = [task.prompt, profile.task_type, profile.characteristics.join(' ')].join(' ');
  const lexical = store.bm25(queryText);
  const result = retrieve({
    query,
    candidates,
    lexical,
    calibration: PLACEHOLDER_CALIBRATION, // OQ-013：标定口径未裁决，占位常数
    environment: 'compatible', // Phase 0 dry-run 同环境（OQ-003 规则 1）
    contraindicationSimilarity: ruledContraindicationSimilarity,
  });
  const retrieved: RetrievedExperienceRef[] = result.in_context.map((s) => ({
    id: s.candidate.id,
    final_score: s.final_score,
    retrieval_status: s.retrieval_status,
    relevance_score: s.relevance_score,
    reliability_score: s.reliability_score,
    contraindication_factor: s.contraindication_factor,
  }));

  // env（OQ-016 / OQ-003 裁决）
  const harnessVersion = (JSON.parse(readFileSync(HARNESS_PKG, 'utf8')) as { version?: string }).version;
  if (!harnessVersion) throw new Error('Harness package.json 缺 version');
  const reqHeader = primaryLog.events.find((e) => e.type === 'request/header');
  const tools = (reqHeader?.data as { header?: { tools?: unknown } } | undefined)?.header?.tools;
  if (!Array.isArray(tools)) throw new Error(`run ${runId}：会话没有 request/header 工具快照，无法计算 tool_schema_version`);
  const env: EnvironmentCompatibility = {
    harness_version: harnessVersion,
    tool_schema_version: computeToolSchemaVersion(toModelVisibleSchemas(tools)),
    framework_version: FRAMEWORK_VERSION,
  };
  const configHash = experimentConfigHash(buildExperimentConfig(env));

  // judge 输入（§9.2 判定结果，由 dryrun-judge 产出）
  const judge = JSON.parse(readFileSync(judgePath, 'utf8')) as {
    success_criteria_results: Array<{ criterion: string; passed: boolean; evidence?: string }>;
    forbidden_file_changes: string[];
    verification_tool_called: boolean;
    wall_time_ms: number;
  };

  const { events, record } = assembleRun({
    runId,
    task,
    primaryLog,
    childLogs,
    retrieved,
    experienceSnapshotId: 'SNAPSHOT_01',
    experimentConfigHash: configHash,
    env,
    verification: {
      success_criteria_results: judge.success_criteria_results.map((r) => ({ criterion: r.criterion, passed: r.passed })),
      forbidden_file_changes: judge.forbidden_file_changes,
      verification_tool_called: judge.verification_tool_called,
    },
    wallTimeMs: judge.wall_time_ms,
  });

  mkdirSync(TRAJ_DIR, { recursive: true });
  const recorder = new TrajectoryRecorder(runId, TRAJ_DIR);
  for (const e of events) {
    recorder.append(e);
  }
  const outPath = path.join(TRAJ_DIR, `${runId}.jsonl`);
  writeFileSync(path.join(TRAJ_DIR, `${runId}.summary.json`), JSON.stringify(record, null, 2) + '\n');
  console.log(`轨迹写入：${outPath}（events=${events.length}）`);
  console.log(`config_hash=${configHash} tool_schema=${env.tool_schema_version} retrieved=${retrieved.length}`);
}

main();
