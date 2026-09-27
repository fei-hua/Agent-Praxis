# Frozen Specification — Experience-Driven Tool Orchestration (V1.0)

> **状态：FROZEN SPECIFICATION**
>
> 本项目已处于 Frozen Specification 阶段。
>
> - 不要自行修改架构假设
> - 不要增加额外 Memory / RAG / Vector DB / RL / Multi-model 等功能
> - 不要自行改变任何实验指标公式
> - 不要自行修改阈值
> - 不要自行定义新的 status / decision enum
>
> 任何规格未定义行为：**记录为 OPEN QUESTION**（见 `open-questions.md`），不要自行猜测并固化到代码。

---

## 0. 项目定位（冻结）

**项目名称**：`Experience-Driven Tool Orchestration`

**不是**：DeepSeek Memory / Agent Memory / Self-Improving Agent

**核心对象**：

```
Experience → Action Decision → Tool / Subagent Routing
```

**不是**通用长期记忆。

### 措辞禁忌（必须遵守）

```
❌ "模型已经学会……"
❌ "Agent 从经验中学习……"
❌ "越调用 Subagent 越好"

✅ "检索到的经验性条件化（retrieved experiential conditioning）"
✅ "在相同任务下，是否因为过去的行动经验而做出不同且更合理的路由决策"
```

### 范围边界（冻结）

```
✅ DeepSeek V4.1
✅ DeepSeek Harness（作为执行底座，不另造 Runtime）
✅ Task State / Experience Retrieval / Action Decision
✅ Subagent Delegation / Verification / Reflection
✅ Experience Quality Gate / Trajectory Logging / Benchmark

❌ 多模型
❌ 微调
❌ RL
❌ 向量数据库
❌ 新 Agent Runtime
❌ 超复杂 Memory
❌ 自动无限学习
❌ V1 期间的自动 Conflict Triage（人工/半自动）
```

### Related Work（定位参考）

Reflexion / ExpeL / Agent Workflow Memory / Voyager / Letta Code / Deep Agents / DeepSeek Harness

**不声称**「让 Agent 从经验中学习」；范围是 Coding Agent 的 Tool/Subagent Routing。

---

## 1. 系统架构

```
                 DeepSeek V4.1
                       │
                       ▼
              首轮输出 Task State
                       │
                       ▼
              Experience Retrieval
                       │
                       ▼
                 Action Decision
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
        DIRECT    EXPLORE      DELEGATE
                                     │
                              PARALLEL / WORKFLOW
          └────────────┬─────────────┘
                       ▼
                    EXECUTE
                       │
                       ▼
                    VERIFY
                       │
                 ┌─────┴─────┐
                 ▼           ▼
                PASS        FAIL
                 │           │
                 ▼           ▼
                DONE       REPLAN
                 │           │
                 └─────┬─────┘
                       ▼
                  REFLECTION          ← 触发规则决定是否真正执行
                       │
                       ▼
                EXPERIENCE GATE
                       │
                       ▼
                 EXPERIENCE STORE
                       │
                       └────→ 下一次任务
```

> **注**：`DONE` 与 `REPLAN` 都指向 `REFLECTION`，由触发规则（§7）决定是否执行。
> 不是「只有失败才反射」。

---

## 2. Task State Schema（冻结）

主 Agent **首轮正常推理中顺带输出**（不是额外 LLM 调用）。

```json
{
  "schema_version": "1.0",
  "task_state": {
    "task_type": "ui_upgrade",
    "complexity": "high",
    "characteristics": ["multi_page", "multi_file"],
    "scope": "project",
    "constraints": ["routing_immutable"],
    "first_decision": "DELEGATE"
  }
}
```

### 2.1 字段约束

| 字段 | 类型 | 取值 | 说明 |
|---|---|---|---|
| `task_type` | string | 受控词表 | 例：`ui_upgrade` / `bugfix` / `refactor` / `data_layer` / `test` / `doc` |
| `complexity` | enum | `simple` / `medium` / `high` | 三级 |
| `characteristics` | string[] | 受控词表 | 例：`multi_page` / `multi_file` / `shared_state` / `new_module` |
| `scope` | enum | `project` / `generic` | `project`=仅同项目；`generic`=可跨项目 |
| `constraints` | string[] | **只能从 enum 选** | 见 §2.3，空数组合法 |
| `first_decision` | enum | 见 §2.2 | **代码直接读取** |

