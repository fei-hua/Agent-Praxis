/**
 * benchmark/pilot-seeds.ts — Pilot 工作区种子（确定性重建基线）
 *
 * 纪律（人工 2026-09-27 验收标准 #1）：
 *   每个 `pilot-workspace/<task-id>/` 必须能从固定基线**确定性重建**；
 *   Run 1 的改动绝不允许带入 Run 2 —— 每次 run 前必须执行 `scripts/pilot-setup.ts`
 *   （该脚本先清空整个 `pilot-workspace/` 再按本文件重建，并记录 SHA-256 基线清单）。
 *
 * 种子只包含**任务故意制造的状态**（缺陷、缺失文档、待修复配置等）；
 * 验收脚本（`verify-*.js` / `check-*.js`）属于种子的一部分，且列入 `protected_paths`。
 *
 * 批次：本文件当前覆盖 A/B 类 4 个任务（PILOT-A01/A02/B01/B02）；
 *       C/D/E 类 6 个任务的种子见文件末尾 TODO 与 Issue #6。
 */

export interface PilotSeed {
  /** 相对项目根（experience-agent-v1/）的路径 */
  path: string;
  content: string;
}

export const PILOT_TASK_IDS_WITH_SEEDS: readonly string[] = [
  'PILOT-A01',
  'PILOT-A02',
  'PILOT-B01',
  'PILOT-B02',
  'PILOT-C01',
  'PILOT-C02',
  'PILOT-D01',
  'PILOT-D02',
  'PILOT-E01',
  'PILOT-E02',
];

