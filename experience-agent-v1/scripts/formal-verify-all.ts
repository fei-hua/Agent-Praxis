/**
 * scripts/formal-verify-all.ts — 只读的「冻结版独立验真」（参数化：按族）
 *
 * 用法：node scripts/formal-verify-all.ts [--family F01] [--family F02]（缺省 = 全部已声明族）
 *
 * 职责边界（硬性）：
 *   ✅ 读取当前 status=frozen 的族任务 YAML / 种子模块 / 版本标识 / pre-run 声明
 *   ✅ schema 校验、GT 与签署投影一致性、版本身份、protected_paths、verification 覆盖
 *   ✅ 复现交付流程（播种未修复状态 → 真实预跑 → 冻结临时基线 → verifyTask）
 *   ❌ 不生成/不修改任务 YAML、GT、version_hash；不覆盖正式 baseline；不生成 manifest
 *
 * fail-closed：非 frozen、投影不一致、版本身份不匹配、CONFIG_ERROR、success=null ⇒ exit 3
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask, type BenchmarkTask } from '../benchmark/tasks.ts';
import { verifyTask } from './pilot-verify.ts';
import { buildBaselineFromWorkspace } from './formal-setup.ts';
import { FORMAL_F01_SEEDS } from '../benchmark/formal-seeds-f01.ts';
import { FORMAL_F02_SEEDS } from '../benchmark/formal-seeds-f02.ts';
import { readJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TASKS = path.join(ROOT, 'benchmark', 'tasks', 'formal');

interface FamilySpec {
  family: string;
  versionFile: string;
  preRunFile: string;
  seeds: Array<{ path: string; content: string }>;
}
const FAMILIES: Record<string, FamilySpec> = {
  F01: { family: 'F01', versionFile: 'benchmark/formal/f01-version.json', preRunFile: 'benchmark/formal/f01-pre-run.json', seeds: FORMAL_F01_SEEDS },
  F02: { family: 'F02', versionFile: 'benchmark/formal/f02-version.json', preRunFile: 'benchmark/formal/f02-pre-run.json', seeds: FORMAL_F02_SEEDS },
};

const argv = process.argv.slice(2);
const requested: string[] = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--family') requested.push(String(argv[i + 1]));
const selected = (requested.length ? requested : Object.keys(FAMILIES)).map((f) => FAMILIES[f]).filter((f): f is FamilySpec => Boolean(f));
if (selected.length === 0) {
  console.error('未选择任何族（可用：' + Object.keys(FAMILIES).join(', ') + '）');
  process.exit(3);
}

const fails: string[] = [];
let totalChecks = 0;
const add = (name: string, ok: boolean, detail: string): void => {
  totalChecks++;
  if (!ok) fails.push(name + ' — ' + detail);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
};

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
const proj = (text: string): string => {
  const o = parseYaml(text) as Record<string, unknown>;
  for (const k of ['status', 'gt_signed_by', 'gt_signed_at', 'gt_signed_version_hash']) delete o[k];
  const walk = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, walk((v as Record<string, unknown>)[k])])) : v;
  return sha(JSON.stringify(walk(o)));
};

console.log('=== formal-verify-all（只读验真）· 族 = ' + selected.map((s) => s.family).join(', ') + ' ===');

for (const spec of selected) {
  console.log('\n### 族 ' + spec.family);
  const versionPath = path.join(ROOT, spec.versionFile);
  const version = readJsonUtf8<{ signed_version_hash?: string; frozen_version_hash?: string; frozen_content_projection_hash?: string; files: Record<string, string> }>(versionPath);
  const yamlFiles = readdirSync(TASKS).filter((f) => f.startsWith('FORMAL-' + spec.family + '-') && f.endsWith('.yaml')).sort();
  const before = new Map(yamlFiles.map((f) => [f, sha(readFileSync(path.join(TASKS, f)))]));
  const versionBefore = sha(readFileSync(versionPath));
  const officialBaseline = path.join(ROOT, 'pilot-workspace', 'seed-hashes.formal.json');
  const officialBefore = existsSync(officialBaseline) ? sha(readFileSync(officialBaseline)) : null;

  const entries = Object.keys(version.files).sort().map((f) => [f, sha(readFileSync(path.join(ROOT, f)))] as const);
  const frozenNow = sha(entries.map(([f, h]) => f + ':' + h).join('\n'));
  add(`${spec.family} 版本身份 frozen_version_hash`, frozenNow === version.frozen_version_hash, frozenNow.slice(0, 16) + '… vs ' + String(version.frozen_version_hash).slice(0, 16) + '…');
  const projNow = sha(yamlFiles.map((f) => f + ':' + proj(readFileSync(path.join(TASKS, f), 'utf8'))).join('\n'));
  add(`${spec.family} 签署投影（0 GT 漂移）`, projNow === version.frozen_content_projection_hash, projNow.slice(0, 16) + '… vs ' + String(version.frozen_content_projection_hash).slice(0, 16) + '…');

  const tasks: Array<{ id: string; task: BenchmarkTask }> = [];
  for (const f of yamlFiles) {
    const raw = parseYaml(readFileSync(path.join(TASKS, f), 'utf8')) as Record<string, unknown>;
    const id = String(raw['id'] ?? f);
    const loaded = loadTask(raw);
    const verIds = (Array.isArray(raw['verification']) ? (raw['verification'] as Array<Record<string, unknown>>) : []).map((v) => String(v['id']));
    const required = ((raw['success_criteria'] as { required?: string[] } | undefined)?.required ?? []).map(String);
    const prot = (raw['protected_paths'] as string[] | undefined) ?? [];
    const ok =
      raw['status'] === 'frozen' &&
      loaded.ok &&
      String(raw['gt_signed_by'] ?? '').trim() !== '' &&
      /^20\d\d-\d\d-\d\dT/.test(String(raw['gt_signed_at'] ?? '')) &&
      raw['gt_signed_version_hash'] === version.signed_version_hash &&
      verIds.length === new Set(verIds).size &&
      required.every((r) => verIds.includes(r)) &&
      prot.length > 0 &&
      prot.every((p) => String(p).startsWith('pilot-workspace/'));
    add(
      `${id}`,
      ok,
      `status=${String(raw['status'])} schema=${loaded.ok ? 'ok' : 'FAIL'} hash绑定=${raw['gt_signed_version_hash'] === version.signed_version_hash ? 'ok' : '不匹配'} 重复id=${verIds.length === new Set(verIds).size ? 0 : 'YES'} required覆盖=${required.every((r) => verIds.includes(r)) ? 'ok' : '缺失'} protected=${prot.length}`,
    );
    if (loaded.ok) tasks.push({ id, task: loaded.task });
  }

  const preRunSpec = existsSync(path.join(ROOT, spec.preRunFile))
    ? readJsonUtf8<{ pre_runs: Record<string, { command: string; log: string }> }>(path.join(ROOT, spec.preRunFile)).pre_runs
    : {};
  const tmpBaseline = path.join(ROOT, 'pilot-workspace', '.formal-baseline.verifyall.' + spec.family + '.json');
  process.env['DSH_VERIFY_DATASET'] = 'formal';
  process.env['DSH_FORMAL_BASELINE'] = tmpBaseline;
  for (const t of tasks) {
    const dir = path.join(ROOT, 'pilot-workspace', t.id);
    rmSync(dir, { recursive: true, force: true });
    for (const s of spec.seeds) {
      if (!s.path.startsWith('pilot-workspace/' + t.id + '/')) continue;
      const p = path.join(ROOT, s.path);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, s.content, 'utf8');
    }
  }
  let preOk = true;
  for (const [id, pr] of Object.entries(preRunSpec)) {
    const script = path.join(ROOT, pr.command.split(' ')[1]!);
    const oT = path.join(ROOT, 'pilot-workspace', '.va-' + id + '.out');
    const eT = path.join(ROOT, 'pilot-workspace', '.va-' + id + '.err');
    const of = openSync(oT, 'w');
    const ef = openSync(eT, 'w');
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
    writeFileSync(
      path.join(ROOT, pr.log),
      ['# 预跑记录（冻结环境中实际执行）', 'command: ' + pr.command, 'exit_code: ' + String(code), 'stdout:', readFileSync(oT, 'utf8').trim(), 'stderr:', readFileSync(eT, 'utf8').trim(), ''].join('\n'),
      'utf8',
    );
    rmSync(oT, { force: true });
    rmSync(eT, { force: true });
    if (code === 0) preOk = false;
    console.log(`  预跑 ${id}：→ exit=${String(code)}`);
  }
  add(`${spec.family} 预跑复现（声明的失败确实发生）`, preOk, preOk ? '全部非 0' : '有预跑意外成功');

  const bl = buildBaselineFromWorkspace({ taskSetId: spec.family, taskIds: tasks.map((t) => t.id) }, { force: true });
  console.log('  临时基线：' + Object.keys(bl.files).length + ' 个文件，hash=' + bl.baseline_hash.slice(0, 12) + '…');

  let failOk = 0;
  let cfg = 0;
  let nul = 0;
  for (const t of tasks) {
    const r = verifyTask(t.task);
    if (r.success === false && r.verification_status === 'OK' && r.config_errors.length === 0) failOk++;
    if (r.config_errors.length > 0) cfg++;
    if (r.success === null) nul++;
    console.log(`  ${t.id}: success=${String(r.success)} status=${r.verification_status} CONFIG_ERROR=${r.config_errors.length}`);
  }
  add(`${spec.family} 未修复层 10/10 正确 FAIL`, failOk === tasks.length, failOk + '/' + tasks.length);
  add(`${spec.family} 无 CONFIG_ERROR`, cfg === 0, 'CONFIG_ERROR = ' + cfg);
  add(`${spec.family} 无 success=null`, nul === 0, 'success=null = ' + nul);

  let touched = 0;
  for (const f of yamlFiles) if (sha(readFileSync(path.join(TASKS, f))) !== before.get(f)) touched++;
  add(`${spec.family} 未修改任务 YAML`, touched === 0, '被改动 = ' + touched);
  add(`${spec.family} 未修改 version 文件`, sha(readFileSync(versionPath)) === versionBefore, 'ok');
  const officialAfter = existsSync(officialBaseline) ? sha(readFileSync(officialBaseline)) : null;
  add(`${spec.family} 未触碰正式 baseline`, officialBefore === officialAfter, officialBefore === null ? '正式基线不存在（本次也未创建）' : '哈希一致');
  add(`${spec.family} 未生成 formal manifest`, !existsSync(path.join(ROOT, 'pilot-manifest-formal.json')), '不存在');

  for (const t of tasks) rmSync(path.join(ROOT, 'pilot-workspace', t.id), { recursive: true, force: true });
  rmSync(tmpBaseline, { force: true });
  delete process.env['DSH_VERIFY_DATASET'];
  delete process.env['DSH_FORMAL_BASELINE'];
  console.log('  已清理 materialize 目录与临时基线');
}

console.log('\n=== 结论 ===');
console.log('  通过检查 = ' + (totalChecks - fails.length) + '/' + totalChecks);
if (fails.length) {
  console.log('  ❌ fail-closed：');
  for (const f of fails) console.log('    - ' + f);
  process.exit(3);
}
console.log('  ✅ 冻结版独立验真通过（' + selected.map((s) => s.family).join(' + ') + '）');
process.exit(0);
