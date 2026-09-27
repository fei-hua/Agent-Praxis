/**
 * benchmark/judge.ts — Benchmark 判定（spec/frozen.md §9.2/§9.3、experiment-design.md §9）
 *
 * 全部为纯函数输入/输出（§4.3：相关代码可重复运行且无外部状态依赖）。
 *
 * §9.2 任务级判定（判定规则冻结，不得调整）：
 *   success_criteria_passed：所有 success criteria 的检查结果；
 *   no_forbidden_violation：禁改文件 hash diff；
 *   verification_executed：调用了成功条件验证工具；
 *   subagent_used_when_expected：expected_first_decisions 命中委派时，检查 subagent 使用记录。
 *   以上不进入模型 prompt。
 *
 * §9.3 E2A：Beneficial Action Change = Action Change AND Task Success AND no_forbidden_violation AND cost_ok；
 *   cost_ok ⇔ tokens_treatment ≤ 1.50 × tokens_baseline + 1000
 *           AND subagent_calls_treatment ≤ subagent_calls_baseline + 1；
 *   wall_time 只报告，不进硬门。
 */

import { FROZEN } from '../core/frozen-constants.ts';

// ---------- §9.2 任务级判定 ----------

export interface TaskJudgeInput {
  /** 每条 success criteria 的检查结果（冻结定义：所有 criteria 检查结果） */
  success_criteria_results: Array<{ criterion: string; passed: boolean }>;
  /** 禁改文件的 hash diff 列表（非空 = 存在违例） */
  forbidden_file_changes: string[];
  /** 是否调用了成功条件验证工具 */
  verification_tool_called: boolean;
  /** expected_first_decisions 是否命中委派（DELEGATE/PARALLEL/WORKFLOW） */
  expected_delegation: boolean;
  /** 轨迹中的 subagent 调用数 */
  subagent_invocations: number;
}

export interface TaskChecks {
  success_criteria_passed: boolean;
  no_forbidden_violation: boolean;
  verification_executed: boolean;
  subagent_used_when_expected: boolean;
}

export function evaluateTaskChecks(input: TaskJudgeInput): { task_success: boolean; checks: TaskChecks } {
  const checks: TaskChecks = {
    success_criteria_passed:
      input.success_criteria_results.length > 0 && input.success_criteria_results.every((r) => r.passed),
    no_forbidden_violation: input.forbidden_file_changes.length === 0,
    verification_executed: input.verification_tool_called,
    subagent_used_when_expected: input.expected_delegation ? input.subagent_invocations > 0 : true,
  };
  return {
    task_success:
      checks.success_criteria_passed &&
      checks.no_forbidden_violation &&
      checks.verification_executed &&
      checks.subagent_used_when_expected,
    checks,
  };
}

// ---------- §9.1 Action Change（判定规则冻结） ----------

export interface ActionProfile {
  first_decision: string;
  /** delegation agent set */
  delegation_agents: string[];
  /** delegation execution mode（serial|parallel|workflow）；无委派为 null */
  delegation_execution_mode: 'serial' | 'parallel' | 'workflow' | null;
  /** 是否有验证步骤（verification: absent/present） */
  verification_present: boolean;
}

export interface ActionChangeResult {
  changed: boolean;
  reasons: string[];
  excluded_notes: string[];
}

/**
 * Action Change = True 若满足任一：
 *   (a) first_decision 不同；
 *   (b) delegation agent set 不同；
 *   (c) delegation execution mode：serial ↔ parallel；
 *   (d) verification：absent → present。
 * 不计为 Action Change：grep 与 read 等工具选择、同一策略下工具顺序轻微变化、探索深度不同。
 * (c) 按裁决原文只计 serial ↔ parallel 互换；其余 mode 组合不计入（逐字实现，不扩大解释）。
 */
export function isActionChange(baseline: ActionProfile, treatment: ActionProfile): ActionChangeResult {
  const reasons: string[] = [];
  const excluded_notes: string[] = [];

  if (baseline.first_decision !== treatment.first_decision) {
    reasons.push(`(a) first_decision 不同：${baseline.first_decision} vs ${treatment.first_decision}`);
  }
  const setA = new Set(baseline.delegation_agents.map((s) => s.trim().toLowerCase()).sort());
  const setB = new Set(treatment.delegation_agents.map((s) => s.trim().toLowerCase()).sort());
  const sameSet = setA.size === setB.size && [...setA].every((x) => setB.has(x));
  if (!sameSet) {
    reasons.push(`(b) delegation agent set 不同：[${[...setA].join(',')}] vs [${[...setB].join(',')}]`);
  }
  const m0 = baseline.delegation_execution_mode;
  const m1 = treatment.delegation_execution_mode;
  const serialParallelSwap =
    (m0 === 'serial' && m1 === 'parallel') || (m0 === 'parallel' && m1 === 'serial');
  if (serialParallelSwap) {
    reasons.push(`(c) delegation execution mode：${m0} ↔ ${m1}`);
  } else if (m0 !== m1) {
    excluded_notes.push(`(c) mode 变化 ${m0} → ${m1} 不属于裁决定义的 serial ↔ parallel，不计`);
  }
  if (!baseline.verification_present && treatment.verification_present) {
    reasons.push('(d) verification：absent → present');
  }

  excluded_notes.push('工具选择（如 grep ↔ read）、同策略工具顺序、探索深度不同：不计 Action Change（§9.1）');
  return { changed: reasons.length > 0, reasons, excluded_notes };
}

