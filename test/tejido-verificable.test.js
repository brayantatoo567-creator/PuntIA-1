const test = require('node:test');
const assert = require('node:assert/strict');
const { stitchCount, validatePattern, generateSpherePattern, STATUS } = require('../src/modules/tejido-verificable');

test('counts increases as two output stitches each and decreases as one', () => {
  assert.equal(stitchCount([{ stitch: 'sc', count: 3 }, { stitch: 'inc', count: 2 }]), 7);
  assert.equal(stitchCount([{ stitch: 'sc', count: 4 }, { stitch: 'dec', count: 2 }]), 6);
});

test('does not count turning chains unless explicitly marked', () => {
  assert.equal(stitchCount([{ stitch: 'ch', count: 1 }, { stitch: 'dc', count: 5 }]), 5);
  assert.equal(stitchCount([{ stitch: 'ch', count: 1, countsAsStitch: true }, { stitch: 'dc', count: 5 }]), 6);
});

test('flags a row whose declared total is mathematically wrong', () => {
  const result = validatePattern({
    title: 'Prueba',
    rows: [{ label: 'Vuelta 1', instructions: [{ stitch: 'sc', count: 6 }], expectedStitches: 7 }]
  });
  assert.equal(result.status, STATUS.INVALID);
  assert.match(result.errors[0], /calculated total 6/);
});

test('generates a sphere with arithmetically consistent stitch totals', () => {
  const result = generateSpherePattern({ increaseRounds: 6 });
  assert.equal(result.validation.status, STATUS.NEEDS_REVIEW);
  assert.equal(result.validation.errors.length, 0);
  assert.ok(result.pattern.rows.every(row => row.expectedStitches === row.instructions.reduce((sum, item) => {
    if (item.stitch === 'inc') return sum + item.count * 2;
    if (item.stitch === 'dec') return sum + item.count;
    if (item.stitch === 'ch' && item.countsAsStitch !== true) return sum;
    return sum + item.count;
  }, 0)));
});

test('rejects unsupported stitch codes rather than silently guessing', () => {
  assert.throws(() => stitchCount([{ stitch: 'magic', count: 3 }]), /Unsupported stitch/);
});
