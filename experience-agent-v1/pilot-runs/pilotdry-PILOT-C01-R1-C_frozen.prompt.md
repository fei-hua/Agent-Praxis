# Frozen Delegation Policy（B 臂，已冻结）

B = DeepSeek V4.1 + DeepSeek Harness + Frozen Delegation Policy

按以下优先级确定 first_decision（自上而下，先命中先定）：

1. REPLAN：已有失败状态，需要重新规划
2. VERIFY：任务主要目标是验证/测试/审计已有结果
3. WORKFLOW：任务包含多个存在明确先后依赖的阶段
4. PARALLEL：存在两个或以上相互独立且适合委派的子任务
5. DELEGATE：存在明确的专业分工、独立分析或单个可委派子任务
6. EXPLORE：项目结构、调用关系、数据流或影响范围尚不明确，需要先探索
7. DIRECT：任务局部、范围明确、信息充分，且不满足以上条件

运行约束：
- 不读取 Experience Store
- 不使用 Reflection 产生的经验
- 不在线更新 Policy
- 不根据历史轨迹修改规则
- 可以正常使用 Harness Tool / Subagent / Workflow

# Frozen Action Experience（只读 SNAPSHOT_01）

以下经验来自冻结快照，仅供决策参考；不得因为经验存在而跳过验证。

[EXP-DRY-UI-DELEGATE]
task_type: ui_upgrade
characteristics: multi_page
decision: DELEGATE
lesson: 间距升级委派 ui-reviewer 做越界审查
contraindications: 
reliability: 0.78

## 任务

工作区：仓库根为 `D:\Agent Praxis\experience-agent-v1`，任务中的相对路径均相对该目录。

对 pilot-workspace/PILOT-C01/ui/ 下的样式做无障碍审查并修订：
1. 审查范围：对比度、焦点可见性、aria 标注与命中区大小；
2. 按审查结论修订 ui/a11y.css（不得改类名与选择器结构）；
3. 把审查结论整理为 pilot-workspace/PILOT-C01/a11y-review.md，至少列出 3 条无障碍风险（每条含"风险"字样）。
验收脚本 pilot-workspace/PILOT-C01/verify-a11y.js 必须通过。

## 输出协议（必须遵守，且只在本条要求下输出该 JSON）

在你的**第一条回复**里，先输出一个 ```json 代码块，内容为 task_state envelope：

```json
{
  "schema_version": "1.0",
  "task_state": {
  "task_type": "<逐字选自：ui_upgrade | bugfix | refactor | data_layer | test | doc>",
    "complexity": "<逐字选自：simple | medium | high>",
    "characteristics": ["<逐字选自：multi_page | multi_file | shared_state | new_module（可为空数组）>"],
    "scope": "<逐字选自：project | generic>",
    "constraints": ["<逐字选自：routing_immutable | data_schema_immutable | api_immutable | scope_limited | no_new_dependency | no_public_interface_change（可为空数组）>"],
    "first_decision": "<逐字选自：DIRECT | EXPLORE | DELEGATE | PARALLEL | WORKFLOW | VERIFY | REPLAN>"
  }
}
```

取值规则（硬性）：
- 所有字段的值必须**逐字选自上面列出的取值**；不得自创 token、不得改写、不得拼接或扩展枚举值；
- `task_state` 的六个字段缺一不可；
- `first_decision` 必须是你**第一次决策**时真正选择的动作，之后不得回改该 JSON 块；
- 该 JSON 块只记录你的判断，不作为行为指令（协议不规定你应该选哪个值）。

随后再开始执行任务本身。
