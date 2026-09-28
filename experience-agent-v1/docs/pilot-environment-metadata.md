# Pilot 环境元数据（PILOT ENVIRONMENT METADATA）

> 本文件记录 **Pilot run 的执行环境事实**。环境变化必须更新本文件（属于环境记录，不是实验规则修改）。
> 最后更新：2026-09-27（路线 A 修复 + preflight ALL PASS）

## 1. 运行环境

| 项 | 值 | 备注 |
|---|---|---|
| Harness 版本 | `0.1.7-rc.2` | run 时显式传入（OQ-016 / M4：不得读采集时本机版本） |
| `tool_schema_version` | `tschema-dcdb10f5d21c` | 由 preflight 探针会话的 `request/header` 工具快照计算（run 时值） |
| 会话日志格式 | **v4**（`session.v4.jsonl.zstd`） | Phase 0 证据为 v3；解码器与发现逻辑版本无关（`/^session\.v[0-9]+\.jsonl(\.zstd)?$/`） |
| 会话日志根 | `%USERPROFILE%\.dsh\sessions\<projectKey>\<sessionId>\` | 本项目桶 `--D-Agent~0020Praxis--` |
| 会话用途账本 | `%USERPROFILE%\.dsh\dsh-usage\usage-ledger.json` | **按天 × provider × model 聚合**，不按 session ⇒ 仅作对账，不作为 per-run 用量来源（OQ-018：per-run 用会话内 provider-reported usage） |
| 执行会话拓扑 | **顶层会话（`delegationDepth = 0`）** | 必须：depth 1 时 `maxDepth=1` 会阻断任何委派 |
| 执行会话启动方式 | `dsh headless "<prompt>"` | 跑完即退出 ⇒ 会话日志落盘可采集 |

## 2. 沙箱与 ACL（路线 A 修复记录）

| 项 | BEFORE | AFTER |
|---|---|---|
| ACL（icacls 原文） | `docs/preflight/acl-before.txt` | `docs/preflight/acl-after.txt` |
| Owner | `LAPTOP-DDFDM393\asus` | **不变** |
| `AreAccessRulesProtected`（继承） | `False` | **不变** |
| 规则数 | 9 | 10（**仅新增一条**：`LAPTOP-DDFDM393\asus:(OI)(CI)(F)`） |
| 沙箱模式 | `workspace-write` 下 `SetNamedSecurityInfoW` → **Win32 5** | `workspace-write` 下正常执行 |

**根因**：`dsh-sandbox-windows-acl` 的 `grantWrite` 在一次 `SetNamedSecurityInfoW` 中同时写入
能力 ACE + world `FILE_DELETE_CHILD` 拒绝 + **Low 完整性标签**（标签在 SACL ⇒ 需要 `WRITE_OWNER`）。
属主仅隐式获得 `READ_CONTROL` + `WRITE_DAC`；工作区从 `D:\`（非系统盘默认）继承 `Authenticated Users: Modify`，
不含 `WRITE_OWNER` ⇒ ACCESS_DENIED。

**修复指令（唯一改动，未 reset ACL、未改 owner、未改 maxDepth）**：

```powershell
icacls "D:\Agent Praxis" /grant "LAPTOP-DDFDM393\asus:(OI)(CI)F"
```

**为什么选路线 A 而非路线 B**：路线 B（每 run 指定 `danger-full-access`）会让每个正式 run 的运行模式依赖
人工/编排参数，引入隐藏环境变量；路线 A 一条 ACE 即恢复沙箱设计行为，且 `dsh headless` 直接可用。

## 3. 观测到的沙箱模式（写入 run record）

| 场景 | 沙箱模式 | 命令执行 |
|---|---|---|
| 本交互会话（`danger-full-access` 策略） | `danger-full-access` | ✅（非沙箱路径） |
| `dsh headless` 修复前 | `workspace-write` | ❌ Win32 5 |
| `dsh headless` 修复后 | `workspace-write` | ✅ |

`RunRecord` 新增三个环境字段（正式采集缺失 ⇒ `COLLECTION_ERROR`，不计为 Agent FAIL）：
`session_format_version`、`sandbox_mode`、`delegation_depth`。

## 4. Preflight 结论

`node scripts/pilot-env-preflight.ts` → **ALL PASS（10/10）**，证据见
`docs/pilot-env-preflight.md` 第九节。全部通过后可解除 Pilot 暂停。

> 注意：A01 的 infrastructure-failure **恢复规则尚未冻结**，因此 A01 仍不补跑；
> 恢复规则单独冻结后，才决定 30-run 有效样本如何补齐。

## 5. 启动器执行上下文（人工冻结 2026-09-27，路线 3）

```
launcher_execution_context = elevated / outside-sandbox
run_sandbox_mode           = workspace-write
run_depth                  = 0
maxDepth                   = 1（未修改）
```

**为什么必须分离**：`dsh headless` 启动时**总是**重写自己的根配置
（`dsh/lib/profile-boot-*.js` 的 `prepareProfile` → 无条件 `writeFileSync`，注释原文 "The root is always rewritten"），
因此启动步骤必须能写 `DSH_HOME`（`C:\Users\asus\.dsh`）；而 `workspace-write` 沙箱的可写根只覆盖工作区
（`dsh-sandbox-windows-acl/lib/runner.js:144`：`writableDirs: mode === "workspace-write" ? [parsed.workspace] : []`）。
路线 1（预物化 profile）与路线 2（把 DSH_HOME 加进可写根）在本版本 DSH 上均不可行 ⇒ 采用路线 3。

**重要**：这是**启动机制**，不是被测 Agent 的运行环境。不得把 run 标成 `danger-full-access`。

### PILOT-ENV-PREFLIGHT #11（冻结措辞）

```
launcher can boot dsh headless such that the resulting session is
workspace-write + top-level (depth 0), with command execution,
delegation and v4 log persistence all working.
注：启动步骤本身可运行在沙箱外（路线 3），但不得用
danger-full-access 的 run 会话成功来替代本条。
```

**一致性门禁**：resulting session 必须为 `workspace-write`；若为 `danger-full-access` ⇒ **#11 FAIL**。

**实测（2026-09-27）**：`launcher=elevated → session-640f6474… sandbox=workspace-write depth=0 format=v4`,
成功工具结果=5、子会话=1 ⇒ **11/11 PASS**（`node scripts/pilot-env-preflight.ts`）。
