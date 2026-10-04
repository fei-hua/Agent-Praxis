# F09 起草规范（模板渲染与快照一致性）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F09 产物）
> 流程：本规范确认 → `scripts/formal-author-f09.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 纳入 F09 → 独立验真
> 当前禁止：F09 签署 · 冻结 · commit · manifest（LOCKED，门槛 = 全 120 槽位冻结）· 回写 F01–F08

---

## 〇、领域边界（必须排除项，写入 f09-review.md 顶部）

```
F09 只研究：给定**模板**、**显式输入变量**与**固定渲染规则**时，如何得到正确且稳定的输出。

明确不引入（避免与相邻族构念重叠）：
  ❌ 配置层级覆盖（F07）        ❌ quota / rate limit / billing（F08）
  ❌ cache 命中与失效           ❌ lockfile / dependency resolution（F05）
  ❌ 权限 / 策略决策（F06）      ❌ 事件流 / 状态机恢复（F04）
  ❌ deployment / rollback 状态迁移     ❌ HTTP / middleware（F03）     ❌ 通用 workflow 正确性本身

特别声明：**F09 不做"模板配置层级覆盖"**。模板变量来自**已确定的显式输入对象**，
不得引入 global → tenant → user 之类 precedence（否则撞 F07）。

与 F08-E2 的区分（须在 review 中写明）：F08-E2 的对象是"配额账本 vs 展示派生值"；
F09-E2 的对象是"**模板源 vs 渲染快照**"，计算语义与产物均不同（渲染 vs 记账），
形式相似但 failure mode 不同。
```

## 一、⭐ 实现前必须冻结的渲染语义（每变体 CONTRACT.md 显式声明，checker 逐条引用）

> 目的：模板领域极易出现"checker 与 CONTRACT 自相矛盾"⇒ 先冻结语义（同 F07 的做法）。

```
R1 变量替换：`{{name}}` 形式（**全族统一**，不混用 ${} / <% %> 等）
             缺失变量 ⇒ 渲染为**空字符串**（不得报错、不得保留占位符）
             变量值为 null ⇒ 同样渲染为空字符串（null 与 missing 行为一致，写死）

R2 转义规则（写死）：插入值必须做 **HTML 转义**：& → &amp;  < → &lt;  > → &gt;  " → &quot;  ' → &#39;
                    模板**字面文本**不转义；仅变量插入处转义
                    多字符替换顺序写死：先 & ，再 < > " '（避免二次转义）

R3 include / partial：`{{> partial}}` 形式；在同一目录解析；**include 只做文本内联，不参与 block 体系**
                     深度语义（写死）：主模板 = depth 0；第一次 include = depth 1；**最大允许 depth = 10**
                     · 若下一次展开会使 depth > 10 ⇒ **render error**（失败并返回明确错误）
                     · 检测到**循环 include**（A→B→A）⇒ **render error**
                     · 两种情形一律**失败**：不得截断、不得输出未展开文本、不得部分输出
                     （本条必须**同时**出现在 CONTRACT.md 与 checker 中）

R4 继承 / block override：`{{extends base}}` + base 中 `{{block name}}…{{/block}}`；
                         子模板同名 block 覆盖父 block；**未被子模板覆盖的 block 保留父内容**；
                         子模板中 block 之外的文本被忽略（写死，避免歧义）
                         **仅允许单级 extends**：child 只能直接继承一个 base，**base 不得继续 extends**；
                         发现**多级继承**或**继承循环**（A→B→A）⇒ **render error**（不得部分输出）
                         ⇒ B2 保持 "child → base" 的单级语义，不扩张为完整模板继承引擎

R5 快照（snapshot）canonical 形式：每份渲染产物写为 `snapshots/<name>.snap`，规范化链条写死为：
                                   **UTF-8 bytes** → **CRLF → LF** → 不删除/不增加其它任何空白 → **逐字节比较**
                                   **最终换行符属于快照内容**：`"hello\n"` 与 `"hello"` 必须判定为**不同**快照
                                   canonical 比较不忽略行尾空白（与上一条一致）

R6 确定性：同一输入集合重复渲染必须得到**逐字节相同**的 snapshot；
           共享依赖（partial/base）被多个模板使用时，执行顺序不得改变任一 snapshot
