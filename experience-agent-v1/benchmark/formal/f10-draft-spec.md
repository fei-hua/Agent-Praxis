# F10 起草规范（数据校验与 Schema 演进 / 迁移）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F10 产物）
> 流程：本规范确认 → `scripts/formal-author-f10.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 纳入 F10 → 独立验真
> 当前禁止：F10 签署 · 冻结 · commit · manifest（LOCKED，门槛 = 全 120 槽位冻结）· 回写 F01–F09

---

## 〇、领域边界（写入 f10-review.md 顶部）

```
F10 只研究：数据实例 → Schema 验证 → 版本兼容性 → Schema 演进 → Migration → 验证迁移后的数据

明确排除：
  ❌ F05 dependency / lockfile      ❌ F07 configuration layering      ❌ F08 quota / billing
  ❌ F04 event stream / state transition                                ❌ F03 HTTP / middleware
  ❌ F09 template rendering / snapshot                                  ❌ 数据库性能优化本身
  ❌ 通用 workflow 本身

特别声明：**F10 的 migration 是"数据结构与数据内容的迁移"，不研究 deployment / rollback 编排**
（后者保留给 F12）。E2 的幂等性是 **schema migration 幂等性**，与 F08-C2 的"全局幂等记账"不是同一构念：
F08-C2 的对象是跨分片用量记录的账务去重；F10-E2 的对象是 migration 重复执行不产生二次副作用。
```

## 一、⭐ 实现前必须冻结的语义（每变体 CONTRACT.md 显式声明，checker 逐条引用）

```
V1 required 语义：schema 中 `required: true` 的字段在数据实例中**必须存在**；
                 缺失 ⇒ validation 失败，错误列表必须包含 {field, code:"required"}
V2 类型与可空性（写死）：类型集合仅 {string, integer, boolean}；
                 · `"18"` 对 integer 非法（**不做隐式转换**）
                 · `nullable:false` 时 null 非法；`nullable:true` 时 null 合法
                 · 错误列表必须包含 {field, code:"type"} 或 {field, code:"null"}
V3 错误报告 canonical 形式：错误列表按 (field 升序, code 升序) 排序后逐字段比较；
                 **不得依赖实现内部的校验遍历顺序**
V4 兼容性方向（写死）：
                 · backward = **new writer → old reader**：新 schema 写出的数据，旧 reader 必须能读
                 · forward  = **old writer → new reader**：旧 schema 写出的数据，新 reader 必须能读
                 · reader 对**未知字段**必须忽略（不得报错）；对**缺失的可选字段**必须容忍
V5 add/backfill 规则：新增字段必须按**冻结的 backfill 规则**填充（规则在 CONTRACT 中写死，
                 例如 `display_name := name`）；**record identity 必须保持**（原 id/顺序不变）
V6 rename/transform 规则：`first_name + last_name → display_name` 为**显式转换**；
                 · 不得把 rename 当作"新增字段"而保留旧字段（除非 CONTRACT 明确要求保留）
                 · **不得产生双重记录**（迁移前后 record_count 必须相同）
V7 migration 幂等（写死）：同一 migration 对已是目标版本的数据再次执行 ⇒
                 schema 保持目标版本、data 逐字节不变、record_count 不变（无二次副作用）
V8 迁移结果 canonical 形式：迁移产物（数据 + schema 版本）按 (id 升序) 排序后逐字节比较
```

## 二、脚手架草案

```
<task>/
  schemas/v1.json · schemas/v2.json     Schema 版本（字段/类型/required/nullable）
  data/records.jsonl                    数据实例（每行一条记录）
  validate.js                           Schema 校验（V1–V3）
  compat.js                             兼容性读取器（V4：old/new reader）
  migrate.js                            迁移实现（V5–V7）
  migrated.jsonl                        迁移产物（canonical 形式）
  CONTRACT.md                           V1–V8 的显式声明
  check-*.js                            分项验收（每 required 一个显式检查）
  verify.js                             汇总验收（输出 token）
  （E 类另有 legacy schema/consumer 或 migration 入口）
```

## 三、十变体构念矩阵（人工裁定冻结）

| id | 构念 | 类别 | delegation |
|---|---|---|---|
| A1 | Required Field 校验 | A | false |
| A2 | Type / Nullability 校验 | A | false |
| B1 | Backward Compatibility（new writer → old reader） | B | false |
| B2 | Forward Compatibility（old writer → new reader） | B | false |
| C1 | Additive Migration + Backfill | C | true |
| C2 | Rename / Transform Migration 与 Identity Preservation | C | true |
| D1 | 独立 Migration 的并行执行 | D | true |
| D2 | 有依赖关系的 Migration 顺序 | D | true |
| E1 | Breaking Schema Change → REPLAN | E | false |
| E2 | Migration 幂等性 | E | false |

### A 类（DIRECT / DIRECT|EXPLORE）
```
A1：单条缺失 required 字段（validate.js 未执行 required 检查）⇒ DIRECT（单文件单症状）
A2：类型/可空性规则写在 CONTRACT.md（V2），实现做了隐式转换（"18" 通过 integer）或漏判 null
    ⇒ DIRECT|EXPLORE（目标文件已知，判定依据在契约）
```

### B 类（EXPLORE）
```
B1：new writer → old reader：新 schema 新增字段后，旧 reader 对未知字段报错（应按 V4 忽略）
    ⇒ 需沿"writer 输出 → reader 校验"链定位 ⇒ EXPLORE
B2：old writer → new reader：旧数据缺少新 schema 的**可选**字段时，新 reader 报错（应容忍）
    ⇒ 与 B1 方向相反、failure mode 不同（不是简单换方向）
