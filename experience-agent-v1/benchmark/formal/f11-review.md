# F11 族级审核包（10 个正式变体 · GT 待签署）

> **领域边界**：F11 只研究「日志记录 → 聚合 → 过滤 → 排序 → 查询结果」。
> 一句话边界：`F04 = event → state`（状态发生了什么变化）；`F11 = log → query result`（对一组已发生记录的确定性查询结果）。
> F11 明确不研究：状态机 / event replay / transition correctness（F04）· HTTP / middleware（F03）· schema migration（F10）·
> template rendering / snapshot（F09）· cache / lockfile（F05、F07）· deployment / rollback（F12）· 配额 / 记账（F08）。
> **边界声明（每变体 CONTRACT 顶部同款）**：F11 查询不得修改状态、不得重放事件以产生状态变化，也不得以状态转移结果作为查询正确性的判定依据。
> 与既有族的跨族区分：F08-C2 = 跨来源账务去重的全局幂等（对象：用量/额度）；F11-B2 = 单查询内重复投递去重（对象：日志记录）。
> F10-E2 = migration 重复执行无副作用（对象：schema 迁移）；F11-E2 = 缺失值不得被默认值修补（对象：聚合语义）。
> F09-E2 = 模板源 → 渲染快照（权威源模式）；F11 不再做第三份「权威源 vs 派生物」变体。
> 契约：Q1–Q8 逐变体写死在 CONTRACT.md；结果一律 canonical 序列化（固定字段顺序 + UTF-8 + 结尾 LF + 逐字节比较）；Q3 为真全序（第三键 = canonical_record_bytes）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed（LOCKED）。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F11-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-D2 | D | 2 | WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F11-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F11-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## C 类反事实证明（同 fixture / 同分片集合 / 同单分片耗时 / 同预算，仅改调度）

| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |
|---|---|---|---|---|
| FORMAL-F11-C1 | 10179 ms | 6500 ms | 1 | ✓（命中「总耗时超预算」） |
| FORMAL-F11-C2 | 9765 ms | 6500 ms | 1 | ✓（命中「总耗时超预算」） |

> 串行反事实与正式证据使用同一批分片工具、同一批分片数据与同一预算，唯一差异是调度方式；
> 正式证据另要求各分片产物与合并产物都与 checker 内嵌**独立参考实现**逐字节一致（C1：分片互不相交 + 局部聚合合并；C2：跨分片全局合并 + Q3 第三键 tie-break + 去重取用）。

## FORMAL-F11-A1（A 类 · 变体 1）

**标题**：单谓词过滤判定取反（level == "error" 结果反转）

**任务描述**：
```
pilot-workspace/FORMAL-F11-A1 的日志查询把 `level == "error"` 的判定做反了：error 记录被排除、非 error 记录被返回。
修正后运行 node run.js 重算 result.json，使 node verify.js 通过。
不得修改 verify.js、check-filter.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条

**验证规则**：required = filter_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（谓词比较判定取反），目标文件 query.js 与期望结果由 CONTRACT.md 的 Q4 唯一确定 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（失败定位由 check-filter.js 的断言直接给出）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-A2（A 类 · 变体 2）

**标题**：时间窗口边界归属错误（ts == end 被计入本窗口）

**任务描述**：
```
pilot-workspace/FORMAL-F11-A2 的日志查询窗口边界归属与 CONTRACT.md 的 Q1 不一致（恰好落在窗口右端点的记录被计入了本次查询）。
修正后运行 node run.js 重算 result.json，使 node verify.js 通过。
不得修改 verify.js、check-window.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条

**验证规则**：required = window_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（query.js），但「半开区间 [start, end) ⇒ ts == end 不计入」的判定依据写在 CONTRACT.md（Q1）⇒ 先查契约再改与直接修改并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-B1（B 类 · 变体 1）

**标题**：复合谓词优先级反 + 缺失字段被当作匹配

**任务描述**：
```
pilot-workspace/FORMAL-F11-B1 的复合过滤表达式结果与 CONTRACT.md 的 Q4 不一致（含 AND/OR/NOT 的表达式返回了错误的记录集）。
修正后运行 node run.js 重算 result.json，使 node verify.js 通过。
不得修改 verify.js、check-filter.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条

**验证规则**：required = filter_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：同一实现内存在两处真实缺陷（AND/OR 优先级反 + 缺失/null 字段被当作匹配），且两处各自的判定依据都写在 CONTRACT.md 的 Q4；check-filter.js 只给出最终记录集差异 ⇒ 需先明确 Q4 语义再定位（两处缺陷各自都改变结果，只改一处仍不通过）⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 容易只改一处而留下另一个缺陷；委派类超出必要；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-B2（B 类 · 变体 2）

**标题**：重复 record_id 去重取错（未保留 Q3 全序最早一条）

**任务描述**：
```
pilot-workspace/FORMAL-F11-B2 的查询对同一 record_id 的重复投递取用了错误的记录（与 CONTRACT.md 的 Q3/Q4-2 不一致）。
修正后运行 node run.js 重算 result.json，使 node verify.js 通过。
不得修改 verify.js、check-dedup.js、CONTRACT.md、canonical.js、run.js、query.json 与 logs/。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条

