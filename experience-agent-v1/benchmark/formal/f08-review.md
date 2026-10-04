# F08 族级审核包（10 个正式变体 · GT 待签署）

> **防重复声明**：F08 不测试权限判定（F06）、事件排序（F04）或通用状态机恢复；
> 其主要被测对象是**共享资源配额的计算、并发消耗、幂等记账与最终一致性（账务对账）**。
> F06 解决"有没有权限"；F08 解决"有权限以后还能用多少、用了多少、并发时怎么算"。

> 脚手架：配额 / 限流 / 记账（与 F01–F07 各族的领域均不同）。status: draft；签署字段留空。
> 冻结语义 S1–S6（额度计算 / fixed window [start,end) / 并发原子性 / effective=min + reject_layer / 幂等 / canonical 对账）逐变体写入 CONTRACT.md。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F08-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F08-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F08-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F08-A1（A 类 · 变体 1）

**标题**：额度越界判定错误（恰好用尽被误拒）

**任务描述**：
```
pilot-workspace/FORMAL-F08-A1 的限流器在请求成本**恰好等于剩余额度**时错误地拒绝。
修正 limiter.js 使 node verify.js 通过。不得修改 verify.js 与 check-allow.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = boundary_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（limiter.js 的越界比较符），且 S1 契约已写死判定规则 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（位置与规则都已知）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-A2（A 类 · 变体 2）

**标题**：窗口边界记录归属错误（timestamp == window_end）

**任务描述**：
```
pilot-workspace/FORMAL-F08-A2 的窗口过滤把边界记录计入了错误的窗口，导致额度判定与 CONTRACT.md 不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-window.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = window_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件可能已知（窗口过滤实现），但"边界记录归下一窗口"这一判定依据写在 CONTRACT.md（S2）⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-B1（B 类 · 变体 1）

**标题**：多层限额未取最小值（reject_layer 错误）

**任务描述**：
```
pilot-workspace/FORMAL-F08-B1 的额度判定没有按 CONTRACT.md 的多层规则执行（结果见 check-layer.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-layer.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = layer_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"多层限额未按 min 生效"，成因可能在层级收集（漏层）或取值比较（取错层）；需沿多层判定链定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只改 effective 取值而漏掉 reject_layer 归属；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-B2（B 类 · 变体 2）

**标题**：重复记账（同一 request_id 重放被重复扣减）

**任务描述**：
```
pilot-workspace/FORMAL-F08-B2 在用量记录重放后产生了重复扣减（结果见 check-idempotent.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-idempotent.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = idempotent_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：重复扣减的成因可能在记账聚合缺去重、或幂等键选择错误、或在 limiter 累计路径；需探查记账链才能定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只改 limiter 而遗漏聚合层；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-C1（C 类 · 变体 1）

**标题**：硬预算下的多来源用量并行汇总（账务 canonical 等价）

