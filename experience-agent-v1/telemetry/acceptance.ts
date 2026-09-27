/**
 * telemetry/acceptance.ts — Phase 0 验收检查器（tasks/phase0.md §4.2 五条 + §4.3 额外项）
 *
 * §4.2 五条（全部必须为 PASS，Pilot 才能开始）：
 *   1. trajectory schema 覆盖率 100%（§8.1 全部字段都有值或明确的 null）；
 *   2. tool call 与 tool result 配对率 100%；
 *   3. failure event 可重建（从 trajectory 能还原失败原因与上下文）；
 *   4. replan event 可重建（从 trajectory 能还原 replan 的触发与前后决策）；
 *   5. 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome）。
 *
 * §4.3 额外检查（非门禁，报告列出）：
 *   - token 使用量、工具调用数、失败率、replan 次数已记录；
 *   - 5 个 Subagent 的调用与返回都被记录（OQ-006 裁决后可用）；
 *   - replay 可重复运行且无外部状态依赖。
 *
 * 全部为纯代码判定，无外部状态依赖。
 */

import { FROZEN } from '../core/frozen-constants.ts';
import { readTrajectory, type RunRecord, type TrajectoryEvent } from './trajectory.ts';

export interface CheckResult {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  metrics?: Record<string, number | string>;
}

export interface AcceptanceReport {
  run_id: string;
  checks: CheckResult[];
  extra_checks: CheckResult[];
  all_passed: boolean;
}

const RUN_RECORD_FIELDS: Array<keyof RunRecord> = [
  'run_id', 'task_id', 'arm', 'task_state', 'first_tool_call', 'experience_snapshot_id',
  'retrieved_experiences', 'tool_calls', 'tool_results', 'subagent_invocations',
  'verification_result', 'reflection_output', 'outcome', 'harness_version',
  'tool_schema_version', 'framework_version', 'model_id', 'experiment_config_hash',
  'input_tokens', 'output_tokens', 'total_tokens', 'wall_time_ms', 'success_criteria',
];

/** §4.2-1：trajectory schema 覆盖率 100%（§8.1 全部字段都有值或明确的 null） */
export function checkSchemaCoverage(events: TrajectoryEvent[]): CheckResult {
  const runEnd = [...events].reverse().find((e) => e.type === 'run_end');
  const runStart = events.find((e) => e.type === 'run_start');
  const missing: string[] = [];
  if (!runStart) missing.push('run_start 事件');
  if (!runEnd) missing.push('run_end 事件');
  if (runEnd && runEnd.type === 'run_end') {
    const rec = runEnd.run_record;
    for (const f of RUN_RECORD_FIELDS) {
      const v = rec[f];
      if (v === undefined) missing.push(`run_record.${String(f)}`);
    }
  }
  const covered = RUN_RECORD_FIELDS.length - missing.filter((m) => m.startsWith('run_record.')).length;
  return {
    id: '4.2-1',
    title: 'trajectory schema 覆盖率 100%（§8.1 字段值或明确 null）',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    detail:
      missing.length === 0
        ? `§8.1 全部 ${RUN_RECORD_FIELDS.length} 个字段有值或明确 null；run_start/run_end 事件齐全`
        : `缺失：${missing.join(', ')}`,
    metrics: { fields_total: RUN_RECORD_FIELDS.length, fields_covered: covered },
  };
}

/** §4.2-2：tool call 与 tool result 配对率 100% */
export function checkToolPairing(events: TrajectoryEvent[]): CheckResult {
  const calls = events.filter((e) => e.type === 'tool_call');
  const results = events.filter((e) => e.type === 'tool_result');
  const resultIds = new Set(results.map((e) => (e.type === 'tool_result' ? e.result.call_id : '')));
  const callIds = new Set(calls.map((e) => (e.type === 'tool_call' ? e.call.call_id : '')));
  const unpairedCalls = [...callIds].filter((id) => !resultIds.has(id));
  const orphanResults = [...resultIds].filter((id) => !callIds.has(id));
  const total = callIds.size;
  const paired = total - unpairedCalls.length;
  return {
    id: '4.2-2',
    title: 'tool call 与 tool result 配对率 100%',
    status: unpairedCalls.length === 0 && orphanResults.length === 0 && total > 0 ? 'PASS' : 'FAIL',
    detail:
      unpairedCalls.length === 0 && orphanResults.length === 0 && total > 0
        ? `${paired}/${total} 配对（含子会话调用）`
        : `未配对 call：[${unpairedCalls.join(', ')}]；无 call 的 result：[${orphanResults.join(', ')}]；总 call=${total}`,
    metrics: { calls: total, paired },
  };
}

