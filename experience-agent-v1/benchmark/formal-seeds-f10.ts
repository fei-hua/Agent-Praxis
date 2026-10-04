/**
 * benchmark/formal-seeds-f10.ts — F10 族 10 个变体的种子（由 scripts/formal-author-f10.ts 生成）
 */
export const FORMAL_F10_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"email\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"email\",\n      \"type\": \"string\",\n      \"required\": false,\n      \"nullable\": true\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/data/records.jsonl",
    "content": "{\"id\":1,\"name\":\"Ada\",\"email\":\"ada@x.io\"}\n{\"id\":2}\n{\"id\":3,\"name\":\"Bo\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/validate.js",
    "content": "// Schema 校验（V1–V3）\nfunction typeOk(type, v) {\n  if (type === 'string') return typeof v === 'string';\n  if (type === 'integer') return typeof v === 'number' && Number.isInteger(v);\n  if (type === 'boolean') return typeof v === 'boolean';\n  return false;\n}\nfunction sortErrors(errors) {\n  return errors.slice().sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)));\n}\nfunction validate(records, schema) {\n  const errors = [];\n  for (const rec of records) {\n    for (const f of schema.fields) {\n      const has = Object.prototype.hasOwnProperty.call(rec, f.name);\n      if (!has) { continue; } // 缺陷：未执行 required 检查\n      const v = rec[f.name];\n      if (v === null) {\n        if (!f.nullable) errors.push({ id: rec.id, field: f.name, code: 'null' });\n        continue;\n      }\n      if (!typeOk(f.type, v)) errors.push({ id: rec.id, field: f.name, code: 'type' });\n    }\n  }\n  return { ok: errors.length === 0, errors: sortErrors(errors) };\n}\nmodule.exports = { validate, sortErrors, typeOk };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/check-required.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { validate } = require('./validate.js');\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));\nconst records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));\nconst res = validate(records, schema);\nconst normalizeErrors = (errs) => errs.slice()\n  .sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)))\n  .map((e) => e.id + ':' + e.field + ':' + e.code);\nassert.strictEqual(res.ok, false, '存在缺失的 required 字段时必须校验失败，实际 ok=' + res.ok);\nassert.deepStrictEqual(normalizeErrors(res.errors), ['2:name:required'], '错误列表必须包含 {id:2, field:\"name\", code:\"required\"}（V1/V3），实际 ' + JSON.stringify(res.errors));\nconsole.log('REQUIRED OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A1/verify.js",
    "content": "require('./check-required.js');\nconsole.log('F10-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"age\",\n    \"email\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"age\",\n      \"type\": \"integer\",\n      \"required\": false,\n      \"nullable\": true\n    },\n    {\n      \"name\": \"email\",\n      \"type\": \"string\",\n      \"required\": false,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/data/records.jsonl",
    "content": "{\"id\":1,\"name\":\"Ada\",\"age\":\"18\"}\n{\"id\":2,\"name\":\"Bo\",\"email\":null}\n{\"id\":3,\"name\":\"Cy\",\"age\":30,\"email\":\"cy@x.io\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/validate.js",
    "content": "// Schema 校验（V1–V3）\nfunction typeOk(type, v) {\n  if (type === 'string') return typeof v === 'string';\n  if (type === 'integer') return typeof v === 'number' && Number.isInteger(v);\n  if (type === 'boolean') return typeof v === 'boolean';\n  return false;\n}\nfunction sortErrors(errors) {\n  return errors.slice().sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)));\n}\nfunction validate(records, schema) {\n  const errors = [];\n  for (const rec of records) {\n    for (const f of schema.fields) {\n      const has = Object.prototype.hasOwnProperty.call(rec, f.name);\n      if (!has) {\n        if (f.required) errors.push({ id: rec.id, field: f.name, code: 'required' });\n        continue;\n      }\n      const v = rec[f.name];\n      if (v === null) { continue; } // 缺陷：null 一律放过（未按 nullable 判定）\n      const coerced = f.type === 'integer' ? Number(v) : v; // 缺陷：隐式转换\n      if (!typeOk(f.type, coerced)) errors.push({ id: rec.id, field: f.name, code: 'type' });\n    }\n  }\n  return { ok: errors.length === 0, errors: sortErrors(errors) };\n}\nmodule.exports = { validate, sortErrors, typeOk };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/check-type-null.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { validate } = require('./validate.js');\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));\nconst records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));\nconst res = validate(records, schema);\nconst normalizeErrors = (errs) => errs.slice()\n  .sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)))\n  .map((e) => e.id + ':' + e.field + ':' + e.code);\nassert.strictEqual(res.ok, false, '存在类型/可空性违规时必须校验失败，实际 ok=' + res.ok);\nassert.deepStrictEqual(normalizeErrors(res.errors), ['1:age:type', '2:email:null'], '必须给出 V2 规定的 {id:1,field:\"age\",code:\"type\"} 与 {id:2,field:\"email\",code:\"null\"}（不得隐式转换、不得放过 null），实际 ' + JSON.stringify(res.errors));\nconsole.log('TYPE-NULL OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-A2/verify.js",
    "content": "require('./check-type-null.js');\nconsole.log('F10-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"display_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"display_name\",\n      \"type\": \"string\",\n      \"required\": false,\n      \"nullable\": true\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/write.js",
    "content": "// 新写入方（v2）：写出 v2 schema 的全部字段\nfunction writeV2(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }\nmodule.exports = { writeV2 };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/compat.js",
    "content": "// 旧读取器（v1）：按 v1 schema 读取记录\nfunction readV1(record, schema) {\n  const known = schema.fields.map((f) => f.name);\n  const errors = [];\n  for (const k of Object.keys(record)) if (!known.includes(k)) errors.push({ field: k, code: 'unknown_field' }); // 缺陷：未知字段被当作错误\n  for (const f of schema.fields) {\n    if (!Object.prototype.hasOwnProperty.call(record, f.name) && f.required) errors.push({ field: f.name, code: 'required' });\n  }\n  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };\n}\nmodule.exports = { readV1 };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/check-backward.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { readV1 } = require('./compat.js');\nconst { writeV2 } = require('./write.js');\nconst schemaV1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v1.json'), 'utf8'));\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nassert.strictEqual(schemaV2.fields.some((f) => f.name === 'display_name'), true, '新 schema 必须包含新增字段 display_name');\nconst produced = writeV2([{ id: 1, name: 'Ada' }])[0];\nassert.ok(Object.prototype.hasOwnProperty.call(produced, 'display_name'), '新写入方必须真实写出新增字段（否则 backward 兼容无从验证）');\nconst r = readV1(produced, schemaV1);\nassert.strictEqual(r.ok, true, 'V4 backward：新写入方产出的数据必须能被旧读取器读取（未知字段必须忽略），实际 ' + JSON.stringify(r.errors));\nassert.strictEqual(r.value.name, 'Ada', '已知字段必须原样保留');\nconsole.log('BACKWARD OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B1/verify.js",
    "content": "require('./check-backward.js');\nconsole.log('F10-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"display_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"display_name\",\n      \"type\": \"string\",\n      \"required\": false,\n      \"nullable\": true\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/compat.js",
    "content": "// 新读取器（v2）：按 v2 schema 读取记录\nfunction readV2(record, schema) {\n  const errors = [];\n  for (const f of schema.fields) {\n    if (!Object.prototype.hasOwnProperty.call(record, f.name)) errors.push({ field: f.name, code: 'missing_field' }); // 缺陷：可选字段也要求存在\n  }\n  return { ok: errors.length === 0, value: errors.length === 0 ? record : null, errors };\n}\nmodule.exports = { readV2 };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/check-forward.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { readV2 } = require('./compat.js');\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst optional = schemaV2.fields.filter((f) => f.name === 'display_name')[0];\nassert.strictEqual(optional.required, false, 'display_name 在新 schema 中必须保持为可选项（forward 兼容的前提）');\nconst oldRecord = { id: 1, name: 'Ada' }; // 旧写入方（v1）产出的数据\nconst r = readV2(oldRecord, schemaV2);\nassert.strictEqual(r.ok, true, 'V4 forward：旧数据缺少新 schema 的可选字段时必须被容忍，实际 ' + JSON.stringify(r.errors));\nassert.strictEqual(r.value.name, 'Ada', '已有字段必须原样保留');\nassert.ok(!Object.prototype.hasOwnProperty.call(r.value, 'display_name'), '缺失的可选字段不得被伪造填充');\nconsole.log('FORWARD OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-B2/verify.js",
    "content": "require('./check-forward.js');\nconsole.log('F10-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## C 类附加条款\n\n1. 三个数据分片共享总预算 6500 ms；\n2. 并行迁移不得改变结果：`migrated.jsonl` 必须与**独立参考迁移实现**（checker 内嵌，不与被测实现共享代码）产出的 canonical 形式**逐字节一致**；\n3. record identity 必须保持（record_count 不变、id 集合与顺序不变）。\n## 本变体冻结的迁移规则\n\n- V1→V2 为 **additive + backfill**：新增字段 `display_name`，backfill 规则 **`display_name := name`**；\n- record identity 必须保持（id 集合与顺序不变，record_count 不变）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"display_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"display_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/canonical.js",
    "content": "// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）\n// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）\nfunction orderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction serializeRecords(schema, records) {\n  const sorted = records.slice().sort(ordinalId);\n  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction bytesOf(text) { return Buffer.from(text, 'utf8'); }\nmodule.exports = { orderFields, ordinalId, serializeRecords, bytesOf };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/migrate.js",
    "content": "// V1→V2 迁移（受保护，冻结规则）：additive + backfill（display_name := name），record identity 保持\nconst { serializeRecords } = require('./canonical.js');\nfunction migrateAdd(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }\nfunction migrateAddToText(schemaV2, records) { return serializeRecords(schemaV2, migrateAdd(records)); }\nmodule.exports = { migrateAdd, migrateAddToText };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/data/shard-a.jsonl",
    "content": "{\"id\":1,\"name\":\"Ada\"}\n{\"id\":4,\"name\":\"Dee\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/data/shard-b.jsonl",
    "content": "{\"id\":2,\"name\":\"Bo\"}\n{\"id\":5,\"name\":\"Eve\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/data/shard-c.jsonl",
    "content": "{\"id\":3,\"name\":\"Cy\"}\n{\"id\":6,\"name\":\"Fay\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/work/shard-a.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-a\";\nconst DUR = 3500;\nconst TOKEN = \"SA-2f81\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateAdd } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateAdd(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/work/shard-b.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-b\";\nconst DUR = 3500;\nconst TOKEN = \"SB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateAdd } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateAdd(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/work/shard-c.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-c\";\nconst DUR = 3000;\nconst TOKEN = \"SC-19e2\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateAdd } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateAdd(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行迁移 + **与独立参考迁移逐字节一致**（不执行任何分片工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\n// 独立参考迁移（V5 additive + backfill：display_name := name）\nfunction refMigrate(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }\nconst BUDGET_MS = 6500;\nconst SHARDS = [\"shard-a\",\"shard-b\",\"shard-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst source = [];\nfor (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));\nconst expected = refSerialize(schemaV2, refMigrate(source));\nconst actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');\nassert.ok(refBytesEq(actual, expected), '并行迁移产物与独立参考迁移逐字节不一致：actual=' + JSON.stringify(actual.slice(0, 160)) + ' expected=' + JSON.stringify(expected.slice(0, 160)));\nconst actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变（V5/V6）：actual=' + actualRecords.length + ' expected=' + source.length);\nconst idsOf = (rs) => rs.slice().sort(refOrdinalId).map((r) => r.id).join(',');\nassert.strictEqual(new Set(actualRecords.map((r) => r.id)).size, actualRecords.length, '不得产生双重记录（id 重复）');\nassert.strictEqual(idsOf(actualRecords), idsOf(source), 'record identity（id 集合与顺序）必须保持');\nconsole.log('TIMELINE OK shards=' + new Set(entries.map((e) => e.shard)).size + ' span=' + span + 'ms bytes=identical additive');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/MIGRATION.md",
    "content": "# 迁移说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\n// 独立参考迁移（V5 additive + backfill：display_name := name）\nfunction refMigrate(records) { return records.map((r) => ({ id: r.id, name: r.name, display_name: r.name })); }\nconst BUDGET_MS = 6500;\nconst SHARDS = [\"shard-a\",\"shard-b\",\"shard-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst source = [];\nfor (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));\nconst expected = refSerialize(schemaV2, refMigrate(source));\nconst actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');\nassert.ok(refBytesEq(actual, expected), '迁移产物与独立参考迁移逐字节不一致');\nconst actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变');\nconst idsOf = (rs) => rs.slice().sort(refOrdinalId).map((r) => r.id).join(',');\nassert.strictEqual(new Set(actualRecords.map((r) => r.id)).size, actualRecords.length, '不得产生双重记录（id 重复）');\nassert.strictEqual(idsOf(actualRecords), idsOf(source), 'record identity（id 集合与顺序）必须保持');\nconsole.log(\"F10-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## C 类附加条款\n\n1. 三个数据分片共享总预算 6500 ms；\n2. 并行迁移不得改变结果：`migrated.jsonl` 必须与**独立参考迁移实现**（checker 内嵌，不与被测实现共享代码）产出的 canonical 形式**逐字节一致**；\n3. record identity 必须保持（record_count 不变、id 集合与顺序不变）。\n## 本变体冻结的迁移规则\n\n- V1→V2 为 **rename/transform**：`display_name := first_name + last_name`（显式转换，按此顺序直接拼接）；\n- 旧字段 `first_name` / `last_name` **不得保留**；不得产生双重记录（record_count 与 id 集合必须保持）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"first_name\",\n    \"last_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"first_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"last_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"display_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"display_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/canonical.js",
    "content": "// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）\n// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）\nfunction orderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction serializeRecords(schema, records) {\n  const sorted = records.slice().sort(ordinalId);\n  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction bytesOf(text) { return Buffer.from(text, 'utf8'); }\nmodule.exports = { orderFields, ordinalId, serializeRecords, bytesOf };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/migrate.js",
    "content": "// V1→V2 迁移（受保护，冻结规则）：rename/transform（display_name := first_name + last_name）\nconst { serializeRecords } = require('./canonical.js');\nfunction migrateRename(records) { return records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })); }\nfunction migrateRenameToText(schemaV2, records) { return serializeRecords(schemaV2, migrateRename(records)); }\nmodule.exports = { migrateRename, migrateRenameToText };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/data/shard-a.jsonl",
    "content": "{\"id\":1,\"first_name\":\"Ada\",\"last_name\":\"Ng\"}\n{\"id\":4,\"first_name\":\"Dee\",\"last_name\":\"Ko\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/data/shard-b.jsonl",
    "content": "{\"id\":2,\"first_name\":\"Bo\",\"last_name\":\"Li\"}\n{\"id\":5,\"first_name\":\"Eve\",\"last_name\":\"Ru\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/data/shard-c.jsonl",
    "content": "{\"id\":3,\"first_name\":\"Cy\",\"last_name\":\"Ma\"}\n{\"id\":6,\"first_name\":\"Fay\",\"last_name\":\"Wu\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/work/shard-a.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-a\";\nconst DUR = 3200;\nconst TOKEN = \"RA-5d10\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateRename } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateRename(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/work/shard-b.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-b\";\nconst DUR = 3400;\nconst TOKEN = \"RB-8c33\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateRename } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateRename(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/work/shard-c.js",
    "content": "// 数据分片迁移工具：读取本分片的源数据，按冻结规则迁移并写出 canonical 产物（受保护，不得修改）\nconst fs = require('fs');\nconst path = require('path');\nconst SHARD = \"shard-c\";\nconst DUR = 3000;\nconst TOKEN = \"RC-41a7\";\nconst ROOT = path.join(__dirname, '..');\nconst { migrateRename } = require(path.join(ROOT, 'migrate.js'));\nconst { serializeRecords } = require(path.join(ROOT, 'canonical.js'));\nconst readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'v2.json'), 'utf8'));\nconst source = readJsonl(path.join(ROOT, 'data', SHARD + '.jsonl'));\nconst migrated = migrateRename(source);\nconst text = serializeRecords(schemaV2, migrated);\nconst end = Date.now();\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ shard: SHARD, start, end, token: TOKEN, count: migrated.length }) + '\\n');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', SHARD + '.jsonl'), text, 'utf8');\nconsole.log(SHARD + ' migrated ' + migrated.length + ' records in ' + (end - start) + 'ms');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行迁移 + **与独立参考迁移逐字节一致**（不执行任何分片工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\n// 独立参考迁移（V6 显式转换：display_name := first_name + last_name）\nfunction refMigrate(records) { return records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })); }\nconst BUDGET_MS = 6500;\nconst SHARDS = [\"shard-a\",\"shard-b\",\"shard-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst source = [];\nfor (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));\nconst expected = refSerialize(schemaV2, refMigrate(source));\nconst actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');\nassert.ok(refBytesEq(actual, expected), '并行迁移产物与独立参考迁移逐字节不一致：actual=' + JSON.stringify(actual.slice(0, 160)) + ' expected=' + JSON.stringify(expected.slice(0, 160)));\nconst actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变（V5/V6）：actual=' + actualRecords.length + ' expected=' + source.length);\nconst idsOf = (rs) => rs.slice().sort(refOrdinalId).map((r) => r.id).join(',');\nassert.strictEqual(new Set(actualRecords.map((r) => r.id)).size, actualRecords.length, '不得产生双重记录（id 重复）');\nassert.strictEqual(idsOf(actualRecords), idsOf(source), 'record identity（id 集合与顺序）必须保持');\nfor (const r of actualRecords) {\n  assert.ok(!Object.prototype.hasOwnProperty.call(r, 'first_name') && !Object.prototype.hasOwnProperty.call(r, 'last_name'), 'V6：rename 后旧字段不得保留，实际 ' + JSON.stringify(r));\n}\nconsole.log('TIMELINE OK shards=' + new Set(entries.map((e) => e.shard)).size + ' span=' + span + 'ms bytes=identical rename');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/MIGRATION.md",
    "content": "# 迁移说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\n// 独立参考迁移（V6 显式转换：display_name := first_name + last_name）\nfunction refMigrate(records) { return records.map((r) => ({ id: r.id, display_name: String(r.first_name || '') + String(r.last_name || '') })); }\nconst BUDGET_MS = 6500;\nconst SHARDS = [\"shard-a\",\"shard-b\",\"shard-c\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.shard)).size, SHARDS.length, 'distinct 分片数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst source = [];\nfor (const s of SHARDS) source.push(...readJsonl(path.join(__dirname, 'data', s + '.jsonl')));\nconst expected = refSerialize(schemaV2, refMigrate(source));\nconst actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');\nassert.ok(refBytesEq(actual, expected), '迁移产物与独立参考迁移逐字节不一致');\nconst actualRecords = actual.trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(actualRecords.length, source.length, 'record_count 必须保持不变');\nconst idsOf = (rs) => rs.slice().sort(refOrdinalId).map((r) => r.id).join(',');\nassert.strictEqual(new Set(actualRecords.map((r) => r.id)).size, actualRecords.length, '不得产生双重记录（id 重复）');\nassert.strictEqual(idsOf(actualRecords), idsOf(source), 'record identity（id 集合与顺序）必须保持');\nfor (const r of actualRecords) {\n  assert.ok(!Object.prototype.hasOwnProperty.call(r, 'first_name') && !Object.prototype.hasOwnProperty.call(r, 'last_name'), 'V6：rename 后旧字段不得保留，实际 ' + JSON.stringify(r));\n}\nconsole.log(\"F10-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## 本变体冻结的三表迁移规则\n\n1. `customers`：V2 = {id, name, tier}，backfill 规则 **`tier := (id <= 100 ? \"standard\" : \"premium\")`**；\n2. `orders`：V2 = {id, amount, currency}，backfill 规则 **`currency := \"USD\"`**；record identity 必须保持（不得丢记录）；\n3. `logs`：V2 = {id, at_ms}，**`at_ms := Date.parse(at)`（integer，epoch 毫秒）**；\n4. 三张表的产物一律按 V8 canonical 形式写出；`migration-report.json` 必须与产物一致（tables.<name>.count 与 total_records）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/canonical.js",
    "content": "// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）\n// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）\nfunction orderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction serializeRecords(schema, records) {\n  const sorted = records.slice().sort(ordinalId);\n  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction bytesOf(text) { return Buffer.from(text, 'utf8'); }\nmodule.exports = { orderFields, ordinalId, serializeRecords, bytesOf };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/schemas/customers.v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"name\",\n    \"tier\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"tier\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/schemas/orders.v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"amount\",\n    \"currency\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"amount\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"currency\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/schemas/logs.v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"at_ms\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"at_ms\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/data/customers.jsonl",
    "content": "{\"id\":99,\"name\":\"Ada\"}\n{\"id\":100,\"name\":\"Bo\"}\n{\"id\":101,\"name\":\"Cy\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/data/orders.jsonl",
    "content": "{\"id\":1,\"amount\":250}\n{\"id\":2,\"amount\":0}\n{\"id\":3,\"amount\":75}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/data/logs.jsonl",
    "content": "{\"id\":1,\"at\":\"2026-01-02T03:04:05.000Z\"}\n{\"id\":2,\"at\":\"2026-02-03T04:05:06.000Z\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/mig-customers.js",
    "content": "const { serializeRecords } = require('./canonical.js');\n// customers V1→V2：新增 tier 并按规则回填\nfunction migrateCustomers(records) {\n  return records.map((r) => ({ id: r.id, name: r.name, tier: r.id < 100 ? 'standard' : 'premium' })); // 缺陷：边界 off-by-one\n}\nmodule.exports = { migrateCustomers };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/mig-orders.js",
    "content": "const { serializeRecords } = require('./canonical.js');\n// orders V1→V2：新增 currency 并按规则回填\nfunction migrateOrders(records) {\n  return records.filter((r) => r.amount).map((r) => ({ id: r.id, amount: r.amount, currency: 'USD' })); // 缺陷：丢弃 amount 为 0 的记录\n}\nmodule.exports = { migrateOrders };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/mig-logs.js",
    "content": "const { serializeRecords } = require('./canonical.js');\n// logs V1→V2：at → at_ms（integer）\nfunction migrateLogs(records) {\n  return records.map((r) => ({ id: r.id, at_ms: String(Date.parse(r.at)) })); // 缺陷：at_ms 输出为 string\n}\nmodule.exports = { migrateLogs };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/check-customers.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'customers.v2.json'), 'utf8'));\nconst source = readJsonlFile(path.join(__dirname, 'data', 'customers.jsonl'));\nconst expected = refSerialize(schema, source.map((r) => ({ id: r.id, name: r.name, tier: r.id <= 100 ? 'standard' : 'premium' })));\nconst delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'customers.jsonl'), 'utf8');\nassert.ok(refBytesEq(delivered, expected), 'customers 迁移产物与参考结果逐字节不一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));\nconsole.log('CUSTOMERS OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/check-orders.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'orders.v2.json'), 'utf8'));\nconst source = readJsonlFile(path.join(__dirname, 'data', 'orders.jsonl'));\nconst expected = refSerialize(schema, source.map((r) => ({ id: r.id, amount: r.amount, currency: 'USD' })));\nconst delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'orders.jsonl'), 'utf8');\nassert.ok(refBytesEq(delivered, expected), 'orders 迁移产物与参考结果逐字节不一致（record identity 必须保持）：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));\nconsole.log('ORDERS OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/check-logs.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'logs.v2.json'), 'utf8'));\nconst source = readJsonlFile(path.join(__dirname, 'data', 'logs.jsonl'));\nconst expected = refSerialize(schema, source.map((r) => ({ id: r.id, at_ms: Date.parse(r.at) })));\nconst delivered = fs.readFileSync(path.join(__dirname, 'migrated', 'logs.jsonl'), 'utf8');\nassert.ok(refBytesEq(delivered, expected), 'logs 迁移产物与参考结果逐字节不一致（at_ms 必须为 integer）：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));\nconsole.log('LOGS OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/check-report.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst { migrateCustomers } = require('./mig-customers.js');\nconst { migrateOrders } = require('./mig-orders.js');\nconst { migrateLogs } = require('./mig-logs.js');\nconst TABLES = [\n  { name: 'customers', fn: migrateCustomers, schema: 'customers.v2.json', data: 'customers.jsonl' },\n  { name: 'orders', fn: migrateOrders, schema: 'orders.v2.json', data: 'orders.jsonl' },\n  { name: 'logs', fn: migrateLogs, schema: 'logs.v2.json', data: 'logs.jsonl' },\n];\nconst report = JSON.parse(fs.readFileSync(path.join(__dirname, 'migration-report.json'), 'utf8'));\nlet total = 0;\nfor (const t of TABLES) {\n  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', t.schema), 'utf8'));\n  const source = readJsonlFile(path.join(__dirname, 'data', t.data));\n  const expected = refSerialize(schema, t.fn(source));\n  const delivered = fs.readFileSync(path.join(__dirname, 'migrated', t.name + '.jsonl'), 'utf8');\n  assert.ok(refBytesEq(delivered, expected), '表 ' + t.name + ' 的交付产物必须与修好后的模块输出逐字节一致：actual=' + JSON.stringify(delivered) + ' expected=' + JSON.stringify(expected));\n  assert.strictEqual(report.tables[t.name].count, source.length, '报告中 ' + t.name + ' 的 count 必须等于源记录数，实际 ' + report.tables[t.name].count);\n  total += source.length;\n}\nassert.strictEqual(report.total_records, total, '迁移报告 total_records 必须等于三表记录数之和（' + total + '），实际 ' + report.total_records);\nconsole.log('REPORT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/migrated/customers.jsonl",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/migrated/orders.jsonl",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/migrated/logs.jsonl",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/migration-report.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D1/verify.js",
    "content": "require('./check-customers.js');\nrequire('./check-orders.js');\nrequire('./check-logs.js');\nrequire('./check-report.js');\nconsole.log('F10-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## 阶段依赖条款（D2）\n\n1. 迁移链必须按依赖顺序执行：**新增字段（region）→ 按映射回填 region → region 约束校验**；\n2. 每一步必须消费上一步的**真实产物文件**（不得跳步或重新读取源数据）；\n3. 每一步必须在 `provenance.json` 记录 {step, input, input_sha256, output, output_sha256}，input/output 为相对本目录的路径；\n4. 最终 `migrated.jsonl` = 第三步的产物，且必须满足 V2 的 region 非空约束。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/canonical.js",
    "content": "// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）\n// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）\nfunction orderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction serializeRecords(schema, records) {\n  const sorted = records.slice().sort(ordinalId);\n  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction bytesOf(text) { return Buffer.from(text, 'utf8'); }\nmodule.exports = { orderFields, ordinalId, serializeRecords, bytesOf };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"country\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"country\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"country\",\n    \"region\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"country\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"region\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/data/records.jsonl",
    "content": "{\"id\":1,\"country\":\"JP\"}\n{\"id\":2,\"country\":\"DE\"}\n{\"id\":3,\"country\":\"BR\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/data/region-map.json",
    "content": "{\n  \"JP\": \"APAC\",\n  \"DE\": \"EMEA\",\n  \"BR\": \"LATAM\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/lib/ops.js",
    "content": "// 迁移链算子（受保护，冻结语义）\nfunction addRegionColumn(rec) { return { id: rec.id, country: rec.country, region: null }; }\nfunction backfillRegion(rec, map) {\n  if (rec.region !== null && rec.region !== undefined) return { id: rec.id, country: rec.country, region: rec.region };\n  return { id: rec.id, country: rec.country, region: map[rec.country] || null };\n}\nfunction addRegionConstraint(rec) { if (!rec.region) throw new Error('region 约束失败：id=' + rec.id); return { id: rec.id, country: rec.country, region: rec.region }; }\nmodule.exports = { addRegionColumn, backfillRegion, addRegionConstraint };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/check-chain.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst crypto = require('crypto');\n// 独立参考序列化（checker 内嵌；不引用被测实现）\nfunction refOrderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction refOrdinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction refSerialize(schema, records) {\n  const sorted = records.slice().sort(refOrdinalId);\n  return sorted.map((r) => JSON.stringify(refOrderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction refBytesEq(a, b) { return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) === 0; }\nfunction readJsonl(p) { return fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)); }\n\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst abs = (p) => path.normalize(path.isAbsolute(String(p)) ? String(p) : path.join(__dirname, String(p)));\nconst sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');\nconst prov = JSON.parse(fs.readFileSync(path.join(__dirname, 'provenance.json'), 'utf8'));\nassert.ok(Array.isArray(prov) && prov.length === 3, 'provenance 必须包含三个阶段记录，实际 ' + JSON.stringify(prov && prov.length));\nfor (let i = 0; i < 3; i++) assert.strictEqual(prov[i].step, i + 1, 'provenance 必须按 step 1..3 排列');\nassert.ok(abs(prov[0].input) === abs('data/records.jsonl'), 'step1 的输入必须是源数据文件 data/records.jsonl，实际 ' + prov[0].input);\nassert.strictEqual(abs(prov[1].input), abs(prov[0].output), 'step2 的输入必须来自 step1 的输出产物（不得跳步或重读源数据）');\nassert.strictEqual(abs(prov[2].input), abs(prov[1].output), 'step3 的输入必须来自 step2 的输出产物');\nfor (const p of prov) {\n  assert.strictEqual(sha(abs(p.input)), p.input_sha256, 'provenance 记录的输入 sha256 必须与真实文件一致：' + p.input);\n  assert.strictEqual(sha(abs(p.output)), p.output_sha256, 'provenance 记录的输出 sha256 必须与真实文件一致：' + p.output);\n}\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst map = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'region-map.json'), 'utf8'));\nconst source = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));\nconst reference = refSerialize(schemaV2, source.map((r) => ({ id: r.id, country: r.country, region: map[r.country] || null })));\nconst actual = fs.readFileSync(path.join(__dirname, 'migrated.jsonl'), 'utf8');\nassert.ok(refBytesEq(actual, reference), '最终迁移产物与独立参考链逐字节不一致：actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(reference));\nfor (const line of actual.trim().split('\\n')) { if (!line.trim()) continue; const r = JSON.parse(line); assert.ok(r.region, 'step3 的 region 约束必须成立（id=' + r.id + '）'); }\nconsole.log('CHAIN OK steps=3 artifacts=verified');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/CHAIN.md",
    "content": "# 迁移链说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-D2/verify.js",
    "content": "require('./check-chain.js');\nconsole.log('F10-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## 兼容条款（E1，优先于 schemas/v2.json 的 email 字段形态）\n\n1. 既有消费方依赖 `email: string`（外部消费方逐字段回放）⇒ 迁移产物中 `email` **必须保持字符串**；\n2. 新结构化值必须同时提供在 `email_detail`：`{address: string, verified: boolean}`，且 `verified` 初始为 `false`；\n3. 上述两条必须**同时**成立；record_count 不得变化。\n4. 说明：`schemas/v2.json` 描述**新写入方**的 schema（email 为对象）；本变体的兼容迁移路径以本条款为准，二者服务不同消费方，不得混用。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"email\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"email\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"email\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"email\",\n      \"type\": \"object\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/data/records.jsonl",
    "content": "{\"id\":1,\"email\":\"ada@x.io\"}\n{\"id\":2,\"email\":\"bo@x.io\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/migrate.js",
    "content": "// 已上线的 V1→V2 迁移：按 schemas/v2.json 把 email 变为结构化对象（破坏 legacy 契约）\nfunction migrate(records) { return records.map((r) => ({ id: r.id, email: { address: r.email, verified: false } })); }\nmodule.exports = { migrate };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：要求 email 仍是字符串，同时要求 email_detail 存在\nconst assert = require('assert');\nfunction consume(records) {\n  for (const r of records) {\n    assert.strictEqual(typeof r.email, 'string', 'legacy 契约：email 必须是字符串，实际 ' + JSON.stringify(r.email));\n    assert.ok(r.email.indexOf('@') > 0, 'legacy 契约：email 必须是可解析地址');\n    assert.ok(r.email_detail && typeof r.email_detail.address === 'string', '兼容契约：必须同时提供 email_detail.address');\n  }\n  return records.length;\n}\nmodule.exports = { consume };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发既有迁移实现\nconst base = require('./migrate.js');\nmodule.exports = { migrate: base.migrate };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/check.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { migrate } = require('./index.js');\nconst { consume } = require('./legacy/consumer.js');\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst records = readJsonlFile(path.join(__dirname, 'data', 'records.jsonl'));\nconst out = migrate(records);\nassert.strictEqual(out.length, records.length, 'record_count 不得变化');\nconst n = consume(out); // legacy 契约 + 兼容契约（字符串 email + email_detail）\nassert.strictEqual(n, records.length, '消费方必须能完整回放全部记录');\nassert.strictEqual(out.map((r) => (typeof r.email === 'string' ? r.email : '')).join(','), records.map((r) => r.email).join(','), 'legacy email 字符串必须逐条保留');\nassert.strictEqual(out[0].email_detail.verified, false, '兼容契约：verified 必须初始化为 false');\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F10-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/CONTRACT.md",
    "content": "# 数据校验与迁移契约（V1–V8，本任务的唯一判定依据）\n\n- **V1 required**：schema 中 `required: true` 的字段在数据实例中**必须存在**；缺失 ⇒ 校验失败，错误列表必须包含 `{field, code:\"required\"}`。\n- **V2 类型与可空性**：标量类型集合仅 {string, integer, boolean}；`\"18\"` 对 integer 非法（**不做隐式转换**）；`nullable:false` 时 null 非法（code `\"null\"`），`nullable:true` 时 null 合法。\n- **V3 错误 canonical 形式**：错误列表按 (field 升序, code 升序) 排序后逐字段比较；**不得依赖实现内部的校验遍历顺序**。\n- **V4 兼容性方向**：backward = new writer → old reader；forward = old writer → new reader。reader 对**未知字段**必须忽略（不得报错），对**缺失的可选字段**必须容忍。\n- **V5 add/backfill**：新增字段必须按本契约冻结的 backfill 规则填充；**record identity**（原 id 集合与顺序）必须保持。\n- **V6 rename/transform**：字段改名/合成属**显式转换**；不得把 rename 当作\"新增字段\"而保留旧字段（除非契约另有要求）；**不得产生双重记录**（迁移前后 record_count 必须相同）。\n- **V7 migration 幂等**：同一 migration 对**已是目标版本**的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变（无二次副作用）。\n- **V8 迁移结果 canonical 形式**：固定字段顺序（契约声明的 field_order，而非对象插入顺序）→ UTF-8 → LF（末行以 LF 结束）→ 行序按 record id 升序（**序数比较**，不得使用 locale 比较）→ **逐字节**比较。\n\n## 幂等条款（E2，V7 的运行时含义）\n\n同一 migration 对已是目标版本的数据再次执行 ⇒ schema 保持目标版本、data **逐字节不变**、record_count 不变。\n判定使用 canonical 形式（V8）：固定字段顺序 + LF；不得因 key 顺序差异产生假差异。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/canonical.js",
    "content": "// canonical 序列化（V8）：固定字段顺序（schema.field_order）→ UTF-8 → LF（末行以 LF 结束）\n// 行序按 record id 升序（序数比较；不依赖对象插入顺序，不使用 locale 比较）\nfunction orderFields(schema, rec) {\n  const out = {};\n  for (const name of schema.field_order) if (Object.prototype.hasOwnProperty.call(rec, name)) out[name] = rec[name];\n  return out;\n}\nfunction ordinalId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }\nfunction serializeRecords(schema, records) {\n  const sorted = records.slice().sort(ordinalId);\n  return sorted.map((r) => JSON.stringify(orderFields(schema, r))).join('\\n') + (sorted.length ? '\\n' : '');\n}\nfunction bytesOf(text) { return Buffer.from(text, 'utf8'); }\nmodule.exports = { orderFields, ordinalId, serializeRecords, bytesOf };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/schemas/v1.json",
    "content": "{\n  \"version\": 1,\n  \"field_order\": [\n    \"id\",\n    \"first_name\",\n    \"last_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"first_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"last_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/schemas/v2.json",
    "content": "{\n  \"version\": 2,\n  \"field_order\": [\n    \"id\",\n    \"display_name\"\n  ],\n  \"fields\": [\n    {\n      \"name\": \"id\",\n      \"type\": \"integer\",\n      \"required\": true,\n      \"nullable\": false\n    },\n    {\n      \"name\": \"display_name\",\n      \"type\": \"string\",\n      \"required\": true,\n      \"nullable\": false\n    }\n  ]\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/data/v1.jsonl",
    "content": "{\"id\":1,\"first_name\":\"Alice\",\"last_name\":\"\"}\n{\"id\":2,\"first_name\":\"Bo\",\"last_name\":\"Ng\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/data/v2.jsonl",
    "content": "{\"id\":1,\"display_name\":\"Alice\"}\n{\"id\":2,\"display_name\":\"BoNg\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/migrate.js",
    "content": "// V1→V2 迁移（当前实现）：display_name := first_name + last_name\nconst { serializeRecords } = require('./canonical.js');\nfunction migrate(records, fromVersion) {\n  const out = records.map((r) => {\n    const first = r.first_name || r.display_name || '';   // 缺陷：已是 v2 时把 display_name 当作 first_name\n    const last = r.last_name || r.display_name || '';\n    return { id: r.id, display_name: String(first) + String(last) };\n  });\n  return { version: 2, records: out };\n}\nmodule.exports = { migrate };"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/idempotent.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { migrate } = require('./migrate.js');\nconst canonical = require('./canonical.js');\nconst readJsonlFile = (p) => fs.readFileSync(p, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nconst schemaV2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'v2.json'), 'utf8'));\nconst before = fs.readFileSync(path.join(__dirname, 'data', 'v2.jsonl'), 'utf8');\nconst records = readJsonlFile(path.join(__dirname, 'data', 'v2.jsonl'));\nconst out = migrate(records, 2); // 对已是 v2 的数据再次执行同一 migration\nassert.strictEqual(out.version, 2, 'V7：已是目标版本时 schema 必须保持 v2，实际 ' + out.version);\nassert.strictEqual(out.records.length, records.length, 'V7：record_count 不得变化，实际 ' + out.records.length);\nconst after = canonical.serializeRecords(schemaV2, out.records);\nassert.strictEqual(Buffer.compare(Buffer.from(after, 'utf8'), Buffer.from(before, 'utf8')), 0, 'V7：已是 v2 的数据再次迁移必须逐字节不变，actual=' + JSON.stringify(out.records) + ' expected=' + JSON.stringify(records));\nconsole.log('IDEMPOTENT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F10-E2/verify.js",
    "content": "require('./idempotent.js');\nconsole.log('F10-E2 OK');"
  }
];
