# Phase 0 Dry-run 验收报告

生成时间：2026-09-27T15:27:32.173Z

## 集合级覆盖（OQ-007 授权要求：≥1 失败 + ≥1 replan）

- [PASS] **coverage-1** 失败场景覆盖（至少 1 个 run 含可重建 failure event） — 集合内 failure 事件总数=5
- [PASS] **coverage-2** Replan 场景覆盖（至少 1 个 run 含可重建 replan event） — 集合内 replan 事件总数=1
- [PASS] **coverage-3** 委派场景覆盖（至少 1 个 run 含 subagent 调用与返回） — 含 subagent 调用的 run 数=2

## §4.2 五条验收（全部 PASS 才允许 Pilot）

### run-2026-09-27-DRY-01
- [PASS] **4.2-1** trajectory schema 覆盖率 100%（§8.1 字段值或明确 null） — §8.1 全部 23 个字段有值或明确 null；run_start/run_end 事件齐全
- [PASS] **4.2-2** tool call 与 tool result 配对率 100% — 6/6 配对（含子会话调用）
- [PASS] **4.2-3** failure event 可重建（失败原因与上下文可从 trajectory 还原） — 0 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call
- [PASS] **4.2-4** replan event 可重建（触发与前后决策可还原） — 0 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原
- [PASS] **4.2-5** 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome） — 链条完整：task=DRY-01，task_state×1，actions=6，outcome 有记录
#### §4.3 额外检查（非门禁）
- [PASS] **4.3-1** token 使用量、工具调用数、失败率、replan 次数已记录 — input=8863, output=1569, total=62272, tool_calls=6, failures=0, replans=0
- [PASS] **4.3-2** Subagent 的调用与返回都被记录（OQ-006 名单内） — 调用 0，返回 0，未返回：[]

### run-2026-09-27-DRY-02
- [PASS] **4.2-1** trajectory schema 覆盖率 100%（§8.1 字段值或明确 null） — §8.1 全部 23 个字段有值或明确 null；run_start/run_end 事件齐全
- [PASS] **4.2-2** tool call 与 tool result 配对率 100% — 8/8 配对（含子会话调用）
- [PASS] **4.2-3** failure event 可重建（失败原因与上下文可从 trajectory 还原） — 0 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call
- [PASS] **4.2-4** replan event 可重建（触发与前后决策可还原） — 0 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原
- [PASS] **4.2-5** 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome） — 链条完整：task=DRY-02，task_state×1，actions=8，outcome 有记录
#### §4.3 额外检查（非门禁）
- [PASS] **4.3-1** token 使用量、工具调用数、失败率、replan 次数已记录 — input=9495, output=1553, total=54312, tool_calls=8, failures=0, replans=0
- [PASS] **4.3-2** Subagent 的调用与返回都被记录（OQ-006 名单内） — 调用 0，返回 0，未返回：[]

### run-2026-09-27-DRY-03
- [PASS] **4.2-1** trajectory schema 覆盖率 100%（§8.1 字段值或明确 null） — §8.1 全部 23 个字段有值或明确 null；run_start/run_end 事件齐全
- [PASS] **4.2-2** tool call 与 tool result 配对率 100% — 14/14 配对（含子会话调用）
- [PASS] **4.2-3** failure event 可重建（失败原因与上下文可从 trajectory 还原） — 1 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call
- [PASS] **4.2-4** replan event 可重建（触发与前后决策可还原） — 0 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原
- [PASS] **4.2-5** 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome） — 链条完整：task=DRY-03，task_state×1，actions=15，outcome 有记录
#### §4.3 额外检查（非门禁）
- [PASS] **4.3-1** token 使用量、工具调用数、失败率、replan 次数已记录 — input=8003, output=8399, total=192914, tool_calls=14, failures=1, replans=0
- [PASS] **4.3-2** Subagent 的调用与返回都被记录（OQ-006 名单内） — 调用 1，返回 1，未返回：[]

