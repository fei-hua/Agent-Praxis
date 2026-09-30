/**
 * tests/json-bom.test.ts — BOM 读写回归（纯代码）
 *
 * 人工要求（2026-09-27）：BOM JSON → 可读取；重写后 → JSON.parse 正常。
 * 实测触发场景：PowerShell `Set-Content -Encoding utf8` 写出的 JSON 带 BOM，
 * JSON.parse 直接抛 `Unexpected token ''`，导致 cell-dispositions 更新中断。
 */

import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readJsonUtf8, stripBom, writeJsonUtf8 } from '../scripts/lib/json-io.ts';

test('stripBom：有 BOM 去掉，无 BOM 原样', () => {
  assert.equal(stripBom('\uFEFF{"a":1}'), '{"a":1}');
  assert.equal(stripBom('{"a":1}'), '{"a":1}');
});

test('带 BOM 的 JSON 文件必须能读（原生 JSON.parse 会失败的形态）', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bom-test-'));
  const f = path.join(dir, 'with-bom.json');
  writeFileSync(f, '\uFEFF{"cells":{"A":{"status":"EXCLUDED"}}}', 'utf8');

  // 原生路径确实会失败（证明这个回归测试有意义）
  assert.throws(() => JSON.parse(readFileSync(f, 'utf8')));

  const parsed = readJsonUtf8<{ cells: Record<string, { status: string }> }>(f);
  assert.equal(parsed.cells['A']!.status, 'EXCLUDED');
});

test('writeJsonUtf8：写回无 BOM，且能再次 JSON.parse（往返一致）', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bom-test-'));
  const f = path.join(dir, 'roundtrip.json');
  const value = { dataset: 'pilot_dry_execution', planned_cells: 30, cells: { 'X|R1|A': { counted: false } } };

  writeJsonUtf8(f, value);

  const raw = readFileSync(f, 'utf8');
  assert.equal(raw.charCodeAt(0) === 0xfeff, false, '写回不得带 BOM');
  assert.deepEqual(JSON.parse(raw), value, '无 BOM 时原生 JSON.parse 必须直接成功');
  assert.deepEqual(readJsonUtf8(f), value);
  assert.ok(raw.endsWith('\n'), '结尾应有换行');
});
