# INVALID_PREPARED_PLAN（旧预运行 bundle，保留以备审计）

保留时间：2026-09-28T17:23:43.752Z

原因：这批 plan 在 prepare 阶段**未绑定参考会话**，因此其声明 manifest 为：
```
tool_schema_version    = UNVERIFIED_AT_PLAN_TIME   （占位符）
experiment_config_hash = 由该占位符派生              （与运行时永不相等）
```
⇒ 采集期 manifest 门禁必然 CONFIG_MISMATCH。属**预运行配置无效**，不是实验内容变化。

旧文件数：133；SHA-256 记录见 ../plans-rematerialized.json
