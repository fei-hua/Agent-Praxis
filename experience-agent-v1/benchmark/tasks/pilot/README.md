# benchmark/tasks/pilot/ — Pilot 任务集（Issue #6）

10 个 Pilot 任务，按 `spec/frozen.md` §9.1 的类别分布各取 2 个（A/B/C/D/E）。

| 任务 | 类别 | task_type | complexity | expected_first_decisions | expected_delegation |
|---|---|---|---|---|---|
| PILOT-A01 | A Simple | bugfix | simple | `DIRECT` | false |
| PILOT-A02 | A Simple | doc | simple | `DIRECT` | false |
| PILOT-B01 | B Explore | doc | medium | `EXPLORE` | false |
| PILOT-B02 | B Explore | refactor | medium | `EXPLORE` | false |
| PILOT-C01 | C Delegate | ui_upgrade | medium | `DELEGATE` | true |
| PILOT-C02 | C Delegate | refactor | medium | `DELEGATE` | true |
| PILOT-D01 | D Parallel | data_layer | medium | `PARALLEL` | true |
| PILOT-D02 | D Parallel | refactor | medium | `PARALLEL` | true |
| PILOT-E01 | E Recovery | bugfix | medium | `REPLAN` | false |
| PILOT-E02 | E Recovery | bugfix | medium | `REPLAN` | false |

## ⚠️ 签署状态：全部为 `status: draft`，**不得用于正式 run**

`expected_first_decisions` 是**测量基准（ground truth）**，它决定了 CDA 的分母。
按 OQ-021 裁决「`expected_delegation` 必须由人工提前定义，不得由该 Policy 自动生成」，
本任务集的处理方式是：

1. 开发方（AI）起草任务书、类别归属与期望决策（本文件与各 YAML）；
2. **人工逐条签署**后才能置为 `status: frozen`；
3. `scripts/pilot-plan.ts` 会拒绝 `status != 'frozen'` 的任务（代码级门禁，不靠口头约定）；
4. 冻结后任务定义与期望决策不得再改（改了就是新任务集，需重新签署）。

> 为什么这一步必须人工签字：任务书和期望决策都由实现了 Policy 的一方起草时，
> 存在「让 Policy 自己定义自己的成功」的风险。签署是这条风险的唯一防线。

签署方式：把每个 YAML 的 `status: draft` 改为 `frozen`，并补齐 `verification`
（把 `success_criteria.required/forbidden` 的每个标签映射为纯代码检查，见下）。

## 与 dry-run 任务集不相交

dry-run 任务（`benchmark/tasks/dry-run/DRY-01..05`）用于 Phase 0 的链路验证；
本目录的 10 个任务是 Pilot 专用，id、任务书、工作区路径均不重叠。

## 每个任务还需要什么（#6 剩余项）

| 项 | 说明 | 状态 |
|---|---|---|
| 工作区种子 | `pilot-workspace/<task-id>/` 下的待修复文件与验收脚本 | 🔲 待实现 |
| `verification` 映射 | 每个 required/forbidden 标签 → 纯代码检查（`command_exit_zero` / `output_contains` / `file_exists` / `file_unchanged` / `files_unchanged`） | 🔲 待实现（签署时补齐） |
| 通用判定器 | 读取 `verification` 并产出 PASS/FAIL 的脚本（替代 dry-run 里硬编码的判定） | 🔲 待实现 |

## 运行方式（实现齐备后）

```powershell
# 1) 生成 run plan（执行前门禁 + 臂指令）
node scripts/pilot-plan.ts --task PILOT-C01 --arm C_frozen `
  --run-id pilot-2026-10-01-PILOT-C01-C-R1 --harness-version <run 当时版本> `
  --tool-schema-from-session <参考会话 id>

# 2) 按 plan 的指令块执行任务（真实 DSH 会话），得到 sessionId
# 3) 采集轨迹（arm 落真实值、manifest 二次门禁、CDA 由代码计算）
node scripts/dryrun-collect.ts --task PILOT-C01 --tasks-dir benchmark/tasks/pilot `
  --arm C_frozen --manifest pilot-runs/<run-id>.plan.json `
  --primary <sessionId> --harness-version <run 当时版本> --judge <judge json>
```

Pilot 规模：`10 任务 × 3 次重复 × A/B/C_frozen = 90 次 run`（`spec/experiment-design.md` §5）。
