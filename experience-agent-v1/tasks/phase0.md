# Phase 0 — Development Brief

> **这是第一批唯一需要交给开发 AI 的文件。**
> `spec/frozen.md` 与 `spec/experiment-design.md` 作为附件，遇到不确定时查阅。
>
> **不要把三份文档一次性丢给开发 AI。** 它会照单全收，包括尚未定的定义，
> 然后按字面实现成硬编码。分批交付，让它有机会停下来问你。

---

## 🚫 禁止自行发挥（必须放在任务最前面）

```
本项目已处于 Frozen Specification 阶段。

不要自行修改架构假设。
不要增加额外 Memory、RAG、Vector DB、RL、Multi-model 等功能。
不要自行改变任何实验指标公式。
不要自行修改阈值。
不要自行定义新的 status / decision enum。

任何规格未定义行为：
    记录为 OPEN QUESTION（spec/open-questions.md），
    不要自行猜测并固化到代码。

Phase 0 只做 instrumentation 和基础运行闭环。
```

**理由**：现在最大的风险不是「想得不够多」，而是「开发 AI 觉得自己聪明，
擅自替你改设计」。

---

## 1. Phase 0 的唯一目标

> **证明我们能准确记录 DeepSeek 是怎么做决定、怎么调用工具、
> 怎么调用 Subagent、最后发生了什么。**

```
第一版最重要的不是「把 Agent 做得很聪明」，
而是「把 Agent 每次为什么选择这个工具、为什么委派、结果如何、
     经验是否改变了下一次选择，完整、可重复地记录下来」。
```

**不要在这个阶段追求智能，追求可观察性。**

---

## 2. 交付清单（10 项）

### T1. Harness Event Collector

在 Harness Session 事件层订阅 `tool/call`、`tool/result`、`session/event`。
**不解析最终聊天文本。**

### T2. Trajectory Recorder

把事件流落成 append-only typed JSONL，一次 run 一个文件：

```
telemetry/trajectories/{run_id}.jsonl
```

必须能离线重建：

```
Task → Task State → First Decision → Action → Tool/Subagent → Outcome
```

### T3. Task State

主 Agent 首轮**顺带**输出结构化 Task State（不是额外 LLM 调用）。
Schema 见 `spec/frozen.md` §2。

`first_decision` 是必填 enum，**代码直接读取 `task_state.first_decision`**。

### T4. Experience Schema

见 `spec/frozen.md` §3。包含 `independent_support` / `conflict_count` /
`contraindications` / `evidence` 等字段。

**`reliability_score` 不在 schema 中由 Reflection 填写**，由代码按 §5.4 公式计算。

### T5. Deterministic Quality Gate

只做代码可判的部分（见 `spec/frozen.md` §6.1）：

```
schema / enum / provenance / task_id / trajectory ref / outcome
/ duplicate / exact conflict / version
```

**Phase 0 不做 Semantic Gate（那是 Phase 1）。**

### T6. Experience Store + Basic Retrieval

SQLite + FTS5。检索实现 `spec/frozen.md` §5 的完整公式：

```
structured_match → relevance_score → reliability_score
→ contraindication_factor → final_score → Top-K=5 → 阈值 0.30
```

**Phase 0 阶段 BM25 的 P05/P95 可以先用占位常数**，
但**标定代码路径必须存在**，Phase 1 在 SNAPSHOT_01 上跑正式标定。

### T7. 5 个 Subagent

按 benchmark 任务类别 A–E 配置（见 `spec/frozen.md` §9.1）：

```
DIRECT / EXPLORE / DELEGATE / PARALLEL / WORKFLOW / VERIFY / REPLAN
对应的最小可用 Subagent 集合
```

**Phase 0 只要求「能被调用并记录」，不要求智能。**

### T8. Task State → First Decision logging

`first_decision` 必须出现在 trajectory 中，且可被代码直接索引。

### T9. Snapshot 机制

```
Experience Store → SNAPSHOT_01（只读）
```

每次 run 记录 `experience_snapshot_id`。
**Phase 0 不做 BM25 正式标定，但 Snapshot 只读语义必须实现。**

### T10. 5 Dry-run verification

见 §4。

---

## 3. Phase 0 明确不做

```
❌ 自动 Reflection
❌ 自动 Experience Mining
❌ 自动 Conflict Triage
❌ Semantic Quality Gate
❌ 正式 Benchmark
❌ A/B 实验
❌ 360 / N_formal runs
❌ BM25 正式标定（Phase 1 在 SNAPSHOT_01 上做）
❌ Monte Carlo 功效仿真（Phase 1 做）
❌ Transfer 实验
❌ D_online / C_static 实验
```

