# F01 族级审核包（10 个正式变体 · GT 待签署）

> 本族任务由生成器起草（status: draft）。**签署只能由人工完成**：
> 签署前 `gt_signed_by`/`gt_signed_at` 留空，正式 manifest 门禁保持 fail-closed。
> 纪律：签署后 GT、期望第一步决策集合、验证规则**不得**因试跑结果调整；
> 若发现作者错误 ⇒ 该任务退回、修订版本重新签署、原版本留下 provenance。

| task_id | cat | var | expected_first_decisions | expected_delegation | 证据（未修复→参考修复） |
|---|---|---|---|---|---|
| FORMAL-F01-A1 | A | 1 | DIRECT | false | exit 1 → 0 ✓ |
| FORMAL-F01-A2 | A | 2 | DIRECT\|EXPLORE | false | exit 1 → 0 ✓ |
| FORMAL-F01-B1 | B | 1 | EXPLORE | false | exit 1 → 0 ✓ |
| FORMAL-F01-B2 | B | 2 | EXPLORE | false | exit 1 → 0 ✓ |
| FORMAL-F01-C1 | C | 1 | DELEGATE\|PARALLEL\|WORKFLOW | true | exit 1 → 0 ✓ |
| FORMAL-F01-C2 | C | 2 | DELEGATE\|PARALLEL\|WORKFLOW | true | exit 1 → 0 ✓ |
| FORMAL-F01-D1 | D | 1 | PARALLEL\|WORKFLOW | true | exit 1 → 0 ✓ |
| FORMAL-F01-D2 | D | 2 | PARALLEL\|WORKFLOW | true | exit 1 → 0 ✓ |
| FORMAL-F01-E1 | E | 1 | REPLAN | false | exit 1 → 0 ✓ |
| FORMAL-F01-E2 | E | 2 | REPLAN | false | exit 1 → 0 ✓ |

## FORMAL-F01-A1（A 类 · 变体 1）

**标题**：单文件数值工具的一处明显计算错误

**任务描述**：
```
pilot-workspace/FORMAL-F01-A1/src/math.js 的 sum/mean 计算错误。修正它，使 sum([1,2,3])===6、mean([2,4])===3。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：math_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：单文件、单处、症状即定位：缺陷在 sum 的累加符号，Agent 直接读该文件即可修好，无需探索或委派。

**为什么其他候选不属于 GT**：EXPLORE/DELEGATE/PARALLEL/WORKFLOW/VERIFY/REPLAN 都不是该任务的最小充分动作：没有未知区域需要搜索、没有可并行子任务、失败原因不含状态不一致。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-A2（A 类 · 变体 2）

**标题**：单模块两个函数的格式约定修复

**任务描述**：
```
pilot-workspace/FORMAL-F01-A2 的 src/format.js 未满足 usage.js 中记录的约定（连字符词需首字母大写）。修正 src/format.js 使约定成立。不得修改 verify.js。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：format_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：仍是单模块修复；但"正确格式"写在 usage.js 里，Agent 需要看一眼约定文件——因此 EXPLORE 与 DIRECT 都算最小充分动作。

**为什么其他候选不属于 GT**：DELEGATE/PARALLEL/WORKFLOW 超出必要（无独立子任务）；REPLAN 不适用（仓库状态自洽，只是实现不符约定）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-B1（B 类 · 变体 1）

**标题**：三段式数据管道的取值丢失定位

**任务描述**：
```
pilot-workspace/FORMAL-F01-B1 的 test.js 失败，但任务书不指出缺陷位于哪个阶段。定位并修复，使 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：pipeline_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：缺陷位置未给出，且症状（count 变少）出现在管道末端；必须先沿数据流探查才能定位（normalize 里多了一个 startsWith('a') 过滤），这正是 EXPLORE 的定义。

**为什么其他候选不属于 GT**：DIRECT 会导致盲改；DELEGATE/PARALLEL/WORKFLOW 对 3 个小文件属过度动作；REPLAN 不适用（无状态不一致）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-B2（B 类 · 变体 2）

**标题**：合计金额偏差的舍入位置排查

**任务描述**：
```
pilot-workspace/FORMAL-F01-B2 的合计与明细不一致（见 REPORT.md），需要先定位舍入发生在哪一层再修复。不得修改 verify.js。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：rounding_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：现象只给出"合计差 0.01"，缺陷可能在 calc 或 fmt；必须探查两层才能确认是 fmt 只保留 1 位小数（×10 而非 ×100），故 EXPLORE 是最小充分动作。

**为什么其他候选不属于 GT**：DIRECT 会先改错文件；委派类动作对两个小文件过度；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-C1（C 类 · 变体 1）

**标题**：三个互不相关的交付物（修复 + 文档 + 配置）

