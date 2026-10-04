/**
 * scripts/formal-author-f08.ts — F08 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01–F07 不同）：**配额 / 限流与用量记账**
 *   quota → 多层限制(min) → 窗口过滤 → 幂等记账 → ledger → 展示派生 → 对账
 * 冻结语义（见 f08-draft-spec.md）：S1 额度计算 / S2 fixed window [start,end) /
 *   S3 并发原子性 / S4 effective=min + reject_layer / S5 幂等 / S6 canonical 对账
 * 纪律同前：只产出 draft；三层证据；E 类真实预跑；prompt 不含 first-decision 提示。
 * 用法：node scripts/formal-author-f08.ts
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f08.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f08-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f08-gt-drafts.json');

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

const CONTRACT_S = (win: string, note: string) =>
  [
    '# 配额与记账契约',
    '',
    'S1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。',
    'S2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。',
    'S3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。',
    'S4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；',
    '   拒绝时必须给出 reject_layer（导致超出的具体层级）。',
    'S5 幂等记账：同一 request_id 重放不得重复扣减。',
    'S6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。',
    '',
    '本任务窗口参数：' + win,
    note,
    '',
  ].join('\n');

const quotaJson = (g: number, t: number, u: number, e: number) =>
  JSON.stringify({ global: g, tenant: t, user: u, endpoint: e }, null, 2) + '\n';
const usageJsonl = (rows: Array<Record<string, unknown>>) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

// ---------- 公共：正确账户实现（canonical used） ----------
const ACCOUNT_OK =
  "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "function readUsage(dir) {\n" +
  "  const p = path.join(dir, 'usage.jsonl');\n" +
  "  if (!fs.existsSync(p)) return [];\n" +
  "  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "}\n" +
  "function canonicalUsed(records, winStart, winEnd) {\n" +
  "  const seen = new Set();\n" +
  "  let used = 0;\n" +
  "  for (const r of records) {\n" +
  "    if (seen.has(r.request_id)) continue;\n" +
  "    seen.add(r.request_id);\n" +
  "    if (r.ts < winStart || r.ts >= winEnd) continue;\n" +
  "    used += Number(r.cost);\n" +
  "  }\n" +
  "  return used;\n" +
  "}\n" +
  "module.exports = { readUsage, canonicalUsed };\n";

// ---------- C 类：来源工具 + 并行编排 + 纯读取检查器 ----------
const C_SOURCE_TOOL = (src: string, dur: number, token: string) =>
  "// 用量来源汇总工具：对本来源记录做去重 + 窗口过滤 + 分组求和，记录时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const SRC = " + JSON.stringify(src) + ";\n" +
  "const DUR = " + dur + ";\n" +
  "const TOKEN = " + JSON.stringify(token) + ";\n" +
  "const WIN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'window.json'), 'utf8'));\n" +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const start = Date.now();\n" +
  "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n" +
  "const records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "const seen = new Set();\n" +
  "const groups = {};\n" +
  "let accepted = 0;\n" +
  "for (const r of records) {\n" +
  "  if (seen.has(r.request_id)) continue;\n" +
  "  seen.add(r.request_id);\n" +
  "  if (r.ts < WIN.start || r.ts >= WIN.end) continue;\n" +
  "  const key = r.tenant + '/' + r.endpoint;\n" +
  "  groups[key] = (groups[key] || 0) + Number(r.cost);\n" +
  "  accepted += Number(r.cost);\n" +
  "}\n" +
  "const end = Date.now();\n" +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, accepted, count: records.length }) + '\\n');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, groups, accepted }, null, 2) + '\\n');\n" +
  "console.log(SRC + ' done in ' + (end - start) + 'ms accepted=' + accepted);\n";

const RUN_SOURCES = (srcs: string[]) =>
  "// 并行编排：并发汇总各用量来源，随后按 S6 canonical 规则生成 ledger.json\n" +
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
  "  const groups = {};\n" +
  "  let used = 0;\n" +
  "  for (const s of sources) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')); for (const [k, v] of Object.entries(frag.groups)) groups[k] = (groups[k] || 0) + v; used += frag.accepted; }\n" +
  "  const quota = JSON.parse(fs.readFileSync(path.join(__dirname, 'quota.json'), 'utf8'));\n" +
  "  const sortedGroups = Object.fromEntries(Object.keys(groups).sort().map((k) => [k, groups[k]]));\n" +
  "  fs.writeFileSync(path.join(__dirname, 'ledger.json'), JSON.stringify({ quota, used, groups: sortedGroups, sources: sources.slice().sort() }, null, 2) + '\\n');\n" +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各用量来源并行汇总，账本按 canonical 规则生成。\\n');\n" +
  "  console.log('parallel usage aggregation done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

/** 纯读取检查器：内嵌**独立**参考实现（不引用被测 account.js / limiter.js） */
const CHECK_TIMELINE_LEDGER = (budget: number, srcs: string[]) =>
  "// 纯读取检查器：验证已发生的并行汇总 + 账务 canonical 等价（不执行任何来源工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "// ---- 独立参考实现（S6 canonical；与任务实现无共享代码）----\n" +
  "const REF = (function () {\n" +
  "  function canonicalUsed(records, start, end) {\n" +
  "    const seen = {};\n" +
  "    let used = 0;\n" +
  "    for (const r of records) {\n" +
  "      if (seen[r.request_id]) continue;\n" +
  "      seen[r.request_id] = true;\n" +
  "      if (r.ts < start || r.ts >= end) continue;\n" +
  "      used += Number(r.cost);\n" +
  "    }\n" +
  "    return used;\n" +
  "  }\n" +
  "  function groups(records, start, end) {\n" +
  "    const seen = {};\n" +
  "    const g = {};\n" +
  "    for (const r of records) {\n" +
  "      if (seen[r.request_id]) continue;\n" +
  "      seen[r.request_id] = true;\n" +
  "      if (r.ts < start || r.ts >= end) continue;\n" +
  "      const k = r.tenant + '/' + r.endpoint;\n" +
  "      g[k] = (g[k] || 0) + Number(r.cost);\n" +
  "    }\n" +
  "    return Object.fromEntries(Object.keys(g).sort().map((k) => [k, g[k]]));\n" +
  "  }\n" +
  "  return { canonicalUsed, groups };\n" +
  "})();\n" +
  "const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "const win = JSON.parse(fs.readFileSync(path.join(__dirname, 'window.json'), 'utf8'));\n" +
  "const all = [];\n" +
  "for (const s of SOURCES) { const p = path.join(__dirname, 'usage', s + '.jsonl'); const rs = fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); for (const r of rs) all.push(r); }\n" +
  "const refUsed = REF.canonicalUsed(all, win.start, win.end);\n" +
  "const refGroups = REF.groups(all, win.start, win.end);\n" +
  "const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\n" +
  "assert.strictEqual(ledger.used, refUsed, 'ledger.used 与独立参考不一致：' + ledger.used + ' vs ' + refUsed);\n" +
  "assert.deepStrictEqual(canon(ledger.groups), canon(refGroups), 'ledger 分组与独立参考不一致');\n" +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('LEDGER OK sources=' + SOURCES.length + ' span=' + span + 'ms used=' + refUsed + ' canonical=equivalent');\n";

