const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/runtime.cjs');

test('retired topbar entry is removed without touching native activity or player lyrics', () => {
  const f = fixture('<nav><button class="aurora-lyrics-toggle">Lyrics</button><button aria-label="Listening activity">Activity</button></nav><button class="crp-lyrics">Player lyrics</button>');
  try {
    const native = f.w.document.querySelector('[aria-label="Listening activity"]');
    let clicks = 0; native.addEventListener('click', () => clicks++);
    f.run('src/top-bar.ts');
    assert.equal(f.w.document.querySelector('.aurora-lyrics-toggle'), null);
    assert.ok(f.w.document.querySelector('.crp-lyrics'));
    native.click(); assert.equal(clicks, 1);
  } finally { f.dom.window.close(); }
});
