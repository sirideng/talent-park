import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const host = '.scene > [data-scene-id="happy-harbor"]';
try {
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: '05 欢乐港湾', exact: true }).click();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.harborDebug,
    host,
  );
  await page.getByRole('button', { name: '走向入口', exact: true }).click();
  await page.getByRole('button', { name: '进入座舱', exact: true }).click();
  await page.waitForFunction(
    (s) => document.querySelector(s).harborDebug.getState().phase === 'riding',
    host,
  );
  const start = Date.now();
  console.log('REAL RIDE START');
  await page
    .getByRole('button', { name: '切换为外景视角', exact: true })
    .click();
  await page.waitForFunction(
    (s) => document.querySelector(s).harborDebug.getState().rideTime >= 50,
    host,
    { timeout: 75000 },
  );
  const high = await page.evaluate(
    (s) => document.querySelector(s).harborDebug.getState(),
    host,
  );
  assert.ok(high.upright && high.anchorError < 1e-6 && high.cameraClear);
  await page.screenshot({
    path: 'work/harbor-realtime-high.png',
    timeout: 15000,
  });
  console.log('REAL HIGH POINT', Date.now() - start, high.rideTime);
  await page.waitForFunction(
    (s) => document.querySelector(s).harborDebug.getState().phase === 'walking',
    host,
    { timeout: 100000 },
  );
  const end = await page.evaluate(
      (s) => document.querySelector(s).harborDebug.getState(),
      host,
    ),
    elapsed = Date.now() - start;
  assert.ok(elapsed >= 119000);
  assert.equal(end.rides, 1);
  assert.equal(end.audio.active, false);
  assert.equal(end.resets, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    'work/harbor-realtime-report.json',
    JSON.stringify({ elapsed, high, end, errors, passed: true }, null, 2),
  );
  console.log('REAL RIDE PASS', elapsed);
} finally {
  await browser.close();
}
