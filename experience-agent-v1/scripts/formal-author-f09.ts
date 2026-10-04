/**
 * scripts/formal-author-f09.ts — F09 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架：**模板渲染与快照一致性**（R1–R6 见 benchmark/formal/f09-draft-spec.md）
 *   R1 变量替换 {{name}}；缺失/null → ""    R2 HTML 转义（仅变量插入处；先 & 再 < > " '）
 *   R3 include {{> p}}：depth 0=主模板/最大 10；超限或循环 ⇒ render error
 *   R4 继承 {{extends base}} + {{block}}：仅单级；多级或循环 ⇒ render error
 *   R5 snapshot canonical：UTF-8 → CRLF→LF → 不动其它空白 → 逐字节比较；最终换行符属于内容
 *   R6 确定性：重复渲染逐字节相同；共享依赖下顺序不得改变任一 snapshot
 * 纪律：只产出 draft；三层证据；E 类真实预跑；prompt 不含 first-decision 提示。
 * 用法：node scripts/formal-author-f09.ts
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f09.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f09-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f09-gt-drafts.json');

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

/** R1–R6 契约（每变体 CONTRACT.md 引用同一套语义） */
const CONTRACT = (extra: string) =>
  [
    '# 渲染契约',
    '',
    'R1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。',
    'R2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，" → &quot;，\' → &#39;），',
    '   替换顺序为先 & 再 < > " \'；模板字面文本不转义。',
    'R3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；',
    '   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；',
    '   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。',
    'R4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，',
    '   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。',
    'R5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；',
    '   最终换行符属于快照内容（"hello\\n" 与 "hello" 必须不同）。',
    'R6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。',
    '',
    extra,
    '',
  ].join('\n');

/** 正确渲染器（R1–R6 全实现） */
const RENDERER_OK = [
  "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends",
  "const fs = require('fs');",
  "const path = require('path');",
  "function esc(s) {",
  "  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');",
  '}',
  'function readTemplate(file) { return fs.readFileSync(file, "utf8").replace(/\\r\\n/g, "\\n"); }',
  'function applyBlocks(baseSrc, childBlocks) {',
  '  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));',
  '}',
  'function renderFile(file, vars, depth, stack) {',
  '  if (depth > 10) throw new Error("include depth exceeded (max 10)");',
  '  let text = readTemplate(file);',
  '  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);',
  '  if (ext) {',
  '    if (depth > 0) throw new Error("multi-level extends not allowed");',
  '    const baseFile = path.join(path.dirname(file), ext[1]);',
  '    const baseSrc = readTemplate(baseFile);',
  '    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error("base must not extend");',
  '    const childBlocks = {};',
  '    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];',
  '    text = applyBlocks(baseSrc, childBlocks);',
  '  }',
  '  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {',
  '    const inc = path.join(path.dirname(file), name);',
  '    if (stack.indexOf(inc) >= 0) throw new Error("include cycle detected: " + name);',
  '    return renderFile(inc, vars, depth + 1, stack.concat([inc]));',
  '  });',
  '  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {',
  '    const v = vars[name];',
  '    return v === undefined || v === null ? "" : esc(v);',
  '  });',
  '  return text;',
  '}',
  'function render(name, vars) {',
  '  const file = path.join(__dirname, "templates", name);',
  '  return renderFile(file, vars || {}, 0, [file]);',
  '}',
  'module.exports = { render, esc };',
  '',
].join('\n');

const varsJson = (o: Record<string, unknown>) => JSON.stringify(o, null, 2) + '\n';

// ---------- C 类：模板渲染工具 + 并行编排 + 纯读取一致性检查器 ----------
const C_TOOL = (name: string, dur: number, token: string) =>
  "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const NAME = " + JSON.stringify(name) + ";\n" +
  "const DUR = " + dur + ";\n" +
  "const TOKEN = " + JSON.stringify(token) + ";\n" +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const { render } = require(path.join(ROOT, 'renderer.js'));\n" +
  "const start = Date.now();\n" +
  "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n" +
  "const vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\n" +
  "const out = render(NAME, vars);\n" +
  "const end = Date.now();\n" +
  "fs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\n" +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\n" +
  "console.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n";

const RUN_TEMPLATES = (names: string[]) =>
  "// 并行编排：并发渲染各模板，随后写出集成结论\n" +
  "const { spawn } = require('child_process');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const templates = " + JSON.stringify(names) + ";\n" +
  "function runOne(t) {\n" +
  "  return new Promise((resolve, reject) => {\n" +
  "    const c = spawn(process.execPath, [path.join(__dirname, 'work', t.replace(/\\.tpl$/, '') + '.js')], { stdio: 'ignore' });\n" +
  "    c.on('error', (e) => reject(new Error(t + ' spawn_error: ' + e.code + ' ' + e.message)));\n" +
  "    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(t + ' exit=' + code + ' signal=' + sig))));\n" +
  "  });\n" +
  "}\n" +
  "Promise.all(templates.map(runOne)).then(() => {\n" +
  "  const integ = '# 集成说明\\n集成：各模板并行渲染完成，快照与独立参考渲染一致。\\n';\n" +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), integ);\n" +
  "  console.log('parallel template rendering done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

