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
 * environment_factor 四档（spec/frozen.md §5.4）：
 *   1.0  harness/tool_schema 完全兼容（同 major，tool_schema 相同）
 *   0.7  minor-compatible（同 major，tool_schema 小改）
 *   0.3  major 不兼容但仍可解析
 *   0.0  不可用（结构性变化，经验无法解析）
 *
 * OQ-003（open）：minor/major 的具体比对规则（哪个字段算 major、tool_schema「小改」
 * 如何从版本号判定）规格未定义，人工尚未裁决。
 * 因此 classifyEnvironment() 只实现「版本完全相同 ⇒ 1.0」这一无歧义情形，
 * 其余情形显式抛错等待裁决，绝不隐式假设映射规则。
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

export function classifyEnvironment(from: VersionInfo, to: VersionInfo): EnvironmentClass {
  const identical =
    from.harness_version === to.harness_version &&
    from.tool_schema_version === to.tool_schema_version &&
    from.framework_version === to.framework_version;

  if (identical) {
    // 完全同版本 ⇒ 同 major 且 tool_schema 相同 ⇒ §5.4 第一档（无需猜测任何边界）
    return 'compatible';
  }
  throw new Error(
    'OQ-003 未裁决：environment_factor 的 semver 映射细节缺失（哪个字段算 major、tool_schema 小改的判定）。' +
      '非同版本环境的分类在人工裁决前不可计算，代码不做隐式假设。',
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
