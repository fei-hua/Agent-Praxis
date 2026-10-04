# Formal 基准进度与冻结资产台账

> 本文件属于**审核/证据层**，不进入任何 task identity。
> 最近更新事由：**F12 签署+冻结完成 ⇒ F01–F12 = 120/120 全部冻结，独立验真 240/240 PASS**；F12 构念审查 PASS（C1/C2 同为 [WORKFLOW] 但 failure mode 不同；D1 = [PARALLEL] 单一）；manifest 仍 **LOCKED（未生成，待人工授权）**。

---

## 一、冻结资产台账（不可回写基准）

| 族 | 状态 | signed_version_hash | frozen_version_hash | frozen_content_projection_hash | 独立验真 |
|---|---|---|---|---|---|
| F01 | **frozen** | 1daf8f56… | dd94f79d50a69729… | 893d5fbbea5fbd4d… | PASS |
| F02 | **frozen** | a4015814… | ff689acca75c09c7… | a00870c8960bd04c… | PASS |
| F03 | **frozen** | e1467928ba6363fc2f31255b4f4fcd01d2e7b7207fb658bf72db84c97186aab9 | d3a34ef4fcb7b34328704f2bbd45ed0801fd7784b4a45a9fba3acb35d5b655bf | d32e5343df9338890c9b645841b3660433e60c22e9fd9e07bdd92b5c0249935f | PASS |
| F04 | **frozen** | 8e5682980e5d2b15ba5d19fba8cba63b1936816cd11d71e61492de661d057fc2 | 630abbf31bffcd1b59087e0a15a3ccb21a51434d86b010d35a6e239a9df45d86 | ca8af00072b5eed5cfcbe7b2540bad41a48f9b4ae0774c1f6cdc011abd84fc55 | PASS |
| F05 | **frozen** | 1a6dcaba14576b50c55541a0d8f7a192f084aed16e60411fecbba250cfdc62d1 | 82a8f3b7aaec92a689242b751367a5f32f830f1137780a7bf76c0c502fb3f01b | 02ca8c01a3dfe7c1d6490a1356da26a66155a3b0ffad65871972adcf37af0f04 | PASS |
| F06 | **frozen** | 13b0d0fe8c1e4653bffcdc2e209bb944884d475b32d8bc3700d3680ecff2767e | a6465c465cb8e0094833aebb9035415a4f8c50debc1d1224469ab8f37746604d | e814fa7ec4c916050230df9fd9cfe050c7e4b069a9f412395552e6e05eb755d3 | PASS |
| F07 | **frozen** | 883ce1ed05bf68737d7160ef5f80653e59c0fd86230319e2a42738bce68b4e8d | 63ccfe74803a890c1d9ecba509742db13ba18de69dfe75754ea3a7e86f1e94be | 29a7942c25fc1b62994c2ffdc9fe0eec9703b2afe5635c8825b8db0a4bf4c395 | PASS |
| F08 | **frozen** | 024aed6c0408749cc8aa904182629f854c8086b46eeaff9eb07a23d095092fb2 | 2b6e531363c6f82bdebb050926f255af87265ae2dd311e7efa4a46a7055c8e72 | 65399a2bd9a87b8f19f6c3fb71474a20254e59344cfad61f342c91e9eb4826c7 | PASS |
| F09 | **frozen** | 6224f1f9c61469b8dcc6e571f6ebe6a45d34b1341d692f618d20659f43b67ac7 | 2876127978756246f592304d8e7a4ce6b22075c8f0851c65af20657a742625e1 | a14936b2483e816f72ff72df080623e8988c6b4b0ade410d508375a67112a845 | PASS |
| F10 | **frozen** | 715d7a7ebb125fd48d7e42ea0c7e29abb2e2f0ae44f08f59b5ef07b676744a7b | 7529f8e356d017ce3ff19d1660e81d0b25378a91d24625c055a0f5c9b8d30c85 | 442beec3b765d572d625013455fabc1d82e1f2c957a93fc11bb3cdad44545b3c | PASS |
| F11 | **frozen** | 5bfea286b9457b853a48f30fc7a00c23675a0e41f4bf389ea783da01076882cf | 4c31a3f7c86ae4b731b6d4a94cf6deb925e8cb8fb4f3a3e26d4f9c901412e4ad | bca00524dc6263022bf33539930253f85216c53c38460fc336af94cf5020fb23 | PASS |
| F12 | **frozen** | bd6e12fa7673679b45358eeabf40a1a9f46c5d7ed2e56611f7319b3e91328a60 | 8ec5aaef0505f3ae320aa1e396ea25e30de99807f0fc42cb6c190c385c9be55a | f8838f36aabcc1cb80887cea175ed087a2840ee01f4dd3c368286c8e5a108994 | PASS |