/** §4.2-3：failure event 可重建（原因 + 上下文都在事件里） */
export function checkFailureReconstructable(events: TrajectoryEvent[]): CheckResult {
  const failures = events.filter((e) => e.type === 'failure');
  const bad: string[] = [];
  for (const e of failures) {
    if (e.type !== 'failure') continue;
    const f = e.failure;
    if (!f.failure_id || !f.reason || !f.kind) bad.push(`${f.failure_id || '<无 id>'}: 原因/kind 缺失`);
    if (!f.context.tool_call_id && !f.context.subagent_invocation_id) {
      bad.push(`${f.failure_id}: 上下文（tool_call_id/subagent_invocation_id）缺失`);
    }
    // 上下文必须指向轨迹里真实存在的 call
    if (f.context.tool_call_id) {
      const callExists = events.some(
        (ev) => ev.type === 'tool_call' && ev.call.call_id === f.context.tool_call_id,
      );
      if (!callExists) bad.push(`${f.failure_id}: 指向的 tool_call ${f.context.tool_call_id} 不在轨迹中`);
    }
  }
  return {
    id: '4.2-3',
    title: 'failure event 可重建（失败原因与上下文可从 trajectory 还原）',
    status: bad.length === 0 ? 'PASS' : 'FAIL',
    detail:
      bad.length === 0
        ? `${failures.length} 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call`
        : bad.join('; '),
    metrics: { failures: failures.length },
  };
}

/** §4.2-4：replan event 可重建（触发 failure + 前后决策） */
export function checkReplanReconstructable(events: TrajectoryEvent[]): CheckResult {
  const replans = events.filter((e) => e.type === 'replan');
  const failures = events.filter((e) => e.type === 'failure');
  const failureIds = new Set(failures.map((e) => (e.type === 'failure' ? e.failure.failure_id : '')));
  const decisions = events
    .filter((e) => e.type === 'task_state')
    .map((e) => (e.type === 'task_state' ? e.first_decision : ''));
  const bad: string[] = [];
  for (const e of replans) {
    if (e.type !== 'replan') continue;
    const r = e.replan;
    if (!r.trigger_failure_id || !failureIds.has(r.trigger_failure_id)) {
      bad.push(`${r.replan_id}: trigger_failure_id ${r.trigger_failure_id} 不在轨迹 failure 中`);
    }
    if (!r.decision_before || !r.decision_after) bad.push(`${r.replan_id}: 前后决策缺失`);
    if (!decisions.includes(r.decision_before) || !decisions.includes(r.decision_after)) {
      bad.push(`${r.replan_id}: 前后决策与轨迹 task_state 不一致`);
    }
  }
  return {
    id: '4.2-4',
    title: 'replan event 可重建（触发与前后决策可还原）',
    status: bad.length === 0 ? 'PASS' : 'FAIL',
    detail:
      bad.length === 0
        ? `${replans.length} 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原`
        : bad.join('; '),
    metrics: { replans: replans.length },
  };
}

/** §4.2-5：离线可重建完整决策链 Task → Task State → First Decision → Action → Tool/Subagent → Outcome */
export function checkDecisionChain(events: TrajectoryEvent[]): CheckResult {
  const runStart = events.find((e) => e.type === 'run_start');
  const taskStates = events.filter((e) => e.type === 'task_state');
  const calls = events.filter((e) => e.type === 'tool_call');
  const subs = events.filter((e) => e.type === 'subagent_invocation');
  const outcome = events.find((e) => e.type === 'outcome');
  const problems: string[] = [];
  if (!runStart) problems.push('Task（run_start.task_id）缺失');
  if (taskStates.length === 0) problems.push('Task State 缺失');
  else if (taskStates.some((e) => e.type !== 'task_state' || !e.first_decision)) problems.push('First Decision 缺失');
  if (calls.length === 0 && subs.length === 0) problems.push('Action（tool_call/subagent_invocation）缺失');
  if (!outcome) problems.push('Outcome 缺失');
  // 顺序性：task_state 必须先于第一个 action；outcome 在 action 之后
  const firstActionIdx = events.findIndex((e) => e.type === 'tool_call' || e.type === 'subagent_invocation');
  const firstStateIdx = events.findIndex((e) => e.type === 'task_state');
  const outcomeIdx = events.findIndex((e) => e.type === 'outcome');
  if (firstStateIdx < 0 || firstActionIdx < 0 || firstStateIdx > firstActionIdx) problems.push('task_state 未先于 action');
  if (outcomeIdx < firstActionIdx) problems.push('outcome 未在 action 之后');
  return {
    id: '4.2-5',
    title: '离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome）',
    status: problems.length === 0 ? 'PASS' : 'FAIL',
    detail:
      problems.length === 0
        ? `链条完整：task=${(runStart as { task_id?: string })?.task_id ?? '?'}，task_state×${taskStates.length}，actions=${calls.length + subs.length}，outcome 有记录`
        : problems.join('; '),
    metrics: { task_states: taskStates.length, tool_calls: calls.length, subagent_invocations: subs.length },
  };
}

// ---------- §4.3 额外检查（非门禁） ----------

