/**
 * tests/dsh-resolver.test.ts — 版本解析的反例测试（人工要求 2026-09-29）
 *
 * 必须覆盖：
 *   A. 声明版本存在且探测一致 → RESOLVED
 *   B. 声明 0.1.7 但 binary 自报 0.2.0 → VERSION_MISMATCH（不得放行）
 *   C. 声明版本不存在 → NOT_FOUND（并列出本机可用版本）
 *   D. 目录不可读 → RESOLVER_ERROR（**不得**降级成 NOT_FOUND）
 */

import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveDshBinary } from '../scripts/lib/dsh-resolver.ts';

/** 造一个假的 npx 缓存：<base>/<dir>/node_modules/@deepseek-ai/dsh/{package.json,lib/bin.js} */
function fakeInstall(base: string, dir: string, version: string): string {
  const root = path.join(base, dir, 'node_modules', '@deepseek-ai', 'dsh');
  mkdirSync(path.join(root, 'lib'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version }), 'utf8');
  const bin = path.join(root, 'lib', 'bin.js');
  writeFileSync(bin, '// fake\n', 'utf8');
  return bin;
}

test('A. 声明版本存在且探测一致 → RESOLVED', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-res-'));
  const bin = fakeInstall(base, 'aaa', '0.1.7-rc.2');
  fakeInstall(base, 'bbb', '0.2.0-rc.2');

  const r = resolveDshBinary('0.1.7-rc.2', { baseDir: base, probe: (b) => (b === bin ? '0.1.7-rc.2' : '0.2.0-rc.2') });
  assert.equal(r.status, 'RESOLVED');
  if (r.status === 'RESOLVED') {
    assert.equal(r.resolvedVersion, '0.1.7-rc.2');
    assert.equal(r.binaryPath, bin, '必须解析到 exact binary，而不是"最新那个"');
    assert.deepEqual(r.available.sort(), ['0.1.7-rc.2', '0.2.0-rc.2']);
  }
});

test('B. 声明 0.1.7 但 binary 自报 0.2.0 → VERSION_MISMATCH（不得放行）', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-res-'));
  fakeInstall(base, 'aaa', '0.1.7-rc.2');
  const r = resolveDshBinary('0.1.7-rc.2', { baseDir: base, probe: () => '0.2.0-rc.2' });
  assert.equal(r.status, 'VERSION_MISMATCH');
  if (r.status === 'VERSION_MISMATCH') assert.equal(r.probedVersion, '0.2.0-rc.2');
});

test('C. 声明版本不存在 → NOT_FOUND（并列出可用版本）', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-res-'));
  fakeInstall(base, 'aaa', '0.2.0-rc.2');
  const r = resolveDshBinary('0.1.7-rc.2', { baseDir: base, probe: () => '0.2.0-rc.2' });
  assert.equal(r.status, 'NOT_FOUND');
  if (r.status === 'NOT_FOUND') assert.deepEqual(r.available, ['0.2.0-rc.2']);
});

test('D. 目录不可读 → RESOLVER_ERROR（不得降级成 NOT_FOUND）', () => {
  const r = resolveDshBinary('0.1.7-rc.2', { baseDir: path.join(tmpdir(), 'definitely-missing-dir-xyz'), probe: () => '0.1.7-rc.2' });
  assert.equal(r.status, 'RESOLVER_ERROR');
  if (r.status === 'RESOLVER_ERROR') assert.match(r.message, /无法读取安装目录/);
});

test('E. package.json 损坏 → RESOLVER_ERROR（不静默跳过）', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'dsh-res-'));
  const root = path.join(base, 'aaa', 'node_modules', '@deepseek-ai', 'dsh');
  mkdirSync(path.join(root, 'lib'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{ not json', 'utf8');
  writeFileSync(path.join(root, 'lib', 'bin.js'), '// fake\n', 'utf8');
  const r = resolveDshBinary('0.1.7-rc.2', { baseDir: base, probe: () => '0.1.7-rc.2' });
  assert.equal(r.status, 'RESOLVER_ERROR');
});
