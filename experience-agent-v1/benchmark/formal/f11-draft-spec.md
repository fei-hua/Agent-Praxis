# F11 起草规范（日志聚合与查询语义）

> 状态：**规范待人工确认**；生成器尚未编写（本轮无任何 F11 产物）
> 流程：本规范确认 → `scripts/formal-author-f11.ts` → 10 个 draft + 三层证据 → 机械门禁
>       → 人工独立构念审查 → 签署 + 冻结 → formal-verify-all 纳入 F11 → 独立验真
> 当前禁止：F11 签署 · 冻结 · commit · manifest（LOCKED，门槛 = 全 120 槽位冻结）· 回写 F01–F10

---

## 〇、领域边界（写入 f11-review.md 顶部）

```
F11 研究：日志记录 → 聚合 → 过滤 → 排序 → 查询结果
F04 研究：事件顺序 → 状态转换 → 状态机正确性

一句话边界：F04 = event → state（状态发生了什么变化）
           F11 = log  → query result（对一组已发生记录的确定性查询结果）
```

**F11 明确不研究**：

```
❌ 状态机本身 / event replay / transition correctness（F04）
❌ HTTP / middleware（F03）              ❌ schema migration（F10）
❌ template rendering / snapshot（F09）  ❌ cache / lockfile（F05、F07）
❌ deployment / rollback（留给 F12）      ❌ 配额 / 记账（F08）
❌ **不是"写一个 SQL 查询"**；要冻结的是：同一组 canonical logs 在固定查询语义下
   必须产生**唯一、可机械复核**的结果
```

**CONTRACT 顶部必须写入的边界声明（非阻塞，但每变体都要有）**：
> F11 查询**不得修改状态**、不得重放事件以产生状态变化，也不得以状态转移结果作为查询正确性的判定依据。

**与既有族的跨族区分（review 必须写明）**：

```
F08-C2 = 跨来源重复 request_id ⇒ 全局幂等**账务去重**（对象：用量/额度）
F11-C2 = 跨分片的**全局合并排序**（对象：日志记录的全序，tie-break 必须作用于合并后的全序）
F10-E2 = migration 重复执行无副作用（对象：schema 迁移）
F11-E2 = **缺失值不得被默认值修补**（对象：聚合语义；不是幂等性、不是权威源）
F09-E2 = 模板源 → 渲染快照（权威源模式）；F11 **不再做**第三份"权威源 vs 派生物"变体
```

## 一、⭐ 实现前必须冻结的查询与聚合语义（每变体 CONTRACT.md 显式声明，checker 逐条引用）

```
Q1 时间窗口（写死）：半开区间 [start, end)，ts 为整数毫秒；
   · ts == end ⇒ **不计入**本窗口（归下一窗口）
   · ts 缺失或非整数 ⇒ **非法记录**：在进入 query population 之前**直接排除**，
     不得当作 0、不得报错中断，**且不参与 duplicate selection**（见 Q4 流水线第 1 步）
Q2 聚合定义（写死，null/missing 处理不得由实现自行决定）：
   · count           = 去重后匹配记录条数（含 value 缺失者）
   · count_with_value = 去重后匹配且 value 为数值的记录条数
   · sum             = 去重后匹配且 value 为数值的 value 之和；**缺失/null 不计入 sum**（不得视为 0）
   · min / max       = 在"有数值"的记录上取值；若该集合为空 ⇒ **null**
   · 字符串形式的数字（如 "10"）**不是数值**（见 Q8）
Q3 排序（**真全序 / total order**，写死）：一律按
   **(ts asc, record_id 序数 asc, canonical_record_bytes asc)** 排序；
   · 第三键 `canonical_record_bytes` = 该记录的 canonical 五字段序列化字节（Q5），**逐字节**比较
     ⇒ 即使 (ts, record_id) 完全相同也能得到唯一顺序（数学意义上的 total order）
   · record_id 比较为**序数/逐字节**（Ordinal，非 locale）
   · canonical bytes 完全相同的重复行视为同一行，保留任一份都无可观测差异
   · 禁止依赖输入顺序、分片顺序或对象遍历顺序
Q4 查询语义与**处理顺序**（全部写死）：
   · 过滤表达式优先级 **NOT > AND > OR**；允许括号；比较一律大小写敏感、逐字节
   · level 为固定枚举，**取值逐字列出**：`["debug","info","warn","error"]`（小写，大小写敏感精确相等）
   · 空结果 ⇒ 返回 **[]**（不是 null、不是错误）
   · **查询流水线顺序（唯一，不得调换）**：
     1. **canonicalize + 类型合法性**：非法 ts 记录在进入 population 前排除（Q1）
     2. **duplicate record_id resolution**：同一 record_id 保留 **Q3 全序中最早的一条**
     3. **time-window filter**（Q1）
     4. **predicate filter**（优先级 NOT > AND > OR）
     5. **aggregation**（Q2）
     6. **ordering**（Q3 全序）
     7. **limit / top-K**（Q6）
   · 顺序后果示例（写死为方案 A）：r1@ts=50 与 r1@ts=150，窗口 [100,200) ⇒ 先 dedup 保留 ts=50，
     再 window ⇒ **r1 被排除**（不是"先 window 再 dedup 保留 r1"）
Q5 canonical 日志形式（写死）：每条记录**恒为五字段**，按固定字段顺序序列化
   `(ts, level, service, record_id, value)`；**缺失 value 统一编码为 JSON null**（不省略键），
   语义上与显式 null 相同 ⇒ 不存在"字段缺失导致序列化形式不同"的实现差异；
   UTF-8 编码；每条记录一行、以 LF 结束；行序 = Q3 全序
Q6 limit / top-K（若查询带 limit）：结果 = canonical 全序的**前 K 条**（不是"任意 K 条"）
Q7 聚合结果 canonical 形式：结果数组按 **Q3 全序**（ts, record_id, canonical_record_bytes）；
   聚合标量按固定字段顺序的对象序列化；一律 **逐字节**比较（UTF-8 + LF）
Q8 类型规则：`value` 仅数值或缺失/null；**不做隐式类型转换**（"10" 非数值）；
   level / service / record_id 视为字符串
```

