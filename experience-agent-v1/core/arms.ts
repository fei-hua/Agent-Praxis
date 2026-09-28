/**
 * core/arms.ts — 实验臂定义（人工冻结，2026-09-27）
 *
 * 人工裁决原文表格：
 *   | Arm      | 输入     | Experience     | Reflection |
 *   | A        | Harness | ❌             | ❌         |
 *   | B        | Policy  | ❌             | ❌         |
 *   | C_frozen | Policy  | SNAPSHOT_01    | ❌         |
 *   | C_static | D 对照   | S0             | ❌         |
 *   | D_online | Policy  | evolving store | ✅         |
 *
 * Pilot 只跑 **A / B / C_frozen** 三臂；C_static 与 D_online 属于 D 实验（探索性），不参与 Pilot。
 * 本文件是「臂隔离」的唯一事实来源：任何 run 的 manifest 必须与本表一致。
 */

import type { Arm } from './enums.ts';

export interface ArmDefinition {
  arm: Arm;
  /** 决策输入来源：Harness（无额外策略）/ Policy（Frozen Delegation Policy）*/
  decision_input: 'harness' | 'policy';
  /** 经验来源：无 / 冻结快照 / 冻结基线 S0 / 在线演化 */
  experience: 'none' | 'SNAPSHOT_01' | 'S0' | 'evolving_store';
  /** 是否在做完任务后写入 Reflection 产物 */
  reflection: boolean;
  /** 是否属于 Pilot 三臂 */
  pilot: boolean;
  /** 备注（人工表格中的角色） */
  note: string;
}

export const ARM_DEFINITIONS: readonly ArmDefinition[] = [
  {
    arm: 'A',
    decision_input: 'harness',
    experience: 'none',
    reflection: false,
    pilot: true,
    note: 'Baseline：无 Policy、无 Experience（人工表格）',
  },
  {
    arm: 'B',
    decision_input: 'policy',
    experience: 'none',
    reflection: false,
    pilot: true,
    note: 'Policy-only baseline：Frozen Delegation Policy，不读经验（OQ-021）',
  },
  {
    arm: 'C_frozen',
    decision_input: 'policy',
    experience: 'SNAPSHOT_01',
    reflection: false,
    pilot: true,
    note: 'Policy + 冻结 Action Experience（只读 SNAPSHOT_01，禁止写回）',
  },
  {
    arm: 'C_static',
    decision_input: 'policy',
    experience: 'S0',
    reflection: false,
    pilot: false,
    note: 'D 实验对照：不做 Reflection，store 全程冻结在 S0',
  },
  {
    arm: 'D_online',
    decision_input: 'policy',
    experience: 'evolving_store',
    reflection: true,
    pilot: false,
    note: 'D 实验（探索性）：每个任务后 Reflection，store S0 → S1 → …',
  },
];

/** Pilot 三臂（人工裁决：Pilot 目标 = A/B/C_frozen） */
export const PILOT_ARMS: readonly Arm[] = ['A', 'B', 'C_frozen'];

export function armDefinition(arm: Arm): ArmDefinition {
  const found = ARM_DEFINITIONS.find((a) => a.arm === arm);
  if (!found) throw new Error(`未定义的实验臂：${arm}`);
  return found;
}

/** Pilot 期间禁止运行的臂（用于编排前置校验） */
export function assertPilotArm(arm: Arm): void {
  if (!PILOT_ARMS.includes(arm)) {
    throw new Error(`Pilot 只允许 A / B / C_frozen 三臂，收到 arm=${arm}（该臂属于 D 实验）`);
  }
}
