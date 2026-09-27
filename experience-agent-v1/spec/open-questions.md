# Open Questions

> **只允许追加，不允许修改或删除已有条目。**
>
> 任何规格未定义、规格矛盾、或规格与实现冲突的情况，都必须在这里登记，
> **不允许自行猜测并固化到代码**。

---

## 格式

```yaml
id: OQ-001
question: <一句话说清问题>
where: <规格中的位置，如 spec/frozen.md §5.4>
why_it_matters: <不解决会怎样>
proposal: <你的建议方案，可空>
phase: phase0
blocking: true            # true = 停在受影响模块等裁决
                          # false = 记 TODO，继续其他不受影响的工作
owner: human
status: open              # open | answered | rejected
created_at: 2026-09-18
answered_at:
answer:
```

---

## 处理规则

```
blocking: true   → 停下等人工裁决，不要继续写受影响的代码
blocking: false  → 写 TODO 占位，继续其他工作

禁止：
    ❌ 自己挑一个方案实现并继续
    ❌ 在代码里留下"以后再改"的硬编码假设
    ❌ 修改本文件中已有的条目
```

目标 SLA：人工 24 小时内答复（项目管理目标，非程序机制）。

---

## 已知的开放项（开工前就存在）

以下几项在规格冻结时**已知但故意留给实现阶段决定**。
遇到时请开 OQ，不要自行决定：

| 主题 | 说明 |
|---|---|
| 实现语言/技术栈 | 规格未指定。SQLite FTS5 已定，但 Python / Node / 其他未定。**开工第一件事就是开 OQ 问这个。** |
| `task_type` / `characteristics` 的完整受控词表 | 规格给了示例，完整清单需在 Acquisition 之前定稿 |
| `environment_factor` 的 semver 映射细节 | 规格给了四档，具体比对规则（哪个字段算 major）需明确 |
| `stale` 的具体阈值 | 「超过 N 个任务未被命中」的 N 未定 |
| Semantic Gate judge 的具体模型与提示词 | 只定输出 schema，judge 选型未定 |
| Benchmark 30/15/30 个任务的实际编写 | 必须人工写，不能由开发 AI 生成 |

---

## 条目

（开发过程中追加于此）

```yaml
id: OQ-001
question: Phase 0 的实现语言/技术栈未定（SQLite FTS5 已定，但 Python / Node / 其他未定）；全部代码用什么语言与运行时实现？
where: spec/open-questions.md「已知的开放项」/ tasks/phase0.md §7 / spec/frozen.md §8.2
why_it_matters: 在此项裁决前无法开始任何编码；Telemetry、Store、Retrieval、Quality Gate、Subagent 的实现形态与依赖都取决于该选择。
proposal: >-
  候选一：TypeScript/Node —— DeepSeek Harness 本身是 npm/TS 包，
  在 Session 事件层订阅 tool/call / tool/result / session/event（T1）与同栈集成最直接，
  符合「复用 Harness，不另造 Runtime」；FTS5 需选一个 SQLite 绑定。
  候选二：Python 3 —— 标准库自带 sqlite3（含 FTS5），后续标定/统计脚本顺手；
  但需另行打通 Harness 事件流的消费方式（如读取 session 事件日志）。
  不擅自选定，请人工裁决。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: 人工裁决：TypeScript / Node.js。
```

```yaml
id: OQ-002
question: task_type / characteristics 的完整受控词表未定稿（规格只给了示例）；Phase 0 的 enum 校验与 dry-run 任务使用哪套词表？
where: spec/frozen.md §2.1（task_type / characteristics 标注「受控词表」）/ tasks/phase0.md §7
why_it_matters: >-
  Deterministic Quality Gate 的「enum 合法性」校验需要完整词表；
  dry-run 任务的 task_state 也必须填这两个字段。
  词表定稿明确要求在 Acquisition 之前完成。
proposal: >-
  在 Acquisition 之前由人工定稿完整清单并追加到规格；
  Phase 0 期间仅使用规格示例值（task_type: ui_upgrade/bugfix/refactor/data_layer/test/doc；
  characteristics: multi_page/multi_file/shared_state/new_module），
  校验代码按「词表可配置注入」实现，不把示例值硬编码固化为完整定义。
  是否接受该过渡方案请人工裁决。
phase: phase0
blocking: false
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: 人工裁决：接受过渡方案（Phase 0 用规格示例值；词表做成可配置注入；完整清单由人工在 Acquisition 前定稿）。
```