**验证规则**：required = dedup_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：成因在「Q3 真全序（含第三键 canonical_record_bytes）→ 去重取用 → 谓词过滤」的组合语义上，需先确定全序定义才能判断该保留哪一条（check-dedup.js 只断言最终记录集）⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 未刻画「全序 + 第三键 + 去重取用」的组合；本变体不是 F08-C2 的跨来源账务去重（对象是单查询内的重复投递，且不涉及预算与并行）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-C1（C 类 · 变体 1）

**标题**：硬预算下的不相交分片并行查询（结果与独立参考逐字节一致）

**任务描述**：
```
pilot-workspace/FORMAL-F11-C1 需要在**总预算 6500 ms**内完成三个日志分片的查询聚合，最终必须同时成立：
① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<shard>.json 与 timeline.jsonl 记录；
② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；
④ 合并后的 result.json 必须与按 CONTRACT.md 冻结语义（Q1–Q8）独立计算的结果**逐字节一致**；
⑤ 写出 REPORT.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、shard-lib.js、query.json、logs/ 与 work/ 下的分片工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：12 条

**验证规则**：required = shards_done, timeline_ok, result_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=10179 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三个分片各自固定耗时（3.5s / 3.5s / 3.0s，串行约 10s）与 6500ms 总预算，且**调度方式不得改变结果**（result.json 与各分片局部结果都必须与 checker 内嵌独立参考逐字节一致）。串行执行无法满足硬预算（verify 直接以「总耗时超预算」拒绝），分片级并行 + 局部结果合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-分片-逐字节等价」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-C2（C 类 · 变体 2）

**标题**：硬预算下的跨分片全局合并排序（Q3 第三键 tie-break 作用于合并后结果）

**任务描述**：
```
pilot-workspace/FORMAL-F11-C2 需要在**总预算 6500 ms**内完成三个日志分片的 canonical 化与**跨分片全局合并**，最终必须同时成立：
① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；
② 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；
③ merged.jsonl = 全部合法记录（Q1）按 Q3 真全序（含第三键 canonical_record_bytes）的行序，**重复 record_id 必须保留**；
④ result.json 必须与按 Q1–Q8 独立计算的结果**逐字节一致**（含全局去重：保留 Q3 全序最早一条）；
⑤ 写出 REPORT.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、predicate.js、query.json、logs/ 与 work/ 下的分片工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：12 条

**验证规则**：required = shards_done, timeline_ok, merged_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=9765 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：与 C1 同构但承担**不同 failure mode**：C1 = 不相交分片的局部结果与预算编排；C2 = **跨分片全局合并/去重/全序**（分片按 record_id hash 交错，含跨分片重复 record_id，其中 (ts, record_id) 相同而 canonical bytes 不同的记录必须由第三键决定全序），checker 断言「分片拼接序 ≠ canonical 全序」且分片内语义由冻结工具固定（失败只能来自合并路径）。同样存在硬预算 + 与独立参考逐字节一致的机械约束 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画「合并-全序-第三键」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-D1（D 类 · 变体 1）

**标题**：三个独立查询目标各自的缺陷 + 统一报告校验

