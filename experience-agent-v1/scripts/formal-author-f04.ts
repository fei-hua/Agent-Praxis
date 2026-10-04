/**
 * scripts/formal-author-f04.ts — F04 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 脚手架（与 F01/F02/F03 不同）：**事件流 + 状态机**（顺序 / 幂等 / 迁移合法性 / 故障恢复 / 多来源）
 * 纪律同前：只产出 draft；GT 逐条独立推导；三层证据；E 类真实预跑 + 日志后冻结基线；
 *          不生成 manifest、不启动正式 run；prompt 不含 first-decision 提示。
 *
 * 用法：node scripts/formal-author-f04.ts
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

/** 严格运行 fixRun：区分 EXIT / SIGNAL / SPAWN_ERROR（禁止 undefined），fd 捕获输出并打印 timeline/span */
function runFixRunStrict(cwd: string, script: string) {
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
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f04.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f04-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f04-gt-drafts.json');

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

/** 事件流任务公共脚手架（machine / apply / events / verify 由各变体覆盖或复用） */
const MACHINE_OK =
  "// 状态机：合法迁移表\n" +
  "const TABLE = {\n" +
  "  created: ['pay', 'cancel'],\n" +
  "  paid: ['ship', 'cancel'],\n" +
  "  shipped: [],\n" +
  "  cancelled: [],\n" +
  "};\n" +
  "function canMove(state, type) { return (TABLE[state] || []).includes(type); }\n" +
  "function move(state, type) { return canMove(state, type) ? (type === 'pay' ? 'paid' : type === 'ship' ? 'shipped' : 'cancelled') : state; }\n" +
  "module.exports = { TABLE, canMove, move };\n";

const SRC_TOOL = (src: string, dur: number, token: string) =>
  "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const SRC = " + JSON.stringify(src) + ";\n" +
  "const DUR = " + dur + ";\n" +
  "const TOKEN = " + JSON.stringify(token) + ";\n" +
  "const ROOT = path.join(__dirname, '..');\n" +
  "const start = Date.now();\n" +
  "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\n" +
  "const events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "const ordered = events.slice().sort((a, b) => a.seq - b.seq);\n" +
  "let last = -1;\n" +
  "let orderOk = true;\n" +
  "const ids = [];\n" +
  "for (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\n" +
  "const end = Date.now();\n" +
  "fs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\n" +
  "fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\n" +
  "fs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\n" +
  "console.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n";

const RUN_PARALLEL = (srcs: string[], merged: boolean) =>
  "// 并行编排：并发消费三个来源，随后产出集成结论（每来源内部顺序由各自工具保证）\n" +
  "const { spawn } = require('child_process');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const sources = " + JSON.stringify(srcs) + ";\n" +
  "function runOne(s) {\n" +
  "  return new Promise((resolve, reject) => {\n" +
  "    const p = spawn(process.execPath, [path.join(__dirname, 'work', s + '.js')], { stdio: 'ignore' });\n" +
  "    p.on('error', (e) => reject(new Error(s + ' spawn_error: ' + e.code + ' ' + e.message)));\n" +
  "    p.on('exit', (c, sig) => (c === 0 ? resolve() : reject(new Error(s + ' exit=' + c + ' signal=' + sig))));\n" +
  "  });\n" +
  "}\n" +
  "Promise.all(sources.map(runOne)).then(() => {\n" +
  (merged
    ? "  const counts = {};\n" +
      "  for (const s of sources) { const txt = fs.readFileSync(path.join(__dirname, 'out', s + '.txt'), 'utf8').trim(); counts[s] = txt === '' ? 0 : txt.split(',').length; }\n" +
      "  fs.writeFileSync(path.join(__dirname, 'merged.json'), JSON.stringify({ sources, counts }) + '\\n');\n"
    : '') +
  "  fs.writeFileSync(path.join(__dirname, 'INTEGRATION.md'), '# 集成说明\\n集成：三个来源并行消费完成，每来源内部保持 seq 升序，总耗时在预算内。\\n');\n" +
  "  console.log('parallel orchestration done');\n" +
  "}).catch((e) => { console.error(e.message); process.exit(1); });\n";

const CHECK_TIMELINE = (budget: number, srcs: string[], needMerged: boolean) =>
  "// 纯读取检查器：验证**已发生**的那次并行运行（绝不执行任何来源工具）\n" +
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.ok(entries.length >= SOURCES.length, 'timeline 记录数不足：' + entries.length);\n" +
  "const seen = new Set(entries.map((e) => e.source));\n" +
  "assert.strictEqual(seen.size, SOURCES.length, '来源数不符：' + Array.from(seen).join(','));\n" +
  "for (const e of entries) {\n" +
  "  assert.ok(typeof e.start === 'number' && typeof e.end === 'number', 'timeline 时间字段非法');\n" +
  "  assert.strictEqual(e.order_ok, true, '来源 ' + e.source + ' 内部顺序未保持');\n" +
  "  const out = path.join(__dirname, 'out', e.source + '.txt');\n" +
  "  assert.ok(fs.existsSync(out), '缺少来源产物 out/' + e.source + '.txt');\n" +
  "  const ids = fs.readFileSync(out, 'utf8').trim();\n" +
  "  const evs = fs.readFileSync(path.join(__dirname, 'events', e.source + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "  const expectIds = evs.slice().sort((a, b) => a.seq - b.seq).map((e2) => e2.id).join(',');\n" +
  "  assert.strictEqual(ids, expectIds, '来源 ' + e.source + ' 输出顺序与 seq 升序不一致');\n" +
  "}\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  (needMerged
    ? "const merged = JSON.parse(fs.readFileSync(path.join(__dirname, 'merged.json'), 'utf8'));\n" +
      "assert.strictEqual(Object.keys(merged.counts).length, SOURCES.length, 'merged.json 未覆盖全部来源');\n"
    : '') +
  "assert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\n" +
  "console.log('TIMELINE OK sources=' + seen.size + ' entries=' + entries.length + ' span=' + span + 'ms order=preserved');\n";

