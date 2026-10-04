# Run Plan 身份对账（v1 archived vs v2 authoritative）

- v1: `benchmark/formal/archive/formal-run-plan-v1.json` sha256=5301735C08BE777105B3F0F7E3AF0F8589059E289A9764FE6E695C008BE81888 plan_version=v1 runs=360
- v2: `formal-run-plan-v2.json` sha256=E7D55265143FCB21C77C768547D072CDF2F368C559BEE99D529B56FE72B9FEEC plan_version=v2 runs=360
- seed: v1=formal-arm-order-2026-10-04-v1 / v2=formal-arm-order-2026-10-04-v1 （相同=true）
- source_manifest sha 相同=false · design 相同=true · run_id 集合相同=true · (task,arm,rep) 三元组相同=true
- 差异维度: 仅 `arm_order_index` 分配（位置配额修正），不同 task 数=103/120
- 首位分布: v1 = A:34 B:51 C_frozen:35 / v2 = A:40 B:40 C_frozen:40
- 位置配额: v1 = A@p0=34 B@p0=51 C_frozen@p0=35 A@p1=42 B@p1=39 C_frozen@p1=39 A@p2=44 B@p2=30 C_frozen@p2=46
-           v2 = A@p0=40 B@p0=40 C_frozen@p0=40 A@p1=40 B@p1=40 C_frozen@p1=40 A@p2=40 B@p2=40 C_frozen@p2=40
- (b) F01 已执行 30 条: run_id∈v2=30/30 · task=30 · arm=30 · replicate=30 · arm_order_index=30
- 判定: **(a) 差异仅来自位置配额修正 = false** · **(b) 30 条逐条属于 v2 = true**
- ⇒ 结论: v2 为唯一权威执行计划；v1 为 superseded 历史计划

---

## 收口记录（2026-10-04）

### source_manifest.sha256 定性 = (i) 表示差异

- v1.source_manifest.sha256 = `D255E4CD218F81F618D80FA827FFC8174F74C6649843D6821EBB3CCF1E7A875F`（大写）
- v2.source_manifest.sha256 = `d255e4cd218f81f618d80fa827ffc8174f74c6649843d6821ebb3ccf1e7a875f`（小写）
- 当前 `pilot-manifest-formal.json` 文件字节 sha256 = `d255e4cd…7a875f`；大小写两种形式**均命中同一份文件字节哈希**
- 未命中候选：compact_json = 3abad483…（未被任何一方引用）、sha256(哈希串) = 8f9465fd…（未被引用）
- 生成器依据（scripts/formal-run-plan.ts:46/110-112/278-284）：`sha256 = createHash('sha256').update(s,'utf8').digest('hex')`，
  对**文件原始字节**取哈希并保留小写 hex；v1（手工生成）为同一哈希的大写形式
- 时间线：manifest mtime 2026-10-04T08:44:47Z → v1 08:49:06Z → v2 09:01:54Z（期间 manifest 未被重新生成）
- ⇒ **同一份 frozen manifest**，差异仅为大小写表示 ⇒ 不影响计划身份

### 计划身份权威关系（收口后）

- `formal-run-plan-v2.json` = **唯一 authoritative execution plan**
  （依据 Protocol v2 §5：排序键 `sha256(frozen_seed|group_id|arm)`，位次配额 18 格精确 40/40/40）
- `formal-run-plan-v1.json` = **historical / superseded**
  （排序键 `sha256(seed|task_id|arm)`，首位分布 34/51/35，违反 §5 位次配额）

### F01 已执行 30 条的归属与二级指标记录

- (b) F01 30 条逐条属于 v2：run_id 30/30 · task 30/30 · arm 30/30 · replicate 30/30 · arm_order_index 30/30（无不一致）
- F01 first_decision GT 命中率 = **20/30**
  → **二级分析指标**（仅用于 first_decision 统计）
  → **不修改 frozen GT**
  → **不修改 primary outcome**（已产生的 30 条 task 判定不变）
- exec_exit_code 语义：`''` = Agent process exited normally with code 0；`infrastructure_failure` = 0
