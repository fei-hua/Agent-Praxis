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
} from './trajectory.ts';
import type { RawSessionEvent } from './session-log.ts';

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

export function extractTokenUsage(events: RawSessionEvent[]): {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
} {
  let input = 0;
  let output = 0;
  let total = 0;
  for (const ev of events) {
    if (ev.type !== 'assistant/message') continue;
    const d = ev.data as {
      usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    };
    if (!d.usage) continue;
    input += d.usage.inputTokens ?? 0;
    output += d.usage.outputTokens ?? 0;
    total += d.usage.totalTokens ?? (d.usage.inputTokens ?? 0) + (d.usage.outputTokens ?? 0);
  }
  return { input_tokens: input, output_tokens: output, total_tokens: total };
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

/** failure 从 tool/result 派生（OQ-019）：失败原因 + 上下文（callId/turn/step）都保留在事件里
 *  (1) tool error（error 字段 / isError 标记）→ kind = errorName || 'tool_error'；
 *  (2) 命令非零退出（文本 [exit code: N]，N≠0）→ kind = 'command_exit_nonzero'。
 */
export function deriveFailures(events: RawSessionEvent[]): FailureRecord[] {
  const out: FailureRecord[] = [];
  for (const r of extractToolResults(events)) {
    const exitMatch = /\[exit code: (-?\d+)\]/.exec(r.result_summary);
    const nonZeroExit = exitMatch !== null && Number(exitMatch[1]) !== 0;
    if (r.isError) {
      out.push({
        failure_id: `fail-${r.call_id}`,
        reason: r.result_summary || `tool ${r.call_id} 返回错误`,
        kind: r.errorName ?? 'tool_error',
        context: {
          tool_call_id: r.call_id,
          step: `turn ${r.turn} / step ${r.step}`,
        },
      });
    } else if (nonZeroExit) {
      out.push({
        failure_id: `fail-${r.call_id}`,
        reason: r.result_summary || `命令 ${r.call_id} 非零退出`,
        kind: 'command_exit_nonzero',
        context: {
          tool_call_id: r.call_id,
          step: `turn ${r.turn} / step ${r.step}`,
        },
      });
    }
  }
  return out;
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