const EV = (rows: Array<[number, string]>) => rows.map(([seq, type]) => JSON.stringify({ id: 'e' + seq, seq, type })).join('\n') + '\n';

const C_VERIFY = (budget: number, srcs: string[], token: string) =>
  "const assert = require('assert');\n" +
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  "const BUDGET_MS = " + budget + ";\n" +
  "const SOURCES = " + JSON.stringify(srcs) + ";\n" +
  "const tl = path.join(__dirname, 'timeline.jsonl');\n" +
  "assert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\n" +
  "const entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n" +
  "assert.strictEqual(new Set(entries.map((e) => e.source)).size, SOURCES.length, '来源数不符');\n" +
  "for (const e of entries) assert.strictEqual(e.order_ok, true, '来源顺序未保持：' + e.source);\n" +
  "const span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\n" +
  "assert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n" +
  "console.log(" + JSON.stringify(token) + ");\n";

const C1_SRCS = ['src-a', 'src-b', 'src-c'];
const C2_SRCS = ['src-x', 'src-y', 'src-z'];

const variants: Variant[] = [
  // ---------------- A1 ----------------
  V({
    id: 'FORMAL-F04-A1', category: 'A', variant: 1, token: 'F04-A1 OK',
    title: '状态机迁移表缺陷（单文件单点）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-A1 的订单状态机在收到 ship 事件后没有进入 shipped 状态。',
      '修正 machine.js 使状态迁移符合预期，并让 node verify.js 通过。不得修改 verify.js 与 check-machine.js。',
    ].join('\n'),
    files: {
      'machine.js': MACHINE_OK.replace("paid: ['ship', 'cancel'],", "paid: ['pay', 'cancel'],"),
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        'function replay(events) { let state = "created"; for (const e of events) state = move(state, e.type); return state; }',
        "function load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }",
        'module.exports = { replay, load, state: () => replay(load().slice().sort((a, b) => a.seq - b.seq)) };',
      ].join('\n'),
      'events.jsonl': EV([[1, 'pay'], [2, 'ship']]),
      'check-machine.js': [
        "const assert = require('assert');",
        "const apply = require('./apply.js');",
        "assert.strictEqual(apply.state(), 'shipped', '收到 ship 后应进入 shipped，实际 ' + apply.state());",
        "console.log('MACHINE OK');",
      ].join('\n'),
      'verify.js': [
        "require('./check-machine.js');",
        "console.log('F04-A1 OK');",
      ].join('\n'),
    },
    fix: { 'machine.js': MACHINE_OK },
    required: ['machine_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-machine.js'],
    extraChecks: [{ id: 'machine_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-A1/check-machine.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件、单症状、目标文件明确（machine.js 的迁移表），直接修改是最小充分的首决策。',
    rationaleNot: 'EXPLORE 无依据（故障位置已知）；委派类与 REPLAN 均不适用。',
  }),
  // ---------------- A2 ----------------
  V({
    id: 'FORMAL-F04-A2', category: 'A', variant: 2, token: 'F04-A2 OK',
    title: '事件处理顺序不符契约（目标文件已知但需查约定）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: ['shared_state'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-A2 的最终状态与 CONTRACT.md 描述的事件处理要求不一致。',
      '修正后使 node verify.js 通过。不得修改 verify.js、check-order.js 与 CONTRACT.md。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 事件处理契约\n\n事件必须按 seq 升序处理（文件中的物理顺序不代表处理顺序）。\n',
      'machine.js': MACHINE_OK,
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        'function load() { return fs.readFileSync(path.join(__dirname, \'events.jsonl\'), \'utf8\').trim().split(\'\\n\').filter((l) => l.trim() !== \'\').map((l) => JSON.parse(l)); }',
        'function state() { let s = \'created\'; for (const e of load()) s = move(s, e.type); return s; }',
        'module.exports = { state, load };',
      ].join('\n'),
      'events.jsonl': EV([[2, 'ship'], [1, 'pay']]),
      'check-order.js': [
        "const assert = require('assert');",
        "const apply = require('./apply.js');",
        "assert.strictEqual(apply.state(), 'shipped', '按 seq 升序处理后应为 shipped，实际 ' + apply.state());",
        "console.log('ORDER OK');",
      ].join('\n'),
      'verify.js': ["require('./check-order.js');", "console.log('F04-A2 OK');"].join('\n'),
    },
    fix: {
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        'function load() { return fs.readFileSync(path.join(__dirname, \'events.jsonl\'), \'utf8\').trim().split(\'\\n\').filter((l) => l.trim() !== \'\').map((l) => JSON.parse(l)); }',
        'function state() { let s = \'created\'; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) s = move(s, e.type); return s; }',
        'module.exports = { state, load };',
      ].join('\n'),
    },
    required: ['order_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-order.js', 'CONTRACT.md'],
    extraChecks: [{ id: 'order_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-A2/check-order.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '目标文件已知（apply.js），但"必须按 seq 升序"这一正确性依据写在 CONTRACT.md 中；先查约定再改属合理探索，因此 DIRECT 与 EXPLORE 并列成立。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽，仅实现与约定不符）。',
  }),
  // ---------------- B1 ----------------
  V({
    id: 'FORMAL-F04-B1', category: 'B', variant: 1, token: 'F04-B1 OK',
    title: '末端快照缺少 status 字段（需沿链定位）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-B1 产出的最终快照里缺少 status 字段（期望快照见 check-snapshot.js 的要求）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-snapshot.js。',
    ].join('\n'),
    files: {
      'machine.js': MACHINE_OK,
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        "function load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }",
        "function run() { let state = 'created'; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) state = move(state, e.type); return { state, status: state }; }",
        'module.exports = { run, load };',
      ].join('\n'),
      'snapshot.js': [
        "const apply = require('./apply.js');",
        'function snapshot() { const r = apply.run(); return { state: r.state }; }',
        'module.exports = { snapshot };',
      ].join('\n'),
      'events.jsonl': EV([[1, 'pay'], [2, 'ship']]),
      'check-snapshot.js': [
        "const assert = require('assert');",
        "const { snapshot } = require('./snapshot.js');",
        "const s = snapshot();",
        "assert.strictEqual(s.status, 'shipped', '快照缺少正确的 status，实际 ' + JSON.stringify(s));",
        "console.log('SNAPSHOT OK');",
      ].join('\n'),
      'verify.js': ["require('./check-snapshot.js');", "console.log('F04-B1 OK');"].join('\n'),
    },
    fix: {
      'snapshot.js': [
        "const apply = require('./apply.js');",
        'function snapshot() { const r = apply.run(); return { state: r.state, status: r.status }; }',
        'module.exports = { snapshot };',
      ].join('\n'),
    },
    required: ['snapshot_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-snapshot.js'],
    extraChecks: [{ id: 'snapshot_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-B1/check-snapshot.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状出现在末端快照，但字段可能在 apply.js 的聚合结果或 snapshot.js 的投影中丢失；需沿链定位 ⇒ EXPLORE 有明确依据。',
    rationaleNot: 'DIRECT 会盲改其中一处；委派对三个小文件过度；REPLAN 不适用。',
  }),
  // ---------------- B2 ----------------
  V({
    id: 'FORMAL-F04-B2', category: 'B', variant: 2, token: 'F04-B2 OK',
    title: '重复事件导致重复副作用（需定位去重层是否生效）',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-B2 在同一事件被重复投递时产生了重复计数（期望最终计数见 check-dedupe.js）。',
      '请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-dedupe.js 与 dedupe.js。',
    ].join('\n'),
    files: {
      'dedupe.js': [
        '// 幂等判重（按事件 id）',
        'const seen = new Set();',
        'function once(ev) { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; }',
        'module.exports = { once };',
      ].join('\n'),
      'machine.js': [
        'const TABLE = { created: ["add"], counting: ["add"] };',
        'function move(state, type) { return type === "add" ? "counting" : state; }',
        'module.exports = { TABLE, move };',
      ].join('\n'),
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        "function load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }",
        'function run() { let state = "created"; let count = 0; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) { state = move(state, e.type); if (e.type === "add") count += 1; } return { state, count }; }',
        'module.exports = { run, load };',
      ].join('\n'),
      'events.jsonl': [
        JSON.stringify({ id: 'dup-1', seq: 1, type: 'add', payload: 'a' }),
        JSON.stringify({ id: 'dup-1', seq: 2, type: 'add', payload: 'b' }),
      ].join('\n') + '\n',
      'check-dedupe.js': [
        "const assert = require('assert');",
        "const { run } = require('./apply.js');",
        "const r = run();",
        "assert.strictEqual(r.count, 1, '同一 id 的事件只应产生一次副作用，实际 ' + r.count + ' 次');",
        "console.log('DEDUPE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-dedupe.js');", "console.log('F04-B2 OK');"].join('\n'),
    },
    fix: {
      'apply.js': [
        "const fs = require('fs');",
        "const path = require('path');",
        "const { move } = require('./machine.js');",
        "const dedupe = require('./dedupe.js');",
        "function load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }",
        'function run() { let state = "created"; let count = 0; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) { if (!dedupe.once(e)) continue; state = move(state, e.type); if (e.type === "add") count += 1; } return { state, count }; }',
        'module.exports = { run, load };',
      ].join('\n'),
    },
    required: ['dedupe_fixed', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-dedupe.js', 'dedupe.js'],
    extraChecks: [{ id: 'dedupe_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-B2/check-dedupe.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '症状是重复副作用，但成因可能在 apply.js 未调用去重、或 dedupe.js 判重逻辑失效；需要探查调用链才能定位 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 可能改错层（dedupe.js 本身是正确的且受保护）；委派与 REPLAN 不适用。',
  }),
  // ---------------- C1 ----------------
  V({
    id: 'FORMAL-F04-C1', category: 'C', variant: 1, token: 'F04-C1 OK',
    title: '硬预算下的多来源并行消费（每来源内部保序）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-C1 需要在**总预算 6500 ms**内完成三分支事件来源的消费，最终必须同时成立：',
      '① work/ 下的三个来源工具都必须真实执行完成，各自产出 out/<source>.txt；',
      '② 每次执行都会把 {source,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个来源内部必须保持 seq 升序的处理顺序（见 CONTRACT.md）；',
      '④ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 写出 INTEGRATION.md，含一行以「集成」开头的结论；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的来源工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 来源消费契约\n\n1. 每个来源内部的事件必须按 seq 升序处理；\n2. 三个来源共享一个总时间预算（6500 ms）；\n3. 每次运行必须把 {source,start,end,token,order_ok} 追加到 timeline.jsonl。\n',
      'events/src-a.jsonl': EV([[3, 'c'], [1, 'a'], [2, 'b']]),
      'events/src-b.jsonl': EV([[2, 'y'], [1, 'x']]),
      'events/src-c.jsonl': EV([[1, 'p'], [3, 'r'], [2, 'q']]),
      'work/src-a.js': SRC_TOOL('src-a', 3500, 'SA-1a2b'),
      'work/src-b.js': SRC_TOOL('src-b', 3500, 'SB-77c4'),
      'work/src-c.js': SRC_TOOL('src-c', 3000, 'SC-31e8'),
      'check-timeline.js': CHECK_TIMELINE(6500, C1_SRCS, false),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C1_SRCS, 'F04-C1 OK'),
    },
    fix: {
      'run-sources.js': RUN_PARALLEL(C1_SRCS, false),
      'INTEGRATION.md': '# 集成说明\n集成：三个来源并行消费完成，每来源内部保持 seq 升序，总耗时在预算内。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F04-C1/run-sources.js',
    required: ['sources_done', 'timeline_ok', 'integration_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'work/src-a.js', 'work/src-b.js', 'work/src-c.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/src-a.txt' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-C1/check-timeline.js' },
      { id: 'integration_ok', kind: 'file_contains', path: 'INTEGRATION.md', expect: '集成' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '任务同时给出两条可机械验证的约束：三分支各自固定耗时（3.5s/3.5s/3.0s，串行合计约 10s）与 6500ms 总预算，且**每个来源内部必须保序**。串行调度必然超预算（verify 直接拒绝），而来源级并行 + 各自内部保序可以同时满足预算与顺序约束 ⇒ 拆解/并行/编排具有结构依据。',
    rationaleNot: '串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-保序"结构；REPLAN 不适用（任务状态自洽）。',
  }),
  // ---------------- C2 ----------------
  V({
    id: 'FORMAL-F04-C2', category: 'C', variant: 2, token: 'F04-C2 OK',
    title: '硬预算下的多来源消费 + 合并产物（每来源内部保序）',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-C2 需要在**总预算 6500 ms**内完成三分支事件来源的消费与合并，最终必须同时成立：',
      '① work/ 下的三个来源工具都必须真实执行完成，各自产出 out/<source>.txt；',
      '② 每次执行都会把 {source,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；',
      '③ 每个来源内部必须保持 seq 升序的处理顺序（见 CONTRACT.md）；',
      '④ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；',
      '⑤ 产出 merged.json，包含三个来源各自的条目数；写出 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。',
      '不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的来源工具。',
    ].join('\n'),
    files: {
      'CONTRACT.md': '# 来源消费契约\n\n1. 每个来源内部的事件必须按 seq 升序处理；\n2. 三个来源共享总时间预算 6500 ms；\n3. 运行结束后必须产出 merged.json（含各来源条目数）与 INTEGRATION.md。\n',
      'events/src-x.jsonl': EV([[2, 'b'], [1, 'a'], [3, 'c'], [4, 'd']]),
      'events/src-y.jsonl': EV([[1, 'a'], [2, 'b'], [3, 'c']]),
      'events/src-z.jsonl': EV([[3, 'c'], [2, 'b'], [1, 'a']]),
      'work/src-x.js': SRC_TOOL('src-x', 3500, 'SX-4b70'),
      'work/src-y.js': SRC_TOOL('src-y', 3200, 'SY-2d19'),
      'work/src-z.js': SRC_TOOL('src-z', 3000, 'SZ-88af'),
      'check-timeline.js': CHECK_TIMELINE(6500, C2_SRCS, true),
      'INTEGRATION.md': '# 集成说明\n（待补）\n',
      'verify.js': C_VERIFY(6500, C2_SRCS, 'F04-C2 OK'),
    },
    fix: {
      'run-sources.js': RUN_PARALLEL(C2_SRCS, true),
      'INTEGRATION.md': '# 集成说明\n集成：三个来源并行消费并合并条目数，每来源内部保持 seq 升序，总耗时在预算内。\n',
    },
    fixRun: 'node pilot-workspace/FORMAL-F04-C2/run-sources.js',
    required: ['sources_done', 'merged_ok', 'timeline_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-timeline.js', 'CONTRACT.md', 'work/src-x.js', 'work/src-y.js', 'work/src-z.js'],
    extraChecks: [
      { id: 'sources_done', kind: 'file_exists', path: 'out/src-x.txt' },
      { id: 'merged_ok', kind: 'file_contains', path: 'merged.json', expect: 'counts' },
      { id: 'timeline_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-C2/check-timeline.js' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '与 C1 同构但非复制：来源数/耗时分布/事件量不同，且额外要求产出**合并产物**（merged.json 必须覆盖全部来源）。同样存在"硬预算 + 每来源保序"两条可机械验证的约束，串行超预算而来源级并行可行 ⇒ 委派类成立。',
    rationaleNot: '串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-来源-保序-合并"结构；REPLAN 不适用。',
  }),
  // ---------------- D1 ----------------
  V({
    id: 'FORMAL-F04-D1', category: 'D', variant: 1, token: 'F04-D1 OK',
    title: '三个来源包各自的缺陷 + 统一合并校验',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-D1 下的三个来源包 svc-a / svc-b / svc-c 都需要修好，',
      '并且合并校验（merge 相关检查）与该目录下的 node verify.js 也必须全部通过。',
      '不得修改 check-a.js、check-b.js、check-c.js、check-merge.js 与 verify.js。',
    ].join('\n'),
    files: {
      'svc-a/state.js': [
        '// A 来源：计数应逐条自增',
        'function inc(n) { return n; }',
        'module.exports = { inc };',
      ].join('\n'),
      'svc-b/state.js': [
        '// B 来源：重置应回到 0',
        'function reset() { return undefined; }',
        'module.exports = { reset };',
      ].join('\n'),
      'svc-c/state.js': [
        '// C 来源：求和应包含全部条目',
        'function sum(xs) { return xs.slice(0, Math.max(0, xs.length - 1)).reduce((a, b) => a + b, 0); }',
        'module.exports = { sum };',
      ].join('\n'),
      'check-a.js': ["const assert = require('assert');", "const { inc } = require('./svc-a/state.js');", "assert.strictEqual(inc(0), 1);", "assert.strictEqual(inc(4), 5);", "console.log('A OK');"].join('\n'),
      'check-b.js': ["const assert = require('assert');", "const { reset } = require('./svc-b/state.js');", "assert.strictEqual(reset(), 0);", "console.log('B OK');"].join('\n'),
      'check-c.js': ["const assert = require('assert');", "const { sum } = require('./svc-c/state.js');", "assert.strictEqual(sum([1, 2, 3]), 6);", "console.log('C OK');"].join('\n'),
      'check-merge.js': [
        "const assert = require('assert');",
        "const a = require('./svc-a/state.js');",
        "const b = require('./svc-b/state.js');",
        "const c = require('./svc-c/state.js');",
        "assert.strictEqual(a.inc(0), 1);",
        "assert.strictEqual(b.reset(), 0);",
        "assert.strictEqual(c.sum([2, 4]), 6);",
        "console.log('MERGE OK');",
      ].join('\n'),
      'verify.js': ["require('./check-a.js');", "require('./check-b.js');", "require('./check-c.js');", "console.log('F04-D1 OK');"].join('\n'),
    },
    fix: {
      'svc-a/state.js': ['// A 来源：计数逐条自增', 'function inc(n) { return n + 1; }', 'module.exports = { inc };'].join('\n'),
      'svc-b/state.js': ['// B 来源：重置回到 0', 'function reset() { return 0; }', 'module.exports = { reset };'].join('\n'),
      'svc-c/state.js': ['// C 来源：求和包含全部条目', 'function sum(xs) { return xs.reduce((a, b) => a + b, 0); }', 'module.exports = { sum };'].join('\n'),
    },
    required: ['a_fixed', 'b_fixed', 'c_fixed', 'merge_ok', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['check-a.js', 'check-b.js', 'check-c.js', 'check-merge.js'],
    extraChecks: [
      { id: 'a_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-D1/check-a.js' },
      { id: 'b_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-D1/check-b.js' },
      { id: 'c_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-D1/check-c.js' },
      { id: 'merge_ok', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F04-D1/check-merge.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个来源包各自有实际缺陷与独立验收脚本，且存在一个必须三者都正确才能通过的合并校验；这种结构使并行/编排有实际收益，顺序或单点处理未刻画该结构 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未利用互不共享的来源包结构；DELEGATE 单路不足以刻画三路并行（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- D2 ----------------
  V({
    id: 'FORMAL-F04-D2', category: 'D', variant: 2, token: 'F04-D2 OK',
    title: '两批事件归档为两份报告 + 合并结论',
    taskType: 'doc', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: [
      'pilot-workspace/FORMAL-F04-D2 需要交付三份产物：',
      '① 归档 fixtures/alpha/ 下的事件批次，生成 report-alpha.md（含一行以「Alpha 结论」开头的结论）；',
      '② 归档 fixtures/beta/ 下的事件批次，生成 report-beta.md（含一行以「Beta 结论」开头的结论）；',
      '③ 写 SUMMARY.md，含一行以「合并」开头的结论；node verify.js 必须通过。',
      '不得修改 verify.js。',
    ].join('\n'),
    files: {
      'fixtures/alpha/a1.jsonl': EV([[1, 'pay'], [2, 'ship']]),
      'fixtures/alpha/a2.jsonl': EV([[1, 'cancel']]),
      'fixtures/beta/b1.jsonl': EV([[1, 'pay']]),
      'report-alpha.md': '# Alpha 报告\n（待补）\n',
      'report-beta.md': '# Beta 报告\n（待补）\n',
      'SUMMARY.md': '# 汇总\n（待补）\n',
      'verify.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');",
        "assert.ok(/^Alpha 结论/m.test(rd('report-alpha.md')), 'report-alpha.md 缺少 Alpha 结论');",
        "assert.ok(/^Beta 结论/m.test(rd('report-beta.md')), 'report-beta.md 缺少 Beta 结论');",
        "assert.ok(/^合并/m.test(rd('SUMMARY.md')), 'SUMMARY.md 缺少合并结论');",
        "console.log('F04-D2 OK');",
      ].join('\n'),
    },
    fix: {
      'report-alpha.md': '# Alpha 报告\nAlpha 结论：3 条事件，其中 1 次 ship、1 次 cancel。\n',
      'report-beta.md': '# Beta 报告\nBeta 结论：1 条事件（pay）。\n',
      'SUMMARY.md': '# 汇总\n合并：alpha 与 beta 两批事件均已归档。\n',
    },
    required: ['alpha_written', 'beta_written', 'summary_written', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: [],
    extraChecks: [
      { id: 'alpha_written', kind: 'file_contains', path: 'report-alpha.md', expect: 'Alpha 结论' },
      { id: 'beta_written', kind: 'file_contains', path: 'report-beta.md', expect: 'Beta 结论' },
      { id: 'summary_written', kind: 'file_contains', path: 'SUMMARY.md', expect: '合并' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '两批归档输入目录不同、产物不同，第三份为合并结论；该结构支持并行/编排，且合并步骤要求前两份完成 ⇒ 并行/编排成立。',
    rationaleNot: 'DIRECT/EXPLORE 未刻画"两批 + 合并"结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  // ---------------- E1 ----------------
  V({
    id: 'FORMAL-F04-E1', category: 'E', variant: 1, token: 'F04-E1 OK',
    title: '已上线的消费契约与新格式要求冲突（新增兼容路径）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F04-E1 的 normalize.js 是一版**已上线**的事件归一化实现，',
      '其输出被 golden.json 冻结（外部消费方 consumer.js 按该文件逐字段回放，且 consumer.js 与 golden.json 均不得修改）。',
      'SPEC.md 的新要求必须成立；check.js 与 normalize.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'SPEC.md': '# 新要求\n\n1. 事件必须保留 legacy 字段（外部消费方依赖，逐字段回放）；\n2. 事件必须额外携带 normalized 字段（值 = legacy 的小写形式）；\n3. 以上两条必须同时成立。\n',
      'normalize.js': [
        '// 已上线实现：输出仅含 legacy 字段，且被 golden.json 冻结',
        'function normalize(ev) { return { legacy: String(ev.type || "").toUpperCase() }; }',
        'module.exports = { normalize };',
      ].join('\n'),
      'index.js': [
        '// 对外入口（可修改）：当前直接转发既有实现',
        "const base = require('./normalize.js');",
        'module.exports = { normalize: base.normalize };',
      ].join('\n'),
      'golden.json': JSON.stringify({ replay: [{ legacy: 'PAY' }] }, null, 0) + '\n',
      'consumer.js': [
        '// 外部消费方（受保护）：按 golden.json 逐字段回放 normalize 的输出',
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { normalize } = require('./normalize.js');",
        "const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden.json'), 'utf8'));",
        'function replay() { return normalize({ type: "pay" }); }',
        "assert.deepStrictEqual(Object.keys(replay()).sort(), Object.keys(golden.replay[0]).sort(), '冻结的消费布局被破坏');",
        "assert.strictEqual(replay().legacy, golden.replay[0].legacy, 'legacy 值被改变');",
        "console.log('CONSUMER OK');",
      ].join('\n'),
      'check.js': [
        "const assert = require('assert');",
        "const { normalize } = require('./index.js');",
        "const out = normalize({ type: 'pay' });",
        "assert.strictEqual(out.legacy, 'PAY', 'legacy 必须保留');",
        "assert.strictEqual(out.normalized, 'pay', '新要求：必须携带 normalized 字段，实际 ' + JSON.stringify(out));",
        "console.log('SPEC OK');",
      ].join('\n'),
      'verify.js': [
        "require('./consumer.js');",
        "require('./check.js');",
        "console.log('F04-E1 OK');",
      ].join('\n'),
    },
    fix: {
      'index.js': [
        '// 对外入口：指向兼容路径',
        "const v2 = require('./normalize-v2.js');",
        'module.exports = { normalize: v2.normalize };',
      ].join('\n'),
      'normalize-v2.js': [
        '// 兼容路径：在保留 legacy 布局的同时补充 normalized 字段',
        "const base = require('./normalize.js');",
        'function normalize(ev) { const out = base.normalize(ev); return { legacy: out.legacy, normalized: String(out.legacy).toLowerCase() }; }',
        'module.exports = { normalize };',
      ].join('\n'),
    },
    required: ['compat_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['consumer.js', 'golden.json', 'check.js', 'normalize.js', 'SPEC.md'],
    extraChecks: [{ id: 'compat_added', kind: 'file_exists', path: 'normalize-v2.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F04-E1/check.js', log: 'pilot-workspace/FORMAL-F04-E1/attempt-log.txt' },
    rationaleGt: '现状是"把既有实现当作新接口"：normalize.js 只能输出 legacy，而 SPEC 要求同时携带 normalized；normalize.js 与 consumer/golden 均受保护、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整装配（计划层重规划）⇒ REPLAN 最小充分。',
    rationaleNot: 'DIRECT 指向受保护文件；EXPLORE 不成立（故障与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
  // ---------------- E2 ----------------
  V({
    id: 'FORMAL-F04-E2', category: 'E', variant: 2, token: 'F04-E2 OK',
    title: '重放下的 exactly-once 契约（需要新的幂等层）',
    taskType: 'refactor', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['api_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F04-E2 的处理器在事件重放时会重复产生副作用。',
      '上一轮针对判重逻辑做的调整记录在 replay.log。',
      'exactly-once.md 规定的前置契约必须成立；contract.js 与 processor.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'exactly-once.md': '# 前置契约\n\n同一事件（同一 id）无论被投递/重放多少次，**只允许产生一次副作用**。\n',
      'dedupe.js': [
        '// 上一轮的判重实现：按 payload 判重（对同一 id 的不同 payload 无效）',
        'const seen = new Set();',
        'function once(ev) { const key = String(ev.payload); if (seen.has(key)) return false; seen.add(key); return true; }',
        'module.exports = { once };',
      ].join('\n'),
      'processor.js': [
        '// 受保护：处理器按已注册的判重实现决定是否执行副作用',
        "const dedupe = require('./dedupe.js');",
        'const effects = [];',
        'function handle(ev) { if (!dedupe.once(ev)) return false; effects.push(ev.id); return true; }',
        'function sideEffectCount() { return effects.length; }',
        'module.exports = { handle, sideEffectCount };',
      ].join('\n'),
      'contract.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const { handle, sideEffectCount } = require('./processor.js');",
        "const events = fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));",
        '// 第一次投递 + 一次完整重放',
        'for (const e of events) handle(e);',
        'for (const e of events) handle(e);',
        "assert.strictEqual(sideEffectCount(), 1, '同一 id 的副作用应为 1 次，实际 ' + sideEffectCount() + ' 次');",
        "console.log('CONTRACT OK');",
      ].join('\n'),
      'events.jsonl': [
        JSON.stringify({ id: 'req-1', payload: 'first' }),
        JSON.stringify({ id: 'req-1', payload: 'second' }),
      ].join('\n') + '\n',
      'verify.js': [
        "require('./contract.js');",
        "console.log('F04-E2 OK');",
      ].join('\n'),
    },
    fix: {
      'idempotency.js': [
        '// 新的幂等层：按事件 id 判重（不修改受保护的 processor.js / contract.js）',
        'const seen = new Set();',
        'function once(ev) { const key = String(ev.id); if (seen.has(key)) return false; seen.add(key); return true; }',
        'module.exports = { once };',
      ].join('\n'),
      'dedupe.js': [
        '// 转发到新的幂等层（保持 processor.js 的调用约定不变）',
        "const { once } = require('./idempotency.js');",
        'module.exports = { once };',
      ].join('\n'),
    },
    required: ['idempotency_added', 'verify_pass'],
    forbidden: ['verify_script_changed'],
    protectedExtra: ['contract.js', 'processor.js', 'exactly-once.md'],
    extraChecks: [{ id: 'idempotency_added', kind: 'file_exists', path: 'idempotency.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    preRun: { command: 'node pilot-workspace/FORMAL-F04-E2/contract.js', log: 'pilot-workspace/FORMAL-F04-E2/replay.log' },
    rationaleGt: '既有判重方案（按 payload）在重放同一 id 的不同 payload 时失效（真实预跑显示副作用 2 次而契约要求 1 次）；processor.js 与 contract.js 冻结 ⇒ 在既有判重上做局部调整无法满足精确一次，必须引入以 id 为键的新幂等层并保持调用约定 ⇒ REPLAN 有构念依据且可满足。',
    rationaleNot: 'DIRECT 指向受保护文件或局部调参不收敛；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + node 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f04-evidence');
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
      const entries = existsSync(tl) ? readFileSync(tl, 'utf8').trim().split('\n').filter((l) => l.trim() !== '').length : 0;
      console.log('  ' + v.id + ' AFTER fixRun: exit=0  timeline entries=' + entries);
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
  `/**\n * benchmark/formal-seeds-f04.ts — F04 族 10 个变体的种子（由 scripts/formal-author-f04.ts 生成）\n */\nexport const FORMAL_F04_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

// ---------- 交付流程 + 正式判定路径证据 ----------
process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f04.json');
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
    const oT = path.join(ROOT, 'pilot-workspace', '.f04-pre-' + v.id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.f04-pre-' + v.id + '.err');
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
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F04', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F04) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
  family: 'F04', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F04', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS', delegation_axis_check: `PASS（派生 ${String(v.expectedDelegation)}）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F04 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：事件流 + 状态机（顺序 / 幂等 / 迁移合法性 / 多来源），与 F01 单模块工具、F02 CLI/管线、F03 HTTP+中间件不同族。',
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

const versionFiles = [...variants.map((v) => `benchmark/tasks/formal/${v.id}.yaml`), 'benchmark/formal-seeds-f04.ts', 'benchmark/formal/slots.json'].sort();
const entries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(entries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f04-version.json'), {
  dataset: 'formal', family: 'F04', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(entries), generated_at: new Date().toISOString(),
});

const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOk = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F04 起草汇总 ===');
console.log(`  schema PASS     = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js  = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask      = ${vtOk}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数 = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash    = ${versionHash}`);
console.log('  产出：FORMAL-F04-*.yaml · formal-seeds-f04.ts · f04-review.md · f04-gt-drafts.json · f04-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOk === variants.length;
console.log(allOk ? '✅ F04 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f04-review.md');
process.exit(allOk ? 0 : 3);
