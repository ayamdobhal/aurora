const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const code = buildSync({ entryPoints: ['src/lib/colors.ts'], bundle: true, write: false,
  format: 'iife', globalName: 'Colors' }).outputFiles[0].text;
const { contrast, readableAccent, onAccent } = vm.runInNewContext(code + '; Colors;');

test('contrast matches reference black/white and audited blue control', () => {
  assert.equal(contrast([0,0,0], [255,255,255]), 21);
  assert.equal(contrast([40,40,40], [40,40,40]), 1);
  assert.ok(Math.abs(contrast([25,86,163], [23,76,146]) - 1.17) < .01);
});

test('accent roles remain readable across RGB gamut samples and composited states', () => {
  for (let r = 0; r <= 255; r += 51)
    for (let g = 0; g <= 255; g += 51)
      for (let b = 0; b <= 255; b += 51) {
        const fill = [r,g,b], text = readableAccent(fill);
        assert.ok(contrast(fill, onAccent(fill)) >= 4.5, `on-accent ${fill}`);
        for (const surface of [[32,35,40], [84,84,84]])
          assert.ok(contrast(text, surface) >= 4.5, `text ${fill} on ${surface}`);
      }
});

test('already readable accent keeps its color', () => {
  assert.deepEqual(Array.from(readableAccent([200,240,220])), [200,240,220]);
});
