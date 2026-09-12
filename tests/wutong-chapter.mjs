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
const host = '.scene > [data-scene-id="wutong"]',
  errors = [],
  samples = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const state = () =>
  page.evaluate((s) => document.querySelector(s)?.wutongDebug.state(), host);
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).wutongDebug;
      for (let i = 0; i < seconds * 60; i++) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { host, seconds },
  );
const click = async (name) => {
  const b = page.getByRole('button', { name, exact: true });
  if (mobile) await b.tap();
  else await b.click();
};
const snap = (name) =>
  page.screenshot({
    path: `work/wutong-${mobile ? 'mobile' : 'desktop'}-${name}.png`,
    timeout: 15000,
  });
try {
  await page.goto('http://localhost:3000/');
  await click('06 梧桐山');
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.wutongDebug,
    host,
    { timeout: 90000 },
  );
  await snap('start');
  await click('收起登山介绍');
  for (const [id, name, fraction] of [
    ['port', '盐田港观景段', 0.47],
    ['stone', '鹏城第一峰', 0.93],
    ['summit', '山顶 · 罗湖与福田', 1],
  ]) {
    await click('沿山路前进');
    for (let i = 0; i < 45; i++) {
      await advance(15);
      const s = await state();
      if (s.progress > s.length * fraction - 7) break;
      if (i % 10 === 0) console.log('CLIMB', id, s);
    }
    const s = await state();
    console.log('NODE', id, s);
    assert.ok(s.progress > s.length * fraction - 8, `reach ${id}`);
    assert.equal(s.resets, 0);
    await click('观看' + name);
    await advance(2);
    assert.equal((await state()).watching, id);
    await snap(id);
    if (id === 'port') {
      await click('结束观看');
      await advance(2);
      assert.equal((await state()).audio.active, false);
      await click('观看' + name);
      await advance(20);
      assert.equal((await state()).watching, null);
    } else if (id === 'summit') {
      for (const landmark of ['平安金融中心', '京基100', '地王大厦']) {
        await click('凝视' + landmark);
        await advance(3);
        await snap(landmark);
        assert.equal(
          await page.locator('.wutong-label').textContent(),
          landmark,
        );
        assert.equal((await state()).cameraClear, true);
      }
      await click('结束观看');
      await advance(2);
    } else {
      await click('结束观看');
      await advance(2);
    }
    samples.push(await state());
  }
  const final = await state();
  assert.ok(
    final.elapsed >= 480 && final.elapsed <= 780,
    `duration ${final.elapsed}`,
  );
  await page.evaluate(
    (s) => document.querySelector(s).wutongDebug.fall(),
    host,
  );
  await advance(1);
  assert.equal((await state()).resets, 1);
  assert.ok((await state()).grounded);
  await click('开启山风');
  await page.evaluate(
    (s) => (window.oldMountain = document.querySelector(s).wutongDebug),
    host,
  );
  await click('返回记忆星球');
  await page.waitForFunction(
    () => window.oldMountain.audio().context === 'closed',
  );
  assert.equal(await page.locator('canvas').count(), 1);
  assert.deepEqual(errors, []);
  await writeFile(
    `work/wutong-${mobile ? 'mobile' : 'desktop'}-report.json`,
    JSON.stringify({ samples, final, errors, passed: true }, null, 2),
  );
  console.log('PASS', mobile ? 'mobile' : 'desktop', final);
} catch (e) {
  console.log('FAIL STATE', await state(), errors);
  await snap('failure');
  throw e;
} finally {
  await browser.close();
}