```yaml
id: OQ-003
question: environment_factor 的 semver 映射细节未定义——「哪个字段算 major」「tool_schema 小改」如何从版本号判定，均未给出比对规则。
where: spec/frozen.md §5.4（environment_factor 四档）/ spec/open-questions.md 已知开放项
why_it_matters: >-
  reliability_score = support_factor × conflict_factor × environment_factor，
  比对规则缺失时无法对「非同版本环境」给出可靠取值。
proposal: >-
  Phase 0 的 dry-run 全部运行在完全相同的环境（同 harness/tool_schema/framework 版本），
  按规格第一档「同 major，tool_schema 相同 → 1.0」判定即可，无需猜测；
  代码中对「非完全同版本」的比较显式抛出「OQ-003 未裁决」错误，不隐式假设任何映射。
  请人工给出完整映射规则（哪个版本字段算 major、tool_schema 小改的判定）。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-004
question: >-
  contraindication 命中判定的「structured_match(当前任务, 该禁忌) ≥ 0.60」自相矛盾/未定义：
  contraindications 是单个 characteristics 词表 token（§3.1），而 structured_match 需要
  task_type/complexity/characteristics/constraints 四项完整剖面（§5.3），无法把单个 token 代入。
where: spec/frozen.md §5.6（命中判定）与 §3.1（contraindications 受控词表，同 characteristics）
why_it_matters: >-
  contraindication_factor = 1 − matched_count/total_count 依赖 matched_count；
  按字面把 token 构造成伪剖面代入 structured_match 会出现数学上不可能达到 0.60 的矛盾，
  任何实现方式都只能靠猜。
proposal: >-
  把「命中」定义为：该 contraindication token 出现在当前任务的 characteristics（词表精确匹配），
  token 词表沿用 characteristics（§3.1 已定）；
  或由人工定义 token → 条件剖面的映射与专用匹配函数。请裁决，我不擅自选。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决：命中 ⇔ 该 contraindication token 出现在当前任务 characteristics（词表精确匹配）。
  实现为二值相似度（成员=1.0，非成员=0.0），冻结阈值 0.60 原样保留并作用于该相似度（语义等价，阈值未改）。
```

```yaml
id: OQ-005
question: Deterministic Quality Gate 的 duplicate 检测与 exact conflict 检测没有判定定义（比对哪些字段、何为「完全重复」、何为「直接矛盾」）。
where: spec/frozen.md §6.1（gate 清单）/ §4.1（→ conflict 迁移条件「检测到与现有经验直接矛盾」）
why_it_matters: 9 项 gate 检查中这 2 项无规则可实现，实现任何判定口径都是猜。
proposal: >-
  duplicate = 与库中某条在 (task_type, complexity, characteristics, constraints, decision,
  delegation.mode) 上完全相同且 lesson 相同；
  exact conflict = 前述结构化条件完全相同但 decision 不同或 outcome.success 相反。
  以上仅为建议口径，请人工裁决。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决（2026-09-27，原话要点）：
  duplicate = 两条 Experience 在 scope、task_type、complexity、characteristics、constraints、
  decision.action、decision.mode、delegation.agents、lesson 上完全一致，
  且规范化后内容一致（列表排序、大小写、空值已规范化）。
  exact conflict = 适用条件（scope、task_type、complexity、characteristics、constraints）完全一致，
  但出现以下任一：(a) decision.action 不同；(b) decision.mode 在同一 action 下发生互斥变化
  （例如 PARALLEL vs SERIAL）；(c) 在相同任务类型、相同适用条件、相同决策下，
  存在相同 success criteria 下的明确相反 outcome（一个通过，一个失败）→ 标记 exact_conflict。
  仅 lesson 不同、证据数量不同、reliability 不同，不构成 conflict。
  字段映射：decision.action ⇔ Experience.decision（§2.2 FirstDecision），
  decision.mode ⇔ Experience.delegation.mode（§3 serial|parallel|workflow），不新增字段。
```

