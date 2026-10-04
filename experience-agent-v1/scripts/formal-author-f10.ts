/**
 * scripts/formal-author-f10.ts — F10 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01–F09 各族的领域均不同）：**数据校验 + Schema 演进 / 迁移**
 *   数据实例 → Schema 校验（V1–V3）→ 版本兼容性（V4）→ Schema 演进 →
 *   Migration（V5–V7）→ 迁移后验证；产物一律 canonical 序列化（V8，逐字节比较）
 * 纪律同前：只产出 draft；三层证据；E 类真实预跑 + 日志后冻结基线；prompt 不含 first-decision 提示；
 *          C 类另有「反事实（仅改调度）+ 产物与 checker 内嵌独立参考迁移逐字节一致」；D2 断言 step 间真实 artifact 传递。
 * 用法：node scripts/formal-author-f10.ts
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f10.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f10-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f10-gt-drafts.json');
const VERSION = path.join(ROOT, 'benchmark', 'formal', 'f10-version.json');

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
const JSONL = (records: unknown[]): string => records.map((r) => JSON.stringify(r)).join('\n') + '\n';
type FieldTuple = [string, string, boolean, boolean];
const SCHEMA = (version: number, fields: FieldTuple[]): string =>
  J({
    version,
    field_order: fields.map((f) => f[0]),
    fields: fields.map(([name, type, required, nullable]) => ({ name, type, required, nullable })),
  });

// ---------- V1–V8 契约文本（逐变体显式声明；checker 逐条引用） ----------
const CONTRACT_MD = (extra: string[] = []): string =>
  [
    '# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）',
    '',
    '- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:"required"}`。',
    '- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`"18"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `"null"`），`nullable:true` 时 null 合法。',
    '- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。',
    '- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。',
    '- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。',
    '- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作"新增字段"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。',
    '- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。',
    '- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。',
    ...(extra.length ? ['', ...extra] : []),
    '',
  ].join('\n');

const C_CLAUSE = (budget: number): string[] => [
  '## C 类附加条款',
  '',
  `1. 三个数据分片共享总预算 ${budget} ms；`,
  '2. 并行迁移不得改变结果：`migrated.jsonl` 必须与**独立参考迁移实现**（checker 内嵌，不与被测实现共享代码）产出的 canonical 形式**逐字节一致**；',
  '3. record identity 必须保持（record_count 不变、id 集合与顺序不变）。',
];

// ---------- 任务侧 canonical 序列化（V8） ----------
const CANONICAL_JS =
`// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）
// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）
function orderFields(schema, rec) {
  const out = {};
  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];
  return out;
}
function ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
function serializeRecords(schema, records) {
  const sorted = records.slice().sort(ordinalId);
  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');
}
function bytesOf(text) { return Buffer.from(text, 'utf8'); }
module.exports = { orderFields, ordinalId, serializeRecords, bytesOf };
`;

// ---------- checker 内嵌的独立参考序列化（不引用被测实现） ----------
const REF_SER_JS =
`// 独立参考序列化（checker 内嵌；不引用被测实现）
function refOrderFields(schema, rec) {
  const out = {};
  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];
  return out;
}
function refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
function refSerialize(schema, records) {
  const sorted = records.slice().sort(refOrdinalId);
  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');
}
function refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }
function readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }
`;

const READ_JSONL_JS =
`const readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));`;

// ---------- Schema 校验（V1–V3）正确版；缺陷版由字符串替换派生 ----------
const VALIDATE_JS =
`// Schema 校验（V1–V3）
function typeOk(type, v) {
  if (type === 'string') return typeof v === 'string';
  if (type === 'integer') return typeof v === 'number' && Number.isInteger(v);
  if (type === 'boolean') return typeof v === 'boolean';
  return false;
}
function sortErrors(errors) {
  return errors.slice().sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)));
}
function validate(records, schema) {
  const errors = [];
  for (const rec of records) {
    for (const f of schema.fields) {
      const has = Object.prototype.hasOwnProperty.call(rec, f.name);
      if (!has) {
        if (f.required) errors.push({ id: rec.id, field: f.name, code: 'required' });
        continue;
      }
      const v = rec[f.name];
      if (v === null) {
        if (!f.nullable) errors.push({ id: rec.id, field: f.name, code: 'null' });
        continue;
      }
      if (!typeOk(f.type, v)) errors.push({ id: rec.id, field: f.name, code: 'type' });
    }
  }
  return { ok: errors.length === 0, errors: sortErrors(errors) };
}
module.exports = { validate, sortErrors, typeOk };
`;

const REQUIRED_BLOCK =
`      if (!has) {
        if (f.required) errors.push({ id: rec.id, field: f.name, code: 'required' });
        continue;
      }`;
const REQUIRED_BLOCK_BAD = `      if (!has) { continue; } // 缺陷：未执行 required 检查`;
const NULL_BLOCK =
`      if (v === null) {
        if (!f.nullable) errors.push({ id: rec.id, field: f.name, code: 'null' });
        continue;
      }`;
const NULL_BLOCK_BAD = `      if (v === null) { continue; } // 缺陷：null 一律放过（未按 nullable 判定）`;
const TYPE_LINE = `      if (!typeOk(f.type, v)) errors.push({ id: rec.id, field: f.name, code: 'type' });`;
const TYPE_LINE_BAD = `      const coerced = f.type === 'integer' ? Number(v) : v; // 缺陷：隐式转换
      if (!typeOk(f.type, coerced)) errors.push({ id: rec.id, field: f.name, code: 'type' });`;

/** 错误列表的规范化比较（checker 自行排序，不依赖实现遍历顺序；V3） */
const NORM_ERRORS_JS =
`const normalizeErrors = (errs) => errs.slice()
  .sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)))
  .map((e) => e.id + ':' + e.field + ':' + e.code);`;

// ---------- C 类：分片迁移工具（受保护 fixture） ----------
const C_SHARD_TOOL = (shard: string, migrateFn: string, dur: number, token: string): string =>
`// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）
const fs = require('fs');
const path = require('path');
const SHARD = ${JSON.stringify(shard)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const { ${migrateFn} } = require(path.join(ROOT, 'migrate.js'));
const { serializeRecords } = require(path.join(ROOT, 'canonical.js'));
const readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));
const source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));
const migrated = ${migrateFn}(source);
const text = serializeRecords(schemaV2, migrated);
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');
console.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');
`;

