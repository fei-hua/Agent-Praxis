/**
 * benchmark/formal-seeds-f05.ts — F05 族 10 个变体的种子（由 scripts/formal-author-f05.ts 生成）
 */
export const FORMAL_F05_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A1/registry.json",
    "content": "{\n  \"packages\": {\n    \"x\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"2.4.0\": {\n          \"deps\": {}\n        },\n        \"2.4.1\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A1/manifest.json",
    "content": "{\n  \"name\": \"app\",\n  \"dependencies\": {\n    \"x\": \"^2.4\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A1/resolver.js",
    "content": "// 解析器：应为满足 semver 约束的版本选择一个确定结果\nconst registry = require('./registry.json');\nfunction satisfies(version, range) { return true; }\nfunction pickVersion(name, range) {\n  const versions = Object.keys(registry.packages[name].versions).sort();\n  return versions.find((v) => satisfies(v, range));\n}\nfunction resolve(manifest) {\n  const deps = {};\n  for (const [name, range] of Object.entries(manifest.dependencies)) deps[name] = pickVersion(name, range);\n  return { deps };\n}\nmodule.exports = { resolve, pickVersion, satisfies };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A1/check-resolve.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { resolve } = require('./resolver.js');\nconst manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\nconst out = resolve(manifest);\nassert.strictEqual(out.deps.x, '2.4.1', '^2.4 应解析为满足约束的最高版本，实际 ' + out.deps.x);\nconsole.log(\"RESOLVE OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A1/verify.js",
    "content": "require('./check-resolve.js');\nconsole.log('F05-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/CONTRACT.md",
    "content": "# 解析契约\n\n1. 约束必须按 semver 解析；\n2. 若 lockfile.json 中已有**满足约束**的固定版本，必须优先采用该版本（lockfile 具备冻结效力）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/registry.json",
    "content": "{\n  \"packages\": {\n    \"x\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"2.4.0\": {\n          \"deps\": {}\n        },\n        \"2.4.1\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/manifest.json",
    "content": "{\n  \"name\": \"app\",\n  \"dependencies\": {\n    \"x\": \"^2.4\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/lockfile.json",
    "content": "{\n  \"deps\": {\n    \"x\": \"2.4.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/resolver.js",
    "content": "// 解析器：解析满足 caret 约束的确定结果\nconst registry = require('./registry.json');\nfunction satisfies(version, range) {\n  const m = /^\\^?(\\d+)(?:\\.(\\d+))?/.exec(String(range));\n  if (!m) return version === range;\n  const [maj, min] = [Number(m[1]), m[2] === undefined ? 0 : Number(m[2])];\n  const p = String(version).split('.').map(Number);\n  if (String(range).startsWith('^')) return p[0] === maj && (p[1] > min || (p[1] === min && p[2] >= 0));\n  return p[0] === maj && p[1] === min;\n}\nfunction pickVersion(name, range) {\n  const versions = Object.keys(registry.packages[name].versions).sort();\n  const ok = versions.filter((v) => satisfies(v, range));\n  return ok.length ? ok[ok.length - 1] : undefined;\n}\nfunction resolve(manifest) {\n  const deps = {};\n  for (const [name, range] of Object.entries(manifest.dependencies)) deps[name] = pickVersion(name, range);\n  return { deps };\n}\nmodule.exports = { resolve, pickVersion, satisfies };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/check-lockfile.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { resolve } = require('./resolver.js');\nconst manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\nconst out = resolve(manifest);\nassert.strictEqual(out.deps.x, '2.4.0', '应遵循 lockfile 的固定版本（满足约束的 pinned 版本），实际 ' + out.deps.x);\nconsole.log('LOCKFILE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-A2/verify.js",
    "content": "require('./check-lockfile.js');\nconsole.log('F05-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/CONTRACT.md",
    "content": "# 依赖图契约\n\n依赖图必须包含**全部传递依赖**（递归展开），不得只取顶层。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/registry.json",
    "content": "{\n  \"packages\": {\n    \"app\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {\n            \"next\": \"^1.0.0\"\n          }\n        }\n      }\n    },\n    \"next\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {\n            \"leaf\": \"^1.0.0\"\n          }\n        }\n      }\n    },\n    \"leaf\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/manifest.json",
    "content": "{\n  \"name\": \"root\",\n  \"dependencies\": {\n    \"app\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/graph.js",
    "content": "// 依赖图：当前只展开一层\nconst registry = require('./registry.json');\nfunction build(deps) {\n  const out = {};\n  for (const [name, range] of Object.entries(deps)) {\n    out[name] = range;\n    const meta = registry.packages[name];\n    const v = Object.keys(meta.versions)[0];\n    // 缺少对 meta.versions[v].deps 的递归展开\n  }\n  return out;\n}\nmodule.exports = { build };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/check-graph.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { build } = require('./graph.js');\nconst manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\nconst g = build(manifest.dependencies);\nfor (const need of ['app', 'next', 'leaf']) assert.ok(g[need], '依赖图缺少 ' + need);\nconsole.log('GRAPH OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B1/verify.js",
    "content": "require('./check-graph.js');\nconsole.log('F05-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/CONTRACT.md",
    "content": "# 解析契约\n\n若同一包被要求满足互不兼容的主版本约束，解析结果必须报告冲突（conflicts 列出该包名）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/registry.json",
    "content": "{\n  \"packages\": {\n    \"p\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {\n            \"shared\": \"^1.0.0\"\n          }\n        }\n      }\n    },\n    \"q\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {\n            \"shared\": \"^2.0.0\"\n          }\n        }\n      }\n    },\n    \"shared\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"2.0.0\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/manifest.json",
    "content": "{\n  \"name\": \"app\",\n  \"dependencies\": {\n    \"p\": \"^1.0.0\",\n    \"q\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/resolver.js",
    "content": "// 解析器：当前忽略冲突，后写覆盖\nconst fs = require('fs');\nconst path = require('path');\nconst registry = require('./registry.json');\nfunction resolve(manifest) {\n  const deps = {}; const conflicts = [];\n  const visit = (depsIn) => {\n    for (const [name, range] of Object.entries(depsIn)) {\n      const versions = Object.keys(registry.packages[name].versions).sort();\n      const maj = Number((/\\d+/.exec(String(range)) || [0])[0]);\n      const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n      deps[name] = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n      const meta = registry.packages[name].versions[deps[name]];\n      if (meta && meta.deps) visit(meta.deps);\n    }\n  };\n  visit(manifest.dependencies);\n  return { deps, conflicts };\n}\nmodule.exports = { resolve };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/check-conflict.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { resolve } = require('./resolver.js');\nconst manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\nconst out = resolve(manifest);\nassert.deepStrictEqual(out.conflicts.slice().sort(), ['shared'], '应报告 shared 的版本冲突，实际 ' + JSON.stringify(out.conflicts));\nconsole.log('CONFLICT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-B2/verify.js",
    "content": "require('./check-conflict.js');\nconsole.log('F05-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/CONTRACT.md",
    "content": "# 解析契约\n\n1. 每个包内部必须按 package.json 的依赖**声明顺序**解析；\n2. 三个包共享总时间预算 6500 ms；\n3. 运行结束后各包必须产出完整 lockfile 片段。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/registry.json",
    "content": "{\n  \"packages\": {\n    \"z\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.1.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"m\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.2.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"a\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.0.1\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"q\": {\n      \"versions\": {\n        \"2.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"r\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"s\": {\n      \"versions\": {\n        \"3.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"t\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/packages/pkg-a/package.json",
    "content": "{\n  \"name\": \"pkg-a\",\n  \"dependencies\": {\n    \"z\": \"^1.0.0\",\n    \"m\": \"^1.0.0\",\n    \"a\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/packages/pkg-b/package.json",
    "content": "{\n  \"name\": \"pkg-b\",\n  \"dependencies\": {\n    \"r\": \"^1.0.0\",\n    \"q\": \"^2.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/packages/pkg-c/package.json",
    "content": "{\n  \"name\": \"pkg-c\",\n  \"dependencies\": {\n    \"t\": \"^1.0.0\",\n    \"s\": \"^3.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/work/pkg-a.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-a\";\nconst DUR = 3500;\nconst TOKEN = \"PA-1a2b\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/work/pkg-b.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-b\";\nconst DUR = 3500;\nconst TOKEN = \"PB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/work/pkg-c.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-c\";\nconst DUR = 3000;\nconst TOKEN = \"PC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证**已发生**的那次并行解析（不执行任何包工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst PACKAGES = [\"pkg-a\",\"pkg-b\",\"pkg-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符：' + entries.map((e) => e.pkg).join(','));\nfor (const e of entries) {\n  assert.strictEqual(e.order_ok, true, '包 ' + e.pkg + ' 内部依赖顺序未保持');\n  const declared = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, 'packages', e.pkg, 'package.json'), 'utf8')).dependencies || {});\n  const out = fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.txt'), 'utf8').trim();\n  assert.strictEqual(out, declared.join(','), '包 ' + e.pkg + ' 输出顺序与声明顺序不一致');\n  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.lock.json'), 'utf8'));\n  for (const d of declared) assert.ok(frag.deps[d], '包 ' + e.pkg + ' 的 lockfile 缺少依赖 ' + d + '（完整性不足）');\n}\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK packages=' + new Set(entries.map((e) => e.pkg)).size + ' span=' + span + 'ms order=preserved lockfile=complete');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst PACKAGES = [\"pkg-a\",\"pkg-b\",\"pkg-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '包顺序未保持：' + e.pkg);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(\"F05-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/CONTRACT.md",
    "content": "# 解析契约\n\n1. 每个包内部必须按声明顺序解析；\n2. 共享总预算 6500 ms；\n3. 运行结束后必须产出 unified-lock.json（覆盖全部包）与 INTEGRATION.md。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/registry.json",
    "content": "{\n  \"packages\": {\n    \"z\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.1.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"m\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.2.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"a\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"1.0.1\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"q\": {\n      \"versions\": {\n        \"2.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"r\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"s\": {\n      \"versions\": {\n        \"3.0.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"t\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/packages/pkg-x/package.json",
    "content": "{\n  \"name\": \"pkg-x\",\n  \"dependencies\": {\n    \"s\": \"^3.0.0\",\n    \"r\": \"^1.0.0\",\n    \"q\": \"^2.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/packages/pkg-y/package.json",
    "content": "{\n  \"name\": \"pkg-y\",\n  \"dependencies\": {\n    \"t\": \"^1.0.0\",\n    \"m\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/packages/pkg-z/package.json",
    "content": "{\n  \"name\": \"pkg-z\",\n  \"dependencies\": {\n    \"a\": \"^1.0.0\",\n    \"z\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/work/pkg-x.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-x\";\nconst DUR = 3500;\nconst TOKEN = \"PX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/work/pkg-y.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-y\";\nconst DUR = 3200;\nconst TOKEN = \"PY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/work/pkg-z.js",
    "content": "// 包解析工具：按 package.json 的**声明顺序**解析该包依赖，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst PKG = \"pkg-z\";\nconst DUR = 3000;\nconst TOKEN = \"PZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages', PKG, 'package.json'), 'utf8'));\nconst declared = Object.keys(pkgJson.dependencies || {});\nconst reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry.json'), 'utf8')).packages;\nconst lock = {};\nconst order = [];\nfor (const dep of declared) {\n  const versions = Object.keys(reg[dep].versions).sort();\n  const range = String(pkgJson.dependencies[dep]);\n  const maj = Number((/\\d+/.exec(range) || ['0'])[0]);\n  const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n  const chosen = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  lock[dep] = chosen;\n  order.push(dep);\n}\nconst orderOk = declared.join(',') === order.join(',');\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ pkg: PKG, start, end, token: TOKEN, order_ok: orderOk, count: order.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.txt'), order.join(',') + '\\n');\nfs.writeFileSync(path.join(ROOT, 'out', PKG + '.lock.json'), JSON.stringify({ pkg: PKG, deps: lock }) + '\\n');\nconsole.log(PKG + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证**已发生**的那次并行解析（不执行任何包工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst PACKAGES = [\"pkg-x\",\"pkg-y\",\"pkg-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符：' + entries.map((e) => e.pkg).join(','));\nfor (const e of entries) {\n  assert.strictEqual(e.order_ok, true, '包 ' + e.pkg + ' 内部依赖顺序未保持');\n  const declared = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, 'packages', e.pkg, 'package.json'), 'utf8')).dependencies || {});\n  const out = fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.txt'), 'utf8').trim();\n  assert.strictEqual(out, declared.join(','), '包 ' + e.pkg + ' 输出顺序与声明顺序不一致');\n  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', e.pkg + '.lock.json'), 'utf8'));\n  for (const d of declared) assert.ok(frag.deps[d], '包 ' + e.pkg + ' 的 lockfile 缺少依赖 ' + d + '（完整性不足）');\n}\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst uni = JSON.parse(fs.readFileSync(path.join(__dirname, 'unified-lock.json'), 'utf8'));\nassert.strictEqual(Object.keys(uni.deps).length >= PACKAGES.length, true, 'unified-lock.json 覆盖不足');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK packages=' + new Set(entries.map((e) => e.pkg)).size + ' span=' + span + 'ms order=preserved lockfile=complete');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst PACKAGES = [\"pkg-x\",\"pkg-y\",\"pkg-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.pkg)).size, PACKAGES.length, 'distinct package 数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '包顺序未保持：' + e.pkg);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(\"F05-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/svc-a/select.js",
    "content": "// A 包图：应在候选版本中选择最高版本\nfunction pick(versions) { return versions.slice().sort()[0]; }\nmodule.exports = { pick };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/svc-b/walk.js",
    "content": "// B 包图：应展开全部传递依赖\nfunction walk(deps, registry) { const out = {}; for (const k of Object.keys(deps)) { out[k] = deps[k]; } return out; }\nmodule.exports = { walk };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/svc-c/lock.js",
    "content": "// C 包图：lockfile 必须带 integrity 字段\nfunction lock(deps) { return { deps }; }\nmodule.exports = { lock };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { pick } = require('./svc-a/select.js');\nassert.strictEqual(pick(['1.0.0','1.2.0','1.1.0']), '1.2.0');\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { walk } = require('./svc-b/walk.js');\nconst reg = { a: { deps: { b: '^1' } }, b: { deps: {} } };\nconst g = walk({ a: '^1' }, reg);\nassert.ok(g.b, '传递依赖 b 缺失');\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { lock } = require('./svc-c/lock.js');\nconst l = lock({ a: '1.0.0' });\nassert.ok(typeof l.integrity === 'string' && l.integrity.length > 0, 'lockfile 缺少 integrity');\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/check-unified.js",
    "content": "const assert = require('assert');\nconst a = require('./svc-a/select.js');\nconst b = require('./svc-b/walk.js');\nconst c = require('./svc-c/lock.js');\nassert.strictEqual(a.pick(['1.0.0','1.2.0']), '1.2.0');\nassert.ok(b.walk({ a: '^1' }, { a: { deps: { b: '^1' } }, b: { deps: {} } }).b);\nassert.ok(c.lock({ a: '1.0.0' }).integrity);\nconsole.log('UNIFIED OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nconsole.log('F05-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D2/graph.json",
    "content": "{\n  \"deps\": {\n    \"a\": \"^1.0.0\",\n    \"b\": \"~2.0.0\"\n  },\n  \"missing\": [\n    \"c\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D2/graph-fixed.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D2/versions-normalized.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D2/lockfile.final.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));\nassert.strictEqual(rd('graph-fixed.json').repaired, true, 'graph-fixed.json 缺少 repaired');\nassert.strictEqual(rd('versions-normalized.json').normalized, true, 'versions-normalized.json 缺少 normalized');\nassert.ok(typeof rd('lockfile.final.json').integrity === 'string', 'lockfile.final.json 缺少 integrity');\nconsole.log('F05-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/CONTRACT-v2.md",
    "content": "# 新契约\n\n1. lockfile 必须保留 legacy 字段 deps（外部消费方逐字段回放）；\n2. lockfile 必须新增 integrity 与 resolution 字段；\n3. 两条必须同时成立。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/lockfile.js",
    "content": "// 已上线实现：仅输出 deps，且被 legacy/lockfile.json 冻结\nfunction build(deps) { return { deps }; }\nmodule.exports = { build };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/legacy/lockfile.json",
    "content": "{\n  \"deps\": {\n    \"a\": \"1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：按 legacy/lockfile.json 逐字段回放 build 的输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { build } = require('../lockfile.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'lockfile.json'), 'utf8'));\nconst out = build({ a: '1.0.0' });\nassert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');\nassert.deepStrictEqual(out.deps, golden.deps, 'legacy deps 被改变');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有实现\nconst base = require('./lockfile.js');\nmodule.exports = { build: base.build };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/check.js",
    "content": "const assert = require('assert');\nconst { build } = require('./index.js');\nconst out = build({ a: '1.0.0' });\nassert.deepStrictEqual(out.deps, { a: '1.0.0' }, 'legacy deps 必须保留');\nassert.ok(typeof out.integrity === 'string' && out.integrity.length > 0, '新契约：必须携带 integrity，实际 ' + JSON.stringify(out));\nassert.ok(out.resolution && typeof out.resolution === 'object', '新契约：必须携带 resolution 字段');\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F05-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/reproducibility.md",
    "content": "# 前置契约\n\n同一输入连续两次 resolve()，其 lockfile 的**规范形式（canonical）必须完全一致**。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/registry.json",
    "content": "{\n  \"packages\": {\n    \"x\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        },\n        \"2.4.0\": {\n          \"deps\": {}\n        }\n      }\n    },\n    \"y\": {\n      \"versions\": {\n        \"1.0.0\": {\n          \"deps\": {}\n        }\n      }\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/manifest.json",
    "content": "{\n  \"name\": \"app\",\n  \"dependencies\": {\n    \"x\": \"^1.0.0\",\n    \"y\": \"^1.0.0\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/lockfile.js",
    "content": "// lockfile 生成：当前写入解析时间戳（导致两次 resolve 不一致）\nconst { createHash } = require('crypto');\nfunction lock(deps) {\n  return { resolvedAt: Date.now(), deps, integrity: \"sha256-\" + createHash(\"sha256\").update(JSON.stringify(deps)).digest(\"hex\") };\n}\nmodule.exports = { lock };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/resolver.js",
    "content": "// 受保护：解析器（调用 lockfile 生成结果）\nconst registry = require('./registry.json');\nconst { lock } = require('./lockfile.js');\nfunction resolve(manifest) {\n  const deps = {};\n  for (const [name, range] of Object.entries(manifest.dependencies)) {\n    const versions = Object.keys(registry.packages[name].versions).sort();\n    const maj = Number((/\\d+/.exec(String(range)) || [0])[0]);\n    const ok = versions.filter((v) => Number(v.split('.')[0]) === maj);\n    deps[name] = ok.length ? ok[ok.length - 1] : versions[versions.length - 1];\n  }\n  return lock(deps);\n}\nmodule.exports = { resolve };"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/repro.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { resolve } = require('./resolver.js');\nconst manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));\nconst canonical = (v) => Array.isArray(v) ? v.map(canonical) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);\nconst l1 = resolve(manifest);\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);\nconst l2 = resolve(manifest);\nassert.deepStrictEqual(canonical(l1), canonical(l2), '两次 resolve 的 lockfile 必须可复现');\nconsole.log('REPRO OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F05-E2/verify.js",
    "content": "require('./repro.js');\nconsole.log('F05-E2 OK');"
  }
];
