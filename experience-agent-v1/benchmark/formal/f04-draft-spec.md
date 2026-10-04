# F04 起草规范（事件流 / 状态机 + 顺序与幂等约束）

> 状态：**规范已获授权实现**（用户确认按本规范实现 `scripts/formal-author-f04.ts`，不修改规范）
> 　　**实现尚未开始**：本轮未写入任何生成器代码、未生成任何 F04 产物
> 　　（遵守"不得留下半应用状态"纪律：生成器一旦开始即在同轮内完成 draft + 证据 + 机械门禁，再交审查）
> 领域裁定：用户批准 **F04-A = 事件流 / 状态机处理（含幂等与顺序保证）**
> 交付阶段：draft + seeds + 三层证据 → **交人工独立构念审查** → 机械门禁 → 加入 formal-verify-all → 独立验真 → 签署 + 冻结
> 当前**不授权**：F04 签署 · 冻结 · commit · manifest

---

## 一、与已冻结族的领域区分

```
F01：单模块 JS 工具                （文件内单点修复/单文件定位）
F02：CLI 解析 + 数据管线            （输入解析 + 变换 + 汇总）
F03：HTTP handler + middleware 链   （请求链、快照、路由、审计）
F04：事件流 + 状态机                （事件顺序、重复事件、状态迁移合法性、故障恢复、多来源/多阶段）
```

**核心不是"写一个状态机"**，而是让以下故障面**自然出现**：
事件顺序约束 · 重复事件/幂等 · 状态迁移合法性 · 故障恢复 · 多事件来源或多阶段处理。

## 二、脚手架草案（每变体同构，故障点不同）

```
<task>/
  events/              事件源（每变体 1–3 个来源；jsonl 或 json 数组）
  machine.js           状态机：合法迁移表 + 迁移执行
  apply.js             事件应用器：按序消费事件并驱动状态机
  dedupe.js            幂等层（部分变体中缺失或错误）
  snapshot.js          状态快照/投影（用于契约级断言）
  CONTRACT.md          事件契约（顺序/幂等/迁移合法性的规范描述）
  check-*.js           分项验收脚本（每个 required 标签一个显式检查）
  verify.js            汇总验收（输出 token）
```

约定：`verify.js` 与各 `check-*.js`、`CONTRACT.md` 在相应变体中为**受保护文件**；
`protected_paths` 一律为 `pilot-workspace/<task>/...` 形式（与既有族一致）。

## 三、A–E 十变体的构念设计（每类 2 个）

### A 类（DIRECT / DIRECT|EXPLORE；delegation=false）
```
A1：单文件单点迁移表错误（例如 machine.js 中 'paid' → 'shipped' 被误写为 'paid' → 'paid'）
    症状即定位 ⇒ DIRECT 最小充分
A2：事件顺序在 CONTRACT.md 中定义，apply.js 的实现顺序与之不符（目标文件已知，但需查约定）
    ⇒ DIRECT 与 EXPLORE 并列成立
```

### B 类（EXPLORE；delegation=false）
```
B1：最终快照缺少某字段（如 status）——故障可能在 apply.js / machine.js / snapshot.js 任一处
    症状在末端，需沿链定位 ⇒ EXPLORE
B2：重复事件处理结果与期望快照不同——可能是 dedupe 缺失、也可能是 apply 的键选择错误
    需要探查多处 ⇒ EXPLORE
（两变体都必须有**真实故障面**：BEFORE 态 verify 必须真实失败，不得为"假探索"）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW；delegation=true）—— **继承 F03 标准**
```
判据：不得仅凭"事件很多所以适合并行"。必须先找到**可机械验证的任务约束**。
F04 建议约束（事件流派生，比单纯预算更贴近领域）：
  · 硬预算 + 每来源顺序保证：三个来源各自有固定处理耗时，总预算冻结；
    要求"每来源内部严格有序"且"跨来源可交错"。
  · 串行反事实：逐来源顺序消费 ⇒ 总耗时 > 预算（verify 直接拒绝）
  · 并行：来源级并行 + 每来源内部保序 ⇒ 在预算内完成，且快照/契约断言通过
  · 机械证据必须包含：来源并行运行产生的 timeline（或等价运行记录）
    · 记录条数 = 来源数 · span ≤ 预算 · 每来源事件序未被破坏（保序断言）
两个 C 变体的差异：来源数/耗时分布/保序断言不同（不得机械复制）
若最终证明"串行不可行"无法成立 ⇒ 该变体不得标为 C（宁可重设计，不得放宽判据）
```

### D 类（PARALLEL / WORKFLOW；delegation=true）
```
D1：三个来源各自有独立缺陷与独立验收脚本，且最后一个**合并快照**步骤要求三来源收敛
    （prompt 中**不得**出现"互不依赖/各自独立脚本/可并行"等 cue）
D2：两批事件分别归档为两份报告 + 一份合并结论
    （prompt 只写"需要交付三份产物"，不得写"两份互不依赖"）
```

### E 类（REPLAN；delegation=false）
```
E1：存在**已上线**的消费契约（被外部冻结，如 replay 日志或 legedit 快照），
    新要求与其冲突；受保护文件不可改 ⇒ 必须新增兼容路径而非局部改参
    （配真实预跑日志：check.js exit=1）
E2：现有"至少一次 + 去重"方案在重放下违反 exactly-once 契约（受保护的处理器/契约不可改）
    ⇒ 需要新增幂等/序化层改变装配方式（REPLAN）
    （配真实预跑日志：contract.js exit=1，并在未修复态给出真实的 actual/expected 断言差异）
```

## 四、交付物与门禁（与 F01–F03 同构）

```
交付物：
  scripts/formal-author-f04.ts        （生成器：draft YAML + seeds + 三层证据 + review + version）
  benchmark/tasks/formal/FORMAL-F04-{A1,A2,B1,B2,C1,C2,D1,D2,E1,E2}.yaml
  benchmark/formal-seeds-f04.ts
  benchmark/formal/f04-review.md
  benchmark/formal/f04-gt-drafts.json
  benchmark/formal/f04-version.json
  benchmark/formal/f04-pre-run.json   （仅 E 类需要真实预跑时）

机械门禁（全部必须成立，fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0
  E 类预跑：真实 exit=1（日志由真实执行产生）
  C 类：反事实证明（同 fixture / 同约束 / 仅改调度）+ 正式 fixRun 证据（exit=0 · 记录数正确 · span ≤ 预算）

随后：formal-verify-all 加入 F04 → 独立验真（逐任务 + 版本身份 + 签署投影）
     → 人工构念审查通过 → 签署 + 冻结（三哈希 + status: frozen + gt_signed_*）
```

## 五、红线（F04 全程有效）

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA / GT /
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01 / F02 / F03 的 frozen hash、GT、任务内容
不得只凭"适合并行"判定 C 类；不得降低判据以凑配额
不得在 prompt 中写入结构性 cue（互不依赖 / 各自独立脚本 / 可并行 / 工作量大所以应并行）
当前禁止：F04 签署 · 冻结 · commit · manifest（LOCKED 维持 120/120 门槛）
```

**下一步**：实现 `scripts/formal-author-f04.ts`（按本规范），产出 draft + 三层证据，然后**交用户做 F04 独立构念审查**；审查通过前不进入签署。