```
F03 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-09-30T17:02:49Z（F03）
F04 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-09-30T17:39:57Z
F05 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-09-30T17:54:00Z
F06 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-09-30T18:00:27Z
F07 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-09-30T18:15:03Z（冻结前独立复算 MATCH=True）
F08 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-10-04T05:04:23Z（冻结前独立复算 MATCH=True）
F09 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-10-04T06:18:32Z（冻结前独立复算 MATCH=True）
F10 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-10-04T06:40:41Z（冻结前独立复算 MATCH=True；D2 GT = [WORKFLOW] 单一，签署前校验通过）
F11 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-10-04T07:21:14Z（冻结前独立复算 MATCH=True；D2 GT = [WORKFLOW] 单一，签署前校验通过）
F12 签署元数据：gt_signed_by = fei-hua · gt_signed_at = 2026-10-04T08:10:23Z（冻结前独立复算 MATCH=True；C1/C2 = [WORKFLOW]、D1 = [PARALLEL]、D2 = [WORKFLOW] 逐一校验通过）
  各族 10 个 FORMAL-F0X-*.yaml 均为 status: frozen，且 gt_signed_version_hash 与上表 signed 值一致
独立验真：     formal-verify-all --family F01..F08 ⇒ 通过检查 = **160/160**（PASS=160 FAIL=0）
              F01–F08 各自：版本身份 ✓ · 签署投影（0 GT 漂移）✓ · 未修改任务 YAML = 0 ✓
              F08 十条逐任务：status=frozen schema=ok hash绑定=ok 重复id=0 required覆盖=ok
F08（已冻结）：10/10 status: frozen · gt_signed_version_hash = 024aed6c…（10/10）
              机械门禁（author 运行）：schema 10/10 · node 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0
              C 类反事实：C1 串行 10183ms / C2 串行 9876ms > 6500ms ⇒ verify「总耗时超预算」拒绝；并行 3536 / 3508 ms ≤ 预算
                        C2 专项：跨来源重复 request_id = 1（C1 = 0）· per-source naive = 83 ≠ global canonical = 68
                                第三份独立实现复算 ledger.used = 68 一致 · groups 全等 ⇒ 全局幂等对账成立
              E 类真实预跑：E1 check.js / E2 reconcile.js 均 exit=1；E2 断言原文「展示额度必须由账本推导，实际 70，账本推导值 20」
              C2 构念名称（人工裁定冻结）：**跨来源重叠分片条件下的全局幂等对账正确性**（对照 C1 = 不重叠分片下的并行调度/预算正确性）
F09（已冻结）：10/10 status: frozen · gt_signed_version_hash = 6224f1f9…（10/10）
              机械门禁：schema 10/10 · node 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0
              C1 反事实（实测，_diag-f09-evidence.mjs）：同 fixture（2ec2672a…）
                        serial span 10190ms > 6500ms ⇒ verify REJECT(1) 且命中「总耗时超预算」；check-timeline REJECT(1)
                        parallel span 3548ms ≤ 预算 ⇒ verify PASS(0) + check-timeline PASS(0)（纯读取，独立参考渲染器逐字节比对）
              C2：共享 partial（shared.tpl）下顺序无关性断言通过（两种完成顺序 snapshot 逐字节一致）
              E 类真实预跑：E1 check.js / E2 reconcile.js 均 exit=1；E2 派生链实测：改 source(Alice→Bob) 后
                        **snapshots/main.snap 本身被重新派生为 "Hello Bob"**（display 未绕过 snapshot）
F10（已冻结）：10/10 status: frozen · gt_signed_version_hash = 715d7a7e…（10/10）· D2 expected_first_decisions = [WORKFLOW]
              机械门禁（author 运行）：schema 10/10 · node 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0
              C 类反事实：C1 串行 10189ms / C2 串行 9772ms > 6500ms ⇒ verify「总耗时超预算」拒绝；
                        正式证据 fixRun exit=0 · distinct 分片=3 · span 3533/3440ms ≤ 预算 · canonical 产物 == checker 内嵌独立参考迁移（逐字节）
              D2：fixRun exit=0 · provenance 三级链 sha256 校验通过（真实 artifact 传递，非"各自 PASS"）
              E 类真实预跑：E1 check.js / E2 idempotent.js 均 exit=1；E2 断言原文：
                        actual=[{"id":1,"display_name":"AliceAlice"},…] expected=[{"id":1,"display_name":"Alice"},…]
              独立复算：_f10-independent-check.mjs ⇒ 44/44 PASS（未修复层 10/10 正确 FAIL）· _f10-drift-check.mjs ⇒ F01–F09 零漂移
              GT 纠偏记录：D2 由 [PARALLEL, WORKFLOW] 收紧为 [WORKFLOW]（人工裁定 GT 过约束）；
                        范围复算：fixtures sha256 不变 · 变化 YAML 仅 D2 · 变化行仅 1 行（expected_first_decisions）
                        正式记录仅使用 715d7a7e… 一套身份（D2 收紧前的 draft identity 已作废，不再写入任何正式记录）
F11（已冻结）：10/10 status: frozen · gt_signed_version_hash = 5bfea286…（10/10）· D2 expected_first_decisions = [WORKFLOW]
              机械门禁（author 运行）：schema 10/10 · node 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0
              C 类反事实：C1 串行 10179ms / C2 串行 9765ms > 6500ms ⇒ verify「总耗时超预算」拒绝；
                        正式证据 fixRun exit=0 · 分片产物与合并产物 == checker 内嵌独立参考查询（逐字节）
                        C2 专项：分片拼接序 ≠ canonical 全序；第三键 canonical_record_bytes 决定 (ts, record_id) 相同的 r-dup 取用
              D2：四阶段 provenance 路径连续 + sha256 与真实文件一致（artifact 真实传递）
              E 类真实预跑：E1 check.js / E2 check-query.js 均 exit=1；断言原文：
                        E1「新查询路径必须按 Q3 真全序输出」· E2「Q2：缺失/null 的 value 不得被默认值修补 —— actual sum=130 / expected sum=100」
              独立复算：_f11-independent-check.mjs ⇒ 123/123 PASS（第三份最小实现 + 人工推算期望字面值 + 独立重建 verifyTask）
              ⚠️ incident（已恢复）：独立复算脚本曾 rmSync 整个 pilot-workspace（10 个 PILOT-* + seed-hashes.json），
                        已用 scripts/pilot-setup.ts 确定性重建并核验 36/36 零失配；pilot-runs 证据（receipts 99 文件）未受影响；
                        脚本已改为只清理 FORMAL-F11-*。本 incident 不影响 F11 证据链，也无需重跑 F01–F10。
F12（已冻结）：10/10 status: frozen · gt_signed_version_hash = bd6e12fa…（10/10）· 人工授权冻结的 F-1…F-9 已写入各变体 CONTRACT
              机械门禁（author 运行）：schema 10/10 · node 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0
              C/E 类真实预跑 5/5 exit≠0 · D1 调度反事实 1/1 被「总耗时超预算」拒绝（串行 span 10.19s > 6500ms；并行 ≈3.5s ≤ 预算）
              C1：仅已发生状态变化的 api 进入回滚范围、逆拓扑序回滚到 LKG=v3、rolled_back、rollback_count=1
              C2：健康门禁失败 → 回滚阶段自身失败 ⇒ halted + 停止后续回滚步（api 停在 v1）；与"吞掉失败报 rolled_back"形成真实终态差异
              D2：db→api→web 拓扑链 + provenance 四步路径连续与 sha256 一致
              独立复算：_f12-independent-check.mjs ⇒ 165/165 PASS（第三份最小实现 + 人工推算期望字面值 + 独立重建 verifyTask）
              ⚠️ 实现优先级（人工点名）：S7/F9 的 drift-redeploy 必须优先于 S9 same-version skip（见下方核验行）
冻结进度：     **120 / 120**（F01–F12 全部冻结 —— 12 族 × 10 变体；A–E 各 24 个槽位）
独立验真（累计）：formal-verify-all --family F01..F12 ⇒ 通过检查 = **240/240**（PASS=240 FAIL=0）
manifest 门槛：**已达成（120/120）**，但 pilot-manifest-formal.json **尚未生成** —— 需人工明确授权后一次性全量生成

```

