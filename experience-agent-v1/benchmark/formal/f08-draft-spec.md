# F08 起草规范（配额 / 限流与用量记账）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F08 产物）
> 流程：本规范确认 → `scripts/formal-author-f08.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 加入 F08 → 独立验真
> 当前禁止：F08 签署 · 冻结 · commit · manifest（LOCKED，门槛 = 全 120 槽位冻结）· 回写 F01–F07

---

## 〇、防重复声明（写入 f08-review.md 顶部）

> **F08 不测试权限判定、事件排序或通用状态机恢复。** 其主要被测对象是：
> **共享资源配额的计算、并发消耗、幂等记账与最终一致性（账务对账）。**
>
> 与相邻族的边界：
> ```
> F06：解决"有没有权限"（policy precedence / access decision）
> F08：解决"有权限以后还能用多少、用了多少、并发时怎么算"（quota / usage / accounting）
> F04：事件顺序与状态恢复           F08：并发争用下的额度原子性与账务一致性
> F07：多层配置 merge/effective     F08：多层限额（global→tenant→user→endpoint）的生效与消耗
> ```

## 一、领域定位

```
F01 单模块工具 · F02 CLI+管线 · F03 HTTP+中间件 · F04 事件流+状态机
F05 依赖解析+lockfile · F06 权限策略 · F07 配置层叠 · F08 配额/限流/记账  ← 本族

核心行为面：共享资源 · 并发争用 · 额度消耗 · 原子性 · 幂等记账 · 对账一致性
```

## 二、⭐ 实现前必须冻结的六条语义（写进每个变体的 CONTRACT.md，checker 逐条引用）

> 目的：避免 F05-A2 那类"fixture/checker 与契约自相矛盾 ⇒ 任务不可满足"的事故。
> 每条必须在 CONTRACT.md 中**可判定地**写死，checker 断言与之一一对应。

```
S1 额度计算
    remaining = quota − used
    请求成本 cost <= remaining ⇒ allow
    cost > remaining ⇒ reject
    （usage 累计口径全族统一：按**权重 cost** 累加，不使用计数/token 等其它口径）

S2 时间窗口（全族统一 fixed window，不允许变体自选算法）
    窗口区间统一为 [window_start, window_end)
    恰好等于 window_end 的记录归入**下一窗口**，不属于当前窗口
    ⇒ 不把"窗口算法选择"引入为第二个被测变量；A2 专门制造 timestamp == window_end 的边界错误

S3 并发扣减
    used_after = used_before + Σ accepted_cost
    used_after <= quota（**不允许超扣**，可部分拒绝）
    断言方式：N 个并发请求后 used == Σ(被接受的 cost)，且 used ≤ quota；
             拒绝数 + 接受数 == N

S4 多层限制（生效规则写死）
    层级：global → tenant → user → endpoint
    对一个请求，所有适用层级均产生 quota limit，**最终有效额度 = 这些适用限制的最小值**
    effective_quota = min(global, tenant, user, endpoint)
    请求被拒绝时，reject_layer 必须为**导致该请求超出有效额度的具体层级**
    示例：global=100 / tenant=80 / user=60 / endpoint=70 ⇒ effective_quota=60；
          used=55、cost=10 ⇒ remaining=5、10>5 ⇒ reject，reject_layer=user

S5 幂等记账
    同一 request_id 重放/重试后**不得重复扣减**（断言：同一 id 提交两次后 used 只增加一次）

S6 对账（canonical 定义写死）
    raw usage records 为 **canonical source**；
    canonical used = raw records → 按 request_id 去重（仅统计有效记录）→ 按 S2 窗口规则过滤
                    → 求 accepted cost 总和
    聚合结果与该 canonical 结果不一致时，**以 canonical reconciliation result 为准**
    （S5 与 S6 由此自然衔接：raw → 去重 → 窗口过滤 → 汇总 → canonical used）

```

## 三、脚手架草案

```
<task>/
  quota.json            配额配置（多层：global/tenant/user/endpoint）
  usage.jsonl           原始用量记录（含 request_id / tenant / endpoint / cost / ts）
  window.js             窗口实现（S2 语义）
  limiter.js            限额判定（S1/S4）
  account.js            记账与聚合（S3 原子扣减 + S5 幂等 + S6 对账）
  ledger.json           账本产物（canonical 形式）
  CONTRACT.md           S1–S6 的显式声明
  check-*.js            分项验收（每 required 一个显式检查）
  verify.js             汇总验收（输出 token）
  （E 类另有 legacy 计费产物与 consumer）
```

## 四、十变体构念设计

### A 类（delegation=false）
```
A1 DIRECT：单额度计算错误（remaining 计算方向错 / 越界判定用了 >= 而非 >，导致恰好用尽被误拒）
A2 DIRECT|EXPLORE：窗口边界归属错误 —— 制造 `timestamp == window_end` 的边界记录
    （按 S2 应归**下一窗口**，实现错误地计入当前窗口）
    规则写在 CONTRACT.md（S2 fixed window），目标文件已知但判定依据在契约
```

### B 类（EXPLORE）
```
B1 多层 quota 配置冲突：global→tenant→user→endpoint 生效规则实现错误
    （需沿多层判定链定位是哪一层、以及 AND 语义是否被破坏）
B2 重复扣减/幂等问题：同一 request_id 重放导致重复记账（S5）
    （需探查幂等键与记账调用路径）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW；delegation=true）—— 与前族不重叠
