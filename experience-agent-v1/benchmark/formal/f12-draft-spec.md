# F12 起草规范（状态迁移编排 / Deploy & Rollback）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F12 产物）
> 流程：本规范确认 → `scripts/formal-author-f12.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 纳入 F12 → 独立验真（→ 120/120）
> 当前禁止：F12 签署 · 冻结 · commit · manifest（LOCKED，门槛 = 全 120 槽位冻结）· 回写 F01–F11

---

## 〇、领域边界（写入 f12-review.md 顶部，逐字保留）

```
F12 = system state transition orchestration（deploy / upgrade / rollback / recovery）
F04 = 单个事件驱动的状态机语义（event → state）
F10 = 数据 / schema 迁移（schema/data → migrated data）

F12 研究：多个部署阶段、检查点与失败恢复条件下，系统状态如何按既定迁移策略安全地
         从旧版本到新版本，并在失败时恢复到**允许状态集合**之内。

F12 不研究：
  ❌ 单个状态机 transition correctness（F04）
  ❌ 数据字段 / schema / data 内容迁移本身（F10）
  ❌ 通用 workflow 本身
  ❌ quota / permission / template / query / lockfile（F08/F06/F09/F11/F05/F07）
```

**特别原则（防止把 F12 做成 "Workflow + rollback" 拼装题）**：

```
· D2 使用 WORKFLOW，其构念必须是 **部署依赖导致的迁移顺序约束**（拓扑序 + 前置版本约束），
  而不是"任务比较复杂所以用 Workflow"。
· C1/C2 必须把 **deploy failure** 与 **rollback recovery failure** 作为两个不同 failure mode，
  而不是只改变组件数量或失败注入点。
· "失败"的定义见 S8：只有前置条件被拒 / 阶段执行返回非零 / 校验不一致才算 deploy failure；
  业务侧正常返回（如服务返回 4xx）**不得**触发 rollback。
```

## 一、⭐ 实现前必须冻结的语义（每变体 CONTRACT.md 显式声明，checker 逐条引用）

```
S1 前置条件（preconditions，部署前必须全部成立，否则**拒绝且不发生任何状态变更**）：
   (a) `from_version` 必须与当前组件版本**一致**；
   (b) 该组件没有 in-flight 部署（history 中最后一条非终态记录必须已收敛）；
   (c) `target_version` 属于该组件**声明的版本集合**；
   (d) `target_version` 与当前版本**相邻**（见 S2）。
   任一违反 ⇒ `decision="rejected"`，并且：
   · **reason 必须属于闭集**：
     `{"version_mismatch", "in_flight", "target_not_declared", "target_not_adjacent"}`
   · **多项同时违反时，按上述枚举顺序取第一项作为唯一 reason**（消除多解）
   · `state.json`、`history.jsonl` 与**任何 artifact 均逐字节不变**
   · **不进入部署阶段，不产生任何 rollback / recovery 动作**
   · rejected 是**部署前置拒绝**，不得被重新解释为已发生的 deployment stage failure
S2 合法状态集合（写死）：
   · 每个组件的版本 ∈ 声明集合 {v1, v2, v3}；版本迁移**只允许相邻**（v1→v2、v2→v3、v2→v1、v3→v2），
     不允许跨版本（v1→v3 必须被拒）
   · 全局状态必须满足依赖约束：若 C 依赖 X，则 version(X) >= version(C) 的**要求下限**（见 S6）
S3 rollback target 的唯一选择规则（写死）：
   · rollback 目标 = **该组件最近一次成功部署之前的版本**（last known good, LKG）
   · 取值来源：history.jsonl 中该组件最近一条 status="success" 记录的 `from_version`
   · **不得猜测**（例如无条件回退到 v1）；若不存在此类记录 ⇒ 拒绝 rollback
     （输出 {decision:"rejected", reason:"no_lkg"}，状态不变）
S4 partial deployment 定义（写死，**比较对象单位必须一致**）：
   存在下述任一情况即为 partially-deployed：
   (a) 多组件目标中，部分组件已达到目标版本、部分仍为旧版本；或
   (b) **expected_artifact_sha256 ≠ actual_artifact_sha256**：由声明版本查得该组件的预期产物指纹
       （plan/artifacts 清单中的 expected_artifact_sha256），与实际 artifact 文件的 sha256 比较；
       **禁止比较"版本字符串 vs 指纹"这类不同单位的值**（与 S7 使用同一对象，消除实现空间）
   ⇒ partially-deployed **不得作为最终状态**：必须继续推进至一致，或回滚至 LKG
S5 rollback 范围 / 顺序 / 允许终态（全部写死）：
   · **范围**：只对本次 deployment target 集合中**已发生状态变化**的组件执行回滚；
     从未离开原版本的组件**不得**产生 rollback 记录（禁止虚假 rollback）
   · **顺序**：按 deployment dependency 的**逆拓扑序**执行（若部署序为 X→Y→C，则回滚序为 C→Y→X）；
     同一层内部按组件名**序数升序**（确定化，避免多解）
   · **允许终态（只有两种）**：
     (a) 一致回滚：所有受影响组件回到各自 LKG 且满足依赖约束 ⇒ status="rolled_back"
     (b) 任一 rollback step 失败 ⇒ status="halted"（**唯一允许的非一致终态**）：
         必须停止后续 rollback stage、不得继续部署、不得报告 success/rolled_back、不得静默吞掉失败
   · 其它任何终态（例如留在 partially-deployed 且继续推进）一律视为失败
