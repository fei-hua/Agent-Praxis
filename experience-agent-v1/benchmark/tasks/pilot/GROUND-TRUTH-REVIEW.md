# Pilot 任务 Ground Truth 评估问卷（第 1 轮：待人工逐条签署）

> 本文件是 `expected_first_decisions` 的签署载体。**签署前不得开跑**（`scripts/pilot-plan.ts` 会拒绝 `status: draft`）。
>
> **签署规则（人工 2026-09-27 拍板）**
> 1. 逐条审核，**不得**按 §9.1 类别直接映射冻结（否则会出现「任务归为 C → expected=DELEGATE → 再证明 Policy 判断正确」的循环定义）。
> 2. 判断依据是**任务实际要求**，不是任务名字或类别标签。
> 3. 一旦签署，Pilot / Formal 期间**不得**因模型表现不好而修改。
> 4. 若发现任务书存在真正歧义，按**版本变更**处理（记为新任务或标记修订），**不得直接改 ground truth**。
> 5. 可签署内容：`expected_first_decisions`（含等价决策集）、`success_criteria` 结构（见第二部分的 4 个设计问题）。

---

## 第一部分：逐条签署表（10 条）

填写方式：在「签署」列写 `✓`（同意）或写下你的修改；「等价集」列是可在不改变 CDA 判定前提下并列接受的决策集合。

| # | 任务 | 任务实际要求（摘要） | 我提议 expected | 建议等价集 | 影响 CDA 分母 | 签署 |
|---|---|---|---|---|---|---|
| 1 | PILOT-A01 | 修单个文件 `heartbeat.js` 的计数缺陷，范围完全明确 | `DIRECT` | `{DIRECT}` | false | |
| 2 | PILOT-A02 | 给单个文件 `parser.js` 的全部导出函数补 JSDoc，范围明确 | `DIRECT` | `{DIRECT, EXPLORE}` | false | |
| 3 | PILOT-B01 | 读 3 个未文档化模块 + 入口，判定"谁被**间接**调用"并写调用链 | `EXPLORE` | `{EXPLORE}` | false | |
| 4 | PILOT-B02 | 梳理 `shared/` 对 `widget.js` 的**直接/间接**使用集合 | `EXPLORE` | `{EXPLORE}` | false | |
| 5 | PILOT-C01 | 无障碍审查 + 修订 `a11y.css` + 出审查报告（需专业审查视角） | `DELEGATE` | `{DELEGATE, PARALLEL, WORKFLOW}` | **true** | |
| 6 | PILOT-C02 | 代码/架构审查 `auth.js` 输入校验 + 在 api 不变前提下修正 | `DELEGATE` | `{DELEGATE, PARALLEL, WORKFLOW}` | **true** | |
| 7 | PILOT-D01 | 两项**互不依赖**工作：依赖图 + 测试归档 | `PARALLEL` | `{PARALLEL, WORKFLOW}` | **true** | |
| 8 | PILOT-D02 | 两项**互不依赖**工作：版本 breaking change 分析 + 兼容检查归档 | `PARALLEL` | `{PARALLEL, WORKFLOW}` | **true** | |
| 9 | PILOT-E01 | **已知失败状态**：迁移脚本因配置缺失中止，需重新规划并修复 | `REPLAN` | `{REPLAN}` | false | |
| 10 | PILOT-E02 | **已知失败状态**：构建清单引用不存在源文件，需重新规划并修复 | `REPLAN` | `{REPLAN}` | false | |

### 逐条判断依据（为什么是这一个，而不是别的）

**#1 PILOT-A01 → DIRECT**
任务书给了确切文件与确切缺陷（count 不递增），不需要探索、不需要专业分工、没有并行子任务、不是验证型任务、不是失败恢复。七条 Policy 优先级逐条不命中，落到 DIRECT。

**#2 PILOT-A02 → DIRECT（可放 EXPLORE）**
单文件、要求明确（"每个导出函数一条 JSDoc"），必须读文件才能写注释——但读一个已知文件属于 DIRECT 的常规工作，不构成 §9.1 意义上的"结构/数据流尚不明确"。
⚠️ 我把它列为可放 `EXPLORE`：因为「先读后写」和「先探索」的边界在单文件任务上确实模糊。**两者都不改变 CDA**（都不是委派动作），但会影响 Decision Accuracy 的统计。请你决定是否放行 EXPLORE。

