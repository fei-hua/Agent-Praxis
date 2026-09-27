# Experiment Design — Experience-Driven Tool Orchestration (V1.0)

> **状态：FROZEN**
> 本文件中的所有阈值、公式、样本量规则已在正式实验开始前冻结。
> **禁止在 Pilot 之后修改本文件中的任何数字。**
> 如需修改，必须新开版本号（V1.1），并说明修改理由与时机。

---

## 0. 一句话

我们不问「DeepSeek 有没有变聪明」，我们问：

> **经过质量控制的行动经验，是否会改变 Coding Agent 的工具/子任务路由决策，并带来可测量的收益？**

---

## 1. 研究问题

| # | 问题 | 对比 | 证据等级 |
|---|---|---|---|
| RQ1 | Policy 是否改善基础委派决策？ | B − A | **Confirmatory (H1)** |
| RQ2 | Frozen Action Experience 是否在 Policy 之上产生增量？ | C_frozen − B | **Confirmatory (H2)** |
| RQ3 | 若无增量，结果是否与「效应 < 5pp」相容？ | C_frozen − B 的 90% CI | Exploratory (H2-null) |
| RQ4 | 行动经验能否迁移到未见过的项目？ | Transfer Set | Exploratory (H3) |
| RQ5 | 在线 Reflection 是否继续产生适应？ | D_online vs C_static | Exploratory |

---

## 2. 假设分级（最重要的一条设计原则）

```
            Confirmatory
                 │
           ┌─────┴─────┐
           H1          H2
        Policy     Experience
                 │
            Primary CDA
                 │
        ─────────┼─────────
                 │
            Exploratory
        ┌────────┼────────┐
     H2-null            H3
   Equivalence        Transfer
        │
     D_online
  Online Adaptation
```

**不是所有问题都值得做成确认性假设。**

- **Confirmatory**（H1/H2）：可以据此下结论
- **Exploratory**（H2-null/H3/D）：用于解释与产生假设，**不据此下「成立/不成立」结论**

---

## 3. 主指标：Conditional Delegation Accuracy (CDA)

### 3.1 定义

```
delegation_action ⇔ first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}

expected_delegation     ← 来自 benchmark task YAML 的 expected_first_decisions
actual_delegation       ← 来自 task_state.first_decision（代码读取，非 LLM 判定）

CDA = 1  若 actual_delegation == expected_delegation
CDA = 0  否则
```

### 3.2 边界（已冻结，属有意设计）

```
expected = DELEGATE
actual   = PARALLEL
→ CDA = 1
```

**CDA 只回答「该不该委派」。** 采用何种委派模式（DELEGATE vs PARALLEL vs WORKFLOW）由 Secondary Metric `Decision Accuracy` 负责。

### 3.3 每个实验单元

每个 `(task, arm)` 取 3 次重复的均值，得到该任务的 `CDA_task ∈ {0, 1/3, 2/3, 1}`。

---

## 4. Secondary Metrics（只报不判）

以下指标**不得用于判定 H1/H2 成立与否**：

| 指标 | 说明 |
|---|---|
| Decision Accuracy | `first_decision` 与 `expected_first_decisions` 的精确匹配 |
| Tool Selection Quality | LLM Judge（辅助），需报 judge↔human 一致率 |
| Task Success | per-task `success_criteria` 全满足 |
| Verification Rate | 完成后是否验证 |
| Recovery Rate | 失败后是否 replan |
| Unnecessary Tool Rate | 无谓工具调用 |
| Experience Retrieval Rate | 检索命中率 |
| Candidate Context Inclusion Rate | candidate 进入上下文比例 |
| Cost / Tokens / Latency | 描述性统计 |
| **E2A — Action Change Rate** | 见 §9 |
| **E2A — Beneficial Action Change Rate** | 见 §9 |

---

## 5. 样本量规划

### 5.1 Pilot

```
10 tasks
× 3 repetitions
× 3 arms (A / B / C_frozen)
= 90 runs
```

**Pilot 不参与正式假设检验。**

Pilot 职责：