## 二、脚手架草案

```
<task>/
  logs/<shard>.jsonl        日志记录（canonical 形式；含重复 record_id 与边界 ts 的夹具）
  query.json                查询定义（filter 表达式 + window + 聚合种类 [+ limit]）
  query.js                  查询实现（过滤 → 去重 → 窗口 → 聚合 → 全序排序）
  result.json               查询结果（canonical 形式）
  CONTRACT.md               Q1–Q8 的显式声明
  check-*.js                分项验收（每 required 一个显式检查）
  verify.js                 汇总验收（输出 token）
  （C/D 类另有 work/*.js 分片聚合工具与 timeline.jsonl；E 类另有 legacy query 实现）
```

## 三、十变体构念矩阵（待人工裁定）

| id | 构念 | 类别 | 建议 GT |
|---|---|---|---|
| A1 | 单谓词过滤正确性 | A | DIRECT |
| A2 | 时间窗口边界归属（ts == end） | A | DIRECT \| EXPLORE |
| B1 | 过滤优先级与缺失字段处理（NOT/AND/OR + null） | B | EXPLORE |
| B2 | 重复 record_id 去重（保留 canonical 序最早一条） | B | EXPLORE |
| C1 | 硬预算下不相交分片的并行聚合（结果 == 独立参考） | C | DELEGATE/PARALLEL/WORKFLOW |
| C2 | 硬预算下跨分片全局合并排序（Q3 全序的 tie-break 作用于合并后的结果） | C | DELEGATE/PARALLEL/WORKFLOW |
| D1 | 三个互不依赖查询目标的并行生成 + 统一报告校验 | D | PARALLEL/WORKFLOW |
| D2 | 有依赖的查询流水线：parse → normalize → aggregate → query | D | **WORKFLOW（单一）** |
| E1 | 排序契约变化（插入序 → (ts, id) 全序）⇒ REPLAN | E | REPLAN |
| E2 | 缺失值不得被默认值修补（既有 default-fill 路径失效）⇒ REPLAN | E | REPLAN |

### 类别设计要点
```
A1：单谓词（level == "error"）过滤判定反了 / 用了大小写不敏感比较 ⇒ 单文件单症状 ⇒ DIRECT
A2：窗口边界 ts == end 被计入（Q1）⇒ DIRECT | EXPLORE（目标文件可能已知，判定依据在 CONTRACT）
B1：实现先算 OR 再算 AND（优先级反）+ 缺失字段被当作匹配 ⇒ 需冻结优先级与 null 语义 ⇒ EXPLORE
B2：同一 record_id 二次投递被重复计数 ⇒ 去重规则（保留 canonical 序最早一条）⇒ EXPLORE
      （与 F08-C2 的区别：F08-C2 是跨来源账务去重的**全局幂等**；F11-B2 是**单查询内**的重复投递去重；
        且 B 类不涉及预算与并行）
C1：分片**互不相交**（按 service 分片）；约束 = 硬预算 6500ms + 结果必须等于 checker 内嵌**独立参考查询**（Q1–Q8 逐字节）
C2：分片**时间交错**（按 hash 分片，各分片 ts 相互穿插）；朴素实现按分片拼接 ⇒ 全序错；
      必须做**跨分片合并**后再应用 Q3 真全序（含第三键 canonical bytes）；同样受硬预算约束、同样与独立参考逐字节比对；
      **纪律**：C2 的失败必须主要来自 merge/order —— checker 固定分片内数据语义，
      只把"调度/合并路径"作为变量，不得让 shard-local aggregation 同时成为未知变量
      ⇒ C1 = 独立分片聚合正确性；C2 = 跨分片全局合并排序正确性（两个不同 failure mode）
D1：三个查询目标（stats-summary / error-digest / slowest-top-K）各有真实缺陷 + 独立验收 + 统一报告校验
D2：四阶段严格依赖，且 checker **断言 step 间真实 artifact 传递**（step2 输入必须来自 step1 输出文件、
     并以 sha256 校验；step3 同理）—— 构念主体是 artifact 依赖，不是"workflow 本身"
      **GT 一开始就收紧为 [WORKFLOW] 单一**（吸取 F10-D2 的 GT 过宽教训）
E1：旧查询路径按插入序返回；新契约要求 (ts, record_id) 全序 + tie-break；legacy consumer 与冻结快照受保护、
      非保护入口可改 ⇒ 检测契约变化后重新规划查询路径 ⇒ REPLAN；真实预跑 check.js → exit=1
E2：既有 default-fill 归一化路径把缺失 value 视为 0（legacy 行为被冻结回放），
      而新契约要求缺失 **不计入 sum**（Q2）；受保护文件不可改 ⇒ 必须重新规划聚合路径（新增兼容聚合层）；
      真实预跑 check.js → exit=1，断言给出**真实业务差异**（例如 actual sum=130 / expected sum=100）
      ⇒ 与 F10-E2（迁移幂等）、F09-E2（权威源）机制均不同
```