```yaml
id: OQ-006
question: >-
  T7 的「5 个 Subagent」与 first_decision 的 7 个枚举值（DIRECT/EXPLORE/DELEGATE/PARALLEL/
  WORKFLOW/VERIFY/REPLAN）如何对应？5 个 Subagent 的角色与命名规格未给出
  （§3 示例中的 ui-designer/ui-reviewer 是示例数据，不是定义）。
where: tasks/phase0.md T7 / spec/frozen.md §2.2 / §9.1（A–E 五类）
why_it_matters: subagent_invocations[] 与 delegation.agents[] 都要记录 Subagent 身份；命名/职责不明就只能自造语义。
proposal: >-
  按 §9.1 五类任务配置 5 个 Subagent（覆盖七种决策的最小集合，例如
  explorer / builder / delegate-worker / parallel-worker / recovery-verifier），
  Phase 0 只保证「能被调用并记录」。命名与职责对应关系请人工确认后我再写。
phase: phase0
blocking: true
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer: 2026-09-27 交互记录：人工选择「人工给定名字与职责」，对应表待人工提供；在此之前 T7 agents/ 定义保持挂起，不自造命名。
```

```yaml
id: OQ-007
question: 5 个 dry-run 任务由谁编写？benchmark task YAML 明确「人工提前写，不得由开发 AI 临时解释」，dry-run 任务的编写责任未定义。
where: tasks/phase0.md §4.1、T10 / spec/frozen.md §9 / spec/experiment-design.md §10.2
why_it_matters: >-
  T10 验收需要 5 个任务（Dry-run ∩ Pilot = ∅）；且 §4.2 第 3/4 条要求 trajectory 中
  存在 failure 与 replan 事件可重建，任务设计必须能产生这两种事件。
proposal: >-
  请人工提供 5 个 dry-run 任务 YAML（含 success_criteria，并至少覆盖一次失败与一次 replan），
  或明确授权我编写「仅供 Phase 0 验收、绝不进入 Pilot」的合成 dry-run 任务。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决：授权开发 AI 编写合成 dry-run 任务，仅用于 Phase 0 数据链路验收，
  明确标注禁止进入 Pilot（Dry-run ∩ Pilot = ∅）；任务须至少覆盖一次 failure 与一次 replan。
```

```yaml
id: OQ-008
question: dry-run run 的 arm 字段取值是什么？arm 枚举 A|B|C_frozen|C_static|D_online 都是实验臂，dry-run 不属于任何臂，而禁止自造新 enum。
where: spec/frozen.md §8.1（arm 枚举）/ tasks/phase0.md §6.3（run 必录字段）
why_it_matters: arm 是 run 必录字段，直接影响 §4.2 第 1 条「trajectory schema coverage = 100%」。
proposal: 请人工裁决：dry-run 使用哪个既有值、留空/记 null 是否允许，或由人工扩充枚举并更新规格。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决：Phase 0 dry-run 的 run 记录 arm 字段存在但值为 null，附 OQ-008 标记；
  不改 enum、不造值，验收报告中明确报告此缺口。
```

```yaml
id: OQ-009
question: experiment_config_hash 的计算定义缺失——「experiment config」包含哪些内容、用什么序列化口径与哈希算法，规格均未定义。
where: spec/frozen.md §8.1 / spec/experiment-design.md §12、§10.3（只写「写入 experiment config」，无结构定义）
why_it_matters: run 必录字段，无定义则无法生成有意义的值；乱取口径会固化错误假设并破坏可复现性承诺。
proposal: >-
  请人工定义 experiment config 的内容清单（如检索权重、阈值 0.30、Top-K=5、160 tokens、
  lesson 60 字、P05/P95、arm 配置、版本号等）与哈希算法（如 SHA-256 over canonical JSON）；
  在定义前，代码不生成该字段的值。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决（2026-09-27，方案 3）：experiment_config_hash = SHA256(canonical_json(experiment_config))，
  前缀记作 "sha256:<hex>"。canonical JSON：UTF-8、对象 key 递归字典序、数组保持原序
  （语义无序的 vocabulary/enum 列表先字典序排序）、无空白、数字用 JSON 标准表示、
  时间戳/run_id/session_id/task_id/机器信息/随机种子/运行时 token/延迟/工具结果/轨迹数据
  /生成的经验记录一律不得进入 hash。
  experiment_config 必须包含 protocol（schema_version/experiment_version/decision/
  first_decision_enum/delegation_definition/cda_definition/action_change_definition/
  beneficial_action_change_definition）、thresholds（relevance 0.30/0.60/0.80、top_k=5、
  low_relevance_max=2、800/160 tokens、lesson 60 字、h2 0.10、h2-null ±0.05、power 0.80、
  planning_alpha 0.025）、retrieval、vocabulary、experience、experiments（五臂定义、
  formal 30/150、pilot 10×3、formal_repetitions 3、transfer 15）、statistical_protocol
  （primary_metric=CDA、primary_tests、holm_correction、permutation_test_definition、
  h2_null_method=TOST、h2_null_confidence_level=90%、h3/d_online=exploratory）。
  harness_version / tool_schema_version / framework_version 作为 experiment config 的固定
  protocol/environment compatibility 字段另行记录，值变化 → 生成新的 experiment_config_hash。
  生成时机：SNAPSHOT_01 → BM25 calibration → experiment_config_hash；正式 run 必记
  experiment_config_hash + experience_snapshot_id；运行时 hash 不一致 → CONFIG_MISMATCH →
  禁止进入正式统计。experiment_config_hash 与 experience_snapshot_id 分工：
  前者「实验规则是什么」，后者「用了哪一版经验」。
```

