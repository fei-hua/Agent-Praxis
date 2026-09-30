# F02 族级审核包（10 个正式变体 · GT 待签署）

> 脚手架：CLI 参数解析 + 数据管线（与 F01 的单模块工具脚手架不同族）。
> 本族为 status: draft，`gt_signed_by`/`gt_signed_at` 留空；正式 manifest 门禁保持 fail-closed。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F02-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-D1 | D | 1 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-D2 | D | 2 | PARALLEL\|WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F02-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F02-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## FORMAL-F02-A1（A 类 · 变体 1）

**标题**：CLI 计数参数类型错误（单点修复）

**任务描述**：
```
pilot-workspace/FORMAL-F02-A1/cli.js 解析 --count 后返回的是字符串而不是数字。修正它，使 verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = cli_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件单点类型缺陷，症状即定位，直接修改即可 ⇒ DIRECT 是最小充分首决策。

**为什么其他候选不属于 GT**：EXPLORE/委派类/REPLAN 均超出必要（无未知范围、无可分解子任务、无失败前提）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-A2（A 类 · 变体 2）

**标题**：CLI 默认值违反 USAGE 约定（单模块修复）

**任务描述**：
```
pilot-workspace/FORMAL-F02-A2 的 cli.js 未满足 USAGE.md 中记录的默认值约定。修正 cli.js 使约定成立并让 verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = defaults_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：仍是单模块修复；但"正确默认值"记录在 USAGE.md 中，需要看一眼约定文件 ⇒ DIRECT 与 EXPLORE 都算最小充分。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-B1（B 类 · 变体 1）

**标题**：三段 CLI 管道丢弃末条记录的位置未知

**任务描述**：
```
pilot-workspace/FORMAL-F02-B1 的 run.js 输出条数少于输入（见 EXPECTED.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = pipeline_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：缺陷位置未给出且症状在管道末端；必须沿数据流探查三层才能定位 filter 的越界过滤 ⇒ EXPLORE 是最小充分。

**为什么其他候选不属于 GT**：DIRECT 会导致盲改；委派对 3 个小文件过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-B2（B 类 · 变体 2）

**标题**：输出金额小数位不一致的层级排查

**任务描述**：
```
pilot-workspace/FORMAL-F02-B2 的合计输出与明细之和不一致（见 REPORT.md）。请修复该问题，使 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = format_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：现象只给出合计差，缺陷可能在 total 或 format；需探查两层才能确认是 format 只保留 1 位小数 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 会先改错文件；委派过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-C1（C 类 · 变体 1）

**标题**：三件互不相关的 CLI 交付物

**任务描述**：
```
pilot-workspace/FORMAL-F02-C1 有三件互相独立的事：① 修 src/parse.js 的短选项解析；② 写 NOTES.md，至少 2 条以「结论」开头的要点；③ 修 config.json 的默认重试次数（应为 3）。三件都完成且 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = parse_fixed, notes_written, config_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三件交付物互不依赖（代码修复 / 文档 / 配置），可分解可并行 ⇒ 委派类为最小充分。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 串行化了可分解工作；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-C2（C 类 · 变体 2）

**标题**：两个独立 CLI 模块 + 一份汇总

**任务描述**：
```
pilot-workspace/FORMAL-F02-C2：① 修 src/left.js 使 verify-left.js 通过；② 修 src/right.js 使 verify-right.js 通过；③ 写 SUMMARY.md，含一行以「汇总」开头的结论。不得修改 verify*.js。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）
- protected_paths：3 条（含 verify.js）

**验证规则**：required = left_fixed, right_fixed, summary_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：两个模块互不依赖且各有独立验收脚本，再加一份汇总 ⇒ 天然可分解/可并行。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用可分解性；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-D1（D 类 · 变体 1）

**标题**：三个独立子包的同构修复（并行编排）

**任务描述**：
```
pilot-workspace/FORMAL-F02-D1 下 pkg1/pkg2/pkg3 各带独立缺陷与独立验收脚本（check1/2/3.js），三者互不共享文件。全部修好并让 node verify.js 通过。不得修改 check*.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）
- protected_paths：4 条（含 verify.js）

**验证规则**：required = pkg1_fixed, pkg2_fixed, pkg3_fixed, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三个子包文件不相交、各有独立验收脚本、工作量明显超过单点修复 ⇒ 正确动作是利用并行结构（PARALLEL/Workflow）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用结构；DELEGATE 单路不足以刻画三路并行（D 类等价集不含 DELEGATE）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-D2（D 类 · 变体 2）

**标题**：两份独立日志分析 + 合并结论

**任务描述**：
```
pilot-workspace/FORMAL-F02-D2：① 由 logs/a.log 生成 report-a.md（含一行以「A 结论」开头的结论）；② 由 logs/b.log 生成 report-b.md（含一行以「B 结论」开头的结论）；③ 写 SUMMARY.md，含一行以「合并」开头的结论。两份分析互不依赖。不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）
- protected_paths：1 条（含 verify.js）