**任务描述**：
```
pilot-workspace/FORMAL-F01-C1 有三件互相独立的事：① 修 src/calc.js 的折扣计算错误；② 写 NOTES.md，至少 2 条以「结论」开头的要点；③ 修 config.json 的阈值（应为 100 而非 10）。三件都完成且 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）

**验证规则**：calc_fixed, notes_written, config_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：三件交付物彼此无依赖（代码修复、文档撰写、配置修正），可分解且可并行 ⇒ 委派/并行/workflow 都是最小充分动作。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 会把可分解工作串行化，未利用结构的可并行性；REPLAN 不适用（状态自洽）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-C2（C 类 · 变体 2）

**标题**：两个独立模块 + 一份汇总

**任务描述**：
```
pilot-workspace/FORMAL-F01-C2：① 修 src/left.js 使 verify-left.js 通过；② 修 src/right.js 使 verify-right.js 通过；③ 写 SUMMARY.md，含一行以「汇总」开头的结论。不得修改 verify-left.js / verify-right.js / verify.js。
```

**expected_first_decisions**：`[DELEGATE, PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）

**验证规则**：left_fixed, right_fixed, summary_written, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：两个模块互不依赖，各自有独立验收脚本，再加一份汇总 ⇒ 天然可分解/可并行。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用可分解性；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-D1（D 类 · 变体 1）

**标题**：三个独立子包的同构修复（需要并行编排）

**任务描述**：
```
pilot-workspace/FORMAL-F01-D1 下 pkg1/pkg2/pkg3 各自带一个独立缺陷与独立验收脚本（check1/2/3.js），三者互不共享文件。全部修好并让 node verify.js 通过。不得修改 check*.js 与 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）

**验证规则**：pkg1_fixed, pkg2_fixed, pkg3_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：三个子包文件完全不相交、各有独立验收脚本，且合计工作量明显超出单点修复 ⇒ 正确动作是利用并行结构（PARALLEL）或用 workflow 编排。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未利用结构；DELEGATE（单次委派）不足以刻画"三路并行"的必要性 ⇒ 按 Pilot 的 D 类等价集，DELEGATE 不算命中；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-D2（D 类 · 变体 2）

**标题**：两份独立数据集分析与一份合并结论

**任务描述**：
```
pilot-workspace/FORMAL-F01-D2：① 由 data/a.csv 生成 report-a.md（含一行以「A 结论」开头的结论）；② 由 data/b.csv 生成 report-b.md（含一行以「B 结论」开头的结论）；③ 写 SUMMARY.md，含一行以「合并」开头的结论。两份分析互不依赖。不得修改 verify.js。
```

**expected_first_decisions**：`[PARALLEL, WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = true）

**验证规则**：report_a_written, report_b_written, summary_written, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：两份分析输入不同、产物不同、彼此无依赖，第三份是两者的汇总 ⇒ 并行/编排是正确动作结构。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 串行化；DELEGATE 单路不足以覆盖两路并行（Pilot D 类等价集不含 DELEGATE）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-E1（E 类 · 变体 1）

**标题**：缺失被引用模块：需要重规划而非单点修复

**任务描述**：
```
pilot-workspace/FORMAL-F01-E1 的 src/index.js 引用了一个并不存在的模块 ./stats.js，其应有行为记录在 SPEC.md。请让 node verify.js 通过。不得修改 verify.js。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：module_created, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：当前状态是"执行前提不成立"：被引用模块根本不存在，原计划（改代码）无法直接续行，必须先重估计划——这正是 REPLAN 的定义（与 Pilot E01 的缺失 config.json 同类）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 不足以刻画"前提缺失需改计划"；委派类动作对单模块补写过度。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F01-E2（E 类 · 变体 2）

**标题**：配置指向不存在的路径：修复前提而非放宽校验

**任务描述**：
```
pilot-workspace/FORMAL-F01-E2 的 check.js 报错：config.json 指向的输入文件不存在。真实输入位于 data/input.txt。请让 node verify.js 通过；**不得**削弱或修改 check.js 的校验逻辑。不得修改 verify.js。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生值 = false）

**验证规则**：config_fixed, verify_pass（forbidden: verify_script_changed）

**验证证据**：未修复时 exit=1（应非 0）；参考修复后 exit=0（应为 0）⇒ 先失败后通过 ✓

**为什么这些 first_decision 属于 GT**：失败原因是前置配置与实际文件系统不一致（前提错误），正确动作是先重估前提并改配置，而不是继续按原计划改代码。

**为什么其他候选不属于 GT**：DIRECT 会倾向去改 check.js（被禁止）；EXPLORE 只描述"查看"，未刻画"前提需修正"；委派类动作过度。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`


## 门禁状态

```
本族任务文件：10 个（全部 status: draft）
已冻结：0（等待人工签署）
```
