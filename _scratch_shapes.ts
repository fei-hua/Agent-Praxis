// scratch3：subagent/workflow 事件真实形状 + usage 口径（用后即删）
import { listSessions, decodeSessionLog } from './experience-agent-v1/telemetry/session-log.ts';

const home = process.env['USERPROFILE'] + '/.dsh';
const sessions = listSessions(home);
const seen = new Map();
for (const s of sessions) {
  let log;
  try { log = decodeSessionLog(s.logPath); } catch { continue; }
  for (const e of log.events) {
    if (/subagent|workflow|usage|catalog|descriptor/.test(e.type) && !seen.has(e.type)) {
      seen.set(e.type, { sessionId: s.sessionId, data: JSON.stringify(e.data).slice(0, 400) });
    }
    if (e.type === 'assistant/message') {
      const u = (e.data as any)?.usage;
      if (u && !seen.has('assistant/message.usage')) {
        seen.set('assistant/message.usage', { sessionId: s.sessionId, data: JSON.stringify(u) });
      }
      const src = (e.data as any)?.message?.source;
      if (src && !seen.has('assistant/message.source')) {
        seen.set('assistant/message.source', { sessionId: s.sessionId, data: JSON.stringify(src).slice(0, 300) });
      }
    }
    if (e.type === 'request/header' && !seen.has('request/header.data')) {
      seen.set('request/header.data', { sessionId: s.sessionId, data: JSON.stringify(e.data).slice(0, 300) });
    }
    if (e.type === 'tool/result' && !seen.has('tool/result.shape')) {
      seen.set('tool/result.shape', { sessionId: s.sessionId, data: JSON.stringify(e.data).slice(0, 300) });
    }
  }
}
for (const [type, info] of [...seen.entries()].sort()) {
  console.log('==', type, '@', info.sessionId.slice(0, 20));
  console.log('   ', info.data);
}
