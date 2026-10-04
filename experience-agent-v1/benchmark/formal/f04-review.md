# F04 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：事件流 + 状态机（顺序 / 幂等 / 迁移合法性 / 多来源），与 F01 单模块工具、F02 CLI/管线、F03 HTTP+中间件不同族。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F04-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F04-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F04-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F04-A1（A 类 · 变体 1）

**标题**：状态机迁移表缺陷（单文件单点）

**任务描述**：
```
pilot-workspace/FORMAL-F04-A1 的订单状态机在收到 ship 事件后没有进入 shipped 状态。
修正 machine.js 使状态迁移符合预期，并让 node verify.js 通过。不得修改 verify.js 与 check-machine.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = machine_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状、目标文件明确（machine.js 的迁移表），直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（故障位置已知）；委派类与 REPLAN 均不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-A2（A 类 · 变体 2）

**标题**：事件处理顺序不符契约（目标文件已知但需查约定）

**任务描述**：
```
pilot-workspace/FORMAL-F04-A2 的最终状态与 CONTRACT.md 描述的事件处理要求不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-order.js 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = order_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（apply.js），但"必须按 seq 升序"这一正确性依据写在 CONTRACT.md 中；先查约定再改属合理探索，因此 DIRECT 与 EXPLORE 并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与约定不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-B1（B 类 · 变体 1）

**标题**：末端快照缺少 status 字段（需沿链定位）

**任务描述**：
```
pilot-workspace/FORMAL-F04-B1 产出的最终快照里缺少 status 字段（期望快照见 check-snapshot.js 的要求）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-snapshot.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = snapshot_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状出现在末端快照，但字段可能在 apply.js 的聚合结果或 snapshot.js 的投影中丢失；需沿链定位 ⇒ EXPLORE 有明确依据。

**为什么其他候选不属于 GT**：DIRECT 会盲改其中一处；委派对三个小文件过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-B2（B 类 · 变体 2）

**标题**：重复事件导致重复副作用（需定位去重层是否生效）

**任务描述**：
```
pilot-workspace/FORMAL-F04-B2 在同一事件被重复投递时产生了重复计数（期望最终计数见 check-dedupe.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js、check-dedupe.js 与 dedupe.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = dedupe_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是重复副作用，但成因可能在 apply.js 未调用去重、或 dedupe.js 判重逻辑失效；需要探查调用链才能定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能改错层（dedupe.js 本身是正确的且受保护）；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-C1（C 类 · 变体 1）

**标题**：硬预算下的多来源并行消费（每来源内部保序）

**任务描述**：
```
pilot-workspace/FORMAL-F04-C1 需要在**总预算 6500 ms**内完成三分支事件来源的消费，最终必须同时成立：
① work/ 下的三个来源工具都必须真实执行完成，各自产出 out/<source>.txt；
② 每次执行都会把 {source,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个来源内部必须保持 seq 升序的处理顺序（见 CONTRACT.md）；
④ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 写出 INTEGRATION.md，含一行以「集成」开头的结论；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的来源工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：6 条

**验证规则**：required = sources_done, timeline_ok, integration_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：任务同时给出两条可机械验证的约束：三分支各自固定耗时（3.5s/3.5s/3.0s，串行合计约 10s）与 6500ms 总预算，且**每个来源内部必须保序**。串行调度必然超预算（verify 直接拒绝），而来源级并行 + 各自内部保序可以同时满足预算与顺序约束 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-保序"结构；REPLAN 不适用（任务状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-C2（C 类 · 变体 2）

**标题**：硬预算下的多来源消费 + 合并产物（每来源内部保序）

**任务描述**：
```
pilot-workspace/FORMAL-F04-C2 需要在**总预算 6500 ms**内完成三分支事件来源的消费与合并，最终必须同时成立：
① work/ 下的三个来源工具都必须真实执行完成，各自产出 out/<source>.txt；
② 每次执行都会把 {source,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个来源内部必须保持 seq 升序的处理顺序（见 CONTRACT.md）；
④ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 产出 merged.json，包含三个来源各自的条目数；写出 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的来源工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：6 条

**验证规则**：required = sources_done, merged_ok, timeline_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：与 C1 同构但非复制：来源数/耗时分布/事件量不同，且额外要求产出**合并产物**（merged.json 必须覆盖全部来源）。同样存在"硬预算 + 每来源保序"两条可机械验证的约束，串行超预算而来源级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-来源-保序-合并"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-D1（D 类 · 变体 1）

**标题**：三个来源包各自的缺陷 + 统一合并校验

**任务描述**：
```
pilot-workspace/FORMAL-F04-D1 下的三个来源包 svc-a / svc-b / svc-c 都需要修好，
并且合并校验（merge 相关检查）与该目录下的 node verify.js 也必须全部通过。
不得修改 check-a.js、check-b.js、check-c.js、check-merge.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, merge_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个来源包各自有实际缺陷与独立验收脚本，且存在一个必须三者都正确才能通过的合并校验；这种结构使并行/编排有实际收益，顺序或单点处理未刻画该结构 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用互不共享的来源包结构；DELEGATE 单路不足以刻画三路并行（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-D2（D 类 · 变体 2）

**标题**：两批事件归档为两份报告 + 合并结论

**任务描述**：
```
pilot-workspace/FORMAL-F04-D2 需要交付三份产物：
① 归档 fixtures/alpha/ 下的事件批次，生成 report-alpha.md（含一行以「Alpha 结论」开头的结论）；
② 归档 fixtures/beta/ 下的事件批次，生成 report-beta.md（含一行以「Beta 结论」开头的结论）；
③ 写 SUMMARY.md，含一行以「合并」开头的结论；node verify.js 必须通过。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = alpha_written, beta_written, summary_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：两批归档输入目录不同、产物不同，第三份为合并结论；该结构支持并行/编排，且合并步骤要求前两份完成 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画"两批 + 合并"结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-E1（E 类 · 变体 1）

**标题**：已上线的消费契约与新格式要求冲突（新增兼容路径）

**任务描述**：
```
pilot-workspace/FORMAL-F04-E1 的 normalize.js 是一版**已上线**的事件归一化实现，
其输出被 golden.json 冻结（外部消费方 consumer.js 按该文件逐字段回放，且 consumer.js 与 golden.json 均不得修改）。
SPEC.md 的新要求必须成立；check.js 与 normalize.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F04-E1/check.js

**为什么这些 first_decision 属于 GT**：现状是"把既有实现当作新接口"：normalize.js 只能输出 legacy，而 SPEC 要求同时携带 normalized；normalize.js 与 consumer/golden 均受保护、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（故障与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F04-E2（E 类 · 变体 2）

**标题**：重放下的 exactly-once 契约（需要新的幂等层）

**任务描述**：
```
pilot-workspace/FORMAL-F04-E2 的处理器在事件重放时会重复产生副作用。
上一轮针对判重逻辑做的调整记录在 replay.log。
exactly-once.md 规定的前置契约必须成立；contract.js 与 processor.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = idempotency_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F04-E2/contract.js

**为什么这些 first_decision 属于 GT**：既有判重方案（按 payload）在重放同一 id 的不同 payload 时失效（真实预跑显示副作用 2 次而契约要求 1 次）；processor.js 与 contract.js 冻结 ⇒ 在既有判重上做局部调整无法满足精确一次，必须引入以 id 为键的新幂等层并保持调用约定 ⇒ REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件或局部调参不收敛；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
