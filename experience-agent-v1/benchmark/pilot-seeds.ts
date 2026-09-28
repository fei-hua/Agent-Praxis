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

export const PILOT_TASK_IDS_WITH_SEEDS: readonly string[] = ['PILOT-A01', 'PILOT-A02', 'PILOT-B01', 'PILOT-B02'];

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
];
