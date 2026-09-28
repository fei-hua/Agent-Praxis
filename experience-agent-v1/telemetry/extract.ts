/**
 * telemetry/extract.ts — 从 Harness SessionEvent 流确定性提取 run 要素（T1/T2/T8）
 *
 * 全部提取都是纯代码、确定性、无 LLM 参与：
 *   - tool/call ↔ tool/result 按 callId 配对；
 *   - task_state 只从 assistant 消息中的 \`\`\`json 结构化块做严格 schema 提取（OQ-010），
 *     first_decision 只取自 task_state.first_decision（绝不从轨迹推断）；
 *   - failure 从 tool/result 的错误标记派生（失败原因与上下文可重建）；
 *   - replan 从「failure 之后出现的 first_decision=REPLAN 的 task_state 更新」派生
 *     （触发与前后决策可重建）。
 */

import { extractTaskStateFromFirstTurnText, validateTaskStateEnvelope, type TaskStateEnvelope } from '../core/task-state.ts';
import type { FirstDecision } from '../core/enums.ts';
import type {
  FailureRecord,
  ReplanRecord,
  SubagentInvocationRecord,
  SubagentResultRecord,
  ToolCallRecord,
  ToolResultRecord,
  FailureClass,
} from './trajectory.ts';
import type { RawSessionEvent } from './session-log.ts';
import { normalizeUsage, sumUsage, type UsageRecord } from '../core/token-accounting.ts';

// ---------- tool/call、tool/result ----------

export interface ExtractedToolCall extends ToolCallRecord {
  seq: number;
  turn: number;
  step: number;
}

export interface ExtractedToolResult extends ToolResultRecord {
  seq: number;
  turn: number;
  step: number;
  isError: boolean;
  errorName?: string;
}

export function extractToolCalls(events: RawSessionEvent[]): ExtractedToolCall[] {
  const out: ExtractedToolCall[] = [];
  for (const ev of events) {
    if (ev.type !== 'tool/call') continue;
    const d = ev.data as { callId?: unknown; name?: unknown; arguments?: unknown; turn?: unknown; step?: unknown };
    out.push({
      seq: ev.seq,
      turn: Number(d.turn ?? 0),
      step: Number(d.step ?? 0),
      call_id: String(d.callId ?? ''),
      tool_name: String(d.name ?? ''),
      arguments: parseArguments(d.arguments),
    });
  }
  return out;
}

export function extractToolResults(events: RawSessionEvent[]): ExtractedToolResult[] {
  const out: ExtractedToolResult[] = [];
  for (const ev of events) {
    if (ev.type !== 'tool/result') continue;
    const d = ev.data as {
      turn?: unknown;
      step?: unknown;
      error?: { name?: string; code?: unknown } | undefined;
      message?: {
        source?: { kind?: string; callId?: string };
        content?: Array<{ type?: string; toolCallId?: string; content?: unknown; isError?: boolean }>;
      };
    };
    const block = d.message?.content?.[0];
    const callId = block?.toolCallId ?? d.message?.source?.callId ?? '';
    const isError = block?.isError === true || d.error !== undefined;
    out.push({
      seq: ev.seq,
      turn: Number(d.turn ?? 0),
      step: Number(d.step ?? 0),
      call_id: String(callId),
      ok: !isError,
      result_summary: summarizeContent(block?.content),
      isError,
      ...(d.error?.name ? { errorName: d.error.name } : {}),
    });
  }
  return out;
}

// ---------- assistant 文本（只用于结构化 task_state 提取，不用于重建轨迹语义） ----------

export interface AssistantText {
  seq: number;
  turn: number;
  step: number;
  text: string;
}