```
 ├── Instrumentation 验收
 ├── Retrieval 验收
 ├── Experience Gate 验收
 ├── Candidate inclusion 统计
 └── Power estimation（本节核心）
```

### 5.2 任务级配对差

```
Δ_BA(task) = CDA_B(task) − CDA_A(task)
Δ_CB(task) = CDA_C_frozen(task) − CDA_B(task)

→ s_BA, s_CB（任务级 paired SD）
```

### 5.3 保守 SD（80% 单侧上置信界）

直接用 `s_pilot` 风险很大（n=10）。V1 采用上置信界：

```
s_planning = sqrt( (n-1) × s_pilot² / χ²_(0.20, n-1) )
```

n = 10 时：

```
χ²_(0.20, 9) ≈ 5.40
s_planning ≈ 1.293 × s_pilot     工程文档写作 ≈ 1.30 × s_pilot
```

> 来源明确，不是拍脑袋的 1.30。

### 5.4 检出样本量

```
δ       = 0.10            (10 percentage points)
power   = 0.80
α_plan  = 0.025           (双侧，用于保守规划)

z_(1-α_plan/2) = z_0.9875 = 2.2414
z_(0.80)       =           0.8416

N_detect =
ceil(
    ((2.2414 + 0.8416) × s_planning / 0.10)²
)
```

### 5.5 最终样本量

```
N_formal = max(30, N_H1, N_H2)
```

**H2-null 不参与样本量规划**（已降为 exploratory，见 §6）。

### 5.6 上限与 Underpowered 规则

```
N_max = 150

若 N_formal > 150：
    记录 "FORMAL STUDY UNDERPOWERED"
    不得修改 δ
    不得删除任务
    不得降低 power
    不得调整经验库/检索算法/任务判据
    → H1/H2 不做确认性结论，只报探索性结果
```

### 5.7 查表（δ=10pp, power=0.80, α_plan=0.025）

| s_pilot | s_planning (×1.293) | N_detect | 是否 ≤ 150 |
|---:|---:|---:|:--:|
| 0.20 | 0.2586 | 64 | ✅ |
| 0.22 | 0.2845 | 77 | ✅ |
| 0.25 | 0.3233 | 100 | ✅ |
| 0.27 | 0.3491 | 116 | ✅ |
| 0.30 | 0.3879 | 143 | ✅ |
| 0.31 | 0.4008 | 153 | ❌ |

**覆盖范围：`s_pilot ≤ 0.307`**

### 5.8 Monte Carlo Power Simulation（交叉验证，必做）

CDA 是离散有界指标，正态近似可能失配。因此**同时**计算解析 N 与仿真 N：

```
N_formal = max(N_formula, N_simulation, 30)
```

#### 🔒 仿真规格冻结规则（必须遵守）

```
① 时机
   仿真规格（本节）必须在 Pilot 数据到手之前冻结。
   代码可以后写，但规格不得后改。
   理由：N_formal 由仿真参与决定，规格可事后修改 =
        可以"调"出想要的 N（即使无意）。

② 检验一致
   仿真必须使用与正式分析完全相同的检验：
   paired permutation test + Holm correction
   否则 N_simulation 优化的是另一个统计量。

③ 效应注入
   必须写明如何在有界 [-1, 1] 的配对差分布上施加 +10pp。
   禁止简单整体平移（会越界）。
   推荐：对每任务的 (p_A, p_B) 用 beta-binomial 建模，
         再把 p_B 抬高 0.10（截断到 [0,1]）。

④ SD 不确定性必须传播
   重采样 Pilot → 重新估分布 → 得到 N 的分布
   取 N 的高分位数（80% 或 90%）
   否则仿真只反映点估计，比解析公式更乐观。

⑤ 一致性规则
   若 max(N_formula, N_simulation) > 150
     → 同样触发 UNDERPOWERED，不允许"因为仿真说可以"就放行
   若两者差异 > 1.5 倍
     → 必须报告并调查原因，不允许静默取 max
```

---

## 6. 假设与判定规则

### H1 — Confirmatory

> **Policy improves delegation decision quality.**

