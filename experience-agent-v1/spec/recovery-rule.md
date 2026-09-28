# Infrastructure / Collection Error 恢复规则 v1（人工冻结，2026-09-27）

> 适用对象：Pilot / Formal 阶段中，某个 **planned cell**（`task × replicate × arm`）的运行失败。
> 目的：给真实的基础设施故障一条**合法补跑路径**，同时**杜绝"重跑到漂亮为止"的选择性重跑**。

## 1. 适用范围（同时满足）

```text
class ∈ { infrastructure, collection_error }
且已明确确认：问题不是 Agent 行为失败
```

分类口径（不得混合）：

| class | 含义 | 是否可走本规则 |
|---|---|---|
| `infrastructure` | 执行环境不可用（沙箱、会话、拓扑、日志落盘等） | ✅ |
| `collection_error` | 采集/协议/契约导致无法形成正式 observation | ✅ |
| `CONFIG_MISMATCH` | 声明 manifest 与运行时不一致 | ✅（同属基础设施类） |
| Agent FAIL | 任务判定为失败（`verify` 给出 FAIL） | ❌ **这就是结果，不得重跑** |

## 2. 原 run 的处置

```text
保留原 run（永不删除、永不覆盖）
counted = false
不采集为正式 observation
原始证据永久留存（session id / 事件 / envelope / 校验器 issues）
```

原 run 中的任何 Agent 行为（例如 `first_decision`）**不进入 CDA，也不进入任何统计**；
**不得回填为 0 或任何值**。

## 3. Replacement（每个 cell 最多 1 次）

同一个 `task × replicate × arm` 最多允许 **1 次** replacement run，且必须：

```text
同 task_id
同 replicate
同 arm
同 frozen manifest cell（arm_order_index / group_id 不变）
新 run_id
全新 session
全新 workspace（重新 seed，确定性重建）
使用**当时已经冻结**的协议 / collector
receipt 记录 replacement_of = <original_run_id>
```

## 4. 再次失败的处理（禁止无限重试）

若 replacement 再次落入 `infrastructure` / `collection_error`：

```text
该 cell 标记：UNRESOLVED_INFRASTRUCTURE
暂停正式 Pilot，先处理环境/基础设施问题
不再自动重试
```

## 5. 明确禁止

- 不得因"结果不理想"而重跑（Agent FAIL 一律不得重跑）；
- 不得通过重复运行直到成功来筛选结果；
- 不得为凑 `planned = collected` 而修改 checker / ground truth / Policy / Experience / retrieval / CDA；
- 不得修改已冻结的协议契约来"迎合"某次运行结果（协议修改只服从契约漂移修复，且必须重新过 contract test）。

## 6. 首次适用记录

| cell | 原 run | class | replacement run | 状态 |
|---|---|---|---|---|
| `PILOT-A01 \| R1 \| A` | `pilotdry-PILOT-A01-R1-A` | `collection_error`（orchestrator_prompt_defect：协议块未枚举 `constraints` 词表 ⇒ 会话内无合法 task_state） | 待执行（协议修复 + `PROTOCOL_CONTRACT_TEST` 通过后，仅此 1 次） | 原 run `counted=false`，其 `first_decision=EXPLORE` 永不进入 CDA |