**任务描述**：
```
pilot-workspace/FORMAL-F08-C1 需要在**总预算 6500 ms**内完成三个用量来源的汇总，最终必须同时成立：
① work/ 下的三个来源汇总工具都必须真实执行完成，各自产出 out/<src>.json；
② 每次执行都会把 {src,start,end,token,accepted,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个来源内部按 S6 规则（去重 request_id → fixed window 过滤 → accepted cost 求和）汇总；
④ 三来源完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 生成 ledger.json，其 used 与分组必须与**独立参考实现**一致；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、window.json、account.js 与 work/ 下的来源工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：8 条

**验证规则**：required = sources_done, timeline_ok, ledger_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三来源各自固定汇总耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行汇总不得破坏账务语义**（ledger 的 used 与分组必须等于 checker 内嵌独立参考实现按 S6 规则算出的结果）。串行调度必然超预算（verify 直接拒绝），而来源级并行 + canonical 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-账务等价"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-C2（C 类 · 变体 2）

**标题**：硬预算下的重叠分片并行汇总（跨来源全局幂等）

**任务描述**：
```
pilot-workspace/FORMAL-F08-C2 需要在**总预算 6500 ms**内完成三个用量分片的汇总，最终必须同时成立：
① work/ 下的三个分片工具都必须真实执行完成，各自产出 out/<src>.json（含该分片的原始记录）与 timeline.jsonl 记录；
② 每次执行都会把 {src,start,end,token,naiveAccepted,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 分片之间可能包含**相同的 request_id**（见 CONTRACT.md 的全局幂等规则）；
④ 三来源完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 生成 ledger.json，其 used 与 tenant/endpoint 分组必须与**全局幂等参考实现**一致；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、window.json、account.js 与 work/ 下的分片工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：8 条

**验证规则**：required = sources_done, timeline_ok, ledger_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：与 C1 的 failure mode 不同：C1 的分片**互不重叠**（来源内去重 + 分片求和即可）；C2 的分片**存在跨来源重复 request_id**（r1 同时出现在 src-x 与 src-y）⇒ per-source 去重不足，必须做**全局幂等去重**（tie-break：ts 最小者，ts 相同取来源名序最小者）后再按 fixed window 汇总。未修复/朴素实现按分片各自去重再相加 ⇒ naive=83 ≠ canonical=68（checker 显式断言两者必须不同，以证明该 fixture 具有区分力）。硬预算与并行结构同 C1：串行约 10s > 6500ms 被 verify 拒绝，分片级并行 ≤ 预算，且账本必须等于独立全局幂等参考 ⇒ 拆解/并行/编排 + 全局幂等 reconciliation 具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-重叠分片-全局幂等"结构；REPLAN 不适用（任务状态自洽，无既有失败方案需要推翻）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-D1（D 类 · 变体 1）

**标题**：三个限流模块各自的缺陷 + 统一额度报告校验

**任务描述**：
```
pilot-workspace/FORMAL-F08-D1 下的三个限流模块 mod-a / mod-b / mod-c 都需要修好，
并且统一额度报告校验（check-report.js）与该目录下的 node verify.js 也必须全部通过。
不得修改 check-a.js、check-b.js、check-c.js、check-report.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, report_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个限流模块各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用模块互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-D2（D 类 · 变体 2）

**标题**：多阶段账务修复：记录修复 → 聚合归一 → 账本重生成 → 对账报告

**任务描述**：
```
pilot-workspace/FORMAL-F08-D2 需要交付四份产物：
① 修复后的用量记录 records-fixed.json（含字段 "repaired": true）；
② 聚合归一结果 aggregation-normalized.json（含字段 "normalized": true）；
③ 重生成的账本 ledger-rebuilt.json（含字段 "used"）；
④ 对账报告 reconciliation-report.json（含字段 "reconciled": true）；node verify.js 必须通过。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = records_repaired, aggregation_normalized, ledger_rebuilt, reconciled, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：四个阶段（记录修复 → 聚合归一 → 账本重生成 → 对账报告）各有独立产物与验收字段，后续阶段依赖前序结果 ⇒ 多阶段编排结构由任务本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-E1（E 类 · 变体 1）

**标题**：旧版计费规则与新 quota 契约冲突（新增兼容路径）

**任务描述**：
```
pilot-workspace/FORMAL-F08-E1 的 billing.js 是一版**已上线**的计费实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/billing.json 与 consumer 均不得修改）。
CONTRACT-quota.md 的新要求必须成立；check.js 与 billing.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F08-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把既有实现当作新接口：billing.js 只能输出 billed，而新契约要求同时携带 remaining/reject_layer；billing.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F08-E2（E 类 · 变体 2）

**标题**：展示派生状态与账本真值脱节（账本权威性）

**任务描述**：
```
pilot-workspace/FORMAL-F08-E2 对外展示的剩余额度与账本真值不一致。
上一轮针对展示数据的处理记录在 display.log。
ledger-authority.md 规定的前置契约必须成立；reconcile.js 与 ledger.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = authority_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F08-E2/reconcile.js

**为什么这些 first_decision 属于 GT**：未修复态把派生展示数据当作权威：display-snapshot.json 残留 remaining=70（对应旧 used=30），而账本 used=80 ⇒ 真实剩余 20（真实预跑断言 actual=70 / expected=20）；进一步账本更新为 used=90 时展示必须变为 10。reconcile.js 与 ledger.js 冻结 ⇒ 必须改变"展示从哪里取数"的方案（由账本推导），属计划层重规划 ⇒ REPLAN 有构念依据且可满足；与 F06 缓存键失效、F07 层叠传播机制不同。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件或直接改 display-snapshot.json 数值（把派生数据当真值，不解决问题）；EXPLORE 不成立（权威性规则与成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

---

## 人工裁定（F08 独立构念审查 · 全部通过）

**C2 构念名称（冻结）**：**跨来源重叠分片条件下的全局幂等对账正确性**
（对照 C1：**不重叠分片下的并行调度/预算正确性**）

- 区分两个 C 变体的实验量：跨来源重复 request_id（C1 = 0，C2 = 1）；
- C2 区分力证据：per-source naive = 83 ≠ global canonical = 68（checker 显式断言二者必须不同）；
- 第三份独立实现复算：ledger.used = 68 == 独立复算 68，groups 全等；
- 保持相同：window 规则 / quota 规则 / timing budget(6500ms) / parallel structure / L_reference 独立性。

最终裁定：A1✅ A2✅ B1✅ B2✅ C1✅ C2✅ D1✅ D2✅ E1✅ E2✅ = **10/10 PASS**
