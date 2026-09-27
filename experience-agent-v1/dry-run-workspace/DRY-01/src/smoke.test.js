// DRY-01 冒烟测试：覆盖 increment() 与 reset()
'use strict';
const { increment, reset } = require('./counter');

let failures = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`ok - ${name}`);
  } else {
    failures += 1;
    console.log(`not ok - ${name}: expected ${expected}, got ${actual}`);
  }
}

try {
  check('reset() 返回 0', reset(), 0);
  check('increment() 默认步长 1', increment(), 1);
  check('increment() 连续调用累加', increment(), 2);
  check('increment(3) 自定义步长', increment(3), 5);
  check('reset() 清零', reset(), 0);
  check('清零后 increment(2)', increment(2), 2);
} catch (err) {
  failures += 1;
  console.log(`not ok - 抛出异常: ${err && err.stack ? err.stack : err}`);
}

if (failures === 0) {
  console.log('SMOKE PASS');
  process.exit(0);
} else {
  console.log('SMOKE FAIL');
  process.exit(1);
}
