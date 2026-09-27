// scratch4：真实 tool/result 错误形状扫描（用后即删）
import { listSessions, decodeSessionLog } from './experience-agent-v1/telemetry/session-log.ts';

const home = process.env['USERPROFILE'] + '/.dsh';
let total = 0, withErrField = 0, withIsError = 0, withExitCode = 0;
const samples = [];
for (const s of listSessions(home)) {
  let log;
  try { log = decodeSessionLog(s.logPath); } catch { continue; }
  for (const e of log.events) {
    if (e.type !== 'tool/result') continue;
    total++;
    const d = e.data as any;
    const blocks = d?.message?.content ?? [];
    const txt = JSON.stringify(blocks).slice(0, 600);
    if (d?.error) { withErrField++; if (samples.length < 6) samples.push(['error-field', JSON.stringify(d.error), txt.slice(0, 200)]); }
    if (blocks.some((b: any) => b?.isError === true)) { withIsError++; if (samples.length < 6) samples.push(['isError-block', '', txt.slice(0, 200)]); }
    if (/\[exit code: [1-9]/.test(txt)) { withExitCode++; if (samples.length < 6) samples.push(['exit-code', '', txt.slice(0, 200)]); }
  }
}
console.log({ total, withErrField, withIsError, withExitCode });
for (const [kind, a, b] of samples) console.log('==', kind, a, b);
