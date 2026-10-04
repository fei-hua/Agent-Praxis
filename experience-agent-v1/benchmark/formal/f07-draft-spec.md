# F07 起草规范（配置层叠与合并语义）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F07 产物）
> 流程：本规范确认 → `scripts/formal-author-f07.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 加入 F07 → 独立验真
> 当前禁止：F07 签署 · 冻结 · commit · manifest（LOCKED，门槛 120/120 全族冻结）· 回写 F01–F06

---

## 一、领域定位

```
F01 单模块 JS 工具 · F02 CLI+数据管线 · F03 HTTP+中间件 · F04 事件流+状态机
F05 依赖解析+lockfile · F06 权限策略+访问控制 · F07 配置层叠+合并语义  ← 本族

层叠链（本族核心）：defaults ≺ environment ≺ profile ≺ local ⇒ final effective config
行为面：层级覆盖 · 深层 merge · 数组 replace/append · null vs missing · 继承 ·
       冲突解析 · effective config · 配置迁移与兼容
```

## 二、⭐ 实现前必须冻结的六条语义（写进每个变体的 CONTRACT.md，checker 逐条引用）

> 目的：避免 F05-A2 那类"fixture/checker 与契约自相矛盾 ⇒ 任务不可满足"的事故。
> **每条语义必须在 CONTRACT.md 中用可判定的措辞写死，且 checker 的断言必须与之一一对应。**

```
S1 missing ≠ null
   · 键**缺失** ⇒ 不参与层叠（下层值保留）
   · 键存在且值为 null ⇒ 按 S5 的删除语义处理

S2 object ⇒ deep merge（递归合并；叶子按层叠覆盖）

S3 array ⇒ 语义必须显式声明其一，且全局一致：
   · replace：上层数组整体替换下层
   · append ：上层数组追加到下层之后（顺序 = 下层 + 上层）
   （每个变体只允许选一种，并在 CONTRACT.md 写明；checker 只按该语义断言）

S4 覆盖方向（layer precedence）固定为：
   defaults < environment < profile < local （后者覆盖前者）
   ⇒ 任何实现不得反向覆盖

S5 删除语义：null **是否**表示删除必须显式声明
   · 若声明"null = 删除该键" ⇒ 层叠后该键不存在
   · 若声明"null 是普通值" ⇒ 层叠后该键 = null
   （两种都合法，但必须写死；checker 与 fixture 必须一致）

S6 迁移与兼容：legacy 字段的保留要求必须在 CONTRACT 中列出（供 E1 使用）
```

## 三、脚手架草案

```
<task>/
  layers/defaults.json · layers/environment.json · layers/<profile>.json · layers/local.json
  CONTRACT.md        上述六条语义的**显式声明**（S1–S6 逐条）
  merge.js           层叠合并实现（deep merge / 数组语义 / null 处理）
  resolve.js         按 layer precedence 生成 effective config
  schema.json        键类型约束（供 schema repair / 校验）
  check-*.js         分项验收（每 required 一个显式检查）
  verify.js          汇总验收（输出 token）
  （E 类另有 legacy 产物与 consumer）
```

## 四、十变体构念设计

### A 类（delegation=false）
```
A1 DIRECT：单字段覆盖方向错误 —— local 应覆盖 default，实现反向覆盖（default 覆盖 local）
A2 DIRECT|EXPLORE：merge 规则写在 CONTRACT.md（S1 null vs missing、S5 删除语义），
    实现错误处理 null/missing ⇒ 目标文件已知但判定依据在契约