// ---------- §9.3 Beneficial Action Change（E2A 主定义） ----------

export interface CostInputs {
  /** 委派成本口径 token（含 Experience Context 注入；§4.4：Input/Output/总 token 三个口径都要报） */
  tokens: number;
  /** Input Token 去掉 Experience Context 预算占用后的有效口径（T4 公式） */
  tokens_effective: number;
  subagent_calls: number;
  /** §9.2 四条检查结果 */
  task_success: boolean;
  no_forbidden_violation: boolean;
}

export interface CostComparison {
  cost_ok: boolean;
  tokens_ok: boolean;
  subagent_calls_ok: boolean;
  wall_time_report_only: { baseline_ms: number; treatment_ms: number };
}

export function evaluateCostOk(baseline: CostInputs, treatment: CostInputs, wallTime: { baseline_ms: number; treatment_ms: number }): CostComparison {
  const tokens_ok = treatment.tokens <= 1.50 * baseline.tokens + 1000;
  const subagent_calls_ok = treatment.subagent_calls <= baseline.subagent_calls + 1;
  return {
    cost_ok: tokens_ok && subagent_calls_ok,
    tokens_ok,
    subagent_calls_ok,
    wall_time_report_only: wallTime,
  };
}

export interface BeneficialResult {
  beneficial_action_change: boolean;
  action_changed: boolean;
  action_change_reasons: string[];
  task_success: boolean;
  no_forbidden_violation: boolean;
  cost_ok: boolean;
  cost: CostComparison;
}

/**
 * Beneficial Action Change = Action Change AND Task Success AND no_forbidden_violation AND cost_ok。
 * E2A：新策略产生的动作变化在不突破成本上限的前提下，确实帮助任务成功。
 * （决策变化但未带来成功 → 不算；成功但成本超上限 → 不算。）
 */
export function evaluateBeneficialActionChange(
  baselineProfile: ActionProfile,
  treatmentProfile: ActionProfile,
  baselineCost: CostInputs,
  treatmentCost: CostInputs,
  wallTime: { baseline_ms: number; treatment_ms: number },
): BeneficialResult {
  const ac = isActionChange(baselineProfile, treatmentProfile);
  const cost = evaluateCostOk(baselineCost, treatmentCost, wallTime);
  return {
    beneficial_action_change:
      ac.changed && treatmentCost.task_success && treatmentCost.no_forbidden_violation && cost.cost_ok,
    action_changed: ac.changed,
    action_change_reasons: ac.reasons,
    task_success: treatmentCost.task_success,
    no_forbidden_violation: treatmentCost.no_forbidden_violation,
    cost_ok: cost.cost_ok,
    cost,
  };
}

// ---------- T4 等价实现：Input Token 去掉 Experience Context 预算占用 ----------

export interface StepTokenRecord {
  turn: number;
  step: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /** 该 step 注入的经验上下文 token 估算（retrieval.experience_context_estimate_tokens 同口径） */
  experience_context_estimate_tokens: number;
  /** 该 step 实际注入的经验条数（决定单条预算 160 tokens 的上限项） */
  experience_count: number;
}

/**
 * T4：T4_Input_Token = Σ_steps max(0, input_tokens − min(经验上下文实际占用, 预算上限))
 * 预算上限 = max(experience_context_total_budget, n × experience_token_budget_item)
 * 冻结值：experience_context_total_budget=800，experience_token_budget_item=160；n = 该 step 注入经验条数。
 */
export function effectiveInputTokens(steps: StepTokenRecord[]): number {
  let total = 0;
  for (const s of steps) {
    total += effectiveInputTokensPerStep(s);
  }
  return total;
}

/** 单 step 的有效 input token（T4 的被加项） */
export function effectiveInputTokensPerStep(step: StepTokenRecord): number {
  const budget = Math.max(
    FROZEN.experience_context_total_budget,
    FROZEN.experience_token_budget_item * Math.max(0, step.experience_count),
  );
  return Math.max(0, step.input_tokens - Math.min(step.experience_context_estimate_tokens, budget));
}
