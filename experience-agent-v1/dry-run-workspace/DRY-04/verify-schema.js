// 种子：schema 校验脚本（对 schema.json 断言，禁改）
'use strict';
const fs = require('fs');
const path = require('path');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const allowed = ['string', 'number', 'array', 'boolean'];
let failed = 0;
for (const f of schema.fields) {
  if (typeof f.name !== 'string' || !f.name) { console.log('bad name: ' + JSON.stringify(f)); failed++; }
  if (!allowed.includes(f.type)) { console.log('bad type: ' + f.type); failed++; }
  if (typeof f.required !== 'boolean') { console.log('bad required: ' + f.name); failed++; }
}
if (failed > 0) { console.log('SCHEMA BAD'); process.exit(1); }
console.log('SCHEMA OK');
