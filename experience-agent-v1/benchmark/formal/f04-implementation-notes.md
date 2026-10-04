# F04 实现笔记（生成器模板结构与下一步）

> 目的：把 `scripts/formal-author-f03.ts` 中**已验证的模板事实**固定下来，避免下一轮靠记忆重写导致返工。
> 状态：F04 生成器**尚未开始编写**（本轮仅完成模板勘察，未写入任何 F04 代码或产物）。

## 一、F03 生成器的导入块（可原样复制，仅改 F03→F04 相关常量）

```ts
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { writeJsonUtf8 } from './lib/json-io.ts';
```

路径常量（F03 → F04 改名即可）：

```ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const SEEDS_MOD = path.join(ROOT, 'benchmark', 'formal-seeds-f04.ts');
const REVIEW  = path.join(ROOT, 'benchmark', 'formal', 'f04-review.md');
const GT_DRAFTS = path.join(ROOT, 'benchmark', 'formal', 'f04-gt-drafts.json');
```

## 二、`runFixRunStrict(cwd, script)`（F03 第 22–61 行 · 原样复用）

- 运行前清理 `timeline.jsonl` 与 `out/`（保证**每个证据阶段干净开始**）
- fd 重定向捕获 stdout/stderr；严格三分类 `EXIT / SIGNAL / SPAWN_ERROR`，**禁止 undefined**
- 打印 `fixRun <kind> exitCode=… timeline entries=… span=…`，并在失败时打印 stderr 摘要

## 三、证据链尾部（F03 第 596–729 行 · 结构可整体照搬）

```
1) 逐变体把 seeds 写入 real pilot-workspace（mkdirSync + writeFileSync）
2) 预跑：对带 v.preRun 的变体执行其 command，fd 捕获 → 写 <log>（含 exit_code/stdout/stderr）
        → 记录 preExit（用于"真实失败"证据）
3) buildBaselineFromWorkspace({ taskSetId: 'F0X', taskIds: variants.map(v => v.id) }, { force: true })
        → 基线在**预跑日志之后**冻结（顺序不可颠倒）
4) verifyTask 证据循环（每个变体）：
        before = verifyTask(loaded.task)
        → 写 v.fix 到 pilot-workspace/<id>/
        → 若 v.fixRun：runFixRunStrict(pilot-workspace/<id>, run-parallel.js)
        → after = verifyTask(loaded.task)
        → 记录 { beforeOk, afterOk, status, cfg(配置错误数), pre }
        → rmSync(pilot-workspace/<id>)  清理
5) 产出：f0X-gt-drafts.json（signature 留空）· f0X-review.md（表格 + 逐条理由）· f0X-version.json
        version_files = [...10 个 YAML, 'benchmark/formal-seeds-f0X.ts', 'benchmark/formal/slots.json'].sort()
        version_hash  = sha256(entries.map(f + ':' + h).join('\n'))
6) 汇总与退出码：schema / node verify.js / verifyTask 全通过 ⇒ exit 0；否则 exit 3
```

纪律要点（来自 F03 的血泪教训，必须保留）：
```
· 所有字符串内容发射用 JSON.stringify（逐键逐值），禁止 replace(/"key":/) 之类取巧
· .mjs 工具脚本禁含 TS 语法；需要类别级自检（真 TS 语法 FAIL / 字符串内 TS 文本 PASS）
· 导入符号自检：使用的 node:fs 符号 ⊆ 已导入（F03 曾两次因 existsSync/appendFileSync 缺导入翻车）
· 锚点 NOT FOUND ⇒ exit 2 且不写盘；写盘后立即重读核对
```

## 四、F04 尚需读取的模板段（下一轮第一步）

```
scripts/formal-author-f03.ts 第 70–600 行，重点关注：
  · interface Variant（字段清单：id/category/variant/token/title/taskType/complexity/scope/
    characteristics/constraints/prompt/files/fix/fixRun/required/forbidden/protectedExtra/
    extraChecks/expected/expectedDelegation/rationaleGt/rationaleNot/preRun）
  · 逐变体定义（10 个）与 YAML 发射函数（status/verification/protected_paths 的组装规则）
  · seeds 模块（benchmark/formal-seeds-f0X.ts）的生成格式
  · node-evidence 段（临时目录 materialize + fd 捕获 node verify.js 的 BEFORE/AFTER）
  · schema 校验段（loadTask 的调用与 issues 处理）
```

## 五、F04 特有实现要求（来自 f04-draft-spec.md）

```
· 领域：事件流 + 状态机（events/ · machine.js · apply.js · dedupe.js · snapshot.js · CONTRACT.md ·
        check-*.js · verify.js）
· C1/C2：来源级并行 + **每来源内部保序** + 硬预算
        反事实证明：同 fixture / 同来源 / 同预算，仅改调度
          串行逐来源 ⇒ span > 预算 ⇒ verify exit=1（stderr 明确"超预算"）
          并行 ⇒ span ≤ 预算 **且保序断言通过**（不得只测 span）
        正式证据含：记录数 = 来源数 · span ≤ 预算 · 每来源序列严格保持
· E1/E2：真实失败预跑（exit=1）；E2 的重复副作用必须给出**实际数值**（actual/expected），
        不得只查字符串或标志位
· prompt 禁止结构性 cue；措辞用"串行调度无法满足硬预算约束"
```

## 六、当前状态

```
F01–F03 frozen（30/120）· 独立验真 60/60 PASS · manifest LOCKED · git 未 commit（HEAD c360187）
F04：生成器未开始编写；本轮仅产出本笔记（未跟踪）
```
