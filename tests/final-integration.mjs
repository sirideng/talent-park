import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const mobile = process.env.TEST_MOBILE === '1',
  tag = mobile ? 'mobile' : 'desktop';
const page = await browser.newPage({
  viewport: mobile
    ? { width: 390, height: 844 }
    : { width: 1920, height: 1080 },
  hasTouch: mobile,
  isMobile: mobile,
});
const errors = [],
  results = [],
  perf = [];
let current = 'planet';
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = () => `.scene > [data-scene-id="${current}"]`;
const click = async (name) => {
  const b = page.getByRole('button', { name, exact: true }).first();
  if (mobile) await b.tap();
  else await b.click();
};
const state = () =>
  page.evaluate(
    (s) => document.querySelector(s)?.integrationApi?.getState?.(),
    host(),
  );
const advance = (seconds) =>
  page.evaluate(
    ({ s, seconds }) => {
      const h = document.querySelector(s),
        d = h.schoolDebug ?? h.bayDebug ?? h.harborDebug ?? h.wutongDebug;
      if (!d) return;
      for (let i = 0; i < seconds * 60; i++) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { s: host(), seconds },
  );
const enter = async (id, name) => {
  await click(name);
  current = id;
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.integrationApi,
    host(),
    { timeout: 90000 },
  );
  await page.waitForTimeout(500);
};
const snap = (name) =>
  page.screenshot({ path: `work/final-${tag}-${name}.png` });