### run-2026-09-27-DRY-04
- [PASS] **4.2-1** trajectory schema 覆盖率 100%（§8.1 字段值或明确 null） — §8.1 全部 23 个字段有值或明确 null；run_start/run_end 事件齐全
- [PASS] **4.2-2** tool call 与 tool result 配对率 100% — 26/26 配对（含子会话调用）
- [PASS] **4.2-3** failure event 可重建（失败原因与上下文可从 trajectory 还原） — 2 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call
- [PASS] **4.2-4** replan event 可重建（触发与前后决策可还原） — 0 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原
- [PASS] **4.2-5** 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome） — 链条完整：task=DRY-04，task_state×1，actions=28，outcome 有记录
#### §4.3 额外检查（非门禁）
- [PASS] **4.3-1** token 使用量、工具调用数、失败率、replan 次数已记录 — input=8554, output=6014, total=268648, tool_calls=26, failures=2, replans=0
- [PASS] **4.3-2** Subagent 的调用与返回都被记录（OQ-006 名单内） — 调用 2，返回 2，未返回：[]

### run-2026-09-27-DRY-05
- [PASS] **4.2-1** trajectory schema 覆盖率 100%（§8.1 字段值或明确 null） — §8.1 全部 23 个字段有值或明确 null；run_start/run_end 事件齐全
- [PASS] **4.2-2** tool call 与 tool result 配对率 100% — 10/10 配对（含子会话调用）
- [PASS] **4.2-3** failure event 可重建（失败原因与上下文可从 trajectory 还原） — 2 个 failure 均含 reason/kind/context 且上下文指向真实 tool_call
- [PASS] **4.2-4** replan event 可重建（触发与前后决策可还原） — 1 个 replan 的 trigger_failure_id / decision_before / decision_after 均可还原
- [PASS] **4.2-5** 离线可重建完整决策链（Task → Task State → First Decision → Action → Tool/Subagent → Outcome） — 链条完整：task=DRY-05，task_state×2，actions=10，outcome 有记录
#### §4.3 额外检查（非门禁）
- [PASS] **4.3-1** token 使用量、工具调用数、失败率、replan 次数已记录 — input=3278, output=2227, total=94081, tool_calls=10, failures=2, replans=1
- [PASS] **4.3-2** Subagent 的调用与返回都被记录（OQ-006 名单内） — 调用 0，返回 0，未返回：[]

## 冻结阈值（原样记录，不得调整）

```json
{
  "final_score_threshold": 0.3,
  "top_k": 5,
  "experience_token_budget_item": 160,
  "lesson_max_chars": 60
}
```

## 离线决策链重放（§4.2-5 证据，无外部状态依赖）

### run-2026-09-27-DRY-01（chain_complete=true）
```
[   0] Task           task_id=DRY-01 arm=null(OQ-008) snapshot=SNAPSHOT_01
[   0] Meta           model=deepseek-flash config_hash=sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0
[   0] Meta           env: harness=0.1.5-rc.3 tool_schema=tschema-19751aa066b9 framework=1.0
[   1] Task State     complexity=simple scope=project characteristics=[] constraints=[scope_limited]
[   1] First Decision first_decision=DIRECT（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   2] Meta           retrieval @ SNAPSHOT_01: EXP-DRY-TEST-DIRECT(final=0.466,MATCHED)
[   3] Action         tool_call read (call_00_OPNqjoCLzApNkdBicbQs0144)
[   3] Tool/Subagent  read ← primary
[   5] Action         tool_call glob (call_01_AOdD5I2Pd5QpGTk1tnvp5615)
[   5] Tool/Subagent  glob ← primary
[   7] Action         tool_call write (call_00_2VKoxXMZa3oTsXIMue414746)
[   7] Tool/Subagent  write ← primary
[   9] Action         tool_call edit (call_00_s7hHDev63ju3lXivldHy2770)
[   9] Tool/Subagent  edit ← primary
[  11] Action         tool_call pwsh (call_00_ET_34LlSSHXN0YFofb1a63c3439)
[  11] Tool/Subagent  pwsh ← primary
[  13] Action         tool_call send_message (call_00_yuLqkrNYAZvVO49xwIhT5915)
[  13] Tool/Subagent  send_message ← primary
[  15] Meta           verification success=true required={"dry-run-workspace/DRY-01/src/smoke.test.js 存在":"PASS","node dry-run-workspace/DRY-01/src/smoke.test.js 的输出包含 SMOKE PASS":"PASS","counter.js 未被修改（哈希不变）":"PASS","轨迹中存在至少一次对 smoke.test.js 的执行（成功条件验证）":"PASS"}
[  16] Outcome        tokens=62272 subagent_calls=0 wall_time_s=11.271
[  17] Outcome        run_record: task_success=true input=8863 output=1569 total=62272
```

