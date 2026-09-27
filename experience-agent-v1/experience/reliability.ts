/**
 * experience/reliability.ts — reliability_score（spec/frozen.md §5.4，冻结）
 *
 * 硬约束（tasks/phase0.md 三条硬约束之 3）：
 *   reliability_score 由代码按 §5.4 公式计算，Reflection 不得填写此字段。
 *
 * 结构性保证：Experience 记录（§3）里根本没有 reliability_score 字段，
 * 该值只在检索时由本模块从 independent_support / conflict_count / 环境比对计算，
 * 因此任何 LLM/Reflection 输出都无法填入它。
 *
 * 公式（逐字冻结）：
 *   support_factor  = 1 − exp(−independent_support / 2)
 *   conflict_rate   = min(1, conflict_count / max(1, independent_support))
 *   conflict_factor = 1 − conflict_rate
 *   environment_factor = 1.0 | 0.7 | 0.3 | 0.0   （四档，见下）
 *   reliability_score = support_factor × conflict_factor × environment_factor
 */

import { FROZEN } from '../core/frozen-constants.ts';

// ---------- 输入校验 ----------

function requireNonNegativeInt(name: string, v: number): number {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${name} 必须是非负整数，收到 ${v}`);
  }
  return v;
}

// ---------- 因子 ----------

export function supportFactor(independentSupport: number): number {
  requireNonNegativeInt('independent_support', independentSupport);
  return 1 - Math.exp(-independentSupport / FROZEN.reliability_support_decay);
}

export function conflictRate(independentSupport: number, conflictCount: number): number {
  requireNonNegativeInt('independent_support', independentSupport);
  requireNonNegativeInt('conflict_count', conflictCount);
  return Math.min(1, conflictCount / Math.max(1, independentSupport));
}

export function conflictFactor(independentSupport: number, conflictCount: number): number {
  return 1 - conflictRate(independentSupport, conflictCount);
}

/**
 * environment_factor 四档数值（spec/frozen.md §5.4，冻结）：
 *   1.0 / 0.7 / 0.3 / 0.0
 *
 * 分类规则（OQ-003 + OQ-016 人工裁决 2026-09-27，取代原 semver 映射问题）：
 *   tool_schema_version = 运行时 ToolSchema canonical hash（tschema-<hash>），不是 SemVer，
 *   major/minor/patch 那套规则不再用于它。规则：
 *     (1) Harness version 相同 + ToolSchema hash 相同                      → compatible      (1.0)
 *     (2) Harness version 相同 + ToolSchema hash 不同
 *         + 当前 Experience 明确声明兼容                                    → minor_compatible(0.7)
 *     (3) Harness 发生重大不兼容变化                                        → major_parseable (0.3)
 *     (4) ToolSchema 无法解析 / Experience 不可用                            → unusable        (0.0)
 *
 * 未被裁决覆盖的组合（例如 Harness 小版本不同、Experience 未声明兼容）显式抛错，
 * 不隐式假设取值。「明确声明兼容」「重大不兼容」由调用方以显式判定输入提供
 * （Experience schema 无兼容声明字段，声明属带外判定）。
 */
export type EnvironmentClass = 'compatible' | 'minor_compatible' | 'major_parseable' | 'unusable';

export function environmentFactor(cls: EnvironmentClass): number {
  return FROZEN.environment_factor[cls];
}

export interface VersionInfo {
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
}

export interface EnvironmentClassificationJudgment {
  /** 规则 (2)：当前 Experience 明确声明兼容（带外判定，Experience schema 无该字段） */
  experienceDeclaresCompatibility?: boolean;
  /** 规则 (3)：Harness 发生重大不兼容变化（带外判定） */
  harnessMajorIncompatible?: boolean;
  /** 规则 (4)：ToolSchema 无法解析 / Experience 不可用 */
  toolSchemaUnparseableOrExperienceUnusable?: boolean;
}

export function classifyEnvironment(
  from: VersionInfo,
  to: VersionInfo,
  judgment: EnvironmentClassificationJudgment = {},
): EnvironmentClass {
  // 规则 (1)
  if (from.harness_version === to.harness_version && from.tool_schema_version === to.tool_schema_version) {
    return 'compatible';
  }
  // 规则 (4) 优先于 (3)：不可用就是不可用
  if (judgment.toolSchemaUnparseableOrExperienceUnusable) {
    return 'unusable';
  }
  // 规则 (2)
  if (from.harness_version === to.harness_version && from.tool_schema_version !== to.tool_schema_version) {
    if (judgment.experienceDeclaresCompatibility) {
      return 'minor_compatible';
    }
    throw new Error(
      'OQ-003 裁决未覆盖：Harness version 相同、ToolSchema hash 不同，但 Experience 未声明兼容——' +
        '规则 (2) 要求「明确声明兼容」才给 0.7，其余取值裁决未定义；不做假设。',
    );
  }
  // 规则 (3)
  if (judgment.harnessMajorIncompatible) {
    return 'major_parseable';
  }
  throw new Error(
    'OQ-003 裁决未覆盖：Harness version 不同且未提供「重大不兼容」判定——规则 (3) 需要显式判定；不做假设。',
  );
}

// ---------- 汇总 ----------

export interface ReliabilityInput {
  independent_support: number;
  conflict_count: number;
  environment: EnvironmentClass;
}

/** §5.4：reliability_score = support_factor × conflict_factor × environment_factor */
export function reliabilityScore(input: ReliabilityInput): number {
  return (
    supportFactor(input.independent_support) *
    conflictFactor(input.independent_support, input.conflict_count) *
    environmentFactor(input.environment)
  );
}
