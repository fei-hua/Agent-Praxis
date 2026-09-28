# PILOT-ENV-PREFLIGHT 报告（2026-09-27）

> 状态：**Pilot 暂停中**。剩余 29 个 run 未启动，A01 未重跑，未修改任何实验规则 / frozen ground truth /
> CDA 定义 / OQ-014 / retrieval 公式 / Phase 0。
>
> 触发原因：30-run 验收第 1 个 run（`pilotdry-PILOT-A01-R1-A`）被判定为
> **基础设施失败**（`class=infrastructure`、`counted=false`、未采集），证据见下。

## 一、Preflight 清单

| # | 检查项 | 结果 | 证据 / 说明 |
|---|---|---|---|
| 1 | command execution | ❌ **FAIL** | 执行会话内每条 `pwsh` 都在沙箱初始化阶段失败：`SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\Agent Praxis)`；命令根本没运行 |
| 2 | sandbox workspace write | ❌ **FAIL** | 根因见第二节：缺 `WRITE_OWNER`（继承自 `D:\` 的 Modify-only DACL），而沙箱的合并授权（DACL + world 拒绝 + Low 标签）必须写 SACL |
| 3 | deterministic seed rebuild | ✅ PASS | `pilot-setup` 重建 36 个种子文件 / 10 任务；基线指纹恒定 `6aeee38c…`；污染探针（故意改坏 → 重建）完全还原；该 run 的残留已清除（不一致文件数 = 0） |
| 4 | session log persisted（Pilot 执行会话） | ❌ **FAIL** | 会话日志位置已确认（`C:\Users\asus\.dsh\sessions\--D-Agent~0020Praxis--\`，20 个日志）；但**没有任何日志包含 Pilot 提示**（按内容检索 `PILOT-A01` / `heartbeat` / `exceeds maxDepth` 全为空） |
| 5 | event timestamps available | ✅ PASS（格式已证） | 既有日志的原始事件带 `time`（epoch ms），可算 `wall_time_ms = max(time) − min(time)` |
| 6 | token usage available | ✅ PASS（格式已证） | Phase 0 的采集就是从真实日志抽出 `input/output/cache_read/reasoning` |
| 7 | tool schema snapshot available | ✅ PASS（格式已证） | 采集脚本从会话 `request/header` 工具快照算 `tool_schema_version`（Phase 0 已成功产出 `tschema-19751aa066b9`） |
| 8 | required Subagent topology | ❌ **FAIL** | 执行会话报 `subagent depth 2 exceeds maxDepth 1`：它被放在 depth 1，因而**无法委派**。C/D 类任务的 `DELEGATE / PARALLEL / WORKFLOW` 会从"模型自主决策"退化为"环境根本不允许"——实验有效性问题 |
| 9 | maxDepth 不阻断既定委派 | ❌ **FAIL（但可由拓扑修正解决，无需改 Harness 参数）** | 见第三节 |

**结论：9 项中 5 项 FAIL ⇒ 不解除 Pilot 暂停。**

## 二、① 根因：沙箱授权需要 `WRITE_OWNER`，而工作区只被授予 `Modify`

模块文档明确写着先决条件（`node_modules/@deepseek-ai/dsh-sandbox-windows-acl/README.zh.md` 第 122 条）：

> 被授权目录必须由调用者拥有并授予 `WRITE_OWNER`。所有者隐式获得的只有 `READ_CONTROL` 与 `WRITE_DAC`；
> **标签位于 SACL，因此合并应用还需要 `WRITE_OWNER`**（完全控制目录——即正常工作区情形——本就具备）。
> DACL 只授予 Modify 的目录现在会大声失败，而不是静默跳过隔离。

实测（只读，未做任何修改）：

```
当前用户           : LAPTOP-DDFDM393\asus      （IsAdmin = False，非提权）
D: 文件系统        : NTFS（锁定，非 FAT/exFAT）
D:\Agent Praxis
  Owner            : LAPTOP-DDFDM393\asus      （属主正确）
  DACL 继承        : AreAccessRulesProtected = False（全部继承自 D:\）
  有效授权（当前用户经 Authenticated Users）: (I)(M) = Modify   ← 不含 WRITE_OWNER
  Administrators/SYSTEM: (I)(F)                ← 未提权，Filtered Token 不生效