```
指标：CDA_B − CDA_A

成立条件：
    ≥ 10 percentage points
    AND
    Holm-adjusted p < 0.05
```

### H2 — Confirmatory

> **Frozen Action Experience provides additional improvement beyond Policy.**

```
指标：CDA_C_frozen − CDA_B

成立条件：
    ≥ 10 percentage points
    AND
    Holm-adjusted p < 0.05
```

### H2-null — Exploratory Equivalence Analysis

> **观察结果是否与「效应 < 5pp」相容？**

```
指标：C_frozen − B 的 90% CI

若 90% CI ⊆ [−5pp, +5pp]
    → 报告："观察结果与 ±5pp 等效区间相容"
否则
    → 报告："无法建立 ±5pp 等效"
```

**不作为确认性结论。不参与样本量规划。**

> 说明：TOST 等效判定在 α=0.05 下对应 90% CI。若要求 80% power，
> 样本量公式需含 `z_power` 项，此时 `N_equiv ≈ ((1.645+0.842)×s/0.05)²`
> 在 s=0.25/0.30/0.35 时分别为 155/223/303 任务。
> 为不拖垮 V1，H2-null 降为探索性。

### H3 — Exploratory Transfer Analysis

```
Validation Gain = C_frozen − B                  （Validation Set）
Transfer Gain   = C_transfer − B_transfer        （Transfer Set）

若 Validation Gain < 5pp → H3 = Not Testable
否则 Retention = Transfer Gain / Validation Gain
```

**报告内容：`B_transfer` / `C_transfer` / `Transfer Gain` / 95% CI / Retention 点估计**
**不做 confirmatory pass/fail。**

> 理由：Transfer Set = 15 任务，SE ≈ 7.8pp，95% CI 半宽 ≈ 15pp。
> 强行要求 CI 下界 ≥ 60% 会因精度不足永远失败，而那不是「迁移不存在」。

### D — Exploratory Online Adaptation

```
D_online ：每个任务后 Reflection，store S0 → S1 → S2 → …
C_static ：不 Reflection，store 全程冻结在 S0

比较 D_t vs C_static(t)
```

**任务顺序控制**：

```
每个 paired replicate 内：D_online 与 C_static 使用完全相同的任务顺序
不同 replicate：使用不同的预先随机化任务顺序

Rep 1: T7 T2 T13 T5 ...
Rep 2: T3 T11 T8 T1 ...
Rep 3: T9 T4 T15 T6 ...
```

目的：消除「后面的任务刚好更简单」造成的系统偏差。

**D 结果不参与 H1/H2。**

---

## 7. 统计检验

### 7.1 确认性比较

```
检验：paired permutation test（任务级配对）
多重比较校正：Holm correction（m = 2，仅 H1 与 H2）
```

### 7.2 报告格式

```
主结果：mean ± std，per-task 明细
检验：Holm-adjusted p
效应量：Δ 及其 95% CI
```

### 7.3 不做的事

```
❌ 不挑指标（主指标只有 CDA）
❌ 不事后改阈值
❌ 不因"结果不好看"删任务
❌ 不用 p > 0.05 声称"没效果"
```

---

## 8. 检测下限措辞（必须原样写进报告）

> **本研究针对 Experience 增量收益的确认性检测阈值为 10 percentage points。
> H2 未得到确认，不等价于证明 Experience 无效；它仅表示本研究未检测到
> 达到预设 10pp 阈值的增量效果。**

示例：

```
C − B = +6pp,  p > .05
→ ❌ 不能说："Experience 没用"
→ ✅ 应说："未确认 ≥10pp 的增量效果"
```

---

## 9. E2A（Experience → Action Effect）

这是本项目的核心贡献指标之一。核心问题：

> **历史经验有没有让下一次的行动决策发生更合理的变化？**

（不是 "Experience → Context"，是 "Experience → Action"。）

### 9.1 Action Change 判定

**只依据 `first_decision` 与高层委派计划**，不使用工具调用细节（避免噪声）。

```
Action Change = True，若满足任一：

(a) first_decision 不同
(b) delegation agent set 不同
(c) delegation execution mode：serial ↔ parallel
(d) verification：absent → present
```