const C_VERIFY = (budget: number, srcs: string[], token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\n" +
  "assert.ok(typeof ledger.used === 'number' && ledger.used > 0, 'ledger.used 非法');\n" +
  "assert.ok(ledger.quota && typeof ledger.quota === 'object', 'ledger.quota 缺失');\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

const C1_SRCS = ['src-a', 'src-b', 'src-c'];
const C2_SRCS = ['src-x', 'src-y', 'src-z'];
const WINDOW = JSON.stringify({ start: 0, end: 1000 }, null, 2) + '\n';

// ---------- C2 专用：跨来源重叠分片（全局幂等） ----------
const C2_SOURCE_TOOL = (src: string, dur: number, token: string) =>
  "// 分片汇总工具：输出本来源**原始记录**（去重留待全局）+ 局部去重后的朴素值，记录时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'const SRC = ' + JSON.stringify(src) + ';\n' +
  'const DUR = ' + dur + ';\n' +
  'const TOKEN = ' + JSON.stringify(token) + ';\n' +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const WIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'window.json'), 'utf8'));\n" +
  'const start = Date.now();\n' +
  'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n' +
  "const records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  'const stamped = records.map((r) => Object.assign({}, r, { source: SRC }));\n' +
  'const within = stamped.filter((r) => r.ts >= WIN.start && r.ts < WIN.end);\n' +
  'const localSeen = new Set();\n' +
  'let naive = 0;\n' +
  'for (const r of within) { if (localSeen.has(r.request_id)) continue; localSeen.add(r.request_id); naive += Number(r.cost); }\n' +
  'const end = Date.now();\n' +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, naiveAccepted: naive, count: within.length }) + '\\n');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, records: within, naiveAccepted: naive }, null, 2) + '\\n');\n" +
  "console.log(SRC + ' done in ' + (end - start) + 'ms naiveAccepted=' + naive);\n";

// 全局幂等合并（参考修复）：跨来源去重（ts 最小者优先；ts 相同取来源名序最小者）→ 窗口过滤 → 分组求和
const RUN_SOURCES_GLOBAL = (srcs: string[]) =>
  "// 并行编排：并发汇总各分片，随后按**全局幂等**规则生成 ledger.json\n" +
  "const { spawn } = require('child_process');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'const sources = ' + JSON.stringify(srcs) + ';\n' +
  'function runOne(s) {\n' +
  '  return new Promise((resolve, reject) => {\n' +
  "    const c = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });\n" +
  "    c.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));\n" +
  "    c.on('exit', (code, sig) => (code === 0 ? resolve() : reject(new Error(s + ' exit=' + code + ' signal=' + sig))));\n" +
  '  });\n' +
  '}\n' +
  'Promise.all(sources.map(runOne)).then(() => {\n' +
  '  const all = [];\n' +
  '  for (const s of sources) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, \'out\', s + \'.json\'), \'utf8\')); for (const r of frag.records) all.push(r); }\n' +
  '  const best = {};\n' +
  '  for (const r of all) { const p = best[r.request_id]; if (!p || r.ts < p.ts || (r.ts === p.ts && String(r.source) < String(p.source))) best[r.request_id] = r; }\n' +
  '  const win = JSON.parse(fs.readFileSync(path.join(__dirname, \'window.json\'), \'utf8\'));\n' +
  '  let used = 0; const groups = {};\n' +
  '  for (const r of Object.keys(best).map((k) => best[k])) { if (r.ts < win.start || r.ts >= win.end) continue; used += Number(r.cost); const key = r.tenant + \'/\' + r.endpoint; groups[key] = (groups[key] || 0) + Number(r.cost); }\n' +
  '  const quota = JSON.parse(fs.readFileSync(path.join(__dirname, \'quota.json\'), \'utf8\'));\n' +
  '  const sortedGroups = Object.fromEntries(Object.keys(groups).sort().map((k) => [k, groups[k]]));\n' +
  '  fs.writeFileSync(path.join(__dirname, \'ledger.json\'), JSON.stringify({ quota, used, groups: sortedGroups, sources: sources.slice().sort() }, null, 2) + \'\\n\');\n' +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：各分片并行汇总后按全局幂等规则合并到账本。\\n');\n" +
  "  console.log('parallel shard aggregation done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

