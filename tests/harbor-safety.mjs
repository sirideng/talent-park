import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  probes = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = '.scene > [data-scene-id="happy-harbor"]';
const state = () =>
  page.evaluate((s) => document.querySelector(s).harborDebug.getState(), host);
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).harborDebug;
      for (let t = 0; t < seconds; t += 1 / 60) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { host, seconds },
  );
const place = async (x, z) => {
  await page.evaluate(
    ({ host, x, z }) => document.querySelector(host).harborDebug.teleport(x, z),
    { host, x, z },
  );
  await advance(0.3);
};
const hold = async (key, seconds) => {
  await page.keyboard.down(key);
  await advance(seconds);
  await page.keyboard.up(key);
  await advance(0.2);
};
try {
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: '05 欢乐港湾', exact: true }).click();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.harborDebug,
    host,
  );
  for (const p of [
    { name: 'sea rail', x: 25, z: 6, key: 'w' },
    { name: 'tree trunk', x: 25, z: -27, key: 'w' },
    { name: 'fin', x: 0, z: -8, key: 'w' },
    { name: 'east hedge', x: 52, z: -15, key: 'a' },
    { name: 'north hedge', x: 25, z: -34, key: 's' },
  ]) {
    await place(p.x, p.z);
    await hold(p.key, 3);
    const s = await state();
    assert.equal(s.resets, 0, p.name);
    assert.equal(
      await page.evaluate(
        (s) => document.querySelector(s).harborDebug.capsuleClear(),
        host,
      ),
      true,
      p.name,
    );
    probes.push({ name: p.name, position: s.position });
    if (p.name === 'sea rail') assert.ok(s.position[2] < 8.7);
    if (p.name === 'fin') assert.ok(s.position[2] < -3.8);
    await hold(p.key === 's' ? 'w' : 's', 1);
    assert.ok((await state()).position.every(Number.isFinite));
  }
  await place(25, 6);
  await page.locator('canvas').click({ position: { x: 700, y: 350 } });
  await page.keyboard.down('w');
  await page.keyboard.press('Space');
  await advance(2);
  await page.keyboard.up('w');
  assert.ok((await state()).position[2] < 8.7);
  for (const [x, z] of [
    [25, -25.8],
    [0, -6],
    [25, 6],
    [52, -15],
  ]) {
    await place(x, z);
    for (let i = 0; i < 12; i++) {
      await page.evaluate(
        ({ host, i }) =>
          document.querySelector(host).harborDebug.orbit((i * Math.PI) / 6),
        { host, i },
      );
      await advance(0.15);
      assert.equal((await state()).cameraClear, true, `camera ${x}/${z}/${i}`);
    }
  }
  await place(0, -6);
  await page.keyboard.press('e');
  await advance(0.2);
  assert.equal((await state()).phase, 'boarding');
  await page.keyboard.press('Escape');
  await advance(2);
  assert.equal((await state()).phase, 'walking');
  assert.equal((await state()).audio.active, false);
  await page.keyboard.press('e');
  await advance(2);
  assert.equal((await state()).phase, 'riding');
  // Actual keyboard commands while canvas focused cannot dislodge the locked player.
  await page.locator('canvas').click({ position: { x: 700, y: 350 } });
  await page.keyboard.down('w');
  await page.keyboard.press('Space');
  await advance(15);
  await page.keyboard.up('w');
  assert.ok((await state()).anchorError < 1e-6);
  assert.equal(
    await page.evaluate(
      (s) => document.querySelector(s).harborDebug.capsuleClear(),
      host,
    ),
    true,
  );
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const frozen = (await state()).rideTime;
  await advance(4);
  assert.equal((await state()).rideTime, frozen);
  assert.equal((await state()).audio.active, false);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  await advance(35);
  assert.ok((await state()).labelTime > 0);
  await advance(15);
  assert.equal((await state()).labelTime, 0);
  await page.getByRole('button', { name: '安全返回入口', exact: true }).click();
  await advance(0.7);
  const fading = await state();
  assert.equal(fading.phase, 'exiting');
  assert.ok(fading.position[1] < 0.2);
  assert.ok(fading.camera[2] < -10);
  await advance(1);
  assert.equal((await state()).grounded, true);
  assert.deepEqual(errors, []);
  await writeFile(
    'work/harbor-safety-report.json',
    JSON.stringify({ probes, cameraProbes: 48, errors, passed: true }, null, 2),
  );
  console.log('PASS safety', probes);
} catch (e) {
  console.log('STATE', await state(), 'ERRORS', errors);
  await page.screenshot({
    path: 'work/harbor-safety-failure.png',
    timeout: 15000,
  });
  throw e;
} finally {
  await browser.close();
}
