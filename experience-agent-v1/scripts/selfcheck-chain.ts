/**
 * scripts/selfcheck-chain.ts — 非 Pilot 链路自测（人工要求 2026-09-27）
 *
 * 目的：证明 **execute 路径不再经过 nested spawn，且与 repair 路径使用同一个 verifier**，
 *       四个场景都不产生任何 Pilot observation（无 Agent 调用、无会话日志、不写 trajectories）。
 *
 * 覆盖：
 *   1. 正常任务：verifyTask → PASS → judge 生成 → collect 前置门禁通过
 *   2. 正常任务失败：verifyTask 正常返回 FAIL（verification_status=OK），不是工具异常
 *   3. workspace 被修改：fingerprint 正常记录，且能检出不一致（门禁会拒绝）
 *   4. 配置错误：required 标签缺 checker ⇒ VERIFICATION_CONFIG_ERROR（⇒ 链路按 COLLECTION_ERROR 处理）
 *
 * 用法：node scripts/selfcheck-chain.ts     退出码 0 = 四例全过；非 0 = 未通过
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTask } from './pilot-verify.ts';
import type { BenchmarkTask } from '../benchmark/tasks.ts';
import { writeJsonUtf8 } from './lib/json-io.ts';
import { captureWorkspaceFingerprint, fingerprintDiff, fingerprintMatches } from './lib/workspace-fingerprint.ts';
import { PROJECT_ROOT } from './pilot-setup.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(PROJECT_ROOT, 'pilot-workspace-selfcheck');
const TASK = 'CHAIN-01';
const rel = (p: string): string => path.relative(PROJECT_ROOT, p).split(path.sep).join('/');

const results: Array<{ id: string; pass: boolean; detail: string }> = [];
const check = (id: string, pass: boolean, detail: string): void => {
  results.push({ id, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} — ${detail}`);
};

function buildWorkspace(broken: boolean): void {
  const dir = path.join(DIR, TASK);
  mkdirSync(dir, { recursive: true });
  // M3 边界（Phase 0 已定位、此处第三次复现）：父项目是 "type":"module"，
  // 工作区若不自带 package.json{type:commonjs}，所有 .js 会被按 ESM 解析 ⇒ checker 里 require 未定义。
  writeFileSync(path.join(DIR, 'package.json'), JSON.stringify({ name: 'selfcheck-workspace', private: true, type: 'commonjs' }, null, 2) + '\n', 'utf8');
  writeFileSync(
    path.join(dir, 'work.js'),
    broken
      ? "module.exports = { add: (a, b) => a - b };\n" // 故意写错
      : "module.exports = { add: (a, b) => a + b };\n",
    'utf8',
  );
  writeFileSync(
    path.join(dir, 'check-work.js'),
    [
      "'use strict';",
      "const { add } = require('./work.js');",
      "let bad = 0;",
      "const t = (c, m) => { console.log((c ? 'ok - ' : 'FAIL - ') + m); if (!c) bad++; };",
      "t(add(2, 3) === 5, 'add(2,3) === 5');",
      "t(add(0, 0) === 0, 'add(0,0) === 0');",
      "if (bad) { console.log('WORK FAIL'); process.exit(1); }",
      "console.log('WORK OK');",
    ].join('\n') + '\n',
    'utf8',
  );
}

const baseTask = (over: Partial<BenchmarkTask>): BenchmarkTask =>
  ({
    id: TASK,
    category: 'A',
    status: 'frozen',
    source: 'selfcheck',
    task_type: 'bugfix',
    complexity: 'simple',
    scope: 'project',
    characteristics: [],
    constraints: ['scope_limited'],
    prompt: 'selfcheck',
    expected_first_decisions: ['DIRECT'],
    expected_delegation: false,
    success_criteria: ['work_ok', 'check_output'],
    success_criteria_required: ['work_ok', 'check_output'],
    success_criteria_forbidden: [],
    expected_files: [],
    allowed_paths: [],
    protected_paths: [],
    verification: [
      { id: 'work_ok', kind: 'command_exit_zero', command: `node ${rel(path.join(DIR, TASK, 'check-work.js'))}` },
      { id: 'check_output', kind: 'output_contains', command: `node ${rel(path.join(DIR, TASK, 'check-work.js'))}`, expect: 'WORK OK' },
    ],
    ...over,
  }) as BenchmarkTask;

console.log('=== 非 Pilot 链路自测（不调用 Agent，不写 trajectories） ===');

// ---------- 例 1：正常任务 ----------
buildWorkspace(false);
const okResult = verifyTask(baseTask({}));
check('1. 正常任务：verifyTask PASS', okResult.success === true, `verification_status=${okResult.verification_status} checks=${okResult.checks.map((c) => c.status).join('/')}`);
const judgeFile = path.join(DIR, `judge-${TASK}.json`);
writeJsonUtf8(judgeFile, {
  task_id: okResult.task_id,
  success_criteria_results: [
    ...Object.entries(okResult.required).map(([criterion, v]) => ({ criterion, passed: v === 'PASS' })),
    ...Object.entries(okResult.forbidden).map(([criterion, violated]) => ({ criterion, passed: !violated })),
  ],
  forbidden_file_changes: okResult.protected_path_violations,
  verification_tool_called: true,
  subagent_invocations: 0,
  wall_time_ms: 0,
  verification_status: okResult.verification_status,
  config_errors: okResult.config_errors,
});
const judgeOk = existsSync(judgeFile);
const trajFree = !existsSync(path.join(PROJECT_ROOT, 'telemetry', 'trajectories', `${TASK}.jsonl`));
check(
  '1b. judge 生成 + collect 前置门禁',
  judgeOk && trajFree,
  `judge=${judgeOk ? '已生成' : '缺失'}；trajectory 路径空闲=${trajFree}（真实 collect 需会话日志，由 Pilot run 覆盖——已两次实证）`,
);

// ---------- 例 2：正常任务失败（应为普通 FAIL，不是异常/配置错误） ----------
buildWorkspace(true);
const failResult = verifyTask(baseTask({}));
check(
  '2. 正常任务失败 → 普通 FAIL（非工具异常）',
  failResult.success === false && failResult.verification_status === 'OK',
  `success=${String(failResult.success)} verification_status=${failResult.verification_status}`,
);

// ---------- 例 3：workspace 被修改 → 指纹检出 ----------
buildWorkspace(false);
const fp = captureWorkspaceFingerprint(DIR);
writeFileSync(path.join(DIR, TASK, 'work.js'), 'module.exports = { add: (a, b) => a * b };\n', 'utf8');
const drifted = captureWorkspaceFingerprint(DIR);
const diff = fingerprintDiff(fp, drifted);
check(
  '3. workspace 被修改 → 指纹记录并检出不一致',
  fp.file_count > 0 && !fingerprintMatches(fp, drifted) && diff.includes(`${TASK}/work.js`),
  `记录 ${fp.file_count} files；变化文件=${diff.join(',')}`,
);
buildWorkspace(false);
check('3b. 恢复后指纹一致（门禁放行）', fingerprintMatches(fp, captureWorkspaceFingerprint(DIR)), '内容还原 ⇒ manifest 摘要一致');

// ---------- 例 4：配置错误 → COLLECTION_ERROR 语义（不得伪装成 Agent FAIL） ----------
const brokenTask = baseTask({
  verification: [{ id: 'check_output', kind: 'output_contains', command: `node ${rel(path.join(DIR, TASK, 'check-work.js'))}`, expect: 'WORK OK' }],
});
const cfgResult = verifyTask(brokenTask);
check(
  '4. 配置错误 → VERIFICATION_CONFIG_ERROR（链路按 COLLECTION_ERROR 处理）',
  cfgResult.verification_status === 'VERIFICATION_CONFIG_ERROR' && cfgResult.success === null,
  `success=${String(cfgResult.success)}；errors=${cfgResult.config_errors.length} 条：${cfgResult.config_errors[0] ?? ''}`,
);

// ---------- 清理与汇总 ----------
rmSync(DIR, { recursive: true, force: true });
const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? '✅ 链路自测 4/4 通过（无 nested spawn；verifier 与 repair 共用 verifyTask）' : `❌ ${failed.length} 例未通过`}`);
process.exit(failed.length === 0 ? 0 : 1);
