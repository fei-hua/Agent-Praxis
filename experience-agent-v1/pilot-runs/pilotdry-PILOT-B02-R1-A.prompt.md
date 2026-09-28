## 任务

工作区：仓库根为 `D:\Agent Praxis\experience-agent-v1`，任务中的相对路径均相对该目录。

pilot-workspace/PILOT-B02/shared/ 提供多个导出函数，其中只有一部分被 widget.js 使用。
请确定「widget.js 直接使用」与「经其他模块间接使用」的导出函数集合，
写入 pilot-workspace/PILOT-B02/impact.md，格式要求：
- 小节 "## direct" 下列出直接使用的导出函数名（每行一个）
- 小节 "## indirect" 下列出间接使用的导出函数名（每行一个）
只允许新增 impact.md；shared/ 与 widget.js 不得修改。

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
