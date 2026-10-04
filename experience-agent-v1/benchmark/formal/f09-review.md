# F09 族级审核包（10 个正式变体 · GT 待签署）

> **领域边界**：F09 只研究"给定模板 + 显式输入变量 + 固定渲染规则 ⇒ 正确且稳定的输出"。
> 不引入：配置层叠(F07) / quota(F08) / cache / lockfile(F05) / 权限(F06) / 事件流(F04) / 部署迁移 / HTTP(F03) / 通用 workflow 本身。
> 特别声明：**不做"模板配置层级覆盖"**（变量只来自已确定的显式输入对象）；变量类型仅字符串 / null / 缺失。
> 与 F08-E2 的区分：F08-E2 = 配额账本 → 展示派生值（账务语义）；F09-E2 = **模板源 → 渲染快照**（渲染语义与产物均不同）。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F09-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F09-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F09-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F09-A1（A 类 · 变体 1）

**标题**：单变量渲染正确性（第二处占位符未被替换）

**任务描述**：
```
pilot-workspace/FORMAL-F09-A1 渲染后第二个 {{name}} 占位符没有被替换。
修正 renderer.js 使 node verify.js 通过。不得修改 verify.js 与 check-render.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = render_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（renderer.js 的变量替换不是全局替换），R1 已写死 ⇒ 直接修改是最小充分首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-A2（A 类 · 变体 2）

**标题**：特殊字符转义不一致（漏转义）

**任务描述**：
```
pilot-workspace/FORMAL-F09-A2 的渲染输出与 CONTRACT.md 的转义规则不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-escape.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = escape_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件可能已知（renderer.js 的 esc），但"必须覆盖哪些字符、替换顺序如何"的判定依据写在 CONTRACT.md（R2）⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-B1（B 类 · 变体 1）

**标题**：include/partial 嵌套展开不完整

**任务描述**：
```
pilot-workspace/FORMAL-F09-B1 的最终输出缺少嵌套 partial 的内容（见 check-include.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-include.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = include_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"嵌套内容缺失"，成因可能在 include 替换未递归、或路径解析错误、或 depth 传递错误；需沿模板依赖链定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只补一层而漏掉递归与 depth；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-B2（B 类 · 变体 2）

**标题**：继承与 Block Override 未生效

**任务描述**：
```
pilot-workspace/FORMAL-F09-B2 的子模板 block 没有覆盖父模板内容（见 check-inherit.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-inherit.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = inherit_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"覆盖未生效"，成因可能在 extends 解析、block 收集或替换三处；且需区分 R3（include 内联）与 R4（block 覆盖体系）⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只改替换而漏掉 block 收集；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-C1（C 类 · 变体 1）

**标题**：硬预算下的独立模板并行渲染（快照一致性）

**任务描述**：
```
pilot-workspace/FORMAL-F09-C1 需要在**总预算 6500 ms**内完成三个模板的渲染，最终必须同时成立：
① work/ 下的三个渲染工具都必须真实执行完成，各自产出 snapshots/<name>.snap；
② 每次执行都会把 {tpl,start,end,token,bytes} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 三模板完成时间跨度（max(end) - min(start)）不得超过总预算；
④ 每份快照必须与**独立参考渲染器**逐字节一致（UTF-8 → CRLF→LF → 逐字节比较）；
⑤ 写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、renderer.js 与 work/ 下的渲染工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = templates_done, timeline_ok, snapshots_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三模板各自固定渲染耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行渲染不得改变任何快照**（每份快照必须与 checker 内嵌独立参考渲染器逐字节一致）。串行调度必然超预算（verify 直接拒绝），而模板级并行可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-模板-快照一致性"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-C2（C 类 · 变体 2）

**标题**：硬预算下的共享依赖渲染（顺序无关的确定性快照）

**任务描述**：
```
pilot-workspace/FORMAL-F09-C2 需要在**总预算 6500 ms**内完成三个共享同一 partial 的模板渲染：
① work/ 下的三个渲染工具都必须真实执行完成，各自产出 snapshots/<name>.snap；
② 每次执行都会把 {tpl,start,end,token,bytes} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 三模板完成时间跨度不得超过总预算；
④ 三个模板都 include 同一个 `shared.tpl`；每份快照必须与**独立参考渲染器**逐字节一致；
⑤ **顺序无关性**：共享依赖在不同完成顺序下不得导致快照漂移；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、renderer.js 与 work/ 下的渲染工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = templates_done, timeline_ok, order_independent, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：与 C1 的 failure mode 不同：C1 的模板**互不共享依赖**；C2 的三个模板**共享同一 partial**（shared.tpl），除"预算内完成 + 快照等于独立参考"外，checker 还以两种不同顺序各渲染一遍并断言两轮结果**逐字节相同**（顺序无关性）。⇒ C1 测"独立单元并行渲染不改变输出"，C2 测"共享依赖 + 顺序变化不产生漂移"；串行超预算而模板级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-共享依赖-顺序无关性"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-D1（D 类 · 变体 1）

