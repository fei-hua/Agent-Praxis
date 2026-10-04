/**
 * scripts/formal-author-f07.ts — F07 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01–F06 各族的领域均不同）：**配置层叠 + 合并语义**
 *   defaults ≺ environment ≺ profile ≺ local ⇒ final effective config
 *   S1 missing ≠ null · S2 object ⇒ deep merge · S3 数组 replace/append（逐变体显式声明）
 *   S4 覆盖方向固定 · S5 null 语义显式声明 · S6 迁移与兼容
 * 纪律同前：只产出 draft；三层证据（schema / node verify.js / verifyTask）；E 类真实预跑 + 日志后冻结基线；
 *          C 类另有「反事实（仅改调度）+ canonical(E_parallel)==canonical(E_reference)」证据；prompt 不含 first-decision 提示。
 * 用法：node scripts/formal-author-f07.ts
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f07.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f07-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f07-gt-drafts.json');
const VERSION = path.join(ROOT, 'benchmark', 'formal', 'f07-version.json');

interface Variant {
  id: string; category: string; variant: number; token: string; title: string;
  taskType: string; complexity: string; scope: string; characteristics: string[]; constraints: string[];
  prompt: string; files: Record<string, string>; fix: Record<string, string>; fixRun?: string;
  required: string[]; forbidden: string[]; protectedExtra?: string[];
  extraChecks?: Array<Record<string, unknown>>;
  expected: string[]; expectedDelegation: boolean; rationaleGt: string; rationaleNot: string;
  preRun?: { command: string; log: string };
  /** C 类：反事实脚本内容（仅起草期证据，不进入任务目录）与预算 */
  counterfactual?: string; budget?: number;
}
const V = (v: Variant): Variant => v;

const J = (o: unknown): string => JSON.stringify(o, null, 2) + '\n';

// ---------- S1–S6 契约文本（逐变体显式声明；checker 逐条引用） ----------
const CONTRACT_MD = (arrays: 'replace' | 'append', nullDeletes: boolean, extra: string[] = []): string =>
  [
    '# 层叠契约（S1–S6，本任务的唯一判定依据）',
    '',
    '- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。',
    '- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。',
    `- **S3 数组语义 = ${arrays}**：${arrays === 'replace' ? '上层数组**整体替换**下层（不追加）' : '上层数组**追加**到下层之后（顺序 = 下层 + 上层）'}。本变体全局限定为该语义。`,
    '- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。',
    `- **S5 null 语义 = ${nullDeletes ? '删除该键' : '普通值'}**：${nullDeletes ? '层叠后该键**不存在**。' : '层叠后该键的值就是 null。'}`,
    '- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。',
    ...(extra.length ? ['', ...extra] : []),
    '',
  ].join('\n');

const MIGRATION_E1 = [
  '## 迁移条款（S6）',
  '',
  '1. 必须保留 legacy 字段 `version`（number）与 `timeout`（number）：legacy/config.json 的字段布局被外部消费方**逐字段回放**。',
  '2. 必须新增 `layers`（非空字符串数组：本条配置实际经过的层名）与 `migrated: true`。',
  '3. 上述两条必须**同时**成立。',
];

const RECOMPUTE_E2 = [
  '## 重算条款（S4 的运行时含义）',
  '',
  'effective config 必须由**当前**层树按需推导：层输入（layer store）发生变化后，下一次 resolve 必须反映新值。',
  '不得使用模块加载时拍下的快照；不得返回上一次计算的结果。',
];

// ---------- 固定层叠规则（独立参考实现：内嵌进 checker，与任务实现无关） ----------
const CANON_JS =
  "const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);";

const REF_RULES_JS = (arrays: 'replace' | 'append', nullDeletes: boolean): string =>
`// 固定层叠规则（独立参考实现，与任务实现无关；S1–S5）
const LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];
const ARRAYS = '${arrays}';
const NULL_DELETES = ${String(nullDeletes)};
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function mergeObjectsRef(base, over) {
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }
    if (isPlainObject(v) && isPlainObject(out[k])) { out[k] = mergeObjectsRef(out[k], v); continue; }
    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }
    out[k] = v;
  }
  return out;
}
function mergeLayersRef(layers) {
  let out = {};
  for (const name of LAYER_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;
    out = mergeObjectsRef(out, layers[name]);
  }
  return out;
}
`;

// ---------- 任务内实现（正确版；缺陷版由字符串替换派生） ----------
const MERGE_JS = (arrays: 'replace' | 'append', nullDeletes: boolean): string =>
`// 层叠合并实现（S1–S5）
// S4 覆盖方向（固定）：defaults < environment < profile < local
// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge
// S3 数组语义 = ${arrays}；S5 null 语义 = ${nullDeletes ? '删除该键' : '作为普通值保留'}
const LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];
const ARRAYS = '${arrays}';
const NULL_DELETES = ${String(nullDeletes)};

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function mergeObjects(base, over) {
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }
    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }
    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }
    out[k] = v;
  }
  return out;
}

function mergeLayers(layers) {
  let out = {};
  for (const name of LAYER_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;
    out = mergeObjects(out, layers[name]);
  }
  return out;
}

module.exports = { mergeLayers, mergeObjects, LAYER_ORDER };
`;

const ORDER_LINE = "const LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];";
const ORDER_LINE_BAD = "const LAYER_ORDER = ['local', 'profile', 'environment', 'defaults']; // 缺陷：覆盖方向被反转";
const NULL_LINE = "    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }";
const NULL_LINE_BAD = "    if (v === undefined || v === null) { delete out[k]; continue; } // 缺陷：缺失键被当作删除";
const KEYS_LINE = "  for (const k of Object.keys(over)) {";
const KEYS_LINE_BAD = "  const keys = Object.keys(base).concat(Object.keys(over)).filter((k, i, a) => a.indexOf(k) === i);\n  for (const k of keys) {";
const RECURSE_LINE = "    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }";
const RECURSE_LINE_BAD = "    // 缺陷：不做递归合并，嵌套对象被整体替换（深层键丢失）";

const RESOLVE_JS =
`// 按层叠链生成 effective config（读取 layers/ 下的层文件）
const fs = require('fs');
const path = require('path');
const { mergeLayers } = require('./merge.js');
const LAYER_NAMES = ['defaults', 'environment', 'profile', 'local'];
function loadLayers() {
  const layers = {};
  for (const n of LAYER_NAMES) {
    const p = path.join(__dirname, 'layers', n + '.json');
    if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return layers;
}
function resolve() { return mergeLayers(loadLayers()); }
module.exports = { resolve, loadLayers };
`;