### run-2026-09-27-DRY-02（chain_complete=true）
```
[   0] Task           task_id=DRY-02 arm=null(OQ-008) snapshot=SNAPSHOT_01
[   0] Meta           model=deepseek-flash config_hash=sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0
[   0] Meta           env: harness=0.1.5-rc.3 tool_schema=tschema-19751aa066b9 framework=1.0
[   1] Task State     complexity=simple scope=project characteristics=[multi_file] constraints=[scope_limited]
[   1] First Decision first_decision=EXPLORE（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   2] Meta           retrieval @ SNAPSHOT_01: EXP-DRY-DOC-EXPLORE(final=0.379,MATCHED)
[   3] Action         tool_call glob (call_00_l8OPXDmMIaw7D2zSyxYT9523)
[   3] Tool/Subagent  glob ← primary
[   5] Action         tool_call read (call_01_QD10hWG3i1b5rCqrKvT75840)
[   5] Tool/Subagent  read ← primary
[   6] Action         tool_call read (call_02_MMgPfM6wtUW6165RVxgq5077)
[   6] Tool/Subagent  read ← primary
[   7] Action         tool_call read (call_03_VL0HF9UiHF4vAWNwFP3u0317)
[   7] Tool/Subagent  read ← primary
[  11] Action         tool_call write (call_00_QoNkNoRBDeEkffJo2enX8560)
[  11] Tool/Subagent  write ← primary
[  13] Action         tool_call read (call_00_54N1E7ZNbotxGkO2xH6E0630)
[  13] Tool/Subagent  read ← primary
[  15] Action         tool_call present (call_00_ET_ksg8deAfwxovWbgmMD9z0042)
[  15] Tool/Subagent  present ← primary
[  17] Action         tool_call send_message (call_01_ET_Fg1bg394YBg0JHCCzjxV8774)
[  17] Tool/Subagent  send_message ← primary
[  19] Meta           verification success=true required={"dry-run-workspace/DRY-02/docs.md 存在":"PASS","docs.md 提及 alpha.js、beta.js、gamma.js 三个文件名":"PASS","docs.md 含至少一处调用关系表述（→ 或 调用）":"PASS","mini-lib/ 下文件未被修改":"PASS","轨迹中存在对 mini-lib 的读取/检查（成功条件验证）":"PASS"}
[  20] Outcome        tokens=54312 subagent_calls=0 wall_time_s=9.706
[  21] Outcome        run_record: task_success=true input=9495 output=1553 total=54312
```

