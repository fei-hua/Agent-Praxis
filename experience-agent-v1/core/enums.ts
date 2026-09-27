/**
 * core/enums.ts — 冻结枚举（唯一一套，禁止扩充）
 *
 * 来源：spec/frozen.md §2.2（first_decision）、§2.1/§2.3（complexity/scope/constraints）、
 *      §3/§4（experience status、delegation mode）、§5.8（retrieval_status）、§8.1（arm）。
 *
 * 硬约束（spec/frozen.md §12 / tasks/phase0.md「禁止自行发挥」）：
 *   ❌ 不自行定义新的 status / decision enum 值
 * 本文件中的每一个取值都逐字来自规格；任何新增取值都必须先由人工修改规格。
 */

// ---------- first_decision（spec/frozen.md §2.2，唯一一套） ----------
export const FIRST_DECISION = [
  'DIRECT',   // 主 Agent 直接执行任务
  'EXPLORE',  // 主 Agent 先进行项目/信息探索
  'DELEGATE', // 委派一个或多个 Subagent，但不属于并行编排
  'PARALLEL', // 两个或以上独立 Subagent 并行
  'WORKFLOW', // 使用 Harness Workflow 编排多步骤/多 Agent
  'VERIFY',   // 当前任务以验证已有结果为第一行动
  'REPLAN',   // 在已有失败状态下重新规划
] as const;
export type FirstDecision = (typeof FIRST_DECISION)[number];

// ---------- complexity（spec/frozen.md §2.1） ----------
export const COMPLEXITY = ['simple', 'medium', 'high'] as const;
export type Complexity = (typeof COMPLEXITY)[number];

// ---------- scope（spec/frozen.md §2.1） ----------
export const SCOPE = ['project', 'generic'] as const;
export type Scope = (typeof SCOPE)[number];

// ---------- constraints 受控词表（spec/frozen.md §2.3，完整清单已冻结） ----------
export const CONSTRAINTS_VOCAB = [
  'routing_immutable',
  'data_schema_immutable',
  'api_immutable',
  'scope_limited',
  'no_new_dependency',
  'no_public_interface_change',
] as const;
export type ConstraintToken = (typeof CONSTRAINTS_VOCAB)[number];

// ---------- experience status（spec/frozen.md §3 / §4） ----------
export const EXPERIENCE_STATUS = [
  'candidate',
  'validated',
  'active',
  'stale',
  'deprecated',
  'conflict',
  'rejected',
] as const;
export type ExperienceStatus = (typeof EXPERIENCE_STATUS)[number];

// ---------- delegation.mode（spec/frozen.md §3） ----------
export const DELEGATION_MODE = ['serial', 'parallel', 'workflow'] as const;
export type DelegationMode = (typeof DELEGATION_MODE)[number];

// ---------- arm（spec/frozen.md §8.1；dry-run 的 arm 取值见 OQ-008，未裁决前禁止自造） ----------
export const ARM = ['A', 'B', 'C_frozen', 'C_static', 'D_online'] as const;
export type Arm = (typeof ARM)[number];

// ---------- retrieval_status（spec/frozen.md §5.8，只表示相关性） ----------
export const RETRIEVAL_STATUS = [
  'NO_MATCH',
  'LOW_RELEVANCE',
  'MATCHED',
  'HIGH_RELEVANCE',
] as const;
export type RetrievalStatus = (typeof RETRIEVAL_STATUS)[number];

// ---------- Conflict Triage 结果枚举（spec/frozen.md §6.3） ----------
// Phase 0 不做 Conflict Triage（tasks/phase0.md §3）；此处仅登记规格已冻结的取值，
// 供 Phase 1 使用，不在 Phase 0 的任何代码路径中使用。
export const CONFLICT_TRIAGE_RESULT = [
  'MERGE',
  'SPLIT_BY_CONDITION',
  'KEEP_BOTH',
  'DEPRECATE_A',
  'DEPRECATE_B',
  'UNRESOLVED',
] as const;
export type ConflictTriageResult = (typeof CONFLICT_TRIAGE_RESULT)[number];