export function checkUsageRecorded(events: TrajectoryEvent[]): CheckResult {
  const runEnd = [...events].reverse().find((e) => e.type === 'run_end');
  const rec = runEnd && runEnd.type === 'run_end' ? runEnd.run_record : null;
  const ok = !!rec && typeof rec.input_tokens === 'number' && typeof rec.total_tokens === 'number';
  return {
    id: '4.3-1',
    title: 'token 使用量、工具调用数、失败率、replan 次数已记录',
    status: ok ? 'PASS' : 'FAIL',
    detail: ok
      ? `input=${rec!.input_tokens}, output=${rec!.output_tokens}, total=${rec!.total_tokens}, tool_calls=${rec!.tool_calls.length}, failures=${events.filter((e) => e.type === 'failure').length}, replans=${events.filter((e) => e.type === 'replan').length}`
      : 'run_record 缺 token 字段',
    metrics: {
      input_tokens: rec?.input_tokens ?? 0,
      output_tokens: rec?.output_tokens ?? 0,
      total_tokens: rec?.total_tokens ?? 0,
      tool_calls: rec?.tool_calls.length ?? 0,
    },
  };
}

export function checkSubagentRecording(events: TrajectoryEvent[]): CheckResult {
  const inv = events.filter((e) => e.type === 'subagent_invocation');
  const res = events.filter((e) => e.type === 'subagent_result');
  const invIds = new Set(inv.map((e) => (e.type === 'subagent_invocation' ? e.invocation.invocation_id : '')));
  const resIds = new Set(res.map((e) => (e.type === 'subagent_result' ? e.result.invocation_id : '')));
  const unreturned = [...invIds].filter((id) => !resIds.has(id));
  return {
    id: '4.3-2',
    title: 'Subagent 的调用与返回都被记录（OQ-006 名单内）',
    status: unreturned.length === 0 ? 'PASS' : 'FAIL',
    detail: `调用 ${invIds.size}，返回 ${resIds.size}，未返回：[${unreturned.join(', ')}]`,
    metrics: { invocations: invIds.size, results: resIds.size },
  };
}

/** 对一个轨迹文件执行全部检查 */
export function runAcceptance(trajectoryPath: string): AcceptanceReport {
  const events = readTrajectory(trajectoryPath);
  const runEnd = [...events].reverse().find((e) => e.type === 'run_end');
  const runId = runEnd && runEnd.type === 'run_end' ? runEnd.run_record.run_id : trajectoryPath;
  const checks = [
    checkSchemaCoverage(events),
    checkToolPairing(events),
    checkFailureReconstructable(events),
    checkReplanReconstructable(events),
    checkDecisionChain(events),
  ];
  const extra_checks = [checkUsageRecorded(events), checkSubagentRecording(events)];
  return {
    run_id: runId,
    checks,
    extra_checks,
    all_passed: checks.every((c) => c.status === 'PASS'),
  };
}

/** 全部轨迹的验收汇总（§4.1 exit gate：5 个 dry-run 全部满足五条） */
export function runAcceptanceAll(trajectoryPaths: string[]): {
  reports: AcceptanceReport[];
  gate_passed: boolean;
  coverage: CheckResult[];
  frozen_thresholds_recorded: Record<string, number>;
} {
  const reports = trajectoryPaths.map(runAcceptance);

  // 集合级覆盖（OQ-007 授权要求：5 个 dry-run 至少覆盖 1 次真实失败 + 1 次 replan；
  // 单条轨迹若无 failure，§4.2-3/4 会「空集通过」，因此必须在集合级显式要求覆盖）
  let failures = 0;
  let replans = 0;
  let subagentRuns = 0;
  for (const p of trajectoryPaths) {
    const events = readTrajectory(p);
    const f = events.filter((e) => e.type === 'failure').length;
    const r = events.filter((e) => e.type === 'replan').length;
    const s = events.filter((e) => e.type === 'subagent_invocation').length;
    failures += f;
    replans += r;
    if (s > 0) subagentRuns++;
  }
  const coverage: CheckResult[] = [
    {
      id: 'coverage-1',
      title: '失败场景覆盖（至少 1 个 run 含可重建 failure event）',
      status: failures >= 1 ? 'PASS' : 'FAIL',
      detail: `集合内 failure 事件总数=${failures}`,
      metrics: { failures },
    },
    {
      id: 'coverage-2',
      title: 'Replan 场景覆盖（至少 1 个 run 含可重建 replan event）',
      status: replans >= 1 ? 'PASS' : 'FAIL',
      detail: `集合内 replan 事件总数=${replans}`,
      metrics: { replans },
    },
    {
      id: 'coverage-3',
      title: '委派场景覆盖（至少 1 个 run 含 subagent 调用与返回）',
      status: subagentRuns >= 1 ? 'PASS' : 'FAIL',
      detail: `含 subagent 调用的 run 数=${subagentRuns}`,
      metrics: { subagent_runs: subagentRuns },
    },
  ];

  return {
    reports,
    gate_passed:
      reports.length === 5 && reports.every((r) => r.all_passed) && coverage.every((c) => c.status === 'PASS'),
    coverage,
    frozen_thresholds_recorded: {
      final_score_threshold: FROZEN.final_score_threshold,
      top_k: FROZEN.top_k,
      experience_token_budget_item: FROZEN.experience_token_budget_item,
      lesson_max_chars: FROZEN.lesson_max_chars,
    },
  };
}
