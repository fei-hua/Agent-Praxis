/**
 * experience/gate.ts — Experience Quality Gate，Deterministic 层（spec/frozen.md §6.1）
 *
 * Phase 0 只做代码可判的部分（tasks/phase0.md T5）：
 *   schema / enum / provenance / task_id / trajectory ref / outcome
 *   / duplicate / exact conflict / version
 *
 * ❌ Phase 0 不做 Semantic Gate（§6.2，那是 Phase 1）。
 *
 * 判定定义（人工裁决 2026-09-27，OQ-005 / OQ-012）：
 *
 *   duplicate：两条 Experience 在 scope、task_type、complexity、characteristics、constraints、
 *     decision.action、decision.mode、delegation.agents、lesson 上完全一致
 *     （规范化后：列表排序、大小写、空值已规范化）。
 *     字段映射：decision.action ⇔ Experience.decision（FirstDecision），
 *               decision.mode ⇔ Experience.delegation.mode（serial|parallel|workflow）。
 *
 *   exact conflict：适用条件（scope、task_type、complexity、characteristics、constraints）完全一致，
 *     且出现任一：
 *       (a) decision.action 不同；
 *       (b) decision.mode 在同一 action 下发生互斥变化（例如 PARALLEL vs SERIAL）；
 *       (c) 相同任务类型、相同适用条件、相同决策下，相同 success criteria 的明确相反 outcome。
 *     仅 lesson 不同、证据数量不同、reliability 不同，不构成 conflict。
 *
 *   task_id：Experience 不存 task_id。链路 Experience.evidence → run_id → Trajectory record → task_id，
 *     必须存在且可沿证据链解析，否则 Gate 失败。
 *
 *   version：Experience 不存运行环境版本。链路 evidence → run_id → Trajectory metadata，
 *     检查 harness_version / tool_schema_version / framework_version，
 *     三者必须都存在且为合法非空字符串，否则 Gate 失败。
 *     环境兼容性判断统一使用这些版本字段，不从 lesson/scope 等自然语言字段推断。
 *
 * 数据链（裁决原文）：Experience（知识）→ evidence → run_id → trajectory（事实证据）
 *   → task_id / harness_version / tool_schema_version / framework_version。
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { validateExperience, type Experience } from './schema.ts';

export type GateCheckStatus = 'pass' | 'fail' | 'blocked_by_oq';

export interface GateCheckResult {
  check: string;
  status: GateCheckStatus;
  detail: string;
  /** status = blocked_by_oq 时对应的 OQ 编号 */
  oq_id?: string;
  /** exact_conflict_detection 的分规则评估（(c) 需要 success criteria 解析） */
  sub_rules?: Array<{ rule: string; status: 'pass' | 'fail' | 'not_evaluated'; detail: string }>;
  /** 命中的 duplicate / exact conflict 对象 id */
  findings?: Array<{ rule: string; other_id: string; detail: string }>;
}

export interface GateResult {
  /**
   * true  = 全部检查通过；
   * false = 存在 fail；
   * null  = 无 fail 但存在 blocked_by_oq / not_evaluated（判定不完整，不允许当作通过）。
   */
  passed: boolean | null;
  checks: GateCheckResult[];
}

/** evidence → run_id → Trajectory record 可解析出的运行元数据（OQ-012 裁决的数据链） */
export interface RunMetadata {
  task_id: string;
  harness_version: string;
  tool_schema_version: string;
  framework_version: string;
}

export interface GateContext {
  /** trajectory_ref 可解析性的判定根目录（默认 experience-agent-v1 根） */
  trajectoryRoot: string;
  /** evidence.run_id → Trajectory record（run_id/task_id/版本三元组）；不可解析 → Gate 失败 */
  resolveRun?: (runId: string) => RunMetadata | undefined;
  /** 现有经验库（duplicate / exact conflict 比对对象） */
  existing?: Experience[];
}

/**
 * §6.1 Deterministic Gate（代码优先，必须先过）。
 * 每一项检查独立给出 pass / fail / blocked_by_oq。
 */
