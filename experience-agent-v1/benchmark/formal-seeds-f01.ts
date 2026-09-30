/**
 * benchmark/formal-seeds-f01.ts — F01 族 10 个正式变体的种子（由 scripts/formal-author-f01.ts 生成）
 * 纪律：每个变体的种子独立编写；不含任何 Pilot 锚点的 GT 或内容。
 */
export const FORMAL_F01_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-A1/src/math.js",
    "content": "function sum(xs) {\n  let t = 0;\n  for (const x of xs) t -= x;\n  return t;\n}\nfunction mean(xs) {\n  return sum(xs) / xs.length;\n}\nmodule.exports = { sum, mean };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-A1/verify.js",
    "content": "const assert = require('assert');\nconst { sum, mean } = require('./src/math.js');\nassert.strictEqual(sum([1, 2, 3]), 6);\nassert.strictEqual(mean([2, 4]), 3);\nconsole.log('F01-A1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-A2/src/format.js",
    "content": "function titleCase(s) {\n  return s.charAt(0).toUpperCase() + s.slice(1);\n}\nfunction slug(s) {\n  return s.trim().toLowerCase().replace(/\\s+/g, '-');\n}\nmodule.exports = { titleCase, slug };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-A2/src/usage.js",
    "content": "// 约定：title-case 必须把连字符分隔的每个词首字母大写\n//   titleCase('hello-world') === 'Hello-World'\n//   titleCase('a b') === 'A B'\nmodule.exports = {};\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-A2/verify.js",
    "content": "const assert = require('assert');\nconst { titleCase, slug } = require('./src/format.js');\nassert.strictEqual(titleCase('hello-world'), 'Hello-World');\nassert.strictEqual(titleCase('a b'), 'A B');\nassert.strictEqual(slug('  Hello World '), 'hello-world');\nconsole.log('F01-A2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/src/load.js",
    "content": "function load(raw) {\n  return raw.split(',').map((s) => s.trim()).filter((s) => s !== '');\n}\nmodule.exports = { load };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/src/normalize.js",
    "content": "function normalize(xs) {\n  return xs.map((x) => x.toLowerCase()).filter((x) => x.length >= 0 && x.startsWith('a'));\n}\nmodule.exports = { normalize };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/src/summarize.js",
    "content": "function summarize(xs) {\n  return { count: xs.length, items: xs };\n}\nmodule.exports = { summarize };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/test.js",
    "content": "const { load } = require('./src/load.js');\nconst { normalize } = require('./src/normalize.js');\nconst { summarize } = require('./src/summarize.js');\nconst r = summarize(normalize(load('alpha, beta, gamma')));\nconsole.log('count=' + r.count);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/EXPECTED.md",
    "content": "# 期望\n输入 'alpha, beta, gamma' 经 load → normalize → summarize 后 count 应为 3。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B1/verify.js",
    "content": "const assert = require('assert');\nconst { load } = require('./src/load.js');\nconst { normalize } = require('./src/normalize.js');\nconst { summarize } = require('./src/summarize.js');\nconst r = summarize(normalize(load('alpha, beta, gamma')));\nassert.strictEqual(r.count, 3);\nconsole.log('F01-B1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B2/src/calc.js",
    "content": "function lineTotal(qty, price) {\n  return qty * price;\n}\nfunction total(lines) {\n  return lines.reduce((s, l) => s + lineTotal(l.qty, l.price), 0);\n}\nmodule.exports = { lineTotal, total };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B2/src/fmt.js",
    "content": "function money(x) {\n  return Math.round(x * 10) / 10;\n}\nmodule.exports = { money };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B2/REPORT.md",
    "content": "# 现象\n明细：3 × 0.335 = 1.005；两行明细合计应为 2.01，但页面显示 2.0（差 0.01）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-B2/verify.js",
    "content": "const assert = require('assert');\nconst { total } = require('./src/calc.js');\nconst { money } = require('./src/fmt.js');\nassert.strictEqual(money(total([{ qty: 3, price: 0.335 }, { qty: 3, price: 0.335 }])), 2.01);\nconsole.log('F01-B2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C1/src/calc.js",
    "content": "function discount(price, pct) {\n  return price - (price * pct) / 10;\n}\nmodule.exports = { discount };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C1/config.json",
    "content": "{ \"threshold\": 10 }\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C1/NOTES.md",
    "content": "# 说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { discount } = require('./src/calc.js');\nassert.strictEqual(discount(100, 20), 80);\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nassert.strictEqual(cfg.threshold, 100);\nconst notes = fs.readFileSync(path.join(__dirname, 'NOTES.md'), 'utf8');\nassert.ok((notes.match(/^结论/gm) || []).length >= 2, 'NOTES.md 需至少 2 条以「结论」开头的要点');\nconsole.log('F01-C1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/src/left.js",
    "content": "function last(xs) {\n  return xs[xs.length];\n}\nmodule.exports = { last };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/src/right.js",
    "content": "function uniq(xs) {\n  return xs;\n}\nmodule.exports = { uniq };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/verify-left.js",
    "content": "const assert = require('assert');\nconst { last } = require('./src/left.js');\nassert.strictEqual(last([1, 2, 3]), 3);\nconsole.log('LEFT OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/verify-right.js",
    "content": "const assert = require('assert');\nconst { uniq } = require('./src/right.js');\nassert.deepStrictEqual(uniq([1, 1, 2]), [1, 2]);\nconsole.log('RIGHT OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/SUMMARY.md",
    "content": "# 汇总\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { last } = require('./src/left.js');\nconst { uniq } = require('./src/right.js');\nassert.strictEqual(last([1, 2, 3]), 3);\nassert.deepStrictEqual(uniq([1, 1, 2]), [1, 2]);\nassert.ok(/^汇总/m.test(fs.readFileSync(path.join(__dirname, 'SUMMARY.md'), 'utf8')));\nconsole.log('F01-C2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/pkg1/src.js",
    "content": "function clamp(v, lo, hi) {\n  return Math.min(lo, Math.max(hi, v));\n}\nmodule.exports = { clamp };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/pkg2/src.js",
    "content": "function chunk(xs, n) {\n  const out = [];\n  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n + 1));\n  return out;\n}\nmodule.exports = { chunk };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/pkg3/src.js",
    "content": "function sumBy(xs, f) {\n  return xs.reduce((s, x) => s + f(x), 1);\n}\nmodule.exports = { sumBy };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/check1.js",
    "content": "const assert = require('assert');\nconst { clamp } = require('./pkg1/src.js');\nassert.strictEqual(clamp(5, 0, 10), 5);\nassert.strictEqual(clamp(-1, 0, 10), 0);\nassert.strictEqual(clamp(99, 0, 10), 10);\nconsole.log('PKG1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/check2.js",
    "content": "const assert = require('assert');\nconst { chunk } = require('./pkg2/src.js');\nassert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);\nconsole.log('PKG2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/check3.js",
    "content": "const assert = require('assert');\nconst { sumBy } = require('./pkg3/src.js');\nassert.strictEqual(sumBy([1, 2, 3], (x) => x), 6);\nconsole.log('PKG3 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D1/verify.js",
    "content": "require('./check1.js');\nrequire('./check2.js');\nrequire('./check3.js');\nconsole.log('F01-D1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/data/a.csv",
    "content": "k,v\nx,1\ny,2\nz,3\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/data/b.csv",
    "content": "k,v\np,10\nq,20\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/report-a.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/report-b.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/SUMMARY.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');\nassert.ok(/^A 结论/m.test(rd('report-a.md')), 'report-a.md 需含「A 结论」开头的行');\nassert.ok(/^B 结论/m.test(rd('report-b.md')), 'report-b.md 需含「B 结论」开头的行');\nassert.ok(/^合并/m.test(rd('SUMMARY.md')), 'SUMMARY.md 需含「合并」开头的行');\nconsole.log('F01-D2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E1/src/index.js",
    "content": "const { average } = require('./stats.js');\nfunction summarize(xs) {\n  return { avg: average(xs), n: xs.length };\n}\nmodule.exports = { summarize };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E1/SPEC.md",
    "content": "# stats.js 规格\n- 导出 average(xs)：返回算术平均；空数组返回 0。\n- 仅使用 CommonJS（module.exports）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E1/verify.js",
    "content": "const assert = require('assert');\nconst { summarize } = require('./src/index.js');\nassert.deepStrictEqual(summarize([2, 4]), { avg: 3, n: 2 });\nassert.deepStrictEqual(summarize([]), { avg: 0, n: 0 });\nconsole.log('F01-E1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E2/config.json",
    "content": "{ \"input\": \"data/missing.txt\" }\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E2/data/input.txt",
    "content": "payload\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E2/check.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nif (!fs.existsSync(path.join(__dirname, cfg.input))) {\n  console.error('输入不存在：' + cfg.input);\n  process.exit(1);\n}\nconsole.log('CONFIG OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E2/verify.js",
    "content": "require('./check.js');\nconsole.log('F01-E2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F01-E2/asserts.txt",
    "content": "# 必须保持的断言（verify.js 之外另存一份，供人工核对）\nassert(1)\nassert(2)\nassert(3)\n"
  }
];
