/**
 * scripts/formal-author-f05.ts — F05 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01–F04 不同）：**依赖解析 / 包图 / Lockfile 一致性**
 *   manifest → dependency graph → version constraint → transitive → conflict → lockfile → reproducibility
 * 纪律同前：只产出 draft；GT 逐条独立推导；三层证据；E 类真实预跑 + 日志后冻结基线；
 *          不生成 manifest、不启动正式 run；prompt 不含 first-decision 提示。
 *
 * 用法：node scripts/formal-author-f05.ts
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

/** 严格运行 fixRun：EXIT / SIGNAL / SPAWN_ERROR 三分类（禁止 undefined），fd 捕获输出 */
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f05.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f05-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f05-gt-drafts.json');

interface Variant {
  id: string;
  category: string;
  variant: number;
  token: string;
  title: string;
  taskType: string;
  complexity: string;
  scope: string;
  characteristics: string[];
  constraints: string[];
  prompt: string;
  files: Record<string, string>;
  fix: Record<string, string>;
  fixRun?: string;
  required: string[];
  forbidden: string[];
  protectedExtra?: string[];
  extraChecks?: Array<Record<string, unknown>>;
  expected: string[];
  expectedDelegation: boolean;
  rationaleGt: string;
  rationaleNot: string;
  preRun?: { command: string; log: string };
}
const V = (v: Variant): Variant => v;

/** 离线注册表：名称 → 版本 → 依赖 */
const REGISTRY = (spec: Record<string, Record<string, Record<string, string>>>) =>
  JSON.stringify(
    {
      packages: Object.fromEntries(
        Object.entries(spec).map(([name, versions]) => [
          name,
          { versions: Object.fromEntries(Object.entries(versions).map(([v, deps]) => [v, { deps }])) },
        ]),
      ),
    },
    null,
    2,
  ) + '\n';

const R_A1 = REGISTRY({
  x: { '1.0.0': {}, '2.4.0': {}, '2.4.1': {} },
});

// A1 未修复：完全忽略约束，取最低版本
const RESOLVER_NAIVE =
  "// 解析器：应为满足 semver 约束的版本选择一个确定结果\n" +
  "const registry = require('./registry.json');\n" +
  "function satisfies(version, range) { return true; }\n" +
  "function pickVersion(name, range) {\n" +
  "  const versions = Object.keys(registry.packages[name].versions).sort();\n" +
  "  return versions.find((v) => satisfies(v, range));\n" +
  "}\n" +
  "function resolve(manifest) {\n" +
  "  const deps = {};\n" +
  "  for (const [name, range] of Object.entries(manifest.dependencies)) deps[name] = pickVersion(name, range);\n" +
  "  return { deps };\n" +
  "}\n" +
  "module.exports = { resolve, pickVersion, satisfies };\n";

const RESOLVER_CARET =
  "// 解析器：解析满足 caret 约束的确定结果\n" +
  "const registry = require('./registry.json');\n" +
  "function satisfies(version, range) {\n" +
  "  const m = /^\\^?(\\d+)(?:\\.(\\d+))?/.exec(String(range));\n" +
  "  if (!m) return version === range;\n" +
  "  const [maj, min] = [Number(m[1]), m[2] === undefined ? 0 : Number(m[2])];\n" +
  "  const p = String(version).split('.').map(Number);\n" +
  "  if (String(range).startsWith('^')) return p[0] === maj && (p[1] > min || (p[1] === min && p[2] >= 0));\n" +
  "  return p[0] === maj && p[1] === min;\n" +
  "}\n" +
  "function pickVersion(name, range) {\n" +
  "  const versions = Object.keys(registry.packages[name].versions).sort();\n" +
  "  const ok = versions.filter((v) => satisfies(v, range));\n" +
  "  return ok.length ? ok[ok.length - 1] : undefined;\n" +
  "}\n" +
  "function resolve(manifest) {\n" +
  "  const deps = {};\n" +
  "  for (const [name, range] of Object.entries(manifest.dependencies)) deps[name] = pickVersion(name, range);\n" +
  "  return { deps };\n" +
  "}\n" +
  "module.exports = { resolve, pickVersion, satisfies };\n";

const MANIFEST_A1 = JSON.stringify({ name: 'app', dependencies: { x: '^2.4' } }, null, 2) + '\n';

