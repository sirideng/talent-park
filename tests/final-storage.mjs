import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
try {
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  const result = await page.evaluate(async () => {
    const p = await import('/app/shared/preferences.ts');
    localStorage.setItem(
      'test-school-legacy',
      JSON.stringify({
        version: 1,
        chapterComplete: true,
        afterSchool: true,
        midAutumn: true,
      }),
    );
    const migrated = p.readChapter('school', 'test-school-legacy');
    p.saveChapter('shenzhen-bay', {
      version: 1,
      complete: true,
      ride: 80,
      gulls: 10,
      sunrise: 75,
    });
    p.completeMemory('shenzhen-bay');
    p.recordVisit('talent-park:bridge');
    p.updateSettings({ quality: 'medium', volume: 0.25, motion: 'reduce' });
    return {
      migrated,
      legacy: localStorage.getItem('test-school-legacy'),
      memory: p.readMemory(),
    };
  });
  assert.ok(result.migrated.chapterComplete && result.legacy);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('shenzhen-memory:unified:v1')),
    ),
    result.memory,
  );
  await page.getByRole('button', { name: '01 人才公园', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.scene > [data-scene-id="talent-park"]')
        ?.parkDebug,
  );
  assert.match(
    await page.locator('.stamp-count strong').textContent(),
    /1\s*\/\s*6/,
  );
  console.log(
    'PASS migration keeps old bytes; chapters, visits, restored stamp count and preferences survive reload',
  );
} finally {
  await browser.close();
}