```

## 二、脚手架草案

```
<task>/
  templates/<name>.tpl        模板源（含 {{var}} / {{> partial}} / {{extends}} / {{block}}）
  templates/partials/*.tpl    被 include 的片段
  vars/<name>.json            显式输入变量对象（已确定，无层级 precedence）
  renderer.js                 渲染实现（解析 + 变量替换 + 转义 + include + 继承）
  snapshots/<name>.snap       快照产物（canonical 形式）
  CONTRACT.md                 R1–R6 的显式声明
  check-*.js                  分项验收（每 required 一个显式检查）
  verify.js                   汇总验收（输出 token）
  （E 类另有 legacy 模板/consumer 或 template-source 目录）
```

## 三、十变体构念矩阵（人工裁定冻结）

| id | 构念 | 类别 | delegation |
|---|---|---|---|
| A1 | 单变量模板渲染正确性 | A | false |
| A2 | 特殊字符转义后的渲染一致性 | A | false |
| B1 | Include / Partial 展开正确性 | B | false |
| B2 | 模板继承与 Block Override 正确性 | B | false |
| C1 | 独立模板并行渲染的一致性 | C | true |
| C2 | 共享模板依赖下的确定性快照 | C | true |
| D1 | 多模板包的并行生成 | D | true |
| D2 | 预处理 → 渲染 → 快照 → 验证的依赖工作流 | D | true |
| E1 | 模板契约变化后的 REPLAN | E | false |
| E2 | 模板源与派生 Snapshot 的权威关系 | E | false |

### A 类（DIRECT / DIRECT|EXPLORE）
```
A1：单变量替换正确性，唯一变量 = 变量取值替换（renderer 未替换 / 替换错位置）
    ⇒ DIRECT（单文件单症状）
A2：转义规则（R2）写在 CONTRACT.md；实现漏转义 `"`（或转义顺序错误导致 &amp;lt; 二次转义）
    ⇒ DIRECT|EXPLORE（目标文件已知，但转义规则依据在契约）
```

### B 类（EXPLORE）
```
B1：include/partial 展开不完整或顺序错误（例如只展开一层、或忽略嵌套 partial）
    需沿模板依赖定位 ⇒ EXPLORE
B2：继承/override 语义错误（子 block 未覆盖父 block，或父 block 残留重复输出）
    需要区分 R3（include）与 R4（inherit）两条不同机制 ⇒ EXPLORE
（B1 与 B2 必须是**两个明显不同的机制**：文本内联 vs block 覆盖体系）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW）—— 与 C1/C2 构念分离
```
C1 = **独立模板并行渲染的一致性**（模板彼此不共享依赖）
    硬预算 + 三模板各自固定渲染耗时；串行合计 > budget ⇒ verify 拒绝
    并行 ⇒ span ≤ budget，且三份 snapshot 逐个等于**独立参考渲染器**（checker 内嵌）的结果
    ⇒ 测的是"独立单元的并行渲染不改变快照"
C2 = **共享模板依赖下的确定性快照**（多模板共享 common partial/base）
    约束：并行/任意执行顺序下，snapshot 必须逐字节等于固定规则参考结果；
          并额外断言**顺序无关性**：以两种不同的完成顺序各渲染一次，两次 snapshot 必须逐字节相同
    ⇒ 测的是"共享依赖 + 顺序变化不产生漂移"（与 C1 的"独立单元"不同）
两者共用：同一 budget 机制（6500ms）、同一 canonical 比较、同一独立参考实现原则
```

### D 类（PARALLEL / WORKFLOW）
```
D1：多个独立模板包（如 backend / frontend / worker / docs）并行生成，最终统一 snapshot 校验
    prompt 不得出现"互不依赖 / 可以并行 / 请并行处理"
D2：垂直依赖工作流：prepare → render → snapshot → verify，
    **后一步必须消费前一步产生的真实 artifact**（产物字段可机械校验）；
    构念主体是"artifact 依赖链"，不是"workflow 本身"
```

### E 类（REPLAN）
```
E1：旧模板语法与新渲染契约不兼容（模板用 `{{name}}`，新 renderer 契约要求 `${name}` 或反之），
    且既有模板/consumer 冻结、check.js 不得修改 ⇒ 检测契约变化后必须重新确定渲染路径
    （新增兼容渲染层 + 调整非保护入口），真实预跑 check.js → exit=1
E2：**模板源 vs 派生快照的权威关系**（两个**实际载体**，不写成抽象声明）：
    ```
    templates/main.tpl    ← CANONICAL SOURCE（权威源）
    snapshots/main.snap   ← DERIVED ARTIFACT（派生产物）
    ```
    唯一合法方向（写入 CONTRACT.md，并作为 checker 的判定前提）：
    ```
    Template Source → Renderer → Snapshot        （允许）
    Template Source ←→ Snapshot                  （禁止：不得互为权威）
    ```
    未修复：snapshot 生成直接读取 `snapshots/`（残留旧值，即陈旧派生物）⇒ 修改 `templates/main.tpl` 后 snapshot 仍为旧内容
    真实行为证据（真实预跑 snapshot.js → exit=1）：
      render #1 ⇒ snapshot 与 templates/main.tpl 一致（例如 "Hello Alice"）
      修改 `templates/main.tpl`（Alice → Bob，**只改 source**）⇒ render #2 期望 snapshot = "Hello Bob"；
      未修复仍返回旧快照 "Hello Alice" ⇒ actual = 旧内容 / expected = 新内容（业务结果差异，非结构断言）
    契约声明（写入 CONTRACT.md）：
      > `templates/` 是 canonical source；`snapshots/` 只是派生 artifact，不得作为渲染权威来源。
      > **直接修改 snapshot 不能替代 source 更新**；snapshot 必须由 source 重新派生。
    检查纪律（写死）：**checker 不得以 snapshot 反推 source 来证明自身正确** ——
                    正确性必须来自"由 source 重新 render 后的结果"与独立参考渲染的一致。
    与 F08-E2 的区分（须在 review 写明）：F08-E2 的对象是"配额账本 → 展示派生值"（账务计算语义）；
                                        F09-E2 的对象是"模板源 → 渲染快照"（渲染语义与产物均不同）。
```

## 四、交付物与门禁（与 F01–F08 同构）

```
交付物：scripts/formal-author-f09.ts · 10 个 FORMAL-F09-*.yaml · formal-seeds-f09.ts ·
       f09-review.md · f09-gt-drafts.json · f09-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实（同 fixture / 同模板集合 / 同预算 / 仅改调度）
        + snapshot == 独立参考渲染结果（checker 内嵌参考实现，不与被测 renderer 共享代码）
        + C2 额外：顺序无关性（两种完成顺序 ⇒ snapshot 逐字节相同）
```

## 五、实现模板与已知陷阱（沿用 F04–F08 骨架）

```
复用：导入块 / 路径常量 / runFixRunStrict（三分类 + 阶段前置清理）/ Variant 接口 /
     YAML 发射规则（uniform 两项 + extraChecks，path 自动补前缀）/ node 证据循环 /
     seeds 格式 / schema 校验（loadTask + issues）/ verifyTask 证据链 / 产物发射 / exit 0|3

陷阱清单（本会话实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05 registry 结构不一致 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2 不可满足）⇒ 本族先冻结 R1–R6
  ③ `.mjs` 工具脚本禁 TS 语法、禁混用 require（F03/F05/F08 各一次）
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希复算须用序数排序（Ordinal）
  ⑤ 证据类检查器必须纯读取，不得为验证而重跑被测动作（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入（F03 两次）
  ⑦ **生成器内多行字符串的转义层级**：构造"生成代码里的 \n"时，用
     `JSON.stringify(layer2Text)` 生成字面量，禁止手数反斜杠（F08-C2 因此先错一轮）
  ⑧ C 类变体必须承担**不同 failure mode**，不能只是"换一组数据"（F08-C2 据此重构为
     "跨来源重叠分片 ⇒ 全局幂等"）；本族 C1 = 独立模板 / C2 = 共享依赖 + 顺序无关性
```

## 六、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F08 的 frozen hash / GT / 任务内容
C 类不得只凭"模板多所以适合并行"判定；E2 不得退化为结构/字符串断言
prompt 不得写入结构性 cue
当前禁止：F09 签署 · 冻结 · commit · manifest
```

## 七、当前基线

```
F01–F08 frozen：**80/120** · 独立验真 **160/160 PASS**（针对已冻结 80 个任务）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F09：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
```
