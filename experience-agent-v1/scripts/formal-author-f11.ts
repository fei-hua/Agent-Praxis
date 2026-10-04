/**
 * scripts/formal-author-f11.ts — F11 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 领域（与 F01–F10 各族的领域均不同）：**日志聚合与查询语义**
 *   日志记录 canonical 化 → 时间窗口 → 谓词过滤 → 去重 → 聚合 → 真全序排序 → limit；
 *   查询**不修改状态**、不重放事件，结果一律按 Q1–Q8（写死在 CONTRACT.md）canonical 逐字节比较。
 *   边界：F04 = event → state；F11 = log → query result。
 * 纪律：只产出 draft；三层证据；E 类真实预跑 + 日志后冻结基线；prompt 不含 first-decision 提示；
 *      C 类另有「反事实（仅改调度）+ 结果与 checker 内嵌独立参考查询逐字节一致」；D2 断言 step 间真实 artifact 传递。
 * 用法：node scripts/formal-author-f11.ts
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f11.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f11-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f11-gt-drafts.json');
const VERSION = path.join(ROOT, 'benchmark', 'formal', 'f11-version.json');

interface Variant {
  id: string; category: string; variant: number; token: string; title: string;
  taskType: string; complexity: string; scope: string; characteristics: string[]; constraints: string[];
  prompt: string; files: Record<string, string>; fix: Record<string, string>; fixRun?: string;
  required: string[]; forbidden: string[]; protectedExtra?: string[];
  extraChecks?: Array<Record<string, unknown>>;
  expected: string[]; expectedDelegation: boolean; rationaleGt: string; rationaleNot: string;
  preRun?: { command: string; log: string };
  /** 起草期：用**未修复**的初始实现真实生成初始产物（使初始状态自洽但违反契约） */
  derive?: string[]; derived?: string[]; deriveCopy?: Array<[string, string]>;
  /** C 类：反事实脚本内容（仅起草期证据，不进入任务目录）与预算 */
  counterfactual?: string; budget?: number;
}
const V = (v: Variant): Variant => v;

const J = (o: unknown): string => JSON.stringify(o, null, 2) + '\n';
const JSONL = (records: unknown[]): string => records.map((r) => JSON.stringify(r)).join('\n') + '\n';

// ---------- Q1–Q8 契约文本（逐变体显式声明；checker 逐条引用） ----------
const CONTRACT_MD = (extra: string[] = []): string =>
  [
    '# 日志查询契约（Q1–Q8，本任务的唯一判定依据）',
    '',
    '> 领域边界：本契约只研究「日志记录 → 聚合 → 过滤 → 排序 → 查询结果」，**不修改任何状态**、不重放事件、',
    '> 不以状态转移结果作为查询正确性的判定依据（事件顺序与状态机属于 F04 的领域）。',
    '',
    '- **Q1 时间窗口**：半开区间 `[start, end)`，`ts` 为整数毫秒。`ts == end` ⇒ **不计入**本窗口（归下一窗口）；',
    '  `ts` 缺失或非整数 ⇒ **非法记录**：在进入 query population **之前**直接排除（不得当作 0、不得报错中断、',
    '  且不参与 Q4 第 ② 步的 duplicate resolution）。',
    '- **Q2 聚合定义**：count = 去重后匹配记录条数（含 value 缺失者）；count_with_value = 去重后匹配且 value 为数值的记录条数；',
    '  sum = 去重后匹配且 value 为数值的 value 之和（**缺失/null 不计入，不得视为 0**）；min/max = 在"有数值"的记录上取值，',
    '  该集合为空 ⇒ `null`（数值集合为空时 sum = 0）。字符串形式的数字（如 `"10"`）**不是数值**。',
    '- **Q3 全序（total order）**：一律按 `(ts asc, record_id 序数升序, canonical_record_bytes 逐字节升序)` 排序；',
    '  第三键 = 该记录 Q5 五字段 canonical 序列化字节；record_id 为**序数比较**（非 locale）；',
    '  禁止依赖输入顺序、分片顺序或对象遍历顺序；canonical bytes 完全相同的重复行视为同一行。',
    '- **Q4 查询语义与处理顺序（唯一，不得调换）**：过滤表达式优先级 **NOT > AND > OR**，允许括号；',
    '  比较一律大小写敏感、逐字节；`level` 为固定枚举，取值逐字为 `["debug","info","warn","error"]`（精确相等）；',
    '  字段缺失或为 `null` 时，任何比较一律为 `false`（两值逻辑）；空结果 ⇒ 返回 `[]`（不是 null、不是错误）。',
    '  流水线顺序：① canonicalize + 类型合法性 → ② duplicate record_id resolution（保留 Q3 全序中**最早**的一条）',
    '  → ③ time-window filter → ④ predicate filter → ⑤ aggregation → ⑥ ordering → ⑦ limit。',
    '- **Q5 canonical 日志形式**：每条记录恒为五字段，按固定字段顺序 `(ts, level, service, record_id, value)` 序列化；',
    '  缺失 value 统一编码为 JSON `null`（不省略键）；UTF-8；每条记录一行、以 LF 结束；行序 = Q3 全序。',
    '- **Q6 limit / top-K**：`limit` 非 null 时 `records` = Q3 全序的**前 K 条**（不是任意 K 条）；',
    '  `aggregation` 始终按 limit 之前的匹配集合计算（第 ⑤ 步先于第 ⑦ 步）。',
    '- **Q7 结果 canonical 形式**：结果文件为 `{"records":[...],"aggregation":{...}}`；`records` 按 Q3 全序、每条为 Q5 五字段形式；',
    '  `aggregation` 按固定字段顺序 `(count, count_with_value, sum, min, max)`；一律 UTF-8 + 结尾 LF，**逐字节**比较。',
    '- **Q8 类型规则**：`value` 仅数值或缺失/null；**不做隐式类型转换**（`"10"` 非数值）；level / service / record_id 视为字符串。',
    ...(extra.length ? ['', ...extra] : []),
    '',
  ].join('\n');

/** A/B/E 变体的谓词与窗口边界变体：检查脚本需与之对应 */
const CHECK_QUERY_JS = (extra: string[], token: string): string => `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runQuery } = require('./query.js');
const { serializeResult } = require('./canonical.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const reference = refSerializeResult(refQuery(logs, query));
const delivered = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
const inProcess = serializeResult(runQuery(logs, query));
${extra.join('\n')}
assert.ok(refBytesEq(inProcess, reference), '查询实现（query.js）的输出必须与 checker 内嵌独立参考逐字节一致：actual=' + JSON.stringify(inProcess.slice(0, 200)) + ' expected=' + JSON.stringify(reference.slice(0, 200)));
assert.ok(refBytesEq(delivered, reference), 'result.json 必须与 checker 内嵌独立参考逐字节一致：actual=' + JSON.stringify(delivered.slice(0, 200)) + ' expected=' + JSON.stringify(reference.slice(0, 200)));
console.log(${JSON.stringify(token)});
`;

/** A/B 变体统一的 runner：由 query.js 重算 result.json（Q7 canonical） */
const RUN_JS = `// 读取 logs/ 与 query.json，调用 query.js 重算 result.json（Q7 canonical 形式）
const fs = require('fs');
const path = require('path');
const { serializeResult } = require('./canonical.js');
const { runQuery } = require('./query.js');
const files = fs.readdirSync(path.join(__dirname, 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const records = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') records.push(JSON.parse(line));
}
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult(runQuery(records, query)), 'utf8');
console.log('result.json 已重算：records=' + runQuery(records, query).records.length);
`;

const RESULT_STUB = '{"records":[],"aggregation":{"count":-1,"count_with_value":0,"sum":0,"min":null,"max":null}}\n';

// ---------- 任务侧 canonical 序列化（Q5/Q7） ----------
const CANONICAL_JS = `// canonical 序列化（Q5/Q7）：五字段固定顺序 (ts, level, service, record_id, value)
// 缺失 value 统一编码为 JSON null（不省略键）；每条记录一行、以 LF 结束；行序 = Q3 全序
function canonicalRecord(rec) {
  return JSON.stringify({
    ts: rec.ts,
    level: rec.level,
    service: rec.service,
    record_id: rec.record_id,
    value: Object.prototype.hasOwnProperty.call(rec, 'value') ? rec.value : null,
  });
}
function isValidRecord(rec) {
  return !!rec && typeof rec.ts === 'number' && Number.isInteger(rec.ts);
}
function totalOrder(a, b) {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  if (a.record_id !== b.record_id) return a.record_id < b.record_id ? -1 : 1;
  return Buffer.compare(Buffer.from(canonicalRecord(a), 'utf8'), Buffer.from(canonicalRecord(b), 'utf8'));
}
function serializeRecords(records) {
  const sorted = records.slice().sort(totalOrder);
  return sorted.map(canonicalRecord).join('\\n') + (sorted.length ? '\\n' : '');
}
function serializeResult(res) {
  const records = res.records.map((r) => ({
    ts: r.ts,
    level: r.level,
    service: r.service,
    record_id: r.record_id,
    value: Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null,
  }));
  const aggregation = {
    count: res.aggregation.count,
    count_with_value: res.aggregation.count_with_value,
    sum: res.aggregation.sum,
    min: res.aggregation.min,
    max: res.aggregation.max,
  };
  return JSON.stringify({ records, aggregation }) + '\\n';
}
module.exports = { canonicalRecord, isValidRecord, totalOrder, serializeRecords, serializeResult };
`;

// ---------- checker 内嵌的独立参考查询（不引用被测实现；shunting-yard + RPN） ----------
const REF_Q_JS = `// —— 独立参考查询（checker 内嵌；不引用被测实现）——
function refFields(r) {
  return {
    ts: r.ts,
    level: r.level,
    service: r.service,
    record_id: r.record_id,
    value: Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null,
  };
}
function refRec(r) { return JSON.stringify(refFields(r)); }
function refValid(r) { return !!r && typeof r.ts === 'number' && Number.isInteger(r.ts); }
function refCmp(a, b) {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  if (a.record_id !== b.record_id) return a.record_id < b.record_id ? -1 : 1;
  return Buffer.compare(Buffer.from(refRec(a), 'utf8'), Buffer.from(refRec(b), 'utf8'));
}
function refLex(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') { out.push(two); i += 2; continue; }
    if (c === '<' || c === '>') { out.push(c); i++; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); out.push(JSON.parse(src.slice(i, j + 1))); i = j + 1; continue; }
    const num = /^-?[0-9]+(\\.[0-9]+)?/.exec(src.slice(i));
    if (num) { out.push(Number(num[0])); i += num[0].length; continue; }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0];
    out.push(word);
    i += word.length;
  }
  return out;
}
function refIsValue(t) {
  return !(t === 'AND' || t === 'OR' || t === 'NOT' || t === '(' || t === ')' || t === '==' || t === '!=' || t === '<' || t === '<=' || t === '>' || t === '>=');
}
const REF_PREC = { '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4, NOT: 3, AND: 2, OR: 1 };
function refRpn(tokens) {
  const out = [];
  const ops = [];
  for (const t of tokens) {
    if (refIsValue(t)) { out.push(t); continue; }
    if (t === '(') { ops.push(t); continue; }
    if (t === ')') { while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()); ops.pop(); continue; }
    while (ops.length && ops[ops.length - 1] !== '(' && REF_PREC[ops[ops.length - 1]] >= REF_PREC[t]) out.push(ops.pop());
    ops.push(t);
  }
  while (ops.length) out.push(ops.pop());
  return out;
}
function refCmpField(v, op, lit) {
  if (v === undefined || v === null) return false;
  if (op === '==') return v === lit;
  if (op === '!=') return v !== lit;
  if (typeof v !== 'number' || typeof lit !== 'number') return false;
  if (op === '<') return v < lit;
  if (op === '<=') return v <= lit;
  if (op === '>') return v > lit;
  return v >= lit;
}
function refEval(rpn, rec) {
  const st = [];
  for (const t of rpn) {
    if (refIsValue(t)) { st.push(t); continue; }
    if (t === 'NOT') { st.push(!st.pop()); continue; }
    if (t === 'AND' || t === 'OR') { const b = st.pop(); const a = st.pop(); st.push(t === 'AND' ? !!(a && b) : !!(a || b)); continue; }
    const lit = st.pop();
    const field = st.pop();
    const v = Object.prototype.hasOwnProperty.call(rec, field) ? rec[field] : undefined;
    st.push(refCmpField(v, t, lit));
  }
  return !!st.pop();
}
function refMatch(expr, rec) { return refEval(refRpn(refLex(expr)), rec); }
function refAgg(records) {
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of records) {
    count++;
    const v = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    if (typeof v === 'number') {
      countWithValue++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    }
  }
  return { count, count_with_value: countWithValue, sum, min, max };
}
function refQuery(logs, query) {
  const legal = logs.filter(refValid);
  const ordered = legal.slice().sort(refCmp);
  const seen = new Set();
  const deduped = [];
  for (const r of ordered) {
    if (seen.has(r.record_id)) continue;
    seen.add(r.record_id);
    deduped.push(r);
  }
  const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  const matched = windowed.filter((r) => refMatch(query.filter, r));
  const aggregation = refAgg(matched);
  const sorted = matched.slice().sort(refCmp);
  const records = (query.limit === null || query.limit === undefined) ? sorted : sorted.slice(0, query.limit);
  return { records, aggregation };
}
function refSerializeResult(res) {
  const records = res.records.map(refFields);
  const aggregation = {
    count: res.aggregation.count,
    count_with_value: res.aggregation.count_with_value,
    sum: res.aggregation.sum,
    min: res.aggregation.min,
    max: res.aggregation.max,
  };
  return JSON.stringify({ records, aggregation }) + '\\n';
}
function refSerializeLog(records) {
  const sorted = records.slice().sort(refCmp);
  return sorted.map(refRec).join('\\n') + (sorted.length ? '\\n' : '');
}
function refReadJsonl(p) {
  const text = require('fs').readFileSync(p, 'utf8').trim();
  return text ? text.split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)) : [];
}
function refReadLogsDir(dir) {
  const fsMod = require('fs');
  const files = fsMod.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
  const out = [];
  for (const f of files) out.push(...refReadJsonl(require('path').join(dir, f)));
  return out;
}
function refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }
`;

