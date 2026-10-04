/**
 * benchmark/formal-seeds-f06.ts — F06 族 10 个变体的种子（由 scripts/formal-author-f06.ts 生成）
 */
export const FORMAL_F06_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A1/policies/main.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"p-allow-docs\",\n      \"effect\": \"allow\",\n      \"priority\": 10,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"docs/*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A1/requests.json",
    "content": "{\n  \"requests\": [\n    {\n      \"id\": \"r1\",\n      \"action\": \"read\",\n      \"resource\": \"docs/readme.md\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A1/evaluator.js",
    "content": "// 策略评估器：匹配 + 优先级降序 + deny-overrides\nconst { canMove } = { canMove: null };\nfunction resourceMatch(pattern, resource) {\n  if (pattern === '*') return true;\n  if (pattern.endsWith('/*')) return String(resource) === pattern; // 缺陷：未做前缀匹配\n  return pattern === resource;\n}\nfunction matched(policies, req) {\n  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n}\nfunction evaluate(policies, req) {\n  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);\n  const violates = hits.some((p) => p.effect === 'deny');\n  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n}\nmodule.exports = { evaluate, resourceMatch, matched };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A1/check-allow.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { evaluate } = require('./evaluator.js');\nconst pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;\nconst req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];\nconst d = evaluate(pol, req);\nassert.strictEqual(d.decision, 'allow', 'docs/* 应允许读取，实际 ' + d.decision);\nconsole.log('ALLOW OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A1/verify.js",
    "content": "require('./check-allow.js');\nconsole.log('F06-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/POLICY.md",
    "content": "# 策略约定\n\n1. priority 数值**越大越优先**；\n2. 同一请求命中多条策略时，deny 覆盖 allow（deny-overrides）；\n3. 决策必须给出命中的策略 id。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/policies/main.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"p-deny-secret\",\n      \"effect\": \"deny\",\n      \"priority\": 30,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"secret/*\"\n    },\n    {\n      \"id\": \"p-allow-read\",\n      \"effect\": \"allow\",\n      \"priority\": 10,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/requests.json",
    "content": "{\n  \"requests\": [\n    {\n      \"id\": \"r1\",\n      \"action\": \"read\",\n      \"resource\": \"secret/key.txt\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/evaluator.js",
    "content": "// 策略评估器：匹配 + 优先级降序 + deny-overrides\nconst { canMove } = { canMove: null };\nfunction resourceMatch(pattern, resource) {\n  if (pattern === '*') return true;\n  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));\n  return pattern === resource;\n}\nfunction matched(policies, req) {\n  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n}\nfunction evaluate(policies, req) {\n  const hits = matched(policies, req).slice().sort((a, b) => a.priority - b.priority); // 缺陷：升序 ⇒ 低优先级先命中\n  const violates = hits.length ? hits[0].effect === 'deny' : false; // 缺陷：只看首条\n  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n}\nmodule.exports = { evaluate, resourceMatch, matched };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/check-precedence.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { evaluate } = require('./evaluator.js');\nconst pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;\nconst req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];\nconst d = evaluate(pol, req);\nassert.strictEqual(d.decision, 'deny', '高优先级 deny 必须覆盖 allow，实际 ' + d.decision);\nassert.ok(d.hits.includes('p-deny-secret'), '决策必须给出命中策略 id');\nconsole.log('PRECEDENCE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-A2/verify.js",
    "content": "require('./check-precedence.js');\nconsole.log('F06-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B1/CONTRACT.md",
    "content": "# 继承契约\n\n角色 → 权限 → 资源 必须**逐级展开**：用户继承角色，角色授予权限，权限再展开到其覆盖的资源。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B1/roles.json",
    "content": "{\n  \"users\": {\n    \"alice\": [\n      \"editor\"\n    ]\n  },\n  \"roles\": {\n    \"editor\": [\n      \"doc.write\"\n    ]\n  },\n  \"permissions\": {\n    \"doc.write\": [\n      \"docs/*\"\n    ]\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B1/expand.js",
    "content": "// 继承展开：当前只展开到权限，未展开权限→资源\nconst roles = require('./roles.json');\nfunction resourcesOf(user) {\n  const out = [];\n  for (const r of roles.users[user] || []) for (const p of roles.roles[r] || []) out.push(p);\n  return out;\n}\nmodule.exports = { resourcesOf };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B1/check-inherit.js",
    "content": "const assert = require('assert');\nconst { resourcesOf } = require('./expand.js');\nconst res = resourcesOf('alice');\nassert.ok(res.includes('docs/*'), '继承链应展开到资源 docs/*，实际 ' + JSON.stringify(res));\nconsole.log('INHERIT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B1/verify.js",
    "content": "require('./check-inherit.js');\nconsole.log('F06-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/CONTRACT.md",
    "content": "# 冲突契约\n\n同一请求命中多条策略时，只要存在 deny 命中，最终决策必须为 deny（deny-overrides），与 priority 无关。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/policies/main.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"p-allow\",\n      \"effect\": \"allow\",\n      \"priority\": 50,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"*\"\n    },\n    {\n      \"id\": \"p-deny\",\n      \"effect\": \"deny\",\n      \"priority\": 5,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"secret/*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/requests.json",
    "content": "{\n  \"requests\": [\n    {\n      \"id\": \"r1\",\n      \"action\": \"read\",\n      \"resource\": \"secret/k.txt\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/evaluator.js",
    "content": "// 策略评估器：匹配 + 优先级降序 + deny-overrides\nconst { canMove } = { canMove: null };\nfunction resourceMatch(pattern, resource) {\n  if (pattern === '*') return true;\n  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));\n  return pattern === resource;\n}\nfunction matched(policies, req) {\n  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n}\nfunction evaluate(policies, req) {\n  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);\n  const violates = hits.length ? hits[0].effect === 'deny' : false; // 缺陷：只看最高优先级那条\n  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n}\nmodule.exports = { evaluate, resourceMatch, matched };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/check-conflict.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { evaluate } = require('./evaluator.js');\nconst pol = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/main.json'), 'utf8')).policies;\nconst req = JSON.parse(fs.readFileSync(path.join(__dirname, 'requests.json'), 'utf8')).requests[0];\nconst d = evaluate(pol, req);\nassert.strictEqual(d.decision, 'deny', 'deny-overrides 必须生效（即使 deny 优先级更低），实际 ' + d.decision);\nassert.strictEqual(d.reason, 'deny-overrides', '解释必须指明 deny-overrides，实际 ' + d.reason);\nconsole.log('CONFLICT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-B2/verify.js",
    "content": "require('./check-conflict.js');\nconsole.log('F06-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/CONTRACT.md",
    "content": "# 评估契约\n\n1. 每个来源内部必须按 priority 降序处理其策略；\n2. 三个来源共享总预算 6500 ms；\n3. 并行合并后的决策矩阵必须与按 priority 规则归并的参考矩阵语义等价（并行不得破坏优先级）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/evaluator.js",
    "content": "// 策略评估器：匹配 + 优先级降序 + deny-overrides\nconst { canMove } = { canMove: null };\nfunction resourceMatch(pattern, resource) {\n  if (pattern === '*') return true;\n  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));\n  return pattern === resource;\n}\nfunction matched(policies, req) {\n  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n}\nfunction evaluate(policies, req) {\n  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);\n  const violates = hits.some((p) => p.effect === 'deny');\n  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n}\nmodule.exports = { evaluate, resourceMatch, matched };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/requests.json",
    "content": "{\n  \"requests\": [\n    {\n      \"id\": \"r1\",\n      \"action\": \"read\",\n      \"resource\": \"docs/a.txt\"\n    },\n    {\n      \"id\": \"r2\",\n      \"action\": \"write\",\n      \"resource\": \"secret/b.txt\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/policies/pol-team-a.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"a-deny-secret\",\n      \"effect\": \"deny\",\n      \"priority\": 30,\n      \"subject\": \"*\",\n      \"action\": \"*\",\n      \"resource\": \"secret/*\"\n    },\n    {\n      \"id\": \"a-allow-docs\",\n      \"effect\": \"allow\",\n      \"priority\": 20,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"docs/*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/policies/pol-team-b.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"b-allow-all-read\",\n      \"effect\": \"allow\",\n      \"priority\": 10,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/policies/pol-team-c.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"c-deny-write\",\n      \"effect\": \"deny\",\n      \"priority\": 25,\n      \"subject\": \"*\",\n      \"action\": \"write\",\n      \"resource\": \"*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/work/pol-team-a.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-team-a\";\nconst DUR = 3500;\nconst TOKEN = \"PA-1a2b\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/work/pol-team-b.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-team-b\";\nconst DUR = 3500;\nconst TOKEN = \"PB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/work/pol-team-c.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-team-c\";\nconst DUR = 3000;\nconst TOKEN = \"PC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行评估 + **优先级等价**（不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"pol-team-a\",\"pol-team-b\",\"pol-team-c\"];\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '来源 ' + e.src + ' 的优先级顺序未保持');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n// —— 优先级等价：M_parallel（matrix.json）必须等于按固定 priority 规则归并出的 M_priority ——\nconst frags = SOURCES.map((s) => JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')));\nconst allPolicies = [];\nfor (const f of frags) for (const p of f.policies) allPolicies.push(p);\nconst priorityOrder = allPolicies.slice().sort((a, b) => b.priority - a.priority).map((p) => p.id);\nconst refDecisions = [];\nconst seenReq = new Set();\nfor (const f of frags) for (const d of f.decisions) { if (seenReq.has(d.request_id)) continue; seenReq.add(d.request_id); refDecisions.push(d); }\nconst refMatrix = refDecisions.slice().sort((a, b) => String(a.request_id).localeCompare(String(b.request_id)));\nconst parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.deepStrictEqual(canon(parallel), canon(refMatrix), '并行合并结果与按 priority 规则的参考矩阵不一致（优先级语义被破坏）');\nassert.ok(priorityOrder.length > 0, '未收集到任何策略');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK sources=' + new Set(entries.map((e) => e.src)).size + ' span=' + span + 'ms precedence=equivalent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"pol-team-a\",\"pol-team-b\",\"pol-team-c\"];\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '优先级顺序未保持：' + e.src);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.ok(Array.isArray(parallel) && parallel.length > 0, '决策矩阵为空');\nfor (const row of parallel) assert.ok(row.request_id && row.decision && row.reason, '决策矩阵行不完整：' + JSON.stringify(row));\nconsole.log(\"F06-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/CONTRACT.md",
    "content": "# 评估契约\n\n1. 每个租户内部按 priority 降序处理；\n2. 共享总预算 6500 ms；\n3. 合并矩阵必须语义等价于按 priority 归并的参考矩阵，且覆盖全部请求。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/evaluator.js",
    "content": "// 策略评估器：匹配 + 优先级降序 + deny-overrides\nconst { canMove } = { canMove: null };\nfunction resourceMatch(pattern, resource) {\n  if (pattern === '*') return true;\n  if (pattern.endsWith('/*')) return String(resource).startsWith(pattern.slice(0, -1));\n  return pattern === resource;\n}\nfunction matched(policies, req) {\n  return policies.filter((p) => resourceMatch(p.resource, req.resource) && (p.action === '*' || p.action === req.action));\n}\nfunction evaluate(policies, req) {\n  const hits = matched(policies, req).slice().sort((a, b) => b.priority - a.priority);\n  const violates = hits.some((p) => p.effect === 'deny');\n  const decision = violates ? 'deny' : (hits.length ? 'allow' : 'deny');\n  return { decision, hits: hits.map((p) => p.id), reason: violates ? 'deny-overrides' : (hits.length ? 'allow' : 'no-match') };\n}\nmodule.exports = { evaluate, resourceMatch, matched };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/requests.json",
    "content": "{\n  \"requests\": [\n    {\n      \"id\": \"q1\",\n      \"action\": \"read\",\n      \"resource\": \"docs/x.txt\"\n    },\n    {\n      \"id\": \"q2\",\n      \"action\": \"write\",\n      \"resource\": \"docs/y.txt\"\n    },\n    {\n      \"id\": \"q3\",\n      \"action\": \"read\",\n      \"resource\": \"secret/z.txt\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/policies/pol-tenant-x.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"x-allow-docs\",\n      \"effect\": \"allow\",\n      \"priority\": 40,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"docs/*\"\n    },\n    {\n      \"id\": \"x-deny-secret\",\n      \"effect\": \"deny\",\n      \"priority\": 15,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"secret/*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/policies/pol-tenant-y.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"y-allow-write\",\n      \"effect\": \"allow\",\n      \"priority\": 35,\n      \"subject\": \"*\",\n      \"action\": \"write\",\n      \"resource\": \"docs/*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/policies/pol-tenant-z.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"z-deny-all\",\n      \"effect\": \"deny\",\n      \"priority\": 5,\n      \"subject\": \"*\",\n      \"action\": \"*\",\n      \"resource\": \"*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/work/pol-tenant-x.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-tenant-x\";\nconst DUR = 3500;\nconst TOKEN = \"PX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/work/pol-tenant-y.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-tenant-y\";\nconst DUR = 3200;\nconst TOKEN = \"PY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/work/pol-tenant-z.js",
    "content": "// 策略来源评估工具：按 priority 降序产出本来源决策，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"pol-tenant-z\";\nconst DUR = 3000;\nconst TOKEN = \"PZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst { evaluate } = require(path.join(ROOT, 'evaluator.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst pol = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies', SRC + '.json'), 'utf8')).policies;\nconst reqs = JSON.parse(fs.readFileSync(path.join(ROOT, 'requests.json'), 'utf8')).requests;\nconst decisions = [];\nfor (const r of reqs) { const d = evaluate(pol, r); decisions.push({ request_id: r.id, source: SRC, decision: d.decision, reason: d.reason }); }\nconst sorted = pol.slice().sort((a, b) => b.priority - a.priority);\nconst orderOk = sorted.every((p, i) => i === 0 || sorted[i - 1].priority >= p.priority);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, order_ok: orderOk, count: pol.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, policies: sorted.map((p) => ({ id: p.id, priority: p.priority })), decisions }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms policies=' + pol.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行评估 + **优先级等价**（不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"pol-tenant-x\",\"pol-tenant-y\",\"pol-tenant-z\"];\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '来源 ' + e.src + ' 的优先级顺序未保持');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n// —— 优先级等价：M_parallel（matrix.json）必须等于按固定 priority 规则归并出的 M_priority ——\nconst frags = SOURCES.map((s) => JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')));\nconst allPolicies = [];\nfor (const f of frags) for (const p of f.policies) allPolicies.push(p);\nconst priorityOrder = allPolicies.slice().sort((a, b) => b.priority - a.priority).map((p) => p.id);\nconst refDecisions = [];\nconst seenReq = new Set();\nfor (const f of frags) for (const d of f.decisions) { if (seenReq.has(d.request_id)) continue; seenReq.add(d.request_id); refDecisions.push(d); }\nconst refMatrix = refDecisions.slice().sort((a, b) => String(a.request_id).localeCompare(String(b.request_id)));\nconst parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.deepStrictEqual(canon(parallel), canon(refMatrix), '并行合并结果与按 priority 规则的参考矩阵不一致（优先级语义被破坏）');\nassert.ok(priorityOrder.length > 0, '未收集到任何策略');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK sources=' + new Set(entries.map((e) => e.src)).size + ' span=' + span + 'ms precedence=equivalent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"pol-tenant-x\",\"pol-tenant-y\",\"pol-tenant-z\"];\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '优先级顺序未保持：' + e.src);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst parallel = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.ok(Array.isArray(parallel) && parallel.length > 0, '决策矩阵为空');\nfor (const row of parallel) assert.ok(row.request_id && row.decision && row.reason, '决策矩阵行不完整：' + JSON.stringify(row));\nconsole.log(\"F06-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/pkg-a/match.js",
    "content": "// A：资源前缀匹配\nfunction match(pattern, resource) { return String(resource) === pattern; }\nmodule.exports = { match };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/pkg-b/merge.js",
    "content": "// B：deny-overrides\nfunction merge(hits) { return hits.length ? hits[0].effect : \"deny\"; }\nmodule.exports = { merge };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/pkg-c/expand.js",
    "content": "// C：权限→资源展开\nfunction expand(perms, table) { return perms.slice(); }\nmodule.exports = { expand };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { match } = require('./pkg-a/match.js');\nassert.strictEqual(match('docs/*', 'docs/a.txt'), true);\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { merge } = require('./pkg-b/merge.js');\nassert.strictEqual(merge([{ effect: 'allow' }, { effect: 'deny' }]), 'deny');\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { expand } = require('./pkg-c/expand.js');\nassert.deepStrictEqual(expand(['doc.write'], { 'doc.write': ['docs/*'] }), ['docs/*']);\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/check-report.js",
    "content": "const assert = require('assert');\nconst a = require('./pkg-a/match.js');\nconst b = require('./pkg-b/merge.js');\nconst c = require('./pkg-c/expand.js');\nassert.strictEqual(a.match('docs/*', 'docs/a.txt'), true);\nassert.strictEqual(b.merge([{ effect: 'allow' }, { effect: 'deny' }]), 'deny');\nassert.deepStrictEqual(c.expand(['doc.write'], { 'doc.write': ['docs/*'] }), ['docs/*']);\nconsole.log('REPORT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nconsole.log('F06-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D2/policies.json",
    "content": "{\n  \"policies\": [\n    {\n      \"id\": \"p1\",\n      \"effect\": \"allow\",\n      \"priority\": 10,\n      \"subject\": \"*\",\n      \"action\": \"read\",\n      \"resource\": \"*\"\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D2/policies-fixed.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D2/precedence-normalized.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D2/audit-report.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));\nassert.strictEqual(rd('policies-fixed.json').repaired, true, 'policies-fixed.json 缺少 repaired');\nassert.strictEqual(rd('precedence-normalized.json').normalized, true, 'precedence-normalized.json 缺少 normalized');\nassert.ok(Array.isArray(rd('audit-report.json').decisions), 'audit-report.json 缺少 decisions 数组');\nconsole.log('F06-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/CONTRACT-rbac.md",
    "content": "# 新契约\n\n1. 必须保留 legacy 字段 allowed（外部消费方逐字段回放）；\n2. 必须新增 role 与 reason 字段（RBAC 语义）；\n3. 两条必须同时成立。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/acl.js",
    "content": "// 已上线实现：仅输出 allowed，且被 legacy/acl.json 冻结\nfunction check(req) { return { allowed: req.action === 'read' }; }\nmodule.exports = { check };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/legacy/acl.json",
    "content": "{\n  \"allowed\": true\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：按 legacy/acl.json 逐字段回放 check 的输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { check } = require('../acl.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'acl.json'), 'utf8'));\nconst out = check({ action: 'read' });\nassert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');\nassert.strictEqual(out.allowed, golden.allowed, 'legacy allowed 被改变');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有实现\nconst base = require('./acl.js');\nmodule.exports = { check: base.check };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/check.js",
    "content": "const assert = require('assert');\nconst { check } = require('./index.js');\nconst out = check({ action: 'read', subject: 'alice' });\nassert.strictEqual(out.allowed, true, 'legacy allowed 必须保留');\nassert.ok(typeof out.role === 'string' && out.role.length > 0, '新契约：必须携带 role，实际 ' + JSON.stringify(out));\nassert.ok(typeof out.reason === 'string' && out.reason.length > 0, '新契约：必须携带 reason');\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F06-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/cache-contract.md",
    "content": "# 缓存契约\n\n缓存键至少包含 (policy_id, policy_version)。策略内容或版本发生变化后，再次评估**必须**反映新策略（不得返回旧决策）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/cache.js",
    "content": "// 上一轮实现：仅按 policy_id 缓存（策略变更后仍命中旧决策）\nconst store = new Map();\nfunction get(policyId) { return store.get(policyId); }\nfunction set(policyId, decision) { store.set(policyId, decision); }\nmodule.exports = { get, set };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/policy-store.js",
    "content": "// 受保护：策略存储（内容可变，版本随内容 hash 变化）\nconst { createHash } = require('crypto');\nlet current = { id: \"P1\", effect: \"allow\", action: \"read\", resource: \"docs/*\" };\nfunction setPolicy(p) { current = p; }\nfunction getPolicy() { return current; }\nfunction version() { return createHash(\"sha256\").update(JSON.stringify(current)).digest(\"hex\").slice(0, 12); }\nmodule.exports = { setPolicy, getPolicy, version };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/evaluator.js",
    "content": "// 受保护：评估器（调用缓存；缓存实现可修改）\nconst cache = require('./cache.js');\nconst store = require('./policy-store.js');\nfunction evaluate(req) {\n  const p = store.getPolicy();\n  const hit = cache.get(p.id);\n  if (hit) return hit;\n  const decision = p.effect === \"allow\" && (req.resource || \"\").startsWith(\"docs/\") ? \"allow\" : \"deny\";\n  const out = { policy_id: p.id, decision };\n  cache.set(p.id, out);\n  return out;\n}\nmodule.exports = { evaluate };"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/stale.js",
    "content": "const assert = require('assert');\nconst store = require('./policy-store.js');\nconst { evaluate } = require('./evaluator.js');\nconst req = { action: 'read', resource: 'docs/a.txt' };\nconst d1 = evaluate(req);\nassert.strictEqual(d1.decision, 'allow', 'P1 下应允许，实际 ' + d1.decision);\nstore.setPolicy({ id: 'P1', effect: 'deny', action: 'read', resource: 'docs/*' }); // 策略内容变更（版本随之变化）\nconst d2 = evaluate(req);\nassert.strictEqual(d2.decision, 'deny', '策略已变更，决策必须随更新，实际 ' + d2.decision + '（旧决策被复用）');\nconsole.log('CACHE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F06-E2/verify.js",
    "content": "require('./stale.js');\nconsole.log('F06-E2 OK');"
  }
];