export function extractAssistantTexts(events: RawSessionEvent[]): AssistantText[] {
  const out: AssistantText[] = [];
  for (const ev of events) {
    if (ev.type !== 'assistant/message') continue;
    const d = ev.data as {
      turn?: unknown;
      step?: unknown;
      message?: { content?: Array<{ type?: string; text?: string }> };
    };
    const text = (d.message?.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n');
    out.push({ seq: ev.seq, turn: Number(d.turn ?? 0), step: Number(d.step ?? 0), text });
  }
  return out;
}

export interface TaskStateCapture {
  seq: number;
  turn: number;
  envelope: TaskStateEnvelope;
  first_decision: FirstDecision;
}

/**
 * task_state 捕获（T3 / T8 / OQ-010）：
 * 每条 assistant 消息中至多一个 \`\`\`json 结构化块，必须整体通过 schema 校验；
 * 第一条 = 初始 Task State；后续的 = §5.9 失败后的 Task State 更新。
 * 提取失败即报错，绝不猜。
 */
export function extractTaskStates(events: RawSessionEvent[]): TaskStateCapture[] {
  const out: TaskStateCapture[] = [];
  for (const t of extractAssistantTexts(events)) {
    const fenced = [...t.text.matchAll(/```json\s*\n([\s\S]*?)```/g)];
    for (const m of fenced) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(m[1]!);
      } catch {
        continue; // 非 task_state 的 json 块（例如示例代码）：跳过，不猜
      }
      const validated = validateTaskStateEnvelope(parsed);
      if (!validated.ok) continue;
      out.push({
        seq: t.seq,
        turn: t.turn,
        envelope: validated.value,
        first_decision: validated.value.task_state.first_decision,
      });
    }
  }
  return out;
}

// ---------- 元数据 ----------

export function extractModelId(events: RawSessionEvent[]): string | undefined {
  for (const ev of events) {
    if (ev.type !== 'assistant/message') continue;
    const d = ev.data as { message?: { source?: { kind?: string; model?: string } } };
    const model = d.message?.source?.model;
    if (typeof model === 'string') return model;
  }
  return undefined;
}

/**
 * OQ-018 裁决（2026-09-27）：以 Harness / Provider 返回的 usage 为权威来源。
 * 逐条 assistant/message 的 usage 归一（total 缺失时 total = input + output + cache_read；
 * reasoning 单独提供时只记录、不重复计入），再按同一口径求和。
 */
export function extractTokenUsage(events: RawSessionEvent[]): UsageRecord {
  const records: UsageRecord[] = [];
  for (const ev of events) {
    if (ev.type !== 'assistant/message') continue;
    const d = ev.data as {
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        cacheReadTokens?: number;
        reasoningTokens?: number;
      };
    };
    if (!d.usage) continue;
    records.push(normalizeUsage(d.usage));
  }
  return sumUsage(records);
}

// ---------- Subagent 委派（DELEGATE / PARALLEL / WORKFLOW 的记录） ----------

/** DSH 委派工具名（调研：默认 'subagent'，可配 toolName；这里覆盖本部署已知工具名） */
export const DELEGATION_TOOL_NAMES = ['subagent', 'subagent_fork'] as const;

export interface ExtractedSubagentInvocation extends SubagentInvocationRecord {
  seq: number;
  child_session_id?: string;
  mode?: string;
  tool_name?: string;
}

export interface ExtractedSubagentResult extends SubagentResultRecord {
  seq: number;
}

/**
 * 提取 Subagent 调用与返回：
 *  (a) 委派工具的 tool/call（调用）与 tool/result（返回），按 callId 配对；
 *  (b) subagent/catalog（childId/label/mode）按出现顺序与委派调用对齐；
 *  (c) tool-workflow/agent-start / agent-end（WORKFLOW/PARALLEL 的成员）。
 */
