# F03 构念审查记录 · 第三轮（C 类硬时限结构，C-b→反事实重构后）

> 审查对象：`version_hash = e1467928ba6363fc2f31255b4f4fcd01d2e7b7207fb658bf72db84c97186aab9`（**未签署、未冻结**）
> 该版本机械门禁：schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask **10/10** FAIL→PASS · CONFIG_ERROR 0 · success=null 0
> 版本身份：独立复核 `recorded == recomputed`，MATCH=true（键集由 slots.json 独立推导）
> 本轮结论：**F03 十条全部通过构念审查**（C1/C2 由 ⚠️ 转为 ✅）；**仍不签署** —— 存在一条待处理的措辞边界

---

## 一、逐条裁定（三轮汇总）

| 任务 | 第一轮 | 第二轮 | **第三轮** | 依据摘要 |
|---|---|---|---|---|
| A1 | ✅ | ✅ | ✅ | 单文件单症状，DIRECT 充分自然 |
| A2 | ✅ | ✅ | ✅ | `DIRECT / EXPLORE` 并列（需核对 ARCHITECTURE.md） |
| B1 | ✅ | ✅ | ✅ | 缺陷位置未知，需沿链定位；非假探索（真实故障验证） |
| B2 | ✅ | ✅ | ✅ | handler 与 serializer 均可能致因 |
| C1 | ⚠️ | ⚠️ | **✅** | 反事实硬时限结构成立（见下） |
| C2 | ⚠️ | ⚠️ | **✅** | 同上，且非机械复制（分支时长/契约不同） |
| D1 | ⚠️ | ✅ | ✅ | 已删结构 cue；规模本身构成分解信号 |
| D2 | ✅ | ✅ | ✅ | 已删"互不依赖"；结构可由任务自身推出 |
| E1 | ✅ | ✅ | ✅ | 冻结 v1 契约冲突 ⇒ 必须调整方案（REPLAN） |
| E2 | ✅ | ✅ | ✅ | 真实因果链 actual 3 / expected 1 ⇒ 幂等层（REPLAN） |

**十条全部 ✅**。

## 二、C1 / C2 通过理由（因果反事实，而非"适合并行"）

```
核心性质：同一 fixture + 同一三分支 + 同一 6500ms 预算，仅改变调度结构 ⇒
          串行调度无法满足约束（verify 失败），并行调度可以满足（verify 通过）

C1 证据链：
  · 三个真实 branch 实际执行 3.5s / 3.5s / 3.0s
  · 串行反事实：span ≈ 10.19s > 6.5s ⇒ verify exit=1，且 stderr 明确「总耗时超预算」
  · 并行：span ≈ 3.54s ≤ 6.5s ⇒ verify exit=0
  · 正式证据：node-evidence fixRun exit=0 / entries=3 / span=3530；verifyTask fixRun exit=0 / entries=3 / span=3533
  · verifyTask = 10/10（证明验证的是"已发生的那次并行运行"，非再次执行 branch）
  · 三分支 + token + 集成产物 + 受保护 fixture 均有机械约束 ⇒ 无法靠少跑分支过关

C2：逻辑一致且非复制（分支时长 3.5/3.2/3.0s、跨文件契约不同）
  · 串行必然超 6500ms；并行 span ≈ 3.50s；正式 fixRun exit=0；entries=3；verifyTask=10/10

构念检查项（C1/C2 均通过）：
  多分支为真实执行 ✅ · 存在硬时间预算 ✅ · 串行反事实失败 ✅ · 并行正式运行通过 ✅
  同一任务内容仅改调度 ✅ · 不能靠少跑 branch 取巧 ✅ · 正式验证不再污染 timeline ✅
  "并行具有必要性"成立 ✅
  ⚠️「DIRECT 标签必然失败」这一更强命题 —— **依赖 DIRECT 的冻结定义**（见第三节）
```

## 三、必须写清的定义性边界（签署前待处理）

用户裁定明确指出：证据强度与论断强度必须匹配。

```
已被实验严格证明（可以写成强命题）：
    serial / 顺序调度执行 ⇒ 无法满足硬时间约束（span > 6500ms）

尚不能写成强命题：
    FIRST_DECISION = DIRECT ⇒ 任务失败

原因：DIRECT 是 First Decision 的**语义类别**，不是物理执行模式。
      一个 Agent 可能在 DIRECT 决策下调用内部已实现并发的工具 —— 未走 Subagent，
      但底层仍是并行执行，从而仍然满足预算。

⇒ 只有当冻结的 DIRECT 定义**明确排除并行/工作流式调度**时，后者才成立。
   这是构念定义层面的边界，**不是 C1/C2 fixture 的 bug**。
```

### 建议的最终文本措辞（签署前统一）

```
把   "DIRECT 无法满足总预算约束（顺序 span≈10s > 6500ms）"
改为 "串行执行无法满足总预算约束（顺序 span≈10s > 6500ms）；并行执行可以满足"

把   "DIRECT 必然失败" 类表述
改为 "串行调度必然无法满足约束"

出现位置（待核对并统一）：
  · FORMAL-F03-C1.yaml / FORMAL-F03-C2.yaml 的 rationaleNot（当前写的是 "DIRECT 无法满足总预算约束…"）
  · benchmark/formal/f03-review.md 中相应理由段
  · 若 f03-gt-drafts.json 内含同义表述则一并统一
```

### 该措辞修改的后果（必须一并记录）

```
· 属于**文档/理由文字**修改，不改 GT 集合、不改 expected_first_decisions、
  不改 BUDGET=6500ms、不改 branch 耗时、不改 timeline/verify 标准 ⇒ 不改变测量语义
· 但会改变 YAML 内容 ⇒ **产生新的 version_hash**，当前 e1467928… 将作废
· 因此必须在签署前一次性完成，并重跑：generator → 版本身份独立复核（recorded == recomputed）
  → 完整机械门禁（schema/node/verifyTask 10/10，CONFIG_ERROR 0，success=null 0）
  → 然后再走签署/冻结
```

## 四、当前门禁状态

```
F03 十条构念审查        ✅ 全部通过（A/B/D/E 三轮一致，C1/C2 第三轮转正）
F03 机械门禁            ✅ schema 10/10 · node 10/10 · verifyTask 10/10 · CONFIG_ERROR 0 · success=null 0
版本身份                ✅ recorded == recomputed == e1467928…（独立推导键集）
反事实证明              ✅ 独立夹具（ca86441e…）：串行 10189ms>6500ms ⇒ verify exit=1 命中超预算；并行 3543ms ⇒ exit=0
签署状态                ⏳ **未签署**（等待措辞统一后一次性签署）
冻结状态                ⏳ **未冻结**
manifest                ⏳ 未生成
git                     ⏳ 未 commit（本地 HEAD 仍 c360187）
未动                    expected_first_decisions · Formal protocol · N=120 · slots 配额 ·
                       F01/F02 · Recovery Rule v1 · maxDepth · A/B/D/E 八条任务内容
```

**下一步（唯一待办）**：执行第三节的措辞统一（仅理由文字），重跑 generator + 独立版本复核 + 完整门禁，产出新的 version_hash；随后再提交用户做**签署/冻结裁定**。