**标题**：三个模板包各自的缺陷 + 统一快照校验

**任务描述**：
```
pilot-workspace/FORMAL-F09-D1 下的三个模板包 pkg-a / pkg-b / pkg-c 都需要修好，
并且统一快照校验（check-unified.js）与该目录下的 node verify.js 也必须全部通过。
不得修改 check-a.js、check-b.js、check-c.js、check-unified.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, unified_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个模板包各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用包间互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-D2（D 类 · 变体 2）

**标题**：渲染流水线：预处理 → 渲染 → 快照 → 验证

**任务描述**：
```
pilot-workspace/FORMAL-F09-D2 需要交付四份产物，且后一步必须消费前一步的真实产物：
① prepared.json（含字段 "prepared": true 与 "vars" 对象）；
② rendered.json（含字段 "rendered": true 与 "text"，其 text 必须等于用 prepared.vars 渲染 templates/main.tpl 的结果）；
③ main.snap（内容必须与 rendered.json 的 text 逐字节一致）；
④ verified.json（含字段 "verified": true 与 "bytes"，bytes 必须等于 main.snap 的字节长度）；node verify.js 必须通过。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = prepared_ok, rendered_ok, snapshot_ok, verified_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：四个阶段（预处理 → 渲染 → 快照 → 验证）各有独立产物，且 verify.js 断言**后一步消费前一步真实产物**（rendered.text 必须等于用 prepared.vars 渲染模板的结果；snap 必须与 text 逐字节一致；verified.bytes 必须等于 snap 字节数）⇒ 垂直依赖工作流结构由任务本身给出。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段化 artifact 依赖；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-E1（E 类 · 变体 1）

**标题**：模板语法契约变化后的重新规划（新增兼容渲染路径）

**任务描述**：
```
pilot-workspace/FORMAL-F09-E1 的 legacy.js 是一版**已上线**的渲染实现，其输出被 legacy/consumer.js 按行为回放（legacy/greeting.snap 与 consumer 均不得修改）。
CONTRACT-v2.md 的新要求必须成立；check.js 与 legacy.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F09-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把既有实现当作新契约：legacy.js 只支持 `{{name}}`，而 CONTRACT-v2 要求同时支持 `${name}`；legacy.js 与 consumer/冻结快照不可改、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容渲染路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F09-E2（E 类 · 变体 2）

**标题**：模板源与派生快照的权威关系（快照必须由源重新派生）

**任务描述**：
```
pilot-workspace/FORMAL-F09-E2 的快照与模板源内容不一致。
上一轮针对快照的处理记录在 snapshot.log。
authority.md 规定的前置契约必须成立；snapshot.js 与 templates/ 下的模板都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：5 条

**验证规则**：required = authority_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F09-E2/reconcile.js

**为什么这些 first_decision 属于 GT**：未修复态把派生 artifact 当权威：display 直接返回 snapshots/main.snap 的内容；当 `templates/main.tpl` 被修改（Alice → Bob，只改 source）后，快照仍是旧内容 ⇒ 真实预跑断言 actual="Hello Alice" / expected="Hello Bob"。合法解唯一路径：display 改为**由模板源重新渲染**（renderer 语义来自 canonical source），并写回派生产物；snapshot.js 与模板文件冻结 ⇒ 必须改变"快照从哪里来"的方案（计划层重规划）⇒ REPLAN 有构念依据且可满足。检查纪律：checker 不以 snapshot 反推 source。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件或直接改 snapshots/main.snap 内容（把派生物当真值，不解决问题）；EXPLORE 不成立（权威性规则与成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
