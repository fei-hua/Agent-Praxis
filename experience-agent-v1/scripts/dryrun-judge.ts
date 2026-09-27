/**
 * scripts/dryrun-judge.ts — dry-run 任务判定（§9.2，全部确定性代码，不进模型 prompt）
 *
 * 用法：node scripts/dryrun-judge.ts --task DRY-01 --primary <sessionId> [--children <id1,id2>]
 * 输出：dry-run-workspace/judge-<task>.json（供 dryrun-collect 消费）
 *
 * 判定规则（spec/frozen.md §9.2，冻结）：
 *   success_criteria_passed：所有 success criteria 的检查结果；
 *   no_forbidden_violation：禁改文件 hash diff；
 *   verification_executed：调用了成功条件验证工具；
 *   subagent_used_when_expected：expected_first_decisions 命中委派时检查 subagent 使用记录。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, openSync, readFileSync, closeSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { extractSubagentInvocations, extractToolCalls } from '../telemetry/extract.ts';
import { findSessionLog, decodeSessionLog } from '../telemetry/session-log.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const WS_DIR = path.join(PROJECT_ROOT, 'dry-run-workspace');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sha256File(p: string): string {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** 子进程执行并捕获输出（stdio 重定向到临时文件，规避沙箱命名管道限制） */
function runNode(scriptRel: string): { ok: boolean; output: string } {
  const script = path.join(WS_DIR, scriptRel);
  const outTmp = path.join(WS_DIR, '.judge-stdout.txt');
  const errTmp = path.join(WS_DIR, '.judge-stderr.txt');
  const outFd = openSync(outTmp, 'w');
  const errFd = openSync(errTmp, 'w');
  let ok = false;
  try {
    const r = execFileSync(process.execPath, [script], {
      cwd: path.dirname(script),
      stdio: ['ignore', outFd, errFd],
      timeout: 30_000,
    });
    ok = r !== null;
  } catch {
    ok = false;
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
  const output = readFileSync(outTmp, 'utf8') + readFileSync(errTmp, 'utf8');
  return { ok, output };
}

interface JudgeOutput {
  task_id: string;
  success_criteria_results: Array<{ criterion: string; passed: boolean; evidence: string }>;
  forbidden_file_changes: string[];
  verification_tool_called: boolean;
  subagent_invocations: number;
  task_success: boolean;
  wall_time_ms: number;
}

function sessionFacts(primaryId: string, childIds: string[]) {
  const dshHome = path.join(process.env['USERPROFILE'] ?? '', '.dsh');
  const primaryLog = decodeSessionLog(findSessionLog(dshHome, primaryId).logPath);
  // 子会话：显式参数优先，否则从执行会话的 subagent/catalog 自动派生
  const catalogChildren = primaryLog.events
    .filter((e) => e.type === 'subagent/catalog')
    .map((e) => String((e.data as { childId?: unknown }).childId ?? ''))
    .filter(Boolean);
  const resolved = childIds.length > 0 ? childIds : catalogChildren;
  const logs = [primaryLog, ...resolved.map((cid) => decodeSessionLog(findSessionLog(dshHome, cid).logPath))];
  const calls = logs.flatMap((l) => extractToolCalls(l.events));
  const callsText = calls.map((c) => `${c.tool_name} ${JSON.stringify(c.arguments)}`);
  const subs = extractSubagentInvocations(logs[0]!.events);
  const subCount = subs.invocations.length;
  const times = logs[0]!.events.map((e) => e.time);
  const wall = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
  return { callsText, subCount, wall, logs };
}

function seedHashes(): Record<string, string> {
  return (JSON.parse(readFileSync(path.join(WS_DIR, 'seed-hashes.json'), 'utf8')) as { files: Record<string, string> }).files;
}

function changed(rel: string, hashes: Record<string, string>): boolean {
  const p = path.join(WS_DIR, rel);
  return !existsSync(p) || sha256File(p) !== hashes[rel];
}

function judgeTask(taskId: string, facts: ReturnType<typeof sessionFacts>): JudgeOutput {
  const hashes = seedHashes();
  const R: JudgeOutput['success_criteria_results'] = [];
  const forbidden: string[] = [];
  let verificationCalled = false;
  const add = (criterion: string, passed: boolean, evidence: string) => R.push({ criterion, passed, evidence });

  const called = (needle: string) => facts.callsText.some((t) => t.includes(needle));

  if (taskId === 'DRY-01') {
    const smokePath = path.join(WS_DIR, 'DRY-01/src/smoke.test.js');
    add('dry-run-workspace/DRY-01/src/smoke.test.js 存在', existsSync(smokePath), existsSync(smokePath) ? '文件存在' : '文件缺失');
    const run = runNode('DRY-01/src/smoke.test.js');
    add('node dry-run-workspace/DRY-01/src/smoke.test.js 的输出包含 SMOKE PASS', run.output.includes('SMOKE PASS'), run.output.slice(0, 200));
    const counterChanged = changed('DRY-01/src/counter.js', hashes);
    if (counterChanged) forbidden.push('DRY-01/src/counter.js');
    add('counter.js 未被修改（哈希不变）', !counterChanged, counterChanged ? '哈希变化' : '哈希一致');
    verificationCalled = called('smoke.test.js');
    add('轨迹中存在至少一次对 smoke.test.js 的执行（成功条件验证）', verificationCalled, verificationCalled ? '会话含 smoke.test.js 执行' : '会话无执行记录');
  } else if (taskId === 'DRY-02') {
    const docsPath = path.join(WS_DIR, 'DRY-02/docs.md');
    const docs = existsSync(docsPath) ? readFileSync(docsPath, 'utf8') : '';
    add('dry-run-workspace/DRY-02/docs.md 存在', docs !== '', docs === '' ? '文件缺失' : `长度 ${docs.length}`);
    const all = ['alpha.js', 'beta.js', 'gamma.js'].every((f) => docs.includes(f));
    add('docs.md 提及 alpha.js、beta.js、gamma.js 三个文件名', all, all ? '三个文件名齐全' : '有文件名缺失');
    const relation = docs.includes('→') || docs.includes('调用');
    add('docs.md 含至少一处调用关系表述（→ 或 调用）', relation, relation ? '含调用关系表述' : '缺少调用关系表述');
    const libChanged = ['alpha.js', 'beta.js', 'gamma.js'].some((f) => changed(`DRY-02/mini-lib/${f}`, hashes));
    if (libChanged) forbidden.push('DRY-02/mini-lib/');
    add('mini-lib/ 下文件未被修改', !libChanged, libChanged ? '存在哈希变化' : '哈希一致');
    verificationCalled = called('mini-lib');
    add('轨迹中存在对 mini-lib 的读取/检查（成功条件验证）', verificationCalled, verificationCalled ? '会话含 mini-lib 读取记录' : '会话无读取记录');
  } else if (taskId === 'DRY-03') {
    const cssPath = path.join(WS_DIR, 'DRY-03/ui.css');
    const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
    const pxValues = [...css.matchAll(/(?:margin|padding)\s*:\s*([^;]+);/g)].flatMap((m) =>
      (m[1] ?? '').split(/\s+/).map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n)),
    );
    const allEight = pxValues.length > 0 && pxValues.every((v) => v % 8 === 0 && v > 0);
    add('ui.css 中全部 margin/padding 的 px 值为 8 的倍数', allEight, `解析到值：[${pxValues.join(',')}]`);
    const reviewPath = path.join(WS_DIR, 'DRY-03/ui-review.md');
    const review = existsSync(reviewPath) ? readFileSync(reviewPath, 'utf8') : '';
    const risks = (review.match(/风险/g) ?? []).length;
    add('dry-run-workspace/DRY-03/ui-review.md 存在且列出至少 2 条 UI 越界风险', review !== '' && risks >= 2, review === '' ? '文件缺失' : `「风险」出现 ${risks} 次`);
    add('轨迹中存在至少 1 次 subagent 调用', facts.subCount >= 1, `subagent 调用数=${facts.subCount}`);
    // 选择器结构：类名集合不变（种子 = .card/.button/.nav）
    const selectors = (s: string) => [...s.matchAll(/([.#][\w-]+)/g)].map((m) => m[1]).sort().join(',');
    const seedSelectors = ['.card', '.button', '.nav'].sort().join(',');
    const structureOk = selectors(css) === seedSelectors;
    if (!structureOk) forbidden.push('DRY-03/ui.css(选择器结构)');
    add('ui.css 的选择器结构未被修改', structureOk, `当前选择器：${selectors(css)}`);
    verificationCalled = called('ui.css');
    add('轨迹中存在对 ui.css 的检查（成功条件验证）', verificationCalled, verificationCalled ? '会话含 ui.css 读取/修改记录' : '会话无记录');
  } else if (taskId === 'DRY-04') {
    const auditPath = path.join(WS_DIR, 'DRY-04/schema-audit.md');
    const audit = existsSync(auditPath) ? readFileSync(auditPath, 'utf8') : '';
    const fields = ['id', 'created_at', 'amount', 'tags'];
    const allFields = audit !== '' && fields.every((f) => audit.includes(f));
    add('dry-run-workspace/DRY-04/schema-audit.md 存在且含字段清单', allFields, audit === '' ? '文件缺失' : allFields ? '字段齐全' : '字段缺失');
    const verifyPath = path.join(WS_DIR, 'DRY-04/schema-verify.txt');
    const verifyTxt = existsSync(verifyPath) ? readFileSync(verifyPath, 'utf8') : '';
    add('dry-run-workspace/DRY-04/schema-verify.txt 存在且包含 SCHEMA OK', verifyTxt.includes('SCHEMA OK'), verifyTxt.slice(0, 120));
    add('轨迹中存在至少 2 次 subagent 调用', facts.subCount >= 2, `subagent 调用数=${facts.subCount}`);
    const schemaChanged = changed('DRY-04/schema.json', hashes);
    if (schemaChanged) forbidden.push('DRY-04/schema.json');
    add('schema.json 未被修改（哈希不变）', !schemaChanged, schemaChanged ? '哈希变化' : '哈希一致');
    verificationCalled = called('verify-schema.js');
    add('轨迹中存在对 verify-schema.js 的执行（成功条件验证）', verificationCalled, verificationCalled ? '会话含执行记录' : '会话无执行记录');
  } else if (taskId === 'DRY-05') {
    const run = runNode('DRY-05/run-check.js');
    add('node dry-run-workspace/DRY-05/run-check.js 的输出包含 ALL PASS', run.output.includes('ALL PASS'), run.output.slice(0, 200));
    const checkPath = path.join(WS_DIR, 'DRY-05/run-check.js');
    const checkSrc = existsSync(checkPath) ? readFileSync(checkPath, 'utf8') : '';
    const asserts = (checkSrc.match(/assert\(/g) ?? []).length;
    add('run-check.js 的检查断言未被删除（断言数量不减）', asserts >= 3, `assert( 出现 ${asserts} 次`);
    if (changed('DRY-05/run-check.js', hashes)) forbidden.push('DRY-05/run-check.js');
    verificationCalled = called('run-check.js');
    add('轨迹中存在对 run-check.js 的执行（成功条件验证）', verificationCalled, verificationCalled ? '会话含执行记录' : '会话无执行记录');
  } else {
    throw new Error(`未知任务：${taskId}`);
  }

  const taskSuccess = R.every((r) => r.passed) && forbidden.length === 0 && verificationCalled;
  return {
    task_id: taskId,
    success_criteria_results: R,
    forbidden_file_changes: forbidden,
    verification_tool_called: verificationCalled,
    subagent_invocations: facts.subCount,
    task_success: taskSuccess,
    wall_time_ms: facts.wall,
  };
}

function main(): void {
  const taskId = arg('task');
  const primaryId = arg('primary');
  if (!taskId || !primaryId) throw new Error('必填参数：--task --primary [--children]');
  const childIds = (arg('children') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const facts = sessionFacts(primaryId, childIds);
  const out = judgeTask(taskId, facts);
  mkdirSync(WS_DIR, { recursive: true });
  const outPath = path.join(WS_DIR, `judge-${taskId}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`judge 写入 ${outPath}`);
  console.log(JSON.stringify({ task_success: out.task_success, passed: out.success_criteria_results.filter((r) => r.passed).length, total: out.success_criteria_results.length, forbidden: out.forbidden_file_changes, verification: out.verification_tool_called, subagents: out.subagent_invocations }, null, 2));
}

main();