const CHECK_RESOLVE = (token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const { resolve } = require('./resolver.js');\n" +
  "const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\n" +
  "const out = resolve(manifest);\n" +
  "assert.strictEqual(out.deps.x, '2.4.1', '^2.4 应解析为满足约束的最高版本，实际 ' + out.deps.x);\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

// ---------- C 类：多 package workspace（每包保序 + 硬预算） ----------
const PKG_TOOL = (pkg: string, dur: number, token: string) =>
  "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const PKG = " + JSON.stringify(pkg) + ";\n" +
  "const DUR = " + dur + ";\n" +
  "const TOKEN = " + JSON.stringify(token) + ";\n" +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const start = Date.now();\n" +
  "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n" +
  "const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\n" +
  "const declared = Object.keys(pkgJson.dependencies || {});\n" +
  "const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\n" +
  "const lock = {};\n" +
  "const order = [];\n" +
  "for (const dep of declared) {\n" +
  "  const versions = Object.keys(reg[dep].versions).sort();\n" +
  "  const range = String(pkgJson.dependencies[dep]);\n" +
  "  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n" +
  "  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n" +
  "  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n" +
  "  lock[dep] = chosen;\n" +
  "  order.push(dep);\n" +
  "}\n" +
  "const orderOk = declared.join(',') === order.join(',');\n" +
  "const end = Date.now();\n" +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\n" +
  "console.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n";

const RUN_PKGS_PARALLEL = (pkgs: string[], unified: boolean) =>
  "// 并行编排：并发解析各 package，随后产出统一 lockfile / 集成结论\n" +
  "const { spawn } = require('child_process');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const packages = " + JSON.stringify(pkgs) + ";\n" +
  "function runOne(p) {\n" +
  "  return new Promise((resolve, reject) => {\n" +
  "    const c = spawn(process.execPath, [path.join(__dirname, 'work', p + '.js')], { stdio: 'ignore' });\n" +
  "    c.on('error', (e) => reject(new Error(p + ' spawn_error: ' + e.code + ' ' + e.message)));\n" +
  "    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(p + ' exit=' + code + ' signal=' + sig))));\n" +
  "  });\n" +
  "}\n" +
  "Promise.all(packages.map(runOne)).then(() => {\n" +
  (unified
    ? "  const deps = {};\n" +
      "  for (const p of packages) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', p + '.lock.json'), 'utf8')); for (const [k, v] of Object.entries(frag.deps)) deps[k] = v; }\n" +
      "  fs.writeFileSync(path.join(__dirname, 'unified-lock.json'), JSON.stringify({ packages, deps }, null, 2) + '\\n');\n"
    : '') +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各 package 并行解析完成，包内依赖保持声明顺序，总耗时在预算内。\\n');\n" +
  "  console.log('parallel resolution done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

const CHECK_TIMELINE_PKG = (budget: number, pkgs: string[], needUnified: boolean) =>
  "// 纯读取检查器：验证**已发生**的那次并行解析（不执行任何包工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const PACKAGES = " + JSON.stringify(pkgs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符：' + entries.map((e) => e.pkg).join(','));\n" +
  "for (const e of entries) {\n" +
  "  assert.strictEqual(e.order_ok, true, '包 ' + e.pkg + ' 内部依赖顺序未保持');\n" +
  "  const declared = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, 'packages', e.pkg, 'package.json'), 'utf8')).dependencies || {});\n" +
  "  const out = fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.txt'), 'utf8').trim();\n" +
  "  assert.strictEqual(out, declared.join(','), '包 ' + e.pkg + ' 输出顺序与声明顺序不一致');\n" +
  "  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.lock.json'), 'utf8'));\n" +
  "  for (const d of declared) assert.ok(frag.deps[d], '包 ' + e.pkg + ' 的 lockfile 缺少依赖 ' + d + '（完整性不足）');\n" +
  "}\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  (needUnified
    ? "const uni = JSON.parse(fs.readFileSync(path.join(__dirname, 'unified-lock.json'), 'utf8'));\n" +
      "assert.strictEqual(Object.keys(uni.deps).length >= PACKAGES.length, true, 'unified-lock.json 覆盖不足');\n"
    : '') +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('TIMELINE OK packages=' + new Set(entries.map((e) => e.pkg)).size + ' span=' + span + 'ms order=preserved lockfile=complete');\n";

const C_VERIFY = (budget: number, pkgs: string[], token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const PACKAGES = " + JSON.stringify(pkgs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符');\n" +
  "for (const e of entries) assert.strictEqual(e.order_ok, true, '包顺序未保持：' + e.pkg);\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

const C1_PKGS = ['pkg-a', 'pkg-b', 'pkg-c'];
const C2_PKGS = ['pkg-x', 'pkg-y', 'pkg-z'];
const C_REGISTRY = REGISTRY({
  z: { '1.0.0': {}, '1.1.0': {} }, m: { '1.0.0': {}, '1.2.0': {} }, a: { '1.0.0': {}, '1.0.1': {} },
  q: { '2.0.0': {} }, r: { '1.0.0': {} }, s: { '3.0.0': {} }, t: { '1.0.0': {} },
});
const pkgJson = (name: string, deps: Record<string, string>) => JSON.stringify({ name, dependencies: deps }, null, 2) + '\n';

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F05-A1', category: 'A', variant: 1, token: 'F05-A1 OK',
    title: '版本约束解析错误（单文件单点）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-A1 的依赖解析器没有按 manifest 的 semver 约束选择版本。',
      '修正 resolver.js 使 node verify.js 通过。不得修改 verify.js 与 check-resolve.js。',
    ].join('\n'),
    files: {
      'registry.json': R_A1,
      'manifest.json': MANIFEST_A1,
      'resolver.js': RESOLVER_NAIVE,
      'check-resolve.js': CHECK_RESOLVE('RESOLVE OK'),
      'verify.js': ["require('./check-resolve.js');", "console.log('F05-A1 OK');"].join('\n'),
    },
    fix: { 'resolver.js': RESOLVER_CARET },
    required: ['version_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-resolve.js'],
    extraChecks: [{ id: 'version_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-A1/check-resolve.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（resolver.js 的约束匹配），目标明确 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（位置已知）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F05-A2', category: 'A', variant: 2, token: 'F05-A2 OK',
    title: '未遵循已冻结 lockfile 的解析结果',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-A2 的解析结果与冻结的 lockfile.json 不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-lockfile.js、lockfile.json 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 解析契约\n\n1. 约束必须按 semver 解析；\n2. 若 lockfile.json 中已有**满足约束**的固定版本，必须优先采用该版本（lockfile 具备冻结效力）。\n',
      'registry.json': REGISTRY({ x: { '1.0.0': {}, '2.4.0': {}, '2.4.1': {} } }),
      'manifest.json': MANIFEST_A1,
      'lockfile.json': JSON.stringify({ deps: { x: '2.4.0' } }, null, 2) + '\n',
      'resolver.js': RESOLVER_CARET,
      'check-lockfile.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { resolve } = require('./resolver.js');",
        "const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));",
        "const out = resolve(manifest);",
        "assert.strictEqual(out.deps.x, '2.4.0', '应遵循 lockfile 的固定版本（满足约束的 pinned 版本），实际 ' + out.deps.x);",
        "console.log('LOCKFILE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-lockfile.js');", "console.log('F05-A2 OK');"].join('\n'),
    },
    fix: {
      'resolver.js':
        "// 解析器：优先采用 lockfile 中满足约束的固定版本\n" +
        "const registry = require('./registry.json');\n" +
        "const lockfile = require('./lockfile.json');\n" +
        "function satisfies(version, range) {\n" +
        "  const m = /^\\^?(\\d+)(?:\\.(\\d+))?/.exec(String(range));\n" +
        "  if (!m) return version === range;\n" +
        "  const [maj, min] = [Number(m[1]), m[2] === undefined ? 0 : Number(m[2])];\n" +
        "  const p = String(version).split('.').map(Number);\n" +
        "  return String(range).startsWith('^') ? p[0] === maj : p[0] === maj && p[1] === min;\n" +
        "}\n" +
        "function pickVersion(name, range) {\n" +
        "  const pinned = lockfile.deps[name];\n" +
        "  if (pinned && satisfies(pinned, range)) return pinned;\n" +
        "  const versions = Object.keys(registry.packages[name].versions).sort();\n" +
        "  const ok = versions.filter((v) => satisfies(v, range));\n" +
        "  return ok.length ? ok[ok.length - 1] : undefined;\n" +
        "}\n" +
        "function resolve(manifest) {\n" +
        "  const deps = {};\n" +
        "  for (const [name, range] of Object.entries(manifest.dependencies)) deps[name] = pickVersion(name, range);\n" +
        "  return { deps };\n" +
        "}\n" +
        "module.exports = { resolve, pickVersion, satisfies };\n",
    },
    required: ['lockfile_honored', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-lockfile.js', 'lockfile.json', 'CONTRACT.md'],
    extraChecks: [{ id: 'lockfile_honored', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-A2/check-lockfile.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（resolver.js），但"必须优先采用 lockfile 固定版本"的判定依据写在 CONTRACT.md ⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅未遵循契约）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F05-B1', category: 'B', variant: 1, token: 'F05-B1 OK',
    title: '间接依赖缺失（需沿依赖图定位）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-B1 生成的依赖图缺少间接依赖（期望图内容见 check-graph.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-graph.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 依赖图契约\n\n依赖图必须包含**全部传递依赖**（递归展开），不得只取顶层。\n',
      'registry.json': REGISTRY({ app: { '1.0.0': { next: '^1.0.0' } }, next: { '1.0.0': { leaf: '^1.0.0' } }, leaf: { '1.0.0': {} } }),
      'manifest.json': JSON.stringify({ name: 'root', dependencies: { app: '^1.0.0' } }, null, 2) + '\n',
      'graph.js': [
        '// 依赖图：当前只展开一层',
        "const registry = require('./registry.json');",
        'function build(deps) {',
        '  const out = {};',
        '  for (const [name, range] of Object.entries(deps)) {',
        '    out[name] = range;',
        '    const meta = registry.packages[name];',
        '    const v = Object.keys(meta.versions)[0];',
        '    // 缺少对 meta.versions[v].deps 的递归展开',
        '  }',
        '  return out;',
        '}',
        'module.exports = { build };',
      ].join('\n'),
      'check-graph.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { build } = require('./graph.js');",
        "const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));",
        "const g = build(manifest.dependencies);",
        "for (const need of ['app', 'next', 'leaf']) assert.ok(g[need], '依赖图缺少 ' + need);",
        "console.log('GRAPH OK');",
      ].join('\n'),
      'verify.js': ["require('./check-graph.js');", "console.log('F05-B1 OK');"].join('\n'),
    },
    fix: {
      'graph.js': [
        '// 依赖图：递归展开全部传递依赖',
        "const registry = require('./registry.json');",
        'function build(deps) {',
        '  const out = {};',
        '  const visit = (d) => {',
        '    for (const [name, range] of Object.entries(d)) {',
        '      if (out[name]) continue;',
        '      out[name] = range;',
        '      const meta = registry.packages[name];',
        '      const v = Object.keys(meta.versions).sort().pop();',
        '      if (meta.versions[v].deps) visit(meta.versions[v].deps);',
        '    }',
        '  };',
        '  visit(deps);',
        '  return out;',
        '}',
        'module.exports = { build };',
      ].join('\n'),
    },
    required: ['graph_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-graph.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'graph_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-B1/check-graph.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"图不完整"，但成因可能在遍历深度、入队逻辑或版本选择；需沿依赖图定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只补一个包而漏掉其它传递路径；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F05-B2', category: 'B', variant: 2, token: 'F05-B2 OK',
    title: '冲突依赖未被识别（需定位求解与冲突选择）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-B2 在两个顶层依赖对同一包提出互不兼容的约束时没有报告冲突。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-conflict.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 解析契约\n\n若同一包被要求满足互不兼容的主版本约束，解析结果必须报告冲突（conflicts 列出该包名）。\n',
      'registry.json': REGISTRY({ p: { '1.0.0': { shared: '^1.0.0' } }, q: { '1.0.0': { shared: '^2.0.0' } }, shared: { '1.0.0': {}, '2.0.0': {} } }),
      'manifest.json': JSON.stringify({ name: 'app', dependencies: { p: '^1.0.0', q: '^1.0.0' } }, null, 2) + '\n',
      'resolver.js': [
        '// 解析器：当前忽略冲突，后写覆盖',
        "const fs = require('fs');",
        "const path = require('path');",
        "const registry = require('./registry.json');",
        'function resolve(manifest) {',
        '  const deps = {}; const conflicts = [];',
        '  const visit = (depsIn) => {',
        '    for (const [name, range] of Object.entries(depsIn)) {',
        '      const versions = Object.keys(registry.packages[name].versions).sort();',
        '      const maj = Number((/\\d+/.exec(String(range)) || [0])[0]);',
        '      const ok = versions.filter((v) => Number(v.split(\'.\')[0]) === maj);',
        '      deps[name] = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];',
        '      const meta = registry.packages[name].versions[deps[name]];',
        '      if (meta && meta.deps) visit(meta.deps);',
        '    }',
        '  };',
        '  visit(manifest.dependencies);',
        '  return { deps, conflicts };',
        '}',
        'module.exports = { resolve };',
      ].join('\n'),
      'check-conflict.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { resolve } = require('./resolver.js');",
        "const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));",
        "const out = resolve(manifest);",
        "assert.deepStrictEqual(out.conflicts.slice().sort(), ['shared'], '应报告 shared 的版本冲突，实际 ' + JSON.stringify(out.conflicts));",
        "console.log('CONFLICT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-conflict.js');", "console.log('F05-B2 OK');"].join('\n'),
    },
    fix: {
      'resolver.js': [
        '// 解析器：识别同一包的不兼容主版本约束并报告冲突',
        "const registry = require('./registry.json');",
        'function resolve(manifest) {',
        '  const deps = {}; const constraints = {}; const conflicts = [];',
        '  const visit = (depsIn) => {',
        '    for (const [name, range] of Object.entries(depsIn)) {',
        '      const maj = Number((/\\d+/.exec(String(range)) || [0])[0]);',
        '      if (constraints[name] !== undefined && constraints[name] !== maj && !conflicts.includes(name)) conflicts.push(name);',
        '      else constraints[name] = maj;',
        '      const versions = Object.keys(registry.packages[name].versions).sort();',
        '      const ok = versions.filter((v) => Number(v.split(\'.\')[0]) === maj);',
        '      if (!deps[name]) deps[name] = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];',
        '      const meta = registry.packages[name].versions[deps[name]];',
        '      if (meta && meta.deps) visit(meta.deps);',
        '    }',
        '  };',
        '  visit(manifest.dependencies);',
        '  return { deps, conflicts };',
        '}',
        'module.exports = { resolve };',
      ].join('\n'),
    },
    required: ['conflict_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-conflict.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'conflict_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-B2/check-conflict.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '冲突未被报告，成因可能在约束收集（求解）或冲突选择策略两处；需探查两处逻辑才能定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只改其中一层而遗漏另一处；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F05-C1', category: 'C', variant: 1, token: 'F05-C1 OK',
    title: '硬预算下的多包并行解析（每包内部保序）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-C1 需要在**总预算 6500 ms**内完成三个 package 的依赖解析，最终必须同时成立：',
      '① work/ 下的三个包解析工具都必须真实执行完成，各自产出 out/<pkg>.txt 与 out/<pkg>.lock.json；',
      '② 每次执行都会把 {pkg,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个包内部必须保持 package.json 中依赖的**声明顺序**（见 CONTRACT.md）；',
      '④ 三个包的完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 各包 lockfile 必须完整覆盖其全部声明依赖；写出 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的包工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 解析契约\n\n1. 每个包内部必须按 package.json 的依赖**声明顺序**解析；\n2. 三个包共享总时间预算 6500 ms；\n3. 运行结束后各包必须产出完整 lockfile 片段。\n',
      'registry.json': C_REGISTRY,
      'packages/pkg-a/package.json': pkgJson('pkg-a', { z: '^1.0.0', m: '^1.0.0', a: '^1.0.0' }),
      'packages/pkg-b/package.json': pkgJson('pkg-b', { r: '^1.0.0', q: '^2.0.0' }),
      'packages/pkg-c/package.json': pkgJson('pkg-c', { t: '^1.0.0', s: '^3.0.0' }),
      'work/pkg-a.js': PKG_TOOL('pkg-a', 3500, 'PA-1a2b'),
      'work/pkg-b.js': PKG_TOOL('pkg-b', 3500, 'PB-77c4'),
      'work/pkg-c.js': PKG_TOOL('pkg-c', 3000, 'PC-31e8'),
      'check-timeline.js': CHECK_TIMELINE_PKG(6500, C1_PKGS, false),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C1_PKGS, 'F05-C1 OK'),
    },
    fix: {
      'run-packages.js': RUN_PKGS_PARALLEL(C1_PKGS, false),
      'INTEGRATION.md': '# 集成说明\n集成：三个包并行解析完成，包内依赖保持声明顺序，lockfile 完整，总耗时在预算内。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F05-C1/run-packages.js',
    required: ['packages_done', 'timeline_ok', 'integration_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'work/pkg-a.js', 'work/pkg-b.js', 'work/pkg-c.js'],
    extraChecks: [
      { id: 'packages_done', kind: 'file_exists', path: 'out/pkg-a.lock.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-C1/check-timeline.js' },
      { id: 'integration_ok', kind: 'file_contains', path: 'INTEGRATION.md', expect: '集成' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三包各自固定解析耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**每包内部必须保持声明顺序**、lockfile 必须完整。串行调度必然超预算（verify 直接拒绝），而包级并行 + 各自内部保序可同时满足预算与顺序/完整性约束 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-包-保序-完整性"结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F05-C2', category: 'C', variant: 2, token: 'F05-C2 OK',
    title: '硬预算下的多包解析 + 统一 lockfile 合并（每包保序）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-C2 需要在**总预算 6500 ms**内完成三个 package 的依赖解析与统一 lockfile 合并：',
      '① work/ 下的三个包解析工具都必须真实执行完成，各自产出 out/<pkg>.txt 与 out/<pkg>.lock.json；',
      '② 每次执行都会把 {pkg,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个包内部必须保持依赖声明顺序；',
      '④ 三包完成时间跨度不得超过总预算；',
      '⑤ 产出 unified-lock.json（覆盖全部包的依赖）与 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的包工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 解析契约\n\n1. 每个包内部必须按声明顺序解析；\n2. 共享总预算 6500 ms；\n3. 运行结束后必须产出 unified-lock.json（覆盖全部包）与 INTEGRATION.md。\n',
      'registry.json': C_REGISTRY,
      'packages/pkg-x/package.json': pkgJson('pkg-x', { s: '^3.0.0', r: '^1.0.0', q: '^2.0.0' }),
      'packages/pkg-y/package.json': pkgJson('pkg-y', { t: '^1.0.0', m: '^1.0.0' }),
      'packages/pkg-z/package.json': pkgJson('pkg-z', { a: '^1.0.0', z: '^1.0.0' }),
      'work/pkg-x.js': PKG_TOOL('pkg-x', 3500, 'PX-4b70'),
      'work/pkg-y.js': PKG_TOOL('pkg-y', 3200, 'PY-2d19'),
      'work/pkg-z.js': PKG_TOOL('pkg-z', 3000, 'PZ-88af'),
      'check-timeline.js': CHECK_TIMELINE_PKG(6500, C2_PKGS, true),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C2_PKGS, 'F05-C2 OK'),
    },
    fix: {
      'run-packages.js': RUN_PKGS_PARALLEL(C2_PKGS, true),
      'INTEGRATION.md': '# 集成说明\n集成：三个包并行解析完成并合并为 unified-lock.json，包内保持声明顺序，总耗时在预算内。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F05-C2/run-packages.js',
    required: ['packages_done', 'unified_ok', 'timeline_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'work/pkg-x.js', 'work/pkg-y.js', 'work/pkg-z.js'],
    extraChecks: [
      { id: 'packages_done', kind: 'file_exists', path: 'out/pkg-x.lock.json' },
      { id: 'unified_ok', kind: 'file_contains', path: 'unified-lock.json', expect: 'deps' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-C2/check-timeline.js' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但非复制：包集合/依赖声明顺序/耗时分布不同，且额外要求**统一 lockfile 合并**（必须覆盖全部包）。同样存在"硬预算 + 每包保序 + lockfile 完整性"的可机械验证约束，串行超预算而包级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-包-保序-合并"结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F05-D1', category: 'D', variant: 1, token: 'F05-D1 OK',
    title: '三个包图各自的缺陷 + 统一 lockfile 校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-D1 下的三个包图 svc-a / svc-b / svc-c 都需要修好，',
      '并且统一 lockfile 校验（check-unified.js）与该目录下的 node verify.js 也必须全部通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-unified.js 与 verify.js。',
    ].join('\n'),
    files: {
      'svc-a/select.js': ['// A 包图：应在候选版本中选择最高版本', 'function pick(versions) { return versions.slice().sort()[0]; }', 'module.exports = { pick };'].join('\n'),
      'svc-b/walk.js': ['// B 包图：应展开全部传递依赖', 'function walk(deps, registry) { const out = {}; for (const k of Object.keys(deps)) { out[k] = deps[k]; } return out; }', 'module.exports = { walk };'].join('\n'),
      'svc-c/lock.js': ['// C 包图：lockfile 必须带 integrity 字段', 'function lock(deps) { return { deps }; }', 'module.exports = { lock };'].join('\n'),
      'check-a.js': ["const assert = require('assert');", "const { pick } = require('./svc-a/select.js');", "assert.strictEqual(pick(['1.0.0','1.2.0','1.1.0']), '1.2.0');", "console.log('A OK');"].join('\n'),
      'check-b.js': ["const assert = require('assert');", "const { walk } = require('./svc-b/walk.js');", "const reg = { a: { deps: { b: '^1' } }, b: { deps: {} } };", "const g = walk({ a: '^1' }, reg);", "assert.ok(g.b, '传递依赖 b 缺失');", "console.log('B OK');"].join('\n'),
      'check-c.js': ["const assert = require('assert');", "const { lock } = require('./svc-c/lock.js');", "const l = lock({ a: '1.0.0' });", "assert.ok(typeof l.integrity === 'string' && l.integrity.length > 0, 'lockfile 缺少 integrity');", "console.log('C OK');"].join('\n'),
      'check-unified.js': [
        "const assert = require('assert');",
        "const a = require('./svc-a/select.js');",
        "const b = require('./svc-b/walk.js');",
        "const c = require('./svc-c/lock.js');",
        "assert.strictEqual(a.pick(['1.0.0','1.2.0']), '1.2.0');",
        "assert.ok(b.walk({ a: '^1' }, { a: { deps: { b: '^1' } }, b: { deps: {} } }).b);",
        "assert.ok(c.lock({ a: '1.0.0' }).integrity);",
        "console.log('UNIFIED OK');",
      ].join('\n'),
      'verify.js': ["require('./check-a.js');", "require('./check-b.js');", "require('./check-c.js');", "console.log('F05-D1 OK');"].join('\n'),
    },
    fix: {
      'svc-a/select.js': ['// A 包图：选择最高候选版本', "function pick(versions) { return versions.slice().sort().pop(); }", 'module.exports = { pick };'].join('\n'),
      'svc-b/walk.js': [
        '// B 包图：递归展开全部传递依赖',
        'function walk(deps, registry) {',
        '  const out = {};',
        '  const visit = (d) => { for (const k of Object.keys(d)) { if (out[k]) continue; out[k] = d[k]; const m = registry[k]; if (m && m.deps) visit(m.deps); } };',
        '  visit(deps);',
        '  return out;',
        '}',
        'module.exports = { walk };',
      ].join('\n'),
      'svc-c/lock.js': [
        '// C 包图：lockfile 携带 integrity',
        "const { createHash } = require('crypto');",
        "function lock(deps) { const integrity = 'sha256-' + createHash('sha256').update(JSON.stringify(deps)).digest('hex'); return { deps, integrity }; }",
        'module.exports = { lock };',
      ].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'unified_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-unified.js'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-D1/check-c.js' },
      { id: 'unified_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-D1/check-unified.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个包图各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一 lockfile 校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未利用包图互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F05-D2', category: 'D', variant: 2, token: 'F05-D2 OK',
    title: '多阶段依赖修复：图修复 → 版本归一 → lockfile 重生成',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F05-D2 需要交付三份产物：',
      '① 修复后的依赖图 graph-fixed.json（含一行字段 "repaired": true）；',
      '② 版本归一结果 versions-normalized.json（含字段 "normalized": true）；',
      '③ 重新生成的 lockfile lockfile.final.json（含字段 "integrity"）；node verify.js 必须通过。',
      '不得修改 verify.js。',
    ].join('\n'),
    files: {
      'graph.json': JSON.stringify({ deps: { a: '^1.0.0', b: '~2.0.0' }, missing: ['c'] }, null, 2) + '\n',
      'graph-fixed.json': '{}\n',
      'versions-normalized.json': '{}\n',
      'lockfile.final.json': '{}\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "assert.strictEqual(rd('graph-fixed.json').repaired, true, 'graph-fixed.json 缺少 repaired');",
        "assert.strictEqual(rd('versions-normalized.json').normalized, true, 'versions-normalized.json 缺少 normalized');",
        "assert.ok(typeof rd('lockfile.final.json').integrity === 'string', 'lockfile.final.json 缺少 integrity');",
        "console.log('F05-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'graph-fixed.json': JSON.stringify({ repaired: true, deps: { a: '^1.0.0', b: '~2.0.0', c: '^1.0.0' } }, null, 2) + '\n',
      'versions-normalized.json': JSON.stringify({ normalized: true, versions: { a: '1.0.0', b: '2.0.0', c: '1.0.0' } }, null, 2) + '\n',
      'lockfile.final.json': JSON.stringify({ integrity: 'sha256-placeholder', deps: { a: '1.0.0', b: '2.0.0', c: '1.0.0' } }, null, 2) + '\n',
    },
    required: ['graph_repaired', 'versions_normalized', 'lockfile_regenerated', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: [],
    extraChecks: [
      { id: 'graph_repaired', kind: 'file_contains', path: 'graph-fixed.json', expect: 'repaired' },
      { id: 'versions_normalized', kind: 'file_contains', path: 'versions-normalized.json', expect: 'normalized' },
      { id: 'lockfile_regenerated', kind: 'file_contains', path: 'lockfile.final.json', expect: 'integrity' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个阶段（图修复 → 版本归一 → lockfile 重生成）各有独立产物与验收字段，且最终 lockfile 依赖前两阶段结果 ⇒ 多阶段编排/并行结构由任务本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F05-E1', category: 'E', variant: 1, token: 'F05-E1 OK',
    title: 'legacy lockfile 冻结布局与新 resolver contract 冲突',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F05-E1 的 lockfile.js 是一版**已上线**的实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/lockfile.json 与 consumer 均不得修改）。',
      'CONTRACT-v2.md 的新要求必须成立；check.js 与 lockfile.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT-v2.md': '# 新契约\n\n1. lockfile 必须保留 legacy 字段 deps（外部消费方逐字段回放）；\n2. lockfile 必须新增 integrity 与 resolution 字段；\n3. 两条必须同时成立。\n',
      'lockfile.js': ['// 已上线实现：仅输出 deps，且被 legacy/lockfile.json 冻结', "function build(deps) { return { deps }; }", 'module.exports = { build };'].join('\n'),
      'legacy/lockfile.json': JSON.stringify({ deps: { a: '1.0.0' } }, null, 2) + '\n',
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：按 legacy/lockfile.json 逐字段回放 build 的输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { build } = require('../lockfile.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'lockfile.json'), 'utf8'));",
        "const out = build({ a: '1.0.0' });",
        "assert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');",
        "assert.deepStrictEqual(out.deps, golden.deps, 'legacy deps 被改变');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'index.js': ['// 对外入口（可修改）：当前直接转发既有实现', "const base = require('./lockfile.js');", 'module.exports = { build: base.build };'].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { build } = require('./index.js');",
        "const out = build({ a: '1.0.0' });",
        "assert.deepStrictEqual(out.deps, { a: '1.0.0' }, 'legacy deps 必须保留');",
        "assert.ok(typeof out.integrity === 'string' && out.integrity.length > 0, '新契约：必须携带 integrity，实际 ' + JSON.stringify(out));",
        "assert.ok(out.resolution && typeof out.resolution === 'object', '新契约：必须携带 resolution 字段');",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F05-E1 OK');"].join('\n'),
    },
    fix: {
      'lockfile-v2.js': [
        '// 兼容路径：保留 legacy deps 布局，同时补充 integrity / resolution',
        "const { createHash } = require('crypto');",
        "const base = require('./lockfile.js');",
        'function build(deps) { const out = base.build(deps); return { deps: out.deps, integrity: "sha256-" + createHash("sha256").update(JSON.stringify(out.deps)).digest("hex"), resolution: { strategy: "highest-satisfying", resolved: Object.keys(out.deps).length } }; }',
        'module.exports = { build };',
      ].join('\n'),
      'index.js': ['// 对外入口：指向兼容路径', "const v2 = require('./lockfile-v2.js');", 'module.exports = { build: v2.build };'].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['lockfile.js', 'legacy/consumer.js', 'legacy/lockfile.json', 'check.js', 'CONTRACT-v2.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'lockfile-v2.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F05-E1/check.js', log: 'pilot-workspace/FORMAL-F05-E1/attempt-log.txt' },
    rationaleGt: '现状把既有实现当作新接口：lockfile.js 只能输出 deps，而新契约要求同时携带 integrity/resolution；lockfile.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口的装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F05-E2', category: 'E', variant: 2, token: 'F05-E2 OK',
    title: '解析不可复现（两次 resolve 得到不同 lockfile）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F05-E2 的解析器在相同输入下会产出不同的 lockfile（可复现性缺陷）。',
      '上一轮针对解析顺序做的调整记录在 resolution.log。',
      'reproducibility.md 规定的前置契约必须成立；repro.js 与 resolver.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'reproducibility.md': '# 前置契约\n\n同一输入连续两次 resolve()，其 lockfile 的**规范形式（canonical）必须完全一致**。\n',
      'registry.json': REGISTRY({ x: { '1.0.0': {}, '2.4.0': {} }, y: { '1.0.0': {} } }),
      'manifest.json': JSON.stringify({ name: 'app', dependencies: { x: '^1.0.0', y: '^1.0.0' } }, null, 2) + '\n',
      'lockfile.js': [
        '// lockfile 生成：当前写入解析时间戳（导致两次 resolve 不一致）',
        "const { createHash } = require('crypto');",
        'function lock(deps) {',
        '  return { resolvedAt: Date.now(), deps, integrity: "sha256-" + createHash("sha256").update(JSON.stringify(deps)).digest("hex") };',
        '}',
        'module.exports = { lock };',
      ].join('\n'),
      'resolver.js': [
        '// 受保护：解析器（调用 lockfile 生成结果）',
        "const registry = require('./registry.json');",
        "const { lock } = require('./lockfile.js');",
        'function resolve(manifest) {',
        '  const deps = {};',
        '  for (const [name, range] of Object.entries(manifest.dependencies)) {',
        '    const versions = Object.keys(registry.packages[name].versions).sort();',
        '    const maj = Number((/\\d+/.exec(String(range)) || [0])[0]);',
        '    const ok = versions.filter((v) => Number(v.split(\'.\')[0]) === maj);',
        '    deps[name] = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];',
        '  }',
        '  return lock(deps);',
        '}',
        'module.exports = { resolve };',
      ].join('\n'),
      'repro.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { resolve } = require('./resolver.js');",
        "const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));",
        'const canonical = (v) => Array.isArray(v) ? v.map(canonical) : (v && typeof v === \'object\' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);',
        'const l1 = resolve(manifest);',
        'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);',
        'const l2 = resolve(manifest);',
        "assert.deepStrictEqual(canonical(l1), canonical(l2), '两次 resolve 的 lockfile 必须可复现');",
        "console.log('REPRO OK');",
      ].join('\n'),
      'verify.js': ["require('./repro.js');", "console.log('F05-E2 OK');"].join('\n'),
    },
    fix: {
      'lockfile.js': [
        '// lockfile 生成：确定性（不含时间戳；依赖键按序输出）',
        "const { createHash } = require('crypto');",
        'function lock(deps) {',
        '  const sorted = Object.fromEntries(Object.keys(deps).sort().map((k) => [k, deps[k]]));',
        '  return { deps: sorted, integrity: "sha256-" + createHash("sha256").update(JSON.stringify(sorted)).digest("hex") };',
        '}',
        'module.exports = { lock };',
      ].join('\n'),
    },
    required: ['determinism_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['repro.js', 'resolver.js', 'reproducibility.md'],
    extraChecks: [{ id: 'determinism_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F05-E2/repro.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F05-E2/repro.js', log: 'pilot-workspace/FORMAL-F05-E2/resolution.log' },
    rationaleGt: '未修复态在相同输入下两次 resolve 产生不同 lockfile（真实预跑：canonical(l1) ≠ canonical(l2)，差异字段为 resolvedAt 的真实数值）；repro.js 与 resolver.js 冻结 ⇒ 只能在 lockfile 生成层重建确定性（去掉时间戳 + 依赖键规范排序）⇒ 属于计划层重规划（改变"如何生成可复现产物"的方案）而非局部修补，REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护文件或局部调参不收敛；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f05-evidence');
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
  `/**\n * benchmark/formal-seeds-f05.ts — F05 族 10 个变体的种子（由 scripts/formal-author-f05.ts 生成）\n */\nexport const FORMAL_F05_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

// ---------- 交付流程 + 正式判定路径证据 ----------
process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f05.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f05-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f05-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F05', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F05) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F05', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F05', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F05 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：依赖解析 / 包图 / Lockfile 一致性（与 F01 单模块工具、F02 CLI/管线、F03 HTTP+中间件、F04 事件流+状态机不同族）。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f05.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f05-version.json'), {
  dataset: 'formal', family: 'F05', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F05 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F05-*.yaml · formal-seeds-f05.ts · f05-review.md · f05-gt-drafts.json · f05-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F05 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f05-review.md');
process.exit(allOk ? 0 : 3);
