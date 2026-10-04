# F03 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：HTTP 处理器 + 中间件链 + 契约/快照测试（与 F01 单模块工具、F02 CLI/管线不同族）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F03-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F03-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F03-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F03-A1（A 类 · 变体 1）

**标题**：单个处理器返回码错误（单点修复）

**任务描述**：
```
pilot-workspace/FORMAL-F03-A1/handlers/status.js 对未知路由返回了成功码。修正它，使 verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：1 条

**验证规则**：required = status_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单处、症状即定位（未知路由返回码），直接修改即可 ⇒ DIRECT 是最小充分首决策。

**为什么其他候选不属于 GT**：EXPLORE/委派/REPLAN 均无依据：无未知范围、无可分解子任务、无既有方案失败。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-A2（A 类 · 变体 2）

**标题**：中间件顺序违反架构文档约定（单文件修复）

**任务描述**：
```
pilot-workspace/FORMAL-F03-A2 的 chain.js 组装出的中间件顺序与 ARCHITECTURE.md 记录的约定不一致。修正 chain.js 使约定成立并让 verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：1 条

**验证规则**：required = chain_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：仍是单文件修复；但"正确顺序"记录在 ARCHITECTURE.md 中，需要查看该约定文件才能确认 ⇒ DIRECT 与 EXPLORE 都算最小充分。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现不符约定）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-B1（B 类 · 变体 1）

**标题**：响应字段在中间件链中丢失（位置未知）

**任务描述**：
```
pilot-workspace/FORMAL-F03-B1 的最终响应里 request_id 字段为空（见 EXPECTED.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：1 条

**验证规则**：required = enrich_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状（字段为空）出现在链末端，任务未给出缺陷所在中间件；需沿链逐段探查才能确认 enrich 覆盖了 request_id ⇒ EXPLORE 是最小充分。

**为什么其他候选不属于 GT**：DIRECT 会导致盲改；委派对 3 个小中间件过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-B2（B 类 · 变体 2）

**标题**：响应快照与序列化器不一致的层间排查

**任务描述**：
```
pilot-workspace/FORMAL-F03-B2 的响应快照与期望快照存在字段差异（见 REPORT.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：1 条

**验证规则**：required = serializer_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：现象只说"缺字段"，缺陷可能在 handler（未产出）或 serialize（白名单未含）；需探查两处才能定位 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 可能改错层；委派过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-C1（C 类 · 变体 1）

**标题**：硬时限下的多分支推进（总预算内完成三分支 + 集成）

**任务描述**：
```
pilot-workspace/FORMAL-F03-C1 需要在**总预算 6500 ms**内完成，最终必须同时成立：\n① work/ 下的三个分支工具都必须真实执行完成，各自产出 out/<branch>.txt；\n② 每次执行都会把 {branch,start,end,token} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；\n③ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；\n④ 写出 INTEGRATION.md，含一行以「集成」开头的结论；\n⑤ node verify.js 必须通过。不得修改 verify.js 与 work/ 下的分支工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = timeline_ok, artifacts_ok, integration_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：任务给出可机械验证的硬时限：三分支各有固定工具耗时（3.5s/3.5s/3.0s，合计约 10s），总预算 6500ms。顺序执行必然超预算（verify.js 直接拒绝：总耗时超预算），而分支同时推进可在预算内完成并进入集成。因此"直接顺序做完"在机械层面无法满足约束，拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行执行无法满足总预算约束（顺序 span≈10s > 6500ms）；并行执行可以满足；EXPLORE 未刻画"预算-分支"结构；REPLAN 不适用（任务状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-C2（C 类 · 变体 2）

**标题**：硬时限下的多分支推进（总预算内完成三分支 + 集成）

**任务描述**：
```
pilot-workspace/FORMAL-F03-C2 需要在**总预算 6500 ms**内完成，最终必须同时成立：\n① work/ 下的三个分支工具都必须真实执行完成，各自产出 out/<branch>.txt；\n② 每次执行都会把 {branch,start,end,token} 追加到 timeline.jsonl（由工具自身写入，不得手工构造）；\n③ 三分支的完成时间跨度（max(end) - min(start)）不得超过总预算；\n④ 写出 INTEGRATION.md，含一行以「集成」开头的结论；\n⑤ node verify.js 必须通过。不得修改 verify.js 与 work/ 下的分支工具。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：5 条

