# pre-rematerialization-backup

Contains original receipt artifacts backed up before rematerialization.
These are source evidence, not excluded/invalid experiment runs.

内容说明：
- 本目录保存的是**重新生成计划（rematerialization）之前的原始产物**：原始 receipt（含运行数据与 Agent-exit 指纹）、
  原始 plan、prompt、manifest。
- 目录名中的 "pre-rematerialization" 指**备份时点**，不代表这些都是无效/被排除的实验。
- 其中 9 条 receipt 是已完成 run 的**唯一完整记录**（在线位置的 receipt 在 rematerialization 时被覆盖为 prepare 空壳）；
  分析脚本（scripts/pilot-audit.ts）在检测到在线卡为 prepare 空壳时会回退读取本目录，并在 `receipt_source` 列标注 `archive`。
- 权威数据仍以 `telemetry/trajectories/<runId>.jsonl` 为准。