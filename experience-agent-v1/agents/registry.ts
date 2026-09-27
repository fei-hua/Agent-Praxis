/**
 * agents/registry.ts — T7：5 个 Subagent（OQ-006 人工裁决 2026-09-27，冻结）
 *
 * 裁决原文（禁止自行修改以下名称、职责或 enum）：
 *   1. explorer：只读项目探索，负责文件定位、结构分析、调用关系、数据流和影响范围分析；不得修改项目文件。
 *   2. researcher：独立技术研究与方案分析，负责文档/API/实现方案比较；默认不得修改代码。
 *   3. ui-reviewer：UI/UX 专项审查，负责布局、视觉层级、间距、一致性、交互和 UI 越界风险；默认不得修改代码。
 *   4. code-reviewer：代码与架构审查，负责模块边界、数据流、副作用、路由和未授权修改检查；默认不得修改代码。
 *   5. tester：构建、测试、回归和 success criteria 验证；可以执行测试命令，但默认不得修改源码。
 *
 * first_decision 与 Subagent 不做一一对应，统一关系为（裁决原文）：
 *   DIRECT   → 不调用 Subagent
 *   EXPLORE  → 典型调用 explorer
 *   DELEGATE → 根据任务选择专业 Subagent
 *   PARALLEL → 并行调用两个或以上 Subagent
 *   WORKFLOW → 由 Workflow 编排多个 Subagent
 *   VERIFY   → 典型调用 tester
 *   REPLAN   → 主 Agent 重新决策，不对应固定 Subagent
 *
 * Phase 0 要求（tasks/phase0.md T7）：能被调用并记录，不要求智能。
 */

import type { FirstDecision } from '../core/enums.ts';

export const SUBAGENT_NAMES = [
  'explorer',
  'researcher',
  'ui-reviewer',
  'code-reviewer',
  'tester',
] as const;
export type SubagentName = (typeof SUBAGENT_NAMES)[number];

export interface SubagentDefinition {
  name: SubagentName;
  /** 职责（裁决原文） */
  responsibility: string;
  /** 修改权限（裁决原文） */
  modification_policy: string;
}

/** OQ-006 裁决：5 个 Subagent 的名字与职责（冻结，禁止修改） */
export const SUBAGENTS: readonly SubagentDefinition[] = [
  {
    name: 'explorer',
    responsibility: '只读项目探索：文件定位、结构分析、调用关系、数据流和影响范围分析',
    modification_policy: '不得修改项目文件',
  },
  {
    name: 'researcher',
    responsibility: '独立技术研究与方案分析：文档/API/实现方案比较',
    modification_policy: '默认不得修改代码',
  },
  {
    name: 'ui-reviewer',
    responsibility: 'UI/UX 专项审查：布局、视觉层级、间距、一致性、交互和 UI 越界风险',
    modification_policy: '默认不得修改代码',
  },
  {
    name: 'code-reviewer',
    responsibility: '代码与架构审查：模块边界、数据流、副作用、路由和未授权修改检查',
    modification_policy: '默认不得修改代码',
  },
  {
    name: 'tester',
    responsibility: '构建、测试、回归和 success criteria 验证',
    modification_policy: '可以执行测试命令，但默认不得修改源码',
  },
];

/** OQ-006 裁决：first_decision → Subagent 统一关系（非一一对应） */
export const DECISION_TO_SUBAGENTS: Readonly<Record<FirstDecision, readonly SubagentName[]>> = {
  DIRECT: [], // 不调用 Subagent
  EXPLORE: ['explorer'], // 典型调用 explorer
  DELEGATE: ['explorer', 'researcher', 'ui-reviewer', 'code-reviewer', 'tester'], // 根据任务选择专业 Subagent
  PARALLEL: ['explorer', 'researcher', 'ui-reviewer', 'code-reviewer', 'tester'], // 并行调用两个或以上 Subagent
  WORKFLOW: ['explorer', 'researcher', 'ui-reviewer', 'code-reviewer', 'tester'], // 由 Workflow 编排多个 Subagent
  VERIFY: ['tester'], // 典型调用 tester
  REPLAN: [], // 主 Agent 重新决策，不对应固定 Subagent
};

export function isRegisteredSubagent(name: string): name is SubagentName {
  return (SUBAGENT_NAMES as readonly string[]).includes(name);
}

export function subagentDefinition(name: SubagentName): SubagentDefinition {
  const found = SUBAGENTS.find((a) => a.name === name);
  if (!found) throw new Error(`未注册的 Subagent：${name}`);
  return found;
}
