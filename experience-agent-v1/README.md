# experience-agent-v1 — Phase 0 实现

**Experience-Driven Tool Orchestration（V1.0）** 的 Phase 0：只做 instrumentation 与基础运行闭环。
TypeScript / Node 24，除 `js-yaml` 外零运行时依赖；经验存储用 Node 内置 `node:sqlite`（SQLite FTS5）。

> Phase 0 的目标只有一个：**证明我们能可靠地观察 Agent 怎么做决策、调用工具、委派 Subagent、失败与重新规划。**
> 它不决定「检索效果好不好」，也不允许为了让结果好看而调整任何冻结阈值。

## 状态

| 项 | 结果 |
|---|---|
| 5 个 dry-run 的出口标准（§4.2 五条） | ✅ 全部 PASS |
| tool call ↔ result 配对率 | ✅ 100%（6/6、8/8、14/14、40/40、10/10） |
| failure / replan 可重建 | ✅ 集合内 7 个 failure、2 个 replan |
| 离线决策链重放 | ✅ chain_complete = true |
| 确定性测试 | ✅ 24/24（`npm test`） |
| 类型检查 | ✅ 0 error（严格模式） |
| 开放问题 | 20 条登记，13 条已裁决，7 条非阻塞待补 |

完整证据：`docs/phase0-acceptance-report.md`

## 运行

```powershell
npm install --cache "..\.npm-cache"   # 工作区本地缓存（避免全局 npm 缓存受限）
npm run typecheck
npm test                              # node --test --test-isolation=none tests/…（沙箱下禁用子进程管道）
node scripts/dryrun-setup.ts          # 播种工作区 + 经验 fixtures + 只读 SNAPSHOT_01
node scripts/dryrun-accept.ts --write-report
```

dry-run 的执行本身是**真实 DSH 子会话**（不是 mock）：每个任务由主 Agent 读任务书执行，
轨迹由会话事件日志离线组装（`scripts/dryrun-collect.ts`）。

## 模块地图

| 目录 | 职责 | 关键文件 |
|---|---|---|
| `core/` | 冻结枚举/常量、Task State 直读、canonical JSON、两个哈希 | `enums.ts` `frozen-constants.ts` `task-state.ts` `experiment-config.ts` `tool-schema-version.ts` |
| `experience/` | 经验知识层 | `schema.ts`（无 reliability 字段）`reliability.ts`（§5.4 公式）`retrieval.ts`（检索链路）`store.ts`（FTS5）`snapshot.ts`（只读）`gate.ts`（确定性质量门） |
| `agents/` | 5 个 Subagent 定义（人工裁决冻结） | `registry.ts` |
| `telemetry/` | 观测层 | `session-log.ts`（zstd 拼接帧解码）`extract.ts` `trajectory.ts` `assemble.ts` `acceptance.ts` `replay.ts` |
| `benchmark/` | 任务与判定 | `tasks.ts`（受控词表校验）`judge.ts`（§9.2/§9.3）`tasks/dry-run/*.yaml` |
| `scripts/` | 一键流水线 | `dryrun-setup.ts` `dryrun-judge.ts` `dryrun-collect.ts` `dryrun-accept.ts` |
| `spec/` | 冻结规格与 OQ 登记簿 | `frozen.md` `experiment-design.md` `open-questions.md` |

## 关键不变式（改代码前先读）

1. `first_decision` **只能**由代码直读 `task_state.first_decision`，禁止事后从轨迹或文本推断。
2. `reliability_score` **不在** Experience schema 里，由代码按 §5.4 计算，Reflection 不得填写。
3. 阈值冻结：相关性 0.30/0.60/0.80、Top-K=5、低相关 ≤2、上下文 800 tokens、单条 ≤160 tokens、lesson ≤60 字。
4. 判定顺序（OQ-020 裁决）：**Conflict 优先于 Duplicate**；outcome 缺失/不可确定不得判 duplicate。
5. 快照只读：`SNAPSHOT_01` 一经创建不得覆盖；每次 run 记录 `experience_snapshot_id`。
6. 规格未定义 ⇒ 写 `spec/open-questions.md`，blocking 时停下问，不猜。

## 已知边界

- **M1 采集时机**：会话仍在继续时采集会得到「过期快照」。父级必须核对会话最终事件数与轨迹内容
  （task_state / subagent_invocation / tool_call，含子会话）后再验收。DRY-04 曾因此重采。
- **M2 沙箱限制**：`npm test` 必须加 `--test-isolation=none`（子进程管道在受限沙箱内被拒）；
  git 推送需 `-c http.sslBackend=openssl`（schannel 在该环境下取不到凭据）。
- **M3 未裁决项**：OQ-014 / 015 / 017 / 019 —— 涉及 `task.scope × experience.scope` 组合规则、T1 采集通道、
  stale 的 N、failure 是否含「命令非零退出」。Pilot 期间会真实碰到，需要在正式跑数前补齐。
- **M4 溯源**：`harness_version` 必须取 **run 当时**的版本（`dryrun-collect.ts --harness-version`，缺参即报错），
  不得读采集时的本机安装版本——会话日志只带日志格式版本，不含 harness 版本。
  实证：dry-run 在 0.1.5-rc.3 下运行，采集时本机已被环境升级到 0.1.7-rc.2，隐式读取会把环境字段与
  `experiment_config_hash` 写错（`c7013033…`）；按 run 时版本重采后恢复为 `90227c3b…`。
