// Real RAF timing: no accelerated simulation. Mobile viewport is NOT a phone benchmark.
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
    : { width: 1920, height: 1080 },
  hasTouch: mobile,
  isMobile: mobile,
});
const rows = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.addInitScript(() => {
    // Invoked with the original target through .call(this) below.
    /* oxlint-disable typescript/unbound-method -- original methods are invoked with .call(this) */
    const entries = [],
      add = EventTarget.prototype.addEventListener,
      remove = EventTarget.prototype.removeEventListener;
    const cap = (o) => (typeof o === 'boolean' ? o : !!o?.capture);
    EventTarget.prototype.addEventListener = function (t, c, o) {
      if (
        /^(key|pointer|wheel|blur|storage|memory-settings|memory-change|visibilitychange)/.test(t) &&
        c &&
        !entries.some(
          (e) =>
            e.target === this && e.t === t && e.c === c && e.cap === cap(o),
        )
      ) {
        const e = { target: this, t, c, cap: cap(o) };
        entries.push(e);
        if (o?.signal)
          add.call(
            o.signal,
            'abort',
            () => {
              const i = entries.indexOf(e);
              if (i >= 0) entries.splice(i, 1);
            },
            { once: true },
          );
      }
      return add.call(this, t, c, o);
    };
    EventTarget.prototype.removeEventListener = function (t, c, o) {
      const i = entries.findIndex(
        (e) => e.target === this && e.t === t && e.c === c && e.cap === cap(o),
      );
      if (i >= 0) entries.splice(i, 1);
      return remove.call(this, t, c, o);
    };
    window.listenerCounts = () => {
      const counts = {};
      for (const e of entries) {
        const target =
          e.target === window
            ? 'window'
            : e.target === document
              ? 'document'
              : e.target instanceof HTMLCanvasElement
                ? e.target.isConnected
                  ? 'canvas'
                  : 'detached'
                : null;
        if (target) {
          const k = target + e.t;
          counts[k] = (counts[k] ?? 0) + 1;
        }
      }
      return counts;
    };
  });
  await page.goto('http://localhost:3000/');
  await page.waitForFunction(
    () => document.querySelector('.scene canvas')?.qualityDebug,
  );
  let baseline;
  for (const [id, name] of [
    ['planet', ''],
    ['talent-park', '01 人才公园'],
    ['school', '07 我的中学'],
    ['shenzhen-bay', '02 深圳湾'],
    ['happy-harbor', '05 欢乐港湾'],
    ['wutong', '06 梧桐山'],
  ]) {
    if (name) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(
        (id) =>
          document.querySelector(`.scene > [data-scene-id="${id}"]`)
            ?.integrationApi,
        id,
      );
    }
    await page.waitForTimeout(process.env.AUDIT_ONLY ? 500 : 3500);
    await page.evaluate(
      () =>
        (document.querySelector('.scene canvas').qualityDebug.samples.length =
          0),
    );
    await page.waitForTimeout(process.env.AUDIT_ONLY ? 500 : 12000);
    const row = await page.evaluate(() => {
      const d = document.querySelector('.scene canvas').qualityDebug,
        s = d.samples.slice(),
        sorted = [...s].sort((a, b) => a - b),
        gl = d.renderer.getContext(),
        ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        ...d.stats,
        fps: (s.length * 1000) / s.reduce((a, b) => a + b, 0),
        p95: sorted[Math.floor(s.length * 0.95)],
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '',
        webglError: gl.getError(),
        ua: navigator.userAgent,
      };
    });
    assert.equal(row.webglError, 0);
    rows.push({ id, ...row });
    console.log(id, row.fps, row.tier);
    if (!name) {
      baseline = await page.evaluate(() => window.listenerCounts());
      continue;
    }
    await page.evaluate(() => {
      const d = document.querySelector('.scene canvas').qualityDebug,
        assets = new Set(),
        owners = new Map();
      d.scene.traverse((o) => {
        if (o.geometry) {
          assets.add(o.geometry);
          owners.set(o.geometry, o.type);
        }
        for (const m of o.material
          ? Array.isArray(o.material)
            ? o.material
            : [o.material]
          : []) {
          assets.add(m);
          for (const v of Object.values(m)) if (v?.isTexture) assets.add(v);
          for (const u of Object.values(m.uniforms ?? {}))
            if (u.value?.isTexture) assets.add(u.value);
        }
      });
      window.audit = {
        d,
        total: assets.size,
        disposed: 0,
        missing: new Map(
          [...assets].map((a) => [a, { type: a.type, owner: owners.get(a) }]),
        ),
      };
      for (const a of assets)
        a.addEventListener('dispose', () => {
          window.audit.disposed++;
          window.audit.missing.delete(a);
        });
    });
    await page
      .getByRole('button', { name: '返回记忆星球', exact: true })
      .first()
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('.scene')?.dataset.sceneId === 'planet' &&
        document.querySelector('.scene')?.dataset.sceneStatus === 'ready',
    );
    await page.waitForTimeout(300);
    const audit = await page.evaluate(() => ({
      total: window.audit.total,
      disposed: window.audit.disposed,
      missing: [...window.audit.missing.values()],
      lost: window.audit.d.renderer.getContext().isContextLost(),
      listeners: window.listenerCounts(),
    }));
    // Sprite.js owns one module-global quad shared across scenes. Its GPU buffers
    // belong to the renderer/context, not the scene's dispose-event contract.
    assert.ok(
      audit.missing.every(
        (a) => a.owner === 'Sprite' && a.type === 'BufferGeometry',
      ),
    );
    assert.equal(audit.total - audit.missing.length, audit.disposed);
    assert.ok(audit.lost);
    assert.deepEqual(audit.listeners, baseline);
    rows.at(-1).cleanup = audit;
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `work/final-${process.env.AUDIT_ONLY ? 'audit' : 'quality'}-${mobile ? 'mobile' : 'desktop'}.json`,
    JSON.stringify({ viewport: page.viewportSize(), rows, errors }, null, 2),
  );
} finally {
  await browser.close();
}
