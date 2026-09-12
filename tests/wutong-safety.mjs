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
const host = '.scene > [data-scene-id="wutong"]',
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const click = (name) => page.getByRole('button', { name, exact: true }).tap();
const state = () =>
  page.evaluate((s) => document.querySelector(s).wutongDebug.state(), host);
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).wutongDebug;
      for (let i = 0; i < seconds * 60; i++) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { host, seconds },
  );
try {
  await page.goto('http://localhost:3000/');
  await click('06 梧桐山');
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.wutongDebug,
    host,
    { timeout: 90000 },
  );
  await click('收起登山介绍');
  const start = await state(),
    b = await page
      .locator('.memory-joystick')
      .boundingBox(),
    cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 - 40 }],
  });
  await advance(2);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await advance(0.3);
  assert.ok(
    (await state()).progress > start.progress + 5,
    'held touch direction moves',
  );
  const beforeJump = (await state()).position[1];
  await page.locator('.memory-controls').getByRole('button', {name:'跳跃',exact:true}).tap();
  await advance(0.25);
  assert.ok((await state()).position[1] > beforeJump + 0.3);
  await advance(1);
  assert.ok((await state()).grounded);
  const probes = await page.evaluate((s) => {
    const d = document.querySelector(s).wutongDebug,
      p = d.physics,
      V = p.position.clone(),
      out = [];
    const move = (v, n) => {
      for (let i = 0; i < n * 60; i++) p.update(1 / 60, v);
    };
    for (const sign of [-1, 1]) {
      d.place(d.state().length * 0.75);
      move(V.set(0, 0, 0), 0.5);
      const a = p.position.clone(),
        side = d.route.nearest(a).side.clone().multiplyScalar(sign);
      move(side, 3);
      out.push({
        name: 'ridge rail ' + sign,
        distance: d.route.nearest(p.position).distance,
        resets: p.resets,
      });
      move(side.negate(), 0.7);
    }
    const tree = d.world.testTree.clone(),
      direction = tree.clone().set(1, 0, 0),
      start = tree.clone().addScaledVector(direction, -2.5);
    d.placeWorld(start.x, start.z);
    move(V.set(0, 0, 0), 0.5);
    out.push({
      name: 'tree start',
      tree: tree.toArray(),
      position: p.position.toArray(),
    });
    let minDistance = Infinity;
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60, direction);
      minDistance = Math.min(
        minDistance,
        Math.hypot(p.position.x - tree.x, p.position.z - tree.z),
      );
    }
    out.push({
      name: 'tree',
      distance: Math.hypot(p.position.x - tree.x, p.position.z - tree.z),
      grounded: p.grounded,
      minDistance,
      position: p.position.toArray(),
    });
    const contact = p.position.clone();
    move(direction.negate(), 1);
    out.push({
      name: 'tree escape',
      moved: contact.distanceTo(p.position),
      distance: Math.hypot(p.position.x - tree.x, p.position.z - tree.z),
    });
    return out;
  }, host);
  console.log('PROBES', probes);
  for (const p of probes.filter((p) => p.name.startsWith('ridge'))) {
    assert.ok(p.distance < 3.15, JSON.stringify(p));
    assert.equal(p.resets, 0);
  }
  assert.ok(
    probes.find((p) => p.name === 'tree').minDistance >= 0.65,
    JSON.stringify(probes),
  );
  assert.ok(probes.find((p) => p.name === 'tree escape').moved > 1);
  for (const fraction of [0.1, 0.47, 0.75, 0.93, 0.998]) {
    await page.evaluate(
      ({ host, fraction }) => {
        const d = document.querySelector(host).wutongDebug;
        d.place(d.state().length * fraction);
      },
      { host, fraction },
    );
    await advance(0.3);
    for (let i = 0; i < 12; i++) {
      await page.evaluate(
        ({ host, i }) =>
          document
            .querySelector(host)
            .wutongDebug.orbit((i * Math.PI) / 6, i % 2 ? 1.8 : 0.6),
        { host, i },
      );
      await advance(0.2);
      assert.ok((await state()).cameraClear, `camera ${fraction}/${i}`);
    }
  }
  await page.evaluate(
    (s) => document.querySelector(s).wutongDebug.fall(),
    host,
  );
  await advance(1);
  assert.equal((await state()).resets, 1);
  assert.ok((await state()).grounded);
  for (let i = 0; i < 3; i++) {
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
    if (i < 2) {
      await click('06 梧桐山');
      await page.waitForFunction(
        (s) => !!document.querySelector(s)?.wutongDebug,
        host,
        { timeout: 90000 },
      );
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    'work/wutong-safety-report.json',
    JSON.stringify(
      { probes, cameraPoses: 60, roundTrips: 3, errors, passed: true },
      null,
      2,
    ),
  );
  console.log('PASS', probes);
} finally {
  await browser.close();
}
