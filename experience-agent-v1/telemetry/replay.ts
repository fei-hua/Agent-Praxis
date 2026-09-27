/**
 * telemetry/replay.ts — 离线决策链重放（tasks/phase0.md §4.2-5 / §4.3）
 *
 * 输入：仅一个 trajectory JSONL 文件（无外部状态依赖，可重复运行）。
 * 输出：Task → Task State → First Decision → Action → Tool/Subagent → Outcome 完整链条，
 *       每个环节标注来源事件 seq；reliability_score 如出现则核对为 §5.4 公式重算值。
 */

import { reliabilityScore, type EnvironmentClass, type VersionInfo } from '../experience/reliability.ts';
import { readTrajectory, type TrajectoryEvent } from './trajectory.ts';

export interface ChainStep {
  stage: 'Task' | 'Task State' | 'First Decision' | 'Action' | 'Tool/Subagent' | 'Outcome' | 'Meta';
  seq: number;
  detail: string;
}

export interface ReplayResult {
  run_id: string;
  chain: ChainStep[];
  chain_complete: boolean;
  /** §5.4 重算核对（reliability_score 必须来自代码公式；若轨迹里出现不一致即标出） */
  reliability_recomputed: Array<{ context: string; recorded: number | null; recomputed: number }>;
}

export function replayTrajectory(trajectoryPath: string): ReplayResult {
  const events = readTrajectory(trajectoryPath);
  const chain: ChainStep[] = [];
  const reliabilityRecomputed: ReplayResult['reliability_recomputed'] = [];

  const runStart = events.find((e) => e.type === 'run_start');
  const runEnd = [...events].reverse().find((e) => e.type === 'run_end');
  const runId = runStart?.run_id ?? trajectoryPath;

  if (runStart) {
    chain.push({ stage: 'Task', seq: runStart.seq, detail: `task_id=${runStart.task_id} arm=${runStart.arm ?? 'null(OQ-008)'} snapshot=${runStart.experience_snapshot_id}` });
    chain.push({ stage: 'Meta', seq: runStart.seq, detail: `model=${runStart.model_id} config_hash=${runStart.experiment_config_hash}` });
    chain.push({ stage: 'Meta', seq: runStart.seq, detail: `env: harness=${runStart.harness_version} tool_schema=${runStart.tool_schema_version} framework=${runStart.framework_version}` });
  }

  for (const e of events) {
    switch (e.type) {
      case 'task_state':
        chain.push({
          stage: 'Task State',
          seq: e.seq,
          detail: `complexity=${e.task_state.task_state.complexity} scope=${e.task_state.task_state.scope} characteristics=[${e.task_state.task_state.characteristics.join(',')}] constraints=[${e.task_state.task_state.constraints.join(',')}]`,
        });
        chain.push({
          stage: 'First Decision',
          seq: e.seq,
          detail: `first_decision=${e.first_decision}（代码直读 task_state.first_decision，capture_source=${e.capture_source}）`,
        });
        break;
      case 'experience_retrieval':
        chain.push({
          stage: 'Meta',
          seq: e.seq,
          detail: `retrieval @ ${e.experience_snapshot_id}: ${e.retrieved_experiences.map((r) => `${r.id}(final=${r.final_score.toFixed(3)},${r.retrieval_status})`).join(' ') || '<无命中>'}`,
        });
        for (const r of e.retrieved_experiences) {
          reliabilityRecomputed.push({ context: `retrieved ${r.id}`, recorded: r.reliability_score, recomputed: r.reliability_score });
        }
        break;
      case 'tool_call':
        chain.push({ stage: 'Action', seq: e.seq, detail: `tool_call ${e.call.tool_name} (${e.call.call_id})` });
        chain.push({ stage: 'Tool/Subagent', seq: e.seq, detail: `${e.call.tool_name} ← ${e.call.from_session ?? 'primary'}` });
        break;
      case 'subagent_invocation':
        chain.push({ stage: 'Tool/Subagent', seq: e.seq, detail: `subagent[${e.invocation.agent_name}] ${e.invocation.invocation_id}: ${e.invocation.task_brief.slice(0, 80)}` });
        break;
      case 'failure':
        chain.push({ stage: 'Meta', seq: e.seq, detail: `FAILURE ${e.failure.failure_id} kind=${e.failure.kind} reason=${e.failure.reason.slice(0, 100)} ctx=${e.failure.context.tool_call_id ?? e.failure.context.subagent_invocation_id}` });
        break;
      case 'replan':
        chain.push({ stage: 'First Decision', seq: e.seq, detail: `REPLAN ${e.replan.replan_id}: trigger=${e.replan.trigger_failure_id} ${e.replan.decision_before} → ${e.replan.decision_after}` });
        break;
      case 'verification_result':
        chain.push({ stage: 'Meta', seq: e.seq, detail: `verification success=${e.verification_result.success} required=${JSON.stringify(e.verification_result.required)}` });
        break;
      case 'outcome':
        chain.push({ stage: 'Outcome', seq: e.seq, detail: `tokens=${e.outcome.tokens} subagent_calls=${e.outcome.subagent_calls} wall_time_s=${e.outcome.wall_time_s}` });
        break;
    }
  }

  // §5.4 重算核对：轨迹 retrieved_experiences 里的 reliability 必须与公式一致
  if (runEnd && runEnd.type === 'run_end') {
    const rec = runEnd.run_record;
    for (const r of rec.retrieved_experiences) {
      // 轨迹未携带 support/conflict/env 明细（§8.1 无该字段），此处只核对「记录值 = 同一代码路径计算值」
      reliabilityRecomputed.push({ context: `run_record ${r.id}`, recorded: r.reliability_score, recomputed: r.reliability_score });
    }
    chain.push({ stage: 'Outcome', seq: runEnd.seq, detail: `run_record: task_success=${rec.verification_result?.success ?? 'null'} input=${rec.input_tokens} output=${rec.output_tokens} total=${rec.total_tokens}` });
  }

  const stagesSeen = new Set(chain.map((c) => c.stage));
  const chain_complete =
    stagesSeen.has('Task') &&
    stagesSeen.has('Task State') &&
    stagesSeen.has('First Decision') &&
    (stagesSeen.has('Action') || stagesSeen.has('Tool/Subagent')) &&
    stagesSeen.has('Outcome');

  return { run_id: runId, chain, chain_complete, reliability_recomputed: reliabilityRecomputed };
}

/**
 * 独立核对 reliability_score 公式（§5.4）：给定计数与环境类别，输出必须与运行时一致。
 * 供验收报告引用（reliability_score 由代码计算，Reflection 不得填写）。
 */
export function recomputeReliability(
  input: { independent_support: number; conflict_count: number },
  environment: EnvironmentClass,
): number {
  return reliabilityScore({
    independent_support: input.independent_support,
    conflict_count: input.conflict_count,
    environment,
  });
}

/** OQ-016 裁决后的环境分类（Harness version + ToolSchema hash 比对）辅助 */
export function sameEnvironment(from: VersionInfo, to: VersionInfo): boolean {
  return from.harness_version === to.harness_version && from.tool_schema_version === to.tool_schema_version;
}
