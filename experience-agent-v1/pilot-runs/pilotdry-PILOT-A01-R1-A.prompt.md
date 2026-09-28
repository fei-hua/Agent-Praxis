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
