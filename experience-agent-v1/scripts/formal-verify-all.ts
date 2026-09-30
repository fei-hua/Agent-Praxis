/**
 * scripts/formal-verify-all.ts — 只读的「冻结版独立验真」（人工要求 2026-09-30 Step ①）
 *
 * 职责边界（硬性）：
 *   ✅ 读取当前 status=frozen 的 F01 YAML / 种子模块 / 版本标识 / pre-run 声明
 *   ✅ schema 校验、GT 与签署投影一致性校验、版本身份校验
 *   ✅ 复现交付流程（播种未修复状态 → 真实预跑产生失败日志 → 冻结临时基线 → verifyTask）
 *   ❌ 不生成/不修改任何任务 YAML、GT、version_hash
 *   ❌ 不覆盖正式 baseline（使用 DSH_FORMAL_BASELINE 指向临时文件）
 *   ❌ 不生成 formal manifest、不创建 F02
 *
 * fail-closed：非 frozen、签署投影不一致、版本身份不匹配、CONFIG_ERROR、success=null ⇒ exit 3
 *
 * 用法：node scripts/formal-verify-all.ts
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { FORMAL_F01_SEEDS } from '../benchmark/formal-seeds-f01.ts';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const VERSION_FILE = path.join(ROOT, 'benchmark', 'formal', 'f01-version.json');
const PRE_RUN_FILE = path.join(ROOT, 'benchmark', 'formal', 'f01-pre-run.json');

const fails: string[] = [];
const checks: Array<[string, boolean, string]> = [];
const add = (name: string, ok: boolean, detail: string): void => {
  checks.push([name, ok, detail]);
  if (!ok) fails.push(name + ' — ' + detail);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
};

// ---------- 0) 只读性声明 ----------
console.log('=== formal-verify-all（只读验真，不会修改任何任务文件） ===');
const before = new Map<string, string>();
const yamlFiles = readdirSync(TASKS).filter((f) => /^FORMAL-F01-.*\.yaml$/.test(f)).sort();
for (const f of yamlFiles) before.set(f, createHash('sha256').update(readFileSync(path.join(TASKS, f))).digest('hex'));
const versionBefore = createHash('sha256').update(readFileSync(VERSION_FILE)).digest('hex');

// ---------- 1) 版本身份 ----------
const version = readJsonUtf8<{ signed_version_hash: string; frozen_version_hash: string; frozen_content_projection_hash: string; file_count: number; files: Record<string, string> }>(VERSION_FILE);
const entries = Object.keys(version.files).sort().map((f) => [f, createHash('sha256').update(readFileSync(path.join(ROOT, f))).digest('hex')] as const);
const frozenNow = createHash('sha256').update(entries.map(([f, h]) => f + ':' + h).join('\n')).digest('hex');
add('版本身份：frozen_version_hash 与 f01-version.json 一致', frozenNow === version.frozen_version_hash, frozenNow.slice(0, 16) + '… vs ' + version.frozen_version_hash.slice(0, 16) + '…');

const proj = (text: string): string => {
  const o = parseYaml(text) as Record<string, unknown>;
  for (const k of ['status', 'gt_signed_by', 'gt_signed_at', 'gt_signed_version_hash']) delete o[k];
  const walk = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, walk((v as Record<string, unknown>)[k])])) : v;
  return createHash('sha256').update(JSON.stringify(walk(o))).digest('hex');
};
const projNow = createHash('sha256').update(yamlFiles.map((f) => f + ':' + proj(readFileSync(path.join(TASKS, f), 'utf8'))).join('\n')).digest('hex');
add('签署投影：语义投影与签署时记录一致（0 GT 漂移）', projNow === version.frozen_content_projection_hash, projNow.slice(0, 16) + '… vs ' + version.frozen_content_projection_hash.slice(0, 16) + '…');

// ---------- 2) 逐任务 frozen / schema / 签署字段 / verification 覆盖 ----------
console.log('\n--- 逐任务（status / schema / 签署 / verification） ---');
const tasks: Array<{ id: string; task: import('../benchmark/tasks.ts').BenchmarkTask }> = [];
for (const f of yamlFiles) {
  const text = readFileSync(path.join(TASKS, f), 'utf8');
  const raw = parseYaml(text) as Record<string, unknown>;
  const id = String(raw['id'] ?? f);
  const loaded = loadTask(raw);
  const statusOk = raw['status'] === 'frozen';
  const signedOk = String(raw['gt_signed_by'] ?? '').trim() !== '' && /^20\d\d-\d\d-\d\dT/.test(String(raw['gt_signed_at'] ?? ''));
  const hashOk = raw['gt_signed_version_hash'] === version.signed_version_hash;
  const verIds = (Array.isArray(raw['verification']) ? (raw['verification'] as Array<Record<string, unknown>>) : []).map((v) => String(v['id']));
  const noDup = verIds.length === new Set(verIds).size;
  const required = ((raw['success_criteria'] as { required?: string[] } | undefined)?.required ?? []).map(String);
  const covered = required.every((r) => verIds.includes(r));
  const prot = (raw['protected_paths'] as string[] | undefined) ?? [];
  const protOk = prot.length > 0 && prot.every((p) => String(p).startsWith('pilot-workspace/'));
  const ok = statusOk && loaded.ok && signedOk && hashOk && noDup && covered && protOk;
  add(
    `${id}`,
    ok,
    `status=${String(raw['status'])} schema=${loaded.ok ? 'ok' : 'FAIL'} 签署=${signedOk ? 'ok' : '缺失'} 绑定hash=${hashOk ? 'ok' : '不匹配'} 重复id=${noDup ? 0 : 'YES'} required覆盖=${covered ? 'ok' : '缺失'} protected=${prot.length}`,
  );
  if (loaded.ok) tasks.push({ id, task: loaded.task });
}

// ---------- 3) 复现交付流程 + verifyTask（未修复层） ----------
console.log('\n--- 交付流程复现（播种 → 真实预跑 → 冻结临时基线 → verifyTask） ---');
const preRunSpec = readJsonUtf8<{ pre_runs: Record<string, { command: string; log: string }> }>(PRE_RUN_FILE).pre_runs;
const tmpBaseline = path.join(ROOT, 'pilot-workspace', '.formal-baseline.verifyall.json');
process.env['DSH_VERIFY_DATASET'] = 'formal';
process.env['DSH_FORMAL_BASELINE'] = tmpBaseline;
const officialBaseline = path.join(ROOT, 'pilot-workspace', 'seed-hashes.formal.json');
const officialBefore = existsSync(officialBaseline) ? createHash('sha256').update(readFileSync(officialBaseline)).digest('hex') : null;

for (const task of tasks) {
  const dir = path.join(ROOT, 'pilot-workspace', task.id);
  rmSync(dir, { recursive: true, force: true });
  for (const seed of FORMAL_F01_SEEDS) {
    if (!seed.path.startsWith('pilot-workspace/' + task.id + '/')) continue;
    const p = path.join(ROOT, seed.path);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, seed.content, 'utf8');
  }
}
let preRunFails = 0;
for (const [id, spec] of Object.entries(preRunSpec)) {
  const script = path.join(ROOT, spec.command.split(' ')[1]!);
  const outT = path.join(ROOT, 'pilot-workspace', '.va-' + id + '.out');
  const errT = path.join(ROOT, 'pilot-workspace', '.va-' + id + '.err');
  const of = openSync(outT, 'w');
  const ef = openSync(errT, 'w');
  let code = 0;
  try {
    execFileSync(process.execPath, [script], { cwd: ROOT, stdio: ['ignore', of, ef], timeout: 60_000 });
  } catch (e) {
    const st = (e as { status?: number | null }).status;
    code = typeof st === 'number' ? st : 1;
  } finally {
    closeSync(of);
    closeSync(ef);
  }
  const stdout = readFileSync(outT, 'utf8');
  const stderr = readFileSync(errT, 'utf8');
  writeFileSync(path.join(ROOT, spec.log), ['# 预跑记录（冻结环境中实际执行）', 'command: ' + spec.command, 'exit_code: ' + String(code), 'stdout:', stdout.trim(), 'stderr:', stderr.trim(), ''].join('\n'), 'utf8');
  rmSync(outT, { force: true });
  rmSync(errT, { force: true });
  console.log(`  预跑 ${id}：${spec.command} → exit=${String(code)}`);
  if (code === 0) preRunFails++;
}
add('预跑复现：声明的失败确实发生（exit≠0）', preRunFails === 0, preRunFails === 0 ? '全部非 0' : preRunFails + ' 个预跑意外成功');

const bl = buildBaselineFromWorkspace({ taskSetId: 'F01', taskIds: tasks.map((t) => t.id) }, { force: true });
console.log('  临时基线（含预跑日志）：' + Object.keys(bl.files).length + ' 个文件，baseline_hash=' + bl.baseline_hash.slice(0, 12) + '…');

let failLayerOk = 0;
let cfgErr = 0;
let nullOk = 0;
for (const t of tasks) {
  const r = verifyTask(t.task);
  const good = r.success === false && r.verification_status === 'OK' && r.config_errors.length === 0;
  if (good) failLayerOk++;
  if (r.config_errors.length > 0) cfgErr++;
  if (r.success === null) nullOk++;
  console.log(`  ${t.id}: 未修复 success=${String(r.success)} status=${r.verification_status} CONFIG_ERROR=${r.config_errors.length} ${good ? '✓' : '⚠️'}`);
}
add('未修复层：10/10 正确判为 FAIL（success=false）', failLayerOk === tasks.length, failLayerOk + '/' + tasks.length);
add('无 CONFIG_ERROR', cfgErr === 0, 'CONFIG_ERROR 总数 = ' + cfgErr);
add('无 success=null', nullOk === 0, 'success=null 数 = ' + nullOk);

// ---------- 4) 只读性与边界 ----------
console.log('\n--- 只读性与边界 ---');
let touched = 0;
for (const f of yamlFiles) if (createHash('sha256').update(readFileSync(path.join(TASKS, f))).digest('hex') !== before.get(f)) touched++;
add('未修改任何任务 YAML', touched === 0, '被改动 = ' + touched);
add('未修改 f01-version.json', createHash('sha256').update(readFileSync(VERSION_FILE)).digest('hex') === versionBefore, 'ok');
const officialAfter = existsSync(officialBaseline) ? createHash('sha256').update(readFileSync(officialBaseline)).digest('hex') : null;
add('未触碰正式 baseline', officialBefore === officialAfter, officialBefore === null ? '正式基线不存在（本次也未创建）' : '哈希一致');
add('未生成 formal manifest', !existsSync(path.join(ROOT, 'pilot-manifest-formal.json')), 'pilot-manifest-formal.json 不存在');
add('未创建 F02 文件', readdirSync(TASKS).filter((f) => /^FORMAL-F02-/.test(f)).length === 0, 'FORMAL-F02-* = 0');

// 清理（只删本次 materialize 的任务目录与临时基线）
for (const t of tasks) rmSync(path.join(ROOT, 'pilot-workspace', t.id), { recursive: true, force: true });
rmSync(tmpBaseline, { force: true });
delete process.env['DSH_VERIFY_DATASET'];
delete process.env['DSH_FORMAL_BASELINE'];
console.log('  已清理：materialize 的任务目录与临时基线');

// ---------- 5) 结论 ----------
const passed = checks.filter(([, ok]) => ok).length;
console.log('\n=== 结论 ===');
console.log('  通过检查 = ' + passed + '/' + checks.length);
if (fails.length) {
  console.log('  ❌ fail-closed：以下检查未通过');
  for (const f of fails) console.log('    - ' + f);
  process.exit(3);
}
console.log('  ✅ 冻结版独立验真通过（F01 frozen 10/10）');
console.log('  说明：本次为**未修复层**复现（全部正确 FAIL）。修复层（参考修复后 PASS）需要 f01-reference-fixes.json，');
console.log('        当前尚未落盘，故不在本脚本职责内 —— 需你裁定是否补齐。');
process.exit(0);
