import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  baseline = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    if (m.location().url.endsWith('/favicon.ico')) baseline.push(m.text());
    else errors.push(m.text());
  }
});
const host = '.scene > [data-scene-id="school"]';
const state = () =>
  page.evaluate(
    (s) => document.querySelector(s)?.schoolDebug?.getState(),
    host,
  );
const start = Date.now();
await mkdir('work', { recursive: true });
try {
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: '07 我的中学' }).click();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.schoolDebug,
    host,
    { timeout: 60000 },
  );
  await page.screenshot({ path: 'work/school-arrival.png' });
  console.log('SCHOOL READY');
  await page.getByRole('button', { name: '带我走过去', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('[data-action="interact"]').disabled,
    null,
    { timeout: 65000 },
  );
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  console.log('PRACTICE', Math.round((Date.now() - start) / 1000));
  let last = -1;
  while ((await state()).step === 'practice') {
    const s = await state();
    const cycle = Math.floor(s.practiceTime / 14),
      phase = (s.practiceTime % 14) / 14;
    if (phase > 0.3 && phase < 0.8 && cycle !== last) {
      await page.getByRole('button', { name: '轻轻拉起', exact: true }).click();
      last = cycle;
      console.log('REP', (await state()).reps);
    }
    await page.waitForTimeout(350);
  }
  await page.screenshot({ path: 'work/school-practice.png' });
  await page.getByRole('button', { name: '跟随光点慢跑', exact: true }).click();
  console.log('RUN');
  await page.waitForFunction(
    (s) => document.querySelector(s).schoolDebug.getState().step === 'rest',
    host,
    { timeout: 240000 },
  );
  await page.screenshot({ path: 'work/school-track.png' });
  console.log('REST', Math.round((Date.now() - start) / 1000));
  await page.getByRole('button', { name: '带我走过去', exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('[data-action="interact"]').disabled,
    null,
    { timeout: 35000 },
  );
  await page.getByRole('button', { name: '坐下看日落', exact: true }).click();
  await page.waitForFunction(
    (s) => document.querySelector(s).schoolDebug.getState().step === 'home',
    host,
    { timeout: 120000 },
  );
  await page.screenshot({ path: 'work/school-sunset.png' });
  assert.ok((await state()).memory.afterSchool);
  await page.getByRole('button', { name: '沿灯光回校门', exact: true }).click();
  await page.waitForFunction(
    (s) => document.querySelector(s).schoolDebug.getState().step === 'complete',
    host,
    { timeout: 25000 },
  );
  const completed = await state(),
    seconds = (Date.now() - start) / 1000;
  console.log('COMPLETE', seconds);
  await page.screenshot({ path: 'work/school-gate.png' });
  await page
    .getByRole('button', { name: '返回记忆星球', exact: true })
    .last()
    .click();
  await page.reload();
  await page.getByRole('button', { name: '07 我的中学' }).click();
  await page.waitForFunction(
    (s) =>
      document.querySelector(s)?.schoolDebug?.getState().memory.chapterComplete,
    host,
    { timeout: 60000 },
  );
  assert.equal((await state()).step, 'complete');
  assert.deepEqual(errors, []);
  await writeFile(
    'work/school-chapter-report.json',
    JSON.stringify(
      { completed, seconds, errors, baseline, persistence: true },
      null,
      2,
    ),
  );
  console.log('PASS school chapter');
} catch (e) {
  await page.screenshot({ path: 'work/school-failure.png' });
  console.log('LAST STATE', await state());
  throw e;
} finally {
  await browser.close();
}
