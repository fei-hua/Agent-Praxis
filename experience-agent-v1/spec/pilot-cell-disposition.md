# Pilot cell final disposition（本次既有事件的结账记录）

> **这不是新的 Recovery Rule。** Recovery Rule v1（`spec/recovery-rule.md`）保持不变、未被扩展。
> 本文件只记录**已经发生的事件的最终处置**。

## 处置

| 项 | 值 |
|---|---|
| cell | `PILOT-A01 \| R1 \| A` |
| original run | `pilotdry-PILOT-A01-R1-A` → `collection_error` / `orchestrator_prompt_defect`（协议块未枚举 `constraints` 词表 ⇒ 会话内无合法 task_state）→ `counted=false` |
| replacement run | `pilotdry-PILOT-A01-R1-A-rep1` → `infrastructure` / `no_session_created`（启动器无法写 `DSH_HOME` ⇒ headless 未启动）→ `counted=false` |
| **final status** | **`EXCLUDED`** |
| `exclusion_class` | `UNRESOLVED_INFRASTRUCTURE` |
| `counted` | `false` |
| 再次重试 | **不允许**（Recovery Rule v1 的 1 次 replacement 已用尽） |
| frozen manifest | **未修改**（`planned_cells = 30` 保持） |

两个 run 的全部原始证据保留（`pilot-runs/infra-failures.jsonl`、`replacements.json`、两份 `.exec.log`）。
原始 run 的 `first_decision = EXPLORE` **不进入任何统计**，也**不得回填**为 0 或任何值。

## 为什么不追加第三次机会

Recovery Rule v1 在第一次 replacement 失败后**已经生效完毕**。此刻再因"环境已修好"而追加第三次机会，
本质上是**在看到具体失败之后修改规则**——这比少一个有效 cell 更伤实验可信度。

## 账面（最终对账口径）

```text
planned_cells  = 30      （frozen manifest 不变）
valid_cells    = 29
excluded_cells = 1
missing_cells  = 0       （30 个 planned cell 都有最终处置状态）
unexpected_cells = 0
```

`missing = 0` 表示**每个计划 cell 都有最终处置**，不表示每个 cell 都有有效 observation。

## 对统计的影响（不做任何插补）

```text
H1 pilot SD（B − A）：基于实际存在的 9 个 paired observations（A01/R1/A 缺失）
H2 pilot SD（C − B）：基于实际存在的 10 个 paired observations
```

不得插补；不得把缺失的 A 臂当作 0；不得用 B/C 的数据"补出"不存在的 A。

报告用语（固定）：

> One infrastructure-excluded cell reduced the available paired observations for the B−A pilot
> variance estimate from 10 to 9; no outcome imputation was performed.

## 不受影响的 cell

`PILOT-A01 | R1 | B` 与 `PILOT-A01 | R1 | C_frozen` 是**不同的 manifest cell**，未发生失败，
因此按原 manifest **正常运行**，不连带排除。