// ---------- 任务侧谓词求值（递归下降；Q4 优先级 NOT > AND > OR） ----------
const PARSE_CORRECT = `function orExpr() { let node = andExpr(); while (tk[p] && tk[p].k === 'OR') { p++; node = { op: 'OR', l: node, r: andExpr() }; } return node; }
  function andExpr() { let node = notExpr(); while (tk[p] && tk[p].k === 'AND') { p++; node = { op: 'AND', l: node, r: notExpr() }; } return node; }
  function notExpr() { if (tk[p] && tk[p].k === 'NOT') { p++; return { op: 'NOT', x: notExpr() }; } return primary(); }
  function primary() {
    const x = tk[p];
    if (x && x.k === '(') { p++; const node = orExpr(); p++; return node; }
    const field = tk[p++].v;
    const cmp = tk[p++].v;
    const lit = tk[p++].v;
    return { op: 'CMP', field, cmp, lit };
  }`;

const PARSE_OR_FIRST = `function orExpr() { let node = notExpr(); while (tk[p] && tk[p].k === 'OR') { p++; node = { op: 'OR', l: node, r: notExpr() }; } return node; }
  function andExpr() { let node = orExpr(); while (tk[p] && tk[p].k === 'AND') { p++; node = { op: 'AND', l: node, r: orExpr() }; } return node; }
  function notExpr() { if (tk[p] && tk[p].k === 'NOT') { p++; return { op: 'NOT', x: notExpr() }; } return primary(); }
  function primary() {
    const x = tk[p];
    if (x && x.k === '(') { p++; const node = orExpr(); p++; return node; }
    const field = tk[p++].v;
    const cmp = tk[p++].v;
    const lit = tk[p++].v;
    return { op: 'CMP', field, cmp, lit };
  }`;

const PREDICATE_JS = (orFirst: boolean, invertEquality: boolean, missingMatches: boolean): string => `function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({ k: c }); i++; continue; }
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') { out.push({ k: 'op', v: two }); i += 2; continue; }
    if (c === '<' || c === '>') { out.push({ k: 'op', v: c }); i++; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); out.push({ k: 'lit', v: JSON.parse(src.slice(i, j + 1)) }); i = j + 1; continue; }
    const num = /^-?[0-9]+(\\.[0-9]+)?/.exec(src.slice(i));
    if (num) { out.push({ k: 'lit', v: Number(num[0]) }); i += num[0].length; continue; }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0];
    if (word === 'AND' || word === 'OR' || word === 'NOT') out.push({ k: word });
    else out.push({ k: 'field', v: word });
    i += word.length;
  }
  return out;
}
function parseExpr(src) {
  const tk = tokenize(src);
  let p = 0;
  ${orFirst ? PARSE_OR_FIRST : PARSE_CORRECT}
  return ${orFirst ? 'andExpr()' : 'orExpr()'};
}
function compareField(rec, field, op, lit) {
  const v = Object.prototype.hasOwnProperty.call(rec, field) ? rec[field] : undefined;
  ${missingMatches ? 'if (v === undefined || v === null) return true; // 缺陷：缺失/null 字段被当作匹配' : 'if (v === undefined || v === null) return false; // Q4：缺失/null 时比较恒为 false'}
  if (op === '==') return ${invertEquality ? 'v !== lit; // 缺陷：相等判定取反' : 'v === lit;'};
  if (op === '!=') return ${invertEquality ? 'v === lit; // 缺陷：不等判定取反' : 'v !== lit;'};
  if (typeof v !== 'number' || typeof lit !== 'number') return false;
  if (op === '<') return v < lit;
  if (op === '<=') return v <= lit;
  if (op === '>') return v > lit;
  if (op === '>=') return v >= lit;
  return false;
}
function evaluate(node, rec) {
  if (node.op === 'OR') return evaluate(node.l, rec) || evaluate(node.r, rec);
  if (node.op === 'AND') return evaluate(node.l, rec) && evaluate(node.r, rec);
  if (node.op === 'NOT') return !evaluate(node.x, rec);
  return compareField(rec, node.field, node.cmp, node.lit);
}
function matches(expr, rec) { return evaluate(parseExpr(expr), rec); }`;

const DEDUPE_FIRST = `const sorted = records.slice().sort(totalOrder);
  const keepId = new Set();
  const keepRec = new Set();
  for (const r of sorted) {
    if (keepId.has(r.record_id)) continue;
    keepId.add(r.record_id);
    keepRec.add(canonicalRecord(r));
  }
  return records.filter((r) => keepRec.has(canonicalRecord(r)));`;

const DEDUPE_LAST = `const ordered = records.slice().sort(totalOrder);
  const byId = new Map();
  for (const r of ordered) byId.set(r.record_id, r); // 缺陷：后写覆盖 ⇒ 保留 Q3 全序中最后一条
  return Array.from(byId.values());`;

interface QueryMode {
  invertEquality?: boolean;
  includeEnd?: boolean;
  orFirst?: boolean;
  missingMatches?: boolean;
  keepLastDuplicate?: boolean;
  insertionOrder?: boolean;
  coerceValue?: boolean;
}

const QUERY_JS = (m: QueryMode = {}): string => `// 日志查询实现（Q1–Q8）：canonicalize/合法性 → 去重 → 窗口 → 谓词 → 聚合 → 全序 → limit
const { isValidRecord, totalOrder, canonicalRecord } = require('./canonical.js');
${PREDICATE_JS(!!m.orFirst, !!m.invertEquality, !!m.missingMatches)}
function dedupe(records) {
  ${m.keepLastDuplicate ? DEDUPE_LAST : DEDUPE_FIRST}
}
${m.coerceValue ? `function coerceNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s); // 缺陷：隐式类型转换（Q8：字符串数字不是数值）
  return Number.isFinite(n) ? n : null;
}
` : ''}function aggregate(records) {
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of records) {
    count++;
    const raw = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    const v = ${m.coerceValue ? 'coerceNumber(raw)' : 'raw'};
    if (typeof v === 'number') {
      countWithValue++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    }
  }
  return { count, count_with_value: countWithValue, sum, min, max };
}
function scan(records, query) {
  const legal = records.filter(isValidRecord);
  const deduped = dedupe(legal);
  const windowed = deduped.filter((r) => ${m.includeEnd ? 'r.ts >= query.window.start && r.ts <= query.window.end' : 'r.ts >= query.window.start && r.ts < query.window.end'});
  return windowed.filter((r) => matches(query.filter, r));
}
function runQuery(records, query) {
  const matched = scan(records, query);
  const aggregation = aggregate(matched);
  const ordered = ${m.insertionOrder ? 'matched.slice()' : 'matched.slice().sort(totalOrder)'};
  const recordsOut = (query.limit === null || query.limit === undefined) ? ordered : ordered.slice(0, query.limit);
  return { records: recordsOut, aggregation };
}
module.exports = { scan, dedupe, aggregate, matches, parseExpr, runQuery };
`;

// ---------- C 类公共条款 ----------
const C_CLAUSE = (budget: number): string[] => [
  '## C 类附加条款',
  '',
  `1. 三个分片共享总预算 ${budget} ms；`,
  '2. 调度方式不得改变结果：交付产物必须与 **checker 内嵌的独立参考实现**（不与被测实现共享代码）产出的结果**逐字节一致**；',
  '3. 分片工具必须真实执行（各自把 `{shard,start,end,token,count}` 追加到 timeline.jsonl，由工具自身写入，不得手工构造）。',
];

/** C1：分片局部查询工具（受保护，冻结语义）——算出本分片的局部结果（Q7 canonical） */
const C1_SHARD_TOOL = (shard: string, dur: number, token: string): string => `// 分片局部查询工具（受保护，冻结语义）：算出本分片的局部结果并按 Q7 canonical 写出
const fs = require('fs');
const path = require('path');
const { runQuery } = require('../shard-lib.js');
const { serializeResult } = require('../canonical.js');
const SHARD = ${JSON.stringify(shard)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const query = JSON.parse(fs.readFileSync(path.join(ROOT, 'query.json'), 'utf8'));
const records = fs.readFileSync(path.join(ROOT, 'logs', SHARD + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
const result = runQuery(records, query);
const text = serializeResult(result);
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: result.records.length }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', SHARD + '.json'), text, 'utf8');
console.log(SHARD + ' partial records=' + result.records.length + ' in ' + (end - start) + 'ms');
`;

/** C2：分片 canonical 化工具（受保护，冻结语义）——只做分片内 canonical 化与全序，不做窗口/谓词/去重 */
const C2_SHARD_TOOL = (shard: string, dur: number, token: string): string => `// 分片 canonical 化工具（受保护，冻结语义）：把本分片的日志按 Q5 canonical 形式（分片内 Q3 全序）写出
const fs = require('fs');
const path = require('path');
const { serializeRecords } = require('../canonical.js');
const SHARD = ${JSON.stringify(shard)};
const DUR = ${dur};
const TOKEN = ${JSON.stringify(token)};
const ROOT = path.join(__dirname, '..');
const start = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);
const records = fs.readFileSync(path.join(ROOT, 'logs', SHARD + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
const text = serializeRecords(records);
const end = Date.now();
fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: records.length }) + '\\n');
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');
console.log(SHARD + ' canonical records=' + records.length + ' in ' + (end - start) + 'ms');
`;

const C_SPAWN_HELPER = `function runOne(s) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
    c.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));
    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(s + ' exit=' + code + ' signal=' + sig))));
  });
}`;

const C1_MERGE_BODY = `const parts = SHARDS.map((s) => JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')));
  const records = [];
  for (const p of parts) records.push(...p.records);
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const p of parts) {
    count += p.aggregation.count;
    countWithValue += p.aggregation.count_with_value;
    sum += p.aggregation.sum;
    if (p.aggregation.min !== null) min = (min === null) ? p.aggregation.min : Math.min(min, p.aggregation.min);
    if (p.aggregation.max !== null) max = (max === null) ? p.aggregation.max : Math.max(max, p.aggregation.max);
  }
  const merged = { records: records.slice().sort(totalOrder), aggregation: { count, count_with_value: countWithValue, sum, min, max } };
  fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult(merged), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'REPORT.md'), '# 分片查询汇总\\n三分片并行执行完成；分片局部结果按 Q3 真全序合并，聚合按 count/count_with_value/sum 求和、min/max 取极值合并。\\n', 'utf8');
  console.log('parallel shard query done');`;