子对象扫描        : 1094 个对象，属主异常 / DACL 受保护 / 不可读 = 0（排除传播失败假设）
```

`D:\` 作为非系统盘，默认只给 `Authenticated Users: Modify`，工作区继承该 ACE ⇒ 沙箱那次
`SetNamedSecurityInfoW(DACL + LABEL)` 因缺 `WRITE_OWNER` 被拒 ⇒ **Win32 5 (ACCESS_DENIED)**。
这同时解释了为什么"我的会话能跑命令"（每条命令走人工提权的非沙箱路径），而"执行会话一条都跑不了"
（子会话没有审批方 ⇒ fail-closed）。

### 建议的最小必要修复（**待你确认后再执行，尚未动手**）

```powershell
# 仅在工作区根目录增加一条显式、可继承的 Full Control ACE（当前用户即属主）
# 不 reset ACL、不改属主、不改任何继承设置、不移动工作区路径
icacls "D:\Agent Praxis" /grant "LAPTOP-DDFDM393\asus:(OI)(CI)F"
```

理由：`grantWrite` 需要对根目录及其**每个后代**具备 `WRITE_DAC`/`WRITE_OWNER`（授权是急切全树传播），
因此可继承的 Full Control 是满足该先决条件的最小改动。这属于**环境变更**，需记录进 Pilot 环境元数据。

## 三、③ 根因：编排拓扑错误（不是 Harness 限制）

`dsh-subagent` 文档与源码（`lib/types/child-agent.js`）：

```
maxDepth 默认 1 ＝ "depth 1 permits direct children only"；depth 0 禁止委派
resolveChildDepth(parent, maxDepth): childDepth = parentDepth + 1；childDepth > maxDepth ⇒ SubagentDepthError
子级深度持久化在子会话 header 中
```

拓扑对照：

```
Phase 0（可委派，实测 4 次 subagent_invocation）
  顶层会话 (depth 0)  →  子代理 (depth 1)   ✅ 允许

本轮 30-run（委派被阻断）
  顶层会话 (depth 0)  →  **执行会话 (depth 1)**  →  子代理 (depth 2)  ❌ exceeds maxDepth 1
