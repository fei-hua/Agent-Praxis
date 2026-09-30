/**
 * benchmark/formal-seeds-f02.ts — F02 族 10 个变体的种子（由 scripts/formal-author-f02.ts 生成）
 */
export const FORMAL_F02_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-A1/cli.js",
    "content": "function parseArgs(argv) {\n  const out = { count: 0 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--count') out.count = argv[i + 1];\n  }\n  return out;\n}\nmodule.exports = { parseArgs };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-A1/verify.js",
    "content": "const assert = require('assert');\nconst { parseArgs } = require('./cli.js');\nassert.strictEqual(parseArgs(['--count', '3']).count, 3);\nassert.strictEqual(typeof parseArgs(['--count', '3']).count, 'number');\nconsole.log('F02-A1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-A2/USAGE.md",
    "content": "# 约定\n- `--mode` 取值只能是 fast 或 safe；未提供时默认为 **safe**。\n- `--retries` 未提供时默认为 2。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-A2/cli.js",
    "content": "const MODES = ['fast', 'safe'];\nfunction parseArgs(argv) {\n  const out = { mode: 'fast', retries: 1 };\n  for (let i = 0; i < argv.length; i++) {\n    if (argv[i] === '--mode') out.mode = argv[i + 1];\n    if (argv[i] === '--retries') out.retries = Number(argv[i + 1]);\n  }\n  if (!MODES.includes(out.mode)) throw new Error('bad mode');\n  return out;\n}\nmodule.exports = { parseArgs };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-A2/verify.js",
    "content": "const assert = require('assert');\nconst { parseArgs } = require('./cli.js');\nassert.strictEqual(parseArgs([]).mode, 'safe');\nassert.strictEqual(parseArgs([]).retries, 2);\nassert.strictEqual(parseArgs(['--mode', 'fast']).mode, 'fast');\nconsole.log('F02-A2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/src/load.js",
    "content": "function load(text) {\n  return text.split('\\n').filter((l) => l.trim() !== '');\n}\nmodule.exports = { load };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/src/filter.js",
    "content": "function filter(lines) {\n  return lines.filter((l, i) => l.length > 0 && i < lines.length - 1);\n}\nmodule.exports = { filter };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/src/render.js",
    "content": "function render(lines) {\n  return { n: lines.length, lines };\n}\nmodule.exports = { render };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/run.js",
    "content": "const { load } = require('./src/load.js');\nconst { filter } = require('./src/filter.js');\nconst { render } = require('./src/render.js');\nconsole.log(JSON.stringify(render(filter(load('a\\nb\\nc')))));\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/EXPECTED.md",
    "content": "# 期望\n输入 a/b/c 三行时，最终 n 应为 3。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B1/verify.js",
    "content": "const assert = require('assert');\nconst { load } = require('./src/load.js');\nconst { filter } = require('./src/filter.js');\nconst { render } = require('./src/render.js');\nassert.strictEqual(render(filter(load('a\\nb\\nc'))).n, 3);\nconsole.log('F02-B1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B2/src/total.js",
    "content": "function total(xs) {\n  return xs.reduce((s, x) => s + x, 0);\n}\nmodule.exports = { total };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B2/src/format.js",
    "content": "function money(x) {\n  return Number(x.toFixed(1));\n}\nmodule.exports = { money };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B2/REPORT.md",
    "content": "# 现象\n明细：0.335 + 0.335 = 0.67；输出合计显示 0.7（差 0.03）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-B2/verify.js",
    "content": "const assert = require('assert');\nconst { total } = require('./src/total.js');\nconst { money } = require('./src/format.js');\nassert.strictEqual(money(total([0.335, 0.335])), 0.67);\nconsole.log('F02-B2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C1/src/parse.js",
    "content": "function short(argv) {\n  const out = {};\n  for (const a of argv) if (a.startsWith('-')) out[a.slice(2)] = true;\n  return out;\n}\nmodule.exports = { short };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C1/config.json",
    "content": "{ \"retries\": 1 }\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C1/NOTES.md",
    "content": "# 说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { short } = require('./src/parse.js');\nassert.deepStrictEqual(short(['-a', '-b']), { a: true, b: true });\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nassert.strictEqual(cfg.retries, 3);\nconst notes = fs.readFileSync(path.join(__dirname, 'NOTES.md'), 'utf8');\nassert.ok((notes.match(/^结论/gm) || []).length >= 2);\nconsole.log('F02-C1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/src/left.js",
    "content": "function first(xs) {\n  return xs[1];\n}\nmodule.exports = { first };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/src/right.js",
    "content": "function sum(xs) {\n  return xs.reduce((a, b) => a + b, 1);\n}\nmodule.exports = { sum };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/verify-left.js",
    "content": "const assert = require('assert');\nconst { first } = require('./src/left.js');\nassert.strictEqual(first([7, 8]), 7);\nconsole.log('LEFT OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/verify-right.js",
    "content": "const assert = require('assert');\nconst { sum } = require('./src/right.js');\nassert.strictEqual(sum([1, 2, 3]), 6);\nconsole.log('RIGHT OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/SUMMARY.md",
    "content": "# 汇总\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { first } = require('./src/left.js');\nconst { sum } = require('./src/right.js');\nassert.strictEqual(first([7, 8]), 7);\nassert.strictEqual(sum([1, 2, 3]), 6);\nassert.ok(/^汇总/m.test(fs.readFileSync(path.join(__dirname, 'SUMMARY.md'), 'utf8')));\nconsole.log('F02-C2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/pkg1/src.js",
    "content": "function max(xs) {\n  return Math.min(...xs);\n}\nmodule.exports = { max };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/pkg2/src.js",
    "content": "function take(xs, n) {\n  return xs.slice(0, n - 1);\n}\nmodule.exports = { take };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/pkg3/src.js",
    "content": "function join(xs) {\n  return xs.join(', ');\n}\nmodule.exports = { join };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/check1.js",
    "content": "const assert = require('assert');\nconst { max } = require('./pkg1/src.js');\nassert.strictEqual(max([2, 9, 4]), 9);\nconsole.log('PKG1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/check2.js",
    "content": "const assert = require('assert');\nconst { take } = require('./pkg2/src.js');\nassert.deepStrictEqual(take([1, 2, 3], 2), [1, 2]);\nconsole.log('PKG2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/check3.js",
    "content": "const assert = require('assert');\nconst { join } = require('./pkg3/src.js');\nassert.strictEqual(join(['a', 'b']), 'a,b');\nconsole.log('PKG3 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D1/verify.js",
    "content": "require('./check1.js');\nrequire('./check2.js');\nrequire('./check3.js');\nconsole.log('F02-D1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/logs/a.log",
    "content": "INFO start\nERROR boom\nINFO end\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/logs/b.log",
    "content": "WARN slow\nWARN slow\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/report-a.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/report-b.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/SUMMARY.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');\nassert.ok(/^A 结论/m.test(rd('report-a.md')));\nassert.ok(/^B 结论/m.test(rd('report-b.md')));\nassert.ok(/^合并/m.test(rd('SUMMARY.md')));\nconsole.log('F02-D2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/SPEC.md",
    "content": "# 要求\nA. 新接口 format(n)：必须精确到 2 位小数（四舍五入），例如 format(1/3) === \"0.33\"、format(0.005) === \"0.01\"。\nB. 遗留接口 formatLegacy(n)：其输出已被外部基线冻结，必须与 baseline-output.json 逐字符一致；src/render.js 不得修改。\nC. formatLegacy 必须**继续从 src/index.js 可用**（旧调用方依赖该入口）。\nD. check.js 不得修改，也不得删除断言。"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/src/render.js",
    "content": "// 遗留实现（输出格式被外部基线冻结，不得修改本文件）\nfunction formatLegacy(n) {\n  return n.toFixed(1);\n}\nmodule.exports = { formatLegacy };"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/src/index.js",
    "content": "const { formatLegacy } = require('./render.js');\n// 旧路径：直接把遗留实现当作 format 暴露出去\nmodule.exports = { format: formatLegacy };"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/baseline-output.json",
    "content": "{\n  \"note\": \"外部消费方回放用：formatLegacy() 必须与这些值逐字符一致\",\n  \"samples\": [\n    {\n      \"input\": 0.25,\n      \"output\": \"0.3\"\n    },\n    {\n      \"input\": 2,\n      \"output\": \"2.0\"\n    }\n  ]\n}"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/check.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst api = require('./src/index.js');\nconst baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-output.json'), 'utf8'));\n// (4) 遗留接口仍必须可用\nassert.strictEqual(typeof api.formatLegacy, 'function', 'formatLegacy 必须继续从 index.js 可用');\n// (1)(2) 冻结基线逐字符一致\nfor (const s of baseline.samples) assert.strictEqual(api.formatLegacy(s.input), s.output, 'formatLegacy(' + s.input + ') 必须为 ' + s.output);\n// (3) 新接口精确性\nassert.strictEqual(typeof api.format, 'function', 'format 必须可用');\nassert.strictEqual(api.format(1 / 3), '0.33');\nassert.strictEqual(api.format(0.005), '0.01');\nconsole.log('CHECK OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E1/verify.js",
    "content": "require('./check.js');\nconsole.log('F02-E1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/config.json",
    "content": "{ \"input\": \"data/absent.log\", \"log_version\": 2 }\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/config.schema.json",
    "content": "{\n  \"title\": \"pipeline config schema（不得修改）\",\n  \"required\": [\n    \"input\",\n    \"log_version\"\n  ],\n  \"log_version_enum\": [\n    2,\n    3\n  ],\n  \"note\": \"log_version 只允许 2 或 3；input 必须存在且版本一致\"\n}"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/gen.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst out = path.join(__dirname, 'data', 'events.log');\nfs.mkdirSync(path.dirname(out), { recursive: true });\nfs.writeFileSync(out, 'v3\\nalpha\\nbeta\\n', 'utf8');\nconsole.log('generated v3 -> data/events.log');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/migrate.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst p = path.join(__dirname, 'data', 'events.log');\nconst t = fs.readFileSync(p, 'utf8');\nif (!t.startsWith('v1')) { console.error('not v1'); process.exit(1); }\nfs.writeFileSync(p, t.replace(/^v1/, 'v2'), 'utf8');\nconsole.log('migrated v1 -> v2');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/data/events.log",
    "content": "v1\nalpha\nbeta\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/check.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.schema.json'), 'utf8'));\nassert.ok(schema.log_version_enum.includes(cfg.log_version), 'log_version 必须 ∈ ' + JSON.stringify(schema.log_version_enum));\nconst input = path.join(__dirname, cfg.input);\nassert.ok(fs.existsSync(input), '输入不存在：' + cfg.input);\nconst head = fs.readFileSync(input, 'utf8').split('\\n')[0].trim();\nassert.strictEqual(head, 'v' + cfg.log_version, '输入版本 ' + head + ' 与 config.log_version=' + cfg.log_version + ' 不一致');\nconsole.log('CONFIG OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F02-E2/verify.js",
    "content": "require('./check.js');\nconsole.log('F02-E2 OK');\n"
  }
];
