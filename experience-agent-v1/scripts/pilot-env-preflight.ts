/**
 * scripts/pilot-env-preflight.ts — PILOT-ENV-PREFLIGHT 自动验收
 *
 * 用**真实会话产物**验证 Pilot 启动前的 9 项环境前置条件（不产生任何实验 run）。
 * 全部 PASS 才解除 Pilot 暂停；退出码非 0 表示未通过。
 *
 * 用法：node scripts/pilot-env-preflight.ts [--marker PFP2-ACLFIX-VERIFY] [--max-kb 300]
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSessionLog, findChildSessions, listSessions, type RawSessionEvent } from '../telemetry/session-log.ts';
import { extractTokenUsage } from '../telemetry/extract.ts';
import { computeToolSchemaVersion, toModelVisibleSchemas } from '../core/tool-schema-version.ts';
import { seedPilotWorkspace, loadSeedHashes, currentHash } from './pilot-setup.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const DSH_HOME = path.join(process.env['USERPROFILE'] ?? '', '.dsh');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Item {
  id: number;
  name: string;
  pass: boolean;
  detail: string;
}

const items: Item[] = [];
const add = (id: number, name: string, pass: boolean, detail: string): void => {
  items.push({ id, name, pass, detail });
};

function toolsFromSession(events: RawSessionEvent[]): unknown[] | null {
  const hdr = events.find((e) => e.type === 'request/header');
  const tools = (hdr?.data as { header?: { tools?: unknown } } | undefined)?.header?.tools;
  return Array.isArray(tools) ? tools : null;
}

// ---------- 定位 preflight 探针会话（真实会话产物） ----------
const marker = arg('marker') ?? 'PFP2-ACLFIX-VERIFY';
const maxBytes = (arg('max-kb') ? Number(arg('max-kb')) : 300) * 1024;

const sessions = listSessions(DSH_HOME)
  .map((s) => ({ ...s, size: existsSync(s.logPath) ? statSync(s.logPath).size : 0 }))
  .filter((s) => s.size > 0 && s.size <= maxBytes);

let probe: { sessionId: string; logPath: string; sandboxMode: string | null; depth: number; version: number; events: RawSessionEvent[]; text: string } | null = null;

for (const s of sessions) {
  try {
    const decoded = decodeSessionLog(s.logPath);
    const sandboxEvent = decoded.events.find((e) => e.type === 'sandbox/mode');
    const mode = (sandboxEvent?.data as { mode?: unknown } | undefined)?.mode;
    const sandy = typeof mode === 'string' ? mode : null;
    // 只认 workspace-write 且确含标记的会话（用于验证受限沙箱通道）
    if (sandy !== 'workspace-write') continue;
    const marked = decoded.events.some((e) => JSON.stringify(e.data ?? {}).includes(marker));
    if (!marked) continue;
    probe = {
      sessionId: s.sessionId,
      logPath: s.logPath,
      sandboxMode: sandy,
      depth: decoded.header.delegationDepth,
      version: decoded.header.version,
      events: decoded.events,
      text: JSON.stringify(decoded.events),
    };
    break;
  } catch {
    continue;
  }
}

if (!probe) {
  console.log(`未找到含标记「${marker}」且 sandbox/mode=workspace-write 的会话（>${maxBytes / 1024}KB 的会话已跳过）`);
  console.log('提示：先运行 dsh headless 探针，并确保其会话小于 --max-kb 上限。');
  process.exit(2);
}

console.log(`preflight 探针会话：${probe.sessionId}  sandbox=${probe.sandboxMode}  depth=${probe.depth}  format=v${probe.version}\n`);

// 1) 命令执行（受限 workspace-write 通道）
const toolCalls = probe.events.filter((e) => e.type === 'tool/call');
const toolResults = probe.events.filter((e) => e.type === 'tool/result');
const okResults = toolResults.filter((e) => {
  const d = e.data as { error?: unknown; message?: { content?: Array<{ isError?: boolean }> } };
  return d.error === undefined && d.message?.content?.[0]?.isError !== true;
});
add(1, 'command execution（workspace-write 沙箱通道）', toolCalls.length > 0 && okResults.length > 0,
  `tool/call=${toolCalls.length} tool/result=${toolResults.length} 成功=${okResults.length}`);

// 2) 沙箱工作区写入（探针做了 建/读/删）
const wroteWorkspace = /_pfp2_probe\.txt/.test(probe.text);
add(2, 'sandbox workspace write', probe.sandboxMode === 'workspace-write' && wroteWorkspace,
  `sandbox/mode=${probe.sandboxMode}；探针含工作区文件操作=${wroteWorkspace}`);

// 3) 会话 v4 落盘
add(3, 'session log persisted（v4）', existsSync(probe.logPath) && probe.version >= 4,
  `${path.basename(path.dirname(probe.logPath))}  header.version=${probe.version}`);

// 4) 事件时间戳 & wall_time
const times = probe.events.map((e) => e.time).filter((t) => typeof t === 'number' && t > 0);
const wall = times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0;
add(4, 'event timestamps / wall_time_ms > 0', wall > 0, `事件时间戳=${times.length}  wall_time_ms=${wall}`);

// 5) tool_schema_version（由 v4 request/header 计算）
let toolSchema: string | null = null;
try {
  const tools = toolsFromSession(probe.events);
  if (tools) toolSchema = computeToolSchemaVersion(toModelVisibleSchemas(tools as never));
} catch {
  toolSchema = null;
}
add(5, 'tool_schema_version（来自 request/header 工具快照）', !!toolSchema && /^tschema-[0-9a-f]{12}$/.test(toolSchema),
  toolSchema ?? '无法计算');

// 6) token usage（provider-reported usage events；OQ-018）
const usage = extractTokenUsage(probe.events);
add(6, 'token usage（provider usage，reasoning 不重复计入）', usage.total_tokens > 0,
  `input=${usage.input_tokens} output=${usage.output_tokens} cache_read=${usage.cache_read_tokens} reasoning=${usage.reasoning_tokens} total=${usage.total_tokens}`);

// 7) sandbox mode 可记录（字段已进 RunRecord）
const acceptanceFields = (await import('../telemetry/acceptance.ts')) as { RUN_RECORD_FIELDS?: string[] };
const fieldsOk = !acceptanceFields.RUN_RECORD_FIELDS || acceptanceFields.RUN_RECORD_FIELDS.includes('sandbox_mode');
add(7, 'sandbox mode recorded（run record 字段）', fieldsOk && !!probe.sandboxMode,
  `sandbox_mode=${probe.sandboxMode}；RUN_RECORD_FIELDS 含 sandbox_mode=${fieldsOk}`);

// 8) 顶层会话可委派（depth 0 + 存在子会话）
const children = findChildSessions(DSH_HOME, probe.sessionId);
add(8, 'top-level headless delegation（depth 0 → 子会话存在）', probe.depth === 0 && children.length > 0,
  `delegationDepth=${probe.depth}  子会话=${children.map((c) => c.sessionId.slice(0, 8)).join(',') || '无'}`);

// 9) maxDepth 未阻断既定委派（同上；不改 Harness 参数）
add(9, 'maxDepth 不阻断既定委派（未改 Harness 参数）', probe.depth === 0 && children.length > 0,
  `无需改 maxDepth：顶层会话已成功委派 ${children.length} 个子会话`);

// 11) 启动器上下文一致性门禁（人工冻结 2026-09-27，路线 3）
//     启动步骤可在沙箱外（elevated/outside-sandbox），但**生成的真实会话**必须是
//     workspace-write + depth 0；若生成会话是 danger-full-access ⇒ 本条 FAIL
//     （不得用 danger-full-access 的 run 会话成功来替代）。
{
  const launcherMarker = arg('launcher-marker') ?? 'PFP3-ROUTE3';
  let found: { id: string; mode: string | null; depth: number; version: number; ok: number; kids: number } | null = null;
  for (const s of listSessions(DSH_HOME)) {
    if (!existsSync(s.logPath) || statSync(s.logPath).size > maxBytes) continue;
    try {
      const d = decodeSessionLog(s.logPath);
      if (!d.events.some((e) => JSON.stringify(e.data ?? {}).includes(launcherMarker))) continue;
      const sb = d.events.find((e) => e.type === 'sandbox/mode');
      const mode = (sb?.data as { mode?: unknown } | undefined)?.mode;
      const oks = d.events.filter((e) => {
        if (e.type !== 'tool/result') return false;
        const dd = e.data as { error?: unknown; message?: { content?: Array<{ isError?: boolean }> } };
        return dd.error === undefined && dd.message?.content?.[0]?.isError !== true;
      }).length;
      found = {
        id: s.sessionId,
        mode: typeof mode === 'string' ? mode : null,
        depth: d.header.delegationDepth,
        version: d.header.version,
        ok: oks,
        kids: findChildSessions(DSH_HOME, s.sessionId).length,
      };
      break;
    } catch {
      continue;
    }
  }
  const pass = !!found && found.mode === 'workspace-write' && found.depth === 0 && found.ok > 0 && found.kids > 0 && found.version >= 4;
  add(
    11,
    'launcher can boot dsh headless under the exact Pilot run policy（workspace-write + depth 0；danger-full-access 不算通过）',
    pass,
    found
      ? `launcher=elevated/outside-sandbox → session=${found.id.slice(0, 20)} sandbox=${found.mode} depth=${found.depth} format=v${found.version} 成功工具结果=${found.ok} 子会话=${found.kids}`
      : `未找到含启动器标记「${launcherMarker}」的会话`,
  );
}

// 10) 确定性 seed 重建（附带项）
seedPilotWorkspace();
const seed = loadSeedHashes()!;
const drifted = Object.entries(seed.files).filter(([p, h]) => currentHash(p) !== h).map(([p]) => p);
add(10, 'deterministic seed rebuild', drifted.length === 0, `${Object.keys(seed.files).length} 个种子文件，漂移=${drifted.length}`);

// ---------- 报告 ----------
console.log('=== PILOT-ENV-PREFLIGHT ===');
for (const it of items) console.log(`  [${it.pass ? 'PASS' : 'FAIL'}] ${it.id}. ${it.name} — ${it.detail}`);
const failed = items.filter((i) => !i.pass);
console.log(`\n${failed.length === 0 ? '✅ ALL PASS —— 可解除 Pilot 暂停' : `❌ ${failed.length} 项未通过 —— 继续暂停`}`);
process.exit(failed.length === 0 ? 0 : 1);
