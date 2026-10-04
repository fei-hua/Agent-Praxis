# F05 起草规范（依赖解析 / 包图 / Lockfile 一致性）

> 状态：**规范已获授权起草**（用户裁定 F05 领域）；**生成器尚未编写**（本轮未产生任何 F05 产物）
> 起草阶段：draft + seeds + 三层证据 → 交人工独立构念审查 → 机械门禁 → 加入 formal-verify-all → 独立验真 → 签署 + 冻结
> 当前禁止：F05 签署 · 冻结 · commit · manifest（LOCKED，门槛 120/120）· 回写 F01–F04

---

## 一、领域定位（与已冻结四族的区分）

```
F01  单模块 JS 工具
F02  CLI + 数据管线
F03  HTTP handler + middleware
F04  事件流 + 状态机
F05  依赖图 + 版本解析 + lockfile          ← 本族

领域元素：manifest → dependency graph → version constraint → transitive dependency
         → conflict resolution → lockfile → integrity / reproducibility
```

## 二、脚手架草案（每变体同构）

```
<task>/
  manifest.json          顶层依赖声明（semver 约束）
  packages/<name>/package.json    （C/D 类为多包 workspace）
  registry.json          可用版本与依赖元数据（离线注册表；确定性、无网络）
  resolver.js            解析器（约束求解 + 依赖遍历 + 冲突处理）
  graph.js               依赖图构建与遍历（顺序敏感性所在）
  lockfile.js            lockfile 生成/规范化（canonical 排序与完整性字段）
  lockfile.json          既有 lockfile（部分变体为冻结的 legacy 产物）
  CONTRACT.md            解析契约（约束语义 / 遍历顺序 / 冲突规则 / lockfile 完整性）
  check-*.js             分项验收脚本（每 required 一个显式检查）
  verify.js              汇总验收（输出 token）
```

约定：`verify.js` 与 `check-*.js`、`CONTRACT.md`（及部分变体中的 legacy 产物）为**受保护文件**；
`protected_paths` 一律 `pilot-workspace/<task>/...`。

## 三、十变体构念设计（A–E 各 2）

### A 类（delegation=false）
```
A1  DIRECT：resolver 对 manifest 中 `^2.4` 的约束**错误选中 1.x**
    症状与位置明确（resolver.js 的约束匹配）⇒ 直接修复
A2  DIRECT|EXPLORE：lockfile.json 中已冻结明确的解析结果，但实现未按 lockfile 语义执行
    （例如忽略 lockfile 中的 pinned 版本、或未按 lockfile 校验完整性）
    目标文件已知，但"必须遵循 lockfile 语义"的判定依据写在 CONTRACT.md ⇒ 两种首决策并列成立
```

### B 类（EXPLORE）
```
B1  transitive dependency 缺失：顶层包齐备，但间接依赖未进入最终图
    ⇒ 需沿 dependency graph 遍历定位（可能在 graph.js 的遍历深度或 resolver 的入队逻辑）
B2  冲突依赖：A→x@1.x、B→x@2.x，resolver 的 conflict handling 错误（选择策略/回退顺序）
    ⇒ 需探查约束求解与冲突选择两处 ⇒ EXPLORE
（两变体必须有真实故障面：BEFORE 态 verify 必须真实失败）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW；delegation=true）
```
C1/C2 多 package workspace 同时解析：每个 package 内部的**依赖解析顺序必须保持**
    约束（两条同时成立，缺一不可）：
      ① 硬预算：每个 package 有固定解析耗时，串行合计 > budget ⇒ verify 直接拒绝
      ② 每 package 内部依赖顺序保持：输出必须等于按依赖声明顺序（或 CONTRACT 规定顺序）
         遍历所得序列（声明顺序与 registry 中的自然顺序故意不同 ⇒ 保序非平凡）
    机械证据必须包含：
      · distinct package 数（= 期望集合大小）
      · span ≤ budget
      · 每个 package 的依赖顺序断言（产物序列 == 按契约顺序遍历的序列）
      · 最终 lockfile completeness（所有 package 的依赖全部出现且无遗漏）
    C2 额外：统一 lockfile 合并（merged lockfile 覆盖全部 package）——与 C1 不得机械复制
    禁止：把"包很多所以适合并行"作为 GT 依据
