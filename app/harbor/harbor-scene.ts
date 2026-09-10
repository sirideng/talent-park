import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  RAPIER,
  PlayerController,
  ThirdPersonCamera,
  type InteractionTrigger,
} from '../physics/player-controller';
import type { SceneContext } from '../scenes/types';
import { ownThreeScene } from '../scenes/three-resources';
import { createStudent } from '../school/campus';
import { HARBOR as D } from './setting';
import { createHarborCoast } from './coast';
import { createWheel } from './wheel';
import { HarborAmbience } from './ambience';
import './harbor.css';

type RidePhase = 'walking' | 'boarding' | 'riding' | 'exiting';

export function createHarbor({ host, resources }: SceneContext) {
  const scene = new THREE.Scene(),
    renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  ownThreeScene(resources, scene, renderer);
  const physics = new PlayerController(new THREE.Vector3(...D.spawn));
  resources.defer(() => physics.dispose());
  const coast = createHarborCoast(scene, physics),
    wheel = createWheel(scene, physics);
  physics.sync();
  const avatar = createStudent('#dca77d');
  scene.add(avatar.group);
  const camera = new THREE.PerspectiveCamera(
      58,
      host.clientWidth / host.clientHeight,
      0.08,
      1500,
    ),
    renderCamera = camera.clone();
  const boom = new ThirdPersonCamera(),
    controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 180;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.64;
  resources.defer(() => controls.dispose());
  const reset = () => {
    camera.position
      .copy(physics.position)
      .add(new THREE.Vector3(0, 30, -Math.max(65, 55 / camera.aspect)));
    controls.target.copy(physics.position).add(new THREE.Vector3(0, 22, 0));
    controls.update();
    boom.reset();
  };
  reset();
  const audio = new HarborAmbience();
  resources.defer(() => audio.dispose());
  const entrance = new THREE.Vector3(...D.entrance);
  const triggers: InteractionTrigger<string>[] = [
    {
      id: 'wheel-entry',
      kind: 'moment',
      center: entrance.clone().add(new THREE.Vector3(0, 1, 0)),
      radius: 2.3,
      height: 3,
      payload: 'wheel',
    },
  ];
  const keys = new Set<string>();
  let phase: RidePhase = 'walking',
    view: 'inside' | 'outside' = 'inside',
    angle = 0,
    rideTime = 0,
    totalTime = 0,
    transition = 0;
  let transitionApplied = false,
    secured = false,
    viewFade = 0,
    viewPending: 'inside' | 'outside' | null = null,
    sound = true,
    paused = false;
  let highShown = false,
    labelTime = 0,
    rides = 0,
    frame = 0,
    last = performance.now(),
    guide = false,
    uiClock = 0,
    disposed = false;
  let interiorYaw = 0,
    interiorPitch = -0.1;
  const hud = document.createElement('div');
  hud.className = 'harbor-hud';
  hud.innerHTML = `<div class="harbor-note">微缩前海湾 · 方位保留，距离艺术化压缩</div>
    <section class="harbor-card"><button class="harbor-collapse" aria-label="收起港湾介绍" aria-expanded="true">−</button>
    <div class="harbor-copy"><p class="harbor-kicker">06 / 与城市一起慢下来</p><h2>把黄昏，升到半空。</h2>
    <p>走向湾区之光。等海面变蓝，看远处的窗，一盏一盏亮起来。</p></div>
    <p class="harbor-status" role="status" aria-live="polite"></p>
    <div class="harbor-actions"><button data-action="enter">进入座舱</button><button data-action="guide">走向入口</button>
    <button data-action="view" hidden>切换为外景视角</button><button data-action="exit" hidden>安全返回入口</button>
    <button data-action="sound" hidden>关闭声音</button></div></section>
    <div class="harbor-compass">海湾南侧 · 两岸灯火</div>
    <div class="harbor-pad" aria-label="漫游方向"><button data-key="w" aria-label="向前">↑</button><button data-key="a" aria-label="向左">←</button><button data-key="s" aria-label="向后">↓</button><button data-key="d" aria-label="向右">→</button></div>
    <p class="harbor-help">WASD / 方向键移动 · Shift 快走 · 空格跳跃 · E 登舱 · 拖动看风景</p>
    <div class="harbor-labels"></div><div class="harbor-fade"></div>`;
  host.appendChild(hud);
  resources.defer(() => hud.remove());
  const find = <T extends HTMLElement>(selector: string) =>
    hud.querySelector<T>(selector)!;
  const action = (name: string) =>
    find<HTMLButtonElement>(`[data-action="${name}"]`);
  const status = find('.harbor-status'),
    pad = find('.harbor-pad'),
    fade = find('.harbor-fade');
  const labelNodes = D.landmarks.map((l) => {
    const el = document.createElement('div');
    el.className = 'harbor-label';
    el.innerHTML = `<strong>${l.name}</strong><span>${l.detail}</span>`;
    find('.harbor-labels').appendChild(el);
    return el;
  });
  const canEnter = () =>
    phase === 'walking' &&
    physics.grounded &&
    physics.trigger(triggers) === 'wheel';
  // Verify support, height and capsule clearance before releasing control on exit.
  const safeGround = () => {
    for (const offset of [0, -1.5, 1.5, -3, 3]) {
      const point = entrance.clone().add(new THREE.Vector3(offset, 0, -1));
      const hit = physics.world.castRay(
        new RAPIER.Ray({ x: point.x, y: 3, z: point.z }, { x: 0, y: -1, z: 0 }),
        4,
        true,
        undefined,
        undefined,
        physics.capsule,
        undefined,
        physics.solid,
      );
      if (!hit) continue;
      const ground = 3 - hit.timeOfImpact;
      if (Math.abs(ground) > 0.2) continue;
      point.y = ground + 0.04;
      let clear = true;
      physics.world.intersectionsWithShape(
        point.clone().add(new THREE.Vector3(0, 0.85, 0)),
        { x: 0, y: 0, z: 0, w: 1 },
        physics.capsule.shape,
        () => {
          clear = false;
          return false;
        },
        undefined,
        undefined,
        physics.capsule,
        undefined,
        physics.solid,
      );
      if (clear) return point;
    }
    return null;
  };
  const clearInput = () => {
    keys.clear();
    guide = false;
    physics.stop();
  };
  const enter = () => {
    if (!canEnter()) return;
    clearInput();
    phase = 'boarding';
    transition = 0;
    transitionApplied = false;
    view = 'inside';
    rideTime = 0;
    angle = 0;
    highShown = false;
    labelTime = 0;
    interiorYaw = 0;
    interiorPitch = -0.1;
    controls.enabled = false;
    if (sound) audio.start();
    refresh();
  };
  const exit = () => {
    if (phase === 'walking' || phase === 'exiting') return;
    clearInput();
    phase = 'exiting';
    transition = 0;
    transitionApplied = false;
    viewPending = null;
    viewFade = 0;
    labelTime = 0;
    audio.stop();
    refresh();
  };
  const changeView = () => {
    if (phase !== 'riding' || viewPending) return;
    viewPending = view === 'inside' ? 'outside' : 'inside';
    viewFade = 0.6;
  };
  const interact = () => (phase === 'walking' ? enter() : exit());
  const setKey = (key: string, pressed: boolean) => {
    const k = key.toLowerCase();
    if (pressed) {
      if (k === 'e') {
        interact();
        return;
      }
      if (k === 'v') {
        changeView();
        return;
      }
      if (k === 'escape' && phase !== 'walking') {
        exit();
        return;
      }
      if (phase !== 'walking') return;
      guide = false;
      if (k === ' ') physics.jump();
      keys.add(k);
    } else keys.delete(k);
  };
  function refresh() {
    const walking = phase === 'walking',
      available = canEnter();
    action('enter').hidden = !walking;
    action('enter').disabled = !available;
    action('guide').hidden = !walking || available;
    action('guide').textContent = guide ? '停止前往' : '走向入口';
    action('view').hidden = walking;
    action('view').disabled = phase !== 'riding';
    action('view').textContent =
      view === 'inside' ? '切换为外景视角' : '切换为舱内视角';
    action('exit').hidden = walking;
    action('exit').disabled = phase === 'exiting';
    action('sound').hidden = walking;
    action('sound').textContent = audio.state.active ? '关闭声音' : '开启声音';
    pad.hidden = !walking;
    status.textContent =
      phase === 'boarding'
        ? '正在登舱，请稍候…'
        : phase === 'exiting'
          ? '正在安全返回入口…'
          : walking
            ? available
              ? '入口已到 · E / 进入座舱'
              : rides
                ? '海湾还在。想再看一圈，随时回来。'
                : '沿前方步道走到入口'
            : `${view === 'inside' ? '舱内 · 拖动环顾' : '外景 · 俯瞰前海湾'} · ${Math.round((rideTime / D.rideSeconds) * 100)}%${paused ? ' · 已暂停' : ''}`;
  }
  resources.listen(action('enter'), 'click', enter);
  resources.listen(action('exit'), 'click', exit);
  resources.listen(action('view'), 'click', changeView);
  resources.listen(action('guide'), 'click', () => {
    guide = !guide;
    keys.clear();
    refresh();
  });
  resources.listen(action('sound'), 'click', () => {
    sound = !audio.state.active;
    if (sound && !paused) audio.start();
    else audio.stop();
    refresh();
  });
  resources.listen(find('.harbor-collapse'), 'click', () => {
    const collapsed = hud.classList.toggle('collapsed'),
      button = find<HTMLButtonElement>('.harbor-collapse');
    button.textContent = collapsed ? '+' : '−';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute(
      'aria-label',
      collapsed ? '展开港湾介绍' : '收起港湾介绍',
    );
  });
  resources.listen<KeyboardEvent>(window, 'keydown', (e) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('input,textarea,select') ||
        (e.target.closest('button') && [' ', 'Enter'].includes(e.key)))
    )
      return;
    if (
      [
        'w',
        'a',
        's',
        'd',
        'e',
        'v',
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
  for (const button of hud.querySelectorAll<HTMLButtonElement>('[data-key]')) {
    resources.listen<PointerEvent>(button, 'pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      setKey(button.dataset.key!, true);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      resources.listen(button, event, () => setKey(button.dataset.key!, false));
  }
  let drag: { id: number; x: number; y: number } | null = null;
  resources.listen<PointerEvent>(renderer.domElement, 'pointerdown', (e) => {
    if (phase === 'riding') {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  });
  resources.listen<PointerEvent>(renderer.domElement, 'pointermove', (e) => {
    if (drag?.id !== e.pointerId || phase !== 'riding') return;
    interiorYaw -= (e.clientX - drag.x) * 0.004;
    interiorPitch = THREE.MathUtils.clamp(
      interiorPitch + (e.clientY - drag.y) * 0.003,
      -0.65,
      0.55,
    );
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    resources.listen(renderer.domElement, event, () => {
      drag = null;
    });
  const suspend = () => {
    paused = true;
    clearInput();
    audio.stop();
    refresh();
  };
  resources.listen(window, 'blur', suspend);
  resources.listen(window, 'focus', () => {
    paused = document.hidden;
    last = performance.now();
    refresh();
  });
  resources.listen(document, 'visibilitychange', () => {
    if (document.hidden) suspend();
    else {
      paused = false;
      last = performance.now();
      refresh();
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
  const direction = new THREE.Vector3(),
    previous = new THREE.Vector3();
  const rideCamera = () => {
    if (view === 'inside') {
      // Fixed eye sits clear of the character and every closed cabin wall.
      renderCamera.position
        .copy(wheel.active.position)
        .add(new THREE.Vector3(0, 0.45, 0.7));
      const aim = new THREE.Vector3(
        Math.sin(interiorYaw) * Math.cos(interiorPitch),
        Math.sin(interiorPitch),
        Math.cos(interiorYaw) * Math.cos(interiorPitch),
      );
      renderCamera.lookAt(renderCamera.position.clone().add(aim));
    } else {
      const high = Math.sin(Math.min(1, rideTime / D.rideSeconds) * Math.PI);
      // Fit both banks even in portrait. Camera is outside the wheel's volume;
      // switches use a brief fade, not a sweep through the glass/steel.
      const distance = Math.max(155, 190 / camera.aspect);
      renderCamera.position.set(-15, 62 + high * 20, -distance);
      renderCamera.lookAt(-10, 16, 110);
    }
  };
  const updateLabels = () => {
    scene.updateMatrixWorld();
    renderCamera.updateMatrixWorld();
    const alpha = Math.min(1, labelTime / 2),
      rect = host.getBoundingClientRect();
    D.landmarks.forEach((l, i) => {
      const p = new THREE.Vector3(...l.point).project(renderCamera),
        el = labelNodes[i];
      const visible =
        labelTime > 0 &&
        phase === 'riding' &&
        p.z > -1 &&
        p.z < 1 &&
        Math.abs(p.x) < 0.93 &&
        Math.abs(p.y) < 0.88;
      el.style.opacity = visible ? String(alpha) : '0';
      el.style.left = `${(p.x * 0.5 + 0.5) * rect.width}px`;
      el.style.top = `${(-p.y * 0.5 + 0.5) * rect.height}px`;
    });
  };
  function tick(dt: number, draw = true) {
    if (disposed) return;
    dt = Math.min(dt, 0.1);
    if (!paused) {
      totalTime += dt;
      labelTime = Math.max(0, labelTime - dt);
      if (phase === 'walking') {
        previous.copy(physics.position);
        direction.set(0, 0, 0);
        if (guide) {
          direction.copy(entrance).sub(physics.position);
          direction.y = 0;
          if (direction.length() < 1.1) {
            guide = false;
          } else direction.normalize();
        } else {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y = 0;
          forward.normalize();
          const right = new THREE.Vector3().crossVectors(
            forward,
            new THREE.Vector3(0, 1, 0),
          );
          const pressed = (a: string, b: string) => keys.has(a) || keys.has(b);
          direction.addScaledVector(
            forward,
            Number(pressed('w', 'arrowup')) - Number(pressed('s', 'arrowdown')),
          );
          direction.addScaledVector(
            right,
            Number(pressed('d', 'arrowright')) -
              Number(pressed('a', 'arrowleft')),
          );
          direction.normalize();
        }
        physics.update(dt, direction, keys.has('shift'));
        const delta = physics.position.clone().sub(previous);
        controls.target.add(delta);
        camera.position.add(delta);
        controls.update();
        renderCamera.position.copy(
          boom.resolve(physics, camera.position, physics.position, dt),
        );
        renderCamera.lookAt(controls.target);
        if (direction.lengthSq() > 0.1)
          avatar.group.rotation.y = Math.atan2(direction.x, direction.z);
        avatar.legs.forEach((leg, i) => {
          leg.rotation.x =
            direction.lengthSq() > 0.1
              ? Math.sin(totalTime * 9 + i * Math.PI) * 0.35
              : 0;
        });
      } else {
        if (phase === 'riding') {
          rideTime = Math.min(D.rideSeconds, rideTime + dt);
          angle = (rideTime / D.rideSeconds) * Math.PI * 2;
          if (!highShown && rideTime >= D.rideSeconds * 0.4) {
            highShown = true;
            labelTime = 12;
          }
          if (rideTime >= D.rideSeconds) {
            rides++;
            exit();
          }
        }
        if (phase === 'boarding' || phase === 'exiting') {
          transition += dt;
          if (transition >= 0.6 && !transitionApplied) {
            if (phase === 'boarding') {
              wheel.update(0);
              physics.teleport(wheel.anchor);
              physics.sync();
              secured = true;
              transitionApplied = true;
            } else {
              const ground = safeGround();
              if (ground) {
                angle = 0;
                wheel.update(0);
                physics.teleport(ground);
                physics.safePosition.copy(ground);
                physics.sync();
                secured = false;
                transitionApplied = true;
                reset();
              }
              // Refuse an unsafe release; retain secure cabin lock and let scene exit work.
              else {
                transition = 0.6;
                status.textContent = '入口暂不可落地，请使用返回星球。';
              }
            }
          }
          if (transition >= 1.2 && transitionApplied) {
            phase = phase === 'boarding' ? 'riding' : 'walking';
            controls.enabled = phase === 'walking';
            clearInput();
            refresh();
          }
        }
        wheel.update(angle);
        if (secured) {
          physics.teleport(wheel.anchor);
          physics.sync();
        }
        if (!secured) {
          renderCamera.position.copy(
            boom.resolve(physics, camera.position, physics.position, dt),
          );
          renderCamera.lookAt(controls.target);
        } else rideCamera();
        avatar.group.rotation.y = 0;
        avatar.legs.forEach((leg) => {
          leg.rotation.x = 0;
        });
      }
      if (viewPending) {
        viewFade = Math.max(0, viewFade - dt);
        if (viewFade <= 0.3) {
          view = viewPending;
          viewPending = null;
          refresh();
        }
      } else viewFade = Math.max(0, viewFade - dt);
    }
    avatar.group.position.copy(physics.position);
    avatar.group.visible = !secured || view === 'outside';
    const transitionOpacity =
      phase === 'boarding' || phase === 'exiting'
        ? Math.min(1, transition / 0.5, (1.2 - transition) / 0.5)
        : 0;
    fade.style.opacity = String(
      Math.max(
        0,
        transitionOpacity,
        viewFade > 0.3 ? (0.6 - viewFade) / 0.3 : viewFade / 0.3,
      ),
    );
    const night = THREE.MathUtils.smoothstep(totalTime, 8, D.duskSeconds);
    coast.update(totalTime, night);
    wheel.glow.emissiveIntensity = night * 2;
    uiClock += dt;
    if (uiClock > 0.2) {
      uiClock = 0;
      refresh();
    }
    if (draw) {
      updateLabels();
      renderer.render(scene, renderCamera);
    }
  }
  const getState = () => ({
    phase,
    view,
    rideTime,
    angle,
    rides,
    night: THREE.MathUtils.smoothstep(totalTime, 8, D.duskSeconds),
    position: physics.position.toArray(),
    anchor: wheel.anchor.toArray(),
    upright: wheel.cabins.every((c) =>
      c.quaternion.equals(new THREE.Quaternion()),
    ),
    anchorError: physics.position.distanceTo(wheel.anchor),
    cameraClear: physics.cameraClear(renderCamera.position),
    camera: renderCamera.position.toArray(),
    grounded: physics.grounded,
    resets: physics.resets,
    audio: audio.state,
    labelTime,
    paused,
    disposed,
    canEnter: canEnter(),
    colliders: physics.world.colliders.len(),
  });
  if (process.env.NODE_ENV !== 'production') {
    const debug = {
      getState,
      tick,
      teleport: (x: number, z: number) => {
        if (phase !== 'walking') return;
        physics.teleport(new THREE.Vector3(x, 0.04, z));
        physics.sync();
        reset();
      },
      audioState: () => audio.state,
      capsuleClear: () => {
        let clear = true;
        physics.world.intersectionsWithShape(
          physics.capsule.translation(),
          physics.capsule.rotation(),
          physics.capsule.shape,
          () => {
            clear = false;
            return false;
          },
          undefined,
          undefined,
          physics.capsule,
          undefined,
          physics.solid,
        );
        return clear;
      },
      orbit: (azimuth: number) => {
        controls.target
          .copy(physics.position)
          .add(new THREE.Vector3(0, 1.4, 0));
        camera.position
          .copy(physics.position)
          .add(
            new THREE.Vector3(Math.sin(azimuth) * 8, 4, Math.cos(azimuth) * 8),
          );
        controls.update();
        boom.reset();
      },
    };
    Object.assign(host, { harborDebug: debug });
    resources.defer(() => {
      delete (host as HTMLElement & { harborDebug?: unknown }).harborDebug;
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
    clearInput();
  });
  refresh();
  tick(1 / 60);
  frame = requestAnimationFrame(loop);
  return {
    key: setKey,
    interact,
    reset,
    getState,
    dispose: () => resources.dispose(),
  };
}
