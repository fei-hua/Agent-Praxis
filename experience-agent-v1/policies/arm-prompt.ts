/**
 * policies/arm-prompt.ts — 臂运行时装配（Issue #8，基于已冻结的 arms / policy / CDA）
 *
 * 职责：把「实验臂」翻译成一次 run 的可执行计划：
 *   - 注入主 Agent 的指令块（A 臂为空；B/C 臂注入 Frozen Delegation Policy）
 *   - 是否注入经验上下文（仅 C_frozen / C_static / D_online；A/B 为 false）
 *   - 是否启用 Reflection 写回（Pilot 三臂全为 false）
 *   - 期望的经验快照 id 与 Policy 指纹（用于 run manifest 与实验配置）
 *
 * 纪律：本模块不改任何阈值/公式；臂差异只能来自 core/arms.ts 的冻结定义。
 */

import type { Arm } from '../core/enums.ts';
import { armDefinition, type ArmDefinition } from '../core/arms.ts';
import { buildPolicyInstruction, policyFingerprint } from './delegation-policy.ts';

export interface ArmRunPlan {
  arm: Arm;
  definition: ArmDefinition;
  /** 期望的经验快照 id（'none' = 不使用经验） */
  snapshot_id: string;
  /** Policy 指纹；A 臂（无 Policy）为 null */
  policy_hash: string | null;
  inject_experience: boolean;
  reflection_enabled: boolean;
  /** 注入主 Agent 的指令块；A 臂为空字符串（什么都不给） */
  instruction: string;
}

export function buildArmRunPlan(arm: Arm): ArmRunPlan {
  const definition = armDefinition(arm);
  const usesPolicy = definition.decision_input === 'policy';
  return {
    arm,
    definition,
    snapshot_id: definition.experience === 'none' ? 'none' : definition.experience,
    policy_hash: usesPolicy ? policyFingerprint() : null,
    inject_experience: definition.experience !== 'none',
    reflection_enabled: definition.reflection,
    instruction: usesPolicy ? buildPolicyInstruction() : '',
  };
}

/** 经验上下文注入块（只读快照内容；空内容返回空串） */
export function composeExperienceBlock(experienceContext: string, snapshotId: string): string {
  if (experienceContext.trim() === '') return '';
  return [
    `# Frozen Action Experience（只读 ${snapshotId}）`,
    '',
    '以下经验来自冻结快照，仅供决策参考；不得因为经验存在而跳过验证。',
    '',
    experienceContext,
  ].join('\n');
}

/**
 * 组装本次 run 的完整指令块。
 * @param plan buildArmRunPlan 的结果
 * @param experienceContext C 臂检索到的经验上下文（A/B 臂必须为空）
 */
export function composeArmPrompt(plan: ArmRunPlan, experienceContext = ''): string {
  if (!plan.inject_experience && experienceContext.trim() !== '') {
    throw new Error(`臂 ${plan.arm} 不注入经验（arms.ts 冻结定义），但收到的经验上下文非空`);
  }
  const blocks: string[] = [];
  if (plan.instruction !== '') blocks.push(plan.instruction);
  if (plan.inject_experience) {
    const block = composeExperienceBlock(experienceContext, plan.snapshot_id);
    if (block !== '') blocks.push(block);
  }
  return blocks.join('\n\n');
}
