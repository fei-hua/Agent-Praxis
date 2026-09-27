/**
 * scripts/dryrun-setup.ts — Phase 0 dry-run 环境播种（确定性、可重复运行、无外部状态依赖）
 *
 * 1. 创建 dry-run-workspace/ 种子文件 + SHA-256 清单（用于「禁改文件哈希不变」判定）；
 * 2. 经验 fixtures（OQ-007：synthetic，仅 Phase 0 用途，不进 Pilot）→ validateExperience → ExperienceStore；
 * 3. createSnapshot → SNAPSHOT_01（只读快照，T9）。
 *
 * 用法：node scripts/dryrun-setup.ts
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExperienceStore } from '../experience/store.ts';
import { createSnapshot } from '../experience/snapshot.ts';
import { validateExperience, type Experience } from '../experience/schema.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const WS_DIR = path.join(PROJECT_ROOT, 'dry-run-workspace');
const STORE_PATH = path.join(PROJECT_ROOT, 'experience-store', 'dryrun.db');
const SNAP_DIR = path.join(PROJECT_ROOT, 'snapshots');
const FIXTURES_OUT = path.join(PROJECT_ROOT, 'benchmark', 'fixtures', 'dryrun-experiences.json');

/** OQ-016 裁决：harness_version 来自 Harness package 版本 */
const HARNESS_PKG = 'C:\\Users\\asus\\AppData\\Local\\npm-cache\\_npx\\1e7f6d9597241db0\\node_modules\\@deepseek-ai\\dsh\\package.json';

function sha256(s: string | Buffer): string {
  return createHash('sha256').update(s).digest('hex');
}

// ---------- 1. 工作区种子 ----------

const SEEDS: Record<string, string> = {
  // 工作区模块解析声明：种子脚本是 CommonJS，而父项目 package.json 是 "type":"module"，
  // 若不在此显式声明，dry-run 内 .js 会被按 ESM 解析导致 require 失败（首轮 dry-run 实证）。
  'package.json': `{
  "name": "experience-agent-v1-dryrun-workspace",
  "private": true,
  "type": "commonjs"
}
`,
  'DRY-01/src/counter.js': `// 种子：简单计数器模块（测试目标，禁改）
'use strict';
let count = 0;
function increment(by = 1) { count += by; return count; }
function reset() { count = 0; return count; }
function current() { return count; }
module.exports = { increment, reset, current };
`,
  'DRY-02/mini-lib/alpha.js': `// 种子：alpha 基础格式化（禁改）
'use strict';
function formatName(name) { return String(name).trim().toLowerCase(); }
module.exports = { formatName };
`,
  'DRY-02/mini-lib/beta.js': `// 种子：beta 调用 alpha（禁改）
'use strict';
const { formatName } = require('./alpha');
function greet(name) { return 'hello, ' + formatName(name); }
module.exports = { greet };
`,
  'DRY-02/mini-lib/gamma.js': `// 种子：gamma 调用 beta（禁改）
'use strict';
const { greet } = require('./beta');
function greetAll(names) { return names.map(greet).join('; '); }
module.exports = { greetAll };
`,
  'DRY-03/ui.css': `/* 种子：间距不合规的 UI 样式（按 8pt 规格升级；选择器结构禁改） */
.card { margin: 5px; padding: 7px; }
.button { margin: 13px 3px; padding: 21px 9px; }
.nav { margin: 2px; padding: 11px 15px; }
`,
  'DRY-04/schema.json': `{
  "fields": [
    { "name": "id", "type": "string", "required": true },
    { "name": "created_at", "type": "string", "required": true },
    { "name": "amount", "type": "number", "required": true },
    { "name": "tags", "type": "array", "required": false }
  ]
}
`,
  'DRY-04/verify-schema.js': `// 种子：schema 校验脚本（对 schema.json 断言，禁改）
'use strict';
const fs = require('fs');
const path = require('path');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const allowed = ['string', 'number', 'array', 'boolean'];
let failed = 0;
for (const f of schema.fields) {
  if (typeof f.name !== 'string' || !f.name) { console.log('bad name: ' + JSON.stringify(f)); failed++; }
  if (!allowed.includes(f.type)) { console.log('bad type: ' + f.type); failed++; }
  if (typeof f.required !== 'boolean') { console.log('bad required: ' + f.name); failed++; }
}
if (failed > 0) { console.log('SCHEMA BAD'); process.exit(1); }
console.log('SCHEMA OK');
`,
  'DRY-05/run-check.js': `// 种子：检查脚本（读取 config.json 并断言三项；断言禁删）
'use strict';
const fs = require('fs');
const path = require('path');
let failed = 0;
function assert(cond, msg) { if (cond) { console.log('ok - ' + msg); } else { failed++; console.log('FAIL - ' + msg); } }
const configPath = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.log('run-check failed: config.json unreadable (' + e.message + ')');
  process.exit(1);
}
assert(typeof config.threshold === 'number', 'threshold 是数字');
assert(config.threshold > 0 && config.threshold <= 1, 'threshold 在 (0,1]');
assert(config.name === 'dry-05', 'name 为 dry-05');
if (failed > 0) { console.log('CHECK FAIL'); process.exit(1); }
console.log('ALL PASS');
`,
};