const C1_RUNNER = (shards: string[]): string => `// 并行编排：并发执行三个分片工具，等待全部完成后**合并分片局部结果**为 result.json
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { totalOrder, serializeResult } = require('./canonical.js');
const SHARDS = ${JSON.stringify(shards)};
${C_SPAWN_HELPER}
Promise.all(SHARDS.map(runOne)).then(() => {
  ${C1_MERGE_BODY}
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const C2_RUNNER = (shards: string[]): string => `// 并行编排：并发执行三个分片工具，等待全部完成后做**跨分片全局合并**（Q3 真全序 + 去重 + 聚合）
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { totalOrder, serializeRecords, serializeResult } = require('./canonical.js');
const { matches } = require('./predicate.js');
const SHARDS = ${JSON.stringify(shards)};
${C_SPAWN_HELPER}
Promise.all(SHARDS.map(runOne)).then(() => {
  const all = [];
  for (const s of SHARDS) {
    const text = fs.readFileSync(path.join(__dirname, 'out', s + '.jsonl'), 'utf8').trim();
    if (text) for (const line of text.split('\\n')) if (line.trim() !== '') all.push(JSON.parse(line));
  }
  const legal = all.filter((r) => typeof r.ts === 'number' && Number.isInteger(r.ts));
  fs.writeFileSync(path.join(__dirname, 'merged.jsonl'), serializeRecords(legal), 'utf8');
  const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
  const sorted = legal.slice().sort(totalOrder);
  const seen = new Set();
  const deduped = [];
  for (const r of sorted) {
    if (seen.has(r.record_id)) continue;
    seen.add(r.record_id);
    deduped.push(r);
  }
  const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  const matched = windowed.filter((r) => matches(query.filter, r));
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of matched) {
    count++;
    const v = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    if (typeof v === 'number') {
      countWithValue++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    }
  }
  const ordered = matched.slice().sort(totalOrder);
  const records = (query.limit === null || query.limit === undefined) ? ordered : ordered.slice(0, query.limit);
  fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult({ records, aggregation: { count, count_with_value: countWithValue, sum, min, max } }), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'REPORT.md'), '# 跨分片合并汇总\\n三分片并行完成 canonical 化；合并后的日志按 Q3 真全序（含第三键 canonical_record_bytes）排序，查询结果在全局去重后按 Q1–Q8 计算。\\n', 'utf8');
  console.log('cross-shard merge done');
}).catch((e) => { console.error(e.message); process.exit(1); });
`;

const C1_COUNTERFACTUAL = (shards: string[]): string => `// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批分片 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { totalOrder, serializeResult } = require(path.join(__dirname, 'canonical.js'));
const SHARDS = ${JSON.stringify(shards)};
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const s of SHARDS) execFileSync(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
${C1_MERGE_BODY}
`;

const C2_COUNTERFACTUAL = (shards: string[]): string => `// 反事实（仅起草期证据，不属于任务交付物）：同一批 fixture / 同一批分片 / 同一预算，**仅把调度改为串行**
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { totalOrder, serializeRecords, serializeResult } = require(path.join(__dirname, 'canonical.js'));
const { matches } = require(path.join(__dirname, 'predicate.js'));
const SHARDS = ${JSON.stringify(shards)};
fs.rmSync(path.join(__dirname, 'timeline.jsonl'), { force: true });
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true });
for (const s of SHARDS) execFileSync(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });
const all = [];
for (const s of SHARDS) {
  const text = fs.readFileSync(path.join(__dirname, 'out', s + '.jsonl'), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') all.push(JSON.parse(line));
}
const legal = all.filter((r) => typeof r.ts === 'number' && Number.isInteger(r.ts));
fs.writeFileSync(path.join(__dirname, 'merged.jsonl'), serializeRecords(legal), 'utf8');
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const sorted = legal.slice().sort(totalOrder);
const seen = new Set();
const deduped = [];
for (const r of sorted) { if (seen.has(r.record_id)) continue; seen.add(r.record_id); deduped.push(r); }
const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
const matched = windowed.filter((r) => matches(query.filter, r));
let count = 0; let countWithValue = 0; let sum = 0; let min = null; let max = null;
for (const r of matched) {
  count++;
  const v = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
  if (typeof v === 'number') { countWithValue++; sum += v; if (min === null || v < min) min = v; if (max === null || v > max) max = v; }
}
const ordered = matched.slice().sort(totalOrder);
const records = (query.limit === null || query.limit === undefined) ? ordered : ordered.slice(0, query.limit);
fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult({ records, aggregation: { count, count_with_value: countWithValue, sum, min, max } }), 'utf8');
console.log('serial counterfactual done');
`;

/** C1 专有断言：分片互不相交（构造性证据） */
const C1_EXTRA_ASSERTS = `const idShard = new Map();
for (const s of SHARDS) {
  for (const r of refReadJsonl(path.join(__dirname, 'logs', s + '.jsonl'))) {
    assert.ok(!idShard.has(r.record_id), 'fixture 违反 C1 前提：record_id 跨分片重复 ' + r.record_id);
    idShard.set(r.record_id, s);
  }
}`;

/** C2 专有断言：拼接序 ≠ canonical 序、非法 ts 排除、跨分片重复、第三键 tie-break、去重取用 */
const C2_EXTRA_ASSERTS = `const outRecords = [];
for (const s of SHARDS) outRecords.push(...refReadJsonl(path.join(__dirname, 'out', s + '.jsonl')));
const concatText = outRecords.map(refRec).join('\\n') + '\\n';
assert.ok(!refBytesEq(concatText, merged), 'C2：分片拼接序不得等于 canonical 全序（必须做跨分片合并排序）');
assert.strictEqual(merged.indexOf('r-c2'), -1, 'Q1：非法 ts（非整数）的记录必须被排除');
const mergedRecords = merged.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(mergedRecords.length, logs.filter(refValid).length, 'merged.jsonl 必须保留重复 record_id（不得去重）：actual=' + mergedRecords.length + ' expected=' + logs.filter(refValid).length);
const idShards = new Map();
for (const r of outRecords) {
  if (!idShards.has(r.record_id)) idShards.set(r.record_id, new Set());
  idShards.get(r.record_id).add(r.service + ':' + r.ts);
}
const crossIds = outRecords.map((r) => r.record_id).filter((id, i, arr) => arr.indexOf(id) !== i);
assert.ok(new Set(crossIds).size >= 1, 'fixture 必须包含跨分片重复 record_id（构造性证据），实际 ' + new Set(crossIds).size);
const resObj = JSON.parse(fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8'));
for (const cid of new Set(crossIds)) {
  const group = outRecords.filter((r) => r.record_id === cid);
  const refOrder = group.slice().sort(refCmp).map(refRec);
  const gotOrder = mergedRecords.filter((r) => r.record_id === cid).map(refRec);
  assert.ok(refBytesEq(gotOrder.join('\\n'), refOrder.join('\\n')), 'Q3 第三键（canonical_record_bytes）必须决定 (ts, record_id) 相同记录的全序：id=' + cid + ' actual=' + JSON.stringify(gotOrder) + ' expected=' + JSON.stringify(refOrder));
  const kept = resObj.records.filter((r) => r.record_id === cid);
  assert.strictEqual(kept.length, 1, 'Q4-2：result.json 中同一 record_id 只能保留一条：' + cid);
  assert.strictEqual(refRec(kept[0]), refOrder[0], 'Q4-2：必须保留 Q3 全序中最早的一条：id=' + cid + ' actual=' + JSON.stringify(refRec(kept[0])) + ' expected=' + JSON.stringify(refOrder[0]));
}`;

const C_CHECK = (budget: number, shards: string[], mode: 'partial' | 'merge', token: string | null): string => {
  const perShard = shards
    .map((s) => {
      const logPath = `path.join(__dirname, 'logs', ${JSON.stringify(s)} + '.jsonl')`;
      const outPath =
        mode === 'partial'
          ? `path.join(__dirname, 'out', ${JSON.stringify(s)} + '.json')`
          : `path.join(__dirname, 'out', ${JSON.stringify(s)} + '.jsonl')`;
      const refExpr =
        mode === 'partial'
          ? `refSerializeResult(refQuery(refReadJsonl(${logPath}), query))`
          : `refSerializeLog(refReadJsonl(${logPath}))`;
      return [
        '  {',
        `    const ref = ${refExpr};`,
        `    const got = fs.readFileSync(${outPath}, 'utf8');`,
        `    assert.ok(refBytesEq(got, ref), '分片 ${s} 的产物与独立参考不一致：actual=' + JSON.stringify(got.slice(0, 160)) + ' expected=' + JSON.stringify(ref.slice(0, 160)));`,
        '  }',
      ].join('\n');
    })
    .join('\n');
  const artifacts =
    mode === 'partial'
      ? `const actual = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
assert.ok(refBytesEq(actual, expected), '合并结果与 checker 内嵌独立参考逐字节不一致：actual=' + JSON.stringify(actual.slice(0, 200)) + ' expected=' + JSON.stringify(expected.slice(0, 200)));`
      : `const merged = fs.readFileSync(path.join(__dirname, 'merged.jsonl'), 'utf8');
const mergedExpected = refSerializeLog(logs.filter(refValid));
assert.ok(refBytesEq(merged, mergedExpected), 'merged.jsonl 必须与 checker 内嵌独立参考合并结果逐字节一致（Q1：非法 ts 排除；重复 record_id 保留）：actual=' + JSON.stringify(merged.slice(0, 200)) + ' expected=' + JSON.stringify(mergedExpected.slice(0, 200)));
const actual = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
assert.ok(refBytesEq(actual, expected), 'result.json 与 checker 内嵌独立参考查询逐字节不一致：actual=' + JSON.stringify(actual.slice(0, 200)) + ' expected=' + JSON.stringify(expected.slice(0, 200)));`;
  return `const assert = require('assert');
const fs = require('fs');
const path = require('path');
${REF_Q_JS}
const BUDGET_MS = ${budget};
const SHARDS = ${JSON.stringify(shards)};
const tl = path.join(__dirname, 'timeline.jsonl');
assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');
const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
assert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');
const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));
assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
${perShard}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const expected = refSerializeResult(refQuery(logs, query));
${artifacts}
${mode === 'partial' ? C1_EXTRA_ASSERTS : C2_EXTRA_ASSERTS}
console.log('TIMELINE OK shards=' + new Set(entries.map((e) => e.shard)).size + ' span=' + span + 'ms bytes=identical${token ? ' ' + token : ''}');
`;
};

// ---------- D1：三个查询目标 ----------
const D1_PREAMBLE = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const canonical = require('./canonical.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const refOf = (filterExpr) => refQuery(logs, { window: query.window, filter: filterExpr, limit: null });
const refDigest = (filterExpr) => {
  const q = refOf(filterExpr);
  const byService = new Map();
  for (const r of q.records) {
    if (!byService.has(r.service)) byService.set(r.service, { service: r.service, count: 0, sum: 0 });
    const g = byService.get(r.service);
    g.count++;
    if (typeof r.value === 'number') g.sum += r.value;
  }
  return { groups: Array.from(byService.values()).sort((a, b) => (a.service < b.service ? -1 : a.service > b.service ? 1 : 0)), total_records: q.records.length };
};
const refSlowest = () => refOf(query.slowest.filter).records.filter((r) => typeof r.value === 'number').slice().sort((a, b) => (b.value - a.value) || refCmp(a, b)).slice(0, query.slowest.k).map(refFields);
`;

const D1_ERRORS_JS = (sorted: boolean): string => `// error-digest：query.errors.filter 匹配的去重记录按 service 分组（Q4：service 序数升序）
const { isValidRecord, totalOrder } = require('./canonical.js');
const { matches, dedupe } = require('./q-stats.js');
function errorDigest(records, query) {
  const legal = records.filter(isValidRecord);
  const deduped = dedupe(legal);
  const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  const matched = windowed.filter((r) => matches(query.errors.filter, r));
  const byService = new Map();
  for (const r of matched) {
    if (!byService.has(r.service)) byService.set(r.service, { service: r.service, count: 0, sum: 0 });
    const g = byService.get(r.service);
    g.count++;
    if (typeof r.value === 'number') g.sum += r.value;
  }
  const groups = Array.from(byService.values())${sorted ? '.sort((a, b) => (a.service < b.service ? -1 : a.service > b.service ? 1 : 0))' : ''};${sorted ? '' : ' // 缺陷：分组序 = 首次出现序（未按 service 序数升序）'}
  return { groups, total_records: matched.length };
}
module.exports = { errorDigest };
`;

const D1_SLOWEST_JS = (tieBreak: boolean): string => `// slowest-top-K：value 降序，相等时按 Q3 全序升序（tie-break）
const { isValidRecord, totalOrder } = require('./canonical.js');
const { matches, dedupe } = require('./q-stats.js');
const fields = (r) => ({ ts: r.ts, level: r.level, service: r.service, record_id: r.record_id, value: Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null });
function slowest(records, query) {
  const legal = records.filter(isValidRecord);
  const deduped = dedupe(legal);
  const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  const matched = windowed.filter((r) => matches(query.slowest.filter, r)).filter((r) => typeof r.value === 'number');
  const ordered = matched.slice().sort((a, b) => (b.value - a.value)${tieBreak ? ' || totalOrder(a, b)' : ''});${tieBreak ? '' : ' // 缺陷：相等时保留输入顺序（缺少 Q3 全序 tie-break）'}
  return { records: ordered.slice(0, query.slowest.k).map(fields) };
}
module.exports = { slowest };
`;

const D1_REPORT_JS = (legalOnly: boolean): string => `// 统一查询报告：汇总三个结果文件 + 输入规模
const { isValidRecord } = require('./canonical.js');
function buildReport(logs, results) {
  return {
    queries: {
      stats: { count: results.stats.aggregation.count, sum: results.stats.aggregation.sum },
      errors: { groups: results.errors.groups.length, total_records: results.errors.total_records },
      slowest: { records: results.slowest.records.length },
    },
    total_input_records: ${legalOnly ? 'logs.filter(isValidRecord).length' : 'logs.length'},${legalOnly ? '' : ' // 缺陷：非法 ts 记录也被计入 total_input_records'}
  };
}
module.exports = { buildReport };
`;

const D1_RUN_ALL = `// 运行三个查询目标并汇总统一报告
const fs = require('fs');
const path = require('path');
const { serializeResult } = require('./canonical.js');
const { runQuery } = require('./q-stats.js');
const { errorDigest } = require('./q-errors.js');
const { slowest } = require('./q-slowest.js');
const { buildReport } = require('./report.js');
const files = fs.readdirSync(path.join(__dirname, 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const logs = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') logs.push(JSON.parse(line));
}
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
const stats = runQuery(logs, query);
const errors = errorDigest(logs, query);
const slow = slowest(logs, query);
fs.writeFileSync(path.join(__dirname, 'results', 'stats.json'), serializeResult(stats), 'utf8');
fs.writeFileSync(path.join(__dirname, 'results', 'errors.json'), JSON.stringify(errors) + '\\n', 'utf8');
fs.writeFileSync(path.join(__dirname, 'results', 'slowest.json'), JSON.stringify(slow) + '\\n', 'utf8');
fs.writeFileSync(path.join(__dirname, 'query-report.json'), JSON.stringify(buildReport(logs, { stats, errors, slowest: slow })) + '\\n', 'utf8');
console.log('D1 targets written');
`;

