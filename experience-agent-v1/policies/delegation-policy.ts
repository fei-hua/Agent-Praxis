/**
 * policies/delegation-policy.ts — B 臂 Frozen Delegation Policy
 * （OQ-021 人工裁决，2026-09-27，冻结）
 *
 * 裁决原文要点：
 *   B 臂定义为 Policy-only baseline：
 *     B = DeepSeek V4.1 + DeepSeek Harness + Frozen Delegation Policy
 *   B 臂运行约束：不读取 Experience Store、不使用 Reflection 产生的经验、不在线更新 Policy、
 *   不根据历史轨迹修改规则；可以正常使用 Harness Tool / Subagent / Workflow。
 *
 *   Frozen Delegation Policy 按以下**优先级**确定 first_decision（自上而下，先命中先定）：
 *     1. REPLAN   已有失败状态，需要重新规划
 *     2. VERIFY   任务主要目标是验证/测试/审计已有结果
 *     3. WORKFLOW 任务包含多个存在明确先后依赖的阶段
 *     4. PARALLEL 存在两个或以上相互独立且适合委派的子任务
 *     5. DELEGATE 存在明确的专业分工、独立分析或单个可委派子任务
 *     6. EXPLORE  项目结构、调用关系、数据流或影响范围尚不明确，需要先探索
 *     7. DIRECT   任务局部、范围明确、信息充分，且不满足以上条件
 *
 *   Policy 在 Pilot 开始前冻结；Pilot 及 Formal 期间**不得**根据实验结果修改 Policy。
 *   Benchmark 中的 expected_delegation 必须由人工提前定义，**不得由该 Policy 自动生成**。
 *
 * 说明：本 Policy 是**发给主 Agent 的冻结决策规则**（first_decision 仍由主 Agent 产出、
 * 由代码直读 task_state.first_decision）。此处不提供「自动分类器」——那需要任务依赖结构等
 * 无法从任务定义可靠计算的输入，会变成开发 AI 替实验设计策略。
 */

import { createHash } from 'node:crypto';
import { canonicalJson, type JsonValue } from '../core/canonical-json.ts';
import type { FirstDecision } from '../core/enums.ts';

export const POLICY_ID = 'frozen-delegation-policy';
export const POLICY_VERSION = '1.0';
export const B_ARM_DEFINITION = 'B = DeepSeek V4.1 + DeepSeek Harness + Frozen Delegation Policy';

export interface DelegationPolicyRule {
  /** 优先级（1 最高，先命中先定） */
  priority: number;
  decision: FirstDecision;
  /** 命中条件（OQ-021 裁决原文） */
  condition: string;
}

/** OQ-021 裁决：7 条规则，按优先级（冻结，禁止改序/改词） */
export const DELEGATION_POLICY_RULES: readonly DelegationPolicyRule[] = [
  { priority: 1, decision: 'REPLAN', condition: '已有失败状态，需要重新规划' },
  { priority: 2, decision: 'VERIFY', condition: '任务主要目标是验证/测试/审计已有结果' },
  { priority: 3, decision: 'WORKFLOW', condition: '任务包含多个存在明确先后依赖的阶段' },
  { priority: 4, decision: 'PARALLEL', condition: '存在两个或以上相互独立且适合委派的子任务' },
  { priority: 5, decision: 'DELEGATE', condition: '存在明确的专业分工、独立分析或单个可委派子任务' },
  { priority: 6, decision: 'EXPLORE', condition: '项目结构、调用关系、数据流或影响范围尚不明确，需要先探索' },
  { priority: 7, decision: 'DIRECT', condition: '任务局部、范围明确、信息充分，且不满足以上条件' },
];

/** OQ-021 裁决：B 臂运行约束（冻结） */
export const B_ARM_RUN_CONSTRAINTS: readonly string[] = [
  '不读取 Experience Store',
  '不使用 Reflection 产生的经验',
  '不在线更新 Policy',
  '不根据历史轨迹修改规则',
  '可以正常使用 Harness Tool / Subagent / Workflow',
];

/** 实验纪律提醒（写入配置/报告，不发给 Agent） */
export const POLICY_FREEZE_NOTE =
  'Policy 在 Pilot 开始前冻结；Pilot 及 Formal 期间不得根据实验结果修改 Policy。' +
  'Benchmark 的 expected_delegation 必须由人工提前定义，不得由该 Policy 自动生成。';

/**
 * Policy 指纹：canonical JSON 的 SHA-256，记作 "sha256:<hex>"。
 * 用途：与 experiment_config_hash 一并证明「哪一版 Policy 在跑」；
 * 任何规则改动都会改变指纹（Pilot/Formal 期间不得改变）。
 */
export function policyFingerprint(): string {
  const payload = {
    policy_id: POLICY_ID,
    policy_version: POLICY_VERSION,
    arm_definition: B_ARM_DEFINITION,
    rules: DELEGATION_POLICY_RULES.map((r) => ({ priority: r.priority, decision: r.decision, condition: r.condition })),
    constraints: [...B_ARM_RUN_CONSTRAINTS],
  } as unknown as JsonValue;
  return `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`;
}

/** 装配给 B 臂主 Agent 的冻结决策说明（原文口径，不做解释性扩写） */
export function buildPolicyInstruction(): string {
  const rules = [...DELEGATION_POLICY_RULES]
    .sort((a, b) => a.priority - b.priority)
    .map((r) => `${r.priority}. ${r.decision}：${r.condition}`)
    .join('\n');
  return [
    '# Frozen Delegation Policy（B 臂，已冻结）',
    '',
    B_ARM_DEFINITION,
    '',
    '按以下优先级确定 first_decision（自上而下，先命中先定）：',
    '',
    rules,
    '',
    '运行约束：',
    ...B_ARM_RUN_CONSTRAINTS.map((c) => `- ${c}`),
  ].join('\n');
}
