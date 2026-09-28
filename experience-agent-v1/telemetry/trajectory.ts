/**
 * telemetry/trajectory.ts — Trajectory Recorder（spec/frozen.md §8 / tasks/phase0.md T2、T8）
 *
 * 把 Harness Session 事件流落成 append-only typed JSONL，一次 run 一个文件：
 *   telemetry/trajectories/{run_id}.jsonl
 *
 * 必须能离线重建（tasks/phase0.md T2）：
 *   Task → Task State → First Decision → Action → Tool/Subagent → Outcome
 *
 * 硬约束：
 *   - first_decision 只来自 task_state.first_decision（代码直读，绝不 LLM 推断）；
 *   - run 必录字段逐字来自 spec/frozen.md §8.1 / tasks/phase0.md §6.3。
 *
 * 规格未定义处（不猜、不造值）：
 *   OQ-008  dry-run run 的 arm 取值（enum 不覆盖 dry-run）→ arm 允许为 null 并标记
 *           （人工裁决 2026-09-27：字段存在、值为 null、附 OQ-008 标记）
 *   OQ-009  experiment_config_hash 已裁决（2026-09-27）：
 *           = SHA256(canonical_json(experiment_config))，见 core/experiment-config.ts
 */

import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Arm, FirstDecision, RetrievalStatus } from '../core/enums.ts';
import type { TokenAccountingSource } from '../core/token-accounting.ts';
import type { TaskStateEnvelope } from '../core/task-state.ts';

// ---------- 事件负载类型 ----------

export interface RetrievedExperienceRef {
  id: string;
  final_score: number;
  retrieval_status: RetrievalStatus;
  relevance_score: number;
  reliability_score: number;
  contraindication_factor: number;
  /** OQ-011 裁决：该条经验序列化后的 token 数（experience_item_tokens） */
  tokens: number;
}

export interface ToolCallRecord {
  call_id: string;
  tool_name: string;
  arguments: unknown;
  /** 来源会话：'primary' = 执行会话，否则为委派子会话 id（可重建上下文） */
  from_session?: string;
}

export interface ToolResultRecord {
  call_id: string;
  ok: boolean;
  result_summary: string;
  /** 来源会话：'primary' = 执行会话，否则为委派子会话 id */
  from_session?: string;
}

export interface SubagentInvocationRecord {
  invocation_id: string;
  agent_name: string;
  task_brief: string;
}

export interface SubagentResultRecord {
  invocation_id: string;
  ok: boolean;
  result_summary: string;
}

export interface VerificationResultRecord {
  /** §9.2：成功 ⇔ 所有 required = PASS AND 所有 forbidden = FALSE（纯代码判定） */
  required: Record<string, 'PASS' | 'FAIL'>;
  forbidden: Record<string, boolean>;
  success: boolean;
}

export interface FailureContext {
  /** 关联的 tool/subagent 事件 id（可重建失败上下文） */
  tool_call_id?: string;
  subagent_invocation_id?: string;
  /** 关联的会话事件 seq（run 级失败，如 provider/harness 异常） */
  event_seq?: number;
  step?: string;
}

/**
 * OQ-019 人工裁决（2026-09-27）的四类 failure。
 * failure = 一次执行步骤未达到预期执行结果，且需要进入错误处理流程。
 */