### 2.2 `first_decision` enum（唯一一套，禁止扩充）

```
DIRECT     = 主 Agent 直接执行任务
EXPLORE    = 主 Agent 先进行项目/信息探索
DELEGATE   = 委派一个或多个 Subagent，但不属于并行编排
PARALLEL   = 两个或以上独立 Subagent 并行
WORKFLOW   = 使用 Harness Workflow 编排多步骤/多 Agent
VERIFY     = 当前任务以验证已有结果为第一行动
REPLAN     = 在已有失败状态下重新规划
```

**不出现** `TOOL` / `SUBAGENT` 等其他枚举。架构图与 Schema 使用同一套。

**提取方式**：

```
first_decision ← task_state.first_decision（代码读取）
```

**绝对禁止**：任务执行完后让另一个 LLM 看轨迹猜「第一次到底想干什么」。
（否则 E2A 变成 judge-dependent，两个 judge 会给出不同结果。）

`first_tool_call` 同时记录，但 **E2A 只依据 `first_decision` 与高层 delegation plan**。

### 2.3 `constraints` 受控词表

```
routing_immutable
data_schema_immutable
api_immutable
scope_limited
no_new_dependency
no_public_interface_change
```

自然语言「不能修改路由」**必须先映射成** `routing_immutable`，不允许直接拿自然语言做 Jaccard。

> **自由文本的 Jaccard 毫无意义**（「不能改路由」vs「routing_immutable」→ 交集为 0）。
> 映射由 Task State 输出时完成，受 enum 约束（与 `characteristics` 同规则）。

---

## 3. Experience Schema（冻结）

```yaml
id: EX-017
status: active                    # candidate|validated|active|stale|deprecated|conflict|rejected
scope: project                    # project | generic
task_type: ui_upgrade
complexity: high
characteristics: [multi_page, multi_file]
constraints: [routing_immutable]

situation: 多页面 UI 同时需要改布局与导航，且存在共享状态
decision: DELEGATE
delegation:
  mode: parallel                  # serial | parallel | workflow
  agents: [ui-designer, ui-reviewer]

outcome:
  success: true
  task_success_criteria_met: true
  forbidden_violation: false
  tokens: 4200
  subagent_calls: 2
  wall_time_s: 310

evidence:
  run_id: run-2026-09-18-0031
  trajectory_ref: telemetry/trajectories/run-2026-09-18-0031.jsonl
  harness_version: 0.x.y
  tool_schema_version: 1
  framework_version: 1.0
  evidence_complete: true

lesson: >
  多页面 UI 修改前先逐页探索，并让独立 reviewer 检查跨页一致性
contraindications:
  - shared_state                  # 命中此条则不应照搬本经验
conflict_count: 0
independent_support: 3
```

### 3.1 字段说明

| 字段 | 含义 |
|---|---|
| `independent_support` | 支持该经验的**不同 task_id 且不同代码变更**数量 |
| `conflict_count` | 与该经验冲突的记录数 |
| `contraindications` | 命中即不应照搬本经验的条件（受控词表，同 `characteristics`） |
| `evidence_complete` | `run_id` + `trajectory_ref` + `outcome` 三者齐全 |
| `lesson` | **≤ 60 字**（受 token 预算约束，§5.7） |

---

## 4. Experience Lifecycle

```
candidate ──► validated ──► active
                │              │
                ▼              ▼
              stale  ◄─────────┘
                │
                ▼
            deprecated
```

并行状态：`conflict` / `rejected`

### 4.1 状态迁移

| 迁移 | 条件 | 执行者 |
|---|---|---|
| → `candidate` | Reflection 产出且通过 Quality Gate | 代码 |
| `candidate` → `validated` | `independent_support ≥ 2` 且无冲突 | 代码 |
| `validated` → `active` | `independent_support ≥ 3` | 代码 |
| → `stale` | 超过 N 个任务未被命中，或环境版本变化 | 代码 |
| → `deprecated` | 人工标记 / 连续反证 | 人工 |
| → `conflict` | 检测到与现有经验直接矛盾 | 代码 |
| → `rejected` | Quality Gate 未通过 | 代码 |

