// 种子：检查脚本（读取 config.json 并断言三项；断言禁删）
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