```

### B 类（EXPLORE）
```
B1 深层嵌套配置缺失：root → service → database → timeout，中间某层 merge 丢失（只合并一层）
B2 数组 merge 语义错误：CONTRACT 声明 replace，实现为 append（需定位 merge 层与调用路径）
（两变体均须真实故障面：BEFORE 态 verify 真实失败）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW；delegation=true）—— 与前族不重叠的构念
```
C1 多来源配置加载 + 硬预算 + **层叠语义保持**
    两条约束同时成立：
      ① 硬预算：config-a/b/c 各自固定加载耗时，串行合计 > budget ⇒ verify 直接拒绝
      ② 并行加载不得破坏层叠语义：最终 effective config 必须等于
         **由固定层叠规则独立生成的参考结果**
    正式判定：canonical(E_parallel) == canonical(E_reference)
      E_reference 由 check-timeline.js 用固定规则（defaults<environment<profile<local + S1..S5）
      从同一批层文件独立归并生成 —— **不是某一次串行运行的副产物**
    机械证据：distinct 来源数 · span ≤ budget · canonical(E_parallel)==canonical(E_reference)
             · effective config 完整性（CONTRACT 声明的必需键全部存在）
C2 多 profile 批量生成 effective config：多 profile 可并行处理，
    但每个 profile 内部必须保持固定 layer 顺序；最终矩阵必须完整覆盖 profile × key
    ⇒ 判定：canonical(matrix_parallel) == canonical(matrix_reference)（同一固定规则生成）
禁止：把"来源多/profile 多所以适合并行"当作 GT 依据
⚠️ budget 是**接受约束**，不是截断 serial runner 的 kill 开关：顺序反事实必须完整跑完，
   以"超预算"被 verify 拒绝（stderr 明确命中），且结果保留用于比较
```

### D 类（PARALLEL / WORKFLOW；delegation=true）
```
D1 多个配置模块存在不同真实缺陷 ⇒ 最终生成统一 effective-config.json 与 config-report.md
    prompt **不得**出现"互不依赖 / 可以并行 / 请并行处理"
D2 schema repair → layer normalization → effective-config generation → validation report
    四份产物各有独立验收字段；prompt 只陈述交付物
```

### E 类（REPLAN；delegation=false）
```
E1 legacy config 格式与新 schema 冲突：必须保留旧字段兼容（外部消费方按冻结产物回放），
    同时引入新层级语义（S4/S6）
    受保护：legacy config、consumer、check.js ⇒ 需新增兼容路径并调整非保护入口装配
    真实预跑：check.js → exit=1
E2 **层叠变更后的依赖传播 / effective-config 重算错误**（⚠️ 不是 F06 的缓存失效！）
    语义：effective config 必须由**当前**层树按需推导；不得使用加载时拍下的快照
    未修复实现：resolve.js 在模块加载时把 profile 层快照进常量 ⇒ 之后修改 profile 层不传播
    真实行为证据：
      resolve() → timeout = 30        （profile P1）
      setLayer('profile', { timeout: 60 })   // 修改层叠输入
      resolve() → **期望 60**，未修复态仍为 30  ⇒ actual=30 / expected=60（业务结果差异）
    检查方式（禁止结构/字符串断言）：
      assert.strictEqual(resolve().timeout, 60, '层叠输入变更后 effective config 必须重算，实际 ' + resolve().timeout);
    真实预跑：propagate.js → exit=1
```

## 五、交付物与门禁（与 F01–F06 同构）

```
交付物：scripts/formal-author-f07.ts · 10 个 FORMAL-F07-*.yaml · formal-seeds-f07.ts ·
       f07-review.md · f07-gt-drafts.json · f07-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实（同 fixture / 同层文件集合 / 同预算 / 仅改调度）
        + canonical(E_parallel)==canonical(E_reference)（参考由固定规则独立生成）
        + 正式 fixRun 证据（exit=0 · distinct 来源/profile 数正确 · span ≤ budget）
```

## 六、实现模板与已知陷阱（沿用 F04–F06 骨架）

```
复用：导入块 / 路径常量 / runFixRunStrict（三分类 + 阶段前置清理）/ Variant 接口 /
     YAML 发射规则（uniform 两项 + extraChecks，path 自动补前缀）/ node 证据循环 /
     seeds 格式 / schema 校验（loadTask + issues）/ verifyTask 证据链 / 产物发射 / exit 0|3

陷阱清单（本会话已实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05：registry 结构不一致 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2 ⇒ 任务不可满足）；本族先冻结 S1–S6 即为此
  ③ `.mjs` 工具脚本禁含 TS 语法、禁混用 require（F03/F05 各踩一次）
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希复算须用**序数排序**（[System.StringComparer]::Ordinal）
  ⑤ 证据类检查器必须**纯读取**，不得为验证而重跑被测动作（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入（F03 两次翻车）
```

## 七、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F06 的 frozen hash / GT / 任务内容
C 类不得只凭"来源多/profile 多"判定；E2 不得退化为缓存失效或结构断言
prompt 不得写入结构性 cue
当前禁止：F07 签署 · 冻结 · commit · manifest
```

## 八、当前基线

```
F01–F06 frozen：**60/120** · 独立验真 **120/120 PASS**（针对 F01–F06 已冻结族）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F07：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
```
