/**
 * benchmark/formal-seeds-f08.ts — F08 族 10 个变体的种子（由 scripts/formal-author-f08.ts 生成）
 */
export const FORMAL_F08_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS1 明确规定 cost == remaining 必须允许（remaining 变为 0）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 100,\n  \"user\": 100,\n  \"endpoint\": 100\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/usage.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":40,\"ts\":10}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n    if (r.ts < winStart || r.ts >= winEnd) continue;\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/limiter.js",
    "content": "const account = require('./account.js');\nconst quota = require('./quota.json');\nfunction check(records, cost, winStart, winEnd) {\n  const used = account.canonicalUsed(records, winStart, winEnd);\n  const remaining = quota.global - used;\n  return cost >= remaining ? { decision: \"reject\", remaining, layer: \"global\" } : { decision: \"allow\", remaining: remaining - cost, layer: null }; // 缺陷：应为 cost > remaining\n}\nmodule.exports = { check };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/check-allow.js",
    "content": "const assert = require('assert');\nconst account = require('./account.js');\nconst { check } = require('./limiter.js');\nconst records = account.readUsage(__dirname);\nconst r = check(records, 60, 0, 1000);\nassert.strictEqual(r.decision, 'allow', 'cost == remaining 必须允许（remaining 归零），实际 ' + r.decision);\nassert.strictEqual(r.remaining, 0, 'remaining 应为 0，实际 ' + r.remaining);\nconsole.log('ALLOW OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A1/verify.js",
    "content": "require('./check-allow.js');\nconsole.log('F08-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS2 明确规定 timestamp == window_end 的记录归**下一窗口**，不得计入当前窗口。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/window.json",
    "content": "{\n  \"start\": 0,\n  \"end\": 1000\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 100,\n  \"user\": 100,\n  \"endpoint\": 100\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/usage.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":40,\"ts\":10}\n{\"request_id\":\"r2\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":50,\"ts\":1000}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n    if (r.ts < winStart || r.ts > winEnd) continue; // 缺陷：边界记录被计入当前窗口\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/check-window.js",
    "content": "const assert = require('assert');\nconst account = require('./account.js');\nconst records = account.readUsage(__dirname);\nconst used = account.canonicalUsed(records, 0, 1000);\nassert.strictEqual(used, 40, 'timestamp == window_end 的记录必须归下一窗口，当前窗口 used 应为 40，实际 ' + used);\nconsole.log('WINDOW OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-A2/verify.js",
    "content": "require('./check-window.js');\nconsole.log('F08-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS4 规定 effective_quota = min(global, tenant, user, endpoint)，且拒绝时必须给出 reject_layer。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/window.json",
    "content": "{\n  \"start\": 0,\n  \"end\": 1000\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 80,\n  \"user\": 60,\n  \"endpoint\": 70\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/usage.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":55,\"ts\":10}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n    if (r.ts < winStart || r.ts >= winEnd) continue;\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/limiter.js",
    "content": "const account = require('./account.js');\nconst quota = require('./quota.json');\nfunction check(records, cost, winStart, winEnd) {\n  const used = account.canonicalUsed(records, winStart, winEnd);\n  const effective = quota.tenant; // 缺陷：只取 tenant 层，未取四层最小值\n  const remaining = effective - used;\n  return cost > remaining ? { decision: \"reject\", remaining, layer: \"tenant\" } : { decision: \"allow\", remaining: remaining - cost, layer: null };\n}\nmodule.exports = { check };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/check-layer.js",
    "content": "const assert = require('assert');\nconst account = require('./account.js');\nconst { check } = require('./limiter.js');\nconst records = account.readUsage(__dirname);\nconst r = check(records, 10, 0, 1000);\nassert.strictEqual(r.decision, 'reject', 'used=55、cost=10、effective_quota=60 ⇒ 必须拒绝，实际 ' + r.decision);\nassert.strictEqual(r.layer, 'user', '拒绝层必须是 user（有效额度 60 来自 user 层），实际 ' + r.layer);\nconsole.log('LAYER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B1/verify.js",
    "content": "require('./check-layer.js');\nconsole.log('F08-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS5 规定同一 request_id 重放不得重复扣减；S6 规定 canonical source 为 raw records 去重后求和。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/window.json",
    "content": "{\n  \"start\": 0,\n  \"end\": 1000\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 100,\n  \"user\": 100,\n  \"endpoint\": 100\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/usage.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":30,\"ts\":10}\n{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":30,\"ts\":11}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    // 缺陷：缺少按 request_id 去重\n    if (r.ts < winStart || r.ts >= winEnd) continue;\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/limiter.js",
    "content": "const account = require('./account.js');\nconst quota = require('./quota.json');\nfunction check(records, cost, winStart, winEnd) {\n  const used = account.canonicalUsed(records, winStart, winEnd);\n  const remaining = quota.global - used;\n  return cost > remaining ? { decision: \"reject\", remaining, layer: \"global\" } : { decision: \"allow\", remaining: remaining - cost, layer: null };\n}\nmodule.exports = { check };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/check-idempotent.js",
    "content": "const assert = require('assert');\nconst account = require('./account.js');\nconst { check } = require('./limiter.js');\nconst records = account.readUsage(__dirname);\nconst used = account.canonicalUsed(records, 0, 1000);\nassert.strictEqual(used, 30, '同一 request_id 重放只应扣减一次，canonical used 应为 30，实际 ' + used);\nconst r = check(records, 60, 0, 1000);\nassert.strictEqual(r.decision, 'allow', '去重后 remaining=70 ⇒ cost=60 必须允许，实际 ' + r.decision);\nconsole.log('IDEMPOTENT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-B2/verify.js",
    "content": "require('./check-idempotent.js');\nconsole.log('F08-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS6 规定 canonical used = raw 去重(request_id) → 窗口过滤 → accepted cost 求和。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/window.json",
    "content": "{\n  \"start\": 0,\n  \"end\": 1000\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 60,\n  \"user\": 60,\n  \"endpoint\": 60\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n    if (r.ts < winStart || r.ts >= winEnd) continue;\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/usage/src-a.jsonl",
    "content": "{\"request_id\":\"a1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":20,\"ts\":10}\n{\"request_id\":\"a2\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e2\",\"cost\":15,\"ts\":20}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/usage/src-b.jsonl",
    "content": "{\"request_id\":\"b1\",\"tenant\":\"t2\",\"user\":\"u2\",\"endpoint\":\"e1\",\"cost\":25,\"ts\":30}\n{\"request_id\":\"b1\",\"tenant\":\"t2\",\"user\":\"u2\",\"endpoint\":\"e1\",\"cost\":25,\"ts\":31}\n{\"request_id\":\"b2\",\"tenant\":\"t2\",\"user\":\"u2\",\"endpoint\":\"e2\",\"cost\":5,\"ts\":1000}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/usage/src-c.jsonl",
    "content": "{\"request_id\":\"c1\",\"tenant\":\"t1\",\"user\":\"u3\",\"endpoint\":\"e1\",\"cost\":10,\"ts\":40}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/work/src-a.js",
    "content": "// 用量来源汇总工具：对本来源记录做去重 + 窗口过滤 + 分组求和，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-a\";\nconst DUR = 3500;\nconst TOKEN = \"SA-1a2b\";\nconst WIN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'window.json'), 'utf8'));\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst seen = new Set();\nconst groups = {};\nlet accepted = 0;\nfor (const r of records) {\n  if (seen.has(r.request_id)) continue;\n  seen.add(r.request_id);\n  if (r.ts < WIN.start || r.ts >= WIN.end) continue;\n  const key = r.tenant + '/' + r.endpoint;\n  groups[key] = (groups[key] || 0) + Number(r.cost);\n  accepted += Number(r.cost);\n}\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, accepted, count: records.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, groups, accepted }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms accepted=' + accepted);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/work/src-b.js",
    "content": "// 用量来源汇总工具：对本来源记录做去重 + 窗口过滤 + 分组求和，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-b\";\nconst DUR = 3500;\nconst TOKEN = \"SB-77c4\";\nconst WIN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'window.json'), 'utf8'));\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst seen = new Set();\nconst groups = {};\nlet accepted = 0;\nfor (const r of records) {\n  if (seen.has(r.request_id)) continue;\n  seen.add(r.request_id);\n  if (r.ts < WIN.start || r.ts >= WIN.end) continue;\n  const key = r.tenant + '/' + r.endpoint;\n  groups[key] = (groups[key] || 0) + Number(r.cost);\n  accepted += Number(r.cost);\n}\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, accepted, count: records.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, groups, accepted }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms accepted=' + accepted);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/work/src-c.js",
    "content": "// 用量来源汇总工具：对本来源记录做去重 + 窗口过滤 + 分组求和，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-c\";\nconst DUR = 3000;\nconst TOKEN = \"SC-31e8\";\nconst WIN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'window.json'), 'utf8'));\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst seen = new Set();\nconst groups = {};\nlet accepted = 0;\nfor (const r of records) {\n  if (seen.has(r.request_id)) continue;\n  seen.add(r.request_id);\n  if (r.ts < WIN.start || r.ts >= WIN.end) continue;\n  const key = r.tenant + '/' + r.endpoint;\n  groups[key] = (groups[key] || 0) + Number(r.cost);\n  accepted += Number(r.cost);\n}\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, accepted, count: records.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, groups, accepted }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms accepted=' + accepted);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行汇总 + 账务 canonical 等价（不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// ---- 独立参考实现（S6 canonical；与任务实现无共享代码）----\nconst REF = (function () {\n  function canonicalUsed(records, start, end) {\n    const seen = {};\n    let used = 0;\n    for (const r of records) {\n      if (seen[r.request_id]) continue;\n      seen[r.request_id] = true;\n      if (r.ts < start || r.ts >= end) continue;\n      used += Number(r.cost);\n    }\n    return used;\n  }\n  function groups(records, start, end) {\n    const seen = {};\n    const g = {};\n    for (const r of records) {\n      if (seen[r.request_id]) continue;\n      seen[r.request_id] = true;\n      if (r.ts < start || r.ts >= end) continue;\n      const k = r.tenant + '/' + r.endpoint;\n      g[k] = (g[k] || 0) + Number(r.cost);\n    }\n    return Object.fromEntries(Object.keys(g).sort().map((k) => [k, g[k]]));\n  }\n  return { canonicalUsed, groups };\n})();\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-a\",\"src-b\",\"src-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst win = JSON.parse(fs.readFileSync(path.join(__dirname, 'window.json'), 'utf8'));\nconst all = [];\nfor (const s of SOURCES) { const p = path.join(__dirname, 'usage', s + '.jsonl'); const rs = fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); for (const r of rs) all.push(r); }\nconst refUsed = REF.canonicalUsed(all, win.start, win.end);\nconst refGroups = REF.groups(all, win.start, win.end);\nconst ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\nassert.strictEqual(ledger.used, refUsed, 'ledger.used 与独立参考不一致：' + ledger.used + ' vs ' + refUsed);\nassert.deepStrictEqual(canon(ledger.groups), canon(refGroups), 'ledger 分组与独立参考不一致');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('LEDGER OK sources=' + SOURCES.length + ' span=' + span + 'ms used=' + refUsed + ' canonical=equivalent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-a\",\"src-b\",\"src-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\nassert.ok(typeof ledger.used === 'number' && ledger.used > 0, 'ledger.used 非法');\nassert.ok(ledger.quota && typeof ledger.quota === 'object', 'ledger.quota 缺失');\nconsole.log(\"F08-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/CONTRACT.md",
    "content": "# 配额与记账契约\n\nS1 额度计算：remaining = quota - used；cost <= remaining ⇒ allow；cost > remaining ⇒ reject。\nS2 时间窗口：fixed window，区间 [window_start, window_end)；timestamp == window_end 的记录归**下一窗口**。\nS3 并发扣减：used_after = used_before + Σ accepted_cost；used_after <= quota（不得超扣，可部分拒绝）。\nS4 多层限制：global → tenant → user → endpoint；effective_quota = min(所有适用层限制)；\n   拒绝时必须给出 reject_layer（导致超出的具体层级）。\nS5 幂等记账：同一 request_id 重放不得重复扣减。\nS6 对账：raw usage records 为 canonical source；canonical used = 去重(request_id) → 窗口过滤 → accepted cost 求和。\n\n本任务窗口参数：start=0, end=1000\nS5/S6 全局幂等：**同一 request_id 跨来源重复时只计一次**；tie-break = 取 ts 最小者，ts 相同则取来源名序最小者；随后按 fixed window 过滤并求和。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/window.json",
    "content": "{\n  \"start\": 0,\n  \"end\": 1000\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/quota.json",
    "content": "{\n  \"global\": 100,\n  \"tenant\": 50,\n  \"user\": 50,\n  \"endpoint\": 50\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/account.js",
    "content": "// 账户：canonical used = 去重(request_id) → fixed window 过滤 → accepted cost 求和\nconst fs = require('fs');\nconst path = require('path');\nfunction readUsage(dir) {\n  const p = path.join(dir, 'usage.jsonl');\n  if (!fs.existsSync(p)) return [];\n  return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n}\nfunction canonicalUsed(records, winStart, winEnd) {\n  const seen = new Set();\n  let used = 0;\n  for (const r of records) {\n    if (seen.has(r.request_id)) continue;\n    seen.add(r.request_id);\n    if (r.ts < winStart || r.ts >= winEnd) continue;\n    used += Number(r.cost);\n  }\n  return used;\n}\nmodule.exports = { readUsage, canonicalUsed };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/usage/src-x.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"tx\",\"user\":\"ux\",\"endpoint\":\"e1\",\"cost\":30,\"ts\":10}\n{\"request_id\":\"r2\",\"tenant\":\"tx\",\"user\":\"ux\",\"endpoint\":\"e2\",\"cost\":8,\"ts\":1000}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/usage/src-y.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"ty\",\"user\":\"uy\",\"endpoint\":\"e1\",\"cost\":15,\"ts\":20}\n{\"request_id\":\"r3\",\"tenant\":\"ty\",\"user\":\"uy\",\"endpoint\":\"e1\",\"cost\":18,\"ts\":15}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/usage/src-z.jsonl",
    "content": "{\"request_id\":\"r4\",\"tenant\":\"tz\",\"user\":\"uz\",\"endpoint\":\"e3\",\"cost\":7,\"ts\":25}\n{\"request_id\":\"r5\",\"tenant\":\"tz\",\"user\":\"uz\",\"endpoint\":\"e1\",\"cost\":13,\"ts\":26}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/work/src-x.js",
    "content": "// 分片汇总工具：输出本来源**原始记录**（去重留待全局）+ 局部去重后的朴素值，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-x\";\nconst DUR = 3500;\nconst TOKEN = \"SX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst WIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'window.json'), 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst stamped = records.map((r) => Object.assign({}, r, { source: SRC }));\nconst within = stamped.filter((r) => r.ts >= WIN.start && r.ts < WIN.end);\nconst localSeen = new Set();\nlet naive = 0;\nfor (const r of within) { if (localSeen.has(r.request_id)) continue; localSeen.add(r.request_id); naive += Number(r.cost); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, naiveAccepted: naive, count: within.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, records: within, naiveAccepted: naive }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms naiveAccepted=' + naive);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/work/src-y.js",
    "content": "// 分片汇总工具：输出本来源**原始记录**（去重留待全局）+ 局部去重后的朴素值，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-y\";\nconst DUR = 3200;\nconst TOKEN = \"SY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst WIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'window.json'), 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst stamped = records.map((r) => Object.assign({}, r, { source: SRC }));\nconst within = stamped.filter((r) => r.ts >= WIN.start && r.ts < WIN.end);\nconst localSeen = new Set();\nlet naive = 0;\nfor (const r of within) { if (localSeen.has(r.request_id)) continue; localSeen.add(r.request_id); naive += Number(r.cost); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, naiveAccepted: naive, count: within.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, records: within, naiveAccepted: naive }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms naiveAccepted=' + naive);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/work/src-z.js",
    "content": "// 分片汇总工具：输出本来源**原始记录**（去重留待全局）+ 局部去重后的朴素值，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-z\";\nconst DUR = 3000;\nconst TOKEN = \"SZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst WIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'window.json'), 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst records = fs.readFileSync(path.join(ROOT, 'usage', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst stamped = records.map((r) => Object.assign({}, r, { source: SRC }));\nconst within = stamped.filter((r) => r.ts >= WIN.start && r.ts < WIN.end);\nconst localSeen = new Set();\nlet naive = 0;\nfor (const r of within) { if (localSeen.has(r.request_id)) continue; localSeen.add(r.request_id); naive += Number(r.cost); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, naiveAccepted: naive, count: within.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, records: within, naiveAccepted: naive }, null, 2) + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms naiveAccepted=' + naive);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行分片汇总 + 全局幂等等价（不执行任何分片工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// ---- 独立参考实现（全局幂等；与任务实现、account.js 均无共享代码）----\nfunction refCanonical(records, start, end) {\n  const best = {};\n  for (const r of records) { const p = best[r.request_id]; if (!p || r.ts < p.ts || (r.ts === p.ts && String(r.source) < String(p.source))) best[r.request_id] = r; }\n  let used = 0; const groups = {};\n  for (const k of Object.keys(best)) { const r = best[k]; if (r.ts < start || r.ts >= end) continue; used += Number(r.cost); const key = r.tenant + '/' + r.endpoint; groups[key] = (groups[key] || 0) + Number(r.cost); }\n  return { used, groups: Object.fromEntries(Object.keys(groups).sort().map((k) => [k, groups[k]])) };\n}\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-x\",\"src-y\",\"src-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 分片数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst win = JSON.parse(fs.readFileSync(path.join(__dirname, 'window.json'), 'utf8'));\nconst all = []; const naiveTotal = (function () { let n = 0; for (const s of SOURCES) { const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8')); for (const r of frag.records) all.push(r); n += frag.naiveAccepted; } return n; })();\nconst ref = refCanonical(all, win.start, win.end);\nconst ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\nassert.strictEqual(ledger.used, ref.used, 'ledger.used 与全局幂等参考不一致：' + ledger.used + ' vs ' + ref.used);\nassert.deepStrictEqual(canon(ledger.groups), canon(ref.groups), 'ledger 分组与全局幂等参考不一致');\nassert.notStrictEqual(naiveTotal, ref.used, '本 fixture 必须使局部去重与全局幂等结果不同（否则失去区分力）');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('GLOBAL IDEMPOTENCY OK shards=' + SOURCES.length + ' span=' + span + 'ms naive=' + naiveTotal + ' canonical=' + ref.used);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-x\",\"src-y\",\"src-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst ledger = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));\nassert.ok(typeof ledger.used === 'number' && ledger.used > 0, 'ledger.used 非法');\nassert.ok(ledger.quota && typeof ledger.quota === 'object', 'ledger.quota 缺失');\nconsole.log(\"F08-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/mod-a/remaining.js",
    "content": "// A：remaining = quota - used\nfunction remaining(quota, used) { return used - quota; }\nmodule.exports = { remaining };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/mod-b/effective.js",
    "content": "// B：effective = min(layers)\nfunction effective(layers) { return Math.max.apply(null, layers); }\nmodule.exports = { effective };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/mod-c/window.js",
    "content": "// C：fixed window [start, end)\nfunction inWindow(ts, start, end) { return ts >= start && ts <= end; }\nmodule.exports = { inWindow };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { remaining } = require('./mod-a/remaining.js');\nassert.strictEqual(remaining(100, 30), 70);\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { effective } = require('./mod-b/effective.js');\nassert.strictEqual(effective([100, 80, 60, 70]), 60);\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { inWindow } = require('./mod-c/window.js');\nassert.strictEqual(inWindow(1000, 0, 1000), false);\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/check-report.js",
    "content": "const assert = require('assert');\nconst a = require('./mod-a/remaining.js');\nconst b = require('./mod-b/effective.js');\nconst c = require('./mod-c/window.js');\nassert.strictEqual(a.remaining(100, 30), 70);\nassert.strictEqual(b.effective([100, 80, 60]), 60);\nassert.strictEqual(c.inWindow(1000, 0, 1000), false);\nconsole.log('REPORT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nconsole.log('F08-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/usage.jsonl",
    "content": "{\"request_id\":\"r1\",\"tenant\":\"t1\",\"user\":\"u1\",\"endpoint\":\"e1\",\"cost\":30,\"ts\":10}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/records-fixed.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/aggregation-normalized.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/ledger-rebuilt.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/reconciliation-report.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));\nassert.strictEqual(rd('records-fixed.json').repaired, true, 'records-fixed.json 缺少 repaired');\nassert.strictEqual(rd('aggregation-normalized.json').normalized, true, 'aggregation-normalized.json 缺少 normalized');\nassert.strictEqual(typeof rd('ledger-rebuilt.json').used, 'number', 'ledger-rebuilt.json 缺少 used');\nassert.strictEqual(rd('reconciliation-report.json').reconciled, true, 'reconciliation-report.json 缺少 reconciled');\nconsole.log('F08-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/CONTRACT-quota.md",
    "content": "# 新契约\n\n1. 必须保留 legacy 字段 billed（外部消费方逐字段回放）；\n2. 必须新增 remaining 与 reject_layer 字段（配额语义）；\n3. 两条必须同时成立。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/billing.js",
    "content": "// 已上线实现：仅输出 billed，且被 legacy/billing.json 冻结\nfunction charge(cost, used) { return { billed: cost + used }; }\nmodule.exports = { charge };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/legacy/billing.json",
    "content": "{\n  \"billed\": 40\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：按 legacy/billing.json 逐字段回放 charge 的输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { charge } = require('../billing.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'billing.json'), 'utf8'));\nconst out = charge(10, 30);\nassert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');\nassert.strictEqual(out.billed, golden.billed, 'legacy billed 被改变');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有实现\nconst base = require('./billing.js');\nmodule.exports = { charge: base.charge };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/check.js",
    "content": "const assert = require('assert');\nconst { charge } = require('./index.js');\nconst out = charge(10, 30, { quota: 100 });\nassert.strictEqual(out.billed, 40, 'legacy billed 必须保留');\nassert.strictEqual(typeof out.remaining, 'number', '新契约：必须携带 remaining，实际 ' + JSON.stringify(out));\nassert.ok(out.reject_layer === null || typeof out.reject_layer === 'string', '新契约：必须携带 reject_layer');\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F08-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/ledger-authority.md",
    "content": "# 权威性契约\n\nledger.json 是业务真值源；display-snapshot.json 只是**派生展示数据**，不得成为额度计算的权威来源。额度必须由账本推导（remaining = ledger.quota - ledger.used）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/ledger.json",
    "content": "{\n  \"quota\": 100,\n  \"used\": 80\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/display-snapshot.json",
    "content": "{\n  \"remaining\": 70,\n  \"note\": \"derived display data (stale)\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/ledger.js",
    "content": "// 受保护：账本读写（真值源）\nconst fs = require('fs');\nconst path = require('path');\nconst file = path.join(__dirname, 'ledger.json');\nfunction read() { return JSON.parse(fs.readFileSync(file, 'utf8')); }\nfunction setUsed(used) { const cur = read(); fs.writeFileSync(file, JSON.stringify({ quota: cur.quota, used }, null, 2) + '\\n'); }\nmodule.exports = { read, setUsed };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/display.js",
    "content": "// 展示层：当前直接读取 display-snapshot.json（派生数据被当成权威）\nconst fs = require('fs');\nconst path = require('path');\nfunction remaining() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'display-snapshot.json'), 'utf8')).remaining; }\nmodule.exports = { remaining };"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/reconcile.js",
    "content": "const assert = require('assert');\nconst ledger = require('./ledger.js');\nconst display = require('./display.js');\nconst l1 = ledger.read();\nassert.strictEqual(display.remaining(), l1.quota - l1.used, '展示额度必须由账本推导，实际 ' + display.remaining() + '，账本推导值 ' + (l1.quota - l1.used));\nledger.setUsed(90); // 账本更新：真值变化必须传播到展示\nassert.strictEqual(display.remaining(), 10, '账本更新后展示额度必须随之重算，实际 ' + display.remaining());\nconsole.log('RECONCILE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F08-E2/verify.js",
    "content": "require('./reconcile.js');\nconsole.log('F08-E2 OK');"
  }
];
