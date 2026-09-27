/**
 * core/task-state.ts — Task State Schema（spec/frozen.md §2，冻结）
 *
 * 主 Agent 首轮正常推理中顺带输出结构化 Task State（不是额外 LLM 调用）。
 *
 * 硬约束（tasks/phase0.md 三条硬约束之 3 / spec/frozen.md §2.2）：
 *   first_decision 是必填 enum，代码直接读取 task_state.first_decision。
 *   绝对禁止：任务执行完后让另一个 LLM 看轨迹猜「第一次到底想干什么」。
 *   （否则 E2A 变成 judge-dependent，两个 judge 会给出不同结果。）
 *
 * 本模块只做确定性解析与校验；first_decision 的唯一来源是 task_state 对象本身，
 * 读取路径 readFirstDecision() 不接受、也不产生任何推断。
 */

import {
  COMPLEXITY,
  CONSTRAINTS_VOCAB,
  FIRST_DECISION,
  SCOPE,
  type Complexity,
  type ConstraintToken,
  type FirstDecision,
  type Scope,
} from './enums.ts';
import { FROZEN } from './frozen-constants.ts';
import {
  SPEC_EXAMPLE_VOCAB,
  isValidCharacteristic,
  isValidTaskType,
  type ControlledVocab,
} from './vocab.ts';

// ---------- 数据结构（spec/frozen.md §2） ----------

export interface TaskState {
  task_type: string;
  complexity: Complexity;
  characteristics: string[];
  scope: Scope;
  constraints: ConstraintToken[];
  first_decision: FirstDecision;
}

export interface TaskStateEnvelope {
  schema_version: string;
  task_state: TaskState;
}

// ---------- 校验（纯确定性代码） ----------

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

/**
 * 校验 Task State 信封（spec/frozen.md §2.1）。
 *
 * @param vocab task_type / characteristics 受控词表（OQ-002：可注入，不得固化示例词表）
 */
export function validateTaskStateEnvelope(
  input: unknown,
  vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB,
): ValidationResult<TaskStateEnvelope> {
  const issues: ValidationIssue[] = [];

  if (typeof input !== 'object' || input === null) {
    return { ok: false, issues: [{ field: '.', message: 'task state envelope 必须是对象' }] };
  }
  const env = input as Record<string, unknown>;

  if (env['schema_version'] !== FROZEN.task_state_schema_version) {
    issues.push({
      field: 'schema_version',
      message: `必须为 "${FROZEN.task_state_schema_version}"（spec/frozen.md §2）`,
    });
  }

  const ts = env['task_state'];
  if (typeof ts !== 'object' || ts === null) {
    issues.push({ field: 'task_state', message: 'task_state 必须是对象' });
    return { ok: false, issues };
  }
  const s = ts as Record<string, unknown>;

  // task_type：受控词表（OQ-002 过渡期注入词表）
  if (typeof s['task_type'] !== 'string') {
    issues.push({ field: 'task_state.task_type', message: 'task_type 必须是字符串' });
  } else if (!isValidTaskType(vocab, s['task_type'])) {
    issues.push({ field: 'task_state.task_type', message: `task_type "${s['task_type']}" 不在受控词表内` });
  }

  // complexity：enum simple | medium | high（§2.1）
  if (!isOneOf(COMPLEXITY, s['complexity'])) {
    issues.push({ field: 'task_state.complexity', message: `complexity 必须是 ${COMPLEXITY.join(' | ')}` });
  }

  // characteristics：受控词表数组（OQ-002 过渡期注入词表）
  const chars = s['characteristics'];
  if (!Array.isArray(chars)) {
    issues.push({ field: 'task_state.characteristics', message: 'characteristics 必须是数组' });
  } else {
    for (const c of chars) {
      if (typeof c !== 'string' || !isValidCharacteristic(vocab, c)) {
        issues.push({ field: 'task_state.characteristics', message: `characteristics 值 "${String(c)}" 不在受控词表内` });
      }
    }
  }

  // scope：enum project | generic（§2.1）
  if (!isOneOf(SCOPE, s['scope'])) {
    issues.push({ field: 'task_state.scope', message: `scope 必须是 ${SCOPE.join(' | ')}` });
  }

  // constraints：只能从 §2.3 enum 选，空数组合法
  const cons = s['constraints'];
  if (!Array.isArray(cons)) {
    issues.push({ field: 'task_state.constraints', message: 'constraints 必须是数组（可为空）' });
  } else {
    for (const c of cons) {
      if (!isOneOf(CONSTRAINTS_VOCAB, c)) {
        issues.push({ field: 'task_state.constraints', message: `constraints 值 "${String(c)}" 不在 §2.3 受控词表内` });
      }
    }
  }

  // first_decision：必填 enum（§2.2，唯一一套，禁止扩充）
  if (!isOneOf(FIRST_DECISION, s['first_decision'])) {
    issues.push({ field: 'task_state.first_decision', message: `first_decision 必须是 ${FIRST_DECISION.join(' | ')}` });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const value: TaskStateEnvelope = {
    schema_version: env['schema_version'] as string,
    task_state: {
      task_type: s['task_type'] as string,
      complexity: s['complexity'] as Complexity,
      characteristics: (chars as string[]).slice(),
      scope: s['scope'] as Scope,
      constraints: (cons as ConstraintToken[]).slice(),
      first_decision: s['first_decision'] as FirstDecision,
    },
  };
  return { ok: true, value };
}

// ---------- first_decision 的代码直读通道（T3 / T8） ----------

/**
 * 读取 first_decision。
 *
 * 唯一合法来源：已通过校验的 task_state.first_decision 字段（代码直接读取）。
 * 本函数不做任何形式的推断、补全或语义还原；
 * 事后让 LLM 从轨迹猜 first_decision 是绝对禁止的（spec/frozen.md §2.2）。
 */
export function readFirstDecision(envelope: TaskStateEnvelope): FirstDecision {
  return envelope.task_state.first_decision;
}

/**
 * 从原始事件负载中确定性地提取 Task State（T3 / OQ-010）。
 *
 * 提取规则（纯代码，无 LLM 参与）：
 *   1. 只接受消息事件文本中的单个 ```json / ``` fenced JSON 代码块；
 *   2. 必须整体通过 validateTaskStateEnvelope（含 schema_version 与 enum 校验）；
 *   3. 只扫描首轮（first turn）事件，后续消息一律不解析；
 *   4. 不做任何自然语言理解；提取失败即报错，绝不猜。
 *
 * OQ-010（open）：人工尚未确认「从首轮消息事件做结构化提取」是否触碰
 * T1「不解析最终聊天文本」的边界。若裁决为不允许，本函数将替换为人工指定的通道。
 */
export function extractTaskStateFromFirstTurnText(
  text: string,
  vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB,
): ValidationResult<TaskStateEnvelope> {
  const fenced = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (fenced.length !== 1) {
    return {
      ok: false,
      issues: [{ field: '.', message: `首轮消息中必须恰好有一个 \`\`\`json 代码块（找到 ${fenced.length} 个），不做猜测` }],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced[0]![1]!);
  } catch (e) {
    return { ok: false, issues: [{ field: '.', message: `JSON 解析失败：${(e as Error).message}` }] };
  }
  return validateTaskStateEnvelope(parsed, vocab);
}

// ---------- util ----------

function isOneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (values as readonly string[]).includes(v);
}