export const FAILURE_CLASSES = [
  'tool_execution',
  'command_execution',
  'agent_action',
  'infrastructure',
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export interface FailureRecord {
  failure_id: string;
  /** OQ-019：失败分类（四类之一） */
  class: FailureClass;
  reason: string;
  kind: string;
  context: FailureContext;
}

export interface ReplanRecord {
  replan_id: string;
  /** 触发来源：failure_id（可重建 replan 的触发） */
  trigger_failure_id: string;
  decision_before: FirstDecision;
  decision_after: FirstDecision;
  note: string;
}

export interface RunOutcome {
  tokens: number;
  subagent_calls: number;
  wall_time_s: number;
}

// ---------- typed JSONL 事件（append-only） ----------

interface EventBase {
  seq: number;
  ts: string;
  run_id: string;
}

export interface RunStartEvent extends EventBase {
  type: 'run_start';
  task_id: string;
  arm: Arm | null; // OQ-008：dry-run 取值未裁决，不造值
  experience_snapshot_id: string;
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
  model_id: string;
  /** OQ-009 裁决：SHA256(canonical_json(experiment_config))，"sha256:<hex>" */
  experiment_config_hash: string;
}

export interface TaskStateEvent extends EventBase {
  type: 'task_state';
  task_state: TaskStateEnvelope;
  /**
   * T8：first_decision 出现在 trajectory 中且可被代码直接索引。
   * 唯一来源 = task_state.first_decision（代码复制字段，非推断）。
   */
  first_decision: FirstDecision;
  /**
   * OQ-010 裁决：两级通道 —— 优先 'dedicated_event'（Harness 专用结构化事件）；
   * 当前 Harness 无该事件，故实际值为回退通道 'first_turn_structured_json'。
   */
  capture_source: 'dedicated_event' | 'first_turn_structured_json';
  capture_oq: 'OQ-010';
}

export interface RetrievalEvent extends EventBase {
  type: 'experience_retrieval';
  experience_snapshot_id: string;
  retrieved_experiences: RetrievedExperienceRef[];
  /** OQ-011 裁决：注入上下文的经验总 token 数（experience_context_tokens） */
  experience_context_tokens: number;
  /** OQ-011 裁决：计数口径来源（正式实验必须为 'harness' | 'provider'） */
  token_accounting_source: TokenAccountingSource;
}

export interface ToolCallEvent extends EventBase {
  type: 'tool_call';
  call: ToolCallRecord;
}

export interface ToolResultEvent extends EventBase {
  type: 'tool_result';
  result: ToolResultRecord;
}

export interface SubagentInvocationEvent extends EventBase {
  type: 'subagent_invocation';
  invocation: SubagentInvocationRecord;
}

export interface SubagentResultEvent extends EventBase {
  type: 'subagent_result';
  result: SubagentResultRecord;
}

export interface FailureEvent extends EventBase {
  type: 'failure';
  failure: FailureRecord;
}

export interface ReplanEvent extends EventBase {
  type: 'replan';
  replan: ReplanRecord;
}

export interface VerificationEvent extends EventBase {
  type: 'verification_result';
  verification_result: VerificationResultRecord;
}

export interface ReflectionOutputEvent extends EventBase {
  type: 'reflection_output';
  reflection_output: unknown;
}

export interface OutcomeEvent extends EventBase {
  type: 'outcome';
  outcome: RunOutcome;
}

export interface RunEndEvent extends EventBase {
  type: 'run_end';
  run_record: RunRecord;
}

export type TrajectoryEvent =
  | RunStartEvent
  | TaskStateEvent
  | RetrievalEvent
  | ToolCallEvent
  | ToolResultEvent
  | SubagentInvocationEvent
  | SubagentResultEvent
  | FailureEvent
  | ReplanEvent
  | VerificationEvent
  | ReflectionOutputEvent
  | OutcomeEvent
  | RunEndEvent;

// ---------- Run Record（spec/frozen.md §8.1 / tasks/phase0.md §6.3，逐字） ----------

export interface RunRecord {
  run_id: string;
  task_id: string;
  arm: Arm | null; // OQ-008
  task_state: TaskStateEnvelope;
  first_tool_call: ToolCallRecord | null;
  experience_snapshot_id: string;
  retrieved_experiences: RetrievedExperienceRef[];
  tool_calls: ToolCallRecord[];
  tool_results: ToolResultRecord[];
  subagent_invocations: SubagentInvocationRecord[];
  verification_result: VerificationResultRecord | null;
  reflection_output: unknown | null;
  outcome: RunOutcome;
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
  model_id: string;
  /** OQ-009 裁决：SHA256(canonical_json(experiment_config))，"sha256:<hex>" */
  experiment_config_hash: string;
  /** §8.1：Input Token / Output Token / 总 Token（OQ-018 裁决：以 Harness/Provider usage 为权威来源） */
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /** OQ-018 裁决：cache read tokens（provider 提供时记录） */
  cache_read_tokens: number;
  /** OQ-018 裁决：reasoning tokens（provider 未单独提供时为 null；已含在 output 内时不重复计算） */
  reasoning_tokens: number | null;
  /** OQ-011 裁决：注入上下文的经验总 token 数 */
  experience_context_tokens: number;
  /** OQ-011 裁决：token 计数口径来源（正式实验必须为 'harness' | 'provider'） */
  token_accounting_source: TokenAccountingSource;
  /** §8.1：wall_time（毫秒） */
  wall_time_ms: number;
  /** §8.1：success_criteria（任务定义原文） */
  success_criteria: string[];
}

// ---------- Recorder ----------

export class TrajectoryRecorder {
  readonly filePath: string;
  readonly runId: string;
  #seq = 0;

  constructor(runId: string, trajectoriesDir: string) {
    this.runId = runId;
    mkdirSync(trajectoriesDir, { recursive: true });
    this.filePath = path.join(trajectoriesDir, `${runId}.jsonl`);
    if (existsSync(this.filePath)) {
      throw new Error(`trajectory 文件已存在（append-only 语义下拒绝复用 run_id）：${this.filePath}`);
    }
  }

  /** append-only：只追加，不提供任何修改/删除接口 */
  append<E extends TrajectoryEvent>(event: Omit<E, 'seq' | 'ts' | 'run_id'>): E {
    const full = {
      ...(event as object),
      seq: this.#seq++,
      ts: new Date().toISOString(),
      run_id: this.runId,
    } as E;
    appendFileSync(this.filePath, JSON.stringify(full) + '\n', 'utf8');
    return full;
  }
}

/** 离线读取一条 trajectory（独立脚本重放的入口） */
export function readTrajectory(filePath: string): TrajectoryEvent[] {
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l, i) => {
      try {
        return JSON.parse(l) as TrajectoryEvent;
      } catch (e) {
        throw new Error(`trajectory 第 ${i + 1} 行 JSON 解析失败：${(e as Error).message}`);
      }
    });
}
