// 种子：gamma 调用 beta（禁改）
'use strict';
const { greet } = require('./beta');
function greetAll(names) { return names.map(greet).join('; '); }
module.exports = { greetAll };
