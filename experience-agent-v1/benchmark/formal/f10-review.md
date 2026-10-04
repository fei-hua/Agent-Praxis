# F10 族级审核包（10 个正式变体 · GT 待签署）

> **领域边界**：F10 只研究"数据实例 → Schema 验证 → 版本兼容性 → Schema 演进 → Migration → 验证迁移后的数据"。
> 不引入：依赖解析/lockfile(F05) / 配置层叠(F07) / quota/billing(F08) / 事件流(F04) / HTTP(F03) / 模板渲染与快照(F09) / 数据库性能优化本身 / 通用 workflow 本身。
> 特别声明：**F10 的 migration 是"数据结构与数据内容的迁移"**，不研究 deployment / rollback 编排（保留给 F12）。
> 与 F08-C2 的区分：F08-C2 = 跨分片用量记录的账务去重；F10-E2 = **schema migration 幂等性**（migration 重复执行不产生二次副作用）。
> 契约：V1–V8 逐变体写死在 CONTRACT.md；产物一律 canonical 序列化（固定字段顺序 + UTF-8 + LF + 逐字节比较）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F10-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-D2 | D | 2 | WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F10-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F10-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## C 类反事实证明（同 fixture / 同数据分片 / 同预算，仅改调度）

| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |
|---|---|---|---|---|
| FORMAL-F10-C1 | 10163 ms | 6500 ms | 1 | ✓（stderr 命中「总耗时超预算」） |
| FORMAL-F10-C2 | 9775 ms | 6500 ms | 1 | ✓（stderr 命中「总耗时超预算」） |

> 串行反事实与正式证据使用同一批分片工具、同一批数据分片与同一预算，唯一差异是调度方式；
> 正式证据另要求 canonical 产物与 checker 内嵌**独立参考迁移**逐字节一致（C2 另含 record_count 与 identity 断言）。

## FORMAL-F10-A1（A 类 · 变体 1）

**标题**：Required 字段校验缺失（缺失必填字段仍判为通过）

**任务描述**：
```
pilot-workspace/FORMAL-F10-A1 的 Schema 校验对「必填字段缺失」的数据仍判定为通过（期望失败）。
修正后使 node verify.js 通过。不得修改 verify.js、check-required.js、CONTRACT.md 与 schemas/v1.json。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = required_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（validate.js 未执行 required 检查），目标文件与错误码由 CONTRACT 唯一确定 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（失败原因由输出直接定位）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-A2（A 类 · 变体 2）

**标题**：类型与可空性判定错误（隐式转换 + null 放过）

**任务描述**：
```
pilot-workspace/FORMAL-F10-A2 的 Schema 校验结果与 CONTRACT.md 规定的 V2 语义不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-type-null.js、CONTRACT.md 与 schemas/v1.json。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = type_null_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（validate.js），但「不得隐式转换」「nullable:false 时 null 非法」的判定依据写在 CONTRACT.md（V2）⇒ 先查契约再改与直接修改并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-B1（B 类 · 变体 1）

**标题**：Backward 兼容失败：旧读取器对新增字段报错

**任务描述**：
```
pilot-workspace/FORMAL-F10-B1 的旧读取器无法读取新写入方产出的数据（期望按 V4 忽略未知字段）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-backward.js、CONTRACT.md 与 schemas/ 下的 schema。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：5 条

**验证规则**：required = backward_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"旧读取器读不了新数据"，成因可能在 writer 的字段装配或 reader 的未知字段处理；需沿 writer 输出 → reader 校验链定位（checker 另有断言保证 writer 真写出新字段）⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 容易只改一侧而留下另一处不一致；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-B2（B 类 · 变体 2）

**标题**：Forward 兼容失败：新读取器要求可选字段必须存在

**任务描述**：
```
pilot-workspace/FORMAL-F10-B2 的新读取器无法读取旧写入方产出的数据（期望按 V4 容忍缺失的可选字段）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-forward.js、CONTRACT.md 与 schemas/ 下的 schema。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：5 条

**验证规则**：required = forward_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：方向与 B1 相反且 failure mode 不同（缺失可选字段 vs 未知字段）：成因可能在 reader 的字段存在性判定或 schema 的可选性声明；需沿 schema → reader 判定链定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 容易把可选字段硬性要求或伪造默认值；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-C1（C 类 · 变体 1）

**标题**：硬预算下的多分片并行迁移（additive + backfill，产物逐字节一致）

