# 正式实验 Protocol（preregistration 级统计方案）· **v2 冻结版**

> 状态：**正式签署版（2026-09-30）**
> 本文件为新增文档；未修改 `spec/` 下任何已冻结条目、Pilot manifest、ground truth、CDA/Policy/Experience/retrieval 定义、Recovery Rule v1、maxDepth。
> 生成依据：Pilot（dataset=`pilot_dry_execution`，30 planned cell / 28 valid / 2 excluded）的五份产物：
> 数据审计、成本审计、paired SD、Power Analysis、反向 MDE。
> v2 变更见 §12（修订记录）。

---

## 1. 研究问题与假设

| 编号 | 假设 | 类型 |
|---|---|---|
| **H1（主要 / confirmatory）** | 在 Policy 条件恒定的前提下，加入**冻结经验快照**会提高 Agent 第一步决策落入签署正确委派集合的比例：`C_frozen > B`（CDA） | 主要假设 |
| H2（辅助 / exploratory） | Policy 本身（无经验）相对自然基线的影响：`B vs A`（CDA） | 辅助比较 |
| H3（次要 / 安全性） | 任务成功率（Task Success）不因加入经验而下降 | 次要 |
| H4（次要 / 成本） | 耗时（elapsed_ms）与 token 用量（tokens）的差异 | 次要 |

**臂定义（冻结，沿用 Pilot）**

```
A        无 Policy、无 Experience                                        → natural baseline
B        Policy-only                                                     → confirmatory 对照
C_frozen Policy + 冻结经验快照（只读 SNAPSHOT_01，reflection=false）      → confirmatory 处理组
```

## 2. 主要指标、比较与检验（confirmatory 部分，不可事后更改）

```
主要指标      CDA（第一步决策是否落入**事先签署的**期望委派集合；只看"该不该委派"这条轴，
              不等同于决策模式准确率）
主要比较      C_frozen − B（同一任务实例内配对）
检验          Exact two-sided McNemar（不一致对：b = C=1,B=0；c = C=0,B=1）
显著性水平    α = 0.05（双侧）
检验效能      1 − β = 0.80
效应定义      π_d = 0.20（20% 的配对出现 CDA 不一致）
              q   = 0.80（不一致对中 80% 方向有利于 C_frozen）
              等价写法：P(C>B) = 0.16，P(C<B) = 0.04，净方向差 = 0.12
```

**效应定义说明**：McNemar 关注**配对不一致结构**，故主要效应以 (π_d, q) 规定，而非"C 比 B 高 20 个百分点"。

**Pilot 的作用边界（重要）**：Pilot 的 `C−B = 1/8` 不一致对仅作为**效应假设的参考资料**，**不作为正式效应估计**。正式实验不得据此声称"经验提高了 12.5% 的 CDA"。

## 3. 样本量（已用项目内单一实现复核）

| N | power（π_d=0.20, q=0.80） |
|---|---|
| 100 | 0.7357 |
| **120** | **0.8189** |
| 150 | 0.9028 |

```
达到 80% power 的最小 N = 115
⇒ 正式样本量冻结为 N = 120 个配对任务（留 5 对余量，且不把 150 的上限一次性用满）
```

## 4. 实验单位、任务构造与独立性（v2 修订）

### 4.1 分析单位

**一个配对任务（replicate）= 一个全新任务实例**，同实例内分别跑 A / B / C_frozen 三臂；N = 120 即 120 个任务实例。

```
❌ 不接受：把同一任务重复多次当作多个配对单元（伪重复 pseudo-replication）
❌ 不接受：把 Pilot 的 10 个冻结任务放进 confirmatory 样本
   —— 那会让"用于设计效应/方差估计的数据"与"用于假设检验的数据"在任务层面重叠
✅ 接受：120 个**全新**任务实例，每个都有**事先独立签署的 ground truth（期望决策等价集）**
```

**Pilot 的 10 个冻结任务**：仅作为**任务族的语义/难度锚点与 GT 制作参考**，**不进入正式 120 个配对单元**。
（若因外部原因必须纳入，则必须单独标识，并在最终分析中并列给出"含 Pilot-anchor / 不含 Pilot-anchor"两个敏感性结果，且**不得**作为主分析样本。）

### 4.2 配额（冻结为明确整数，无解释空间）

```
正式任务总数        120
按类别分层（confirmatory 分层结构）：
  A = 24    B = 24    C = 24    D = 24    E = 24

任务族              12 个族 × 每族 10 个变体 = 120
族 × 类别配额       每族对每一类别恰好贡献 2 个变体
                    ⇒ 12 族 × 2 = 每类 24  ✓  每族 2 × 5 = 10  ✓
```

**冻结的族×类别配额表（全表统一，无特例）**

