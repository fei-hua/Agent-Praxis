# F07 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：配置层叠 + 合并语义（defaults ≺ environment ≺ profile ≺ local；S1–S6 逐变体写死在 CONTRACT.md）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F07-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F07-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F07-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## C 类反事实证明（同 fixture / 同层文件集合 / 同预算，仅改调度）

| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |
|---|---|---|---|---|
| FORMAL-F07-C1 | 10178 ms | 6500 ms | 1 | ✓（stderr 命中「总耗时超预算」） |
| FORMAL-F07-C2 | 9782 ms | 6500 ms | 1 | ✓（stderr 命中「总耗时超预算」） |

> 串行反事实与正式证据使用同一批 source 工具、同一批层文件与同一预算，唯一差异是调度方式；
> 正式证据另要求 canonical(E_parallel) == canonical(E_reference)（参考结果由固定层叠规则独立生成）。

## FORMAL-F07-A1（A 类 · 变体 1）

**标题**：层叠覆盖方向反了（defaults 覆盖了 local）

**任务描述**：
```
pilot-workspace/FORMAL-F07-A1 的 effective config 里 defaults 层覆盖了 local 层（期望 local 覆盖 defaults）。
修正后使 node verify.js 通过。不得修改 verify.js、check-precedence.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = precedence_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（层叠顺序常量写反），目标文件与成功判据都唯一明确 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（成因已由错误输出直接定位）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-A2（A 类 · 变体 2）

**标题**：missing 被当作 null（缺失键误删下层值）

**任务描述**：
```
pilot-workspace/FORMAL-F07-A2 的 effective config 与 CONTRACT.md 规定的 S1 / S5 语义不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-null-missing.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = null_missing_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（merge.js），但「缺失 ≠ null」与「null = 删除」的判定依据写在 CONTRACT.md（S1/S5）⇒ 先查契约再改与直接修改并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-B1（B 类 · 变体 1）

**标题**：深层嵌套配置在层叠中丢失（只合并了一层）

**任务描述**：
```
pilot-workspace/FORMAL-F07-B1 的 effective config 里深层配置不完整（期望见 check-nested.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-nested.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = nested_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是「深层配置不完整」，成因可能在合并递归、层顺序或某层 JSON 结构；需沿 root→service→database 逐层定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只补一层而漏掉 cache 分支；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-B2（B 类 · 变体 2）

**标题**：数组层叠语义与契约相反（声明 replace，实现 append）

**任务描述**：
```
pilot-workspace/FORMAL-F07-B2 的数组字段层叠结果与 CONTRACT.md 声明的数组语义不一致。
请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-array-semantics.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = array_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：数组结果错误，成因可能在 merge 层（数组分支的语义选择）或调用路径（层文件装配与调用方式）；需定位合并层与其调用路径 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 容易只改调用方而留下 merge 层语义不一致；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-C1（C 类 · 变体 1）

**标题**：硬预算下的多来源并行配置加载（层叠语义不得被破坏）

**任务描述**：
```
pilot-workspace/FORMAL-F07-C1 需要在**总预算 6500 ms**内完成三个配置来源的加载，最终必须同时成立：
① work/ 下的三个来源加载工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；
② 每次执行都会把 {src,start,end,token,layers} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 各来源完成时间跨度（max(end) - min(start)）不得超过总预算；
④ 合并后的 effective.json 必须与按 CONTRACT.md 固定层叠规则（defaults<environment<profile<local + S1..S5）独立生成的参考结果**语义等价**；
⑤ 写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、merge.js 与 work/ 下的来源工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = sources_done, timeline_ok, effective_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=10178 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三来源各自固定加载耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行加载不得破坏层叠语义**（effective.json 必须与固定规则独立生成的参考结果 canonical 相等）。串行调度必然超预算（verify 直接拒绝），来源级并行 + 按固定层叠规则合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-来源-层叠等价」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-C2（C 类 · 变体 2）

**标题**：硬预算下的多 profile 批量生效配置（profile 内层顺序不得被打乱）

**任务描述**：
```
pilot-workspace/FORMAL-F07-C2 需要在**总预算 6500 ms**内完成三个 profile 的 effective config 批量生成与矩阵汇总：
① work/ 下的三个 profile 生成工具都必须真实执行完成，各自产出 out/<profile>.json 与 timeline.jsonl 记录；
② 每次执行都会把 {src,start,end,token,profile} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个 profile 内部必须保持固定层顺序（defaults<environment<profile<local，见 CONTRACT.md）；
④ 三个 profile 的完成时间跨度不得超过总预算；
⑤ 汇总矩阵 matrix.json 必须与按固定层叠规则独立生成的参考矩阵**语义等价**，且按 profile × key 完整覆盖；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、merge.js 与 work/ 下的生成工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = profiles_done, timeline_ok, matrix_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=9782 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：与 C1 同构但非复制：对象是 profile 集合而非来源集合，层文件集合与矩阵覆盖要求不同。同样存在「硬预算 + profile 内固定层顺序 + 并行结果必须与固定规则参考矩阵等价」的可机械验证约束，串行超预算而 profile 级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画「预算-profile-矩阵等价」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-D1（D 类 · 变体 1）

