# F06 起草规范（权限策略 + 访问控制 + 决策合并）

> 状态：**规范已获授权撰写**；**生成器尚未编写**（本轮无任何 F06 产物）
> 流程：本规范交人工确认 → `scripts/formal-author-f06.ts` → draft + 三层证据 → 机械门禁
>       → 交人工独立构念审查 → 签署 + 冻结 → formal-verify-all 加入 F06 → 独立验真（目标 120/120 逐步推进）
> 当前禁止：F06 签署 · 冻结 · commit · manifest（LOCKED，门槛 120/120）· 回写 F01–F05

---

## 一、领域定位（与前五族的边界）

```
F01  单模块 JS 工具
F02  CLI + 数据管线
F03  HTTP handler + middleware
F04  事件流 + 状态机
F05  依赖解析 + lockfile
F06  权限策略 + 访问控制 + 决策合并      ← 本族

领域元素（不做成"写一个权限系统"，而是围绕评估语义构造任务）：
  policy set → 条件匹配 → 角色/权限/资源继承 → 优先级（precedence）→ allow/deny 冲突
  → decision（含解释）→ 决策缓存与失效 → 审计报告
```

## 二、脚手架草案（每变体同构）

```
<task>/
  policies/<name>.json       策略条目：{ id, effect: allow|deny, priority, subject, action, resource, conditions? }
  POLICY.md 或 CONTRACT.md   评估契约（匹配语义 / 优先级 / 冲突规则 / 继承链 / 缓存失效条件）
  roles.json                 角色 → 权限 → 资源 的继承关系
  evaluator.js               策略评估器（匹配 + 优先级 + 合并）
  precedence.js              优先级/覆盖顺序实现（部分变体缺陷所在）
  cache.js                   决策缓存（含失效判定；E2 缺陷所在）
  audit.js                   审计报告生成（决策 + 命中策略 + 解释）
  check-*.js                 分项验收（每 required 一个显式检查）
  verify.js                  汇总验收（输出 token）
```

约定：`verify.js`、`check-*.js`、契约文档，以及相应变体中的冻结产物为**受保护文件**；
`protected_paths` 一律 `pilot-workspace/<task>/...`。

## 三、十变体构念设计（A–E 各 2）

### A 类（delegation=false）
```
A1  DIRECT：单条策略的资源匹配规则写反（应允许的请求被拒绝）
    症状与位置明确（evaluator 的资源匹配）⇒ 直接修复
A2  DIRECT|EXPLORE：优先级约定写在 POLICY.md/CONTRACT.md（例如"高 priority 先匹配、首个命中即生效"），
    实现采用错误的覆盖顺序（低优先级覆盖高优先级）
    目标文件已知，但"正确覆盖顺序"的判定依据在契约文档 ⇒ 两种首决策并列成立
```

### B 类（EXPLORE）
```
B1  角色 → 权限 → 资源 三级继承链缺失一层（例如只展开角色→权限，未展开权限→资源）
    需要沿继承链定位 ⇒ EXPLORE
B2  allow / deny 冲突处理错误：两条策略同时命中，deny-overrides 语义未正确实现
    需探查匹配与合并两处 ⇒ EXPLORE
（两变体均须有真实故障面：BEFORE 态 verify 必须真实失败）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW；delegation=true）—— 继承 F03–F05 硬标准
```
C1  多策略来源并行评估 + **决策优先级保持**
    约束（两条同时成立）：
      ① 硬预算：各策略来源有固定评估耗时，串行合计 > budget ⇒ verify 直接拒绝
      ② 并行评估不得破坏策略语义：最终决策必须按 priority 降序（30 > 20 > 10）解释与合并，
         物理完成顺序可以乱，但合并结果必须等价于按 priority 顺序评估的结果
    机械证据必须包含：
      · distinct 来源数（= 期望集合大小）
      · span ≤ budget
      · **优先级等价断言**：并行合并结果 == 串行按 priority 顺序合并结果（同一输入，两种实现的规范形式相等）
      · 决策矩阵完整性（每条请求都有 decision + 命中策略 id + 解释）
C2  多租户/多资源批量评估：并行处理不同对象（tenant/resource），
    但**同一对象内部策略优先级不可打乱**；最终 decision matrix 必须完整覆盖全部对象 × 动作
    C1/C2 不得机械复制（对象集合/优先级分布/耗时不同）
禁止：把"策略多/对象多所以适合并行"当作 GT 依据
```

### D 类（PARALLEL / WORKFLOW；delegation=true）
```
D1  三套策略包各自有真实缺陷，最终必须生成统一 authorization report
    prompt **不得**出现"互不依赖 / 各自独立脚本 / 可并行"等结构性 cue
D2  多阶段流程：policy repair → precedence normalization → audit regeneration
    三份产物各有独立验收字段；prompt 只陈述交付物与验收
```

### E 类（REPLAN；delegation=false）
```
E1  legacy ACL 与新 RBAC contract 冲突：必须保留旧兼容语义（外部消费方按冻结产物回放），
    同时支持新策略字段（role/inheritance）
    受保护：legacy ACL、consumer、check.js ⇒ 需新增兼容路径并调整非保护入口装配
    真实预跑：check.js → exit=1
