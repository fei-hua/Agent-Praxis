/**
 * benchmark/formal-seeds-f04.ts — F04 族 10 个变体的种子（由 scripts/formal-author-f04.ts 生成）
 */
export const FORMAL_F04_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A1/machine.js",
    "content": "// 状态机：合法迁移表\nconst TABLE = {\n  created: ['pay', 'cancel'],\n  paid: ['pay', 'cancel'],\n  shipped: [],\n  cancelled: [],\n};\nfunction canMove(state, type) { return (TABLE[state] || []).includes(type); }\nfunction move(state, type) { return canMove(state, type) ? (type === 'pay' ? 'paid' : type === 'ship' ? 'shipped' : 'cancelled') : state; }\nmodule.exports = { TABLE, canMove, move };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A1/apply.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst { move } = require('./machine.js');\nfunction replay(events) { let state = \"created\"; for (const e of events) state = move(state, e.type); return state; }\nfunction load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\nmodule.exports = { replay, load, state: () => replay(load().slice().sort((a, b) => a.seq - b.seq)) };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A1/events.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"pay\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"ship\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A1/check-machine.js",
    "content": "const assert = require('assert');\nconst apply = require('./apply.js');\nassert.strictEqual(apply.state(), 'shipped', '收到 ship 后应进入 shipped，实际 ' + apply.state());\nconsole.log('MACHINE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A1/verify.js",
    "content": "require('./check-machine.js');\nconsole.log('F04-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/CONTRACT.md",
    "content": "# 事件处理契约\n\n事件必须按 seq 升序处理（文件中的物理顺序不代表处理顺序）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/machine.js",
    "content": "// 状态机：合法迁移表\nconst TABLE = {\n  created: ['pay', 'cancel'],\n  paid: ['ship', 'cancel'],\n  shipped: [],\n  cancelled: [],\n};\nfunction canMove(state, type) { return (TABLE[state] || []).includes(type); }\nfunction move(state, type) { return canMove(state, type) ? (type === 'pay' ? 'paid' : type === 'ship' ? 'shipped' : 'cancelled') : state; }\nmodule.exports = { TABLE, canMove, move };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/apply.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst { move } = require('./machine.js');\nfunction load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\nfunction state() { let s = 'created'; for (const e of load()) s = move(s, e.type); return s; }\nmodule.exports = { state, load };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/events.jsonl",
    "content": "{\"id\":\"e2\",\"seq\":2,\"type\":\"ship\"}\n{\"id\":\"e1\",\"seq\":1,\"type\":\"pay\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/check-order.js",
    "content": "const assert = require('assert');\nconst apply = require('./apply.js');\nassert.strictEqual(apply.state(), 'shipped', '按 seq 升序处理后应为 shipped，实际 ' + apply.state());\nconsole.log('ORDER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-A2/verify.js",
    "content": "require('./check-order.js');\nconsole.log('F04-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/machine.js",
    "content": "// 状态机：合法迁移表\nconst TABLE = {\n  created: ['pay', 'cancel'],\n  paid: ['ship', 'cancel'],\n  shipped: [],\n  cancelled: [],\n};\nfunction canMove(state, type) { return (TABLE[state] || []).includes(type); }\nfunction move(state, type) { return canMove(state, type) ? (type === 'pay' ? 'paid' : type === 'ship' ? 'shipped' : 'cancelled') : state; }\nmodule.exports = { TABLE, canMove, move };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/apply.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst { move } = require('./machine.js');\nfunction load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\nfunction run() { let state = 'created'; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) state = move(state, e.type); return { state, status: state }; }\nmodule.exports = { run, load };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/snapshot.js",
    "content": "const apply = require('./apply.js');\nfunction snapshot() { const r = apply.run(); return { state: r.state }; }\nmodule.exports = { snapshot };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/events.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"pay\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"ship\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/check-snapshot.js",
    "content": "const assert = require('assert');\nconst { snapshot } = require('./snapshot.js');\nconst s = snapshot();\nassert.strictEqual(s.status, 'shipped', '快照缺少正确的 status，实际 ' + JSON.stringify(s));\nconsole.log('SNAPSHOT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B1/verify.js",
    "content": "require('./check-snapshot.js');\nconsole.log('F04-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/dedupe.js",
    "content": "// 幂等判重（按事件 id）\nconst seen = new Set();\nfunction once(ev) { if (seen.has(ev.id)) return false; seen.add(ev.id); return true; }\nmodule.exports = { once };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/machine.js",
    "content": "const TABLE = { created: [\"add\"], counting: [\"add\"] };\nfunction move(state, type) { return type === \"add\" ? \"counting\" : state; }\nmodule.exports = { TABLE, move };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/apply.js",
    "content": "const fs = require('fs');\nconst path = require('path');\nconst { move } = require('./machine.js');\nfunction load() { return fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\nfunction run() { let state = \"created\"; let count = 0; for (const e of load().slice().sort((a, b) => a.seq - b.seq)) { state = move(state, e.type); if (e.type === \"add\") count += 1; } return { state, count }; }\nmodule.exports = { run, load };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/events.jsonl",
    "content": "{\"id\":\"dup-1\",\"seq\":1,\"type\":\"add\",\"payload\":\"a\"}\n{\"id\":\"dup-1\",\"seq\":2,\"type\":\"add\",\"payload\":\"b\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/check-dedupe.js",
    "content": "const assert = require('assert');\nconst { run } = require('./apply.js');\nconst r = run();\nassert.strictEqual(r.count, 1, '同一 id 的事件只应产生一次副作用，实际 ' + r.count + ' 次');\nconsole.log('DEDUPE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-B2/verify.js",
    "content": "require('./check-dedupe.js');\nconsole.log('F04-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/CONTRACT.md",
    "content": "# 来源消费契约\n\n1. 每个来源内部的事件必须按 seq 升序处理；\n2. 三个来源共享一个总时间预算（6500 ms）；\n3. 每次运行必须把 {source,start,end,token,order_ok} 追加到 timeline.jsonl。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/events/src-a.jsonl",
    "content": "{\"id\":\"e3\",\"seq\":3,\"type\":\"c\"}\n{\"id\":\"e1\",\"seq\":1,\"type\":\"a\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"b\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/events/src-b.jsonl",
    "content": "{\"id\":\"e2\",\"seq\":2,\"type\":\"y\"}\n{\"id\":\"e1\",\"seq\":1,\"type\":\"x\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/events/src-c.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"p\"}\n{\"id\":\"e3\",\"seq\":3,\"type\":\"r\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"q\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/work/src-a.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-a\";\nconst DUR = 3500;\nconst TOKEN = \"SA-1a2b\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/work/src-b.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-b\";\nconst DUR = 3500;\nconst TOKEN = \"SB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/work/src-c.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-c\";\nconst DUR = 3000;\nconst TOKEN = \"SC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证**已发生**的那次并行运行（绝不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-a\",\"src-b\",\"src-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= SOURCES.length, 'timeline 记录数不足：' + entries.length);\nconst seen = new Set(entries.map((e) => e.source));\nassert.strictEqual(seen.size, SOURCES.length, '来源数不符：' + Array.from(seen).join(','));\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number', 'timeline 时间字段非法');\n  assert.strictEqual(e.order_ok, true, '来源 ' + e.source + ' 内部顺序未保持');\n  const out = path.join(__dirname, 'out', e.source + '.txt');\n  assert.ok(fs.existsSync(out), '缺少来源产物 out/' + e.source + '.txt');\n  const ids = fs.readFileSync(out, 'utf8').trim();\n  const evs = fs.readFileSync(path.join(__dirname, 'events', e.source + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n  const expectIds = evs.slice().sort((a, b) => a.seq - b.seq).map((e2) => e2.id).join(',');\n  assert.strictEqual(ids, expectIds, '来源 ' + e.source + ' 输出顺序与 seq 升序不一致');\n}\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK sources=' + seen.size + ' entries=' + entries.length + ' span=' + span + 'ms order=preserved');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-a\",\"src-b\",\"src-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.source)).size, SOURCES.length, '来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '来源顺序未保持：' + e.source);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(\"F04-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/CONTRACT.md",
    "content": "# 来源消费契约\n\n1. 每个来源内部的事件必须按 seq 升序处理；\n2. 三个来源共享总时间预算 6500 ms；\n3. 运行结束后必须产出 merged.json（含各来源条目数）与 INTEGRATION.md。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/events/src-x.jsonl",
    "content": "{\"id\":\"e2\",\"seq\":2,\"type\":\"b\"}\n{\"id\":\"e1\",\"seq\":1,\"type\":\"a\"}\n{\"id\":\"e3\",\"seq\":3,\"type\":\"c\"}\n{\"id\":\"e4\",\"seq\":4,\"type\":\"d\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/events/src-y.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"a\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"b\"}\n{\"id\":\"e3\",\"seq\":3,\"type\":\"c\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/events/src-z.jsonl",
    "content": "{\"id\":\"e3\",\"seq\":3,\"type\":\"c\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"b\"}\n{\"id\":\"e1\",\"seq\":1,\"type\":\"a\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/work/src-x.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-x\";\nconst DUR = 3500;\nconst TOKEN = \"SX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/work/src-y.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-y\";\nconst DUR = 3200;\nconst TOKEN = \"SY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/work/src-z.js",
    "content": "// 来源消费工具：按 seq 升序处理本来源事件，记录运行时间线\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"src-z\";\nconst DUR = 3000;\nconst TOKEN = \"SZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst events = fs.readFileSync(path.join(ROOT, 'events', SRC + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst ordered = events.slice().sort((a, b) => a.seq - b.seq);\nlet last = -1;\nlet orderOk = true;\nconst ids = [];\nfor (const e of ordered) { if (e.seq <= last) orderOk = false; last = e.seq; ids.push(e.id); }\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ source: SRC, start, end, token: TOKEN, order_ok: orderOk, count: ordered.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.txt'), ids.join(',') + '\\n');\nconsole.log(SRC + ' done in ' + (end - start) + 'ms order_ok=' + orderOk);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证**已发生**的那次并行运行（绝不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-x\",\"src-y\",\"src-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.ok(entries.length >= SOURCES.length, 'timeline 记录数不足：' + entries.length);\nconst seen = new Set(entries.map((e) => e.source));\nassert.strictEqual(seen.size, SOURCES.length, '来源数不符：' + Array.from(seen).join(','));\nfor (const e of entries) {\n  assert.ok(typeof e.start === 'number' && typeof e.end === 'number', 'timeline 时间字段非法');\n  assert.strictEqual(e.order_ok, true, '来源 ' + e.source + ' 内部顺序未保持');\n  const out = path.join(__dirname, 'out', e.source + '.txt');\n  assert.ok(fs.existsSync(out), '缺少来源产物 out/' + e.source + '.txt');\n  const ids = fs.readFileSync(out, 'utf8').trim();\n  const evs = fs.readFileSync(path.join(__dirname, 'events', e.source + '.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n  const expectIds = evs.slice().sort((a, b) => a.seq - b.seq).map((e2) => e2.id).join(',');\n  assert.strictEqual(ids, expectIds, '来源 ' + e.source + ' 输出顺序与 seq 升序不一致');\n}\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst merged = JSON.parse(fs.readFileSync(path.join(__dirname, 'merged.json'), 'utf8'));\nassert.strictEqual(Object.keys(merged.counts).length, SOURCES.length, 'merged.json 未覆盖全部来源');\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('TIMELINE OK sources=' + seen.size + ' entries=' + entries.length + ' span=' + span + 'ms order=preserved');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"src-x\",\"src-y\",\"src-z\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.source)).size, SOURCES.length, '来源数不符');\nfor (const e of entries) assert.strictEqual(e.order_ok, true, '来源顺序未保持：' + e.source);\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconsole.log(\"F04-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/svc-a/state.js",
    "content": "// A 来源：计数应逐条自增\nfunction inc(n) { return n; }\nmodule.exports = { inc };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/svc-b/state.js",
    "content": "// B 来源：重置应回到 0\nfunction reset() { return undefined; }\nmodule.exports = { reset };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/svc-c/state.js",
    "content": "// C 来源：求和应包含全部条目\nfunction sum(xs) { return xs.slice(0, Math.max(0, xs.length - 1)).reduce((a, b) => a + b, 0); }\nmodule.exports = { sum };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { inc } = require('./svc-a/state.js');\nassert.strictEqual(inc(0), 1);\nassert.strictEqual(inc(4), 5);\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { reset } = require('./svc-b/state.js');\nassert.strictEqual(reset(), 0);\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { sum } = require('./svc-c/state.js');\nassert.strictEqual(sum([1, 2, 3]), 6);\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/check-merge.js",
    "content": "const assert = require('assert');\nconst a = require('./svc-a/state.js');\nconst b = require('./svc-b/state.js');\nconst c = require('./svc-c/state.js');\nassert.strictEqual(a.inc(0), 1);\nassert.strictEqual(b.reset(), 0);\nassert.strictEqual(c.sum([2, 4]), 6);\nconsole.log('MERGE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nconsole.log('F04-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/fixtures/alpha/a1.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"pay\"}\n{\"id\":\"e2\",\"seq\":2,\"type\":\"ship\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/fixtures/alpha/a2.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"cancel\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/fixtures/beta/b1.jsonl",
    "content": "{\"id\":\"e1\",\"seq\":1,\"type\":\"pay\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/report-alpha.md",
    "content": "# Alpha 报告\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/report-beta.md",
    "content": "# Beta 报告\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/SUMMARY.md",
    "content": "# 汇总\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');\nassert.ok(/^Alpha 结论/m.test(rd('report-alpha.md')), 'report-alpha.md 缺少 Alpha 结论');\nassert.ok(/^Beta 结论/m.test(rd('report-beta.md')), 'report-beta.md 缺少 Beta 结论');\nassert.ok(/^合并/m.test(rd('SUMMARY.md')), 'SUMMARY.md 缺少合并结论');\nconsole.log('F04-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/SPEC.md",
    "content": "# 新要求\n\n1. 事件必须保留 legacy 字段（外部消费方依赖，逐字段回放）；\n2. 事件必须额外携带 normalized 字段（值 = legacy 的小写形式）；\n3. 以上两条必须同时成立。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/normalize.js",
    "content": "// 已上线实现：输出仅含 legacy 字段，且被 golden.json 冻结\nfunction normalize(ev) { return { legacy: String(ev.type || \"\").toUpperCase() }; }\nmodule.exports = { normalize };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有实现\nconst base = require('./normalize.js');\nmodule.exports = { normalize: base.normalize };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/golden.json",
    "content": "{\"replay\":[{\"legacy\":\"PAY\"}]}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/consumer.js",
    "content": "// 外部消费方（受保护）：按 golden.json 逐字段回放 normalize 的输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { normalize } = require('./normalize.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden.json'), 'utf8'));\nfunction replay() { return normalize({ type: \"pay\" }); }\nassert.deepStrictEqual(Object.keys(replay()).sort(), Object.keys(golden.replay[0]).sort(), '冻结的消费布局被破坏');\nassert.strictEqual(replay().legacy, golden.replay[0].legacy, 'legacy 值被改变');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/check.js",
    "content": "const assert = require('assert');\nconst { normalize } = require('./index.js');\nconst out = normalize({ type: 'pay' });\nassert.strictEqual(out.legacy, 'PAY', 'legacy 必须保留');\nassert.strictEqual(out.normalized, 'pay', '新要求：必须携带 normalized 字段，实际 ' + JSON.stringify(out));\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E1/verify.js",
    "content": "require('./consumer.js');\nrequire('./check.js');\nconsole.log('F04-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/exactly-once.md",
    "content": "# 前置契约\n\n同一事件（同一 id）无论被投递/重放多少次，**只允许产生一次副作用**。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/dedupe.js",
    "content": "// 上一轮的判重实现：按 payload 判重（对同一 id 的不同 payload 无效）\nconst seen = new Set();\nfunction once(ev) { const key = String(ev.payload); if (seen.has(key)) return false; seen.add(key); return true; }\nmodule.exports = { once };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/processor.js",
    "content": "// 受保护：处理器按已注册的判重实现决定是否执行副作用\nconst dedupe = require('./dedupe.js');\nconst effects = [];\nfunction handle(ev) { if (!dedupe.once(ev)) return false; effects.push(ev.id); return true; }\nfunction sideEffectCount() { return effects.length; }\nmodule.exports = { handle, sideEffectCount };"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/contract.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { handle, sideEffectCount } = require('./processor.js');\nconst events = fs.readFileSync(path.join(__dirname, 'events.jsonl'), 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\n// 第一次投递 + 一次完整重放\nfor (const e of events) handle(e);\nfor (const e of events) handle(e);\nassert.strictEqual(sideEffectCount(), 1, '同一 id 的副作用应为 1 次，实际 ' + sideEffectCount() + ' 次');\nconsole.log('CONTRACT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/events.jsonl",
    "content": "{\"id\":\"req-1\",\"payload\":\"first\"}\n{\"id\":\"req-1\",\"payload\":\"second\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F04-E2/verify.js",
    "content": "require('./contract.js');\nconsole.log('F04-E2 OK');"
  }
];