```

**结论：问题出在编排器把被测 Agent 放进了 depth 1**（通过 subagent 工具启动），而不是 Harness 参数。
正确做法是让每个 run 成为**顶层会话**——`dsh headless "<prompt>"` 正是为此提供的（`dsh --help`：
"answer one task, print the result, and exit"）。

因此：**不得**为了通过测试把 `maxDepth` 改成 2（那会把环境参数改动引入实验）；应改编排拓扑。

## 四、② 附带发现：执行会话未落盘

- 落盘位置已确认（不猜）：`DSH_HOME=C:\Users\asus\.dsh` →
  `sessions\--D-Agent~0020Praxis--\<sessionDir>\session.v3.jsonl[.zstd]`（该桶 21 个会话目录 / 20 个含日志）。
- 但按**内容**检索最近 8 个日志，无一包含 Pilot 提示（`PILOT-A01` / `heartbeat` 等）。
- 含义：即使沙箱修好，若执行会话不落盘，`collect` 就拿不到 `request/header` 工具快照、token 用量与会话时间跨度
  ⇒ 无法采集。这一条必须用**真实顶层会话**（`dsh headless`）重新验证。

## 五、解除暂停的条件（ALL PASS）

```
[ ] 1 command execution            → 修复 ① 后重测
[ ] 2 sandbox workspace write      → 修复 ① 后重测
[x] 3 deterministic seed rebuild   → 已 PASS
[ ] 4 session log persisted        → 用 dsh headless 测试会话验证（不计入 Pilot）
[ ] 5 event timestamps available   → 同上（并确认能算出 wall_time_ms > 0）
[ ] 6 token usage available        → 同上
[ ] 7 tool schema snapshot available → 同上（tool_schema_verified 必须变为 true）
[ ] 8 required Subagent topology   → 改为顶层会话执行后验证
[ ] 9 maxDepth 不阻断既定委派      → 同上（不改 Harness 参数）
```

全部通过后，还需要**单独冻结** infrastructure-failure 的恢复规则，才能决定 30-run 的有效样本如何补齐
（在此之前不重跑 A01、不临时制定规则）。

## 六、本轮未做的事（纪律留痕）

- 未启动剩余 29 个 run；
- 未重跑 A01（保持 `class=infrastructure`、`counted=false`、未采集）；
- 未修改 ground truth / CDA / OQ-014 / retrieval / Policy / Experience / Phase 0；
- 未 reset ACL、未改属主、未移动工作区路径（仅只读诊断）。

---

## 七、更新：运行策略变更后的复测（2026-09-27，同轮）

会话运行策略由 `workspace-write + ask` 变为 **`danger-full-access` + 审批关闭**（不再有沙箱 ACL 授权步骤）。

### 复测结果

| # | 检查项 | 原判 | 复测 | 证据 |
|---|---|---|---|---|
| 1 | command execution（执行会话内） | ❌ | ✅ **PASS** | preflight 探针（subagent 会话）成功运行 `node --version` → `v24.15.0`、`Get-Location` → `D:\Agent Praxis`、`echo PREFLIGHT-PROBE-7f3a` 回显一致 |
| 2 | sandbox workspace write | ❌ | ✅ **PASS** | 同上会话在工作区内完成读写删；`danger-full-access` 下不再调用 `SetNamedSecurityInfoW`，第二节的 `WRITE_OWNER` 先决条件不再被触发（该根因仍然有效：**若回到 `workspace-write` 模式会再次失败**，除非补那条 ACL） |
| 3 | deterministic seed rebuild | ✅ | ✅ PASS | 不变 |
| 4 | session log persisted | ❌ | ⏳ **待 headless 复测** | 关键发现：**活动会话的日志不会实时落盘**（探针会话与其标记在会话桶 20 个日志中均不存在）。因此必须用**跑完即退出的顶层会话**（`dsh headless`）验证 |
| 5–7 | timestamps / token usage / tool snapshot | ✅（格式） | ⏳ 待 headless 复测（需在该会话日志中实测） | — |
| 8 | required Subagent topology | ❌ | ❌ **FAIL（已定性）** | 探针再次实测：执行会话（depth 1）委派被拒 `subagent depth 2 exceeds maxDepth 1`；探针自身也指出"需要在 depth 0（顶层会话）发起" |
| 9 | maxDepth 不阻断既定委派 | ❌ | ⏳ 待 headless 复测 | 若 `dsh headless`（depth 0）能成功委派 depth 1 子代理，则证明**只需改编排拓扑、不必改 Harness 参数** |

### 由复测新增的两个结论

1. **阻塞 ① 是策略性而非永久性的**：`workspace-write` 模式下沙箱必须写 SACL（需 `WRITE_OWNER`），而工作区从 `D:\` 继承了 Modify-only DACL ⇒ fail-closed。
   `danger-full-access` 下该路径不再被调用 ⇒ 执行会话可用。**记录该依赖**：实验环境元数据必须写明运行时的沙盒模式，
   否则换回受限模式会让整批 run 无法执行（与 M2/M4 同类问题）。
2. **日志落盘时机是硬约束**：会话日志在会话结束/轮转时才写入 `DSH_HOME\sessions\--D-Agent~0020Praxis--\`。
   因此 Pilot 的每个 run **必须是跑完即退出的顶层会话**（`dsh headless`），既满足 ③ 的委派拓扑，也满足 ② 的采集前提；
   这也解释了为什么本轮 A01 的会话日志完全不存在（会话被拒绝后未正常结束，或仍在缓冲）。

### 决议

- ①②③ 的**执行侧**已恢复，但 preflight **仍未全绿**（第 4/5/6/7/8/9 项待 headless 复测）。
- 在 headless 复测通过前：继续暂停剩余 29 个 run、不重跑 A01、不改实验规则、不改 frozen ground truth。

---

## 八、headless 复测结果（2026-09-27，本轮最终）

### 1）headless 顶层会话（depth 0）——委派 ✅、命令 ❌

| 步骤 | 结果 |
|---|---|
| `echo` 探针标记 | ❌ 两次都失败：`SetNamedSecurityInfoW failed (Win32 5): grantWrite(D:\Agent Praxis)`（命令执行前失败） |
| 委派 subagent | ✅ **成功**（子代理返回"1+1=2 在皮亚诺算术中成立"） |

⇒ **③ 的结论得到正面验证**：把被测 Agent 放在 **顶层会话**（depth 0）时，委派到 depth 1 正常工作；
   放在 depth 1（subagent 工具）时必然被 `maxDepth 1` 阻断。**不需要改 Harness 参数，只需改编排拓扑。**

⇒ **① 仍未解决**：`dsh headless` 启动时使用 `workspace-write`（我交互会话的 `danger-full-access` 未被继承），
   因而每次都撞上第二节的 `WRITE_OWNER` 先决条件。**沙箱模式是 per-session 的**，必须为每个 run 会话显式配置。

### 2）会话日志：格式已升级为 **v4**，且确实在实时落盘

之前判定"未落盘"是**检索方式错误**——日志文件名已从 `session.v3.jsonl.zstd` 变为 **`session.v4.jsonl.zstd`**：

```
~/.dsh/sessions/--D-Agent~0020Praxis--/
  session-5e2f94d0-…/session.v4.jsonl.zstd   3.6MB  09-29 00:55   ← 本对话会话（3979 事件行、8342 时间戳）
  session-a26a613b-…/session.v4.jsonl.zstd    19KB  09-29 00:54   ← headless preflight 会话（36 事件、3 次工具调用）
  7f5709be-…/session.v4.jsonl.zstd            10KB  09-29 00:54   ← 探针 subagent 会话（含 sandbox/mode 事件）
