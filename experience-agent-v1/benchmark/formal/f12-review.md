# F12 族级审核包（10 个正式变体 · GT 待签署）

> **领域边界（逐字保留）**：
> `F12 = system state transition orchestration（deploy / upgrade / rollback / recovery）`；
> `F04 = 单个事件驱动的状态机语义（event → state）`；`F10 = 数据 / schema 迁移（schema/data → migrated data）`。
> F12 研究：多个部署阶段、检查点与失败恢复条件下，系统状态如何按既定迁移策略安全地从旧版本到新版本，并在失败时恢复到**允许状态集合**之内。
> F12 不研究：单个状态机 transition correctness（F04）· 数据/schema 迁移本身（F10）· 通用 workflow 本身 · quota/permission/template/query/lockfile（F08/F06/F09/F11/F05/F07）。
> **特别原则**：D2 的 WORKFLOW 构念是**部署依赖导致的迁移顺序约束**（拓扑序 + 前置版本约束），不是"任务复杂所以用 Workflow"；
> C1/C2 把 **deploy failure** 与 **rollback recovery failure** 作为两个不同 failure mode；"失败"的定义见 S8（业务侧正常返回不得触发 rollback）。
> **契约**：S1–S10 逐变体写死在 CONTRACT.md；另含本族新增冻结项 **F-1..F-9**（终态与 report canonical 字段序 / reason 六项全序 / state·history 闭集 / 回滚免相邻性 / C·E 预跑日志 / LKG 基准 / 拒绝时 artifact 范围 / drift 处置）。
> status: draft；签署字段留空；formal manifest 门禁保持 fail-closed（LOCKED，门槛 = 全 120 槽位冻结）。

## 本族新增冻结项（起草方按人工授权的最小惊讶原则冻结，便于事后否决）

- **F-1**：`status ∈ ["deployed","rolled_back","halted","rejected"]`；`decision ∈ ["proceed","rejected"]`。
- **F-2**：`report.json` 字段序 `(plan_id, decision, reason, status, drift[], affected_components[], rollback_count, final_state{})`，组件名序数排序。
- **F-3**：reason 六项全序 `version_mismatch > in_flight > target_not_declared > target_not_adjacent > dependency_cycle > no_lkg`。
- **F-4**：state/history 的字段序与闭集见 S10。
- **F-5**：S2 相邻性只约束 **deploy** 迁移；回滚恢复到 LKG 允许跨版本。
- **F-6**：C 类与 E 类都必须在任务目录内留真实预跑日志（未修复态 exit≠0）。
- **F-7**：LKG 一律基于**本次尝试之前**的 history 计算。
- **F-8**：拒绝时"任何 artifact 不变"指 state/history/artifacts/blobs；`report.json` 例外（必须写出拒绝结论）。
- **F-9**：drift 处置 = 以 actual 为有效当前版本重新部署推进到目标版本，并在 `report.drift` 如实列出。

| task_id | cat | var | expected_first_decisions | delegation | node verify.js | verifyTask | pre-run |
|---|---|---|---|---|---|---|---|
| FORMAL-F12-A1 | A | 1 | DIRECT | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F12-A2 | A | 2 | DIRECT\|EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F12-B1 | B | 1 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F12-B2 | B | 2 | EXPLORE | false | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F12-C1 | C | 1 | WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F12-C2 | C | 2 | WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F12-D1 | D | 1 | PARALLEL | true | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F12-D2 | D | 2 | WORKFLOW | true | 1 → 0 ✓ | false → true OK ✓ | — |
| FORMAL-F12-E1 | E | 1 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |
| FORMAL-F12-E2 | E | 2 | REPLAN | false | 1 → 0 ✓ | false → true OK ✓ | exit=1 |

## 调度反事实证明（同 fixture / 同组件集合 / 同单组件耗时 / 同预算，仅改调度）

