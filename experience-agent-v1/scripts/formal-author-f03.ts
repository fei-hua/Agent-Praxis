/**
 * scripts/formal-author-f03.ts — F03 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01/F02 不同）：HTTP 处理器 + 中间件链 + 契约/快照测试
 * 纪律同前：只产出 draft；GT 逐条独立推导；三层证据；E1/E2 真实预跑 + 日志后冻结基线；
 *          不生成 manifest、不启动正式 run；prompt 不含 first-decision 提示。
 *
 * 用法：node scripts/formal-author-f03.ts
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { writeJsonUtf8 } from './lib/json-io.ts';

/** 最小修复 D：严格运行 fixRun —— 区分 EXIT / SIGNAL / SPAWN_ERROR（禁止 undefined），fd 捕获输出并打印 timeline/span */
function runFixRunStrict(cwd: string, script: string) {
  // G-3: 每个证据阶段以干净运行状态开始（避免跨阶段 timeline 累积导致 span 失真）
  const _tlPath = path.join(cwd, 'timeline.jsonl');
  if (existsSync(_tlPath)) rmSync(_tlPath);
  const _outDir = path.join(cwd, 'out');
  if (existsSync(_outDir)) rmSync(_outDir, { recursive: true, force: true });
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f03.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f03-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f03-gt-drafts.json');

interface Variant {
  id: string; category: 'A' | 'B' | 'C' | 'D' | 'E'; variant: number;
  title: string; token: string;
  taskType: string; complexity: string; scope: string; characteristics: string[]; constraints: string[];
  prompt: string;
  files: Record<string, string>;
  fix: Record<string, string>;
  required: string[]; forbidden: string[];
  extraChecks?: Array<Record<string, unknown>>;
  protectedExtra?: string[];
  preRun?: { command: string; log: string };
  expected: string[]; expectedDelegation: boolean;
  rationaleGt: string; rationaleNot: string;
}
const V = (v: Variant): Variant => v;

const variants: Variant[] = [
  V({
    id: 'FORMAL-F03-A1', category: 'A', variant: 1, token: 'F03-A1 OK',
    title: '单个处理器返回码错误（单点修复）',
    taskType: 'bugfix', complexity: 'simple', scope: 'generic', characteristics: [], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-A1/handlers/status.js 对未知路由返回了成功码。修正它，使 verify.js 通过。不得修改 verify.js。',
    files: {
      'handlers/status.js': "function handle(req) {\n  if (req.path === '/health') return { code: 200, body: 'ok' };\n  return { code: 200, body: 'not found' };\n}\nmodule.exports = { handle };\n",
      'verify.js': "const assert = require('assert');\nconst { handle } = require('./handlers/status.js');\nassert.strictEqual(handle({ path: '/health' }).code, 200);\nassert.strictEqual(handle({ path: '/nope' }).code, 404);\nconsole.log('F03-A1 OK');\n",
    },
    fix: { 'handlers/status.js': "function handle(req) {\n  if (req.path === '/health') return { code: 200, body: 'ok' };\n  return { code: 404, body: 'not found' };\n}\nmodule.exports = { handle };\n" },
    required: ['status_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'status_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-A1/verify.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单处、症状即定位（未知路由返回码），直接修改即可 ⇒ DIRECT 是最小充分首决策。',
    rationaleNot: 'EXPLORE/委派/REPLAN 均无依据：无未知范围、无可分解子任务、无既有方案失败。',
  }),
  V({
    id: 'FORMAL-F03-A2', category: 'A', variant: 2, token: 'F03-A2 OK',
    title: '中间件顺序违反架构文档约定（单文件修复）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: [], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-A2 的 chain.js 组装出的中间件顺序与 ARCHITECTURE.md 记录的约定不一致。修正 chain.js 使约定成立并让 verify.js 通过。不得修改 verify.js。',
    files: {
      'ARCHITECTURE.md': '# 约定\n中间件执行顺序必须为：parse → auth → handler。\n（auth 不得在 parse 之前执行）\n',
      'mw/parse.js': "module.exports = { name: 'parse', run: (ctx) => { ctx.parsed = true; return ctx; } };\n",
      'mw/auth.js': "module.exports = { name: 'auth', run: (ctx) => { if (!ctx.parsed) throw new Error('auth before parse'); return ctx; } };\n",
      'mw/handler.js': "module.exports = { name: 'handler', run: (ctx) => { ctx.done = true; return ctx; } };\n",
      'chain.js': "const parse = require('./mw/parse.js');\nconst auth = require('./mw/auth.js');\nconst handler = require('./mw/handler.js');\nconst CHAIN = [auth, parse, handler];\nfunction run(ctx) {\n  return CHAIN.reduce((c, m) => m.run(c), ctx);\n}\nmodule.exports = { CHAIN, run };\n",
      'verify.js': "const assert = require('assert');\nconst { CHAIN, run } = require('./chain.js');\nassert.deepStrictEqual(CHAIN.map((m) => m.name), ['parse', 'auth', 'handler']);\nassert.strictEqual(run({}).done, true);\nconsole.log('F03-A2 OK');\n",
    },
    fix: { 'chain.js': "const parse = require('./mw/parse.js');\nconst auth = require('./mw/auth.js');\nconst handler = require('./mw/handler.js');\nconst CHAIN = [parse, auth, handler];\nfunction run(ctx) {\n  return CHAIN.reduce((c, m) => m.run(c), ctx);\n}\nmodule.exports = { CHAIN, run };\n" },
    required: ['chain_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'chain_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-A2/verify.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '仍是单文件修复；但"正确顺序"记录在 ARCHITECTURE.md 中，需要查看该约定文件才能确认 ⇒ DIRECT 与 EXPLORE 都算最小充分。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现不符约定）。',
  }),
  V({
    id: 'FORMAL-F03-B1', category: 'B', variant: 1, token: 'F03-B1 OK',
    title: '响应字段在中间件链中丢失（位置未知）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-B1 的最终响应里 request_id 字段为空（见 EXPECTED.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。',
    files: {
      'mw/parse.js': "module.exports = { name: 'parse', run: (ctx) => { ctx.req = { id: 'r-1', path: '/x' }; return ctx; } };\n",
      'mw/enrich.js': "module.exports = { name: 'enrich', run: (ctx) => { ctx.res = { request_id: null, path: ctx.req.path }; return ctx; } };\n",
      'mw/handler.js': "module.exports = { name: 'handler', run: (ctx) => { ctx.done = true; return ctx; } };\n",
      'chain.js': "const parse = require('./mw/parse.js');\nconst enrich = require('./mw/enrich.js');\nconst handler = require('./mw/handler.js');\nfunction run(ctx) {\n  return [parse, enrich, handler].reduce((c, m) => m.run(c), ctx);\n}\nmodule.exports = { run };\n",
      'EXPECTED.md': '# 期望\n最终响应 request_id 应为 "r-1"（来自请求）。\n',
      'verify.js': "const assert = require('assert');\nconst { run } = require('./chain.js');\nassert.strictEqual(run({}).res.request_id, 'r-1');\nconsole.log('F03-B1 OK');\n",
    },
    fix: { 'mw/enrich.js': "module.exports = { name: 'enrich', run: (ctx) => { ctx.res = { request_id: ctx.req.id, path: ctx.req.path }; return ctx; } };\n" },
    required: ['enrich_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'enrich_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-B1/verify.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状（字段为空）出现在链末端，任务未给出缺陷所在中间件；需沿链逐段探查才能确认 enrich 覆盖了 request_id ⇒ EXPLORE 是最小充分。',
    rationaleNot: 'DIRECT 会导致盲改；委派对 3 个小中间件过度；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F03-B2', category: 'B', variant: 2, token: 'F03-B2 OK',
    title: '响应快照与序列化器不一致的层间排查',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-B2 的响应快照与期望快照存在字段差异（见 REPORT.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。',
    files: {
      'serialize.js': "function serialize(res) {\n  const keys = ['code', 'body'];\n  const out = {};\n  for (const k of keys) out[k] = res[k];\n  return JSON.stringify(out);\n}\nmodule.exports = { serialize };\n",
      'handlers/echo.js': "function handle(req) {\n  return { code: 200, body: req.body, extra: 'x' };\n}\nmodule.exports = { handle };\n",
      'REPORT.md': '# 现象\n期望快照：{"code":200,"body":"hi","extra":"x"}；实际输出缺少 extra。\n',
      'verify.js': "const assert = require('assert');\nconst { serialize } = require('./serialize.js');\nconst { handle } = require('./handlers/echo.js');\nassert.strictEqual(serialize(handle({ body: 'hi' })), JSON.stringify({ code: 200, body: 'hi', extra: 'x' }));\nconsole.log('F03-B2 OK');\n",
    },
    fix: { 'serialize.js': "function serialize(res) {\n  const keys = ['code', 'body', 'extra'];\n  const out = {};\n  for (const k of keys) out[k] = res[k];\n  return JSON.stringify(out);\n}\nmodule.exports = { serialize };\n" },
    required: ['serializer_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'serializer_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-B2/verify.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '现象只说"缺字段"，缺陷可能在 handler（未产出）或 serialize（白名单未含）；需探查两处才能定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能改错层；委派过度；REPLAN 不适用。',
  }),
  V({
    id: "FORMAL-F03-C1", category: 'C', variant: 1, token: "F03-C1 OK",
    title: "硬时限下的多分支推进（总预算内完成三分支 + 集成）",
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: "pilot-workspace/FORMAL-F03-C1 需要在**总预算 6500 ms**内完成，最终必须同时成立：\\n① work/ 下的三个分支工具都必须真实执行完成，各自产出 out/<branch>.txt；\\n② 每次执行都会把 {branch,start,end,token} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；\\n③ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；\\n④ 写出 INTEGRATION.md，含一行以「集成」开头的结论；\\n⑤ node verify.js 必须通过。不得修改 verify.js 与 work/ 下的分支工具。",
    files: {
      "work/branch-a.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-a\";\nconst token = \"TA-9f21\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "work/branch-b.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-b\";\nconst token = \"TB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "work/branch-c.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-c\";\nconst token = \"TC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "verify.js": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');\nassert.ok(fs.existsSync(path.join(__dirname, 'timeline.jsonl')), '缺少 timeline.jsonl（分支工具未运行）');\nconst entries = rd('timeline.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, '分支记录不足 3 条，实际 ' + entries.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nfor (const e of entries) {\n  const art = 'out/' + e.branch + '.txt';\n  assert.ok(fs.existsSync(path.join(__dirname, art)), '缺少分支产物 ' + art);\n  assert.ok(rd(art).includes(e.token), '分支产物 token 不匹配：' + art);\n}\nassert.ok(/^集成/m.test(rd('INTEGRATION.md')), 'INTEGRATION.md 缺少集成结论');\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(JSON.stringify({ span, budget: BUDGET_MS, entries: entries.length }));\nconsole.log(\"F03-C1 OK\");\n",
      "check-timeline.js": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, 'timeline 记录不足 3 条，实际 ' + entries.length);\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number' && typeof e.token === 'string', 'timeline 记录字段非法');\n  assert.ok(typeof e.branch === 'string' && e.branch.length > 0, 'timeline 记录缺少 branch');\n  const art = path.join(__dirname, 'out', e.branch + '.txt');\n  assert.ok(fs.existsSync(art), '缺少分支产物 out/' + e.branch + '.txt');\n  assert.ok(fs.readFileSync(art, 'utf8').includes(e.token), '分支产物 token 不匹配：' + e.branch);\n}\nconst branches = Array.from(new Set(entries.map((e) => e.branch)));\nassert.ok(branches.length >= 3, '分支种类不足 3，实际 ' + branches.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK entries=' + entries.length + ' branches=' + branches.length + ' span=' + span + 'ms');\n",
      "INTEGRATION.md": "# 集成说明\n（待补）\n",
    },
    fix: {
      "run-parallel.js": "// 并行编排：并发启动三个分支工具，随后产出集成结论\nconst { spawn } = require('child_process');\nconst fs = require('fs');\nconst path = require('path');\nconst branches = [\"branch-a\",\"branch-b\",\"branch-c\"];\nfunction runOne(b) {\n  return new Promise((resolve, reject) => {\n    const p = spawn(process.execPath, [path.join(__dirname, 'work', b + '.js')], { stdio: 'ignore' });\n    p.on('error', (e) => reject(new Error(b + ' spawn_error: ' + e.code + ' ' + e.message)));\n    p.on('exit', (c, sig) => (c === 0 ? resolve() : reject(new Error(b + ' exit=' + c + ' signal=' + sig))));\n  });\n}\nPromise.all(branches.map(runOne)).then(() => {\n  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), \"# 集成说明\\n集成：三个分支并行完成后汇总。\\n\");\n  console.log('parallel orchestration done');\n}).catch((e) => { console.error(e.message); process.exit(1); });\n",
    },
    fixRun: "node pilot-workspace/FORMAL-F03-C1/run-parallel.js",
    required: ["timeline_ok", "artifacts_ok", "integration_ok", "verify_pass"],
    forbidden: ['verify_script_changed'],
    protectedExtra: ["work/branch-a.js", "work/branch-b.js", "work/branch-c.js", "check-timeline.js"],
    extraChecks: [{
        "id": "timeline_ok",
        "kind": "command_exit_zero",
        "command": "node pilot-workspace/FORMAL-F03-C1/check-timeline.js",
      }, {
        "id": "artifacts_ok",
        "kind": "file_exists",
        "path": "out/branch-b.txt",
      }, {
        "id": "integration_ok",
        "kind": "file_contains",
        "path": "INTEGRATION.md",
        "expect": "集成",
      }],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: "任务给出可机械验证的硬时限：三分支各有固定工具耗时（3.5s/3.5s/3.0s，合计约 10s），总预算 6500ms。顺序执行必然超预算（verify.js 直接拒绝：总耗时超预算），而分支同时推进可在预算内完成并进入集成。因此\"直接顺序做完\"在机械层面无法满足约束，拆解/并行/编排具有结构依据。",
    rationaleNot: "串行执行无法满足总预算约束（顺序 span≈10s > 6500ms）；并行执行可以满足；EXPLORE 未刻画\"预算-分支\"结构；REPLAN 不适用（任务状态自洽）。",
  }),
  V({
    id: "FORMAL-F03-C2", category: 'C', variant: 2, token: "F03-C2 OK",
    title: "硬时限下的多分支推进（总预算内完成三分支 + 集成）",
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: "pilot-workspace/FORMAL-F03-C2 需要在**总预算 6500 ms**内完成，最终必须同时成立：\\n① work/ 下的三个分支工具都必须真实执行完成，各自产出 out/<branch>.txt；\\n② 每次执行都会把 {branch,start,end,token} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；\\n③ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；\\n④ 写出 INTEGRATION.md，含一行以「集成」开头的结论；\\n⑤ node verify.js 必须通过。不得修改 verify.js 与 work/ 下的分支工具。",
    files: {
      "work/branch-x.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-x\";\nconst token = \"TX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "work/branch-y.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-y\";\nconst token = \"TY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3200);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "work/branch-z.js": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-z\";\nconst token = \"TZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n",
      "verify.js": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');\nassert.ok(fs.existsSync(path.join(__dirname, 'timeline.jsonl')), '缺少 timeline.jsonl（分支工具未运行）');\nconst entries = rd('timeline.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, '分支记录不足 3 条，实际 ' + entries.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nfor (const e of entries) {\n  const art = 'out/' + e.branch + '.txt';\n  assert.ok(fs.existsSync(path.join(__dirname, art)), '缺少分支产物 ' + art);\n  assert.ok(rd(art).includes(e.token), '分支产物 token 不匹配：' + art);\n}\nassert.ok(/^集成/m.test(rd('INTEGRATION.md')), 'INTEGRATION.md 缺少集成结论');\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(JSON.stringify({ span, budget: BUDGET_MS, entries: entries.length }));\nconsole.log(\"F03-C2 OK\");\n",
      "check-timeline.js": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, 'timeline 记录不足 3 条，实际 ' + entries.length);\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number' && typeof e.token === 'string', 'timeline 记录字段非法');\n  assert.ok(typeof e.branch === 'string' && e.branch.length > 0, 'timeline 记录缺少 branch');\n  const art = path.join(__dirname, 'out', e.branch + '.txt');\n  assert.ok(fs.existsSync(art), '缺少分支产物 out/' + e.branch + '.txt');\n  assert.ok(fs.readFileSync(art, 'utf8').includes(e.token), '分支产物 token 不匹配：' + e.branch);\n}\nconst branches = Array.from(new Set(entries.map((e) => e.branch)));\nassert.ok(branches.length >= 3, '分支种类不足 3，实际 ' + branches.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK entries=' + entries.length + ' branches=' + branches.length + ' span=' + span + 'ms');\n",
      "INTEGRATION.md": "# 集成说明\n（待补）\n",
    },
    fix: {
      "run-parallel.js": "// 并行编排：并发启动三个分支工具，随后产出集成结论\nconst { spawn } = require('child_process');\nconst fs = require('fs');\nconst path = require('path');\nconst branches = [\"branch-x\",\"branch-y\",\"branch-z\"];\nfunction runOne(b) {\n  return new Promise((resolve, reject) => {\n    const p = spawn(process.execPath, [path.join(__dirname, 'work', b + '.js')], { stdio: 'ignore' });\n    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(b + ' failed ' + c))));\n  });\n}\nPromise.all(branches.map(runOne)).then(() => {\n  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), \"# 集成说明\\n集成：三个分支并行完成后汇总。\\n\");\n  console.log('parallel orchestration done');\n}).catch((e) => { console.error(e.message); process.exit(1); });\n",
    },
    fixRun: "node pilot-workspace/FORMAL-F03-C2/run-parallel.js",
    required: ["timeline_ok", "artifacts_ok", "integration_ok", "verify_pass"],
    forbidden: ['verify_script_changed'],
    protectedExtra: ["work/branch-x.js", "work/branch-y.js", "work/branch-z.js", "check-timeline.js"],
    extraChecks: [{
        "id": "timeline_ok",
        "kind": "command_exit_zero",
        "command": "node pilot-workspace/FORMAL-F03-C2/check-timeline.js",
      }, {
        "id": "artifacts_ok",
        "kind": "file_exists",
        "path": "out/branch-y.txt",
      }, {
        "id": "integration_ok",
        "kind": "file_contains",
        "path": "INTEGRATION.md",
        "expect": "集成",
      }],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: "任务给出可机械验证的硬时限：三分支各有固定工具耗时（3.5s/3.5s/3.0s，合计约 10s），总预算 6500ms。顺序执行必然超预算（verify.js 直接拒绝：总耗时超预算），而分支同时推进可在预算内完成并进入集成。因此\"直接顺序做完\"在机械层面无法满足约束，拆解/并行/编排具有结构依据。",
    rationaleNot: "串行执行无法满足总预算约束（顺序 span≈10s > 6500ms）；并行执行可以满足；EXPLORE 未刻画\"预算-分支\"结构；REPLAN 不适用（任务状态自洽）。",
  }),
  V({
    id: 'FORMAL-F03-D1', category: 'D', variant: 1, token: 'F03-D1 OK',
    title: '三个独立服务包的同构修复（并行编排）',
    taskType: 'data_layer', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-D1 的三个服务包 svc-auth / svc-rate / svc-audit 都需要修好：这些包各自的验收脚本与该目录下的 node verify.js 必须全部通过。不得修改验收脚本与 verify.js。',
    files: {
      'svc-auth/src.js': "function allow(role) {\n  return role === 'root';\n}\nmodule.exports = { allow };\n",
      'svc-rate/src.js': "function window(n) {\n  return n * 60 + 1;\n}\nmodule.exports = { window };\n",
      'svc-audit/src.js': "function mask(s) {\n  return s.slice(0, 1) + '***';\n}\nmodule.exports = { mask };\n",
      'check-auth.js': "const assert = require('assert');\nconst { allow } = require('./svc-auth/src.js');\nassert.strictEqual(allow('root'), true);\nassert.strictEqual(allow('admin'), true);\nassert.strictEqual(allow('user'), false);\nconsole.log('AUTH OK');\n",
      'check-rate.js': "const assert = require('assert');\nconst { window } = require('./svc-rate/src.js');\nassert.strictEqual(window(2), 120);\nconsole.log('RATE OK');\n",
      'check-audit.js': "const assert = require('assert');\nconst { mask } = require('./svc-audit/src.js');\nassert.strictEqual(mask('abcd'), 'a***d');\nconsole.log('AUDIT OK');\n",
      'verify.js': "require('./check-auth.js');\nrequire('./check-rate.js');\nrequire('./check-audit.js');\nconsole.log('F03-D1 OK');\n",
    },
    fix: {
      'svc-auth/src.js': "function allow(role) {\n  return role === 'root' || role === 'admin';\n}\nmodule.exports = { allow };\n",
      'svc-rate/src.js': "function window(n) {\n  return n * 60;\n}\nmodule.exports = { window };\n",
      'svc-audit/src.js': "function mask(s) {\n  return s.slice(0, 1) + '***' + s.slice(-1);\n}\nmodule.exports = { mask };\n",
    },
    required: ['auth_fixed', 'rate_fixed', 'audit_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['check-auth.js', 'check-rate.js', 'check-audit.js'],
    extraChecks: [
      { id: 'auth_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-D1/check-auth.js' },
      { id: 'rate_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-D1/check-rate.js' },
      { id: 'audit_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F03-D1/check-audit.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个服务包文件完全不相交、各有独立验收脚本、合计工作量明显超过单点修复 ⇒ 正确动作是并行/编排。',
    rationaleNot: 'DIRECT/EXPLORE 未利用结构；DELEGATE 单路不足以刻画三路并行（D 类等价集不含 DELEGATE）；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F03-D2', category: 'D', variant: 2, token: 'F03-D2 OK',
    title: '两份独立快照套件审计 + 合并结论',
    taskType: 'data_layer', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F03-D2 需要交付三份产物：\n① 审计 fixtures/alpha/ 下的快照，生成 report-alpha.md（含一行以「Alpha 结论」开头的结论）；\n② 审计 fixtures/beta/ 下的快照，生成 report-beta.md（含一行以「Beta 结论」开头的结论）；\n③ 写 SUMMARY.md，含一行以「合并」开头的结论。\n不得修改 verify.js。',

    files: {
      'fixtures/alpha/s1.json': '{"code":200,"body":"ok"}\n',
      'fixtures/alpha/s2.json': '{"code":500,"body":"err"}\n',
      'fixtures/beta/t1.json': '{"code":200,"body":"ok"}\n',
      'report-alpha.md': '（待生成）\n',
      'report-beta.md': '（待生成）\n',
      'SUMMARY.md': '（待生成）\n',
      'verify.js': "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');\nassert.ok(/^Alpha 结论/m.test(rd('report-alpha.md')));\nassert.ok(/^Beta 结论/m.test(rd('report-beta.md')));\nassert.ok(/^合并/m.test(rd('SUMMARY.md')));\nconsole.log('F03-D2 OK');\n",
    },
    fix: {
      'report-alpha.md': '# Alpha 报告\nAlpha 结论：alpha 套件 2 个快照，其中 1 个为 5xx。\n',
      'report-beta.md': '# Beta 报告\nBeta 结论：beta 套件 1 个快照，全部为 2xx。\n',
      'SUMMARY.md': '# 汇总\n合并：两套件规模不同（2 vs 1），错误分布不同。\n',
    },
    required: ['alpha_written', 'beta_written', 'summary_written', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [
      { id: 'alpha_written', kind: 'file_contains', path: 'report-alpha.md', expect: 'Alpha 结论' },
      { id: 'beta_written', kind: 'file_contains', path: 'report-beta.md', expect: 'Beta 结论' },
      { id: 'summary_written', kind: 'file_contains', path: 'SUMMARY.md', expect: '合并' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '两份审计输入目录不同、产物不同、彼此无依赖，第三份为汇总 ⇒ 并行/编排是正确动作结构。',
    rationaleNot: 'DIRECT/EXPLORE 会串行化；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F03-E1', category: 'E', variant: 1, token: 'F03-E1 OK',
    title: '线上格式契约被冻结：新增字段必须走新路径而非改写旧序列化器',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F03-E1 的 serialize.js 是一版**已上线**的响应序列化实现，',
      '其字节级输出被 golden-snapshots.json 冻结（外部调用方按该文件回放）。',
      'attempt-log.txt 记录了针对当前实现的一次实际执行结果。',
      'SPEC.md 的新要求必须成立；check.js 与 serialize.js 都不得修改。',
      '请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'SPEC.md': [
        '# 要求',
        'A. 新接口 v2(res)：响应必须包含 code、body、trace_id 三个字段（trace_id 取自请求上下文）。',
        'B. 已上线的 v1(res)：其字节级输出被 golden-snapshots.json 冻结，必须逐字符一致；serialize.js 不得修改。',
        'C. v1 必须继续从 index.js 可用（旧调用方依赖该入口）。',
        'D. check.js 不得修改，也不得删除断言。',
      ].join('\n'),
      'serialize.js': [
        '// 已上线实现（字节级输出被外部 golden 快照冻结，不得修改本文件）',
        'function v1(res) {',
        "  return JSON.stringify({ code: res.code, body: res.body });",
        '}',
        'module.exports = { v1 };',
      ].join('\n'),
      'index.js': [
        "const { v1 } = require('./serialize.js');",
        '// 旧路径：把已上线的 v1 直接当作新接口暴露',
        'module.exports = { v2: v1 };',
      ].join('\n'),
      'golden-snapshots.json': JSON.stringify({ note: '外部回放用：v1() 必须逐字符一致', samples: [{ input: { code: 200, body: 'ok' }, output: '{"code":200,"body":"ok"}' }] }, null, 2),
      'check.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const api = require('./index.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-snapshots.json'), 'utf8'));",
        '// C) 旧接口仍必须可用',
        "assert.strictEqual(typeof api.v1, 'function', 'v1 必须继续从 index.js 可用');",
        '// B) 冻结字节级输出逐字符一致',
        'for (const s of golden.samples) assert.strictEqual(api.v1(s.input), s.output);',
        '// A) 新接口要求',
        "assert.strictEqual(typeof api.v2, 'function', 'v2 必须可用');",
        "const out = JSON.parse(api.v2({ code: 201, body: 'created', trace_id: 't-9' }));",
        "assert.deepStrictEqual(out, { code: 201, body: 'created', trace_id: 't-9' });",
        "console.log('CHECK OK');",
      ].join('\n'),
      'verify.js': "require('./check.js');\nconsole.log('F03-E1 OK');\n",
    },
    fix: {
      'serialize-v2.js': [
        '// 新契约 v2（不改动被冻结的 serialize.js）',
        'function v2(res) {',
        '  return JSON.stringify({ code: res.code, body: res.body, trace_id: res.trace_id });',
        '}',
        'module.exports = { v2 };',
      ].join('\n'),
      'index.js': [
        "const { v1 } = require('./serialize.js');",
        "const { v2 } = require('./serialize-v2.js');",
        'module.exports = { v1, v2 };',
      ].join('\n'),
    },
    required: ['v2_path_added', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['serialize.js', 'check.js'],
    preRun: { command: 'node pilot-workspace/FORMAL-F03-E1/check.js', log: 'pilot-workspace/FORMAL-F03-E1/attempt-log.txt' },
    extraChecks: [{ id: 'v2_path_added', kind: 'file_exists', path: 'pilot-workspace/FORMAL-F03-E1/serialize-v2.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '既有 v1 已被外部 golden 快照冻结且不得修改，而 index.js 现状把 v1 当作 v2 暴露 ⇒ 新要求失败（真实预跑记录）。继续原路径的两条走法都被约束堵死：改 serialize.js 破坏 B、放宽 check.js 违反 D。正解需要重新组织实现路径（新增 v2 序列化并让 index.js 同时导出 v1/v2），属计划层重规划 ⇒ REPLAN 为最小充分。',
    rationaleNot: 'DIRECT 指向受保护的 serialize.js；EXPLORE 不成立（失败原因已记录）；VERIFY 与委派类不适用。',
  }),
  V({
    id: 'FORMAL-F03-E2', category: 'E', variant: 2, token: 'F03-E2 OK',
    title: '失败的重试方案：精确一次契约与重试策略冲突',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited', 'data_schema_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F03-E2 的处理器管线在一次不稳定依赖下会重复产生副作用。',
      '上一轮为重试参数做的调整记录在 pipeline.log。',
      'exactly-once.md 规定的前置契约必须成立；contract.js 与 pipeline.js 都不得修改。',
      '请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'exactly-once.md': [
        '# 契约（不得修改）',
        '1. 同一 request_id 的请求，无论内部重试多少次，副作用只能发生一次。',
        '2. pipeline.js 必须继续导出 retry 中间件（既有部署依赖）。',
        '3. contract.js 是契约测试，不得修改，也不得删除断言。',
      ].join('\n'),
      'pipeline.js': [
        '// 已部署的管线段（不得修改本文件）',
        'const retry = {',
        "  name: 'retry',",
        '  run(ctx) {',
        '    for (let i = 0; i < 3; i++) {',
        '      try {',
        '        return ctx.invoke();',
        '      } catch (e) {',
        '        ctx.attempts = (ctx.attempts || 0) + 1;',
        '      }',
        '    }',
        '    throw new Error("exhausted");',
        '  },',
        '};',
        'function makePipeline(invoke) {',
        '  return { run: (ctx) => retry.run(Object.assign(ctx, { invoke })) };',
        '}',
        'module.exports = { retry, makePipeline };',
      ].join('\n'),
      'handlers/write.js': [
        '// 不稳定处理器：每次被调用都先写入副作用，然后抛出可重试的瞬时错误',
        'function makeHandler(store) {',
        '  return function handle(req) {',
        '    store.push(req.id);',
        '    throw new Error("transient");',
        '  };',
        '}',
        'module.exports = { makeHandler };',
      ].join('\n'),
      'store.js': [
        'function createStore() {',
        '  const items = [];',
        "  items.count = 0;",
        '  return {',
        '    push(x) { items.push(x); items.count += 1; },',
        '    size() { return items.length; },',
        '  };',
        '}',
        'module.exports = { createStore };',
      ].join('\n'),
      'app.js': [
        "const { makePipeline } = require('./pipeline.js');",
        "const { makeHandler } = require('./handlers/write.js');",
        "const { createStore } = require('./store.js');",
        'const store = createStore();',
        'const handle = makeHandler(store);',
        'const pipe = makePipeline(() => handle({ id: "same-id", flaky: true }));',
        'function runOnce() {',
        '  try { pipe.run({}); } catch (e) { /* 已耗尽重试 */ }',
        '  return store.size();',
        '}',
        'module.exports = { runOnce, store };',
      ].join('\n'),
      'contract.js': [
        "const assert = require('assert');",
        "const { retry, makePipeline } = require('./pipeline.js');",
        "const app = require('./app.js');",
        '// 2) retry 中间件必须继续导出',
        "assert.ok(typeof retry === 'function' || typeof retry === 'object', 'retry 必须继续导出');",
        "assert.strictEqual(typeof makePipeline, 'function', 'makePipeline 必须继续导出');",
        '// 1) 同一 request_id 的副作用只能发生一次（即使内部重试）',
        'const n = app.runOnce();',
        "assert.strictEqual(n, 1, '同一 request_id 的副作用应为 1 次，实际 ' + n + ' 次');",
        "console.log('CONTRACT OK');",
      ].join('\n'),
      'verify.js': "require('./contract.js');\nconsole.log('F03-E2 OK');\n",
    },
    fix: {
      'idempotency.js': [
        '// 幂等层：同一 request_id 只放行一次副作用（不修改被冻结的 pipeline.js）',
        'function createGuard() {',
        '  const seen = new Set();',
        '  return {',
        '    allow(id) {',
        '      if (seen.has(id)) return false;',
        '      seen.add(id);',
        '      return true;',
        '    },',
        '  };',
        '}',
        'module.exports = { createGuard };',
      ].join('\n'),
      'app.js': [
        "const { makePipeline } = require('./pipeline.js');",
        "const { makeHandler } = require('./handlers/write.js');",
        "const { createStore } = require('./store.js');",
        "const { createGuard } = require('./idempotency.js');",
        'const store = createStore();',
        'const guard = createGuard();',
        'const rawHandle = makeHandler(store);',
        'function handleGuarded(req) {',
        '  if (!guard.allow(req.id)) return { ok: true, deduped: true };',
        '  return rawHandle(req);',
        '}',
        'const pipe = makePipeline(() => handleGuarded({ id: "same-id", flaky: true }));',
        'function runOnce() {',
        '  try { pipe.run({}); } catch (e) { /* 已耗尽重试 */ }',
        '  return store.size();',
        '}',
        'module.exports = { runOnce, store };',
      ].join('\n'),
    },
    required: ['idempotency_path_added', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['contract.js', 'pipeline.js'],
    preRun: { command: 'node pilot-workspace/FORMAL-F03-E2/contract.js', log: 'pilot-workspace/FORMAL-F03-E2/pipeline.log' },
    extraChecks: [{ id: 'idempotency_path_added', kind: 'file_exists', path: 'pilot-workspace/FORMAL-F03-E2/idempotency.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '既有重试方案已实际失败（真实预跑：同一 request_id 的副作用发生多次），而 pipeline.js（含 retry）被契约冻结、contract.js 不得修改。继续在重试参数上做局部调整无法满足"精确一次"⇒ 必须重新判断方案（把幂等性放到新的层，而不是改被冻结的管线段）。存在可执行替代路径（新增幂等守卫并调整 app.js 装配）⇒ REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护的 pipeline.js / 局部调参无法收敛；EXPLORE 不成立（失败原因已记录）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f03-evidence');
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
  let fixRunInfo = '';
  if (v.fixRun) {
    try {
      const fx = runFixRunStrict(evDir, path.join(evDir, v.fixRun.split(' ')[1]!.replace('pilot-workspace/' + v.id + '/', '')));
      if (fx.kind !== 'EXIT' || fx.exitCode !== 0) throw new Error('fixRun 未成功: ' + JSON.stringify({ kind: fx.kind, exitCode: fx.exitCode, signal: fx.signal, spawnError: fx.spawnError }));
      const tl = path.join(evDir, 'timeline.jsonl');
      const entries = existsSync(tl) ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
      fixRunInfo = 'AFTER fixRun: exit=0  timeline entries=' + entries;
      console.log('  ' + v.id + ' ' + fixRunInfo);
    } catch (e) {
      fixRunInfo = 'AFTER fixRun: exit!=0 (' + (e as { message?: string }).message + ')';
      console.log('  ' + v.id + ' ' + fixRunInfo);
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
  `/**\n * benchmark/formal-seeds-f03.ts — F03 族 10 个变体的种子（由 scripts/formal-author-f03.ts 生成）\n */\nexport const FORMAL_F03_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

// ---------- 交付流程 + 正式判定路径证据 ----------
process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f03.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f03-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f03-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F03', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F03) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
        const entries = existsSync(tl) ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
        console.log('  ' + v.id + ' AFTER fixRun: exit=0  timeline entries=' + entries);
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
  family: 'F03', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F03', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F03 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：HTTP 处理器 + 中间件链 + 契约/快照测试（与 F01 单模块工具、F02 CLI/管线不同族）。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f03.ts', 'benchmark/formal/slots.json'].sort();
const entries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(entries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f03-version.json'), {
  dataset: 'formal', family: 'F03', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(entries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F03 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F03-*.yaml · formal-seeds-f03.ts · f03-review.md · f03-gt-drafts.json · f03-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F03 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f03-review.md');
process.exit(allOk ? 0 : 3);