**验证规则**：required = timeline_ok, artifacts_ok, integration_ok, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：任务给出可机械验证的硬时限：三分支各有固定工具耗时（3.5s/3.5s/3.0s，合计约 10s），总预算 6500ms。顺序执行必然超预算（verify.js 直接拒绝：总耗时超预算），而分支同时推进可在预算内完成并进入集成。因此"直接顺序做完"在机械层面无法满足约束，拆解/并行/编排具有结构依据。

**为什么其他候选不属于 GT**：串行执行无法满足总预算约束（顺序 span≈10s > 6500ms）；并行执行可以满足；EXPLORE 未刻画"预算-分支"结构；REPLAN 不适用（任务状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-D1（D 类 · 变体 1）

**标题**：三个独立服务包的同构修复（并行编排）

**任务描述**：
```
pilot-workspace/FORMAL-F03-D1 的三个服务包 svc-auth / svc-rate / svc-audit 都需要修好：这些包各自的验收脚本与该目录下的 node verify.js 必须全部通过。不得修改验收脚本与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：4 条

**验证规则**：required = auth_fixed, rate_fixed, audit_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个服务包文件完全不相交、各有独立验收脚本、合计工作量明显超过单点修复 ⇒ 正确动作是并行/编排。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用结构；DELEGATE 单路不足以刻画三路并行（D 类等价集不含 DELEGATE）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-D2（D 类 · 变体 2）

**标题**：两份独立快照套件审计 + 合并结论

**任务描述**：
```
pilot-workspace/FORMAL-F03-D2 需要交付三份产物：
① 审计 fixtures/alpha/ 下的快照，生成 report-alpha.md（含一行以「Alpha 结论」开头的结论）；
② 审计 fixtures/beta/ 下的快照，生成 report-beta.md（含一行以「Beta 结论」开头的结论）；
③ 写 SUMMARY.md，含一行以「合并」开头的结论。
不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：1 条

**验证规则**：required = alpha_written, beta_written, summary_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：两份审计输入目录不同、产物不同、彼此无依赖，第三份为汇总 ⇒ 并行/编排是正确动作结构。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 会串行化；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-E1（E 类 · 变体 1）

**标题**：线上格式契约被冻结：新增字段必须走新路径而非改写旧序列化器

**任务描述**：
```
pilot-workspace/FORMAL-F03-E1 的 serialize.js 是一版**已上线**的响应序列化实现，
其字节级输出被 golden-snapshots.json 冻结（外部调用方按该文件回放）。
attempt-log.txt 记录了针对当前实现的一次实际执行结果。
SPEC.md 的新要求必须成立；check.js 与 serialize.js 都不得修改。
请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = v2_path_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F03-E1/check.js

**为什么这些 first_decision 属于 GT**：既有 v1 已被外部 golden 快照冻结且不得修改，而 index.js 现状把 v1 当作 v2 暴露 ⇒ 新要求失败（真实预跑记录）。继续原路径的两条走法都被约束堵死：改 serialize.js 破坏 B、放宽 check.js 违反 D。正解需要重新组织实现路径（新增 v2 序列化并让 index.js 同时导出 v1/v2），属计划层重规划 ⇒ REPLAN 为最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护的 serialize.js；EXPLORE 不成立（失败原因已记录）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F03-E2（E 类 · 变体 2）

**标题**：失败的重试方案：精确一次契约与重试策略冲突

**任务描述**：
```
pilot-workspace/FORMAL-F03-E2 的处理器管线在一次不稳定依赖下会重复产生副作用。
上一轮为重试参数做的调整记录在 pipeline.log。
exactly-once.md 规定的前置契约必须成立；contract.js 与 pipeline.js 都不得修改。
请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：3 条

**验证规则**：required = idempotency_path_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F03-E2/contract.js

**为什么这些 first_decision 属于 GT**：既有重试方案已实际失败（真实预跑：同一 request_id 的副作用发生多次），而 pipeline.js（含 retry）被契约冻结、contract.js 不得修改。继续在重试参数上做局部调整无法满足"精确一次"⇒ 必须重新判断方案（把幂等性放到新的层，而不是改被冻结的管线段）。存在可执行替代路径（新增幂等守卫并调整 app.js 装配）⇒ REPLAN 有构念依据且可满足。

**为什么其他候选不属于 GT**：DIRECT 指向受保护的 pipeline.js / 局部调参无法收敛；EXPLORE 不成立（失败原因已记录）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`