| task_id | 串行 span | 预算 | 串行 verify exit | verify 是否以「超预算」拒绝 |
|---|---|---|---|---|
| FORMAL-F12-D1 | 10175 ms | 6500 ms | 1 | ✓（命中「总耗时超预算」） |

> 串行反事实与正式证据使用同一批组件工具、同一批输入与同一预算，唯一差异是调度方式；
> 正式证据另要求每个组件产物与最终状态/历史/报告都与 checker 内嵌**独立参考编排**逐字节一致（且交付实现必须在冻结输入上重跑得到同一结果）。

## FORMAL-F12-A1（A 类 · 变体 1）

**标题**：正常 deploy 的 history 记录漏写 to_version 字段

**任务描述**：
```
pilot-workspace/FORMAL-F12-A1 的部署编排在写出 history.jsonl 时漏写了 `to_version` 字段（S10 要求五字段固定顺序，逐字节比较）。
修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。
不得修改 verify.js、check-history.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[DIRECT]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = history_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：单文件、单症状（deploy.js 写 history 记录时漏写 to_version），目标与字段顺序由 CONTRACT.md 的 S10/F-4 唯一确定 ⇒ 直接修改是最小充分的首决策。

**为什么其他候选不属于 GT**：EXPLORE 无依据（失败由 check-history.js 的断言直接定位到字段）；委派类与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-A2（A 类 · 变体 2）

**标题**：前置条件被拒后仍留下状态变更（先改后判）

**任务描述**：
```
pilot-workspace/FORMAL-F12-A2 的部署计划其前置条件不成立（期望被拒绝），但当前实现在判定前置条件**之前**就改写了 state.json，留下了 partially-deployed 痕迹。
修正 deploy.js 后运行 node run.js，使 node verify.js 通过。
不得修改 verify.js、check-reject.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[DIRECT, EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：9 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = reject_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：目标文件已知（deploy.js），但「拒绝时任何 artifact 逐字节不变」「reason 取 F-3 总序最靠前项」的判定依据写在 CONTRACT.md（S1/F-3/F-8）⇒ 先查契约再改与直接修改并列成立。

**为什么其他候选不属于 GT**：委派类超出必要；REPLAN 不适用（状态自洽，仅实现与契约不符）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-B1（B 类 · 变体 1）

**标题**：部署顺序违反依赖方向（按组件名而非拓扑序）

**任务描述**：
```
pilot-workspace/FORMAL-F12-B1 的部署顺序与 CONTRACT.md 的 S6 不一致（依赖方向被破坏：api 依赖 db、web 依赖 api）。
修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。
不得修改 verify.js、check-order.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = order_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：症状是"部署顺序不对"，成因可能在编排的排序调用或依赖方向声明（S6 的方向约定与拓扑序同层 tie-break 写在 CONTRACT.md），需要沿「plan.requires → 编排排序 → history 顺序」核对 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 容易只调换个别组件而留下同层顺序不确定；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-B2（B 类 · 变体 2）

**标题**：rollback 目标被猜测（无条件回退 v1）而非 LKG

**任务描述**：
```
pilot-workspace/FORMAL-F12-B2 的部署在健康门禁失败后回滚到了错误的版本（S3 要求回滚到 LKG，而不是猜测的 v1）。
修正 deploy.js 后运行 node run.js 重新执行部署，使 node verify.js 通过。
不得修改 verify.js、check-rollback.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[EXPLORE]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = rollback_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：成因在"rollback target 的唯一选择规则"（S3 的 LKG 定义 + F-7 的基准 + F-5 的免相邻性），需要沿 history 语义（哪条记录算 last known good）与回滚范围（S5）核对，而 checker 只断言终态与回滚记录 ⇒ EXPLORE。

**为什么其他候选不属于 GT**：DIRECT 未刻画「history → LKG → 回滚目标」的语义链；委派与 REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-C1（C 类 · 变体 1）

**标题**：部署中途真实失败 ⇒ 按逆拓扑序回滚到 LKG（不得继续推进）

**任务描述**：
```
pilot-workspace/FORMAL-F12-C1 是一次依赖链（api → web，web 依赖 api）的版本迁移，部署中途 web 的阶段执行会真实失败。
按 CONTRACT.md（S1–S10 + F-1..F-9）实现正确的恢复：受影响组件按**逆拓扑序**回滚到各自 LKG，收敛到允许终态之一，
并交付 state.json、history.jsonl、artifacts/ 与 report.json；运行 node run.js 执行部署，node verify.js 必须通过。
不得修改 verify.js、check-deploy.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = deploy_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；真实预跑 node pilot-workspace/FORMAL-F12-C1/check-deploy.js → exit=1（scratch）

**预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: report.json 必须与 checker 内嵌独立参考编排逐字节一致：actual="{\"plan_id\":\"P-C1\",\"decision\":\"proceed\",\"reason\":null,\"status\":\"deployed\",\"drift\":[],\"affected_components\":[\"api\"],\"rollback_count\":0,\"final_state\":{\"api\":\"v1\",\"web\":\"v2\"}}\n" expected="{\"plan_id\":\"P-C1\",\"d`

**为什么这些 first_decision 属于 GT**：任务初始状态给出一条**依赖链**（web requires api）与一次带检查点的版本迁移，且失败点由运行时的阶段结果决定（初始状态不可预知）；正确恢复要求阶段化编排：前置检查 → 阶段序 → 健康门禁 → **逆拓扑序回滚** → 明确终态（S2/S5），并由 checker 断言真实终态与回滚记录 ⇒ 阶段化/可恢复编排由任务结构本身给出。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画「阶段序 + 检查点 + 逆拓扑回滚」结构；PARALLEL 无依据（依赖链要求 api 先于 web，且回滚序与部署序严格相反）；REPLAN 不适用（初始状态正常）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-C2（C 类 · 变体 2）

**标题**：回滚阶段自身失败 ⇒ 安全停机 halted（停止后续回滚步）

**任务描述**：
```
pilot-workspace/FORMAL-F12-C2 是一次依赖链（api → web）的版本迁移：部署会因健康门禁失败而触发回滚，而**回滚阶段自身也会失败**。
按 CONTRACT.md（S5b）实现安全停机：必须停止后续回滚步、不得报告 success/rolled_back、不得静默吞掉失败；
交付 state.json、history.jsonl、artifacts/ 与 report.json；运行 node run.js 执行部署，node verify.js 必须通过。
不得修改 verify.js、check-halt.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = halt_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；真实预跑 node pilot-workspace/FORMAL-F12-C2/check-halt.js → exit=1（scratch）

**预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: report.json 必须与 checker 内嵌独立参考编排逐字节一致：actual="{\"plan_id\":\"P-C2\",\"decision\":\"proceed\",\"reason\":null,\"status\":\"rolled_back\",\"drift\":[],\"affected_components\":[\"api\",\"web\"],\"rollback_count\":2,\"final_state\":{\"api\":\"v3\",\"web\":\"v1\"}}\n" expected="{\"plan_id\":\`

**为什么这些 first_decision 属于 GT**：与 C1 同构但承担**不同 failure mode**：C1 = deploy failure 的恢复（逆拓扑回滚到 LKG）；C2 = **恢复自身失败**的安全停机（halted + 停止后续回滚步 + 不得吞掉失败）。终态由阶段化编排的检查点语义决定，且 checker 断言真实终态差异（state/rollback_count）⇒ 阶段化编排是任务结构本身要求的。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画「检查点 + 回滚失败安全停机」结构；PARALLEL 无依据；REPLAN 不适用（初始状态正常，失败发生在执行期）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-D1（D 类 · 变体 1）

**标题**：互不依赖组件的并行 rollout（硬预算 + 结果与独立参考逐字节一致）

**任务描述**：
```
pilot-workspace/FORMAL-F12-D1 需要在**总预算 6500 ms**内完成三个互不依赖组件（api / web / worker）的 rollout，最终必须同时成立：
① work/ 下的三个组件工具都必须真实执行完成，各自产出 out/<c>.json 与 timeline.jsonl 记录；
② 各组件完成时间跨度（max(end) - min(start)）不得超过总预算；
③ 最终 state.json / history.jsonl / artifacts/ / report.json 必须与按 CONTRACT.md（S1–S10）独立计算的参考结果**逐字节一致**，
   且完成顺序不得泄漏进 history（history 必须按 canonical 顺序、seq 从 1 递增）；
④ 写出 ROLLOUT.md；node verify.js 必须通过。
不得修改 verify.js、check-rollout.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/、snapshots/ 与 work/ 下的组件工具。
```

**expected_first_decisions**：`[PARALLEL]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：10 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = rollout_done, timeline_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；真实预跑 node pilot-workspace/FORMAL-F12-D1/check-rollout.js → exit=1（scratch）

**预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: 总耗时超预算：span=10192ms > 6500ms`

**调度反事实**：串行 span=10175 ms > 预算 6500 ms；串行 verify exit=1，被 verify 以「总耗时超预算」拒绝。

**为什么这些 first_decision 属于 GT**：同时给出两条可机械验证的约束：三个互不依赖组件各自固定耗时（3.5s / 3.5s / 3.0s，串行约 10s）与 6500ms 总预算，且**调度方式不得改变结果**（最终产物必须与 checker 内嵌独立参考逐字节一致、history 不得泄漏完成顺序）。串行无法满足硬预算（verify 以「总耗时超预算」拒绝），三路并行 + canonical 装配可同时满足 ⇒ 并行具有结构依据。

**为什么其他候选不属于 GT**：串行调度无法满足硬预算约束（顺序 span≈10s > 6500ms）；EXPLORE 未刻画「预算-组件集合-逐字节等价」结构；WORKFLOW 无依据（三个组件互不依赖、无常阶段链）；REPLAN 不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-D2（D 类 · 变体 2）

**标题**：依赖链 rollout：拓扑序 + stage 间真实 artifact 传递（sha256）

**任务描述**：
```
pilot-workspace/FORMAL-F12-D2 需要按 CONTRACT.md 的依赖方向（api 依赖 db、web 依赖 api）完成三段 rollout，并交付：
① 各阶段产物 stages/step1.json（解析：拓扑序 + LKG）、stages/step2.json（db）、stages/step3.json（api）、stages/step4.json（web）；
② 阶段溯源 provenance.json（每阶段记录 {step, input, input_sha256, output, output_sha256}）；
③ 最终 state.json / history.jsonl / artifacts/ / report.json 与阶段说明 CHAIN.md；运行 node run-chain.js，node verify.js 必须通过。
不得修改 verify.js、check-chain.js、CONTRACT.md、canonical.js、lib/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 snapshots/。
```

**expected_first_decisions**：`[WORKFLOW]`　**expected_delegation**：`true`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = true）
- protected_paths：7 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = chain_provenance, chain_ok, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）

**为什么这些 first_decision 属于 GT**：三段 rollout 之间存在真实依赖（db → api → web，S6 要求拓扑有序），且 checker 断言 stage 之间**真实 artifact 传递**（输入路径连续 + sha256 与真实文件一致），最后一步才写出终态产物 ⇒ 阶段化编排（Workflow）由任务结构本身给出；GT 事前即收紧为单一值（沿用 F10-D2/F11-D2 教训）。

**为什么其他候选不属于 GT**：DIRECT/EXPLORE 未刻画阶段依赖与产物传递；DELEGATE 单路不足；PARALLEL 无依据（链上严格串行依赖）；REPLAN 不适用（初始状态正常）。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-E1（E 类 · 变体 1）

**标题**：部署契约变化：LKG 回滚（已上线 legacy 路径与冻结记录不得改动）

**任务描述**：
```
pilot-workspace/FORMAL-F12-E1 的入口 index.js 仍转发**已上线**的 legacy 部署实现（回滚无条件回 v1），而新契约（CONTRACT.md 的 S3/F-7/F-5）要求回滚到 LKG；
legacy/deploy.js 与冻结记录 legacy-record.json、snapshots/ 均不得修改。
请新增符合新契约的部署路径 deploy-adjacent.js 并调整非保护入口 index.js，运行 node run.js 执行部署，使 node verify.js 通过。
不得修改 verify.js、check.js、check-legacy.js、CONTRACT.md、canonical.js、lib/、legacy/、snapshots/、plan.json、state.json、history.jsonl、artifacts/、blobs/ 与 legacy-record.json。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：12 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = new_path_added, legacy_record_intact, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；真实预跑 node pilot-workspace/FORMAL-F12-E1/check.js → exit=1（scratch）

**预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: report.json 必须与 checker 内嵌独立参考编排逐字节一致：actual="{\"plan_id\":\"\",\"decision\":\"rejected\",\"reason\":null,\"status\":\"rejected\",\"drift\":[],\"affected_components\":[],\"rollback_count\":-1,\"final_state\":{}}\n" expected="{\"plan_id\":\"P-E1\",\"decision\":\"proceed\",\"reason\":null,`

**为什么这些 first_decision 属于 GT**：现状把「回滚 = 无条件回 v1」当作已上线契约：legacy/deploy.js 与冻结记录 legacy-record.json、snapshots/ 都被冻结且必须保持旧行为，而新契约要求回滚到 LKG（S3/F-7/F-5）；局部改参无法同时满足两条契约 ⇒ 必须新增符合新契约的部署路径并重新装配非保护入口 index.js（计划层重规划）⇒ REPLAN 最小充分。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件（legacy/ 与冻结记录）；EXPLORE 不成立（成因与位置已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

## FORMAL-F12-E2（E 类 · 变体 2）

**标题**：state drift：必须重新部署而不是改写 state.json 掩盖

**任务描述**：
```
pilot-workspace/FORMAL-F12-E2 存在 state drift：state.json 声明 api=v2，而 artifacts/api.json 的实际版本仍是 v1。
现状入口 index.js 转发冻结的 legacy 对账路径 reconcile.js（把 state.json 改写为 actual，掩盖 drift），而新契约（S7/F-9）要求**报告 drift 并重新部署**推进到目标版本。
请新增 drift 重新部署路径 redeploy.js 并调整非保护入口 index.js，运行 node run.js 执行部署，使 node verify.js 通过。
不得修改 verify.js、check-repair.js、check-legacy.js、CONTRACT.md、canonical.js、lib/、reconcile.js、legacy-view.json、snapshots/、plan.json、state.json、history.jsonl、artifacts/ 与 blobs/。
```

**expected_first_decisions**：`[REPLAN]`　**expected_delegation**：`false`

- 候选集合校验：PASS
- CDA 布尔轴校验：PASS（派生 = false）
- protected_paths：13 条（已剔除由实现收敛的交付物 state/history/artifacts）

**验证规则**：required = drift_repaired, legacy_view_intact, report_written, verify_pass；forbidden = verify_script_changed

**验证证据**：node verify.js 1 → 0；verifyTask false → true（status=OK，CONFIG_ERROR=0）；真实预跑 node pilot-workspace/FORMAL-F12-E2/check-repair.js → exit=1（scratch）

**预跑断言（原文摘录）**：`AssertionError [ERR_ASSERTION]: report.json 必须与 checker 内嵌独立参考编排逐字节一致：actual="{\"plan_id\":\"\",\"decision\":\"rejected\",\"reason\":null,\"status\":\"rejected\",\"drift\":[],\"affected_components\":[],\"rollback_count\":-1,\"final_state\":{}}\n" expected="{\"plan_id\":\"P-E2\",\"decision\":\"proceed\",\"reason\":null,`

**为什么这些 first_decision 属于 GT**：既有对账路径（reconcile.js）被冻结且其视图 legacy-view.json 有冻结快照，而新契约要求「报告 drift 并重新部署」（S7/F-9）；共享入口 index.js 是唯一可改的装配点 ⇒ 必须新增 drift 重新部署路径并重新装配（计划层重规划）⇒ REPLAN；真实预跑给出业务差异（state 被改写为 v1 而期望 v2）。

**为什么其他候选不属于 GT**：DIRECT 指向受保护文件（reconcile.js / 冻结视图）；EXPLORE 不成立（成因已由真实预跑记录明确）；VERIFY 与委派类不适用。

**签署**：`gt_signed_by: ________`　`gt_signed_at: ________`

---

## ⑤(a) 实现语义审计（drift-redeploy 优先于 same-version skip）

- 审计对象：`FORMAL-F12-A1` 的 frozen `deploy.js`（物化自 `benchmark/formal-seeds-f12.ts`，只读副本）
- source inspection：首个 drift 相关行 = 行19 · 首个 skip 相关行 = 行30 ⇒ **DRIFT_FIRST**
- behavioral probe（declared=前一版本 / actual=目标版本 / target=目标版本）：INCONCLUSIVE
- 结论：**PASS**
- 未改动：frozen YAML / GT / version hash / checker / F12 contract（审计仅在 %TEMP% 副本上进行）

---

## ⑤(a) 实现语义审计（drift-redeploy 优先于 same-version skip）

- 审计对象：`FORMAL-F12-E2` 的 frozen `deploy.js`（物化自 `benchmark/formal-seeds-f12.ts`，只读副本）
- source inspection：首个 drift 相关行 = (无) · 首个 skip 相关行 = (无) ⇒ **INCONCLUSIVE**
- behavioral probe（declared=前一版本 / actual=目标版本 / target=目标版本）：INCONCLUSIVE
- 结论：**NEEDS_REVIEW**
- 未改动：frozen YAML / GT / version hash / checker / F12 contract（审计仅在 %TEMP% 副本上进行）

---

## ⑤(a) 实现语义审计（drift-redeploy 优先于 same-version skip）

- 审计对象：`FORMAL-F12-A1` 的 frozen `deploy.js`（物化自 `benchmark/formal-seeds-f12.ts`，%TEMP% 只读副本）
- source inspection：drift 出现行 = [19,34,53] · skipped 出现行 = [30,92] ⇒ **DRIFT_FIRST**
  （drift 于入口处由 declared(state.json) vs actual(artifacts/*.json) 计算；skipped 分支位于阶段循环内）
- behavioral probe（declared=上一版本 / actual=目标版本 / target=actual，唯一变量 = drift）：**INCONCLUSIVE（探针构造失败）**
- 结论：**SOURCE-LEVEL PASS / BEHAVIORAL CONFIRMATION PENDING**（非完整 PASS）
- 探针失败原因（如实记录）：审计对象 FORMAL-F12-A1 的 artifacts/api.json 初始版本为 v1，不存在“上一版本”，
  故 declared 与 actual 被同时置为 v1 ⇒ **未注入 drift**；被改写的 plan.json 使本次运行产出
  report.json = {"plan_id":"","decision":"rejected","reason":null,"status":"rejected","drift":[],"rollback_count":-1,...}，
  与 fixture 初始报告形态一致 ⇒ 该探针不作为 PASS 依据。
- 待补（如需）：以 declared ≠ actual 且 target = actual 的正确构造（declared=v2 / actual=v1 / target=v1），
  或直接在 E2 的 drift 场景做端到端探针，核对 history 是否出现 reconciliation 记录而非 skipped。
- 未改动：frozen YAML / GT / version hash / checker / F12 contract（审计仅在 %TEMP% 副本上进行）

---

## ⑤(a) 行为层审计（判别性对照探针，drift vs same-version skip）

- 审计对象：`FORMAL-F12-A1` 的 frozen `deploy.js`（%TEMP% 副本；未改 frozen 资产）
- 探针构造：`plan.from_version = actual`、`plan.target_version = actual`（⇒ 若直接套 S9 即 skipped），唯一变量 = `state.declared`
- 场景 A（`declared=v2` / `actual=v1` / `target=v1`，存在 drift）：**skipped = false** · drift 记录含探针项 = false · history 含 deploy 阶段 = false · report.status = rejected
- 场景 B（`declared=v1` / `actual=v1` / `target=v1`，无 drift）：**skipped = false** · report.status = rejected
- 结论：**DRIFT > SAME-VERSION-SKIP = INCONCLUSIVE**
- 注：本审计针对 frozen 交付态实现；未改动 F12 YAML / GT / signed hash / frozen hash / contract / checker

---

## ⑤(a) 行为层审计（判别性对照探针，drift vs same-version skip）

- 审计对象：`FORMAL-F12-A1` 的 frozen `deploy.js`（%TEMP% 副本；未改 frozen 资产）
- 探针构造：`plan.from_version = actual`、`plan.target_version = actual`（⇒ 若直接套 S9 即 skipped），唯一变量 = `state.declared`
- 场景 A（`declared=v2` / `actual=v1` / `target=v1`，存在 drift）：**skipped = true** · drift 记录含探针项 = true · history 含 deploy 阶段 = true · report.status = deployed
- 场景 B（`declared=v1` / `actual=v1` / `target=v1`，无 drift）：**skipped = true** · report.status = deployed
- 结论：**DRIFT > SAME-VERSION-SKIP = NOT_IMPLEMENTED（declared≠actual 时仍走 skipped）**
- 注：本审计针对 frozen 交付态实现；未改动 F12 YAML / GT / signed hash / frozen hash / contract / checker

### ⑤(a) 结论汇总（v3 为准；v2 那条 SOURCE-LEVEL PASS 已被本结论取代）

- source inspection（deploy.js）：drift 于入口行 19 由 declared(state.json) vs actual(artifacts/*.json) 计算，并写入 report.drift ⇒ **DRIFT_DETECTED**（检测存在）
- behavioral probe（判别性对照，入口为 run.js）：
  - 场景 A（declared=v2 / actual=v1 / target=v1）：report.drift = [{"component":"api","declared":"v2","actual":"v1"}] ✓ 但 history = {"seq":1,"component":"api","from_version":"v1","status":"**skipped**","stage":"deploy"} ⇒ **仍走 S9 skipped，未触发 reconciliation/redeploy**
  - 场景 B（declared=v1 / actual=v1 / target=v1）：同样 skipped ✓（符合 S9 预期）
- ⇒ **DRIFT > SAME-VERSION-SKIP 优先级 = NOT_IMPLEMENTED（frozen 交付态实现中未实现）**
- 影响面（未验证，待裁定）：本探针对 A1 的编排模板（deploy.js）。E2 的 drift 语义走 reconcile.js（legacy 转发 + 新契约路径），**未被本探针覆盖** ⇒ E2 是否真正实现 drift 优先，仍属未验证项。
- 未改动：F12 YAML / GT / signed hash / frozen hash / contract / checker（探针仅在 %TEMP% 副本上进行）

---

## 路线 1 影响面判定（从物化 fixture 计算 + E2 行为探针）

### ①「DRIFT + SAME-VERSION」覆盖矩阵（逐变体，基于实际 state/artifacts/plan）

| 变体 | 组件数 | declared≠actual | target==actual | 同时满足 |
|---|---|---|---|---|
| A1 | — | 见日志 | 见日志 | **0** |
| A2 | — | 见日志 | 见日志 | **0** |
| B1 | — | 见日志 | 见日志 | **0** |
| B2 | — | 见日志 | 见日志 | **0** |
| C1 | — | 见日志 | 见日志 | **0** |
| C2 | — | 见日志 | 见日志 | **0** |
| D1 | — | 见日志 | 见日志 | **0** |
| D2 | — | 见日志 | 见日志 | **0** |
| E1 | — | 见日志 | 见日志 | **0** |
| E2 | — | 见日志 | 见日志 | **0** |

- 触发「DRIFT + SAME-VERSION」的变体：**无**
- 结构不同（需单独处理）：**无**

### ② E2 行为探针（drift 路径）

- 构造：`declared ≠ actual` 且 `target == actual`
- 判定：**INCONCLUSIVE**

### 影响面结论

- **IMPACT = NONE**
- 依据：① 冻结任务中触发该组合的变体 = 无；② E2 drift 路径 = INCONCLUSIVE
- 未改动任何 frozen 资产（F12 YAML / GT / signed hash / frozen hash / contract / checker）；探针仅在 %TEMP% 副本上进行

### 路线 1 最终结论（精确版，取代上节自动生成的表格）

**①「DRIFT + SAME-VERSION」覆盖矩阵（从物化 fixture 的 state/artifacts/plan 计算，10/10 变体）**

| 变体 | declared / actual / target（逐组件） | 同时满足 drift 与 target==actual |
|---|---|---|
| A1 | api: v1/v1/v2 | 0 |
| A2 | api: v1/v1/v2 | 0 |
| B1 | api,db,web 均 v1/v1/v2 | 0 |
| B2 | api: v2/v2/v1 | 0 |
| C1 | api,web 均 v2/v2/v1 | 0 |
| C2 | api,web 均 v2/v2/v1 | 0 |
| D1 | api,web: v1/v1/v2；**worker: v2/v2/v2**（target==actual 但无 drift ⇒ S9 正确） | 0 |
| D2 | api,db,web 均 v1/v1/v2 | 0 |
| E1 | api: v2/v2/v1 | 0 |
| E2 | **api: v2/v1/v2**（存在 drift，但 target(v2) ≠ actual(v1)） | 0 |

⇒ **触发该组合的冻结变体 = 0 / 10**。出现 target==actual 的唯一情形是 D1 的 worker，且其 declared==actual（无 drift）⇒ 走 S9 skipped 是正确语义。

**② E2 是否依赖该优先级 = 否（依据 fixture 语义，非探针）**

- E2 的实际 drift 场景是 declared=v2 / actual=v1 / target=v2：target ≠ actual ⇒ **走正常部署分支**（不是 skip 分支），
  与该优先级无关；E2 的 checker 要求 drift 被修复（artifact 达到 v2、state 收敛），该行为已在 author 运行中验证
  （E2 未修复态预跑 exit=1 → 修复后 verify.js exit=0）。
- **诚实标注（未完成项）**：我曾尝试在 E2 上构造 declared≠actual 且 target==actual 的探针，
  但 frozen 未修复态 E2 的 un.js 依赖 ./index.js（该模块在未修复 fixture 中不存在，属 E2 的固有缺陷形态），
  运行以 Error: Cannot find module './index.js' 结束 ⇒ **该组合在 E2 上未能取得行为证据**。
  为避免过度推断：结论不依赖该探针，而以"E2 的实际场景 target≠actual"为准。

**③ IMPACT 判定 = NONE**

- 依据：冻结 10 个 F12 变体中，**没有任何一个**同时满足 declared≠actual 与 	arget==actual；
  E2 的实际 drift 场景不经过 skip 分支。
- 因此 DRIFT_FIRST behavioral priority 在本冻结任务集内属 **known unexercised implementation limitation**
  （检测存在、优先级缺口存在，但冻结任务的判别语义不依赖它）。
- 未改动任何 frozen 资产（F12 YAML / GT / signed hash / frozen hash / contract / checker）；
  全部探针在 %TEMP% 副本上进行，产物仅本审核文件与 f12-*.log 证据。
