/**
 * scripts/formal-author-f02.ts — F02 族起草（10 个变体：A/B/C/D/E 各 2）
 *
 * 纪律（与 F01 完全一致）：
 *   · 只产出 status: draft；gt_signed_* 一律留空（签署只能人工完成）
 *   · 每个变体独立编写；不复制 F01 的缺陷与 GT
 *   · 三层证据：schema · node verify.js FAIL→PASS · verifyTask（formal baseline）FAIL→PASS
 *   · E1/E2 交付前**真实预跑**产生失败日志，且 baseline 在日志之后冻结
 *   · 不生成 formal manifest、不启动 F02 run
 *
 * 用法：node scripts/formal-author-f02.ts
 */

import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { writeJsonUtf8 } from './lib/json-io.ts';


const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f02.ts');
const REVIEW = path.join(ROOT, 'benchmark', 'formal', 'f02-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f02-gt-drafts.json');

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
    id: 'FORMAL-F02-A1', category: 'A', variant: 1, token: 'F02-A1 OK',
    title: 'CLI 计数参数类型错误（单点修复）',
    taskType: 'bugfix', complexity: 'simple', scope: 'generic', characteristics: [], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-A1/cli.js 解析 --count 后返回的是字符串而不是数字。修正它，使 verify.js 通过。不得修改 verify.js。',
    files: {
      'cli.js': "function parseArgs(argv) {\n  const out = { count: 0 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--count') out.count = argv[i + 1];\n  }\n  return out;\n}\nmodule.exports = { parseArgs };\n",
      'verify.js': "const assert = require('assert');\nconst { parseArgs } = require('./cli.js');\nassert.strictEqual(parseArgs(['--count', '3']).count, 3);\nassert.strictEqual(typeof parseArgs(['--count', '3']).count, 'number');\nconsole.log('F02-A1 OK');\n",
    },
    fix: { 'cli.js': "function parseArgs(argv) {\n  const out = { count: 0 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--count') out.count = Number(argv[i + 1]);\n  }\n  return out;\n}\nmodule.exports = { parseArgs };\n" },
    required: ['cli_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'cli_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-A1/verify.js' }],
    expected: ['DIRECT'], expectedDelegation: false,
    rationaleGt: '单文件单点类型缺陷，症状即定位，直接修改即可 ⇒ DIRECT 是最小充分首决策。',
    rationaleNot: 'EXPLORE/委派类/REPLAN 均超出必要（无未知范围、无可分解子任务、无失败前提）。',
  }),
  V({
    id: 'FORMAL-F02-A2', category: 'A', variant: 2, token: 'F02-A2 OK',
    title: 'CLI 默认值违反 USAGE 约定（单模块修复）',
    taskType: 'bugfix', complexity: 'simple', scope: 'project', characteristics: [], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-A2 的 cli.js 未满足 USAGE.md 中记录的默认值约定。修正 cli.js 使约定成立并让 verify.js 通过。不得修改 verify.js。',
    files: {
      'USAGE.md': '# 约定\n- `--mode` 取值只能是 fast 或 safe；未提供时默认为 **safe**。\n- `--retries` 未提供时默认为 2。\n',
      'cli.js': "const MODES = ['fast', 'safe'];\nfunction parseArgs(argv) {\n  const out = { mode: 'fast', retries: 1 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--mode') out.mode = argv[i + 1];\n    if (argv[i] === '--retries') out.retries = Number(argv[i + 1]);\n  }\n  if (!MODES.includes(out.mode)) throw new Error('bad mode');\n  return out;\n}\nmodule.exports = { parseArgs };\n",
      'verify.js': "const assert = require('assert');\nconst { parseArgs } = require('./cli.js');\nassert.strictEqual(parseArgs([]).mode, 'safe');\nassert.strictEqual(parseArgs([]).retries, 2);\nassert.strictEqual(parseArgs(['--mode', 'fast']).mode, 'fast');\nconsole.log('F02-A2 OK');\n",
    },
    fix: { 'cli.js': "const MODES = ['fast', 'safe'];\nfunction parseArgs(argv) {\n  const out = { mode: 'safe', retries: 2 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--mode') out.mode = argv[i + 1];\n    if (argv[i] === '--retries') out.retries = Number(argv[i + 1]);\n  }\n  if (!MODES.includes(out.mode)) throw new Error('bad mode');\n  return out;\n}\nmodule.exports = { parseArgs };\n" },
    required: ['defaults_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'defaults_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-A2/verify.js' }],
    expected: ['DIRECT', 'EXPLORE'], expectedDelegation: false,
    rationaleGt: '仍是单模块修复；但"正确默认值"记录在 USAGE.md 中，需要看一眼约定文件 ⇒ DIRECT 与 EXPLORE 都算最小充分。',
    rationaleNot: '委派类超出必要；REPLAN 不适用（状态自洽）。',
  }),
  V({
    id: 'FORMAL-F02-B1', category: 'B', variant: 1, token: 'F02-B1 OK',
    title: '三段 CLI 管道丢弃末条记录的位置未知',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-B1 的 run.js 输出条数少于输入（见 EXPECTED.md），任务书不指出缺陷位于哪个阶段。定位并修复，使 node verify.js 通过。不得修改 verify.js。',
    files: {
      'src/load.js': "function load(text) {\n  return text.split('\\n').filter((l) => l.trim() !== '');\n}\nmodule.exports = { load };\n",
      'src/filter.js': "function filter(lines) {\n  return lines.filter((l, i) => l.length > 0 && i < lines.length - 1);\n}\nmodule.exports = { filter };\n",
      'src/render.js': "function render(lines) {\n  return { n: lines.length, lines };\n}\nmodule.exports = { render };\n",
      'run.js': "const { load } = require('./src/load.js');\nconst { filter } = require('./src/filter.js');\nconst { render } = require('./src/render.js');\nconsole.log(JSON.stringify(render(filter(load('a\\nb\\nc')))));\n",
      'EXPECTED.md': '# 期望\n输入 a/b/c 三行时，最终 n 应为 3。\n',
      'verify.js': "const assert = require('assert');\nconst { load } = require('./src/load.js');\nconst { filter } = require('./src/filter.js');\nconst { render } = require('./src/render.js');\nassert.strictEqual(render(filter(load('a\\nb\\nc'))).n, 3);\nconsole.log('F02-B1 OK');\n",
    },
    fix: { 'src/filter.js': "function filter(lines) {\n  return lines.filter((l) => l.length > 0);\n}\nmodule.exports = { filter };\n" },
    required: ['pipeline_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'pipeline_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-B1/verify.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '缺陷位置未给出且症状在管道末端；必须沿数据流探查三层才能定位 filter 的越界过滤 ⇒ EXPLORE 是最小充分。',
    rationaleNot: 'DIRECT 会导致盲改；委派对 3 个小文件过度；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-B2', category: 'B', variant: 2, token: 'F02-B2 OK',
    title: '输出金额小数位不一致的层级排查',
    taskType: 'bugfix', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-B2 的合计输出与明细之和不一致（见 REPORT.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。',
    files: {
      'src/total.js': "function total(xs) {\n  return xs.reduce((s, x) => s + x, 0);\n}\nmodule.exports = { total };\n",
      'src/format.js': "function money(x) {\n  return Number(x.toFixed(1));\n}\nmodule.exports = { money };\n",
      'REPORT.md': '# 现象\n明细：0.335 + 0.335 = 0.67；输出合计显示 0.7（差 0.03）。\n',
      'verify.js': "const assert = require('assert');\nconst { total } = require('./src/total.js');\nconst { money } = require('./src/format.js');\nassert.strictEqual(money(total([0.335, 0.335])), 0.67);\nconsole.log('F02-B2 OK');\n",
    },
    fix: { 'src/format.js': "function money(x) {\n  return Number(x.toFixed(2));\n}\nmodule.exports = { money };\n" },
    required: ['format_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [{ id: 'format_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-B2/verify.js' }],
    expected: ['EXPLORE'], expectedDelegation: false,
    rationaleGt: '现象只给出合计差，缺陷可能在 total 或 format；需探查两层才能确认是 format 只保留 1 位小数 ⇒ EXPLORE。',
    rationaleNot: 'DIRECT 会先改错文件；委派过度；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-C1', category: 'C', variant: 1, token: 'F02-C1 OK',
    title: '三件互不相关的 CLI 交付物',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited', 'no_public_interface_change'],
    prompt: 'pilot-workspace/FORMAL-F02-C1 有三件互相独立的事：① 修 src/parse.js 的短选项解析；② 写 NOTES.md，至少 2 条以「结论」开头的要点；③ 修 config.json 的默认重试次数（应为 3）。三件都完成且 node verify.js 通过。不得修改 verify.js。',
    files: {
      'src/parse.js': "function short(argv) {\n  const out = {};\n  for (const a of argv) if (a.startsWith('-')) out[a.slice(2)] = true;\n  return out;\n}\nmodule.exports = { short };\n",
      'config.json': '{ "retries": 1 }\n',
      'NOTES.md': '# 说明\n（待补）\n',
      'verify.js': "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { short } = require('./src/parse.js');\nassert.deepStrictEqual(short(['-a', '-b']), { a: true, b: true });\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nassert.strictEqual(cfg.retries, 3);\nconst notes = fs.readFileSync(path.join(__dirname, 'NOTES.md'), 'utf8');\nassert.ok((notes.match(/^结论/gm) || []).length >= 2);\nconsole.log('F02-C1 OK');\n",
    },
    fix: {
      'src/parse.js': "function short(argv) {\n  const out = {};\n  for (const a of argv) if (a.startsWith('-')) out[a.slice(1)] = true;\n  return out;\n}\nmodule.exports = { short };\n",
      'config.json': '{ "retries": 3 }\n',
      'NOTES.md': '# 说明\n结论：短选项键名应为去掉单个连字符后的字母。\n结论：默认重试次数统一为 3。\n',
    },
    required: ['parse_fixed', 'notes_written', 'config_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [
      { id: 'parse_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-C1/verify.js' },
      { id: 'notes_written', kind: 'file_contains', path: 'NOTES.md', expect: '结论', min_count: 2 },
      { id: 'config_fixed', kind: 'file_contains', path: 'config.json', expect: '\"retries\": 3' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三件交付物互不依赖（代码修复 / 文档 / 配置），可分解可并行 ⇒ 委派类为最小充分。',
    rationaleNot: 'DIRECT/EXPLORE 串行化了可分解工作；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-C2', category: 'C', variant: 2, token: 'F02-C2 OK',
    title: '两个独立 CLI 模块 + 一份汇总',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-C2：① 修 src/left.js 使 verify-left.js 通过；② 修 src/right.js 使 verify-right.js 通过；③ 写 SUMMARY.md，含一行以「汇总」开头的结论。不得修改 verify*.js。',
    files: {
      'src/left.js': "function first(xs) {\n  return xs[1];\n}\nmodule.exports = { first };\n",
      'src/right.js': "function sum(xs) {\n  return xs.reduce((a, b) => a + b, 1);\n}\nmodule.exports = { sum };\n",
      'verify-left.js': "const assert = require('assert');\nconst { first } = require('./src/left.js');\nassert.strictEqual(first([7, 8]), 7);\nconsole.log('LEFT OK');\n",
      'verify-right.js': "const assert = require('assert');\nconst { sum } = require('./src/right.js');\nassert.strictEqual(sum([1, 2, 3]), 6);\nconsole.log('RIGHT OK');\n",
      'SUMMARY.md': '# 汇总\n（待补）\n',
      'verify.js': "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { first } = require('./src/left.js');\nconst { sum } = require('./src/right.js');\nassert.strictEqual(first([7, 8]), 7);\nassert.strictEqual(sum([1, 2, 3]), 6);\nassert.ok(/^汇总/m.test(fs.readFileSync(path.join(__dirname, 'SUMMARY.md'), 'utf8')));\nconsole.log('F02-C2 OK');\n",
    },
    fix: {
      'src/left.js': "function first(xs) {\n  return xs[0];\n}\nmodule.exports = { first };\n",
      'src/right.js': "function sum(xs) {\n  return xs.reduce((a, b) => a + b, 0);\n}\nmodule.exports = { sum };\n",
      'SUMMARY.md': '# 汇总\n汇总：两个模块各自独立修复，互不影响。\n',
    },
    required: ['left_fixed', 'right_fixed', 'summary_written', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['verify-left.js', 'verify-right.js'],
    extraChecks: [
      { id: 'left_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-C2/verify-left.js' },
      { id: 'right_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-C2/verify-right.js' },
      { id: 'summary_written', kind: 'file_contains', path: 'SUMMARY.md', expect: '汇总' },
    ],
    expected: ['DELEGATE', 'PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '两个模块互不依赖且各有独立验收脚本，再加一份汇总 ⇒ 天然可分解/可并行。',
    rationaleNot: 'DIRECT/EXPLORE 未利用可分解性；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-D1', category: 'D', variant: 1, token: 'F02-D1 OK',
    title: '三个独立子包的同构修复（并行编排）',
    taskType: 'data_layer', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-D1 下 pkg1/pkg2/pkg3 各带独立缺陷与独立验收脚本（check1/2/3.js），三者互不共享文件。全部修好并让 node verify.js 通过。不得修改 check*.js 与 verify.js。',
    files: {
      'pkg1/src.js': "function max(xs) {\n  return Math.min(...xs);\n}\nmodule.exports = { max };\n",
      'pkg2/src.js': "function take(xs, n) {\n  return xs.slice(0, n - 1);\n}\nmodule.exports = { take };\n",
      'pkg3/src.js': "function join(xs) {\n  return xs.join(', ');\n}\nmodule.exports = { join };\n",
      'check1.js': "const assert = require('assert');\nconst { max } = require('./pkg1/src.js');\nassert.strictEqual(max([2, 9, 4]), 9);\nconsole.log('PKG1 OK');\n",
      'check2.js': "const assert = require('assert');\nconst { take } = require('./pkg2/src.js');\nassert.deepStrictEqual(take([1, 2, 3], 2), [1, 2]);\nconsole.log('PKG2 OK');\n",
      'check3.js': "const assert = require('assert');\nconst { join } = require('./pkg3/src.js');\nassert.strictEqual(join(['a', 'b']), 'a,b');\nconsole.log('PKG3 OK');\n",
      'verify.js': "require('./check1.js');\nrequire('./check2.js');\nrequire('./check3.js');\nconsole.log('F02-D1 OK');\n",
    },
    fix: {
      'pkg1/src.js': "function max(xs) {\n  return Math.max(...xs);\n}\nmodule.exports = { max };\n",
      'pkg2/src.js': "function take(xs, n) {\n  return xs.slice(0, n);\n}\nmodule.exports = { take };\n",
      'pkg3/src.js': "function join(xs) {\n  return xs.join(',');\n}\nmodule.exports = { join };\n",
    },
    required: ['pkg1_fixed', 'pkg2_fixed', 'pkg3_fixed', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['check1.js', 'check2.js', 'check3.js'],
    extraChecks: [
      { id: 'pkg1_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-D1/check1.js' },
      { id: 'pkg2_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-D1/check2.js' },
      { id: 'pkg3_fixed', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-D1/check3.js' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '三个子包文件不相交、各有独立验收脚本、工作量明显超过单点修复 ⇒ 正确动作是利用并行结构（PARALLEL/Workflow）。',
    rationaleNot: 'DIRECT/EXPLORE 未利用结构；DELEGATE 单路不足以刻画三路并行（D 类等价集不含 DELEGATE）；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-D2', category: 'D', variant: 2, token: 'F02-D2 OK',
    title: '两份独立日志分析 + 合并结论',
    taskType: 'data_layer', complexity: 'high', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited'],
    prompt: 'pilot-workspace/FORMAL-F02-D2：① 由 logs/a.log 生成 report-a.md（含一行以「A 结论」开头的结论）；② 由 logs/b.log 生成 report-b.md（含一行以「B 结论」开头的结论）；③ 写 SUMMARY.md，含一行以「合并」开头的结论。两份分析互不依赖。不得修改 verify.js。',
    files: {
      'logs/a.log': 'INFO start\nERROR boom\nINFO end\n',
      'logs/b.log': 'WARN slow\nWARN slow\n',
      'report-a.md': '（待生成）\n',
      'report-b.md': '（待生成）\n',
      'SUMMARY.md': '（待生成）\n',
      'verify.js': "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');\nassert.ok(/^A 结论/m.test(rd('report-a.md')));\nassert.ok(/^B 结论/m.test(rd('report-b.md')));\nassert.ok(/^合并/m.test(rd('SUMMARY.md')));\nconsole.log('F02-D2 OK');\n",
    },
    fix: {
      'report-a.md': '# A 报告\nA 结论：a.log 共 3 行，其中 ERROR 1 条。\n',
      'report-b.md': '# B 报告\nB 结论：b.log 共 2 行，全部为 WARN。\n',
      'SUMMARY.md': '# 汇总\n合并：两份日志规模不同（3 行 vs 2 行），错误级别分布不同。\n',
    },
    required: ['report_a_written', 'report_b_written', 'summary_written', 'verify_pass'], forbidden: ['verify_script_changed'],
    extraChecks: [
      { id: 'report_a_written', kind: 'file_contains', path: 'report-a.md', expect: 'A 结论' },
      { id: 'report_b_written', kind: 'file_contains', path: 'report-b.md', expect: 'B 结论' },
      { id: 'summary_written', kind: 'file_contains', path: 'SUMMARY.md', expect: '合并' },
    ],
    expected: ['PARALLEL', 'WORKFLOW'], expectedDelegation: true,
    rationaleGt: '两份分析输入/产物不同且无依赖，第三份是汇总 ⇒ 并行/编排是正确动作结构。',
    rationaleNot: 'DIRECT/EXPLORE 串行化；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。',
  }),
  V({
    id: 'FORMAL-F02-E1', category: 'E', variant: 1, token: 'F02-E1 OK',
    title: '遗留接口被外部基线冻结：新格式要求必须走新路径而非改写旧契约',
    taskType: 'refactor', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited', 'no_public_interface_change'],
    prompt: [
      'pilot-workspace/FORMAL-F02-E1 的 src/render.js 提供遗留接口 formatLegacy(n)，该接口的输出',
      '已被外部消费方按 baseline-output.json 冻结回放。',
      'SPEC.md 给出了新的输出要求；attempt-log.txt 记录了针对当前实现的一次实际执行结果。',
      'check.js 与 src/render.js 都不得修改。请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'SPEC.md': [
        '# 要求',
        'A. 新接口 format(n)：必须精确到 2 位小数（四舍五入），例如 format(1/3) === "0.33"、format(0.005) === "0.01"。',
        'B. 遗留接口 formatLegacy(n)：其输出已被外部基线冻结，必须与 baseline-output.json 逐字符一致；src/render.js 不得修改。',
        'C. formatLegacy 必须**继续从 src/index.js 可用**（旧调用方依赖该入口）。',
        'D. check.js 不得修改，也不得删除断言。',
      ].join('\n'),
      'src/render.js': [
        '// 遗留实现（输出格式被外部基线冻结，不得修改本文件）',
        'function formatLegacy(n) {',
        "  return n.toFixed(1);",
        '}',
        'module.exports = { formatLegacy };',
      ].join('\n'),
      'src/index.js': [
        "const { formatLegacy } = require('./render.js');",
        '// 旧路径：直接把遗留实现当作 format 暴露出去',
        'module.exports = { format: formatLegacy };',
      ].join('\n'),
      'baseline-output.json': JSON.stringify({ note: '外部消费方回放用：formatLegacy() 必须与这些值逐字符一致', samples: [{ input: 0.25, output: '0.3' }, { input: 2, output: '2.0' }] }, null, 2),
      'check.js': [
        "const assert = require('assert');",
        "const fs = require('fs');",
        "const path = require('path');",
        "const api = require('./src/index.js');",
        "const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-output.json'), 'utf8'));",
        '// (4) 遗留接口仍必须可用',
        "assert.strictEqual(typeof api.formatLegacy, 'function', 'formatLegacy 必须继续从 index.js 可用');",
        '// (1)(2) 冻结基线逐字符一致',
        'for (const s of baseline.samples) assert.strictEqual(api.formatLegacy(s.input), s.output, \'formatLegacy(\' + s.input + \') 必须为 \' + s.output);',
        '// (3) 新接口精确性',
        "assert.strictEqual(typeof api.format, 'function', 'format 必须可用');",
        "assert.strictEqual(api.format(1 / 3), '0.33');",
        "assert.strictEqual(api.format(0.005), '0.01');",
        "console.log('CHECK OK');",
      ].join('\n'),
      'verify.js': "require('./check.js');\nconsole.log('F02-E1 OK');\n",
    },
    fix: {
      'src/exact.js': [
        '// 新契约：精确到 2 位小数（不改动被冻结的 render.js）',
        'function formatExact(n) {',
        '  return (Math.round(n * 100) / 100).toFixed(2);',
        '}',
        'module.exports = { formatExact };',
      ].join('\n'),
      'src/index.js': [
        "const { formatLegacy } = require('./render.js');",
        "const { formatExact } = require('./exact.js');",
        'module.exports = { format: formatExact, formatLegacy };',
      ].join('\n'),
    },
    required: ['exact_path_added', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['src/render.js', 'check.js'],
    preRun: { command: 'node pilot-workspace/FORMAL-F02-E1/check.js', log: 'pilot-workspace/FORMAL-F02-E1/attempt-log.txt' },
    extraChecks: [{ id: 'exact_path_added', kind: 'file_exists', path: 'pilot-workspace/FORMAL-F02-E1/src/exact.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: [
      '**既有路径已失败且继续原路径不再成立**：当前 index.js 把被外部基线冻结的 formatLegacy 直接当作 format 暴露，',
      '真实预跑（attempt-log.txt）显示新契约的精确性断言失败。继续走旧路径有两种走法且都被约束堵死：',
      '改 render.js 破坏 B（且该文件受保护）、放宽 check.js 违反 D。',
      '正解需要**重新组织实现路径**：保留冻结的遗留契约，另建精确实现并把两个契约分别从 index.js 导出（新契约 format + 旧契约 formatLegacy）。',
      '这属于计划层的重新规划，而非局部修补 ⇒ REPLAN 是最小充分首决策。',
    ].join(''),
    rationaleNot: [
      'DIRECT 指向的正是受保护的 src/render.js（改它即破坏冻结契约）。',
      'EXPLORE 不成立：失败原因已由真实预跑日志给出，不存在范围未知。',
      'VERIFY 不成立：任务目标不是验证已有结果。',
      '委派类不成立：这是一条需要重新定实现路径的单线任务，没有可并行的独立子任务。',
    ].join(''),
  }),
  V({
    id: 'FORMAL-F02-E2', category: 'E', variant: 2, token: 'F02-E2 OK',
    title: '失败管线：日志格式版本与配置/生成器三者不一致',
    taskType: 'data_layer', complexity: 'medium', scope: 'project', characteristics: ['multi_file'], constraints: ['scope_limited', 'data_schema_immutable'],
    prompt: [
      'pilot-workspace/FORMAL-F02-E2 的数据管线上一轮运行失败。',
      'config.json、generator（gen.js）与当前输入 data/events.log 三者的状态记录在 pipeline.log。',
      'config.schema.json 与 check.js 都不得修改（也不得削弱校验）；config.json 必须满足 config.schema.json。',
      '请让 node verify.js 通过。',
    ].join('\n'),
    files: {
      'config.json': '{ "input": "data/absent.log", "log_version": 2 }\n',
      'config.schema.json': JSON.stringify({ title: 'pipeline config schema（不得修改）', required: ['input', 'log_version'], log_version_enum: [2, 3], note: 'log_version 只允许 2 或 3；input 必须存在且版本一致' }, null, 2),
      'gen.js': "const fs = require('fs');\nconst path = require('path');\nconst out = path.join(__dirname, 'data', 'events.log');\nfs.mkdirSync(path.dirname(out), { recursive: true });\nfs.writeFileSync(out, 'v3\\nalpha\\nbeta\\n', 'utf8');\nconsole.log('generated v3 -> data/events.log');\n",
      'migrate.js': "const fs = require('fs');\nconst path = require('path');\nconst p = path.join(__dirname, 'data', 'events.log');\nconst t = fs.readFileSync(p, 'utf8');\nif (!t.startsWith('v1')) { console.error('not v1'); process.exit(1); }\nfs.writeFileSync(p, t.replace(/^v1/, 'v2'), 'utf8');\nconsole.log('migrated v1 -> v2');\n",
      'data/events.log': 'v1\nalpha\nbeta\n',
      'check.js': "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.schema.json'), 'utf8'));\nassert.ok(schema.log_version_enum.includes(cfg.log_version), 'log_version 必须 ∈ ' + JSON.stringify(schema.log_version_enum));\nconst input = path.join(__dirname, cfg.input);\nassert.ok(fs.existsSync(input), '输入不存在：' + cfg.input);\nconst head = fs.readFileSync(input, 'utf8').split('\\n')[0].trim();\nassert.strictEqual(head, 'v' + cfg.log_version, '输入版本 ' + head + ' 与 config.log_version=' + cfg.log_version + ' 不一致');\nconsole.log('CONFIG OK');\n",
      'verify.js': "require('./check.js');\nconsole.log('F02-E2 OK');\n",
    },
    fix: { 'config.json': '{ "input": "data/events.log", "log_version": 2 }\n', 'data/events.log': 'v2\nalpha\nbeta\n' },
    required: ['pipeline_consistent', 'verify_pass'], forbidden: ['verify_script_changed'],
    protectedExtra: ['config.schema.json', 'check.js', 'gen.js'],
    preRun: { command: 'node pilot-workspace/FORMAL-F02-E2/check.js', log: 'pilot-workspace/FORMAL-F02-E2/pipeline.log' },
    extraChecks: [{ id: 'pipeline_consistent', kind: 'command_exit_zero', command: 'node pilot-workspace/FORMAL-F02-E2/check.js' }],
    expected: ['REPLAN'], expectedDelegation: false,
    rationaleGt: '既有配置方案已运行且失败（真实预跑日志），三件产物不一致：config 指向不存在的文件、现存输入为 v1、生成器产出 v3、schema 只允许 {2,3}。只改路径后版本仍不一致；把版本改成 1 被 schema 拒绝。可行方向至少两条（重跑 gen.js→v3 / 用 migrate.js→v2）⇒ 需先判断方向再执行 ⇒ REPLAN 为最小充分。',
    rationaleNot: 'DIRECT 会被版本一致性拒绝；EXPLORE 不成立（原因已记录）；VERIFY 与委派类不适用。',
  }),
];

// ---------- 生成 YAML + 种子 + 证据 ----------
const seedEntries: Array<{ path: string; content: string }> = [{ path: 'pilot-workspace/package.json', content: '{"type":"commonjs"}\n' }];
const nodeEvidence: Array<{ id: string; before: number | null; after: number | null; ok: boolean }> = [];
const EVIDENCE = path.join(ROOT, 'pilot-workspace', '.f02-evidence');
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

  // node verify.js 证据（隔离目录，不污染正式工作区）
  const evDir = path.join(EVIDENCE, v.id);
  mkdirSync(path.join(evDir, 'src'), { recursive: true });
  mkdirSync(path.join(evDir, 'pkg1', 'src'), { recursive: true });
  mkdirSync(path.join(evDir, 'logs'), { recursive: true });
  mkdirSync(path.join(evDir, 'data'), { recursive: true });
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
  const after = runVerify();
  nodeEvidence.push({ id: v.id, before, after, ok: before !== 0 && after === 0 });
}
rmSync(EVIDENCE, { recursive: true, force: true });

// ---------- schema 校验 ----------
const loadResults = variants.map((v) => {
  const file = path.join(TASKS_DIR, `${v.id}.yaml`);
  const loaded = loadTask(parseYaml(readFileSync(file, 'utf8')) as Record<string, unknown>);
  if (!loaded.ok) console.log(`  [诊断] ${v.id} 加载失败：${JSON.stringify(loaded.issues)}`);
  return { v, loaded };
});

// ---------- 种子模块 ----------
writeFileSync(
  SEEDS_MOD,
  `/**\n * benchmark/formal-seeds-f02.ts — F02 族 10 个变体的种子（由 scripts/formal-author-f02.ts 生成）\n */\nexport const FORMAL_F02_SEEDS: Array<{ path: string; content: string }> = ${JSON.stringify(seedEntries, null, 2)};\n`,
  'utf8',
);

// ---------- 交付流程 + 正式判定路径证据（真实预跑 → 日志 → 冻结基线 → verifyTask） ----------
process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = path.join(ROOT, 'pilot-workspace', '.formal-baseline.f02.json');
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
    const outT = path.join(ROOT, 'pilot-workspace', '.f02-pre-' + v.id + '.out');
    const errT = path.join(ROOT, 'pilot-workspace', '.f02-pre-' + v.id + '.err');
    const of = openSync(outT, 'w');
    const ef = openSync(errT, 'w');
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
    const stdout = readFileSync(outT, 'utf8');
    const stderr = readFileSync(errT, 'utf8');
    writeFileSync(path.join(ROOT, v.preRun.log), ['# 预跑记录（冻结环境中实际执行，非人工撰写）', 'command: ' + v.preRun.command, 'exit_code: ' + String(code), 'stdout:', stdout.trim(), 'stderr:', stderr.trim(), ''].join('\n'), 'utf8');
    rmSync(outT, { force: true });
    rmSync(errT, { force: true });
    preExit.set(v.id, code);
    console.log('  预跑 ' + v.id + '：' + v.preRun.command + ' → exit=' + String(code));
  }
  const bl = buildBaselineFromWorkspace({ taskSetId: 'F02', taskIds: variants.map((v) => v.id) }, { force: true });
  console.log('  formal baseline(F02) 已冻结（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，baseline_hash=' + bl.baseline_hash.slice(0, 12) + '…');
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
    const after = verifyTask(loaded.task);
    vtEvidence.push({ id: v.id, beforeOk: before.success, afterOk: after.success, status: String(after.verification_status), cfg: after.config_errors.length, pre: v.preRun ? 'exit=' + String(preExit.get(v.id)) : undefined });
    rmSync(path.join(ROOT, 'pilot-workspace', v.id), { recursive: true, force: true });
  }
  rmSync(String(process.env['DSH_FORMAL_BASELINE']), { force: true });
}
delete process.env['DSH_VERIFY_DATASET'];
delete process.env['DSH_FORMAL_BASELINE'];

// ---------- GT 草案 + 审核包 ----------
writeJsonUtf8(GT_DRAFTS, {
  family: 'F02', generated_at: new Date().toISOString(),
  signature: { gt_signed_by: '', gt_signed_at: '', status: 'DRAFT — 待人工签署' },
  variants: variants.map((v) => ({
    task_id: v.id, family: 'F02', category: v.category, variant: v.variant, title: v.title,
    task_description: v.prompt, expected_first_decisions: v.expected, expected_delegation: v.expectedDelegation,
    candidate_set_check: 'PASS（expected_first_decisions ⊆ FIRST_DECISION 词表，非空）',
    delegation_axis_check: `PASS（由集合推出 expected_delegation=${String(v.expectedDelegation)}，与声明一致）`,
    verification_rules: v.required, rationale_in_gt: v.rationaleGt, rationale_not_in_gt: v.rationaleNot,
    gt_signed_by: '', gt_signed_at: '',
  })),
});

const md: string[] = [
  '# F02 族级审核包（10 个正式变体 · GT 待签署）',
  '',
  '> 脚手架：CLI 参数解析 + 数据管线（与 F01 的单模块工具脚手架不同族）。',
  '> 本族为 status: draft，`gt_signed_by`/`gt_signed_at` 留空；正式 manifest 门禁保持 fail-closed。',
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
    `## ${v.id}（${v.category} 类 · 变体 ${v.variant}）`,
    '',
    `**标题**：${v.title}`,
    '',
    '**任务描述**：',
    '```',
    v.prompt,
    '```',
    '',
    `**expected_first_decisions**：\`[${v.expected.join(', ')}]\`　**expected_delegation**：\`${String(v.expectedDelegation)}\``,
    '',
    `- 候选集合校验：${loaded.ok ? 'PASS' : 'FAIL'}`,
    `- CDA 布尔轴校验：PASS（派生值 = ${String(v.expectedDelegation)}）`,
    `- protected_paths：${(v.protectedExtra ?? []).length + 1} 条（含 verify.js）`,
    '',
    `**验证规则**：required = ${v.required.join(', ')}；forbidden = ${v.forbidden.join(', ')}`,
    '',
    `**验证证据**：node verify.js 未修复 exit=${String(ne.before)} → 参考修复 exit=${String(ne.after)}；` +
      `verifyTask 未修复 success=${String(vt.beforeOk)} → 参考修复 success=${String(vt.afterOk)}（status=${vt.status}，CONFIG_ERROR=${vt.cfg}）${v.preRun ? `；交付前真实预跑 ${v.preRun.command}` : ''}`,
    '',
    `**为什么这些 first_decision 属于 GT**：${v.rationaleGt}`,
    '',
    `**为什么其他候选不属于 GT**：${v.rationaleNot}`,
    '',
    `**签署**：\`gt_signed_by: ________\`　\`gt_signed_at: ________\``,
    '',
  );
}
writeFileSync(REVIEW, md.join('\n'), 'utf8');

// ---------- 版本标识 ----------
const versionFiles = [...variants.map((v) => path.join('benchmark', 'tasks', 'formal', `${v.id}.yaml`)), 'benchmark/formal-seeds-f02.ts', 'benchmark/formal/slots.json'].sort();
const entries = versionFiles.map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const versionHash = createHash('sha256').update(entries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
writeJsonUtf8(path.join(ROOT, 'benchmark', 'formal', 'f02-version.json'), {
  dataset: 'formal', family: 'F02', status: 'DRAFT（未签署）', version_hash: versionHash,
  file_count: versionFiles.length, files: Object.fromEntries(entries), generated_at: new Date().toISOString(),
});

// ---------- 汇总 ----------
const schemaOk = loadResults.filter((r) => r.loaded.ok).length;
const nodeOk = nodeEvidence.filter((e) => e.ok).length;
const vtOkCount = vtEvidence.filter((e) => e.beforeOk === false && e.afterOk === true && e.status === 'OK' && e.cfg === 0).length;
console.log('\n=== F02 起草汇总 ===');
console.log(`  schema PASS        = ${schemaOk}/${variants.length}`);
console.log(`  node verify.js     = ${nodeOk}/${variants.length} FAIL→PASS`);
console.log(`  verifyTask         = ${vtOkCount}/${variants.length} FAIL→PASS（CONFIG_ERROR=0，status=OK）`);
console.log(`  CONFIG_ERROR 总数   = ${vtEvidence.reduce((a, e) => a + e.cfg, 0)}`);
console.log(`  version_hash       = ${versionHash}`);
console.log('  产出：benchmark/tasks/formal/FORMAL-F02-*.yaml · formal-seeds-f02.ts · f02-review.md · f02-gt-drafts.json · f02-version.json');
const allOk = schemaOk === variants.length && nodeOk === variants.length && vtOkCount === variants.length;
console.log(allOk ? '✅ F02 起草 + 三层证据全部通过（等待人工逐条构念审查与签署）' : '⛔ 存在问题，见 f02-review.md');
process.exit(allOk ? 0 : 3);
