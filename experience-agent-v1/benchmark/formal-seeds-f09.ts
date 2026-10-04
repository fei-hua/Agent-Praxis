/**
 * benchmark/formal-seeds-f09.ts — F09 族 10 个变体的种子（由 scripts/formal-author-f09.ts 生成）
 */
export const FORMAL_F09_SEEDS: Array<{ path: string; content: string }> = [
  {
    "path": "pilot-workspace/package.json",
    "content": "{\"type\":\"commonjs\"}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\n本任务只有一处缺陷：变量替换不是全局替换（R1）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/templates/greet.tpl",
    "content": "Hello {{name}}, bye {{name}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/vars/greet.json",
    "content": "{\n  \"name\": \"Alice\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = applyBlocks(baseSrc, childBlocks);\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return renderFile(inc, vars, depth + 1, stack.concat([inc]));\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/check-render.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { render } = require('./renderer.js');\nconst vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/greet.json'), 'utf8'));\nconst out = render('greet.tpl', vars);\nassert.strictEqual(out, 'Hello Alice, bye Alice\\n', '所有出现都必须替换，实际 ' + JSON.stringify(out));\nconsole.log('RENDER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A1/verify.js",
    "content": "require('./check-render.js');\nconsole.log('F09-A1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\nR2：仅变量插入处转义，且必须覆盖 & < > \" '（先 & 再其余）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/templates/note.tpl",
    "content": "note: {{text}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/vars/note.json",
    "content": "{\n  \"text\": \"a & b < c > d \\\" e ' f\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = applyBlocks(baseSrc, childBlocks);\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return renderFile(inc, vars, depth + 1, stack.concat([inc]));\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/check-escape.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { render } = require('./renderer.js');\nconst vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/note.json'), 'utf8'));\nconst out = render('note.tpl', vars);\nassert.strictEqual(out, 'note: a &amp; b &lt; c &gt; d &quot; e &#39; f\\n', '转义必须覆盖 & < > \" \\'，实际 ' + JSON.stringify(out));\nconsole.log('ESCAPE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-A2/verify.js",
    "content": "require('./check-escape.js');\nconsole.log('F09-A2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\nR3：include 必须递归展开（同目录、只做文本内联）。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/templates/main.tpl",
    "content": "START\n{{> header.tpl}}END\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/templates/header.tpl",
    "content": "HEADER\n{{> badge.tpl}}"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/templates/badge.tpl",
    "content": "BADGE {{tag}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/vars/main.json",
    "content": "{\n  \"tag\": \"v1\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = applyBlocks(baseSrc, childBlocks);\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return readTemplate(inc); // 缺陷：未递归展开嵌套 include\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/check-include.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { render } = require('./renderer.js');\nconst vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/main.json'), 'utf8'));\nconst out = render('main.tpl', vars);\nassert.strictEqual(out, 'START\\nHEADER\\nBADGE v1\\nEND\\n', '嵌套 include 必须被展开，实际 ' + JSON.stringify(out));\nconsole.log('INCLUDE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B1/verify.js",
    "content": "require('./check-include.js');\nconsole.log('F09-B1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\nR4：同名 block 覆盖（仅单级 extends）；未覆盖的 block 保留父内容。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/templates/base.tpl",
    "content": "TITLE: {{block title}}default{{/block}}\nBODY: {{block body}}base body{{/block}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/templates/child.tpl",
    "content": "{{extends base.tpl}}\n{{block body}}child body{{/block}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/vars/child.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = baseSrc; // 缺陷：忽略子模板的 block 覆盖\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return renderFile(inc, vars, depth + 1, stack.concat([inc]));\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/check-inherit.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { render } = require('./renderer.js');\nconst vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/child.json'), 'utf8'));\nconst out = render('child.tpl', vars);\nassert.strictEqual(out, 'TITLE: default\\nBODY: child body\\n', '子 block 必须覆盖 body、未覆盖的 title 保留父内容，实际 ' + JSON.stringify(out));\nconsole.log('INHERIT OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-B2/verify.js",
    "content": "require('./check-inherit.js');\nconsole.log('F09-B2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\nR5/R6：快照逐字节比较；重复渲染与执行顺序不得改变快照。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/templates/tpl-a.tpl",
    "content": "A: {{name}} / {{tag}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/templates/tpl-b.tpl",
    "content": "B: {{> part-b.tpl}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/templates/part-b.tpl",
    "content": "part {{name}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/templates/tpl-c.tpl",
    "content": "C: {{missing}}|{{nil}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/vars/tpl-a.json",
    "content": "{\n  \"name\": \"Alice\",\n  \"tag\": \"<t>\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/vars/tpl-b.json",
    "content": "{\n  \"name\": \"Bob\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/vars/tpl-c.json",
    "content": "{\n  \"nil\": null\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = applyBlocks(baseSrc, childBlocks);\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return renderFile(inc, vars, depth + 1, stack.concat([inc]));\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/work/tpl-a.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"tpl-a.tpl\";\nconst DUR = 3500;\nconst TOKEN = \"TA-1a2b\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/work/tpl-b.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"tpl-b.tpl\";\nconst DUR = 3500;\nconst TOKEN = \"TB-77c4\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/work/tpl-c.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"tpl-c.tpl\";\nconst DUR = 3000;\nconst TOKEN = \"TC-31e8\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行渲染 + 与独立参考渲染逐字节一致（不执行任何渲染工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// ---- 独立参考渲染器（与被测 renderer.js 无共享代码）----\nconst REF = (function () {\n  function read(f) { return fs.readFileSync(f, 'utf8').replace(/\\r\\n/g, '\\n'); }\n  function esc(s) { return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('\"').join('&quot;').split(String.fromCharCode(39)).join('&#39;'); }\n  function file(f, vars, depth, stack) {\n    if (depth > 10) throw new Error('depth');\n    let t = read(f);\n    const e = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(t);\n    if (e) {\n      if (depth > 0) throw new Error('multi-level extends');\n      const bs = read(path.join(path.dirname(f), e[1]));\n      if (/^\\{\\{extends/m.test(bs)) throw new Error('base extends');\n      const cb = {};\n      for (const m of t.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) cb[m[1]] = m[2];\n      t = bs.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (a, n, b) => (Object.prototype.hasOwnProperty.call(cb, n) ? cb[n] : b));\n    }\n    t = t.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (a, n) => { const inc = path.join(path.dirname(f), n); if (stack.indexOf(inc) >= 0) throw new Error('cycle'); return file(inc, vars, depth + 1, stack.concat([inc])); });\n    t = t.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (a, n) => { const v = vars[n]; return v === undefined || v === null ? '' : esc(v); });\n    return t;\n  }\n  return { render: (name, vars) => { const f = path.join(__dirname, 'templates', name); return file(f, vars || {}, 0, [f]); } };\n})();\nconst BUDGET_MS = 6500;\nconst NAMES = [\"tpl-a.tpl\",\"tpl-b.tpl\",\"tpl-c.tpl\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nfor (const n of NAMES) {\n  const base = n.replace(/\\.tpl$/, '');\n  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n  const got = fs.readFileSync(path.join(__dirname, 'snapshots', base + '.snap'), 'utf8');\n  const ref = REF.render(n, vars);\n  assert.strictEqual(got, ref, '快照与独立参考渲染不一致：' + base);\n}\n// R6：顺序无关性（以两种不同顺序各渲染一遍，结果必须逐字节相同）\nfor (const n of NAMES) {\n  const base = n.replace(/\\.tpl$/, '');\n  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n  const first = REF.render(n, vars);\n  for (const other of NAMES.slice().reverse()) { if (other !== n) { const o = other.replace(/\\.tpl$/, ''); REF.render(other, JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', o + '.json'), 'utf8'))); } }\n  const second = REF.render(n, vars);\n  assert.strictEqual(first, second, '共享依赖下顺序变化导致快照漂移：' + base);\n}\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('SNAPSHOTS OK templates=' + NAMES.length + ' span=' + span + 'ms order=independent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C1/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst NAMES = [\"tpl-a.tpl\",\"tpl-b.tpl\",\"tpl-c.tpl\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nfor (const n of NAMES) { const s = path.join(__dirname, 'snapshots', n.replace(/\\.tpl$/, '') + '.snap'); assert.ok(fs.existsSync(s), '缺少快照 ' + s); }\nconsole.log(\"F09-C1 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/CONTRACT.md",
    "content": "# 渲染契约\n\nR1 变量替换：`{{name}}` → 变量文本；缺失变量 → 空字符串；null → 空字符串。\nR2 转义：**仅变量插入处**做 HTML 转义（& → &amp;，< → &lt;，> → &gt;，\" → &quot;，' → &#39;），\n   替换顺序为先 & 再 < > \" '；模板字面文本不转义。\nR3 include：`{{> partial}}`，同目录解析，只做文本内联，不参与 block 体系；\n   主模板 depth=0，第一次 include depth=1，最大允许 depth=10；\n   超过 10 或检测到循环 include ⇒ **render error**（不得截断、不得输出未展开文本、不得部分输出）。\nR4 继承：`{{extends base}}` + `{{block name}}…{{/block}}`；同名 block 覆盖，未覆盖保留父内容，\n   block 外文本忽略；**仅允许单级 extends**（base 不得继续 extends）；多级或循环 ⇒ **render error**。\nR5 snapshot canonical：UTF-8 bytes → CRLF 规范化为 LF → 不删除/不增加其它空白 → 逐字节比较；\n   最终换行符属于快照内容（\"hello\\n\" 与 \"hello\" 必须不同）。\nR6 确定性：同一输入重复渲染必须逐字节相同；共享依赖下执行顺序不得改变任一 snapshot。\n\nR6：共享依赖（同一 partial 被多模板使用）时，执行顺序不得改变任一 snapshot。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/templates/shared.tpl",
    "content": "SHARED[{{env}}]\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/templates/page-x.tpl",
    "content": "X\n{{> shared.tpl}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/templates/page-y.tpl",
    "content": "Y\n{{> shared.tpl}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/templates/page-z.tpl",
    "content": "Z\n{{> shared.tpl}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/vars/page-x.json",
    "content": "{\n  \"env\": \"prod\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/vars/page-y.json",
    "content": "{\n  \"env\": \"prod\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/vars/page-z.json",
    "content": "{\n  \"env\": \"prod\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/renderer.js",
    "content": "// 渲染器：R1 变量替换 / R2 转义 / R3 include(depth+cycle) / R4 单级 extends\nconst fs = require('fs');\nconst path = require('path');\nfunction esc(s) {\n  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');\n}\nfunction readTemplate(file) { return fs.readFileSync(file, \"utf8\").replace(/\\r\\n/g, \"\\n\"); }\nfunction applyBlocks(baseSrc, childBlocks) {\n  return baseSrc.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (all, name, body) => (Object.prototype.hasOwnProperty.call(childBlocks, name) ? childBlocks[name] : body));\n}\nfunction renderFile(file, vars, depth, stack) {\n  if (depth > 10) throw new Error(\"include depth exceeded (max 10)\");\n  let text = readTemplate(file);\n  const ext = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(text);\n  if (ext) {\n    if (depth > 0) throw new Error(\"multi-level extends not allowed\");\n    const baseFile = path.join(path.dirname(file), ext[1]);\n    const baseSrc = readTemplate(baseFile);\n    if (/^\\{\\{extends/m.test(baseSrc)) throw new Error(\"base must not extend\");\n    const childBlocks = {};\n    for (const m of text.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) childBlocks[m[1]] = m[2];\n    text = applyBlocks(baseSrc, childBlocks);\n  }\n  text = text.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (all, name) => {\n    const inc = path.join(path.dirname(file), name);\n    if (stack.indexOf(inc) >= 0) throw new Error(\"include cycle detected: \" + name);\n    return renderFile(inc, vars, depth + 1, stack.concat([inc]));\n  });\n  text = text.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (all, name) => {\n    const v = vars[name];\n    return v === undefined || v === null ? \"\" : esc(v);\n  });\n  return text;\n}\nfunction render(name, vars) {\n  const file = path.join(__dirname, \"templates\", name);\n  return renderFile(file, vars || {}, 0, [file]);\n}\nmodule.exports = { render, esc };\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/work/page-x.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"page-x.tpl\";\nconst DUR = 3500;\nconst TOKEN = \"PX-4b70\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/work/page-y.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"page-y.tpl\";\nconst DUR = 3200;\nconst TOKEN = \"PY-2d19\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/work/page-z.js",
    "content": "// 模板渲染工具：渲染本模板并写出 snapshot，记录时间线\nconst fs = require('fs');\nconst path = require('path');\nconst NAME = \"page-z.tpl\";\nconst DUR = 3000;\nconst TOKEN = \"PZ-88af\";\nconst ROOT = path.join(__dirname, '..');\nconst { render } = require(path.join(ROOT, 'renderer.js'));\nconst start = Date.now();\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, DUR);\nconst vars = JSON.parse(fs.readFileSync(path.join(ROOT, 'vars', NAME.replace(/\\.tpl$/, '') + '.json'), 'utf8'));\nconst out = render(NAME, vars);\nconst end = Date.now();\nfs.mkdirSync(path.join(ROOT, 'snapshots'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'snapshots', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });\nfs.writeFileSync(path.join(ROOT, 'out', NAME.replace(/\\.tpl$/, '') + '.snap'), out, 'utf8');\nfs.appendFileSync(path.join(ROOT, 'timeline.jsonl'), JSON.stringify({ tpl: NAME, start, end, token: TOKEN, bytes: out.length }) + '\\n');\nconsole.log(NAME + ' rendered in ' + (end - start) + 'ms bytes=' + out.length);\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/check-timeline.js",
    "content": "// 纯读取检查器：验证已发生的并行渲染 + 与独立参考渲染逐字节一致（不执行任何渲染工具）\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\n// ---- 独立参考渲染器（与被测 renderer.js 无共享代码）----\nconst REF = (function () {\n  function read(f) { return fs.readFileSync(f, 'utf8').replace(/\\r\\n/g, '\\n'); }\n  function esc(s) { return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('\"').join('&quot;').split(String.fromCharCode(39)).join('&#39;'); }\n  function file(f, vars, depth, stack) {\n    if (depth > 10) throw new Error('depth');\n    let t = read(f);\n    const e = /^\\{\\{extends\\s+([\\w.-]+)\\}\\}\\s*$/m.exec(t);\n    if (e) {\n      if (depth > 0) throw new Error('multi-level extends');\n      const bs = read(path.join(path.dirname(f), e[1]));\n      if (/^\\{\\{extends/m.test(bs)) throw new Error('base extends');\n      const cb = {};\n      for (const m of t.matchAll(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g)) cb[m[1]] = m[2];\n      t = bs.replace(/\\{\\{block\\s+([\\w.-]+)\\}\\}([\\s\\S]*?)\\{\\{\\/block\\}\\}/g, (a, n, b) => (Object.prototype.hasOwnProperty.call(cb, n) ? cb[n] : b));\n    }\n    t = t.replace(/\\{\\{>\\s*([\\w.\\/-]+)\\}\\}/g, (a, n) => { const inc = path.join(path.dirname(f), n); if (stack.indexOf(inc) >= 0) throw new Error('cycle'); return file(inc, vars, depth + 1, stack.concat([inc])); });\n    t = t.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (a, n) => { const v = vars[n]; return v === undefined || v === null ? '' : esc(v); });\n    return t;\n  }\n  return { render: (name, vars) => { const f = path.join(__dirname, 'templates', name); return file(f, vars || {}, 0, [f]); } };\n})();\nconst BUDGET_MS = 6500;\nconst NAMES = [\"page-x.tpl\",\"page-y.tpl\",\"page-z.tpl\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl（本次运行尚未发生）');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nfor (const n of NAMES) {\n  const base = n.replace(/\\.tpl$/, '');\n  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n  const got = fs.readFileSync(path.join(__dirname, 'snapshots', base + '.snap'), 'utf8');\n  const ref = REF.render(n, vars);\n  assert.strictEqual(got, ref, '快照与独立参考渲染不一致：' + base);\n}\n// R6：顺序无关性（以两种不同顺序各渲染一遍，结果必须逐字节相同）\nfor (const n of NAMES) {\n  const base = n.replace(/\\.tpl$/, '');\n  const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', base + '.json'), 'utf8'));\n  const first = REF.render(n, vars);\n  for (const other of NAMES.slice().reverse()) { if (other !== n) { const o = other.replace(/\\.tpl$/, ''); REF.render(other, JSON.parse(fs.readFileSync(path.join(__dirname, 'vars', o + '.json'), 'utf8'))); } }\n  const second = REF.render(n, vars);\n  assert.strictEqual(first, second, '共享依赖下顺序变化导致快照漂移：' + base);\n}\nassert.ok(/^集成/m.test(fs.readFileSync(path.join(__dirname, 'INTEGRATION.md'), 'utf8')), '缺少集成产物结论');\nconsole.log('SNAPSHOTS OK templates=' + NAMES.length + ' span=' + span + 'ms order=independent');\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/INTEGRATION.md",
    "content": "# 集成说明\n（待补）\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-C2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst BUDGET_MS = 6500;\nconst NAMES = [\"page-x.tpl\",\"page-y.tpl\",\"page-z.tpl\"];\nconst tl = path.join(__dirname, 'timeline.jsonl');\nassert.ok(fs.existsSync(tl), '缺少 timeline.jsonl');\nconst entries = fs.readFileSync(tl, 'utf8').trim().split('\\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));\nassert.strictEqual(new Set(entries.map((e) => e.tpl)).size, NAMES.length, 'distinct 模板数不符');\nconst span = Math.max(...entries.map((e) => e.end)) - Math.min(...entries.map((e) => e.start));\nassert.ok(span <= BUDGET_MS, '总耗时超预算：span=' + span + 'ms > ' + BUDGET_MS + 'ms');\nfor (const n of NAMES) { const s = path.join(__dirname, 'snapshots', n.replace(/\\.tpl$/, '') + '.snap'); assert.ok(fs.existsSync(s), '缺少快照 ' + s); }\nconsole.log(\"F09-C2 OK\");\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/pkg-a/render.js",
    "content": "// A：变量替换\nfunction fill(tpl, vars) { return tpl.replace(/\\{\\{name\\}\\}/, vars.name); }\nmodule.exports = { fill };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/pkg-b/render.js",
    "content": "// B：转义\nfunction esc(s) { return String(s).split(\"<\").join(\"&lt;\"); }\nmodule.exports = { esc };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/pkg-c/render.js",
    "content": "// C：include 展开\nfunction inline(tpl, parts) { return tpl; }\nmodule.exports = { inline };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/check-a.js",
    "content": "const assert = require('assert');\nconst { fill } = require('./pkg-a/render.js');\nassert.strictEqual(fill('{{name}}/{{name}}', { name: 'A' }), 'A/A');\nconsole.log('A OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/check-b.js",
    "content": "const assert = require('assert');\nconst { esc } = require('./pkg-b/render.js');\nassert.strictEqual(esc('a & b < c'), 'a &amp; b &lt; c');\nconsole.log('B OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/check-c.js",
    "content": "const assert = require('assert');\nconst { inline } = require('./pkg-c/render.js');\nassert.strictEqual(inline('X{{> p}}Y', { p: 'P' }), 'XPY');\nconsole.log('C OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/check-unified.js",
    "content": "const assert = require('assert');\nconst a = require('./pkg-a/render.js');\nconst b = require('./pkg-b/render.js');\nconst c = require('./pkg-c/render.js');\nassert.strictEqual(a.fill('{{name}}', { name: 'Z' }), 'Z');\nassert.strictEqual(b.esc('<x>'), '&lt;x&gt;');\nassert.strictEqual(c.inline('{{> p}}', { p: 'P' }), 'P');\nconsole.log('UNIFIED OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D1/verify.js",
    "content": "require('./check-a.js');\nrequire('./check-b.js');\nrequire('./check-c.js');\nconsole.log('F09-D1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/templates/main.tpl",
    "content": "Hi {{who}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/prepared.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/rendered.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/main.snap",
    "content": ""
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/verified.json",
    "content": "{}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-D2/verify.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst rd = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));\nconst prep = rd('prepared.json');\nassert.strictEqual(prep.prepared, true, 'prepared.json 缺少 prepared');\nassert.ok(prep.vars && typeof prep.vars === 'object', 'prepared.json 缺少 vars');\nconst ren = rd('rendered.json');\nassert.strictEqual(ren.rendered, true, 'rendered.json 缺少 rendered');\nconst tpl = fs.readFileSync(path.join(__dirname, 'templates/main.tpl'), 'utf8');\nassert.strictEqual(ren.text, tpl.split('{{who}}').join(prep.vars.who), 'rendered.text 必须由 prepared.vars 渲染模板得到');\nconst snap = fs.readFileSync(path.join(__dirname, 'main.snap'), 'utf8');\nassert.strictEqual(snap, ren.text, 'main.snap 必须与 rendered.text 逐字节一致');\nconst ver = rd('verified.json');\nassert.strictEqual(ver.verified, true, 'verified.json 缺少 verified');\nassert.strictEqual(ver.bytes, Buffer.byteLength(snap, 'utf8'), 'verified.bytes 必须等于快照字节长度');\nconsole.log('F09-D2 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/CONTRACT-v2.md",
    "content": "# 新渲染契约\n\n1. 必须保留 legacy 语法 `{{name}}` 的行为（外部消费方回放，输出逐字节不变）；\n2. 必须支持新语法 `${name}`；\n3. 两种语法必须同时可用。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/legacy.js",
    "content": "// 已上线实现：仅支持 {{name}}，输出被 legacy/greeting.snap 冻结\nfunction render(tpl, vars) { return tpl.replace(/\\{\\{name\\}\\}/g, vars.name || ''); }\nmodule.exports = { render };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/legacy/greeting.snap",
    "content": "Hello Alice\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/legacy/consumer.js",
    "content": "// 外部消费方（受保护）：按冻结快照回放 legacy 输出\nconst assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst { render } = require('../legacy.js');\nconst golden = fs.readFileSync(path.join(__dirname, 'greeting.snap'), 'utf8');\nassert.strictEqual(render('Hello {{name}}\\n', { name: 'Alice' }), golden, '冻结的 legacy 输出被破坏');\nconsole.log('CONSUMER OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/index.js",
    "content": "// 对外入口（可修改）：当前直接转发 legacy 实现\nconst base = require('./legacy.js');\nmodule.exports = { render: base.render };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/check.js",
    "content": "const assert = require('assert');\nconst { render } = require('./index.js');\nassert.strictEqual(render('Hello {{name}}\\n', { name: 'Alice' }), 'Hello Alice\\n', 'legacy 语法行为必须保留');\nassert.strictEqual(render('Hi ${name}\\n', { name: 'Bob' }), 'Hi Bob\\n', '新契约：必须支持 ${name} 语法，实际 ' + JSON.stringify(render('Hi ${name}\\n', { name: 'Bob' })));\nconsole.log('SPEC OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E1/verify.js",
    "content": "require('./legacy/consumer.js');\nrequire('./check.js');\nconsole.log('F09-E1 OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/authority.md",
    "content": "# 权威性契约\n\ntemplates/ 是 canonical source；snapshots/ 只是派生 artifact，不得作为渲染权威来源。\n直接修改 snapshot 不能替代 source 更新；snapshot 必须由 source 重新派生。\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/templates/main.tpl",
    "content": "Hello {{name}}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/vars/main.json",
    "content": "{\n  \"name\": \"Alice\"\n}\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/snapshots/main.snap",
    "content": "Hello Alice\n"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/snapshot.js",
    "content": "// 受保护：快照读写入口\nconst fs = require('fs');\nconst path = require('path');\nfunction readSnapshot() { return fs.readFileSync(path.join(__dirname, 'snapshots/main.snap'), 'utf8'); }\nfunction writeSnapshot(text) { fs.writeFileSync(path.join(__dirname, 'snapshots/main.snap'), text, 'utf8'); }\nmodule.exports = { readSnapshot, writeSnapshot };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/display.js",
    "content": "// 展示层：当前直接读取已存在的快照（把派生 artifact 当成权威来源）\nconst snapshot = require('./snapshot.js');\nfunction current() { return snapshot.readSnapshot(); }\nmodule.exports = { current };"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/reconcile.js",
    "content": "const assert = require('assert');\nconst fs = require('fs');\nconst path = require('path');\nconst display = require('./display.js');\nconst tplPath = path.join(__dirname, 'templates/main.tpl');\nconst vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'vars/main.json'), 'utf8'));\nconst rendered = () => fs.readFileSync(tplPath, 'utf8').replace(/\\{\\{name\\}\\}/g, vars.name);\nassert.strictEqual(display.current(), rendered(), '快照必须由模板源重新派生，实际 ' + JSON.stringify(display.current()));\nconst next = rendered().replace('Alice', 'Bob');\nfs.writeFileSync(tplPath, next, 'utf8'); // 只修改 canonical source\nassert.strictEqual(display.current(), next, '模板源变化后快照必须随之重新派生，实际 ' + JSON.stringify(display.current()));\nconsole.log('RECONCILE OK');"
  },
  {
    "path": "pilot-workspace/FORMAL-F09-E2/verify.js",
    "content": "require('./reconcile.js');\nconsole.log('F09-E2 OK');"
  }
];