```
C1 多个独立 usage source 并行汇总 + 硬预算 + **账务等价**
    两条约束同时成立：
      ① 硬预算：各 usage source 有固定汇总耗时，串行合计 > budget ⇒ verify 直接拒绝
      ② 并行汇总不得破坏账务语义：最终 ledger 的 canonical 形式必须等于
         **由固定记账规则独立生成的参考账本**
    正式判定：canonical(L_parallel) == canonical(L_reference)
      L_reference 由 checker 内嵌的**固定规则独立生成**（S6 canonical 定义）：
        raw usage records → 按 request_id 去重 → 按 S2 **fixed window** `[start,end)` 过滤
        （`ts == window_end` 归下一窗口）→ 按 tenant/endpoint 分组累加 accepted cost
        → canonical 排序 —— **不是**某次串行运行的副产物
    机械证据：distinct source 数 · span ≤ budget · canonical 等价 · ledger 完整性（无重复 request_id）
C2 批量 tenant/user 配额计算：并行处理多个 tenant，但**每个 tenant 内部窗口/层级判定顺序固定**；
    最终矩阵必须完整覆盖 tenant × endpoint；判定 = canonical(M_parallel) == canonical(M_reference)
    C1/C2 不得机械复制（对象集合/权重分布/耗时不同）
禁止：把"来源多/tenant 多所以适合并行"当作 GT 依据
⚠️ budget 是**接受约束**，不是截断 serial runner 的 kill 开关：顺序反事实必须完整跑完后由
   span > budget 被 verify 拒绝（stderr 命中），结果保留用于比较
```

### D 类（PARALLEL / WORKFLOW；delegation=true）
```
D1 多个限流模块分别存在缺陷 ⇒ 统一修复并验证整体额度结果（quota-report.json + 汇总校验）
    prompt 不得出现"互不依赖 / 可以并行 / 请并行处理"
D2 数据/接口/计算链连续缺陷 ⇒ 形成修复工作流：
    record repair → aggregation normalization → ledger regeneration → reconciliation report
    四份产物各有独立验收字段；prompt 只陈述交付物
```

### E 类（REPLAN；delegation=false）
```
E1 旧版计费规则与新版 quota 规则冲突：必须保留旧计费字段兼容（外部消费方按冻结产物回放），
    同时引入新额度语义（S1/S4）⇒ 新增兼容路径 + 调整非保护入口装配
    受保护：legacy 计费产物、consumer、check.js ⇒ 真实预跑 check.js → exit=1
E2 **账本真值与展示派生状态脱节（两个独立载体）**——⚠️ 与 F06 缓存失效、F07 层叠传播均不同：
    **固定载体（两个独立文件）**：
      ledger.json          业务真值源：{ quota: 100, used: 80 }   ⇒ 真实 remaining = 20
      display-snapshot.json 派生展示数据：{ remaining: 70 }      ⇒ 残留旧值（对应 used = 30）
    权威性声明（写入 CONTRACT.md）：
      > **ledger.json 是业务真值源；display snapshot 只是派生展示数据，不得成为额度计算的权威来源。**
    真实行为证据：
      remaining() 在未修复态直接返回 display-snapshot.json 的值 ⇒ actual = **70**
      按账本重算应为 100 − 80 = 20                            ⇒ expected = **20**
    检查方式（禁止结构/字符串断言）：
      assert.strictEqual(remaining(), 20, 'display 必须由账本重算，实际 ' + remaining());
      （未修复：actual_display_remaining = 70 / expected_remaining = 20；修复后：20 / 20）
    真实预跑：reconcile.js → exit=1
    与相邻族的区别：F06 是 (policy_id, policy_version) 缓存键失效；F07 是层叠状态变更后的传播；
                    F08 E2 是**账本真值与展示派生状态脱节**
```

## 五、交付物与门禁（与 F01–F07 同构）

```
交付物：scripts/formal-author-f08.ts · 10 个 FORMAL-F08-*.yaml · formal-seeds-f08.ts ·
       f08-review.md · f08-gt-drafts.json · f08-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实（同 fixture / 同 source 集合 / 同预算 / 仅改调度）
        + canonical(L_parallel)==canonical(L_reference)（参考由固定记账规则独立生成）
        + 并发原子性证据（S3：used ≤ quota 且 used == Σ接受成本）
```

## 六、实现模板与已知陷阱（沿用 F04–F07 骨架）

```
复用：导入块/路径常量/runFixRunStrict（三分类 + 阶段前置清理）/Variant 接口/
     YAML 发射规则（uniform 两项 + extraChecks，path 自动补前缀）/node 证据循环/
     seeds 格式/schema 校验（loadTask + issues）/verifyTask 证据链/产物发射/exit 0|3

陷阱清单（本会话实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05 registry 结构不一致 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2 不可满足）⇒ 本族先冻结 S1–S6
  ③ `.mjs` 工具脚本禁 TS 语法、禁混用 require（F03/F05 各一次）
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希复算须用序数排序（Ordinal）
  ⑤ 证据类检查器必须纯读取，不得为验证而重跑被测动作（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入（F03 两次）
  ⑦ 并发任务不得依赖真实竞态产生失败（避免不可复现）：并发语义必须由**断言**刻画（S3），
     而非依赖调度时序本身 ⇒ 否则 BEFORE/AFTER 会 flaky
```

## 七、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F07 的 frozen hash / GT / 任务内容
C 类不得只凭"来源多/tenant 多"判定；E2 不得退化为缓存失效/结构断言
prompt 不得写入结构性 cue
当前禁止：F08 签署 · 冻结 · commit · manifest
```

## 八、当前基线

```
F01–F07 frozen：**70/120** · 独立验真 **140/140 PASS**（针对已冻结 70 个任务）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F08：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
```
