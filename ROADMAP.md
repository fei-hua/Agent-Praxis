# 路线图 / Roadmap

本项目按阶段推进，每个阶段有明确的**出口标准**；阶段未通过前不进入下一阶段。
所有进行中的工作以 GitHub [Milestones](https://github.com/fei-hua/Agent-Praxis/milestones) 与
[Issues](https://github.com/fei-hua/Agent-Praxis/issues) 为准，本文件是同一路线图的仓库内快照。

```
Phase 0  观测与基础运行闭环            ✅ 已完成（tag v0.1.0-phase0）
   ↓
Pilot    10 任务 × 3 次 × A/B/C        ⏳ 进行中（前置项待补齐）
   ↓
正式实验  30–150 任务，H1 / H2 / H2-null + E2A
```

---

## Phase 0 — 观测与基础运行闭环 ✅

**唯一目标**：证明能可靠观察 Agent 的决策过程（决策 / 工具调用 / Subagent 委派 / 失败 / 重新规划）。
本阶段不做 Reflection、经验挖掘、冲突裁定、语义门、A/B 与正式跑数。

**出口标准（已满足）**：5 个 dry-run 全部通过五条验收 —— 轨迹 schema 覆盖率 100% ·
tool call ↔ result 配对 100% · failure 可重建 · replan 可重建 · 离线可完整重建决策链。

- Milestone：[#1 Phase 0 — 观测与基础运行闭环](https://github.com/fei-hua/Agent-Praxis/milestone/1)（已关闭）
- 验收报告：[`experience-agent-v1/docs/phase0-acceptance-report.md`](experience-agent-v1/docs/phase0-acceptance-report.md)
- 里程碑发布：[v0.1.0-phase0](https://github.com/fei-hua/Agent-Praxis/releases/tag/v0.1.0-phase0)

| # | Issue | 状态 |
|---|---|---|
| [#1](https://github.com/fei-hua/Agent-Praxis/issues/1) | Phase 0 交付与验收：T1–T10 | ✅ closed |
| [#2](https://github.com/fei-hua/Agent-Praxis/issues/2) | 已知边界 M1：采集中途读取会得到过期快照 | ✅ closed |
| [#3](https://github.com/fei-hua/Agent-Praxis/issues/3) | 已知边界 M2：受限沙箱下的运行约束 | ✅ closed |

---

## Pilot — 10 任务 × 3 次 × A/B/C ⏳

**目标**：确定正式实验所需样本量，并验证检索与经验注入在真实任务上的行为。
**不参与正式假设检验**。

- Milestone：[#2 Pilot — 10 任务 × 3 次 × A/B/C](https://github.com/fei-hua/Agent-Praxis/milestone/2)

| # | Issue | 说明 |
|---|---|---|
| [#4](https://github.com/fei-hua/Agent-Praxis/issues/4) | 补齐影响冻结配置的 OQ（011 token 口径 / 013 BM25 标定 / 018 usage 口径） | 前置：直接决定冻结配置 |
| [#5](https://github.com/fei-hua/Agent-Praxis/issues/5) | 裁决其余未决 OQ（010 / 014 / 015 / 017 / 019） | 前置：Pilot 期间会真实碰到 |
| [#6](https://github.com/fei-hua/Agent-Praxis/issues/6) | 编写 10 个 Pilot 任务（与 dry-run 不相交，覆盖 A–E 类） | 任务集冻结后不得为提高指标而修改 |
| [#7](https://github.com/fei-hua/Agent-Praxis/issues/7) | 实现 Policy 臂（B）规则集（`policies/`） | 规则必须来自规格或裁决 |
| [#8](https://github.com/fei-hua/Agent-Praxis/issues/8) | 实现 A/B/C 三臂运行编排（arm 取值、快照绑定、CDA 计算与录制） | CDA 的 actual 必须代码直读 `task_state.first_decision` |
| [#9](https://github.com/fei-hua/Agent-Praxis/issues/9) | Pilot 执行与报告（CDA/SD、检索行为、经验注入行为、成本） | 每个数字都要能从轨迹离线重建 |
| [#10](https://github.com/fei-hua/Agent-Praxis/issues/10) | Power Analysis：s_pilot → s_planning（≈1.30×）→ N_formal（≤150） | 超过上限须报告不可行，不得放宽阈值 |
| [#11](https://github.com/fei-hua/Agent-Praxis/issues/11) | 环境异常复核：ESM/require 包作用域矛盾（M3，低优先级） | 未解释现象，如实保留 |

---

## 正式实验 — H1 / H2 / H2-null + E2A

**目标**：在冻结的实验规则与经验快照下完成正式跑数并产出结论。

- Milestone：[#3 正式实验 — H1 / H2 / H2-null + E2A](https://github.com/fei-hua/Agent-Praxis/milestone/3)

| # | Issue | 说明 |
|---|---|---|
| [#12](https://github.com/fei-hua/Agent-Praxis/issues/12) | BM25 正式标定并冻结 `experiment_config_hash` | 顺序：SNAPSHOT_01 → 标定 → hash |
| [#13](https://github.com/fei-hua/Agent-Praxis/issues/13) | 锁定 SNAPSHOT_01 与正式任务集（30–150，每任务 3 次重复） | 跑数开始后冻结 |
| [#14](https://github.com/fei-hua/Agent-Praxis/issues/14) | 跑数（A / B / C_frozen + 对照 C_static、D_online） | CONFIG_MISMATCH 的 run 一律排除 |
| [#15](https://github.com/fei-hua/Agent-Praxis/issues/15) | H1 / H2 假设检验（paired permutation + Holm，m = 2，≥10pp） | 报告效应量与置信区间 |
| [#16](https://github.com/fei-hua/Agent-Praxis/issues/16) | H2-null TOST（90% CI ⊆ ±5pp） | 结论不利也必须按要求报告 |
| [#17](https://github.com/fei-hua/Agent-Praxis/issues/17) | E2A / C_static / D_online 探索性分析与结论产出 | 明确标注探索性部分 |

---

## 贯穿全程的纪律

1. **规格冻结**：不改架构假设、指标公式、阈值、枚举；要改先改规格并留痕。
2. **不确定就问**：规格未定义处登记 [`spec/open-questions.md`](experience-agent-v1/spec/open-questions.md)，blocking 时停下等裁决。
3. **可复现优先**：每次 run 记录 `experiment_config_hash`（实验规则）+ `experience_snapshot_id`（当时用哪一版经验）+ 环境版本三元组。
4. **先做对观察，再谈改进**：不得为了让结果好看而调整阈值、经验库、检索算法或任务判定。
