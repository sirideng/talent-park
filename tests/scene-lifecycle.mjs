// Run against the local dev server. Use an installed Playwright or set
// PLAYWRIGHT_MODULE_PATH to the bundled Playwright index.mjs. No runtime test hooks.
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
 ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href)
 : await import('playwright');
const browser = await playwright.chromium.launch({headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'msedge'});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
const errors = [], failedRequests = [], consoleErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') {errors.push(message.text()); consoleErrors.push({text: message.text(), url: message.location().url});}});
page.on('response', response => {if (response.status() >= 400) failedRequests.push({url: response.url(), status: response.status()});});

try {
 await page.addInitScript(() => {
  const listeners = [], frames = new Set(), observers = new Set(), cameras = new WeakMap();
  // These original prototype methods are deliberately invoked with .call(this).
  // oxlint-disable-next-line typescript/unbound-method
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
  const matches = (entry, target, type, callback, options) => entry.target === target && entry.type === type && entry.callback === callback && entry.capture === capture(options);
  EventTarget.prototype.addEventListener = function(type, callback, options) {
   if (/^(key|pointer|wheel|blur|contextmenu)/.test(type) && callback && !options?.signal?.aborted
     && !listeners.some(entry => matches(entry, this, type, callback, options))) {
    const entry = {target: this, type, callback, capture: capture(options)};
    listeners.push(entry);
    if (options?.signal) add.call(options.signal, 'abort', () => {const i = listeners.indexOf(entry); if (i >= 0) listeners.splice(i, 1);}, {once: true});
   }
   return add.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function(type, callback, options) {
   const i = listeners.findIndex(entry => matches(entry, this, type, callback, options));
   if (i >= 0) listeners.splice(i, 1);
   return remove.call(this, type, callback, options);
  };
  const raf = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = callback => {
   const id = raf(time => {frames.delete(id); callback(time);}); frames.add(id); return id;
  };
  window.cancelAnimationFrame = id => {frames.delete(id); cancel(id);};
  const OriginalObserver = window.ResizeObserver;
  window.ResizeObserver = class extends OriginalObserver {
   observe(target, options) {observers.add(this); super.observe(target, options);}
   disconnect() {observers.delete(this); super.disconnect();}
  };
  // Capture the view matrix sent to WebGL; this proves drag changes the camera,
  // rather than mistaking animated stars/water for camera motion in screenshots.
  // oxlint-disable-next-line typescript/unbound-method
  const matrix = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  // oxlint-disable-next-line typescript/unbound-method
  const uniform = WebGL2RenderingContext.prototype.getUniformLocation;
  const names = new WeakMap();
  WebGL2RenderingContext.prototype.getUniformLocation = function(program, name) {
   const result = uniform.call(this, program, name); if (result) names.set(result, name); return result;
  };
  WebGL2RenderingContext.prototype.uniformMatrix4fv = function(location, transpose, values, ...rest) {
   if (names.get(location) === 'viewMatrix') cameras.set(this.canvas, Array.from(values));
   return matrix.call(this, location, transpose, values, ...rest);
  };
  const tools = new Map();
  Object.defineProperty(document, 'modelContext', {configurable: true, value: {
   registerTool(tool, {signal}) {tools.set(tool.name, tool); signal.addEventListener('abort', () => tools.delete(tool.name), {once: true});},
  }});
  window.sceneTest = {
   state: () => tools.get('read_park_state')?.execute(),
   camera: () => cameras.get(document.querySelector('.scene canvas')),
   snapshot: () => {
    const counts = {};
    for (const entry of listeners) {
     const target = entry.target === window ? 'window' : entry.target === document ? 'document'
      : entry.target instanceof HTMLCanvasElement ? (entry.target.isConnected ? 'canvas' : 'detachedCanvas') : null;
     if (target) {const key = `${target}:${entry.type}:${entry.capture}`; counts[key] = (counts[key] || 0) + 1;}
    }
    return {listeners: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))), frames: frames.size, observers: observers.size,
     canvases: document.querySelectorAll('.scene canvas').length, tools: [...tools.keys()].sort((a, b) => a.localeCompare(b))};
   },
  };
 });
 const response = await page.goto(process.env.TEST_URL || 'http://localhost:3000/');
 assert.equal(response.status(), 200);
 const ready = id => page.locator(`.scene[data-scene-id="${id}"][data-scene-status="ready"]`).waitFor({timeout: 60000});
 await ready('planet');
 await page.waitForFunction(() => window.sceneTest.camera()?.length === 16);
 const planetBaseline = await page.evaluate(() => window.sceneTest.snapshot());
 const before = await page.evaluate(() => window.sceneTest.camera());
 await page.mouse.move(980, 480); await page.mouse.down(); await page.mouse.move(1200, 510, {steps: 16}); await page.mouse.up();
 await page.waitForFunction(previous => window.sceneTest.camera().some((n, i) => Math.abs(n - previous[i]) > 0.1), before);
 const rotated = await page.evaluate(() => window.sceneTest.camera());
 assert.notDeepEqual(rotated, before);
 await page.getByRole('button', {name: '重置星球视角'}).click();
 await page.getByRole('button', {name: '07 我的中学'}).click();
 assert.equal(await page.locator('.location-card h3').textContent(), '北京师范大学南山附属中学');
 assert.equal(await page.locator('.location-card button').count(), 0);
 await page.getByRole('button', {name: '01 人才公园'}).click();
 let parkBaseline;
 const rounds = [];
 for (let round = 1; round <= 5; round++) {
  if (round > 1) await page.getByRole('button', {name: '走进这段记忆'}).click();
  await ready('talent-park');
  await page.waitForFunction(() => !!window.sceneTest.state());
  const park = await page.evaluate(() => window.sceneTest.snapshot());
  parkBaseline ??= park;
  assert.deepEqual(park, parkBaseline, `Park resources changed on visit ${round}`);
  assert.equal(park.canvases, 1);
  await page.getByRole('button', {name: '进入漫游', exact: true}).click();
  await page.waitForFunction(() => window.sceneTest.state()?.walking && !window.sceneTest.state()?.transitioning);
  const start = await page.evaluate(() => window.sceneTest.state().position);
  await page.keyboard.down('w');
  await page.waitForFunction(previous => {
   const p = window.sceneTest.state().position; return Math.hypot(p.x - previous.x, p.z - previous.z) > 0.2;
  }, start);
  // Return with a pressed key and captured pointer to exercise cleanup mid-input.
  if (round === 5) {
   await page.mouse.move(1000, 500); await page.mouse.down(); await page.mouse.move(1050, 520, {steps: 5});
   await page.getByRole('button', {name: '返回记忆星球'}).press('Enter');
   await page.mouse.up();
  } else await page.getByRole('button', {name: '返回记忆星球'}).click();
  await page.keyboard.up('w');
  await ready('planet');
  const planet = await page.evaluate(() => window.sceneTest.snapshot());
  assert.deepEqual(planet, planetBaseline, `Planet resources changed after return ${round}`);
  rounds.push({round, park, planet});
 }
 const intentionalErrorStart = errors.length;
 // Bounded lifecycle fault checks use the same manager in an isolated DOM host.
 const lifecycle = await page.evaluate(async () => {
  const {SceneManager} = await import('/app/scenes/manager.ts');
  const {SceneResources} = await import('/app/scenes/resources.ts');
  const {SCENES} = await import('/app/scenes/registry.ts');
  const host = document.createElement('div'); document.body.appendChild(host);
  const events = Object.fromEntries(['resetView', 'selectLocation', 'selectPlace', 'visit', 'nearby', 'momentAvailable', 'resting'].map(key => [key, () => {}]));
  let pending, state, created = 0, entered = 0, exited = 0, disposed = 0, cleaned = 0, staleEvents = 0;
  const factory = {create: ({resources}) => {created++; resources.defer(() => cleaned++); return {api: {}, enter: () => entered++, exit: () => exited++, dispose: () => disposed++};}};
  const registry = {...SCENES, planet: {...SCENES.planet, load: () => new Promise(resolve => {pending = resolve;})},
   'talent-park': {...SCENES['talent-park'], load: async () => factory}};
  const manager = new SceneManager(host, registry, events, next => {state = next;});
  const slow = manager.switchTo('planet');
  await manager.switchTo('talent-park'); pending(factory); await slow;
  const race = {created, entered, scene: state.sceneId, children: host.children.length};
  await manager.switchTo('talent-park');
  manager.dispose(); manager.dispose();
  const releases = {created, entered, exited, disposed, cleaned, children: host.children.length};
  const stopped = new SceneManager(host, registry, events, () => {});
  const stopLoad = stopped.switchTo('planet'); stopped.dispose(); pending(factory); await stopLoad;
  const stoppedCreates = created;
  registry.planet.load = async () => {throw new Error('TEST_EXPECTED: import failure');};
  const recovery = new SceneManager(host, registry, events, next => {state = next;});
  await recovery.switchTo('planet'); const importError = state.status;
  registry.planet.load = async () => ({create: context => {
   context.resources.defer(() => cleaned++);
   const notify = context.resources.guard(() => staleEvents++);
   queueMicrotask(notify);
   throw new Error('TEST_EXPECTED: partial create failure');
  }});
  await recovery.switchTo('planet'); const createError = state.status;
  const emptyAfterFailure = host.children.length === 0;
  registry.planet.load = async () => factory;
  await recovery.switchTo('planet'); const recovered = state.status;
  recovery.dispose();
  const scope = new SceneResources(), order = [];
  scope.defer(() => order.push('last')); scope.defer(() => {throw new Error('cleanup');}); scope.defer(() => order.push('first'));
  let cleanupError = false; try {scope.dispose();} catch {cleanupError = true;} scope.dispose();
  host.remove();
  return {race, releases, stoppedCreates, importError, createError, emptyAfterFailure, recovered, staleEvents, order, cleanupError,
   ids: Object.keys(SCENES), plannedWithoutLoad: Object.values(SCENES).filter(s => s.status === 'planned').every(s => !s.load)};
 });
 assert.deepEqual(lifecycle.race, {created: 1, entered: 1, scene: 'talent-park', children: 1});
 assert.deepEqual(lifecycle.releases, {created: 1, entered: 1, exited: 1, disposed: 1, cleaned: 1, children: 0});
 assert.equal(lifecycle.stoppedCreates, 1);
 assert.equal(lifecycle.importError, 'error'); assert.equal(lifecycle.createError, 'error');
 assert.equal(lifecycle.emptyAfterFailure, true); assert.equal(lifecycle.recovered, 'ready');
 assert.equal(lifecycle.staleEvents, 0); assert.equal(lifecycle.cleanupError, true);
 assert.deepEqual(lifecycle.order, ['first', 'last']); assert.equal(lifecycle.plannedWithoutLoad, true);
 for (const id of ['planet', 'talent-park', 'happy-harbor', 'shenzhen-bay', 'wutong', 'school']) assert(lifecycle.ids.includes(id));
 // The original page requests an absent favicon. Do not hide any other error.
 const appErrors = errors.slice(0, intentionalErrorStart);
 const faviconErrors = consoleErrors.filter(r => r.url && new URL(r.url).pathname === '/favicon.ico' && r.text === 'Failed to load resource: the server responded with a status of 404 (Not Found)');
 assert(failedRequests.every(r => new URL(r.url).pathname === '/favicon.ico' && r.status === 404), JSON.stringify(failedRequests));
 assert.equal(appErrors.filter(e => e !== 'Failed to load resource: the server responded with a status of 404 (Not Found)').length, 0, JSON.stringify(appErrors));
 assert(appErrors.length <= faviconErrors.length, JSON.stringify(appErrors));
 assert.equal(errors.slice(intentionalErrorStart).filter(e => !e.includes('TEST_EXPECTED:')).length, 0);
 await mkdir('work', {recursive: true});
 await page.screenshot({path: 'work/scene-lifecycle-planet.png'});
 const report = {passed: true, homepage: response.status(), rotationChanged: true, rounds, lifecycle, existingFavicon404: faviconErrors.length, newAppErrors: 0};
 await writeFile('work/scene-lifecycle-results.json', JSON.stringify(report, null, 2));
 console.log(JSON.stringify(report));
} finally {await browser.close();}