/** 纯读取检查器：内嵌**独立参考渲染器**（不引用被测 renderer.js） */
const CHECK_SNAPSHOTS = (budget: number, names: string[]) =>
  "// 纯读取检查器：验证已发生的并行渲染 + 与独立参考渲染逐字节一致（不执行任何渲染工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "// ---- 独立参考渲染器（与被测 renderer.js 无共享代码）----\n" +
  "const REF = (function () {\n" +
  "  function read(f) { return fs.readFileSync(f, 'utf8').replace(/\\r\\n/g, '\\n'); }\n" +
  "  function esc(s) { return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('\"').join('&quot;').split(String.fromCharCode(39)).join('&#39;'); }\n" +
  "  function file(f, vars, depth, stack) {\n" +
  "    if (depth > 10) throw new Error('depth');\n" +
  "    let t = read(f);\n" +
  "    const e = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(t);\n" +
  "    if (e) {\n" +
  "      if (depth > 0) throw new Error('multi-level extends');\n" +
  "      const bs = read(path.join(path.dirname(f), e[1]));\n" +
  "      if (/^\\{\\{extends/m.test(bs)) throw new Error('base extends');\n" +
  "      const cb = {};\n" +
  "      for (const m of t.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) cb[m[1]] = m[2];\n" +
  "      t = bs.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (a, n, b) => (Object.prototype.hasOwnProperty.call(cb, n) ? cb[n] : b));\n" +
  "    }\n" +
  "    t = t.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (a, n) => { const inc = path.join(path.dirname(f), n); if (stack.indexOf(inc) >= 0) throw new Error('cycle'); return file(inc, vars, depth + 1, stack.concat([inc])); });\n" +
  "    t = t.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (a, n) => { const v = vars[n]; return v === undefined || v === null ? '' : esc(v); });\n" +
  "    return t;\n" +
  "  }\n" +
  "  return { render: (name, vars) => { const f = path.join(__dirname, 'templates', name); return file(f, vars || {}, 0, [f]); } };\n" +
  "})();\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const NAMES = " + JSON.stringify(names) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "for (const n of NAMES) {\n" +
  "  const base = n.replace(/\\.tpl$/, '');\n" +
  "  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n" +
  "  const got = fs.readFileSync(path.join(__dirname, 'snapshots', base + '.snap'), 'utf8');\n" +
  "  const ref = REF.render(n, vars);\n" +
  "  assert.strictEqual(got, ref, '快照与独立参考渲染不一致：' + base);\n" +
  "}\n" +
  "// R6：顺序无关性（以两种不同顺序各渲染一遍，结果必须逐字节相同）\n" +
  "for (const n of NAMES) {\n" +
  "  const base = n.replace(/\\.tpl$/, '');\n" +
  "  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n" +
  "  const first = REF.render(n, vars);\n" +
  "  for (const other of NAMES.slice().reverse()) { if (other !== n) { const o = other.replace(/\\.tpl$/, ''); REF.render(other, JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', o + '.json'), 'utf8'))); } }\n" +
  "  const second = REF.render(n, vars);\n" +
  "  assert.strictEqual(first, second, '共享依赖下顺序变化导致快照漂移：' + base);\n" +
  "}\n" +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('SNAPSHOTS OK templates=' + NAMES.length + ' span=' + span + 'ms order=independent');\n";