~/.dsh/storages/session_projcache/sessions/<id>.json              ← 会话索引缓存
~/.dsh/dsh-usage/usage-ledger.json                                ← Harness 侧用量账本（OQ-011 相关）
```

字段实测（采集所需全部具备）：

```
request/header + data.header.config.tools[...]  ✅ 工具快照可算 tool_schema_version
time（epoch ms，可算 wall_time_ms）             ✅ 示例：headless 会话 span = 6747ms > 0
input_tokens / output_tokens / cache_read / reasoning  ✅（大会话中实测存在；另见 usage-ledger）
事件类型（v4）：tool/call, tool/result, step/start, assistant/message, step/end,
                user/message, agent/inbox/spliced, approval/asked, approval/policy,
                subagent/descriptor, sandbox/mode, session-log-deepseek/delivery-accepted
```

### 3）由此暴露的**代码层缺口**（不是环境问题）

`telemetry/session-log.ts` 与 `telemetry/extract.ts` 是按 **v3** 写的：

| 缺口 | 现状 | 需要 |
|---|---|---|
| 日志文件名 | 只匹配 `session.v3.jsonl[.zstd]` | 支持 `session.v4.jsonl.zstd`（否则采不到当前 harness 的任何会话） |
| 事件名 | 期望 `tool_call` / `tool_result` 等下划线式 | v4 为 `tool/call` / `tool/result` 斜杠式（需映射或适配） |
| 用量 | 只在会话内找 usage | 另可对接 `dsh-usage/usage-ledger.json`（Harness 侧，OQ-011 更优口径） |
| 环境记录 | 无沙箱模式字段 | v4 有 `sandbox/mode` 事件 ⇒ 应写入 run 环境元数据（本次失败的直接变量） |

### 4）Preflight 最终判定（本轮结束时）

| # | 检查项 | 判定 |
|---|---|---|
| 1 | command execution | ⚠️ 条件性 PASS：`danger-full-access` 下 ✅（本会话 + 探针会话）；`workspace-write` 下 ❌（headless） |
| 2 | sandbox workspace write | ⚠️ 同上；根因明确（缺 `WRITE_OWNER`），两条修复路线待选 |
| 3 | deterministic seed rebuild | ✅ PASS |
| 4 | session log persisted | ✅ PASS（v4，实时落盘）——但**采集器需先支持 v4**，否则逻辑上采不到 |
| 5 | event timestamps available | ✅ PASS（`time` 可算 wall_time_ms，实测 6747ms） |
| 6 | token usage available | ✅ PASS（会话内 usage + usage-ledger） |
| 7 | tool schema snapshot available | ✅ PASS（`request/header` 含完整 tools） |
| 8 | required Subagent topology | ✅ PASS（顶层会话可委派）——**前提是改编排拓扑为顶层会话** |
| 9 | maxDepth 不阻断既定委派 | ✅ PASS（不改 Harness 参数） |

**仍不解除暂停**：第 1/2 项需要一条明确的环境决定（ACL 修复 vs 每 run 指定 `danger-full-access`），
且**采集器必须先支持 v4**（第 4 项的逻辑前提）。这两件事都不属于"改实验规则"，但都必须先做完并记录。

### 5）待人工决定（二选一）与后续步骤

**① 沙箱模式二选一（环境变更，必须记录）**

- **路线 A（修 ACL，保留受限沙箱）**：`icacls "D:\Agent Praxis" /grant "LAPTOP-DDFDM393\asus:(OI)(CI)F"`
  —— 满足模块先决条件（完全控制目录），之后 `workspace-write` 可用；环境更严格，但与 Phase 0（带审批=非沙箱执行）不同。
- **路线 B（每 run 指定 `danger-full-access`）**：不改 ACL；执行环境与 Phase 0 的"带审批执行"最接近；
  但需要在每个 run 会话显式配置策略，并写入环境元数据（否则无人复核）。

**② 采集器升级到 v4**（文件名 + 事件名映射 + 可选 usage-ledger 对接 + 记录 `sandbox/mode`）。

**③ 之后才是**：用顶层 `dsh headless` 会话跑完 10 任务 × 1 rep × 3 臂的 30-run 验收（此时才能采到数据）。

**④ 仍待单独冻结**：infrastructure-failure 的恢复规则（在此之前不重跑 A01）。
