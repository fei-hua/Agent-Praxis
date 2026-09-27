// scratch2：zstd 拼接帧解码对比（用后即删）
import { readFileSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { scanZstdFrames, decompressZstdConcatenated } from './experience-agent-v1/telemetry/session-log.ts';

const home = process.env['USERPROFILE'] + '/.dsh/sessions';
const { readdirSync, statSync } = await import('node:fs');
const path = await import('node:path');
let target = '';
outer: for (const pk of readdirSync(home)) {
  const pd = path.join(home, pk);
  if (!statSync(pd).isDirectory()) continue;
  for (const sid of readdirSync(pd)) {
    const sd = path.join(pd, sid);
    if (!statSync(sd).isDirectory()) continue;
    for (const n of readdirSync(sd)) {
      if (n.endsWith('.zstd')) { target = path.join(sd, n); break outer; }
    }
  }
}
console.log('target:', target);
const buf = readFileSync(target);
console.log('bytes:', buf.length);
const frames = scanZstdFrames(buf);
console.log('frames scanned:', frames.length, 'covered bytes:', frames.reduce((a, f) => a + f.size, 0));
try {
  const whole = zstdDecompressSync(buf);
  console.log('whole decompress lines:', whole.toString('utf8').split('\n').filter((l) => l.trim()).length);
} catch (e) {
  console.log('whole decompress failed:', e.message);
}
const per = decompressZstdConcatenated(buf);
console.log('per-frame lines:', per.toString('utf8').split('\n').filter((l) => l.trim()).length);
