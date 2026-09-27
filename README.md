# Agent Praxis

> **经验驱动的 Coding Agent 工具编排框架**
>
> Experience-Driven Tool Orchestration — turn every agent run into reusable, verifiable experience.

**English** · [中文说明见下方](#agent-praxis-中文说明)

Agent Praxis is an **experience-driven tool-orchestration framework for coding agents**, built on **DeepSeek + DeepSeek Harness**.
It records *how* an agent decides, selects tools, delegates to subagents, fails and recovers — then replays that experience
under **frozen, reproducible experiment rules**.

```
Experience → Decision → Tool/Subagent → Outcome → Reflection
```

**Keywords:** experience-driven tool orchestration · coding agent evaluation · subagent delegation ·
tool-call trajectory instrumentation · reproducible LLM-agent experiments · DeepSeek Harness

**Status:** Phase 0 (instrumentation + basic run loop) is **complete and verified** — 5/5 dry-run tasks pass every exit
criterion: 100% tool-call↔result pairing, reconstructable `failure` and `replan` events, and fully offline-reconstructable
decision chains (Task → Task State → First Decision → Action → Tool/Subagent → Outcome).
Evidence: [`experience-agent-v1/docs/phase0-acceptance-report.md`](experience-agent-v1/docs/phase0-acceptance-report.md) ·
Module guide: [`experience-agent-v1/README.md`](experience-agent-v1/README.md)

---

## Agent Praxis 中文说明

Agent Praxis 基于 **DeepSeek + DeepSeek Harness（DSH）**，把 Coding Agent 的实战过程变成可复用的经验：
记录它如何做决策、如何选工具、如何委派 Subagent、如何失败又如何恢复，再把这些经验在**受控、可复现**的条件下注入下一次决策。

```
经验 → 决策 → 工具 / Subagent → 结果 → 复盘
 Experience → Action Decision → Tool/Subagent Routing → Outcome → Reflection
```

**核心理念：** 不给 Agent 换一个「更聪明的脑子」，而是给它一套**可验证的经验回路**——
经验是知识，轨迹是事实证据；每条经验都必须能沿证据链回溯到真实运行。

---

## 1. 要解决的问题

Coding Agent 的能力瓶颈往往不在「会不会写代码」，而在**编排决策**：

| 问题 | 表现 |
|---|---|
| 该不该委派？ | 简单任务过度委派（浪费 token/延迟），复杂任务又独自硬扛 |
| 委派给谁？ | 缺少专业分工（探索 / 研究 / UI 审查 / 代码审查 / 测试） |
| 失败之后？ | 原地重试而不是重新规划（Replan），失败信息被丢掉 |
| 经验如何积累？ | 每次任务都从零开始，上一次的教训无法进入下一次决策 |
| 怎么证明有效？ | 「感觉更好了」——没有可复现的指标、没有统计检验、没有冻结的实验规则 |

Agent Praxis 的回答是：**先把观测做对，再谈改进。**
所有阈值、公式、枚举、判定规则在正式实验前冻结；任何规格未定义之处登记为开放问题（OQ），
由人裁决后落账，**绝不静默硬化成代码假设**。

---

## 2. 架构：一条可回溯的数据链

```
Task（任务定义）
   │
   ▼
Task State（主 Agent 首轮结构化输出：task_type / complexity / characteristics / scope / constraints）
   │
   ▼
First Decision（DIRECT / EXPLORE / DELEGATE / PARALLEL / WORKFLOW / VERIFY / REPLAN）
   │                                     ↑ 由代码直读 task_state.first_decision，绝不事后由 LLM 从轨迹推断
   ▼
Experience Retrieval（结构化匹配 → BM25 → 相关性 → 可靠性 → 禁忌因子 → final_score → Top-K=5 → 阈值 0.30）
   │
   ▼
Action：Tool / Subagent（explorer · researcher · ui-reviewer · code-reviewer · tester）
   │
   ▼
Outcome + Failure + Replan（失败原因与上下文完整落盘，可离线重建）
   │
   ▼
Experience（知识）──evidence──▶ run_id ──▶ Trajectory（事实证据）──▶ task_id / 环境版本三元组
```

两条设计原则贯穿全程：

- **事实与知识分离**：Trajectory 只记录真实发生的事；Experience 是可被质量门（Quality Gate）审查、可被复审推翻的知识。
- **一切可复现**：每次运行记录 `experiment_config_hash`（实验规则是什么）+ `experience_snapshot_id`（当时用了哪一版经验）。

---

## 3. 实验设计（V1.0，冻结）

| 臂 | 定义 |
|---|---|
| **A** | Baseline：无 Policy |
| **B** | Policy：应用策略规则 |
| **C_frozen** | Policy + 冻结 Action Experience（只读快照，禁止 Reflection 写回） |
| **C_static** | 不做 Reflection，经验库全程冻结在 S0（对照） |
| **D_online** | 每个任务后 Reflection，经验库 S0 → S1 → …（探索性） |

- **主指标 CDA**：`delegation_action ⇔ first_decision ∈ {DELEGATE, PARALLEL, WORKFLOW}`，与任务期望委派行为比对
- **H1**：`CDA_B − CDA_A ≥ 10pp`（Holm 校正后 p < 0.05）
- **H2**：`CDA_C_frozen − CDA_B ≥ 10pp`；**H2-null**：TOST，90% CI ⊆ ±5pp
- **E2A（Beneficial Action Change）**：决策确实变化 **且** 任务成功 **且** 无越界修改 **且** 成本不超上限
  （tokens ≤ 1.50 × baseline + 1000；subagent_calls ≤ baseline + 1）
- 样本量：Pilot 10 任务 × 3 次；正式 30–150（N_max = 150）；power 0.80；α_planning = 0.025

**冻结阈值（不得为让结果好看而调整）：** 相关性 0.30 / 0.60 / 0.80 · Top-K = 5 · 低相关上限 2 条 ·
经验上下文总预算 800 tokens · 单条经验 ≤ 160 tokens · lesson ≤ 60 字。

---

## 4. 当前状态：Phase 0 ✅ 已验收通过

Phase 0 的唯一目标是**证明我们能可靠地观察 Agent 的决策过程**（instrumentation + 基础运行闭环），
不做 Reflection、不做经验挖掘、不做 A/B、不跑正式数据。

**验收结果：5 个 dry-run 全部满足出口标准**

| run | 首决策 | 工具调用↔返回配对 | failure | replan | 五条验收 |
|---|---|---|---|---|---|
| DRY-01 冒烟测试 | DIRECT | 6/6 | 0 | 0 | ✅ |
| DRY-02 模块文档 | EXPLORE | 8/8 | 0 | 0 | ✅ |
| DRY-03 UI 升级 + 审查 | DELEGATE → ui-reviewer | 14/14 | 1 | 0 | ✅ |
| DRY-04 数据层双线 | PARALLEL → explorer + tester | 40/40 | 4 | 1（PARALLEL→REPLAN） | ✅ |
| DRY-05 失败修复 | EXPLORE → REPLAN | 10/10 | 2 | 1（EXPLORE→REPLAN） | ✅ |

五条出口标准全部 PASS：轨迹 schema 覆盖率 100% · tool call↔result 配对 100% ·
failure 可重建 · replan 可重建（含触发与前后决策）· **离线可完整重建决策链**
（Task → Task State → First Decision → Action → Tool/Subagent → Outcome）。

其他实测证据：

- 集合覆盖：7 个可重建 failure、2 个 replan、2 个 run 含真实 Subagent 委派
- 环境指纹：`harness 0.1.5-rc.3` · `tool_schema tschema-19751aa066b9` · `experiment_config_hash sha256:90227c3b…`
- 确定性测试 24/24 通过（冻结公式、质量门裁决规则、benchmark 判定、验收检查器）
- TypeScript 严格模式 0 error
- 20 条开放问题登记在案（12 条已由人裁决，8 条非阻塞待补）

**已知边界（如实记录，不作推测性结论）** 见 `experience-agent-v1/docs/phase0-acceptance-report.md`：
包括「采集中途读到过期快照」这一真实边界的发现与重采过程，以及一次 Node ESM/CommonJS 包作用域异常。

---

## 5. 目录结构

```
Agent Praxis/
├── README.md
├── LICENSE
└── experience-agent-v1/            # Phase 0 实现（TypeScript / Node 24，零运行时依赖）
    ├── spec/
    │   ├── frozen.md               # 冻结规格：架构 / Schema / 检索公式 / E2A / 质量门 / 快照
    │   ├── experiment-design.md    # 统计设计 / 样本量 / 假设 / 预算
    │   └── open-questions.md       # OQ 登记簿（追加式，含人工裁决原文）
    ├── tasks/phase0.md             # Phase 0 任务书 + 禁止事项 + 出口标准
    ├── core/                       # 冻结枚举与常量、Task State 直读、canonical JSON、
    │                               # experiment_config_hash、tool_schema_version
    ├── experience/                 # 经验 Schema、可靠性公式、检索链路、SQLite FTS5 存储、
    │                               # 只读快照、确定性质量门
    ├── agents/registry.ts          # 5 个 Subagent 的名字与职责（人工裁决冻结）
    ├── telemetry/                  # 会话解码、事件提取、轨迹组装、验收检查器、离线重放
    ├── benchmark/                  # 任务加载与判定（§9.2/§9.3）、dry-run 任务与经验 fixtures
    ├── policies/                   # B 臂 Policy 规则（Phase 0 有意留空）
    ├── scripts/                    # 一键运行：setup → judge → collect → accept
    ├── tests/                      # 确定性测试（无网络、无 LLM、无外部状态）
    ├── docs/                       # Phase 0 验收报告
    ├── snapshots/SNAPSHOT_01.db    # 只读经验快照
    └── telemetry/trajectories/     # 5 条 append-only 轨迹（实验事实证据）
```

---

## 6. 快速开始

```powershell
cd experience-agent-v1

# 依赖（使用工作区本地缓存）
npm install --cache "..\.npm-cache"

# 类型检查 + 确定性测试
npm run typecheck
npm test

# 播种 dry-run 工作区 + 经验 fixtures + 只读快照 SNAPSHOT_01
node scripts/dryrun-setup.ts

# 采集一条轨迹（需要一次真实 DSH 会话的 session id）
node scripts/dryrun-judge.ts   --task DRY-01 --primary <sessionId>
node scripts/dryrun-collect.ts --task DRY-01 --run-id run-YYYY-MM-DD-DRY-01 `
     --primary <sessionId> --judge dry-run-workspace/judge-DRY-01.json

# 全量验收 + 生成报告
node scripts/dryrun-accept.ts --write-report
```

验收报告入口：`experience-agent-v1/docs/phase0-acceptance-report.md`
（含五条检查明细、决策链重放、交付清单映射、待裁决项与已知边界）。

---

## 7. 工程纪律

1. **规格冻结**：不改架构假设、指标公式、阈值、枚举。想改 → 先改规格并留痕。
2. **不确定就问**：规格未定义之处写进 `spec/open-questions.md`；标记为 blocking 时停下等裁决，不猜。
3. **不提前做后面的事**：Phase 0 不做 Reflection / 经验挖掘 / 冲突裁定 / 语义门 / Benchmark / A/B / 正式跑数。
4. **可复现优先**：每条 run 记录 `experiment_config_hash` + `experience_snapshot_id` + 环境版本三元组。
5. **可重复验证**：验收、判定、重放全部是确定性代码，无 LLM 参与、无隐藏状态。

---

## 8. 路线图

```
Phase 0  观测与闭环          ✅ 已完成并验收（tag v0.1.0-phase0）
   ↓
Pilot    10 任务 × 3 次 × A/B/C  →  SD、检索与经验行为检查、Power Analysis
   ↓
正式实验  30–150 任务，H1 / H2 / H2-null + E2A，Holm 校正
   ↓
结论     经验是否真的改善工具编排决策（以及代价是多少）
```

详细阶段出口标准与逐项待办：
[`ROADMAP.md`](ROADMAP.md) ·
[Milestones](https://github.com/fei-hua/Agent-Praxis/milestones) ·
[Issues](https://github.com/fei-hua/Agent-Praxis/issues) ·
[Releases](https://github.com/fei-hua/Agent-Praxis/releases)

---

## 9. 许可

MIT License © 2026 fei-hua