const D1_CHECK_STATS = `${D1_PREAMBLE}
const { runQuery } = require('./q-stats.js');
const reference = refSerializeResult(refOf(query.filter));
const delivered = fs.readFileSync(path.join(__dirname, 'results', 'stats.json'), 'utf8');
const inProcess = canonical.serializeResult(runQuery(logs, query));
assert.ok(refBytesEq(inProcess, reference), 'stats-summary 实现必须与独立参考逐字节一致（Q8：字符串形式的数字不是数值）：actual=' + JSON.stringify(inProcess.slice(0, 240)) + ' expected=' + JSON.stringify(reference.slice(0, 240)));
assert.ok(refBytesEq(delivered, reference), 'results/stats.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(delivered.slice(0, 240)) + ' expected=' + JSON.stringify(reference.slice(0, 240)));
assert.strictEqual(runQuery(logs, query).aggregation.sum, refOf(query.filter).aggregation.sum, 'Q8：sum 只能累加数值 value —— actual=' + runQuery(logs, query).aggregation.sum + ' / expected=' + refOf(query.filter).aggregation.sum);
console.log('STATS OK');
`;

const D1_CHECK_ERRORS = `${D1_PREAMBLE}
const { errorDigest } = require('./q-errors.js');
const refDig = refDigest(query.errors.filter);
const reference = JSON.stringify(refDig) + '\\n';
const delivered = fs.readFileSync(path.join(__dirname, 'results', 'errors.json'), 'utf8');
const inProcess = JSON.stringify(errorDigest(logs, query)) + '\\n';
assert.deepStrictEqual(errorDigest(logs, query).groups.map((g) => g.service), refDig.groups.map((g) => g.service), 'Q4：分组必须按 service 序数升序（不是首次出现序）—— actual=' + JSON.stringify(errorDigest(logs, query).groups.map((g) => g.service)) + ' expected=' + JSON.stringify(refDig.groups.map((g) => g.service)));
assert.ok(refBytesEq(inProcess, reference), 'error-digest 实现必须与独立参考逐字节一致：actual=' + JSON.stringify(inProcess) + ' expected=' + JSON.stringify(reference));
assert.ok(refBytesEq(delivered, reference), 'results/errors.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(reference));
console.log('ERRORS OK');
`;

const D1_CHECK_SLOWEST = `${D1_PREAMBLE}
const { slowest } = require('./q-slowest.js');
const reference = JSON.stringify({ records: refSlowest() }) + '\\n';
const delivered = fs.readFileSync(path.join(__dirname, 'results', 'slowest.json'), 'utf8');
const inProcess = JSON.stringify(slowest(logs, query)) + '\\n';
assert.deepStrictEqual(slowest(logs, query).records.map((r) => r.record_id), refSlowest().map((r) => r.record_id), 'Q3/Q6：value 相等时必须按 Q3 真全序 tie-break（ts, record_id, canonical bytes）—— actual=' + JSON.stringify(slowest(logs, query).records.map((r) => r.record_id)) + ' expected=' + JSON.stringify(refSlowest().map((r) => r.record_id)));
assert.ok(refBytesEq(inProcess, reference), 'slowest-top-K 实现必须与独立参考逐字节一致：actual=' + JSON.stringify(inProcess) + ' expected=' + JSON.stringify(reference));
assert.ok(refBytesEq(delivered, reference), 'results/slowest.json 必须与独立参考逐字节一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(reference));
console.log('SLOWEST OK');
`;

const D1_CHECK_REPORT = `${D1_PREAMBLE}
const { buildReport } = require('./report.js');
const stats = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', 'stats.json'), 'utf8'));
const errors = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', 'errors.json'), 'utf8'));
const slow = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', 'slowest.json'), 'utf8'));
const refDig = refDigest(query.errors.filter);
const legal = logs.filter(refValid).length;
const expectedObj = {
  queries: {
    stats: { count: refOf(query.filter).aggregation.count, sum: refOf(query.filter).aggregation.sum },
    errors: { groups: refDig.groups.length, total_records: refDig.total_records },
    slowest: { records: refSlowest().length },
  },
  total_input_records: legal,
};
const reference = JSON.stringify(expectedObj) + '\\n';
const delivered = fs.readFileSync(path.join(__dirname, 'query-report.json'), 'utf8');
const inProcess = JSON.stringify(buildReport(logs, { stats, errors, slowest: slow })) + '\\n';
assert.strictEqual(buildReport(logs, { stats, errors, slowest: slow }).total_input_records, legal, 'Q1：total_input_records 只计合法记录（非法 ts 不计入）—— actual=' + buildReport(logs, { stats, errors, slowest: slow }).total_input_records + ' / expected=' + legal);
assert.ok(refBytesEq(inProcess, reference), '统一报告必须与三个结果文件 + 独立参考一致：actual=' + JSON.stringify(inProcess) + ' expected=' + JSON.stringify(reference));
assert.ok(refBytesEq(delivered, reference), 'query-report.json 必须与独立参考一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(reference));
console.log('REPORT OK');
`;

// ---------- D2：四阶段依赖链（真实 artifact 传递） ----------
const D2_OPS_JS = `// 查询流水线算子（受保护，冻结语义）：合法性 → 去重 → 窗口+谓词 → 聚合 → 全序装配
const { isValidRecord, totalOrder, canonicalRecord } = require('../canonical.js');
${PREDICATE_JS(false, false, false)}
function parseStage(raws) { return raws.filter(isValidRecord); }
function dedupeStage(records) {
  const sorted = records.slice().sort(totalOrder);
  const keepId = new Set();
  const keepRec = new Set();
  for (const r of sorted) {
    if (keepId.has(r.record_id)) continue;
    keepId.add(r.record_id);
    keepRec.add(canonicalRecord(r));
  }
  return records.filter((r) => keepRec.has(canonicalRecord(r)));
}
function filterStage(records, query) {
  const windowed = records.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  return windowed.filter((r) => matches(query.filter, r));
}
function aggregateStage(records) {
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of records) {
    count++;
    const v = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    if (typeof v === 'number') {
      countWithValue++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    }
  }
  return { count, count_with_value: countWithValue, sum, min, max };
}
function assembleStage(matched, aggregation, limit) {
  const ordered = matched.slice().sort(totalOrder);
  const records = (limit === null || limit === undefined) ? ordered : ordered.slice(0, limit);
  return { records, aggregation };
}
module.exports = { parseStage, dedupeStage, filterStage, aggregateStage, assembleStage, matches, tokenize, parseExpr };
`;

const D2_RUN_CHAIN = `// 查询流水线编排：合法性排除 → 去重 → 窗口+谓词+聚合 → 全序+limit；每一步消费上一步的真实产物并记录 sha256
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ops = require('./lib/ops.js');
const { serializeRecords, serializeResult } = require('./canonical.js');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));
const readJsonl = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, p))).digest('hex');
const query = rd('query.json');
fs.mkdirSync(path.join(__dirname, 'stages'), { recursive: true });
const stages = [
  { step: 1, input: 'logs/logs.jsonl', output: 'stages/step1.jsonl', render: () => serializeRecords(ops.parseStage(readJsonl('logs/logs.jsonl'))) },
  { step: 2, input: 'stages/step1.jsonl', output: 'stages/step2.jsonl', render: () => serializeRecords(ops.dedupeStage(readJsonl('stages/step1.jsonl'))) },
  { step: 3, input: 'stages/step2.jsonl', output: 'stages/step3.json', render: () => { const kept = ops.filterStage(readJsonl('stages/step2.jsonl'), query); return serializeResult(ops.assembleStage(kept, ops.aggregateStage(kept), null)); } },
  { step: 4, input: 'stages/step3.json', output: 'result.json', render: () => { const s3 = rd('stages/step3.json'); return serializeResult(ops.assembleStage(s3.records, s3.aggregation, query.limit)); } },
];
const prov = [];
for (const s of stages) {
  const before = sha(s.input);
  fs.writeFileSync(path.join(__dirname, s.output), s.render(), 'utf8');
  const after = sha(s.output);
  prov.push({ step: s.step, input: s.input, input_sha256: before, output: s.output, output_sha256: after });
}
fs.writeFileSync(path.join(__dirname, 'provenance.json'), JSON.stringify(prov, null, 2) + '\\n', 'utf8');
fs.writeFileSync(path.join(__dirname, 'CHAIN.md'), '# 查询链说明\\n查询链：合法性排除 → 去重（保留 Q3 真全序中最早一条）→ 窗口+谓词+聚合 → 全序+limit；每一步消费上一步的真实产物并记录 sha256 溯源。\\n', 'utf8');
console.log('query chain done');
`;

const D2_CHECK_CHAIN = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
${REF_Q_JS}
const abs = (p) => path.normalize(path.isAbsolute(String(p)) ? String(p) : path.join(__dirname, String(p)));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prov = JSON.parse(fs.readFileSync(path.join(__dirname, 'provenance.json'), 'utf8'));
assert.ok(Array.isArray(prov) && prov.length === 4, 'provenance 必须包含四个阶段记录，实际 ' + JSON.stringify(prov && prov.length));
for (let i = 0; i < 4; i++) assert.strictEqual(prov[i].step, i + 1, 'provenance 必须按 step 1..4 排列');
assert.strictEqual(abs(prov[0].input), abs('logs/logs.jsonl'), 'step1 的输入必须是源日志 logs/logs.jsonl，实际 ' + prov[0].input);
for (let i = 1; i < 4; i++) assert.strictEqual(abs(prov[i].input), abs(prov[i - 1].output), 'step' + (i + 1) + ' 的输入必须来自 step' + i + ' 的输出产物（不得跳步或重读源日志）');
for (const p of prov) {
  assert.ok(fs.existsSync(abs(p.input)), 'provenance 声明的输入必须真实存在：' + p.input);
  assert.ok(fs.existsSync(abs(p.output)), 'provenance 声明的输出必须真实存在：' + p.output);
  assert.strictEqual(sha(abs(p.input)), p.input_sha256, 'provenance 记录的输入 sha256 必须与真实文件一致：' + p.input);
  assert.strictEqual(sha(abs(p.output)), p.output_sha256, 'provenance 记录的输出 sha256 必须与真实文件一致：' + p.output);
}
const step1 = refReadJsonl(path.join(__dirname, 'stages', 'step1.jsonl'));
assert.strictEqual(step1.filter((r) => !refValid(r)).length, 0, 'Q1：step1 必须已排除非法 ts 记录');
const step2 = refReadJsonl(path.join(__dirname, 'stages', 'step2.jsonl'));
assert.strictEqual(new Set(step2.map((r) => r.record_id)).size, step2.length, 'Q4-2：step2 的 record_id 必须唯一（已去重）');
const logs = refReadJsonl(path.join(__dirname, 'logs', 'logs.jsonl'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const reference = refQuery(logs, query);
const step3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'stages', 'step3.json'), 'utf8'));
assert.strictEqual(JSON.stringify(step3.aggregation), JSON.stringify(reference.aggregation), 'step3 的聚合必须与独立参考一致：actual=' + JSON.stringify(step3.aggregation) + ' expected=' + JSON.stringify(reference.aggregation));
const actual = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
const expected = refSerializeResult(reference);
assert.ok(refBytesEq(actual, expected), 'result.json 必须与 checker 内嵌独立参考逐字节一致：actual=' + JSON.stringify(actual.slice(0, 200)) + ' expected=' + JSON.stringify(expected.slice(0, 200)));
const dupLogs = logs.filter(refValid).filter((r) => r.record_id === 'r2');
const earliest = dupLogs.slice().sort(refCmp)[0];
const keptDup = step2.filter((r) => r.record_id === 'r2')[0];
assert.strictEqual(refRec(keptDup), refRec(earliest), 'Q3 第三键：去重必须保留 canonical_record_bytes 最早的一条，actual=' + JSON.stringify(refRec(keptDup)) + ' expected=' + JSON.stringify(refRec(earliest)));
console.log('CHAIN OK steps=4 artifacts=verified');
`;

// ---------- E1：排序契约变化（插入序 → Q3 真全序） ----------
const E1_INDEX_JS = (ordered: boolean): string => `// 查询入口（可修改）：result.json 由本入口产出
const { scan, aggregate } = require('./query.js');
${ordered ? "const { orderRecords } = require('./order.js');" : ''}
function runQuery(records, query) {
  const matched = scan(records, query);
  const recordsOut = ${ordered ? 'orderRecords(matched)' : 'matched'};${ordered ? '' : ' // 缺陷：按插入序返回（违反 Q3 真全序）'}
  const aggregation = aggregate(matched);
  const limited = (query.limit === null || query.limit === undefined) ? recordsOut : recordsOut.slice(0, query.limit);
  return { records: limited, aggregation };
}
module.exports = { runQuery };
`;

const E1_ORDER_JS = `// Q3 真全序排序层（新增）：由非保护入口 index.js 装配
const { totalOrder, canonicalRecord } = require('./canonical.js');
function orderRecords(records) { return records.slice().sort(totalOrder); }
module.exports = { orderRecords, totalOrder, canonicalRecord };
`;

const E1_RUN_QUERY = `// 由 index.js 重算 result.json
const fs = require('fs');
const path = require('path');
const { serializeResult } = require('./canonical.js');
const { runQuery } = require('./index.js');
const files = fs.readdirSync(path.join(__dirname, 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const records = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') records.push(JSON.parse(line));
}
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult(runQuery(records, query)), 'utf8');
console.log('result.json 已重算');
`;

const E1_LEGACY_EXPORT = `// legacy 导出（受保护，冻结）：按**插入序**写出 legacy-view.jsonl（既有消费方依赖该顺序）
const fs = require('fs');
const path = require('path');
const { scan } = require(path.join(__dirname, '..', 'query.js'));
const { canonicalRecord } = require(path.join(__dirname, '..', 'canonical.js'));
const files = fs.readdirSync(path.join(__dirname, '..', 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const records = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, '..', 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') records.push(JSON.parse(line));
}
const query = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'query.json'), 'utf8'));
const matched = scan(records, query);
fs.writeFileSync(path.join(__dirname, '..', 'legacy-view.jsonl'), matched.map(canonicalRecord).join('\\n') + (matched.length ? '\\n' : ''), 'utf8');
console.log('legacy-view.jsonl 已写出（插入序）：records=' + matched.length);
`;

const E1_LEGACY_CONSUMER = `// legacy 消费方（受保护，冻结）：逐条回放，并要求文件顺序等于插入序（旧契约）
const fs = require('fs');
const path = require('path');
const { scan } = require(path.join(__dirname, '..', 'query.js'));
function consume(fileText, records, query) {
  const fileIds = fileText.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l).record_id);
  const insertIds = scan(records, query).map((r) => r.record_id);
  if (fileIds.join(',') !== insertIds.join(',')) {
    throw new Error('legacy 契约：legacy-view.jsonl 必须保持插入序 ' + insertIds.join(',') + '，实际 ' + fileIds.join(','));
  }
  return fileIds.length;
}
module.exports = { consume };
`;

const E1_CHECK = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runQuery } = require('./index.js');
const queryImpl = require('./query.js');
const canonical = require('./canonical.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const reference = refSerializeResult(refQuery(logs, query));
const q3Ids = JSON.parse(reference).records.map((r) => r.record_id);
const insertionIds = queryImpl.scan(logs, query).map((r) => r.record_id);
assert.notStrictEqual(insertionIds.join(','), q3Ids.join(','), '本 fixture 的插入序与 Q3 全序必须不同（构造性证据：必须新增排序层），insertion=' + insertionIds.join(',') + ' q3=' + q3Ids.join(','));
const inProcess = canonical.serializeResult(runQuery(logs, query));
assert.ok(refBytesEq(inProcess, reference), '新查询路径必须按 Q3 真全序输出：actual=' + JSON.stringify(inProcess.slice(0, 200)) + ' expected=' + JSON.stringify(reference.slice(0, 200)));
const delivered = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
assert.ok(refBytesEq(delivered, reference), 'result.json 必须与 checker 内嵌独立参考逐字节一致（Q3 真全序）：actual=' + JSON.stringify(delivered.slice(0, 200)) + ' expected=' + JSON.stringify(reference.slice(0, 200)));
const recs = JSON.parse(delivered).records;
const refTie = JSON.parse(reference).records.filter((r) => r.ts === 100).map((r) => r.record_id);
assert.deepStrictEqual(recs.filter((r) => r.ts === 100).map((r) => r.record_id), refTie, 'Q3：ts 相同时必须按 record_id 序数升序（tie-break 必须作用于结果）');
console.log('ORDER OK');
`;