export function runDeterministicGate(input: unknown, ctx: GateContext): GateResult {
  const checks: GateCheckResult[] = [];

  // 1) schema 完整性 + 2) enum 合法性
  const validated = validateExperience(input);
  if (validated.ok) {
    checks.push({ check: 'schema_completeness', status: 'pass', detail: 'Experience schema 完整' });
    checks.push({ check: 'enum_legality', status: 'pass', detail: '全部 enum/受控词表取值合法' });
  } else {
    const schemaIssues = validated.issues.filter((i) => !isEnumIssue(i.field));
    const enumIssues = validated.issues.filter((i) => isEnumIssue(i.field));
    checks.push({
      check: 'schema_completeness',
      status: schemaIssues.length > 0 ? 'fail' : 'pass',
      detail: schemaIssues.length > 0 ? schemaIssues.map((i) => `${i.field}: ${i.message}`).join('; ') : 'Experience schema 完整',
    });
    checks.push({
      check: 'enum_legality',
      status: enumIssues.length > 0 ? 'fail' : 'pass',
      detail: enumIssues.length > 0 ? enumIssues.map((i) => `${i.field}: ${i.message}`).join('; ') : '全部 enum/受控词表取值合法',
    });
    checks.push({ check: 'provenance_completeness', status: 'fail', detail: 'experience 未通过 schema 校验，provenance 不可信' });
    checks.push({ check: 'task_id_exists', status: 'fail', detail: 'experience 未通过 schema 校验，证据链不可解析' });
    checks.push({ check: 'trajectory_reference_resolvable', status: 'fail', detail: 'experience 未通过 schema 校验' });
    checks.push({ check: 'outcome_record_exists', status: 'fail', detail: 'experience 未通过 schema 校验' });
    checks.push({ check: 'duplicate_detection', status: 'fail', detail: 'experience 未通过 schema 校验，无法比对' });
    checks.push({ check: 'exact_conflict_detection', status: 'fail', detail: 'experience 未通过 schema 校验，无法比对' });
    checks.push({ check: 'version_field_exists', status: 'fail', detail: 'experience 未通过 schema 校验，证据链不可解析' });
    return summarize(checks);
  }

  const exp = validated.value;

  // 3) provenance 完整（run_id / trajectory_ref / outcome）
  const provOk = exp.evidence.run_id !== '' && exp.evidence.trajectory_ref !== '' && hasOutcome(exp);
  checks.push({
    check: 'provenance_completeness',
    status: provOk ? 'pass' : 'fail',
    detail: provOk ? 'run_id / trajectory_ref / outcome 齐全' : 'run_id / trajectory_ref / outcome 至少缺一',
  });

  // 4) task_id 存在（OQ-012 裁决）：evidence → run_id → Trajectory → task_id，必须可解析
  const runMeta = ctx.resolveRun?.(exp.evidence.run_id);
  const taskIdOk = runMeta !== undefined && typeof runMeta.task_id === 'string' && runMeta.task_id.trim() !== '';
  checks.push({
    check: 'task_id_exists',
    status: taskIdOk ? 'pass' : 'fail',
    detail: taskIdOk
      ? `沿证据链解析到 task_id：${runMeta!.task_id}（run_id=${exp.evidence.run_id}）`
      : `无法沿证据链解析 task_id（evidence.run_id=${exp.evidence.run_id}）——OQ-012 裁决：必须存在且可解析，否则 Gate 失败`,
  });

  // 5) trajectory reference 可解析
  const trajPath = path.resolve(ctx.trajectoryRoot, exp.evidence.trajectory_ref);
  const trajOk = existsSync(trajPath);
  checks.push({
    check: 'trajectory_reference_resolvable',
    status: trajOk ? 'pass' : 'fail',
    detail: trajOk ? `可解析：${trajPath}` : `无法解析：${trajPath}`,
  });

  // 6) outcome 记录存在
  checks.push({
    check: 'outcome_record_exists',
    status: hasOutcome(exp) ? 'pass' : 'fail',
    detail: hasOutcome(exp) ? 'outcome 记录存在' : 'outcome 记录缺失',
  });

  // 7) duplicate 检测 + 8) exact conflict 检测
  // OQ-020 裁决（2026-09-27）：判定顺序固定为 Conflict → Duplicate：
  //   (1) 先执行 exact_conflict 检查；(2) 若不存在 conflict，再执行 duplicate 检查。
  //   因此「相同条件 + 相同决策 + 相反 outcome」唯一判为 exact_conflict(c)，
  //   不会再同时命中 duplicate。
  const conflictFindings = findExactConflicts(exp, ctx.existing ?? []);
  const dup = evaluateDuplicate(exp, ctx.existing ?? [], conflictFindings.length > 0);
  checks.push({
    check: 'duplicate_detection',
    status: dup.status,
    detail: dup.detail,
    ...(dup.oq_id ? { oq_id: dup.oq_id } : {}),
    findings: dup.findings,
  });
  checks.push({
    check: 'exact_conflict_detection',
    status: conflictFindings.length > 0 ? 'fail' : 'pass',
    detail:
      conflictFindings.length > 0
        ? `判定为 exact_conflict：${conflictFindings.map((f) => `${f.other_id}(${f.rule})`).join(', ')}`
        : '未发现 exact conflict',
    findings: conflictFindings,
  });

  // 9) version 字段存在（OQ-012 裁决）：Trajectory metadata 三个版本字段必须为合法非空字符串
  const versions = runMeta
    ? [runMeta.harness_version, runMeta.tool_schema_version, runMeta.framework_version]
    : [];
  const versionOk = runMeta !== undefined && versions.every((v) => typeof v === 'string' && v.trim() !== '');
  checks.push({
    check: 'version_field_exists',
    status: versionOk ? 'pass' : 'fail',
    detail: versionOk
      ? `harness_version / tool_schema_version / framework_version 均为合法非空字符串：${versions.join(' / ')}`
      : `Trajectory metadata 的版本字段缺失或非法（run_id=${exp.evidence.run_id}）——OQ-012 裁决：三者必须存在且为合法非空字符串，否则 Gate 失败`,
  });

  return summarize(checks);
}