export function extractSubagentInvocations(events: RawSessionEvent[]): {
  invocations: ExtractedSubagentInvocation[];
  results: ExtractedSubagentResult[];
} {
  const toolCalls = extractToolCalls(events);
  const toolResults = extractToolResults(events);
  const delegateCalls = toolCalls.filter((c) =>
    (DELEGATION_TOOL_NAMES as readonly string[]).includes(c.tool_name),
  );
  const catalogs = events.filter((e) => e.type === 'subagent/catalog');

  const invocations: ExtractedSubagentInvocation[] = [];
  const results: ExtractedSubagentResult[] = [];

  delegateCalls.forEach((call, i) => {
    const catalog = catalogs[i];
    const catalogData = catalog?.data as { childId?: string; label?: string; mode?: string } | undefined;
    invocations.push({
      seq: call.seq,
      invocation_id: catalogData?.childId ?? call.call_id,
      agent_name: catalogData?.label ?? String((call.arguments as Record<string, unknown> | undefined)?.['description'] ?? 'unnamed-subagent'),
      task_brief: summarizeContent(call.arguments),
      ...(catalogData?.childId ? { child_session_id: catalogData.childId } : {}),
      ...(catalogData?.mode ? { mode: catalogData.mode } : {}),
      tool_name: call.tool_name,
    });
    const result = toolResults.find((r) => r.call_id === call.call_id);
    if (result) {
      results.push({
        seq: result.seq,
        invocation_id: catalogData?.childId ?? call.call_id,
        ok: result.ok,
        result_summary: result.result_summary,
      });
    }
  });

  // workflow 成员（WORKFLOW / PARALLEL）
  for (const ev of events) {
    if (ev.type === 'tool-workflow/agent-start') {
      const d = ev.data as { childId?: string; label?: string; seq?: unknown };
      invocations.push({
        seq: ev.seq,
        invocation_id: String(d.childId ?? `wf-${ev.seq}`),
        agent_name: String(d.label ?? 'workflow-agent'),
        task_brief: `workflow 成员（agent-start seq=${String(d.seq ?? '?')}）`,
        ...(d.childId ? { child_session_id: d.childId } : {}),
        tool_name: 'workflow',
      });
    }
    if (ev.type === 'tool-workflow/agent-end') {
      const d = ev.data as { childId?: string; outcome?: unknown };
      results.push({
        seq: ev.seq,
        invocation_id: String(d.childId ?? `wf-${ev.seq}`),
        ok: true,
        result_summary: summarizeContent(d.outcome),
      });
    }
  }

  return { invocations, results };
}

// ---------- failure / replan 派生（可重建） ----------

/**
 * failure 从 tool/result 与 turn/end 派生（OQ-019 裁决，2026-09-27）：
 *
 * failure = 一次执行步骤未达到预期执行结果，且需要进入错误处理流程。四类：
 *   (1) tool_execution   —— tool 返回 error / tool timeout / tool schema validation failure
 *   (2) command_execution—— exit code ≠ 0
 *   (3) agent_action     —— action 与 schema 不匹配 / 必需输出缺失 / 明确违反 task constraint
 *   (4) infrastructure   —— provider/harness 异常导致任务无法继续
 *
 * 不包含：正常业务结果不符合预期但 agent 仍可继续处理、用户需求澄清、普通 replanning、
 * deliberate verification failure（后者无法从事件本身识别，须由判定方显式排除，见 OQ-022）。
 *
 * context 保留可重建依据（tool_call_id / subagent_invocation_id / event_seq / turn-step）。
 */
export function deriveFailures(
  events: RawSessionEvent[],
  opts: { deliberateVerificationCallIds?: readonly string[] } = {},
): FailureRecord[] {
  const deliberate = new Set(opts.deliberateVerificationCallIds ?? []);
  const out: FailureRecord[] = [];

  for (const r of extractToolResults(events)) {
    if (deliberate.has(r.call_id)) continue; // OQ-019：deliberate verification failure 不计入
    const exitMatch = /\[exit code: (-?\d+)\]/.exec(r.result_summary);
    const nonZeroExit = exitMatch !== null && Number(exitMatch[1]) !== 0;

    if (r.isError) {
      const cls = classifyToolError(r.errorName, r.result_summary);
      out.push({
        failure_id: `fail-${r.call_id}`,
        class: cls.class,
        reason: r.result_summary || `tool ${r.call_id} 返回错误`,
        kind: cls.kind,
        context: {
          tool_call_id: r.call_id,
          step: `turn ${r.turn} / step ${r.step}`,
        },
      });
    } else if (nonZeroExit) {
      out.push({
        failure_id: `fail-${r.call_id}`,
        class: 'command_execution',
        reason: r.result_summary || `命令 ${r.call_id} 非零退出`,
        kind: 'command_exit_nonzero',
        context: {
          tool_call_id: r.call_id,
          step: `turn ${r.turn} / step ${r.step}`,
        },
      });
    }
  }

  // run 级失败：turn 以 error 结束（provider/harness 异常，例如 429 RATE_LIMIT）
  for (const ev of events) {
    if (ev.type !== 'turn/end') continue;
    const reason = (ev.data as {
      reason?: { kind?: string; error?: { message?: string; code?: string } };
    }).reason;
    if (reason?.kind !== 'error') continue;
    out.push({
      failure_id: `fail-turn-${ev.seq}`,
      class: 'infrastructure',
      reason: reason.error?.message ?? 'turn 以 error 结束（provider/harness 异常）',
      kind: reason.error?.code ?? 'turn_error',
      context: { event_seq: ev.seq, step: `event seq ${ev.seq}` },
    });
  }

  return out;
}