## 二、门禁状态（用户裁定）

```
formal manifest = **LOCKED**
  · pilot-manifest-formal.json **不存在**（未生成）
  · 门槛保持 **120/120 frozen**，不得降低
  · 不允许生成"部分冻结清单"混入正式 manifest 语义（除非另行修改并重新裁定 manifest 规范）
git：未 commit（本地 HEAD 仍 c360187）
```

## 三、后续管线（F04 → F12，逐族闭环）

```
每族严格按同一顺序：
  起草（draft：10 变体 + seeds + 三层证据）
    → 独立构念审查（人工；新族不得跳过）
    → 机械门禁（schema 10/10 · node verify.js 10/10 FAIL→PASS · verifyTask 10/10 · CONFIG_ERROR=0 · success=null=0）
    → 独立验真（formal-verify-all 加入该族，逐任务 + 版本身份 + 签署投影）
    → 签署 + 冻结（signed/frozen/projection 三哈希，status: frozen，gt_signed_* 写实）
  → 全部 120 槽位冻结后：全量独立验真 → 才允许生成 formal manifest
```

## 四、C 类（委派/并行类）必须继承的 F03 标准

```
判据（不得仅凭"任务看起来适合并行"）：
  必须有**任务约束或反事实证据**证明相应调度结构具有必要性。
F03 的做法（可复用为模板）：
  · 同一 fixture + 同一分支 + 同一总预算（6500ms）
  · 仅改变调度：串行 span ≈ 10.19s > 6.5s ⇒ verify 失败（stderr 明确「总耗时超预算」）
                并行 span ≈ 3.53s ≤ 6.5s ⇒ verify 通过
  · 正式证据必须包含：fixRun exit=0 · timeline entries=3 · span ≤ 预算 · verify PASS
  · 度量卫生：证据阶段以干净状态开始；验证"已发生的那次运行"而非重跑分支

措辞纪律（第三轮裁定）：
  ✅ 可写："串行执行无法满足约束"
  ⚠️ 不可写强命题："FIRST_DECISION=DIRECT ⇒ 必然失败"
      （除非冻结的 DIRECT 定义明确排除并行/工作流式调度；DIRECT 是语义类别而非执行模式）
```

