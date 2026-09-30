/**
 * scripts/lib/json-io.ts — BOM 安全的 JSON 读写
 *
 * 背景：本机 PowerShell 的 `Set-Content -Encoding utf8` 会写入 UTF-8 **BOM**，
 * 而 `JSON.parse` 遇到 BOM 会抛 `Unexpected token ''`（实测：cell-dispositions.json 曾因此读取失败）。
 * 这类失败属于工具健壮性问题，不应变成"看起来像数据损坏"的实验事故。
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** 去掉 UTF-8 BOM（若存在） */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** 读取 JSON（容忍 BOM） */
export function readJsonUtf8<T = unknown>(file: string): T {
  return JSON.parse(stripBom(readFileSync(file, 'utf8'))) as T;
}

/** 写回 JSON：UTF-8、无 BOM、结尾换行 */
export function writeJsonUtf8(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8' });
}
