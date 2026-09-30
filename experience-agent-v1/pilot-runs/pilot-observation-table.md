# Pilot observation 主表（28 行 · 只记录事实）

> 口径：`evidence_status` 依据 **Agent-exit 指纹 + 环境/判定字段** 是否齐备；
> `retrieved_experiences` 在记录卡中的缺失属**记录层缺口**（轨迹为权威），单列 `rcpt_ret`，不据此判为证据不完整。
> `pair_eligible` 与 `valid` 严格分开：证据不完整的 observation 仍计 valid，但不进配对分析。

| group | arm | first_decision | expected | CDA | mode_hit | TaskOK | snapshot | Policy | refl | rcpt_ret | retrieved | ctx_tokens | elapsed_ms | tokens | fingerprint | evidence | pair_elig |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PILOT-A01 | B | DIRECT | DIRECT | 1 | true | true | none | 1 | false | N | 0 | 0 | 9528 | 30591 | f610be80 | ok | true |
| PILOT-A02 | B | DIRECT | DIRECT|EXPLORE | 1 | true | true | none | 1 | false | N | 0 | 0 | 10606 | 49295 | 9a7f9c18 | INCOMPLETE | true |
| PILOT-A02 | C_frozen | DIRECT | DIRECT|EXPLORE | 1 | true | null | SNAPSHOT_01 | 1 | false | Y | 0 | 0 | 11885 | 48618 | e1d14248 | ok | true |
| PILOT-A02 | A | EXPLORE | DIRECT|EXPLORE | 1 | true | null | none | 0 | false | Y | 0 | 0 | 8735 | 30030 | 24ae7a3c | ok | true |
| PILOT-B01 | A | EXPLORE | EXPLORE | 1 | true | null | none | 0 | false | Y | 0 | 0 | 17641 | 59332 | 1ae395ae | ok | true |
| PILOT-B01 | C_frozen | EXPLORE | EXPLORE | 1 | true | null | SNAPSHOT_01 | 1 | false | N | 1(EXP-DRY-DOC-EXPLORE) | 48 | 16775 | 53362 | MISSING | INCOMPLETE | false |
| PILOT-B01 | B | EXPLORE | EXPLORE | 1 | true | true | none | 1 | false | N | 0 | 0 | 11248 | 41444 | 38953f84 | ok | true |
| PILOT-B02 | C_frozen | EXPLORE | EXPLORE | 1 | true | true | SNAPSHOT_01 | 1 | false | N | 0 | 0 | 16404 | 45937 | 49163627 | ok | true |
| PILOT-B02 | B | EXPLORE | EXPLORE | 1 | true | true | none | 1 | false | N | 0 | 0 | 30623 | 61515 | 57725f4b | ok | true |
| PILOT-B02 | A | EXPLORE | EXPLORE | 1 | true | true | none | 0 | false | N | 0 | 0 | 19597 | 55777 | 1a79d686 | ok | true |
| PILOT-C01 | A | EXPLORE | DELEGATE|PARALLEL|WORKFLOW | 0 | false | true | none | 0 | false | N | 0 | 0 | 273969 | 2031122 | 5535e978 | ok | true |
| PILOT-C01 | C_frozen | WORKFLOW | DELEGATE|PARALLEL|WORKFLOW | 1 | true | true | SNAPSHOT_01 | 1 | false | N | 1(EXP-DRY-UI-DELEGATE) | 49 | 71667 | 174719 | 327f91b3 | ok | true |
| PILOT-C01 | B | VERIFY | DELEGATE|PARALLEL|WORKFLOW | 0 | false | true | none | 1 | false | N | 0 | 0 | 43652 | 98792 | cb8cf2a1 | ok | true |
| PILOT-C02 | C_frozen | VERIFY | DELEGATE|PARALLEL|WORKFLOW | 0 | false | true | SNAPSHOT_01 | 1 | false | Y | 0 | 0 | 46782 | 130645 | 3e7e5673 | ok | true |
| PILOT-C02 | A | EXPLORE | DELEGATE|PARALLEL|WORKFLOW | 0 | false | true | none | 0 | false | N | 0 | 0 | 32484 | 115867 | 068265fc | ok | true |
| PILOT-C02 | B | VERIFY | DELEGATE|PARALLEL|WORKFLOW | 0 | false | true | none | 1 | false | Y | 0 | 0 | 45803 | 160763 | f0908dbe | ok | true |
| PILOT-D01 | B | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | none | 1 | false | Y | 0 | 0 | 33064 | 132051 | d5b0489d | ok | true |
| PILOT-D01 | A | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | none | 0 | false | Y | 0 | 0 | 28981 | 76704 | 71b1796f | ok | true |
| PILOT-D01 | C_frozen | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | SNAPSHOT_01 | 1 | false | Y | 1(EXP-DRY-DOC-EXPLORE) | 48 | 37847 | 164118 | f9b5b152 | ok | true |
| PILOT-D02 | C_frozen | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | SNAPSHOT_01 | 1 | false | Y | 0 | 0 | 45232 | 200126 | f92ed0ba | ok | true |
| PILOT-D02 | B | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | none | 1 | false | Y | 0 | 0 | 51918 | 256482 | a9229398 | ok | true |
| PILOT-D02 | A | PARALLEL | PARALLEL|WORKFLOW | 1 | true | true | none | 0 | false | Y | 0 | 0 | 69732 | 468694 | 158d9ecd | ok | true |
| PILOT-E01 | B | REPLAN | REPLAN | 1 | true | true | none | 1 | false | Y | 0 | 0 | 40721 | 371865 | 9c06614d | ok | true |
| PILOT-E01 | A | EXPLORE | REPLAN | 1 | false | true | none | 0 | false | Y | 0 | 0 | 14487 | 98312 | 9c06614d | ok | true |
| PILOT-E01 | C_frozen | REPLAN | REPLAN | 1 | true | true | SNAPSHOT_01 | 1 | false | Y | 0 | 0 | 18641 | 186987 | 9c06614d | ok | true |
| PILOT-E02 | C_frozen | REPLAN | REPLAN | 1 | true | true | SNAPSHOT_01 | 1 | false | Y | 0 | 0 | 13460 | 123192 | 8a2a1c33 | ok | true |
| PILOT-E02 | A | EXPLORE | REPLAN | 1 | false | true | none | 0 | false | Y | 0 | 0 | 41167 | 409715 | 55032b27 | ok | true |
| PILOT-E02 | B | REPLAN | REPLAN | 1 | true | true | none | 1 | false | Y | 0 | 0 | 17812 | 75950 | 69eefe2f | ok | true |
