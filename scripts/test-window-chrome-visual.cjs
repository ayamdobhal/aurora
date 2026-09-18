// Reproduce Spotify's Windows caption spacer using its shipped CSS contract.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    const page = await browser.newPage();
    for (const spacer of ['main-globalNav-contentRightSpacer', 'main-topBar-topbarContentRight']) {
      for (const width of [800, 1280]) for (const zoom of [100, 125]) {
        await page.setViewportSize({ width, height: 400 });
        await page.setContent(`<!doctype html><style>
          :root { --zoom-level: ${zoom}; }
          body { margin: 0; }
          .Root__globalNav { display: flex; justify-content: space-between; box-sizing: border-box; width: 100%; height: 64px; }
          .main-globalNav-contentRight, .main-topBar-topbarContentRight { display: flex; align-items: center; gap: 8px; }
          .main-globalNav-contentRight { margin-inline-end: 8px; }
          .main-globalNav-contentRightSpacer, .main-topBar-topbarContentRight:empty {
            height: calc(32px / (var(--zoom-level, 100) / 100));
            width: calc(135px / (var(--zoom-level, 100) / 100));
          }
          button { width: 32px; height: 32px; }
        </style><div class="Root__globalNav">
          <div class="main-globalNav-historyButtonsWrapper"><button aria-label="Back">←</button></div>
          <div class="main-globalNav-contentRight">
            <div class="main-topBar-topbarContentRight"><button aria-label="Notifications">N</button><button aria-label="Profile">P</button></div>
            <div id="caption-spacer" class="${spacer}"></div>
          </div>
        </div>`);
        await page.addStyleTag({ content: fs.readFileSync('theme/user.css', 'utf8') });
        const reservedWidth = () => page.locator('#caption-spacer').evaluate(el => el.getBoundingClientRect().width);
        const expected = 135 / (zoom / 100);
        assert.ok(Math.abs(await reservedWidth() - expected) < 1, 'native/Mac layout retains its spacer before Windows titlebar hiding');
        await page.evaluate(() => document.documentElement.classList.add('aurora-hide-titlebar'));
        assert.equal(await reservedWidth(), 0, `${spacer} removed at width ${width}, zoom ${zoom}`);
        assert.ok(await page.getByRole('button', { name: 'Notifications' }).isVisible());
        assert.ok(await page.getByRole('button', { name: 'Profile' }).isVisible(), 'populated toolbar remains visible');
        const geometry = await page.evaluate(() => {
          const nav = document.querySelector('.Root__globalNav');
          const profile = document.querySelector('[aria-label="Profile"]');
          return { gap: nav.getBoundingClientRect().right - profile.getBoundingClientRect().right,
            inset: parseFloat(getComputedStyle(nav).paddingRight) };
        });
        assert.ok(Math.abs(geometry.gap - geometry.inset) < 1, 'profile aligns with the normal navigation inset');
        await page.evaluate(() => document.documentElement.classList.remove('aurora-hide-titlebar'));
        assert.ok(Math.abs(await reservedWidth() - expected) < 1, 'F8/native frame restoration brings back caption spacing');
      }
    }
    console.log('Passed Windows caption spacing for current/legacy markup, two widths, two zoom levels, visible profile controls and frame restoration.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