**标题**：三套配置模块各自的缺陷 + 统一生效配置与报告校验

**任务描述**：
```
pilot-workspace/FORMAL-F07-D1 下的三套配置模块 mod-a / mod-b / mod-c 都需要修好，
并交付统一产物 effective-config.json（含 effective 字段）与 config-report.md（配置层叠报告），
两者必须与修好后的模块一致（见 check-report.js）；node verify.js 必须通过。
不得修改 check-a.js、check-b.js、check-c.js、check-report.js、build.js、verify.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, report_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三套配置模块各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一产物校验（effective-config.json 与 config-report.md 必须与三套模块一致）⇒ 并行/编排有实际收益。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用三套模块互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-D2（D 类 · 变体 2）

**标题**：多阶段配置交付：schema 修复 → 层归一 → 生效配置 → 校验报告

**任务描述**：
```
pilot-workspace/FORMAL-F07-D2 需要交付四份产物：
① schema 修复结果 schema-repair.json（含字段 "repaired": true）；
② 层归一结果 layers-normalized.json（含字段 "normalized": true 与覆盖四个层的 layers 数组）；
③ 生效配置 effective-config.json（含字段 "effective"，其 service.database.timeout 必须与层文件按 CONTRACT.md 归一后的结果一致）；
④ 校验报告 validation-report.json（含字段 "valid": true 与至少 4 项 checks）。node verify.js 必须通过。
不得修改 verify.js、schema.json 与 CONTRACT.md。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：3 条

**验证规则**：required = schema_repaired, layers_normalized, effective_generated, report_valid, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：四个阶段（schema 修复 → 层归一 → 生效配置 → 校验报告）各有独立产物与验收字段，后两阶段依赖前两阶段结果 ⇒ 多阶段编排由任务本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-E1（E 类 · 变体 1）

**标题**：legacy 配置布局冻结与新层级语义契约冲突

**任务描述**：
```
pilot-workspace/FORMAL-F07-E1 的 config.js 是一版**已上线**的配置加载实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/config.json 与 consumer 均不得修改）。
CONTRACT.md 的新层级与迁移要求必须成立；check.js 与 config.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F07-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把既有实现当作新接口：config.js 只输出 version/timeout，而新契约要求同时携带 layers/migrated；config.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F07-E2（E 类 · 变体 2）

**标题**：effective config 使用了加载时快照（层输入变更不传播）

**任务描述**：
```
pilot-workspace/FORMAL-F07-E2 的 effective config 在层输入被修改后仍然返回旧结果。
CONTRACT.md 的「重算条款」必须成立；propagate.js、layer-store.js、merge.js 与 layers/ 下的层文件都不得修改。
请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：8 条

**验证规则**：required = propagation_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F07-E2/propagate.js

**为什么这些 first_decision 属于 GT**：未修复态在层输入变更后仍返回旧值（真实预跑：after.timeout=30 而期望 60，属业务结果差异，不是结构断言）；propagate.js / layer-store.js / merge.js 冻结 ⇒ 必须改变"effective config 从何处取值、何时计算"的方案（去掉加载时快照，改为按需推导）⇒ 计划层重规划，REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是缓存失效问题（layer-store 每次读的是当前层树，问题在推导时机）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
