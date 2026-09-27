# DRY-02 — mini-lib 模块分析文档

分析对象：`dry-run-workspace/DRY-02/mini-lib/`（alpha.js、beta.js、gamma.js）
说明：本次仅执行只读分析，未修改 `mini-lib/` 下任何文件。

## 1. 导出函数清单

### alpha.js
| 函数名 | 说明 |
| --- | --- |
| `formatName(name)` | 将输入转为字符串、去除首尾空白并转为小写，返回规范化后的名字。 |

导出：`module.exports = { formatName }`

### beta.js
| 函数名 | 说明 |
| --- | --- |
| `greet(name)` | 调用 alpha 的 `formatName` 规范化名字后，返回 `'hello, ' + 名字` 的问候字符串。 |

导出：`module.exports = { greet }`

### gamma.js
| 函数名 | 说明 |
| --- | --- |
| `greetAll(names)` | 接收名字数组，逐个用 beta 的 `greet` 生成问候语，并用 `'; '` 连接为单个字符串返回。 |

导出：`module.exports = { greetAll }`

## 2. 模块间调用关系

单向依赖链，无循环依赖：

```
gamma.js ──调用──> beta.js ──调用──> alpha.js
```

- `gamma.js → beta.js`：`gamma.js` 第 3 行 `require('./beta')` 导入 `greet`，并在 `greetAll(names)` 内通过 `names.map(greet)` 逐个调用它。
- `beta.js → alpha.js`：`beta.js` 第 3 行 `require('./alpha')` 导入 `formatName`，并在 `greet(name)` 内调用它完成名字规范化。
- `alpha.js` 位于链路末端，不依赖其他模块。

调用顺序（自顶向下）：`greetAll` → `greet` → `formatName`。

## 3. 约束遵守情况

- 未修改、未新增、未删除 `mini-lib/` 下的任何文件。
- 三个模块均使用 `'use strict'` 与 CommonJS 语法（`require` / `module.exports`）。