```yaml
id: OQ-010
question: >-
  Task State 的捕获机制与「不解析最终聊天文本」（T1）的边界：task_state 由主 Agent 首轮「顺带输出」，
  若它出现在首轮 assistant 消息中，代码提取该结构化 JSON 是否算「解析聊天文本」？
where: tasks/phase0.md T1、T3 / spec/frozen.md §2（首轮顺带输出）、§2.2（代码直接读取）
why_it_matters: >-
  捕获机制决定 first_decision 的来源通道。规格禁止的是「事后让 LLM 从轨迹猜」与
  「从聊天文本重建轨迹」；但 task_state 作为结构化输出如何进入事件层没有写明。
proposal: >-
  只在「首轮 assistant 消息事件」中做严格的 JSON 代码块提取 + JSON Schema 校验（纯确定性代码，
  无 LLM 参与），first_decision 仅取自校验通过的 task_state 对象；
  不从任何自然语言推理，不解析后续消息，不用 LLM 补全或猜测。
  若人工认为这仍违反「不解析最终聊天文本」，请指定替代通道（如专用结构化事件）。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-011
question: token 计数口径未定义——「单条 Experience ≤ 160 tokens」「总 Experience Context ≤ 800 tokens」用哪个 tokenizer 计数？
where: spec/frozen.md §5.7 / tasks/phase0.md 硬约束 3
why_it_matters: 预算约束是冻结阈值，但没有计数口径就无法判定是否超限；乱用 tokenizer 会得到不同的截断结果。
proposal: >-
  请人工指定计数器（如目标模型的官方 tokenizer，或字符近似公式）。
  在裁决前，序列化器使用显式标注的占位估算器（CJK 1 字/字、其余 4 字符/token），
  并在输出中标注「OQ-011 占位」，不把占位口径当作最终规则。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-012
question: >-
  Deterministic Gate 的「task_id 存在」与「version 字段存在」两项检查对象不明：
  §3 Experience schema 里既没有 task_id 字段也没有顶层 version 字段，
  「version 字段」指哪个（schema_version？evidence 里的三个版本字段？）未定义。
where: spec/frozen.md §6.1 与 §3（Experience schema 字段清单）
why_it_matters: gate 的 9 项检查中这 2 项无法确定检查对象；按经验记录查则字段不存在，按 provenance 链查则需要新定义。
proposal: >-
  建议：「task_id 存在」检查 evidence.run_id → run 记录 → task_id 非空；
  「version 字段存在」检查 evidence.harness_version / tool_schema_version / framework_version 三者非空。
  请人工裁决，或给出应写入 Experience schema 的字段定义（需人工改规格）。
phase: phase0
blocking: true
owner: human
status: answered
created_at: 2026-09-27
answered_at: 2026-09-27
answer: >-
  人工裁决（2026-09-27，原话要点）：task_id 与 version 不是 Experience 本身的字段，
  Experience 是「知识」，Trajectory 才是「事实证据」。
  task_id 检查：Experience.evidence → run_id → Trajectory record → task_id，
  必须存在且可沿证据链解析，否则 Deterministic Gate 失败。
  version 检查：evidence → run_id → Trajectory metadata，检查 harness_version /
  tool_schema_version / framework_version 三字段，三者都必须存在且为合法非空字符串，
  否则 Deterministic Gate 失败。环境兼容性判断统一使用这些版本字段，
  不从 lesson、scope 或其他自然语言字段推断。
```