**任务描述**：
```
pilot-workspace/FORMAL-F10-C1 需要在**总预算 6500 ms**内完成三个数据分片的 V1→V2 迁移，最终必须同时成立：
① work/ 下的三个分片迁移工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；
② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 各分片完成时间跨度（max(end) - min(start)）不得超过总预算；
④ 合并后的 migrated.jsonl 必须与按 CONTRACT.md 冻结规则（V5 backfill、V8 canonical）独立生成的参考迁移结果**逐字节一致**；
⑤ 写出 MIGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、migrate.js、schemas/ 与 work/ 下的迁移工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：10 条

**验证规则**：required = shards_done, timeline_ok, migrated_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=10163 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三分片各自固定迁移耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行迁移不得改变结果**（migrated.jsonl 必须与 checker 内嵌独立参考迁移逐字节一致）。串行调度必然超预算（verify 直接拒绝），分片级并行 + canonical 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-分片-逐字节等价」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-C2（C 类 · 变体 2）

**标题**：硬预算下的并行 rename/transform 迁移（identity 保持，无双重记录）

**任务描述**：
```
pilot-workspace/FORMAL-F10-C2 需要在**总预算 6500 ms**内完成三个数据分片的 V1→V2 rename/transform 迁移，最终必须同时成立：
① work/ 下的三个分片迁移工具都必须真实执行完成，各自产出 out/<shard>.jsonl 与 timeline.jsonl 记录；
② 每次执行都会把 {shard,start,end,token,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 各分片完成时间跨度不得超过总预算；
④ 合并后的 migrated.jsonl 必须与按 CONTRACT.md 冻结规则（V6 显式转换、V8 canonical）独立生成的参考迁移结果**逐字节一致**；
⑤ record_count 不得变化（禁止双重记录），旧字段不得保留；写出 MIGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、canonical.js、migrate.js、schemas/ 与 work/ 下的迁移工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：10 条

**验证规则**：required = shards_done, timeline_ok, migrated_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**C 类反事实**：串行 span=9775 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：与 C1 同构但承担**不同 failure mode**：C1 是 additive/backfill 正确性，C2 是**变换正确性 + identity 保持**（record_count 不变、无双重记录、旧字段不残留），且多一条旧字段不得保留的机械断言。同样存在「硬预算 + 并行结果必须与独立参考逐字节一致」的可机械验证约束，串行超预算而分片级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画「预算-分片-identity 保持」结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-D1（D 类 · 变体 1）

**标题**：三张表各自的迁移缺陷 + 统一迁移报告校验

**任务描述**：
```
pilot-workspace/FORMAL-F10-D1 下的三套迁移模块 mig-customers.js / mig-orders.js / mig-logs.js 都需要修好，
交付三张表的迁移产物 migrated/customers.jsonl、migrated/orders.jsonl、migrated/logs.jsonl，
以及统一迁移报告 migration-report.json（含 tables 与 total_records）；node verify.js 必须通过。
不得修改 check-customers.js、check-orders.js、check-logs.js、check-report.js、verify.js、CONTRACT.md、canonical.js 与 schemas/。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：10 条

**验证规则**：required = customers_fixed, orders_fixed, logs_fixed, report_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三张表各自有真实缺陷（边界回填 / 丢失记录 / 类型错误）与独立验收脚本，且存在必须三套模块都修好才能通过的统一报告校验（产物必须与模块输出逐字节一致）⇒ 并行/编排有实际收益。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用三张表互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-D2（D 类 · 变体 2）

**标题**：有依赖关系的迁移链：新增列 → 回填 → 约束校验（真实 artifact 传递）

**任务描述**：
```
pilot-workspace/FORMAL-F10-D2 需要按 CONTRACT.md 的阶段依赖完成 V1→V2 迁移，并交付：
① 各阶段产物 stages/step1.jsonl、stages/step2.jsonl、stages/step3.jsonl；
② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；
③ 最终迁移产物 migrated.jsonl 与阶段说明 CHAIN.md；node verify.js 必须通过。
不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/ops.js、schemas/ 与 data/。
```

**expected_first_decisions**：`[WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：9 条

**验证规则**：required = chain_provenance, chain_ok, migrated_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个阶段存在真实依赖（新增列会把 region 重置为 null，回填必须发生在约束校验之前），且 checker 断言 step 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致）⇒ 阶段化编排由任务结构本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段依赖与产物传递结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-E1（E 类 · 变体 1）

**标题**：破坏性 Schema 变更：新迁移路径违反 legacy 兼容契约

**任务描述**：
```
pilot-workspace/FORMAL-F10-E1 的 migrate.js 是一版**已上线**的 V1→V2 迁移，其产物被 legacy/consumer.js 按字段逐项回放（legacy/consumer.js 与 schemas/ 均不得修改）。
CONTRACT.md 的兼容条款必须成立；migrate.js 与 check.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F10-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把已上线迁移当作新接口：migrate.js 按新 schema 把 email 变成对象，而兼容条款要求 email 保持字符串并同时提供 email_detail；migrate.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容迁移路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F10-E2（E 类 · 变体 2）

**标题**：migration 幂等性失败：已是 v2 的数据被二次转换

**任务描述**：
```
pilot-workspace/FORMAL-F10-E2 的同一 migration 对**已是 v2** 的数据再次执行时产生了二次副作用。
CONTRACT.md 的 V7 幂等条款必须成立；idempotent.js、canonical.js、schemas/ 与 data/ 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：8 条

**验证规则**：required = idempotency_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F10-E2/idempotent.js

**为什么这些 first_decision 属于 GT**：未修复态对已是 v2 的数据二次执行迁移（真实预跑：display_name "AliceAlice" 而期望 "Alice"，属业务结果差异，不是结构断言）；idempotent.js / canonical.js / schemas / data 冻结 ⇒ 必须改变"迁移何时生效、如何识别已是目标版本"的方案（计划层重规划）⇒ REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因已由真实预跑记录明确）；本变体不是 F08-C2 的跨分片账务去重（对象是 migration 的二次副作用）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

---

## 人工裁定补记（F10 独立构念审查）

- **D2 的 GT 已按裁定收紧为 `WORKFLOW`（单一）**：任务语义是"add column → backfill → add constraint"的顺序依赖链，
  且 checker 断言 step 间真实 artifact 传递 ⇒ 任务本身不支持 `PARALLEL`；原 `[PARALLEL, WORKFLOW]` 属 GT 过约束（允许了任务语义不支持的类别）。
  本次仅改 GT expectation（及由其派生的 draft 元数据），未改 fixture / checker / 任务正文 / 其它 9 个变体 / V1–V8 / 既有 frozen 族。
- **术语备注（非阻塞）**：B1/B2 的 backward / forward 方向**遵循本 benchmark 契约 V4 的定义**
  （backward = new writer → old reader；forward = old writer → new reader），
  **不依据外部术语习惯推断**；审阅时请以 V4 为准。
