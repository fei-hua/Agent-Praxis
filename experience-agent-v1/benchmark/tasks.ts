/**
 * benchmark/tasks.ts — 任务定义与加载（spec/frozen.md §9、experiment-design.md §10）
 *
 * 任务 YAML 必填字段（§9）：
 *   id / source / task_type / complexity / scope / characteristics / constraints
 *   / prompt / expected_first_decisions / success_criteria
 * 全部做受控词表校验；校验失败即拒绝加载（不猜测、不放行）。
 *
 * 注（OQ-007）：Phase 0 的 dry-run 任务由开发 AI 自行编写（synthetic，人工授权），
 * 与 Pilot 任务集不相交，永不进入 Pilot。
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { COMPLEXITY, CONSTRAINTS_VOCAB, FIRST_DECISION, SCOPE, type FirstDecision } from '../core/enums.ts';
import { SPEC_EXAMPLE_VOCAB, type ControlledVocab } from '../core/vocab.ts';

export interface BenchmarkTask {
  id: string;
  source: string;
  task_type: string;
  complexity: string;
  scope: string;
  characteristics: string[];
  constraints: string[];
  prompt: string;
  expected_first_decisions: FirstDecision[];
  success_criteria: string[];
  /** dry-run 任务特有：本任务预期覆盖的轨迹属性（≥1 failure、≥1 replan 等），仅用于自检 */
  dryrun_coverage?: string[];
}

export interface TaskLoadIssue {
  task: string;
  field: string;
  message: string;
}

export function loadTask(input: unknown, vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB): { ok: true; task: BenchmarkTask } | { ok: false; issues: TaskLoadIssue[] } {
  const issues: TaskLoadIssue[] = [];
  const o = (input ?? {}) as Record<string, unknown>;
  const id = typeof o['id'] === 'string' ? o['id'] : '';
  const push = (field: string, message: string) => issues.push({ task: id || '<无 id>', field, message });

  if (!id) push('id', '必须为非空字符串');
  if (typeof o['source'] !== 'string' || o['source'] === '') push('source', '必须为非空字符串（如 synthetic / company-repo / internal-tools）');
  if (typeof o['task_type'] !== 'string' || !(vocab.task_type as readonly string[]).includes(o['task_type'] as string)) {
    push('task_type', `必须 ∈ task_type 受控词表 [${vocab.task_type.join(', ')}]（OQ-002 过渡期）`);
  }
  if (typeof o['complexity'] !== 'string' || !(COMPLEXITY as readonly string[]).includes(o['complexity'] as string)) {
    push('complexity', `必须 ∈ [${COMPLEXITY.join(', ')}]`);
  }
  if (typeof o['scope'] !== 'string' || !(SCOPE as readonly string[]).includes(o['scope'] as string)) {
    push('scope', `必须 ∈ [${SCOPE.join(', ')}]`);
  }
  const characteristics = Array.isArray(o['characteristics']) ? (o['characteristics'] as unknown[]).map(String) : null;
  if (!characteristics || characteristics.some((c) => !(vocab.characteristics as readonly string[]).includes(c))) {
    push('characteristics', `每一项必须 ∈ characteristics 受控词表 [${vocab.characteristics.join(', ')}]（OQ-002 过渡期）`);
  }
  const constraints = Array.isArray(o['constraints']) ? (o['constraints'] as unknown[]).map(String) : null;
  if (!constraints || constraints.some((c) => !(CONSTRAINTS_VOCAB as readonly string[]).includes(c))) {
    push('constraints', `每一项必须 ∈ constraints 词表 [${CONSTRAINTS_VOCAB.join(', ')}]`);
  }
  if (typeof o['prompt'] !== 'string' || o['prompt'].trim() === '') push('prompt', '必须为非空字符串');
  const expected = Array.isArray(o['expected_first_decisions']) ? (o['expected_first_decisions'] as unknown[]).map(String) : null;
  if (!expected || expected.length === 0 || expected.some((d) => !(FIRST_DECISION as readonly string[]).includes(d))) {
    push('expected_first_decisions', `非空数组且每项必须 ∈ FIRST_DECISION [${FIRST_DECISION.join(', ')}]`);
  }
  const criteria = Array.isArray(o['success_criteria']) ? (o['success_criteria'] as unknown[]).map(String) : null;
  if (!criteria || criteria.length === 0 || criteria.some((c) => c.trim() === '')) {
    push('success_criteria', '必须为非空字符串数组');
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    task: {
      id,
      source: o['source'] as string,
      task_type: o['task_type'] as string,
      complexity: o['complexity'] as string,
      scope: o['scope'] as string,
      characteristics: characteristics!,
      constraints: constraints!,
      prompt: o['prompt'] as string,
      expected_first_decisions: expected as FirstDecision[],
      success_criteria: criteria!,
      dryrun_coverage: Array.isArray(o['dryrun_coverage']) ? (o['dryrun_coverage'] as unknown[]).map(String) : undefined,
    },
  };
}

/** 加载一个目录下全部 *.yaml / *.yml 任务 */
export function loadTasksFromDir(dir: string, vocab: ControlledVocab = SPEC_EXAMPLE_VOCAB): { tasks: BenchmarkTask[]; issues: TaskLoadIssue[] } {
  const tasks: BenchmarkTask[] = [];
  const issues: TaskLoadIssue[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
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