S6 component dependency 方向（写死）：
   `requires[C] = [X, Y]` 表示 **X、Y 必须先于 C 完成部署**（依赖先部署）。
   部署顺序必须是该有向图的**拓扑序**；图中存在环 ⇒ 拒绝该部署计划（reason:"dependency_cycle"）
S7 state drift 的检测依据（写死）：
   · declared state = state.json（声明版本）
   · actual state   = 各组件 artifact 的 sha256 指纹（artifacts/<component>.json 内的 version+fingerprint）
   · **drift = declared ≠ actual**（逐组件比较，按组件名序数排序）
   · 检测到 drift 必须报告并**重新部署**（不得仅改写 state.json 使其"看起来一致"）
S8 deploy failure 与业务结果的区分（写死）：
   · deploy failure 仅指：(a) 前置条件被拒（S1）、(b) 阶段执行返回非零/抛错、(c) 校验不一致（S4/S7）
   · 业务侧正常返回（HTTP 4xx/5xx 业务响应、返回体里的业务错误码）只记为 **business_outcome**：
     **不改变 deployment state、不触发 rollback**；其后是否继续由**既定阶段流程**决定，
     但**不得**把该结果重新解释为 deploy_failure ⇒ 消除"4xx → halt / success / rollback"三种自由行为
     （须有显式规则区分并写进 CONTRACT）
S9 重复部署（幂等）：对已处于目标版本的组件再次部署同一版本 ⇒ 记为 status="skipped"，
   state.json 逐字节不变（不得产生新的版本迁移）
S10 canonical 记录形式：state.json 按**固定字段顺序**（组件名字段按序数排序）+ UTF-8 + LF；
   history.jsonl 每行一条、按 seq 递增、字段顺序固定；所有比较一律**逐字节**
