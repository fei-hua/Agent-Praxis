# F05 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：依赖解析 / 包图 / Lockfile 一致性（与 F01 单模块工具、F02 CLI/管线、F03 HTTP+中间件、F04 事件流+状态机不同族）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F05-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F05-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F05-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F05-A1（A 类 · 变体 1）

**标题**：版本约束解析错误（单文件单点）

**任务描述**：
```
pilot-workspace/FORMAL-F05-A1 的依赖解析器没有按 manifest 的 semver 约束选择版本。
修正 resolver.js 使 node verify.js 通过。不得修改 verify.js 与 check-resolve.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = version_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（resolver.js 的约束匹配），目标明确 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（位置已知）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-A2（A 类 · 变体 2）

**标题**：未遵循已冻结 lockfile 的解析结果

**任务描述**：
```
pilot-workspace/FORMAL-F05-A2 的解析结果与冻结的 lockfile.json 不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-lockfile.js、lockfile.json 与 CONTRACT.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = lockfile_honored, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（resolver.js），但"必须优先采用 lockfile 固定版本"的判定依据写在 CONTRACT.md ⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅未遵循契约）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-B1（B 类 · 变体 1）

**标题**：间接依赖缺失（需沿依赖图定位）

**任务描述**：
```
pilot-workspace/FORMAL-F05-B1 生成的依赖图缺少间接依赖（期望图内容见 check-graph.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-graph.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = graph_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"图不完整"，但成因可能在遍历深度、入队逻辑或版本选择；需沿依赖图定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只补一个包而漏掉其它传递路径；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-B2（B 类 · 变体 2）

**标题**：冲突依赖未被识别（需定位求解与冲突选择）

**任务描述**：
```
pilot-workspace/FORMAL-F05-B2 在两个顶层依赖对同一包提出互不兼容的约束时没有报告冲突。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-conflict.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = conflict_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：冲突未被报告，成因可能在约束收集（求解）或冲突选择策略两处；需探查两处逻辑才能定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只改其中一层而遗漏另一处；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-C1（C 类 · 变体 1）

**标题**：硬预算下的多包并行解析（每包内部保序）

**任务描述**：
```
pilot-workspace/FORMAL-F05-C1 需要在**总预算 6500 ms**内完成三个 package 的依赖解析，最终必须同时成立：
① work/ 下的三个包解析工具都必须真实执行完成，各自产出 out/<pkg>.txt 与 out/<pkg>.lock.json；
② 每次执行都会把 {pkg,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个包内部必须保持 package.json 中依赖的**声明顺序**（见 CONTRACT.md）；
④ 三个包的完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 各包 lockfile 必须完整覆盖其全部声明依赖；写出 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的包工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：6 条

**验证规则**：required = packages_done, timeline_ok, integration_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三包各自固定解析耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**每包内部必须保持声明顺序**、lockfile 必须完整。串行调度必然超预算（verify 直接拒绝），而包级并行 + 各自内部保序可同时满足预算与顺序/完整性约束 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-包-保序-完整性"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-C2（C 类 · 变体 2）

**标题**：硬预算下的多包解析 + 统一 lockfile 合并（每包保序）

**任务描述**：
```
pilot-workspace/FORMAL-F05-C2 需要在**总预算 6500 ms**内完成三个 package 的依赖解析与统一 lockfile 合并：
① work/ 下的三个包解析工具都必须真实执行完成，各自产出 out/<pkg>.txt 与 out/<pkg>.lock.json；
② 每次执行都会把 {pkg,start,end,token,order_ok} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个包内部必须保持依赖声明顺序；
④ 三包完成时间跨度不得超过总预算；
⑤ 产出 unified-lock.json（覆盖全部包的依赖）与 INTEGRATION.md（含一行以「集成」开头的结论）；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md 与 work/ 下的包工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：6 条

**验证规则**：required = packages_done, unified_ok, timeline_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：与 C1 同构但非复制：包集合/依赖声明顺序/耗时分布不同，且额外要求**统一 lockfile 合并**（必须覆盖全部包）。同样存在"硬预算 + 每包保序 + lockfile 完整性"的可机械验证约束，串行超预算而包级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-包-保序-合并"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-D1（D 类 · 变体 1）

**标题**：三个包图各自的缺陷 + 统一 lockfile 校验

**任务描述**：
```
pilot-workspace/FORMAL-F05-D1 下的三个包图 svc-a / svc-b / svc-c 都需要修好，
并且统一 lockfile 校验（check-unified.js）与该目录下的 node verify.js 也必须全部通过。
不得修改 check-a.js、check-b.js、check-c.js、check-unified.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, unified_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个包图各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一 lockfile 校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用包图互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-D2（D 类 · 变体 2）

**标题**：多阶段依赖修复：图修复 → 版本归一 → lockfile 重生成

**任务描述**：
```
pilot-workspace/FORMAL-F05-D2 需要交付三份产物：
① 修复后的依赖图 graph-fixed.json（含一行字段 "repaired": true）；
② 版本归一结果 versions-normalized.json（含字段 "normalized": true）；
③ 重新生成的 lockfile lockfile.final.json（含字段 "integrity"）；node verify.js 必须通过。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = graph_repaired, versions_normalized, lockfile_regenerated, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个阶段（图修复 → 版本归一 → lockfile 重生成）各有独立产物与验收字段，且最终 lockfile 依赖前两阶段结果 ⇒ 多阶段编排/并行结构由任务本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-E1（E 类 · 变体 1）

**标题**：legacy lockfile 冻结布局与新 resolver contract 冲突

**任务描述**：
```
pilot-workspace/FORMAL-F05-E1 的 lockfile.js 是一版**已上线**的实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/lockfile.json 与 consumer 均不得修改）。
CONTRACT-v2.md 的新要求必须成立；check.js 与 lockfile.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F05-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把既有实现当作新接口：lockfile.js 只能输出 deps，而新契约要求同时携带 integrity/resolution；lockfile.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口的装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F05-E2（E 类 · 变体 2）

**标题**：解析不可复现（两次 resolve 得到不同 lockfile）

**任务描述**：
```
pilot-workspace/FORMAL-F05-E2 的解析器在相同输入下会产出不同的 lockfile（可复现性缺陷）。
上一轮针对解析顺序做的调整记录在 resolution.log。
reproducibility.md 规定的前置契约必须成立；repro.js 与 resolver.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = determinism_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F05-E2/repro.js

**为什么这些 first_decision 属于 GT**：未修复态在相同输入下两次 resolve 产生不同 lockfile（真实预跑：canonical(l1) ≠ canonical(l2)，差异字段为 resolvedAt 的真实数值）；repro.js 与 resolver.js 冻结 ⇒ 只能在 lockfile 生成层重建确定性（去掉时间戳 + 依赖键规范排序）⇒ 属于计划层重规划（改变"如何生成可复现产物"的方案）而非局部修补，REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件或局部调参不收敛；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
