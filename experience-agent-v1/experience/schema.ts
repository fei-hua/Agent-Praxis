/**
 * experience/schema.ts — Experience Schema（spec/frozen.md §3，冻结）
 *
 * 硬约束（tasks/phase0.md 三条硬约束之 3）：
 *   reliability_score 不在 schema 中由 Reflection 填写——
 *   本类型里根本不存在 reliability_score 字段；它由代码按 §5.4 公式
 *   （experience/reliability.ts）在检索时计算。
 *
 * 字段逐字来自 spec/frozen.md §3 示例与 §3.1 字段说明。
 * lesson ≤ 60 字（§3.1 / §5.7，超长截断）。
 */

import {
  COMPLEXITY,
  CONSTRAINTS_VOCAB,
  DELEGATION_MODE,
  EXPERIENCE_STATUS,
  FIRST_DECISION,
  SCOPE,
  type Complexity,
  type ConstraintToken,
  type DelegationMode,
  type ExperienceStatus,
  type FirstDecision,
  type Scope,
} from '../core/enums.ts';
import { FROZEN } from '../core/frozen-constants.ts';
import {
  SPEC_EXAMPLE_VOCAB,
  isValidCharacteristic,
  isValidTaskType,
  type ControlledVocab,
} from '../core/vocab.ts';

// ---------- 数据结构（spec/frozen.md §3） ----------

export interface ExperienceOutcome {
  success: boolean;
  task_success_criteria_met: boolean;
  forbidden_violation: boolean;
  tokens: number;
  subagent_calls: number;
  wall_time_s: number;
}

export interface ExperienceEvidence {
  run_id: string;
  trajectory_ref: string;
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
  /** §3.1：evidence_complete = run_id + trajectory_ref + outcome 三者齐全（派生值，校验一致性） */
  evidence_complete: boolean;
}

export interface ExperienceDelegation {
  mode: DelegationMode;
  agents: string[];
}

export interface Experience {
  id: string;
  status: ExperienceStatus;
  scope: Scope;
  task_type: string;
  complexity: Complexity;
  characteristics: string[];
  constraints: ConstraintToken[];
  situation: string;
  decision: FirstDecision;
  delegation: ExperienceDelegation;
  outcome: ExperienceOutcome;
  evidence: ExperienceEvidence;
  /** ≤ 60 字（§3.1 / §5.7，超长截断） */
  lesson: string;
  /** 受控词表同 characteristics（§3.1）；命中判定语义见 OQ-004 */
  contraindications: string[];
  conflict_count: number;
  independent_support: number;
}

// ---------- lesson 归一化 ----------

/** §5.7：lesson ≤ 60 字，超长截断（按字符计数） */
export function normalizeLesson(lesson: string): string {
  return lesson.length <= FROZEN.lesson_max_chars
    ? lesson
    : lesson.slice(0, FROZEN.lesson_max_chars);
}

// ---------- 校验（纯确定性代码） ----------

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

