import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors = [],
  baselineResources = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    const message = m.text() + ' ' + m.location().url;
    if (m.location().url === 'http://localhost:3000/favicon.ico')
      baselineResources.push(message);
    else errors.push(message);
  }
});
page.on('response', (r) => {
  if (r.status() >= 400) console.log('HTTP', r.status(), r.url());
});
try {
  await page.addInitScript(() => {
    const tools = new Map();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(t, { signal }) {
          tools.set(t.name, t);
          signal.addEventListener('abort', () => tools.delete(t.name), {
            once: true,
          });
        },
      },
    });
    window.parkState = () => tools.get('read_park_state')?.execute();
  });
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: '01 人才公园' }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.scene > [data-scene-id="talent-park"]')
        ?.parkDebug,
    undefined,
    { timeout: 60000 },
  );
  const result = await page.evaluate(async () => {
    const d = document.querySelector(
      '.scene > [data-scene-id="talent-park"]',
    ).parkDebug;
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const snapshots = {};
    const run = (name, x, z, dx, dz, frames = 120) => {
      const resets = d.physics.resets;
      d.teleport(x, z);
      d.step(0, 0, 30);
      snapshots[name] = d.step(dx, dz, frames);
      snapshots[name].resets = d.physics.resets - resets;
      if(dx||dz){const stopped=d.physics.position.clone();d.step(-dx,-dz,40);snapshots[name].retreat=d.physics.position.distanceTo(stopped);}
    };
    run('spawn', -16, -14, 0, 0);
    run('pavilion', -33.5, 20, -1, 0);
    run('tower', -12, -46, -1, 0, 180);
    run('culture', -25, -22, -1, 0, 180);
    run('corner', -40, 25, 1, -1, 120);
    run('bridge', 30, -8.5, -4, 20.4, 420);
    run('bridgeRail', 28, 2.6, 1, 0);
    run('water', -7, -32, 0, 1, 150);
    run('waveStairs', -26, -36, 1, 0, 160);
    d.teleport(-16, -14);
    d.step(0, 0, 20);
    const before = d.physics.position.y;
    d.physics.jump();
    let peak = before;
    for (let i = 0; i < 90; i++) {
      d.physics.update(1 / 60, new THREE.Vector3());
      peak = Math.max(peak, d.physics.position.y);
    }
    snapshots.jump = {
      before,
      peak,
      after: d.physics.position.y,
      grounded: d.physics.grounded,
    };
    const trunk = new THREE.Vector3().setFromMatrixPosition(d.trunks[10]);
    run('tree', trunk.x + 1, trunk.z, -1, 0, 45);
    snapshots.tree.center = trunk.toArray();
    const origin = new THREE.Vector3(-33.5, 2, 20),
      direction = new THREE.Vector3(-1, 0, 0);
    snapshots.cameraWall = d.physics.cameraDistance(origin, direction, 10);
    const { PlayerController, RAPIER } =
      await import('/app/physics/player-controller.ts');
    const prototype = new PlayerController(new THREE.Vector3(0, 0.03, 0));
    prototype.add(
      RAPIER.ColliderDesc.cuboid(15, 0.5, 15).setTranslation(0, -0.5, 0),
    );
    prototype.add(
      RAPIER.ColliderDesc.cuboid(1, 0.12, 2).setTranslation(3, 0.12, 0),
    );
    prototype.add(
      RAPIER.ColliderDesc.cuboid(0.2, 3, 2).setTranslation(7, 3, 0),
    );
    prototype.sync();
    let stepPeak = 0;
    for (let i = 0; i < 150; i++) {
      prototype.update(1 / 60, new THREE.Vector3(1, 0, 0));
      stepPeak = Math.max(stepPeak, prototype.position.y);
    }
    snapshots.prototype = {
      stepPeak,
      wallX: prototype.position.x,
      grounded: prototype.grounded,
    };
    prototype.dispose();
    const cameraPrototype = new PlayerController(new THREE.Vector3(0, 0, 0));
    const wall = cameraPrototype.add(
      RAPIER.ColliderDesc.cuboid(0.2, 3, 3).setTranslation(3, 3, 0),
    );
    cameraPrototype.sync();
    d.cameraCollision.reset();
    const feet = new THREE.Vector3(),
      desired = new THREE.Vector3(10, 2, 0);
    const short = d.cameraCollision
      .resolve(cameraPrototype, desired, feet, 1 / 60)
      .distanceTo(new THREE.Vector3(0, 1.95, 0));
    cameraPrototype.world.removeCollider(wall, true);
    cameraPrototype.sync();
    const first = d.cameraCollision
      .resolve(cameraPrototype, desired, feet, 1 / 60)
      .distanceTo(new THREE.Vector3(0, 1.95, 0));
    let restored = 0;
    for (let i = 0; i < 90; i++)
      restored = d.cameraCollision
        .resolve(cameraPrototype, desired, feet, 1 / 60)
        .distanceTo(new THREE.Vector3(0, 1.95, 0));
    snapshots.cameraRecovery = { short, first, restored };
    cameraPrototype.dispose();
    snapshots.slopes = [];
    for (const degrees of [30, 60]) {
      const angle = (degrees * Math.PI) / 180,
        p = new PlayerController(new THREE.Vector3(-1, 0.03, 0));
      p.add(RAPIER.ColliderDesc.cuboid(15, 0.5, 5).setTranslation(0, -0.5, 0));
      p.add(
        RAPIER.ColliderDesc.cuboid(4, 0.2, 2)
          .setTranslation(
            4 * Math.cos(angle),
            4 * Math.sin(angle) - 0.2 * Math.cos(angle),
            0,
          )
          .setRotation({
            x: 0,
            y: 0,
            z: Math.sin(angle / 2),
            w: Math.cos(angle / 2),
          }),
      );
      p.sync();
      for (let i = 0; i < 100; i++)
        p.update(1 / 60, new THREE.Vector3(1, 0, 0));
      snapshots.slopes.push({ degrees, position: p.position.toArray() });
      p.dispose();
    }
    snapshots.cameraChecks = [];
    for (const [name, x, z] of [
      ['wall', -33.5, 20],
      ['culture', -27.5, -22],
      ['tree', trunk.x + 0.65, trunk.z],
      ['lawn', -14.15, -9.35],
      ['bridge', 28, 2.6],
    ]) {
      const feet = new THREE.Vector3(x, d.physics.surface(x, z), z);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          desired = feet
            .clone()
            .add(new THREE.Vector3(Math.cos(a) * 10, 3, Math.sin(a) * 10));
        d.cameraCollision.reset();
        const resolved = d.cameraCollision.resolve(
          d.physics,
          desired,
          feet,
          1 / 60,
        );
        let hits = 0;
        d.physics.world.intersectionsWithShape(
          resolved,
          { x: 0, y: 0, z: 0, w: 1 },
          new RAPIER.Ball(0.18),
          () => {
            hits++;
            return true;
          },
          undefined,
          undefined,
          d.physics.capsule,
          undefined,
          d.physics.cameraSolid,
        );
        if (hits)
          snapshots.cameraChecks.push({
            name,
            i,
            hits,
            feet: feet.toArray(),
            resolved: resolved.toArray(),
          });
      }
    }
    d.teleport(-16, -14);
    d.step(0, 0, 20);
    const safe = d.physics.safePosition.clone();
    d.physics.teleport(new THREE.Vector3(0, -15, 0));
    d.step(0, 0, 1);
    snapshots.reset = {
      safe: safe.toArray(),
      after: d.physics.position.toArray(),
      count: d.physics.resets,
    };
    d.teleport(-14.15, -9.35);
    d.setWalking(true);
    d.step(0, 0, 20);
    return snapshots;
  });
  console.log(
    'Physics cases complete',
    JSON.stringify({
      slopes: result.slopes,
      cameraFailures: result.cameraChecks,
      waveStairs: result.waveStairs,
    }),
  );
  await mkdir('work', { recursive: true });
  await page.getByRole('button', { name: '进入漫游', exact: true }).click();
  await page.waitForFunction(
    () => window.parkState()?.grounded && !window.parkState()?.transitioning,
  );
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => window.parkState()?.sitting && !window.parkState()?.transitioning,
  );
  assert.equal(await page.locator('.resting-panel').count(), 1);
  await page.screenshot({ path: 'work/player-sitting.png' });
  await page.getByRole('button', { name: '继续走', exact: true }).click();
  await page.waitForFunction(
    () => !window.parkState()?.sitting && !window.parkState()?.transitioning,
  );
  const start = await page.evaluate(() => window.parkState().position);
  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  const end = await page.evaluate(() => window.parkState().position);
  assert.ok(
    Math.hypot(end.x - start.x, end.z - start.z) > 0.4,
    'WASD movement',
  );
  await page.evaluate(() => {
    const d = document.querySelector(
      '.scene > [data-scene-id="talent-park"]',
    ).parkDebug;
    d.teleport(28, 2.6);
  });
  await page.waitForFunction(() => window.parkState()?.grounded);
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => window.parkState()?.moment === 'moment-star-bridge',
  );
  await page.screenshot({ path: 'work/player-star-bridge.png' });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.parkState()?.sitting);
  const orbitBefore = await page.evaluate(() =>
    document
      .querySelector('.scene > [data-scene-id="talent-park"]')
      .parkDebug.orbitCamera.position.toArray(),
  );
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(1100, 450, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const orbitAfter = await page.evaluate(() =>
    document
      .querySelector('.scene > [data-scene-id="talent-park"]')
      .parkDebug.orbitCamera.position.toArray(),
  );
  assert.notDeepEqual(orbitAfter, orbitBefore, 'mouse orbit');
  await page.getByRole('button', { name: '俯瞰公园', exact: true }).click();
  await page.waitForFunction(
    () => !window.parkState()?.walking && !window.parkState()?.transitioning,
  );
  await page.screenshot({ path: 'work/player-overview.png' });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '返回记忆星球' }).click();
    await page.getByRole('button', { name: '走进这段记忆' }).click();
    await page.waitForFunction(() => !!window.parkState());
  }
  result.ui = {
    sitStand: true,
    bridgeMoment: true,
    keyboard: true,
    mouse: true,
    overview: true,
    disposeReenter: 3,
  };
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('.scene > [data-scene-id="talent-park"]')
          .parkDebug.debugEnabled,
    ),
    false,
    'debug off by default',
  );
  await page.goto('http://localhost:3000/?colliders=1');
  await page.getByRole('button', { name: '01 人才公园' }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.scene > [data-scene-id="talent-park"]')
        ?.parkDebug?.debugEnabled,
  );
  await page.screenshot({ path: 'work/player-debug.png' });
  await page.getByRole('button', { name: '返回记忆星球' }).click();
  await writeFile(
    'work/player-report.json',
    JSON.stringify({ result, errors, baselineResources }, null, 2),
  );
  await page.screenshot({ path: 'work/player-stage3.png' });
  assert.deepEqual(errors, []);
  assert.ok(result.pavilion.position[0] > -35.55, 'pavilion wall');
  assert.ok(result.tower.position[0] > -14.7, 'tower wall');
  assert.ok(result.culture.position[0] > -29, 'culture wall');
  assert.ok(
    result.jump.peak - result.jump.before > 0.65 && result.jump.grounded,
    'jump',
  );
  assert.ok(result.cameraWall > 0 && result.cameraWall < 2.1, 'camera wall');
  assert.ok(result.reset.count >= 1, 'fall reset');
  assert.ok(result.bridge.position[2] > 13, 'bridge exit');
  assert.ok(
    result.prototype.stepPeak > 0.2 && result.prototype.wallX < 6.55,
    'autostep and wall',
  );
  assert.ok(
    result.cameraRecovery.short < 3 &&
      result.cameraRecovery.first > result.cameraRecovery.short &&
      result.cameraRecovery.first < 4 &&
      result.cameraRecovery.restored > 9.9,
    'smooth camera arm recovery',
  );
  assert.equal(
    result.slopes[0].position[1] > 1,
    true,
    'walkable 30 degree slope',
  );
  assert.equal(
    result.slopes[1].position[1] < 0.4,
    true,
    '60 degree slope limit',
  );
  assert.deepEqual(
    result.cameraChecks,
    [],
    'camera sphere remains outside obstacles',
  );
  assert.ok(
    result.waveStairs.position[0] > -20 &&
      result.waveStairs.position[1] > 0.4 &&
      result.waveStairs.grounded,
    'sunken plaza stairs exit',
  );
  for (const name of [
    'spawn',
    'pavilion',
    'tower',
    'culture',
    'corner',
    'bridge',
    'bridgeRail',
    'water',
    'tree',
  ])
    assert.equal(result[name].resets, 0, `${name} no false resets`);
  console.log('PASS initial targeted physics checks');
} finally {
  await browser.close();
}
