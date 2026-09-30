# Pilot 配对差异 / paired SD（冻结口径：evidence-eligible 集，不插补）

## CDA（B − A，二元）

- eligible_pairs = 9，usable_pairs = 9
- B>A = 0（0.0%）
- B=A = 9（100.0%）
- B<A = 0（0.0%）


## CDA（C_frozen − B，二元）

- eligible_pairs = 8，usable_pairs = 8
- C_frozen>B = 1（12.5%）
- C_frozen=B = 7（87.5%）
- C_frozen<B = 0（0.0%）


## Task Success（B − A，二元）

- eligible_pairs = 9，usable_pairs = 7
- B>A = 0（0.0%）
- B=A = 7（100.0%）
- B<A = 0（0.0%）
- 剔除（不插补）：PILOT-A02（A 侧无记录）, PILOT-B01（A 侧无记录）

## Task Success（C_frozen − B，二元）

- eligible_pairs = 8，usable_pairs = 7
- C_frozen>B = 0（0.0%）
- C_frozen=B = 7（100.0%）
- C_frozen<B = 0（0.0%）
- 剔除（不插补）：PILOT-A02（C_frozen 侧无记录）

## elapsed_ms（B − A，连续）

- eligible_pairs = 9，usable_pairs = 9
- difference mean = -24594.0
- paired SD = 78671.1
- 95% CI = [-85065.9, 35877.9]（t=2.306, df=8）


## elapsed_ms（C_frozen − B，连续）

- eligible_pairs = 8，usable_pairs = 8
- difference mean = -1535.1
- paired SD = 14855.5
- 95% CI = [-13956.6, 10886.4]（t=2.365, df=7）


## tokens（B − A，连续）

- eligible_pairs = 9，usable_pairs = 9
- difference mean = -233044.0
- paired SD = 659751.9
- 95% CI = [-740173.3, 274085.3]（t=2.306, df=8）


## tokens（C_frozen − B，连续）

- eligible_pairs = 8，usable_pairs = 8
- difference mean = -16546.4
- paired SD = 80481.5
- 95% CI = [-83841.2, 50748.5]（t=2.365, df=7）



> 注：二元量只报方向/计数；Power Analysis 若以 CDA 为主要指标，须按二元检验单独定样本量，不得套用连续量的 paired SD。
