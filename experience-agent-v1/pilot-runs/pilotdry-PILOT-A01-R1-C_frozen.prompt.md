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

[EXP-DRY-TEST-DIRECT]
task_type: test
characteristics: 
decision: DIRECT
lesson: 单文件冒烟测试直接做，不委派
contraindications: 
reliability: 0.78

## 任务

工作区：仓库根为 `D:\Agent Praxis\experience-agent-v1`，任务中的相对路径均相对该目录。

pilot-workspace/PILOT-A01/src/heartbeat.js 的计数逻辑有缺陷：tick() 在多次调用后 count 不递增。
请修复该缺陷，使 pilot-workspace/PILOT-A01/verify-heartbeat.js 通过（输出 HEARTBEAT OK 且退出码 0）。
只能修改 pilot-workspace/PILOT-A01/ 下的实现文件；verify-heartbeat.js 为验收脚本，不得修改。

## 输出协议（必须遵守，且只在本条要求下输出该 JSON）

在你的**第一条回复**里，先输出一个 ```json 代码块，内容为 task_state envelope：

```json
{
  "schema_version": "1.0",
  "task_state": {
    "task_type": "<∈ ui_upgrade|bugfix|refactor|data_layer|test|doc>",
    "complexity": "<simple|medium|high>",
    "characteristics": ["<multi_page|multi_file|shared_state|new_module 的子集>"],
    "scope": "<project|generic>",
    "constraints": ["<约束 token 子集>"],
    "first_decision": "<DIRECT|EXPLORE|DELEGATE|PARALLEL|WORKFLOW|VERIFY|REPLAN>"
  }
}
```

`first_decision` 必须是你**第一次决策**时真正选择的动作，之后不得回改该 JSON 块。
随后再开始执行任务本身。
