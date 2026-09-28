/**
 * benchmark/cda.ts — CDA（Composite Delegation Accuracy）冻结口径
 *
 * 人工冻结（2026-09-27）：
 *   CDA 只评价「是否正确判断需要委派」，**不是 mode accuracy**。
 *   expected ∈ {DIRECT, DELEGATE}，actual ∈ {DIRECT, DELEGATE, PARALLEL}：
 *
 *   | expected | actual   | CDA |
 *   | DIRECT   | DIRECT   | 1   |
 *   | DIRECT   | DELEGATE | 0   |
 *   | DELEGATE | DELEGATE | 1   |
 *   | DELEGATE | PARALLEL | 1   |
 *   | DELEGATE | DIRECT   | 0   |
 *
 * 即：只在「是否委派」这一根轴上比较；模式（serial/parallel/workflow）选错由
 * Decision Accuracy 评价，**不得**计入 CDA。该口径不得修改。
 */

import type { FirstDecision } from '../core/enums.ts';

/** §3.1：委派动作 ⇔ first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}（冻结定义） */
export function isDelegationAction(decision: FirstDecision): boolean {
  return decision === 'DELEGATE' || decision === 'PARALLEL' || decision === 'WORKFLOW';
}

/** 任务的期望委派轴：由 benchmark 任务 YAML 的 expected_first_decisions 推导（人工预先定义，不得由 Policy 生成） */
export function expectedDelegation(expectedFirstDecisions: readonly FirstDecision[]): boolean {
  if (expectedFirstDecisions.length === 0) {
    throw new Error('expected_first_decisions 不能为空（任务定义要求，见 benchmark/tasks.ts）');
  }
  return expectedFirstDecisions.some(isDelegationAction);
}

/**
 * 单次 run 的 CDA：期望委派轴与实际行动轴一致 ⇒ 1，否则 0。
 * 与 mode 无关（DELEGATE vs PARALLEL 都得 1）。
 */
export function cdaScore(expectedIsDelegation: boolean, actual: FirstDecision): 0 | 1 {
  return expectedIsDelegation === isDelegationAction(actual) ? 1 : 0;
}

/**
 * 任务级 CDA：把 repetitions 次重复的实际决策取均值（§3.2）。
 * 3 次重复时取值 ∈ {0, 1/3, 2/3, 1}。
 */
export function taskCda(expectedIsDelegation: boolean, actuals: readonly FirstDecision[]): number {
  if (actuals.length === 0) throw new Error('taskCda 需要至少一次实际决策');
  const sum = actuals.reduce((acc, a) => acc + cdaScore(expectedIsDelegation, a), 0);
  return sum / actuals.length;
}

/** 臂级 CDA：任务级 CDA 的均值（配对检验的输入） */
export function armCda(taskValues: readonly number[]): number {
  if (taskValues.length === 0) throw new Error('armCda 需要至少一个任务级 CDA');
  return taskValues.reduce((a, b) => a + b, 0) / taskValues.length;
}