**#3 PILOT-B01 → EXPLORE**
关键要求不是"读文件"，而是"判定**间接**调用关系并给出完整链路"——必须先摸清三个模块与入口的调用结构才可能回答。这是 §9.1 B 类的典型形态。

**#4 PILOT-B02 → EXPLORE**
同 #3：需要先建立 `shared/` 内部调用图，才能区分"被 widget.js 直接使用"与"经其他模块间接使用"。

**#5 PILOT-C01 → DELEGATE**
任务实际要求是**无障碍专业审查**（对比度、焦点可见性、aria、命中区）——存在明确的专业分工，且是单个可委派子任务。注意：这不是"因为类别是 C 所以委派"，而是任务内容本身需要专业审查角色。
⚠️ 见第二部分问题 1：当前任务书**显式写了**"委派 ui-reviewer subagent"，这会削弱区分度。

**#6 PILOT-C02 → DELEGATE**
同 #5：安全/架构审查是有明确专业视角的单一子任务，且要求在不改对外签名的约束下修正。

**#7 PILOT-D01 → PARALLEL**
任务书自身规定两项工作"互不依赖"，并要求产出两份独立产物 → 存在两个以上相互独立且适合委派的子任务。

**#8 PILOT-D02 → PARALLEL**
同上：版本影响分析与兼容性执行互不依赖。

**#9 PILOT-E01 → REPLAN**
任务书以「【已知失败状态】上一次执行失败并中止」开场 → 按 §9.1 E 类与 Policy 第 1 优先级，第一次决策应为 REPLAN。注意这与 dry-run 的 DRY-05 不同：DRY-05 是**先 EXPLORE 再因失败转 REPLAN**，E 类要求**第一次决策就是 REPLAN**。

**#10 PILOT-E02 → REPLAN**
同 #9。

---

## 第二部分：4 个跨任务设计问题（需要你裁决）

这几条会影响测量有效性，我在起草时发现了，先不动手，等你定。

### 问题 1：C/D 类任务书是否应显式要求"委派"？

**现状**：C01/C02 的任务书写着"委派 ui-reviewer / code-reviewer subagent"；D01/D02 写着"请**并行**委派两个 subagent"。

**风险**：如果任务书已经把动作规定好了，三条臂都会照做，**CDA 对每一臂都接近 1，丧失区分度**——实验就测不出"经验是否改善了委派判断"，只测出"是否听话"。

**我的建议**：任务书只描述**任务要求**，不规定执行方式。例如 C01 改为"对 ui/ 做无障碍审查并按结论修订样式，产出审查报告（至少 3 条风险）"；D01 改为"以下两项工作互不依赖：…（分别产出 module-graph.md 与 test-report.txt）"。是否委派、如何委派，交给 Agent 决策——这正是要测的东西。

**请你选**：(甲) 按建议去掉任务书里的委派指令 / (乙) 保留（明确按"指令跟随"解读结果）/ (丙) 其他。

### 问题 2：`subagent_used` 是否应作为 required 判定项？

**现状**：C01/C02/D01/D02 的 `success_criteria.required` 里含 `subagent_used` / `two_subagents_used`。

**风险**：这会把"任务成功"与"是否委派"耦合起来——被测量（委派决策）同时成了成功条件，CDA 与 Task Success 不再独立。

**我的建议**：把委派使用记录从 `required` 移到**观测指标**（`subagent_invocations` 已经在轨迹里了），任务成功只由**产物质量**判定（css 修好、报告写了、图与归档产出）。

**请你选**：(甲) 移出 required / (乙) 保留 / (丙) 其他。

### 问题 3：B 类任务若委派 explorer 子代理，CDA 是否应记为 0？

**背景**：§3.1 冻结定义：委派动作 ⇔ `first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}`。B 类 expected = `EXPLORE`（非委派）。所以若 Agent 选择"委派 explorer 子代理去探索"，按定义 CDA = 0。

**这是判定口径问题**，不是代码问题。**请你确认**：(甲) 维持定义（委派 explorer = 未正确判断，CDA=0）/ (乙) B 类任务的 `EXPLORE` 允许等价 `DELEGATE`（会改变 CDA 定义，需改规格）。

### 问题 4：等价决策集的记录方式

**背景**：CDA 只看委派轴，所以 `{DIRECT, EXPLORE}` 等价（都不委派）、`{DELEGATE, PARALLEL, WORKFLOW}` 等价（都委派）——同一任务允许的多个期望值**不改变 CDA**，只影响 Decision Accuracy。