const C_RUNNER = (shards: string[]): string =>
`// 并行编排：并发执行各分片迁移，**再按 canonical 形式合并**为 migrated.jsonl（并行不得改变结果）
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { serializeRecords } = require(path.join(__dirname, 'canonical.js'));
const SHARDS = ${JSON.stringify(shards)};
function runOne(s) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
    c.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));
    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(s + ' exit=' + code + ' signal=' + sig))));
  });
}
Promise.all(SHARDS.map(runOne)).then(() => {
  const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));
  const records = [];
  for (const s of SHARDS) {
    const text = fs.readFileSync(path.join(__dirname, 'out', s + '.jsonl'), 'utf8').trim();
    if (text) for (const line of text.split('\\n')) records.push(JSON.parse(line));
  }
  fs.writeFileSync(path.join(__dirname, 'migrated.jsonl'), serializeRecords(schemaV2, records), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'MIGRATION.md'), '# 迁移说明\\n迁移：各数据分片并行执行完成，产物按 canonical 形式（固定字段顺序 + id 升序 + LF）合并为 migrated.jsonl（record identity 保持）。\\n');
  console.log('parallel shard migration done');
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const C_CHECK_TIMELINE = (budget: number, shards: string[], refMigrateJs: string, extraAsserts: string, name: string): string =>
`// 纯读取检查器：验证已发生的并行迁移 + **与独立参考迁移逐字节一致**（不执行任何分片工具）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_SER_JS}
${refMigrateJs}
const BUDGET_MS = ${budget};
const SHARDS = ${JSON.stringify(shards)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));
const source = [];
for (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));
const expected = refSerialize(schemaV2, refMigrate(source));
const actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');
assert.ok(refBytesEq(actual, expected), '并行迁移产物与独立参考迁移逐字节不一致：actual=' + JSON.stringify(actual.slice(0, 160)) + ' expected=' + JSON.stringify(expected.slice(0, 160)));
const actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变（V5/V6）：actual=' + actualRecords.length + ' expected=' + source.length);
${extraAsserts}
console.log('TIMELINE OK shards=' + new Set(entries.map((e) => e.shard)).size + ' span=' + span + 'ms bytes=identical ${name}');
`;

const C_VERIFY = (budget: number, shards: string[], refMigrateJs: string, extraAsserts: string, token: string): string =>
`const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_SER_JS}
${refMigrateJs}
const BUDGET_MS = ${budget};
const SHARDS = ${JSON.stringify(shards)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));
const source = [];
for (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));
const expected = refSerialize(schemaV2, refMigrate(source));
const actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');
assert.ok(refBytesEq(actual, expected), '迁移产物与独立参考迁移逐字节不一致');
const actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变');
${extraAsserts}
console.log(${JSON.stringify(token)});
`;

const IDENTITY_ASSERTS =
`const idsOf = (rs) => rs.slice().sort(refOrdinalId).map((r) => r.id).join(',');
assert.strictEqual(new Set(actualRecords.map((r) => r.id)).size, actualRecords.length, '不得产生双重记录（id 重复）');
assert.strictEqual(idsOf(actualRecords), idsOf(source), 'record identity（id 集合与顺序）必须保持');`;

/** C2 专有：rename/transform 后旧字段不得残留（V6） */
const C2_EXTRA_ASSERTS =
`${IDENTITY_ASSERTS}
for (const r of actualRecords) {
  assert.ok(!Object.prototype.hasOwnProperty.call(r, 'first_name') && !Object.prototype.hasOwnProperty.call(r, 'last_name'), 'V6：rename 后旧字段不得保留，实际 ' + JSON.stringify(r));
}`;

const C_COUNTERFACTUAL = (shards: string[]): string =>
`// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批数据分片 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { serializeRecords } = require(path.join(__dirname, 'canonical.js'));
const SHARDS = ${JSON.stringify(shards)};
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const s of SHARDS) execFileSync(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));
const records = [];
for (const s of SHARDS) {
  const text = fs.readFileSync(path.join(__dirname, 'out', s + '.jsonl'), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) records.push(JSON.parse(line));
}
fs.writeFileSync(path.join(__dirname, 'migrated.jsonl'), serializeRecords(schemaV2, records), 'utf8');
console.log('serial counterfactual done');
`;

// ---------- 变体参数 ----------
const C_SHARDS = ['shard-a', 'shard-b', 'shard-c'];
const C_BUDGET = 6500;

const REF_ADD_JS =
`// 独立参考迁移（V5 additive + backfill：display_name := name）
function refMigrate(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }`;
const REF_RENAME_JS =
`// 独立参考迁移（V6 显式转换：display_name := first_name + last_name）
function refMigrate(records) { return records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })); }`;

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F10-A1', category: 'A', variant: 1, token: 'F10-A1 OK',
    title: 'Required 字段校验缺失（缺失必填字段仍判为通过）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-A1 的 Schema 校验对「必填字段缺失」的数据仍判定为通过（期望失败）。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-required.js、CONTRACT.md 与 schemas/v1.json。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['name', 'string', true, false], ['email', 'string', false, true]]),
      'data/records.jsonl': JSONL([{ id: 1, name: 'Ada', email: 'ada@x.io' }, { id: 2 }, { id: 3, name: 'Bo' }]),
      'validate.js': VALIDATE_JS.replace(REQUIRED_BLOCK, REQUIRED_BLOCK_BAD),
      'check-required.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { validate } = require('./validate.js');",
        READ_JSONL_JS,
        "const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));",
        "const records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));",
        'const res = validate(records, schema);',
        NORM_ERRORS_JS,
        "assert.strictEqual(res.ok, false, '存在缺失的 required 字段时必须校验失败，实际 ok=' + res.ok);",
        "assert.deepStrictEqual(normalizeErrors(res.errors), ['2:name:required'], '错误列表必须包含 {id:2, field:\"name\", code:\"required\"}（V1/V3），实际 ' + JSON.stringify(res.errors));",
        "console.log('REQUIRED OK');",
      ].join('\n'),
      'verify.js': ["require('./check-required.js');", "console.log('F10-A1 OK');"].join('\n'),
    },
    fix: { 'validate.js': VALIDATE_JS },
    required: ['required_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-required.js', 'CONTRACT.md', 'schemas/v1.json'],
    extraChecks: [{ id: 'required_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-A1/check-required.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（validate.js 未执行 required 检查），目标文件与错误码由 CONTRACT 唯一确定 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（失败原因由输出直接定位）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F10-A2', category: 'A', variant: 2, token: 'F10-A2 OK',
    title: '类型与可空性判定错误（隐式转换 + null 放过）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-A2 的 Schema 校验结果与 CONTRACT.md 规定的 V2 语义不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-type-null.js、CONTRACT.md 与 schemas/v1.json。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'schemas/v1.json': SCHEMA(1, [
        ['id', 'integer', true, false],
        ['name', 'string', true, false],
        ['age', 'integer', false, true],
        ['email', 'string', false, false],
      ]),
      'data/records.jsonl': JSONL([
        { id: 1, name: 'Ada', age: '18' },
        { id: 2, name: 'Bo', email: null },
        { id: 3, name: 'Cy', age: 30, email: 'cy@x.io' },
      ]),
      'validate.js': VALIDATE_JS.replace(NULL_BLOCK, NULL_BLOCK_BAD).replace(TYPE_LINE, TYPE_LINE_BAD),
      'check-type-null.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { validate } = require('./validate.js');",
        READ_JSONL_JS,
        "const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));",
        "const records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));",
        'const res = validate(records, schema);',
        NORM_ERRORS_JS,
        "assert.strictEqual(res.ok, false, '存在类型/可空性违规时必须校验失败，实际 ok=' + res.ok);",
        "assert.deepStrictEqual(normalizeErrors(res.errors), ['1:age:type', '2:email:null'], '必须给出 V2 规定的 {id:1,field:\"age\",code:\"type\"} 与 {id:2,field:\"email\",code:\"null\"}（不得隐式转换、不得放过 null），实际 ' + JSON.stringify(res.errors));",
        "console.log('TYPE-NULL OK');",
      ].join('\n'),
      'verify.js': ["require('./check-type-null.js');", "console.log('F10-A2 OK');"].join('\n'),
    },
    fix: { 'validate.js': VALIDATE_JS },
    required: ['type_null_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-type-null.js', 'CONTRACT.md', 'schemas/v1.json'],
    extraChecks: [{ id: 'type_null_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-A2/check-type-null.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（validate.js），但「不得隐式转换」「nullable:false 时 null 非法」的判定依据写在 CONTRACT.md（V2）⇒ 先查契约再改与直接修改并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F10-B1', category: 'B', variant: 1, token: 'F10-B1 OK',
    title: 'Backward 兼容失败：旧读取器对新增字段报错',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-B1 的旧读取器无法读取新写入方产出的数据（期望按 V4 忽略未知字段）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-backward.js、CONTRACT.md 与 schemas/ 下的 schema。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['name', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['name', 'string', true, false], ['display_name', 'string', false, true]]),
      'write.js': [
        '// 新写入方（v2）：写出 v2 schema 的全部字段',
        'function writeV2(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }',
        'module.exports = { writeV2 };',
      ].join('\n'),
      'compat.js': [
        '// 旧读取器（v1）：按 v1 schema 读取记录',
        'function readV1(record, schema) {',
        '  const known = schema.fields.map((f) => f.name);',
        '  const errors = [];',
        "  for (const k of Object.keys(record)) if (!known.includes(k)) errors.push({ field: k, code: 'unknown_field' }); // 缺陷：未知字段被当作错误",
        '  for (const f of schema.fields) {',
        "    if (!Object.prototype.hasOwnProperty.call(record, f.name) && f.required) errors.push({ field: f.name, code: 'required' });",
        '  }',
        '  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };',
        '}',
        'module.exports = { readV1 };',
      ].join('\n'),
      'check-backward.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { readV1 } = require('./compat.js');",
        "const { writeV2 } = require('./write.js');",
        "const schemaV1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));",
        "const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));",
        "assert.strictEqual(schemaV2.fields.some((f) => f.name === 'display_name'), true, '新 schema 必须包含新增字段 display_name');",
        "const produced = writeV2([{ id: 1, name: 'Ada' }])[0];",
        "assert.ok(Object.prototype.hasOwnProperty.call(produced, 'display_name'), '新写入方必须真实写出新增字段（否则 backward 兼容无从验证）');",
        'const r = readV1(produced, schemaV1);',
        "assert.strictEqual(r.ok, true, 'V4 backward：新写入方产出的数据必须能被旧读取器读取（未知字段必须忽略），实际 ' + JSON.stringify(r.errors));",
        "assert.strictEqual(r.value.name, 'Ada', '已知字段必须原样保留');",
        "console.log('BACKWARD OK');",
      ].join('\n'),
      'verify.js': ["require('./check-backward.js');", "console.log('F10-B1 OK');"].join('\n'),
    },
    fix: {
      'compat.js': [
        '// 旧读取器（v1）：按 v1 schema 读取记录',
        'function readV1(record, schema) {',
        '  const errors = [];',
        '  for (const f of schema.fields) {',
        "    if (!Object.prototype.hasOwnProperty.call(record, f.name) && f.required) errors.push({ field: f.name, code: 'required' });",
        '  }',
        '  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };',
        '}',
        'module.exports = { readV1 };',
      ].join('\n'),
    },
    required: ['backward_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-backward.js', 'CONTRACT.md', 'schemas/v1.json', 'schemas/v2.json'],
    extraChecks: [{ id: 'backward_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-B1/check-backward.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"旧读取器读不了新数据"，成因可能在 writer 的字段装配或 reader 的未知字段处理；需沿 writer 输出 → reader 校验链定位（checker 另有断言保证 writer 真写出新字段）⇒ EXPLORE。',
    rationaleNot: 'DIRECT 容易只改一侧而留下另一处不一致；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F10-B2', category: 'B', variant: 2, token: 'F10-B2 OK',
    title: 'Forward 兼容失败：新读取器要求可选字段必须存在',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-B2 的新读取器无法读取旧写入方产出的数据（期望按 V4 容忍缺失的可选字段）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-forward.js、CONTRACT.md 与 schemas/ 下的 schema。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['name', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['name', 'string', true, false], ['display_name', 'string', false, true]]),
      'compat.js': [
        '// 新读取器（v2）：按 v2 schema 读取记录',
        'function readV2(record, schema) {',
        '  const errors = [];',
        '  for (const f of schema.fields) {',
        "    if (!Object.prototype.hasOwnProperty.call(record, f.name)) errors.push({ field: f.name, code: 'missing_field' }); // 缺陷：可选字段也要求存在",
        '  }',
        '  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };',
        '}',
        'module.exports = { readV2 };',
      ].join('\n'),
      'check-forward.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { readV2 } = require('./compat.js');",
        "const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));",
        "const optional = schemaV2.fields.filter((f) => f.name === 'display_name')[0];",
        "assert.strictEqual(optional.required, false, 'display_name 在新 schema 中必须保持为可选项（forward 兼容的前提）');",
        "const oldRecord = { id: 1, name: 'Ada' }; // 旧写入方（v1）产出的数据",
        'const r = readV2(oldRecord, schemaV2);',
        "assert.strictEqual(r.ok, true, 'V4 forward：旧数据缺少新 schema 的可选字段时必须被容忍，实际 ' + JSON.stringify(r.errors));",
        "assert.strictEqual(r.value.name, 'Ada', '已有字段必须原样保留');",
        "assert.ok(!Object.prototype.hasOwnProperty.call(r.value, 'display_name'), '缺失的可选字段不得被伪造填充');",
        "console.log('FORWARD OK');",
      ].join('\n'),
      'verify.js': ["require('./check-forward.js');", "console.log('F10-B2 OK');"].join('\n'),
    },
    fix: {
      'compat.js': [
        '// 新读取器（v2）：按 v2 schema 读取记录（仅 required 字段必须存在）',
        'function readV2(record, schema) {',
        '  const errors = [];',
        '  for (const f of schema.fields) {',
        "    if (!Object.prototype.hasOwnProperty.call(record, f.name) && f.required) errors.push({ field: f.name, code: 'required' });",
        '  }',
        '  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };',
        '}',
        'module.exports = { readV2 };',
      ].join('\n'),
    },
    required: ['forward_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-forward.js', 'CONTRACT.md', 'schemas/v1.json', 'schemas/v2.json'],
    extraChecks: [{ id: 'forward_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-B2/check-forward.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '方向与 B1 相反且 failure mode 不同（缺失可选字段 vs 未知字段）：成因可能在 reader 的字段存在性判定或 schema 的可选性声明；需沿 schema → reader 判定链定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 容易把可选字段硬性要求或伪造默认值；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F10-C1', category: 'C', variant: 1, token: 'F10-C1 OK',
    title: '硬预算下的多分片并行迁移（additive + backfill，产物逐字节一致）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-C1 需要在**总预算 6500 ms**内完成三个数据分片的 V1→V2 迁移，最终必须同时成立：',
      '① work/ 下的三个分片迁移工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '④ 合并后的 migrated.jsonl 必须与按 CONTRACT.md 冻结规则（V5 backfill、V8 canonical）独立生成的参考迁移结果**逐字节一致**；',
      '⑤ 写出 MIGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、migrate.js、schemas/ 与 work/ 下的迁移工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(C_CLAUSE(C_BUDGET).concat([
        '## 本变体冻结的迁移规则',
        '',
        '- V1→V2 为 **additive + backfill**：新增字段 `display_name`，backfill 规则 **`display_name := name`**；',
        '- record identity 必须保持（id 集合与顺序不变，record_count 不变）。',
      ])),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['name', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['name', 'string', true, false], ['display_name', 'string', true, false]]),
      'canonical.js': CANONICAL_JS,
      'migrate.js': [
        '// V1→V2 迁移（受保护，冻结规则）：additive + backfill（display_name := name），record identity 保持',
        "const { serializeRecords } = require('./canonical.js');",
        'function migrateAdd(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }',
        'function migrateAddToText(schemaV2, records) { return serializeRecords(schemaV2, migrateAdd(records)); }',
        'module.exports = { migrateAdd, migrateAddToText };',
      ].join('\n'),
      'data/shard-a.jsonl': JSONL([{ id: 1, name: 'Ada' }, { id: 4, name: 'Dee' }]),
      'data/shard-b.jsonl': JSONL([{ id: 2, name: 'Bo' }, { id: 5, name: 'Eve' }]),
      'data/shard-c.jsonl': JSONL([{ id: 3, name: 'Cy' }, { id: 6, name: 'Fay' }]),
      'work/shard-a.js': C_SHARD_TOOL('shard-a', 'migrateAdd', 3500, 'SA-2f81'),
      'work/shard-b.js': C_SHARD_TOOL('shard-b', 'migrateAdd', 3500, 'SB-77c4'),
      'work/shard-c.js': C_SHARD_TOOL('shard-c', 'migrateAdd', 3000, 'SC-19e2'),
      'check-timeline.js': C_CHECK_TIMELINE(C_BUDGET, C_SHARDS, REF_ADD_JS, IDENTITY_ASSERTS, 'additive'),
      'MIGRATION.md': '# 迁移说明\n（待补）\n',
      'verify.js': C_VERIFY(C_BUDGET, C_SHARDS, REF_ADD_JS, IDENTITY_ASSERTS, 'F10-C1 OK'),
    },
    fix: {
      'run-shards.js': C_RUNNER(C_SHARDS),
      'MIGRATION.md': '# 迁移说明\n迁移：三个数据分片并行迁移完成，产物按 canonical 形式合并，与独立参考迁移逐字节一致（record identity 保持）。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F10-C1/run-shards.js',
    counterfactual: C_COUNTERFACTUAL(C_SHARDS),
    budget: C_BUDGET,
    required: ['shards_done', 'timeline_ok', 'migrated_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'canonical.js', 'migrate.js', 'schemas/v1.json', 'schemas/v2.json', 'work/shard-a.js', 'work/shard-b.js', 'work/shard-c.js'],
    extraChecks: [
      { id: 'shards_done', kind: 'file_exists', path: 'out/shard-a.jsonl' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-C1/check-timeline.js' },
      { id: 'migrated_written', kind: 'file_contains', path: 'migrated.jsonl', expect: 'display_name' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三分片各自固定迁移耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行迁移不得改变结果**（migrated.jsonl 必须与 checker 内嵌独立参考迁移逐字节一致）。串行调度必然超预算（verify 直接拒绝），分片级并行 + canonical 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-分片-逐字节等价」结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F10-C2', category: 'C', variant: 2, token: 'F10-C2 OK',
    title: '硬预算下的并行 rename/transform 迁移（identity 保持，无双重记录）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-C2 需要在**总预算 6500 ms**内完成三个数据分片的 V1→V2 rename/transform 迁移，最终必须同时成立：',
      '① work/ 下的三个分片迁移工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 各分片完成时间跨度不得超过总预算；',
      '④ 合并后的 migrated.jsonl 必须与按 CONTRACT.md 冻结规则（V6 显式转换、V8 canonical）独立生成的参考迁移结果**逐字节一致**；',
      '⑤ record_count 不得变化（禁止双重记录），旧字段不得保留；写出 MIGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、migrate.js、schemas/ 与 work/ 下的迁移工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(C_CLAUSE(C_BUDGET).concat([
        '## 本变体冻结的迁移规则',
        '',
        '- V1→V2 为 **rename/transform**：`display_name := first_name + last_name`（显式转换，按此顺序直接拼接）；',
        '- 旧字段 `first_name` / `last_name` **不得保留**；不得产生双重记录（record_count 与 id 集合必须保持）。',
      ])),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['first_name', 'string', true, false], ['last_name', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['display_name', 'string', true, false]]),
      'canonical.js': CANONICAL_JS,
      'migrate.js': [
        '// V1→V2 迁移（受保护，冻结规则）：rename/transform（display_name := first_name + last_name）',
        "const { serializeRecords } = require('./canonical.js');",
        "function migrateRename(records) { return records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })); }",
        'function migrateRenameToText(schemaV2, records) { return serializeRecords(schemaV2, migrateRename(records)); }',
        'module.exports = { migrateRename, migrateRenameToText };',
      ].join('\n'),
      'data/shard-a.jsonl': JSONL([{ id: 1, first_name: 'Ada', last_name: 'Ng' }, { id: 4, first_name: 'Dee', last_name: 'Ko' }]),
      'data/shard-b.jsonl': JSONL([{ id: 2, first_name: 'Bo', last_name: 'Li' }, { id: 5, first_name: 'Eve', last_name: 'Ru' }]),
      'data/shard-c.jsonl': JSONL([{ id: 3, first_name: 'Cy', last_name: 'Ma' }, { id: 6, first_name: 'Fay', last_name: 'Wu' }]),
      'work/shard-a.js': C_SHARD_TOOL('shard-a', 'migrateRename', 3200, 'RA-5d10'),
      'work/shard-b.js': C_SHARD_TOOL('shard-b', 'migrateRename', 3400, 'RB-8c33'),
      'work/shard-c.js': C_SHARD_TOOL('shard-c', 'migrateRename', 3000, 'RC-41a7'),
      'check-timeline.js': C_CHECK_TIMELINE(C_BUDGET, C_SHARDS, REF_RENAME_JS, C2_EXTRA_ASSERTS, 'rename'),
      'MIGRATION.md': '# 迁移说明\n（待补）\n',
      'verify.js': C_VERIFY(C_BUDGET, C_SHARDS, REF_RENAME_JS, C2_EXTRA_ASSERTS, 'F10-C2 OK'),
    },
    fix: {
      'run-shards.js': C_RUNNER(C_SHARDS),
      'MIGRATION.md': '# 迁移说明\n迁移：三个数据分片并行完成 rename/transform，产物与独立参考迁移逐字节一致，record_count 不变且无旧字段残留。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F10-C2/run-shards.js',
    counterfactual: C_COUNTERFACTUAL(C_SHARDS),
    budget: C_BUDGET,
    required: ['shards_done', 'timeline_ok', 'migrated_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'canonical.js', 'migrate.js', 'schemas/v1.json', 'schemas/v2.json', 'work/shard-a.js', 'work/shard-b.js', 'work/shard-c.js'],
    extraChecks: [
      { id: 'shards_done', kind: 'file_exists', path: 'out/shard-a.jsonl' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-C2/check-timeline.js' },
      { id: 'migrated_written', kind: 'file_contains', path: 'migrated.jsonl', expect: 'display_name' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但承担**不同 failure mode**：C1 是 additive/backfill 正确性，C2 是**变换正确性 + identity 保持**（record_count 不变、无双重记录、旧字段不残留），且多一条旧字段不得保留的机械断言。同样存在「硬预算 + 并行结果必须与独立参考逐字节一致」的可机械验证约束，串行超预算而分片级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画「预算-分片-identity 保持」结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F10-D1', category: 'D', variant: 1, token: 'F10-D1 OK',
    title: '三张表各自的迁移缺陷 + 统一迁移报告校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-D1 下的三套迁移模块 mig-customers.js / mig-orders.js / mig-logs.js 都需要修好，',
      '交付三张表的迁移产物 migrated/customers.jsonl、migrated/orders.jsonl、migrated/logs.jsonl，',
      '以及统一迁移报告 migration-report.json（含 tables 与 total_records）；node verify.js 必须通过。',
      '不得修改 check-customers.js、check-orders.js、check-logs.js、check-report.js、verify.js、CONTRACT.md、canonical.js 与 schemas/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 本变体冻结的三表迁移规则',
        '',
        '1. `customers`：V2 = {id, name, tier}，backfill 规则 **`tier := (id <= 100 ? "standard" : "premium")`**；',
        '2. `orders`：V2 = {id, amount, currency}，backfill 规则 **`currency := "USD"`**；record identity 必须保持（不得丢记录）；',
        '3. `logs`：V2 = {id, at_ms}，**`at_ms := Date.parse(at)`（integer，epoch 毫秒）**；',
        '4. 三张表的产物一律按 V8 canonical 形式写出；`migration-report.json` 必须与产物一致（tables.<name>.count 与 total_records）。',
      ]),
      'canonical.js': CANONICAL_JS,
      'schemas/customers.v2.json': SCHEMA(2, [['id', 'integer', true, false], ['name', 'string', true, false], ['tier', 'string', true, false]]),
      'schemas/orders.v2.json': SCHEMA(2, [['id', 'integer', true, false], ['amount', 'integer', true, false], ['currency', 'string', true, false]]),
      'schemas/logs.v2.json': SCHEMA(2, [['id', 'integer', true, false], ['at_ms', 'integer', true, false]]),
      'data/customers.jsonl': JSONL([{ id: 99, name: 'Ada' }, { id: 100, name: 'Bo' }, { id: 101, name: 'Cy' }]),
      'data/orders.jsonl': JSONL([{ id: 1, amount: 250 }, { id: 2, amount: 0 }, { id: 3, amount: 75 }]),
      'data/logs.jsonl': JSONL([
        { id: 1, at: '2026-01-02T03:04:05.000Z' },
        { id: 2, at: '2026-02-03T04:05:06.000Z' },
      ]),
      'mig-customers.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// customers V1→V2：新增 tier 并按规则回填',
        'function migrateCustomers(records) {',
        "  return records.map((r) => ({ id: r.id, name: r.name, tier: r.id < 100 ? 'standard' : 'premium' })); // 缺陷：边界 off-by-one",
        '}',
        'module.exports = { migrateCustomers };',
      ].join('\n'),
      'mig-orders.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// orders V1→V2：新增 currency 并按规则回填',
        'function migrateOrders(records) {',
        "  return records.filter((r) => r.amount).map((r) => ({ id: r.id, amount: r.amount, currency: 'USD' })); // 缺陷：丢弃 amount 为 0 的记录",
        '}',
        'module.exports = { migrateOrders };',
      ].join('\n'),
      'mig-logs.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// logs V1→V2：at → at_ms（integer）',
        'function migrateLogs(records) {',
        "  return records.map((r) => ({ id: r.id, at_ms: String(Date.parse(r.at)) })); // 缺陷：at_ms 输出为 string",
        '}',
        'module.exports = { migrateLogs };',
      ].join('\n'),
      'check-customers.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        REF_SER_JS,
        READ_JSONL_JS,
        "const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'customers.v2.json'), 'utf8'));",
        "const source = readJsonlFile(path.join(__dirname, 'data', 'customers.jsonl'));",
        "const expected = refSerialize(schema, source.map((r) => ({ id: r.id, name: r.name, tier: r.id <= 100 ? 'standard' : 'premium' })));",
        "const delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'customers.jsonl'), 'utf8');",
        "assert.ok(refBytesEq(delivered, expected), 'customers 迁移产物与参考结果逐字节不一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));",
        "console.log('CUSTOMERS OK');",
      ].join('\n'),
      'check-orders.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        REF_SER_JS,
        READ_JSONL_JS,
        "const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'orders.v2.json'), 'utf8'));",
        "const source = readJsonlFile(path.join(__dirname, 'data', 'orders.jsonl'));",
        "const expected = refSerialize(schema, source.map((r) => ({ id: r.id, amount: r.amount, currency: 'USD' })));",
        "const delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'orders.jsonl'), 'utf8');",
        "assert.ok(refBytesEq(delivered, expected), 'orders 迁移产物与参考结果逐字节不一致（record identity 必须保持）：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));",
        "console.log('ORDERS OK');",
      ].join('\n'),
      'check-logs.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        REF_SER_JS,
        READ_JSONL_JS,
        "const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'logs.v2.json'), 'utf8'));",
        "const source = readJsonlFile(path.join(__dirname, 'data', 'logs.jsonl'));",
        "const expected = refSerialize(schema, source.map((r) => ({ id: r.id, at_ms: Date.parse(r.at) })));",
        "const delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'logs.jsonl'), 'utf8');",
        "assert.ok(refBytesEq(delivered, expected), 'logs 迁移产物与参考结果逐字节不一致（at_ms 必须为 integer）：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));",
        "console.log('LOGS OK');",
      ].join('\n'),
      'check-report.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        REF_SER_JS,
        READ_JSONL_JS,
        "const { migrateCustomers } = require('./mig-customers.js');",
        "const { migrateOrders } = require('./mig-orders.js');",
        "const { migrateLogs } = require('./mig-logs.js');",
        "const TABLES = [",
        "  { name: 'customers', fn: migrateCustomers, schema: 'customers.v2.json', data: 'customers.jsonl' },",
        "  { name: 'orders', fn: migrateOrders, schema: 'orders.v2.json', data: 'orders.jsonl' },",
        "  { name: 'logs', fn: migrateLogs, schema: 'logs.v2.json', data: 'logs.jsonl' },",
        '];',
        "const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'migration-report.json'), 'utf8'));",
        'let total = 0;',
        'for (const t of TABLES) {',
        "  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', t.schema), 'utf8'));",
        "  const source = readJsonlFile(path.join(__dirname, 'data', t.data));",
        '  const expected = refSerialize(schema, t.fn(source));',
        "  const delivered = fs.readFileSync(path.join(__dirname, 'migrated', t.name + '.jsonl'), 'utf8');",
        "  assert.ok(refBytesEq(delivered, expected), '表 ' + t.name + ' 的交付产物必须与修好后的模块输出逐字节一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));",
        "  assert.strictEqual(report.tables[t.name].count, source.length, '报告中 ' + t.name + ' 的 count 必须等于源记录数，实际 ' + report.tables[t.name].count);",
        '  total += source.length;',
        '}',
        "assert.strictEqual(report.total_records, total, '迁移报告 total_records 必须等于三表记录数之和（' + total + '），实际 ' + report.total_records);",
        "console.log('REPORT OK');",
      ].join('\n'),
      'migrated/customers.jsonl': '{}\n',
      'migrated/orders.jsonl': '{}\n',
      'migrated/logs.jsonl': '{}\n',
      'migration-report.json': '{}\n',
      'verify.js': [
        "require('./check-customers.js');",
        "require('./check-orders.js');",
        "require('./check-logs.js');",
        "require('./check-report.js');",
        "console.log('F10-D1 OK');",
      ].join('\n'),
    },
    fix: {
      'mig-customers.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// customers V1→V2：新增 tier 并按冻结规则回填',
        'function migrateCustomers(records) {',
        "  return records.map((r) => ({ id: r.id, name: r.name, tier: r.id <= 100 ? 'standard' : 'premium' }));",
        '}',
        'module.exports = { migrateCustomers };',
      ].join('\n'),
      'mig-orders.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// orders V1→V2：新增 currency 并按冻结规则回填（record identity 保持）',
        'function migrateOrders(records) {',
        "  return records.map((r) => ({ id: r.id, amount: r.amount, currency: 'USD' }));",
        '}',
        'module.exports = { migrateOrders };',
      ].join('\n'),
      'mig-logs.js': [
        "const { serializeRecords } = require('./canonical.js');",
        '// logs V1→V2：at → at_ms（integer，epoch 毫秒）',
        'function migrateLogs(records) {',
        '  return records.map((r) => ({ id: r.id, at_ms: Date.parse(r.at) }));',
        '}',
        'module.exports = { migrateLogs };',
      ].join('\n'),
      'migrated/customers.jsonl': JSONL([
        { id: 99, name: 'Ada', tier: 'standard' },
        { id: 100, name: 'Bo', tier: 'standard' },
        { id: 101, name: 'Cy', tier: 'premium' },
      ]),
      'migrated/orders.jsonl': JSONL([
        { id: 1, amount: 250, currency: 'USD' },
        { id: 2, amount: 0, currency: 'USD' },
        { id: 3, amount: 75, currency: 'USD' },
      ]),
      'migrated/logs.jsonl': JSONL([
        { id: 1, at_ms: Date.parse('2026-01-02T03:04:05.000Z') },
        { id: 2, at_ms: Date.parse('2026-02-03T04:05:06.000Z') },
      ]),
      'migration-report.json': J({
        tables: {
          customers: { count: 3, first_id: 99, last_id: 101 },
          orders: { count: 3, first_id: 1, last_id: 3 },
          logs: { count: 2, first_id: 1, last_id: 2 },
        },
        total_records: 8,
      }),
    },
    required: ['customers_fixed', 'orders_fixed', 'logs_fixed', 'report_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-customers.js', 'check-orders.js', 'check-logs.js', 'check-report.js', 'CONTRACT.md', 'canonical.js', 'schemas/customers.v2.json', 'schemas/orders.v2.json', 'schemas/logs.v2.json'],
    extraChecks: [
      { id: 'customers_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-D1/check-customers.js' },
      { id: 'orders_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-D1/check-orders.js' },
      { id: 'logs_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-D1/check-logs.js' },
      { id: 'report_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-D1/check-report.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三张表各自有真实缺陷（边界回填 / 丢失记录 / 类型错误）与独立验收脚本，且存在必须三套模块都修好才能通过的统一报告校验（产物必须与模块输出逐字节一致）⇒ 并行/编排有实际收益。',
    rationaleNot: 'DIRECT/EXPLORE 未利用三张表互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F10-D2', category: 'D', variant: 2, token: 'F10-D2 OK',
    title: '有依赖关系的迁移链：新增列 → 回填 → 约束校验（真实 artifact 传递）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F10-D2 需要按 CONTRACT.md 的阶段依赖完成 V1→V2 迁移，并交付：',
      '① 各阶段产物 stages/step1.jsonl、stages/step2.jsonl、stages/step3.jsonl；',
      '② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；',
      '③ 最终迁移产物 migrated.jsonl 与阶段说明 CHAIN.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/ops.js、schemas/ 与 data/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 阶段依赖条款（D2）',
        '',
        '1. 迁移链必须按依赖顺序执行：**新增字段（region）→ 按映射回填 region → region 约束校验**；',
        '2. 每一步必须消费上一步的**真实产物文件**（不得跳步或重新读取源数据）；',
        '3. 每一步必须在 `provenance.json` 记录 {step, input, input_sha256, output, output_sha256}，input/output 为相对本目录的路径；',
        '4. 最终 `migrated.jsonl` = 第三步的产物，且必须满足 V2 的 region 非空约束。',
      ]),
      'canonical.js': CANONICAL_JS,
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['country', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['country', 'string', true, false], ['region', 'string', true, false]]),
      'data/records.jsonl': JSONL([{ id: 1, country: 'JP' }, { id: 2, country: 'DE' }, { id: 3, country: 'BR' }]),
      'data/region-map.json': J({ JP: 'APAC', DE: 'EMEA', BR: 'LATAM' }),
      'lib/ops.js': [
        '// 迁移链算子（受保护，冻结语义）',
        'function addRegionColumn(rec) { return { id: rec.id, country: rec.country, region: null }; }',
        'function backfillRegion(rec, map) {',
        '  if (rec.region !== null && rec.region !== undefined) return { id: rec.id, country: rec.country, region: rec.region };',
        '  return { id: rec.id, country: rec.country, region: map[rec.country] || null };',
        '}',
        "function addRegionConstraint(rec) { if (!rec.region) throw new Error('region 约束失败：id=' + rec.id); return { id: rec.id, country: rec.country, region: rec.region }; }",
        'module.exports = { addRegionColumn, backfillRegion, addRegionConstraint };',
      ].join('\n'),
      'check-chain.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const crypto = require('crypto');",
        REF_SER_JS,
        READ_JSONL_JS,
        "const abs = (p) => path.normalize(path.isAbsolute(String(p)) ? String(p) : path.join(__dirname, String(p)));",
        "const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');",
        "const prov = JSON.parse(fs.readFileSync(path.join(__dirname, 'provenance.json'), 'utf8'));",
        "assert.ok(Array.isArray(prov) && prov.length === 3, 'provenance 必须包含三个阶段记录，实际 ' + JSON.stringify(prov && prov.length));",
        "for (let i = 0; i < 3; i++) assert.strictEqual(prov[i].step, i + 1, 'provenance 必须按 step 1..3 排列');",
        "assert.ok(abs(prov[0].input) === abs('data/records.jsonl'), 'step1 的输入必须是源数据文件 data/records.jsonl，实际 ' + prov[0].input);",
        "assert.strictEqual(abs(prov[1].input), abs(prov[0].output), 'step2 的输入必须来自 step1 的输出产物（不得跳步或重读源数据）');",
        "assert.strictEqual(abs(prov[2].input), abs(prov[1].output), 'step3 的输入必须来自 step2 的输出产物');",
        'for (const p of prov) {',
        "  assert.strictEqual(sha(abs(p.input)), p.input_sha256, 'provenance 记录的输入 sha256 必须与真实文件一致：' + p.input);",
        "  assert.strictEqual(sha(abs(p.output)), p.output_sha256, 'provenance 记录的输出 sha256 必须与真实文件一致：' + p.output);",
        '}',
        "const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));",
        "const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'region-map.json'), 'utf8'));",
        "const source = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));",
        "const reference = refSerialize(schemaV2, source.map((r) => ({ id: r.id, country: r.country, region: map[r.country] || null })));",
        "const actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');",
        "assert.ok(refBytesEq(actual, reference), '最终迁移产物与独立参考链逐字节不一致：actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(reference));",
        "for (const line of actual.trim().split('\\n')) { if (!line.trim()) continue; const r = JSON.parse(line); assert.ok(r.region, 'step3 的 region 约束必须成立（id=' + r.id + '）'); }",
        "console.log('CHAIN OK steps=3 artifacts=verified');",
      ].join('\n'),
      'CHAIN.md': '# 迁移链说明\n（待补）\n',
      'verify.js': ["require('./check-chain.js');", "console.log('F10-D2 OK');"].join('\n'),
    },
    fix: {
      'run-chain.js': [
        '// 迁移链编排：新增列 → 回填 → 约束校验；每一步消费上一步的真实产物并记录 provenance',
        "const fs = require('fs');",
        "const path = require('path');",
        "const crypto = require('crypto');",
        "const { addRegionColumn, backfillRegion, addRegionConstraint } = require('./lib/ops.js');",
        "const { serializeRecords } = require('./canonical.js');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "const readJsonl = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
        "const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, p))).digest('hex');",
        "const schemaV2 = rd(path.join('schemas', 'v2.json'));",
        "const map = rd(path.join('data', 'region-map.json'));",
        'fs.mkdirSync(path.join(__dirname, \'stages\'), { recursive: true });',
        'const stages = [',
        "  { step: 1, input: 'data/records.jsonl', output: 'stages/step1.jsonl', apply: (rs) => rs.map(addRegionColumn) },",
        "  { step: 2, input: 'stages/step1.jsonl', output: 'stages/step2.jsonl', apply: (rs) => rs.map((r) => backfillRegion(r, map)) },",
        "  { step: 3, input: 'stages/step2.jsonl', output: 'stages/step3.jsonl', apply: (rs) => rs.map(addRegionConstraint) },",
        '];',
        'const prov = [];',
        'for (const s of stages) {',
        '  const before = sha(s.input);',
        '  const out = s.apply(readJsonl(s.input));',
        "  fs.writeFileSync(path.join(__dirname, s.output), serializeRecords(schemaV2, out), 'utf8');",
        '  const after = sha(s.output);',
        '  prov.push({ step: s.step, input: s.input, input_sha256: before, output: s.output, output_sha256: after });',
        '}',
        "fs.writeFileSync(path.join(__dirname, 'provenance.json'), JSON.stringify(prov, null, 2) + '\\n', 'utf8');",
        "fs.copyFileSync(path.join(__dirname, 'stages', 'step3.jsonl'), path.join(__dirname, 'migrated.jsonl'));",
        "fs.writeFileSync(path.join(__dirname, 'CHAIN.md'), '# 迁移链说明\\n迁移链：新增 region 列 → 按 region-map 回填 → region 非空约束校验；每一步消费上一步的真实产物并记录 sha256 溯源。\\n', 'utf8');",
        "console.log('migration chain done');",
      ].join('\n'),
      'CHAIN.md': '# 迁移链说明\n迁移链：新增 region 列 → 按 region-map 回填 → region 非空约束校验；每一步消费上一步的真实产物并记录 sha256 溯源。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F10-D2/run-chain.js',
    required: ['chain_provenance', 'chain_ok', 'migrated_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-chain.js', 'CONTRACT.md', 'canonical.js', 'lib/ops.js', 'schemas/v1.json', 'schemas/v2.json', 'data/records.jsonl', 'data/region-map.json'],
    extraChecks: [
      { id: 'chain_provenance', kind: 'file_exists', path: 'provenance.json' },
      { id: 'chain_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-D2/check-chain.js' },
      { id: 'migrated_written', kind: 'file_contains', path: 'migrated.jsonl', expect: 'region' },
    ],
    expected: ['WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个阶段存在真实依赖（新增列会把 region 重置为 null，回填必须发生在约束校验之前），且 checker 断言 step 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致）⇒ 阶段化编排由任务结构本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段依赖与产物传递结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F10-E1', category: 'E', variant: 1, token: 'F10-E1 OK',
    title: '破坏性 Schema 变更：新迁移路径违反 legacy 兼容契约',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F10-E1 的 migrate.js 是一版**已上线**的 V1→V2 迁移，其产物被 legacy/consumer.js 按字段逐项回放（legacy/consumer.js 与 schemas/ 均不得修改）。',
      'CONTRACT.md 的兼容条款必须成立；migrate.js 与 check.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 兼容条款（E1，优先于 schemas/v2.json 的 email 字段形态）',
        '',
        '1. 既有消费方依赖 `email: string`（外部消费方逐字段回放）⇒ 迁移产物中 `email` **必须保持字符串**；',
        '2. 新结构化值必须同时提供在 `email_detail`：`{address: string, verified: boolean}`，且 `verified` 初始为 `false`；',
        '3. 上述两条必须**同时**成立；record_count 不得变化。',
        '4. 说明：`schemas/v2.json` 描述**新写入方**的 schema（email 为对象）；本变体的兼容迁移路径以本条款为准，二者服务不同消费方，不得混用。',
      ]),
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['email', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['email', 'object', true, false]]),
      'data/records.jsonl': JSONL([{ id: 1, email: 'ada@x.io' }, { id: 2, email: 'bo@x.io' }]),
      'migrate.js': [
        '// 已上线的 V1→V2 迁移：按 schemas/v2.json 把 email 变为结构化对象（破坏 legacy 契约）',
        'function migrate(records) { return records.map((r) => ({ id: r.id, email: { address: r.email, verified: false } })); }',
        'module.exports = { migrate };',
      ].join('\n'),
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：要求 email 仍是字符串，同时要求 email_detail 存在',
        "const assert = require('assert');",
        'function consume(records) {',
        '  for (const r of records) {',
        "    assert.strictEqual(typeof r.email, 'string', 'legacy 契约：email 必须是字符串，实际 ' + JSON.stringify(r.email));",
        "    assert.ok(r.email.indexOf('@') > 0, 'legacy 契约：email 必须是可解析地址');",
        "    assert.ok(r.email_detail && typeof r.email_detail.address === 'string', '兼容契约：必须同时提供 email_detail.address');",
        '  }',
        '  return records.length;',
        '}',
        'module.exports = { consume };',
      ].join('\n'),
      'index.js': [
        '// 对外入口（可修改）：当前直接转发既有迁移实现',
        "const base = require('./migrate.js');",
        'module.exports = { migrate: base.migrate };',
      ].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { migrate } = require('./index.js');",
        "const { consume } = require('./legacy/consumer.js');",
        READ_JSONL_JS,
        "const records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));",
        'const out = migrate(records);',
        "assert.strictEqual(out.length, records.length, 'record_count 不得变化');",
        'const n = consume(out); // legacy 契约 + 兼容契约（字符串 email + email_detail）',
        "assert.strictEqual(n, records.length, '消费方必须能完整回放全部记录');",
        "assert.strictEqual(out.map((r) => (typeof r.email === 'string' ? r.email : '')).join(','), records.map((r) => r.email).join(','), 'legacy email 字符串必须逐条保留');",
        "assert.strictEqual(out[0].email_detail.verified, false, '兼容契约：verified 必须初始化为 false');",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F10-E1 OK');"].join('\n'),
    },
    fix: {
      'migrate-compat.js': [
        '// 兼容迁移路径：保留 legacy email 字符串，同时补上 email_detail 结构化值',
        "function migrate(records) { return records.map((r) => ({ id: r.id, email: r.email, email_detail: { address: r.email, verified: false } })); }",
        'module.exports = { migrate };',
      ].join('\n'),
      'index.js': [
        '// 对外入口：指向兼容迁移路径',
        "const compat = require('./migrate-compat.js');",
        'module.exports = { migrate: compat.migrate };',
      ].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['migrate.js', 'legacy/consumer.js', 'schemas/v1.json', 'schemas/v2.json', 'check.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'migrate-compat.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F10-E1/check.js', log: 'pilot-workspace/FORMAL-F10-E1/attempt-log.txt' },
    rationaleGt: '现状把已上线迁移当作新接口：migrate.js 按新 schema 把 email 变成对象，而兼容条款要求 email 保持字符串并同时提供 email_detail；migrate.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容迁移路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F10-E2', category: 'E', variant: 2, token: 'F10-E2 OK',
    title: 'migration 幂等性失败：已是 v2 的数据被二次转换',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F10-E2 的同一 migration 对**已是 v2** 的数据再次执行时产生了二次副作用。',
      'CONTRACT.md 的 V7 幂等条款必须成立；idempotent.js、canonical.js、schemas/ 与 data/ 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 幂等条款（E2，V7 的运行时含义）',
        '',
        '同一 migration 对已是目标版本的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变。',
        '判定使用 canonical 形式（V8）：固定字段顺序 + LF；不得因 key 顺序差异产生假差异。',
      ]),
      'canonical.js': CANONICAL_JS,
      'schemas/v1.json': SCHEMA(1, [['id', 'integer', true, false], ['first_name', 'string', true, false], ['last_name', 'string', true, false]]),
      'schemas/v2.json': SCHEMA(2, [['id', 'integer', true, false], ['display_name', 'string', true, false]]),
      'data/v1.jsonl': JSONL([{ id: 1, first_name: 'Alice', last_name: '' }, { id: 2, first_name: 'Bo', last_name: 'Ng' }]),
      'data/v2.jsonl': JSONL([{ id: 1, display_name: 'Alice' }, { id: 2, display_name: 'BoNg' }]),
      'migrate.js': [
        '// V1→V2 迁移（当前实现）：display_name := first_name + last_name',
        "const { serializeRecords } = require('./canonical.js');",
        'function migrate(records, fromVersion) {',
        '  const out = records.map((r) => {',
        "    const first = r.first_name || r.display_name || '';   // 缺陷：已是 v2 时把 display_name 当作 first_name",
        "    const last = r.last_name || r.display_name || '';",
        "    return { id: r.id, display_name: String(first) + String(last) };",
        '  });',
        '  return { version: 2, records: out };',
        '}',
        'module.exports = { migrate };',
      ].join('\n'),
      'idempotent.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { migrate } = require('./migrate.js');",
        "const canonical = require('./canonical.js');",
        READ_JSONL_JS,
        "const schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));",
        "const before = fs.readFileSync(path.join(__dirname, 'data', 'v2.jsonl'), 'utf8');",
        "const records = readJsonlFile(path.join(__dirname, 'data', 'v2.jsonl'));",
        'const out = migrate(records, 2); // 对已是 v2 的数据再次执行同一 migration',
        "assert.strictEqual(out.version, 2, 'V7：已是目标版本时 schema 必须保持 v2，实际 ' + out.version);",
        "assert.strictEqual(out.records.length, records.length, 'V7：record_count 不得变化，实际 ' + out.records.length);",
        'const after = canonical.serializeRecords(schemaV2, out.records);',
        "assert.strictEqual(Buffer.compare(Buffer.from(after, 'utf8'), Buffer.from(before, 'utf8')), 0, 'V7：已是 v2 的数据再次迁移必须逐字节不变，actual=' + JSON.stringify(out.records) + ' expected=' + JSON.stringify(records));",
        "console.log('IDEMPOTENT OK');",
      ].join('\n'),
      'verify.js': ["require('./idempotent.js');", "console.log('F10-E2 OK');"].join('\n'),
    },
    fix: {
      'migrate.js': [
        '// V1→V2 迁移：已是目标版本的记录必须原样保留（V7 幂等）',
        "const { serializeRecords } = require('./canonical.js');",
        'function migrate(records, fromVersion) {',
        '  if (fromVersion >= 2) return { version: 2, records: records.map((r) => ({ id: r.id, display_name: r.display_name })) };',
        "  return { version: 2, records: records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })) };",
        '}',
        'module.exports = { migrate };',
      ].join('\n'),
    },
    required: ['idempotency_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['idempotent.js', 'canonical.js', 'schemas/v1.json', 'schemas/v2.json', 'data/v1.jsonl', 'data/v2.jsonl', 'CONTRACT.md'],
    extraChecks: [{ id: 'idempotency_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F10-E2/idempotent.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F10-E2/idempotent.js', log: 'pilot-workspace/FORMAL-F10-E2/idempotent.log' },
    rationaleGt: '未修复态对已是 v2 的数据二次执行迁移（真实预跑：display_name "AliceAlice" 而期望 "Alice"，属业务结果差异，不是结构断言）；idempotent.js / canonical.js / schemas / data 冻结 ⇒ 必须改变"迁移何时生效、如何识别已是目标版本"的方案（计划层重规划）⇒ REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是 F08-C2 的跨分片账务去重（对象是 migration 的二次副作用）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const cfEvidence: Array<{ id: string; span: number | null; budget: number; verifyExit: number | null; rejected: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f10-evidence');
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
  // —— C 类反事实：同一批 fixture / 同一批数据分片 / 同一预算，仅把调度改为串行 ——
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
  `/**\n * benchmark/formal-seeds-f10.ts — F10 族 10 个变体的种子（由 scripts/formal-author-f10.ts 生成）\n */\nexport const FORMAL_F10_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f10.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f10-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f10-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F10', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F10) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F10', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F10', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F10 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> **领域边界**：F10 只研究"数据实例 → Schema 验证 → 版本兼容性 → Schema 演进 → Migration → 验证迁移后的数据"。',
  '> 不引入：依赖解析/lockfile(F05) / 配置层叠(F07) / quota/billing(F08) / 事件流(F04) / HTTP(F03) / 模板渲染与快照(F09) / 数据库性能优化本身 / 通用 workflow 本身。',
  '> 特别声明：**F10 的 migration 是"数据结构与数据内容的迁移"**，不研究 deployment / rollback 编排（保留给 F12）。',
  '> 与 F08-C2 的区分：F08-C2 = 跨分片用量记录的账务去重；F10-E2 = **schema migration 幂等性**（migration 重复执行不产生二次副作用）。',
  '> 契约：V1–V8 逐变体写死在 CONTRACT.md；产物一律 canonical 序列化（固定字段顺序 + UTF-8 + LF + 逐字节比较）。',
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
    '## C 类反事实证明（同 fixture / 同数据分片 / 同预算，仅改调度）',
    '',
    '| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |',
    '|---|---|---|---|---|',
    ...cfEvidence.map((c) => `| ${c.id} | ${String(c.span)} ms | ${c.budget} ms | ${String(c.verifyExit)} | ${c.rejected ? '✓（stderr 命中「总耗时超预算」）' : '⚠️'} |`),
    '',
    '> 串行反事实与正式证据使用同一批分片工具、同一批数据分片与同一预算，唯一差异是调度方式；',
    '> 正式证据另要求 canonical 产物与 checker 内嵌**独立参考迁移**逐字节一致（C2 另含 record_count 与 identity 断言）。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f10.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(VERSION, {
  dataset: 'formal', family: 'F10', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
const cfgTotal = vtEvidence.reduce((a, e) => a + e.cfg, 0);
const preOk = vtEvidence.filter((e) => e.pre !== undefined && e.pre !== 'exit=0').length;
const preDeclared = vtEvidence.filter((e) => e.pre !== undefined).length;
const cfOk = cfEvidence.filter((e) => e.rejected).length;
console.log('\n=== F10 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${cfgTotal}；success=null 总数 = ${vtEvidence.filter((e) => e.beforeOk === null || e.afterOk === null).length}`);
console.log(`  E 类真实预跑    = ${preOk}/${preDeclared} 以非 0 退出`);
console.log(`  C 类反事实      = ${cfOk}/${cfEvidence.length} 被 verify 以「超预算」拒绝`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F10-*.yaml · formal-seeds-f10.ts · f10-review.md · f10-gt-drafts.json · f10-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length && cfgTotal === 0 && preOk === preDeclared && cfOk === cfEvidence.length;
console.log(allOk ? '✅ F10 起草 + 三层证据全部通过（等待人工逐条构念审查与签署；本轮不签署/不冻结/不 commit）' : '⛔ 存在问题，见 f10-review.md');
process.exit(allOk ? 0 : 3);