**任务描述**：
```
pilot-workspace/FORMAL-F11-D1 下的三个查询目标 q-stats.js / q-errors.js / q-slowest.js 的结果都与 CONTRACT.md 的 Q1–Q8 不一致，统一报告 query-report.json 的 total_input_records 也不符合 Q1。
交付 results/stats.json、results/errors.json、results/slowest.json 与 query-report.json；运行 node run-all.js 重算全部产物；node verify.js 必须通过。
不得修改 check-stats.js、check-errors.js、check-slowest.js、check-report.js、verify.js、CONTRACT.md、canonical.js、run-all.js、query.json 与 logs/。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：10 条

**验证规则**：required = stats_fixed, errors_fixed, slowest_fixed, report_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个查询目标各自有真实缺陷（Q8 隐式类型转换 / 分组序 / Q3 tie-break）与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验（报告必须与三个结果文件及合法输入规模一致）⇒ 并行/编排有实际收益。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用三个目标互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-D2（D 类 · 变体 2）

**标题**：有依赖的查询流水线：合法性 → 去重 → 聚合 → 全序（真实 artifact 传递）

**任务描述**：
```
pilot-workspace/FORMAL-F11-D2 需要按 CONTRACT.md 的阶段依赖完成查询流水线，并交付：
① 各阶段产物 stages/step1.jsonl、stages/step2.jsonl、stages/step3.json；
② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；
③ 最终查询结果 result.json 与阶段说明 CHAIN.md；node verify.js 必须通过。
不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/ops.js、query.json 与 logs/。
```

**expected_first_decisions**：`[WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = chain_provenance, chain_ok, result_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：四个阶段存在真实数据依赖（非法 ts 必须在最前排除、去重必须保留 Q3 全序最早一条（含第三键）、聚合只能发生在窗口+谓词之后、limit 只能作用于 Q3 全序），且 checker 断言 step 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致）⇒ 阶段化编排由任务结构本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段依赖与产物传递结构；DELEGATE 单路不足（D 类等价集）；PARALLEL 无依据（四阶段严格串行依赖）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-E1（E 类 · 变体 1）

**标题**：排序契约变化：插入序 → Q3 真全序（已上线查询与 legacy 快照冻结）

**任务描述**：
```
pilot-workspace/FORMAL-F11-E1 的 result.json 仍按**插入序**返回记录，而新契约（CONTRACT.md 的 Q3）要求真全序 `(ts asc, record_id 序数升序, canonical_record_bytes 升序)`。
query.js 已上线且与 legacy 导出链、冻结快照绑定，均不得修改；请新增排序层 order.js 并由非保护入口 index.js 装配，运行 node run-query.js 重新生成 result.json，使 node verify.js 通过。
不得修改 verify.js、check.js、check-legacy.js、CONTRACT.md、canonical.js、query.js、run-query.js、legacy/、snapshots/、query.json 与 logs/。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：12 条

**验证规则**：required = order_path_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F11-E1/check.js → exit=1

**E 类真实预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: 新查询路径必须按 Q3 真全序输出：actual="{\"records\":[{\"ts\":100,\"level\":\"info\",\"service\":\"api\",\"record_id\":\"r-b\",\"value\":1},{\"ts\":100,\"level\":\"info\",\"service\":\"api\",\"record_id\":\"r-a\",\"value\":2},{\"ts\":100,\"level\":\"info\",\"service\":\"web\",\"record" expected="{\"re`

**为什么这些 first_decision 属于 GT**：现状把「插入序」当作结果顺序：query.js（已上线）按插入序返回匹配记录、legacy 导出与冻结快照依赖该顺序，而新契约要求 result.json 按 Q3 真全序（ts, record_id, canonical bytes）；query.js 与 legacy 链冻结、check.js 不得修改 ⇒ 局部改参无法同时满足两条契约，必须新增排序层并重新装配非保护入口（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件（query.js / legacy 链）；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F11-E2（E 类 · 变体 2）

**标题**：缺失值被默认值修补：新契约禁止 default-fill 聚合（共享流水线冻结）

**任务描述**：
```
pilot-workspace/FORMAL-F11-E2 的 result.json 聚合把**缺失 value 的记录按 legacy 默认值修补**后计入，而新契约（CONTRACT.md 的 Q2）要求缺失/null 不得计入 sum 与 count_with_value；同时 legacy 视图必须继续由冻结的默认值填充路径生成。
pipeline.js 与 legacy/ 不得修改；请新增兼容聚合层 aggregate-compat.js 并调整非保护装配 query.js，运行 node run.js 重新生成 result.json，使 node verify.js 通过。
不得修改 verify.js、check-query.js、check-legacy.js、CONTRACT.md、canonical.js、pipeline.js、legacy/、legacy-view.js、query.json 与 logs/。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：11 条

**验证规则**：required = compat_layer_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F11-E2/check-query.js → exit=1

**E 类真实预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: Q2：缺失/null 的 value 不得被默认值修补 —— actual sum=130 / expected sum=100`

**为什么这些 first_decision 属于 GT**：既有默认值填充路径（legacy/normalize.js + legacy/defaults.json）被冻结且 legacy 视图依赖它，而新契约要求缺失 value **不得**被默认值修补（Q2）；共享流水线 pipeline.js 冻结且聚合由调用方注入 ⇒ 无法就地修改聚合语义，必须新增不依赖默认值填充的兼容聚合层并重新装配非保护入口（计划层重规划）⇒ REPLAN；真实预跑给出业务差异（actual sum=130 / expected sum=100）。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件（pipeline.js / legacy 链）；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是 F10-E2 的迁移幂等、也不是 F09-E2 的权威源模式；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