**不计为 Action Change：**

```
❌ grep ↔ read          （同一探索策略）
❌ 同一策略下工具顺序轻微变化
❌ 探索深度不同
```

```
Action Change = High-level action change
     ≠ Tool Call String Difference
```

### 9.2 Action Change Rate

```
                发生 Action Change 的 Treatment/Baseline 配对数
ACR  =  ───────────────────────────────────────────────────────
                        所有相关配对任务数
```

### 9.3 Beneficial Action Change Rate

```
Beneficial Action Change
    = Action Change
      AND Task Success
      AND no_forbidden_violation
      AND cost_ok
```

#### cost_ok（已冻结）

```
cost_ok ⇔
    tokens_treatment ≤ 1.50 × tokens_baseline + 1000
    AND
    subagent_calls_treatment ≤ subagent_calls_baseline + 1
```

> **wall_time 不进硬门**（网络/负载/API 波动过于嘈杂），
> 只作为 Secondary Descriptive Metric 报告。

**目的**：防止得出「经验让 Agent 换了一种工具，所以经验有效」这种错误结论。
必须是「策略变了 + 确实有收益 + 代价没失控」。

---

## 10. 任务集合与实验阶段

### 10.1 数据集 × 阶段

| 阶段 | 任务数 | 重复 | 臂 | 是否进入正式结论 |
|---|---:|---:|---:|:--:|
| Acquisition | 20 | — | — | ❌ 生成 SNAPSHOT_01 |
| Phase 0 Dry-run | 5 | — | — | ❌ 纯 instrumentation |
| Pilot | 10 | 3 | 3 | ❌ 方差/功效/工程验收 |
| Validation | `N_formal` | 3 | 3 | ✅ **确认性** |
| Transfer | 15 | 3 | 2 | 探索性 (H3) |
| D Online | 30 | 3 | 2 | 探索性 (D) |

**总任务数** = 20 + 5 + 10 + N_formal + 15 + 30
N_formal=30 时约 110；N_formal=150 时约 230。

### 10.2 互斥规则（必须满足）

```
Dry-run     ∩ Pilot       = ∅
Pilot       ∩ Validation  = ∅
Acquisition ∩ Validation  = ∅
Acquisition ∩ Transfer    = ∅
```

Pilot 不能参与正式结论。Dry-run 会被开发反复查看，绝不能流入 Pilot。

### 10.3 运行量与预算

```
Dry-run    : 5
Pilot      : 10 × 3 × 3   = 90
Main       : N_formal × 3 × 3  = 270 ~ 1350
Transfer   : 15 × 3 × 2   = 90
D          : 30 × 3 × 2   = 180
────────────────────────────────────
合计 ≈ 635 ~ 1715 runs
```

#### 预算规则

```
EXPERIMENT_BUDGET 由 Pilot 的实际 token/run、latency/run、API 单价
在正式实验开始前计算，并写入 experiment config。

超出预算：
    STOP
    不删任务
    不改阈值
    不重排结果
    只报告已完成数据，并标记 underpowered / incomplete
```

---

## 11. 防御性规则（写给所有人，包括开发 AI）

> **不要为了让实验结果更漂亮而改变阈值、经验库、检索算法或任务判定。
> 所有这些都必须在正式实验开始前冻结。**

Pilot 只能决定：**要做多少正式任务。**

Pilot **不能**决定：「发现 H2 太难了，那我们把 10pp 改成 15pp。」

```
已冻结、不得事后修改：
    H1 = 10pp
    H2 = 10pp
    H2-null = ±5pp（探索性）
    α_plan = 0.025
    power = 0.80
    s_planning 系数 ≈ 1.30
    N_max = 150
```

---

## 12. 版本可复现性

DeepSeek Harness 目前处于 Developer Preview，官方明确提示可能存在 breaking changes。

每次 run 必须记录：

```
harness_version
tool_schema_version
framework_version
model_id
experience_snapshot_id
experiment_config_hash
```

这不是「优雅设计」，是实验可复现的必要条件。
