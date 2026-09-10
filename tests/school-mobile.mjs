import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = '.scene > [data-scene-id="school"]';
const state = () =>
  page.evaluate((s) => document.querySelector(s).schoolDebug.getState(), host);
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).schoolDebug;
      for (let t = 0; t < seconds; t += 0.05) d.tick(0.05);
    },
    { host, seconds },
  );
try {
  await page.goto('http://localhost:3000/');
  await page.evaluate(() =>
    localStorage.setItem('shenzhen-memory:school:v1', 'broken-json'),
  );
  await page.getByRole('button', { name: '07 我的中学' }).tap();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.schoolDebug,
    host,
    { timeout: 60000 },
  );
  assert.equal((await state()).step, 'arrival');
  await page.screenshot({ path: 'work/school-mobile-arrival.png' });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole('button', { name: '带我走过去', exact: true }).tap();
  await advance(40);
  await page.getByRole('button', { name: '开始练习', exact: true }).tap();
  await page.getByRole('button', { name: '轻轻拉起', exact: true }).tap();
  assert.equal((await state()).reps, 0, 'early attempt does not count');
  for (let i = 0; i < 6; i++) {
    await advance(i ? 14 : 5);
    await page.getByRole('button', { name: '轻轻拉起', exact: true }).tap();
  }
  assert.equal((await state()).step, 'run');
  await page.getByRole('button', { name: '跟随光点慢跑', exact: true }).tap();
  for (let i = 0; i < 12 && (await state()).step === 'run'; i++)
    await advance(20);
  assert.equal((await state()).step, 'rest');
  await page.getByRole('button', { name: '带我走过去', exact: true }).tap();
  await advance(25);
  await page.getByRole('button', { name: '坐下看日落', exact: true }).tap();
  await advance(81);
  assert.equal((await state()).step, 'home');
  await page.screenshot({ path: 'work/school-mobile-sunset.png' });
  await page.getByRole('button', { name: '沿灯光回校门', exact: true }).tap();
  await advance(12);
  assert.equal((await state()).memory.chapterComplete, true);
  await page.evaluate(
    (s) => document.querySelector(s).schoolDebug.teleport(0, 0),
    host,
  );
  await advance(0.2);
  await page.getByRole('button', { name: '坐在草坪看月亮', exact: true }).tap();
  await advance(26);
  assert.equal((await state()).memory.midAutumn, true);
  await page.screenshot({ path: 'work/school-mobile-moon.png' });
  await page.getByRole('button', { name: '回到这个傍晚', exact: true }).tap();
  assert.equal((await state()).moonActive, false);
  const physics = await page.evaluate(async (s) => {
    const d = document.querySelector(s).schoolDebug,
      T = await import('/node_modules/.vite/deps/three.js'),
      { RAPIER } = await import('/app/physics/player-controller.ts');
    const cases = {};
    for (const [name, x, z, dx, dz] of [
      ['building', 0, -29, 0, -1],
      ['stand', 0, 29, 0, 1],
      ['post', 38.8, -7, 0, -1],
      ['gate', 5, 43, 0, 1],
    ]) {
      d.teleport(x, z);
      for (let i = 0; i < 120; i++)
        d.physics.update(1 / 60, new T.Vector3(dx, 0, dz));
      const p = d.physics.position.clone();
      let overlap = false;
      d.physics.world.intersectionsWithShape(
        d.physics.capsule.translation(),
        d.physics.capsule.rotation(),
        d.physics.capsule.shape,
        () => {
          overlap = true;
          return false;
        },
        undefined,
        undefined,
        d.physics.capsule,
        undefined,
        d.physics.solid,
      );
      const camera = d.camera.position.clone();
      let cameraHit = false;
      d.physics.world.intersectionsWithShape(
        camera,
        { x: 0, y: 0, z: 0, w: 1 },
        new RAPIER.Ball(0.18),
        () => {
          cameraHit = true;
          return false;
        },
        undefined,
        undefined,
        d.physics.capsule,
        undefined,
        d.physics.cameraSolid,
      );
      cases[name] = { position: p.toArray(), overlap, cameraHit };
    }
    return cases;
  }, host);
  assert.ok(
    Object.values(physics).every((v) => !v.overlap),
    'capsule no penetration',
  );
  const remembered = (await state()).memory;
  await page.reload();
  await page.getByRole('button', { name: '07 我的中学' }).tap();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.schoolDebug,
    host,
    { timeout: 60000 },
  );
  assert.deepEqual((await state()).memory, remembered);
  await page
    .getByRole('button', { name: '返回记忆星球', exact: true })
    .last()
    .tap();
  await page
    .locator('.scene[data-scene-id="planet"][data-scene-status="ready"]')
    .waitFor();
  assert.deepEqual(errors, []);
  await writeFile(
    'work/school-mobile-report.json',
    JSON.stringify(
      {
        physics,
        remembered,
        errors,
        narrowComplete: true,
        note: 'Timers accelerated with development tick; all required interactions and physical movement still executed.',
      },
      null,
      2,
    ),
  );
  console.log('PASS mobile chapter and moon', JSON.stringify(physics));
} catch (e) {
  await page.screenshot({ path: 'work/school-mobile-failure.png' });
  console.log('LAST STATE', await state());
  throw e;
} finally {
  await browser.close();
}