```yaml
id: OQ-013
question: BM25 标定的 P05/P95 百分位算法未定义（最近秩 / 线性插值 / 其他），会直接影响冻结的标定数值。
where: spec/frozen.md §5.5（lexical_match 与 P05/P95 FREEZE）
why_it_matters: Phase 0 允许占位常数、标定在 Phase 1 的 SNAPSHOT_01 上跑，但标定代码路径现在就要存在；百分位口径不同会得到不同的 P05/P95。
proposal: >-
  标定代码把百分位计算做成显式参数、不设默认值，运行正式标定前由人工指定口径；
  Phase 0 使用占位常数（代码中标注「占位，未标定」）。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-014
question: >-
  Eligibility Filter 中 task.scope 与 experience.scope 的组合规则未定义：
  §5.2 只写了「scope=project → 只在同项目内检索；scope=generic → 可跨项目」，
  但两侧都有 scope 字段（§2.1 与 §3），跨项目时如何组合未说明。
where: spec/frozen.md §5.2 / §2.1 / §3
why_it_matters: 跨项目检索的硬过滤规则决定哪些经验进入候选；组合规则缺失时无法实现跨项目情形。
proposal: >-
  建议：候选经验 scope=project ⇒ 仅同项目任务可检索到；
  跨项目候选仅当经验与任务双方 scope=generic 才可进入（其余组合按不可进入处理）。
  代码目前只实现无歧义部分（同项目 → 通过；经验 scope=project 且跨项目 → 拒绝），
  其余组合显式抛错。请人工裁决完整规则。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-015
question: >-
  T1「在 Harness Session 事件层订阅 tool/call、tool/result、session/event」的接入方式请确认：
  Phase 0 拟消费 Harness 会话事件日志（同一 typed 事件流：逐条 SessionEvent，含 tool/call、tool/result，
  按 callId 配对；支持离线整读与增量 tail），而不是在 DSH 进程内挂 cordis 插件。
where: tasks/phase0.md T1 / spec/frozen.md §8
why_it_matters: >-
  调研证实 DSH 的事件层正规订阅点是 cordis 'session/event' firehose（进程内插件），
  外部消费同一事件流的途径是会话事件日志（session.v3.jsonl.zstd）或 SDK JSON-RPC 流。
  三者拿到的事件相同，但「订阅」的字面实现不同。
proposal: >-
  Phase 0 的 Event Collector 以会话事件日志为数据源（typed 事件，绝不解析聊天文本），
  并把接口设计成可替换事件源（离线整读 / 增量 tail / 进程内 cordis 插件 / SDK 流）。
  进程内插件需要改动你的 DSH profile，Phase 0 不动你的运行环境。
  若你认为必须用进程内插件才满足「订阅」，请指定挂载方式，我再补适配器。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-016
question: >-
  run 记录的 harness_version / tool_schema_version / framework_version / model_id 取值来源未定义，
  且调研证实 Harness 事件流中没有 harness_version、没有 tool_schema_version 概念
  （ToolSchema{name,description,parameters} 无 version 字段）。
where: spec/frozen.md §8.1、§5.4（environment_factor 用到 tool_schema 比对）/ spec/experiment-design.md §12
why_it_matters: >-
  这是 run 必录字段（§4.2 schema coverage 100% 要求存在）；
  tool_schema_version 还参与 §5.4 environment_factor 的「tool_schema 相同/小改」判定，
  无定义则环境比较也无从谈起（与 OQ-003 相关）。
proposal: >-
  harness_version ← @deepseek-ai/dsh 发布版本（当前 0.1.5-rc.3）；
  framework_version ← experience-agent-v1 框架版本（1.0）；
  model_id ← 会话事件 assistant/message.source.model（无歧义）；
  tool_schema_version ← 无来源，建议人工定义（例如 request/header.tools 工具清单快照的
  稳定哈希前 8 位，或人工指定整数版本并随规格冻结）。
  在裁决前 tool_schema_version 记 null + OQ-016 标记，其余三项按上述来源生成并在验收报告中列明。
phase: phase0
blocking: true
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```

```yaml
id: OQ-017
question: stale 的具体阈值未定——「超过 N 个任务未被命中，或环境版本变化」中的 N 未定义（规格已知开放项）。
where: spec/frozen.md §4.1（→ stale 迁移条件）/ spec/open-questions.md 已知开放项
why_it_matters: >-
  OQ-009 裁决要求 experiment_config.experience.stale_rule 写入配置并进哈希；
  N 未定则该字段只能记录「N 未定」，Phase 1 冻结 config 前必须定稿。
  Phase 0 不执行生命周期自动迁移，故不阻塞 Phase 0 代码路径。
proposal: 请人工给出 N（或给出 stale 判定的完整规则）；在裁决前 stale_rule 记录规格原文并标注「N 未定」。
phase: phase0
blocking: false
owner: human
status: open
created_at: 2026-09-27
answered_at:
answer:
```
