# F06 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：权限策略 + 访问控制 + 决策合并（与 F01–F05 各族的领域均不同）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F06-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F06-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F06-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F06-A1（A 类 · 变体 1）

**标题**：资源匹配规则写反（应允许的请求被拒绝）

**任务描述**：
```
pilot-workspace/FORMAL-F06-A1 的评估器对 docs/* 资源的请求一律拒绝（期望允许）。
修正 evaluator.js 使 node verify.js 通过。不得修改 verify.js 与 check-allow.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：2 条

**验证规则**：required = match_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（evaluator.js 的资源匹配），目标明确 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-A2（A 类 · 变体 2）

**标题**：优先级覆盖顺序错误（约定写在 POLICY.md）

**任务描述**：
```
pilot-workspace/FORMAL-F06-A2 的最终决策与 POLICY.md 规定的优先级要求不一致。
修正后使 node verify.js 通过。不得修改 verify.js、check-precedence.js 与 POLICY.md。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = precedence_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（evaluator.js），但"priority 越大越优先 + deny-overrides + 必须给出命中 id"的判定依据写在 POLICY.md ⇒ 先查约定再改属合理探索，DIRECT 与 EXPLORE 并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与约定不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-B1（B 类 · 变体 1）

**标题**：继承链缺失一层（角色→权限→资源未展开）

**任务描述**：
```
pilot-workspace/FORMAL-F06-B1 的继承评估结果不完整（期望见 check-inherit.js）。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-inherit.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = inherit_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"继承结果不完整"，成因可能在用户→角色、角色→权限或权限→资源任一层；需沿继承链定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只补一层而漏掉另一处；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-B2（B 类 · 变体 2）

**标题**：allow/deny 冲突处理错误（deny-overrides 未生效）

**任务描述**：
```
pilot-workspace/FORMAL-F06-B2 在 allow 与 deny 同时命中时给出了错误的决策。
请修复该问题，使 node verify.js 通过。不得修改 verify.js 与 check-conflict.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = conflict_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：冲突未被正确处理，成因可能在匹配集合的构造（是否包含全部命中）或合并规则（是否按 deny-overrides）；需探查两处 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能只改合并而遗漏匹配层；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-C1（C 类 · 变体 1）

**标题**：硬预算下的多来源并行评估（优先级语义不得被破坏）

**任务描述**：
```
pilot-workspace/FORMAL-F06-C1 需要在**总预算 6500 ms**内完成三个策略来源的评估，最终必须同时成立：
① work/ 下的三个来源评估工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；
② 每次执行都会把 {src,start,end,token,order_ok,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个来源内部必须保持 priority 降序（见 CONTRACT.md）；
④ 三个来源的完成时间跨度（max(end) - min(start)）不得超过总预算；
⑤ 合并后的决策矩阵 matrix.json 必须与按 priority 规则归并的结果**语义等价**；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、evaluator.js 与 work/ 下的来源工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = sources_done, timeline_ok, precedence_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三来源各自固定评估耗时（3.5s/3.5s/3.0s，串行约 10s）与 6500ms 总预算，且**并行合并不得破坏 priority 语义**（matrix.json 必须与按 priority 规则归并的参考矩阵 canonical 相等）。串行调度必然超预算（verify 直接拒绝），而来源级并行 + 按 priority 合并可同时满足 ⇒ 拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画"预算-来源-优先级等价"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-C2（C 类 · 变体 2）

**标题**：硬预算下的多租户批量评估（对象内优先级不被打乱）

**任务描述**：
```
pilot-workspace/FORMAL-F06-C2 需要在**总预算 6500 ms**内完成三个租户策略集的批量评估与决策矩阵合并：
① work/ 下的三个评估工具都必须真实执行完成，各自产出 out/<src>.json 与 timeline.jsonl 记录；
② 每次执行都会把 {src,start,end,token,order_ok,count} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；
③ 每个租户内部必须保持 priority 降序；
④ 三来源完成时间跨度不得超过总预算；
⑤ 合并后的决策矩阵 matrix.json 必须与按 priority 规则归并的结果**语义等价**，且覆盖全部请求；写出 INTEGRATION.md；node verify.js 必须通过。
不得修改 verify.js、check-timeline.js、CONTRACT.md、evaluator.js 与 work/ 下的评估工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条

