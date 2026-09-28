/**
 * tests/pilot-gates.test.ts — Pilot 门禁回归
 *
 * 覆盖：
 *   1. OQ-014（已冻结）：scope 只做 eligibility；project 缺 project_id ⇒ 配置错误，不得 fallback
 *   2. OQ-014 同分 tie-break：project-specific 优先 → experience_id 升序
 *   3. 任务类别校验收紧：候选集 + 布尔委派属性双约束（挡掉 {DIRECT, REPLAN} 这类越界组合）
 *   4. 签署门：frozen 任务必须有 verification；draft 可缺省
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { isEligible, retrieve, type CandidateExperience, type RetrievalQuery } from '../experience/retrieval.ts';
import { PLACEHOLDER_CALIBRATION } from '../experience/calibration.ts';
import { loadTask } from '../benchmark/tasks.ts';

const candidate = (over: Partial<CandidateExperience>): CandidateExperience =>
  ({
    id: 'exp-1',
    status: 'active',
    scope: 'project',
    project_id: 'p1',
    task_type: 'bugfix',
    characteristics: [],
    constraints: [],
    situation: 's',
    lesson: 'l',
    contraindications: [],
    delegation: { agents: [], independent_subtasks: 0 },
    evidence: { run_id: 'run-1' },
    ...over,
  }) as unknown as CandidateExperience;

const query = (over: Partial<RetrievalQuery> = {}): RetrievalQuery =>
  ({ project_id: 'p1', scope: 'project', task_type: 'bugfix', characteristics: [], constraints: [] , ...over }) as unknown as RetrievalQuery;

test('OQ-014：project 经验仅同项目可检索', () => {
  assert.equal(isEligible(query({ project_id: 'p1' }), candidate({ scope: 'project', project_id: 'p1' })), true);
  assert.equal(isEligible(query({ project_id: 'p2' }), candidate({ scope: 'project', project_id: 'p1' })), false);
});

test('OQ-014：generic 经验跨项目可检索（不因项目不同被排除）', () => {
  assert.equal(isEligible(query({ project_id: 'p2' }), candidate({ scope: 'generic', project_id: 'p1' })), true);
  assert.equal(isEligible(query({ project_id: 'p1' }), candidate({ scope: 'generic', project_id: 'p1' })), true);
});

test('OQ-014：project 经验缺 project_id ⇒ 配置错误（不得 fallback 为 generic）', () => {
  assert.throws(
    () => isEligible(query({ project_id: 'p2' }), candidate({ scope: 'project', project_id: '   ' })),
    /project_id 缺失/,
  );
});

test('OQ-014：同分 tie-break = project-specific 优先 → experience_id 升序', () => {
  // 内容完全一致的候选 ⇒ 分数相同，只能靠 tie-break 决定顺序
  const base = {
    status: 'active',
    task_type: 'bugfix',
    characteristics: ['multi_file'],
    constraints: ['scope_limited'],
    situation: '同一情形',
    lesson: '同一教训',
    contraindications: [],
    independent_support: 3,
    conflict_count: 0,
    delegation: { agents: [], independent_subtasks: 0 },
    evidence: { run_id: 'run-1' },
  } as unknown as Partial<CandidateExperience>;
  const result = retrieve({
    query: query({ project_id: 'p1', characteristics: ['multi_file'], constraints: ['scope_limited'] }),
    candidates: [
      candidate({ ...base, id: 'exp-b', scope: 'generic', project_id: 'p9' }),
      candidate({ ...base, id: 'exp-c', scope: 'project', project_id: 'p1' }),
      candidate({ ...base, id: 'exp-a', scope: 'project', project_id: 'p1' }),
    ],
    lexical: new Map(),
    calibration: PLACEHOLDER_CALIBRATION,
    environment: 'compatible',
    tokenCounter: { source: 'harness', count: () => 1 },
  } as never);
  const ids = result.in_context.map((s) => s.candidate.id);
  assert.deepEqual(ids, ['exp-a', 'exp-c', 'exp-b'], 'project 优先且同 scope 内 id 升序');
});

const baseTask = (over: Record<string, unknown>): Record<string, unknown> => ({
  id: 'PILOT-X01',
  category: 'A',
  status: 'draft',
  source: 'test',
  task_type: 'bugfix',
  complexity: 'simple',
  scope: 'project',
  characteristics: [],
  constraints: ['scope_limited'],
  prompt: '测试任务',
  expected_first_decisions: ['DIRECT'],
  success_criteria: { required: ['r1'], forbidden: [] },
  ...over,
});

test('任务类别校验：签署放行的等价集可加载（A02 形态）', () => {
  const r = loadTask(baseTask({ expected_first_decisions: ['DIRECT', 'EXPLORE'], expected_delegation: false }));
  assert.equal(r.ok, true);
});

test('任务类别校验：布尔属性一致但越出候选集的组合必须被拒（DIRECT + REPLAN）', () => {
  const r = loadTask(baseTask({ expected_first_decisions: ['DIRECT', 'REPLAN'] }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.issues.map((i) => i.message).join(' '), /候选集/);
});

test('任务类别校验：越出委派轴的取值必须被拒（A 类出现 PARALLEL）', () => {
  const r = loadTask(baseTask({ expected_first_decisions: ['PARALLEL'] }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.issues.map((i) => i.message).join(' '), /候选集|委派轴/);
});

test('签署门：frozen 任务缺 verification 必须被拒；draft 允许缺省', () => {
  const draft = loadTask(baseTask({ status: 'draft' }));
  assert.equal(draft.ok, true, 'draft 可暂缺 verification');
  const frozen = loadTask(baseTask({ status: 'frozen' }));
  assert.equal(frozen.ok, false, 'frozen 必须有 verification');
  if (!frozen.ok) assert.match(frozen.issues.map((i) => i.message).join(' '), /verification/);
});
