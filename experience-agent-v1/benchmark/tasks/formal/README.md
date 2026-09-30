# 正式实验任务（benchmark/tasks/formal/）

结构（Protocol v2 §4.2 冻结）：12 族 × 每族 10 变体 = 120；每族对 A–E 各 2 个 ⇒ 每类 24。

## 造任务的硬性规则

1. **槽位一致**：文件名 = `<task_id>.yaml`，`id` 与 `category` 必须与 `benchmark/formal/slots.json` 一致。
2. **GT 独立**：每个变体的 ground truth 必须**独立制作并签署**；不得复制 Pilot 锚点或其他变体的 GT。
3. **Pilot 的 10 个任务不进入正式样本**（仅作族/难度锚点与 GT 参考）。
4. **期望决策集合**：`expected_first_decisions` 与 `expected_delegation` 必须与候选集/布尔轴校验一致
   （沿用 `benchmark/tasks.ts` 的校验；候选集 + 委派轴布尔值）。
5. **验证规则**：只用已冻结的 verification 种类
   （command_exit_zero / output_contains / file_exists / file_changed / file_unchanged / files_unchanged / file_contains）；
   `frozen` 状态必须有 verification。
6. **种子独立**：每个变体自带 seeds（含 `pilot-workspace/package.json` = `{"type":"commonjs"}`，M3 边界）。
7. **冻结纪律**：`status: frozen` 且 `gt_signed_by`/`gt_signed_at` 非空之前，正式 manifest **不会**纳入该任务；
   签署后 GT、期望集合、验证规则**不得**再改。
8. **不得含委派指令**：任务描述里不能出现"请委派/并行/用 workflow"等指令（与 Pilot Q1 裁决一致）。

## 校验

`node scripts/formal-slots.ts` —— 结构性不变量 + 每槽任务文件检查（缺/未签/类别不符 ⇒ exit 3）。
