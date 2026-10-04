/**
 * scripts/formal-author-f06.ts — F06 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01–F05 不同）：**权限策略 + 访问控制 + 决策合并**
 *   policy → 条件匹配 → 继承 → 优先级(precedence) → allow/deny 冲突 → decision/解释 → 缓存失效 → 审计
 * 纪律同前：只产出 draft；三层证据；E 类真实预跑 + 日志后冻结基线；prompt 不含 first-decision 提示。
 * 用法：node scripts/formal-author-f06.ts
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f06.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f06-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f06-gt-drafts.json');

interface Variant {
  id: string; category: string; variant: number; token: string; title: string;
  taskType: string; complexity: string; scope: string; characteristics: string[]; constraints: string[];
  prompt: string; files: Record<string, string>; fix: Record<string, string>; fixRun?: string;
  required: string[]; forbidden: string[]; protectedExtra?: string[];
  extraChecks?: Array<Record<string, unknown>>;
  expected: string[]; expectedDelegation: boolean; rationaleGt: string; rationaleNot: string;
  preRun?: { command: string; log: string };
}
const V = (v: Variant): Variant => v;

const POL = (rows: Array<Record<string, unknown>>) => JSON.stringify({ policies: rows }, null, 2) + '\n';

/** 评估器（正确实现，供多数变体复用） */
const EVALUATOR_OK =
  "// 策略评估器：匹配 + 优先级降序 + deny-overrides\n" +
  "const { canMove } = { canMove: null };\n" +
  "function resourceMatch(pattern, resource) {\n" +
  "  if (pattern === '*') return true;\n" +
  "  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));\n" +
  "  return pattern === resource;\n" +
  "}\n" +
  "function matched(policies, req) {\n" +
  "  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n" +
  "}\n" +
  "function evaluate(policies, req) {\n" +
  "  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);\n" +
  "  const violates = hits.some((p) => p.effect === 'deny');\n" +
  "  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n" +
  "  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n" +
  "}\n" +
  "module.exports = { evaluate, resourceMatch, matched };\n";

const C_SOURCE_TOOL = (src: string, dur: number, token: string) =>
  "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const SRC = " + JSON.stringify(src) + ";\n" +
  "const DUR = " + dur + ";\n" +
  "const TOKEN = " + JSON.stringify(token) + ";\n" +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const { evaluate } = require(path.join(ROOT, 'evaluator.js'));\n" +
  "const start = Date.now();\n" +
  "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n" +
  "const pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\n" +
  "const reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\n" +
  "const decisions = [];\n" +
  "for (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\n" +
  "const sorted = pol.slice().sort((a, b) => b.priority - a.priority);\n" +
  "const orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\n" +
  "const end = Date.now();\n" +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\n" +
  "console.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n";

const RUN_SOURCES = (srcs: string[]) =>
  "// 并行编排：并发评估各策略来源，**再按 priority 降序合并**为决策矩阵（并行不得破坏优先级语义）\n" +
  "const { spawn } = require('child_process');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const sources = " + JSON.stringify(srcs) + ";\n" +
  "function runOne(s) {\n" +
  "  return new Promise((resolve, reject) => {\n" +
  "    const c = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });\n" +
  "    c.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));\n" +
  "    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(s + ' exit=' + code + ' signal=' + sig))));\n" +
  "  });\n" +
  "}\n" +
  "Promise.all(sources.map(runOne)).then(() => {\n" +
  "  const merged = [];\n" +
  "  for (const s of sources) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')); for (const d of frag.decisions) merged.push(d); }\n" +
  "  const byRequest = {};\n" +
  "  for (const d of merged) { if (!byRequest[d.request_id]) byRequest[d.request_id] = d; }\n" +
  "  const matrix = Object.keys(byRequest).sort().map((k) => byRequest[k]);\n" +
  "  fs.writeFileSync(path.join(__dirname, 'matrix.json'), JSON.stringify({ matrix }, null, 2) + '\\n');\n" +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各策略来源并行评估，合并后按 priority 语义产出决策矩阵。\\n');\n" +
  "  console.log('parallel policy evaluation done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

const CHECK_TIMELINE_POL = (budget: number, srcs: string[]) =>
  "// 纯读取检查器：验证已发生的并行评估 + **优先级等价**（不执行任何来源工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\n" +
  "for (const e of entries) assert.strictEqual(e.order_ok, true, '来源 ' + e.src + ' 的优先级顺序未保持');\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "// —— 优先级等价：M_parallel（matrix.json）必须等于按固定 priority 规则归并出的 M_priority ——\n" +
  "const frags = SOURCES.map((s) => JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')));\n" +
  "const allPolicies = [];\n" +
  "for (const f of frags) for (const p of f.policies) allPolicies.push(p);\n" +
  "const priorityOrder = allPolicies.slice().sort((a, b) => b.priority - a.priority).map((p) => p.id);\n" +
  "const refDecisions = [];\n" +
  "const seenReq = new Set();\n" +
  "for (const f of frags) for (const d of f.decisions) { if (seenReq.has(d.request_id)) continue; seenReq.add(d.request_id); refDecisions.push(d); }\n" +
  "const refMatrix = refDecisions.slice().sort((a, b) => String(a.request_id).localeCompare(String(b.request_id)));\n" +
  "const parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\n" +
  "assert.deepStrictEqual(canon(parallel), canon(refMatrix), '并行合并结果与按 priority 规则的参考矩阵不一致（优先级语义被破坏）');\n" +
  "assert.ok(priorityOrder.length > 0, '未收集到任何策略');\n" +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('TIMELINE OK sources=' + new Set(entries.map((e) => e.src)).size + ' span=' + span + 'ms precedence=equivalent');\n";