### run-2026-09-27-DRY-03（chain_complete=true）
```
[   0] Task           task_id=DRY-03 arm=null(OQ-008) snapshot=SNAPSHOT_01
[   0] Meta           model=deepseek-flash config_hash=sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0
[   0] Meta           env: harness=0.1.5-rc.3 tool_schema=tschema-19751aa066b9 framework=1.0
[   1] Task State     complexity=medium scope=project characteristics=[multi_page] constraints=[scope_limited,no_public_interface_change]
[   1] First Decision first_decision=DELEGATE（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   2] Meta           retrieval @ SNAPSHOT_01: EXP-DRY-UI-DELEGATE(final=0.577,MATCHED)
[   3] Action         tool_call read (call_00_ET_gizDOIciaKd8uKtxFGKh8226)
[   3] Tool/Subagent  read ← primary
[   4] Action         tool_call read (call_00_ET_kKgNIVK3U8fR5mgkU2kA6399)
[   4] Tool/Subagent  read ← 095e21a5-3c25-42aa-8a48-2534e8610b5c
[   7] Action         tool_call glob (call_01_ET_EEXWnKsv459KJIdFegzx1619)
[   7] Tool/Subagent  glob ← primary
[   9] Action         tool_call send_message (call_00_mWN0OpQXl23WDXWceU4f8520)
[   9] Tool/Subagent  send_message ← 095e21a5-3c25-42aa-8a48-2534e8610b5c
[  11] Action         tool_call subagent (call_00_HNwltVpmfMkAtMBGu0m66613)
[  11] Tool/Subagent  subagent ← primary
[  12] Tool/Subagent  subagent[ui-reviewer review DRY-03 ui.css] 095e21a5-3c25-42aa-8a48-2534e8610b5c: {"description":"ui-reviewer review DRY-03 ui.css","prompt":"You are \"ui-reviewe
[  15] Action         tool_call write (call_00_rpd3116UcJJbExz6NBA10947)
[  15] Tool/Subagent  write ← primary
[  17] Action         tool_call read (call_00_8qBwDHdkAbkrvJuUCZ2p9506)
[  17] Tool/Subagent  read ← primary
[  19] Action         tool_call list_agents (call_00_HPDYxyI9gGsRLHZ7lvFX9397)
[  19] Tool/Subagent  list_agents ← primary
[  21] Action         tool_call job_output (call_00_BAmf7CVL8qAfjwQhqbw04278)
[  21] Tool/Subagent  job_output ← primary
[  23] Action         tool_call list_agents (call_00_NjyMIJNF8ysPIWz6CIKX7751)
[  23] Tool/Subagent  list_agents ← primary
[  25] Action         tool_call write (call_00_yB9IEYKGYE9ftBVl8dAX6046)
[  25] Tool/Subagent  write ← primary
[  27] Action         tool_call write (call_00_g5rLpcoWfq4bFz3TOEG65342)
[  27] Tool/Subagent  write ← primary
[  29] Action         tool_call send_message (call_00_TYZEn3zezrUpqEAoizsI9354)
[  29] Tool/Subagent  send_message ← primary
[  31] Action         tool_call present (call_00_ndNol5IRacDbHPaeEz240306)
[  31] Tool/Subagent  present ← primary
[  33] Meta           FAILURE fail-call_00_BAmf7CVL8qAfjwQhqbw04278 kind=tool_error reason=Error: unknown job 095e21a5-3c25-42aa-8a48-2534e8610b5c ctx=call_00_BAmf7CVL8qAfjwQhqbw04278
[  34] Meta           verification success=true required={"ui.css 中全部 margin/padding 的 px 值为 8 的倍数":"PASS","dry-run-workspace/DRY-03/ui-review.md 存在且列出至少 2 条 UI 越界风险":"PASS","轨迹中存在至少 1 次 subagent 调用":"PASS","ui.css 的选择器结构未被修改":"PASS","轨迹中存在对 ui.css 的检查（成功条件验证）":"PASS"}
[  35] Outcome        tokens=192914 subagent_calls=1 wall_time_s=34.087
[  36] Outcome        run_record: task_success=true input=8003 output=8399 total=192914
```

