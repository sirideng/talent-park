import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
const rows = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  await page.locator('.memory-settings summary').tap();
  for (const [tier, dpr] of [
    ['high', 1.6],
    ['medium', 1.25],
    ['low', 1],
  ]) {
    await page.getByLabel('画质', { exact: true }).selectOption(tier);
    await page.waitForFunction(
      (dpr) =>
        document.querySelector('.scene canvas').qualityDebug.stats.dpr === dpr,
      dpr,
    );
  }
  await page.getByLabel('动态效果', { exact: true }).selectOption('reduce');
  await page.getByLabel('全局音量', { exact: true }).fill('0.2');
  await page.locator('.memory-settings summary').tap();
  const cdp = await page.context().newCDPSession(page);
  for (const [id, name] of [
    ['talent-park', '01 人才公园'],
    ['school', '07 我的中学'],
    ['shenzhen-bay', '02 深圳湾'],
    ['happy-harbor', '05 欢乐港湾'],
    ['wutong', '06 梧桐山'],
  ]) {
    await page.getByRole('button', { name, exact: true }).tap();
    await page.waitForFunction(
      (id) =>
        document.querySelector(`.scene > [data-scene-id="${id}"]`)
          ?.integrationApi,
      id,
    );
    if (id === 'talent-park') {
      await page.getByRole('button', { name: '进入漫游', exact: true }).tap();
      await page.waitForTimeout(1000);
    }
    const pad = page.locator('.memory-joystick');
    await pad.waitFor({ state: 'visible' });
    const b = await pad.boundingBox(),
      x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    // Observe only input delivery, preserving the real controller implementation.
    await page.evaluate((id) => {
      const h = document.querySelector(`.scene > [data-scene-id="${id}"]`),
        api = h.integrationApi,
        move = api.move;
      window.axes = [];
      api.move = (x, y) => {
        window.axes.push([x, y]);
        move(x, y);
      };
    }, id);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ id: 1, x: x + 12, y: y - 20 }],
    });
    await page.waitForTimeout(300);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: x + 12, y: y - 20 },
        { id: 2, x: 300, y: 300 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { id: 1, x: x + 12, y: y - 20 },
        { id: 2, x: 340, y: 270 },
      ],
    });
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    const axes = await page.evaluate(() => window.axes);
    assert.ok(
      axes.some(([x, y]) => Math.hypot(x, y) > 0.2 && Math.hypot(x, y) < 0.8),
    );
    assert.deepEqual(axes.at(-1), [0, 0]);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(350);
    assert.ok(await pad.isVisible());
    await page.screenshot({ path: `work/final-landscape-${id}.png` });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    rows.push({ id, axes, landscape: true });
    await page
      .getByRole('button', { name: '返回记忆星球', exact: true })
      .first()
      .tap();
    await page.waitForFunction(
      () =>
        document.querySelector('.scene')?.dataset.sceneId === 'planet' &&
        document.querySelector('.scene')?.dataset.sceneStatus === 'ready',
    );
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  const memory = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shenzhen-memory:unified:v1')),
  );
  assert.equal(memory.settings.quality, 'low');
  assert.equal(memory.settings.motion, 'reduce');
  assert.equal(memory.settings.volume, 0.2);
  assert.equal(Object.keys(memory.visits).length, 5);
  assert.ok(
    await page
      .locator('main')
      .evaluate((e) => e.classList.contains('reduce-motion')),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    'work/final-touch.json',
    JSON.stringify({ rows, memory, errors }, null, 2),
  );
  console.log('PASS touch + landscape + persisted preferences');
} finally {
  await browser.close();
}