## 四、交付物与门禁（与 F01–F10 同构）

```
交付物：scripts/formal-author-f11.ts · 10 个 FORMAL-F11-*.yaml · formal-seeds-f11.ts ·
       f11-review.md · f11-gt-drafts.json · f11-version.json（E 类预跑日志置于任务目录内）

机械门禁（fail-closed）：
  schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
  CONFIG_ERROR = 0 · success=null = 0 · E 类真实预跑 exit=1
  C 类：反事实（同 fixture / 同分片集合 / 同单分片耗时 / 同 budget，唯一变量 = 调度方式）
        + 查询结果 == checker 内嵌独立参考查询（Q1–Q8，逐字节）
        + C2 额外：跨分片全序与 tie-break 断言（分片拼接序 ≠ canonical 序）
  D2：断言 step 间真实 artifact 传递（路径连续 + sha256 一致）
```

## 五、实现模板与已知陷阱（沿用 F04–F10 骨架）

```
复用：导入块 / 路径常量 / runFixRunStrict（三分类 + 阶段前置清理）/ Variant 接口 /
     YAML 发射规则 / node 证据循环 / seeds 格式 / schema 校验（loadTask + issues）/
     verifyTask 证据链 / 产物发射 / exit 0|3

陷阱清单（本会话实际踩过，必须规避）：
  ① 共享数据结构形状必须与**所有消费方**一致（F05 ⇒ 首跑 3/10）
  ② fixture 与 checker 不得自相矛盾（F05-A2 不可满足）⇒ 本族先冻结 Q1–Q8
  ③ `.mjs` 工具脚本禁 TS 语法（F03/F05/F08/F09/F10 各一次）、禁混用 require
  ④ PowerShell 读 JSON 必须 -Encoding UTF8；哈希/排序一律**序数（Ordinal）**
  ⑤ 证据 checker 必须纯读取（F03 G-3）
  ⑥ 导入符号自检：使用的 node:fs 符号 ⊆ 已导入
  ⑦ 生成器内多行字符串用 `JSON.stringify(layer2)` 构造，禁止手数反斜杠（F08-C2）
  ⑧ 逐字节/内联类语义必须**预先按字节推算期望值**（F09-B1）
  ⑨ C 类两变体必须承担**不同 failure mode**（F08-C2 教训；本族 C1/C2 见上）
  ⑩ **GT 不得过宽**：只有任务结构本身支持并行时才允许 PARALLEL（F10-D2 教训：D2 收紧为 WORKFLOW 单一）
  ⑪ 排序类语义必须先冻结 **tie-breaker**，否则"逻辑相同但顺序不同"会产生假差异（Q3/Q7）
```

## 六、红线

```
不得改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA/GT ·
       Recovery Rule v1 · maxDepth · 签署键集
不得回写：F01–F10 的 frozen hash / GT / 任务内容
C 类不得只凭"分片多所以适合并行"判定；E2 不得退化为结构/字符串断言
prompt 不得写入结构性 cue
当前禁止：F11 签署 · 冻结 · commit · manifest
```

## 七、当前基线

```
F01–F10 frozen：**100/120** · 独立验真 **200/200 PASS**（针对已冻结 100 个任务）
F10：已封账（台账 100/120；正式记录仅 715d7a7e… 一套身份；归档包 f10-review-bundle.zip 已按 frozen 重打）
formal manifest：LOCKED（文件不存在；门槛 = 全 120 槽位冻结）
git：未 commit（HEAD c360187）
F11：**0 产物**（本规范为唯一新增文件，属审核/证据层，不进入 task identity）
后续：F12 = 状态迁移编排（deploy / rollback）
```
