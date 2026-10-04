/**
 * benchmark/formal-seeds-f03.ts — F03 族 10 个变体的种子（由 scripts/formal-author-f03.ts 生成）
 */
export const FORMAL_F03_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A1/handlers/status.js",
    "content": "function handle(req) {\n  if (req.path === '/health') return { code: 200, body: 'ok' };\n  return { code: 200, body: 'not found' };\n}\nmodule.exports = { handle };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A1/verify.js",
    "content": "const assert = require('assert');\nconst { handle } = require('./handlers/status.js');\nassert.strictEqual(handle({ path: '/health' }).code, 200);\nassert.strictEqual(handle({ path: '/nope' }).code, 404);\nconsole.log('F03-A1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/ARCHITECTURE.md",
    "content": "# 约定\n中间件执行顺序必须为：parse → auth → handler。\n（auth 不得在 parse 之前执行）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/mw/parse.js",
    "content": "module.exports = { name: 'parse', run: (ctx) => { ctx.parsed = true; return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/mw/auth.js",
    "content": "module.exports = { name: 'auth', run: (ctx) => { if (!ctx.parsed) throw new Error('auth before parse'); return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/mw/handler.js",
    "content": "module.exports = { name: 'handler', run: (ctx) => { ctx.done = true; return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/chain.js",
    "content": "const parse = require('./mw/parse.js');\nconst auth = require('./mw/auth.js');\nconst handler = require('./mw/handler.js');\nconst CHAIN = [auth, parse, handler];\nfunction run(ctx) {\n  return CHAIN.reduce((c, m) => m.run(c), ctx);\n}\nmodule.exports = { CHAIN, run };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-A2/verify.js",
    "content": "const assert = require('assert');\nconst { CHAIN, run } = require('./chain.js');\nassert.deepStrictEqual(CHAIN.map((m) => m.name), ['parse', 'auth', 'handler']);\nassert.strictEqual(run({}).done, true);\nconsole.log('F03-A2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/mw/parse.js",
    "content": "module.exports = { name: 'parse', run: (ctx) => { ctx.req = { id: 'r-1', path: '/x' }; return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/mw/enrich.js",
    "content": "module.exports = { name: 'enrich', run: (ctx) => { ctx.res = { request_id: null, path: ctx.req.path }; return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/mw/handler.js",
    "content": "module.exports = { name: 'handler', run: (ctx) => { ctx.done = true; return ctx; } };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/chain.js",
    "content": "const parse = require('./mw/parse.js');\nconst enrich = require('./mw/enrich.js');\nconst handler = require('./mw/handler.js');\nfunction run(ctx) {\n  return [parse, enrich, handler].reduce((c, m) => m.run(c), ctx);\n}\nmodule.exports = { run };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/EXPECTED.md",
    "content": "# 期望\n最终响应 request_id 应为 \"r-1\"（来自请求）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B1/verify.js",
    "content": "const assert = require('assert');\nconst { run } = require('./chain.js');\nassert.strictEqual(run({}).res.request_id, 'r-1');\nconsole.log('F03-B1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B2/serialize.js",
    "content": "function serialize(res) {\n  const keys = ['code', 'body'];\n  const out = {};\n  for (const k of keys) out[k] = res[k];\n  return JSON.stringify(out);\n}\nmodule.exports = { serialize };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B2/handlers/echo.js",
    "content": "function handle(req) {\n  return { code: 200, body: req.body, extra: 'x' };\n}\nmodule.exports = { handle };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B2/REPORT.md",
    "content": "# 现象\n期望快照：{\"code\":200,\"body\":\"hi\",\"extra\":\"x\"}；实际输出缺少 extra。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-B2/verify.js",
    "content": "const assert = require('assert');\nconst { serialize } = require('./serialize.js');\nconst { handle } = require('./handlers/echo.js');\nassert.strictEqual(serialize(handle({ body: 'hi' })), JSON.stringify({ code: 200, body: 'hi', extra: 'x' }));\nconsole.log('F03-B2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/work/branch-a.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-a\";\nconst token = \"TA-9f21\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/work/branch-b.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-b\";\nconst token = \"TB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/work/branch-c.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-c\";\nconst token = \"TC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');\nassert.ok(fs.existsSync(path.join(__dirname, 'timeline.jsonl')), '缺少 timeline.jsonl（分支工具未运行）');\nconst entries = rd('timeline.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, '分支记录不足 3 条，实际 ' + entries.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nfor (const e of entries) {\n  const art = 'out/' + e.branch + '.txt';\n  assert.ok(fs.existsSync(path.join(__dirname, art)), '缺少分支产物 ' + art);\n  assert.ok(rd(art).includes(e.token), '分支产物 token 不匹配：' + art);\n}\nassert.ok(/^集成/m.test(rd('INTEGRATION.md')), 'INTEGRATION.md 缺少集成结论');\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(JSON.stringify({ span, budget: BUDGET_MS, entries: entries.length }));\nconsole.log(\"F03-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/check-timeline.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, 'timeline 记录不足 3 条，实际 ' + entries.length);\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number' && typeof e.token === 'string', 'timeline 记录字段非法');\n  assert.ok(typeof e.branch === 'string' && e.branch.length > 0, 'timeline 记录缺少 branch');\n  const art = path.join(__dirname, 'out', e.branch + '.txt');\n  assert.ok(fs.existsSync(art), '缺少分支产物 out/' + e.branch + '.txt');\n  assert.ok(fs.readFileSync(art, 'utf8').includes(e.token), '分支产物 token 不匹配：' + e.branch);\n}\nconst branches = Array.from(new Set(entries.map((e) => e.branch)));\nassert.ok(branches.length >= 3, '分支种类不足 3，实际 ' + branches.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK entries=' + entries.length + ' branches=' + branches.length + ' span=' + span + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/work/branch-x.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-x\";\nconst token = \"TX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3500);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/work/branch-y.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-y\";\nconst token = \"TY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3200);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/work/branch-z.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst BRANCH = \"branch-z\";\nconst token = \"TZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ branch: BRANCH, start, end, token }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', BRANCH + '.txt'), token + '\\n');\nconsole.log(BRANCH + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');\nassert.ok(fs.existsSync(path.join(__dirname, 'timeline.jsonl')), '缺少 timeline.jsonl（分支工具未运行）');\nconst entries = rd('timeline.jsonl').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, '分支记录不足 3 条，实际 ' + entries.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nfor (const e of entries) {\n  const art = 'out/' + e.branch + '.txt';\n  assert.ok(fs.existsSync(path.join(__dirname, art)), '缺少分支产物 ' + art);\n  assert.ok(rd(art).includes(e.token), '分支产物 token 不匹配：' + art);\n}\nassert.ok(/^集成/m.test(rd('INTEGRATION.md')), 'INTEGRATION.md 缺少集成结论');\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(JSON.stringify({ span, budget: BUDGET_MS, entries: entries.length }));\nconsole.log(\"F03-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/check-timeline.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= 3, 'timeline 记录不足 3 条，实际 ' + entries.length);\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number' && typeof e.token === 'string', 'timeline 记录字段非法');\n  assert.ok(typeof e.branch === 'string' && e.branch.length > 0, 'timeline 记录缺少 branch');\n  const art = path.join(__dirname, 'out', e.branch + '.txt');\n  assert.ok(fs.existsSync(art), '缺少分支产物 out/' + e.branch + '.txt');\n  assert.ok(fs.readFileSync(art, 'utf8').includes(e.token), '分支产物 token 不匹配：' + e.branch);\n}\nconst branches = Array.from(new Set(entries.map((e) => e.branch)));\nassert.ok(branches.length >= 3, '分支种类不足 3，实际 ' + branches.length);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK entries=' + entries.length + ' branches=' + branches.length + ' span=' + span + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/svc-auth/src.js",
    "content": "function allow(role) {\n  return role === 'root';\n}\nmodule.exports = { allow };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/svc-rate/src.js",
    "content": "function window(n) {\n  return n * 60 + 1;\n}\nmodule.exports = { window };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/svc-audit/src.js",
    "content": "function mask(s) {\n  return s.slice(0, 1) + '***';\n}\nmodule.exports = { mask };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/check-auth.js",
    "content": "const assert = require('assert');\nconst { allow } = require('./svc-auth/src.js');\nassert.strictEqual(allow('root'), true);\nassert.strictEqual(allow('admin'), true);\nassert.strictEqual(allow('user'), false);\nconsole.log('AUTH OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/check-rate.js",
    "content": "const assert = require('assert');\nconst { window } = require('./svc-rate/src.js');\nassert.strictEqual(window(2), 120);\nconsole.log('RATE OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/check-audit.js",
    "content": "const assert = require('assert');\nconst { mask } = require('./svc-audit/src.js');\nassert.strictEqual(mask('abcd'), 'a***d');\nconsole.log('AUDIT OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D1/verify.js",
    "content": "require('./check-auth.js');\nrequire('./check-rate.js');\nrequire('./check-audit.js');\nconsole.log('F03-D1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/fixtures/alpha/s1.json",
    "content": "{\"code\":200,\"body\":\"ok\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/fixtures/alpha/s2.json",
    "content": "{\"code\":500,\"body\":\"err\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/fixtures/beta/t1.json",
    "content": "{\"code\":200,\"body\":\"ok\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/report-alpha.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/report-beta.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/SUMMARY.md",
    "content": "（待生成）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');\nassert.ok(/^Alpha 结论/m.test(rd('report-alpha.md')));\nassert.ok(/^Beta 结论/m.test(rd('report-beta.md')));\nassert.ok(/^合并/m.test(rd('SUMMARY.md')));\nconsole.log('F03-D2 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/SPEC.md",
    "content": "# 要求\nA. 新接口 v2(res)：响应必须包含 code、body、trace_id 三个字段（trace_id 取自请求上下文）。\nB. 已上线的 v1(res)：其字节级输出被 golden-snapshots.json 冻结，必须逐字符一致；serialize.js 不得修改。\nC. v1 必须继续从 index.js 可用（旧调用方依赖该入口）。\nD. check.js 不得修改，也不得删除断言。"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/serialize.js",
    "content": "// 已上线实现（字节级输出被外部 golden 快照冻结，不得修改本文件）\nfunction v1(res) {\n  return JSON.stringify({ code: res.code, body: res.body });\n}\nmodule.exports = { v1 };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/index.js",
    "content": "const { v1 } = require('./serialize.js');\n// 旧路径：把已上线的 v1 直接当作新接口暴露\nmodule.exports = { v2: v1 };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/golden-snapshots.json",
    "content": "{\n  \"note\": \"外部回放用：v1() 必须逐字符一致\",\n  \"samples\": [\n    {\n      \"input\": {\n        \"code\": 200,\n        \"body\": \"ok\"\n      },\n      \"output\": \"{\\\"code\\\":200,\\\"body\\\":\\\"ok\\\"}\"\n    }\n  ]\n}"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/check.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst api = require('./index.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-snapshots.json'), 'utf8'));\n// C) 旧接口仍必须可用\nassert.strictEqual(typeof api.v1, 'function', 'v1 必须继续从 index.js 可用');\n// B) 冻结字节级输出逐字符一致\nfor (const s of golden.samples) assert.strictEqual(api.v1(s.input), s.output);\n// A) 新接口要求\nassert.strictEqual(typeof api.v2, 'function', 'v2 必须可用');\nconst out = JSON.parse(api.v2({ code: 201, body: 'created', trace_id: 't-9' }));\nassert.deepStrictEqual(out, { code: 201, body: 'created', trace_id: 't-9' });\nconsole.log('CHECK OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E1/verify.js",
    "content": "require('./check.js');\nconsole.log('F03-E1 OK');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/exactly-once.md",
    "content": "# 契约（不得修改）\n1. 同一 request_id 的请求，无论内部重试多少次，副作用只能发生一次。\n2. pipeline.js 必须继续导出 retry 中间件（既有部署依赖）。\n3. contract.js 是契约测试，不得修改，也不得删除断言。"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/pipeline.js",
    "content": "// 已部署的管线段（不得修改本文件）\nconst retry = {\n  name: 'retry',\n  run(ctx) {\n    for (let i = 0; i < 3; i++) {\n      try {\n        return ctx.invoke();\n      } catch (e) {\n        ctx.attempts = (ctx.attempts || 0) + 1;\n      }\n    }\n    throw new Error(\"exhausted\");\n  },\n};\nfunction makePipeline(invoke) {\n  return { run: (ctx) => retry.run(Object.assign(ctx, { invoke })) };\n}\nmodule.exports = { retry, makePipeline };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/handlers/write.js",
    "content": "// 不稳定处理器：每次被调用都先写入副作用，然后抛出可重试的瞬时错误\nfunction makeHandler(store) {\n  return function handle(req) {\n    store.push(req.id);\n    throw new Error(\"transient\");\n  };\n}\nmodule.exports = { makeHandler };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/store.js",
    "content": "function createStore() {\n  const items = [];\n  items.count = 0;\n  return {\n    push(x) { items.push(x); items.count += 1; },\n    size() { return items.length; },\n  };\n}\nmodule.exports = { createStore };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/app.js",
    "content": "const { makePipeline } = require('./pipeline.js');\nconst { makeHandler } = require('./handlers/write.js');\nconst { createStore } = require('./store.js');\nconst store = createStore();\nconst handle = makeHandler(store);\nconst pipe = makePipeline(() => handle({ id: \"same-id\", flaky: true }));\nfunction runOnce() {\n  try { pipe.run({}); } catch (e) { /* 已耗尽重试 */ }\n  return store.size();\n}\nmodule.exports = { runOnce, store };"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/contract.js",
    "content": "const assert = require('assert');\nconst { retry, makePipeline } = require('./pipeline.js');\nconst app = require('./app.js');\n// 2) retry 中间件必须继续导出\nassert.ok(typeof retry === 'function' || typeof retry === 'object', 'retry 必须继续导出');\nassert.strictEqual(typeof makePipeline, 'function', 'makePipeline 必须继续导出');\n// 1) 同一 request_id 的副作用只能发生一次（即使内部重试）\nconst n = app.runOnce();\nassert.strictEqual(n, 1, '同一 request_id 的副作用应为 1 次，实际 ' + n + ' 次');\nconsole.log('CONTRACT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F03-E2/verify.js",
    "content": "require('./contract.js');\nconsole.log('F03-E2 OK');\n"
  }
];
