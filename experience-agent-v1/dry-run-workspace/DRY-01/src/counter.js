// 种子：简单计数器模块（测试目标，禁改）
'use strict';
let count = 0;
function increment(by = 1) { count += by; return count; }
function reset() { count = 0; return count; }
function current() { return count; }
module.exports = { increment, reset, current };
