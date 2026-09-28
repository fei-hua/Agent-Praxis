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
