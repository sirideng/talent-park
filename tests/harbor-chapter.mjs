import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const mobile = process.env.TEST_MOBILE === '1';
const page = await browser.newPage({
  viewport: mobile
    ? { width: 390, height: 844 }
    : { width: 1440, height: 1000 },
  isMobile: mobile,
  hasTouch: mobile,
});
const errors = [],
  samples = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = '.scene > [data-scene-id="happy-harbor"]',
  tag = mobile ? 'mobile' : 'desktop';
const state = () =>
  page.evaluate(
    (s) => document.querySelector(s)?.harborDebug?.getState(),
    host,
  );
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).harborDebug;
      for (let t = 0; t < seconds; t += 1 / 60) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { host, seconds },
  );
const click = async (name) => {
  const b = page.getByRole('button', { name, exact: true });
  if (mobile) await b.tap();
  else await b.click();
};
const snap = async (name) =>
  page.screenshot({ path: `work/harbor-${tag}-${name}.png`, timeout: 15000 });
const enterScene = async () => {
  await click('05 欢乐港湾');
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.harborDebug,
    host,
    { timeout: 60000 },
  );
};
try {
  await mkdir('work', { recursive: true });
  await page.goto('http://localhost:3000/');
  await enterScene();
  await snap('arrival');
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  if (mobile) {
    const before = (await state()).position[2];
    const client = await page.context().newCDPSession(page);
    const button = await page.getByRole('button', {name:'向前',exact:true}).boundingBox();
    await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2,id:1}]});
    await advance(.65);
    await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await client.detach();
    assert.ok((await state()).position[2] > before + 1);
  }
  await click('走向入口');
  await advance(3);
  assert.equal((await state()).canEnter, true);
  for (let ride = 0; ride < 3; ride++) {
    await click('进入座舱');
    await advance(1.5);
    assert.equal((await state()).phase, 'riding');
    await advance(10);
    let s = await state();
    assert.ok(s.upright && s.anchorError < 1e-6);
    assert.equal(s.audio.active, true);
    assert.equal(s.cameraClear, true);
    await page.keyboard.down('w');
    await page.keyboard.press('Space');
    await advance(2);
    await page.keyboard.up('w');
    s = await state();
    assert.ok(s.anchorError < 1e-6);
    await snap(`inside-${ride}`);
    await click('切换为外景视角');
    await advance(1);
    assert.equal((await state()).view, 'outside');
    if (ride === 0) {
      await advance(36);
      s = await state();
      assert.ok(s.labelTime > 0);
      await snap('high-labels');
      assert.equal(
        await page
          .locator('.harbor-label')
          .evaluateAll(
            (nodes) =>
              nodes.filter((e) => Number(e.style.opacity) > 0.5).length,
          ),
        3,
      );
      if (process.env.TEST_REAL_RIDE === '1') {
        console.log('REAL TIME: completing first orbit from', s.rideTime);
        await page.waitForFunction(
          (s) =>
            document.querySelector(s).harborDebug.getState().phase ===
            'walking',
          host,
          { timeout: 140000 },
        );
      } else await advance(75);
      assert.equal((await state()).phase, 'walking');
      assert.equal((await state()).rides, 1);
    } else {
      await advance(ride === 1 ? 46 : 5);
      await snap(`outside-${ride}`);
      await click('切换为舱内视角');
      await advance(1);
      assert.equal((await state()).view, 'inside');
      await click('安全返回入口');
      await advance(2);
    }
    s = await state();
    samples.push(s);
    assert.equal(s.phase, 'walking');
    assert.equal(s.audio.active, false);
    assert.equal(s.resets, 0);
    assert.ok(s.position[1] >= 0 && s.position[1] < 0.2);
    assert.equal(s.grounded, true);
    assert.equal(s.canEnter, true);
  }
  await click('进入座舱');
  await advance(3);
  await page.evaluate(
    (s) => (window.oldHarbor = document.querySelector(s).harborDebug),
    host,
  );
  await click('返回记忆星球');
  await page.waitForSelector('[data-scene-id="planet"]');
  await page.waitForFunction(
    () => window.oldHarbor.audioState().state === 'closed',
  );
  assert.equal(await page.locator('canvas').count(), 1);
  for (let n = 0; n < 2; n++) {
    await enterScene();
    await click('走向入口');
    await advance(3);
    await click('进入座舱');
    await advance(3);
    await page.evaluate(
      (s) => (window.oldHarbor = document.querySelector(s).harborDebug),
      host,
    );
    await click('返回记忆星球');
    await page.waitForSelector('[data-scene-id="planet"]');
    await page.waitForFunction(
      () => window.oldHarbor.audioState().state === 'closed',
    );
    assert.equal(await page.locator('canvas').count(), 1);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `work/harbor-${tag}-report.json`,
    JSON.stringify({ mobile, samples, errors, passed: true }, null, 2),
  );
  console.log('PASS', tag, samples);
} catch (error) {
  await snap('failure');
  console.log('STATE', await state(), 'ERRORS', errors);
  throw error;
} finally {
  await browser.close();
}