const C_VERIFY = (budget: number, names: string[], token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const NAMES = " + JSON.stringify(names) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "for (const n of NAMES) { const s = path.join(__dirname, 'snapshots', n.replace(/\\.tpl$/, '') + '.snap'); assert.ok(fs.existsSync(s), '缺少快照 ' + s); }\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

// ---------- 变体 ----------
const MAIN_TPL = 'Hello {{name}}\n';
const C1_NAMES = ['tpl-a.tpl', 'tpl-b.tpl', 'tpl-c.tpl'];
const C2_NAMES = ['page-x.tpl', 'page-y.tpl', 'page-z.tpl'];

const variants: Variant[] = [
  // A1 单变量渲染正确性（未修复：只替换第一处出现 ⇒ 非全局替换）
  V({
    id: 'FORMAL-F09-A1', category: 'A', variant: 1, token: 'F09-A1 OK',
    title: '单变量渲染正确性（第二处占位符未被替换）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-A1 渲染后第二个 {{name}} 占位符没有被替换。',
      '修正 renderer.js 使 node verify.js 通过。不得修改 verify.js 与 check-render.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('本任务只有一处缺陷：变量替换不是全局替换（R1）。'),
      'templates/greet.tpl': 'Hello {{name}}, bye {{name}}\n',
      'vars/greet.json': varsJson({ name: 'Alice' }),
      'renderer.js': RENDERER_OK.replace(
        "  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {",
        "  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/, (all, name) => {",
      ),
      'check-render.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { render } = require('./renderer.js');",
        "const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/greet.json'), 'utf8'));",
        "const out = render('greet.tpl', vars);",
        "assert.strictEqual(out, 'Hello Alice, bye Alice\\n', '所有出现都必须替换，实际 ' + JSON.stringify(out));",
        "console.log('RENDER OK');",
      ].join('\n'),
      'verify.js': ["require('./check-render.js');", "console.log('F09-A1 OK');"].join('\n'),
    },
    fix: { 'renderer.js': RENDERER_OK },
    required: ['render_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-render.js'],
    extraChecks: [{ id: 'render_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-A1/check-render.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（renderer.js 的变量替换不是全局替换），R1 已写死 ⇒ 直接修改是最小充分首决策。',
    rationaleNot: 'EXPLORE 无依据；委派类与 REPLAN 不适用。',
  }),
  // A2 转义一致性（未修复：漏 & 与引号转义）
  V({
    id: 'FORMAL-F09-A2', category: 'A', variant: 2, token: 'F09-A2 OK',
    title: '特殊字符转义不一致（漏转义）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-A2 的渲染输出与 CONTRACT.md 的转义规则不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-escape.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('R2：仅变量插入处转义，且必须覆盖 & < > " \'（先 & 再其余）。'),
      'templates/note.tpl': 'note: {{text}}\n',
      'vars/note.json': varsJson({ text: 'a & b < c > d " e \' f' }),
      'renderer.js': RENDERER_OK.replace(
        "  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');",
        "  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');",
      ),
      'check-escape.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { render } = require('./renderer.js');",
        "const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/note.json'), 'utf8'));",
        "const out = render('note.tpl', vars);",
        "assert.strictEqual(out, 'note: a &amp; b &lt; c &gt; d &quot; e &#39; f\\n', '转义必须覆盖 & < > \" \\'，实际 ' + JSON.stringify(out));",
        "console.log('ESCAPE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-escape.js');", "console.log('F09-A2 OK');"].join('\n'),
    },
    fix: { 'renderer.js': RENDERER_OK },
    required: ['escape_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-escape.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'escape_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-A2/check-escape.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件可能已知（renderer.js 的 esc），但"必须覆盖哪些字符、替换顺序如何"的判定依据写在 CONTRACT.md（R2）⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽）。',
  }),
  // B1 include 嵌套展开（未修复：include 不递归）
  V({
    id: 'FORMAL-F09-B1', category: 'B', variant: 1, token: 'F09-B1 OK',
    title: 'include/partial 嵌套展开不完整',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-B1 的最终输出缺少嵌套 partial 的内容（见 check-include.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-include.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('R3：include 必须递归展开（同目录、只做文本内联）。'),
      'templates/main.tpl': 'START\n{{> header.tpl}}END\n',
      'templates/header.tpl': 'HEADER\n{{> badge.tpl}}',
      'templates/badge.tpl': 'BADGE {{tag}}\n',
      'vars/main.json': varsJson({ tag: 'v1' }),
      'renderer.js': RENDERER_OK.replace(
        "    return renderFile(inc, vars, depth + 1, stack.concat([inc]));",
        "    return readTemplate(inc); // 缺陷：未递归展开嵌套 include",
      ),
      'check-include.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { render } = require('./renderer.js');",
        "const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/main.json'), 'utf8'));",
        "const out = render('main.tpl', vars);",
        "assert.strictEqual(out, 'START\\nHEADER\\nBADGE v1\\nEND\\n', '嵌套 include 必须被展开，实际 ' + JSON.stringify(out));",
        "console.log('INCLUDE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-include.js');", "console.log('F09-B1 OK');"].join('\n'),
    },
    fix: { 'renderer.js': RENDERER_OK },
    required: ['include_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-include.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'include_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-B1/check-include.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"嵌套内容缺失"，成因可能在 include 替换未递归、或路径解析错误、或 depth 传递错误；需沿模板依赖链定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只补一层而漏掉递归与 depth；委派与 REPLAN 不适用。',
  }),
  // B2 继承与 block override（未修复：忽略子模板 block）
  V({
    id: 'FORMAL-F09-B2', category: 'B', variant: 2, token: 'F09-B2 OK',
    title: '继承与 Block Override 未生效',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-B2 的子模板 block 没有覆盖父模板内容（见 check-inherit.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-inherit.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('R4：同名 block 覆盖（仅单级 extends）；未覆盖的 block 保留父内容。'),
      'templates/base.tpl': 'TITLE: {{block title}}default{{/block}}\nBODY: {{block body}}base body{{/block}}\n',
      'templates/child.tpl': '{{extends base.tpl}}\n{{block body}}child body{{/block}}\n',
      'vars/child.json': varsJson({}),
      'renderer.js': RENDERER_OK.replace(
        '    text = applyBlocks(baseSrc, childBlocks);',
        '    text = baseSrc; // 缺陷：忽略子模板的 block 覆盖',
      ),
      'check-inherit.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { render } = require('./renderer.js');",
        "const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/child.json'), 'utf8'));",
        "const out = render('child.tpl', vars);",
        "assert.strictEqual(out, 'TITLE: default\\nBODY: child body\\n', '子 block 必须覆盖 body、未覆盖的 title 保留父内容，实际 ' + JSON.stringify(out));",
        "console.log('INHERIT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-inherit.js');", "console.log('F09-B2 OK');"].join('\n'),
    },
    fix: { 'renderer.js': RENDERER_OK },
    required: ['inherit_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-inherit.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'inherit_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-B2/check-inherit.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"覆盖未生效"，成因可能在 extends 解析、block 收集或替换三处；且需区分 R3（include 内联）与 R4（block 覆盖体系）⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只改替换而漏掉 block 收集；委派与 REPLAN 不适用。',
  }),
  // C1 独立模板并行渲染一致性
  V({
    id: 'FORMAL-F09-C1', category: 'C', variant: 1, token: 'F09-C1 OK',
    title: '硬预算下的独立模板并行渲染（快照一致性）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-C1 需要在**总预算 6500 ms**内完成三个模板的渲染，最终必须同时成立：',
      '① work/ 下的三个渲染工具都必须真实执行完成，各自产出 snapshots/<name>.snap；',
      '② 每次执行都会把 {tpl,start,end,token,bytes} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 三模板完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '④ 每份快照必须与**独立参考渲染器**逐字节一致（UTF-8 → CRLF→LF → 逐字节比较）；',
      '⑤ 写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、renderer.js 与 work/ 下的渲染工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('R5/R6：快照逐字节比较；重复渲染与执行顺序不得改变快照。'),
      'templates/tpl-a.tpl': 'A: {{name}} / {{tag}}\n',
      'templates/tpl-b.tpl': 'B: {{> part-b.tpl}}\n',
      'templates/part-b.tpl': 'part {{name}}\n',
      'templates/tpl-c.tpl': 'C: {{missing}}|{{nil}}\n',
      'vars/tpl-a.json': varsJson({ name: 'Alice', tag: '<t>' }),
      'vars/tpl-b.json': varsJson({ name: 'Bob' }),
      'vars/tpl-c.json': varsJson({ nil: null }),
      'renderer.js': RENDERER_OK,
      'work/tpl-a.js': C_TOOL('tpl-a.tpl', 3500, 'TA-1a2b'),
      'work/tpl-b.js': C_TOOL('tpl-b.tpl', 3500, 'TB-77c4'),
      'work/tpl-c.js': C_TOOL('tpl-c.tpl', 3000, 'TC-31e8'),
      'check-timeline.js': CHECK_SNAPSHOTS(6500, C1_NAMES),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C1_NAMES, 'F09-C1 OK'),
    },
    fix: { 'run-templates.js': RUN_TEMPLATES(C1_NAMES), 'INTEGRATION.md': '# 集成说明\n集成：三个独立模板并行渲染完成，快照与独立参考一致。\n' },
    fixRun: 'node pilot-workspace/FORMAL-F09-C1/run-templates.js',
    required: ['templates_done', 'timeline_ok', 'snapshots_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'renderer.js', 'work/tpl-a.js', 'work/tpl-b.js', 'work/tpl-c.js'],
    extraChecks: [
      { id: 'templates_done', kind: 'file_exists', path: 'snapshots/tpl-a.snap' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-C1/check-timeline.js' },
      { id: 'snapshots_ok', kind: 'file_contains', path: 'snapshots/tpl-a.snap', expect: 'A: Alice' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三模板各自固定渲染耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行渲染不得改变任何快照**（每份快照必须与 checker 内嵌独立参考渲染器逐字节一致）。串行调度必然超预算（verify 直接拒绝），而模板级并行可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-模板-快照一致性"结构；REPLAN 不适用。',
  }),
  // C2 共享依赖下的确定性快照（顺序无关性）
  V({
    id: 'FORMAL-F09-C2', category: 'C', variant: 2, token: 'F09-C2 OK',
    title: '硬预算下的共享依赖渲染（顺序无关的确定性快照）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-C2 需要在**总预算 6500 ms**内完成三个共享同一 partial 的模板渲染：',
      '① work/ 下的三个渲染工具都必须真实执行完成，各自产出 snapshots/<name>.snap；',
      '② 每次执行都会把 {tpl,start,end,token,bytes} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 三模板完成时间跨度不得超过总预算；',
      '④ 三个模板都 include 同一个 `shared.tpl`；每份快照必须与**独立参考渲染器**逐字节一致；',
      '⑤ **顺序无关性**：共享依赖在不同完成顺序下不得导致快照漂移；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、renderer.js 与 work/ 下的渲染工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT('R6：共享依赖（同一 partial 被多模板使用）时，执行顺序不得改变任一 snapshot。'),
      'templates/shared.tpl': 'SHARED[{{env}}]\n',
      'templates/page-x.tpl': 'X\n{{> shared.tpl}}\n',
      'templates/page-y.tpl': 'Y\n{{> shared.tpl}}\n',
      'templates/page-z.tpl': 'Z\n{{> shared.tpl}}\n',
      'vars/page-x.json': varsJson({ env: 'prod' }),
      'vars/page-y.json': varsJson({ env: 'prod' }),
      'vars/page-z.json': varsJson({ env: 'prod' }),
      'renderer.js': RENDERER_OK,
      'work/page-x.js': C_TOOL('page-x.tpl', 3500, 'PX-4b70'),
      'work/page-y.js': C_TOOL('page-y.tpl', 3200, 'PY-2d19'),
      'work/page-z.js': C_TOOL('page-z.tpl', 3000, 'PZ-88af'),
      'check-timeline.js': CHECK_SNAPSHOTS(6500, C2_NAMES),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C2_NAMES, 'F09-C2 OK'),
    },
    fix: { 'run-templates.js': RUN_TEMPLATES(C2_NAMES), 'INTEGRATION.md': '# 集成说明\n集成：三个共享 partial 的模板并行渲染完成，快照与独立参考一致且与顺序无关。\n' },
    fixRun: 'node pilot-workspace/FORMAL-F09-C2/run-templates.js',
    required: ['templates_done', 'timeline_ok', 'order_independent', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'renderer.js', 'work/page-x.js', 'work/page-y.js', 'work/page-z.js'],
    extraChecks: [
      { id: 'templates_done', kind: 'file_exists', path: 'snapshots/page-x.snap' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-C2/check-timeline.js' },
      { id: 'order_independent', kind: 'file_contains', path: 'snapshots/page-y.snap', expect: 'SHARED[prod]' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 的 failure mode 不同：C1 的模板**互不共享依赖**；C2 的三个模板**共享同一 partial**（shared.tpl），除"预算内完成 + 快照等于独立参考"外，checker 还以两种不同顺序各渲染一遍并断言两轮结果**逐字节相同**（顺序无关性）。⇒ C1 测"独立单元并行渲染不改变输出"，C2 测"共享依赖 + 顺序变化不产生漂移"；串行超预算而模板级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-共享依赖-顺序无关性"结构；REPLAN 不适用。',
  }),
  // D1 多模板包并行生成
  V({
    id: 'FORMAL-F09-D1', category: 'D', variant: 1, token: 'F09-D1 OK',
    title: '三个模板包各自的缺陷 + 统一快照校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-D1 下的三个模板包 pkg-a / pkg-b / pkg-c 都需要修好，',
      '并且统一快照校验（check-unified.js）与该目录下的 node verify.js 也必须全部通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-unified.js 与 verify.js。',
    ].join('\n'),
    files: {
      'pkg-a/render.js': ['// A：变量替换', 'function fill(tpl, vars) { return tpl.replace(/\\{\\{name\\}\\}/, vars.name); }', 'module.exports = { fill };'].join('\n'),
      'pkg-b/render.js': ['// B：转义', 'function esc(s) { return String(s).split("<").join("&lt;"); }', 'module.exports = { esc };'].join('\n'),
      'pkg-c/render.js': ['// C：include 展开', 'function inline(tpl, parts) { return tpl; }', 'module.exports = { inline };'].join('\n'),
      'check-a.js': ["const assert = require('assert');", "const { fill } = require('./pkg-a/render.js');", "assert.strictEqual(fill('{{name}}/{{name}}', { name: 'A' }), 'A/A');", "console.log('A OK');"].join('\n'),
      'check-b.js': ["const assert = require('assert');", "const { esc } = require('./pkg-b/render.js');", "assert.strictEqual(esc('a & b < c'), 'a &amp; b &lt; c');", "console.log('B OK');"].join('\n'),
      'check-c.js': ["const assert = require('assert');", "const { inline } = require('./pkg-c/render.js');", "assert.strictEqual(inline('X{{> p}}Y', { p: 'P' }), 'XPY');", "console.log('C OK');"].join('\n'),
      'check-unified.js': [
        "const assert = require('assert');",
        "const a = require('./pkg-a/render.js');",
        "const b = require('./pkg-b/render.js');",
        "const c = require('./pkg-c/render.js');",
        "assert.strictEqual(a.fill('{{name}}', { name: 'Z' }), 'Z');",
        "assert.strictEqual(b.esc('<x>'), '&lt;x&gt;');",
        "assert.strictEqual(c.inline('{{> p}}', { p: 'P' }), 'P');",
        "console.log('UNIFIED OK');",
      ].join('\n'),
      'verify.js': ["require('./check-a.js');", "require('./check-b.js');", "require('./check-c.js');", "console.log('F09-D1 OK');"].join('\n'),
    },
    fix: {
      'pkg-a/render.js': ['// A：全局变量替换', 'function fill(tpl, vars) { return tpl.replace(/\\{\\{name\\}\\}/g, vars.name); }', 'module.exports = { fill };'].join('\n'),
      'pkg-b/render.js': ['// B：完整转义', 'function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }', 'module.exports = { esc };'].join('\n'),
      'pkg-c/render.js': ['// C：include 展开', 'function inline(tpl, parts) { return tpl.replace(/\\{\\{>\\s*([\\w.]+)\\}\\}/g, (all, n) => parts[n]); }', 'module.exports = { inline };'].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'unified_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-unified.js'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-D1/check-c.js' },
      { id: 'unified_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-D1/check-unified.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个模板包各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未利用包间互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // D2 预处理→渲染→快照→验证
  V({
    id: 'FORMAL-F09-D2', category: 'D', variant: 2, token: 'F09-D2 OK',
    title: '渲染流水线：预处理 → 渲染 → 快照 → 验证',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F09-D2 需要交付四份产物，且后一步必须消费前一步的真实产物：',
      '① prepared.json（含字段 "prepared": true 与 "vars" 对象）；',
      '② rendered.json（含字段 "rendered": true 与 "text"，其 text 必须等于用 prepared.vars 渲染 templates/main.tpl 的结果）；',
      '③ main.snap（内容必须与 rendered.json 的 text 逐字节一致）；',
      '④ verified.json（含字段 "verified": true 与 "bytes"，bytes 必须等于 main.snap 的字节长度）；node verify.js 必须通过。',
      '不得修改 verify.js。',
    ].join('\n'),
    files: {
      'templates/main.tpl': 'Hi {{who}}\n',
      'prepared.json': '{}\n',
      'rendered.json': '{}\n',
      'main.snap': '',
      'verified.json': '{}\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "const prep = rd('prepared.json');",
        "assert.strictEqual(prep.prepared, true, 'prepared.json 缺少 prepared');",
        "assert.ok(prep.vars && typeof prep.vars === 'object', 'prepared.json 缺少 vars');",
        "const ren = rd('rendered.json');",
        "assert.strictEqual(ren.rendered, true, 'rendered.json 缺少 rendered');",
        "const tpl = fs.readFileSync(path.join(__dirname, 'templates/main.tpl'), 'utf8');",
        "assert.strictEqual(ren.text, tpl.split('{{who}}').join(prep.vars.who), 'rendered.text 必须由 prepared.vars 渲染模板得到');",
        "const snap = fs.readFileSync(path.join(__dirname, 'main.snap'), 'utf8');",
        "assert.strictEqual(snap, ren.text, 'main.snap 必须与 rendered.text 逐字节一致');",
        "const ver = rd('verified.json');",
        "assert.strictEqual(ver.verified, true, 'verified.json 缺少 verified');",
        "assert.strictEqual(ver.bytes, Buffer.byteLength(snap, 'utf8'), 'verified.bytes 必须等于快照字节长度');",
        "console.log('F09-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'prepared.json': JSON.stringify({ prepared: true, vars: { who: 'Bob' } }, null, 2) + '\n',
      'rendered.json': JSON.stringify({ rendered: true, text: 'Hi Bob\n' }, null, 2) + '\n',
      'main.snap': 'Hi Bob\n',
      'verified.json': JSON.stringify({ verified: true, bytes: 7 }, null, 2) + '\n',
    },
    required: ['prepared_ok', 'rendered_ok', 'snapshot_ok', 'verified_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: [],
    extraChecks: [
      { id: 'prepared_ok', kind: 'file_contains', path: 'prepared.json', expect: 'prepared' },
      { id: 'rendered_ok', kind: 'file_contains', path: 'rendered.json', expect: 'rendered' },
      { id: 'snapshot_ok', kind: 'file_exists', path: 'main.snap' },
      { id: 'verified_ok', kind: 'file_contains', path: 'verified.json', expect: 'verified' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '四个阶段（预处理 → 渲染 → 快照 → 验证）各有独立产物，且 verify.js 断言**后一步消费前一步真实产物**（rendered.text 必须等于用 prepared.vars 渲染模板的结果；snap 必须与 text 逐字节一致；verified.bytes 必须等于 snap 字节数）⇒ 垂直依赖工作流结构由任务本身给出。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段化 artifact 依赖；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // E1 契约变化（旧 {{}} vs 新 ${}）+ REPLAN
  V({
    id: 'FORMAL-F09-E1', category: 'E', variant: 1, token: 'F09-E1 OK',
    title: '模板语法契约变化后的重新规划（新增兼容渲染路径）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F09-E1 的 legacy.js 是一版**已上线**的渲染实现，其输出被 legacy/consumer.js 按行为回放（legacy/greeting.snap 与 consumer 均不得修改）。',
      'CONTRACT-v2.md 的新要求必须成立；check.js 与 legacy.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT-v2.md': '# 新渲染契约\n\n1. 必须保留 legacy 语法 `{{name}}` 的行为（外部消费方回放，输出逐字节不变）；\n2. 必须支持新语法 `${name}`；\n3. 两种语法必须同时可用。\n',
      'legacy.js': ['// 已上线实现：仅支持 {{name}}，输出被 legacy/greeting.snap 冻结', "function render(tpl, vars) { return tpl.replace(/\\{\\{name\\}\\}/g, vars.name || ''); }", 'module.exports = { render };'].join('\n'),
      'legacy/greeting.snap': 'Hello Alice\n',
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：按冻结快照回放 legacy 输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { render } = require('../legacy.js');",
        "const golden = fs.readFileSync(path.join(__dirname, 'greeting.snap'), 'utf8');",
        "assert.strictEqual(render('Hello {{name}}\\n', { name: 'Alice' }), golden, '冻结的 legacy 输出被破坏');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'index.js': ['// 对外入口（可修改）：当前直接转发 legacy 实现', "const base = require('./legacy.js');", 'module.exports = { render: base.render };'].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { render } = require('./index.js');",
        "assert.strictEqual(render('Hello {{name}}\\n', { name: 'Alice' }), 'Hello Alice\\n', 'legacy 语法行为必须保留');",
        "assert.strictEqual(render('Hi ${name}\\n', { name: 'Bob' }), 'Hi Bob\\n', '新契约：必须支持 ${name} 语法，实际 ' + JSON.stringify(render('Hi ${name}\\n', { name: 'Bob' })));",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F09-E1 OK');"].join('\n'),
    },
    fix: {
      'render-v2.js': [
        '// 兼容路径：同时支持 {{name}} 与 ${name}',
        "const base = require('./legacy.js');",
        'function render(tpl, vars) { const step1 = base.render(tpl, vars); return step1.replace(/\\$\\{\\s*([\\w.]+)\\s*\\}/g, (all, n) => (vars[n] === undefined || vars[n] === null ? "" : String(vars[n]))); }',
        'module.exports = { render };',
      ].join('\n'),
      'index.js': ['// 对外入口：指向兼容路径', "const v2 = require('./render-v2.js');", 'module.exports = { render: v2.render };'].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['legacy.js', 'legacy/consumer.js', 'legacy/greeting.snap', 'check.js', 'CONTRACT-v2.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'render-v2.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F09-E1/check.js', log: 'pilot-workspace/FORMAL-F09-E1/attempt-log.txt' },
    rationaleGt: '现状把既有实现当作新契约：legacy.js 只支持 `{{name}}`，而 CONTRACT-v2 要求同时支持 `${name}`；legacy.js 与 consumer/冻结快照不可改、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容渲染路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // E2 模板源 vs 派生快照的权威关系
  V({
    id: 'FORMAL-F09-E2', category: 'E', variant: 2, token: 'F09-E2 OK',
    title: '模板源与派生快照的权威关系（快照必须由源重新派生）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F09-E2 的快照与模板源内容不一致。',
      '上一轮针对快照的处理记录在 snapshot.log。',
      'authority.md 规定的前置契约必须成立；snapshot.js 与 templates/ 下的模板都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'authority.md': '# 权威性契约\n\ntemplates/ 是 canonical source；snapshots/ 只是派生 artifact，不得作为渲染权威来源。\n直接修改 snapshot 不能替代 source 更新；snapshot 必须由 source 重新派生。\n',
      'templates/main.tpl': 'Hello {{name}}\n',
      'vars/main.json': varsJson({ name: 'Alice' }),
      'snapshots/main.snap': 'Hello Alice\n',
      'snapshot.js': [
        '// 受保护：快照读写入口',
        "const fs = require('fs');",
        "const path = require('path');",
        "function readSnapshot() { return fs.readFileSync(path.join(__dirname, 'snapshots/main.snap'), 'utf8'); }",
        "function writeSnapshot(text) { fs.writeFileSync(path.join(__dirname, 'snapshots/main.snap'), text, 'utf8'); }",
        'module.exports = { readSnapshot, writeSnapshot };',
      ].join('\n'),
      'display.js': [
        '// 展示层：当前直接读取已存在的快照（把派生 artifact 当成权威来源）',
        "const snapshot = require('./snapshot.js');",
        'function current() { return snapshot.readSnapshot(); }',
        'module.exports = { current };',
      ].join('\n'),
      'reconcile.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const display = require('./display.js');",
        "const tplPath = path.join(__dirname, 'templates/main.tpl');",
        "const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/main.json'), 'utf8'));",
        "const rendered = () => fs.readFileSync(tplPath, 'utf8').replace(/\\{\\{name\\}\\}/g, vars.name);",
        "assert.strictEqual(display.current(), rendered(), '快照必须由模板源重新派生，实际 ' + JSON.stringify(display.current()));",
        "const next = rendered().replace('Alice', 'Bob');",
        "fs.writeFileSync(tplPath, next, 'utf8'); // 只修改 canonical source",
        "assert.strictEqual(display.current(), next, '模板源变化后快照必须随之重新派生，实际 ' + JSON.stringify(display.current()));",
        "console.log('RECONCILE OK');",
      ].join('\n'),
      'verify.js': ["require('./reconcile.js');", "console.log('F09-E2 OK');"].join('\n'),
    },
    fix: {
      'display.js': [
        '// 展示层：由 canonical source（templates/ + vars/）重新渲染派生',
        "const fs = require('fs');",
        "const path = require('path');",
        "const snapshot = require('./snapshot.js');",
        'function current() {',
        "  const tpl = fs.readFileSync(path.join(__dirname, 'templates/main.tpl'), 'utf8');",
        "  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/main.json'), 'utf8'));",
        "  const out = tpl.replace(/\\{\\{name\\}\\}/g, vars[vars && 'name' in vars ? 'name' : ''] || '');",
        '  snapshot.writeSnapshot(out);',
        '  return out;',
        '}',
        'module.exports = { current };',
      ].join('\n'),
    },
    required: ['authority_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['reconcile.js', 'snapshot.js', 'authority.md', 'templates/main.tpl'],
    extraChecks: [{ id: 'authority_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F09-E2/reconcile.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F09-E2/reconcile.js', log: 'pilot-workspace/FORMAL-F09-E2/snapshot.log' },
    rationaleGt: '未修复态把派生 artifact 当权威：display 直接返回 snapshots/main.snap 的内容；当 `templates/main.tpl` 被修改（Alice → Bob，只改 source）后，快照仍是旧内容 ⇒ 真实预跑断言 actual="Hello Alice" / expected="Hello Bob"。合法解唯一路径：display 改为**由模板源重新渲染**（renderer 语义来自 canonical source），并写回派生产物；snapshot.js 与模板文件冻结 ⇒ 必须改变"快照从哪里来"的方案（计划层重规划）⇒ REPLAN 有构念依据且可满足。检查纪律：checker 不以 snapshot 反推 source。',
    rationaleNot: 'DIRECT 指向受保护文件或直接改 snapshots/main.snap 内容（把派生物当真值，不解决问题）；EXPLORE 不成立（权威性规则与成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f09-evidence');
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
  `/**\n * benchmark/formal-seeds-f09.ts — F09 族 10 个变体的种子（由 scripts/formal-author-f09.ts 生成）\n */\nexport const FORMAL_F09_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f09.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f09-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f09-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F09', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F09) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F09', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F09', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F09 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> **领域边界**：F09 只研究"给定模板 + 显式输入变量 + 固定渲染规则 ⇒ 正确且稳定的输出"。',
  '> 不引入：配置层叠(F07) / quota(F08) / cache / lockfile(F05) / 权限(F06) / 事件流(F04) / 部署迁移 / HTTP(F03) / 通用 workflow 本身。',
  '> 特别声明：**不做"模板配置层级覆盖"**（变量只来自已确定的显式输入对象）；变量类型仅字符串 / null / 缺失。',
  '> 与 F08-E2 的区分：F08-E2 = 配额账本 → 展示派生值（账务语义）；F09-E2 = **模板源 → 渲染快照**（渲染语义与产物均不同）。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f09.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f09-version.json'), {
  dataset: 'formal', family: 'F09', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F09 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F09-*.yaml · formal-seeds-f09.ts · f09-review.md · f09-gt-drafts.json · f09-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F09 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f09-review.md');
process.exit(allOk ? 0 : 3);