### 4.2 检索参与（已冻结）

```
deprecated / rejected / conflict  →  不参与检索（权重 0）
candidate / validated / active / stale  →  可参与检索
```

**没有 `status_weight` 乘法因子。** Candidate 的低影响力来自 `independent_support = 1`（见 §5.4），不是额外降权。

> **设计意图（必须写进代码注释）**：
> candidate 可以参与检索，但由于独立支持数不足，其 reliability 上限较低；
> 因此 candidate 在设计上通常只能提供低置信参考，不应被解释为高权威经验。
> **若 candidate 无法达到高置信，这是预期行为，不是 bug。**

---

## 5. Experience Retrieval

### 5.1 总览

```
Eligibility Filter (scope)
        │
        ▼
Structured Match  +  Lexical Match (FTS5/BM25)
        │
        ▼
   relevance_score
        │
        ▼
   reliability_score
        │
        ▼
 contraindication_factor
        │
        ▼
    final_score  →  Top-K = 5  →  阈值过滤  →  序列化进上下文
```

### 5.2 Eligibility Filter（scope）

```
scope = project  →  只在同项目内检索
scope = generic  →  可跨项目
```

`scope` **不参与相似度计算**，只做硬过滤（不混淆「适用范围」与「相似程度」）。

### 5.3 `structured_match`（冻结）

```
structured_match =
    0.35 × task_type_match
  + 0.15 × complexity_match
  + 0.30 × characteristics_jaccard
  + 0.20 × constraints_jaccard
```

| 分项 | 计算 |
|---|---|
| `task_type_match` | 相同 = 1.0；否则 = 0.0 |
| `complexity_match` | 相同 = 1.0；相邻 = 0.5；跨两级 = 0.0 |
| `*_jaccard` | `|A ∩ B| / |A ∪ B|`，**`A = B = ∅` → 1.0**（避免 NaN） |

范围：`structured_match ∈ [0, 1]`

### 5.4 `reliability_score`（冻结，纯确定性，代码计算）

```
support_factor    = 1 − exp(−independent_support / 2)

conflict_rate     = min( 1, conflict_count / max(1, independent_support) )
conflict_factor   = 1 − conflict_rate

environment_factor =
    1.0   harness/tool_schema 完全兼容（同 major，tool_schema 相同）
    0.7   minor-compatible（同 major，tool_schema 小改）
    0.3   major 不兼容但仍可解析
    0.0   不可用（结构性变化，经验无法解析）

reliability_score = support_factor × conflict_factor × environment_factor
```

**`reliability_score` 由代码计算，Reflection 不得填写此字段。**

| independent_support | reliability（无冲突、环境匹配） |
|---:|---:|
| 1 (candidate) | 0.393 |
| 2 (validated) | 0.632 |
| 3 (active) | 0.777 |
| 4 | 0.865 |
| 10 | 0.993 |

### 5.5 `lexical_match`（冻结）

**标定必须在最终 `SNAPSHOT_01` 上做，绝不能在 Acquisition 生长过程中做。**

```
Acquisition 全部结束
   → Store 定稿
   → SNAPSHOT_01
   → 在 SNAPSHOT_01 上跑 Acquisition Set 的查询，收集 raw_bm25
   → 得到 P05 / P95
   → FREEZE
```

**标定查询集 = Acquisition Set 的任务查询。**
不允许 Validation / Transfer / Pilot 参与标定（避免 Evaluation Leakage）。

```
lexical_match = clamp( (P95 − raw_bm25) / (P95 − P05), 0, 1 )
```

> SQLite FTS5 的 `bm25()` **越低越相关**，故 `(P95 − raw)` 方向正确。

若 `P95 == P05`：

```
matched   → 1.0
unmatched → 0.0
```

无命中：`lexical_match = 0`

### 5.6 `relevance_score` 与 `contraindication_factor`

```
relevance_score = 0.60 × structured_match + 0.40 × lexical_match     ∈ [0,1]

contraindication_factor = 1 − matched_count / max(1, total_count)    ∈ [0,1]
```