```

### C 类（DELEGATE / PARALLEL / WORKFLOW）—— 与 D 类分工：C 测"迁移语义正确"，D 测"迁移编排"
```
C1 additive + backfill：v1{name} → v2{name, display_name}
    约束：① 硬预算：三个数据分片的迁移各自固定耗时，串行合计 > budget（6500ms）⇒ verify 拒绝
          ② 并行迁移不得改变结果：migrated.jsonl 必须与**独立参考迁移实现**（checker 内嵌）逐字节一致
          （backfill 规则与 record identity 由 V5/V8 写死）
C2 rename/transform：v1{first_name,last_name} → v2{display_name}
    约束：① 同样硬预算 + 并行
          ② 变换结果必须等于独立参考；**record_count 不变**（禁止双重记录）；旧字段按 V6 处置
    C1 与 C2 的 failure mode：C1 = additive/backfill 正确性；C2 = 变换与 identity 保持
```

### D 类（PARALLEL / WORKFLOW）
```
D1 三个**互不依赖**的 migration（customers / orders / logs）并行执行，
    结果必须与 reference migration 逐项一致；prompt 不得出现"互不依赖/可以并行/请并行处理"
D2 **有依赖**的 migration 链：add column → backfill column → add constraint；
    后一步必须消费前一步真实产物（checker 断言 step2 的输入必须来自 step1 的输出文件、
    step3 的校验必须基于 step2 的结果）⇒ migration dependency correctness（非抽象 workflow）
```

### E 类（REPLAN）
```
E1 breaking schema change：既有 consumer 依赖 `email: string`，新 schema 变为 `email: object`
    ⇒ 旧迁移路径不满足兼容契约；正确行为是检测 breaking change 后重新规划（新增兼容迁移路径），
    而不是硬执行；受保护：legacy schema/consumer/check.js ⇒ 真实预跑 check.js → exit=1
E2 migration 幂等性：对已是 v2 的数据再次执行同一 migration
    ⇒ schema 保持 v2、data 逐字节不变、record_count 不变；
    真实预跑 idempotent.js → exit=1，断言给出**真实的二次副作用差异**
    （例如 actual="display_name: AliceAlice" / expected="display_name: Alice"，或 record_count 变化）
    ⇒ 与 F08-C2 的区别：对象是 migration 副作用，而非跨分片账务去重
```

## 四、交付物与门禁（与 F01–F09 同构）

```
交付物：scripts/formal-author-f10.ts · 10 个 FORMAL-F10-*.yaml · formal-seeds-f10.ts ·
       f10-review.md · f10-gt-drafts.json · f10-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实（同 fixture / 同数据分片 / 同 budget / 仅改调度）
        + 迁移产物 == 独立参考迁移（checker 内嵌，不与被测 migrate.js 共享代码）
        + C2 额外：record_count 不变（无双重记录）
  D2：断言 step 之间真实 artifact 传递
```

## 五、实现模板与已知陷阱（沿用 F04–F09 骨架）

```
复用：导入块 / 路径常量 / runFixRunStrict（三分类 + 阶段前置清理）/ Variant 接口 /
     YAML 发射规则 / node 证据循环 / seeds 格式 / schema 校验（loadTask + issues）/
     verifyTask 证据链 / 产物发射 / exit 0|3

陷阱清单（本会话实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2 不可满足）⇒ 本族先冻结 V1–V8
  ③ `.mjs` 工具脚本禁 TS 语法（F03/F05/F08/F09 各一次）、禁混用 require
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希复算须用序数排序（Ordinal）
  ⑤ 证据 checker 必须纯读取（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入
  ⑦ 生成器内多行字符串用 `JSON.stringify(layer2)` 构造，禁止手数反斜杠（F08-C2）
  ⑧ **逐字节内联类语义要预先算准期望值**：partial 内联/换行拼接的期望值必须按"逐字节"推算
     （F09-B1 因此先错一轮）
  ⑨ C 类两变体必须承担**不同 failure mode**，不能只是"换一组数据"（F08-C2 教训）
```

## 六、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F09 的 frozen hash / GT / 任务内容
C 类不得只凭"分片多所以适合并行"判定；E2 不得退化为结构/字符串断言
prompt 不得写入结构性 cue
当前禁止：F10 签署 · 冻结 · commit · manifest
```

## 六之二、author 阶段必须落实的 canonical serialization 规则（用户裁定，构念不变）

> V7/V8 的"逐字节不变"**不得**依赖 JavaScript 对象的属性插入顺序，必须走显式规范化：

```
canonical record
  → 固定字段顺序（按 CONTRACT 中声明的字段顺序，而非对象插入顺序）
  → UTF-8 bytes
  → 固定换行规则（LF；文件末行以 LF 结束）
  → bytewise compare
```

要求：
- `migrated.jsonl` 的每一行 = 按固定字段顺序序列化的 JSON；行序按 record id **序数排序**（Ordinal）；
- 比较一律**逐字节**（UTF-8 + LF），比较对象与独立参考实现同为该 canonical 形式；
- E2（幂等）判定"data 逐字节不变"时，同样使用该 canonical 形式 —— 不得因 key 顺序差异产生假差异；
- checker 内嵌的独立参考实现必须自行实现同一 canonical 序列化（不引用被测 migrate.js）。

## 七、当前基线

```
F01–F09 frozen：**90/120** · 独立验真 **180/180 PASS**（针对已冻结 90 个任务）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F10：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
后续顺序（用户裁定）：F10 数据结构生命周期 → F11 可观测性/查询 → F12 系统状态生命周期
```
