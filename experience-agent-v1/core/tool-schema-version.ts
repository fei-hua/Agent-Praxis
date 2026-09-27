/**
 * core/tool-schema-version.ts — tool_schema_version（OQ-016 人工裁决 2026-09-27）
 *
 * 裁决：不从单一 npm package version 读取，而从运行时最终暴露给模型的
 * model-facing ToolSchema[] 自动生成：
 *   (1) 获取当前 Session/Agent 实际允许使用的完整 ToolSchema[]；
 *   (2) 对工具按 name 字典序排序；
 *   (3) 对每个 ToolSchema 的模型可见字段做 canonical JSON 序列化；
 *   (4) JSON 使用 UTF-8、递归 key 排序、无空白；
 *   (5) 对 canonical JSON 计算 SHA-256；
 *   (6) tool_schema_version = "tschema-" + SHA256 前 12 位（例：tschema-a81f3c7e92bd）。
 *
 * 该值在 Run 启动时确定，写入 trajectory metadata。
 * 不得手工维护，不得从自然语言 description 推断，不得使用单独的 package version 替代。
 * 同一组 model-facing ToolSchema 必须得到完全相同的 tool_schema_version；
 * 任意工具名称、参数 schema、必填字段、枚举或模型可见 description 发生变化时，应得到新的 version。
 *
 * 模型可见字段 = ToolSchema 的 {name, description, parameters}
 * （调研实证：dsh-llm ToolSchema = {name, description, parameters(JSON Schema)}，
 *   工具注册表生成 ToolSchema[] 发给模型）。
 */

import { createHash } from 'node:crypto';
import { canonicalJson, type JsonValue } from './canonical-json.ts';

export interface ModelVisibleToolSchema {
  name: string;
  description: string;
  parameters: JsonValue;
}

/** 从原始请求快照（request/header.data.header.tools）提取模型可见 ToolSchema */
export function toModelVisibleSchemas(rawTools: unknown): ModelVisibleToolSchema[] {
  if (!Array.isArray(rawTools)) {
    throw new Error('ToolSchema[] 快照不是数组，无法解析');
  }
  return rawTools.map((t) => {
    const o = t as Record<string, unknown>;
    if (typeof o['name'] !== 'string') throw new Error('ToolSchema 缺少 name');
    return {
      name: o['name'],
      description: typeof o['description'] === 'string' ? o['description'] : '',
      parameters: (o['parameters'] ?? {}) as JsonValue,
    };
  });
}

/**
 * OQ-016 裁决：tool_schema_version = "tschema-" + SHA256(canonical JSON) 前 12 位。
 * 输入按 name 字典序排序；canonical JSON 由 core/canonical-json.ts 保证
 * （UTF-8、递归 key 排序、无空白）。
 */
export function computeToolSchemaVersion(schemas: ModelVisibleToolSchema[]): string {
  if (schemas.length === 0) {
    throw new Error('ToolSchema[] 为空，无法计算 tool_schema_version');
  }
  const sorted = [...schemas].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const canonical = canonicalJson(sorted as unknown as JsonValue);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `tschema-${digest.slice(0, 12)}`;
}