/**
 * tool 错误的分类（OQ-019）：
 *   - infrastructure：provider/harness 级异常（限流、连接重置、超载、不可用），这类异常会使任务无法继续；
 *   - tool_execution：其余 tool 返回错误（含 timeout、schema/参数错误、文件/搜索错误等）。
 * 注意：HTTP 状态码必须带词边界（`\b`），否则 UUID/哈希里的数字串（如 …2534…）会被误判为 5xx。
 * 未枚举到的情形一律按 (1) tool execution failure 处理（tool 返回 error），不擅自升级为 infrastructure。
 */
function classifyToolError(errorName: string | undefined, reason: string): { class: FailureClass; kind: string } {
  const name = errorName ?? 'tool_error';
  const infra =
    /rate.?limit|\b429\b|\bquota\b|provider|ECONNRESET|connection was reset|connection reset|overloaded|service unavailable|\b50[0-9]\b|\b51[0-9]\b|\b52[0-9]\b/i;
  const timeout = /timeout|ETIMEDOUT|timed out/i;
  if (infra.test(name) || infra.test(reason)) return { class: 'infrastructure', kind: name };
  if (timeout.test(name) || timeout.test(reason)) return { class: 'tool_execution', kind: 'timeout' };
  return { class: 'tool_execution', kind: name };
}

/**
 * failure_count（OQ-019 裁决）：按 trajectory event 级别统计；**同一根因导致多个重复日志只计一次**。
 * 根因键 = 分类 + kind + 归一化原因首行（去掉 callId/turn/step 等一次性信息）。
 */
export function countFailures(failures: FailureRecord[]): number {
  const seen = new Set<string>();
  for (const f of failures) {
    const firstLine = f.reason.split('\n')[0] ?? '';
    const normalized = firstLine
      .replace(/call_[0-9A-Za-z_]+/g, '<call>')
      .replace(/\d+/g, '<n>')
      .trim()
      .toLowerCase();
    seen.add(`${f.class}|${f.kind}|${normalized}`);
  }
  return seen.size;
}

/**
 * replan 从「failure 之后出现的 Task State 更新（first_decision = REPLAN）」派生：
 *   trigger = 最近的 failure_id；decision_before = 上一个 first_decision；
 *   decision_after = REPLAN。全部来自显式结构化输出与真实错误事件，可重建。
 */
export function deriveReplans(
  taskStates: TaskStateCapture[],
  failures: FailureRecord[],
): ReplanRecord[] {
  const out: ReplanRecord[] = [];
  for (let i = 1; i < taskStates.length; i++) {
    const curr = taskStates[i]!;
    if (curr.first_decision !== 'REPLAN') continue;
    const priorFailures = failures.filter((f) => {
      // failure 的来源 callId 对应事件 seq < 当前 task_state seq
      return out.length >= 0 && f.context.tool_call_id !== undefined;
    });
    const trigger = priorFailures[priorFailures.length - 1];
    if (!trigger) continue;
    out.push({
      replan_id: `replan-${curr.seq}`,
      trigger_failure_id: trigger.failure_id,
      decision_before: taskStates[i - 1]!.first_decision,
      decision_after: curr.first_decision,
      note: `失败后更新 Task State（seq=${curr.seq}）并 Replan（spec/frozen.md §5.9）`,
    });
  }
  return out;
}

// ---------- util ----------

function parseArguments(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function summarizeContent(content: unknown): string {
  if (content === undefined || content === null) return '';
  if (typeof content === 'string') return content.length > 400 ? content.slice(0, 400) + '…' : content;
  if (Array.isArray(content)) {
    return summarizeContent(
      content
        .map((b) => (typeof b === 'object' && b !== null && 'text' in b ? (b as { text: unknown }).text : b))
        .join('\n'),
    );
  }
  const s = JSON.stringify(content);
  return s.length > 400 ? s.slice(0, 400) + '…' : s;
}