// ---------- C 类：来源加载工具（受保护 fixture） ----------
const C_SOURCE_TOOL = (src: string, layers: string[], dur: number, token: string): string =>
`// 配置来源加载工具：读取本来源负责的层文件并记录时间线（受保护，不得修改）
const fs = require('fs');
const path = require('path');
const SRC = ${JSON.stringify(src)};
const LAYERS = ${JSON.stringify(layers)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const layers = {};
for (const n of LAYERS) layers[n] = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers', n + '.json'), 'utf8'));
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, layers: LAYERS }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, token: TOKEN, layers }, null, 2) + '\\n');
console.log(SRC + ' loaded [' + LAYERS.join(',') + '] in ' + (end - start) + 'ms');
`;

const C_PROFILE_TOOL = (profile: string, dur: number, token: string): string =>
`// 单 profile 生效配置生成工具（受保护，不得修改）：内部保持固定层顺序
const fs = require('fs');
const path = require('path');
const { mergeLayers } = require(path.join(__dirname, '..', 'merge.js'));
const PROFILE = ${JSON.stringify(profile)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const layers = {
  defaults: rd(path.join(ROOT, 'layers', 'defaults.json')),
  environment: rd(path.join(ROOT, 'layers', 'environment.json')),
  profile: rd(path.join(ROOT, 'layers', 'profiles', PROFILE + '.json')),
  local: rd(path.join(ROOT, 'layers', 'local.json')),
};
const effective = mergeLayers(layers);
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: 'prof-' + PROFILE, start, end, token: TOKEN, profile: PROFILE }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', PROFILE + '.json'), JSON.stringify({ profile: PROFILE, token: TOKEN, effective }, null, 2) + '\\n');
console.log('profile ' + PROFILE + ' done in ' + (end - start) + 'ms');
`;