**原因**：Phase 0 唯一目标是「证明数据链路完整」。
先把 Observation 做对，再谈 Intervention。

---

## 4. Phase 0 出口标准（必须全部满足）

### 4.1 Dry-run Set

```
5 个任务，独立于 Pilot Set（Dry-run ∩ Pilot = ∅）
```

### 4.2 验收项（任一失败 → Phase 0 不通过，不得进入 Pilot）

```
1. trajectory schema coverage = 100%
   （所有必填字段都存在，无缺失）

2. tool/call ↔ tool/result pairing = 100%
   （无孤立的 tool/call 或 tool/result）

3. failure event 可重建
   （从 trajectory 能还原失败原因与上下文）

4. replan event 可重建
   （从 trajectory 能还原 replan 的触发与前后决策）

5. 每个 run 能离线重建：
   Task
   → Task State
   → First Decision
   → Action
   → Tool / Subagent
   → Outcome
```

### 4.3 额外建议验收（不阻塞，但请报告）

```
- experience_snapshot_id 在每次 run 中都存在
- first_decision 可被代码直接索引（不需要解析自然语言）
- trajectory 文件可被独立脚本重放
- 5 个 Subagent 的调用与返回都被记录
```

### 4.4 不通过的处理

**不允许**「差不多了就进 Pilot」。

Phase 0 不通过 → 修 → 重新 dry-run → 重新验收。

---

## 5. Pilot 的职责（Phase 0 之后，此处仅为预告）

Phase 0 验收通过后，进入 Pilot：

```
Pilot = 10 tasks × 3 reps × 3 arms (A / B / C_frozen) = 90 runs

输出：
    s_BA, s_CB                      （任务级 paired SD）
    N_required_H1, N_required_H2    （解析公式）
    N_simulation                    （Monte Carlo，规格见 experiment-design.md §5.8）
    candidate_retrieval_rate
    candidate_context_inclusion_rate
    retrieval_status_distribution
    average experience tokens
    实际 token/run / latency/run     （用于计算 EXPERIMENT_BUDGET）
```

**Pilot 不参与正式假设检验。** Pilot 只决定「要做多少正式任务」。

---

## 6. 工程约束

### 6.1 复用 Harness，不另造 Runtime

```
✅ Session events（tool/call, tool/result, session/event）→ Trajectory 数据源
✅ agent()         → Subagent 委派
✅ workflow() / pipeline() / parallel() / phase()  → WORKFLOW / PARALLEL 决策
✅ Skills

❌ 新 Agent 框架
❌ 新 Runtime
❌ 自己实现事件总线
```

### 6.2 目录结构（冻结）

```
experience-agent-v1/
├── core/
├── experience/
├── agents/
├── telemetry/
├── benchmark/
├── policies/
└── docs/
```

### 6.3 每次 run 必须记录

```
run_id / task_id / arm
task_state（含 first_decision）
first_tool_call
experience_snapshot_id
retrieved_experiences[]（含 final_score / retrieval_status）
tool_calls[] / tool_results[]
subagent_invocations[]
verification_result
reflection_output（若有）
outcome（tokens / subagent_calls / wall_time）
harness_version / tool_schema_version / framework_version / model_id
experiment_config_hash
```

---

## 7. 开工第一件事

**先开 OQ 问「实现语言/技术栈」。**

规格未指定。SQLite FTS5 已定，但 Python / Node / 其他未定。
在这一点确定之前，不要写任何代码。

随后第二个 OQ：`task_type` / `characteristics` / `constraints` 的完整受控词表
（规格给了示例，完整清单需在 Acquisition 之前定稿）。

---

## 8. 交接清单（给接手的人）

| 文件 | 内容 | 何时读 |
|---|---|---|
| `tasks/phase0.md`（本文件） | Phase 0 任务书 + 禁止事项 | **开工第一份** |
| `spec/frozen.md` | 架构、Schema、检索公式、E2A、Quality Gate、Snapshot | 实现时随时查 |
| `spec/experiment-design.md` | 统计设计、样本量、假设、预算 | Phase 1 开始前必读 |
| `spec/open-questions.md` | 开放问题登记 | 遇到不确定就写 |

**交付顺序**：

```
第 1 批：tasks/phase0.md
         （+ spec/frozen.md 作为附件）

第 2 批：Phase 0 验收通过后
         → 交出 spec/experiment-design.md
         → 进入 Pilot
```

---

## 9. 最后提醒

> **不要为了让实验结果更漂亮而改变阈值、经验库、检索算法或任务判定。
> 所有这些都必须在正式实验开始前冻结。**

Phase 0 只能决定：**数据链路是否完整。**

Phase 0 **不能**决定：「这样检索效果不好，我们改个公式吧。」

**先做对观察，再谈改进。**