### run-2026-09-27-DRY-04（chain_complete=true）
```
[   0] Task           task_id=DRY-04 arm=null(OQ-008) snapshot=SNAPSHOT_01
[   0] Meta           model=deepseek-flash config_hash=sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0
[   0] Meta           env: harness=0.1.5-rc.3 tool_schema=tschema-19751aa066b9 framework=1.0
[   1] Task State     complexity=medium scope=project characteristics=[multi_file,shared_state] constraints=[data_schema_immutable,scope_limited]
[   1] First Decision first_decision=PARALLEL（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   2] Meta           retrieval @ SNAPSHOT_01: EXP-DRY-DATA-PARALLEL(final=0.481,MATCHED)
[   3] Action         tool_call read (call_00_zHX4MtTp11TT2xMUXubS9360)
[   3] Tool/Subagent  read ← primary
[   4] Action         tool_call pwsh (call_00_GDasoiFC5UZiuMgrnXbK8644)
[   4] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[   5] Action         tool_call read (call_00_ET_kGkj1Ln58ze2hxEYImeO4406)
[   5] Tool/Subagent  read ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[   6] Action         tool_call read (call_01_lvbA4R6LhdtcLeNcn7t39817)
[   6] Tool/Subagent  read ← primary
[  11] Action         tool_call read (call_00_VWYKy1nCdsG0DtcBkdxV2563)
[  11] Tool/Subagent  read ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  12] Action         tool_call pwsh (call_00_1mbGYC9R4jDVanyeNYE96881)
[  12] Tool/Subagent  pwsh ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  15] Action         tool_call subagent (call_00_stOUAUz5A7QZyPAdPNGZ3589)
[  15] Tool/Subagent  subagent ← primary
[  16] Tool/Subagent  subagent[tester run schema verify] 5c13e00a-1e8a-4d75-91f9-466dcb4004aa: {"description":"explorer schema audit","prompt":"You are the \"explorer\" line o
[  17] Action         tool_call subagent (call_01_Bnj16tN4qFmOW4nRzDnT1682)
[  17] Tool/Subagent  subagent ← primary
[  18] Tool/Subagent  subagent[explorer schema audit] 80d002f7-2419-4c47-853f-0dd54c249e7d: {"description":"tester run schema verify","prompt":"You are the \"tester\" line 
[  19] Action         tool_call pwsh (call_00_ONQYcTQodFuMNdm3ianJ6683)
[  19] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  20] Action         tool_call write (call_00_8hxukWoppJgIMmBv7KaN0812)
[  20] Tool/Subagent  write ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  27] Action         tool_call pwsh (call_00_sHbgyNQYXde6twAd7QxY5308)
[  27] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  28] Action         tool_call read (call_00_YIaCdcOagAALjUi2zb0X3885)
[  28] Tool/Subagent  read ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  29] Action         tool_call read (call_00_z21dMdvtAsQah3PKR4CM7081)
[  29] Tool/Subagent  read ← primary
[  32] Action         tool_call read (call_01_zRtVABKhmAVuzm8OlXTH5737)
[  32] Tool/Subagent  read ← primary
[  35] Action         tool_call pwsh (call_02_iC3nIS8jsR38xUdThooQ1564)
[  35] Tool/Subagent  pwsh ← primary
[  36] Action         tool_call pwsh (call_00_ET_1KdOMJKmjs4goNiNcGX81500)
[  36] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  37] Action         tool_call write (call_00_2nq9cwxBMW3MGrJ4UxRB7661)
[  37] Tool/Subagent  write ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  41] Action         tool_call present (call_00_kWHAImYdZa3uT7KIKOsH3461)
[  41] Tool/Subagent  present ← primary
[  42] Action         tool_call pwsh (call_00_U9Zk90DzlVxR3alrO9rh4825)
[  42] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  43] Action         tool_call read (call_00_ET_hdUOEbnwtfqoj0SChJru4467)
[  43] Tool/Subagent  read ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  47] Action         tool_call read (call_00_ET_yp5Lmj4VUu43B5fRGXTK5328)
[  47] Tool/Subagent  read ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  48] Action         tool_call pwsh (call_00_ET_gCr0Z8bBplxiusEbgbcG4168)
[  48] Tool/Subagent  pwsh ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  49] Action         tool_call send_message (call_00_ET_txkIOk9LgURU8fswcECH2821)
[  49] Tool/Subagent  send_message ← primary
[  53] Action         tool_call pwsh (call_00_l2AhTrxxUhrq0dfO4H7U2213)
[  53] Tool/Subagent  pwsh ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  54] Action         tool_call present (call_00_zw8Hj6XzLiWqA5rzYwWH9273)
[  54] Tool/Subagent  present ← 80d002f7-2419-4c47-853f-0dd54c249e7d
[  57] Action         tool_call present (call_00_AFAD7viEHagdmPivvQRN2400)
[  57] Tool/Subagent  present ← 5c13e00a-1e8a-4d75-91f9-466dcb4004aa
[  59] Meta           FAILURE 5c13e00a-fail-call_00_VWYKy1nCdsG0DtcBkdxV2563 kind=FsError reason=Error: cannot read "D:\Agent Praxis\experience-agent-v1\dry-run-workspace\DRY-04\schema-verify.txt": ctx=call_00_VWYKy1nCdsG0DtcBkdxV2563
[  60] Meta           FAILURE 80d002f7-fail-call_00_8hxukWoppJgIMmBv7KaN0812 kind=FsError reason=Error: cannot modify "D:\Agent Praxis\experience-agent-v1\dry-run-workspace\DRY-04\schema-audit.md": ctx=call_00_8hxukWoppJgIMmBv7KaN0812
[  61] Meta           verification success=true required={"dry-run-workspace/DRY-04/schema-audit.md 存在且含字段清单":"PASS","dry-run-workspace/DRY-04/schema-verify.txt 存在且包含 SCHEMA OK":"PASS","轨迹中存在至少 2 次 subagent 调用":"PASS","schema.json 未被修改（哈希不变）":"PASS","轨迹中存在对 verify-schema.js 的执行（成功条件验证）":"PASS"}
[  62] Outcome        tokens=268648 subagent_calls=2 wall_time_s=30.31
[  63] Outcome        run_record: task_success=true input=8554 output=6014 total=268648
```

