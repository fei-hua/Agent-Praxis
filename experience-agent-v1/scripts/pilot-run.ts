/**
 * scripts/pilot-run.ts — Pilot 编排器（#8）
 *
 * 模式：
 *   selfcheck  编排器自检（不执行任何 Agent run）：配对、独立重建、臂隔离、元数据完整性
 *   prepare    按冻结 manifest 逐 run 生成 plan + receipt（每 run 前确定性重建 workspace）
 *   collect    按 runs-ledger（run_id → sessionId）执行 verify → collect 闭环，并对账 manifest
 *
 * 人工锁定的 4 个条件（2026-09-27）：
 *   1. 每个 run 独立重建 workspace：seed → clean → setup → run → verify → collect
 *   2. 同一 task 的 A/B/C 使用**同一个 frozen seed**（三个独立 workspace，等价 baseline）
 *   3. 每个 replicate 重新 seed（不串跑）
 *   4. 臂执行顺序由冻结随机化决定，但**不破坏 task-level pairing**
 *
 * 用法：
 *   node scripts/pilot-run.ts --manifest pilot-manifest.json --mode selfcheck
 *   node scripts/pilot-run.ts --manifest pilot-manifest-dry.json --mode prepare --harness-version 0.1.7-rc.2 [--limit 30]
 *   node scripts/pilot-run.ts --manifest pilot-manifest-dry.json --mode collect --ledger runs-ledger.json --harness-version 0.1.7-rc.2
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  auditRunsAgainstManifest,
  canonicalJson,
  loadPilotManifest,
  sha256,
  type PilotManifest,
  type PlannedRun,
} from './pilot-manifest.ts';
import { PROJECT_ROOT, currentHash, loadSeedHashes, seedPilotWorkspace } from './pilot-setup.ts';
import { buildArmRunPlan, composeArmPrompt } from '../policies/arm-prompt.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(PROJECT_ROOT, 'pilot-runs');
const WS = path.join(PROJECT_ROOT, 'pilot-workspace');
const TASKS_DIR = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');

type Arm = Parameters<typeof buildArmRunPlan>[0];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function runNode(script: string, args: string[]): { code: number; output: string } {
  mkdirSync(RUNS_DIR, { recursive: true });
  const outTmp = path.join(RUNS_DIR, '.spawn-stdout.txt');
  const errTmp = path.join(RUNS_DIR, '.spawn-stderr.txt');
  const outFd = openSync(outTmp, 'w');
  const errFd = openSync(errTmp, 'w');
  let code = 0;
  let thrown = '';
  try {
    execFileSync(process.execPath, [path.join(HERE, script), ...args], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', outFd, errFd],
      timeout: 300_000,
    });
  } catch (e) {
    const s = (e as { status?: number | null }).status;
    code = typeof s === 'number' ? s : 1;
    // 记录异常本身（不能只靠 exit code：spawn 层失败时没有 status）
    thrown = `\n[spawn 异常] ${(e as Error).message}`;
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
  return { code, output: readFileSync(outTmp, 'utf8') + readFileSync(errTmp, 'utf8') + thrown };
}

/** 当前 workspace 基线指纹（由种子清单的 canonical JSON 得到） */
function workspaceBaselineHash(): string {
  const seed = loadSeedHashes();
  if (!seed) throw new Error('未找到种子清单：请先运行 pilot-setup（Run 间必须重建）');
  return sha256(canonicalJson(seed.files));
}

