/**
 * scripts/formal-slots.ts — 正式实验 120 个任务槽的**注册表 + fail-closed 校验门禁**
 *
 * 冻结结构（Protocol v2 §4.2，人工确认 2026-09-30）：
 *   12 个任务族 × 每族 10 个变体 = 120 个全新任务实例
 *   每族对每一类别恰好贡献 2 个变体 ⇒ 每类 12 × 2 = 24
 *   A = B = C = D = E = 24
 *
 * 用法：
 *   node scripts/formal-slots.ts --emit     生成 slots.json + 任务模板 + 作者说明
 *   node scripts/formal-slots.ts            校验（缺任务/未签 GT/类别不符 ⇒ exit 3）
 *
 * 纪律：任务内容一旦签署即冻结；GT、期望第一步决策集合、验证规则**不得**因试跑结果调整。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { loadTask } from '../benchmark/tasks.ts';
import { readJsonUtf8, writeJsonUtf8 } from './lib/json-io.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const FORMAL_DIR = path.join(ROOT, 'benchmark', 'formal');
const TASKS_DIR = path.join(ROOT, 'benchmark', 'tasks', 'formal');
const SLOTS_FILE = path.join(FORMAL_DIR, 'slots.json');

const FAMILIES = Array.from({ length: 12 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`);
const CATEGORIES = ['A', 'B', 'C', 'D', 'E'] as const;
const PER_CATEGORY = 2; // 每族每类 2 个变体

interface Slot { slot_id: string; task_id: string; family: string; category: string; variant_index: number }

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  for (const family of FAMILIES) {
    for (const category of CATEGORIES) {
      for (let k = 1; k <= PER_CATEGORY; k++) {
        const taskId = `FORMAL-${family}-${category}${k}`;
        slots.push({ slot_id: taskId, task_id: taskId, family, category, variant_index: k });
      }
    }
  }
  return slots;
}

const slots = buildSlots();

// ---------- 结构性不变量（不满足直接失败） ----------
const familyCount = new Set(slots.map((s) => s.family)).size;
const perCategoryCounts = Object.fromEntries(CATEGORIES.map((c) => [c, slots.filter((s) => s.category === c).length]));
const perFamilyCounts = FAMILIES.map((f) => slots.filter((s) => s.family === f).length);
const invariants: Array<[string, boolean, string]> = [
  ['12 族 × 10 变体 = 120', slots.length === 120 && familyCount === 12 && perFamilyCounts.every((n) => n === 10), `slots=${slots.length} family=${familyCount} perFamily=[${perFamilyCounts.join(',')}]`],
  ['A=B=C=D=E=24', CATEGORIES.every((c) => perCategoryCounts[c] === 24), JSON.stringify(perCategoryCounts)],
  ['每族 2/2/2/2/2', FAMILIES.every((f) => CATEGORIES.every((c) => slots.filter((s) => s.family === f && s.category === c).length === 2)), 'ok'],
  ['task_id 唯一', new Set(slots.map((s) => s.task_id)).size === slots.length, 'ok'],
];

console.log('=== 正式实验任务槽注册表 ===');
for (const [name, ok, detail] of invariants) console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name} — ${detail}`);
const invariantOk = invariants.every(([, ok]) => ok);

if (process.argv.includes('--emit')) {
  mkdirSync(FORMAL_DIR, { recursive: true });
  mkdirSync(TASKS_DIR, { recursive: true });
  const payload = {
    dataset: 'formal_experiment',
    generated_at: new Date().toISOString(),
    structure: { families: 12, variants_per_family: 10, per_family_per_category: PER_CATEGORY, per_category: 24, total: 120 },
    invariants_ok: invariantOk,
    slots,
  };
  writeJsonUtf8(SLOTS_FILE, payload);
  console.log(`\n已写出：benchmark/formal/slots.json（${slots.length} 个槽）`);

  const template = `# 正式实验任务模板（作者复制后改名，例如 FORMAT-F01-A1.yaml）
# 纪律：GT、expected_first_decisions、verification 一旦签署即冻结，不得因试跑结果调整。
id: FORMAL-F01-A1            # 必须与 slots.json 的 task_id 完全一致
title: <简短标题>
category: A                  # A|B|C|D|E，必须与 slots.json 中该槽的 category 一致
status: draft                # draft → frozen（需 GT 签署；formal 运行拒绝 draft）
gt_signed_by: ""             # 签署人（冻结前必须填写）
gt_signed_at: ""             # ISO 时间戳
expected_first_decisions:    # 签署的期望第一步决策等价集（可多值）
  - DIRECT
expected_delegation: false   # 该任务是否**期望**发生委派（与候选集/布尔轴校验一致）
instruction: |
  <交给 Agent 的任务描述：不得包含委派指令（与 Pilot 的 Q1 裁决一致）>
allowed_paths:
  - pilot-workspace/FORMAL-F01-A1/
protected_paths:
  - pilot-workspace/FORMAL-F01-A1/verify.js
verification:
  - kind: command_exit_zero
    command: node pilot-workspace/FORMAL-F01-A1/verify.js
seeds:
  - path: pilot-workspace/package.json
    content: |
      {"type":"commonjs"}
  # …该变体自己的种子文件（必须独立编写，不得从 Pilot 锚点复制 GT）
`;
  writeFileSync(path.join(TASKS_DIR, 'TEMPLATE.yaml'), template, 'utf8');
  const readme = `# 正式实验任务（benchmark/tasks/formal/）

结构（Protocol v2 §4.2 冻结）：12 族 × 每族 10 变体 = 120；每族对 A–E 各 2 个 ⇒ 每类 24。

## 造任务的硬性规则

1. **槽位一致**：文件名 = \`<task_id>.yaml\`，\`id\` 与 \`category\` 必须与 \`benchmark/formal/slots.json\` 一致。
2. **GT 独立**：每个变体的 ground truth 必须**独立制作并签署**；不得复制 Pilot 锚点或其他变体的 GT。
3. **Pilot 的 10 个任务不进入正式样本**（仅作族/难度锚点与 GT 参考）。
4. **期望决策集合**：\`expected_first_decisions\` 与 \`expected_delegation\` 必须与候选集/布尔轴校验一致
   （沿用 \`benchmark/tasks.ts\` 的校验；候选集 + 委派轴布尔值）。
5. **验证规则**：只用已冻结的 verification 种类
   （command_exit_zero / output_contains / file_exists / file_changed / file_unchanged / files_unchanged / file_contains）；
   \`frozen\` 状态必须有 verification。
6. **种子独立**：每个变体自带 seeds（含 \`pilot-workspace/package.json\` = \`{"type":"commonjs"}\`，M3 边界）。
7. **冻结纪律**：\`status: frozen\` 且 \`gt_signed_by\`/\`gt_signed_at\` 非空之前，正式 manifest **不会**纳入该任务；
   签署后 GT、期望集合、验证规则**不得**再改。
8. **不得含委派指令**：任务描述里不能出现"请委派/并行/用 workflow"等指令（与 Pilot Q1 裁决一致）。

## 校验

\`node scripts/formal-slots.ts\` —— 结构性不变量 + 每槽任务文件检查（缺/未签/类别不符 ⇒ exit 3）。
`;
  writeFileSync(path.join(TASKS_DIR, 'README.md'), readme, 'utf8');
  console.log('已写出：benchmark/tasks/formal/TEMPLATE.yaml 与 README.md');
}

// ---------- 逐槽校验（fail-closed） ----------
console.log('\n=== 逐槽校验（fail-closed） ===');
const missing: string[] = [];
const notFrozen: string[] = [];
const badCategory: string[] = [];
const schemaBad: string[] = [];
let frozen = 0;
for (const slot of slots) {
  const file = path.join(TASKS_DIR, `${slot.task_id}.yaml`);
  if (!existsSync(file)) { missing.push(slot.task_id); continue; }
  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch (e) {
    schemaBad.push(`${slot.task_id}（YAML 解析失败：${(e as Error).message}）`);
    continue;
  }
  if (parsed['category'] !== slot.category) badCategory.push(`${slot.task_id}（应为 ${slot.category}，实为 ${String(parsed['category'])}）`);
  const loaded = loadTask(parseYaml(readFileSync(file, 'utf8')) as Record<string, unknown>);
  if (!loaded.ok) { schemaBad.push(`${slot.task_id}（schema：${JSON.stringify(loaded.issues ?? [])}）`); continue; }
  if (loaded.task.status !== 'frozen' || !String(parsed['gt_signed_by'] ?? '').trim() || !String(parsed['gt_signed_at'] ?? '').trim()) {
    notFrozen.push(slot.task_id);
  } else {
    frozen++;
  }
}
console.log(`  槽位总数        = ${slots.length}`);
console.log(`  已冻结（可入正式 manifest）= ${frozen}`);
console.log(`  未冻结/未签 GT  = ${notFrozen.length}`);
console.log(`  任务文件缺失    = ${missing.length}`);
console.log(`  类别不符        = ${badCategory.length}`);
console.log(`  schema 不合规   = ${schemaBad.length}`);
for (const [label, arr] of [['缺失', missing], ['未冻结', notFrozen], ['类别不符', badCategory], ['schema', schemaBad]] as const) {
  if (arr.length) console.log(`    ${label}（前 5）：${arr.slice(0, 5).join(', ')}${arr.length > 5 ? ` …共 ${arr.length}` : ''}`);
}
const gateOk = invariantOk && missing.length === 0 && notFrozen.length === 0 && badCategory.length === 0 && schemaBad.length === 0;
console.log(gateOk ? '\n✅ 门禁通过：120 个槽全部冻结且合规（可生成正式 manifest）' : '\n⛔ 门禁未通过：正式 manifest 不得生成，正式实验不得开跑');
process.exit(gateOk ? 0 : 3);
