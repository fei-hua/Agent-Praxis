/**
 * benchmark/formal-seeds-f07.ts — F07 族 10 个变体的种子（由 scripts/formal-author-f07.ts 生成）
 */
export const FORMAL_F07_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/layers/defaults.json",
    "content": "{\n  \"timeout\": 30,\n  \"retries\": 3\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/layers/environment.json",
    "content": "{\n  \"timeout\": 20\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/layers/profile.json",
    "content": "{\n  \"timeout\": 10\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/layers/local.json",
    "content": "{\n  \"timeout\": 5\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['local', 'profile', 'environment', 'defaults']; // 缺陷：覆盖方向被反转\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/resolve.js",
    "content": "// 按层叠链生成 effective config（读取 layers/ 下的层文件）\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require('./merge.js');\nconst LAYER_NAMES = ['defaults', 'environment', 'profile', 'local'];\nfunction loadLayers() {\n  const layers = {};\n  for (const n of LAYER_NAMES) {\n    const p = path.join(__dirname, 'layers', n + '.json');\n    if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8'));\n  }\n  return layers;\n}\nfunction resolve() { return mergeLayers(loadLayers()); }\nmodule.exports = { resolve, loadLayers };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/check-precedence.js",
    "content": "const assert = require('assert');\nconst { resolve } = require('./resolve.js');\nconst cfg = resolve();\nassert.strictEqual(cfg.timeout, 5, 'local 必须覆盖 defaults：期望 timeout=5，实际 ' + cfg.timeout);\nassert.strictEqual(cfg.retries, 3, 'defaults 独有的键必须保留，实际 ' + cfg.retries);\nconsole.log('PRECEDENCE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A1/verify.js",
    "content": "require('./check-precedence.js');\nconsole.log('F07-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/layers/defaults.json",
    "content": "{\n  \"timeout\": 30,\n  \"retries\": 3,\n  \"debug\": true\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/layers/environment.json",
    "content": "{\n  \"timeout\": 20\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/layers/profile.json",
    "content": "{\n  \"timeout\": 10\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/layers/local.json",
    "content": "{\n  \"timeout\": 5,\n  \"debug\": null\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  const keys = Object.keys(base).concat(Object.keys(over)).filter((k, i, a) => a.indexOf(k) === i);\n  for (const k of keys) {\n    const v = over[k];\n    if (v === undefined || v === null) { delete out[k]; continue; } // 缺陷：缺失键被当作删除\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/resolve.js",
    "content": "// 按层叠链生成 effective config（读取 layers/ 下的层文件）\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require('./merge.js');\nconst LAYER_NAMES = ['defaults', 'environment', 'profile', 'local'];\nfunction loadLayers() {\n  const layers = {};\n  for (const n of LAYER_NAMES) {\n    const p = path.join(__dirname, 'layers', n + '.json');\n    if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8'));\n  }\n  return layers;\n}\nfunction resolve() { return mergeLayers(loadLayers()); }\nmodule.exports = { resolve, loadLayers };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/check-null-missing.js",
    "content": "const assert = require('assert');\nconst { resolve } = require('./resolve.js');\nconst cfg = resolve();\nassert.strictEqual(cfg.timeout, 5, 'local 必须覆盖 defaults：期望 timeout=5，实际 ' + cfg.timeout);\nassert.strictEqual(cfg.retries, 3, 'S1：environment 层缺失的键不得删除下层值，实际 ' + cfg.retries);\nassert.ok(!Object.prototype.hasOwnProperty.call(cfg, 'debug'), 'S5：null 必须表示删除该键，实际 ' + JSON.stringify(cfg.debug));\nconsole.log('NULL-MISSING OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-A2/verify.js",
    "content": "require('./check-null-missing.js');\nconsole.log('F07-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/layers/defaults.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.internal\",\n      \"timeout\": 30,\n      \"pool\": 5\n    },\n    \"cache\": {\n      \"ttl\": 60\n    }\n  },\n  \"log\": {\n    \"level\": \"info\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/layers/environment.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 20\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/layers/profile.json",
    "content": "{\n  \"service\": {\n    \"cache\": {\n      \"ttl\": 120\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/layers/local.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.local\"\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    // 缺陷：不做递归合并，嵌套对象被整体替换（深层键丢失）\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/resolve.js",
    "content": "// 按层叠链生成 effective config（读取 layers/ 下的层文件）\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require('./merge.js');\nconst LAYER_NAMES = ['defaults', 'environment', 'profile', 'local'];\nfunction loadLayers() {\n  const layers = {};\n  for (const n of LAYER_NAMES) {\n    const p = path.join(__dirname, 'layers', n + '.json');\n    if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8'));\n  }\n  return layers;\n}\nfunction resolve() { return mergeLayers(loadLayers()); }\nmodule.exports = { resolve, loadLayers };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/check-nested.js",
    "content": "const assert = require('assert');\nconst { resolve } = require('./resolve.js');\nconst cfg = resolve();\nassert.strictEqual(cfg.service.database.timeout, 20, 'environment 层的 timeout=20 必须生效，实际 ' + cfg.service.database.timeout);\nassert.strictEqual(cfg.service.database.pool, 5, 'defaults 层的深层键 pool 必须保留，实际 ' + JSON.stringify(cfg.service.database));\nassert.strictEqual(cfg.service.database.host, 'db.local', 'local 层必须覆盖 host，实际 ' + cfg.service.database.host);\nassert.strictEqual(cfg.service.cache.ttl, 120, 'profile 层的嵌套键 cache.ttl 必须与 defaults 合并，实际 ' + JSON.stringify(cfg.service.cache));\nassert.strictEqual(cfg.log.level, 'info', '未参与的键必须保留，实际 ' + cfg.log.level);\nconsole.log('NESTED OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B1/verify.js",
    "content": "require('./check-nested.js');\nconsole.log('F07-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/layers/defaults.json",
    "content": "{\n  \"plugins\": [\n    \"core\"\n  ],\n  \"tags\": [\n    \"base\"\n  ],\n  \"timeout\": 30\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/layers/environment.json",
    "content": "{\n  \"plugins\": [\n    \"env-a\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/layers/profile.json",
    "content": "{\n  \"plugins\": [\n    \"prof-b\"\n  ],\n  \"tags\": [\n    \"prof\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/layers/local.json",
    "content": "{\n  \"plugins\": [\n    \"local-c\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'append'; // 缺陷：CONTRACT 声明 replace\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/resolve.js",
    "content": "// 按层叠链生成 effective config（读取 layers/ 下的层文件）\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require('./merge.js');\nconst LAYER_NAMES = ['defaults', 'environment', 'profile', 'local'];\nfunction loadLayers() {\n  const layers = {};\n  for (const n of LAYER_NAMES) {\n    const p = path.join(__dirname, 'layers', n + '.json');\n    if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8'));\n  }\n  return layers;\n}\nfunction resolve() { return mergeLayers(loadLayers()); }\nmodule.exports = { resolve, loadLayers };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/check-array-semantics.js",
    "content": "const assert = require('assert');\nconst { resolve } = require('./resolve.js');\nconst cfg = resolve();\nassert.deepStrictEqual(cfg.plugins, ['local-c'], '数组语义必须是 replace（上层整体替换），实际 ' + JSON.stringify(cfg.plugins));\nassert.deepStrictEqual(cfg.tags, ['prof'], '数组语义必须是 replace（local 未声明 tags 时保留 profile 结果），实际 ' + JSON.stringify(cfg.tags));\nassert.strictEqual(cfg.timeout, 30, '非数组键仍按层叠覆盖（local 未声明则保留 defaults），实际 ' + cfg.timeout);\nconsole.log('ARRAY OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-B2/verify.js",
    "content": "require('./check-array-semantics.js');\nconsole.log('F07-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n\n## C 类附加条款\n\n1. 三个来源共享总预算 6500 ms；\n2. 并行加载不得破坏层叠语义：effective config 必须等于由固定层叠规则从同一批层文件独立生成的参考结果；\n3. effective config 必须包含必需键：service / features / log。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/layers/defaults.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.internal\",\n      \"timeout\": 30\n    }\n  },\n  \"features\": [\n    \"core\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/layers/environment.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 20\n    }\n  },\n  \"log\": {\n    \"level\": \"info\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/layers/profile.json",
    "content": "{\n  \"features\": [\n    \"prof\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/layers/local.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.local\"\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/work/cfg-a.js",
    "content": "// 配置来源加载工具：读取本来源负责的层文件并记录时间线（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"cfg-a\";\nconst LAYERS = [\"defaults\"];\nconst DUR = 3500;\nconst TOKEN = \"CA-3f91\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {};\nfor (const n of LAYERS) layers[n] = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers', n + '.json'), 'utf8'));\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, layers: LAYERS }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, token: TOKEN, layers }, null, 2) + '\\n');\nconsole.log(SRC + ' loaded [' + LAYERS.join(',') + '] in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/work/cfg-b.js",
    "content": "// 配置来源加载工具：读取本来源负责的层文件并记录时间线（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"cfg-b\";\nconst LAYERS = [\"environment\",\"profile\"];\nconst DUR = 3500;\nconst TOKEN = \"CB-77d2\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {};\nfor (const n of LAYERS) layers[n] = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers', n + '.json'), 'utf8'));\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, layers: LAYERS }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, token: TOKEN, layers }, null, 2) + '\\n');\nconsole.log(SRC + ' loaded [' + LAYERS.join(',') + '] in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/work/cfg-c.js",
    "content": "// 配置来源加载工具：读取本来源负责的层文件并记录时间线（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SRC = \"cfg-c\";\nconst LAYERS = [\"local\"];\nconst DUR = 3000;\nconst TOKEN = \"CC-19a4\";\nconst ROOT = path.join(__dirname, '..');\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {};\nfor (const n of LAYERS) layers[n] = JSON.parse(fs.readFileSync(path.join(ROOT, 'layers', n + '.json'), 'utf8'));\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: SRC, start, end, token: TOKEN, layers: LAYERS }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SRC + '.json'), JSON.stringify({ src: SRC, token: TOKEN, layers }, null, 2) + '\\n');\nconsole.log(SRC + ' loaded [' + LAYERS.join(',') + '] in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行加载 + **层叠语义等价**（不执行任何来源工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 固定层叠规则（独立参考实现，与任务实现无关；S1–S5）\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\nconst isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);\nfunction mergeObjectsRef(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isPlainObject(v) && isPlainObject(out[k])) { out[k] = mergeObjectsRef(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\nfunction mergeLayersRef(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjectsRef(out, layers[name]);\n  }\n  return out;\n}\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"cfg-a\",\"cfg-b\",\"cfg-c\"];\nconst REQUIRED_KEYS = [\"service\",\"features\",\"log\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n// —— 各来源片段携带的层内容必须与冻结的层文件语义一致 ——\nconst LAYERS_DIR = path.join(__dirname, 'layers');\nfor (const s of SOURCES) {\n  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', s + '.json'), 'utf8'));\n  for (const name of Object.keys(frag.layers)) {\n    const file = JSON.parse(fs.readFileSync(path.join(LAYERS_DIR, name + '.json'), 'utf8'));\n    assert.deepStrictEqual(canon(frag.layers[name]), canon(file), '来源 ' + s + ' 携带的层 ' + name + ' 与层文件不一致');\n  }\n}\n// —— 层叠等价：canonical(E_parallel) == canonical(E_reference)，参考由固定规则独立生成 ——\nconst allLayers = {};\nfor (const name of LAYER_ORDER) {\n  const p = path.join(LAYERS_DIR, name + '.json');\n  if (fs.existsSync(p)) allLayers[name] = JSON.parse(fs.readFileSync(p, 'utf8'));\n}\nconst reference = mergeLayersRef(allLayers);\nconst effective = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective.json'), 'utf8')).effective;\nassert.deepStrictEqual(canon(effective), canon(reference), '并行加载后的 effective config 与固定层叠规则生成的参考结果不一致（层叠语义被破坏）');\nfor (const k of REQUIRED_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(effective, k), 'effective config 缺少 CONTRACT 声明的必需键：' + k);\nconsole.log('TIMELINE OK sources=' + new Set(entries.map((e) => e.src)).size + ' span=' + span + 'ms layering=equivalent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 固定层叠规则（独立参考实现，与任务实现无关；S1–S5）\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\nconst isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);\nfunction mergeObjectsRef(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isPlainObject(v) && isPlainObject(out[k])) { out[k] = mergeObjectsRef(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\nfunction mergeLayersRef(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjectsRef(out, layers[name]);\n  }\n  return out;\n}\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst BUDGET_MS = 6500;\nconst SOURCES = [\"cfg-a\",\"cfg-b\",\"cfg-c\"];\nconst REQUIRED_KEYS = [\"service\",\"features\",\"log\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.src)).size, SOURCES.length, 'distinct 来源数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst LAYERS_DIR = path.join(__dirname, 'layers');\nconst allLayers = {};\nfor (const name of LAYER_ORDER) {\n  const p = path.join(LAYERS_DIR, name + '.json');\n  if (fs.existsSync(p)) allLayers[name] = JSON.parse(fs.readFileSync(p, 'utf8'));\n}\nconst reference = mergeLayersRef(allLayers);\nconst effective = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective.json'), 'utf8')).effective;\nassert.deepStrictEqual(canon(effective), canon(reference), 'effective config 与固定层叠规则生成的参考结果不一致');\nfor (const k of REQUIRED_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(effective, k), 'effective config 缺少必需键：' + k);\nconsole.log(\"F07-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n\n## C 类附加条款\n\n1. 三个 profile 共享总预算 6500 ms；\n2. 每个 profile 内部必须保持固定层顺序 defaults<environment<profile<local；\n3. 矩阵必须按 profile × key 完整覆盖，且与固定层叠规则独立生成的参考矩阵语义等价。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/defaults.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.internal\",\n      \"timeout\": 30\n    }\n  },\n  \"features\": [\n    \"core\"\n  ],\n  \"log\": {\n    \"level\": \"info\"\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/environment.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 20\n    }\n  },\n  \"features\": [\n    \"env\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/local.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.local\"\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/profiles/p1.json",
    "content": "{\n  \"features\": [\n    \"p1\"\n  ],\n  \"service\": {\n    \"cache\": {\n      \"ttl\": 60\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/profiles/p2.json",
    "content": "{\n  \"features\": [\n    \"p2\"\n  ],\n  \"service\": {\n    \"cache\": {\n      \"ttl\": 120\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/layers/profiles/p3.json",
    "content": "{\n  \"features\": [\n    \"p3\"\n  ],\n  \"service\": {\n    \"database\": {\n      \"timeout\": 45\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/work/prof-p1.js",
    "content": "// 单 profile 生效配置生成工具（受保护，不得修改）：内部保持固定层顺序\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require(path.join(__dirname, '..', 'merge.js'));\nconst PROFILE = \"p1\";\nconst DUR = 3200;\nconst TOKEN = \"PA-9f10\";\nconst ROOT = path.join(__dirname, '..');\nconst rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {\n  defaults: rd(path.join(ROOT, 'layers', 'defaults.json')),\n  environment: rd(path.join(ROOT, 'layers', 'environment.json')),\n  profile: rd(path.join(ROOT, 'layers', 'profiles', PROFILE + '.json')),\n  local: rd(path.join(ROOT, 'layers', 'local.json')),\n};\nconst effective = mergeLayers(layers);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: 'prof-' + PROFILE, start, end, token: TOKEN, profile: PROFILE }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PROFILE + '.json'), JSON.stringify({ profile: PROFILE, token: TOKEN, effective }, null, 2) + '\\n');\nconsole.log('profile ' + PROFILE + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/work/prof-p2.js",
    "content": "// 单 profile 生效配置生成工具（受保护，不得修改）：内部保持固定层顺序\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require(path.join(__dirname, '..', 'merge.js'));\nconst PROFILE = \"p2\";\nconst DUR = 3000;\nconst TOKEN = \"PB-2c73\";\nconst ROOT = path.join(__dirname, '..');\nconst rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {\n  defaults: rd(path.join(ROOT, 'layers', 'defaults.json')),\n  environment: rd(path.join(ROOT, 'layers', 'environment.json')),\n  profile: rd(path.join(ROOT, 'layers', 'profiles', PROFILE + '.json')),\n  local: rd(path.join(ROOT, 'layers', 'local.json')),\n};\nconst effective = mergeLayers(layers);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: 'prof-' + PROFILE, start, end, token: TOKEN, profile: PROFILE }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PROFILE + '.json'), JSON.stringify({ profile: PROFILE, token: TOKEN, effective }, null, 2) + '\\n');\nconsole.log('profile ' + PROFILE + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/work/prof-p3.js",
    "content": "// 单 profile 生效配置生成工具（受保护，不得修改）：内部保持固定层顺序\nconst fs = require('fs');\nconst path = require('path');\nconst { mergeLayers } = require(path.join(__dirname, '..', 'merge.js'));\nconst PROFILE = \"p3\";\nconst DUR = 3400;\nconst TOKEN = \"PC-51d8\";\nconst ROOT = path.join(__dirname, '..');\nconst rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst layers = {\n  defaults: rd(path.join(ROOT, 'layers', 'defaults.json')),\n  environment: rd(path.join(ROOT, 'layers', 'environment.json')),\n  profile: rd(path.join(ROOT, 'layers', 'profiles', PROFILE + '.json')),\n  local: rd(path.join(ROOT, 'layers', 'local.json')),\n};\nconst effective = mergeLayers(layers);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ src: 'prof-' + PROFILE, start, end, token: TOKEN, profile: PROFILE }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', PROFILE + '.json'), JSON.stringify({ profile: PROFILE, token: TOKEN, effective }, null, 2) + '\\n');\nconsole.log('profile ' + PROFILE + ' done in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行 profile 批量生成 + **矩阵等价**（不执行任何 profile 工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 固定层叠规则（独立参考实现，与任务实现无关；S1–S5）\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\nconst isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);\nfunction mergeObjectsRef(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isPlainObject(v) && isPlainObject(out[k])) { out[k] = mergeObjectsRef(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\nfunction mergeLayersRef(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjectsRef(out, layers[name]);\n  }\n  return out;\n}\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);const LAYERS_DIR = path.join(__dirname, 'layers');\nconst rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));\nfunction profileLayers(id) {\n  return {\n    defaults: rd(path.join(LAYERS_DIR, 'defaults.json')),\n    environment: rd(path.join(LAYERS_DIR, 'environment.json')),\n    profile: rd(path.join(LAYERS_DIR, 'profiles', id + '.json')),\n    local: rd(path.join(LAYERS_DIR, 'local.json')),\n  };\n}\n\nconst BUDGET_MS = 6500;\nconst PROFILES = [\"p1\",\"p2\",\"p3\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.profile)).size, PROFILES.length, 'distinct profile 数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\n// —— 矩阵等价：canonical(matrix_parallel) == canonical(matrix_reference)，参考由固定规则独立生成 ——\nconst reference = {};\nfor (const p of PROFILES) reference[p] = mergeLayersRef(profileLayers(p));\nconst delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.deepStrictEqual(canon(delivered), canon(reference), '并行生成的矩阵与固定层叠规则生成的参考矩阵不一致');\nconst keyList = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).keys;\nconst union = new Set();\nfor (const p of PROFILES) for (const k of Object.keys(reference[p])) union.add(k);\nfor (const k of union) assert.ok(keyList.indexOf(k) >= 0, '矩阵 key 覆盖不完整，缺少：' + k);\nfor (const p of PROFILES) for (const k of union) assert.ok(Object.prototype.hasOwnProperty.call(delivered[p], k), 'profile ' + p + ' 缺少键 ' + k);\nconsole.log('TIMELINE OK profiles=' + new Set(entries.map((e) => e.profile)).size + ' span=' + span + 'ms matrix=equivalent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 固定层叠规则（独立参考实现，与任务实现无关；S1–S5）\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\nconst isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);\nfunction mergeObjectsRef(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isPlainObject(v) && isPlainObject(out[k])) { out[k] = mergeObjectsRef(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\nfunction mergeLayersRef(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjectsRef(out, layers[name]);\n  }\n  return out;\n}\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);const LAYERS_DIR = path.join(__dirname, 'layers');\nconst rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));\nfunction profileLayers(id) {\n  return {\n    defaults: rd(path.join(LAYERS_DIR, 'defaults.json')),\n    environment: rd(path.join(LAYERS_DIR, 'environment.json')),\n    profile: rd(path.join(LAYERS_DIR, 'profiles', id + '.json')),\n    local: rd(path.join(LAYERS_DIR, 'local.json')),\n  };\n}\n\nconst BUDGET_MS = 6500;\nconst PROFILES = [\"p1\",\"p2\",\"p3\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.profile)).size, PROFILES.length, 'distinct profile 数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst reference = {};\nfor (const p of PROFILES) reference[p] = mergeLayersRef(profileLayers(p));\nconst delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'matrix.json'), 'utf8')).matrix;\nassert.deepStrictEqual(canon(delivered), canon(reference), '矩阵与固定层叠规则生成的参考矩阵不一致');\nconst union = new Set();\nfor (const p of PROFILES) for (const k of Object.keys(reference[p])) union.add(k);\nfor (const p of PROFILES) for (const k of union) assert.ok(Object.prototype.hasOwnProperty.call(delivered[p], k), 'profile ' + p + ' 缺少键 ' + k);\nconsole.log(\"F07-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/layers/defaults.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.internal\",\n      \"timeout\": 30,\n      \"pool\": 5\n    }\n  },\n  \"features\": [\n    \"core\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/layers/environment.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 20\n    }\n  },\n  \"features\": [\n    \"env\"\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/layers/profile.json",
    "content": "{\n  \"service\": {\n    \"cache\": {\n      \"ttl\": 120\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/layers/local.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"host\": \"db.local\"\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/mod-a/deep-merge.js",
    "content": "// mod-a：对象递归合并（数组交给 mod-b）\nconst { mergeArray } = require('../mod-b/array-merge.js');\nfunction deepMerge(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    // 缺陷：不做递归合并，嵌套对象被整体替换\n    if (Array.isArray(v) && Array.isArray(out[k])) { out[k] = mergeArray(out[k], v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\nmodule.exports = { deepMerge };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/mod-b/array-merge.js",
    "content": "// mod-b：数组语义（CONTRACT 声明 replace）\nfunction mergeArray(base, over) { return base.concat(over); } // 缺陷：实现为 append\nmodule.exports = { mergeArray };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/mod-c/precedence.js",
    "content": "// mod-c：层顺序\nconst ORDER = ['local', 'profile', 'environment', 'defaults']; // 缺陷：顺序反转\nfunction orderLayers(names) { return names.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)); }\nmodule.exports = { orderLayers };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/build.js",
    "content": "// 统一装配（受保护）：按 mod-c 的层顺序，用 mod-a 的合并实现逐层归并\nconst { deepMerge } = require('./mod-a/deep-merge.js');\nconst { orderLayers } = require('./mod-c/precedence.js');\nfunction build(layers) {\n  let out = {};\n  for (const name of orderLayers(Object.keys(layers))) out = deepMerge(out, layers[name]);\n  return out;\n}\nmodule.exports = { build };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { deepMerge } = require('./mod-a/deep-merge.js');\nassert.deepStrictEqual(deepMerge({ a: { b: { c: 1, d: 2 } } }, { a: { b: { d: 3 } } }), { a: { b: { c: 1, d: 3 } } });\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { mergeArray } = require('./mod-b/array-merge.js');\nassert.deepStrictEqual(mergeArray(['x', 'y'], ['z']), ['z'], 'CONTRACT 声明数组语义为 replace');\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { orderLayers } = require('./mod-c/precedence.js');\nassert.deepStrictEqual(orderLayers(['local', 'defaults', 'profile', 'environment']), ['defaults', 'environment', 'profile', 'local']);\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/check-report.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { build } = require('./build.js');\nconst canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);\nconst LAYERS = ['defaults', 'environment', 'profile', 'local'];\nconst layers = {};\nfor (const n of LAYERS) { const p = path.join(__dirname, 'layers', n + '.json'); if (fs.existsSync(p)) layers[n] = JSON.parse(fs.readFileSync(p, 'utf8')); }\nconst ref = build(layers);\nconst delivered = JSON.parse(fs.readFileSync(path.join(__dirname, 'effective-config.json'), 'utf8')).effective;\nassert.deepStrictEqual(canon(delivered), canon(ref), '统一 effective-config.json 必须等于三套模块修好后的层叠结果');\nconst report = fs.readFileSync(path.join(__dirname, 'config-report.md'), 'utf8');\nassert.ok(report.indexOf('配置层叠报告') >= 0, 'config-report.md 缺少报告标题');\nassert.ok(report.indexOf(String(ref.service.database.timeout)) >= 0, 'config-report.md 必须记录生效的 timeout');\nconsole.log('REPORT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/effective-config.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/config-report.md",
    "content": "# 配置报告\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nrequire('./check-report.js');\nconsole.log('F07-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/schema.json",
    "content": "{\n  \"service.database.timeout\": \"number\",\n  \"service.database.pool\": \"number\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/layers/defaults.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 30,\n      \"pool\": 5\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/layers/environment.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": 20\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/layers/profile.json",
    "content": "{\n  \"service\": {\n    \"database\": {\n      \"timeout\": \"10\"\n    }\n  }\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/layers/local.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/schema-repair.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/layers-normalized.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/effective-config.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/validation-report.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));\nassert.strictEqual(rd('schema-repair.json').repaired, true, 'schema-repair.json 缺少 repaired');\nconst norm = rd('layers-normalized.json');\nassert.strictEqual(norm.normalized, true, 'layers-normalized.json 缺少 normalized');\nassert.ok(Array.isArray(norm.layers) && norm.layers.length === 4, 'layers-normalized.json 必须覆盖四个层');\nconst eff = rd('effective-config.json').effective;\nassert.strictEqual(eff.service.database.timeout, 10, 'effective-config.json 的 timeout 必须与层文件归一后的结果一致，实际 ' + JSON.stringify(eff.service && eff.service.database));\nconst rep = rd('validation-report.json');\nassert.strictEqual(rep.valid, true, 'validation-report.json 缺少 valid');\nassert.ok(Array.isArray(rep.checks) && rep.checks.length >= 4, 'validation-report.json 的 checks 至少 4 项');\nconsole.log('F07-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n\n## 迁移条款（S6）\n\n1. 必须保留 legacy 字段 `version`（number）与 `timeout`（number）：legacy/config.json 的字段布局被外部消费方**逐字段回放**。\n2. 必须新增 `layers`（非空字符串数组：本条配置实际经过的层名）与 `migrated: true`。\n3. 上述两条必须**同时**成立。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/config.js",
    "content": "// 已上线实现：仅输出 version / timeout，且被 legacy/config.json 冻结\nfunction load() { return { version: 1, timeout: 30 }; }\nmodule.exports = { load };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/legacy/config.json",
    "content": "{\n  \"version\": 1,\n  \"timeout\": 30\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：按 legacy/config.json 逐字段回放 load 的输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { load } = require('../config.js');\nconst golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));\nconst out = load();\nassert.deepStrictEqual(Object.keys(out).sort(), Object.keys(golden).sort(), '冻结的 legacy 布局被破坏');\nassert.strictEqual(out.timeout, golden.timeout, 'legacy timeout 被改变');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有实现\nconst base = require('./config.js');\nmodule.exports = { load: base.load };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/check.js",
    "content": "const assert = require('assert');\nconst { load } = require('./index.js');\nconst out = load();\nassert.strictEqual(out.version, 1, 'legacy version 必须保留');\nassert.strictEqual(out.timeout, 30, 'legacy timeout 必须保留');\nassert.ok(Array.isArray(out.layers) && out.layers.length > 0, '迁移条款：必须携带非空 layers 数组，实际 ' + JSON.stringify(out));\nassert.strictEqual(out.migrated, true, '迁移条款：必须标记 migrated=true');\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F07-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/CONTRACT.md",
    "content": "# 层叠契约（S1–S6，本任务的唯一判定依据）\n\n- **S1 missing ≠ null**：键**缺失** ⇒ 该键不参与本层层叠，下层值保留；键**存在且值为 null** ⇒ 按 S5 处理。\n- **S2 object ⇒ deep merge**：对象按键**递归**合并，叶子按层叠覆盖（不得整体替换）。\n- **S3 数组语义 = replace**：上层数组**整体替换**下层（不追加）。本变体全局限定为该语义。\n- **S4 覆盖方向（固定）**：defaults < environment < profile < local（后者覆盖前者）；任何实现不得反向覆盖。\n- **S5 null 语义 = 删除该键**：层叠后该键**不存在**。\n- **S6 迁移与兼容**：legacy 字段的保留要求在本契约的「迁移」条款中逐条列出。\n\n## 重算条款（S4 的运行时含义）\n\neffective config 必须由**当前**层树按需推导：层输入（layer store）发生变化后，下一次 resolve 必须反映新值。\n不得使用模块加载时拍下的快照；不得返回上一次计算的结果。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/merge.js",
    "content": "// 层叠合并实现（S1–S5）\n// S4 覆盖方向（固定）：defaults < environment < profile < local\n// S1 键缺失 ⇒ 不参与层叠（下层值保留）；S2 object ⇒ 递归 deep merge\n// S3 数组语义 = replace；S5 null 语义 = 删除该键\nconst LAYER_ORDER = ['defaults', 'environment', 'profile', 'local'];\nconst ARRAYS = 'replace';\nconst NULL_DELETES = true;\n\nfunction isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }\n\nfunction mergeObjects(base, over) {\n  const out = Object.assign({}, base);\n  for (const k of Object.keys(over)) {\n    const v = over[k];\n    if (v === null) { if (NULL_DELETES) { delete out[k]; } else { out[k] = null; } continue; }\n    if (isObj(v) && isObj(out[k])) { out[k] = mergeObjects(out[k], v); continue; }\n    if (Array.isArray(v) && Array.isArray(out[k]) && ARRAYS === 'append') { out[k] = out[k].concat(v); continue; }\n    out[k] = v;\n  }\n  return out;\n}\n\nfunction mergeLayers(layers) {\n  let out = {};\n  for (const name of LAYER_ORDER) {\n    if (!Object.prototype.hasOwnProperty.call(layers, name)) continue;\n    out = mergeObjects(out, layers[name]);\n  }\n  return out;\n}\n\nmodule.exports = { mergeLayers, mergeObjects, LAYER_ORDER };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/layers/defaults.json",
    "content": "{\n  \"timeout\": 90\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/layers/environment.json",
    "content": "{\n  \"timeout\": 60\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/layers/profile.json",
    "content": "{\n  \"timeout\": 30\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/layers/local.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/layer-store.js",
    "content": "// 受保护：层输入存储（内容可变，按需读取）\nconst fs = require('fs');\nconst path = require('path');\nconst NAMES = ['defaults', 'environment', 'profile', 'local'];\nconst state = {};\nfor (const n of NAMES) {\n  const p = path.join(__dirname, 'layers', n + '.json');\n  state[n] = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};\n}\nfunction getLayer(name) { return state[name]; }\nfunction setLayer(name, patch) { state[name] = Object.assign({}, state[name], patch); }\nmodule.exports = { getLayer, setLayer, NAMES };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/resolve.js",
    "content": "// effective config 生成（当前实现使用了加载时快照）\nconst store = require('./layer-store.js');\nconst { mergeLayers } = require('./merge.js');\nconst PROFILE_SNAPSHOT = store.getLayer('profile'); // 缺陷：模块加载时拍下快照\nfunction resolve() {\n  return mergeLayers({\n    defaults: store.getLayer('defaults'),\n    environment: store.getLayer('environment'),\n    profile: PROFILE_SNAPSHOT,\n    local: store.getLayer('local'),\n  });\n}\nmodule.exports = { resolve };"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/propagate.js",
    "content": "const assert = require('assert');\nconst store = require('./layer-store.js');\nconst { resolve } = require('./resolve.js');\nconst before = resolve();\nassert.strictEqual(before.timeout, 30, '初始生效 timeout 应来自 profile 层：期望 30，实际 ' + before.timeout);\nstore.setLayer('profile', { timeout: 60 }); // 修改层叠输入\nconst after = resolve();\nassert.strictEqual(after.timeout, 60, '层叠输入变更后 effective config 必须重算，实际 ' + after.timeout);\nconsole.log('PROPAGATE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F07-E2/verify.js",
    "content": "require('./propagate.js');\nconsole.log('F07-E2 OK');"
  }
];
