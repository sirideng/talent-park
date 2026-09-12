import * as THREE from 'three';
import {reducedMotion} from '../shared/preferences';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PlayerController,
  ThirdPersonCamera,
  RAPIER,
  type InteractionTrigger,
} from '../physics/player-controller';
import { ownThreeScene } from '../scenes/three-resources';
import type { SceneContext } from '../scenes/types';
import { createStudent } from '../school/campus';
import { at, nearest, LENGTH, NODES, terrainHeight } from './trail-data';
import { createMountain } from './mountain';
import { MountainWind } from './wind';
import './wutong.css';

export function createWutong({ host, resources }: SceneContext) {
  const scene = new THREE.Scene(),
    renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  ownThreeScene(resources, scene, renderer);
  const spawn = at(0)
      .point.clone()
      .add(new THREE.Vector3(0, 0.06, 0)),
    p = new PlayerController(spawn, { x: 580, z: 580, minY: -15 });
  resources.defer(() => p.dispose());
  const world = createMountain(scene, p),
    avatar = createStudent('#c99561');
  scene.add(avatar.group);
  const camera = new THREE.PerspectiveCamera(
      58,
      host.clientWidth / host.clientHeight,
      0.1,
      5000,
    ),
    renderCamera = camera.clone(),
    boom = new ThirdPersonCamera();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.58;
  resources.defer(() => controls.dispose());
  const reset = () => {
    const t = nearest(p.position);
    controls.target.copy(p.position).add(new THREE.Vector3(0, 1.4, 0));
    camera.position
      .copy(p.position)
      .addScaledVector(t.tangent, -8)
      .add(new THREE.Vector3(0, 4, 0));
    controls.update();
    boom.reset();
  };
  reset();
  const wind = new MountainWind();
  resources.defer(() => wind.dispose());
  const triggers: InteractionTrigger<string>[] = NODES.map((n) => ({
    id: n.id,
    kind: 'moment',
    center: at(n.s)
      .point.clone()
      .add(new THREE.Vector3(0, 1, 0)),
    radius: 6,
    height: 4,
    payload: n.id,
  }));
  const checkpoint = spawn.clone();
  const touchMove=new THREE.Vector2();
  let guide = false,
    watching: string | null = null,
    watchTime = 0,
    elapsed = 0,
    paused = false,
    frame = 0,
    last = performance.now(),
    progress = 0,
    checkpointS = 0,
    resets = 0,
    uiTimer = 0,
    blend = 0,
    returning = false,
    disposed = false;
  let gaze: string | null = null,
    gazeTime = 0;
  const visited = new Set<string>(),
    keys = new Set<string>(),
    fromPos = new THREE.Vector3(),
    fromTarget = new THREE.Vector3(),
    watchPos = new THREE.Vector3(),
    watchTarget = new THREE.Vector3(),
    aimTarget = new THREE.Vector3();
  const hud = document.createElement('div');
  hud.className = 'wutong-hud';
  hud.innerHTML = `<div class="wutong-top"><span>山脚 → 林间 → 山脊 → 山顶</span><progress max="1" value="0" aria-label="登山进度"></progress></div>
 <section class="wutong-card"><button class="fold" aria-label="收起登山介绍" aria-expanded="true">−</button><div class="copy"><small>07 / 梧桐烟云</small><h2>走到云与城市之间。</h2><p>循着石阶慢慢上山，约 8–12 分钟。沿途可以停下来，看港口，也看生活过的城市。</p></div><p class="status" role="status" aria-live="polite"></p><div class="actions"><button data-action="guide">沿山路前进</button><button data-action="interact" hidden>停下看看</button><button data-action="exit" hidden>结束观看</button><button data-action="sound">开启山风</button><button data-action="reset">回到安全点</button></div><div class="gaze" hidden>${world.landmarks.map((l) => `<button data-gaze="${l.id}">凝视${l.name}</button>`).join('')}</div></section>
 <div class="wutong-pad"><button data-key="w" aria-label="向前">↑</button><button data-key="a" aria-label="向左">←</button><button data-key="s" aria-label="向后">↓</button><button data-key="d" aria-label="向右">→</button><button data-key=" " aria-label="跳跃">跃</button></div><div class="wutong-label"></div><div class="wutong-crosshair" hidden>＋</div><footer>地形：USGS SRTM / Tilezen · 步道艺术化缩尺</footer>`;
  host.appendChild(hud);
  resources.defer(() => hud.remove());
  const el = <T extends HTMLElement>(s: string) => hud.querySelector<T>(s)!;
  const button = (a: string) => el<HTMLButtonElement>(`[data-action="${a}"]`);
  const available = () =>
    watching || !p.grounded ? null : p.trigger(triggers);
  function refresh() {
    const near = available(),
      node = NODES.find((n) => n.id === near);
    el<HTMLProgressElement>('progress').value = progress / LENGTH;
    el('.status').textContent = watching
      ? (NODES.find((n) => n.id === watching)?.text ?? '')
      : progress > LENGTH - 9
        ? '你已抵达山顶。罗湖和福田，在西南偏西。'
        : `${progress < LENGTH * 0.22 ? '山脚' : progress < LENGTH * 0.65 ? '林间台阶' : '山脊'} · 已走 ${Math.round((progress / LENGTH) * 100)}%${node ? ' · ' + node.name : ''}`;
    button('guide').hidden = !!watching;
    button('guide').textContent = guide ? '停下脚步' : '沿山路前进';
    button('interact').hidden = !near;
    button('interact').textContent = node ? '观看' + node.name : '停下看看';
    button('exit').hidden = !watching;
    button('sound').textContent = wind.state.active ? '关闭山风' : '开启山风';
    el('.gaze').hidden = watching !== 'summit';
    el('.wutong-pad').hidden = !!watching;
    el('.wutong-crosshair').hidden = watching !== 'summit';
  }
  const clear = () => {
    keys.clear();
    p.stop();
    guide = false;
  };
  function recover() {
    clear();
    p.teleport(checkpoint);
    p.sync();
    resets++;
    reset();
    returning = false;
    watching = null;
    controls.enabled = true;
    wind.stop();
    refresh();
  }
  function stopWatching() {
    if (!watching) return;
    watching = null;
    watchTime = 0;
    gaze = null;
    gazeTime = 0;
    blend = 0;
    returning = true;
    fromPos.copy(renderCamera.position);
    fromTarget.copy(watchTarget);
    controls.enabled = false;
    wind.stop();
    el('.wutong-label').style.opacity = '0';
    refresh();
  }
  function startWatching() {
    const id = available();
    if (!id || returning) return;
    clear();
    watching = id;
    visited.add(id);
    watchTime = 0;
    blend = 0;
    fromPos.copy(renderCamera.position);
    fromTarget.copy(controls.target);
    controls.enabled = false;
    watchPos.copy(p.position).add(new THREE.Vector3(0, 2.4, 0));
    watchTarget.copy(
      id === 'port'
        ? world.port
        : id === 'stone'
          ? world.stone.clone().add(new THREE.Vector3(0, 2, 0))
          : world.landmarks[1].point,
    );
    if (id === 'stone')
      watchPos.copy(p.position).add(new THREE.Vector3(0, 2.6, 0));
    aimTarget.copy(watchTarget);
    wind.start();
    refresh();
  }
  const interact = () => (watching ? stopWatching() : startWatching());
  const setKey = (key: string, on: boolean) => {
    const k = key.toLowerCase();
    if (on) {
      if (k === 'e') {
        interact();
        return;
      }
      if (k === 'escape') {
        stopWatching();
        return;
      }
      if (watching || returning) return;
      guide = false;
      if (k === ' ') p.jump();
      keys.add(k);
    } else keys.delete(k);
  };
  resources.listen(button('guide'), 'click', () => {
    guide = !guide;
    keys.clear();
    refresh();
  });
  resources.listen(button('interact'), 'click', startWatching);
  resources.listen(button('exit'), 'click', stopWatching);
  resources.listen(button('reset'), 'click', recover);
  resources.listen(button('sound'), 'click', () => {
    if (wind.state.active) wind.stop();
    else wind.start();
    refresh();
  });
  resources.listen(el('.fold'), 'click', () => {
    const folded = hud.classList.toggle('collapsed');
    el('.fold').setAttribute('aria-expanded', String(!folded));
    el('.fold').textContent = folded ? '+' : '−';
    el('.fold').setAttribute(
      'aria-label',
      folded ? '展开登山介绍' : '收起登山介绍',
    );
  });
  for (const b of hud.querySelectorAll<HTMLButtonElement>('[data-gaze]'))
    resources.listen(b, 'click', () => {
      const l = world.landmarks.find((v) => v.id === b.dataset.gaze);
      if (l) {
        watchTarget.copy(l.point);
        gazeTime = 0;
      }
    });
  for (const b of hud.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    resources.listen<PointerEvent>(b, 'pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      setKey(b.dataset.key!, true);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      resources.listen(b, event, () => setKey(b.dataset.key!, false));
  }
  resources.listen<KeyboardEvent>(window, 'keydown', (e) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('input,textarea,select') ||
        (e.target.closest('button') && e.key === ' '))
    )
      return;
    if (
      [
        'w',
        'a',
        's',
        'd',
        'e',
        'escape',
        'shift',
        ' ',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
      ].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      if (!e.repeat) setKey(e.key, true);
    }
  });
  resources.listen<KeyboardEvent>(window, 'keyup', (e) => setKey(e.key, false));
  let drag: { x: number; y: number; id: number } | null = null;
  resources.listen<PointerEvent>(renderer.domElement, 'pointerdown', (e) => {
    if (watching) {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  });
  resources.listen<PointerEvent>(renderer.domElement, 'pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId || !watching) return;
    const direction = watchTarget.clone().sub(watchPos),
      spherical = new THREE.Spherical().setFromVector3(direction);
    spherical.theta -= (e.clientX - drag.x) * 0.003;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + (e.clientY - drag.y) * 0.003,
      0.2,
      2.6,
    );
    watchTarget
      .copy(watchPos)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    resources.listen(renderer.domElement, event, () => {
      drag = null;
    });
  const pause = () => {
    paused = true;
    clear();
    wind.stop();
  };
  resources.listen(window, 'blur', pause);
  resources.listen(window, 'focus', () => {
    paused = document.hidden;
    last = performance.now();
  });
  resources.listen(document, 'visibilitychange', () => {
    if (document.hidden) pause();
    else {
      paused = false;
      last = performance.now();
    }
  });
  const resize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderCamera.aspect = camera.aspect;
    renderCamera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resources.defer(() => observer.disconnect());
  function tick(dt: number, draw = true) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    if (!paused) {
      elapsed += dt;
      if (watching) {
        watchTime += dt;
        blend = Math.min(1, blend + (reducedMotion()?1:dt / 1.2));
        const a = THREE.MathUtils.smoothstep(blend, 0, 1);
        const desired = fromPos.clone().lerp(watchPos, a);
        renderCamera.position.copy(boom.resolve(p, desired, p.position, dt));
        aimTarget.lerp(watchTarget, 1 - Math.exp(-4 * dt));
        renderCamera.lookAt(fromTarget.clone().lerp(aimTarget, a));
        const base =
          watching === 'summit' ? 22 : watching === 'stone' ? 60 : 35;
        const fov = THREE.MathUtils.radToDeg(
          2 *
            Math.atan(
              Math.tan(THREE.MathUtils.degToRad(base / 2)) /
                Math.min(1, camera.aspect),
            ),
        );
        renderCamera.fov = THREE.MathUtils.damp(renderCamera.fov, fov, 3, dt);
        renderCamera.updateProjectionMatrix();
        if (watching === 'port' && watchTime >= 18) stopWatching();
      } else if (returning) {
        blend = Math.min(1, blend + (reducedMotion()?1:dt / 1.1));
        const a = THREE.MathUtils.smoothstep(blend, 0, 1);
        renderCamera.position.copy(
          boom.resolve(
            p,
            fromPos.clone().lerp(camera.position, a),
            p.position,
            dt,
          ),
        );
        renderCamera.lookAt(fromTarget.clone().lerp(controls.target, a));
        renderCamera.fov = THREE.MathUtils.lerp(renderCamera.fov, 58, a);
        renderCamera.updateProjectionMatrix();
        if (blend === 1) {
          returning = false;
          controls.enabled = true;
        }
      } else {
        const old = p.position.clone(),
          near = nearest(p.position),
          direction = new THREE.Vector3();
        if (guide) {
          const upcoming = NODES.find(
            (n) => !visited.has(n.id) && n.s >= near.s - 8,
          );
          if (upcoming && Math.abs(upcoming.s - near.s) < 3) {
            guide = false;
          } else if (near.s >= LENGTH - 2) {
            guide = false;
          } else {
            direction.copy(at(near.s + 2.5).point).sub(p.position);
            direction.y = 0;
            direction.normalize();
          }
        } else {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y = 0;
          forward.normalize();
          const right = new THREE.Vector3().crossVectors(
            forward,
            new THREE.Vector3(0, 1, 0),
          );
          direction.addScaledVector(
            forward,
            Number(keys.has('w') || keys.has('arrowup')) -
            Number(keys.has('s') || keys.has('arrowdown'))-touchMove.y,
          );
          direction.addScaledVector(
            right,
            Number(keys.has('d') || keys.has('arrowright')) -
            Number(keys.has('a') || keys.has('arrowleft'))+touchMove.x,
          );
          direction.normalize();
        }
        const oldResets = p.resets;
        if(touchMove.lengthSq()>0&&!guide)direction.multiplyScalar(Math.min(1,touchMove.length()));
        p.update(dt, direction, keys.has('shift'));
        const now = nearest(p.position);
        const fell = p.resets !== oldResets || p.position.y < now.point.y - 6;
        if (fell) {
          recover();
        } else if (
          p.grounded &&
          now.distance < 2.5 &&
          Math.abs(p.position.y - now.point.y) < 0.4
        ) {
          progress = Math.max(progress, now.s);
          if (now.s > checkpointS + 160) {
            checkpoint.copy(p.position);
            checkpointS = now.s;
          }
        }
        const delta = fell ? new THREE.Vector3() : p.position.clone().sub(old);
        camera.position.add(delta);
        controls.target.add(delta);
        controls.update();
        renderCamera.position.copy(
          boom.resolve(p, camera.position, p.position, dt),
        );
        renderCamera.lookAt(controls.target);
        if (direction.lengthSq() > 0.1)
          avatar.group.rotation.y = Math.atan2(direction.x, direction.z);
        avatar.legs.forEach(
          (leg, i) =>
            (leg.rotation.x =
              direction.lengthSq() > 0.1
                ? Math.sin(elapsed * 9 + i * Math.PI) * 0.35
                : 0),
        );
      }
    }
    avatar.group.position.copy(p.position);
    world.update(reducedMotion()?0:elapsed);
    if (watching === 'summit') {
      const look = new THREE.Vector3();
      renderCamera.getWorldDirection(look);
      const target = world.landmarks
        .map((l) => ({
          l,
          dot: l.point.clone().sub(renderCamera.position).normalize().dot(look),
        }))
        .sort((a, b) => b.dot - a.dot)[0];
      if (target.dot > 0.999) {
        gazeTime = target.l.id === gaze ? gazeTime + dt : 0;
        gaze = target.l.id;
      } else {
        gaze = null;
        gazeTime = 0;
      }
      const label = el('.wutong-label');
      label.textContent = gazeTime > 0.5 ? target.l.name : '';
      label.style.opacity = gazeTime > 0.5 ? '1' : '0';
    } else el('.wutong-label').style.opacity = '0';
    uiTimer += dt;
    if (uiTimer > 0.25) {
      uiTimer = 0;
      refresh();
    }
    if (draw) renderer.render(scene, renderCamera);
  }
  const state = () => ({
    position: p.position.toArray(),
    progress,
    length: LENGTH,
    checkpointS,
    watching,
    returning,
    visited: [...visited],
    resets,
    grounded: p.grounded,
    cameraClear: p.cameraClear(renderCamera.position),
    gaze,
    gazeTime,
    audio: wind.state,
    trees: world.treeCount,
    elapsed,
  });
  if (process.env.NODE_ENV !== 'production') {
    Object.assign(host, {
      wutongDebug: {
        tick,
        state,
        physics: p,
        route: { at, nearest, terrainHeight, NODES },
        world,
        placeWorld: (x: number, z: number) => {
          clear();
          const hit = p.world.castRay(
            new RAPIER.Ray({ x, y: 500, z }, { x: 0, y: -1, z: 0 }),
            600,
            true,
            undefined,
            undefined,
            p.capsule,
            undefined,
            p.solid,
          );
          if (!hit) throw new Error('No safe ground');
          p.teleport(new THREE.Vector3(x, 500 - hit.timeOfImpact + 0.04, z));
          p.sync();
          reset();
        },
        orbit: (theta: number, phi: number) => {
          camera.position
            .copy(p.position)
            .add(new THREE.Vector3().setFromSphericalCoords(12, phi, theta));
          controls.target.copy(p.position).add(new THREE.Vector3(0, 1.4, 0));
          controls.update();
        },
        place: (s: number) => {
          clear();
          p.teleport(
            at(s)
              .point.clone()
              .add(new THREE.Vector3(0, 0.08, 0)),
          );
          p.sync();
          reset();
        },
        fall: () => {
          p.teleport(checkpoint.clone().add(new THREE.Vector3(0, -30, 0)));
          p.sync();
        },
        audio: () => wind.state,
      },
    });
    resources.defer(() => {
      delete (host as HTMLElement & { wutongDebug?: unknown }).wutongDebug;
    });
  }
  const loop = () => {
    if (resources.signal.aborted) return;
    const now = performance.now();
    tick((now - last) / 1000);
    last = now;
    frame = requestAnimationFrame(loop);
  };
  resources.defer(() => {
    disposed = true;
    cancelAnimationFrame(frame);
    clear();
  });
  tick(1 / 60);
  refresh();
  frame = requestAnimationFrame(loop);
  return {
    move:(x:number,y:number)=>{touchMove.set(x,y);if(x||y)guide=false;},
    dispose: () => resources.dispose(),
    key: setKey,
    interact,
    reset,
    getState: state,
  };
}