function seedWorkspace(): void {
  // 默认重置（dry-run 可重复运行）；--no-reset 保留上次产物
  if (!process.argv.includes('--no-reset') && existsSync(WS_DIR)) {
    rmSync(WS_DIR, { recursive: true, force: true });
    console.log(`已重置工作区：${WS_DIR}`);
  }
  mkdirSync(WS_DIR, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const [rel, content] of Object.entries(SEEDS)) {
    const p = path.join(WS_DIR, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, content);
    hashes[rel] = sha256(content);
  }
  // config.json 故意缺失（DRY-05 的失败现场），在清单里显式记录
  const manifest = {
    note: 'dry-run 种子哈希清单；DRY-05/config.json 故意缺失（失败现场）。哈希算法 SHA-256，内容为文件原文。',
    seeded_at: new Date().toISOString(),
    files: hashes,
    intentionally_missing: ['DRY-05/config.json'],
  };
  writeFileSync(path.join(WS_DIR, 'seed-hashes.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`workspace 播种完成：${Object.keys(hashes).length} 个种子文件 → ${WS_DIR}`);
}

// ---------- 2. 经验 fixtures ----------

function fixtureExperiences(): Experience[] {
  return [
    {
      id: 'EXP-DRY-UI-DELEGATE',
      status: 'validated',
      scope: 'project',
      task_type: 'ui_upgrade',
      complexity: 'medium',
      characteristics: ['multi_page'],
      constraints: ['scope_limited', 'no_public_interface_change'],
      situation: '多页面间距/样式升级且要求 UI 越界风险审查',
      decision: 'DELEGATE',
      delegation: { mode: 'serial', agents: ['ui-reviewer'] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 12000, subagent_calls: 1, wall_time_s: 180 },
      evidence: {
        run_id: 'run-fixture-ui-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-ui-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '间距升级委派 ui-reviewer 做越界审查',
      contraindications: [],
      conflict_count: 0,
      independent_support: 3,
    },
    {
      id: 'EXP-DRY-DATA-PARALLEL',
      status: 'validated',
      scope: 'project',
      task_type: 'data_layer',
      complexity: 'medium',
      characteristics: ['multi_file', 'shared_state'],
      constraints: ['data_schema_immutable', 'scope_limited'],
      situation: '数据层两线工作：schema 核对与校验脚本执行互不依赖',
      decision: 'PARALLEL',
      delegation: { mode: 'parallel', agents: ['explorer', 'tester'] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 15000, subagent_calls: 2, wall_time_s: 210 },
      evidence: {
        run_id: 'run-fixture-data-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-data-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '独立数据线并行拆给 explorer 与 tester',
      contraindications: [],
      conflict_count: 0,
      independent_support: 2,
    },
    {
      id: 'EXP-DRY-DOC-EXPLORE',
      status: 'validated',
      scope: 'project',
      task_type: 'doc',
      complexity: 'simple',
      characteristics: ['multi_file'],
      constraints: ['scope_limited'],
      situation: '写模块文档前需要先摸清文件与调用关系',
      decision: 'EXPLORE',
      delegation: { mode: 'serial', agents: ['explorer'] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 8000, subagent_calls: 1, wall_time_s: 120 },
      evidence: {
        run_id: 'run-fixture-doc-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-doc-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '先 explore 摸清模块调用再落笔写文档',
      contraindications: [],
      conflict_count: 0,
      independent_support: 2,
    },
    {
      id: 'EXP-DRY-TEST-DIRECT',
      status: 'validated',
      scope: 'project',
      task_type: 'test',
      complexity: 'simple',
      characteristics: [],
      constraints: ['scope_limited'],
      situation: '单模块冒烟测试，范围小且无未知面',
      decision: 'DIRECT',
      delegation: { mode: 'serial', agents: [] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 5000, subagent_calls: 0, wall_time_s: 60 },
      evidence: {
        run_id: 'run-fixture-test-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-test-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '单文件冒烟测试直接做，不委派',
      contraindications: [],
      conflict_count: 0,
      independent_support: 3,
    },
    {
      id: 'EXP-DRY-GENERIC-STALE',
      status: 'stale',
      scope: 'generic',
      task_type: 'refactor',
      complexity: 'simple',
      characteristics: ['multi_file'],
      constraints: ['no_new_dependency'],
      situation: '泛化重构经验（示例库，含禁忌标记）',
      decision: 'EXPLORE',
      delegation: { mode: 'serial', agents: ['explorer'] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 9000, subagent_calls: 1, wall_time_s: 150 },
      evidence: {
        run_id: 'run-fixture-gen-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-gen-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '重构前先定位调用关系再动手',
      contraindications: ['multi_page', 'shared_state'],
      conflict_count: 0,
      independent_support: 1,
    },
    {
      id: 'EXP-DRY-CANDIDATE-01',
      status: 'candidate',
      scope: 'project',
      task_type: 'bugfix',
      complexity: 'medium',
      characteristics: ['multi_file'],
      constraints: ['scope_limited'],
      situation: '修复类任务在失败后需要重新规划路径',
      decision: 'REPLAN',
      delegation: { mode: 'serial', agents: [] },
      outcome: { success: true, task_success_criteria_met: true, forbidden_violation: false, tokens: 11000, subagent_calls: 0, wall_time_s: 170 },
      evidence: {
        run_id: 'run-fixture-bug-01',
        trajectory_ref: 'telemetry/trajectories/run-fixture-bug-01.jsonl',
        harness_version: '0.1.5-rc.3',
        tool_schema_version: 'tschema-19751aa066b9',
        framework_version: '1.0',
        evidence_complete: true,
      },
      lesson: '失败后先更新 task state 再重规划',
      contraindications: [],
      conflict_count: 0,
      independent_support: 1,
    },
  ];
}

// ---------- 3. store + SNAPSHOT_01 ----------

function main(): void {
  if (!existsSync(HARNESS_PKG)) {
    throw new Error(`harness_version 来源不存在（OQ-016 裁决：Harness package 版本）：${HARNESS_PKG}`);
  }
  const harnessVersion = (JSON.parse(readFileSync(HARNESS_PKG, 'utf8')) as { version?: string }).version;
  if (!harnessVersion) throw new Error('Harness package.json 缺 version 字段');

  seedWorkspace();

  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  if (existsSync(STORE_PATH)) rmSync(STORE_PATH); // 可重复运行：重建 store
  const store = new ExperienceStore(STORE_PATH);
  const fixtures = fixtureExperiences();
  for (const exp of fixtures) {
    const v = validateExperience(exp);
    if (!v.ok) {
      throw new Error(`fixture ${exp.id} 未通过 schema 校验：${v.issues.map((i) => `${i.field}:${i.message}`).join('; ')}`);
    }
    store.upsert(v.value);
  }
  mkdirSync(path.dirname(FIXTURES_OUT), { recursive: true });
  writeFileSync(FIXTURES_OUT, JSON.stringify(fixtures, null, 2) + '\n');
  console.log(`fixtures 写入 ${fixtures.length} 条 → store=${STORE_PATH}，审计副本 → ${FIXTURES_OUT}`);
  console.log(`harness_version（OQ-016 来源）= ${harnessVersion}`);

  const snapDbPath = path.join(SNAP_DIR, 'SNAPSHOT_01.db');
  if (existsSync(snapDbPath)) {
    // 快照语义要求不可变：内容确定（fixtures 固定），已存在则不重建、不覆盖
    console.log(`SNAPSHOT_01 已存在，保持不可变（不重建）：${snapDbPath}`);
    return;
  }
  const snap = createSnapshot({ storeDbPath: STORE_PATH, snapshotId: 'SNAPSHOT_01', snapshotsDir: SNAP_DIR });
  console.log(`SNAPSHOT_01 创建完成（只读）：${snap.db_path}`);
}

main();