const E1_CHECK_LEGACY = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { consume } = require('./legacy/consumer.js');
const { scan } = require('./query.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const snap = fs.readFileSync(path.join(__dirname, 'snapshots', 'legacy-view.snap'), 'utf8');
const delivered = fs.readFileSync(path.join(__dirname, 'legacy-view.jsonl'), 'utf8');
assert.ok(refBytesEq(delivered, snap), 'legacy 冻结快照：legacy-view.jsonl 必须与 snapshots/legacy-view.snap 逐字节一致');
const n = consume(delivered, logs, query);
assert.strictEqual(n, scan(logs, query).length, 'legacy 消费方必须能完整回放（插入序）');
console.log('LEGACY OK');
`;

// ---------- E2：缺失值不得被默认值修补 ----------
const E2_PIPELINE_JS = `// 共享查询流水线（受保护，冻结）：合法性/去重/窗口/谓词/全序在此；聚合由调用方注入
const { isValidRecord, totalOrder, canonicalRecord } = require('./canonical.js');
${PREDICATE_JS(false, false, false)}
function dedupe(records) {
  const sorted = records.slice().sort(totalOrder);
  const keepId = new Set();
  const keepRec = new Set();
  for (const r of sorted) {
    if (keepId.has(r.record_id)) continue;
    keepId.add(r.record_id);
    keepRec.add(canonicalRecord(r));
  }
  return records.filter((r) => keepRec.has(canonicalRecord(r)));
}
function scan(records, query) {
  const legal = records.filter(isValidRecord);
  const deduped = dedupe(legal);
  const windowed = deduped.filter((r) => r.ts >= query.window.start && r.ts < query.window.end);
  return windowed.filter((r) => matches(query.filter, r));
}
function run(records, query, aggregateFn) {
  const matched = scan(records, query);
  const ordered = matched.slice().sort(totalOrder);
  const recordsOut = (query.limit === null || query.limit === undefined) ? ordered : ordered.slice(0, query.limit);
  return { records: recordsOut, aggregation: aggregateFn(matched) };
}
module.exports = { scan, dedupe, matches, run };
`;

const E2_LEGACY_NORMALIZE_JS = `// legacy 归一化路径（受保护，冻结）：缺失 value 按 defaults[service] 填充（缺省 0）
function normalize(rec, defaults) {
  const has = rec.value !== undefined && rec.value !== null;
  const fallback = Object.prototype.hasOwnProperty.call(defaults, rec.service) ? defaults[rec.service] : 0;
  return { ts: rec.ts, level: rec.level, service: rec.service, record_id: rec.record_id, value: has ? rec.value : fallback };
}
module.exports = { normalize };
`;

const E2_QUERY_JS = (defaultFill: boolean): string => `// 查询装配（可修改）：新查询结果 + legacy 归一化视图
const pipeline = require('./pipeline.js');
const { normalize } = require('./legacy/normalize.js');
const defaults = require('./legacy/defaults.json');
${defaultFill ? '' : "const compat = require('./aggregate-compat.js');\n"}function legacyAggregate(records) {
  const normalized = records.map((r) => normalize(r, defaults));
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of normalized) {
    count++;
    if (typeof r.value === 'number') {
      countWithValue++;
      sum += r.value;
      if (min === null || r.value < min) min = r.value;
      if (max === null || r.value > max) max = r.value;
    }
  }
  return { count, count_with_value: countWithValue, sum, min, max };
}
function runQuery(records, query) {
  return pipeline.run(records, query, ${defaultFill ? 'legacyAggregate' : 'compat.aggregateCompat'});${defaultFill ? ' // 缺陷：新查询结果走了默认值填充路径' : ''}
}
function legacyView(records) {
  return { records: records.filter((r) => typeof r.ts === 'number' && Number.isInteger(r.ts)).map((r) => normalize(r, defaults)) };
}
module.exports = { runQuery, legacyView, legacyAggregate };
`;

const E2_AGG_COMPAT_JS = `// 兼容聚合层（新增）：按 Q2 直接聚合原始记录，缺失/null 不计入 sum 与 count_with_value
function aggregateCompat(records) {
  let count = 0;
  let countWithValue = 0;
  let sum = 0;
  let min = null;
  let max = null;
  for (const r of records) {
    count++;
    const v = Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : null;
    if (typeof v === 'number') {
      countWithValue++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
    }
  }
  return { count, count_with_value: countWithValue, sum, min, max };
}
module.exports = { aggregateCompat };
`;

const E2_LEGACY_VIEW_JS = `// legacy 视图导出（受保护，冻结）：由 query.js 的默认值填充路径生成
const fs = require('fs');
const path = require('path');
const { legacyView } = require('./query.js');
const files = fs.readdirSync(path.join(__dirname, 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const records = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') records.push(JSON.parse(line));
}
fs.writeFileSync(path.join(__dirname, 'legacy-view.json'), JSON.stringify(legacyView(records)) + '\\n', 'utf8');
console.log('legacy-view.json 已写出');
`;

const E2_CHECK_QUERY = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const canonical = require('./canonical.js');
const { runQuery } = require('./query.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
const reference = refQuery(logs, query);
const referenceText = refSerializeResult(reference);
const inProcess = runQuery(logs, query);
assert.strictEqual(inProcess.aggregation.sum, reference.aggregation.sum, 'Q2：缺失/null 的 value 不得被默认值修补 —— actual sum=' + inProcess.aggregation.sum + ' / expected sum=' + reference.aggregation.sum);
assert.strictEqual(inProcess.aggregation.count_with_value, reference.aggregation.count_with_value, 'Q2：count_with_value 只计数值 value —— actual=' + inProcess.aggregation.count_with_value + ' / expected=' + reference.aggregation.count_with_value);
assert.ok(refBytesEq(canonical.serializeResult(inProcess), referenceText), '查询结果必须与 checker 内嵌独立参考逐字节一致：actual=' + JSON.stringify(canonical.serializeResult(inProcess).slice(0, 240)) + ' expected=' + JSON.stringify(referenceText.slice(0, 240)));
const delivered = fs.readFileSync(path.join(__dirname, 'result.json'), 'utf8');
assert.ok(refBytesEq(delivered, referenceText), 'result.json 必须与 checker 内嵌独立参考逐字节一致：actual=' + JSON.stringify(delivered.slice(0, 240)) + ' expected=' + JSON.stringify(referenceText.slice(0, 240)));
console.log('QUERY OK');
`;

const E2_CHECK_LEGACY = `const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { legacyView } = require('./query.js');
const { normalize } = require('./legacy/normalize.js');
${REF_Q_JS}
const logs = refReadLogsDir(path.join(__dirname, 'logs'));
const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'legacy', 'defaults.json'), 'utf8'));
assert.strictEqual(typeof legacyView, 'function', 'legacy 归一化路径必须保留（query.js 必须继续导出 legacyView）');
const refView = JSON.stringify({ records: logs.filter(refValid).map((r) => normalize(r, defaults)) }) + '\\n';
const delivered = fs.readFileSync(path.join(__dirname, 'legacy-view.json'), 'utf8');
const inProcess = JSON.stringify(legacyView(logs)) + '\\n';
assert.ok(refBytesEq(inProcess, refView), 'legacy 视图必须继续由冻结的默认值填充路径生成：actual=' + JSON.stringify(inProcess.slice(0, 240)) + ' expected=' + JSON.stringify(refView.slice(0, 240)));
assert.ok(refBytesEq(delivered, refView), 'legacy-view.json 必须保持默认值填充结果（既有消费方依赖）：actual=' + JSON.stringify(delivered.slice(0, 240)) + ' expected=' + JSON.stringify(refView.slice(0, 240)));
const filled = JSON.parse(delivered).records.filter((r) => r.record_id === 'r2')[0];
assert.strictEqual(filled.value, 30, 'legacy 视图必须保留默认值修补（service=web ⇒ 30），实际 ' + JSON.stringify(filled && filled.value));
console.log('LEGACY OK');
`;

const E2_RUN_JS = `// 由 query.js 重算 result.json
const fs = require('fs');
const path = require('path');
const { serializeResult } = require('./canonical.js');
const { runQuery } = require('./query.js');
const files = fs.readdirSync(path.join(__dirname, 'logs')).filter((f) => f.endsWith('.jsonl')).sort();
const records = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(__dirname, 'logs', f), 'utf8').trim();
  if (text) for (const line of text.split('\\n')) if (line.trim() !== '') records.push(JSON.parse(line));
}
const query = JSON.parse(fs.readFileSync(path.join(__dirname, 'query.json'), 'utf8'));
fs.writeFileSync(path.join(__dirname, 'result.json'), serializeResult(runQuery(records, query)), 'utf8');
console.log('result.json 已重算');
`;

// ---------- 变体参数 ----------
const C_SHARDS = ['shard-a', 'shard-b', 'shard-c'];
const C_BUDGET = 6500;

const D1_RESULT_STUB = '{"records":[],"aggregation":{"count":-1,"count_with_value":0,"sum":0,"min":null,"max":null}}\n';
const D1_ERRORS_STUB = '{"groups":[],"total_records":-1}\n';
const D1_SLOWEST_STUB = '{"records":[]}\n';
const D1_REPORT_STUB = '{"queries":{},"total_input_records":-1}\n';

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F11-A1', category: 'A', variant: 1, token: 'F11-A1 OK',
    title: '单谓词过滤判定取反（level == "error" 结果反转）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-A1 的日志查询把 `level == "error"` 的判定做反了：error 记录被排除、非 error 记录被返回。',
      '修正后运行 node run.js 重算 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check-filter.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r1', value: 10 },
        { ts: 120, level: 'error', service: 'api', record_id: 'r2', value: 20 },
        { ts: 150, level: 'error', service: 'web', record_id: 'r3' },
        { ts: 90, level: 'debug', service: 'api', record_id: 'r4', value: 5 },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'level == "error"', limit: null }),
      'query.js': QUERY_JS({ invertEquality: true }),
      'result.json': RESULT_STUB,
      'run.js': RUN_JS,
      'check-filter.js': CHECK_QUERY_JS(
        [
          'const ids = JSON.parse(delivered).records.map((r) => r.record_id);',
          "assert.deepStrictEqual(ids, ['r2', 'r3'], 'Q4：谓词 level == \"error\" 必须精确匹配 error 记录（大小写敏感精确相等），实际 ' + JSON.stringify(ids));",
        ],
        'FILTER OK',
      ),
      'verify.js': ["require('./check-filter.js');", "console.log('F11-A1 OK');"].join('\n'),
    },
    fix: { 'query.js': QUERY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F11-A1/run.js',
    derive: ['node run.js'],
    derived: ['result.json'],
    required: ['filter_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-filter.js', 'CONTRACT.md', 'canonical.js', 'run.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'filter_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-A1/check-filter.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（谓词比较判定取反），目标文件 query.js 与期望结果由 CONTRACT.md 的 Q4 唯一确定 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（失败定位由 check-filter.js 的断言直接给出）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F11-A2', category: 'A', variant: 2, token: 'F11-A2 OK',
    title: '时间窗口边界归属错误（ts == end 被计入本窗口）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-A2 的日志查询窗口边界归属与 CONTRACT.md 的 Q1 不一致（恰好落在窗口右端点的记录被计入了本次查询）。',
      '修正后运行 node run.js 重算 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check-window.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r1', value: 10 },
        { ts: 199, level: 'info', service: 'api', record_id: 'r2', value: 20 },
        { ts: 200, level: 'info', service: 'api', record_id: 'r3', value: 30 },
        { ts: 201, level: 'info', service: 'api', record_id: 'r4', value: 40 },
      ]),
      'query.json': J({ window: { start: 100, end: 200 }, filter: 'level == "info"', limit: null }),
      'query.js': QUERY_JS({ includeEnd: true }),
      'result.json': RESULT_STUB,
      'run.js': RUN_JS,
      'check-window.js': CHECK_QUERY_JS(
        [
          'const ids = JSON.parse(delivered).records.map((r) => r.record_id);',
          "assert.deepStrictEqual(ids, ['r1', 'r2'], 'Q1：窗口 [100,200) 半开区间 ⇒ ts == 100 计入、ts == 200 不计入；实际 ' + JSON.stringify(ids));",
        ],
        'WINDOW OK',
      ),
      'verify.js': ["require('./check-window.js');", "console.log('F11-A2 OK');"].join('\n'),
    },
    fix: { 'query.js': QUERY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F11-A2/run.js',
    derive: ['node run.js'],
    derived: ['result.json'],
    required: ['window_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-window.js', 'CONTRACT.md', 'canonical.js', 'run.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'window_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-A2/check-window.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（query.js），但「半开区间 [start, end) ⇒ ts == end 不计入」的判定依据写在 CONTRACT.md（Q1）⇒ 先查契约再改与直接修改并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F11-B1', category: 'B', variant: 1, token: 'F11-B1 OK',
    title: '复合谓词优先级反 + 缺失字段被当作匹配',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-B1 的复合过滤表达式结果与 CONTRACT.md 的 Q4 不一致（含 AND/OR/NOT 的表达式返回了错误的记录集）。',
      '修正后运行 node run.js 重算 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check-filter.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 10, level: 'info', service: 'api', record_id: 'r1', value: 5 },
        { ts: 20, level: 'error', service: 'web', record_id: 'r2' },
        { ts: 30, level: 'info', service: 'web', record_id: 'r3', value: 7 },
        { ts: 40, level: 'error', service: 'api', record_id: 'r4' },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'service == "api" OR level == "error" AND NOT value == 5', limit: null }),
      'query.js': QUERY_JS({ orFirst: true, missingMatches: true }),
      'result.json': RESULT_STUB,
      'run.js': RUN_JS,
      'check-filter.js': CHECK_QUERY_JS(
        [
          'const ids = JSON.parse(delivered).records.map((r) => r.record_id);',
          "assert.deepStrictEqual(ids, ['r1', 'r2', 'r4'], 'Q4：NOT > AND > OR（本表达式 = service==\"api\" OR (level==\"error\" AND NOT value==5)），且字段缺失时任何比较为 false；实际 ' + JSON.stringify(ids));",
        ],
        'FILTER OK',
      ),
      'verify.js': ["require('./check-filter.js');", "console.log('F11-B1 OK');"].join('\n'),
    },
    fix: { 'query.js': QUERY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F11-B1/run.js',
    derive: ['node run.js'],
    derived: ['result.json'],
    required: ['filter_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-filter.js', 'CONTRACT.md', 'canonical.js', 'run.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'filter_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-B1/check-filter.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '同一实现内存在两处真实缺陷（AND/OR 优先级反 + 缺失/null 字段被当作匹配），且两处各自的判定依据都写在 CONTRACT.md 的 Q4；check-filter.js 只给出最终记录集差异 ⇒ 需先明确 Q4 语义再定位（两处缺陷各自都改变结果，只改一处仍不通过）⇒ EXPLORE。',
    rationaleNot: 'DIRECT 容易只改一处而留下另一个缺陷；委派类超出必要；REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F11-B2', category: 'B', variant: 2, token: 'F11-B2 OK',
    title: '重复 record_id 去重取错（未保留 Q3 全序最早一条）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-B2 的查询对同一 record_id 的重复投递取用了错误的记录（与 CONTRACT.md 的 Q3/Q4-2 不一致）。',
      '修正后运行 node run.js 重算 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check-dedup.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r1', value: 1 },
        { ts: 100, level: 'warn', service: 'api', record_id: 'r1', value: 2 },
        { ts: 50, level: 'info', service: 'web', record_id: 'r2', value: 5 },
        { ts: 100, level: 'info', service: 'web', record_id: 'r3', value: 3 },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'level == "info"', limit: null }),
      'query.js': QUERY_JS({ keepLastDuplicate: true }),
      'result.json': RESULT_STUB,
      'run.js': RUN_JS,
      'check-dedup.js': CHECK_QUERY_JS(
        [
          'const recs = JSON.parse(delivered).records;',
          "assert.deepStrictEqual(recs.map((r) => r.record_id), ['r2', 'r1', 'r3'], 'Q4-2/Q3：同一 record_id 必须保留 Q3 全序中最早的一条；实际 ' + JSON.stringify(recs.map((r) => r.record_id)));",
          "assert.strictEqual(recs[1].value, 1, 'Q3 第三键（canonical_record_bytes）必须决定 (ts, record_id) 相同记录的取用：保留 level=info/value=1 的那条，实际 value=' + JSON.stringify(recs[1].value));",
        ],
        'DEDUP OK',
      ),
      'verify.js': ["require('./check-dedup.js');", "console.log('F11-B2 OK');"].join('\n'),
    },
    fix: { 'query.js': QUERY_JS() },
    fixRun: 'node pilot-workspace/FORMAL-F11-B2/run.js',
    derive: ['node run.js'],
    derived: ['result.json'],
    required: ['dedup_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-dedup.js', 'CONTRACT.md', 'canonical.js', 'run.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'dedup_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-B2/check-dedup.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '成因在「Q3 真全序（含第三键 canonical_record_bytes）→ 去重取用 → 谓词过滤」的组合语义上，需先确定全序定义才能判断该保留哪一条（check-dedup.js 只断言最终记录集）⇒ EXPLORE。',
    rationaleNot: 'DIRECT 未刻画「全序 + 第三键 + 去重取用」的组合；本变体不是 F08-C2 的跨来源账务去重（对象是单查询内的重复投递，且不涉及预算与并行）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F11-C1', category: 'C', variant: 1, token: 'F11-C1 OK',
    title: '硬预算下的不相交分片并行查询（结果与独立参考逐字节一致）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-C1 需要在**总预算 6500 ms**内完成三个日志分片的查询聚合，最终必须同时成立：',
      '① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<shard>.json 与 timeline.jsonl 记录；',
      '② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '④ 合并后的 result.json 必须与按 CONTRACT.md 冻结语义（Q1–Q8）独立计算的结果**逐字节一致**；',
      '⑤ 写出 REPORT.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、shard-lib.js、query.json、logs/ 与 work/ 下的分片工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(
        C_CLAUSE(C_BUDGET).concat([
          '## 本变体冻结的分片规则（C1）',
          '',
          '- 三个分片按 **service 互不相交**划分：shard-a = api、shard-b = web、shard-c = worker（同一 record_id 不会跨分片出现）；',
          '- 分片工具产出**分片局部结果** `out/<shard>.json`（Q7 canonical 形式）；合并后的 `result.json` = 各分片局部记录的 Q3 真全序 + 各分片聚合的合并；',
          '- 聚合合并规则：count / count_with_value / sum 求和；min / max 在非 null 的分片极值上取极值（全部为 null ⇒ null）。',
        ]),
      ),
      'canonical.js': CANONICAL_JS,
      'shard-lib.js': QUERY_JS(),
      'query.json': J({ window: { start: 0, end: 200 }, filter: 'level == "info" OR level == "error"', limit: null }),
      'logs/shard-a.jsonl': JSONL([
        { ts: 10, level: 'info', service: 'api', record_id: 'r-a1', value: 10 },
        { ts: 240, level: 'error', service: 'api', record_id: 'r-a2', value: 4 },
        { ts: 60, level: 'info', service: 'api', record_id: 'r-a3' },
      ]),
      'logs/shard-b.jsonl': JSONL([
        { ts: 20, level: 'warn', service: 'web', record_id: 'r-b1', value: 20 },
        { ts: 80, level: 'info', service: 'web', record_id: 'r-b2', value: 2 },
        { ts: 130, level: 'error', service: 'web', record_id: 'r-b3', value: 13 },
      ]),
      'logs/shard-c.jsonl': JSONL([
        { ts: 30, level: 'info', service: 'worker', record_id: 'r-c1', value: 30 },
        { ts: 90, level: 'debug', service: 'worker', record_id: 'r-c2', value: 99 },
        { ts: 150, level: 'error', service: 'worker', record_id: 'r-c3' },
      ]),
      'work/shard-a.js': C1_SHARD_TOOL('shard-a', 3500, 'SA-2f81'),
      'work/shard-b.js': C1_SHARD_TOOL('shard-b', 3500, 'SB-77c4'),
      'work/shard-c.js': C1_SHARD_TOOL('shard-c', 3000, 'SC-19e2'),
      'REPORT.md': '# 分片查询汇总\n（待补）\n',
      'check-timeline.js': C_CHECK(C_BUDGET, C_SHARDS, 'partial', null),
      'verify.js': C_CHECK(C_BUDGET, C_SHARDS, 'partial', 'F11-C1 OK'),
    },
    fix: {
      'run-shards.js': C1_RUNNER(C_SHARDS),
      'REPORT.md': '# 分片查询汇总\n三分片并行执行完成；分片局部结果按 Q3 真全序合并，聚合按 count/count_with_value/sum 求和、min/max 取极值合并（与独立参考逐字节一致）。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F11-C1/run-shards.js',
    counterfactual: C1_COUNTERFACTUAL(C_SHARDS),
    budget: C_BUDGET,
    required: ['shards_done', 'timeline_ok', 'result_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'canonical.js', 'shard-lib.js', 'query.json', 'logs/shard-a.jsonl', 'logs/shard-b.jsonl', 'logs/shard-c.jsonl', 'work/shard-a.js', 'work/shard-b.js', 'work/shard-c.js'],
    extraChecks: [
      { id: 'shards_done', kind: 'file_exists', path: 'out/shard-a.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-C1/check-timeline.js' },
      { id: 'result_written', kind: 'file_contains', path: 'result.json', expect: '"aggregation"' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三个分片各自固定耗时（3.5s / 3.5s / 3.0s，串行约 10s）与 6500ms 总预算，且**调度方式不得改变结果**（result.json 与各分片局部结果都必须与 checker 内嵌独立参考逐字节一致）。串行执行无法满足硬预算（verify 直接以「总耗时超预算」拒绝），分片级并行 + 局部结果合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-分片-逐字节等价」结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F11-C2', category: 'C', variant: 2, token: 'F11-C2 OK',
    title: '硬预算下的跨分片全局合并排序（Q3 第三键 tie-break 作用于合并后结果）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-C2 需要在**总预算 6500 ms**内完成三个日志分片的 canonical 化与**跨分片全局合并**，最终必须同时成立：',
      '① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；',
      '② 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '③ merged.jsonl = 全部合法记录（Q1）按 Q3 真全序（含第三键 canonical_record_bytes）的行序，**重复 record_id 必须保留**；',
      '④ result.json 必须与按 Q1–Q8 独立计算的结果**逐字节一致**（含全局去重：保留 Q3 全序最早一条）；',
      '⑤ 写出 REPORT.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、predicate.js、query.json、logs/ 与 work/ 下的分片工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD(
        C_CLAUSE(C_BUDGET).concat([
          '## 本变体冻结的分片规则（C2）',
          '',
          '- 分片按 **record_id 的 hash** 划分（时间戳相互交错，且同一 record_id 可能跨分片重复投递）；',
          '- 分片工具只做 **分片内 canonical 化**（Q5 形式 + 分片内 Q3 全序），**不做**窗口/谓词/去重（这些属于合并后的全局语义）；',
          '- `merged.jsonl` = 合并后全部合法记录按 Q3 真全序的行序（重复 record_id 保留、不得去重）；',
          '- `result.json` = 在合并后的记录集上执行完整流水线（全局去重保留 Q3 全序最早一条 → 窗口 → 谓词 → 聚合 → 全序 → limit）。',
        ]),
      ),
      'canonical.js': CANONICAL_JS,
      'predicate.js': `${PREDICATE_JS(false, false, false)}\nmodule.exports = { matches, tokenize, parseExpr, compareField };\n`,
      'query.json': J({ window: { start: 0, end: 350 }, filter: 'level == "info" OR level == "error"', limit: 4 }),
      'logs/shard-a.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r-dup', value: 1 },
        { ts: 300, level: 'error', service: 'web', record_id: 'r-a1', value: 30 },
        { ts: 50, level: 'info', service: 'db', record_id: 'r-a2', value: 5 },
      ]),
      'logs/shard-b.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r-dup', value: 2 },
        { ts: 150, level: 'warn', service: 'api', record_id: 'r-b1', value: 15 },
        { ts: 400, level: 'info', service: 'db', record_id: 'r-b2' },
      ]),
      'logs/shard-c.jsonl': JSONL([
        { ts: 200, level: 'error', service: 'api', record_id: 'r-c1', value: 20 },
        { ts: '150', level: 'info', service: 'web', record_id: 'r-c2', value: 9 },
        { ts: 250, level: 'info', service: 'api', record_id: 'r-c3', value: 25 },
      ]),
      'work/shard-a.js': C2_SHARD_TOOL('shard-a', 3200, 'MA-5d10'),
      'work/shard-b.js': C2_SHARD_TOOL('shard-b', 3400, 'MB-8c33'),
      'work/shard-c.js': C2_SHARD_TOOL('shard-c', 3000, 'MC-41a7'),
      'REPORT.md': '# 跨分片合并汇总\n（待补）\n',
      'check-timeline.js': C_CHECK(C_BUDGET, C_SHARDS, 'merge', null),
      'verify.js': C_CHECK(C_BUDGET, C_SHARDS, 'merge', 'F11-C2 OK'),
    },
    fix: {
      'run-shards.js': C2_RUNNER(C_SHARDS),
      'REPORT.md': '# 跨分片合并汇总\n三分片并行完成 canonical 化；合并后的日志按 Q3 真全序（含第三键 canonical_record_bytes）排序，查询结果在全局去重后按 Q1–Q8 计算（与独立参考逐字节一致）。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F11-C2/run-shards.js',
    counterfactual: C2_COUNTERFACTUAL(C_SHARDS),
    budget: C_BUDGET,
    required: ['shards_done', 'timeline_ok', 'merged_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'canonical.js', 'predicate.js', 'query.json', 'logs/shard-a.jsonl', 'logs/shard-b.jsonl', 'logs/shard-c.jsonl', 'work/shard-a.js', 'work/shard-b.js', 'work/shard-c.js'],
    extraChecks: [
      { id: 'shards_done', kind: 'file_exists', path: 'out/shard-a.jsonl' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-C2/check-timeline.js' },
      { id: 'merged_written', kind: 'file_contains', path: 'merged.jsonl', expect: 'record_id' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但承担**不同 failure mode**：C1 = 不相交分片的局部结果与预算编排；C2 = **跨分片全局合并/去重/全序**（分片按 record_id hash 交错，含跨分片重复 record_id，其中 (ts, record_id) 相同而 canonical bytes 不同的记录必须由第三键决定全序），checker 断言「分片拼接序 ≠ canonical 全序」且分片内语义由冻结工具固定（失败只能来自合并路径）。同样存在硬预算 + 与独立参考逐字节一致的机械约束 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画「合并-全序-第三键」结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F11-D1', category: 'D', variant: 1, token: 'F11-D1 OK',
    title: '三个独立查询目标各自的缺陷 + 统一报告校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-D1 下的三个查询目标 q-stats.js / q-errors.js / q-slowest.js 的结果都与 CONTRACT.md 的 Q1–Q8 不一致，统一报告 query-report.json 的 total_input_records 也不符合 Q1。',
      '交付 results/stats.json、results/errors.json、results/slowest.json 与 query-report.json；运行 node run-all.js 重算全部产物；node verify.js 必须通过。',
      '不得修改 check-stats.js、check-errors.js、check-slowest.js、check-report.js、verify.js、CONTRACT.md、canonical.js、run-all.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 本变体冻结的三个查询目标（D1）',
        '',
        '1. `stats-summary`（results/stats.json）：在 `query.window` / `query.filter` / `query.limit` 下执行完整流水线（Q1–Q8），输出 Q7 canonical 形式；',
        '2. `error-digest`（results/errors.json）：对象 = `query.errors.filter` 匹配的去重记录，输出 `{"groups":[{"service","count","sum"}],"total_records":n}`；',
        '   分组的顺序 = **service 序数升序**；组内 count 为该组记录条数、sum 只累加数值 value（缺失/null 不计入）；`total_records` = 匹配记录总数；',
        '3. `slowest-top-K`（results/slowest.json）：对象 = `query.slowest.filter` 匹配且 value 为数值的记录，按 ① value **降序** ② 相等时 **Q3 真全序升序** 取前 `query.slowest.k` 条；',
        '   输出 `{"records":[...]}`，records 为 Q5 五字段形式；',
        '4. `query-report.json`：`{"queries":{"stats":{"count","sum"},"errors":{"groups","total_records"},"slowest":{"records"}},"total_input_records":N}`，必须与三个结果文件一致；',
        '   其中 `queries.errors.groups` = 分组数、`queries.slowest.records` = 返回条数，N = 输入日志中**合法记录**条数（Q1：非法 ts 不计入）。',
      ]),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 10, level: 'info', service: 'web', record_id: 'r1', value: 10 },
        { ts: 20, level: 'error', service: 'web', record_id: 'r2', value: '10' },
        { ts: 30, level: 'error', service: 'api', record_id: 'r3', value: 30 },
        { ts: '40', level: 'info', service: 'api', record_id: 'r4', value: 40 },
        { ts: 60, level: 'info', service: 'api', record_id: 'r6', value: 20 },
        { ts: 50, level: 'info', service: 'api', record_id: 'r5', value: 20 },
        { ts: 70, level: 'debug', service: 'db', record_id: 'r7', value: 99 },
      ]),
      'query.json': J({
        window: { start: 0, end: 1000 },
        filter: 'level == "info" OR level == "error"',
        limit: null,
        errors: { filter: 'level == "error"' },
        slowest: { filter: 'level == "info"', k: 3 },
      }),
      'q-stats.js': QUERY_JS({ coerceValue: true }),
      'q-errors.js': D1_ERRORS_JS(false),
      'q-slowest.js': D1_SLOWEST_JS(false),
      'report.js': D1_REPORT_JS(false),
      'run-all.js': D1_RUN_ALL,
      'results/stats.json': D1_RESULT_STUB,
      'results/errors.json': D1_ERRORS_STUB,
      'results/slowest.json': D1_SLOWEST_STUB,
      'query-report.json': D1_REPORT_STUB,
      'check-stats.js': D1_CHECK_STATS,
      'check-errors.js': D1_CHECK_ERRORS,
      'check-slowest.js': D1_CHECK_SLOWEST,
      'check-report.js': D1_CHECK_REPORT,
      'verify.js': [
        "require('./check-stats.js');",
        "require('./check-errors.js');",
        "require('./check-slowest.js');",
        "require('./check-report.js');",
        "console.log('F11-D1 OK');",
      ].join('\n'),
    },
    fix: {
      'q-stats.js': QUERY_JS(),
      'q-errors.js': D1_ERRORS_JS(true),
      'q-slowest.js': D1_SLOWEST_JS(true),
      'report.js': D1_REPORT_JS(true),
    },
    fixRun: 'node pilot-workspace/FORMAL-F11-D1/run-all.js',
    derive: ['node run-all.js'],
    derived: ['results/stats.json', 'results/errors.json', 'results/slowest.json', 'query-report.json'],
    required: ['stats_fixed', 'errors_fixed', 'slowest_fixed', 'report_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-stats.js', 'check-errors.js', 'check-slowest.js', 'check-report.js', 'CONTRACT.md', 'canonical.js', 'run-all.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [
      { id: 'stats_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-D1/check-stats.js' },
      { id: 'errors_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-D1/check-errors.js' },
      { id: 'slowest_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-D1/check-slowest.js' },
      { id: 'report_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-D1/check-report.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个查询目标各自有真实缺陷（Q8 隐式类型转换 / 分组序 / Q3 tie-break）与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验（报告必须与三个结果文件及合法输入规模一致）⇒ 并行/编排有实际收益。',
    rationaleNot: 'DIRECT/EXPLORE 未利用三个目标互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F11-D2', category: 'D', variant: 2, token: 'F11-D2 OK',
    title: '有依赖的查询流水线：合法性 → 去重 → 聚合 → 全序（真实 artifact 传递）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F11-D2 需要按 CONTRACT.md 的阶段依赖完成查询流水线，并交付：',
      '① 各阶段产物 stages/step1.jsonl、stages/step2.jsonl、stages/step3.json；',
      '② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；',
      '③ 最终查询结果 result.json 与阶段说明 CHAIN.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/ops.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 阶段依赖条款（D2）',
        '',
        '1. 查询流水线必须按依赖顺序执行：**合法性排除（Q1）→ 去重（Q4-2，保留 Q3 全序最早一条）→ 窗口 + 谓词 + 聚合（Q2）→ 全序 + limit（Q3/Q6）**；',
        '2. 每一步必须消费上一步的**真实产物文件**（不得跳步或重新读取源日志）；',
        '3. 每一步必须在 `provenance.json` 记录 {step, input, input_sha256, output, output_sha256}，input/output 为相对本目录的路径；',
        '4. `stages/step3.json` 为 Q7 canonical 形式（records 按 Q3 全序、aggregation 按固定字段顺序）；`result.json` = 对 step3 的 records 应用 `query.limit` 后的最终结果（aggregation 不变）。',
      ]),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 10, level: 'info', service: 'api', record_id: 'r1', value: 10 },
        { ts: 20, level: 'error', service: 'web', record_id: 'r2' },
        { ts: '30', level: 'info', service: 'api', record_id: 'r3', value: 30 },
        { ts: 20, level: 'warn', service: 'web', record_id: 'r2', value: 7 },
        { ts: 40, level: 'info', service: 'db', record_id: 'r4', value: 40 },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'level == "info" OR level == "error"', limit: 2 }),
      'lib/ops.js': D2_OPS_JS,
      'check-chain.js': D2_CHECK_CHAIN,
      'CHAIN.md': '# 查询链说明\n（待补）\n',
      'verify.js': ["require('./check-chain.js');", "console.log('F11-D2 OK');"].join('\n'),
    },
    fix: {
      'run-chain.js': D2_RUN_CHAIN,
      'CHAIN.md': '# 查询链说明\n查询链：合法性排除 → 去重（保留 Q3 真全序中最早一条）→ 窗口+谓词+聚合 → 全序+limit；每一步消费上一步的真实产物并记录 sha256 溯源。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F11-D2/run-chain.js',
    required: ['chain_provenance', 'chain_ok', 'result_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-chain.js', 'CONTRACT.md', 'canonical.js', 'lib/ops.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [
      { id: 'chain_provenance', kind: 'file_exists', path: 'provenance.json' },
      { id: 'chain_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F11-D2/check-chain.js' },
      { id: 'result_written', kind: 'file_contains', path: 'result.json', expect: '"aggregation"' },
    ],
    expected: ['WORKFLOW'], expectedDelegation: true,
    rationaleGt: '四个阶段存在真实数据依赖（非法 ts 必须在最前排除、去重必须保留 Q3 全序最早一条（含第三键）、聚合只能发生在窗口+谓词之后、limit 只能作用于 Q3 全序），且 checker 断言 step 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致）⇒ 阶段化编排由任务结构本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段依赖与产物传递结构；DELEGATE 单路不足（D 类等价集）；PARALLEL 无依据（四阶段严格串行依赖）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F11-E1', category: 'E', variant: 1, token: 'F11-E1 OK',
    title: '排序契约变化：插入序 → Q3 真全序（已上线查询与 legacy 快照冻结）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F11-E1 的 result.json 仍按**插入序**返回记录，而新契约（CONTRACT.md 的 Q3）要求真全序 `(ts asc, record_id 序数升序, canonical_record_bytes 升序)`。',
      'query.js 已上线且与 legacy 导出链、冻结快照绑定，均不得修改；请新增排序层 order.js 并由非保护入口 index.js 装配，运行 node run-query.js 重新生成 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check.js、check-legacy.js、CONTRACT.md、canonical.js、query.js、run-query.js、legacy/、snapshots/、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 排序契约条款（E1）',
        '',
        '1. `result.json` 的 `records` 必须按 Q3 **真全序**（ts asc → record_id 序数升序 → canonical_record_bytes 逐字节升序）；',
        '2. 既有 legacy 导出 `legacy-view.jsonl` 必须保持**插入序**（legacy 消费方按文件顺序逐条回放），并与冻结快照 `snapshots/legacy-view.snap` 逐字节一致；',
        '3. `query.js` 为**已上线实现**（受保护、按插入序返回匹配记录），`legacy/export.js` 依赖它；只有非保护入口 `index.js` 可以修改。',
      ]),
      'canonical.js': CANONICAL_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 100, level: 'info', service: 'api', record_id: 'r-b', value: 1 },
        { ts: 100, level: 'info', service: 'api', record_id: 'r-a', value: 2 },
        { ts: 50, level: 'error', service: 'web', record_id: 'r-c', value: 3 },
        { ts: 100, level: 'info', service: 'web', record_id: 'r-d', value: 4 },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'level == "info"', limit: null }),
      'query.js': QUERY_JS({ insertionOrder: true }),
      'index.js': E1_INDEX_JS(false),
      'run-query.js': E1_RUN_QUERY,
      'legacy/export.js': E1_LEGACY_EXPORT,
      'legacy/consumer.js': E1_LEGACY_CONSUMER,
      'legacy-view.jsonl': '{}\n',
      'snapshots/legacy-view.snap': '{}\n',
      'result.json': RESULT_STUB,
      'check.js': E1_CHECK,
      'check-legacy.js': E1_CHECK_LEGACY,
      'verify.js': ["require('./check-legacy.js');", "require('./check.js');", "console.log('F11-E1 OK');"].join('\n'),
    },
    fix: { 'order.js': E1_ORDER_JS, 'index.js': E1_INDEX_JS(true) },
    fixRun: 'node pilot-workspace/FORMAL-F11-E1/run-query.js',
    derive: ['node legacy/export.js', 'node run-query.js'],
    derived: ['legacy-view.jsonl', 'result.json'],
    deriveCopy: [['legacy-view.jsonl', 'snapshots/legacy-view.snap']],
    preRun: { command: 'node pilot-workspace/FORMAL-F11-E1/check.js', log: 'pilot-workspace/FORMAL-F11-E1/attempt-log.txt' },
    required: ['order_path_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check.js', 'check-legacy.js', 'CONTRACT.md', 'canonical.js', 'query.js', 'run-query.js', 'legacy/export.js', 'legacy/consumer.js', 'snapshots/legacy-view.snap', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'order_path_added', kind: 'file_exists', path: 'order.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '现状把「插入序」当作结果顺序：query.js（已上线）按插入序返回匹配记录、legacy 导出与冻结快照依赖该顺序，而新契约要求 result.json 按 Q3 真全序（ts, record_id, canonical bytes）；query.js 与 legacy 链冻结、check.js 不得修改 ⇒ 局部改参无法同时满足两条契约，必须新增排序层并重新装配非保护入口（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件（query.js / legacy 链）；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F11-E2', category: 'E', variant: 2, token: 'F11-E2 OK',
    title: '缺失值被默认值修补：新契约禁止 default-fill 聚合（共享流水线冻结）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F11-E2 的 result.json 聚合把**缺失 value 的记录按 legacy 默认值修补**后计入，而新契约（CONTRACT.md 的 Q2）要求缺失/null 不得计入 sum 与 count_with_value；同时 legacy 视图必须继续由冻结的默认值填充路径生成。',
      'pipeline.js 与 legacy/ 不得修改；请新增兼容聚合层 aggregate-compat.js 并调整非保护装配 query.js，运行 node run.js 重新生成 result.json，使 node verify.js 通过。',
      '不得修改 verify.js、check-query.js、check-legacy.js、CONTRACT.md、canonical.js、pipeline.js、legacy/、legacy-view.js、query.json 与 logs/。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_MD([
        '## 兼容条款（E2，优先于可修改实现）',
        '',
        '1. `result.json` 的聚合必须严格按 Q2：缺失/null 的 `value` **不得**被默认值修补，不计入 `sum` 与 `count_with_value`；',
        '2. legacy 视图 `legacy-view.json` 必须继续由冻结的 `legacy/normalize.js`（按 `legacy/defaults.json` 的 service → 默认值）生成，二者并存；',
        '3. `pipeline.js`（共享流水线，聚合由调用方注入）、`legacy/normalize.js`、`legacy/defaults.json`、`legacy-view.js` 均不得修改；',
        '4. 既有消费方仍要求 legacy 视图保留默认值修补（缺失 value 的记录在 legacy 视图中必须被填充）。',
      ]),
      'canonical.js': CANONICAL_JS,
      'pipeline.js': E2_PIPELINE_JS,
      'legacy/normalize.js': E2_LEGACY_NORMALIZE_JS,
      'legacy/defaults.json': J({ web: 30 }),
      'query.js': E2_QUERY_JS(true),
      'legacy-view.js': E2_LEGACY_VIEW_JS,
      'run.js': E2_RUN_JS,
      'logs/logs.jsonl': JSONL([
        { ts: 10, level: 'info', service: 'api', record_id: 'r1', value: 100 },
        { ts: 20, level: 'info', service: 'web', record_id: 'r2' },
        { ts: 30, level: 'info', service: 'api', record_id: 'r3', value: 0 },
      ]),
      'query.json': J({ window: { start: 0, end: 1000 }, filter: 'level == "info"', limit: null }),
      'legacy-view.json': '{}\n',
      'result.json': RESULT_STUB,
      'check-query.js': E2_CHECK_QUERY,
      'check-legacy.js': E2_CHECK_LEGACY,
      'verify.js': ["require('./check-query.js');", "require('./check-legacy.js');", "console.log('F11-E2 OK');"].join('\n'),
    },
    fix: { 'aggregate-compat.js': E2_AGG_COMPAT_JS, 'query.js': E2_QUERY_JS(false) },
    fixRun: 'node pilot-workspace/FORMAL-F11-E2/run.js',
    derive: ['node legacy-view.js', 'node run.js'],
    derived: ['legacy-view.json', 'result.json'],
    preRun: { command: 'node pilot-workspace/FORMAL-F11-E2/check-query.js', log: 'pilot-workspace/FORMAL-F11-E2/attempt-log.txt' },
    required: ['compat_layer_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-query.js', 'check-legacy.js', 'CONTRACT.md', 'canonical.js', 'pipeline.js', 'legacy/normalize.js', 'legacy/defaults.json', 'legacy-view.js', 'query.json', 'logs/logs.jsonl'],
    extraChecks: [{ id: 'compat_layer_added', kind: 'file_exists', path: 'aggregate-compat.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '既有默认值填充路径（legacy/normalize.js + legacy/defaults.json）被冻结且 legacy 视图依赖它，而新契约要求缺失 value **不得**被默认值修补（Q2）；共享流水线 pipeline.js 冻结且聚合由调用方注入 ⇒ 无法就地修改聚合语义，必须新增不依赖默认值填充的兼容聚合层并重新装配非保护入口（计划层重规划）⇒ REPLAN；真实预跑给出业务差异（actual sum=130 / expected sum=100）。',
    rationaleNot: 'DIRECT 指向受保护文件（pipeline.js / legacy 链）；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是 F10-E2 的迁移幂等、也不是 F09-E2 的权威源模式；VERIFY 与委派类不适用。',
  }),
];

