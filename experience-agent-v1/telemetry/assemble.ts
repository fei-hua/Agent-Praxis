/**
 * telemetry/assemble.ts — T2 组装：DSH 会话日志 + 任务 + 检索结果 → typed JSONL 轨迹
 *
 * 事件顺序（tasks/phase0.md §4.2 覆盖清单）：
 *   run_start → task_state → experience_retrieval → tool_call/tool_result（配对）
 *   → subagent_invocation/subagent_result → failure → replan
 *   → verification_result → outcome → run_end
 *
 * 全部事件字段来自真实记录（会话日志 / 结构化 task_state / 检索结果 / 判定输入），
 * 不做任何 LLM 事后推断。reflection_output 为 null（Phase 0 不做 Reflection）。
 */

import type { BenchmarkTask } from '../benchmark/tasks.ts';
import type { DecodedSessionLog, RawSessionEvent } from './session-log.ts';
import { sumUsage, type ExperienceTokenAccounting } from '../core/token-accounting.ts';
import type { Arm } from '../core/enums.ts';
import type { RunManifest } from '../core/run-manifest.ts';
import {
  deriveFailures,
  deriveReplans,
  extractModelId,
  extractSubagentInvocations,
  extractTaskStates,
  extractTokenUsage,
  extractToolCalls,
  extractToolResults,
  type TaskStateCapture,
} from './extract.ts';
import type {
  FailureRecord,
  ReplanRecord,
  RetrievedExperienceRef,
  RunRecord,
  SubagentInvocationRecord,
  SubagentResultRecord,
  ToolCallRecord,
  ToolResultRecord,
  TrajectoryEvent,
  VerificationResultRecord,
} from './trajectory.ts';

export interface AssembleRunInput {
  runId: string;
  task: BenchmarkTask;
  /**
   * 实验臂：dry-run 传 null（OQ-008）；Pilot/Formal 传 core/arms.ts 中已冻结的真实臂值。
   */
  arm?: Arm | null;
  /** Run isolation：本次 run 的 manifest（Pilot/Formal 必填；dry-run 为 null） */
  runManifest?: RunManifest | null;
  /** CDA 冻结口径：期望委派轴与单次得分（dry-run 为 null） */
  expectedDelegation?: boolean | null;
  cda?: 0 | 1 | null;
  /** 执行会话（主 agent）的日志 */
  primaryLog: DecodedSessionLog;
  /** 委派子会话日志（DELEGATE/PARALLEL/WORKFLOW 成员） */
  childLogs?: DecodedSessionLog[];
  retrieved: RetrievedExperienceRef[];
  /** OQ-011 裁决：注入上下文的 token 记账（experience_item_tokens / experience_context_tokens / experience_count） */
  tokenAccounting: ExperienceTokenAccounting;
  experienceSnapshotId: string;
  experimentConfigHash: string;
  env: {
    harness_version: string;
    tool_schema_version: string;
    framework_version: string;
  };
  /** §9.2 判定输入（代码判定，不进模型 prompt） */
  verification: {
    success_criteria_results: Array<{ criterion: string; passed: boolean }>;
    forbidden_file_changes: string[];
    verification_tool_called: boolean;
  };
  wallTimeMs: number;
}