```

## 二、脚手架草案

```
<task>/
  plan.json                 部署计划（components / requires / target versions / stages）
  state.json                声明状态（component → version, status）
  history.jsonl             部署历史（seq, component, from_version, to_version, status, stage）
  artifacts/<c>.json        实际产物（version + sha256 指纹；S7 的 actual state 来源）
  deploy.js                 部署编排实现（前置检查 → 阶段执行 → 状态写入 → 失败处理）
  rollback.js               回滚实现（LKG 选择 → 执行 → 终态判定）
  report.json               最终报告（decision/status/受影响组件/canonical 形式）
  CONTRACT.md               S1–S10 的显式声明
  check-*.js                分项验收（每 required 一个显式检查）
  verify.js                 汇总验收（输出 token）
  （D1/D2 另有 work/*.js 组件部署工具 + timeline.jsonl；E 类另有 legacy deployer）
```

## 三、十变体构念矩阵（C1/C2 的 GT 已按人工裁定钉死；其余沿用）

| id | 构念 | 类别 | GT（已按裁定钉死） |
|---|---|---|---|
| A1 | 正常 deploy（单组件相邻版本迁移） | A | DIRECT |
| A2 | 前置条件失败 ⇒ 不得进入 partially-deployed | A | DIRECT \| EXPLORE |
| B1 | 有序 rollout（依赖方向 + 拓扑序） | B | EXPLORE |
| B2 | rollback target 的唯一选择（LKG 而非猜测） | B | EXPLORE |
| C1 | deploy 中途失败 ⇒ rollback 正确性 | C | **WORKFLOW（单一）** |
| C2 | rollback 阶段失败 ⇒ 恢复路径耗尽 / 安全停机 | C | **WORKFLOW（单一）** |
| D1 | 互不依赖组件的并行 rollout（硬预算 + 结果等价） | D | PARALLEL |
| D2 | 依赖链 rollout（拓扑序 + 真实 artifact 传递） | D | **WORKFLOW（单一）** |
| E1 | 部署契约变化 ⇒ REPLAN | E | REPLAN |
| E2 | 检测到 state drift ⇒ REPLAN | E | REPLAN |

### 类别设计要点
```
A1：单组件 v1→v2；实现漏写 history 或 state 的 version 字段 ⇒ 单文件单症状 ⇒ DIRECT
A2：实现**先写 state 再校验前置条件** ⇒ 被拒后仍留下部分变更（partially-deployed）⇒ DIRECT|EXPLORE
B1：实现按组件名字母序而非拓扑序（S6）⇒ 依赖方向被破坏 ⇒ EXPLORE
B2：rollback 无条件回退到 v1（而非 S3 的 LKG）⇒ 需沿 history 语义定位 ⇒ EXPLORE
C1：部署到第二个组件时注入真实失败 ⇒ 正确行为 = 回滚至 LKG（status="rolled_back"）；
    未修复：留在 partially-deployed 且继续推进 ⇒ 断言给出**真实状态差异**（非结构断言）
C2：**初始 fixture 必须处于正常态**（部署任务开始 → 执行期在 rollback 阶段才注入失败）⇒
    正确行为 = status="halted" 且停止后续阶段；未修复：把失败吞掉并继续部署到目标版本 ⇒ 断言给出真实终态差异
    **GT = [WORKFLOW] 单一**：first_decision 必须由**任务初始状态**支持，不得由执行期预知的失败结果倒推；
    C1 与 C2 的 GT 相同不构成构念重复 —— C1 = deploy failure 的恢复，C2 = recovery 自身失败的安全停机
    （例外：仅当某变体的**初始 fixture 已处于 rollback-failed 状态**、任务要求从既有失败状态继续恢复时，
     才允许 [REPLAN]；本族默认不采用该前置状态）
D1：三个**互不依赖**组件并行 rollout；硬预算 6500ms（各组件固定耗时，串行 > 预算 ⇒ verify 拒绝）；
    最终 state.json/report.json 必须等于 checker 内嵌**独立参考编排**（S1–S10，逐字节）
D2：依赖链 db → api → web；**必须拓扑有序**，且 checker 断言 **stage 间真实 artifact 传递**
    （stage N 的 history 记录必须引用 stage N-1 的产出指纹；路径连续 + sha256 一致）
    GT = [WORKFLOW] 单一（事前收紧，沿用 F10-D2/F11-D2 教训）
E1：部署契约变化（例如新契约要求"相邻版本 + LKG 回滚"），而既有 legacy deployer 按旧假设工作、
    且其消费方/记录被冻结 ⇒ 必须重新规划部署路径 ⇒ REPLAN；真实预跑 check.js → exit=1
E2：检测到 drift（declared=api:v2 而 actual artifact 指纹仍为 v1）⇒ 必须重新部署（S7），
    不得改写 state.json 掩盖；真实预跑 check.js → exit=1，断言给出真实指纹/版本差异
```

## 四、交付物与门禁（与 F01–F11 同构）

```
交付物：scripts/formal-author-f12.ts · 10 个 FORMAL-F12-*.yaml · formal-seeds-f12.ts ·
       f12-review.md · f12-gt-drafts.json · f12-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · C/E 类真实预跑 exit=1（含 C1/C2 的失败注入）
  D1：反事实（同 fixture / 同组件集合 / 同单组件耗时 / 同 budget，唯一变量 = 调度）
      + 最终状态与报告 == checker 内嵌独立参考编排（S1–S10，逐字节）
  D2：stage 间 artifact 传递（路径连续 + sha256 一致），拓扑序违反时 verify 必须失败
  另需：S8 的"tool error vs subject failure"区分在 C/E 类 checker 中显式体现
        （阶段工具自身故障不得被当作被测对象失败）
```

## 五、实现模板与已知陷阱（沿用 F04–F11 骨架）

```
复用：导入块 / 路径常量 / runFixRunStrict（三分类 + 阶段前置清理）/ Variant 接口 /
     YAML 发射规则 / node 证据循环 / seeds 格式 / schema 校验（loadTask + issues）/
     verifyTask 证据链 / 产物发射 / exit 0|3

陷阱清单（本会话实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2）⇒ 本族先冻结 S1–S10
  ③ `.mjs` 工具脚本禁 TS 语法（F03/F05/F08/F09/F10/F11 各一次）、禁混用 require
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希/排序一律**序数（Ordinal）**
  ⑤ 证据 checker 必须纯读取（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入
  ⑦ 生成器内多行字符串用 `JSON.stringify(layer2)` 构造，禁止手数反斜杠（F08-C2）
  ⑧ 逐字节/内联类语义必须**预先按字节推算期望值**（F09-B1）
  ⑨ C 类两变体必须承担**不同 failure mode**（F08-C2；本族见 C1 vs C2）
  ⑩ **GT 不得过宽**：只有任务结构本身支持并行/编排时才允许对应类别（F10-D2、F11-D2）
  ⑪ 排序类语义必须先冻结 **tie-breaker**（F11-Q3 三键真全序）
  ⑫ **清理范围必须最小化**：诊断/复算脚本只能删除自己的临时目录，**绝不 rmSync 共享工作区**
     （F11 incident：误删 pilot-workspace，虽已确定性重建且零失配，但属可避免事故）
  ⑬ 终态判定必须显式（S5）：不得让"回滚失败"被静默吞掉后仍报告成功
```

## 六、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F11 的 frozen hash / GT / 任务内容
C 类不得只凭"组件多所以适合并行"判定；E2 不得退化为结构/字符串断言
prompt 不得写入结构性 cue
当前禁止：F12 签署 · 冻结 · commit · manifest
```

## 七、当前基线

```
F01–F11 frozen：**110/120** · 独立验真 **220/220 PASS**（针对已冻结 110 个任务）
F11 已封账（台账含三哈希 + 2026-10-04T07:21:14Z；归档包按 frozen 身份重打）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F12：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
F12 完成后：120/120 → 方可生成 pilot-manifest-formal.json（仍须一次性、全量）
```