// ---------- OQ-005 裁决：规范化与比对 ----------

/** 大小写与空值规范化（裁决：列表排序、大小写、空值已规范化） */
function normScalar(v: string | undefined | null): string {
  return (v ?? '').trim().toLowerCase();
}

/** 列表规范化：大小写、空值、排序（不改变元素个数，不去重） */
function normList(v: readonly string[] | undefined | null): string[] {
  return (v ?? []).map(normScalar).filter((s) => s !== '').sort();
}

interface DuplicateKey {
  scope: string;
  task_type: string;
  complexity: string;
  characteristics: string[];
  constraints: string[];
  action: string; // decision.action ⇔ Experience.decision
  mode: string; // decision.mode ⇔ Experience.delegation.mode
  agents: string[];
  lesson: string;
}

function duplicateKey(e: Experience): DuplicateKey {
  return {
    scope: normScalar(e.scope),
    task_type: normScalar(e.task_type),
    complexity: normScalar(e.complexity),
    characteristics: normList(e.characteristics),
    constraints: normList(e.constraints),
    action: normScalar(e.decision),
    mode: normScalar(e.delegation.mode),
    agents: normList(e.delegation.agents),
    lesson: normScalar(e.lesson),
  };
}

/** 适用条件（exact conflict 的「条件完全一致」部分） */
function conditionsKey(e: Experience): Omit<DuplicateKey, 'action' | 'mode' | 'agents' | 'lesson'> {
  return {
    scope: normScalar(e.scope),
    task_type: normScalar(e.task_type),
    complexity: normScalar(e.complexity),
    characteristics: normList(e.characteristics),
    constraints: normList(e.constraints),
  };
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** outcome 的可判定性（OQ-020：缺失或无法确定 ⇒ 不得判定 duplicate，转人工复核） */
function outcomeOf(e: Experience): boolean | undefined {
  const v = (e.outcome as { success?: unknown } | null | undefined)?.success;
  return typeof v === 'boolean' ? v : undefined;
}

export function findDuplicates(
  candidate: Experience,
  existing: Experience[],
): Array<{ rule: string; other_id: string; detail: string }> {
  const key = duplicateKey(candidate);
  return existing
    .filter((o) => sameJson(key, duplicateKey(o)))
    .map((o) => ({
      rule: 'duplicate',
      other_id: o.id,
      detail:
        'scope/task_type/complexity/characteristics/constraints/decision.action/decision.mode/' +
        'delegation.agents/lesson 规范化后完全一致',
    }));
}

/**
 * exact conflict（OQ-005 + OQ-020 裁决）：
 *   (a) 适用条件完全一致，但 decision.action 不同；
 *   (b) 适用条件完全一致 + 同一 action 下 decision.mode 发生互斥变化（如 PARALLEL vs SERIAL）；
 *   (c) 适用条件完全一致 + decision.action / decision.mode 相同，但 outcome 在 success / failure 上明确相反。
 * 仅 lesson 不同、证据数量不同、reliability 不同不构成 conflict。
 *
 * OQ-020 裁决：规则 (c) 不再附加「相同 success criteria」条件——outcome 明确相反即成立；
 * 判定顺序为 Conflict → Duplicate（由 runDeterministicGate 保证）。
 */
export function findExactConflicts(
  candidate: Experience,
  existing: Experience[],
): Array<{ rule: string; other_id: string; detail: string }> {
  const findings: Array<{ rule: string; other_id: string; detail: string }> = [];
  const cond = conditionsKey(candidate);
  const sameCondition = existing.filter((o) => sameJson(cond, conditionsKey(o)));
  const action = normScalar(candidate.decision);
  const mode = normScalar(candidate.delegation.mode);

  // (a) decision.action 不同
  for (const o of sameCondition.filter((o) => normScalar(o.decision) !== action)) {
    findings.push({ rule: 'action_differs', other_id: o.id, detail: `decision.action 不同：${candidate.decision} vs ${o.decision}` });
  }

  // (b) decision.mode 在同一 action 下发生互斥变化（serial|parallel|workflow 互斥，§3 enum）
  for (const o of sameCondition.filter(
    (o) => normScalar(o.decision) === action && normScalar(o.delegation.mode) !== mode,
  )) {
    findings.push({
      rule: 'mode_mutually_exclusive',
      other_id: o.id,
      detail: `decision.mode 在同一 action 下互斥变化：${candidate.delegation.mode} vs ${o.delegation.mode}`,
    });
  }

  // (c) 同条件 + 同决策 + 明确相反 outcome
  const candOutcome = outcomeOf(candidate);
  if (candOutcome !== undefined) {
    for (const o of sameCondition) {
      if (normScalar(o.decision) !== action || normScalar(o.delegation.mode) !== mode) continue;
      const otherOutcome = outcomeOf(o);
      if (otherOutcome === undefined) continue; // 不可确定 ⇒ 不判 (c)
      if (otherOutcome !== candOutcome) {
        findings.push({
          rule: 'outcome_opposite',
          other_id: o.id,
          detail: `相同条件与决策下 outcome 明确相反：${candOutcome ? 'success' : 'failure'} vs ${otherOutcome ? 'success' : 'failure'}`,
        });
      }
    }
  }

  return findings;
}

/**
 * duplicate 判定（OQ-020 裁决：仅在不存在 exact conflict 时执行）。
 *   - 存在 conflict ⇒ 不执行 duplicate 判定（Conflict 优先）；
 *   - outcome 缺失/不可确定（任一侧）⇒ 不得判定 duplicate，转 Quality Gate / manual review；
 *   - 否则 dedup key 完全一致 ⇒ duplicate。
 */
export function evaluateDuplicate(
  candidate: Experience,
  existing: Experience[],
  conflictExists: boolean,
): {
  status: 'pass' | 'fail' | 'blocked_by_oq';
  detail: string;
  findings: Array<{ rule: string; other_id: string; detail: string }>;
  oq_id?: string;
} {
  if (conflictExists) {
    return {
      status: 'pass',
      detail: 'Conflict 优先（OQ-020）：本对象已判为 exact_conflict，不执行 duplicate 判定',
      findings: [],
    };
  }
  const candOutcome = outcomeOf(candidate);
  const keyMatches = findDuplicates(candidate, existing);
  if (candOutcome === undefined) {
    return {
      status: 'blocked_by_oq',
      oq_id: 'OQ-020',
      detail: '候选的 outcome 缺失或不可确定 ⇒ 不得判定 duplicate，转 Quality Gate / manual review',
      findings: [],
    };
  }
  const unresolved = keyMatches.filter((f) => {
    const other = existing.find((o) => o.id === f.other_id);
    return other === undefined || outcomeOf(other) === undefined;
  });
  if (unresolved.length > 0) {
    return {
      status: 'blocked_by_oq',
      oq_id: 'OQ-020',
      detail: `dedup key 命中但对方 outcome 不可确定（${unresolved.map((u) => u.other_id).join(', ')}）⇒ 不得判定 duplicate，转人工复核`,
      findings: [],
    };
  }
  return {
    status: keyMatches.length > 0 ? 'fail' : 'pass',
    detail: keyMatches.length > 0 ? `判定为 duplicate：${keyMatches.map((f) => f.other_id).join(', ')}` : '未发现 duplicate',
    findings: keyMatches,
  };
}


// ---------- util ----------

function summarize(checks: GateCheckResult[]): GateResult {
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasBlocked = checks.some(
    (c) => c.status === 'blocked_by_oq' || c.sub_rules?.some((s) => s.status === 'not_evaluated'),
  );
  return {
    passed: hasFail ? false : hasBlocked ? null : true,
    checks,
  };
}

function hasOutcome(exp: Experience): boolean {
  return typeof exp.outcome === 'object' && exp.outcome !== null;
}

function isEnumIssue(field: string): boolean {
  return [
    'status',
    'scope',
    'task_type',
    'complexity',
    'characteristics',
    'constraints',
    'decision',
    'delegation.mode',
    'contraindications',
  ].includes(field);
}
