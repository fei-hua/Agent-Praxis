/**
 * core/experiment-config.ts — experiment_config 与 experiment_config_hash（OQ-009 人工裁决，2026-09-27）
 *
 * experiment_config_hash 标识「一次实验所使用的全部结果相关且应冻结的配置」。
 * 它不是 Run ID，也不是环境版本哈希。
 *   experiment_config_hash = SHA256(canonical_json(experiment_config))，记作 "sha256:<hex>"
 *
 * 与 experience_snapshot_id 的分工（裁决原文要点）：
 *   experiment_config_hash → 「实验规则是什么？」
 *   experience_snapshot_id → 「实验当时用了哪一版经验？」
 *
 * 生成时机（裁决）：SNAPSHOT_01 → BM25 calibration → experiment_config_hash。
 * 正式 run 必记 experiment_config_hash + experience_snapshot_id；
 * 运行时 hash 与当前实验配置不一致 → CONFIG_MISMATCH → 禁止进入正式统计。
 *
 * 运行时字段（run_id/session_id/task_id/时间戳/机器信息/随机种子/token/延迟/
 * 工具结果/轨迹数据/生成的经验记录）一律不进入本 config（构建方保证）。
 *
 * 注：Phase 0 的 bm25_p05/p95 是规格允许的占位常数（§5.5），OQ-013 的标定百分位口径
 * 未裁决；Phase 1 在 SNAPSHOT_01 上正式标定后替换并生成新的 hash（值变化 → 新 hash）。
 */

