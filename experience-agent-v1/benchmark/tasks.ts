/**
 * benchmark/tasks.ts — 任务定义与加载（spec/frozen.md §9、experiment-design.md §10）
 *
 * 规格 §9 的任务 YAML 形态（Pilot / Formal 使用）：
 *   id / category(A|B|C|D|E) / task_type / complexity / characteristics / constraints / scope
 *   / expected_first_decisions / expected_delegation（由前者推出，声明值必须一致）
 *   / success_criteria{required[], forbidden[]} / expected_files[] / allowed_paths[] / protected_paths[]
 *   + 本项目补充字段：prompt（执行用任务书）、verification（把 required/forbidden 标签映射为
 *     纯代码检查，供 §9.2 判定；缺失时判定方必须拒绝，不得凭标签猜）
 *
 * 兼容：Phase 0 的 dry-run 任务使用旧形态（source + prompt + success_criteria 为字符串数组）。
 * 该校验是**纯代码**的：任何非法取值（词表/枚举/类别/路径）都拒绝加载，不猜测、不放行。
 *
 * 注（OQ-007）：dry-run 任务由开发 AI 编写（人工授权，仅 Phase 0）；Pilot 任务集的
 * ground truth（expected_first_decisions）必须人工签署后冻结（见 OQ-023）。
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { COMPLEXITY, CONSTRAINTS_VOCAB, FIRST_DECISION, SCOPE, type FirstDecision } from '../core/enums.ts';
import { SPEC_EXAMPLE_VOCAB, type ControlledVocab } from '../core/vocab.ts';
import { expectedDelegation } from './cda.ts';

/** §9.1 任务类别 */
export const TASK_CATEGORIES = ['A', 'B', 'C', 'D', 'E'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** 类别 → 允许的 expected_first_decisions（§9.1 冻结分布） */
export const CATEGORY_EXPECTED_DECISIONS: Readonly<Record<TaskCategory, readonly FirstDecision[]>> = {
  A: ['DIRECT'],
  B: ['EXPLORE'],
  C: ['DELEGATE', 'PARALLEL', 'WORKFLOW'],
  D: ['PARALLEL', 'WORKFLOW'],
  E: ['REPLAN'],
};

/** 纯代码检查种类（把 success_criteria 标签落实为可执行判定） */
export type VerificationKind =
  | 'command_exit_zero'
  | 'output_contains'
  | 'file_exists'
  | 'file_unchanged'
  | 'files_unchanged';

export interface TaskVerificationCheck {
  /** 对应 success_criteria.required / forbidden 中的标签 */
  id: string;
  kind: VerificationKind;
  command?: string;
  expect?: string;
  path?: string;
  paths?: string[];
}

export interface BenchmarkTask {
  id: string;
  /** §9.1 类别（Pilot / Formal 任务必填；dry-run 旧形态可缺省） */
  category?: TaskCategory;
  /**
   * 签署状态（OQ-023）：
   *   'draft'  = 由开发方起草，ground truth 未签署，**不得用于正式 run**；
   *   'frozen' = 人工签署后冻结，可用于 Pilot/Formal（并要求 verification 齐备）。
   */
  status: 'draft' | 'frozen';
  source: string;
  task_type: string;
  complexity: string;
  scope: string;
  characteristics: string[];
  constraints: string[];
  prompt: string;
  expected_first_decisions: FirstDecision[];
  /** 由 expected_first_decisions 按 §3.1 委派轴推出（声明值必须与之一致） */
  expected_delegation: boolean;
  /** 扁平化的全部标签（required + forbidden），供轨迹记录 */
  success_criteria: string[];
  success_criteria_required: string[];
  success_criteria_forbidden: string[];
  expected_files: string[];
  allowed_paths: string[];
  protected_paths: string[];
  verification: TaskVerificationCheck[];
  /** dry-run 任务特有：本任务预期覆盖的轨迹属性，仅用于自检 */
  dryrun_coverage?: string[];
}

export interface TaskLoadIssue {
  task: string;
  field: string;
  message: string;
}

function toStringArray(v: unknown): string[] | null {
  return Array.isArray(v) ? (v as unknown[]).map(String) : null;
}

export function loadTask(
  input: unknown,
  vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB,
): { ok: true; task: BenchmarkTask } | { ok: false; issues: TaskLoadIssue[] } {
  const issues: TaskLoadIssue[] = [];
  const o = (input ?? {}) as Record<string, unknown>;
  const id = typeof o['id'] === 'string' ? o['id'] : '';
  const push = (field: string, message: string) => issues.push({ task: id || '<无 id>', field, message });

  if (!id) push('id', '必须为非空字符串');

  // category（§9.1）
  const category = typeof o['category'] === 'string' ? (o['category'] as string) : undefined;
  if (category !== undefined && !(TASK_CATEGORIES as readonly string[]).includes(category)) {
    push('category', `必须 ∈ [${TASK_CATEGORIES.join(', ')}]（§9.1）`);
  }

  // status（OQ-023 签署门）：draft 可加载但不得用于正式 run；frozen 必须有 verification
  const status = typeof o['status'] === 'string' ? (o['status'] as string) : 'draft';
  if (!['draft', 'frozen'].includes(status)) {
    push('status', "必须为 'draft' 或 'frozen'（缺省 draft）");
  }

  // source：规格 §9 未列出，本项目补为来源标注（缺省 synthetic）
  const source = typeof o['source'] === 'string' && o['source'] !== '' ? o['source'] : 'synthetic';
  if (o['source'] !== undefined && (typeof o['source'] !== 'string' || o['source'] === '')) {
    push('source', '若提供必须为非空字符串');
  }

  if (typeof o['task_type'] !== 'string' || !(vocab.task_type as readonly string[]).includes(o['task_type'] as string)) {
    push('task_type', `必须 ∈ task_type 受控词表 [${vocab.task_type.join(', ')}]（OQ-002 过渡期）`);
  }
  if (typeof o['complexity'] !== 'string' || !(COMPLEXITY as readonly string[]).includes(o['complexity'] as string)) {
    push('complexity', `必须 ∈ [${COMPLEXITY.join(', ')}]`);
  }
  if (typeof o['scope'] !== 'string' || !(SCOPE as readonly string[]).includes(o['scope'] as string)) {
    push('scope', `必须 ∈ [${SCOPE.join(', ')}]`);
  }
  const characteristics = toStringArray(o['characteristics']);
  if (!characteristics || characteristics.some((c) => !(vocab.characteristics as readonly string[]).includes(c))) {
    push('characteristics', `每一项必须 ∈ characteristics 受控词表 [${vocab.characteristics.join(', ')}]（OQ-002 过渡期）`);
  }
  const constraints = toStringArray(o['constraints']);
  if (!constraints || constraints.some((c) => !(CONSTRAINTS_VOCAB as readonly string[]).includes(c))) {
    push('constraints', `每一项必须 ∈ constraints 词表 [${CONSTRAINTS_VOCAB.join(', ')}]`);
  }
  if (typeof o['prompt'] !== 'string' || o['prompt'].trim() === '') push('prompt', '必须为非空字符串（执行用任务书）');

  // expected_first_decisions + expected_delegation
  const expected = toStringArray(o['expected_first_decisions']);
  const expectedOk =
    expected !== null &&
    expected.length > 0 &&
    expected.every((d) => (FIRST_DECISION as readonly string[]).includes(d));
  if (!expectedOk) {
    push('expected_first_decisions', `非空数组且每项必须 ∈ FIRST_DECISION [${FIRST_DECISION.join(', ')}]`);
  }
  let derivedDelegation: boolean | null = null;
  if (expectedOk) {
    derivedDelegation = expectedDelegation(expected as FirstDecision[]);
    if (category !== undefined && (TASK_CATEGORIES as readonly string[]).includes(category)) {
      const allowed = CATEGORY_EXPECTED_DECISIONS[category as TaskCategory];
      if (!(expected as FirstDecision[]).every((d) => allowed.includes(d))) {
        push('expected_first_decisions', `类别 ${category} 的期望值必须 ∈ [${allowed.join(', ')}]（§9.1）`);
      }
    }
    if (o['expected_delegation'] !== undefined) {
      if (typeof o['expected_delegation'] !== 'boolean') {
        push('expected_delegation', '若提供必须为布尔值');
      } else if (o['expected_delegation'] !== derivedDelegation) {
        push(
          'expected_delegation',
          `声明值 ${String(o['expected_delegation'])} 与 expected_first_decisions 推出的 ${String(derivedDelegation)} 不一致（§9：由前者推出）`,
        );
      }
    }
  }

  // success_criteria：规格 §9 形态 {required[], forbidden[]} 或旧形态 string[]
  let required: string[] | null = null;
  let forbidden: string[] = [];
  const rawCriteria = o['success_criteria'];
  if (Array.isArray(rawCriteria)) {
    required = toStringArray(rawCriteria);
  } else if (rawCriteria !== null && typeof rawCriteria === 'object') {
    const c = rawCriteria as Record<string, unknown>;
    required = toStringArray(c['required']);
    const f = c['forbidden'];
    if (f !== undefined) {
      forbidden = toStringArray(f) ?? [];
      if (!Array.isArray(f)) push('success_criteria.forbidden', '必须为字符串数组');
    }
  }
  if (!required || required.length === 0 || required.some((c) => c.trim() === '')) {
    push('success_criteria.required', '必须为非空字符串数组（§9.2：成功 ⇔ 所有 required=PASS 且所有 forbidden=FALSE）');
  }
  if (forbidden.some((c) => c.trim() === '')) push('success_criteria.forbidden', '每一项必须为非空字符串');

  // 路径字段（§9）
  const expectedFiles = toStringArray(o['expected_files']) ?? [];
  const allowedPaths = toStringArray(o['allowed_paths']) ?? [];
  const protectedPaths = toStringArray(o['protected_paths']) ?? [];
  for (const [field, v] of [
    ['expected_files', o['expected_files']],
    ['allowed_paths', o['allowed_paths']],
    ['protected_paths', o['protected_paths']],
  ] as const) {
    if (v !== undefined && !Array.isArray(v)) push(field, '必须为字符串数组');
  }

  // verification：标签 → 纯代码检查（Pilot/Formal 必需；dry-run 旧形态可缺省）
  const verification: TaskVerificationCheck[] = [];
  const rawVerification = o['verification'];
  if (rawVerification !== undefined) {
    if (!Array.isArray(rawVerification)) {
      push('verification', '必须为数组');
    } else {
      const kinds: readonly string[] = [
        'command_exit_zero',
        'output_contains',
        'file_exists',
        'file_unchanged',
        'files_unchanged',
      ];
      for (const [i, raw] of rawVerification.entries()) {
        const c = (raw ?? {}) as Record<string, unknown>;
        const cid = typeof c['id'] === 'string' ? c['id'] : '';
        const kind = typeof c['kind'] === 'string' ? c['kind'] : '';
        if (!cid) push(`verification[${i}].id`, '必须为非空字符串（对应 success_criteria 标签）');
        if (!kinds.includes(kind)) push(`verification[${i}].kind`, `必须 ∈ [${kinds.join(', ')}]`);
        if (kind === 'command_exit_zero' || kind === 'output_contains') {
          if (typeof c['command'] !== 'string' || c['command'].trim() === '') {
            push(`verification[${i}].command`, `${kind} 必须提供 command`);
          }
        }
        if (kind === 'output_contains' && (typeof c['expect'] !== 'string' || c['expect'] === '')) {
          push(`verification[${i}].expect`, 'output_contains 必须提供 expect');
        }
        if ((kind === 'file_exists' || kind === 'file_unchanged') && (typeof c['path'] !== 'string' || c['path'] === '')) {
          push(`verification[${i}].path`, `${kind} 必须提供 path`);
        }
        if (kind === 'files_unchanged' && (toStringArray(c['paths']) ?? []).length === 0) {
          push(`verification[${i}].paths`, 'files_unchanged 必须提供非空 paths');
        }
        verification.push({
          id: cid,
          kind: kind as VerificationKind,
          ...(typeof c['command'] === 'string' ? { command: c['command'] } : {}),
          ...(typeof c['expect'] === 'string' ? { expect: c['expect'] } : {}),
          ...(typeof c['path'] === 'string' ? { path: c['path'] } : {}),
          ...(toStringArray(c['paths']) ? { paths: toStringArray(c['paths'])! } : {}),
        });
      }
      // 标签覆盖：required 必须都有对应检查，否则判定方无法给出 PASS/FAIL
      if (required) {
        for (const label of required) {
          if (!verification.some((v) => v.id === label)) {
            push('verification', `required 标签「${label}」没有对应的纯代码检查（§9.2 不允许凭标签猜测）`);
          }
        }
      }
      for (const v of verification) {
        if (!required?.includes(v.id) && !forbidden.includes(v.id)) {
          push('verification', `检查「${v.id}」不对应任何 success_criteria 标签`);
        }
      }
    }
  } else if (status === 'frozen' && category !== undefined) {
    push('verification', 'frozen 的 Pilot/Formal 任务必须提供 verification（把 required/forbidden 映射为纯代码检查）');
  } else if (category !== undefined) {
    // draft：ground truth 尚未签署，允许暂缺 verification（不得用于正式 run）
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    task: {
      id,
      ...(category !== undefined ? { category: category as TaskCategory } : {}),
      status: status as 'draft' | 'frozen',
      source,
      task_type: o['task_type'] as string,
      complexity: o['complexity'] as string,
      scope: o['scope'] as string,
      characteristics: characteristics!,
      constraints: constraints!,
      prompt: o['prompt'] as string,
      expected_first_decisions: expected as FirstDecision[],
      expected_delegation: derivedDelegation!,
      success_criteria: [...required!, ...forbidden],
      success_criteria_required: required!,
      success_criteria_forbidden: forbidden,
      expected_files: expectedFiles,
      allowed_paths: allowedPaths,
      protected_paths: protectedPaths,
      verification,
      dryrun_coverage: toStringArray(o['dryrun_coverage']) ?? undefined,
    },
  };
}

/** 加载一个目录下全部 *.yaml / *.yml 任务 */
export function loadTasksFromDir(
  dir: string,
  vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB,
): { tasks: BenchmarkTask[]; issues: TaskLoadIssue[] } {
  const tasks: BenchmarkTask[] = [];
  const issues: TaskLoadIssue[] = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();
  for (const f of files) {
    const doc = parseYaml(readFileSync(path.join(dir, f), 'utf8'));
    const result = loadTask(doc, vocab);
    if (result.ok) {
      tasks.push(result.task);
    } else {
      issues.push(...result.issues);
    }
  }
  return { tasks, issues };
}
