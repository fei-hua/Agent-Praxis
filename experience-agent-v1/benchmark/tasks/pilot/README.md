# benchmark/tasks/pilot/ — Pilot 任务集（Issue #6）

10 个 Pilot 任务，按 `spec/frozen.md` §9.1 的类别分布各取 2 个（A/B/C/D/E）。

| 任务 | 类别 | task_type | complexity | expected_first_decisions（**已签署冻结**） | expected_delegation |
|---|---|---|---|---|---|
| PILOT-A01 | A Simple | bugfix | simple | `DIRECT` | false |
| PILOT-A02 | A Simple | doc | simple | `DIRECT`（等价集含 `EXPLORE`） | false |
| PILOT-B01 | B Explore | doc | medium | `EXPLORE` | false |
| PILOT-B02 | B Explore | refactor | medium | `EXPLORE` | false |
| PILOT-C01 | C Delegate | ui_upgrade | medium | `DELEGATE`（等价集 `{DELEGATE, PARALLEL, WORKFLOW}`） | true |
| PILOT-C02 | C Delegate | refactor | medium | `DELEGATE`（同上） | true |
| PILOT-D01 | D Parallel | data_layer | medium | `PARALLEL`（等价集 `{PARALLEL, WORKFLOW}`） | true |
| PILOT-D02 | D Parallel | refactor | medium | `PARALLEL`（同上） | true |
| PILOT-E01 | E Recovery | bugfix | medium | `REPLAN` | false |
| PILOT-E02 | E Recovery | bugfix | medium | `REPLAN` | false |

## 签署状态：**ground truth 已逐条签署并冻结（2026-09-27），`status = frozen`**

签署结论与规则见 [`GROUND-TRUTH-REVIEW.md`](GROUND-TRUTH-REVIEW.md) 第三部分。要点：

- 逐条审核签署，**不按类别批量映射**；签署值与等价集已写入各 YAML；
- **Q1**：C/D 任务书已去掉"委派/并行委派"指令（消除实验泄漏——不然三条臂都会照做，CDA 失去区分度）；
- **Q2**：`subagent_used` / `two_subagents_used` 已移出 `required`，改为轨迹观测指标（Task Success 与委派决策解耦）；
- **Q3**：CDA 定义不变，`EXPLORE` 与 `DELEGATE/PARALLEL/WORKFLOW` **不等价**；
- **Q4**：允许多值等价集，但**必须在 Pilot 前冻结，不得事后调整**；类别校验相应改为**委派轴一致**；
- `status` 仍为 `draft`：等 `verification` 补齐后才置 `frozen`（`pilot-plan.ts` 会拒绝 `draft`，代码级门禁）。

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

---

## 运行基础设施（#6，进行中）

| 组件 | 文件 | 状态 |
|---|---|---|
| 种子与独立 checker | `benchmark/pilot-seeds.ts` | 批次 1 完成：**A/B 类 4 个任务**（A01/A02/B01/B02），共 15 个种子文件 |
| 确定性重建（Run 隔离） | `scripts/pilot-setup.ts` | ✅ 先清空 `pilot-workspace/` 再重建基线，并写 SHA-256 清单 `seed-hashes.json` |
| 通用判定器 | `scripts/pilot-verify.ts` | ✅ 读 `verification[]` → 每项 PASS/FAIL/**CONFIG_ERROR**，另做 protected_paths 基线比对 |
| `verification` 映射 | 各任务 YAML | 批次 1 的 4 个任务已补齐；C/D/E 类 6 个待做 |

### 已实测的三条路径

| 场景 | 结果 |
|---|---|
| 解题态（产物正确） | `task_success = true`，退出码 **0** |
| 重建基线后（未解题） | `task_success = false`，退出码 **1**（证明 Run 间不继承改动） |
| 未提供 `verification` / 无种子覆盖 | **`VERIFICATION_CONFIG_ERROR`**，退出码 **3**（基础设施错误，不算模型失败） |

### 工作区模块解析边界（必须保留）

`pilot-workspace/package.json` 是种子的一部分（`{"type":"commonjs"}`）。种子与 checker 用 CommonJS，
而父项目 `package.json` 是 `"type": "module"`——缺这一条会让所有 `.js` 被按 ESM 解析、
`require` 直接报错。**Phase 0 的 M3 异常（DRY-04 tester 首跑）根因即此**，此处已固化以避免复发。

### 判定器设计要点（对应人工验收标准）

- **#2 与 Agent 解耦**：checker 只检查任务结果（行为断言 / 产物内容 / 边界哈希），不检查 Agent 采取了什么动作；
- **#3 Forbidden 反向检查**：`成功 ⇔ 全部 required = PASS ∧ 全部 forbidden = 未触发 ∧ 无 protected_path 违规`；
  边界依据 = 种子基线 + 当前哈希比对（`protected_paths` 自动展开 glob）；
- **#4 配置错误不算 FAIL**：缺 checker / 类型未知 / 基线缺失 / 参数非法 / `node <script>` 形式不合法
  → `VERIFICATION_CONFIG_ERROR`（退出码 3），避免把 benchmark bug 记到模型头上；
- **#5 单一实现**：Acquisition / Pilot / Validation 共用 `scripts/pilot-verify.ts`；
  Phase 0 的 `dryrun-judge.ts` 属已冻结的历史证据，不参与后续阶段（dry-run 也不属于实验数据）。

### 本 issue 剩余

- ✅ C/D/E 类 6 个任务的种子与 checker（batch 2 完成，10/10 覆盖）
- ✅ 对应 `verification` 块
- ✅ `status: draft` → `frozen`（OQ-014 冻结后执行，2026-09-27）