// 纯读取检查器：内嵌**独立**参考（全局去重），并证明"局部去重不足"
const CHECK_TIMELINE_GLOBAL = (budget: number, srcs: string[]) =>
  "// 纯读取检查器：验证已发生的并行分片汇总 + 全局幂等等价（不执行任何分片工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "// ---- 独立参考实现（全局幂等；与任务实现、account.js 均无共享代码）----\n" +
  'function refCanonical(records, start, end) {\n' +
  '  const best = {};\n' +
  '  for (const r of records) { const p = best[r.request_id]; if (!p || r.ts < p.ts || (r.ts === p.ts && String(r.source) < String(p.source))) best[r.request_id] = r; }\n' +
  '  let used = 0; const groups = {};\n' +
  '  for (const k of Object.keys(best)) { const r = best[k]; if (r.ts < start || r.ts >= end) continue; used += Number(r.cost); const key = r.tenant + \'/\' + r.endpoint; groups[key] = (groups[key] || 0) + Number(r.cost); }\n' +
  '  return { used, groups: Object.fromEntries(Object.keys(groups).sort().map((k) => [k, groups[k]])) };\n' +
  '}\n' +
  'const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === \'object\' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\n' +
  'const BUDGET_MS = ' + budget + ';\n' +
  'const SOURCES = ' + JSON.stringify(srcs) + ';\n' +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 分片数不符');\n" +
  'const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n' +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "const win = JSON.parse(fs.readFileSync(path.join(__dirname, 'window.json'), 'utf8'));\n" +
  'const all = []; const naiveTotal = (function () { let n = 0; for (const s of SOURCES) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, \'out\', s + \'.json\'), \'utf8\')); for (const r of frag.records) all.push(r); n += frag.naiveAccepted; } return n; })();\n' +
  'const ref = refCanonical(all, win.start, win.end);\n' +
  "const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\n" +
  "assert.strictEqual(ledger.used, ref.used, 'ledger.used 与全局幂等参考不一致：' + ledger.used + ' vs ' + ref.used);\n" +
  "assert.deepStrictEqual(canon(ledger.groups), canon(ref.groups), 'ledger 分组与全局幂等参考不一致');\n" +
  "assert.notStrictEqual(naiveTotal, ref.used, '本 fixture 必须使局部去重与全局幂等结果不同（否则失去区分力）');\n" +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('GLOBAL IDEMPOTENCY OK shards=' + SOURCES.length + ' span=' + span + 'ms naive=' + naiveTotal + ' canonical=' + ref.used);\n";