**我的建议**：在任务 YAML 里用 `expected_first_decisions` 列表表达"等价集"（规范已支持多值），并在本文件记录理由；`expected_delegation` 由该集合按 §3.1 推出（现有校验会强制一致）。

**请你选**：(甲) 按建议允许多值等价集 / (乙) 每任务只允许单一期望值（更严格，但会把实现细节差异计入 Decision Accuracy）/ (丙) 其他。

---

## 第三部分：签署记录（已签署 2026-09-27）

**签署人**：fei-hua　**日期**：2026-09-27　**签署方式**：逐条审核（不按类别批量映射）

| 任务 | expected_first_decisions（冻结值） | 等价集 | 签署 | 备注 |
|---|---|---|---|---|
| PILOT-A01 | `DIRECT` | `{DIRECT}` | ✓ | |
| PILOT-A02 | `DIRECT` | `{DIRECT, EXPLORE}` | ✓ | 人工确认放行 `EXPLORE`：存在合理执行路径差异，不改变 CDA 委派轴；仅影响 Decision Accuracy |
| PILOT-B01 | `EXPLORE` | `{EXPLORE}` | ✓ | |
| PILOT-B02 | `EXPLORE` | `{EXPLORE}` | ✓ | |
| PILOT-C01 | `DELEGATE` | `{DELEGATE, PARALLEL, WORKFLOW}` | ✓ | |
| PILOT-C02 | `DELEGATE` | `{DELEGATE, PARALLEL, WORKFLOW}` | ✓ | |
| PILOT-D01 | `PARALLEL` | `{PARALLEL, WORKFLOW}` | ✓ | |
| PILOT-D02 | `PARALLEL` | `{PARALLEL, WORKFLOW}` | ✓ | |
| PILOT-E01 | `REPLAN` | `{REPLAN}` | ✓ | 人工确认：与 DRY-05 的差异（DRY-05 为 `EXPLORE → 失败 → REPLAN`）是有意保留的，用于检验 Agent 能否识别**已有失败状态** |
| PILOT-E02 | `REPLAN` | `{REPLAN}` | ✓ | 同上 |

### 跨任务设计问题的裁决（人工 2026-09-27）

| 问题 | 裁决 | 落地 |
|---|---|---|
| Q1 C/D 任务书是否显式要求委派 | **甲：去掉委派指令** | C01/C02 改为只描述审查范围；D01/D02 改为只描述两项互不依赖的工作。已修订任务书（实验泄漏已在 Pilot 前消除） |
| Q2 `subagent_used` 是否留在 required | **甲：移出** | 从 C01/C02/D01/D02 的 `success_criteria.required` 移除；委派使用作为轨迹观测指标（`subagent_invocations` / delegate agent set） |
| Q3 B 类委派 explorer 是否算 CDA 等价 | **甲：维持 CDA 定义** | 委派 ⇔ `first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}`；`EXPLORE` 与 `DELEGATE` **不等价**，`expected=EXPLORE ∧ actual=DELEGATE ⇒ CDA=0` |
| Q4 是否允许多值等价集 | **甲：允许，但 Pilot 前冻结** | 已按上表写入任务 YAML 的 `expected_first_decisions` 列表；类别校验改为**委派轴一致**（A/B/E = 非委派轴，C/D = 委派轴） |

### 冻结规则（人工 2026-09-27 拍板）

> 1. 这 10 个 `expected_first_decision` 一旦签署，**Pilot 与 Formal 期间不得因模型表现不好而修改**。
> 2. **等价集必须在任务正式进入 Pilot 前确定**，不得根据 Pilot 结果事后增加、删除或修改。
> 3. 若发现任务描述存在真正的歧义，必须作为**版本变更**处理（记为新任务或标记修订），**不得直接改 ground truth**。

### 签署后的执行状态

| 步骤 | 状态 |
|---|---|
| 1. 按 Q1/Q2 修订任务书与判定项 | ✅ 已完成（2026-09-27） |
| 2. 按签署值写入等价集 | ✅ 已完成（10/10 加载校验 0 issue） |
| 3. 补齐 `verification`（标签 → 纯代码检查） | 🔲 待办（#6 剩余项） |
| 4. `status: draft` → `frozen` | 🔲 待办（第 3 步完成后，且按既定顺序在 OQ-014 之后） |
