/**
 * tests/workspace-fingerprint.test.ts — Agent-exit 指纹门禁的纯代码自测（人工要求 2026-09-27）
 *
 * 覆盖：
 *   A. 正常退出后 fingerprint 可记录（文件清单 + SHA-256 + 时间）
 *   B. 人为修改 workspace → 门禁拒绝（repair 必须 COLLECTION_ERROR）
 *   C. 恢复到 recorded fingerprint → 门禁放行
 *   D. 工具产物（judge-….json / seed-hashes.json / 临时 txt）不进入指纹，避免把工具写文件误判为产物被改
 */

import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { captureWorkspaceFingerprint, fingerprintDiff, fingerprintMatches } from '../scripts/lib/workspace-fingerprint.ts';

/** 造一个最小"workspace"：两个任务产物 + 三个工具产物 */
function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'ws-fp-'));
  mkdirSync(path.join(dir, 'TASK', 'src'), { recursive: true });
  writeFileSync(path.join(dir, 'TASK', 'src', 'a.js'), 'module.exports = { a: 1 };\n', 'utf8');
  writeFileSync(path.join(dir, 'TASK', 'verify.js'), 'console.log("OK");\n', 'utf8');
  // 工具产物（应被排除）
  writeFileSync(path.join(dir, 'TASK', 'judge-TASK.json'), '{"ok":true}\n', 'utf8');
  writeFileSync(path.join(dir, 'seed-hashes.json'), '{"files":{}}\n', 'utf8');
  writeFileSync(path.join(dir, '.verify-stdout.txt'), 'noise\n', 'utf8');
  return dir;
}

test('A. 正常退出后可记录指纹（清单 + SHA-256 + 时间）', () => {
  const ws = makeWorkspace();
  const fp = captureWorkspaceFingerprint(ws);
  assert.equal(fp.file_count, 2, '只应包含任务产物（工具产物被排除）');
  assert.ok(Object.keys(fp.files).includes('TASK/src/a.js'));
  assert.ok(Object.keys(fp.files).includes('TASK/verify.js'));
  assert.ok(!Object.keys(fp.files).includes('seed-hashes.json'));
  assert.match(fp.manifest_sha256, /^[0-9a-f]{64}$/);
  assert.ok(fp.captured_at.length > 0);
  assert.equal(fp.excluded.length, 3, '三个工具产物应被显式记录为排除项');
});

test('B. 人为修改 workspace → 门禁必须拒绝（并给出变化文件）', () => {
  const ws = makeWorkspace();
  const recorded = captureWorkspaceFingerprint(ws);
  writeFileSync(path.join(ws, 'TASK', 'src', 'a.js'), 'module.exports = { a: 2 }; // 被人改了\n', 'utf8');

  const current = captureWorkspaceFingerprint(ws);
  assert.equal(fingerprintMatches(recorded, current), false, '内容变化必须导致指纹不一致');
  assert.deepEqual(fingerprintDiff(recorded, current), ['TASK/src/a.js'], '应精确指出变化文件');
});

test('C. 恢复到 recorded 状态 → 门禁放行', () => {
  const ws = makeWorkspace();
  const recorded = captureWorkspaceFingerprint(ws);
  const original = 'module.exports = { a: 1 };\n';

  writeFileSync(path.join(ws, 'TASK', 'src', 'a.js'), 'broken\n', 'utf8');
  assert.equal(fingerprintMatches(recorded, captureWorkspaceFingerprint(ws)), false);

  writeFileSync(path.join(ws, 'TASK', 'src', 'a.js'), original, 'utf8');
  assert.equal(fingerprintMatches(recorded, captureWorkspaceFingerprint(ws)), true, '还原后必须一致');
});

test('D. 指纹与工具产物无关：repair 期间写 judge/临时文件不得导致不一致', () => {
  const ws = makeWorkspace();
  const recorded = captureWorkspaceFingerprint(ws);

  // 模拟 repair 期间的受控写入（judge 重建、stdout 捕获）
  writeFileSync(path.join(ws, 'TASK', 'judge-TASK.json'), '{"ok":true,"updated":true}\n', 'utf8');
  writeFileSync(path.join(ws, '.repair-stdout.txt'), 'more noise\n', 'utf8');

  assert.equal(fingerprintMatches(recorded, captureWorkspaceFingerprint(ws)), true);
});
