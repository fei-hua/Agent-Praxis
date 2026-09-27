# policies/ — B 臂 Policy 规则（Phase 0 未实现）

本目录属于 `tasks/phase0.md` §6.2 冻结目录结构的一部分。

## Phase 0 状态：空（有意为之）

Phase 0 的唯一目标是 **instrumentation + 基础运行闭环**（T1–T10），
明确不做 Policy 优化、不做 A/B、不做正式跑数（见 `tasks/phase0.md` §3）。

`spec/experiment-design.md` 中的 B 臂（Policy 臂）定义如下，属于后续阶段实现：

| 臂 | 定义（experiment-design / frozen 原文） |
|---|---|
| A | Baseline 臂：无 Policy |
| B | Policy 臂：应用本目录的 Policy 规则（RQ1 检验其改善基础委派决策） |
| C_frozen | Policy + 冻结 Action Experience（只读 SNAPSHOT_01，禁止 Reflection 写回） |
| C_static | 不 Reflection，store 全程冻结在 S0 |
| D_online | 每个任务后 Reflection，store S0 → S1 → …（探索性） |

因此本目录在 Phase 0 保持为空，**不放置任何未经裁决的 Policy 规则**：
任何 Policy 阈值/规则若在 Phase 1 引入，必须来自规格或人工裁决，
并按 OQ-009 裁决更新 `experiment_config_hash`。
