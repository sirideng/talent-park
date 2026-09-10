import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = '.scene > [data-scene-id="shenzhen-bay"]';
const state = () =>
  page.evaluate((s) => document.querySelector(s)?.bayDebug?.getState(), host);
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).bayDebug;
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
const guide = async (seconds) => {
  await click('沿路线前进');
  await advance(seconds);
};
try {
  await page.goto('http://localhost:3000/');
  await page.evaluate(() => localStorage.removeItem('shenzhen-memory:bay:v1'));
  await click('02 深圳湾');
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.bayDebug,
    host,
    { timeout: 60000 },
  );
  await page.screenshot({
    path: `work/bay-${mobile ? 'mobile' : 'desktop'}-arrival.png`,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await guide(5);
  await click('上车');
  assert.equal((await state()).mounted, true);
  if (mobile) {
    const client = await page.context().newCDPSession(page);
    const hold = async (name, seconds) => {
      const b = await page
        .getByRole('button', { name, exact: true })
        .boundingBox();
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }],
      });
      await advance(seconds);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    };
    await hold('踩踏', 1.5);
    assert.ok((await state()).speed > 2);
    await hold('刹车', 1);
    assert.equal((await state()).speed, 0);
    const h = (await state()).heading;
    await hold('向左', 0.4);
    assert.ok((await state()).heading > h + 0.3);
    await hold('向右', 0.4);
    await client.detach();
  }
  await guide(20);
  console.log('LOOKOUT STOP', await state());
  assert.ok(Math.abs((await state()).position[0]) < 4);
  await click('安全下车');
  assert.equal((await state()).mounted, false);
  await guide(5);
  await click('看海鸥');
  await advance(3);
  assert.equal((await state()).watching, 'gulls');
  await click('结束观看 / 起身');
  await advance(3);
  assert.equal((await state()).audio.active, false);
  assert.ok((await state()).memory.gulls < 10);
  await click('看海鸥');
  await advance(11);
  await page.screenshot({
    path: `work/bay-${mobile ? 'mobile' : 'desktop'}-gulls.png`,
  });
  assert.equal((await state()).memory.gulls, 10);
  assert.equal((await state()).audio.active, true);
  await click('结束观看 / 起身');
  await advance(3);
  await guide(5);
  await click('上车');
  assert.equal((await state()).mounted, true);
  await guide(20);
  console.log('PARKING STOP', await state());
  await click('安全下车');
  assert.equal((await state()).memory.parked, true);
  await guide(9);
  await click('躺下看日出');
  await advance(10);
  assert.ok((await state()).pose > 0.9);
  await click('结束观看 / 起身');
  await advance(3);
  assert.equal((await state()).audio.active, false);
  assert.ok((await state()).pose < 0.02);
  await click('躺下看日出');
  if (process.env.TEST_REAL_SUNRISE === '1') {
    const started = Date.now();
    await page.waitForFunction(
      (s) => document.querySelector(s).bayDebug.getState().memory.complete,
      host,
      { timeout: 85000 },
    );
    console.log(
      'REAL SUNRISE remaining seconds',
      (Date.now() - started) / 1000,
    );
  } else await advance(66);
  assert.equal((await state()).memory.complete, true);
  await page.screenshot({
    path: `work/bay-${mobile ? 'mobile' : 'desktop'}-sunrise.png`,
  });
  await click('结束观看 / 起身');
  await advance(3);
  const completed = await state();
  assert.equal(completed.audio.active, false);
  await page
    .getByRole('button', { name: '返回记忆星球', exact: true })
    .first()
    .click();
  await page
    .locator('.scene[data-scene-id="planet"][data-scene-status="ready"]')
    .waitFor();
  await page.reload();
  await click('02 深圳湾');
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.bayDebug,
    host,
    { timeout: 60000 },
  );
  assert.equal((await state()).memory.complete, true);
  assert.deepEqual(errors, []);
  await writeFile(
    `work/bay-${mobile ? 'mobile' : 'desktop'}-report.json`,
    JSON.stringify(
      {
        completed,
        errors,
        persistence: true,
        note: 'Complete physical flow and UI; development tick accelerates timers.',
      },
      null,
      2,
    ),
  );
  console.log('PASS bay chapter');
} catch (e) {
  console.log('FAILED STATE', await state(), errors);
  await page.screenshot({ path: 'work/bay-failure.png' });
  throw e;
} finally {
  await browser.close();
}