**验证规则**：required = report_a_written, report_b_written, summary_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：两份分析输入/产物不同且无依赖，第三份是汇总 ⇒ 并行/编排是正确动作结构。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 串行化；DELEGATE 单路不足（D 类等价集）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-E1（E 类 · 变体 1）

**标题**：遗留接口被外部基线冻结：新格式要求必须走新路径而非改写旧契约

**任务描述**：
```
pilot-workspace/FORMAL-F02-E1 的 src/render.js 提供遗留接口 formatLegacy(n)，该接口的输出
已被外部消费方按 baseline-output.json 冻结回放。
SPEC.md 给出了新的输出要求；attempt-log.txt 记录了针对当前实现的一次实际执行结果。
check.js 与 src/render.js 都不得修改。请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：3 条（含 verify.js）

**验证规则**：required = exact_path_added, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F02-E1/check.js

**为什么这些 first_decision 属于 GT**：**既有路径已失败且继续原路径不再成立**：当前 index.js 把被外部基线冻结的 formatLegacy 直接当作 format 暴露，真实预跑（attempt-log.txt）显示新契约的精确性断言失败。继续走旧路径有两种走法且都被约束堵死：改 render.js 破坏 B（且该文件受保护）、放宽 check.js 违反 D。正解需要**重新组织实现路径**：保留冻结的遗留契约，另建精确实现并把两个契约分别从 index.js 导出（新契约 format + 旧契约 formatLegacy）。这属于计划层的重新规划，而非局部修补 ⇒ REPLAN 是最小充分首决策。

**为什么其他候选不属于 GT**：DIRECT 指向的正是受保护的 src/render.js（改它即破坏冻结契约）。EXPLORE 不成立：失败原因已由真实预跑日志给出，不存在范围未知。VERIFY 不成立：任务目标不是验证已有结果。委派类不成立：这是一条需要重新定实现路径的单线任务，没有可并行的独立子任务。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F02-E2（E 类 · 变体 2）

**标题**：失败管线：日志格式版本与配置/生成器三者不一致

**任务描述**：
```
pilot-workspace/FORMAL-F02-E2 的数据管线上一轮运行失败。
config.json、generator（gen.js）与当前输入 data/events.log 三者的状态记录在 pipeline.log。
config.schema.json 与 check.js 都不得修改（也不得削弱校验）；config.json 必须满足 config.schema.json。
请让 node verify.js 通过。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）
- protected_paths：4 条（含 verify.js）

**验证规则**：required = pipeline_consistent, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 未修复 exit=1 → 参考修复 exit=0；verifyTask 未修复 success=false → 参考修复 success=true（status=OK，CONFIG_ERROR=0）；交付前真实预跑 node pilot-workspace/FORMAL-F02-E2/check.js

**为什么这些 first_decision 属于 GT**：既有配置方案已运行且失败（真实预跑日志），三件产物不一致：config 指向不存在的文件、现存输入为 v1、生成器产出 v3、schema 只允许 {2,3}。只改路径后版本仍不一致；把版本改成 1 被 schema 拒绝。可行方向至少两条（重跑 gen.js→v3 / 用 migrate.js→v2）⇒ 需先判断方向再执行 ⇒ REPLAN 为最小充分。

**为什么其他候选不属于 GT**：DIRECT 会被版本一致性拒绝；EXPLORE 不成立（原因已记录）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## 签署落盘

`
status = frozen（10/10）
gt_signed_by = fei-hua
gt_signed_at = 2026-09-30T12:52:58Z
signed_version_hash = a401581439a02712afa5b1f2b8dc24554a118a7d25078f57981f79574c249a7a
frozen_version_hash = ff689acca75c09c75eb779e89d04bdf1c9a5221ba3f3b81405bd18823fb39451
frozen_projection_hash = a00870c8960bd04c340cf679661086041b8113e95fd82f49b6dbce6c21e6b06b
GT 内容漂移 = 0
`
