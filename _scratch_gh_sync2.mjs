/**
 * _scratch_gh_sync2.mjs — 同步 OQ 裁决落地到 GitHub Issues（用后即删）
 */
const token = process.env.GH_TOKEN;
if (!token) {
  console.error('NO_TOKEN');
  process.exit(2);
}
const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'agent-praxis-sync',
  'X-GitHub-Api-Version': '2022-11-28',
};
const REPO = 'https://api.github.com/repos/fei-hua/Agent-Praxis';

async function api(path, method = 'GET', body) {
  const res = await fetch(REPO + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

// ---- #4：OQ-011 / 013 / 018 裁决落地（关闭）----
await api('/issues/4/comments', 'POST', {
  body: [
    '**裁决已落地（2026-09-27）**',
    '',
    '- ✅ **OQ-013**：采用 **nearest-rank**（`P05 = x(ceil(0.05N))`、`P95 = x(ceil(0.95N))`），`N` 写入 `experiment_config`，',
    '  只在 SNAPSHOT_01 冻结后算一次。代码：`experience/calibration.ts`（`nearestRankPercentile` / `calibrate`）。',
    '- ✅ **OQ-011**：正式口径为 **Harness / Provider 侧 token accounting**，禁止通用 tokenizer 作为正式口径；',
    '  记录 `experience_item_tokens` / `experience_context_tokens` / `experience_count`。',
    '  代码：`core/token-accounting.ts`（诊断口径 `DIAGNOSTIC_ESTIMATOR` 与 `assertFormalCounter` 拒绝机制），',
    '  并让 §5.7 的 160 / 800 预算真正按注入口径执行（此前只做了阈值/Top-K/低相关限制）。',
    '- ✅ **OQ-018**：以 Harness / Provider usage 为权威；记录 `input_tokens` / `output_tokens` / `cache_read_tokens` /',
    '  `reasoning_tokens` / `total_tokens`；缺 total 时 `total = input + output + cache_read`；reasoning 不重复计入。',
    '',
    '**顺带修掉一个真实溯源缺陷（M4）**：`harness_version` 原先在采集时读本机安装版本，而本机在 dry-run 之后',
    '被环境升级（0.1.5-rc.3 → 0.1.7-rc.2），导致环境字段与 `experiment_config_hash` 被写错（`c7013033…`）。',
    '现改为必须显式传 `--harness-version`（缺参即报错）；按 run 时版本重采后指纹恢复 `90227c3b…`，与 Phase 0 原始证据一致。',
    '',
    '测试：`npm test` 39/39 通过（新增 `tests/pilot-prep.test.ts` 15 项）；5 条 dry-run 轨迹已按新 schema 重采（事件数不变），验收仍 ✅ 全过。',
  ].join('\n'),
});
await api('/issues/4', 'PATCH', { state: 'closed', state_reason: 'completed' });
console.log('#4 closed');

// ---- #7：B 臂 Policy 已冻结（关闭）----
await api('/issues/7/comments', 'POST', {
  body: [
    '**Policy 已定义并冻结（OQ-021 裁决落地，2026-09-27）**',
    '',
    '```text',
    'B = DeepSeek V4.1 + DeepSeek Harness + Frozen Delegation Policy',
    '```',
    '',
    '7 条优先级规则（自上而下，先命中先定）：`REPLAN` → `VERIFY` → `WORKFLOW` → `PARALLEL` → `DELEGATE` → `EXPLORE` → `DIRECT`。',
    '',
    '运行约束：不读取 Experience Store、不使用 Reflection 经验、不在线更新 Policy、不按历史轨迹改规则；',
    '可正常使用 Harness Tool / Subagent / Workflow。',
    '',
    '- 代码：`policies/delegation-policy.ts`（`DELEGATION_POLICY_RULES` / `B_ARM_RUN_CONSTRAINTS` / `buildPolicyInstruction()`）',
    '- 说明：`policies/README.md`',
    '- **策略指纹**：`sha256:91185f5bbf72ae4af0fb07486968962d2e8cb12e095053a00c5e721bbe0bea42`',
    '  （任何规则改动都会改变该指纹 → 视为新实验配置）',
    '',
    '纪律：Policy 已冻结，Pilot / Formal 期间不得根据实验结果调整；`expected_delegation` 由人工预先定义，不得由 Policy 生成。',
    '',
    '下一步：B 臂运行时编排由 #8（A/B/C 三臂运行编排）承接。',
  ].join('\n'),
});
await api('/issues/7', 'PATCH', { state: 'closed', state_reason: 'completed' });
console.log('#7 closed');

// ---- #5：剩余未裁决项清单（保持开启）----
await api('/issues/5/comments', 'POST', {
  body: [
    '**裁决进度更新（2026-09-27）**',
    '',
    '- ✅ OQ-010 已裁决（两级通道：专用结构化事件优先 → 回退首轮结构化 JSON + 严格 schema + 纯代码提取）',
    '- ✅ OQ-011 / OQ-013 / OQ-018 已裁决并落地（见 #4）',
    '',
    '本 issue 剩余 **4 条**：`OQ-014`（scope 组合规则）、`OQ-015`（T1 采集通道）、`OQ-017`（stale 的 N）、',
    '`OQ-019`（failure 是否含命令非零退出）。已同步到 `spec/open-questions.md` 末尾的清查表。',
  ].join('\n'),
});
console.log('#5 commented (kept open)');