## 五、红线（当前有效）

```
不可修改：N=120 · 12 families × 10 variants · A–E 各 24 · Protocol v2 · CDA / GT /
         Recovery Rule v1 · maxDepth · 签署键集
不可回写：F01 / F02 / F03 的 frozen hash、GT 与任务内容（视为冻结基准资产）
不可为该配额或结果重新设计已冻结任务
不可生成 manifest（LOCKED）
新增族不得复用已有族的脚手架领域（F01 单模块 JS 工具 / F02 CLI 解析+数据管线 /
         F03 HTTP handler + middleware 链），F04 起需新的任务领域
```

## 六、下一族（F04）拟采用的领域与检查点

```
领域候选（与 F01–F03 不同）：事件流/状态机处理（含幂等与顺序保证）或模板渲染 + 快照一致性
  — 具体领域在起草前单独提出并说明"为何不与 F01–F03 重叠"
变体分布：仍须 A×2 · B×2 · C×2 · D×2 · E×2（与 slots 配额一致）
C 类：必须预先准备可机械验证的约束（如硬时限/预算）与反事实证明脚本，
      不得先写 GT 再补证据
交付物：FORMAL-F04-*.yaml ×10 · formal-seeds-f04.ts · f04-review.md · f04-gt-drafts.json ·
      f04-version.json · f04-pre-run.json（如需预跑）·（审查通过后）签署与冻结
```

---

## Benchmark v1 里程碑（封版锚点）

**Formal Benchmark v1：120/120 frozen · 240/240 independent verification · manifest self-check PASS**
- manifest = \pilot-manifest-formal.json\（131.4 KB，恰好 1 个生成物）
- manifest sha256 = \D255E4CD218F81F618D80FA827FFC8174F74C6649843D6821EBB3CCF1E7A875F\
- 设计：12 族 × 10 变体 · A–E 各 24 · arms = A/B/C_frozen · planned runs = 360
- 已知限制（保持原文，不视为已实现）：F12 DRIFT + SAME-VERSION 行为优先级在冻结任务集中 0/10 被触发；
  source-level 已审计，behavioral path 未实现/未确认；经覆盖分析 IMPACT = NONE（见 f12-review.md）
- 此后 F01–F12 的 task identity / GT / contract / 签署投影 / frozen hash 一律不得修改
