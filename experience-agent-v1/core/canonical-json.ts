/**
 * core/canonical-json.ts — canonical JSON（OQ-009 人工裁决，2026-09-27）
 *
 * 规则（逐条来自裁决）：
 *   - UTF-8 编码
 *   - JSON 对象 key 按字典序递归排序
 *   - 数组保持原定义顺序；语义上无序的 vocabulary / enum 列表先按字典序排序后再写入
 *     （排序在 experiment-config 构建阶段完成，本序列化器只保序输出）
 *   - 不使用空白、缩进或换行
 *   - 布尔值使用 JSON true/false；空值使用 null
 *   - 数字使用 JSON 标准表示，不写单位字符串
 *   - 时间戳、run_id、随机种子、机器 ID、日志路径等运行时字段不得进入
 *     experiment config hash（由 config 构建方保证不放入）
 *
 * 注：key 字典序 = UTF-16 code unit 序（ASCII snake_case key 下与字典序一致）。
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** 输出 canonical JSON 字符串（紧凑、key 递归字典序、数组保序） */
export function canonicalJson(value: JsonValue): string {
  return serialize(value);
}

function serialize(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`canonical JSON 不允许非有限数字：${value}`);
    return JSON.stringify(value); // JSON 标准表示
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(serialize).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + serialize(value[k]!)).join(',') + '}';
}
