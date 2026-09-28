/**
 * scripts/pilot-prompt.ts — 生成某个 run 的**执行提示**（executor prompt）
 *
 * 为什么需要它：臂差异必须体现在**执行方实际看到的提示**里，而不是只写在 receipt 里。
 *    A         → 只有任务书 + 协议（无 Policy、无经验）
 *    B         → 冻结 Policy + 任务书 + 协议
 *    C_frozen  → 冻结 Policy + SNAPSHOT_01 经验块 + 任务书 + 协议
 *
 * 经验块用**与采集阶段完全相同的一条确定性检索**生成（同 task profile、同快照、
 * 同标定、同禁忌相似度函数），因此"注入的上下文"与"记录下来的上下文"一致。
 *
 * 用法：node scripts/pilot-prompt.ts --run-id <run_id> [--snapshot SNAPSHOT_01] [--out pilot-runs]
 * 产出：<out>/<run_id>.prompt.md 与 <out>/<run_id>.prompt.json（记录注入内容与检索元数据）
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { FROZEN } from '../core/frozen-constants.ts';
import { COMPLEXITY, CONSTRAINTS_VOCAB, FIRST_DECISION, SCOPE } from '../core/enums.ts';
import { SPEC_EXAMPLE_VOCAB } from '../core/vocab.ts';
import { loadTask, type BenchmarkTask } from '../benchmark/tasks.ts';
import {
  retrieve,
  ruledContraindicationSimilarity,
  type CandidateExperience,
  type RetrievalQuery,
} from '../experience/retrieval.ts';
import { PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';
import { loadSnapshot } from '../experience/snapshot.ts';
import type { Experience } from '../experience/schema.ts';
import { composeExperienceBlock } from '../policies/arm-prompt.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const SNAP_DIR = path.join(PROJECT_ROOT, 'snapshots');
const TASKS_DIR_DEFAULT = path.join(PROJECT_ROOT, 'benchmark', 'tasks', 'pilot');
const PROJECT_ID = 'experience-agent-v1'; // 与采集阶段一致（Phase 0/Pilot 单项目）

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function toCandidate(e: Experience): CandidateExperience {
  return {
    id: e.id,
    task_type: e.task_type,
    complexity: e.complexity,
    characteristics: e.characteristics,
    constraints: e.constraints,
    scope: e.scope,
    project_id: PROJECT_ID,
    situation: e.situation,
    lesson: e.lesson,
    decision: e.decision,
    contraindications: e.contraindications,
    independent_support: e.independent_support,
    conflict_count: e.conflict_count,
  };
}

export interface ComposedPrompt {
  run_id: string;
  task_id: string;
  arm: string;
  prompt: string;
  injected_ids: string[];
  experience_context_tokens: number;
  token_accounting_source: string;
  serialized_context_hash: string | null;
}

export function composeRunPrompt(opts: {
  runId: string;
  tasksDir?: string;
  snapshotId?: string;
  outDir?: string;
}): ComposedPrompt {
  const outDir = path.join(PROJECT_ROOT, opts.outDir ?? 'pilot-runs');
  const planFile = path.join(outDir, `${opts.runId}.plan.json`);
  if (!existsSync(planFile)) throw new Error(`未找到 plan：${planFile}（请先运行 pilot-run --mode prepare）`);
  const plan = JSON.parse(readFileSync(planFile, 'utf8')) as {
    task_id: string;
    arm: string;
    instruction: string;
    injection: { experience: boolean; reflection: boolean; snapshot_id: string };
  };

  const tasksDir = opts.tasksDir ?? TASKS_DIR_DEFAULT;
  const loaded = loadTask(parseYaml(readFileSync(path.join(tasksDir, `${plan.task_id}.yaml`), 'utf8')));
  if (!loaded.ok) throw new Error(`任务 ${plan.task_id} 校验失败：${loaded.issues.map((i) => i.field).join(', ')}`);
  const task: BenchmarkTask = loaded.task;

  // 臂边界：只有 injection.experience 为 true 的臂才允许注入经验
  let experienceBlock = '';
  let injected_ids: string[] = [];
  let tokens = 0;
  let accountingSource = 'diagnostic';
  let contextHash: string | null = null;

  if (plan.injection.experience) {
    const snapshotId = opts.snapshotId ?? plan.injection.snapshot_id;
    const snap = loadSnapshot(SNAP_DIR, snapshotId);
    const store = snap.openReadOnly();
    const query: RetrievalQuery = {
      task_type: task.task_type,
      complexity: task.complexity as never,
      characteristics: task.characteristics,
      constraints: task.constraints as never,
      scope: task.scope as never,
      project_id: PROJECT_ID,
    };
    const candidates = store.listRetrievable().map(toCandidate);
    const queryText = [task.prompt, task.task_type, task.characteristics.join(' ')].join(' ');
    const lexical = store.bm25(queryText);
    const result = retrieve({
      query,
      candidates,
      lexical,
      calibration: PLACEHOLDER_CALIBRATION,
      environment: 'compatible',
      contraindicationSimilarity: ruledContraindicationSimilarity,
    });
    experienceBlock = composeExperienceBlock(result.serialized_context, snapshotId);
    injected_ids = result.in_context.map((s) => s.candidate.id);
    tokens = result.token_accounting.experience_context_tokens;
    accountingSource = result.token_accounting.token_accounting_source;
    contextHash = createHash('sha256').update(result.serialized_context, 'utf8').digest('hex');
  } else {
    // 非注入臂（A / B）：允许指令里出现「不读取 Experience Store」这类**禁止性**表述，
    // 但绝不允许出现经验上下文块（标记见 composeExperienceBlock）。
    if (plan.arm !== 'A' && plan.arm !== 'B') {
      throw new Error(`臂边界异常：arm=${plan.arm} 既不注入经验、也不是 A/B 臂`);
    }
  }

  const protocol = [
    '## 输出协议（必须遵守，且只在本条要求下输出该 JSON）',
    '',
    '在你的**第一条回复**里，先输出一个 ```json 代码块，内容为 task_state envelope：',
    '',
    '```json',
    '{',
    `  "schema_version": "${FROZEN.task_state_schema_version}",`,
    '  "task_state": {',
    `  "task_type": "<逐字选自：${SPEC_EXAMPLE_VOCAB.task_type.join(' | ')}>",`,
    `    "complexity": "<逐字选自：${COMPLEXITY.join(' | ')}>",`,
    `    "characteristics": ["<逐字选自：${SPEC_EXAMPLE_VOCAB.characteristics.join(' | ')}（可为空数组）>"],`,
    `    "scope": "<逐字选自：${SCOPE.join(' | ')}>",`,
    `    "constraints": ["<逐字选自：${CONSTRAINTS_VOCAB.join(' | ')}（可为空数组）>"],`,
    `    "first_decision": "<逐字选自：${FIRST_DECISION.join(' | ')}>"`,
    '  }',
    '}',
    '```',
    '',
    '取值规则（硬性）：',
    '- 所有字段的值必须**逐字选自上面列出的取值**；不得自创 token、不得改写、不得拼接或扩展枚举值；',
    '- `task_state` 的六个字段缺一不可；',
    '- `first_decision` 必须是你**第一次决策**时真正选择的动作，之后不得回改该 JSON 块；',
    '- 该 JSON 块只记录你的判断，不作为行为指令（协议不规定你应该选哪个值）。',
    '',
    '随后再开始执行任务本身。',
  ].join('\n');

  const prompt = [
    plan.instruction.trim(),
    experienceBlock.trim(),
    '## 任务',
    '',
    `工作区：仓库根为 \`D:\\Agent Praxis\\experience-agent-v1\`，任务中的相对路径均相对该目录。`,
    '',
    task.prompt.trim(),
    '',
    protocol,
  ]
    .filter((s) => s !== '')
    .join('\n\n');

  const result: ComposedPrompt = {
    run_id: opts.runId,
    task_id: plan.task_id,
    arm: plan.arm,
    prompt,
    injected_ids,
    experience_context_tokens: tokens,
    token_accounting_source: accountingSource,
    serialized_context_hash: contextHash,
  };

  // 终检：非注入臂的提示里不得出现经验上下文块标记
  if (!plan.injection.experience && prompt.includes('Frozen Action Experience')) {
    throw new Error(`臂边界异常：${plan.arm} 臂的提示里出现了经验上下文块`);
  }

  writeFileSync(path.join(outDir, `${opts.runId}.prompt.md`), prompt + '\n', 'utf8');
  writeFileSync(path.join(outDir, `${opts.runId}.prompt.json`), JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

if (process.argv[1]?.endsWith('pilot-prompt.ts')) {
  const runId = arg('run-id');
  if (!runId) throw new Error('必填参数：--run-id');
  const r = composeRunPrompt({
    runId,
    tasksDir: arg('tasks-dir'),
    snapshotId: arg('snapshot'),
    outDir: arg('out'),
  });
  console.log(`提示已生成：pilot-runs/${runId}.prompt.md`);
  console.log(
    `arm=${r.arm} 注入经验条目=${r.injected_ids.length} 上下文 token=${r.experience_context_tokens} 记账口径=${r.token_accounting_source}`,
  );
  if (r.injected_ids.length) console.log(`  注入 id：${r.injected_ids.join(', ')}`);
}