/** 某任务的种子指纹（seed_id / seed_hash） */
function taskSeedFingerprint(taskId: string): { seed_id: string; seed_hash: string } {
  const seed = loadSeedHashes();
  if (!seed) throw new Error('未找到种子清单');
  const prefix = `pilot-workspace/${taskId}/`;
  const files = Object.fromEntries(
    Object.entries(seed.files).filter(([p]) => p.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  if (Object.keys(files).length === 0) throw new Error(`任务 ${taskId} 没有种子文件（无法独立重建）`);
  const hash = sha256(canonicalJson(files));
  return { seed_id: `seed-${taskId}-${hash.slice(0, 12)}`, seed_hash: hash };
}

const ARM_OF = (a: string): Arm => a as Arm;

function groupRuns(manifest: PilotManifest): Map<string, PlannedRun[]> {
  const groups = new Map<string, PlannedRun[]>();
  for (const r of manifest.planned_runs) {
    const list = groups.get(r.group_id) ?? [];
    list.push(r);
    groups.set(r.group_id, list);
  }
  for (const list of groups.values()) list.sort((a, b) => a.arm_order_index - b.arm_order_index);
  return groups;
}

interface SelfCheckIssue {
  run_id: string;
  kind: string;
  detail: string;
}

function selfcheck(manifest: PilotManifest): number {
  const issues: SelfCheckIssue[] = [];
  const groups = groupRuns(manifest);
  const expectedOrder = manifest.arms.length;

  // 基线一致性：初始重建一次作为参照
  seedPilotWorkspace();
  const reference = workspaceBaselineHash();
  const baselineByGroup = new Map<string, string>();
  const seedFingerprints = new Map<string, { seed_id: string; seed_hash: string }>();
  let armIsolationChecked = 0;

  for (const [groupId, runs] of groups) {
    if (runs.length !== expectedOrder) {
      issues.push({ run_id: groupId, kind: 'pairing', detail: `组内臂数 ${runs.length} ≠ ${expectedOrder}` });
    }
    // 配对完整性：三臂必须齐备且各出现一次
    const armsInGroup = runs.map((r) => r.arm).sort().join(',');
    if (armsInGroup !== [...manifest.arms].sort().join(',')) {
      issues.push({ run_id: groupId, kind: 'pairing', detail: `组内臂集合异常：${armsInGroup}` });
    }

    for (const run of runs) {
      // 条件 1/2/3：每个 run 独立重建；同组各臂基线必须一致
      seedPilotWorkspace();
      const baseline = workspaceBaselineHash();
      if (baseline !== reference) {
        issues.push({ run_id: run.run_id, kind: 'seed_rebuild', detail: `重建后的基线指纹与参照不一致` });
      }
      baselineByGroup.set(groupId, baseline);
      if (!seedFingerprints.has(run.task_id)) seedFingerprints.set(run.task_id, taskSeedFingerprint(run.task_id));

      // 元数据完整性
      const required: Array<[string, unknown]> = [
        ['run_id', run.run_id],
        ['task_id', run.task_id],
        ['replicate', run.replicate],
        ['arm', run.arm],
        ['arm_order_index', run.arm_order_index],
        ['group_id', run.group_id],
      ];
      for (const [k, v] of required) {
        if (v === undefined || v === null || v === '') {
          issues.push({ run_id: run.run_id, kind: 'metadata', detail: `缺少字段 ${k}` });
        }
      }

      // 条件 6/7/8/9：臂隔离（Experience / Policy / 快照 / reflection）
      const plan = buildArmRunPlan(ARM_OF(run.arm));
      const expectInject = run.arm === 'C_frozen';
      if (plan.inject_experience !== expectInject) {
        issues.push({ run_id: run.run_id, kind: 'arm_isolation', detail: `inject_experience=${plan.inject_experience}，应为 ${expectInject}` });
      }
      if (plan.reflection_enabled !== false) {
        issues.push({ run_id: run.run_id, kind: 'arm_isolation', detail: 'reflection_enabled 必须为 false' });
      }
      if (run.arm === 'C_frozen' && plan.snapshot_id !== manifest.snapshot_id) {
        issues.push({ run_id: run.run_id, kind: 'arm_isolation', detail: `C_frozen 快照=${plan.snapshot_id}，应为 ${manifest.snapshot_id}` });
      }
      // A/B 收到经验上下文必须直接报错（防"偷偷注入"）
      if (!expectInject) {
        let threw = false;
        try {
          composeArmPrompt(plan, 'ctx');
        } catch {
          threw = true;
        }
        if (!threw) issues.push({ run_id: run.run_id, kind: 'arm_isolation', detail: `${run.arm} 臂收到经验上下文却未报错` });
      } else {
        const prompt = composeArmPrompt(plan, '<experience-context>');
        if (!prompt.includes('<experience-context>')) {
          issues.push({ run_id: run.run_id, kind: 'arm_isolation', detail: 'C_frozen 未把经验块并入提示' });
        }
      }
      armIsolationChecked++;
    }
  }

  // 跨 run 污染：模拟"上一个 run 改坏了 workspace"，重建后必须回到基线
  const victim = Object.keys(loadSeedHashes()!.files)[0]!;
  const victimAbs = path.join(PROJECT_ROOT, victim);
  writeFileSync(victimAbs, '// 模拟上一个 run 的残留改动\n', 'utf8');
  seedPilotWorkspace();
  const afterReseed = workspaceBaselineHash();
  if (afterReseed !== reference) {
    issues.push({ run_id: '(contamination-probe)', kind: 'contamination', detail: '重建后未回到基线指纹' });
  }
  if (currentHash(victim) !== loadSeedHashes()!.files[victim]) {
    issues.push({ run_id: '(contamination-probe)', kind: 'contamination', detail: `残留文件未被还原：${victim}` });
  }

  const report = {
    dataset: manifest.dataset,
    manifest_hash: manifest.manifest_hash,
    checked_at: new Date().toISOString(),
    planned_count: manifest.planned_count,
    groups: groups.size,
    arms_per_group: expectedOrder,
    workspace_baseline_hash: reference,
    arm_isolation_checked: armIsolationChecked,
    seed_fingerprints: Object.fromEntries(seedFingerprints),
    issues,
    ok: issues.length === 0,
  };
  mkdirSync(RUNS_DIR, { recursive: true });
  writeFileSync(path.join(RUNS_DIR, `selfcheck-${manifest.dataset}.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`=== 编排器自检（dataset=${manifest.dataset}）===`);
  console.log(`  planned=${manifest.planned_count} 配对组=${groups.size} 每组臂数=${expectedOrder}`);
  console.log(`  workspace 基线指纹=${reference.slice(0, 16)}… 臂隔离断言=${armIsolationChecked} 次`);
  console.log(`  任务种子指纹=${Object.keys(report.seed_fingerprints).length} 个`);
  if (issues.length === 0) {
    console.log('✅ PASS：配对 / 独立重建 / 臂隔离 / 元数据 / 跨 run 污染探针 全部通过');
    return 0;
  }
  console.log(`❌ FAIL：${issues.length} 处问题`);
  for (const i of issues.slice(0, 20)) console.log(`  [${i.kind}] ${i.run_id}: ${i.detail}`);
  return 1;
}

function prepare(manifest: PilotManifest, harnessVersion: string, limit: number | null): number {
  const toolSchemaFrom = arg('tool-schema-from-session');
  const runs = limit ? manifest.planned_runs.slice(0, limit) : manifest.planned_runs;
  let ok = 0;
  const failures: string[] = [];
  for (const run of runs) {
    seedPilotWorkspace(); // 条件 1/2/3：每个 run 独立重建
    const baseline = workspaceBaselineHash();
    const { seed_id, seed_hash } = taskSeedFingerprint(run.task_id);
    const args = [
      '--task', run.task_id,
      '--tasks-dir', TASKS_DIR,
      '--arm', run.arm,
      '--run-id', run.run_id,
      '--harness-version', harnessVersion,
      '--out', RUNS_DIR,
    ];
    if (toolSchemaFrom) args.push('--tool-schema-from-session', toolSchemaFrom);
    const res = runNode('pilot-plan.ts', args);
    const planFile = path.join(RUNS_DIR, `${run.run_id}.plan.json`);
    if (res.code !== 0 || !existsSync(planFile)) {
      failures.push(`${run.run_id}: pilot-plan 失败（exit=${res.code}）\n${res.output.split('\n').slice(-6).join('\n')}`);
      continue;
    }
    const plan = JSON.parse(readFileSync(planFile, 'utf8')) as Record<string, unknown>;
    const receipt = {
      run_id: run.run_id,
      task_id: run.task_id,
      replicate: run.replicate,
      arm: run.arm,
      arm_order_index: run.arm_order_index,
      group_id: run.group_id,
      seed_id,
      seed_hash,
      workspace_baseline_hash: baseline,
      manifest_hash: manifest.manifest_hash,
      pilot_manifest: manifest.dataset,
      experience_snapshot_id: run.arm === 'C_frozen' ? manifest.snapshot_id : null,
      plan_file: path.relative(PROJECT_ROOT, planFile),
      tool_schema_verified: plan['tool_schema_verified'] ?? null,
      prepared_at: new Date().toISOString(),
    };
    writeFileSync(path.join(RUNS_DIR, `${run.run_id}.receipt.json`), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
    ok++;
  }
  console.log(`=== prepare（dataset=${manifest.dataset}）===`);
  console.log(`  生成 plan+receipt：${ok}/${runs.length}`);
  if (failures.length) {
    console.log(`  ❌ 失败 ${failures.length} 个（完整信息，前 2 个）：`);
    for (const f of failures.slice(0, 2)) console.log('   ' + f);
    return 1;
  }
  console.log('✅ 全部 plan 生成成功（执行前门禁已逐个通过）');
  return 0;
}

function collect(manifest: PilotManifest, harnessVersion: string, ledgerFile: string): number {
  if (!existsSync(ledgerFile)) throw new Error(`runs-ledger 不存在：${ledgerFile}`);
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')) as Record<string, string>;
  const planned = new Map(manifest.planned_runs.map((r) => [r.run_id, r]));
  const collectedFile = path.join(RUNS_DIR, `collected-${manifest.dataset}.jsonl`);
  writeFileSync(collectedFile, '', 'utf8');
  let ok = 0;
  const failures: string[] = [];

  for (const [runId, sessionId] of Object.entries(ledger)) {
    const run = planned.get(runId);
    if (!run) {
      failures.push(`${runId}: 不在冻结 manifest 中（unexpected）`);
      continue;
    }
    seedPilotWorkspace(); // 采集前同样从基线重建，保证边界哈希可解释
    const verify = runNode('pilot-verify.ts', ['--task', run.task_id, '--tasks-dir', TASKS_DIR, '--out', WS]);
    const judgeFile = path.join(WS, `judge-${run.task_id}.json`);
    if (verify.code === 3) {
      failures.push(`${runId}: VERIFICATION_CONFIG_ERROR（基础设施错误，不计入正式数据）\n${verify.output.split('\n').slice(-4).join('\n')}`);
      continue;
    }
    if (!existsSync(judgeFile)) {
      failures.push(`${runId}: 判定文件未生成`);
      continue;
    }
    const args = [
      '--task', run.task_id,
      '--tasks-dir', TASKS_DIR,
      '--run-id', runId,
      '--arm', run.arm,
      '--manifest', path.join(RUNS_DIR, `${runId}.plan.json`),
      '--primary', sessionId,
      '--judge', judgeFile,
      '--harness-version', harnessVersion,
    ];
    const res = runNode('dryrun-collect.ts', args);
    if (res.code !== 0) {
      failures.push(`${runId}: 采集失败（exit=${res.code}）${res.output.split('\n').slice(-4).join(' ')}`);
      continue;
    }
    appendFileSync(
      collectedFile,
      JSON.stringify({ run_id: runId, session_id: sessionId, task_id: run.task_id, replicate: run.replicate, arm: run.arm, verdict: verify.code === 0 ? 'PASS' : 'FAIL', collected_at: new Date().toISOString() }) + '\n',
      'utf8',
    );
    ok++;
  }

  const audit = auditRunsAgainstManifest(manifest, Object.keys(ledger));
  console.log(`=== collect（dataset=${manifest.dataset}）===`);
  console.log(`  采集成功：${ok}/${Object.keys(ledger).length}`);
  console.log(`  manifest 对账：planned=${audit.planned_count} actual=${audit.actual_count} missing=${audit.missing.length} duplicate=${audit.duplicate.length} unexpected=${audit.unexpected.length}`);
  if (failures.length) {
    console.log(`  ❌ 失败 ${failures.length} 个（前 5）：`);
    for (const f of failures.slice(0, 5)) console.log('   ' + f.split('\n')[0]);
  }
  const allOk = failures.length === 0 && audit.ok;
  console.log(allOk ? '✅ 采集闭环 + manifest 对账通过' : '❌ 未通过（不得计入正式统计）');
  return allOk ? 0 : 1;
}

if (process.argv[1]?.endsWith('pilot-run.ts')) {
  const manifestFile = arg('manifest') ?? path.join(PROJECT_ROOT, 'pilot-manifest.json');
  const manifest = loadPilotManifest(manifestFile);
  const mode = arg('mode') ?? 'selfcheck';
  const harnessVersion = arg('harness-version');
  const limit = arg('limit') ? Number(arg('limit')) : null;

  let code = 0;
  if (mode === 'selfcheck') code = selfcheck(manifest);
  else if (mode === 'prepare') {
    if (!harnessVersion) throw new Error('prepare 需要 --harness-version（run 当时的 harness 版本，OQ-016）');
    code = prepare(manifest, harnessVersion, limit);
  } else if (mode === 'collect') {
    if (!harnessVersion) throw new Error('collect 需要 --harness-version');
    const ledger = arg('ledger');
    if (!ledger) throw new Error('collect 需要 --ledger（run_id → sessionId 的 JSON 映射）');
    code = collect(manifest, harnessVersion, ledger);
  } else {
    throw new Error(`未知 mode：${mode}（可选 selfcheck / prepare / collect）`);
  }
  process.exit(code);
}