### run-2026-09-27-DRY-05（chain_complete=true）
```
[   0] Task           task_id=DRY-05 arm=null(OQ-008) snapshot=SNAPSHOT_01
[   0] Meta           model=deepseek-flash config_hash=sha256:90227c3b51f9769accbd9d56906b797f106b96121e70effc4c0a47ce0f1ebde0
[   0] Meta           env: harness=0.1.5-rc.3 tool_schema=tschema-19751aa066b9 framework=1.0
[   1] Task State     complexity=medium scope=project characteristics=[multi_file] constraints=[scope_limited]
[   1] First Decision first_decision=EXPLORE（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   2] Task State     complexity=medium scope=project characteristics=[multi_file] constraints=[scope_limited]
[   2] First Decision first_decision=REPLAN（代码直读 task_state.first_decision，capture_source=first_turn_structured_json）
[   3] Meta           retrieval @ SNAPSHOT_01: <无命中>
[   4] Action         tool_call pwsh (call_00_frkQvEHxaYQBrcJekHbl2967)
[   4] Tool/Subagent  pwsh ← primary
[   6] Action         tool_call read (call_01_DO5NQ3qujr4f9nnEuibL8953)
[   6] Tool/Subagent  read ← primary
[   8] Action         tool_call pwsh (call_00_hVjfGty68SCZDOBJQYtQ4609)
[   8] Tool/Subagent  pwsh ← primary
[  10] Action         tool_call glob (call_01_6wScpHzJArPBRO5gODWB1429)
[  10] Tool/Subagent  glob ← primary
[  12] Action         tool_call pwsh (call_00_BtB8AET6rh6R65FFz4U33896)
[  12] Tool/Subagent  pwsh ← primary
[  14] Action         tool_call read (call_00_npHsySNUszNemosSmYB61751)
[  14] Tool/Subagent  read ← primary
[  16] Action         tool_call pwsh (call_01_wAZdPaqGS0WCxncoEKUQ5934)
[  16] Tool/Subagent  pwsh ← primary
[  18] Action         tool_call write (call_00_cbKA5BeynLWNOUTgW1Vn4777)
[  18] Tool/Subagent  write ← primary
[  20] Action         tool_call pwsh (call_00_ET_QlbD1EvYAI6ruXMWeZd48509)
[  20] Tool/Subagent  pwsh ← primary
[  22] Action         tool_call send_message (call_00_bByqkBA1CPEnlht5auUq3471)
[  22] Tool/Subagent  send_message ← primary
[  24] Meta           FAILURE fail-call_01_DO5NQ3qujr4f9nnEuibL8953 kind=FsError reason=Error: cannot read "D:\Agent Praxis\dry-run-workspace\DRY-05\config.json": not found ctx=call_01_DO5NQ3qujr4f9nnEuibL8953
[  25] Meta           FAILURE fail-call_01_6wScpHzJArPBRO5gODWB1429 kind=SearchError reason=Error: glob search failed (exit 2): rg: D:\Agent Praxis\dry-run-workspace: IO error for operation on ctx=call_01_6wScpHzJArPBRO5gODWB1429
[  26] First Decision REPLAN replan-20: trigger=fail-call_01_6wScpHzJArPBRO5gODWB1429 EXPLORE → REPLAN
[  27] Meta           verification success=true required={"node dry-run-workspace/DRY-05/run-check.js 的输出包含 ALL PASS":"PASS","run-check.js 的检查断言未被删除（断言数量不减）":"PASS","轨迹中存在对 run-check.js 的执行（成功条件验证）":"PASS"}
[  28] Outcome        tokens=94081 subagent_calls=0 wall_time_s=15.693
[  29] Outcome        run_record: task_success=true input=3278 output=2227 total=94081
```

## 结论

✅ 5 个 dry-run 任务全部满足 §4.2 五条验收 —— Phase 0 exit gate 通过，可进入 Pilot（需人工确认后）。

## T1–T10 交付映射（tasks/phase0.md §2）