export const PILOT_SEEDS: readonly PilotSeed[] = [
  // ---------------- 工作区模块解析边界（必须第一个） ----------------
  // 种子与 checker 都是 CommonJS，而父项目 package.json 是 "type": "module"。
  // 若不在 pilot-workspace/ 显式声明 commonjs，所有 .js 会被按 ESM 解析 → require 报错
  // （Phase 0 的 M3 异常即此原因；dry-run 工作区同样处理）。
  {
    path: 'pilot-workspace/package.json',
    content: `{
  "name": "experience-agent-v1-pilot-workspace",
  "private": true,
  "type": "commonjs"
}
`,
  },

  // ---------------- PILOT-A01：修单文件计数缺陷 ----------------
  {
    path: 'pilot-workspace/PILOT-A01/src/heartbeat.js',
    content: `'use strict';
// 种子：tick() 的计数逻辑有缺陷（第一次调用后 count 不递增）—— A01 待修复点
const state = { count: 0, ts: null };

function tick() {
  state.ts = new Date().toISOString();
  // BUG: 缺少 count 递增
  return { count: state.count, ts: state.ts };
}

module.exports = { tick };
`,
  },
  {
    path: 'pilot-workspace/PILOT-A01/verify-heartbeat.js',
    content: `'use strict';
// 验收脚本（protected）：行为断言，与 Agent 采取的动作无关
const { tick } = require('./src/heartbeat');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

const a = tick();
const b = tick();
const c = tick();

assert(a.count === 1, '第一次 tick 后 count === 1');
assert(b.count === 2, '第二次 tick 后 count === 2');
assert(c.count === 3, '第三次 tick 后 count === 3');
assert(typeof c.ts === 'string' && !Number.isNaN(Date.parse(c.ts)), 'ts 是可解析的 ISO 字符串');
assert(new Date(c.ts) >= new Date(a.ts), 'ts 单调不减');

if (failed > 0) { console.log('HEARTBEAT FAIL'); process.exit(1); }
console.log('HEARTBEAT OK');
`,
  },

  // ---------------- PILOT-A02：为导出函数补 JSDoc ----------------
  {
    path: 'pilot-workspace/PILOT-A02/src/parser.js',
    content: `'use strict';
// 种子：所有导出函数都缺少 JSDoc —— A02 待补充点
function parsePairs(text) {
  return String(text)
    .split(',')
    .map((p) => p.split('='))
    .reduce((acc, pair) => {
      const k = String(pair[0]).trim();
      const v = String(pair[1] === undefined ? '' : pair[1]).trim();
      if (k !== '') acc[k] = v;
      return acc;
    }, {});
}

function normalizeKey(key) {
  return String(key).trim().toLowerCase().replace(/\\s+/g, '_');
}

module.exports = { parsePairs, normalizeKey };
`,
  },
  {
    path: 'pilot-workspace/PILOT-A02/check-doc.js',
    content: `'use strict';
// 验收脚本（protected）：检查 src/parser.js 的每个导出函数是否都有紧邻的 JSDoc（含 @param 与 @returns）
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src/parser.js');
const src = fs.readFileSync(srcPath, 'utf8');
const exp = /module\\.exports\\s*=\\s*\\{([^}]*)\\}/.exec(src);
if (!exp) { console.log('VERIFICATION_CONFIG_ERROR: 找不到 module.exports'); process.exit(2); }

const names = exp[1]
  .split(',')
  .map((s) => s.trim().split(':')[0].trim())
  .filter((s) => s !== '');
if (names.length === 0) { console.log('VERIFICATION_CONFIG_ERROR: module.exports 为空'); process.exit(2); }

let failed = 0;
for (const name of names) {
  const fn = new RegExp('function\\\\s+' + name + '\\\\s*\\\\(').exec(src);
  if (!fn) { console.log('VERIFICATION_CONFIG_ERROR: 找不到函数 ' + name); process.exit(2); }
  const before = src.slice(0, fn.index).replace(/\\s+$/, '');
  const jsdoc = /\\/\\*\\*[\\s\\S]*?\\*\\/$/.exec(before);
  const hasParam = !!jsdoc && /@param/.test(jsdoc[0]);
  const hasReturn = !!jsdoc && /@returns?/.test(jsdoc[0]);
  const ok = !!jsdoc && hasParam && hasReturn;
  console.log((ok ? 'ok - ' : 'FAIL - ') + name + ' 有 JSDoc（@param=' + hasParam + ', @returns=' + hasReturn + '）');
  if (!ok) failed++;
}

if (failed > 0) { console.log('DOC MISSING'); process.exit(1); }
console.log('DOC OK');
`,
  },

  {
    path: 'pilot-workspace/PILOT-A02/check-behavior.js',
    content: `'use strict';
// 验收脚本（protected）：行为回归 —— 补文档不得改变 parser 的行为
const { parsePairs, normalizeKey } = require('./src/parser');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(JSON.stringify(parsePairs('a=1, b = 2')) === JSON.stringify({ a: '1', b: '2' }), 'parsePairs 行为不变');
assert(parsePairs('x=1,,y=3').x === '1' && parsePairs('x=1,,y=3').y === '3', 'parsePairs 忽略空片段');
assert(normalizeKey('  Hello World ') === 'hello_world', 'normalizeKey 行为不变');

if (failed > 0) { console.log('BEHAVIOR FAIL'); process.exit(1); }
console.log('BEHAVIOR OK');
`,
  },

  // ---------------- PILOT-B01：判定被间接调用的模块 ----------------
  {
    path: 'pilot-workspace/PILOT-B01/app.js',
    content: `'use strict';
// 种子：入口（protected）
const { startClock } = require('./legacy/ui-clock');
module.exports = { boot: () => startClock() };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B01/legacy/ui-clock.js',
    content: `'use strict';
const { formatTime } = require('./time-format');
function startClock() { return formatTime(Date.now()); }
module.exports = { startClock };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B01/legacy/time-format.js',
    content: `'use strict';
function formatTime(ts) { return new Date(ts).toISOString(); }
module.exports = { formatTime };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B01/legacy/theme.js',
    content: `'use strict';
function theme() { return 'light'; }
module.exports = { theme };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B01/check-findings.js',
    content: `'use strict';
// 验收脚本（protected）：核对 findings.md 的 indirect 模块与调用链顺序
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'findings.md');
if (!fs.existsSync(p)) { console.log('FAIL - findings.md 不存在'); process.exit(1); }
const text = fs.readFileSync(p, 'utf8');

const ind = /indirect:\\s*([^\\s\\n]+)/i.exec(text);
const chain = /chain:\\s*([^\\n]+)/i.exec(text);
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(!!ind && /time-format\\.js/i.test(ind[1]), 'indirect 指向 time-format.js（实际：' + (ind ? ind[1] : '缺失') + '）');

const ch = chain ? chain[1] : '';
const i1 = ch.indexOf('app.js');
const i2 = ch.indexOf('ui-clock.js');
const i3 = ch.indexOf('time-format.js');
assert(i1 >= 0 && i2 > i1 && i3 > i2, 'chain 顺序为 app.js → ui-clock.js → time-format.js（实际：' + ch.trim() + '）');

if (failed > 0) { console.log('FINDINGS FAIL'); process.exit(1); }
console.log('FINDINGS OK');
`,
  },

  // ---------------- PILOT-B02：直接/间接使用集合 ----------------
  {
    path: 'pilot-workspace/PILOT-B02/shared/text.js',
    content: `'use strict';
function upper(s) { return String(s).toUpperCase(); }
function trim(s) { return String(s).trim(); }
function slug(s) { return String(s).trim().toLowerCase().replace(/\\s+/g, '-'); }
module.exports = { upper, trim, slug };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B02/shared/format.js',
    content: `'use strict';
const { upper, trim } = require('./text');
function title(s) { return upper(trim(s)); }
function label(s) { return '[' + trim(s) + ']'; }
module.exports = { title, label };
`,
  },
  {
    path: 'pilot-workspace/PILOT-B02/widget.js',
    content: `'use strict';
// 种子：widget 只直接使用 title / label / slug；upper / trim 属于间接使用（protected）
const format = require('./shared/format');
const text = require('./shared/text');
module.exports = {
  render: (s) => format.title(s) + '::' + format.label(s) + '::' + text.slug(s),
};
`,
  },
  {
    path: 'pilot-workspace/PILOT-B02/check-impact.js',
    content: `'use strict';
// 验收脚本（protected）：核对 impact.md 的 direct / indirect 集合
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'impact.md');
if (!fs.existsSync(p)) { console.log('FAIL - impact.md 不存在'); process.exit(1); }
const text = fs.readFileSync(p, 'utf8');
const section = (name) => {
  const m = new RegExp('##\\\\s*' + name + '\\\\s*\\\\n([\\\\s\\\\S]*?)(?=\\\\n##\\\\s|$)', 'i').exec(text);
  return m ? m[1] : null;
};
const parseSet = (body) =>
  new Set(
    (body || '')
      .split('\\n')
      .map((l) => l.replace(/^[-*\\s]+/, '').replace(/[\`'"(),]/g, '').trim())
      .filter((l) => l !== '' && !/^#/.test(l)),
  );

const direct = section('direct');
const indirect = section('indirect');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

if (direct === null || indirect === null) {
  console.log('VERIFICATION_CONFIG_ERROR: impact.md 缺少 ## direct / ## indirect 小节');
  process.exit(2);
}
const D = parseSet(direct);
const I = parseSet(indirect);
const sameSet = (set, expected) => set.size === expected.length && expected.every((x) => set.has(x));

assert(sameSet(D, ['title', 'label', 'slug']), 'direct 集合 = {title, label, slug}（实际：{' + [...D].join(',') + '}）');
assert(sameSet(I, ['upper', 'trim']), 'indirect 集合 = {upper, trim}（实际：{' + [...I].join(',') + '}）');

if (failed > 0) { console.log('IMPACT FAIL'); process.exit(1); }
console.log('IMPACT OK');
`,
  },

  // ---------------- PILOT-C01：无障碍审查与修订 ----------------
  {
    path: 'pilot-workspace/PILOT-C01/ui/a11y.css',
    content: `/* 种子：无障碍缺陷（对比度不足 / 缺焦点样式 / 命中区过小）—— C01 待修订点 */
.card { color: #aaaaaa; background: #ffffff; padding: 8px; }
.button { color: #999999; background: #ffffff; padding: 6px; min-height: 24px; }
.nav { color: #444444; background: #ffffff; padding: 8px; }
`,
  },
  {
    path: 'pilot-workspace/PILOT-C01/verify-a11y.js',
    content: `'use strict';
// 验收脚本（protected）：只检查任务结果（对比度 / 焦点可见性 / 命中区），不检查 Agent 用了什么工具
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'ui/a11y.css');
if (!fs.existsSync(cssPath)) { console.log('VERIFICATION_CONFIG_ERROR: ui/a11y.css 不存在'); process.exit(2); }
const css = fs.readFileSync(cssPath, 'utf8');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

function rule(selector) {
  const rx = new RegExp('\\\\' + selector + '\\\\s*\\\\{([^}]*)\\\\}', 'i');
  const m = rx.exec(css);
  return m ? m[1] : null;
}
function hexOf(block, prop) {
  const m = new RegExp(prop + '\\\\s*:\\\\s*(#[0-9a-fA-F]{3,6})').exec(block || '');
  return m ? m[1] : null;
}
function lum(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(fg, bg) {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

assert(/:focus-visible/.test(css), '存在 :focus-visible 焦点样式');

for (const sel of ['.card', '.button', '.nav']) {
  const block = rule(sel);
  assert(block !== null, sel + ' 规则仍存在');
  if (block) {
    const fg = hexOf(block, 'color');
    const bg = hexOf(block, 'background');
    const ok = !!fg && !!bg && contrast(fg, bg) >= 4.5;
    assert(ok, sel + ' 文本对比度 ≥ 4.5（实际 ' + (fg && bg ? contrast(fg, bg).toFixed(2) : 'n/a') + '）');
  }
}

const btn = rule('.button') || '';
const mh = /min-height\\s*:\\s*(\\d+)px/.exec(btn);
const mw = /min-width\\s*:\\s*(\\d+)px/.exec(btn);
assert(!!mh && Number(mh[1]) >= 44, '.button min-height ≥ 44px（实际 ' + (mh ? mh[1] : 'n/a') + '）');
assert(!!mw && Number(mw[1]) >= 44, '.button min-width ≥ 44px（实际 ' + (mw ? mw[1] : 'n/a') + '）');

if (failed > 0) { console.log('A11Y FAIL'); process.exit(1); }
console.log('A11Y OK');
`,
  },
  {
    path: 'pilot-workspace/PILOT-C01/check-selectors.js',
    content: `'use strict';
// 验收脚本（protected）：选择器结构未改变（类名集合必须仍是 .card/.button/.nav 三个）
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, 'ui/a11y.css'), 'utf8');
const set = new Set((css.match(/\\.[a-z][\\w-]*/gi) || []).map((s) => s.toLowerCase()));
const expected = ['.card', '.button', '.nav'];
const extra = [...set].filter((s) => !expected.includes(s));
const missing = expected.filter((s) => !set.has(s));
console.log('类名集合：' + [...set].join(', '));
if (missing.length || extra.length) {
  console.log('SELECTORS CHANGED（缺少：' + missing.join(',') + '；新增：' + extra.join(',') + '）');
  process.exit(1);
}
console.log('SELECTORS OK');
`,
  },

  // ---------------- PILOT-C02：输入校验审查与修正 ----------------
  {
    path: 'pilot-workspace/PILOT-C02/src/auth.js',
    content: `'use strict';
// 种子：输入校验缺失（api_immutable：导出名与签名不得改变）—— C02 待修正点
function validateEmail(email) {
  return true; // BUG: 永远通过
}

function validateAge(age) {
  return true; // BUG: 永远通过
}

function login(email, age) {
  return { ok: validateEmail(email) && validateAge(age) };
}

module.exports = { validateEmail, validateAge, login };
`,
  },
  {
    path: 'pilot-workspace/PILOT-C02/verify-auth.js',
    content: `'use strict';
// 验收脚本（protected）：只检查任务结果（校验行为 + 对外签名），不检查 Agent 用了什么工具
const auth = require('./src/auth');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(auth.validateEmail('a@b.com') === true, "validateEmail('a@b.com') === true");
assert(auth.validateEmail('bad') === false, "validateEmail('bad') === false");
assert(auth.validateEmail('') === false, "validateEmail('') === false");
assert(auth.validateEmail('a b@c.com') === false, '含空格的邮箱非法');
assert(auth.validateEmail(undefined) === false, 'undefined 非法');

assert(auth.validateAge(20) === true, 'validateAge(20) === true');
assert(auth.validateAge(1) === true, 'validateAge(1) === true');
assert(auth.validateAge(120) === true, 'validateAge(120) === true');
assert(auth.validateAge(0) === false, 'validateAge(0) === false');
assert(auth.validateAge(121) === false, 'validateAge(121) === false');
assert(auth.validateAge(20.5) === false, '非整数年龄非法');
assert(auth.validateAge('20') === false, '字符串年龄非法');

const r = auth.login('a@b.com', 20);
assert(r && r.ok === true, 'login 对合法输入返回 ok=true');
const bad = auth.login('bad', 20);
assert(bad && bad.ok === false, 'login 对非法输入返回 ok=false');

if (failed > 0) { console.log('AUTH FAIL'); process.exit(1); }
console.log('AUTH OK');
`,
  },
  {
    path: 'pilot-workspace/PILOT-C02/check-api.js',
    content: `'use strict';
// 验收脚本（protected）：对外 API 未改变（导出名集合与函数性）
const auth = require('./src/auth');
const names = Object.keys(auth).sort();
const expected = ['login', 'validateAge', 'validateEmail'];
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(JSON.stringify(names) === JSON.stringify(expected), '导出名集合不变（实际：' + names.join(',') + '）');
for (const n of expected) assert(typeof auth[n] === 'function', n + ' 仍是函数');

if (failed > 0) { console.log('API CHANGED'); process.exit(1); }
console.log('API OK');
`,
  },

  // ---------------- PILOT-D01：依赖图 + 测试归档 ----------------
  {
    path: 'pilot-workspace/PILOT-D01/src/one.js',
    content: `'use strict';
function base(n) { return Number(n) + 1; }
module.exports = { base };
`,
  },
  {
    path: 'pilot-workspace/PILOT-D01/src/two.js',
    content: `'use strict';
const { base } = require('./one');
function twice(n) { return base(base(n)); }
module.exports = { twice };
`,
  },
  {
    path: 'pilot-workspace/PILOT-D01/tests/run-tests.js',
    content: `'use strict';
// 验收脚本（protected）：测试套件（输出 TESTS PASS）
const { twice } = require('../src/two');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(twice(1) === 3, 'twice(1) === 3');
assert(twice(0) === 2, 'twice(0) === 2');
assert(twice(-1) === 1, 'twice(-1) === 1');

if (failed > 0) { console.log('TESTS FAIL'); process.exit(1); }
console.log('TESTS PASS');
`,
  },
  {
    path: 'pilot-workspace/PILOT-D01/check-graph.js',
    content: `'use strict';
// 验收脚本（protected）：依赖图内容正确（只检查产物，不检查是否用了 subagent）
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'module-graph.md');
if (!fs.existsSync(p)) { console.log('FAIL - module-graph.md 不存在'); process.exit(1); }
const text = fs.readFileSync(p, 'utf8');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(/two\\.js\\s*(?:→|->|=>)\\s*one\\.js/i.test(text), '文档化 two.js → one.js（实际缺少该边）');
assert(/one\\.js\\s*(?:→|->|=>)\\s*\\(?\\s*(none|无|—|-)\\s*\\)?/i.test(text), '文档化 one.js 无内部依赖');
assert(!/one\\.js\\s*(?:→|->|=>)\\s*one\\.js/i.test(text), '没有自环');

if (failed > 0) { console.log('GRAPH FAIL'); process.exit(1); }
console.log('GRAPH OK');
`,
  },

  // ---------------- PILOT-D02：版本 breaking change + 兼容检查 ----------------
  {
    path: 'pilot-workspace/PILOT-D02/deps/pinned.json',
    content: `{
  "libx": "1.2.0",
  "liby": "0.9.1"
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-D02/deps/latest.json',
    content: `{
  "libx": "2.0.0",
  "liby": "0.9.3"
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-D02/deps/changelogs.json',
    content: `{
  "libx": { "2.0.0": ["REMOVED oldApi()", "CHANGED run() signature"] },
  "liby": { "0.9.3": ["FIXED null handling"] }
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-D02/compat-check.js',
    content: `'use strict';
// 验收脚本（protected）：兼容性检查套件（输出 COMPAT OK）
const fs = require('fs');
const path = require('path');
const pinned = JSON.parse(fs.readFileSync(path.join(__dirname, 'deps/pinned.json'), 'utf8'));
const latest = JSON.parse(fs.readFileSync(path.join(__dirname, 'deps/latest.json'), 'utf8'));
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(Object.keys(pinned).length === Object.keys(latest).length, '依赖数量一致');
assert(pinned.liby === '0.9.1' && latest.liby === '0.9.3', 'liby 为补丁级升级');

if (failed > 0) { console.log('COMPAT FAIL'); process.exit(1); }
console.log('COMPAT OK');
`,
  },
  {
    path: 'pilot-workspace/PILOT-D02/check-notes.js',
    content: `'use strict';
// 验收脚本（protected）：升级说明内容正确（只检查产物）
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'upgrade-notes.md');
if (!fs.existsSync(p)) { console.log('FAIL - upgrade-notes.md 不存在'); process.exit(1); }
const text = fs.readFileSync(p, 'utf8');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

assert(/libx/i.test(text) && /2\\.0\\.0/.test(text), '提到 libx 2.0.0');
assert(
  /libx[\\s\\S]{0,200}?(breaking|破坏|不兼容)/i.test(text) || /(breaking|破坏|不兼容)[\\s\\S]{0,200}?libx/i.test(text),
  '将 libx 判为 breaking change',
);
assert(/liby/i.test(text) && /0\\.9\\.3/.test(text), '提到 liby 0.9.3');
assert(
  /liby[\\s\\S]{0,200}?(非破坏|无破坏|non-?breaking|兼容|补丁)/i.test(text) ||
    /(非破坏|无破坏|non-?breaking|兼容|补丁)[\\s\\S]{0,200}?liby/i.test(text),
  '将 liby 判为非破坏性升级',
);

if (failed > 0) { console.log('NOTES FAIL'); process.exit(1); }
console.log('NOTES OK');
`,
  },

  // ---------------- PILOT-E01：已知失败状态恢复（迁移配置缺失） ----------------
  // ⚠️ 纪律：verification 只检查最终任务结果，**绝不检查 first_decision == REPLAN**
  //    （否则 ground truth 会偷渡进 Task Success，CDA 与 Task Success 不再独立）
  {
    path: 'pilot-workspace/PILOT-E01/run-migration.js',
    content: `'use strict';
// 已知失败现场：缺少 config.json 时中止（断言不得删除或注释）
const fs = require('fs');
const path = require('path');

function assert(cond, msg) { if (!cond) { const e = new Error('ASSERT: ' + msg); e.code = 'ASSERT'; throw e; } }

function loadConfig() {
  const p = path.join(__dirname, 'config.json');
  assert(fs.existsSync(p), 'config.json 必须存在');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\\uFEFF/, ''));
  assert(typeof cfg.target === 'string' && cfg.target !== '', 'target 必须是非空字符串');
  assert(Array.isArray(cfg.steps) && cfg.steps.length > 0, 'steps 必须是非空数组');
  return cfg;
}

function run() {
  const cfg = loadConfig();
  return { ok: true, target: cfg.target, steps: cfg.steps.length };
}

module.exports = { run, loadConfig };

if (require.main === module) {
  try {
    const r = run();
    console.log('MIGRATION OK target=' + r.target + ' steps=' + r.steps);
  } catch (e) {
    console.log('MIGRATION FAILED: ' + e.message);
    process.exit(1);
  }
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-E01/verify-migration.js',
    content: `'use strict';
// 验收脚本（protected）：只检查最终任务结果（迁移可执行），不检查 Agent 的决策与动作
const { run } = require('./run-migration');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

let result = null;
try {
  result = run();
} catch (e) {
  console.log('FAIL - run() 抛出：' + e.message);
  failed++;
}

assert(!!result && result.ok === true, 'run() 返回 ok=true');
assert(!!result && typeof result.target === 'string' && result.target !== '', '迁移目标已解析');
assert(!!result && result.steps > 0, '存在迁移步骤');

if (failed > 0) { console.log('MIGRATION CHECK FAIL'); process.exit(1); }
console.log('MIGRATION OK');
`,
  },

  // ---------------- PILOT-E02：已知失败状态恢复（构建清单引用缺失源文件） ----------------
  {
    path: 'pilot-workspace/PILOT-E02/manifest.json',
    content: `{
  "targets": ["src/app.js", "src/missing.js"]
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-E02/src/app.js',
    content: `'use strict';
function main() { return 'app'; }
module.exports = { main };
`,
  },
  {
    path: 'pilot-workspace/PILOT-E02/build.js',
    content: `'use strict';
// 已知失败现场：清单引用了不存在的源文件（断言不得删除或注释）
const fs = require('fs');
const path = require('path');

function assert(cond, msg) { if (!cond) { const e = new Error('ASSERT: ' + msg); e.code = 'ASSERT'; throw e; } }

function loadManifest() {
  const p = path.join(__dirname, 'manifest.json');
  assert(fs.existsSync(p), 'manifest.json 必须存在');
  const m = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\\uFEFF/, ''));
  assert(Array.isArray(m.targets) && m.targets.length > 0, 'targets 必须是非空数组');
  for (const t of m.targets) {
    assert(fs.existsSync(path.join(__dirname, t)), 'target 必须存在: ' + t);
  }
  return m;
}

function run() {
  const m = loadManifest();
  return { ok: true, targets: m.targets.length };
}

module.exports = { run, loadManifest };

if (require.main === module) {
  try {
    const r = run();
    console.log('BUILD OK targets=' + r.targets);
  } catch (e) {
    console.log('BUILD FAILED: ' + e.message);
    process.exit(1);
  }
}
`,
  },
  {
    path: 'pilot-workspace/PILOT-E02/verify-build.js',
    content: `'use strict';
// 验收脚本（protected）：只检查最终任务结果（构建可完成），不检查 Agent 的决策与动作
const { run } = require('./build');
let failed = 0;
function assert(cond, msg) { console.log((cond ? 'ok - ' : 'FAIL - ') + msg); if (!cond) failed++; }

let result = null;
try {
  result = run();
} catch (e) {
  console.log('FAIL - run() 抛出：' + e.message);
  failed++;
}

assert(!!result && result.ok === true, 'run() 返回 ok=true');
assert(!!result && result.targets > 0, '存在构建目标');

if (failed > 0) { console.log('BUILD CHECK FAIL'); process.exit(1); }
console.log('BUILD OK');
`,
  },
];