E2  **决策缓存失效错误**（本族重点，禁止退化为 `cache !== null` 之类的结构断言）：
    真实行为证据：
      evaluation #1：policy = P1 ⇒ decision = allow
      修改 policy ⇒ P2（同一资源/动作的 effect 改为 deny）
      evaluation #2：decision **应变为 deny**
      未修复态：仍命中旧缓存 ⇒ 返回 allow（actual=allow / expected=deny）
      修复态：缓存按策略版本/内容失效 ⇒ 返回 deny
    检查方式：
      const d1 = evaluate(req);            // P1 ⇒ allow
      mutatePolicy(P2);                    // effect: allow → deny
      const d2 = evaluate(req);            // 期望 deny
      assert.strictEqual(d2.decision, 'deny', '策略已变更，决策必须随更新，实际 ' + d2.decision);
    真实预跑：stale.js → exit=1，并在断言中给出 actual/expected 的**业务结果差异**（allow vs deny）
```

## 四、交付物与门禁（与 F01–F05 同构）

```
交付物：
  scripts/formal-author-f06.ts
  benchmark/tasks/formal/FORMAL-F06-{A1,A2,B1,B2,C1,C2,D1,D2,E1,E2}.yaml
  benchmark/formal-seeds-f06.ts · f06-review.md · f06-gt-drafts.json · f06-version.json
  （E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实证明（同 fixture / 同策略集合 / 同预算 / 仅改调度）
        + 优先级等价断言（并行合并结果 == 按 priority 顺序合并结果）
        + 正式 fixRun 证据（exit=0 · distinct 来源/对象数正确 · span ≤ budget · 决策矩阵完整）
```

## 五、实现模板（沿用 F04/F05 已验证骨架）

```
复用（scripts/formal-author-f0{4,5}.ts 已验证）：
  · 导入块与路径常量（F06 改名）
  · runFixRunStrict（EXIT/SIGNAL/SPAWN_ERROR 严格分类 + 每阶段前置清理）
  · interface Variant + V 辅助 · YAML 发射规则（uniform 两项 + extraChecks；path 自动补前缀）
  · node 证据循环（临时 evDir：BEFORE → 写 fix → fixRun → AFTER）
  · seeds 模块格式（FORMAL_F0X_SEEDS + pilot-workspace/package.json 头）
  · schema 校验（loadTask(parseYaml(...)) + issues 诊断）
  · verifyTask 证据链（预跑 → 基线冻结 → before/fix/fixRun/after → 清理）
  · 产物发射（gt-drafts / review / version = 10 YAML + seeds + slots）· 汇总 exit 0/3
F06 需新写：10 个变体定义（上述 fixture/checker/fix）+ C 类的"优先级等价"断言 + E2 的缓存失效行为检查
已知实现陷阱（前两族教训，必须避免）：
  · 共享数据结构形状必须与**所有消费方**一致（F05 首跑因 registry 结构不一致导致 3/10）
  · fixture 与 checker 不得自相矛盾（F05 A2 因 lockfile 固定版本不满足约束却要求采用，导致不可满足）
  · 证据脚本自身不得混用 ESM/CJS（`.mjs` 禁用 require / TS 语法）
  · PowerShell 读取 JSON 必须指定 -Encoding UTF8；哈希复算须用序数排序
```

## 六、红线（F06 全程有效）

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA / GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F05 的 frozen hash / GT / 任务内容
C 类不得只凭"策略多/对象多"判定；E2 不得退化为结构/字符串断言
prompt 不得写入结构性 cue
当前禁止：F06 签署 · 冻结 · commit · manifest
```

## 六之二、实现层定死的两条解释（用户裁定，规范正文不变）

### C1：优先级等价断言的正式判定形式

```
正式判定：canonical(M_parallel) == canonical(M_priority)
  其中 M_priority = 同一批策略输入按**固定 priority 规则**归并得到的**参考决策矩阵**（不是某一次串行运行的副产物）

⇒ C1 实际证明的是：并行调度 ∧ 不破坏 priority 语义 ∧ span ≤ budget
   而不是"并行结果恰好等于某一次串行运行结果"

顺序反事实必须**完整跑完并记录**：
  serial span > budget → verify 拒绝（exit≠0，stderr 命中「总耗时超预算」）
⚠️ budget 是**接受约束**，不是截断 serial runner 的运行时 kill 开关 ——
   不得因为超预算就提前 kill 导致缺少完整结果用于优先级等价比较。
```

### E2：策略版本载体（cache key）

```
cache key 至少包含：K = (policy_id, policy_version)
policy_version 可用：内容 hash，或显式单调 version
必须满足：P1 → v1 ；P1 改成 P2 → v2 ≠ v1

判据：
  evaluate(P1) → allow
  mutate P1→P2（v1→v2）
  evaluate(P2) → deny
未修复实现继续命中旧 cache ⇒ 形成真实业务差异：actual = allow / expected = deny
（不得退化为"检查 cache 是否被清空"的结构断言）
```

## 七、当前基线

```
F01–F05 frozen：**50/120** · 独立验真 **100/100 PASS**
formal manifest：LOCKED（文件不存在，门槛 120/120）
git：未 commit（HEAD c360187）
F06：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
```