其中 `total_count` = 该经验所有 contraindications 数量。

```
无禁忌       → 1.0
命中 1/3     → 0.667
全部命中     → 0.0
（防御性：clamp 到 [0,1]，避免 matched > total 时为负）
```

**禁忌命中判定（OQ-004 人工裁决，2026-09-27）**：

```
contraindication_hit  ⇔  token ∈ task.characteristics
```

即按 token **精确匹配**（受控词表内比较，二值相似度 1.0 / 0.0）。
命中判定与 `structured_match` 无关——**不得**再使用
`structured_match(当前任务, 该禁忌) ≥ 0.60` 作为判定式。

```
matched_count = 命中的 contraindication token 数量
```

实现说明：二值相似度仍经冻结阈值 `contraindication_hit_threshold = 0.60` 判定
（1.0 ≥ 0.60 记为命中，0.0 < 0.60 记为不命中）；该阈值是 §5.4 体系内的冻结常量，
不因本次文字同步而改变。

**规格同步记录**：本节原文（“`structured_match(当前任务, 该禁忌) ≥ 0.60` 记为命中”）与 OQ-004
人工裁决直接冲突，已于 2026-09-27 按裁决同步。代码 `experience/retrieval.ts`
（`ruledContraindicationSimilarity` / `isContraindicationHit`）自始按裁决实现，无需改动。

### 5.7 `final_score`、Top-K 与序列化

```
final_score = relevance_score × reliability_score × contraindication_factor
```

```
Top-K = 5
final_score < 0.30  →  不进入主 Agent 上下文
LOW_RELEVANCE 最多 2 条
单条 Experience ≤ 160 tokens
总 Experience Context ≤ 800 tokens
```

**序列化格式**（不发整个 YAML）：

```
[EX-017]
task_type: ui_upgrade
characteristics: multi_page,multi_file
decision: DELEGATE
lesson: 多页面 UI 修改前先探索并独立审查
contraindications: shared_state
reliability: 0.77
```

`lesson ≤ 60 字`，超长截断。

> **简单任务额外 LLM call = 0**（无 Task Interpreter 额外调用）。
> 同时：简单任务最多额外插入约 800 tokens 的经验上下文。两者都可测。

### 5.8 `retrieval_status`（只表示相关性）

**语义拆分已完成**：`retrieval_status` 只描述「这条经验与当前任务像不像」；
可信程度单独由 `reliability_score` 表示。

```
relevance < 0.30            → NO_MATCH
0.30 ≤ relevance < 0.60    → LOW_RELEVANCE
0.60 ≤ relevance < 0.80    → MATCHED
relevance ≥ 0.80            → HIGH_RELEVANCE
```

> **注意**：`retrieval_status` 由 **relevance** 决定，不由 `final_score` 决定。
> 经验可以 `HIGH_RELEVANCE` 但仍因低 reliability 而 `final_score < 0.30` 被丢弃。
> 这是两个独立维度：
>   Relevance = 「像不像」；Reliability = 「过去被多少独立证据支持」。

### 5.9 检索时机（冻结）

```
首次：
    User Task → Task State → Experience Retrieval → first_decision → 执行

失败后（REPLAN）：
    Failure → 更新 Task State → 最多再检索一次 → Replan

子 Agent：
    V1 中 Subagent 不独立检索 Experience。
    需要时由主 Agent 把相关经验作为任务上下文传给子 Agent。
    （避免"主 Agent 一个经验、Subagent 又检索出另一个"造成不可解释）
```

**E2A 只看第一次决策。** 第二次检索可影响后续行动，用于 Recovery Metrics，不影响 `first_decision`。

---

## 6. Experience Quality Gate（双层）

### 6.1 Deterministic Gate（代码优先，必须先过）

```
schema 完整性
enum 合法性
provenance 完整（run_id / trajectory_ref / outcome）
task_id 存在
trajectory reference 可解析
outcome 记录存在
duplicate 检测
exact conflict 检测
version 字段存在
```

### 6.2 Semantic Gate（模型判断，输出固定 schema）