| 族 \ 类别 | A | B | C | D | E | 合计 |
|---|---|---|---|---|---|---|
| F01 … F12（每族同构） | 2 | 2 | 2 | 2 | 2 | 10 |
| **列合计** | **24** | **24** | **24** | **24** | **24** | **120** |

**族的定义**：族 = 共享同一**脚手架**（文件布局、缺陷注入方式、verification 种类）的任务集合；
**类别** = 由该变体**自己的 ground truth** 决定（期望委派集合）。因此"族→类别"不是固定单值，
而是上表的**配额关系**——每个族的脚手架都会在五种类别结构下各被检验 2 次，
这同时控制了"脚手架效应"与"类别效应"的混淆。

**每个变体的独立性要求**：代码内容、缺陷位置、期望决策等价集**独立**，
⇒ **每个变体都必须独立制作并签署 GT**（不得从族锚点复制 GT）。

### 4.3 独立性与依赖结构（预先规定的敏感性分析）

**分析单位与聚类结构（冻结，必须在论文中如实描述）**

```
分析单位 = 任务实例（task instance）
聚类结构 = 任务族（task family）
```

120 个实例是**不同的任务**，但同族共享脚手架 ⇒ **不得描述为完全 IID 的 120 个独立样本**；
必须按聚类结构披露，并保留下述 family-level 敏感性分析。
（本设计的族×类别配额为每族 2/2/2/2/2，使 family 与 category **平衡且不混淆**，
分层与敏感性分析因此有干净的对照结构。）

1. 每个任务实例一次运行、**不复用**其 workspace 终态；
2. 每个 run 前从冻结基线**重新 seed**，session 全新，`DSH_HOME` 下无跨 run 状态复用；
3. 同一实例内三臂**串行**执行（避免资源竞争污染 elapsed_ms）；
4. **披露**：同一族的 10 个变体共享脚手架 ⇒ 120 对**并非完全独立**。预先规定：
   - **分层 McNemar**：按类别（A–E）分层报告不一致对分布；
   - **按族聚类**：以族为单位描述不一致对比例范围；族间方向不一致时如实披露，不做合并结论；
5. 正式实验开始后**不得**增删任务、不得改动任何 GT。

## 5. 臂顺序与顺序效应控制（v2 明确位次）

```
· 每个任务实例内，三臂执行顺序由**冻结种子**确定性派生（sha256(frozen_seed|group_id|arm)）
· 位次配额（冻结）：
      首位：A 40 次、B 40 次、C_frozen 40 次
      次位：A 40 次、B 40 次、C_frozen 40 次
      末位：A 40 次、B 40 次、C_frozen 40 次
      ⇒ 三臂各 120 次，共 360 次运行
· 每次运行完全隔离（新 seed / 新 workspace / 新 session）；同实例内各臂不共享缓存或状态
· elapsed_ms 口径与 Pilot 一致（wall_time_ms，取自 run record）
```

## 6. 环境冻结（与 Pilot 完全一致）

```
harness_version        = 0.1.7-rc.2
tool_schema_version    = tschema-dcdb10f5d21c
experiment_config_hash = 由上述环境确定性派生（sha256(canonical_json(config))）
启动器                  = outside-sandbox / elevated（launcher）
被测 session            = workspace-write，delegation_depth = 0
maxDepth               = 1（不改动 Harness 参数）
经验快照                = SNAPSHOT_01（只读；仅 C_frozen 可见，A/B 为 0）
reflection             = false
```

**开跑前置门禁**：① `PILOT-ENV-PREFLIGHT` 12/12 全过（含第 12 项按声明版本解析 exact binary、fail-closed）；
② 全部计划卡用冻结环境生成并对账（missing / unexpected / duplicate / tool_schema / config 不一致均为 0）；
③ 工作区可从冻结基线确定性重建（漂移 0）。

## 7. 数据与证据链（沿用 Pilot 冻结规则）

```
权威来源      telemetry/trajectories/<runId>.jsonl（run_end.run_record）
记录层        receipt（prepare 空壳 → 自动回退归档原件，标注 receipt_source）
指纹          Agent 退出瞬间的 workspace 指纹（capture=agent_exit；POST_HOC 必须标注）
判定          verifyTask() 进程内判定（不 spawn 子进程），PASS / FAIL / CONFIG_ERROR 分离
失败处置      Recovery Rule v1：infrastructure / collection_error / CONFIG_MISMATCH 家族
              → 原 run 永久保留 counted=false；每 (task × replicate × arm) 至多 1 次替换；
              Agent FAIL 不得重跑
插补          任何缺失一律**不插补**
配对资格      pair-eligible = 证据完整（原生/已标注指纹 + 核心环境字段 + 轨迹核心记录）且两层一致；
              证据不完整者仍计 valid，但不进配对分析
```

## 8. 分析计划（预先规定）