```

### D 类（PARALLEL / WORKFLOW；delegation=true）
```
D1  三个 package graph 各有真实缺陷，最终必须生成**完整 unified lockfile**
    prompt 不得出现"互不依赖/各自独立脚本/可并行"等结构性 cue
D2  多阶段依赖修复：graph repair → version normalization → lockfile regeneration
    产物为分阶段文件 + 最终 lockfile；prompt 只陈述交付物与验收，不描述并行性
```

### E 类（REPLAN；delegation=false）
```
E1  legacy lockfile 与新 resolver contract 冲突：必须**保留旧字段**（外部消费方按冻结产物回放），
    同时增加新的 integrity / resolution 信息
    受保护：legacy lockfile、consumer、check.js（不得修改）⇒ 需新增兼容路径并调整装配
    真实预跑：check.js → exit=1
E2  reproducibility / deterministic resolution：
    同一输入连续 resolve() 两次，必须得到 canonical 相同的 lockfile
    未修复实现因**非确定排序 / 依赖遍历顺序 / 冲突选择**产生不同结果
    检查方式（硬红线，禁止字符串断言）：
        const l1 = resolve(input);
        const l2 = resolve(input);
        assert.deepStrictEqual(canonical(l1), canonical(l2));   // canonical = 递归键排序后的规范形式
    真实预跑：repro.js → exit=1，并给出**实际差异**（例如 l1 的依赖顺序 vs l2 的依赖顺序，
        或某字段 actual ≠ expected 的真实数值/序列），不得只查 lockfile 是否包含某字符串
```

## 四、交付物与门禁（与 F01–F04 同构）

```
交付物：
  scripts/formal-author-f05.ts（生成器：draft YAML + seeds + 三层证据 + review + version）
  benchmark/tasks/formal/FORMAL-F05-{A1,A2,B1,B2,C1,C2,D1,D2,E1,E2}.yaml
  benchmark/formal-seeds-f05.ts · f05-review.md · f05-gt-drafts.json · f05-version.json
  （E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实证明（同 fixture / 同包集合 / 同预算 / 仅改调度）+ 正式 fixRun 证据
        （exit=0 · distinct package 数正确 · span ≤ budget · 每包顺序保持 · lockfile 完整）

随后：formal-verify-all 加入 F05 → 独立验真（目标 100/100 = F01..F05）
     → 人工构念审查 → 签署 + 冻结（三哈希 + status: frozen + gt_signed_*）
```

## 五、实现模板（沿用 F04 已验证的生成器骨架）

```
复用（在 scripts/formal-author-f04.ts 中已验证）：
  · 导入块与路径常量（F04→F05 改名）
  · runFixRunStrict（EXIT/SIGNAL/SPAWN_ERROR 严格分类 + 每阶段前置清理 timeline/out 等价状态）
  · interface Variant + V 辅助
  · YAML 发射规则（uniform 两项 + extraChecks；path 自动补 pilot-workspace/<id>/；expect 用 JSON.stringify；
    expected_files = Object.keys(fix)；protected_paths = verify.js + protectedExtra）
  · node 证据循环（临时 evDir：BEFORE → 写 fix → fixRun → AFTER）
  · seeds 模块格式（FORMAL_F0X_SEEDS + pilot-workspace/package.json 头）
  · schema 校验（loadTask(parseYaml(...)) + issues）
  · verifyTask 证据链（预跑 → 基线冻结 → before/fix/fixRun/after → 清理）
  · 产物发射（gt-drafts / review / version = 10 YAML + seeds + slots）· 汇总 exit 0/3
F05 需新写：10 个变体定义（上述 fixture/checker/fix），以及 C 类的多包编排与 E2 的 canonical 复现检查
```

## 六、红线（F05 全程有效）

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA / GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F04 的 frozen hash / GT / 任务内容
不得只凭"适合并行/包很多"判定 C 类；不得用字符串断言替代 E2 的 canonical 复现检查
不得在 prompt 写入结构性 cue
当前禁止：F05 签署 · 冻结 · commit · manifest
```

## 七、当前基线

```
F01–F04 frozen：**40/120** · 独立验真 **80/80 PASS**
formal manifest：LOCKED（文件不存在，门槛 120/120）
git：未 commit（HEAD c360187）
F05：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
```