// ---------- 起草期（0）：用**未修复**的初始实现真实生成初始产物（使初始状态自洽但违反契约） ----------
const DERIVE = path.join(ROOT, 'pilot-workspace', '.f11-derive');
rmSync(DERIVE, { recursive: true, force: true });
for (const v of variants) {
  if (!v.derive || v.derive.length === 0) continue;
  const dir = path.join(DERIVE, v.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(DERIVE), { recursive: true });
  writeFileSync(path.join(DERIVE, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
  for (const [rel, content] of Object.entries(v.files)) {
    const p = path.join(dir, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  for (const cmd of v.derive) {
    const script = path.join(dir, cmd.split(' ')[1]!);
    const r = runScriptCapture(dir, script);
    console.log('  ' + v.id + ' 初始产物派生（未修复态）：' + cmd + ' → exit=' + String(r.code));
    if (r.code !== 0) console.log('      stdout=' + JSON.stringify(r.stdout.trim().slice(0, 240)) + ' stderr=' + JSON.stringify(r.stderr.trim().slice(0, 240)));
  }
  for (const rel of v.derived ?? []) v.files[rel] = readFileSync(path.join(dir, rel), 'utf8');
  for (const [from, to] of v.deriveCopy ?? []) v.files[to] = readFileSync(path.join(dir, from), 'utf8');
}
rmSync(DERIVE, { recursive: true, force: true });

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const cfEvidence: Array<{ id: string; span: number | null; budget: number; verifyExit: number | null; rejected: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f11-evidence');
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
  // —— C 类反事实：同一批 fixture / 同一批分片 / 同一预算，仅把调度改为串行 ——
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
  `/**\n * benchmark/formal-seeds-f11.ts — F11 族 10 个变体的种子（由 scripts/formal-author-f11.ts 生成）\n */\nexport const FORMAL_F11_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f11.json');
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
  for (const v of variants) {
    if (!v.preRun) continue;
    const script = path.join(ROOT, v.preRun.command.split(' ')[1]!);
    const oT = path.join(ROOT, 'pilot-workspace', '.f11-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f11-pre-' + v.id + '.err');
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
    const errText = readFileSync(eT, 'utf8').trim();
    const outText = readFileSync(oT, 'utf8').trim();
    const errLines = (errText || outText).split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const picked =
      errLines.find((l) => /AssertionError \[ERR_ASSERTION\]|AssertionError:/.test(l)) ??
      errLines.find((l) => /Error:.*\S/.test(l) && !/^(throw|\^)/.test(l)) ??
      errLines.find((l) => /actual|expected/i.test(l)) ??
      errLines.slice(0, 3).join(' ⏎ ');
    preExcerpt.set(v.id, picked.slice(0, 320));
    rmSync(oT, { force: true });
    rmSync(eT, { force: true });
    preExit.set(v.id, code);
    console.log('  预跑 ' + v.id + '：' + v.preRun.command + ' → exit=' + String(code));
  }
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F11', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F11) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F11', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F11', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F11 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> **领域边界**：F11 只研究「日志记录 → 聚合 → 过滤 → 排序 → 查询结果」。',
  '> 一句话边界：`F04 = event → state`（状态发生了什么变化）；`F11 = log → query result`（对一组已发生记录的确定性查询结果）。',
  '> F11 明确不研究：状态机 / event replay / transition correctness（F04）· HTTP / middleware（F03）· schema migration（F10）·',
  '> template rendering / snapshot（F09）· cache / lockfile（F05、F07）· deployment / rollback（F12）· 配额 / 记账（F08）。',
  '> **边界声明（每变体 CONTRACT 顶部同款）**：F11 查询不得修改状态、不得重放事件以产生状态变化，也不得以状态转移结果作为查询正确性的判定依据。',
  '> 与既有族的跨族区分：F08-C2 = 跨来源账务去重的全局幂等（对象：用量/额度）；F11-B2 = 单查询内重复投递去重（对象：日志记录）。',
  '> F10-E2 = migration 重复执行无副作用（对象：schema 迁移）；F11-E2 = 缺失值不得被默认值修补（对象：聚合语义）。',
  '> F09-E2 = 模板源 → 渲染快照（权威源模式）；F11 不再做第三份「权威源 vs 派生物」变体。',
  '> 契约：Q1–Q8 逐变体写死在 CONTRACT.md；结果一律 canonical 序列化（固定字段顺序 + UTF-8 + 结尾 LF + 逐字节比较）；Q3 为真全序（第三键 = canonical_record_bytes）。',
  '> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed（LOCKED）。',
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
    '## C 类反事实证明（同 fixture / 同分片集合 / 同单分片耗时 / 同预算，仅改调度）',
    '',
    '| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |',
    '|---|---|---|---|---|',
    ...cfEvidence.map((c) => `| ${c.id} | ${String(c.span)} ms | ${c.budget} ms | ${String(c.verifyExit)} | ${c.rejected ? '✓（命中「总耗时超预算」）' : '⚠️'} |`),
    '',
    '> 串行反事实与正式证据使用同一批分片工具、同一批分片数据与同一预算，唯一差异是调度方式；',
    '> 正式证据另要求各分片产物与合并产物都与 checker 内嵌**独立参考实现**逐字节一致（C1：分片互不相交 + 局部聚合合并；C2：跨分片全局合并 + Q3 第三键 tie-break + 去重取用）。',
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
    `**验证证据**：node verify.js ${String(ne.before)} → ${String(ne.after)}；verifyTask ${String(vt.beforeOk)} → ${String(vt.afterOk)}（status=${vt.status}，CONFIG_ERROR=${vt.cfg}）${v.preRun ? `；交付前真实预跑 ${v.preRun.command} → exit=${String(preExit.get(v.id))}` : ''}`, '',
    ...(v.preRun ? [`**E 类真实预跑断言（原文摘录）**：\`${preExcerpt.get(v.id) ?? ''}\``, ''] : []),
    ...(cf ? [`**C 类反事实**：串行 span=${String(cf.span)} ms > 预算 ${cf.budget} ms；串行 verify exit=${String(cf.verifyExit)}，${cf.rejected ? '被 verify 以「总耗时超预算」拒绝' : '未被拒绝（异常）'}。`, ''] : []),
    `**为什么这些 first_decision 属于 GT**：${v.rationaleGt}`, '',
    `**为什么其他候选不属于 GT**：${v.rationaleNot}`, '',
    `**签署**：\`gt_signed_by: ________\`　\`gt_signed_at: ________\``, '',
  );
}
writeFileSync(REVIEW, md.join('\n'), 'utf8');

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f11.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(VERSION, {
  dataset: 'formal', family: 'F11', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
const cfgTotal = vtEvidence.reduce((a, e) => a + e.cfg, 0);
const preOk = vtEvidence.filter((e) => e.pre !== undefined && e.pre !== 'exit=0').length;
const preDeclared = vtEvidence.filter((e) => e.pre !== undefined).length;
const cfOk = cfEvidence.filter((c) => c.rejected).length;
console.log('\n=== F11 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${cfgTotal}；success=null 总数 = ${vtEvidence.filter((e) => e.beforeOk === null || e.afterOk === null).length}`);
console.log(`  E 类真实预跑    = ${preOk}/${preDeclared} 以非 0 退出`);
console.log(`  C 类反事实      = ${cfOk}/${cfEvidence.length} 被 verify 以「超预算」拒绝`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F11-*.yaml · formal-seeds-f11.ts · f11-review.md · f11-gt-drafts.json · f11-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length && cfgTotal === 0 && preOk === preDeclared && cfOk === cfEvidence.length;
console.log(allOk ? '✅ F11 起草 + 三层证据全部通过（等待人工逐条构念审查与签署；本轮不签署/不冻结/不 commit）' : '⛔ 存在问题，见 f11-review.md');
process.exit(allOk ? 0 : 3);