const back = async () => {
  await page.evaluate(
    () =>
      (window.oldQuality =
        document.querySelector('.scene canvas').qualityDebug),
  );
  await click('返回记忆星球');
  current = 'planet';
  await page.waitForFunction(
    () =>
      document.querySelector('.scene')?.dataset.sceneStatus === 'ready' &&
      document.querySelector('.scene')?.dataset.sceneId === 'planet',
  );
  assert.equal(await page.locator('.scene canvas').count(), 1);
  assert.ok(await page.evaluate(() => window.oldQuality.stats.disposed));
  assert.ok(
    await page.evaluate(() =>
      window.audioInstances.every((c) => c.state === 'closed'),
    ),
  );
};
async function measure() {
  await page.evaluate(
    () =>
      (document.querySelector('.scene canvas').qualityDebug.samples.length = 0),
  );
  await page.waitForTimeout(6500);
  const p = await page.evaluate(() => {
    const d = document.querySelector('.scene canvas').qualityDebug,
      s = d.samples.slice(),
      sorted = s.slice().sort((a, b) => a - b),
      gl = d.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ...d.stats,
      fps: (s.length * 1000) / s.reduce((a, b) => a + b, 0),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      samples: s.length,
      gpu: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      webglError: gl.getError(),
    };
  });
  perf.push({ scene: current, ...p });
  console.log('PERF', current, p.fps, p.tier, p.calls);
}
try {
  await mkdir('work', { recursive: true });
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.audioInstances = [];
    window.AudioContext = class extends Original {
      constructor(...a) {
        super(...a);
        window.audioInstances.push(this);
      }
    };
  });
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  await measure();
  for (const q of ['low', 'medium', 'high', 'auto']) {
    await page.locator('.memory-settings summary').click();
    await page.getByLabel('画质', { exact: true }).selectOption(q);
    await page.waitForTimeout(300);
    await page.locator('.memory-settings summary').click();
  }
  await enter('talent-park', '01 人才公园');
  await click('进入漫游');
  await page.waitForFunction(
    (s) => !document.querySelector(s).integrationApi.getState().transitioning,
    host(),
  );
  await page.evaluate((s) => {
    const d = document.querySelector(s).parkDebug,
      t = d.momentTriggers[0];
    d.teleport(t.center.x, t.center.z);
    d.step(0, 0, 10);
  }, host());
  await page.waitForTimeout(600);
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  assert.ok((await state()).sitting);
  await snap('park-rest');
  await click('继续走');
  await measure();
  results.push({ scene: current, core: 'sit/stand', state: await state() });
  await back();
  await enter('school', '07 我的中学');
  await click('带我走过去');
  await advance(40);
  await click('开始练习');
  for (let i = 0; i < 6; i++) {
    const s = await state();
    await advance(
      Math.max(0, Math.floor(s.practiceTime / 14) * 14 + 5 - s.practiceTime),
    );
    await click('轻轻拉起');
    if (i < 5) await advance(14);
  }
  assert.equal((await state()).step, 'run');
  await click('跟随光点慢跑');
  await advance(200);
  assert.equal((await state()).step, 'rest');
  await click('带我走过去');
  await advance(30);
  await click('坐下看日落');
  await advance(81);
  assert.ok((await state()).memory.afterSchool);
  await click('沿灯光回校门');
  await advance(25);
  assert.ok((await state()).memory.chapterComplete);
  await snap('school');
  await measure();
  results.push({ scene: current, state: await state() });
  await back();
  await enter('shenzhen-bay', '02 深圳湾');
  await click('沿路线前进');
  await advance(5);
  await click('上车');
  await click('沿路线前进');
  await advance(20);
  await click('安全下车');
  await click('沿路线前进');
  await advance(5);
  await click('看海鸥');
  await advance(11);
  await click('结束观看 / 起身');
  await advance(3);
  await click('沿路线前进');
  await advance(5);
  await click('上车');
  await click('沿路线前进');
  await advance(20);
  await click('安全下车');
  await click('沿路线前进');
  await advance(9);
  await click('躺下看日出');
  await advance(76);
  assert.ok((await state()).memory.complete);
  await snap('bay');
  await click('结束观看 / 起身');
  await advance(3);
  await measure();
  results.push({ scene: current, state: await state() });
  await back();
  await enter('happy-harbor', '05 欢乐港湾');
  await click('走向入口');
  await advance(3);
  await click('进入座舱');
  await advance(52);
  assert.equal((await state()).phase, 'riding');
  await click('切换为外景视角');
  await advance(1);
  await snap('harbor');
  await measure();
  await advance(75);
  assert.equal((await state()).phase, 'walking');
  results.push({ scene: current, state: await state() });
  await back();
  await enter('wutong', '06 梧桐山');
  await click('收起登山介绍');
  for (const [id, name] of [
    ['port', '盐田港观景段'],
    ['stone', '鹏城第一峰'],
    ['summit', '山顶 · 罗湖与福田'],
  ]) {
    await click('沿山路前进');
    await advance(id === 'port' ? 300 : id === 'stone' ? 285 : 48);
    await click('观看' + name);
    await advance(2);
    assert.equal((await state()).watching, id);
    await snap(id);
    await click('结束观看');
    await advance(2);
  }
  await measure();
  results.push({ scene: current, state: await state() });
  await back();
  for (const [id, name] of [
    ['talent-park', '01 人才公园'],
    ['school', '07 我的中学'],
    ['shenzhen-bay', '02 深圳湾'],
    ['happy-harbor', '05 欢乐港湾'],
    ['wutong', '06 梧桐山'],
  ]) {
    await enter(id, name);
    await back();
  }
  const memory = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('shenzhen-memory:unified:v1')),
  );
  assert.equal(
    Object.keys(memory.visits).filter((k) => !k.includes(':')).length,
    5,
  );
  assert.ok(
    memory.chapters.school.chapterComplete &&
      memory.chapters['shenzhen-bay'].complete,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('shenzhen-memory:unified:v1')),
    ),
    memory,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `work/final-${tag}-report.json`,
    JSON.stringify(
      {
        viewport: page.viewportSize(),
        results,
        perf,
        roundTrips: 10,
        memory,
        errors,
      },
      null,
      2,
    ),
  );
  console.log('PASS', tag);
} catch (e) {
  console.log('FAILED', current, await state(), errors);
  await snap('failure');
  throw e;
} finally {
  await browser.close();
}