**主要分析（H1，confirmatory）**

```
对 120 对（pair-eligible）做 Exact two-sided McNemar：
  报告 b、c、不一致对总数、精确 p 值
  效应量 = (b − c) / N，95% CI 预先规定为 Clopper–Pearson 精确区间
  同时报告 nominal / valid / eligible 三个对数（不插补）
```

**次要分析（exploratory，不做 α 调整——主要检验只有一个）**

```
H2  A vs B（CDA）：Exact McNemar
H3  Task Success：Exact McNemar（视配对结构）或 Fisher 精确检验；报告配对成功率差与 95% CI
H4  elapsed_ms / tokens：配对 t 检验为主要口径；Wilcoxon 符号秩为敏感性分析；
    tokens 另做对数变换敏感性分析（Pilot 显示右偏）
    N=120 时的理论可检出尺度（基于 Pilot 方差锚点，**非预期效应**）：
      |d_z| = 0.2578
      B−A elapsed ≈ 20,283 ms   B−A tokens ≈ 170,097
      C−B elapsed ≈ 3,830 ms    C−B tokens ≈ 20,750
```

**停止规则**：**不做中期有效性分析、不做可选停止**。仅允许因基础设施原因暂停（Recovery Rule v1），
暂停与恢复必须记入偏离日志。

## 9. 执行方案与资源预算

**正式方案：三臂全跑（360 runs）** —— 保留 A 臂，使 `Policy-only` 与 `Policy+Experience` 的增量关系完整呈现，
而不只是一条 B→C 的比较。

| 方案 | runs | tokens（均值口径） | tokens（中位数口径） | 串行墙钟（均值口径） |
|---|---|---|---|---|
| **正式（A + B + C_frozen × 120）** | **360** | ≈ 75M | ≈ 38M | ≈ 3.9 小时 |
| 备选（仅主比较 B + C_frozen × 120） | 240 | ≈ 30M | ≈ 26M | ≈ 2.0 小时 |

（A 臂均值被 Pilot 中 `C01|A` 的极端值抬高，故中位数口径更稳健；正式分析需同时报告均值与中位数。）

## 10. 风险与已知局限（须在论文中披露）

1. **伪重复风险**：120 个实例由 12 个族派生，族内共享脚手架 ⇒ 已按 §4.3 规定分层/聚类敏感性分析；
2. **环境漂移风险**：Pilot 期间发生过 harness 被升级（0.1.7 → 0.2.0）导致的 CONFIG_MISMATCH；
   现由「按声明版本解析 exact binary + fail-closed + 12 项 preflight」堵住；
   正式实验期间每次开跑前仍须跑 preflight；
3. **Pilot 极端值**：`C01|A`（273,969 ms / 2,031,122 tokens）等**未剔除**，仅用于方差规划；
4. **效应假设**：π_d=0.20 / q=0.80 是**事先假设**，不是 Pilot 实测；
5. **未检出 ≠ 无效应（重要，原样保留）**：
   > 当真实效应弱于预设 MDE 时，N=120 可能无法达到 80% power。
   > 未达到统计显著时，只表述为"**未检出预先定义的效应**"，
   > **不得**表述为"**证明无效应**"。

## 11. 签署（正式冻结）

```
主要指标        CDA
主要比较        C_frozen − B（confirmatory）
次要比较        A vs B（exploratory）
检验            Exact two-sided McNemar，α = 0.05，target power = 0.80
效应定义        π_d = 0.20，q = 0.80（P(C>B)=0.16，P(C<B)=0.04）
样本量          N = 120 配对任务（最小需求 115）；120 个全新任务实例，Pilot 的 10 个任务不进入
分层            A/B/C/D/E 各 24；12 族 × 每族 10 变体；每族对每类贡献 2 个变体
执行            三臂全跑 360 runs；位次配额各 40/40/40；顺序由冻结种子确定性派生
次要指标        Task Success（安全性）、elapsed_ms / tokens（成本）

签署后不得再改动：ground truth、CDA 定义、Policy、Experience、retrieval、
Recovery Rule v1、maxDepth、主要终点（primary endpoint）、N
```

## 12. 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-09-30 | 首版：主要指标 CDA、主要比较 C_frozen−B、N=120、环境冻结、分析计划 |
| **v2** | **2026-09-30** | ① §4：Pilot 10 个任务**移出** confirmatory 样本，改为"120 个全新任务实例"（原 v1 的 110 个变体改为 **120 个**）；② §4.2：类别配额明确为 **A=B=C=D=E=24**，族×类别冻结为 **每族每类 2 个（12×2=24）**；③ §5：位次配额明确为 **首位/次位/末位各 40/40/40**；④ §9：正式方案定为**三臂全跑 360 runs**；⑤ §10.5 强化"未检出 ≠ 无效应"表述 |