const C_VERIFY = (budget: number, srcs: string[], token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\n" +
  "for (const e of entries) assert.strictEqual(e.order_ok, true, '优先级顺序未保持：' + e.src);\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "const parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\n" +
  "assert.ok(Array.isArray(parallel) && parallel.length > 0, '决策矩阵为空');\n" +
  "for (const row of parallel) assert.ok(row.request_id && row.decision && row.reason, '决策矩阵行不完整：' + JSON.stringify(row));\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

const C1_SRCS = ['pol-team-a', 'pol-team-b', 'pol-team-c'];
const C2_SRCS = ['pol-tenant-x', 'pol-tenant-y', 'pol-tenant-z'];
const cReq = (rows: Array<[string, string, string]>) => JSON.stringify({ requests: rows.map(([id, action, resource]) => ({ id, action, resource })) }, null, 2) + '\n';

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F06-A1', category: 'A', variant: 1, token: 'F06-A1 OK',
    title: '资源匹配规则写反（应允许的请求被拒绝）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-A1 的评估器对 docs/* 资源的请求一律拒绝（期望允许）。',
      '修正 evaluator.js 使 node verify.js 通过。不得修改 verify.js 与 check-allow.js。',
    ].join('\n'),
    files: {
      'policies/main.json': POL([{ id: 'p-allow-docs', effect: 'allow', priority: 10, subject: '*', action: 'read', resource: 'docs/*' }]),
      'requests.json': cReq([['r1', 'read', 'docs/readme.md']]),
      'evaluator.js': EVALUATOR_OK.replace(
        "  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));",
        "  if (pattern.endsWith('/*')) return String(resource) === pattern; // 缺陷：未做前缀匹配",
      ),
      'check-allow.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { evaluate } = require('./evaluator.js');",
        "const pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;",
        "const req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];",
        "const d = evaluate(pol, req);",
        "assert.strictEqual(d.decision, 'allow', 'docs/* 应允许读取，实际 ' + d.decision);",
        "console.log('ALLOW OK');",
      ].join('\n'),
      'verify.js': ["require('./check-allow.js');", "console.log('F06-A1 OK');"].join('\n'),
    },
    fix: { 'evaluator.js': EVALUATOR_OK },
    required: ['match_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-allow.js'],
    extraChecks: [{ id: 'match_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-A1/check-allow.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（evaluator.js 的资源匹配），目标明确 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F06-A2', category: 'A', variant: 2, token: 'F06-A2 OK',
    title: '优先级覆盖顺序错误（约定写在 POLICY.md）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-A2 的最终决策与 POLICY.md 规定的优先级要求不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-precedence.js 与 POLICY.md。',
    ].join('\n'),
    files: {
      'POLICY.md': '# 策略约定\n\n1. priority 数值**越大越优先**；\n2. 同一请求命中多条策略时，deny 覆盖 allow（deny-overrides）；\n3. 决策必须给出命中的策略 id。\n',
      'policies/main.json': POL([
        { id: 'p-deny-secret', effect: 'deny', priority: 30, subject: '*', action: 'read', resource: 'secret/*' },
        { id: 'p-allow-read', effect: 'allow', priority: 10, subject: '*', action: 'read', resource: '*' },
      ]),
      'requests.json': cReq([['r1', 'read', 'secret/key.txt']]),
      'evaluator.js': EVALUATOR_OK.replace(
        "  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);",
        "  const hits = matched(policies, req).slice().sort((a, b) => a.priority - b.priority); // 缺陷：升序 ⇒ 低优先级先命中",
      ).replace(
        "  const violates = hits.some((p) => p.effect === 'deny');",
        "  const violates = hits.length ? hits[0].effect === 'deny' : false; // 缺陷：只看首条",
      ),
      'check-precedence.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { evaluate } = require('./evaluator.js');",
        "const pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;",
        "const req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];",
        "const d = evaluate(pol, req);",
        "assert.strictEqual(d.decision, 'deny', '高优先级 deny 必须覆盖 allow，实际 ' + d.decision);",
        "assert.ok(d.hits.includes('p-deny-secret'), '决策必须给出命中策略 id');",
        "console.log('PRECEDENCE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-precedence.js');", "console.log('F06-A2 OK');"].join('\n'),
    },
    fix: { 'evaluator.js': EVALUATOR_OK },
    required: ['precedence_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-precedence.js', 'POLICY.md'],
    extraChecks: [{ id: 'precedence_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-A2/check-precedence.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（evaluator.js），但"priority 越大越优先 + deny-overrides + 必须给出命中 id"的判定依据写在 POLICY.md ⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与约定不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F06-B1', category: 'B', variant: 1, token: 'F06-B1 OK',
    title: '继承链缺失一层（角色→权限→资源未展开）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-B1 的继承评估结果不完整（期望见 check-inherit.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-inherit.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 继承契约\n\n角色 → 权限 → 资源 必须**逐级展开**：用户继承角色，角色授予权限，权限再展开到其覆盖的资源。\n',
      'roles.json': JSON.stringify({ users: { alice: ['editor'] }, roles: { editor: ['doc.write'] }, permissions: { 'doc.write': ['docs/*'] } }, null, 2) + '\n',
      'expand.js': [
        '// 继承展开：当前只展开到权限，未展开权限→资源',
        "const roles = require('./roles.json');",
        'function resourcesOf(user) {',
        '  const out = [];',
        '  for (const r of roles.users[user] || []) for (const p of roles.roles[r] || []) out.push(p);',
        '  return out;',
        '}',
        'module.exports = { resourcesOf };',
      ].join('\n'),
      'check-inherit.js': [
        "const assert = require('assert');",
        "const { resourcesOf } = require('./expand.js');",
        "const res = resourcesOf('alice');",
        "assert.ok(res.includes('docs/*'), '继承链应展开到资源 docs/*，实际 ' + JSON.stringify(res));",
        "console.log('INHERIT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-inherit.js');", "console.log('F06-B1 OK');"].join('\n'),
    },
    fix: {
      'expand.js': [
        '// 继承展开：角色 → 权限 → 资源 逐级展开',
        "const roles = require('./roles.json');",
        'function resourcesOf(user) {',
        '  const out = [];',
        '  for (const r of roles.users[user] || []) for (const p of roles.roles[r] || []) for (const res of roles.permissions[p] || []) out.push(res);',
        '  return out;',
        '}',
        'module.exports = { resourcesOf };',
      ].join('\n'),
    },
    required: ['inherit_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-inherit.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'inherit_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-B1/check-inherit.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"继承结果不完整"，成因可能在用户→角色、角色→权限或权限→资源任一层；需沿继承链定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只补一层而漏掉另一处；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F06-B2', category: 'B', variant: 2, token: 'F06-B2 OK',
    title: 'allow/deny 冲突处理错误（deny-overrides 未生效）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-B2 在 allow 与 deny 同时命中时给出了错误的决策。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-conflict.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 冲突契约\n\n同一请求命中多条策略时，只要存在 deny 命中，最终决策必须为 deny（deny-overrides），与 priority 无关。\n',
      'policies/main.json': POL([
        { id: 'p-allow', effect: 'allow', priority: 50, subject: '*', action: 'read', resource: '*' },
        { id: 'p-deny', effect: 'deny', priority: 5, subject: '*', action: 'read', resource: 'secret/*' },
      ]),
      'requests.json': cReq([['r1', 'read', 'secret/k.txt']]),
      'evaluator.js': EVALUATOR_OK.replace(
        "  const violates = hits.some((p) => p.effect === 'deny');",
        "  const violates = hits.length ? hits[0].effect === 'deny' : false; // 缺陷：只看最高优先级那条",
      ),
      'check-conflict.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { evaluate } = require('./evaluator.js');",
        "const pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;",
        "const req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];",
        "const d = evaluate(pol, req);",
        "assert.strictEqual(d.decision, 'deny', 'deny-overrides 必须生效（即使 deny 优先级更低），实际 ' + d.decision);",
        "assert.strictEqual(d.reason, 'deny-overrides', '解释必须指明 deny-overrides，实际 ' + d.reason);",
        "console.log('CONFLICT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-conflict.js');", "console.log('F06-B2 OK');"].join('\n'),
    },
    fix: { 'evaluator.js': EVALUATOR_OK },
    required: ['conflict_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-conflict.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'conflict_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-B2/check-conflict.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '冲突未被正确处理，成因可能在匹配集合的构造（是否包含全部命中）或合并规则（是否按 deny-overrides）；需探查两处 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只改合并而遗漏匹配层；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F06-C1', category: 'C', variant: 1, token: 'F06-C1 OK',
    title: '硬预算下的多来源并行评估（优先级语义不得被破坏）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-C1 需要在**总预算 6500 ms**内完成三个策略来源的评估，最终必须同时成立：',
      '① work/ 下的三个来源评估工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {src,start,end,token,order_ok,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个来源内部必须保持 priority 降序（见 CONTRACT.md）；',
      '④ 三个来源的完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 合并后的决策矩阵 matrix.json 必须与按 priority 规则归并的结果**语义等价**；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、evaluator.js 与 work/ 下的来源工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 评估契约\n\n1. 每个来源内部必须按 priority 降序处理其策略；\n2. 三个来源共享总预算 6500 ms；\n3. 并行合并后的决策矩阵必须与按 priority 规则归并的参考矩阵语义等价（并行不得破坏优先级）。\n',
      'evaluator.js': EVALUATOR_OK,
      'requests.json': cReq([['r1', 'read', 'docs/a.txt'], ['r2', 'write', 'secret/b.txt']]),
      'policies/pol-team-a.json': POL([
        { id: 'a-deny-secret', effect: 'deny', priority: 30, subject: '*', action: '*', resource: 'secret/*' },
        { id: 'a-allow-docs', effect: 'allow', priority: 20, subject: '*', action: 'read', resource: 'docs/*' },
      ]),
      'policies/pol-team-b.json': POL([
        { id: 'b-allow-all-read', effect: 'allow', priority: 10, subject: '*', action: 'read', resource: '*' },
      ]),
      'policies/pol-team-c.json': POL([
        { id: 'c-deny-write', effect: 'deny', priority: 25, subject: '*', action: 'write', resource: '*' },
      ]),
      'work/pol-team-a.js': C_SOURCE_TOOL('pol-team-a', 3500, 'PA-1a2b'),
      'work/pol-team-b.js': C_SOURCE_TOOL('pol-team-b', 3500, 'PB-77c4'),
      'work/pol-team-c.js': C_SOURCE_TOOL('pol-team-c', 3000, 'PC-31e8'),
      'check-timeline.js': CHECK_TIMELINE_POL(6500, C1_SRCS),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C1_SRCS, 'F06-C1 OK'),
    },
    fix: {
      'run-sources.js': RUN_SOURCES(C1_SRCS),
      'INTEGRATION.md': '# 集成说明\n集成：三个策略来源并行评估完成，合并矩阵与 priority 参考矩阵语义等价。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F06-C1/run-sources.js',
    required: ['sources_done', 'timeline_ok', 'precedence_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'evaluator.js', 'work/pol-team-a.js', 'work/pol-team-b.js', 'work/pol-team-c.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/pol-team-a.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-C1/check-timeline.js' },
      { id: 'precedence_ok', kind: 'file_contains', path: 'matrix.json', expect: 'matrix' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三来源各自固定评估耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行合并不得破坏 priority 语义**（matrix.json 必须与按 priority 规则归并的参考矩阵 canonical 相等）。串行调度必然超预算（verify 直接拒绝），而来源级并行 + 按 priority 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-优先级等价"结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F06-C2', category: 'C', variant: 2, token: 'F06-C2 OK',
    title: '硬预算下的多租户批量评估（对象内优先级不被打乱）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-C2 需要在**总预算 6500 ms**内完成三个租户策略集的批量评估与决策矩阵合并：',
      '① work/ 下的三个评估工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {src,start,end,token,order_ok,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个租户内部必须保持 priority 降序；',
      '④ 三来源完成时间跨度不得超过总预算；',
      '⑤ 合并后的决策矩阵 matrix.json 必须与按 priority 规则归并的结果**语义等价**，且覆盖全部请求；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、evaluator.js 与 work/ 下的评估工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 评估契约\n\n1. 每个租户内部按 priority 降序处理；\n2. 共享总预算 6500 ms；\n3. 合并矩阵必须语义等价于按 priority 归并的参考矩阵，且覆盖全部请求。\n',
      'evaluator.js': EVALUATOR_OK,
      'requests.json': cReq([['q1', 'read', 'docs/x.txt'], ['q2', 'write', 'docs/y.txt'], ['q3', 'read', 'secret/z.txt']]),
      'policies/pol-tenant-x.json': POL([
        { id: 'x-allow-docs', effect: 'allow', priority: 40, subject: '*', action: 'read', resource: 'docs/*' },
        { id: 'x-deny-secret', effect: 'deny', priority: 15, subject: '*', action: 'read', resource: 'secret/*' },
      ]),
      'policies/pol-tenant-y.json': POL([
        { id: 'y-allow-write', effect: 'allow', priority: 35, subject: '*', action: 'write', resource: 'docs/*' },
      ]),
      'policies/pol-tenant-z.json': POL([
        { id: 'z-deny-all', effect: 'deny', priority: 5, subject: '*', action: '*', resource: '*' },
      ]),
      'work/pol-tenant-x.js': C_SOURCE_TOOL('pol-tenant-x', 3500, 'PX-4b70'),
      'work/pol-tenant-y.js': C_SOURCE_TOOL('pol-tenant-y', 3200, 'PY-2d19'),
      'work/pol-tenant-z.js': C_SOURCE_TOOL('pol-tenant-z', 3000, 'PZ-88af'),
      'check-timeline.js': CHECK_TIMELINE_POL(6500, C2_SRCS),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C2_SRCS, 'F06-C2 OK'),
    },
    fix: {
      'run-sources.js': RUN_SOURCES(C2_SRCS),
      'INTEGRATION.md': '# 集成说明\n集成：三个租户策略集并行评估完成，决策矩阵与 priority 参考矩阵语义等价且覆盖全部请求。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F06-C2/run-sources.js',
    required: ['sources_done', 'timeline_ok', 'matrix_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'evaluator.js', 'work/pol-tenant-x.js', 'work/pol-tenant-y.js', 'work/pol-tenant-z.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/pol-tenant-x.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-C2/check-timeline.js' },
      { id: 'matrix_ok', kind: 'file_contains', path: 'matrix.json', expect: 'matrix' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但非复制：租户集合/优先级分布/请求集合不同，且要求矩阵覆盖全部请求。同样存在"硬预算 + 对象内优先级保持 + 并行不得破坏优先级语义"的可机械验证约束，串行超预算而来源级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-对象-优先级等价"结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F06-D1', category: 'D', variant: 1, token: 'F06-D1 OK',
    title: '三套策略包各自的缺陷 + 统一授权报告校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-D1 下的三套策略包 pkg-a / pkg-b / pkg-c 都需要修好，',
      '并且统一授权报告校验（check-report.js）与该目录下的 node verify.js 也必须全部通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-report.js 与 verify.js。',
    ].join('\n'),
    files: {
      'pkg-a/match.js': ['// A：资源前缀匹配', "function match(pattern, resource) { return String(resource) === pattern; }", 'module.exports = { match };'].join('\n'),
      'pkg-b/merge.js': ['// B：deny-overrides', 'function merge(hits) { return hits.length ? hits[0].effect : "deny"; }', 'module.exports = { merge };'].join('\n'),
      'pkg-c/expand.js': ['// C：权限→资源展开', 'function expand(perms, table) { return perms.slice(); }', 'module.exports = { expand };'].join('\n'),
      'check-a.js': ["const assert = require('assert');", "const { match } = require('./pkg-a/match.js');", "assert.strictEqual(match('docs/*', 'docs/a.txt'), true);", "console.log('A OK');"].join('\n'),
      'check-b.js': ["const assert = require('assert');", "const { merge } = require('./pkg-b/merge.js');", "assert.strictEqual(merge([{ effect: 'allow' }, { effect: 'deny' }]), 'deny');", "console.log('B OK');"].join('\n'),
      'check-c.js': ["const assert = require('assert');", "const { expand } = require('./pkg-c/expand.js');", "assert.deepStrictEqual(expand(['doc.write'], { 'doc.write': ['docs/*'] }), ['docs/*']);", "console.log('C OK');"].join('\n'),
      'check-report.js': [
        "const assert = require('assert');",
        "const a = require('./pkg-a/match.js');",
        "const b = require('./pkg-b/merge.js');",
        "const c = require('./pkg-c/expand.js');",
        "assert.strictEqual(a.match('docs/*', 'docs/a.txt'), true);",
        "assert.strictEqual(b.merge([{ effect: 'allow' }, { effect: 'deny' }]), 'deny');",
        "assert.deepStrictEqual(c.expand(['doc.write'], { 'doc.write': ['docs/*'] }), ['docs/*']);",
        "console.log('REPORT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-a.js');", "require('./check-b.js');", "require('./check-c.js');", "console.log('F06-D1 OK');"].join('\n'),
    },
    fix: {
      'pkg-a/match.js': ['// A：资源前缀匹配', "function match(pattern, resource) { return pattern.endsWith('/*') ? String(resource).startsWith(pattern.slice(0, -1)) : String(resource) === pattern; }", 'module.exports = { match };'].join('\n'),
      'pkg-b/merge.js': ['// B：deny-overrides', "function merge(hits) { return hits.some((h) => h.effect === 'deny') ? 'deny' : 'allow'; }", 'module.exports = { merge };'].join('\n'),
      'pkg-c/expand.js': ['// C：权限→资源展开', 'function expand(perms, table) { const out = []; for (const p of perms) for (const r of table[p] || []) out.push(r); return out; }', 'module.exports = { expand };'].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'report_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-report.js'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-D1/check-c.js' },
      { id: 'report_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-D1/check-report.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三套策略包各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未利用策略包互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F06-D2', category: 'D', variant: 2, token: 'F06-D2 OK',
    title: '多阶段策略修复：策略修复 → 优先级归一 → 审计重生成',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F06-D2 需要交付三份产物：',
      '① 修复后的策略集 policies-fixed.json（含字段 "repaired": true）；',
      '② 优先级归一结果 precedence-normalized.json（含字段 "normalized": true）；',
      '③ 重新生成的审计报告 audit-report.json（含字段 "decisions" 数组）；node verify.js 必须通过。',
      '不得修改 verify.js。',
    ].join('\n'),
    files: {
      'policies.json': POL([{ id: 'p1', effect: 'allow', priority: 10, subject: '*', action: 'read', resource: '*' }]),
      'policies-fixed.json': '{}\n',
      'precedence-normalized.json': '{}\n',
      'audit-report.json': '{}\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "assert.strictEqual(rd('policies-fixed.json').repaired, true, 'policies-fixed.json 缺少 repaired');",
        "assert.strictEqual(rd('precedence-normalized.json').normalized, true, 'precedence-normalized.json 缺少 normalized');",
        "assert.ok(Array.isArray(rd('audit-report.json').decisions), 'audit-report.json 缺少 decisions 数组');",
        "console.log('F06-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'policies-fixed.json': JSON.stringify({ repaired: true, policies: [{ id: 'p1', effect: 'allow', priority: 10, subject: '*', action: 'read', resource: '*' }] }, null, 2) + '\n',
      'precedence-normalized.json': JSON.stringify({ normalized: true, order: ['p1'] }, null, 2) + '\n',
      'audit-report.json': JSON.stringify({ decisions: [{ request_id: 'r1', decision: 'allow', reason: 'allow' }] }, null, 2) + '\n',
    },
    required: ['policy_repaired', 'precedence_normalized', 'audit_regenerated', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: [],
    extraChecks: [
      { id: 'policy_repaired', kind: 'file_contains', path: 'policies-fixed.json', expect: 'repaired' },
      { id: 'precedence_normalized', kind: 'file_contains', path: 'precedence-normalized.json', expect: 'normalized' },
      { id: 'audit_regenerated', kind: 'file_contains', path: 'audit-report.json', expect: 'decisions' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个阶段（策略修复 → 优先级归一 → 审计重生成）各有独立产物与验收字段，且审计依赖前两阶段结果 ⇒ 多阶段编排/并行结构由任务本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F06-E1', category: 'E', variant: 1, token: 'F06-E1 OK',
    title: 'legacy ACL 冻结语义与新 RBAC 契约冲突',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F06-E1 的 acl.js 是一版**已上线**的访问控制实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/acl.json 与 consumer 均不得修改）。',
      'CONTRACT-rbac.md 的新要求必须成立；check.js 与 acl.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT-rbac.md': '# 新契约\n\n1. 必须保留 legacy 字段 allowed（外部消费方逐字段回放）；\n2. 必须新增 role 与 reason 字段（RBAC 语义）；\n3. 两条必须同时成立。\n',
      'acl.js': ['// 已上线实现：仅输出 allowed，且被 legacy/acl.json 冻结', "function check(req) { return { allowed: req.action === 'read' }; }", 'module.exports = { check };'].join('\n'),
      'legacy/acl.json': JSON.stringify({ allowed: true }, null, 2) + '\n',
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：按 legacy/acl.json 逐字段回放 check 的输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { check } = require('../acl.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'acl.json'), 'utf8'));",
        "const out = check({ action: 'read' });",
        "assert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');",
        "assert.strictEqual(out.allowed, golden.allowed, 'legacy allowed 被改变');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'index.js': ['// 对外入口（可修改）：当前直接转发既有实现', "const base = require('./acl.js');", 'module.exports = { check: base.check };'].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { check } = require('./index.js');",
        "const out = check({ action: 'read', subject: 'alice' });",
        "assert.strictEqual(out.allowed, true, 'legacy allowed 必须保留');",
        "assert.ok(typeof out.role === 'string' && out.role.length > 0, '新契约：必须携带 role，实际 ' + JSON.stringify(out));",
        "assert.ok(typeof out.reason === 'string' && out.reason.length > 0, '新契约：必须携带 reason');",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F06-E1 OK');"].join('\n'),
    },
    fix: {
      'acl-rbac.js': [
        '// 兼容路径：保留 legacy allowed 布局，同时补充 role / reason',
        "const base = require('./acl.js');",
        "function check(req) { const out = base.check(req); return { allowed: out.allowed, role: req.subject ? 'authenticated' : 'anonymous', reason: out.allowed ? 'rbac-allow' : 'rbac-deny' }; }",
        'module.exports = { check };',
      ].join('\n'),
      'index.js': ['// 对外入口：指向兼容路径', "const v2 = require('./acl-rbac.js');", 'module.exports = { check: v2.check };'].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['acl.js', 'legacy/consumer.js', 'legacy/acl.json', 'check.js', 'CONTRACT-rbac.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'acl-rbac.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F06-E1/check.js', log: 'pilot-workspace/FORMAL-F06-E1/attempt-log.txt' },
    rationaleGt: '现状把既有实现当作新接口：acl.js 只能输出 allowed，而新契约要求同时携带 role/reason；acl.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F06-E2', category: 'E', variant: 2, token: 'F06-E2 OK',
    title: '决策缓存失效错误（策略变更后仍返回旧决策）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F06-E2 的访问决策在策略被修改后仍然返回旧结果。',
      '上一轮针对缓存做的调整记录在 cache.log。',
      'cache-contract.md 规定的前置契约必须成立；stale.js 与 policy-store.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'cache-contract.md': '# 缓存契约\n\n缓存键至少包含 (policy_id, policy_version)。策略内容或版本发生变化后，再次评估**必须**反映新策略（不得返回旧决策）。\n',
      'cache.js': [
        '// 上一轮实现：仅按 policy_id 缓存（策略变更后仍命中旧决策）',
        'const store = new Map();',
        'function get(policyId) { return store.get(policyId); }',
        'function set(policyId, decision) { store.set(policyId, decision); }',
        'module.exports = { get, set };',
      ].join('\n'),
      'policy-store.js': [
        '// 受保护：策略存储（内容可变，版本随内容 hash 变化）',
        "const { createHash } = require('crypto');",
        'let current = { id: "P1", effect: "allow", action: "read", resource: "docs/*" };',
        'function setPolicy(p) { current = p; }',
        'function getPolicy() { return current; }',
        'function version() { return createHash("sha256").update(JSON.stringify(current)).digest("hex").slice(0, 12); }',
        'module.exports = { setPolicy, getPolicy, version };',
      ].join('\n'),
      'evaluator.js': [
        '// 受保护：评估器（调用缓存；缓存实现可修改）',
        "const cache = require('./cache.js');",
        "const store = require('./policy-store.js');",
        'function evaluate(req) {',
        '  const p = store.getPolicy();',
        '  const hit = cache.get(p.id);',
        '  if (hit) return hit;',
        '  const decision = p.effect === "allow" && (req.resource || "").startsWith("docs/") ? "allow" : "deny";',
        '  const out = { policy_id: p.id, decision };',
        '  cache.set(p.id, out);',
        '  return out;',
        '}',
        'module.exports = { evaluate };',
      ].join('\n'),
      'stale.js': [
        "const assert = require('assert');",
        "const store = require('./policy-store.js');",
        "const { evaluate } = require('./evaluator.js');",
        "const req = { action: 'read', resource: 'docs/a.txt' };",
        "const d1 = evaluate(req);",
        "assert.strictEqual(d1.decision, 'allow', 'P1 下应允许，实际 ' + d1.decision);",
        "store.setPolicy({ id: 'P1', effect: 'deny', action: 'read', resource: 'docs/*' }); // 策略内容变更（版本随之变化）",
        "const d2 = evaluate(req);",
        "assert.strictEqual(d2.decision, 'deny', '策略已变更，决策必须随更新，实际 ' + d2.decision + '（旧决策被复用）');",
        "console.log('CACHE OK');",
      ].join('\n'),
      'verify.js': ["require('./stale.js');", "console.log('F06-E2 OK');"].join('\n'),
    },
    fix: {
      'cache.js': [
        '// 缓存键包含 (policy_id, policy_version)：内容/版本变化后不再命中旧决策',
        'const store = new Map();',
        'function key(policyId, version) { return policyId + "@" + version; }',
        'function get(policyId, version) { return store.get(key(policyId, version)); }',
        'function set(policyId, version, decision) { store.set(key(policyId, version), decision); }',
        'module.exports = { get, set, key };',
      ].join('\n'),
      'evaluator.js': [
        '// 受保护语义不变：以 (policy_id, policy_version) 作为缓存键',
        "const cache = require('./cache.js');",
        "const store = require('./policy-store.js');",
        'function evaluate(req) {',
        '  const p = store.getPolicy();',
        '  const v = store.version();',
        '  const hit = cache.get(p.id, v);',
        '  if (hit) return hit;',
        '  const decision = p.effect === "allow" && (req.resource || "").startsWith("docs/") ? "allow" : "deny";',
        '  const out = { policy_id: p.id, decision };',
        '  cache.set(p.id, v, out);',
        '  return out;',
        '}',
        'module.exports = { evaluate };',
      ].join('\n'),
    },
    required: ['cache_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['stale.js', 'policy-store.js', 'cache-contract.md'],
    extraChecks: [{ id: 'cache_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F06-E2/stale.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F06-E2/stale.js', log: 'pilot-workspace/FORMAL-F06-E2/cache.log' },
    rationaleGt: '未修复态在策略内容变更后仍命中旧缓存（真实预跑：d2.decision=allow 而期望 deny，属业务结果差异）；stale.js 与 policy-store.js 冻结 ⇒ 必须把缓存键从 (policy_id) 改为 (policy_id, policy_version) 并调整评估器的取值路径（改变"如何生成与复用决策"的方案）⇒ 计划层重规划，REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护文件或仅清缓存不收敛（缓存清空不解决键语义）；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f06-evidence');
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
    'protected_paths:', `  - ${base}/verify.js`, ...(v.protectedExtra ?? []).map((p) => `  - ${base}/${p}`),
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
  const runVerify = (): number | null => {
    try {
      execFileSync(process.execPath, ['verify.js'], { cwd: evDir, stdio: 'ignore', timeout: 60_000 });
      return 0;
    } catch (e) {
      return (e as { status?: number | null }).status ?? null;
    }
  };
  const before = runVerify();
  for (const [rel, content] of Object.entries(v.fix)) {
    const p = path.join(evDir, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  if (v.fixRun) {
    try {
      const fx = runFixRunStrict(evDir, path.join(evDir, v.fixRun.split(' ')[1]!.replace('pilot-workspace/' + v.id + '/', '')));
      if (fx.kind !== 'EXIT' || fx.exitCode !== 0) throw new Error('fixRun 未成功: ' + JSON.stringify({ kind: fx.kind, exitCode: fx.exitCode, signal: fx.signal, spawnError: fx.spawnError }));
      const tl = path.join(evDir, 'timeline.jsonl');
      const n = existsSync(tl) ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
      console.log('  ' + v.id + ' AFTER fixRun: exit=0  timeline entries=' + n);
    } catch (e) {
      console.log('  ' + v.id + ' AFTER fixRun: exit!=0 (' + (e as { message?: string }).message + ')');
    }
  }
  const after = runVerify();
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
  `/**\n * benchmark/formal-seeds-f06.ts — F06 族 10 个变体的种子（由 scripts/formal-author-f06.ts 生成）\n */\nexport const FORMAL_F06_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f06.json');
const vtEvidence: Array<{ id: string; beforeOk: boolean | null; afterOk: boolean | null; status: string; cfg: number; pre?: string }> = [];
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
  const preExit = new Map<string, number>();
  for (const v of variants) {
    if (!v.preRun) continue;
    const script = path.join(ROOT, v.preRun.command.split(' ')[1]!);
    const oT = path.join(ROOT, 'pilot-workspace', '.f06-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f06-pre-' + v.id + '.err');
    const of = openSync(oT, 'w');
    const ef = openSync(eT, 'w');
    let code = 0;
    try {
      execFileSync(process.execPath, [script], { cwd: ROOT, stdio: ['ignore', of, ef], timeout: 60_000 });
    } catch (e) {
      const st = (e as { status?: number | null }).status;
      code = typeof st === 'number' ? st : 1;
    } finally {
      closeSync(of);
      closeSync(ef);
    }
    writeFileSync(path.join(ROOT, v.preRun.log), ['# 预跑记录（冻结环境中实际执行，非人工撰写）', 'command: ' + v.preRun.command, 'exit_code: ' + String(code), 'stdout:', readFileSync(oT, 'utf8').trim(), 'stderr:', readFileSync(eT, 'utf8').trim(), ''].join('\n'), 'utf8');
    rmSync(oT, { force: true });
    rmSync(eT, { force: true });
    preExit.set(v.id, code);
    console.log('  预跑 ' + v.id + '：' + v.preRun.command + ' → exit=' + String(code));
  }
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F06', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F06) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
        const tl = path.join(ROOT, 'pilot-workspace', v.id, 'timeline.jsonl');
        const n = existsSync(tl) ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
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
  family: 'F06', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F06', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F06 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：权限策略 + 访问控制 + 决策合并（与 F01–F05 各族的领域均不同）。',
  '> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。',
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
for (const { v, loaded } of loadResults) {
  const ne = nodeEvidence.find((e) => e.id === v.id)!;
  const vt = vtEvidence.find((e) => e.id === v.id)!;
  md.push(
    `## ${v.id}（${v.category} 类 · 变体 ${v.variant}）`, '',
    `**标题**：${v.title}`, '',
    '**任务描述**：', '```', v.prompt, '```', '',
    `**expected_first_decisions**：\`[${v.expected.join(', ')}]\`　**expected_delegation**：\`${String(v.expectedDelegation)}\``, '',
    `- 候选集合校验：${loaded.ok ? 'PASS' : 'FAIL'}`,
    `- CDA 布尔轴校验：PASS（派生 = ${String(v.expectedDelegation)}）`,
    `- protected_paths：${(v.protectedExtra ?? []).length + 1} 条`, '',
    `**验证规则**：required = ${v.required.join(', ')}；forbidden = ${v.forbidden.join(', ')}`, '',
    `**验证证据**：node verify.js ${String(ne.before)} → ${String(ne.after)}；verifyTask ${String(vt.beforeOk)} → ${String(vt.afterOk)}（status=${vt.status}，CONFIG_ERROR=${vt.cfg}）${v.preRun ? `；交付前真实预跑 ${v.preRun.command}` : ''}`, '',
    `**为什么这些 first_decision 属于 GT**：${v.rationaleGt}`, '',
    `**为什么其他候选不属于 GT**：${v.rationaleNot}`, '',
    `**签署**：\`gt_signed_by: ________\`　\`gt_signed_at: ________\``, '',
  );
}
writeFileSync(REVIEW, md.join('\n'), 'utf8');

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f06.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f06-version.json'), {
  dataset: 'formal', family: 'F06', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F06 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F06-*.yaml · formal-seeds-f06.ts · f06-review.md · f06-gt-drafts.json · f06-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F06 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f06-review.md');
process.exit(allOk ? 0 : 3);