**验证规则**：required = sources_done, timeline_ok, matrix_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：与 C1 同构但非复制：租户集合/优先级分布/请求集合不同，且要求矩阵覆盖全部请求。同样存在"硬预算 + 对象内优先级保持 + 并行不得破坏优先级语义"的可机械验证约束，串行超预算而来源级并行可行 ⇒ 委派类成立。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束；EXPLORE 未刻画"预算-对象-优先级等价"结构；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-D1（D 类 · 变体 1）

**标题**：三套策略包各自的缺陷 + 统一授权报告校验

**任务描述**：
```
pilot-workspace/FORMAL-F06-D1 下的三套策略包 pkg-a / pkg-b / pkg-c 都需要修好，
并且统一授权报告校验（check-report.js）与该目录下的 node verify.js 也必须全部通过。
不得修改 check-a.js、check-b.js、check-c.js、check-report.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = a_fixed, b_fixed, c_fixed, report_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三套策略包各自有真实缺陷与独立验收脚本，且存在必须三者都正确才能通过的统一报告校验；该结构使并行/编排有实际收益 ⇒ 并行/编排成立。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用策略包互不共享的结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-D2（D 类 · 变体 2）

**标题**：多阶段策略修复：策略修复 → 优先级归一 → 审计重生成

**任务描述**：
```
pilot-workspace/FORMAL-F06-D2 需要交付三份产物：
① 修复后的策略集 policies-fixed.json（含字段 "repaired": true）；
② 优先级归一结果 precedence-normalized.json（含字段 "normalized": true）；
③ 重新生成的审计报告 audit-report.json（含字段 "decisions" 数组）；node verify.js 必须通过。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = policy_repaired, precedence_normalized, audit_regenerated, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个阶段（策略修复 → 优先级归一 → 审计重生成）各有独立产物与验收字段，且审计依赖前两阶段结果 ⇒ 多阶段编排/并行结构由任务本身给出（prompt 只陈述交付物）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段化产物结构；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-E1（E 类 · 变体 1）

**标题**：legacy ACL 冻结语义与新 RBAC 契约冲突

**任务描述**：
```
pilot-workspace/FORMAL-F06-E1 的 acl.js 是一版**已上线**的访问控制实现，其输出被 legacy/consumer.js 按字段逐项回放（legacy/acl.json 与 consumer 均不得修改）。
CONTRACT-rbac.md 的新要求必须成立；check.js 与 acl.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：6 条

**验证规则**：required = compat_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F06-E1/check.js

**为什么这些 first_decision 属于 GT**：现状把既有实现当作新接口：acl.js 只能输出 allowed，而新契约要求同时携带 role/reason；acl.js 与 legacy 消费方冻结、check.js 不得修改 ⇒ 局部改参无法满足，必须新增兼容路径并调整非保护入口装配（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F06-E2（E 类 · 变体 2）

**标题**：决策缓存失效错误（策略变更后仍返回旧决策）

**任务描述**：
```
pilot-workspace/FORMAL-F06-E2 的访问决策在策略被修改后仍然返回旧结果。
上一轮针对缓存做的调整记录在 cache.log。
cache-contract.md 规定的前置契约必须成立；stale.js 与 policy-store.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：4 条

**验证规则**：required = cache_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F06-E2/stale.js

**为什么这些 first_decision 属于 GT**：未修复态在策略内容变更后仍命中旧缓存（真实预跑：d2.decision=allow 而期望 deny，属业务结果差异）；stale.js 与 policy-store.js 冻结 ⇒ 必须把缓存键从 (policy_id) 改为 (policy_id, policy_version) 并调整评估器的取值路径（改变"如何生成与复用决策"的方案）⇒ 计划层重规划，REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件或仅清缓存不收敛（缓存清空不解决键语义）；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

---

## 审计备注（非阻断，人工裁定）

**priority equivalence 是最终语义约束，不是对执行顺序的要求。**

- 执行完成顺序 ≠ priority 顺序，本身**不构成错误**；
- 必须保证的是：最终 decision matrix 的规范形式等于由**固定 priority 规则**独立生成的 M_priority；
- 因此 C1/C2 的判定为 canonical(M_parallel) == canonical(M_priority)，而不是"并行必须严格按 priority 顺序完成"。