import { createHash } from 'node:crypto';
import { canonicalJson, type JsonValue } from './canonical-json.ts';
import { COMPLEXITY, CONSTRAINTS_VOCAB, EXPERIENCE_STATUS, FIRST_DECISION, SCOPE } from './enums.ts';
import { FROZEN } from './frozen-constants.ts';
import { SPEC_EXAMPLE_VOCAB } from './vocab.ts';
import { PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';

export interface EnvironmentCompatibility {
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
}

/** OQ-002 过渡期词表版本标记（完整清单由人工在 Acquisition 前定稿后更新版本并换 hash） */
const VOCAB_VERSION_TRANSITIONAL = 'OQ-002-transitional-2026-09-27';
const VOCAB_VERSION_FROZEN = '1.0-frozen';

function sortedCopy(values: readonly string[]): string[] {
  return [...values].sort();
}

export function buildExperimentConfig(env: EnvironmentCompatibility): JsonValue {
  return {
    protocol: {
      schema_version: '1.0',
      experiment_version: 'V1.0',
      decision:
        'Experience → Action Decision → Tool/Subagent Routing（spec/frozen.md §0）；' +
        'first_decision 由代码直读 task_state.first_decision（§2.2），绝不事后由 LLM 从轨迹推断',
      first_decision_enum: sortedCopy(FIRST_DECISION),
      delegation_definition:
        'delegation_action ⇔ first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}（experiment-design §3.1）；' +
        'delegation.mode ∈ serial|parallel|workflow（frozen §3）；E2A 只依据 first_decision 与高层委派计划',
      cda_definition:
        'CDA = 1 若 actual_delegation == expected_delegation（在「是否该委派」意义上 ' +
        'DELEGATE/PARALLEL/WORKFLOW 等价，experiment-design §3.2），否则 0；' +
        'actual_delegation 来自 task_state.first_decision（代码读取）；expected 来自 benchmark task YAML expected_first_decisions；' +
        'CDA_task = 3 次重复均值 ∈ {0, 1/3, 2/3, 1}',
      action_change_definition:
        'Action Change = True 若满足任一：(a) first_decision 不同；(b) delegation agent set 不同；' +
        '(c) delegation execution mode：serial ↔ parallel；(d) verification：absent → present。' +
        '不计为 Action Change：grep ↔ read、同一策略下工具顺序轻微变化、探索深度不同（experiment-design §9.1）',
      beneficial_action_change_definition:
        'Beneficial Action Change = Action Change AND Task Success AND no_forbidden_violation AND cost_ok；' +
        'cost_ok ⇔ tokens_treatment ≤ 1.50 × tokens_baseline + 1000 AND ' +
        'subagent_calls_treatment ≤ subagent_calls_baseline + 1；wall_time 不进硬门（experiment-design §9.3）',
      // OQ-009 裁决 §5：环境版本作为固定 protocol/environment compatibility 字段记录；
      // 值变化 → 生成新的 experiment_config_hash
      environment_compatibility: {
        harness_version: env.harness_version,
        tool_schema_version: env.tool_schema_version,
        framework_version: env.framework_version,
      },
    },
    thresholds: {
      relevance_low_threshold: FROZEN.retrieval_status_bands.low,
      relevance_matched_threshold: FROZEN.retrieval_status_bands.matched,
      relevance_high_threshold: FROZEN.retrieval_status_bands.high,
      top_k: FROZEN.top_k,
      low_relevance_max: FROZEN.low_relevance_max,
      experience_context_token_budget: FROZEN.experience_context_total_budget,
      single_experience_token_limit: FROZEN.experience_token_budget_item,
      lesson_character_limit: FROZEN.lesson_max_chars,
      h2_effect_threshold: 0.10,
      h2_null_equivalence_margin: 0.05,
      power: 0.80,
      planning_alpha: 0.025,
    },
    retrieval: {
      structured_match_weights: {
        task_type: FROZEN.structured_match_weights.task_type,
        complexity: FROZEN.structured_match_weights.complexity,
        characteristics: FROZEN.structured_match_weights.characteristics,
        constraints: FROZEN.structured_match_weights.constraints,
      },
      lexical_match_weight: FROZEN.relevance_weights.lexical,
      bm25_normalization_method:
        'lexical_match = clamp((P95 − raw_bm25) / (P95 − P05), 0, 1)；P95 == P05 时 matched→1.0 / unmatched→0.0；无命中→0（frozen §5.5）',
      bm25_p05: PLACEHOLDER_CALIBRATION.p05,
      bm25_p95: PLACEHOLDER_CALIBRATION.p95,
      candidate_retrieval_policy:
        'deprecated/rejected/conflict 不参与检索（权重 0）；candidate/validated/active/stale 可参与；' +
        '无 status_weight 乘法因子；candidate 低影响力来自 independent_support=1（frozen §4.2）',
      contraindication_factor_definition:
        'contraindication_factor = 1 − matched_count / max(1, total_count)，clamp [0,1]；无禁忌→1.0；' +
        '命中 ⇔ contraindication token ∈ 当前任务 characteristics（OQ-004 裁决 2026-09-27），' +
        '二值相似度经冻结阈值 0.60 判定',
      reliability_score_definition:
        'reliability_score = (1 − exp(−independent_support/2)) × ' +
        '(1 − min(1, conflict_count / max(1, independent_support))) × environment_factor；' +
        '纯确定性代码计算，Reflection 不得填写（frozen §5.4）',
      environment_factor_rules: {
        compatible: FROZEN.environment_factor.compatible,
        minor_compatible: FROZEN.environment_factor.minor_compatible,
        major_parseable: FROZEN.environment_factor.major_parseable,
        unusable: FROZEN.environment_factor.unusable,
        mapping_rules: 'OQ-003-pending（semver 边界比对规则未裁决；同版本→compatible 为唯一已定义情形）',
      },
    },
    vocabulary: {
      task_type_vocabulary_version: VOCAB_VERSION_TRANSITIONAL,
      task_type_vocabulary: sortedCopy(SPEC_EXAMPLE_VOCAB.task_type),
      characteristics_vocabulary_version: VOCAB_VERSION_TRANSITIONAL,
      characteristics_vocabulary: sortedCopy(SPEC_EXAMPLE_VOCAB.characteristics),
      constraints_vocabulary_version: VOCAB_VERSION_FROZEN,
      constraints_vocabulary: sortedCopy(CONSTRAINTS_VOCAB),
      first_decision_vocabulary_version: VOCAB_VERSION_FROZEN,
    },
    experience: {
      experience_statuses: sortedCopy(EXPERIENCE_STATUS),
      candidate_policy:
        'candidate 可参与检索，但 independent_support=1 使其 reliability 上限约 0.393，' +
        '设计上只能提供低置信参考；若 candidate 无法达到高置信，这是预期行为不是 bug（frozen §4.2）',
      validation_rule:
        'candidate→validated ⇔ independent_support ≥ 2 且无冲突；validated→active ⇔ independent_support ≥ 3；' +
        '→stale：超过 N 个任务未被命中或环境版本变化（N 未定，OQ-017）；→deprecated：人工标记/连续反证；' +
        '→conflict：检测到与现有经验直接矛盾；→rejected：Quality Gate 未通过（frozen §4.1）',
      independent_support_definition: '支持该经验的不同 task_id 且不同代码变更数量（frozen §3.1）',
      conflict_rule:
        'exact conflict（OQ-005 裁决 2026-09-27）：适用条件完全一致（scope/task_type/complexity/characteristics/constraints）' +
        '且出现任一：(a) decision.action 不同；(b) decision.mode 在同一 action 下发生互斥变化（如 PARALLEL vs SERIAL）；' +
        '(c) 相同任务类型、相同适用条件、相同决策下，相同 success criteria 的明确相反 outcome（一过一败）。' +
        '仅 lesson 不同、证据数量不同、reliability 不同不构成 conflict',
      dedup_rule:
        'duplicate（OQ-005 裁决 2026-09-27）：scope/task_type/complexity/characteristics/constraints/' +
        'decision.action/decision.mode/delegation.agents/lesson 完全一致，' +
        '且规范化后内容一致（列表排序、大小写、空值已规范化）',
      stale_rule: '超过 N 个任务未被命中，或环境版本变化 → stale（N 未定，OQ-017）',
    },
    experiments: {
      A_arm_definition: 'Baseline 臂：无 Policy（RQ1 比较 B − A）',
      B_arm_definition: 'Policy 臂：应用 policies/ 的 Policy 规则（RQ1 检验其改善基础委派决策）',
      C_frozen_arm_definition:
        'Policy + 冻结 Action Experience：只读 SNAPSHOT_01，禁止 Reflection 写回（RQ2 比较 C_frozen − B）',
      C_static_arm_definition: '不 Reflection，store 全程冻结在 S0（D 实验的对照臂）',
      D_online_arm_definition: '每个任务后 Reflection，store S0 → S1 → S2 → …（探索性，不参与 H1/H2）',
      formal_sample_size_min: 30,
      formal_sample_size_max: 150,
      pilot_tasks: 10,
      pilot_repetitions: 3,
      formal_repetitions: 3,
      transfer_tasks: 15,
    },
    statistical_protocol: {
      primary_metric: 'CDA',
      primary_tests:
        'paired permutation test（任务级配对）：H1 = CDA_B − CDA_A，H2 = CDA_C_frozen − CDA_B；' +
        '成立条件：≥ 10 percentage points 且 Holm-adjusted p < 0.05',
      holm_correction: 'Holm correction（m = 2，仅 H1 与 H2）',
      permutation_test_definition:
        'paired permutation test（任务级配对）；Monte Carlo 仿真必须使用与正式分析完全相同的检验（experiment-design §5.8 ②）',
      h2_null_method: 'TOST',
      h2_null_confidence_level: 0.9,
      h3: 'exploratory',
      d_online: 'exploratory',
    },
  };
}

/** experiment_config_hash = SHA256(canonical_json(experiment_config))，记作 "sha256:<hex>" */
export function experimentConfigHash(config: JsonValue): string {
  const digest = createHash('sha256').update(canonicalJson(config), 'utf8').digest('hex');
  return `sha256:${digest}`;
}

/**
 * 运行时一致性检查（裁决 §6）：
 * 记录的 hash 与当前实验配置不一致 → 'CONFIG_MISMATCH' → 禁止进入正式统计。
 */
export function checkConfigHash(recordedHash: string, currentConfig: JsonValue): 'match' | 'CONFIG_MISMATCH' {
  return recordedHash === experimentConfigHash(currentConfig) ? 'match' : 'CONFIG_MISMATCH';
}

/** complexity / scope 也进入配置可复现性口径（值来自冻结枚举，展示用） */
export const FROZEN_ENUMS_FOR_CONFIG = {
  complexity: COMPLEXITY,
  scope: SCOPE,
} as const;