const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F08-A1', category: 'A', variant: 1, token: 'F08-A1 OK',
    title: '额度越界判定错误（恰好用尽被误拒）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-A1 的限流器在请求成本**恰好等于剩余额度**时错误地拒绝。',
      '修正 limiter.js 使 node verify.js 通过。不得修改 verify.js 与 check-allow.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S1 明确规定 cost == remaining 必须允许（remaining 变为 0）。'),
      'quota.json': quotaJson(100, 100, 100, 100),
      'usage.jsonl': usageJsonl([{ request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 40, ts: 10 }]),
      'account.js': ACCOUNT_OK,
      'limiter.js': [
        "const account = require('./account.js');",
        "const quota = require('./quota.json');",
        'function check(records, cost, winStart, winEnd) {',
        '  const used = account.canonicalUsed(records, winStart, winEnd);',
        '  const remaining = quota.global - used;',
        '  return cost >= remaining ? { decision: "reject", remaining, layer: "global" } : { decision: "allow", remaining: remaining - cost, layer: null }; // 缺陷：应为 cost > remaining',
        '}',
        'module.exports = { check };',
      ].join('\n'),
      'check-allow.js': [
        "const assert = require('assert');",
        "const account = require('./account.js');",
        "const { check } = require('./limiter.js');",
        "const records = account.readUsage(__dirname);",
        "const r = check(records, 60, 0, 1000);",
        "assert.strictEqual(r.decision, 'allow', 'cost == remaining 必须允许（remaining 归零），实际 ' + r.decision);",
        "assert.strictEqual(r.remaining, 0, 'remaining 应为 0，实际 ' + r.remaining);",
        "console.log('ALLOW OK');",
      ].join('\n'),
      'verify.js': ["require('./check-allow.js');", "console.log('F08-A1 OK');"].join('\n'),
    },
    fix: {
      'limiter.js': [
        "const account = require('./account.js');",
        "const quota = require('./quota.json');",
        'function check(records, cost, winStart, winEnd) {',
        '  const used = account.canonicalUsed(records, winStart, winEnd);',
        '  const remaining = quota.global - used;',
        '  return cost > remaining ? { decision: "reject", remaining, layer: "global" } : { decision: "allow", remaining: remaining - cost, layer: null };',
        '}',
        'module.exports = { check };',
      ].join('\n'),
    },
    required: ['boundary_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-allow.js'],
    extraChecks: [{ id: 'boundary_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-A1/check-allow.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状（limiter.js 的越界比较符），且 S1 契约已写死判定规则 ⇒ 直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（位置与规则都已知）；委派类与 REPLAN 不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F08-A2', category: 'A', variant: 2, token: 'F08-A2 OK',
    title: '窗口边界记录归属错误（timestamp == window_end）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-A2 的窗口过滤把边界记录计入了错误的窗口，导致额度判定与 CONTRACT.md 不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-window.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S2 明确规定 timestamp == window_end 的记录归**下一窗口**，不得计入当前窗口。'),
      'window.json': WINDOW,
      'quota.json': quotaJson(100, 100, 100, 100),
      'usage.jsonl': usageJsonl([
        { request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 40, ts: 10 },
        { request_id: 'r2', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 50, ts: 1000 },
      ]),
      'account.js': ACCOUNT_OK.replace('if (r.ts < winStart || r.ts >= winEnd) continue;', 'if (r.ts < winStart || r.ts > winEnd) continue; // 缺陷：边界记录被计入当前窗口'),
      'check-window.js': [
        "const assert = require('assert');",
        "const account = require('./account.js');",
        "const records = account.readUsage(__dirname);",
        "const used = account.canonicalUsed(records, 0, 1000);",
        "assert.strictEqual(used, 40, 'timestamp == window_end 的记录必须归下一窗口，当前窗口 used 应为 40，实际 ' + used);",
        "console.log('WINDOW OK');",
      ].join('\n'),
      'verify.js': ["require('./check-window.js');", "console.log('F08-A2 OK');"].join('\n'),
    },
    fix: { 'account.js': ACCOUNT_OK },
    required: ['window_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-window.js', 'CONTRACT.md', 'window.json'],
    extraChecks: [{ id: 'window_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-A2/check-window.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件可能已知（窗口过滤实现），但"边界记录归下一窗口"这一判定依据写在 CONTRACT.md（S2）⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F08-B1', category: 'B', variant: 1, token: 'F08-B1 OK',
    title: '多层限额未取最小值（reject_layer 错误）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-B1 的额度判定没有按 CONTRACT.md 的多层规则执行（结果见 check-layer.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-layer.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S4 规定 effective_quota = min(global, tenant, user, endpoint)，且拒绝时必须给出 reject_layer。'),
      'window.json': WINDOW,
      'quota.json': quotaJson(100, 80, 60, 70),
      'usage.jsonl': usageJsonl([{ request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 55, ts: 10 }]),
      'account.js': ACCOUNT_OK,
      'limiter.js': [
        "const account = require('./account.js');",
        "const quota = require('./quota.json');",
        'function check(records, cost, winStart, winEnd) {',
        '  const used = account.canonicalUsed(records, winStart, winEnd);',
        '  const effective = quota.tenant; // 缺陷：只取 tenant 层，未取四层最小值',
        '  const remaining = effective - used;',
        '  return cost > remaining ? { decision: "reject", remaining, layer: "tenant" } : { decision: "allow", remaining: remaining - cost, layer: null };',
        '}',
        'module.exports = { check };',
      ].join('\n'),
      'check-layer.js': [
        "const assert = require('assert');",
        "const account = require('./account.js');",
        "const { check } = require('./limiter.js');",
        "const records = account.readUsage(__dirname);",
        "const r = check(records, 10, 0, 1000);",
        "assert.strictEqual(r.decision, 'reject', 'used=55、cost=10、effective_quota=60 ⇒ 必须拒绝，实际 ' + r.decision);",
        "assert.strictEqual(r.layer, 'user', '拒绝层必须是 user（有效额度 60 来自 user 层），实际 ' + r.layer);",
        "console.log('LAYER OK');",
      ].join('\n'),
      'verify.js': ["require('./check-layer.js');", "console.log('F08-B1 OK');"].join('\n'),
    },
    fix: {
      'limiter.js': [
        "const account = require('./account.js');",
        "const quota = require('./quota.json');",
        'function check(records, cost, winStart, winEnd) {',
        '  const used = account.canonicalUsed(records, winStart, winEnd);',
        '  const layers = [["global", quota.global], ["tenant", quota.tenant], ["user", quota.user], ["endpoint", quota.endpoint]];',
        '  let effective = Infinity; let layerName = null;',
        '  for (const [n, v] of layers) { if (v < effective) { effective = v; layerName = n; } }',
        '  const remaining = effective - used;',
        '  return cost > remaining ? { decision: "reject", remaining, layer: layerName } : { decision: "allow", remaining: remaining - cost, layer: null };',
        '}',
        'module.exports = { check };',
      ].join('\n'),
    },
    required: ['layer_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-layer.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'layer_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-B1/check-layer.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是"多层限额未按 min 生效"，成因可能在层级收集（漏层）或取值比较（取错层）；需沿多层判定链定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只改 effective 取值而漏掉 reject_layer 归属；委派与 REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F08-B2', category: 'B', variant: 2, token: 'F08-B2 OK',
    title: '重复记账（同一 request_id 重放被重复扣减）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-B2 在用量记录重放后产生了重复扣减（结果见 check-idempotent.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-idempotent.js。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S5 规定同一 request_id 重放不得重复扣减；S6 规定 canonical source 为 raw records 去重后求和。'),
      'window.json': WINDOW,
      'quota.json': quotaJson(100, 100, 100, 100),
      'usage.jsonl': usageJsonl([
        { request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 30, ts: 10 },
        { request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 30, ts: 11 },
      ]),
      'account.js': ACCOUNT_OK.replace(
        "    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n",
        '    // 缺陷：缺少按 request_id 去重\n',
      ),
      'limiter.js': [
        "const account = require('./account.js');",
        "const quota = require('./quota.json');",
        'function check(records, cost, winStart, winEnd) {',
        '  const used = account.canonicalUsed(records, winStart, winEnd);',
        '  const remaining = quota.global - used;',
        '  return cost > remaining ? { decision: "reject", remaining, layer: "global" } : { decision: "allow", remaining: remaining - cost, layer: null };',
        '}',
        'module.exports = { check };',
      ].join('\n'),
      'check-idempotent.js': [
        "const assert = require('assert');",
        "const account = require('./account.js');",
        "const { check } = require('./limiter.js');",
        "const records = account.readUsage(__dirname);",
        "const used = account.canonicalUsed(records, 0, 1000);",
        "assert.strictEqual(used, 30, '同一 request_id 重放只应扣减一次，canonical used 应为 30，实际 ' + used);",
        "const r = check(records, 60, 0, 1000);",
        "assert.strictEqual(r.decision, 'allow', '去重后 remaining=70 ⇒ cost=60 必须允许，实际 ' + r.decision);",
        "console.log('IDEMPOTENT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-idempotent.js');", "console.log('F08-B2 OK');"].join('\n'),
    },
    fix: { 'account.js': ACCOUNT_OK },
    required: ['idempotent_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-idempotent.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'idempotent_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-B2/check-idempotent.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '重复扣减的成因可能在记账聚合缺去重、或幂等键选择错误、或在 limiter 累计路径；需探查记账链才能定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能只改 limiter 而遗漏聚合层；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F08-C1', category: 'C', variant: 1, token: 'F08-C1 OK',
    title: '硬预算下的多来源用量并行汇总（账务 canonical 等价）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-C1 需要在**总预算 6500 ms**内完成三个用量来源的汇总，最终必须同时成立：',
      '① work/ 下的三个来源汇总工具都必须真实执行完成，各自产出 out/<src>.json；',
      '② 每次执行都会把 {src,start,end,token,accepted,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个来源内部按 S6 规则（去重 request_id → fixed window 过滤 → accepted cost 求和）汇总；',
      '④ 三来源完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 生成 ledger.json，其 used 与分组必须与**独立参考实现**一致；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、window.json、account.js 与 work/ 下的来源工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S6 规定 canonical used = raw 去重(request_id) → 窗口过滤 → accepted cost 求和。'),
      'window.json': WINDOW,
      'quota.json': quotaJson(100, 60, 60, 60),
      'account.js': ACCOUNT_OK,
      'usage/src-a.jsonl': usageJsonl([
        { request_id: 'a1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 20, ts: 10 },
        { request_id: 'a2', tenant: 't1', user: 'u1', endpoint: 'e2', cost: 15, ts: 20 },
      ]),
      'usage/src-b.jsonl': usageJsonl([
        { request_id: 'b1', tenant: 't2', user: 'u2', endpoint: 'e1', cost: 25, ts: 30 },
        { request_id: 'b1', tenant: 't2', user: 'u2', endpoint: 'e1', cost: 25, ts: 31 },
        { request_id: 'b2', tenant: 't2', user: 'u2', endpoint: 'e2', cost: 5, ts: 1000 },
      ]),
      'usage/src-c.jsonl': usageJsonl([{ request_id: 'c1', tenant: 't1', user: 'u3', endpoint: 'e1', cost: 10, ts: 40 }]),
      'work/src-a.js': C_SOURCE_TOOL('src-a', 3500, 'SA-1a2b'),
      'work/src-b.js': C_SOURCE_TOOL('src-b', 3500, 'SB-77c4'),
      'work/src-c.js': C_SOURCE_TOOL('src-c', 3000, 'SC-31e8'),
      'check-timeline.js': CHECK_TIMELINE_LEDGER(6500, C1_SRCS),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C1_SRCS, 'F08-C1 OK'),
    },
    fix: {
      'run-sources.js': RUN_SOURCES(C1_SRCS),
      'INTEGRATION.md': '# 集成说明\n集成：三个用量来源并行汇总，账本按 S6 canonical 规则生成。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F08-C1/run-sources.js',
    required: ['sources_done', 'timeline_ok', 'ledger_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'window.json', 'account.js', 'work/src-a.js', 'work/src-b.js', 'work/src-c.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/src-a.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-C1/check-timeline.js' },
      { id: 'ledger_ok', kind: 'file_contains', path: 'ledger.json', expect: 'used' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '同时给出两条可机械验证的约束：三来源各自固定汇总耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行汇总不得破坏账务语义**（ledger 的 used 与分组必须等于 checker 内嵌独立参考实现按 S6 规则算出的结果）。串行调度必然超预算（verify 直接拒绝），而来源级并行 + canonical 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-账务等价"结构；REPLAN 不适用。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F08-C2', category: 'C', variant: 2, token: 'F08-C2 OK',
    title: '硬预算下的重叠分片并行汇总（跨来源全局幂等）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-C2 需要在**总预算 6500 ms**内完成三个用量分片的汇总，最终必须同时成立：',
      '① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<src>.json（含该分片的原始记录）与 timeline.jsonl 记录；',
      '② 每次执行都会把 {src,start,end,token,naiveAccepted,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 分片之间可能包含**相同的 request_id**（见 CONTRACT.md 的全局幂等规则）；',
      '④ 三来源完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 生成 ledger.json，其 used 与 tenant/endpoint 分组必须与**全局幂等参考实现**一致；写出 INTEGRATION.md；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md、window.json、account.js 与 work/ 下的分片工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': CONTRACT_S('start=0, end=1000', 'S5/S6 全局幂等：**同一 request_id 跨来源重复时只计一次**；tie-break = 取 ts 最小者，ts 相同则取来源名序最小者；随后按 fixed window 过滤并求和。'),
      'window.json': WINDOW,
      'quota.json': quotaJson(100, 50, 50, 50),
      'account.js': ACCOUNT_OK,
      'usage/src-x.jsonl': usageJsonl([
        { request_id: 'r1', tenant: 'tx', user: 'ux', endpoint: 'e1', cost: 30, ts: 10 },
        { request_id: 'r2', tenant: 'tx', user: 'ux', endpoint: 'e2', cost: 8, ts: 1000 },
      ]),
      'usage/src-y.jsonl': usageJsonl([
        { request_id: 'r1', tenant: 'ty', user: 'uy', endpoint: 'e1', cost: 15, ts: 20 },
        { request_id: 'r3', tenant: 'ty', user: 'uy', endpoint: 'e1', cost: 18, ts: 15 },
      ]),
      'usage/src-z.jsonl': usageJsonl([
        { request_id: 'r4', tenant: 'tz', user: 'uz', endpoint: 'e3', cost: 7, ts: 25 },
        { request_id: 'r5', tenant: 'tz', user: 'uz', endpoint: 'e1', cost: 13, ts: 26 },
      ]),
      'work/src-x.js': C2_SOURCE_TOOL('src-x', 3500, 'SX-4b70'),
      'work/src-y.js': C2_SOURCE_TOOL('src-y', 3200, 'SY-2d19'),
      'work/src-z.js': C2_SOURCE_TOOL('src-z', 3000, 'SZ-88af'),
      'check-timeline.js': CHECK_TIMELINE_GLOBAL(6500, C2_SRCS),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C2_SRCS, 'F08-C2 OK'),
    },
    fix: {
      'run-sources.js': RUN_SOURCES_GLOBAL(C2_SRCS),
      'INTEGRATION.md': '# 集成说明\n集成：各分片并行汇总后按全局幂等规则（跨来源 request_id 去重）合并为账本。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F08-C2/run-sources.js',
    required: ['sources_done', 'timeline_ok', 'ledger_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'window.json', 'account.js', 'work/src-x.js', 'work/src-y.js', 'work/src-z.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/src-x.json' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-C2/check-timeline.js' },
      { id: 'ledger_ok', kind: 'file_contains', path: 'ledger.json', expect: 'groups' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 的 failure mode 不同：C1 的分片**互不重叠**（来源内去重 + 分片求和即可）；C2 的分片**存在跨来源重复 request_id**（r1 同时出现在 src-x 与 src-y）⇒ per-source 去重不足，必须做**全局幂等去重**（tie-break：ts 最小者，ts 相同取来源名序最小者）后再按 fixed window 汇总。未修复/朴素实现按分片各自去重再相加 ⇒ naive=83 ≠ canonical=68（checker 显式断言两者必须不同，以证明该 fixture 具有区分力）。硬预算与并行结构同 C1：串行约 10s > 6500ms 被 verify 拒绝，分片级并行 ≤ 预算，且账本必须等于独立全局幂等参考 ⇒ 拆解/并行/编排 + 全局幂等 reconciliation 具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-重叠分片-全局幂等"结构；REPLAN 不适用（任务状态自洽，无既有失败方案需要推翻）。',
  }),
  V({
    id: 'FORMAL-F08-D1', category: 'D', variant: 1, token: 'F08-D1 OK',
    title: '三个限流模块各自的缺陷 + 统一额度报告校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-D1 下的三个限流模块 mod-a / mod-b / mod-c 都需要修好，',
      '并且统一额度报告校验（check-report.js）与该目录下的 node verify.js 也必须全部通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-report.js 与 verify.js。',
    ].join('\n'),
    files: {
      'mod-a/remaining.js': ['// A：remaining = quota - used', 'function remaining(quota, used) { return used - quota; }', 'module.exports = { remaining };'].join('\n'),
      'mod-b/effective.js': ['// B：effective = min(layers)', 'function effective(layers) { return Math.max.apply(null, layers); }', 'module.exports = { effective };'].join('\n'),
      'mod-c/window.js': ['// C：fixed window [start, end)', 'function inWindow(ts, start, end) { return ts >= start && ts <= end; }', 'module.exports = { inWindow };'].join('\n'),
      'check-a.js': ["const assert = require('assert');", "const { remaining } = require('./mod-a/remaining.js');", "assert.strictEqual(remaining(100, 30), 70);", "console.log('A OK');"].join('\n'),
      'check-b.js': ["const assert = require('assert');", "const { effective } = require('./mod-b/effective.js');", "assert.strictEqual(effective([100, 80, 60, 70]), 60);", "console.log('B OK');"].join('\n'),
      'check-c.js': ["const assert = require('assert');", "const { inWindow } = require('./mod-c/window.js');", "assert.strictEqual(inWindow(1000, 0, 1000), false);", "console.log('C OK');"].join('\n'),
      'check-report.js': [
        "const assert = require('assert');",
        "const a = require('./mod-a/remaining.js');",
        "const b = require('./mod-b/effective.js');",
        "const c = require('./mod-c/window.js');",
        "assert.strictEqual(a.remaining(100, 30), 70);",
        "assert.strictEqual(b.effective([100, 80, 60]), 60);",
        "assert.strictEqual(c.inWindow(1000, 0, 1000), false);",
        "console.log('REPORT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-a.js');", "require('./check-b.js');", "require('./check-c.js');", "console.log('F08-D1 OK');"].join('\n'),
    },
    fix: {
      'mod-a/remaining.js': ['// A：remaining = quota - used', 'function remaining(quota, used) { return quota - used; }', 'module.exports = { remaining };'].join('\n'),
      'mod-b/effective.js': ['// B：effective = min(layers)', 'function effective(layers) { return Math.min.apply(null, layers); }', 'module.exports = { effective };'].join('\n'),
      'mod-c/window.js': ['// C：fixed window [start, end)', 'function inWindow(ts, start, end) { return ts >= start && ts < end; }', 'module.exports = { inWindow };'].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'report_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-report.js'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-D1/check-c.js' },
      { id: 'report_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-D1/check-report.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个限流模块各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未利用模块互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F08-D2', category: 'D', variant: 2, token: 'F08-D2 OK',
    title: '多阶段账务修复：记录修复 → 聚合归一 → 账本重生成 → 对账报告',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F08-D2 需要交付四份产物：',
      '① 修复后的用量记录 records-fixed.json（含字段 "repaired": true）；',
      '② 聚合归一结果 aggregation-normalized.json（含字段 "normalized": true）；',
      '③ 重生成的账本 ledger-rebuilt.json（含字段 "used"）；',
      '④ 对账报告 reconciliation-report.json（含字段 "reconciled": true）；node verify.js 必须通过。',
      '不得修改 verify.js。',
    ].join('\n'),
    files: {
      'usage.jsonl': usageJsonl([{ request_id: 'r1', tenant: 't1', user: 'u1', endpoint: 'e1', cost: 30, ts: 10 }]),
      'records-fixed.json': '{}\n',
      'aggregation-normalized.json': '{}\n',
      'ledger-rebuilt.json': '{}\n',
      'reconciliation-report.json': '{}\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));",
        "assert.strictEqual(rd('records-fixed.json').repaired, true, 'records-fixed.json 缺少 repaired');",
        "assert.strictEqual(rd('aggregation-normalized.json').normalized, true, 'aggregation-normalized.json 缺少 normalized');",
        "assert.strictEqual(typeof rd('ledger-rebuilt.json').used, 'number', 'ledger-rebuilt.json 缺少 used');",
        "assert.strictEqual(rd('reconciliation-report.json').reconciled, true, 'reconciliation-report.json 缺少 reconciled');",
        "console.log('F08-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'records-fixed.json': JSON.stringify({ repaired: true, records: [{ request_id: 'r1', cost: 30, ts: 10 }] }, null, 2) + '\n',
      'aggregation-normalized.json': JSON.stringify({ normalized: true, used: 30 }, null, 2) + '\n',
      'ledger-rebuilt.json': JSON.stringify({ used: 30, quota: { global: 100 } }, null, 2) + '\n',
      'reconciliation-report.json': JSON.stringify({ reconciled: true, delta: 0 }, null, 2) + '\n',
    },
    required: ['records_repaired', 'aggregation_normalized', 'ledger_rebuilt', 'reconciled', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: [],
    extraChecks: [
      { id: 'records_repaired', kind: 'file_contains', path: 'records-fixed.json', expect: 'repaired' },
      { id: 'aggregation_normalized', kind: 'file_contains', path: 'aggregation-normalized.json', expect: 'normalized' },
      { id: 'ledger_rebuilt', kind: 'file_contains', path: 'ledger-rebuilt.json', expect: 'used' },
      { id: 'reconciled', kind: 'file_contains', path: 'reconciliation-report.json', expect: 'reconciled' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '四个阶段（记录修复 → 聚合归一 → 账本重生成 → 对账报告）各有独立产物与验收字段，后续阶段依赖前序结果 ⇒ 多阶段编排结构由任务本身给出（prompt 只陈述交付物）。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F08-E1', category: 'E', variant: 1, token: 'F08-E1 OK',
    title: '旧版计费规则与新 quota 契约冲突（新增兼容路径）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F08-E1 的 billing.js 是一版**已上线**的计费实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/billing.json 与 consumer 均不得修改）。',
      'CONTRACT-quota.md 的新要求必须成立；check.js 与 billing.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'CONTRACT-quota.md': '# 新契约\n\n1. 必须保留 legacy 字段 billed（外部消费方逐字段回放）；\n2. 必须新增 remaining 与 reject_layer 字段（配额语义）；\n3. 两条必须同时成立。\n',
      'billing.js': ['// 已上线实现：仅输出 billed，且被 legacy/billing.json 冻结', 'function charge(cost, used) { return { billed: cost + used }; }', 'module.exports = { charge };'].join('\n'),
      'legacy/billing.json': JSON.stringify({ billed: 40 }, null, 2) + '\n',
      'legacy/consumer.js': [
        '// 外部消费方（受保护）：按 legacy/billing.json 逐字段回放 charge 的输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { charge } = require('../billing.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'billing.json'), 'utf8'));",
        "const out = charge(10, 30);",
        "assert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');",
        "assert.strictEqual(out.billed, golden.billed, 'legacy billed 被改变');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'index.js': ['// 对外入口（可修改）：当前直接转发既有实现', "const base = require('./billing.js');", 'module.exports = { charge: base.charge };'].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { charge } = require('./index.js');",
        "const out = charge(10, 30, { quota: 100 });",
        "assert.strictEqual(out.billed, 40, 'legacy billed 必须保留');",
        "assert.strictEqual(typeof out.remaining, 'number', '新契约：必须携带 remaining，实际 ' + JSON.stringify(out));",
        "assert.ok(out.reject_layer === null || typeof out.reject_layer === 'string', '新契约：必须携带 reject_layer');",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': ["require('./legacy/consumer.js');", "require('./check.js');", "console.log('F08-E1 OK');"].join('\n'),
    },
    fix: {
      'billing-quota.js': [
        '// 兼容路径：保留 legacy billed 布局，同时补充 remaining / reject_layer',
        "const base = require('./billing.js');",
        'function charge(cost, used, ctx) { const out = base.charge(cost, used); const quota = (ctx && ctx.quota) || 100; const remaining = quota - used - cost; return { billed: out.billed, remaining: remaining < 0 ? 0 : remaining, reject_layer: remaining < 0 ? "global" : null }; }',
        'module.exports = { charge };',
      ].join('\n'),
      'index.js': ['// 对外入口：指向兼容路径', "const v2 = require('./billing-quota.js');", 'module.exports = { charge: v2.charge };'].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['billing.js', 'legacy/consumer.js', 'legacy/billing.json', 'check.js', 'CONTRACT-quota.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'billing-quota.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F08-E1/check.js', log: 'pilot-workspace/FORMAL-F08-E1/attempt-log.txt' },
    rationaleGt: '现状把既有实现当作新接口：billing.js 只能输出 billed，而新契约要求同时携带 remaining/reject_layer；billing.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F08-E2', category: 'E', variant: 2, token: 'F08-E2 OK',
    title: '展示派生状态与账本真值脱节（账本权威性）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file', 'shared_state'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F08-E2 对外展示的剩余额度与账本真值不一致。',
      '上一轮针对展示数据的处理记录在 display.log。',
      'ledger-authority.md 规定的前置契约必须成立；reconcile.js 与 ledger.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'ledger-authority.md': '# 权威性契约\n\nledger.json 是业务真值源；display-snapshot.json 只是**派生展示数据**，不得成为额度计算的权威来源。额度必须由账本推导（remaining = ledger.quota - ledger.used）。\n',
      'ledger.json': JSON.stringify({ quota: 100, used: 80 }, null, 2) + '\n',
      'display-snapshot.json': JSON.stringify({ remaining: 70, note: 'derived display data (stale)' }, null, 2) + '\n',
      'ledger.js': [
        '// 受保护：账本读写（真值源）',
        "const fs = require('fs');",
        "const path = require('path');",
        'const file = path.join(__dirname, \'ledger.json\');',
        'function read() { return JSON.parse(fs.readFileSync(file, \'utf8\')); }',
        'function setUsed(used) { const cur = read(); fs.writeFileSync(file, JSON.stringify({ quota: cur.quota, used }, null, 2) + \'\\n\'); }',
        'module.exports = { read, setUsed };',
      ].join('\n'),
      'display.js': [
        '// 展示层：当前直接读取 display-snapshot.json（派生数据被当成权威）',
        "const fs = require('fs');",
        "const path = require('path');",
        'function remaining() { return JSON.parse(fs.readFileSync(path.join(__dirname, \'display-snapshot.json\'), \'utf8\')).remaining; }',
        'module.exports = { remaining };',
      ].join('\n'),
      'reconcile.js': [
        "const assert = require('assert');",
        "const ledger = require('./ledger.js');",
        "const display = require('./display.js');",
        "const l1 = ledger.read();",
        "assert.strictEqual(display.remaining(), l1.quota - l1.used, '展示额度必须由账本推导，实际 ' + display.remaining() + '，账本推导值 ' + (l1.quota - l1.used));",
        "ledger.setUsed(90); // 账本更新：真值变化必须传播到展示",
        "assert.strictEqual(display.remaining(), 10, '账本更新后展示额度必须随之重算，实际 ' + display.remaining());",
        "console.log('RECONCILE OK');",
      ].join('\n'),
      'verify.js': ["require('./reconcile.js');", "console.log('F08-E2 OK');"].join('\n'),
    },
    fix: {
      'display.js': [
        '// 展示层：由账本真值推导（display-snapshot.json 仅为派生展示数据，不作为权威来源）',
        "const ledger = require('./ledger.js');",
        'function remaining() { const l = ledger.read(); return l.quota - l.used; }',
        'module.exports = { remaining };',
      ].join('\n'),
    },
    required: ['authority_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['reconcile.js', 'ledger.js', 'ledger-authority.md'],
    extraChecks: [{ id: 'authority_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F08-E2/reconcile.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F08-E2/reconcile.js', log: 'pilot-workspace/FORMAL-F08-E2/display.log' },
    rationaleGt: '未修复态把派生展示数据当作权威：display-snapshot.json 残留 remaining=70（对应旧 used=30），而账本 used=80 ⇒ 真实剩余 20（真实预跑断言 actual=70 / expected=20）；进一步账本更新为 used=90 时展示必须变为 10。reconcile.js 与 ledger.js 冻结 ⇒ 必须改变"展示从哪里取数"的方案（由账本推导），属计划层重规划 ⇒ REPLAN 有构念依据且可满足；与 F06 缓存键失效、F07 层叠传播机制不同。',
    rationaleNot: 'DIRECT 指向受保护文件或直接改 display-snapshot.json 数值（把派生数据当真值，不解决问题）；EXPLORE 不成立（权威性规则与成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f08-evidence');
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
  `/**\n * benchmark/formal-seeds-f08.ts — F08 族 10 个变体的种子（由 scripts/formal-author-f08.ts 生成）\n */\nexport const FORMAL_F08_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f08.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f08-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f08-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F08', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F08) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F08', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F08', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F08 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> **防重复声明**：F08 不测试权限判定（F06）、事件排序（F04）或通用状态机恢复；',
  '> 其主要被测对象是**共享资源配额的计算、并发消耗、幂等记账与最终一致性（账务对账）**。',
  '> F06 解决"有没有权限"；F08 解决"有权限以后还能用多少、用了多少、并发时怎么算"。',
  '',
  '> 脚手架：配额 / 限流 / 记账（与 F01–F07 各族的领域均不同）。status: draft；签署字段留空。',
  '> 冻结语义 S1–S6（额度计算 / fixed window [start,end) / 并发原子性 / effective=min + reject_layer / 幂等 / canonical 对账）逐变体写入 CONTRACT.md。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f08.ts', 'benchmark/formal/slots.json'].sort();
const vEntries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(vEntries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f08-version.json'), {
  dataset: 'formal', family: 'F08', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(vEntries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F08 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F08-*.yaml · formal-seeds-f08.ts · f08-review.md · f08-gt-drafts.json · f08-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F08 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f08-review.md');
process.exit(allOk ? 0 : 3);