const C1_RUNNER = (srcs: string[]): string =>
`// 并行编排：并发加载各配置来源，**再按固定层叠规则合并**为 effective config（并行不得破坏层叠语义）
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const SOURCES = ${JSON.stringify(srcs)};
function runOne(s) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
    c.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));
    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(s + ' exit=' + code + ' signal=' + sig))));
  });
}
Promise.all(SOURCES.map(runOne)).then(() => {
  const { mergeLayers } = require(path.join(__dirname, 'merge.js'));
  const layers = {};
  for (const s of SOURCES) {
    const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8'));
    for (const name of Object.keys(frag.layers)) layers[name] = frag.layers[name];
  }
  const effective = mergeLayers(layers);
  fs.writeFileSync(path.join(__dirname, 'effective.json'), JSON.stringify({ effective }, null, 2) + '\\n');
  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各配置来源并行加载完成，按固定层叠规则（defaults<environment<profile<local + S1..S5）合并为 effective config。\\n');
  console.log('parallel config load done');
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const C1_CHECK_TIMELINE = (budget: number, srcs: string[], requiredKeys: string[]): string =>
`// 纯读取检查器：验证已发生的并行加载 + **层叠语义等价**（不执行任何来源工具）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_RULES_JS('replace', true)}${CANON_JS}
const BUDGET_MS = ${budget};
const SOURCES = ${JSON.stringify(srcs)};
const REQUIRED_KEYS = ${JSON.stringify(requiredKeys)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
// —— 各来源片段携带的层内容必须与冻结的层文件语义一致 ——
const LAYERS_DIR = path.join(__dirname, 'layers');
for (const s of SOURCES) {
  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8'));
  for (const name of Object.keys(frag.layers)) {
    const file = JSON.parse(fs.readFileSync(path.join(LAYERS_DIR, name + '.json'), 'utf8'));
    assert.deepStrictEqual(canon(frag.layers[name]), canon(file), '来源 ' + s + ' 携带的层 ' + name + ' 与层文件不一致');
  }
}
// —— 层叠等价：canonical(E_parallel) == canonical(E_reference)，参考由固定规则独立生成 ——
const allLayers = {};
for (const name of LAYER_ORDER) {
  const p = path.join(LAYERS_DIR, name + '.json');
  if (fs.existsSync(p)) allLayers[name] = JSON.parse(fs.readFileSync(p, 'utf8'));
}
const reference = mergeLayersRef(allLayers);
const effective = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective.json'), 'utf8')).effective;
assert.deepStrictEqual(canon(effective), canon(reference), '并行加载后的 effective config 与固定层叠规则生成的参考结果不一致（层叠语义被破坏）');
for (const k of REQUIRED_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(effective, k), 'effective config 缺少 CONTRACT 声明的必需键：' + k);
console.log('TIMELINE OK sources=' + new Set(entries.map((e) => e.src)).size + ' span=' + span + 'ms layering=equivalent');
`;

const C1_VERIFY = (budget: number, srcs: string[], requiredKeys: string[], token: string): string =>
`const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_RULES_JS('replace', true)}${CANON_JS}
const BUDGET_MS = ${budget};
const SOURCES = ${JSON.stringify(srcs)};
const REQUIRED_KEYS = ${JSON.stringify(requiredKeys)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const LAYERS_DIR = path.join(__dirname, 'layers');
const allLayers = {};
for (const name of LAYER_ORDER) {
  const p = path.join(LAYERS_DIR, name + '.json');
  if (fs.existsSync(p)) allLayers[name] = JSON.parse(fs.readFileSync(p, 'utf8'));
}
const reference = mergeLayersRef(allLayers);
const effective = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective.json'), 'utf8')).effective;
assert.deepStrictEqual(canon(effective), canon(reference), 'effective config 与固定层叠规则生成的参考结果不一致');
for (const k of REQUIRED_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(effective, k), 'effective config 缺少必需键：' + k);
console.log(${JSON.stringify(token)});
`;

const C2_RUNNER = (profiles: string[]): string =>
`// 并行编排：并发生成各 profile 的 effective config（每个 profile 内部保持固定层顺序），再汇总为完整矩阵
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const PROFILES = ${JSON.stringify(profiles)};
function runOne(p) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'work', 'prof-' + p + '.js')], { stdio: 'ignore' });
    c.on('error', (e) => reject(new Error(p + ' spawn_error: ' + e.code + ' ' + e.message)));
    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(p + ' exit=' + code + ' signal=' + sig))));
  });
}
Promise.all(PROFILES.map(runOne)).then(() => {
  const matrix = {};
  const keys = new Set();
  for (const p of PROFILES) {
    const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', p + '.json'), 'utf8'));
    matrix[p] = frag.effective;
    for (const k of Object.keys(frag.effective)) keys.add(k);
  }
  const keyList = Array.from(keys).sort();
  fs.writeFileSync(path.join(__dirname, 'matrix.json'), JSON.stringify({ matrix, keys: keyList }, null, 2) + '\\n');
  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各 profile 的 effective config 并行生成完成，矩阵按 profile × key 完整覆盖，且每个 profile 内部保持固定层顺序。\\n');
  console.log('parallel profile matrix done');
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const C2_REF_JS =
`const LAYERS_DIR = path.join(__dirname, 'layers');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
function profileLayers(id) {
  return {
    defaults: rd(path.join(LAYERS_DIR, 'defaults.json')),
    environment: rd(path.join(LAYERS_DIR, 'environment.json')),
    profile: rd(path.join(LAYERS_DIR, 'profiles', id + '.json')),
    local: rd(path.join(LAYERS_DIR, 'local.json')),
  };
}
`;

const C2_CHECK_TIMELINE = (budget: number, profiles: string[]): string =>
`// 纯读取检查器：验证已发生的并行 profile 批量生成 + **矩阵等价**（不执行任何 profile 工具）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_RULES_JS('replace', true)}${CANON_JS}${C2_REF_JS}
const BUDGET_MS = ${budget};
const PROFILES = ${JSON.stringify(profiles)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.profile)).size, PROFILES.length, 'distinct profile 数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
// —— 矩阵等价：canonical(matrix_parallel) == canonical(matrix_reference)，参考由固定规则独立生成 ——
const reference = {};
for (const p of PROFILES) reference[p] = mergeLayersRef(profileLayers(p));
const delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;
assert.deepStrictEqual(canon(delivered), canon(reference), '并行生成的矩阵与固定层叠规则生成的参考矩阵不一致');
const keyList = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).keys;
const union = new Set();
for (const p of PROFILES) for (const k of Object.keys(reference[p])) union.add(k);
for (const k of union) assert.ok(keyList.indexOf(k) >= 0, '矩阵 key 覆盖不完整，缺少：' + k);
for (const p of PROFILES) for (const k of union) assert.ok(Object.prototype.hasOwnProperty.call(delivered[p], k), 'profile ' + p + ' 缺少键 ' + k);
console.log('TIMELINE OK profiles=' + new Set(entries.map((e) => e.profile)).size + ' span=' + span + 'ms matrix=equivalent');
`;

const C2_VERIFY = (budget: number, profiles: string[], token: string): string =>
`const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_RULES_JS('replace', true)}${CANON_JS}${C2_REF_JS}
const BUDGET_MS = ${budget};
const PROFILES = ${JSON.stringify(profiles)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.profile)).size, PROFILES.length, 'distinct profile 数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const reference = {};
for (const p of PROFILES) reference[p] = mergeLayersRef(profileLayers(p));
const delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;
assert.deepStrictEqual(canon(delivered), canon(reference), '矩阵与固定层叠规则生成的参考矩阵不一致');
const union = new Set();
for (const p of PROFILES) for (const k of Object.keys(reference[p])) union.add(k);
for (const p of PROFILES) for (const k of union) assert.ok(Object.prototype.hasOwnProperty.call(delivered[p], k), 'profile ' + p + ' 缺少键 ' + k);
console.log(${JSON.stringify(token)});
`;

const C1_COUNTERFACTUAL = (srcs: string[]): string =>
`// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批层文件 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const SOURCES = ${JSON.stringify(srcs)};
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const s of SOURCES) execFileSync(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
const { mergeLayers } = require(path.join(__dirname, 'merge.js'));
const layers = {};
for (const s of SOURCES) {
  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8'));
  for (const name of Object.keys(frag.layers)) layers[name] = frag.layers[name];
}
fs.writeFileSync(path.join(__dirname, 'effective.json'), JSON.stringify({ effective: mergeLayers(layers) }, null, 2) + '\\n');
console.log('serial counterfactual done');
`;

const C2_COUNTERFACTUAL = (profiles: string[]): string =>
`// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批层文件 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PROFILES = ${JSON.stringify(profiles)};
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const p of PROFILES) execFileSync(process.execPath, [path.join(__dirname, 'work', 'prof-' + p + '.js')], { stdio: 'ignore' });
const matrix = {};
const keys = new Set();
for (const p of PROFILES) {
  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', p + '.json'), 'utf8'));
  matrix[p] = frag.effective;
  for (const k of Object.keys(frag.effective)) keys.add(k);
}
fs.writeFileSync(path.join(__dirname, 'matrix.json'), JSON.stringify({ matrix, keys: Array.from(keys).sort() }, null, 2) + '\\n');
console.log('serial counterfactual done');
`;

// ---------- 变体参数 ----------
const C1_SRCS = ['cfg-a', 'cfg-b', 'cfg-c'];
const C2_PROFILES = ['p1', 'p2', 'p3'];
const C1_KEYS = ['service', 'features', 'log'];
const C_BUDGET = 6500;

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F07-A1', category: 'A', variant: 1, token: 'F07-A1 OK',
    title: '层叠覆盖方向反了（defaults 覆盖了 local）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-A1 的 effective config 里 defaults 层覆盖了 local 层（期望 local 覆盖 defaults）。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-precedence.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'layers/defaults.json': J({ timeout: 30, retries: 3 }),
      'layers/environment.json': J({ timeout: 20 }),
      'layers/profile.json': J({ timeout: 10 }),
      'layers/local.json': J({ timeout: 5 }),
      'merge.js': MERGE_JS('replace', true).replace(ORDER_LINE, ORDER_LINE_BAD),
      'resolve.js': RESOLVE_JS,
      'check-precedence.js': [
        "const assert = require('assert');",
        "const { resolve } = require('./resolve.js');",
        'const cfg = resolve();',
        "assert.strictEqual(cfg.timeout, 5, 'local 必须覆盖 defaults：期望 timeout=5，实际 ' + cfg.timeout);",
        "assert.strictEqual(cfg.retries, 3, 'defaults 独有的键必须保留，实际 ' + cfg.retries);",
        "console.log('PRECEDENCE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-precedence.js');", "console.log('F07-A1 OK');"].join('\n'),
    },
    fix: { 'merge.js': MERGE_JS('replace', true) },
    required: ['precedence_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-precedence.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'precedence_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-A1/check-precedence.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（层叠顺序常量写反），目标文件与成功判据都唯一明确 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（成因已由错误输出直接定位）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F07-A2', category: 'A', variant: 2, token: 'F07-A2 OK',
    title: 'missing 被当作 null（缺失键误删下层值）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-A2 的 effective config 与 CONTRACT.md 规定的 S1 / S5 语义不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-null-missing.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'layers/defaults.json': J({ timeout: 30, retries: 3, debug: true }),
      'layers/environment.json': J({ timeout: 20 }),
      'layers/profile.json': J({ timeout: 10 }),
      'layers/local.json': J({ timeout: 5, debug: null }),
      'merge.js': MERGE_JS('replace', true).replace(KEYS_LINE, KEYS_LINE_BAD).replace(NULL_LINE, NULL_LINE_BAD),
      'resolve.js': RESOLVE_JS,
      'check-null-missing.js': [
        "const assert = require('assert');",
        "const { resolve } = require('./resolve.js');",
        'const cfg = resolve();',
        "assert.strictEqual(cfg.timeout, 5, 'local 必须覆盖 defaults：期望 timeout=5，实际 ' + cfg.timeout);",
        "assert.strictEqual(cfg.retries, 3, 'S1：environment 层缺失的键不得删除下层值，实际 ' + cfg.retries);",
        "assert.ok(!Object.prototype.hasOwnProperty.call(cfg, 'debug'), 'S5：null 必须表示删除该键，实际 ' + JSON.stringify(cfg.debug));",
        "console.log('NULL-MISSING OK');",
      ].join('\n'),
      'verify.js': ["require('./check-null-missing.js');", "console.log('F07-A2 OK');"].join('\n'),
    },
    fix: { 'merge.js': MERGE_JS('replace', true) },
    required: ['null_missing_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-null-missing.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'null_missing_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-A2/check-null-missing.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（merge.js），但「缺失 ≠ null」与「null = 删除」的判定依据写在 CONTRACT.md（S1/S5）⇒ 先查契约再改与直接修改并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F07-B1', category: 'B', variant: 1, token: 'F07-B1 OK',
    title: '深层嵌套配置在层叠中丢失（只合并了一层）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-B1 的 effective config 里深层配置不完整（期望见 check-nested.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-nested.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'layers/defaults.json': J({ service: { database: { host: 'db.internal', timeout: 30, pool: 5 }, cache: { ttl: 60 } }, log: { level: 'info' } }),
      'layers/environment.json': J({ service: { database: { timeout: 20 } } }),
      'layers/profile.json': J({ service: { cache: { ttl: 120 } } }),
      'layers/local.json': J({ service: { database: { host: 'db.local' } } }),
      'merge.js': MERGE_JS('replace', true).replace(RECURSE_LINE, RECURSE_LINE_BAD),
      'resolve.js': RESOLVE_JS,
      'check-nested.js': [
        "const assert = require('assert');",
        "const { resolve } = require('./resolve.js');",
        'const cfg = resolve();',
        "assert.strictEqual(cfg.service.database.timeout, 20, 'environment 层的 timeout=20 必须生效，实际 ' + cfg.service.database.timeout);",
        "assert.strictEqual(cfg.service.database.pool, 5, 'defaults 层的深层键 pool 必须保留，实际 ' + JSON.stringify(cfg.service.database));",
        "assert.strictEqual(cfg.service.database.host, 'db.local', 'local 层必须覆盖 host，实际 ' + cfg.service.database.host);",
        "assert.strictEqual(cfg.service.cache.ttl, 120, 'profile 层的嵌套键 cache.ttl 必须与 defaults 合并，实际 ' + JSON.stringify(cfg.service.cache));",
        "assert.strictEqual(cfg.log.level, 'info', '未参与的键必须保留，实际 ' + cfg.log.level);",
        "console.log('NESTED OK');",
      ].join('\n'),
      'verify.js': ["require('./check-nested.js');", "console.log('F07-B1 OK');"].join('\n'),
    },
    fix: { 'merge.js': MERGE_JS('replace', true) },
    required: ['nested_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-nested.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'nested_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-B1/check-nested.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是「深层配置不完整」，成因可能在合并递归、层顺序或某层 JSON 结构；需沿 root→service→database 逐层定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只补一层而漏掉 cache 分支；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F07-B2', category: 'B', variant: 2, token: 'F07-B2 OK',
    title: '数组层叠语义与契约相反（声明 replace，实现 append）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-B2 的数组字段层叠结果与 CONTRACT.md 声明的数组语义不一致。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-array-semantics.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'layers/defaults.json': J({ plugins: ['core'], tags: ['base'], timeout: 30 }),
      'layers/environment.json': J({ plugins: ['env-a'] }),
      'layers/profile.json': J({ plugins: ['prof-b'], tags: ['prof'] }),
      'layers/local.json': J({ plugins: ['local-c'] }),
      'merge.js': MERGE_JS('replace', true).replace("const ARRAYS = 'replace';", "const ARRAYS = 'append'; // 缺陷：CONTRACT 声明 replace"),
      'resolve.js': RESOLVE_JS,
      'check-array-semantics.js': [
        "const assert = require('assert');",
        "const { resolve } = require('./resolve.js');",
        'const cfg = resolve();',
        "assert.deepStrictEqual(cfg.plugins, ['local-c'], '数组语义必须是 replace（上层整体替换），实际 ' + JSON.stringify(cfg.plugins));",
        "assert.deepStrictEqual(cfg.tags, ['prof'], '数组语义必须是 replace（local 未声明 tags 时保留 profile 结果），实际 ' + JSON.stringify(cfg.tags));",
        "assert.strictEqual(cfg.timeout, 30, '非数组键仍按层叠覆盖（local 未声明则保留 defaults），实际 ' + cfg.timeout);",
        "console.log('ARRAY OK');",
      ].join('\n'),
      'verify.js': ["require('./check-array-semantics.js');", "console.log('F07-B2 OK');"].join('\n'),
    },
    fix: { 'merge.js': MERGE_JS('replace', true) },
    required: ['array_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-array-semantics.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'array_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-B2/check-array-semantics.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '数组结果错误，成因可能在 merge 层（数组分支的语义选择）或调用路径（层文件装配与调用方式）；需定位合并层与其调用路径 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 容易只改调用方而留下 merge 层语义不一致；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F07-C1', category: 'C', variant: 1, token: 'F07-C1 OK',
    title: '硬预算下的多来源并行配置加载（层叠语义不得被破坏）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-C1 需要在**总预算 6500 ms**内完成三个配置来源的加载，最终必须同时成立：',
      '① work/ 下的三个来源加载工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {src,start,end,token,layers} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 各来源完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '④ 合并后的 effective.json 必须与按 CONTRACT.md 固定层叠规则（defaults<environment<profile<local + S1..S5）独立生成的参考结果**语义等价**；',
      '⑤ 写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、merge.js 与 work/ 下的来源工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true, [
        '## C 类附加条款',
        '',
        '1. 三个来源共享总预算 6500 ms；',
        '2. 并行加载不得破坏层叠语义：effective config 必须等于由固定层叠规则从同一批层文件独立生成的参考结果；',
        '3. effective config 必须包含必需键：service / features / log。',
      ]),
      'merge.js': MERGE_JS('replace', true),
      'layers/defaults.json': J({ service: { database: { host: 'db.internal', timeout: 30 } }, features: ['core'] }),
      'layers/environment.json': J({ service: { database: { timeout: 20 } }, log: { level: 'info' } }),
      'layers/profile.json': J({ features: ['prof'] }),
      'layers/local.json': J({ service: { database: { host: 'db.local' } } }),
      'work/cfg-a.js': C_SOURCE_TOOL('cfg-a', ['defaults'], 3500, 'CA-3f91'),
      'work/cfg-b.js': C_SOURCE_TOOL('cfg-b', ['environment', 'profile'], 3500, 'CB-77d2'),
      'work/cfg-c.js': C_SOURCE_TOOL('cfg-c', ['local'], 3000, 'CC-19a4'),
      'check-timeline.js': C1_CHECK_TIMELINE(C_BUDGET, C1_SRCS, C1_KEYS),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C1_VERIFY(C_BUDGET, C1_SRCS, C1_KEYS, 'F07-C1 OK'),
    },
    fix: {
      'run-sources.js': C1_RUNNER(C1_SRCS),
      'INTEGRATION.md': '# 集成说明\n集成：三个配置来源并行加载完成，effective config 与固定层叠规则生成的参考结果语义等价。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F07-C1/run-sources.js',
    counterfactual: C1_COUNTERFACTUAL(C1_SRCS),
    budget: C_BUDGET,
    required: ['sources_done', 'timeline_ok', 'effective_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'merge.js', 'work/cfg-a.js', 'work/cfg-b.js', 'work/cfg-c.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/cfg-a.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-C1/check-timeline.js' },
      { id: 'effective_written', kind: 'file_contains', path: 'effective.json', expect: 'effective' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三来源各自固定加载耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行加载不得破坏层叠语义**（effective.json 必须与固定规则独立生成的参考结果 canonical 相等）。串行调度必然超预算（verify 直接拒绝），来源级并行 + 按固定层叠规则合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-来源-层叠等价」结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F07-C2', category: 'C', variant: 2, token: 'F07-C2 OK',
    title: '硬预算下的多 profile 批量生效配置（profile 内层顺序不得被打乱）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-C2 需要在**总预算 6500 ms**内完成三个 profile 的 effective config 批量生成与矩阵汇总：',
      '① work/ 下的三个 profile 生成工具都必须真实执行完成，各自产出 out/<profile>.json 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {src,start,end,token,profile} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个 profile 内部必须保持固定层顺序（defaults<environment<profile<local，见 CONTRACT.md）；',
      '④ 三个 profile 的完成时间跨度不得超过总预算；',
      '⑤ 汇总矩阵 matrix.json 必须与按固定层叠规则独立生成的参考矩阵**语义等价**，且按 profile × key 完整覆盖；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、merge.js 与 work/ 下的生成工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true, [
        '## C 类附加条款',
        '',
        '1. 三个 profile 共享总预算 6500 ms；',
        '2. 每个 profile 内部必须保持固定层顺序 defaults<environment<profile<local；',
        '3. 矩阵必须按 profile × key 完整覆盖，且与固定层叠规则独立生成的参考矩阵语义等价。',
      ]),
      'merge.js': MERGE_JS('replace', true),
      'layers/defaults.json': J({ service: { database: { host: 'db.internal', timeout: 30 } }, features: ['core'], log: { level: 'info' } }),
      'layers/environment.json': J({ service: { database: { timeout: 20 } }, features: ['env'] }),
      'layers/local.json': J({ service: { database: { host: 'db.local' } } }),
      'layers/profiles/p1.json': J({ features: ['p1'], service: { cache: { ttl: 60 } } }),
      'layers/profiles/p2.json': J({ features: ['p2'], service: { cache: { ttl: 120 } } }),
      'layers/profiles/p3.json': J({ features: ['p3'], service: { database: { timeout: 45 } } }),
      'work/prof-p1.js': C_PROFILE_TOOL('p1', 3200, 'PA-9f10'),
      'work/prof-p2.js': C_PROFILE_TOOL('p2', 3000, 'PB-2c73'),
      'work/prof-p3.js': C_PROFILE_TOOL('p3', 3400, 'PC-51d8'),
      'check-timeline.js': C2_CHECK_TIMELINE(C_BUDGET, C2_PROFILES),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C2_VERIFY(C_BUDGET, C2_PROFILES, 'F07-C2 OK'),
    },
    fix: {
      'run-profiles.js': C2_RUNNER(C2_PROFILES),
      'INTEGRATION.md': '# 集成说明\n集成：三个 profile 的 effective config 并行生成完成，矩阵按 profile × key 完整覆盖且与参考矩阵语义等价。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F07-C2/run-profiles.js',
    counterfactual: C2_COUNTERFACTUAL(C2_PROFILES),
    budget: C_BUDGET,
    required: ['profiles_done', 'timeline_ok', 'matrix_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'merge.js', 'work/prof-p1.js', 'work/prof-p2.js', 'work/prof-p3.js'],
    extraChecks: [
      { id: 'profiles_done', kind: 'file_exists', path: 'out/p1.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-C2/check-timeline.js' },
      { id: 'matrix_written', kind: 'file_contains', path: 'matrix.json', expect: 'matrix' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但非复制：对象是 profile 集合而非来源集合，层文件集合与矩阵覆盖要求不同。同样存在「硬预算 + profile 内固定层顺序 + 并行结果必须与固定规则参考矩阵等价」的可机械验证约束，串行超预算而 profile 级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画「预算-profile-矩阵等价」结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F07-D1', category: 'D', variant: 1, token: 'F07-D1 OK',
    title: '三套配置模块各自的缺陷 + 统一生效配置与报告校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-D1 下的三套配置模块 mod-a / mod-b / mod-c 都需要修好，',
      '并交付统一产物 effective-config.json（含 effective 字段）与 config-report.md（配置层叠报告），',
      '两者必须与修好后的模块一致（见 check-report.js）；node verify.js 必须通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-report.js、build.js、verify.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'layers/defaults.json': J({ service: { database: { host: 'db.internal', timeout: 30, pool: 5 } }, features: ['core'] }),
      'layers/environment.json': J({ service: { database: { timeout: 20 } }, features: ['env'] }),
      'layers/profile.json': J({ service: { cache: { ttl: 120 } } }),
      'layers/local.json': J({ service: { database: { host: 'db.local' } } }),
      'mod-a/deep-merge.js': [
        "// mod-a：对象递归合并（数组交给 mod-b）",
        "const { mergeArray } = require('../mod-b/array-merge.js');",
        'function deepMerge(base, over) {',
        '  const out = Object.assign({}, base);',
        '  for (const k of Object.keys(over)) {',
        '    const v = over[k];',
        '    // 缺陷：不做递归合并，嵌套对象被整体替换',
        '    if (Array.isArray(v) && Array.isArray(out[k])) { out[k] = mergeArray(out[k], v); continue; }',
        '    out[k] = v;',
        '  }',
        '  return out;',
        '}',
        'module.exports = { deepMerge };',
      ].join('\n'),
      'mod-b/array-merge.js': [
        '// mod-b：数组语义（CONTRACT 声明 replace）',
        'function mergeArray(base, over) { return base.concat(over); } // 缺陷：实现为 append',
        'module.exports = { mergeArray };',
      ].join('\n'),
      'mod-c/precedence.js': [
        '// mod-c：层顺序',
        "const ORDER = ['local', 'profile', 'environment', 'defaults']; // 缺陷：顺序反转",
        'function orderLayers(names) { return names.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); }',
        'module.exports = { orderLayers };',
      ].join('\n'),
      'build.js': [
        '// 统一装配（受保护）：按 mod-c 的层顺序，用 mod-a 的合并实现逐层归并',
        "const { deepMerge } = require('./mod-a/deep-merge.js');",
        "const { orderLayers } = require('./mod-c/precedence.js');",
        'function build(layers) {',
        '  let out = {};',
        '  for (const name of orderLayers(Object.keys(layers))) out = deepMerge(out, layers[name]);',
        '  return out;',
        '}',
        'module.exports = { build };',
      ].join('\n'),
      'check-a.js': [
        "const assert = require('assert');",
        "const { deepMerge } = require('./mod-a/deep-merge.js');",
        "assert.deepStrictEqual(deepMerge({ a: { b: { c: 1, d: 2 } } }, { a: { b: { d: 3 } } }), { a: { b: { c: 1, d: 3 } } });",
        "console.log('A OK');",
      ].join('\n'),
      'check-b.js': [
        "const assert = require('assert');",
        "const { mergeArray } = require('./mod-b/array-merge.js');",
        "assert.deepStrictEqual(mergeArray(['x', 'y'], ['z']), ['z'], 'CONTRACT 声明数组语义为 replace');",
        "console.log('B OK');",
      ].join('\n'),
      'check-c.js': [
        "const assert = require('assert');",
        "const { orderLayers } = require('./mod-c/precedence.js');",
        "assert.deepStrictEqual(orderLayers(['local', 'defaults', 'profile', 'environment']), ['defaults', 'environment', 'profile', 'local']);",
        "console.log('C OK');",
      ].join('\n'),
      'check-report.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { build } = require('./build.js');",
        CANON_JS,
        "const LAYERS = ['defaults', 'environment', 'profile', 'local'];",
        'const layers = {};',
        "for (const n of LAYERS) { const p = path.join(__dirname, 'layers', n + '.json'); if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8')); }",
        'const ref = build(layers);',
        "const delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective-config.json'), 'utf8')).effective;",
        "assert.deepStrictEqual(canon(delivered), canon(ref), '统一 effective-config.json 必须等于三套模块修好后的层叠结果');",
        "const report = fs.readFileSync(path.join(__dirname, 'config-report.md'), 'utf8');",
        "assert.ok(report.indexOf('配置层叠报告') >= 0, 'config-report.md 缺少报告标题');",
        "assert.ok(report.indexOf(String(ref.service.database.timeout)) >= 0, 'config-report.md 必须记录生效的 timeout');",
        "console.log('REPORT OK');",
      ].join('\n'),
      'effective-config.json': '{}\n',
      'config-report.md': '# 配置报告\n（待补）\n',
      'verify.js': [
        "require('./check-a.js');",
        "require('./check-b.js');",
        "require('./check-c.js');",
        "require('./check-report.js');",
        "console.log('F07-D1 OK');",
      ].join('\n'),
    },
    fix: {
      'mod-a/deep-merge.js': [
        "// mod-a：对象递归合并（数组交给 mod-b）",
        "const { mergeArray } = require('../mod-b/array-merge.js');",
        'function deepMerge(base, over) {',
        '  const out = Object.assign({}, base);',
        '  for (const k of Object.keys(over)) {',
        '    const v = over[k];',
        '    const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);',
        '    if (isObj(v) && isObj(out[k])) { out[k] = deepMerge(out[k], v); continue; }',
        '    if (Array.isArray(v) && Array.isArray(out[k])) { out[k] = mergeArray(out[k], v); continue; }',
        '    out[k] = v;',
        '  }',
        '  return out;',
        '}',
        'module.exports = { deepMerge };',
      ].join('\n'),
      'mod-b/array-merge.js': [
        '// mod-b：数组语义（CONTRACT 声明 replace ⇒ 上层整体替换下层）',
        'function mergeArray(base, over) { return over.slice(); }',
        'module.exports = { mergeArray };',
      ].join('\n'),
      'mod-c/precedence.js': [
        '// mod-c：层顺序（S4 固定方向）',
        "const ORDER = ['defaults', 'environment', 'profile', 'local'];",
        'function orderLayers(names) { return names.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); }',
        'module.exports = { orderLayers };',
      ].join('\n'),
      'effective-config.json': J({
        effective: {
          service: { database: { host: 'db.local', timeout: 20, pool: 5 }, cache: { ttl: 120 } },
          features: ['env'],
        },
      }),
      'config-report.md': [
        '# 配置层叠报告',
        '',
        '- 层顺序（S4）：defaults < environment < profile < local',
        '- 数组语义（S3）：replace；null 语义（S5）：删除该键',
        '- 生效的 service.database.timeout = 20',
        '- 生效的 service.database.host = db.local',
        '- 生效的 features = ["env"]',
        '',
      ].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'report_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-report.js', 'build.js', 'CONTRACT.md'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-D1/check-c.js' },
      { id: 'report_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-D1/check-report.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三套配置模块各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一产物校验（effective-config.json 与 config-report.md 必须与三套模块一致）⇒ 并行/编排有实际收益。',
    rationaleNot: 'DIRECT/EXPLORE 未利用三套模块互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F07-D2', category: 'D', variant: 2, token: 'F07-D2 OK',
    title: '多阶段配置交付：schema 修复 → 层归一 → 生效配置 → 校验报告',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F07-D2 需要交付四份产物：',
      '① schema 修复结果 schema-repair.json（含字段 "repaired": true）；',
      '② 层归一结果 layers-normalized.json（含字段 "normalized": true 与覆盖四个层的 layers 数组）；',
      '③ 生效配置 effective-config.json（含字段 "effective"，其 service.database.timeout 必须与层文件按 CONTRACT.md 归一后的结果一致）；',
      '④ 校验报告 validation-report.json（含字段 "valid": true 与至少 4 项 checks）。node verify.js 必须通过。',
      '不得修改 verify.js、schema.json 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true),
      'schema.json': J({ 'service.database.timeout': 'number', 'service.database.pool': 'number' }),
      'layers/defaults.json': J({ service: { database: { timeout: 30, pool: 5 } } }),
      'layers/environment.json': J({ service: { database: { timeout: 20 } } }),
      'layers/profile.json': J({ service: { database: { timeout: '10' } } }),
      'layers/local.json': '{}\n',
      'schema-repair.json': '{}\n',
      'layers-normalized.json': '{}\n',
      'effective-config.json': '{}\n',
      'validation-report.json': '{}\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "assert.strictEqual(rd('schema-repair.json').repaired, true, 'schema-repair.json 缺少 repaired');",
        "const norm = rd('layers-normalized.json');",
        "assert.strictEqual(norm.normalized, true, 'layers-normalized.json 缺少 normalized');",
        "assert.ok(Array.isArray(norm.layers) && norm.layers.length === 4, 'layers-normalized.json 必须覆盖四个层');",
        "const eff = rd('effective-config.json').effective;",
        "assert.strictEqual(eff.service.database.timeout, 10, 'effective-config.json 的 timeout 必须与层文件归一后的结果一致，实际 ' + JSON.stringify(eff.service && eff.service.database));",
        "const rep = rd('validation-report.json');",
        "assert.strictEqual(rep.valid, true, 'validation-report.json 缺少 valid');",
        "assert.ok(Array.isArray(rep.checks) && rep.checks.length >= 4, 'validation-report.json 的 checks 至少 4 项');",
        "console.log('F07-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'schema-repair.json': J({
        repaired: true,
        issues: [{ layer: 'profile', path: 'service.database.timeout', found: 'string', expected: 'number', action: 'coerce_number' }],
      }),
      'layers-normalized.json': J({
        normalized: true,
        layers: ['defaults', 'environment', 'profile', 'local'],
        values: { 'service.database.timeout': 10, 'service.database.pool': 5 },
      }),
      'effective-config.json': J({ effective: { service: { database: { timeout: 10, pool: 5 } } } }),
      'validation-report.json': J({
        valid: true,
        checks: [
          { id: 'schema_repaired', ok: true },
          { id: 'layers_normalized', ok: true },
          { id: 'effective_generated', ok: true },
          { id: 'contract_consistent', ok: true },
        ],
        effective_timeout: 10,
      }),
    },
    required: ['schema_repaired', 'layers_normalized', 'effective_generated', 'report_valid', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['schema.json', 'CONTRACT.md'],
    extraChecks: [
      { id: 'schema_repaired', kind: 'file_contains', path: 'schema-repair.json', expect: 'repaired' },
      { id: 'layers_normalized', kind: 'file_contains', path: 'layers-normalized.json', expect: 'normalized' },
      { id: 'effective_generated', kind: 'file_contains', path: 'effective-config.json', expect: 'effective' },
      { id: 'report_valid', kind: 'file_contains', path: 'validation-report.json', expect: 'valid' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '四个阶段（schema 修复 → 层归一 → 生效配置 → 校验报告）各有独立产物与验收字段，后两阶段依赖前两阶段结果 ⇒ 多阶段编排由任务本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F07-E1', category: 'E', variant: 1, token: 'F07-E1 OK',
    title: 'legacy 配置布局冻结与新层级语义契约冲突',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F07-E1 的 config.js 是一版**已上线**的配置加载实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/config.json 与 consumer 均不得修改）。',
      'CONTRACT.md 的新层级与迁移要求必须成立；check.js 与 config.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true, MIGRATION_E1),
      'config.js': [
        '// 已上线实现：仅输出 version / timeout，且被 legacy/config.json 冻结',
        'function load() { return { version: 1, timeout: 30 }; }',
        'module.exports = { load };',
      ].join('\n'),
      'legacy/config.json': J({ version: 1, timeout: 30 }),
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：按 legacy/config.json 逐字段回放 load 的输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { load } = require('../config.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));",
        'const out = load();',
        "assert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');",
        "assert.strictEqual(out.timeout, golden.timeout, 'legacy timeout 被改变');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'index.js': [
        '// 对外入口（可修改）：当前直接转发既有实现',
        "const base = require('./config.js');",
        'module.exports = { load: base.load };',
      ].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { load } = require('./index.js');",
        'const out = load();',
        "assert.strictEqual(out.version, 1, 'legacy version 必须保留');",
        "assert.strictEqual(out.timeout, 30, 'legacy timeout 必须保留');",
        "assert.ok(Array.isArray(out.layers) && out.layers.length > 0, '迁移条款：必须携带非空 layers 数组，实际 ' + JSON.stringify(out));",
        "assert.strictEqual(out.migrated, true, '迁移条款：必须标记 migrated=true');",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F07-E1 OK');"].join('\n'),
    },
    fix: {
      'config-layered.js': [
        '// 兼容路径：保留 legacy 布局，同时补上层级与迁移标记',
        "const base = require('./config.js');",
        'function load() {',
        '  const out = base.load();',
        "  return { version: out.version, timeout: out.timeout, layers: ['defaults', 'environment', 'profile', 'local'], migrated: true };",
        '}',
        'module.exports = { load };',
      ].join('\n'),
      'index.js': [
        '// 对外入口：指向兼容路径',
        "const layered = require('./config-layered.js');",
        'module.exports = { load: layered.load };',
      ].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['config.js', 'legacy/consumer.js', 'legacy/config.json', 'check.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'config-layered.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F07-E1/check.js', log: 'pilot-workspace/FORMAL-F07-E1/attempt-log.txt' },
    rationaleGt: '现状把既有实现当作新接口：config.js 只输出 version/timeout，而新契约要求同时携带 layers/migrated；config.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F07-E2', category: 'E', variant: 2, token: 'F07-E2 OK',
    title: 'effective config 使用了加载时快照（层输入变更不传播）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F07-E2 的 effective config 在层输入被修改后仍然返回旧结果。',
      'CONTRACT.md 的「重算条款」必须成立；propagate.js、layer-store.js、merge.js 与 layers/ 下的层文件都不得修改。',
      '请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD('replace', true, RECOMPUTE_E2),
      'merge.js': MERGE_JS('replace', true),
      'layers/defaults.json': J({ timeout: 90 }),
      'layers/environment.json': J({ timeout: 60 }),
      'layers/profile.json': J({ timeout: 30 }),
      'layers/local.json': '{}\n',
      'layer-store.js': [
        '// 受保护：层输入存储（内容可变，按需读取）',
        "const fs = require('fs');",
        "const path = require('path');",
        "const NAMES = ['defaults', 'environment', 'profile', 'local'];",
        'const state = {};',
        'for (const n of NAMES) {',
        "  const p = path.join(__dirname, 'layers', n + '.json');",
        "  state[n] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};",
        '}',
        'function getLayer(name) { return state[name]; }',
        'function setLayer(name, patch) { state[name] = Object.assign({}, state[name], patch); }',
        'module.exports = { getLayer, setLayer, NAMES };',
      ].join('\n'),
      'resolve.js': [
        '// effective config 生成（当前实现使用了加载时快照）',
        "const store = require('./layer-store.js');",
        "const { mergeLayers } = require('./merge.js');",
        'const PROFILE_SNAPSHOT = store.getLayer(\'profile\'); // 缺陷：模块加载时拍下快照',
        'function resolve() {',
        '  return mergeLayers({',
        "    defaults: store.getLayer('defaults'),",
        "    environment: store.getLayer('environment'),",
        '    profile: PROFILE_SNAPSHOT,',
        "    local: store.getLayer('local'),",
        '  });',
        '}',
        'module.exports = { resolve };',
      ].join('\n'),
      'propagate.js': [
        "const assert = require('assert');",
        "const store = require('./layer-store.js');",
        "const { resolve } = require('./resolve.js');",
        'const before = resolve();',
        "assert.strictEqual(before.timeout, 30, '初始生效 timeout 应来自 profile 层：期望 30，实际 ' + before.timeout);",
        "store.setLayer('profile', { timeout: 60 }); // 修改层叠输入",
        'const after = resolve();',
        "assert.strictEqual(after.timeout, 60, '层叠输入变更后 effective config 必须重算，实际 ' + after.timeout);",
        "console.log('PROPAGATE OK');",
      ].join('\n'),
      'verify.js': ["require('./propagate.js');", "console.log('F07-E2 OK');"].join('\n'),
    },
    fix: {
      'resolve.js': [
        '// effective config 生成：按当前层树按需推导（不得快照）',
        "const store = require('./layer-store.js');",
        "const { mergeLayers } = require('./merge.js');",
        'function resolve() {',
        '  return mergeLayers({',
        "    defaults: store.getLayer('defaults'),",
        "    environment: store.getLayer('environment'),",
        "    profile: store.getLayer('profile'),",
        "    local: store.getLayer('local'),",
        '  });',
        '}',
        'module.exports = { resolve };',
      ].join('\n'),
    },
    required: ['propagation_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['propagate.js', 'layer-store.js', 'merge.js', 'layers/defaults.json', 'layers/environment.json', 'layers/profile.json', 'layers/local.json'],
    extraChecks: [{ id: 'propagation_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F07-E2/propagate.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F07-E2/propagate.js', log: 'pilot-workspace/FORMAL-F07-E2/propagate.log' },
    rationaleGt: '未修复态在层输入变更后仍返回旧值（真实预跑：after.timeout=30 而期望 60，属业务结果差异，不是结构断言）；propagate.js / layer-store.js / merge.js 冻结 ⇒ 必须改变"effective config 从何处取值、何时计算"的方案（去掉加载时快照，改为按需推导）⇒ 计划层重规划，REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是缓存失效问题（layer-store 每次读的是当前层树，问题在推导时机）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const cfEvidence: Array<{ id: string; span: number | null; budget: number; verifyExit: number | null; rejected: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f07-evidence');
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
      execFileSync(process.execPath, ['verify.js'], { cwd: evDir, stdio: 'ignore', timeout: 120_000 });
      return 0;
    } catch (e) {
      return (e as { status?: number | null }).status ?? null;
    }
  };
  const readSpan = (tlPath: string): number | null => {
    if (!existsSync(tlPath)) return null;
    const es = readFileSync(tlPath, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as { start: number; end: number });
    return es.length ? Math.max(...es.map((e) => e.end)) - Math.min(...es.map((e) => e.start)) : null;
  };
  const before = runVerify();
  // —— C 类反事实：同一批 fixture / 同一批层文件 / 同一预算，仅把调度改为串行 ——
  if (v.counterfactual) {
    const cfPath = path.join(evDir, 'cf-serial.js');
    writeFileSync(cfPath, v.counterfactual, 'utf8');
    const run = runScriptCapture(evDir, cfPath);
    const vf = runScriptCapture(evDir, path.join(evDir, 'verify.js'));
    const span = readSpan(path.join(evDir, 'timeline.jsonl'));
    const rejected = vf.code !== 0 && /超预算/.test(vf.stdout + vf.stderr);
    cfEvidence.push({ id: v.id, span, budget: v.budget ?? 0, verifyExit: vf.code, rejected });
    console.log('  ' + v.id + ' 反事实(串行): run=' + String(run.code) + ' span=' + String(span) + 'ms 预算=' + String(v.budget) + 'ms verify_exit=' + String(vf.code) + ' 超预算拒绝=' + String(rejected));
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
  `/**\n * benchmark/formal-seeds-f07.ts — F07 族 10 个变体的种子（由 scripts/formal-author-f07.ts 生成）\n */\nexport const FORMAL_F07_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f07.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f07-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f07-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F07', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F07) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F07', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F07', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F07 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：配置层叠 + 合并语义（defaults ≺ environment ≺ profile ≺ local；S1–S6 逐变体写死在 CONTRACT.md）。',
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
if (cfEvidence.length) {
  md.push(
    '## C 类反事实证明（同 fixture / 同层文件集合 / 同预算，仅改调度）',
    '',
    '| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |',
    '|---|---|---|---|---|',
    ...cfEvidence.map((c) => `| ${c.id} | ${String(c.span)} ms | ${c.budget} ms | ${String(c.verifyExit)} | ${c.rejected ? '✓（stderr 命中「总耗时超预算」）' : '⚠️'} |`),
    '',
    '> 串行反事实与正式证据使用同一批 source 工具、同一批层文件与同一预算，唯一差异是调度方式；',
    '> 正式证据另要求 canonical(E_parallel) == canonical(E_reference)（参考结果由固定层叠规则独立生成）。',
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
    `- protected_paths：${(v.protectedExtra ?? []).length + 1} 条`, '',
    `**验证规则**：required = ${v.required.join(', ')}；forbidden = ${v.forbidden.join(', ')}`, '',
    `**验证证据**：node verify.js ${String(ne.before)} → ${String(ne.after)}；verifyTask ${String(vt.beforeOk)} → ${String(vt.afterOk)}（status=${vt.status}，CONFIG_ERROR=${vt.cfg}）${v.preRun ? `；交付前真实预跑 ${v.preRun.command}` : ''}`, '',
    ...(cf ? [`**C 类反事实**：串行 span=${String(cf.span)} ms > 预算 ${cf.budget} ms；串行 verify exit=${String(cf.verifyExit)}，${cf.rejected ? '被 verify 以「总耗时超预算」拒绝' : '未被拒绝（异常）'}。`, ''] : []),
    `**为什么这些 first_decision 属于 GT**：${v.rationaleGt}`, '',
    `**为什么其他候选不属于 GT**：${v.rationaleNot}`, '',
    `**签署**：\`gt_signed_by: ________\`　\`gt_signed_at: ________\``, '',
  );
}
writeFileSync(REVIEW, md.join('\n'), 'utf8');

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f07.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(VERSION, {
  dataset: 'formal', family: 'F07', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
const cfgTotal = vtEvidence.reduce((a, e) => a + e.cfg, 0);
const preOk = vtEvidence.filter((e) => e.pre !== undefined && e.pre !== 'exit=0').length;
const preDeclared = vtEvidence.filter((e) => e.pre !== undefined).length;
const cfOk = cfEvidence.filter((e) => e.rejected).length;
console.log('\n=== F07 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${cfgTotal}；success=null 总数 = ${vtEvidence.filter((e) => e.beforeOk === null || e.afterOk === null).length}`);
console.log(`  E 类真实预跑    = ${preOk}/${preDeclared} 以非 0 退出`);
console.log(`  C 类反事实      = ${cfOk}/${cfEvidence.length} 被 verify 以「超预算」拒绝`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F07-*.yaml · formal-seeds-f07.ts · f07-review.md · f07-gt-drafts.json · f07-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length && cfgTotal === 0 && preOk === preDeclared && cfOk === cfEvidence.length;
console.log(allOk ? '✅ F07 起草 + 三层证据全部通过（等待人工逐条构念审查与签署；本轮不签署/不冻结/不 commit）' : '⛔ 存在问题，见 f07-review.md');
process.exit(allOk ? 0 : 3);
