// 种子：beta 调用 alpha（禁改）
'use strict';
const { formatName } = require('./alpha');
function greet(name) { return 'hello, ' + formatName(name); }
module.exports = { greet };
