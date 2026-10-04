# F03 签署就绪记录（身份分层裁定 + 签署前清单）

> 本文件属于**审核/证据层**，不进入 task identity。
> 裁定来源：第三轮构念审查后的身份分层裁定（用户明确放行）。

---

## 一、身份分层（已裁定）

```
【签署身份层】＝ 12 个键，决定"正式任务究竟是什么"
    benchmark/tasks/formal/FORMAL-F03-A1.yaml … E2.yaml   （10 个）
    benchmark/formal-seeds-f03.ts
    benchmark/formal/slots.json
        ↓
    version_hash
        ↓
    正式任务身份 = e1467928ba6363fc2f31255b4f4fcd01d2e7b7207fb658bf72db84c97186aab9

【审核/证据层】＝ 解释"为什么这样定义、为什么构念通过"，**不改变 formal task identity**
    benchmark/formal/f03-review.md
    benchmark/formal/f03-gt-drafts.json
    benchmark/formal/f03-construct-review.md          （第一轮）
    benchmark/formal/f03-construct-review-round2.md   （第二轮）
    benchmark/formal/f03-construct-review-round3.md   （第三轮）
    benchmark/formal/f03-signing-readiness.md         （本文件）
```

**裁定要点**：`rationaleNot` 等理由文字属于**审查记录**，**不纳入签署对象**。
理由：Task Identity ≠ Review Rationale。若把解释性文字纳入哈希，则每次措辞微调（"无法满足"→"不能满足硬预算"）
都会改变任务身份，使签署机制不必要地脆弱。**不可变的应是** prompt / GT / verification / protected fixture 等参与正式判定的字段。

**已确认的事实**：本轮措辞统一（`DIRECT 无法满足总预算约束…` → `串行执行无法满足总预算约束…；并行执行可以满足`）
只落在审核层（`f03-review.md` / `f03-gt-drafts.json` 共 4 处），**签署层的 12 个键内容未变** ⇒
`version_hash` 保持 `e1467928…` 是**正确行为**（而非修改未生效）。

## 二、F03 门禁总表（签署前状态）

```
构念审查（三轮）：A1 ✅ A2 ✅ B1 ✅ B2 ✅ C1 ✅ C2 ✅ D1 ✅ D2 ✅ E1 ✅ E2 ✅
机械门禁：        schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 FAIL→PASS
                  CONFIG_ERROR = 0 · success=null = 0
预跑：            E1 check.js → exit=1（真实）· E2 contract.js → exit=1（真实）
C 类反事实证据：   同一 fixture + 同一预算 6500ms，仅改调度
                  串行 span ≈ 10.19s > 6.5s ⇒ verify exit=1，stderr 明确「总耗时超预算」
                  并行 span ≈ 3.53s ≤ 6.5s ⇒ verify exit=0
                  正式证据：node-evidence fixRun exit=0/entries=3/span≈3535
                            verifyTask   fixRun exit=0/entries=3/span≈3526
版本身份：        recorded == recomputed == e1467928… · MATCH = true（键集由 slots.json 独立推导）
签署状态：        **未签署**
冻结状态：        **未冻结**
manifest：        **未生成**（pilot-manifest-formal.json 不存在）
git：             **未 commit**（本地 HEAD 仍 c360187）
```

## 三、签署动作将会改变什么（待用户明确放行后执行）

```
① 10 个 FORMAL-F03-*.yaml：status → frozen（当前为 draft）
② benchmark/formal/f03-gt-drafts.json：写入真实 gt_signed_at（ISO 时间戳）
③ benchmark/formal/f03-version.json：写入
     signed_version_hash      = e1467928…（签署时的 version_hash）
     frozen_version_hash      = <冻结后按同一规则重算>
     frozen_content_projection_hash = <GT 投影哈希，用于检测 0 漂移>
④ 签署后必须重跑独立验真；**需要一处单独的代码改动**：
     scripts/formal-verify-all.ts 的 FAMILIES 列表当前只有 F01/F02，需**加入 F03**
     （该脚本不属于 task identity，但改动本身需单独授权）
⑤ 之后才可生成 formal manifest（当前严禁）
```

## 四、签署前的纪律（用户明确要求保持）

```
不得再修改：任何正式任务字段 · GT 集合 · expected_first_decisions · indicator / 测量标准 ·
            签署键集 · 6500ms 预算 · branch 耗时 · timeline / verify 标准 ·
            Formal protocol · N=120 · slots 配额 · F01/F02 · Recovery Rule v1 · maxDepth
不得执行：   签署 · 冻结 · commit · 生成 manifest（在用户明确放行之前）
```

**结论**：F03 已具备签署条件，身份为 `e1467928…`；**等待用户对"执行签署+冻结"的明确放行**，
以及（可一并授权的）`formal-verify-all.ts` 加入 F03 族、随后的独立验真与 manifest 生成。
