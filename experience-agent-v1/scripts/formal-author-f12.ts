/**
 * scripts/formal-author-f12.ts — F12 族起草（10 个变体：A/B/C/D/E 各 2；**最后一个族**）
 *
 * 领域（与 F01–F11 各族的领域均不同）：**状态迁移编排（deploy / upgrade / rollback / recovery）**
 *   前置条件（S1）→ 阶段序 prepare/stage/verify/activate（S2）→ 健康门禁 → 失败回滚（S3/S5）
 *   → 明确终态（S5）→ canonical 状态/历史/报告（S10 + F-1..F-9），一律**逐字节**比较。
 *   边界：F04 = event → state（单状态机转移合法性）；F10 = data → migrated data；F12 = 部署单元 → 目标 revision 生效/回退。
 * 纪律：只产出 draft；三层证据；C/E 类真实预跑 exit=1；D1 反事实（仅改调度）+ 独立参考编排逐字节一致；
 *      D2 断言 stage 间真实 artifact 传递（路径连续 + sha256）；prompt 不含 first-decision 提示。
 * 用法：node scripts/formal-author-f12.ts
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { writeJsonUtf8 } from './lib/json-io.ts';

function runFixRunStrict(cwd: string, script: string) {
  const _tl = path.join(cwd, 'timeline.jsonl');
  if (existsSync(_tl)) rmSync(_tl);
  const _out = path.join(cwd, 'out');
  if (existsSync(_out)) rmSync(_out, { recursive: true, force: true });
  const oT = path.join(cwd, '.fixrun.out');
  const eT = path.join(cwd, '.fixrun.err');
  const of = openSync(oT, 'w');
  const ef = openSync(eT, 'w');
  let kind = 'SPAWN_ERROR';
  let exitCode: number | undefined;
  let signal: string | undefined;
  let spawnError: { code: string | null; message: string } | undefined;
  try {
    execFileSync(process.execPath, [script], { cwd, stdio: ['ignore', of, ef], timeout: 300_000 });
    kind = 'EXIT';
    exitCode = 0;
  } catch (e) {
    const err = e as { status?: number | null; signal?: string | null; code?: string; message?: string };
    if (typeof err.status === 'number') { kind = 'EXIT'; exitCode = err.status; }
    else if (err.signal) { kind = 'SIGNAL'; signal = String(err.signal); }
    else { kind = 'SPAWN_ERROR'; spawnError = { code: err.code ?? null, message: String(err.message ?? '') }; }
  } finally {
    closeSync(of);
    closeSync(ef);
  }
  const stdout = existsSync(oT) ? readFileSync(oT, 'utf8') : '';
  const stderr = existsSync(eT) ? readFileSync(eT, 'utf8') : '';
  const tl = path.join(cwd, 'timeline.jsonl');
  const entries = existsSync(tl)
    ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { start: number; end: number })
    : [];
  const span = entries.length ? Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start)) : null;
  console.log('      fixRun ' + kind + (exitCode !== undefined ? ' exitCode=' + exitCode : '') + (signal ? ' signal=' + signal : '') + (spawnError ? ' spawn_error.code=' + spawnError.code + ' message=' + spawnError.message : '') + '  timeline entries=' + entries.length + '  span=' + span);
  if (stdout.trim()) console.log('      fixRun stdout: ' + JSON.stringify(stdout.trim().slice(0, 200)));
  if (stderr.trim()) console.log('      fixRun stderr: ' + JSON.stringify(stderr.trim().slice(0, 300)));
  return { kind, exitCode, signal, spawnError, stdout, stderr };
}

/** 以文件重定向捕获子进程输出（避免管道；与 runFixRunStrict 同机制） */
function runScriptCapture(cwd: string, script: string, timeout = 300_000): { code: number | null; stdout: string; stderr: string } {
  const oT = path.join(cwd, '.cap.out');
  const eT = path.join(cwd, '.cap.err');
  const of = openSync(oT, 'w');
  const ef = openSync(eT, 'w');
  let code: number | null = null;
  try {
    execFileSync(process.execPath, [script], { cwd, stdio: ['ignore', of, ef], timeout });
    code = 0;
  } catch (e) {
    const st = (e as { status?: number | null }).status;
    code = typeof st === 'number' ? st : null;
  } finally {
    closeSync(of);
    closeSync(ef);
  }
  const stdout = readFileSync(oT, 'utf8');
  const stderr = readFileSync(eT, 'utf8');
  rmSync(oT, { force: true });
  rmSync(eT, { force: true });
  return { code, stdout, stderr };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f12.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f12-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f12-gt-drafts.json');
const VERSION = path.join(ROOT, 'benchmark', 'formal', 'f12-version.json');

interface Variant {
  id: string; category: string; variant: number; token: string; title: string;
  taskType: string; complexity: string; scope: string; characteristics: string[]; constraints: string[];
  prompt: string; files: Record<string, string>; fix: Record<string, string>; fixRun?: string;
  required: string[]; forbidden: string[]; protectedExtra?: string[];
  extraChecks?: Array<Record<string, unknown>>;
  expected: string[]; expectedDelegation: boolean; rationaleGt: string; rationaleNot: string;
  preRun?: { command: string; log: string; scratch?: boolean; serialFirst?: boolean };
  derive?: string[]; derived?: string[]; deriveCopy?: Array<[string, string]>;
  counterfactual?: string; budget?: number;
}
const V = (v: Variant): Variant => v;

/** 受保护清单：交付物（state/history/artifacts）由实现按契约收敛，不属于"冻结输入"⇒ 一律从清单剔除 */
const PROTECTED = (v: Variant): string[] => (v.protectedExtra ?? []).filter((p) => !/^(state\.json|history\.jsonl|artifacts\/)/.test(p));

const J = (o: unknown): string => JSON.stringify(o, null, 2) + '\n';
const JSONL = (records: unknown[]): string => records.map((r) => JSON.stringify(r)).join('\n') + '\n';
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

// ---------- S1–S10 + F-1..F-9 契约文本（逐变体显式声明；checker 逐条引用） ----------
const CONTRACT_MD = (extra: string[] = []): string =>
  [
    '# 状态迁移编排契约（S1–S10 + F-1..F-9；本任务的唯一判定依据）',
    '',
    '> 领域边界：本契约只研究「部署单元 → 目标版本生效 / 回退」，不研究单状态机的转移合法性（F04）、',
    '> 不研究 schema/数据迁移本身（F10）、不研究查询语义（F11）。所有比较一律 **逐字节**。',
    '',
    '- **S1 前置条件**（全部成立才可进入部署；任一违反 ⇒ `decision="rejected"`）：',
    '  (a) `from_version` 必须与 state.json 的当前版本**一致**；(b) 组件没有未收敛记录（in-flight）；',
    '  (c) `target_version` 属于 `{v1,v2,v3}`；(d) `target_version` 与当前版本**相邻**（S2）。',
    '  多项同时违反 ⇒ `reason` 取 **F-3 总序**中最靠前的一项；拒绝时 `state.json` / `history.jsonl` /',
    '  `artifacts/<c>.json` / `blobs/` **逐字节不变**，**不进入部署阶段、不产生任何 rollback**；',
    '  `report.json` 是本次尝试的产出，必须写出拒绝结论（F-8）。',
    '- **S2 合法状态集合与阶段序**：版本 ∈ `{v1,v2,v3}`；**deploy 迁移只允许相邻**（`v1→v3` 必须被拒）；',
    '  阶段序固定为 `prepare → stage → verify → activate → health → converge`，不得调换；',
    '  前四阶段按**拓扑序**逐组件执行，`health` 门禁在全部 `activate` 之后按组件名序数升序探测。',
    '- **S3 rollback target**：目标 = 该组件 **LKG** = **本次尝试之前** history 中该组件最近一条 `status="success"`',
    '  记录的 `from_version`（F-7）；不得猜测（如无条件回退 v1）；不存在此类记录 ⇒ `reason="no_lkg"` 拒绝。',
    '- **S4 partial deployment**：出现下述任一即为 partially-deployed：(a) 目标集合中部分组件已到目标版本、部分仍为旧版本；',
    '  (b) `expected_artifact_sha256`（plan 声明）≠ 实际 `blobs/<c>-<v>.bin` 的 sha256。partially-deployed **不得作为最终状态**。',
    '- **S5 rollback 范围 / 顺序 / 允许终态**：范围 = 本次尝试中**确实发生版本变化**的组件（未变化的组件不得产生 rollback 记录）；',
    '  顺序 = 部署拓扑序的**逆序**；允许终态只有两种：(a) 全部受影响组件回到各自 LKG ⇒ `status="rolled_back"`；',
    '  (b) 任一回滚步失败 ⇒ `status="halted"`，**必须停止后续回滚步**、不得报告 success/rolled_back、不得静默吞掉失败。',
    '- **S6 依赖方向**：`requires[C] = [X]` 表示 X 必须先于 C 完成部署；部署序 = 该有向图的**拓扑序**',
    '  （同层按组件名**序数升序**）；存在环 ⇒ `reason="dependency_cycle"` 拒绝。',
    '- **S7 state drift**：declared = state.json 的版本；actual = `artifacts/<c>.json` 的 `version` + `fingerprint`；',
    '  `drift = declared ≠ actual`（逐组件比较，按组件名序数排序）。检测到 drift 必须**报告并重新部署**',
    '  （以 actual 为有效当前版本推进到目标版本），**不得仅改写 state.json 使其"看起来一致"**。',
    '- **S8 deploy failure 与业务结果的区分**：deploy failure 仅指 (a) 前置条件被拒、(b) 阶段返回非零/抛错、',
    '  (c) 校验不一致（S4b）。`business_outcome`（业务侧正常返回）**不改变状态、不触发 rollback、不写 history**，',
    '  阶段流程继续；不得被重新解释为 deploy_failure。',
    '- **S9 重复部署（幂等）**：目标版本 == 当前版本 ⇒ 记 `status="skipped"`（`from_version == to_version == 当前版本`），',
    '  该组件状态逐字节不变，不得产生新的版本迁移。',
    '- **S10 canonical 记录形式**（F-4）：`state.json` = `{"components":{<name>:{"version":..,"status":..}}}`，',
    '  组件名按键**序数升序**，组件 `status ∈ ["active","pending"]`（终态产物中不得出现 `pending`）；',
    '  `history.jsonl` 每行一条、`seq` 从 1 递增、字段顺序固定 `(seq, component, from_version, to_version, status, stage)`，',
    '  `status ∈ ["success","skipped","failed"]`、`stage ∈ ["deploy","rollback"]`；一律 UTF-8 + 结尾 LF，**逐字节**比较。',
    '',
    '## 本族新增冻结项（人工授权起草方按最小惊讶原则冻结）',
    '',
    '- **F-1 终态与决定闭集**：`status ∈ ["deployed","rolled_back","halted","rejected"]`（小写精确）；',
    '  `decision ∈ ["proceed","rejected"]`；`reason` 为 F-3 闭集值或 `null`。',
    '- **F-2 report.json canonical 字段顺序**：`(plan_id, decision, reason, status, drift[], affected_components[], rollback_count, final_state{})`；',
    '  `drift` 每项固定 `(component, declared, actual)` 且按组件名序数升序；`affected_components` 与 `final_state` 的组件名同规则排序；',
    '  `rollback_count` = 本次尝试**实际执行的回滚步数**（含失败步）；UTF-8 + 结尾 LF，逐字节比较。',
    '- **F-3 reason 闭集全序（6 项，多项违反时取最靠前一项）**：',
    '  `["version_mismatch","in_flight","target_not_declared","target_not_adjacent","dependency_cycle","no_lkg"]`。',
    '- **F-4**：见 S10（state/history 的字段序与闭集）。',
    '- **F-5 回滚不受相邻性约束**：S2 的相邻性只约束 **deploy** 迁移；回滚是**恢复到 LKG**，允许跨版本。',
    '- **F-6**：C 类与 E 类都必须在任务目录内留下**真实预跑日志**（未修复态 exit≠0）。',
    '- **F-7 LKG 基准**：LKG 一律基于**本次尝试之前**的 history 计算（本次尝试的记录不参与 LKG 判定）。',
    '- **F-8 拒绝时的"任何 artifact 不变"范围**：指 `state.json` / `history.jsonl` / `artifacts/<c>.json` / `blobs/`；`report.json` 例外（必须写出拒绝结论）。',
    '- **F-9 drift 的处置**：检测到 drift 时以 `actual`（artifacts 的 version）作为有效当前版本重新执行部署阶段推进到目标版本，',
    '  并在 `report.drift` 中如实列出；改完后的 `artifacts/<c>.json` 与 `state.json` 必须一致（S7 重新收敛）。',
    ...(extra.length ? ['', ...extra] : []),
    '',
  ].join('\n');

// ---------- 任务侧 canonical 序列化（S10 / F-2 / F-4） ----------
const CANON_JS = `// canonical 序列化（S10/F-2/F-4）：固定字段顺序 + 序数排序 + UTF-8 + 结尾 LF
const fs = require('fs');
const crypto = require('crypto');
function ordinal(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
function serializeState(components) {
  const names = Object.keys(components).slice().sort(ordinal);
  const out = {};
  for (const n of names) out[n] = { version: components[n].version, status: components[n].status };
  return JSON.stringify({ components: out }) + '\\n';
}
function serializeHistory(records) {
  const lines = records.map((r) => JSON.stringify({
    seq: r.seq,
    component: r.component,
    from_version: r.from_version,
    to_version: r.to_version,
    status: r.status,
    stage: r.stage,
  }));
  return lines.join('\\n') + (lines.length ? '\\n' : '');
}
function serializeReport(report) {
  const drift = (report.drift || []).slice().sort((a, b) => ordinal(a.component, b.component)).map((d) => ({
    component: d.component,
    declared: d.declared,
    actual: d.actual,
  }));
  const affected = (report.affected_components || []).slice().sort(ordinal);
  const fs2 = {};
  for (const n of Object.keys(report.final_state || {}).slice().sort(ordinal)) fs2[n] = report.final_state[n];
  return JSON.stringify({
    plan_id: report.plan_id,
    decision: report.decision,
    reason: report.reason === undefined ? null : report.reason,
    status: report.status,
    drift,
    affected_components: affected,
    rollback_count: report.rollback_count,
    final_state: fs2,
  }) + '\\n';
}
function serializeArtifact(version, fingerprint) {
  return JSON.stringify({ version, fingerprint }) + '\\n';
}
module.exports = { ordinal, sha256File, serializeState, serializeHistory, serializeReport, serializeArtifact };
`;

// ---------- 冻结原语（受保护；被测实现的共享底座） ----------
const LIB_DEPLOY_JS = `// 冻结的部署原语（受保护，冻结语义）：相邻性 / 拓扑序 / LKG / reason 全序 / 输入读取
const fs = require('fs');
const path = require('path');
const { sha256File, ordinal } = require('../canonical.js');
const VERSIONS = ['v1', 'v2', 'v3'];
const REASON_ORDER = ['version_mismatch', 'in_flight', 'target_not_declared', 'target_not_adjacent', 'dependency_cycle', 'no_lkg'];
function adjacent(a, b) { return Math.abs(VERSIONS.indexOf(a) - VERSIONS.indexOf(b)) === 1; }
function topoOrder(components, requires) {
  const remaining = components.slice().sort(ordinal);
  const done = [];
  while (remaining.length > 0) {
    const next = remaining.filter((c) => (requires[c] || []).every((d) => done.indexOf(d) >= 0))[0];
    if (next === undefined) return null;
    done.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return done;
}
function lkgOf(history, component) {
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (r.component === component && r.status === 'success') return r.from_version;
  }
  return null;
}
function firstReason(reasons) {
  for (const r of REASON_ORDER) if (reasons.indexOf(r) >= 0) return r;
  return null;
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function readJsonl(p) {
  const t = fs.readFileSync(p, 'utf8').trim();
  return t === '' ? [] : t.split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}
module.exports = { VERSIONS, REASON_ORDER, adjacent, topoOrder, lkgOf, firstReason, readJson, readJsonl, sha256File, ordinal };
`;

// ---------- 冻结的运行时结果（fixture 数据；不属于被测实现） ----------
interface RuntimeSpec {
  deployFailures?: Array<{ component: string; stage: string; kind: string; code?: string | number }>;
  health?: Record<string, string>;
  rollbackFailures?: string[];
}
const RUNTIME_JS = (spec: RuntimeSpec): string => `// 冻结的运行时结果（fixture 数据，不属于被测实现）
// kind: deploy_failure（S8b：真实失败）| business_outcome（S8：业务侧正常返回，不得触发 rollback）| ok
const DEPLOY_FAILURES = ${JSON.stringify(spec.deployFailures ?? [])};
const HEALTH = ${JSON.stringify(spec.health ?? {})};
const ROLLBACK_FAILURES = ${JSON.stringify(spec.rollbackFailures ?? [])};
function stageOutcome(component, stage) {
  for (const f of DEPLOY_FAILURES) {
    if (f.component === component && f.stage === stage) return { kind: f.kind, code: (f.code === undefined ? null : f.code) };
  }
  return { kind: 'ok', code: null };
}
function healthOutcome(component) { return Object.prototype.hasOwnProperty.call(HEALTH, component) ? HEALTH[component] : 'healthy'; }
function rollbackOutcome(component) { return ROLLBACK_FAILURES.indexOf(component) >= 0 ? 'failed' : 'ok'; }
module.exports = { stageOutcome, healthOutcome, rollbackOutcome };
`;

// ---------- checker 内嵌的**独立参考编排**（不引用被测实现与原语库） ----------
const REF_ORCH_JS = `// —— 独立参考编排（checker 内嵌；不引用被测实现，也不引用 lib/deploy-lib.js）——
const refFs = require('fs');
const refPath = require('path');
const refCrypto = require('crypto');
const REF_VERSIONS = ['v1', 'v2', 'v3'];
const REF_REASONS = ['version_mismatch', 'in_flight', 'target_not_declared', 'target_not_adjacent', 'dependency_cycle', 'no_lkg'];
function refOrd(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function refShaFile(p) { return refCrypto.createHash('sha256').update(refFs.readFileSync(p)).digest('hex'); }
function refAdjacent(a, b) { return Math.abs(REF_VERSIONS.indexOf(a) - REF_VERSIONS.indexOf(b)) === 1; }
function refTopo(components, requires) {
  const todo = components.slice().sort(refOrd);
  const done = [];
  while (todo.length > 0) {
    const pick = todo.filter((c) => (requires[c] || []).every((d) => done.indexOf(d) >= 0))[0];
    if (pick === undefined) return null;
    done.push(pick);
    todo.splice(todo.indexOf(pick), 1);
  }
  return done;
}
function refLkg(preHistory, component) {
  const mine = preHistory.filter((r) => r.component === component && r.status === 'success');
  return mine.length === 0 ? null : mine[mine.length - 1].from_version;
}
function refFirstReason(reasons) {
  const hit = REF_REASONS.filter((r) => reasons.indexOf(r) >= 0);
  return hit.length === 0 ? null : hit[0];
}
function refStateText(components) {
  const names = Object.keys(components).slice().sort(refOrd);
  const out = {};
  for (const n of names) out[n] = { version: components[n].version, status: components[n].status };
  return JSON.stringify({ components: out }) + '\\n';
}
function refHistoryText(records) {
  const lines = records.map((r) => JSON.stringify({
    seq: r.seq, component: r.component, from_version: r.from_version,
    to_version: r.to_version, status: r.status, stage: r.stage,
  }));
  return lines.join('\\n') + (lines.length ? '\\n' : '');
}
function refReportText(report) {
  const drift = (report.drift || []).slice().sort((a, b) => refOrd(a.component, b.component)).map((d) => ({ component: d.component, declared: d.declared, actual: d.actual }));
  const fs2 = {};
  for (const n of Object.keys(report.final_state || {}).slice().sort(refOrd)) fs2[n] = report.final_state[n];
  return JSON.stringify({
    plan_id: report.plan_id,
    decision: report.decision,
    reason: report.reason === undefined ? null : report.reason,
    status: report.status,
    drift,
    affected_components: (report.affected_components || []).slice().sort(refOrd),
    rollback_count: report.rollback_count,
    final_state: fs2,
  }) + '\\n';
}
function refArtifactText(version, fingerprint) { return JSON.stringify({ version, fingerprint }) + '\\n'; }
function refStateMap(current) {
  const out = {};
  for (const c of Object.keys(current)) out[c] = { version: current[c], status: 'active' };
  return out;
}
function refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }
function refReadJsonl(p) {
  const t = refFs.readFileSync(p, 'utf8').trim();
  return t === '' ? [] : t.split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}
/** 独立参考编排：返回期望的 canonical 文本与终态摘要
 *  输入一律读**冻结快照** snapshots/inputs/（checker 必须纯读取，而实现已改写工作区）；blobs/ 不被改写，就地读取。
 */
function refRun(dir, runtime) {
  const snap = refPath.join(dir, 'snapshots', 'inputs');
  const plan = JSON.parse(refFs.readFileSync(refPath.join(snap, 'plan.json'), 'utf8'));
  const state0 = JSON.parse(refFs.readFileSync(refPath.join(snap, 'state.json'), 'utf8'));
  const preHistory = refReadJsonl(refPath.join(snap, 'history.jsonl'));
  const components = plan.components.slice().sort(refOrd);
  const declared = {};
  const actual = {};
  for (const c of components) {
    declared[c] = state0.components[c].version;
    actual[c] = JSON.parse(refFs.readFileSync(refPath.join(snap, 'artifacts', c + '.json'), 'utf8')).version;
  }
  const drift = components.filter((c) => declared[c] !== actual[c]).map((c) => ({ component: c, declared: declared[c], actual: actual[c] }));
  const current = {};
  for (const c of components) current[c] = actual[c];
  const order = refTopo(components, plan.requires);
  const reasons = [];
  if (order === null) reasons.push('dependency_cycle');
  for (const c of components) {
    if (plan.from_version[c] !== current[c]) reasons.push('version_mismatch');
    const t = plan.target_version[c];
    if (t === undefined || REF_VERSIONS.indexOf(t) < 0) reasons.push('target_not_declared');
    else if (t !== current[c] && !refAdjacent(current[c], t)) reasons.push('target_not_adjacent');
    const mine = preHistory.filter((r) => r.component === c);
    const last = mine.length === 0 ? null : mine[mine.length - 1];
    if (last && ['success', 'skipped', 'failed'].indexOf(last.status) < 0) reasons.push('in_flight');
  }
  const reason = refFirstReason(reasons);
  if (reason !== null) {
    const finalState = {};
    for (const c of components) finalState[c] = current[c];
    return {
      rejected: true,
      report: { plan_id: plan.plan_id, decision: 'rejected', reason, status: 'rejected', drift, affected_components: [], rollback_count: 0, final_state: finalState },
      state: refStateMap(current),
      history: [],
      artifacts: [],
    };
  }
  const records = [];
  const applied = {};
  let seq = preHistory.length;
  const add = (component, from, to, status, stage) => { records.push({ seq: ++seq, component, from_version: from, to_version: to, status, stage }); };
  const artifactWrites = [];
  const writeArtifact = (c, v) => artifactWrites.push({ component: c, version: v, fingerprint: refShaFile(refPath.join(dir, 'blobs', c + '-' + v + '.bin')) });
  const stop = (status, affected, rollbackCount) => {
    const finalState = {};
    for (const c of components) finalState[c] = current[c];
    return {
      rejected: false,
      report: { plan_id: plan.plan_id, decision: 'proceed', reason: null, status, drift, affected_components: affected, rollback_count: rollbackCount, final_state: finalState },
      state: refStateMap(current),
      history: records,
      artifacts: artifactWrites,
    };
  };
  const rollback = () => {
    const affected = Object.keys(applied).sort(refOrd);
    const rbOrder = order.filter((c) => affected.indexOf(c) >= 0).slice().reverse();
    let count = 0;
    for (const c of rbOrder) {
      const target = refLkg(preHistory, c);
      count++;
      if (target === null) { add(c, applied[c], applied[c], 'failed', 'rollback'); return stop('halted', affected, count); }
      if (runtime.rollbackOutcome(c) !== 'ok') {
        add(c, applied[c], target, 'failed', 'rollback');
        return stop('halted', affected, count);
      }
      add(c, applied[c], target, 'success', 'rollback');
      current[c] = target;
      writeArtifact(c, target);
    }
    return stop('rolled_back', affected, count);
  };
  for (const phase of ['prepare', 'stage', 'verify', 'activate']) {
    for (const c of order) {
      const outcome = runtime.stageOutcome(c, phase);
      if (outcome.kind === 'business_outcome') continue;
      if (outcome.kind === 'deploy_failure') {
        add(c, current[c], plan.target_version[c], 'failed', 'deploy');
        return rollback();
      }
      if (phase === 'verify') {
        const exp = (plan.expected_artifact_sha256[c] || {})[plan.target_version[c]];
        const act = refShaFile(refPath.join(dir, 'blobs', c + '-' + plan.target_version[c] + '.bin'));
        if (exp !== undefined && exp !== act) {
          add(c, current[c], plan.target_version[c], 'failed', 'deploy');
          return rollback();
        }
      }
      if (phase !== 'activate') continue;
      if (plan.target_version[c] === current[c]) {
        add(c, current[c], current[c], 'skipped', 'deploy');
      } else {
        applied[c] = plan.target_version[c];
        current[c] = plan.target_version[c];
        add(c, plan.from_version[c], plan.target_version[c], 'success', 'deploy');
        writeArtifact(c, plan.target_version[c]);
      }
    }
  }
  for (const c of order) {
    if (runtime.healthOutcome(c) === 'unhealthy') return rollback();
  }
  return stop('deployed', Object.keys(applied).sort(refOrd), 0);
}
`;

// ---------- 被测实现 deploy.js（按变体注入缺陷；受测面 = 本文件） ----------
interface DeployMode {
  omitToVersion?: boolean;
  mutateBeforeCheck?: boolean;
  orderByName?: boolean;
  rollbackToV1?: boolean;
  ignoreDeployFailure?: boolean;
  swallowRollbackFailure?: boolean;
  requirePrefix?: string;
}
const DEPLOY_JS = (m: DeployMode = {}): string => `// 部署编排实现（S1–S10 + F-1..F-9）：前置检查 → 阶段执行 → 健康门禁 → 回滚 → 收敛
const fs = require('fs');
const path = require('path');
const lib = require('${m.requirePrefix ?? './'}lib/deploy-lib.js');
const runtime = require('${m.requirePrefix ?? './'}lib/runtime.js');
const canon = require('${m.requirePrefix ?? './'}canonical.js');

function run(dir) {
  const plan = lib.readJson(path.join(dir, 'plan.json'));
  const state = lib.readJson(path.join(dir, 'state.json'));
  const preHistory = lib.readJsonl(path.join(dir, 'history.jsonl'));
  const components = plan.components.slice().sort(lib.ordinal);
  const current = {};
  const declaredVersion = {};
  for (const c of components) {
    declaredVersion[c] = state.components[c].version;
    current[c] = lib.readJson(path.join(dir, 'artifacts', c + '.json')).version;   // S7：actual 为有效当前版本
  }
  const drift = components.filter((c) => declaredVersion[c] !== current[c]).map((c) => ({ component: c, declared: declaredVersion[c], actual: current[c] }));
  const order = ${m.orderByName ? 'components.slice().sort(lib.ordinal)' : 'lib.topoOrder(components, plan.requires)'};   // S6：拓扑序（同层序数升序）${m.orderByName ? ' ← 缺陷：按组件名序数排序，忽略依赖方向' : ''}
  const reasons = [];
  if (order === null) reasons.push('dependency_cycle');
  for (const c of components) {
    if (plan.from_version[c] !== current[c]) reasons.push('version_mismatch');
    const t = plan.target_version[c];
    if (t === undefined || lib.VERSIONS.indexOf(t) < 0) reasons.push('target_not_declared');
    else if (t !== current[c] && !lib.adjacent(current[c], t)) reasons.push('target_not_adjacent');
    const mine = preHistory.filter((r) => r.component === c);
    const last = mine.length === 0 ? null : mine[mine.length - 1];
    if (last && ['success', 'skipped', 'failed'].indexOf(last.status) < 0) reasons.push('in_flight');
  }
  const reason = lib.firstReason(reasons);
  if (reason !== null) {
${m.mutateBeforeCheck ? `    state.components[components[0]].version = plan.target_version[components[0]];
    state.components[components[0]].status = 'pending';
    fs.writeFileSync(path.join(dir, 'state.json'), canon.serializeState(state.components), 'utf8');   // 缺陷：先改 state 再判定前置条件
` : ''}    writeReport(dir, { plan_id: plan.plan_id, decision: 'rejected', reason, status: 'rejected', drift, affected_components: [], rollback_count: 0, final_state: current });
    return { status: 'rejected', reason };
  }
  const records = [];
  const applied = {};
  let seq = preHistory.length;
  const add = (component, from, to, status, stage) => {
    const r = { seq: ++seq, component, from_version: from, status, stage };
    ${m.omitToVersion ? '// 缺陷：漏写 to_version 字段' : 'r.to_version = to;'}
    records.push(r);
  };
  const writeArtifact = (c, v) => {
    fs.writeFileSync(path.join(dir, 'artifacts', c + '.json'), canon.serializeArtifact(v, lib.sha256File(path.join(dir, 'blobs', c + '-' + v + '.bin'))), 'utf8');
  };
  const converge = (status, rollbackCount, affected) => {
    for (const c of components) if (state.components[c].status === 'pending') state.components[c].status = 'active';
    for (const c of components) state.components[c].version = current[c];
    fs.writeFileSync(path.join(dir, 'state.json'), canon.serializeState(state.components), 'utf8');
    fs.writeFileSync(path.join(dir, 'history.jsonl'), canon.serializeHistory(preHistory.concat(records)), 'utf8');
    writeReport(dir, { plan_id: plan.plan_id, decision: 'proceed', reason: null, status, drift, affected_components: affected, rollback_count: rollbackCount, final_state: current });
    return { status };
  };
  const rollback = () => {
    const affected = Object.keys(applied).sort(lib.ordinal);
    const rbOrder = order.filter((c) => affected.indexOf(c) >= 0).slice().reverse();   // S5：逆拓扑序
    let count = 0;
    for (const c of rbOrder) {
      const target = ${m.rollbackToV1 ? "'v1'" : 'lib.lkgOf(preHistory, c)'};   // S3/F-7${m.rollbackToV1 ? ' ← 缺陷：无条件回退 v1（猜测而非 LKG）' : ''}
      count++;
      if (target === null) { add(c, applied[c], applied[c], 'failed', 'rollback'); return converge('halted', count, affected); }
      if (runtime.rollbackOutcome(c) !== 'ok') {
        add(c, applied[c], target, 'failed', 'rollback');
${m.swallowRollbackFailure ? '        continue;   // 缺陷：回滚失败被吞掉并继续后续回滚步' : '        return converge(\'halted\', count, affected);'}
      }
      add(c, applied[c], target, 'success', 'rollback');
      current[c] = target;
      writeArtifact(c, target);
    }
    return converge('rolled_back', count, affected);
  };
  for (const phase of ['prepare', 'stage', 'verify', 'activate']) {
    for (const c of order) {
      const outcome = runtime.stageOutcome(c, phase);
      if (outcome.kind === 'business_outcome') continue;   // S8：不改变状态、不触发 rollback、继续
      if (outcome.kind === 'deploy_failure') {
        add(c, current[c], plan.target_version[c], 'failed', 'deploy');
${m.ignoreDeployFailure ? '        continue;   // 缺陷：阶段失败被忽略并继续推进（留在 partially-deployed）' : '        return rollback();'}
      }
      if (phase === 'verify') {
        const exp = (plan.expected_artifact_sha256[c] || {})[plan.target_version[c]];
        const act = lib.sha256File(path.join(dir, 'blobs', c + '-' + plan.target_version[c] + '.bin'));
        if (exp !== undefined && exp !== act) {   // S4b：校验不一致 ⇒ deploy failure
          add(c, current[c], plan.target_version[c], 'failed', 'deploy');
          return rollback();
        }
      }
      if (phase !== 'activate') continue;
      if (plan.target_version[c] === current[c]) {
        add(c, current[c], current[c], 'skipped', 'deploy');   // S9
      } else {
        applied[c] = plan.target_version[c];
        current[c] = plan.target_version[c];
        add(c, plan.from_version[c], plan.target_version[c], 'success', 'deploy');
        writeArtifact(c, plan.target_version[c]);
      }
    }
  }
  for (const c of order) {
    if (runtime.healthOutcome(c) === 'unhealthy') return rollback();
  }
  return converge('deployed', 0, Object.keys(applied).sort(lib.ordinal));
}
function writeReport(dir, report) {
  fs.writeFileSync(path.join(dir, 'report.json'), canon.serializeReport(report), 'utf8');
}
module.exports = { run };
`;

const RUN_JS = `// 冻结入口：执行部署编排并打印终态（受测面 = deploy.js）
const { run } = require('./deploy.js');
const out = run(__dirname);
console.log('deploy run status=' + out.status);
`;

// ---------- fixture 装配 ----------
const BLOB = (component: string, version: string): string => 'blob:' + component + ':' + version + '\n';
const blobSha = (component: string, version: string): string => sha(BLOB(component, version));
const STATE = (map: Record<string, [string, string?]>): string => {
  const names = Object.keys(map).slice().sort();
  const out: Record<string, unknown> = {};
  for (const n of names) out[n] = { version: map[n]![0], status: map[n]![1] ?? 'active' };
  return JSON.stringify({ components: out }) + '\n';
};
type HistRow = [number, string, string, string, string, string];
const HIST = (rows: HistRow[]): string =>
  rows.map((r) => JSON.stringify({ seq: r[0], component: r[1], from_version: r[2], to_version: r[3], status: r[4], stage: r[5] })).join('\n') + (rows.length ? '\n' : '');
const ARTIFACT = (version: string, fingerprint: string): string => JSON.stringify({ version, fingerprint }) + '\n';
const REPORT_STUB = '{"plan_id":"","decision":"rejected","reason":null,"status":"rejected","drift":[],"affected_components":[],"rollback_count":-1,"final_state":{}}\n';

interface FixSpec {
  planId: string;
  state: Record<string, [string, string?]>;
  history?: HistRow[];
  requires?: Record<string, string[]>;
  target: Record<string, string>;
  fromVersionOverride?: Record<string, string>;
  expectedOverride?: Record<string, Record<string, string>>;
  runtime?: RuntimeSpec;
  deploy: string;
  contractExtra?: string[];
  extra?: Record<string, string>;
  liveArtifacts?: Record<string, [string, string]>;
  noReport?: boolean;
}
const FIX = (o: FixSpec): Record<string, string> => {
  const components = Object.keys(o.state).slice().sort();
  const history = o.history ?? [];
  const expected: Record<string, Record<string, string>> = {};
  for (const c of components) {
    expected[c] = {};
    expected[c]![o.target[c]!] = blobSha(c, o.target[c]!);
  }
  for (const c of Object.keys(o.expectedOverride ?? {})) expected[c] = o.expectedOverride[c]!;
  const plan = {
    plan_id: o.planId,
    components,
    from_version: Object.fromEntries(components.map((c) => [c, o.fromVersionOverride?.[c] ?? o.state[c]![0]])),
    target_version: Object.fromEntries(components.map((c) => [c, o.target[c]!])),
    requires: o.requires ?? Object.fromEntries(components.map((c) => [c, []])),
    expected_artifact_sha256: expected,
    stages: ['prepare', 'stage', 'verify', 'activate', 'health', 'converge'],
  };
  const stateText = STATE(o.state);
  const histText = HIST(history);
  const files: Record<string, string> = {
    'CONTRACT.md': CONTRACT_MD(o.contractExtra ?? []),
    'canonical.js': CANON_JS,
    'lib/deploy-lib.js': LIB_DEPLOY_JS,
    'lib/runtime.js': RUNTIME_JS(o.runtime ?? {}),
    'plan.json': J(plan),
    'state.json': stateText,
    'history.jsonl': histText,
    'deploy.js': o.deploy,
    'run.js': RUN_JS,
    'snapshots/inputs/plan.json': J(plan),
    'snapshots/inputs/state.json': stateText,
    'snapshots/inputs/history.jsonl': histText,
  };
  if (!o.noReport) files['report.json'] = REPORT_STUB;
  const versions: Record<string, Set<string>> = {};
  for (const c of components) versions[c] = new Set([o.state[c]![0], o.target[c]!]);
  for (const r of history) {
    if (!versions[r[1]]) versions[r[1]] = new Set();
    versions[r[1]]!.add(r[2]);
    versions[r[1]]!.add(r[3]);
  }
  for (const c of Object.keys(versions)) {
    for (const v of Array.from(versions[c]!).sort()) files['blobs/' + c + '-' + v + '.bin'] = BLOB(c, v);
  }
  for (const c of components) {
    const live = o.liveArtifacts?.[c];
    const liveVersion = live ? live[0] : o.state[c]![0];
    const liveFp = live ? live[1] : blobSha(c, liveVersion);
    files['artifacts/' + c + '.json'] = ARTIFACT(liveVersion, liveFp);
    files['snapshots/inputs/artifacts/' + c + '.json'] = ARTIFACT(liveVersion, liveFp);
  }
  for (const [k, v] of Object.entries(o.extra ?? {})) files[k] = v;
  return files;
};

// ---------- 标准 checker：交付产物 + **实现重跑**（在 scratch 目录）双重复算 ----------
const CHECK_HARNESS_JS = `function copyInputs(dir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(dest, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'blobs'), { recursive: true });
  const snap = path.join(dir, 'snapshots', 'inputs');
  for (const rel of ['plan.json', 'state.json', 'history.jsonl']) fs.copyFileSync(path.join(snap, rel), path.join(dest, rel));
  for (const f of fs.readdirSync(path.join(snap, 'artifacts'))) fs.copyFileSync(path.join(snap, 'artifacts', f), path.join(dest, 'artifacts', f));
  for (const f of fs.readdirSync(path.join(dir, 'blobs'))) fs.copyFileSync(path.join(dir, 'blobs', f), path.join(dest, 'blobs', f));
}
/** 用**交付的入口实现**在 scratch 目录重跑同一份冻结输入，返回其 canonical 产物 */
function rerunImplementation(dir, entry) {
  const scratch = path.join(dir, '.check-run');
  fs.rmSync(scratch, { recursive: true, force: true });
  copyInputs(dir, scratch);
  require(entry).run(scratch);
  const out = {
    report: fs.readFileSync(path.join(scratch, 'report.json'), 'utf8'),
    state: fs.readFileSync(path.join(scratch, 'state.json'), 'utf8'),
    history: fs.readFileSync(path.join(scratch, 'history.jsonl'), 'utf8'),
    artifacts: {},
  };
  for (const f of fs.readdirSync(path.join(scratch, 'artifacts'))) out.artifacts[f] = fs.readFileSync(path.join(scratch, 'artifacts', f), 'utf8');
  fs.rmSync(scratch, { recursive: true, force: true });
  return out;
}`;

const CHECK_MAIN_JS = (token: string, extra: string[], entry = './deploy.js'): string => `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const runtime = require('./lib/runtime.js');
${REF_ORCH_JS}
${CHECK_HARNESS_JS}
const ENTRY = ${JSON.stringify(entry)};
const dir = __dirname;
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const expected = refRun(dir, runtime);
const expectedReport = refReportText(expected.report);
const expectedState = refStateText(expected.state);
const expectedHistory = read(path.join('snapshots', 'inputs', 'history.jsonl')) + refHistoryText(expected.history);
const plan = JSON.parse(read('plan.json'));
const expectedArtifacts = {};
for (const c of plan.components) {
  const v = expected.state[c].version;
  expectedArtifacts[c + '.json'] = refArtifactText(v, refShaFile(path.join(dir, 'blobs', c + '-' + v + '.bin')));
}
// ① 交付产物必须与独立参考逐字节一致
const deliveredReport = read('report.json');
const deliveredState = read('state.json');
const deliveredHistory = read('history.jsonl');
assert.ok(refBytesEq(deliveredReport, expectedReport), 'report.json 必须与 checker 内嵌独立参考编排逐字节一致：actual=' + JSON.stringify(deliveredReport.slice(0, 260)) + ' expected=' + JSON.stringify(expectedReport.slice(0, 260)));
assert.ok(refBytesEq(deliveredState, expectedState), 'state.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(deliveredState) + ' expected=' + JSON.stringify(expectedState));
assert.ok(refBytesEq(deliveredHistory, expectedHistory), 'history.jsonl 必须与独立参考逐字节一致（含 seq 递增与字段顺序）：actual=' + JSON.stringify(deliveredHistory.slice(0, 260)) + ' expected=' + JSON.stringify(expectedHistory.slice(0, 260)));
for (const f of Object.keys(expectedArtifacts)) {
  const got = read(path.join('artifacts', f));
  assert.ok(refBytesEq(got, expectedArtifacts[f]), 'artifacts/' + f + ' 必须与独立参考一致（S7 重新收敛）：actual=' + JSON.stringify(got) + ' expected=' + JSON.stringify(expectedArtifacts[f]));
}
// ② 交付的入口实现在同一份冻结输入上重跑，必须得到同一套 canonical 产物（防止只手改产物）
const again = rerunImplementation(dir, ENTRY);
assert.ok(refBytesEq(again.report, expectedReport), '交付的 deploy.js 重跑结果与独立参考不一致（report.json）：actual=' + JSON.stringify(again.report.slice(0, 260)) + ' expected=' + JSON.stringify(expectedReport.slice(0, 260)));
assert.ok(refBytesEq(again.state, expectedState), '交付的 deploy.js 重跑结果与独立参考不一致（state.json）：actual=' + JSON.stringify(again.state) + ' expected=' + JSON.stringify(expectedState));
assert.ok(refBytesEq(again.history, expectedHistory), '交付的 deploy.js 重跑结果与独立参考不一致（history.jsonl）：actual=' + JSON.stringify(again.history.slice(0, 260)) + ' expected=' + JSON.stringify(expectedHistory.slice(0, 260)));
for (const f of Object.keys(expectedArtifacts)) {
  assert.ok(refBytesEq(again.artifacts[f], expectedArtifacts[f]), '交付的 deploy.js 重跑结果与独立参考不一致（artifacts/' + f + '）：actual=' + JSON.stringify(again.artifacts[f]) + ' expected=' + JSON.stringify(expectedArtifacts[f]));
}
${extra.join('\n')}
console.log(${JSON.stringify(token)});
`;

// ---------- D1：并行 rollout（组件工具 + 装配 + 反事实） ----------
const C_BUDGET = 6500;
/** 反事实只需让「串行调度」真实发生并落在预算之外（verify 的 span 断言先于产物比对），不得消耗输入 */
const D1_COUNTERFACTUAL_HEAD = `// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批组件 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const COMPONENTS = ["api", "web", "worker"];
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const c of COMPONENTS) execFileSync(process.execPath, [path.join(__dirname, 'work', c + '.js')], { stdio: 'ignore' });
console.log('serial counterfactual done（仅产生 timeline，不做装配）');
`;
const D1_TOOL = (component: string, dur: number, token: string): string => `// 组件 rollout 工具（受保护，冻结语义）：固定耗时后完成本组件的 verify + activate，并写出 out/<c>.json 与 timeline.jsonl
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const COMPONENT = ${JSON.stringify(component)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
const target = plan.target_version[COMPONENT];
const current = state.components[COMPONENT].version;
const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'blobs', COMPONENT + '-' + target + '.bin'))).digest('hex');
const status = (target === current) ? 'skipped' : 'success';
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ component: COMPONENT, start, end, token: TOKEN, status }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', COMPONENT + '.json'), JSON.stringify({ component: COMPONENT, from_version: current, to_version: target, status, fingerprint }) + '\\n', 'utf8');
console.log(COMPONENT + ' rollout ' + status + ' in ' + (end - start) + 'ms');
`;

const D1_ASSEMBLE = `const plan = lib.readJson(path.join(__dirname, 'plan.json'));
  const state = lib.readJson(path.join(__dirname, 'state.json'));
  const preHistory = lib.readJsonl(path.join(__dirname, 'history.jsonl'));
  const order = plan.components.slice().sort(lib.ordinal);   // 互不依赖 ⇒ canonical 顺序（完成顺序不得泄漏）
  const records = [];
  const applied = [];
  const finalState = {};
  let seq = 0;
  for (const c of order) {
    const out = lib.readJson(path.join(__dirname, 'out', c + '.json'));
    records.push({ seq: ++seq, component: c, from_version: out.from_version, to_version: out.to_version, status: out.status, stage: 'deploy' });
    finalState[c] = out.to_version;
    if (out.status !== 'skipped') applied.push(c);
    fs.writeFileSync(path.join(__dirname, 'artifacts', c + '.json'), canon.serializeArtifact(out.to_version, out.fingerprint), 'utf8');
    state.components[c].version = out.to_version;
    state.components[c].status = 'active';
  }
  fs.writeFileSync(path.join(__dirname, 'state.json'), canon.serializeState(state.components), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'history.jsonl'), canon.serializeHistory(preHistory.concat(records)), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'report.json'), canon.serializeReport({ plan_id: plan.plan_id, decision: 'proceed', reason: null, status: 'deployed', drift: [], affected_components: applied.slice().sort(lib.ordinal), rollback_count: 0, final_state: finalState }), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'ROLLOUT.md'), '# 并行 rollout 汇总\\n三个互不依赖组件并行执行完成；产物按 canonical 顺序装配（完成顺序不得泄漏进 history）。\\n', 'utf8');
  console.log('parallel rollout done');`;

const D1_RUNNER = `// 并行 rollout 编排：并发执行三个组件工具，再按 canonical 顺序装配最终产物
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const canon = require('./canonical.js');
const lib = require('./lib/deploy-lib.js');
const COMPONENTS = ["api", "web", "worker"];
function runOne(c) {
  return new Promise((resolve, reject) => {
    const ch = spawn(process.execPath, [path.join(__dirname, 'work', c + '.js')], { stdio: 'ignore' });
    ch.on('error', reject);
    ch.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(c + ' exit=' + code))));
  });
}
Promise.all(COMPONENTS.map(runOne)).then(() => {
  ${D1_ASSEMBLE}
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const D1_COUNTERFACTUAL = D1_COUNTERFACTUAL_HEAD;

const D1_CHECK_JS = (token: string): string => `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const runtime = require('./lib/runtime.js');
${REF_ORCH_JS}
const dir = __dirname;
const BUDGET_MS = ${C_BUDGET};
const COMPONENTS = ["api", "web", "worker"];
const tl = path.join(dir, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.component)).size, COMPONENTS.length, 'distinct 组件数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'snapshots', 'inputs', 'plan.json'), 'utf8'));
const state0 = JSON.parse(fs.readFileSync(path.join(dir, 'snapshots', 'inputs', 'state.json'), 'utf8'));
for (const c of COMPONENTS) {
  const target = plan.target_version[c];
  const current = state0.components[c].version;
  const status = (target === current) ? 'skipped' : 'success';
  const exp = JSON.stringify({ component: c, from_version: current, to_version: target, status, fingerprint: refShaFile(path.join(dir, 'blobs', c + '-' + target + '.bin')) }) + '\\n';
  const got = fs.readFileSync(path.join(dir, 'out', c + '.json'), 'utf8');
  assert.ok(refBytesEq(got, exp), 'out/' + c + '.json 必须与独立参考一致：actual=' + JSON.stringify(got) + ' expected=' + JSON.stringify(exp));
}
const expected = refRun(dir, runtime);
const expectedReport = refReportText(expected.report);
const expectedState = refStateText(expected.state);
const expectedHistory = fs.readFileSync(path.join(dir, 'snapshots', 'inputs', 'history.jsonl'), 'utf8') + refHistoryText(expected.history);
const gotReport = fs.readFileSync(path.join(dir, 'report.json'), 'utf8');
const gotState = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
const gotHistory = fs.readFileSync(path.join(dir, 'history.jsonl'), 'utf8');
assert.ok(refBytesEq(gotReport, expectedReport), 'report.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(gotReport.slice(0, 260)) + ' expected=' + JSON.stringify(expectedReport.slice(0, 260)));
assert.ok(refBytesEq(gotState, expectedState), 'state.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(gotState) + ' expected=' + JSON.stringify(expectedState));
assert.ok(refBytesEq(gotHistory, expectedHistory), 'history.jsonl 必须与独立参考逐字节一致（canonical 顺序、完成顺序不得泄漏）：actual=' + JSON.stringify(gotHistory.slice(0, 260)) + ' expected=' + JSON.stringify(expectedHistory.slice(0, 260)));
for (const c of COMPONENTS) {
  const v = expected.state[c].version;
  const exp = refArtifactText(v, refShaFile(path.join(dir, 'blobs', c + '-' + v + '.bin')));
  const got = fs.readFileSync(path.join(dir, 'artifacts', c + '.json'), 'utf8');
  assert.ok(refBytesEq(got, exp), 'artifacts/' + c + '.json 必须与独立参考一致：actual=' + JSON.stringify(got) + ' expected=' + JSON.stringify(exp));
}
console.log(${JSON.stringify(token)});
`;

// ---------- D2：依赖链 rollout（阶段产物 + 溯源 + 终态） ----------
const D2_RUN_CHAIN = `// 依赖链 rollout 编排：解析（拓扑序 + LKG）→ db → api → web；每步消费上一步真实产物并记录 sha256
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const canon = require('./canonical.js');
const lib = require('./lib/deploy-lib.js');
const at = (p) => path.join(__dirname, p);
const shaFile = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sortKeys = (o) => {
  const out = {};
  for (const k of Object.keys(o).sort(lib.ordinal)) out[k] = o[k];
  return out;
};
const plan = lib.readJson(at('plan.json'));
const state = lib.readJson(at('state.json'));
const preHistory = lib.readJsonl(at('history.jsonl'));
const order = lib.topoOrder(plan.components.slice().sort(lib.ordinal), plan.requires);
fs.mkdirSync(at('stages'), { recursive: true });
const steps = [{ step: 1, component: null, input: 'plan.json', output: 'stages/step1.json' }];
for (const c of order) steps.push({ step: steps.length + 1, component: c, input: steps[steps.length - 1].output, output: 'stages/step' + (steps.length + 1) + '.json' });
const prov = [];
const applied = {};
const records = [];
let seq = 0;
for (const s of steps) {
  const before = shaFile(at(s.input));
  if (s.step === 1) {
    fs.writeFileSync(at(s.output), JSON.stringify({ step: 1, component: null, from_version: null, to_version: null, status: 'resolved', applied: {}, fingerprint: '' }) + '\\n', 'utf8');
  } else {
    const c = s.component;
    const cur = state.components[c].version;
    const tgt = plan.target_version[c];
    const fingerprint = lib.sha256File(at('blobs/' + c + '-' + tgt + '.bin'));
    const status = (tgt === cur) ? 'skipped' : 'success';
    applied[c] = tgt;
    fs.writeFileSync(at(s.output), JSON.stringify({ step: s.step, component: c, from_version: cur, to_version: tgt, status, applied: sortKeys(applied), fingerprint }) + '\\n', 'utf8');
    records.push({ seq: ++seq, component: c, from_version: cur, to_version: tgt, status, stage: 'deploy' });
    if (status !== 'skipped') fs.writeFileSync(at('artifacts/' + c + '.json'), canon.serializeArtifact(tgt, fingerprint), 'utf8');
    state.components[c].version = tgt;
    state.components[c].status = 'active';
  }
  prov.push({ step: s.step, input: s.input, input_sha256: before, output: s.output, output_sha256: shaFile(at(s.output)) });
}
fs.writeFileSync(at('provenance.json'), JSON.stringify(prov, null, 2) + '\\n', 'utf8');
const finalState = {};
for (const c of plan.components.slice().sort(lib.ordinal)) finalState[c] = state.components[c].version;
fs.writeFileSync(at('state.json'), canon.serializeState(state.components), 'utf8');
fs.writeFileSync(at('history.jsonl'), canon.serializeHistory(preHistory.concat(records)), 'utf8');
fs.writeFileSync(at('report.json'), canon.serializeReport({ plan_id: plan.plan_id, decision: 'proceed', reason: null, status: 'deployed', drift: [], affected_components: Object.keys(applied).sort(lib.ordinal), rollback_count: 0, final_state: finalState }), 'utf8');
fs.writeFileSync(at('CHAIN.md'), '# 链说明\\nrollout 链：解析（拓扑序 + LKG）→ db → api → web；每一步消费上一步的真实产物并记录 sha256 溯源，最后一步写出 canonical 终态产物。\\n', 'utf8');
console.log('rollout chain done');
`;

const D2_CHECK_JS = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const runtime = require('./lib/runtime.js');
${REF_ORCH_JS}
const dir = __dirname;
const shaFile = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const abs = (p) => path.normalize(path.isAbsolute(String(p)) ? String(p) : path.join(dir, String(p)));
const prov = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json'), 'utf8'));
assert.ok(Array.isArray(prov) && prov.length === 4, 'provenance 必须包含四个阶段记录，实际 ' + JSON.stringify(prov && prov.length));
for (let i = 0; i < 4; i++) assert.strictEqual(prov[i].step, i + 1, 'provenance 必须按 step 1..4 排列');
assert.strictEqual(abs(prov[0].input), abs('plan.json'), 'step1 的输入必须是 plan.json，实际 ' + prov[0].input);
for (let i = 1; i < 4; i++) assert.strictEqual(abs(prov[i].input), abs(prov[i - 1].output), 'step' + (i + 1) + ' 的输入必须来自 step' + i + ' 的输出产物（不得跳步或重读源输入）');
for (const p of prov) {
  assert.ok(fs.existsSync(abs(p.input)), 'provenance 声明的输入必须真实存在：' + p.input);
  assert.ok(fs.existsSync(abs(p.output)), 'provenance 声明的输出必须真实存在：' + p.output);
  assert.strictEqual(shaFile(abs(p.input)), p.input_sha256, 'provenance 记录的输入 sha256 必须与真实文件一致：' + p.input);
  assert.strictEqual(shaFile(abs(p.output)), p.output_sha256, 'provenance 记录的输出 sha256 必须与真实文件一致：' + p.output);
}
const step1 = JSON.parse(fs.readFileSync(path.join(dir, 'stages', 'step1.json'), 'utf8'));
assert.strictEqual(step1.status, 'resolved', 'step1 必须是解析阶段（status=resolved）');
const seqComponents = [];
for (let k = 2; k <= 4; k++) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'stages', 'step' + k + '.json'), 'utf8'));
  assert.strictEqual(s.step, k, 'step' + k + ' 的 step 字段必须为 ' + k);
  seqComponents.push(s.component);
}
assert.deepStrictEqual(seqComponents, ['db', 'api', 'web'], 'S6/D2：阶段顺序必须是拓扑序 db → api → web，实际 ' + JSON.stringify(seqComponents));
const expected = refRun(dir, runtime);
const expectedReport = refReportText(expected.report);
const expectedState = refStateText(expected.state);
const expectedHistory = fs.readFileSync(path.join(dir, 'snapshots', 'inputs', 'history.jsonl'), 'utf8') + refHistoryText(expected.history);
const gotReport = fs.readFileSync(path.join(dir, 'report.json'), 'utf8');
const gotState = fs.readFileSync(path.join(dir, 'state.json'), 'utf8');
const gotHistory = fs.readFileSync(path.join(dir, 'history.jsonl'), 'utf8');
assert.ok(refBytesEq(gotReport, expectedReport), 'report.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(gotReport.slice(0, 260)) + ' expected=' + JSON.stringify(expectedReport.slice(0, 260)));
assert.ok(refBytesEq(gotState, expectedState), 'state.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(gotState) + ' expected=' + JSON.stringify(expectedState));
assert.ok(refBytesEq(gotHistory, expectedHistory), 'history.jsonl 必须与独立参考逐字节一致：actual=' + JSON.stringify(gotHistory.slice(0, 260)) + ' expected=' + JSON.stringify(expectedHistory.slice(0, 260)));
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
for (const c of plan.components) {
  const v = expected.state[c].version;
  const exp = refArtifactText(v, refShaFile(path.join(dir, 'blobs', c + '-' + v + '.bin')));
  const got = fs.readFileSync(path.join(dir, 'artifacts', c + '.json'), 'utf8');
  assert.ok(refBytesEq(got, exp), 'artifacts/' + c + '.json 必须与独立参考一致：actual=' + JSON.stringify(got) + ' expected=' + JSON.stringify(exp));
}
console.log('CHAIN OK steps=4 artifacts=verified');
`;

// ---------- E 类：冻结 legacy 路径与入口装配 ----------
const E1_INDEX = (fixed: boolean): string => `// 部署入口${fixed ? '（已改：指向符合新契约的部署路径）' : '（现状：直接转发既有 legacy 实现）'}
${fixed ? "const impl = require('./deploy-adjacent.js');" : "const impl = require('./legacy/deploy.js');"}
function run(dir) { return impl.run(dir); }
module.exports = { run };
`;

const E1_CHECK_LEGACY = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const runtime = require('./lib/runtime.js');
function copyInputs(dir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(dest, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'blobs'), { recursive: true });
  const snap = path.join(dir, 'snapshots', 'inputs');
  for (const rel of ['plan.json', 'state.json', 'history.jsonl']) fs.copyFileSync(path.join(snap, rel), path.join(dest, rel));
  for (const f of fs.readdirSync(path.join(snap, 'artifacts'))) fs.copyFileSync(path.join(snap, 'artifacts', f), path.join(dest, 'artifacts', f));
  for (const f of fs.readdirSync(path.join(dir, 'blobs'))) fs.copyFileSync(path.join(dir, 'blobs', f), path.join(dest, 'blobs', f));
}
const dir = __dirname;
const bytesEq = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0;
assert.ok(bytesEq(fs.readFileSync(path.join(dir, 'legacy-record.json'), 'utf8'), fs.readFileSync(path.join(dir, 'snapshots', 'legacy-record.snap'), 'utf8')), 'legacy 冻结记录 legacy-record.json 必须与快照逐字节一致（不得被改写）');
const scratch = path.join(dir, '.legacy-run');
fs.rmSync(scratch, { recursive: true, force: true });
copyInputs(dir, scratch);
require('./legacy/deploy.js').run(scratch);
const st = JSON.parse(fs.readFileSync(path.join(scratch, 'state.json'), 'utf8'));
assert.strictEqual(st.components.api.version, 'v1', 'legacy 旧契约行为（回滚无条件回 v1）必须仍然可用，实际 ' + st.components.api.version);
assert.ok(bytesEq(fs.readFileSync(path.join(scratch, 'report.json'), 'utf8'), fs.readFileSync(path.join(dir, 'legacy-record.json'), 'utf8')), '冻结记录必须等于冻结 legacy 实现的真实输出');
fs.rmSync(scratch, { recursive: true, force: true });
console.log('LEGACY OK');
`;

const E2_RECONCILE_JS = `// legacy 对账路径（受保护，冻结）：把 state.json 改写为 actual（掩盖 drift）并写 legacy 结论与 legacy-view.json
const fs = require('fs');
const path = require('path');
const canon = require('./canonical.js');
const lib = require('./lib/deploy-lib.js');
function reconcile(dir) {
  const plan = lib.readJson(path.join(dir, 'plan.json'));
  const state = lib.readJson(path.join(dir, 'state.json'));
  const finalState = {};
  for (const c of plan.components.slice().sort(lib.ordinal)) {
    const actual = lib.readJson(path.join(dir, 'artifacts', c + '.json')).version;
    state.components[c].version = actual;   // 掩盖 drift：只改声明，不重新部署
    finalState[c] = actual;
  }
  fs.writeFileSync(path.join(dir, 'state.json'), canon.serializeState(state.components), 'utf8');
  fs.writeFileSync(path.join(dir, 'report.json'), canon.serializeReport({ plan_id: plan.plan_id, decision: 'proceed', reason: null, status: 'reconciled', drift: [], affected_components: [], rollback_count: 0, final_state: finalState }), 'utf8');
  fs.writeFileSync(path.join(dir, 'legacy-view.json'), JSON.stringify({ view: 'reconcile', declared: finalState }) + '\\n', 'utf8');
  return { status: 'reconciled' };
}
module.exports = { run: reconcile };
`;

const E2_INDEX = (fixed: boolean): string => `// 部署入口${fixed ? '（已改：指向 drift 重新部署路径）' : '（现状：直接转发 legacy 对账路径）'}
${fixed ? "const impl = require('./redeploy.js');" : "const impl = require('./reconcile.js');"}
function run(dir) { return impl.run(dir); }
module.exports = { run };
`;

const E2_CHECK_LEGACY = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
function copyInputs(dir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(dest, 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'blobs'), { recursive: true });
  const snap = path.join(dir, 'snapshots', 'inputs');
  for (const rel of ['plan.json', 'state.json', 'history.jsonl']) fs.copyFileSync(path.join(snap, rel), path.join(dest, rel));
  for (const f of fs.readdirSync(path.join(snap, 'artifacts'))) fs.copyFileSync(path.join(snap, 'artifacts', f), path.join(dest, 'artifacts', f));
  for (const f of fs.readdirSync(path.join(dir, 'blobs'))) fs.copyFileSync(path.join(dir, 'blobs', f), path.join(dest, 'blobs', f));
}
const dir = __dirname;
const bytesEq = (a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0;
assert.ok(bytesEq(fs.readFileSync(path.join(dir, 'legacy-view.json'), 'utf8'), fs.readFileSync(path.join(dir, 'snapshots', 'legacy-view.snap'), 'utf8')), 'legacy 冻结视图 legacy-view.json 必须与快照逐字节一致');
const scratch = path.join(dir, '.legacy-run');
fs.rmSync(scratch, { recursive: true, force: true });
copyInputs(dir, scratch);
require('./reconcile.js').run(scratch);
assert.ok(bytesEq(fs.readFileSync(path.join(scratch, 'legacy-view.json'), 'utf8'), fs.readFileSync(path.join(dir, 'snapshots', 'legacy-view.snap'), 'utf8')), '冻结 legacy 对账路径的行为必须仍然可用');
const st = JSON.parse(fs.readFileSync(path.join(scratch, 'state.json'), 'utf8'));
assert.strictEqual(st.components.api.version, 'v1', 'legacy 对账路径的旧行为（声明改写为 actual）必须仍然可用，实际 ' + st.components.api.version);
fs.rmSync(scratch, { recursive: true, force: true });
console.log('LEGACY OK');
`;

const E1_RECORD = '{"plan_id":"P-E1","decision":"proceed","reason":null,"status":"rolled_back","drift":[],"affected_components":["api"],"rollback_count":1,"final_state":{"api":"v1"}}\n';
const E2_VIEW = '{"view":"reconcile","declared":{"api":"v1"}}\n';

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F12-A1', category: 'A', variant: 1, token: 'F12-A1 OK',
    title: '正常 deploy 的 history 记录漏写 to_version 字段',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-A1 的部署编排在写出 history.jsonl 时漏写了 `to_version` 字段（S10 要求五字段固定顺序，逐字节比较）。',
      '修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。',
      '不得修改 verify.js、check-history.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-A1',
      state: { api: ['v1'] },
      history: [],
      target: { api: 'v2' },
      deploy: DEPLOY_JS({ omitToVersion: true }),
      extra: {
        'check-history.js': CHECK_MAIN_JS('HISTORY OK', [
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "assert.strictEqual(rows.length, 1, 'S2：单组件正常部署必须恰好产生一条 deploy 记录，实际 ' + rows.length);",
          "assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'to_version'), 'S10：history 记录必须包含 to_version 字段，实际 ' + JSON.stringify(rows[0]));",
          "assert.strictEqual(rows[0].to_version, 'v2', 'S10/F-4：to_version 必须为目标版本 v2，实际 ' + JSON.stringify(rows[0].to_version));",
          "assert.strictEqual(rows[0].status, 'success', 'S2：正常部署记录 status=success');",
        ]),
        'verify.js': ["require('./check-history.js');", "console.log('F12-A1 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-A1/run.js',
    required: ['history_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-history.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json'],
    extraChecks: [
      { id: 'history_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-A1/check-history.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（deploy.js 写 history 记录时漏写 to_version），目标与字段顺序由 CONTRACT.md 的 S10/F-4 唯一确定 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（失败由 check-history.js 的断言直接定位到字段）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F12-A2', category: 'A', variant: 2, token: 'F12-A2 OK',
    title: '前置条件被拒后仍留下状态变更（先改后判）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-A2 的部署计划其前置条件不成立（期望被拒绝），但当前实现在判定前置条件**之前**就改写了 state.json，留下了 partially-deployed 痕迹。',
      '修正 deploy.js 后运行 node run.js，使 node verify.js 通过。',
      '不得修改 verify.js、check-reject.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-A2',
      state: { api: ['v1'] },
      fromVersionOverride: { api: 'v2' },
      history: [[1, 'api', 'v2', 'v1', 'success', 'deploy']],
      target: { api: 'v2' },
      deploy: DEPLOY_JS({ mutateBeforeCheck: true }),
      extra: {
        'check-reject.js': CHECK_MAIN_JS('REJECT OK', [
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.decision, 'rejected', 'S1：前置条件不成立必须 decision=\"rejected\"，实际 ' + rep.decision);",
          "assert.strictEqual(rep.reason, 'version_mismatch', 'F-3：reason 取总序最靠前项（此处 from_version 与当前版本不一致 ⇒ version_mismatch），实际 ' + JSON.stringify(rep.reason));",
          "assert.strictEqual(rep.status, 'rejected', 'F-1：拒绝终态 = rejected，实际 ' + rep.status);",
          "assert.ok(refBytesEq(read('state.json'), read(path.join('snapshots', 'inputs', 'state.json'))), 'S1/F-8：拒绝时 state.json 必须逐字节不变，实际 ' + JSON.stringify(read('state.json')));",
          "assert.ok(refBytesEq(read('history.jsonl'), read(path.join('snapshots', 'inputs', 'history.jsonl'))), 'S1/F-8：拒绝时 history.jsonl 必须逐字节不变');",
          "assert.ok(refBytesEq(read(path.join('artifacts', 'api.json')), read(path.join('snapshots', 'inputs', 'artifacts', 'api.json'))), 'S1/F-8：拒绝时 artifacts/api.json 必须逐字节不变');",
        ]),
        'verify.js': ["require('./check-reject.js');", "console.log('F12-A2 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-A2/run.js',
    required: ['reject_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-reject.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'snapshots/inputs/state.json', 'snapshots/inputs/history.jsonl'],
    extraChecks: [
      { id: 'reject_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-A2/check-reject.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（deploy.js），但「拒绝时任何 artifact 逐字节不变」「reason 取 F-3 总序最靠前项」的判定依据写在 CONTRACT.md（S1/F-3/F-8）⇒ 先查契约再改与直接修改并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F12-B1', category: 'B', variant: 1, token: 'F12-B1 OK',
    title: '部署顺序违反依赖方向（按组件名而非拓扑序）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-B1 的部署顺序与 CONTRACT.md 的 S6 不一致（依赖方向被破坏：api 依赖 db、web 依赖 api）。',
      '修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。',
      '不得修改 verify.js、check-order.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-B1',
      state: { api: ['v1'], db: ['v1'], web: ['v1'] },
      history: [],
      requires: { api: ['db'], db: [], web: ['api'] },
      target: { api: 'v2', db: 'v2', web: 'v2' },
      deploy: DEPLOY_JS({ orderByName: true }),
      extra: {
        'check-order.js': CHECK_MAIN_JS('ORDER OK', [
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "const seq = rows.filter((r) => r.stage === 'deploy').map((r) => r.component);",
          "assert.deepStrictEqual(seq, ['db', 'api', 'web'], 'S6：部署序必须是拓扑序（db → api → web），实际 ' + JSON.stringify(seq));",
          "assert.deepStrictEqual(rows.map((r) => r.seq), [1, 2, 3], 'S10：history 的 seq 必须从 1 递增，实际 ' + JSON.stringify(rows.map((r) => r.seq)));",
        ]),
        'verify.js': ["require('./check-order.js');", "console.log('F12-B1 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-B1/run.js',
    required: ['order_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-order.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'artifacts/db.json', 'artifacts/web.json'],
    extraChecks: [
      { id: 'order_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-B1/check-order.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"部署顺序不对"，成因可能在编排的排序调用或依赖方向声明（S6 的方向约定与拓扑序同层 tie-break 写在 CONTRACT.md），需要沿「plan.requires → 编排排序 → history 顺序」核对 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 容易只调换个别组件而留下同层顺序不确定；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F12-B2', category: 'B', variant: 2, token: 'F12-B2 OK',
    title: 'rollback 目标被猜测（无条件回退 v1）而非 LKG',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-B2 的部署在健康门禁失败后回滚到了错误的版本（S3 要求回滚到 LKG，而不是猜测的 v1）。',
      '修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。',
      '不得修改 verify.js、check-rollback.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-B2',
      state: { api: ['v2'] },
      history: [
        [1, 'api', 'v1', 'v2', 'success', 'deploy'],
        [2, 'api', 'v2', 'v3', 'success', 'deploy'],
        [3, 'api', 'v3', 'v2', 'success', 'rollback'],
      ],
      target: { api: 'v1' },
      runtime: { health: { api: 'unhealthy' } },
      deploy: DEPLOY_JS({ rollbackToV1: true }),
      extra: {
        'check-rollback.js': CHECK_MAIN_JS('ROLLBACK OK', [
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "const rb = rows.filter((r) => r.stage === 'rollback' && r.seq > 3);",
          "assert.strictEqual(rb.length, 1, 'S5：只有发生版本变化的组件才产生 rollback 记录，实际 ' + rb.length);",
          "assert.strictEqual(rb[0].to_version, 'v3', 'S3/F-7：rollback 目标必须是本次尝试之前最近一条 success 记录的 from_version（LKG=v3；F-5：回滚不受相邻性约束），实际 ' + JSON.stringify(rb[0].to_version));",
          "const st = JSON.parse(read('state.json'));",
          "assert.strictEqual(st.components.api.version, 'v3', 'S5：一致回滚后 api 必须回到 LKG=v3，实际 ' + st.components.api.version);",
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.status, 'rolled_back', 'S5a：全部受影响组件回到 LKG ⇒ status=rolled_back，实际 ' + rep.status);",
          "assert.strictEqual(rep.rollback_count, 1, 'F-2：rollback_count 必须等于实际执行的回滚步数，实际 ' + rep.rollback_count);",
        ]),
        'verify.js': ["require('./check-rollback.js');", "console.log('F12-B2 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-B2/run.js',
    required: ['rollback_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-rollback.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json'],
    extraChecks: [
      { id: 'rollback_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-B2/check-rollback.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '成因在"rollback target 的唯一选择规则"（S3 的 LKG 定义 + F-7 的基准 + F-5 的免相邻性），需要沿 history 语义（哪条记录算 last known good）与回滚范围（S5）核对，而 checker 只断言终态与回滚记录 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 未刻画「history → LKG → 回滚目标」的语义链；委派与 REPLAN 不适用。',
  }),

  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F12-C1', category: 'C', variant: 1, token: 'F12-C1 OK',
    title: '部署中途真实失败 ⇒ 按逆拓扑序回滚到 LKG（不得继续推进）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-C1 是一次依赖链（api → web，web 依赖 api）的版本迁移，部署中途 web 的阶段执行会真实失败。',
      '按 CONTRACT.md（S1–S10 + F-1..F-9）实现正确的恢复：受影响组件按**逆拓扑序**回滚到各自 LKG，收敛到允许终态之一，',
      '并交付 state.json、history.jsonl、artifacts/ 与 report.json；运行 node run.js 执行部署，node verify.js 必须通过。',
      '不得修改 verify.js、check-deploy.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-C1',
      state: { api: ['v2'], web: ['v2'] },
      history: [
        [1, 'api', 'v1', 'v2', 'success', 'deploy'],
        [2, 'api', 'v2', 'v3', 'success', 'deploy'],
        [3, 'api', 'v3', 'v2', 'success', 'rollback'],
        [4, 'web', 'v1', 'v2', 'success', 'deploy'],
        [5, 'web', 'v2', 'v3', 'success', 'deploy'],
        [6, 'web', 'v3', 'v2', 'success', 'rollback'],
      ],
      requires: { api: [], web: ['api'] },
      target: { api: 'v1', web: 'v1' },
      runtime: { deployFailures: [{ component: 'web', stage: 'activate', kind: 'deploy_failure', code: 3 }] },
      deploy: DEPLOY_JS({ ignoreDeployFailure: true }),
      extra: {
        'check-deploy.js': CHECK_MAIN_JS('ROLLBACK OK', [
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.status, 'rolled_back', 'S5a：全部受影响组件回到 LKG ⇒ status=rolled_back（缺陷实现会继续推进到 deployed），实际 ' + rep.status);",
          "assert.deepStrictEqual(rep.affected_components, ['api'], 'S5：只有发生版本变化的组件才进入回滚范围（web 的阶段失败发生在 activate 之前 ⇒ 不在范围内），实际 ' + JSON.stringify(rep.affected_components));",
          "assert.strictEqual(rep.rollback_count, 1, 'F-2：实际执行的回滚步数必须为 1，实际 ' + rep.rollback_count);",
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "const rb = rows.filter((r) => r.stage === 'rollback' && r.seq > 6);",
          "assert.strictEqual(rb.length, 1, 'S5：本次尝试只对 api 产生一条 rollback 记录，实际 ' + rb.length);",
          "assert.strictEqual(rb[0].component, 'api', 'S5：回滚范围只含 api，实际 ' + rb[0].component);",
          "assert.strictEqual(rb[0].to_version, 'v3', 'S3/F-7：回滚目标 = LKG = v3（F-5：免相邻性），实际 ' + JSON.stringify(rb[0].to_version));",
          "const st = JSON.parse(read('state.json'));",
          "assert.strictEqual(st.components.api.version, 'v3', 'S5：api 必须回到 LKG=v3，实际 ' + st.components.api.version);",
          "assert.strictEqual(st.components.web.version, 'v2', 'S5：未发生版本变化的 web 不得被回滚，实际 ' + st.components.web.version);",
        ]),
        'verify.js': ["require('./check-deploy.js');", "console.log('F12-C1 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-C1/run.js',
    preRun: { command: 'node pilot-workspace/FORMAL-F12-C1/check-deploy.js', log: 'pilot-workspace/FORMAL-F12-C1/attempt-log.txt', scratch: true },
    required: ['deploy_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-deploy.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'artifacts/web.json'],
    extraChecks: [
      { id: 'deploy_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-C1/check-deploy.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['WORKFLOW'], expectedDelegation: true,
    rationaleGt: '任务初始状态给出一条**依赖链**（web requires api）与一次带检查点的版本迁移，且失败点由运行时的阶段结果决定（初始状态不可预知）；正确恢复要求阶段化编排：前置检查 → 阶段序 → 健康门禁 → **逆拓扑序回滚** → 明确终态（S2/S5），并由 checker 断言真实终态与回滚记录 ⇒ 阶段化/可恢复编排由任务结构本身给出。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画「阶段序 + 检查点 + 逆拓扑回滚」结构；PARALLEL 无依据（依赖链要求 api 先于 web，且回滚序与部署序严格相反）；REPLAN 不适用（初始状态正常）。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F12-C2', category: 'C', variant: 2, token: 'F12-C2 OK',
    title: '回滚阶段自身失败 ⇒ 安全停机 halted（停止后续回滚步）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-C2 是一次依赖链（api → web）的版本迁移：部署会因健康门禁失败而触发回滚，而**回滚阶段自身也会失败**。',
      '按 CONTRACT.md（S5b）实现安全停机：必须停止后续回滚步、不得报告 success/rolled_back、不得静默吞掉失败；',
      '交付 state.json、history.jsonl、artifacts/ 与 report.json；运行 node run.js 执行部署，node verify.js 必须通过。',
      '不得修改 verify.js、check-halt.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-C2',
      state: { api: ['v2'], web: ['v2'] },
      history: [
        [1, 'api', 'v1', 'v2', 'success', 'deploy'],
        [2, 'api', 'v2', 'v3', 'success', 'deploy'],
        [3, 'api', 'v3', 'v2', 'success', 'rollback'],
        [4, 'web', 'v1', 'v2', 'success', 'deploy'],
        [5, 'web', 'v2', 'v3', 'success', 'deploy'],
        [6, 'web', 'v3', 'v2', 'success', 'rollback'],
      ],
      requires: { api: [], web: ['api'] },
      target: { api: 'v1', web: 'v1' },
      runtime: { health: { web: 'unhealthy' }, rollbackFailures: ['web'] },
      deploy: DEPLOY_JS({ swallowRollbackFailure: true }),
      extra: {
        'check-halt.js': CHECK_MAIN_JS('HALT OK', [
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.status, 'halted', 'S5b：回滚步失败 ⇒ 唯一允许的非一致终态 halted，实际 ' + rep.status);",
          "assert.strictEqual(rep.rollback_count, 1, 'S5b：必须停止后续回滚步 ⇒ rollback_count=1，实际 ' + rep.rollback_count);",
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "const rb = rows.filter((r) => r.stage === 'rollback' && r.seq > 6);",
          "assert.strictEqual(rb.length, 1, 'S5b：失败后不得继续后续回滚步，实际产生 ' + rb.length + ' 条回滚记录');",
          "assert.strictEqual(rb[0].component, 'web', 'S5：回滚顺序为逆拓扑序 ⇒ 先回滚 web，实际 ' + rb[0].component);",
          "assert.strictEqual(rb[0].status, 'failed', 'S5b：回滚步失败必须如实记为 failed，实际 ' + rb[0].status);",
          "const st = JSON.parse(read('state.json'));",
          "assert.strictEqual(st.components.api.version, 'v1', 'S5b：api 的回滚步不得被执行（停在部署后的版本），实际 ' + st.components.api.version);",
          "assert.strictEqual(st.components.web.version, 'v1', 'S5b：web 的回滚失败 ⇒ 停在部署后的版本，实际 ' + st.components.web.version);",
        ]),
        'verify.js': ["require('./check-halt.js');", "console.log('F12-C2 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy.js': DEPLOY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F12-C2/run.js',
    preRun: { command: 'node pilot-workspace/FORMAL-F12-C2/check-halt.js', log: 'pilot-workspace/FORMAL-F12-C2/attempt-log.txt', scratch: true },
    required: ['halt_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-halt.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'artifacts/web.json'],
    extraChecks: [
      { id: 'halt_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-C2/check-halt.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但承担**不同 failure mode**：C1 = deploy failure 的恢复（逆拓扑回滚到 LKG）；C2 = **恢复自身失败**的安全停机（halted + 停止后续回滚步 + 不得吞掉失败）。终态由阶段化编排的检查点语义决定，且 checker 断言真实终态差异（state/rollback_count）⇒ 阶段化编排是任务结构本身要求的。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画「检查点 + 回滚失败安全停机」结构；PARALLEL 无依据；REPLAN 不适用（初始状态正常，失败发生在执行期）。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F12-D1', category: 'D', variant: 1, token: 'F12-D1 OK',
    title: '互不依赖组件的并行 rollout（硬预算 + 结果与独立参考逐字节一致）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-D1 需要在**总预算 6500 ms**内完成三个互不依赖组件（api / web / worker）的 rollout，最终必须同时成立：',
      '① work/ 下的三个组件工具都必须真实执行完成，各自产出 out/<c>.json 与 timeline.jsonl 记录；',
      '② 各组件完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '③ 最终 state.json / history.jsonl / artifacts/ / report.json 必须与按 CONTRACT.md（S1–S10）独立计算的参考结果**逐字节一致**，',
      '   且完成顺序不得泄漏进 history（history 必须按 canonical 顺序、seq 从 1 递增）；',
      '④ 写出 ROLLOUT.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-rollout.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/、snapshots/ 与 work/ 下的组件工具。',
    ].join('\n'),
    files: FIX({
      planId: 'P-D1',
      state: { api: ['v1'], web: ['v1'], worker: ['v2'] },
      history: [],
      target: { api: 'v2', web: 'v2', worker: 'v2' },
      deploy: DEPLOY_JS(),
      extra: {
        'work/api.js': D1_TOOL('api', 3500, 'DA-2f81'),
        'work/web.js': D1_TOOL('web', 3500, 'DW-77c4'),
        'work/worker.js': D1_TOOL('worker', 3000, 'DK-19e2'),
        'check-rollout.js': D1_CHECK_JS('ROLLOUT OK'),
        'verify.js': ["require('./check-rollout.js');", "console.log('F12-D1 OK');"].join('\n'),
      },
    }),
    fix: {
      'run-rollout.js': D1_RUNNER,
      'ROLLOUT.md': '# 并行 rollout 汇总\n三个互不依赖组件并行执行完成；产物按 canonical 顺序装配（完成顺序不得泄漏进 history）。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F12-D1/run-rollout.js',
    counterfactual: D1_COUNTERFACTUAL,
    budget: C_BUDGET,
    preRun: { command: 'node pilot-workspace/FORMAL-F12-D1/check-rollout.js', log: 'pilot-workspace/FORMAL-F12-D1/attempt-log.txt', scratch: true, serialFirst: true },
    required: ['rollout_done', 'timeline_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-rollout.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'artifacts/web.json', 'artifacts/worker.json', 'work/api.js', 'work/web.js', 'work/worker.js'],
    extraChecks: [
      { id: 'rollout_done', kind: 'file_exists', path: 'out/api.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-D1/check-rollout.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['PARALLEL'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三个互不依赖组件各自固定耗时（3.5s / 3.5s / 3.0s，串行约 10s）与 6500ms 总预算，且**调度方式不得改变结果**（最终产物必须与 checker 内嵌独立参考逐字节一致、history 不得泄漏完成顺序）。串行无法满足硬预算（verify 以「总耗时超预算」拒绝），三路并行 + canonical 装配可同时满足 ⇒ 并行具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-组件集合-逐字节等价」结构；WORKFLOW 无依据（三个组件互不依赖、无常阶段链）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F12-D2', category: 'D', variant: 2, token: 'F12-D2 OK',
    title: '依赖链 rollout：拓扑序 + stage 间真实 artifact 传递（sha256）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F12-D2 需要按 CONTRACT.md 的依赖方向（api 依赖 db、web 依赖 api）完成三段 rollout，并交付：',
      '① 各阶段产物 stages/step1.json（解析：拓扑序 + LKG）、stages/step2.json（db）、stages/step3.json（api）、stages/step4.json（web）；',
      '② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；',
      '③ 最终 state.json / history.jsonl / artifacts/ / report.json 与阶段说明 CHAIN.md；运行 node run-chain.js，node verify.js 必须通过。',
      '不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-D2',
      state: { api: ['v1'], db: ['v1'], web: ['v1'] },
      history: [],
      requires: { api: ['db'], db: [], web: ['api'] },
      target: { api: 'v2', db: 'v2', web: 'v2' },
      deploy: DEPLOY_JS(),
      contractExtra: [
        '## 阶段依赖条款（D2）',
        '',
        '1. rollout 必须按依赖方向拓扑有序执行：**db → api → web**（S6）；',
        '2. 每一步必须消费上一步的**真实产物文件**（不得跳步或重读源输入）；',
        '3. `stages/step1.json` 为解析阶段（`component` 为 `null`、`status` 为 `"resolved"`、`applied` 为 `{}`），',
        '   `stages/step<k>.json`（k≥2）字段顺序固定 `(step, component, from_version, to_version, status, applied, fingerprint)`，',
        '   `applied` 为累计的 {component: version}（键序数升序）；',
        '4. `provenance.json` 为 4 条记录（step 1..4），`input`/`output` 为相对本目录路径，且 step k 的 input = step k−1 的 output；',
        '5. 最终产物由最后一步写出：`state.json` / `history.jsonl` / `artifacts/<c>.json` / `report.json`（S10 + F-2）。',
      ],
      extra: {
        'CHAIN.md': '# 查询链说明\n（待补）\n',
        'check-chain.js': D2_CHECK_JS,
        'verify.js': ["require('./check-chain.js');", "console.log('F12-D2 OK');"].join('\n'),
      },
    }),
    fix: {
      'run-chain.js': D2_RUN_CHAIN,
      'CHAIN.md': '# 链说明\nrollout 链：解析（拓扑序 + LKG）→ db → api → web；每一步消费上一步的真实产物并记录 sha256 溯源，最后一步写出 canonical 终态产物。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F12-D2/run-chain.js',
    required: ['chain_provenance', 'chain_ok', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-chain.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json', 'artifacts/db.json', 'artifacts/web.json'],
    extraChecks: [
      { id: 'chain_provenance', kind: 'file_exists', path: 'provenance.json' },
      { id: 'chain_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-D2/check-chain.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三段 rollout 之间存在真实依赖（db → api → web，S6 要求拓扑有序），且 checker 断言 stage 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致），最后一步才写出终态产物 ⇒ 阶段化编排（Workflow）由任务结构本身给出；GT 事前即收紧为单一值（沿用 F10-D2/F11-D2 教训）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段依赖与产物传递；DELEGATE 单路不足；PARALLEL 无依据（链上严格串行依赖）；REPLAN 不适用（初始状态正常）。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F12-E1', category: 'E', variant: 1, token: 'F12-E1 OK',
    title: '部署契约变化：LKG 回滚（已上线 legacy 路径与冻结记录不得改动）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F12-E1 的入口 index.js 仍转发**已上线**的 legacy 部署实现（回滚无条件回 v1），而新契约（CONTRACT.md 的 S3/F-7/F-5）要求回滚到 LKG；',
      'legacy/deploy.js 与冻结记录 legacy-record.json、snapshots/ 均不得修改。',
      '请新增符合新契约的部署路径 deploy-adjacent.js 并调整非保护入口 index.js，运行 node run.js 执行部署，使 node verify.js 通过。',
      '不得修改 verify.js、check.js、check-legacy.js、CONTRACT.md、canonical.js、lib/、legacy/、snapshots/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 legacy-record.json。',
    ].join('\n'),
    files: FIX({
      planId: 'P-E1',
      state: { api: ['v2'] },
      history: [
        [1, 'api', 'v1', 'v2', 'success', 'deploy'],
        [2, 'api', 'v2', 'v3', 'success', 'deploy'],
        [3, 'api', 'v3', 'v2', 'success', 'rollback'],
      ],
      fromVersionOverride: { api: 'v2' },
      target: { api: 'v1' },
      runtime: { health: { api: 'unhealthy' } },
      deploy: E1_INDEX(false),
      extra: {
        'legacy/deploy.js': DEPLOY_JS({ rollbackToV1: true, requirePrefix: '../' }),
        'legacy-record.json': E1_RECORD,
        'snapshots/legacy-record.snap': E1_RECORD,
        'run.js': ["const { run } = require('./index.js');", "const out = run(__dirname);", "console.log('deploy run status=' + out.status);"].join('\n'),
        'check.js': CHECK_MAIN_JS('CONTRACT OK', [
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.status, 'rolled_back', 'S5a：全部受影响组件回到 LKG ⇒ status=rolled_back，实际 ' + rep.status);",
          "assert.strictEqual(rep.rollback_count, 1, 'F-2：实际回滚步数必须为 1，实际 ' + rep.rollback_count);",
          "const st = JSON.parse(read('state.json'));",
          "assert.strictEqual(st.components.api.version, 'v3', 'S3/F-7/F-5：新契约要求回滚到 LKG=v3（legacy 的「猜测 v1」不再成立），实际 ' + st.components.api.version);",
          "const rows = read('history.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
          "const rb = rows.filter((r) => r.stage === 'rollback' && r.seq > 3);",
          "assert.strictEqual(rb.length, 1, 'S5：本次尝试只产生一条 rollback 记录，实际 ' + rb.length);",
          "assert.strictEqual(rb[0].to_version, 'v3', 'S3：rollback 目标必须是 LKG=v3，实际 ' + JSON.stringify(rb[0].to_version));",
        ], './index.js'),
        'check-legacy.js': E1_CHECK_LEGACY,
        'verify.js': ["require('./check-legacy.js');", "require('./check.js');", "console.log('F12-E1 OK');"].join('\n'),
      },
    }),
    fix: { 'deploy-adjacent.js': DEPLOY_JS(), 'index.js': E1_INDEX(true) },
    fixRun: 'node pilot-workspace/FORMAL-F12-E1/run.js',
    preRun: { command: 'node pilot-workspace/FORMAL-F12-E1/check.js', log: 'pilot-workspace/FORMAL-F12-E1/attempt-log.txt', scratch: true },
    required: ['new_path_added', 'legacy_record_intact', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check.js', 'check-legacy.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'legacy/deploy.js', 'legacy-record.json', 'snapshots/inputs/state.json', 'snapshots/legacy-record.snap', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json'],
    extraChecks: [
      { id: 'new_path_added', kind: 'file_exists', path: 'deploy-adjacent.js' },
      { id: 'legacy_record_intact', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-E1/check-legacy.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '现状把「回滚 = 无条件回 v1」当作已上线契约：legacy/deploy.js 与冻结记录 legacy-record.json、snapshots/ 都被冻结且必须保持旧行为，而新契约要求回滚到 LKG（S3/F-7/F-5）；局部改参无法同时满足两条契约 ⇒ 必须新增符合新契约的部署路径并重新装配非保护入口 index.js（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件（legacy/ 与冻结记录）；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F12-E2', category: 'E', variant: 2, token: 'F12-E2 OK',
    title: 'state drift：必须重新部署而不是改写 state.json 掩盖',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F12-E2 存在 state drift：state.json 声明 api=v2，而 artifacts/api.json 的实际版本仍是 v1。',
      '现状入口 index.js 转发冻结的 legacy 对账路径 reconcile.js（把 state.json 改写为 actual，掩盖 drift），而新契约（S7/F-9）要求**报告 drift 并重新部署**推进到目标版本。',
      '请新增 drift 重新部署路径 redeploy.js 并调整非保护入口 index.js，运行 node run.js 执行部署，使 node verify.js 通过。',
      '不得修改 verify.js、check-repair.js、check-legacy.js、CONTRACT.md、canonical.js、lib/、reconcile.js、legacy-view.json、snapshots/、plan.json、state.json、history.jsonl、artifacts/ 与 blobs/。',
    ].join('\n'),
    files: FIX({
      planId: 'P-E2',
      state: { api: ['v2'] },
      history: [],
      fromVersionOverride: { api: 'v1' },
      target: { api: 'v2' },
      liveArtifacts: { api: ['v1', blobSha('api', 'v1')] },
      deploy: E2_INDEX(false),
      contractExtra: [
        '## 兼容条款（E2）',
        '',
        '1. S7/F-9：检测到 drift 必须如实写入 `report.drift` 并**重新部署**（以 actual 为有效当前版本推进到目标版本），',
        '   使 `artifacts/<c>.json` 与 `state.json` 重新一致；**不得**仅改写 `state.json` 掩盖 drift；',
        '2. 冻结的 legacy 对账路径 `reconcile.js` 与其视图 `legacy-view.json`（快照 `snapshots/legacy-view.snap`）必须保持旧行为不变。',
      ],
      extra: {
        'reconcile.js': E2_RECONCILE_JS,
        'legacy-view.json': E2_VIEW,
        'snapshots/legacy-view.snap': E2_VIEW,
        'run.js': ["const { run } = require('./index.js');", "const out = run(__dirname);", "console.log('deploy run status=' + out.status);"].join('\n'),
        'check-repair.js': CHECK_MAIN_JS('DRIFT OK', [
          "const rep = JSON.parse(read('report.json'));",
          "assert.strictEqual(rep.status, 'deployed', 'F-1：drift 修复后必须收敛到 deployed，实际 ' + rep.status);",
          "assert.deepStrictEqual(rep.drift, [{ component: 'api', declared: 'v2', actual: 'v1' }], 'S7：drift 必须被如实报告（declared=v2 / actual=v1），实际 ' + JSON.stringify(rep.drift));",
          "const st = JSON.parse(read('state.json'));",
          "assert.strictEqual(st.components.api.version, 'v2', 'S7/F-9：必须重新部署到目标版本 v2（不得改写 state.json 掩盖），实际 ' + st.components.api.version);",
          "const art = JSON.parse(read(path.join('artifacts', 'api.json')));",
          "assert.strictEqual(art.version, 'v2', 'S7：artifacts 必须与 state 重新一致（v2），实际 ' + art.version);",
          "assert.strictEqual(art.fingerprint, refShaFile(path.join(dir, 'blobs', 'api-v2.bin')), 'S7：artifacts 指纹必须对应 v2 的真实产物');",
        ], './index.js'),
        'check-legacy.js': E2_CHECK_LEGACY,
        'verify.js': ["require('./check-repair.js');", "require('./check-legacy.js');", "console.log('F12-E2 OK');"].join('\n'),
      },
    }),
    fix: { 'redeploy.js': DEPLOY_JS(), 'index.js': E2_INDEX(true) },
    fixRun: 'node pilot-workspace/FORMAL-F12-E2/run.js',
    preRun: { command: 'node pilot-workspace/FORMAL-F12-E2/check-repair.js', log: 'pilot-workspace/FORMAL-F12-E2/attempt-log.txt', scratch: true },
    required: ['drift_repaired', 'legacy_view_intact', 'report_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-repair.js', 'check-legacy.js', 'CONTRACT.md', 'canonical.js', 'lib/deploy-lib.js', 'lib/runtime.js', 'reconcile.js', 'legacy-view.json', 'snapshots/legacy-view.snap', 'snapshots/inputs/state.json', 'snapshots/inputs/artifacts/api.json', 'plan.json', 'state.json', 'history.jsonl', 'artifacts/api.json'],
    extraChecks: [
      { id: 'drift_repaired', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-E2/check-repair.js' },
      { id: 'legacy_view_intact', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F12-E2/check-legacy.js' },
      { id: 'report_written', kind: 'file_exists', path: 'report.json' },
    ],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '既有对账路径（reconcile.js）被冻结且其视图 legacy-view.json 有冻结快照，而新契约要求「报告 drift 并重新部署」（S7/F-9）；共享入口 index.js 是唯一可改的装配点 ⇒ 必须新增 drift 重新部署路径并重新装配（计划层重规划）⇒ REPLAN；真实预跑给出业务差异（state 被改写为 v1 而期望 v2）。',
    rationaleNot: 'DIRECT 指向受保护文件（reconcile.js / 冻结视图）；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const cfEvidence: Array<{ id: string; span: number | null; budget: number; verifyExit: number | null; rejected: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f12-evidence');
rmSync(EVIDENCE, { recursive: true, force: true });
mkdirSync(TASKS_DIR, { recursive: true });

for (const v of variants) {
  const base = `pilot-workspace/${v.id}`;
  for (const [rel, content] of Object.entries(v.files)) seedEntries.push({ path: `${base}/${rel}`, content });
  const uniform: Array<Record<string, unknown>> = [
    { id: 'verify_pass', kind: 'output_contains', command: `node ${base}/verify.js`, expect: v.token },
    { id: 'verify_script_changed', kind: 'file_unchanged', path: `${base}/verify.js` },
  ];
  const checks = [...uniform, ...(v.extraChecks ?? [])];
  const yaml = [
    `id: ${v.id}`, `category: ${v.category}`, 'status: draft', 'source: synthetic-formal',
    `task_type: ${v.taskType}`, `complexity: ${v.complexity}`, `scope: ${v.scope}`,
    `characteristics: [${v.characteristics.join(', ')}]`, `constraints: [${v.constraints.join(', ')}]`,
    'prompt: |', ...v.prompt.split('\n').map((l) => `  ${l}`),
    `expected_first_decisions: [${v.expected.join(', ')}]`, `expected_delegation: ${String(v.expectedDelegation)}`,
    'success_criteria:', '  required:', ...v.required.map((r) => `    - ${r}`), '  forbidden:', ...v.forbidden.map((f) => `    - ${f}`),
    'expected_files:', ...Object.keys(v.fix).map((f) => `  - ${base}/${f}`),
    'allowed_paths:', `  - ${base}/**`,
    'protected_paths:', `  - ${base}/verify.js`, ...PROTECTED(v).map((p) => `  - ${base}/${p}`),
    'verification:',
    ...checks.flatMap((c) => {
      const lines = [`  - id: ${String(c['id'])}`, `    kind: ${String(c['kind'])}`];
      if (c['command'] !== undefined) lines.push(`    command: ${String(c['command'])}`);
      if (c['expect'] !== undefined) lines.push(`    expect: ${JSON.stringify(String(c['expect']))}`);
      if (c['path'] !== undefined) {
        const p = String(c['path']);
        lines.push(`    path: ${p.startsWith('pilot-workspace/') ? p : `${base}/${p}`}`);
      }
      if (c['min_count'] !== undefined) lines.push(`    min_count: ${String(c['min_count'])}`);
      return lines;
    }),
    '',
  ].join('\n');
  writeFileSync(path.join(TASKS_DIR, `${v.id}.yaml`), yaml, 'utf8');

  const evDir = path.join(EVIDENCE, v.id);
  for (const [rel, content] of Object.entries(v.files)) {
    const p = path.join(evDir, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  let lastOut = '';
  let lastErr = '';
  const runVerify = (): number | null => {
    const oT = path.join(evDir, '.verify.out');
    const eT = path.join(evDir, '.verify.err');
    const of = openSync(oT, 'w');
    const ef = openSync(eT, 'w');
    let code: number | null = 0;
    try {
      execFileSync(process.execPath, ['verify.js'], { cwd: evDir, stdio: ['ignore', of, ef], timeout: 120_000 });
    } catch (e) {
      const st = (e as { status?: number | null }).status;
      code = typeof st === 'number' ? st : null;
    } finally {
      closeSync(of);
      closeSync(ef);
    }
    lastOut = readFileSync(oT, 'utf8');
    lastErr = readFileSync(eT, 'utf8');
    return code;
  };
  const readSpan = (tlPath: string): number | null => {
    if (!existsSync(tlPath)) return null;
    const es = readFileSync(tlPath, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { start: number; end: number });
    return es.length ? Math.max(...es.map((e) => e.end)) - Math.min(...es.map((e) => e.start)) : null;
  };
  const before = runVerify();
  // —— D1 反事实：同一批 fixture / 同一批组件 / 同一预算，仅把调度改为串行 ——
  if (v.counterfactual) {
    const cfPath = path.join(evDir, 'cf-serial.js');
    writeFileSync(cfPath, v.counterfactual, 'utf8');
    const run = runScriptCapture(evDir, cfPath);
    const vf = runScriptCapture(evDir, path.join(evDir, 'verify.js'));
    const span = readSpan(path.join(evDir, 'timeline.jsonl'));
    const rejected = vf.code !== 0 && /超预算/.test(vf.stdout + vf.stderr);
    cfEvidence.push({ id: v.id, span, budget: v.budget ?? 0, verifyExit: vf.code, rejected });
    console.log('  ' + v.id + ' 反事实(串行): run=' + String(run.code) + ' span=' + String(span) + 'ms 预算=' + String(v.budget) + 'ms verify_exit=' + String(vf.code) + ' 超预算拒绝=' + String(rejected));
    if (!rejected) console.log('      cf verify 输出：stdout=' + JSON.stringify(vf.stdout.trim().slice(0, 300)) + ' stderr=' + JSON.stringify(vf.stderr.trim().slice(0, 400)));
    rmSync(cfPath, { force: true });
  }
  for (const [rel, content] of Object.entries(v.fix)) {
    const p = path.join(evDir, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  if (v.fixRun) {
    try {
      const fx = runFixRunStrict(evDir, path.join(evDir, v.fixRun.split(' ')[1]!.replace('pilot-workspace/' + v.id + '/', '')));
      if (fx.kind !== 'EXIT' || fx.exitCode !== 0) throw new Error('fixRun 未成功: ' + JSON.stringify({ kind: fx.kind, exitCode: fx.exitCode, signal: fx.signal, spawnError: fx.spawnError }));
      const n = existsSync(path.join(evDir, 'timeline.jsonl')) ? readFileSync(path.join(evDir, 'timeline.jsonl'), 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
      console.log('  ' + v.id + ' AFTER fixRun: exit=0  timeline entries=' + n);
    } catch (e) {
      console.log('  ' + v.id + ' AFTER fixRun: exit!=0 (' + (e as { message?: string }).message + ')');
    }
  }
  const after = runVerify();
  if (after !== 0) {
    console.log('      ' + v.id + ' 修复后 verify 仍失败：stdout=' + JSON.stringify(lastOut.trim().slice(0, 300)) + ' stderr=' + JSON.stringify(lastErr.trim().slice(0, 400)));
  }
  nodeEvidence.push({ id: v.id, before, after, ok: before !== 0 && after === 0 });
}
rmSync(EVIDENCE, { recursive: true, force: true });

const loadResults = variants.map((v) => {
  const loaded = loadTask(parseYaml(readFileSync(path.join(TASKS_DIR, `${v.id}.yaml`), 'utf8')) as Record<string, unknown>);
  if (!loaded.ok) console.log(`  [诊断] ${v.id}：${JSON.stringify(loaded.issues)}`);
  return { v, loaded };
});

writeFileSync(
  SEEDS_MOD,
  `/**\n * benchmark/formal-seeds-f12.ts — F12 族 10 个变体的种子（由 scripts/formal-author-f12.ts 生成）\n */\nexport const FORMAL_F12_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f12.json');
const vtEvidence: Array<{ id: string; beforeOk: boolean | null; afterOk: boolean | null; status: string; cfg: number; pre?: string }> = [];
const preExit = new Map<string, number>();
const preExcerpt = new Map<string, string>();
{
  for (const v of variants) {
    const dir = path.join(ROOT, 'pilot-workspace', v.id);
    rmSync(dir, { recursive: true, force: true });
    for (const [rel, content] of Object.entries(v.files)) {
      const p = path.join(dir, rel);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, content, 'utf8');
    }
  }
  // —— 预跑（F-6：C/E 类都必须在任务目录内留下真实预跑日志）——
  const PRERUN = path.join(ROOT, 'pilot-workspace', '.f12-prerun');
  rmSync(PRERUN, { recursive: true, force: true });
  for (const v of variants) {
    if (!v.preRun) continue;
    const checkerName = v.preRun.command.split(' ')[1]!.split('/').pop()!;
    let code: number;
    let errText = '';
    let outText = '';
    if (v.preRun.scratch) {
      // 在 scratch 副本上真实执行未修复实现（任务初始状态保持冻结）
      const dir = path.join(PRERUN, v.id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(PRERUN, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
      for (const [rel, content] of Object.entries(v.files)) {
        const p = path.join(dir, rel);
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, content, 'utf8');
      }
      let runnerNote = '';
      if (v.preRun.serialFirst && v.counterfactual) {
        const cfPath = path.join(dir, 'cf-serial.js');
        writeFileSync(cfPath, v.counterfactual, 'utf8');
        const r = runScriptCapture(dir, cfPath);
        runnerNote = 'serial_counterfactual_exit=' + String(r.code);
      } else {
        const r = runScriptCapture(dir, path.join(dir, 'run.js'));
        runnerNote = 'unfixed_run_exit=' + String(r.code);
      }
      const chk = runScriptCapture(dir, path.join(dir, checkerName));
      code = chk.code === null ? 1 : chk.code;
      errText = chk.stderr;
      outText = chk.stdout + '\n' + runnerNote;
    } else {
      const script = path.join(ROOT, v.preRun.command.split(' ')[1]!);
      const r = runScriptCapture(ROOT, script);
      code = r.code === null ? 1 : r.code;
      errText = r.stderr;
      outText = r.stdout;
    }
    const logPath = path.join(ROOT, v.preRun.log);
    writeFileSync(
      logPath,
      ['# 预跑记录（冻结环境中实际执行，非人工撰写）', 'command: ' + v.preRun.command, 'mode: ' + (v.preRun.scratch ? 'scratch（在任务输入副本上执行未修复实现，任务初始状态保持冻结）' : 'in-place（checker 纯读取）'), 'exit_code: ' + String(code), 'stdout:', outText.trim(), 'stderr:', errText.trim(), ''].join('\n'),
      'utf8',
    );
    const errLines = (errText || outText).split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const picked =
      errLines.find((l) => /AssertionError \[ERR_ASSERTION\]|AssertionError:/.test(l)) ??
      errLines.find((l) => /Error:.*\S/.test(l) && !/^(throw|\^)/.test(l)) ??
      errLines.find((l) => /actual|expected|超预算/i.test(l)) ??
      errLines.slice(0, 3).join(' ⏎ ');
    preExcerpt.set(v.id, picked.slice(0, 320));
    preExit.set(v.id, code);
    console.log('  预跑 ' + v.id + '：' + v.preRun.command + '（' + (v.preRun.scratch ? 'scratch' : 'in-place') + '） → exit=' + String(code));
  }
  rmSync(PRERUN, { recursive: true, force: true });
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F12', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F12) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
  for (const { v, loaded } of loadResults) {
    if (!loaded.ok) {
      vtEvidence.push({ id: v.id, beforeOk: null, afterOk: null, status: 'SCHEMA_FAIL', cfg: 0 });
      continue;
    }
    const before = verifyTask(loaded.task);
    for (const [rel, content] of Object.entries(v.fix)) {
      const p = path.join(ROOT, 'pilot-workspace', v.id, rel);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, content, 'utf8');
    }
    if (v.fixRun) {
      try {
        const fx = runFixRunStrict(path.join(ROOT, 'pilot-workspace', v.id), path.join(ROOT, v.fixRun.split(' ')[1]!));
        if (fx.kind !== 'EXIT' || fx.exitCode !== 0) throw new Error('fixRun 未成功: ' + JSON.stringify({ kind: fx.kind, exitCode: fx.exitCode, signal: fx.signal, spawnError: fx.spawnError }));
        const n = existsSync(path.join(ROOT, 'pilot-workspace', v.id, 'timeline.jsonl')) ? readFileSync(path.join(ROOT, 'pilot-workspace', v.id, 'timeline.jsonl'), 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
        console.log('  ' + v.id + ' AFTER fixRun: exit=0  timeline entries=' + n);
      } catch (e) {
        console.log('  ' + v.id + ' AFTER fixRun: exit!=0 (' + (e as { message?: string }).message + ')');
      }
    }
    const after = verifyTask(loaded.task);
    vtEvidence.push({ id: v.id, beforeOk: before.success, afterOk: after.success, status: String(after.verification_status), cfg: after.config_errors.length, pre: v.preRun ? 'exit=' + String(preExit.get(v.id)) : undefined });
    rmSync(path.join(ROOT, 'pilot-workspace', v.id), { recursive: true, force: true });
  }
  rmSync(String(process.env['DSH_FORMAL_BASELINE']), { force: true });
}
delete process.env['DSH_VERIFY_DATASET'];
delete process.env['DSH_FORMAL_BASELINE'];

writeJsonUtf8(GT_DRAFTS, {
  family: 'F12', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F12', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F12 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> **领域边界（逐字保留）**：',
  '> `F12 = system state transition orchestration（deploy / upgrade / rollback / recovery）`；',
  '> `F04 = 单个事件驱动的状态机语义（event → state）`；`F10 = 数据 / schema 迁移（schema/data → migrated data）`。',
  '> F12 研究：多个部署阶段、检查点与失败恢复条件下，系统状态如何按既定迁移策略安全地从旧版本到新版本，并在失败时恢复到**允许状态集合**之内。',
  '> F12 不研究：单个状态机 transition correctness（F04）· 数据/schema 迁移本身（F10）· 通用 workflow 本身 · quota/permission/template/query/lockfile（F08/F06/F09/F11/F05/F07）。',
  '> **特别原则**：D2 的 WORKFLOW 构念是**部署依赖导致的迁移顺序约束**（拓扑序 + 前置版本约束），不是"任务复杂所以用 Workflow"；',
  '> C1/C2 把 **deploy failure** 与 **rollback recovery failure** 作为两个不同 failure mode；"失败"的定义见 S8（业务侧正常返回不得触发 rollback）。',
  '> **契约**：S1–S10 逐变体写死在 CONTRACT.md；另含本族新增冻结项 **F-1..F-9**（终态与 report canonical 字段序 / reason 六项全序 / state·history 闭集 / 回滚免相邻性 / C·E 预跑日志 / LKG 基准 / 拒绝时 artifact 范围 / drift 处置）。',
  '> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed（LOCKED，门槛 = 全 120 槽位冻结）。',
  '',
  '## 本族新增冻结项（起草方按人工授权的最小惊讶原则冻结，便于事后否决）',
  '',
  '- **F-1**：`status ∈ ["deployed","rolled_back","halted","rejected"]`；`decision ∈ ["proceed","rejected"]`。',
  '- **F-2**：`report.json` 字段序 `(plan_id, decision, reason, status, drift[], affected_components[], rollback_count, final_state{})`，组件名序数排序。',
  '- **F-3**：reason 六项全序 `version_mismatch > in_flight > target_not_declared > target_not_adjacent > dependency_cycle > no_lkg`。',
  '- **F-4**：state/history 的字段序与闭集见 S10。',
  '- **F-5**：S2 相邻性只约束 **deploy** 迁移；回滚恢复到 LKG 允许跨版本。',
  '- **F-6**：C 类与 E 类都必须在任务目录内留真实预跑日志（未修复态 exit≠0）。',
  '- **F-7**：LKG 一律基于**本次尝试之前**的 history 计算。',
  '- **F-8**：拒绝时"任何 artifact 不变"指 state/history/artifacts/blobs；`report.json` 例外（必须写出拒绝结论）。',
  '- **F-9**：drift 处置 = 以 actual 为有效当前版本重新部署推进到目标版本，并在 `report.drift` 如实列出。',
  '',
  '| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |',
  '|---|---|---|---|---|---|---|---|',
  ...variants.map((v) => {
    const ne = nodeEvidence.find((e) => e.id === v.id)!;
    const vt = vtEvidence.find((e) => e.id === v.id)!;
    return `| ${v.id} | ${v.category} | ${v.variant} | ${v.expected.join('\\|')} | ${String(v.expectedDelegation)} | ${String(ne.before)} → ${String(ne.after)} ${ne.ok ? '✓' : '⚠️'} | ${String(vt.beforeOk)} → ${String(vt.afterOk)} ${vt.status} ${vt.beforeOk === false && vt.afterOk === true && vt.cfg === 0 ? '✓' : '⚠️'} | ${vt.pre ?? '—'} |`;
  }),
  '',
];
if (cfEvidence.length) {
  md.push(
    '## 调度反事实证明（同 fixture / 同组件集合 / 同单组件耗时 / 同预算，仅改调度）',
    '',
    '| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |',
    '|---|---|---|---|---|',
    ...cfEvidence.map((c) => `| ${c.id} | ${String(c.span)} ms | ${c.budget} ms | ${String(c.verifyExit)} | ${c.rejected ? '✓（命中「总耗时超预算」）' : '⚠️'} |`),
    '',
    '> 串行反事实与正式证据使用同一批组件工具、同一批输入与同一预算，唯一差异是调度方式；',
    '> 正式证据另要求每个组件产物与最终状态/历史/报告都与 checker 内嵌**独立参考编排**逐字节一致（且交付实现必须在冻结输入上重跑得到同一结果）。',
    '',
  );
}
for (const { v, loaded } of loadResults) {
  const ne = nodeEvidence.find((e) => e.id === v.id)!;
  const vt = vtEvidence.find((e) => e.id === v.id)!;
  const cf = cfEvidence.find((c) => c.id === v.id);
  md.push(
    `## ${v.id}（${v.category} 类 · 变体 ${v.variant}）`, '',
    `**标题**：${v.title}`, '',
    '**任务描述**：', '```', v.prompt, '```', '',
    `**expected_first_decisions**：\`[${v.expected.join(', ')}]\`　**expected_delegation**：\`${String(v.expectedDelegation)}\``, '',
    `- 候选集合校验：${loaded.ok ? 'PASS' : 'FAIL'}`,
    `- CDA 布尔轴校验：PASS（派生 = ${String(v.expectedDelegation)}）`,
    `- protected_paths：${PROTECTED(v).length + 1} 条（已剔除由实现收敛的交付物 state/history/artifacts）`, '',
    `**验证规则**：required = ${v.required.join(', ')}；forbidden = ${v.forbidden.join(', ')}`, '',
    `**验证证据**：node verify.js ${String(ne.before)} → ${String(ne.after)}；verifyTask ${String(vt.beforeOk)} → ${String(vt.afterOk)}（status=${vt.status}，CONFIG_ERROR=${vt.cfg}）${v.preRun ? `；真实预跑 ${v.preRun.command} → exit=${String(preExit.get(v.id))}（${v.preRun.scratch ? 'scratch' : 'in-place'}）` : ''}`, '',
    ...(v.preRun ? [`**预跑断言（原文摘录）**：\`${preExcerpt.get(v.id) ?? ''}\``, ''] : []),
    ...(cf ? [`**调度反事实**：串行 span=${String(cf.span)} ms > 预算 ${cf.budget} ms；串行 verify exit=${String(cf.verifyExit)}，${cf.rejected ? '被 verify 以「总耗时超预算」拒绝' : '未被拒绝（异常）'}。`, ''] : []),
    `**为什么这些 first_decision 属于 GT**：${v.rationaleGt}`, '',
    `**为什么其他候选不属于 GT**：${v.rationaleNot}`, '',
    `**签署**：\`gt_signed_by: ________\`　\`gt_signed_at: ________\``, '',
  );
}
writeFileSync(REVIEW, md.join('\n'), 'utf8');

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f12.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(VERSION, {
  dataset: 'formal', family: 'F12', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
const cfgTotal = vtEvidence.reduce((a, e) => a + e.cfg, 0);
const preOk = vtEvidence.filter((e) => e.pre !== undefined && e.pre !== 'exit=0').length;
const preDeclared = vtEvidence.filter((e) => e.pre !== undefined).length;
const cfOk = cfEvidence.filter((c) => c.rejected).length;
console.log('\n=== F12 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${cfgTotal}；success=null 总数 = ${vtEvidence.filter((e) => e.beforeOk === null || e.afterOk === null).length}`);
console.log(`  C/E 类真实预跑  = ${preOk}/${preDeclared} 以非 0 退出`);
console.log(`  调度反事实      = ${cfOk}/${cfEvidence.length} 被 verify 以「超预算」拒绝`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F12-*.yaml · formal-seeds-f12.ts · f12-review.md · f12-gt-drafts.json · f12-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length && cfgTotal === 0 && preOk === preDeclared && cfOk === cfEvidence.length;
console.log(allOk ? '✅ F12 起草 + 三层证据全部通过（等待人工逐条构念审查与签署；本轮不签署/不冻结/不 commit）' : '⛔ 存在问题，见 f12-review.md');
process.exit(allOk ? 0 : 3);