export function assembleRun(input: AssembleRunInput): { events: TrajectoryEvent[]; record: RunRecord } {
  const { runId, task, primaryLog } = input;
  const childLogs = input.childLogs ?? [];
  const allLogs = [primaryLog, ...childLogs];

  // ---- 源提取 ----
  const taskStates: TaskStateCapture[] = extractTaskStates(primaryLog.events);
  if (taskStates.length === 0) {
    throw new Error(`run ${runId}：未捕获到任何 task_state（§4.1 必须记录；OQ-010 提取口径）`);
  }
  const firstState = taskStates[0]!;

  const callsByLog = allLogs.map((l) => extractToolCalls(l.events));
  const resultsByLog = allLogs.map((l) => extractToolResults(l.events));
  // OQ-018 裁决：逐条 usage 归一后按同一口径求和（provider total 优先；reasoning 不重复计入）
  const usage = sumUsage([extractTokenUsage(primaryLog.events), ...childLogs.map((l) => extractTokenUsage(l.events))]);

  // tool_call / tool_result 记录（含子会话来源标记）
  const toolCalls: ToolCallRecord[] = [];
  const toolResults: ToolResultRecord[] = [];
  allLogs.forEach((log, li) => {
    const sessionTag = li === 0 ? 'primary' : log.header.id;
    for (const c of callsByLog[li]!) {
      toolCalls.push({ call_id: c.call_id, tool_name: c.tool_name, arguments: c.arguments, from_session: sessionTag });
    }
    for (const r of resultsByLog[li]!) {
      toolResults.push({ call_id: r.call_id, ok: r.ok, result_summary: r.result_summary, from_session: sessionTag });
    }
  });

  const subs = extractSubagentInvocations(primaryLog.events);
  const subagentInvocations: SubagentInvocationRecord[] = subs.invocations.map((i) => ({
    invocation_id: i.invocation_id,
    agent_name: i.agent_name,
    task_brief: i.task_brief,
  }));
  const subagentResults: SubagentResultRecord[] = subs.results.map((r) => ({
    invocation_id: r.invocation_id,
    ok: r.ok,
    result_summary: r.result_summary,
  }));

  const failures: FailureRecord[] = [];
  allLogs.forEach((log, li) => {
    const prefix = li === 0 ? '' : `${log.header.id.slice(0, 8)}-`;
    for (const f of deriveFailures(log.events)) {
      failures.push({ ...f, failure_id: prefix + f.failure_id });
    }
  });
  const replans: ReplanRecord[] = deriveReplans(taskStates, failures);

  // ---- verification_result（§9.2 纯代码判定）----
  const required: Record<string, 'PASS' | 'FAIL'> = {};
  for (const r of input.verification.success_criteria_results) {
    required[r.criterion] = r.passed ? 'PASS' : 'FAIL';
  }
  const forbidden: Record<string, boolean> = {};
  for (const p of input.verification.forbidden_file_changes) {
    forbidden[p] = true;
  }
  const verificationResult: VerificationResultRecord = {
    required,
    forbidden,
    success:
      input.verification.success_criteria_results.length > 0 &&
      input.verification.success_criteria_results.every((r) => r.passed) &&
      input.verification.forbidden_file_changes.length === 0 &&
      input.verification.verification_tool_called,
  };

  const outcome = {
    tokens: usage.total_tokens,
    subagent_calls: subagentInvocations.length,
    wall_time_s: input.wallTimeMs / 1000,
  };

  const record: RunRecord = {
    run_id: runId,
    task_id: task.id,
    arm: input.arm ?? null, // OQ-008：dry-run 为 null
    run_manifest: input.runManifest ?? null,
    expected_delegation: input.expectedDelegation ?? null,
    cda: input.cda ?? null,
    task_state: firstState.envelope,
    first_tool_call: toolCalls[0] ?? null,
    experience_snapshot_id: input.experienceSnapshotId,
    retrieved_experiences: input.retrieved,
    tool_calls: toolCalls,
    tool_results: toolResults,
    subagent_invocations: subagentInvocations,
    verification_result: verificationResult,
    reflection_output: null, // Phase 0 不做 Reflection
    outcome,
    harness_version: input.env.harness_version,
    tool_schema_version: input.env.tool_schema_version,
    framework_version: input.env.framework_version,
    model_id: extractModelId(primaryLog.events) ?? 'unknown',
    experiment_config_hash: input.experimentConfigHash,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    reasoning_tokens: usage.reasoning_tokens,
    experience_context_tokens: input.tokenAccounting.experience_context_tokens,
    token_accounting_source: input.tokenAccounting.token_accounting_source,
    wall_time_ms: input.wallTimeMs,
    success_criteria: task.success_criteria,
  };

  // ---- 事件流 ----
  const events: TrajectoryEvent[] = [];
  let seq = 0;
  const now = () => new Date().toISOString();
  const firstTs = primaryLog.events[0] ? new Date(primaryLog.events[0].time).toISOString() : now();
  type WithoutSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;
  const push = (e: WithoutSeq<TrajectoryEvent>): void => {
    events.push({ ...e, seq: ++seq } as TrajectoryEvent);
  };

  push({
    type: 'run_start',
    ts: firstTs,
    run_id: runId,
    task_id: task.id,
    arm: input.arm ?? null,
    experience_snapshot_id: input.experienceSnapshotId,
    harness_version: input.env.harness_version,
    tool_schema_version: input.env.tool_schema_version,
    framework_version: input.env.framework_version,
    model_id: record.model_id,
    experiment_config_hash: input.experimentConfigHash,
    run_manifest: input.runManifest ?? null,
  });

  for (const ts of taskStates) {
    push({
      type: 'task_state',
      ts: now(),
      run_id: runId,
      task_state: ts.envelope,
      first_decision: ts.first_decision,
      capture_source: 'first_turn_structured_json',
      capture_oq: 'OQ-010',
    });
  }

  push({
    type: 'experience_retrieval',
    ts: now(),
    run_id: runId,
    experience_snapshot_id: input.experienceSnapshotId,
    retrieved_experiences: input.retrieved,
    experience_context_tokens: input.tokenAccounting.experience_context_tokens,
    token_accounting_source: input.tokenAccounting.token_accounting_source,
  });

  // tool_call/tool_result/subagent/failure：按源事件 seq 合并排序（多会话按各自 seq 交错）
  type Stamped =
    | { kind: 'tool_call'; seq: number; ev: ToolCallRecord; ts: string }
    | { kind: 'tool_result'; seq: number; ev: ToolResultRecord; ts: string }
    | { kind: 'sub_inv'; seq: number; ev: SubagentInvocationRecord; ts: string }
    | { kind: 'sub_res'; seq: number; ev: SubagentResultRecord; ts: string }
    | { kind: 'failure'; seq: number; ev: FailureRecord; ts: string };
  const stamped: Stamped[] = [];
  callsByLog.forEach((calls, li) => {
    for (const c of calls) {
      stamped.push({ kind: 'tool_call', seq: c.seq, ev: { call_id: c.call_id, tool_name: c.tool_name, arguments: c.arguments, from_session: li === 0 ? 'primary' : allLogs[li]!.header.id }, ts: now() });
    }
  });
  resultsByLog.forEach((results, li) => {
    for (const r of results) {
      stamped.push({ kind: 'tool_result', seq: r.seq, ev: { call_id: r.call_id, ok: r.ok, result_summary: r.result_summary, from_session: li === 0 ? 'primary' : allLogs[li]!.header.id }, ts: now() });
    }
  });
  for (const i of subs.invocations) {
    stamped.push({ kind: 'sub_inv', seq: i.seq, ev: { invocation_id: i.invocation_id, agent_name: i.agent_name, task_brief: i.task_brief }, ts: now() });
  }
  for (const r of subs.results) {
    stamped.push({ kind: 'sub_res', seq: r.seq, ev: { invocation_id: r.invocation_id, ok: r.ok, result_summary: r.result_summary }, ts: now() });
  }
  for (const f of failures) {
    // failure 紧随其触发结果之后（保持可重建上下文顺序）
    stamped.push({ kind: 'failure', seq: Number.MAX_SAFE_INTEGER, ev: f, ts: now() });
  }
  stamped.sort((a, b) => a.seq - b.seq);

  for (const s of stamped) {
    if (s.kind === 'tool_call') push({ type: 'tool_call', ts: s.ts, run_id: runId, call: s.ev });
    else if (s.kind === 'tool_result') push({ type: 'tool_result', ts: s.ts, run_id: runId, result: s.ev });
    else if (s.kind === 'sub_inv') push({ type: 'subagent_invocation', ts: s.ts, run_id: runId, invocation: s.ev });
    else if (s.kind === 'sub_res') push({ type: 'subagent_result', ts: s.ts, run_id: runId, result: s.ev });
    else push({ type: 'failure', ts: s.ts, run_id: runId, failure: s.ev });
  }

  for (const r of replans) {
    push({ type: 'replan', ts: now(), run_id: runId, replan: r });
  }

  push({ type: 'verification_result', ts: now(), run_id: runId, verification_result: verificationResult });
  push({ type: 'outcome', ts: now(), run_id: runId, outcome });
  push({ type: 'run_end', ts: now(), run_id: runId, run_record: record });

  return { events, record };
}

export type { RawSessionEvent };
