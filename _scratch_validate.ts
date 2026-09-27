// scratch：真实会话日志验证（用后即删）
import { listSessions, decodeSessionLog } from './experience-agent-v1/telemetry/session-log.ts';
import { extractToolCalls, extractToolResults, extractTokenUsage, extractModelId, extractSubagentInvocations } from './experience-agent-v1/telemetry/extract.ts';
import { computeToolSchemaVersion, toModelVisibleSchemas } from './experience-agent-v1/core/tool-schema-version.ts';

const home = process.env['USERPROFILE'] + '/.dsh';
const sessions = listSessions(home);
console.log('sessions found:', sessions.length);
for (const s of sessions.slice(-4)) {
  const log = decodeSessionLog(s.logPath);
  const counts = new Map();
  for (const e of log.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  console.log('---', s.sessionId, 'parent:', log.header.parentSession ?? '-', 'events:', log.events.length);
  console.log('   types:', [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => `${t}=${n}`).join(' '));

  const calls = extractToolCalls(log.events);
  const results = extractToolResults(log.events);
  const paired = calls.filter((c) => results.some((r) => r.call_id === c.call_id)).length;
  console.log('   tool calls:', calls.length, 'results:', results.length, 'paired:', paired);
  console.log('   usage:', JSON.stringify(extractTokenUsage(log.events)), 'model:', extractModelId(log.events));

  const reqHeader = log.events.find((e) => e.type === 'request/header');
  const tools = (reqHeader?.data as any)?.header?.tools;
  if (Array.isArray(tools)) {
    console.log('   tools snapshot:', tools.length, 'tool_schema_version:', computeToolSchemaVersion(toModelVisibleSchemas(tools)));
    console.log('   tool names:', toModelVisibleSchemas(tools).map((t) => t.name).sort().join(','));
  } else {
    console.log('   tools snapshot: <none in first request/header>');
  }
  const subs = extractSubagentInvocations(log.events);
  console.log('   subagent invocations:', subs.invocations.length, 'results:', subs.results.length,
    subs.invocations.map((i) => `${i.agent_name}/${i.tool_name ?? '?'}`).join(' '));
}