| 交付项 | 代码/模块 | 证据 |
|---|---|---|
| T1 Harness Event Collector | `telemetry/session-log.ts + telemetry/extract.ts` | 5 条轨迹的 tool_call/tool_result 全部来自会话事件（日志通道；集成模式见 OQ-015） |
| T2 Trajectory Recorder | `telemetry/assemble.ts + telemetry/trajectory.ts` | telemetry/trajectories/run-2026-09-27-DRY-0{1..5}.jsonl（append-only typed JSONL） |
| T3 Task State | `core/task-state.ts` | 每条轨迹含 task_state 事件，首轮结构化输出（OQ-010 口径） |
| T4 Experience Schema | `experience/schema.ts` | schema 无 reliability_score 字段；§8.1 token 三个口径全部记录 |
| T5 Deterministic Quality Gate | `experience/gate.ts` | 9 项检查；tests/deterministic.test.ts 覆盖 duplicate/conflict(a)(b)(c)/task_id/version |
| T6 Store + Basic Retrieval | `experience/store.ts + experience/retrieval.ts + experience/calibration.ts` | SNAPSHOT_01 上完成真实检索（DRY-01 final=0.466 等）；BM25 标定路径存在（占位常数 OQ-013） |
| T7 5 个 Subagent | `agents/registry.ts` | DRY-03（ui-reviewer ×1）、DRY-04（explorer+tester ×2）调用与返回均已记录 |
| T8 first_decision logging | `core/task-state.ts readFirstDecision + telemetry/extract.ts` | 每条 task_state 事件带 first_decision；重放可索引（EXPLORE→REPLAN 见于 DRY-05） |
| T9 Snapshot 机制 | `experience/snapshot.ts` | snapshots/SNAPSHOT_01.db（0444 只读 + readOnly 连接），每次 run 记录 experience_snapshot_id |
| T10 5 Dry-run verification | `scripts/dryrun-{setup,judge,collect,accept}.ts` | 本报告 §4.2 全部 PASS |

## 确定性测试与类型检查

- `npm test` → `node --test --test-isolation=none tests/deterministic.test.ts`：24 项全部通过
- `npm run typecheck` → `tsc -p tsconfig.json`：0 error
- 说明：沙箱禁止子进程管道，故使用 `--test-isolation=none`（进程内运行，无 spawn）；这是环境约束不是规格选择。

## 仍未裁决的 OQ（登记于 spec/open-questions.md，Phase 0 不阻塞项）

| OQ | blocking | 问题 |
|---|---|---|
| OQ-010 | 否 | Task State 的捕获机制与「不解析最终聊天文本」（T1）的边界：task_state 由主 Agent 首轮「顺带输出」， |
| OQ-011 | 否 | token 计数口径未定义——「单条 Experience ≤ 160 tokens」「总 Experience Context ≤ 800 tokens」用哪个 tokenizer 计数？ |
| OQ-013 | 否 | BM25 标定的 P05/P95 百分位算法未定义（最近秩 / 线性插值 / 其他），会直接影响冻结的标定数值。 |
| OQ-014 | 否 | Eligibility Filter 中 task.scope 与 experience.scope 的组合规则未定义： |
| OQ-015 | 否 | T1「在 Harness Session 事件层订阅 tool/call、tool/result、session/event」的接入方式请确认： |
| OQ-017 | 否 | stale 的具体阈值未定——「超过 N 个任务未被命中，或环境版本变化」中的 N 未定义（规格已知开放项）。 |
| OQ-018 | 否 | token usage 字段口径（cache read 是否计入 Input / 总 Token） |
| OQ-019 | 否 | failure event 的派生规则（tool error 与非零命令退出） |
| OQ-020 | 否 | duplicate 与 exact conflict 规则 (c) 的判定重叠 |

## 工程约束与已知边界

- §6.1 复用 Harness：事件来自 DSH Session 日志、委派来自 `subagent` 工具，未新建 Runtime/事件总线。
- §6.2 目录结构：core/ experience/ agents/ telemetry/ benchmark/ policies/ docs/ 均已建立（`policies/` 按 Phase 0 范围留空并附 README）。
- OQ-008：dry-run 的 `arm` 记为 `null` 并标注（不造 enum 值）。
- 首轮执行遇到 provider 429 限流导致 5 个执行器中止；已改为分批执行并修复工作区 ESM/CJS 边界（工作区 `package.json{"type":"commonjs"}`），最终 5 条轨迹全部达标。
- DRY-05 首次执行的协议使初始即 REPLAN，缺少「失败→REPLAN」决策变化，该轨迹已废弃并按修正协议重跑（现存轨迹含 EXPLORE→REPLAN 与 2 个可重建 failure）。