```json
{
  "generalizable": true,
  "applicability_clear": true,
  "outcome_relevant": true,
  "overgeneralized": false,
  "contradiction_detected": false,
  "evidence_sufficient": true,
  "reason": "..."
}
```

**Quality Gate 的质量不能完全交给 LLM 自己说了算**——Deterministic 层优先，语义层只做代码判不了的部分。

```
Candidate → Quality Gate → Validated → Active
```

### 6.3 Conflict Triage（V1：人工/半自动）

```
Conflict Queue → 人工 / 半自动 triage
```

**V1 不做自动 Conflict Agent。** 理由：

> 我们现在真正需要验证的是「Experience 是否改善工具路由」，
> 不是「我们的经验数据库管理系统多么先进」。

Triage 触发：每 5 个复杂任务一次。

结果枚举：`MERGE / SPLIT_BY_CONDITION / KEEP_BOTH / DEPRECATE_A / DEPRECATE_B / UNRESOLVED`

同一适用条件下 ≥3 条 UNRESOLVED → 自动降权。

等 Phase 1 证明 Experience 值得继续投入，再自动化。

---

## 7. Reflection 触发规则（冻结）

```
Simple  + Success    → 不执行（额外 LLM call = 0）
Medium  + Success    → 默认不执行
Complex + Success    → 执行 1 次
Failure              → 执行 1 次
Novel trajectory     → 执行 1 次
```

> **架构图上 `DONE` 与 `REPLAN` 都连到 `REFLECTION`**，
> 但是否真正执行由本节规则决定。不是「只有失败才反射」。

---

## 8. Trajectory Logging / Telemetry

**复用 DeepSeek Harness 现有能力，不另造 Runtime。**

Harness Session 本身是 append-only typed event log，包含 `tool/call`、`tool/result` 等事件，
可从 session event 流观察。Workflow 负责模型请求的编排脚本，Subagent 是独立委派能力。

**因此 Phase 0 直接在 Harness 事件层做 trajectory recorder，不解析最终聊天文本。**

### 8.1 每次 Run 必须记录

```
run_id
task_id
arm                              # A | B | C_frozen | C_static | D_online
task_state (含 first_decision)
first_tool_call
experience_snapshot_id
retrieved_experiences[]          # 含 final_score / retrieval_status
tool_calls[] / tool_results[]
subagent_invocations[]
verification_result
reflection_output (若有)
outcome (tokens / subagent_calls / wall_time)
harness_version / tool_schema_version / framework_version / model_id
experiment_config_hash
```

### 8.2 目录结构（冻结）

```
experience-agent-v1/
├── core/           # 运行闭环、Task State、Decision
├── experience/     # Schema、Store、Retrieval、Quality Gate、Snapshot
├── agents/         # 5 个 Subagent 定义
├── telemetry/      # Event Collector、Trajectory Recorder
├── benchmark/      # 任务定义、success_criteria、统计
├── policies/       # Policy 规则（B 臂）
└── docs/           # 本规格与相关文档
```

---

## 9. Benchmark Task YAML（人工提前写，不得由开发 AI 临时解释）

```yaml
id: TASK-023
category: C                       # A|B|C|D|E（见下）
task_type: ui_upgrade
complexity: high
characteristics: [multi_page, multi_file]
constraints: [routing_immutable]
scope: project

expected_first_decisions:
  - DELEGATE

expected_delegation: true         # 由 expected_first_decisions 推出

success_criteria:
  required:
    - build_pass
    - target_behavior_correct
  forbidden:
    - unrelated_file_changed
    - routing_changed

expected_files:
  - src/ui/w2.c
allowed_paths:
  - src/ui/**
protected_paths:
  - src/navigation/**
  - src/data/**
```

### 9.1 任务类别（Benchmark 分布）

```
A Simple     6    expected_first_decision: DIRECT
B Explore    6    expected_first_decision: EXPLORE
C Delegate   6    expected_first_decision: DELEGATE / PARALLEL / WORKFLOW
D Parallel   6    expected_first_decision: PARALLEL / WORKFLOW
E Recovery   6    expected_first_decision: REPLAN
```

