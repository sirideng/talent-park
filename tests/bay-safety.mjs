import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico'))
    errors.push(m.text());
});
const host = '.scene > [data-scene-id="shenzhen-bay"]';
const advance = (seconds) =>
  page.evaluate(
    ({ host, seconds }) => {
      const d = document.querySelector(host).bayDebug;
      for (let t = 0; t < seconds; t += 1 / 60) d.tick(1 / 60, false);
      d.tick(1 / 60);
    },
    { host, seconds },
  );
const state = () =>
  page.evaluate((s) => document.querySelector(s).bayDebug.getState(), host);
const enter = async () => {
  await page.getByRole('button', { name: '02 深圳湾', exact: true }).click();
  await page.waitForFunction(
    (s) => !!document.querySelector(s)?.bayDebug,
    host,
    { timeout: 60000 },
  );
};
try {
  await page.goto('http://localhost:3000/');
  await enter();
  await page.getByRole('button', { name: '沿路线前进', exact: true }).click();
  await advance(5);
  await page.keyboard.press('e');
  assert.equal((await state()).mounted, true);
  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await advance(2);
  const fast = await state();
  assert.ok(fast.speed > 4);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await advance(0.5);
  const coast = await state();
  assert.ok(coast.speed > 0 && coast.speed < fast.speed);
  await page.keyboard.press('e');
  assert.equal((await state()).mounted, true, 'moving dismount rejected');
  await page.keyboard.down('s');
  await advance(1);
  await page.keyboard.up('s');
  assert.equal((await state()).speed, 0);
  const heading = (await state()).heading;
  await page.keyboard.down('a');
  await advance(0.5);
  await page.keyboard.up('a');
  assert.ok((await state()).heading > heading + 0.4);
  await page.keyboard.press('e');
  assert.equal((await state()).mounted, false);
  const physics = await page.evaluate(async (s) => {
    const d = document.querySelector(s).bayDebug,
      { RAPIER, ThirdPersonCamera } =
        await import('/app/physics/player-controller.ts'),
      T = await import('/node_modules/.vite/deps/three.js'),
      { coastZ } = await import('/app/bay/chapter-data.ts');
    const p = d.physics,
      b = d.bicycle,
      rows = [];
    const setup = (x, z, a) => {
      b.mounted = false;
      b.stop();
      p.capsule.setShape(new RAPIER.Capsule(0.53, 0.32));
      const ground = b.safeGround(x, z, 0.8);
      if (!ground) throw new Error('unsafe test setup ' + x + ',' + z);
      p.teleport(ground);
      p.sync();
      for (let i = 0; i < 10; i++) p.update(1 / 60, new T.Vector3());
      b.parked.copy(ground);
      b.heading = a;
      if (!b.mount()) throw new Error('test mount failed');
    };
    const clear = () => {
      let hit = false;
      p.world.intersectionsWithShape(
        p.capsule.translation(),
        p.capsule.rotation(),
        p.capsule.shape,
        () => {
          hit = true;
          return false;
        },
        undefined,
        undefined,
        p.capsule,
        undefined,
        p.solid,
      );
      return !hit;
    };
    const tree = d.coast.trees[0];
    for (const [name, x, z, a] of [
      ['sea', 0, 5, 0],
      ['curve', 24, coastZ(24) + 5, 0],
      ['end', 54, coastZ(54), Math.PI / 2],
      ['tree', tree.x - 3, tree.z, Math.PI / 2],
    ]) {
      setup(x, z, a);
      for (let i = 0; i < 240; i++) b.update(1 / 60, true, false, 0, true);
      const contact = p.position.clone(),
        free = clear(),
        resets = p.resets;
      b.stop();
      b.heading += Math.PI;
      for (let i = 0; i < 90; i++) b.update(1 / 60, true, false, 0, false);
      rows.push({
        name,
        clear: free && clear(),
        contact: contact.toArray(),
        escape: p.position.distanceTo(contact),
        resets,
      });
    }
    const unsafeSea = b.safeGround(0, 18) === null;
    setup(0, 0, Math.PI / 2);
    for (let i = 0; i < 10; i++) b.update(1 / 60, false, true, 0, false);
    const blocks = [];
    for (const z of [-1.6, 1.6])
      blocks.push(
        p.add(RAPIER.ColliderDesc.cuboid(1, 2, 0.5).setTranslation(0, 2, z)),
      );
    blocks.push(
      p.add(RAPIER.ColliderDesc.cuboid(0.5, 2, 1).setTranslation(-1.6, 2, 0)),
    );
    p.sync();
    const blockedDismount = !b.dismount();
    for (const c of blocks) {
      p.kinds.delete(c.handle);
      p.world.removeCollider(c, true);
    }
    p.sync();
    b.checkpoint.set(0, 0.04, 0);
    p.teleport(new T.Vector3(0, -12, 0));
    p.sync();
    const prior = p.resets;
    b.update(1 / 60, false, true, 0, false);
    const recovered =
      p.position.distanceTo(b.checkpoint) < 0.1 && p.resets === prior + 1;
    const camera = [];
    for (const [x, z] of [
      [0, 6],
      [24, coastZ(24) + 6],
      [36, -10],
      [tree.x - 3, tree.z],
    ]) {
      p.teleport(new T.Vector3(x, p.surface(x, z), z));
      p.sync();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          desired = p.position
            .clone()
            .add(
              new T.Vector3(
                Math.sin(a) * 9,
                i % 3 === 0 ? -2 : 4,
                Math.cos(a) * 9,
              ),
            );
        const actual = new ThirdPersonCamera().resolve(
          p,
          desired,
          p.position,
          1 / 60,
        );
        camera.push(p.cameraClear(actual));
      }
    }
    return { rows, unsafeSea, blockedDismount, recovered, camera };
  }, host);
  console.log('PHYSICS', JSON.stringify(physics));
  assert.ok(
    physics.rows.every((r) => r.clear && r.escape > 1),
    JSON.stringify(physics.rows),
  );
  assert.ok(physics.unsafeSea && physics.blockedDismount && physics.recovered);
  assert.ok(physics.camera.every(Boolean));
  // Leave while audio is active, then repeatedly recreate it. No old context may remain live.
  const cycles = [];
  await page
    .getByRole('button', { name: '返回记忆星球', exact: true })
    .first()
    .click();
  await page
    .locator('.scene[data-scene-id="planet"][data-scene-status="ready"]')
    .waitFor();
  await page.evaluate(() =>
    localStorage.setItem(
      'shenzhen-memory:bay:v1',
      JSON.stringify({
        version: 1,
        ride: 40,
        gulls: 0,
        sunrise: 0,
        parked: false,
        complete: false,
        checkpoint: 1,
      }),
    ),
  );
  for (let i = 0; i < 5; i++) {
    await enter();
    await page.evaluate((s) => {
      const d = document.querySelector(s).bayDebug;
      d.teleport(0, 6);
      window.previousBay = d;
    }, host);
    await advance(0.2);
    await page.getByRole('button', { name: '看海鸥', exact: true }).click();
    await advance(0.3);
    assert.equal((await state()).audio.active, true);
    if (i === 0) {
      await page
        .getByRole('button', { name: '关闭环境声', exact: true })
        .click();
      assert.equal((await state()).audio.active, false);
      await page
        .getByRole('button', { name: '开启海浪、风声与鸟鸣', exact: true })
        .click();
      assert.equal((await state()).audio.active, true);
    }
    await page.keyboard.down('w');
    await page
      .getByRole('button', { name: '返回记忆星球', exact: true })
      .first()
      .click();
    await page.keyboard.up('w');
    await page
      .locator('.scene[data-scene-id="planet"][data-scene-status="ready"]')
      .waitFor();
    await page.waitForFunction(
      () => window.previousBay.ambience.state.state === 'closed',
    );
    cycles.push(
      await page.evaluate(() => ({
        audio: window.previousBay.ambience.state,
        canvas: document.querySelectorAll('.scene canvas').length,
      })),
    );
  }
  assert.ok(cycles.every((c) => !c.audio.active && c.canvas === 1));
  assert.deepEqual(errors, []);
  await writeFile(
    'work/bay-safety-report.json',
    JSON.stringify({ fast, coast, physics, cycles, errors }, null, 2),
  );
  console.log('PASS bay safety', JSON.stringify(physics));
} catch (e) {
  await page.screenshot({ path: 'work/bay-safety-failure.png' });
  console.log(errors);
  throw e;
} finally {
  await browser.close();
}