export function validateExperience(
  input: unknown,
  vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB,
): ValidationResult<Experience> {
  const issues: ValidationIssue[] = [];
  if (typeof input !== 'object' || input === null) {
    return { ok: false, issues: [{ field: '.', message: 'experience 必须是对象' }] };
  }
  const e = input as Record<string, unknown>;

  if (typeof e['id'] !== 'string' || e['id'].length === 0) {
    issues.push({ field: 'id', message: 'id 必须是非空字符串' });
  }
  if (!oneOf(EXPERIENCE_STATUS, e['status'])) {
    issues.push({ field: 'status', message: `status 必须是 ${EXPERIENCE_STATUS.join(' | ')}` });
  }
  if (!oneOf(SCOPE, e['scope'])) {
    issues.push({ field: 'scope', message: `scope 必须是 ${SCOPE.join(' | ')}` });
  }
  if (typeof e['task_type'] !== 'string' || !isValidTaskType(vocab, e['task_type'])) {
    issues.push({ field: 'task_type', message: `task_type "${String(e['task_type'])}" 不在受控词表内（OQ-002 词表注入）` });
  }
  if (!oneOf(COMPLEXITY, e['complexity'])) {
    issues.push({ field: 'complexity', message: `complexity 必须是 ${COMPLEXITY.join(' | ')}` });
  }
  checkStringArray(e['characteristics'], 'characteristics', (v) => isValidCharacteristic(vocab, v), issues);
  checkStringArray(e['constraints'], 'constraints', (v) => oneOf(CONSTRAINTS_VOCAB, v), issues);

  if (typeof e['situation'] !== 'string') {
    issues.push({ field: 'situation', message: 'situation 必须是字符串' });
  }
  if (!oneOf(FIRST_DECISION, e['decision'])) {
    issues.push({ field: 'decision', message: `decision 必须是 ${FIRST_DECISION.join(' | ')}` });
  }

  // delegation
  const del = e['delegation'];
  if (typeof del !== 'object' || del === null) {
    issues.push({ field: 'delegation', message: 'delegation 必须是对象' });
  } else {
    const d = del as Record<string, unknown>;
    if (!oneOf(DELEGATION_MODE, d['mode'])) {
      issues.push({ field: 'delegation.mode', message: `mode 必须是 ${DELEGATION_MODE.join(' | ')}` });
    }
    checkStringArray(d['agents'], 'delegation.agents', () => true, issues);
  }

  // outcome
  const out = e['outcome'];
  if (typeof out !== 'object' || out === null) {
    issues.push({ field: 'outcome', message: 'outcome 必须是对象' });
  } else {
    const o = out as Record<string, unknown>;
    for (const b of ['success', 'task_success_criteria_met', 'forbidden_violation'] as const) {
      if (typeof o[b] !== 'boolean') issues.push({ field: `outcome.${b}`, message: `${b} 必须是布尔值` });
    }
    for (const n of ['tokens', 'subagent_calls', 'wall_time_s'] as const) {
      const v = o[n];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        issues.push({ field: `outcome.${n}`, message: `${n} 必须是非负数` });
      }
    }
  }

  // evidence
  const ev = e['evidence'];
  if (typeof ev !== 'object' || ev === null) {
    issues.push({ field: 'evidence', message: 'evidence 必须是对象' });
  } else {
    const v = ev as Record<string, unknown>;
    for (const f of ['run_id', 'trajectory_ref', 'harness_version', 'tool_schema_version', 'framework_version'] as const) {
      if (typeof v[f] !== 'string' || v[f] === '') {
        issues.push({ field: `evidence.${f}`, message: `${f} 必须是非空字符串` });
      }
    }
    if (typeof v['evidence_complete'] !== 'boolean') {
      issues.push({ field: 'evidence.evidence_complete', message: 'evidence_complete 必须是布尔值' });
    } else {
      // §3.1：evidence_complete ⇔ run_id + trajectory_ref + outcome 三者齐全
      const derived =
        typeof v['run_id'] === 'string' && v['run_id'] !== '' &&
        typeof v['trajectory_ref'] === 'string' && v['trajectory_ref'] !== '' &&
        typeof out === 'object' && out !== null;
      if (v['evidence_complete'] !== derived) {
        issues.push({
          field: 'evidence.evidence_complete',
          message: `evidence_complete 应为 ${derived}（§3.1：run_id + trajectory_ref + outcome 三者齐全）`,
        });
      }
    }
  }

  // lesson：≤ 60 字（§3.1 / §5.7，超长截断）
  if (typeof e['lesson'] !== 'string') {
    issues.push({ field: 'lesson', message: 'lesson 必须是字符串' });
  }

  // contraindications：受控词表同 characteristics（§3.1）
  checkStringArray(e['contraindications'], 'contraindications', (v) => isValidCharacteristic(vocab, v), issues);

  for (const n of ['conflict_count', 'independent_support'] as const) {
    const v = e[n];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      issues.push({ field: n, message: `${n} 必须是非负整数` });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const value: Experience = {
    id: e['id'] as string,
    status: e['status'] as ExperienceStatus,
    scope: e['scope'] as Scope,
    task_type: e['task_type'] as string,
    complexity: e['complexity'] as Complexity,
    characteristics: (e['characteristics'] as string[]).slice(),
    constraints: (e['constraints'] as ConstraintToken[]).slice(),
    situation: e['situation'] as string,
    decision: e['decision'] as FirstDecision,
    delegation: {
      mode: (del as Record<string, unknown>)['mode'] as DelegationMode,
      agents: ((del as Record<string, unknown>)['agents'] as string[]).slice(),
    },
    outcome: { ...(out as unknown as ExperienceOutcome) },
    evidence: { ...(ev as unknown as ExperienceEvidence) },
    lesson: normalizeLesson(e['lesson'] as string),
    contraindications: (e['contraindications'] as string[]).slice(),
    conflict_count: e['conflict_count'] as number,
    independent_support: e['independent_support'] as number,
  };
  return { ok: true, value };
}

// ---------- util ----------

function oneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (values as readonly string[]).includes(v);
}

function checkStringArray(
  v: unknown,
  field: string,
  itemValid: (s: string) => boolean,
  issues: ValidationIssue[],
): void {
  if (!Array.isArray(v)) {
    issues.push({ field, message: `${field} 必须是数组` });
    return;
  }
  for (const item of v) {
    if (typeof item !== 'string' || !itemValid(item)) {
      issues.push({ field, message: `${field} 值 "${String(item)}" 不合法` });
    }
  }
}