> **注意**：每类仅 6 个任务，**分类别做不了显著性检验**。分类别只报均值，整体才做检验。

### 9.2 Success 判定（纯代码）

```
成功 ⇔ 所有 required = PASS  AND  所有 forbidden = FALSE
```

### 9.3 Forbidden 判定（纯代码，不交给 LLM）

运行后：

```
git status --porcelain      # 含未跟踪新文件
git diff
```

```
unrelated_file_changed  ⇔  changed_file ∉ allowed_paths
routing_changed         ⇔  protected_paths 中任意文件发生 diff
```

> **注意**：`git diff` 默认不含未跟踪新文件，必须用 `git status --porcelain`
> 或 `git add -A && git diff --cached` 才能抓到新建的无关文件。

---

## 10. Snapshot 冻结流程（实验可复现性的核心）

```
Acquisition Set (20 tasks)
        │
        ▼
Experience Store 定稿
        │
        ▼
   SNAPSHOT_01
        │
        ▼
 BM25 Calibration（在 SNAPSHOT_01 上）
        │
        ▼
   P05 / P95 FREEZE
        │
        ▼
========================
正式评测开始（只读）
========================
        │
   A / B / C_frozen 只读 SNAPSHOT_01
        │
   禁止 Reflection 写回 SNAPSHOT_01
```

每次 run 记录 `experience_snapshot_id`。

**若不锁快照，配对反事实不成立**（第 1 个 run 用经验库 v0，第 30 个用 v7，90 次 run 之间不可比）。

---

## 11. Harness 集成方式

| 能力 | 用途 | 来源 |
|---|---|---|
| Session events (`tool/call`, `tool/result`, `session/event`) | Trajectory Recorder 的数据源 | Harness Core |
| `agent()` | Subagent 委派 | Harness Subagent |
| `workflow()` / `pipeline()` / `parallel()` / `phase()` | 多 Agent 编排（WORKFLOW / PARALLEL 决策） | Harness Workflow |
| Skills | 复用已有能力 | Harness Skill |

**不重写 runtime，不做新的 Agent 框架。**

---

## 12. 禁止事项（给开发 AI 的硬约束）

```
❌ 自动 Reflection（Phase 0 不做）
❌ 自动 Experience Mining（Phase 0 不做）
❌ 自动 Conflict Triage（V1 不做）
❌ 正式 Benchmark（Phase 0 不做）
❌ A/B 实验（Phase 0 不做）
❌ 360 / N_formal runs（Phase 0 不做）
❌ Vector DB / Embedding / RAG 框架
❌ 微调 / RL / 多模型
❌ 自行定义新的 enum / status / decision 值
❌ 自行修改任何指标公式或阈值
❌ 自行解释 success_criteria
❌ 事后用 LLM 猜 first_decision
```

---

## 13. 遇到规格未定义行为时

**不要猜。不要固化到代码。**

→ 记录到 `spec/open-questions.md`（格式见该文件），然后：

```
blocking: true   → 停在受影响模块，等人工裁决
blocking: false  → 记 TODO，继续其他不受影响的工作
```

目标 SLA：人工 24 小时内给答复（项目管理目标，非程序机制）。

---

## 14. 本规格中标注为「补丁」的条目

以下条目为规格评审阶段提出的补充，与主体一同冻结。若你（指派的开发负责人）
不同意其中任何一条，**必须**在 `open-questions.md` 中开 OQ 并停下，不要自行改写：

| # | 补丁 | 位置 |
|---|---|---|
| P1 | `environment_factor` 的 minor/major 边界采用 semver | §5.4 |
| P2 | `contraindication_factor` 与 `retrieval_status` 必须与 `final_score` 同节实现 | §5.6 / §5.8 |
| P3 | Dry-run + Pilot 的 runs 计入 `EXPERIMENT_BUDGET` | `experiment-design.md` §10.3 |
| P4 | `C_static` 跑相同 Reflection 代码路径但丢弃产出 | `experiment-design.md` §6 |
| P5 | `lesson ≤ 60 字`（160 token/条硬约束） | §5.7 |
| P6 | BM25 标定查询来自 Acquisition，与 Validation 分布可能不同 —— 写入 Limitations | §5.5 |
