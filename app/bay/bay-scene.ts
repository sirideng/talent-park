import * as THREE from 'three';
import './bay.css';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PlayerController,
  ThirdPersonCamera,
  type InteractionTrigger,
} from '../physics/player-controller';
import { ownThreeScene } from '../scenes/three-resources';
import type { SceneContext } from '../scenes/types';
import { createStudent } from '../school/campus';
import { BAY as D, cyclePoint, terrainY } from './chapter-data';
import { readProgress, saveProgress } from './progress';
import { BicycleController } from './bicycle-controller';
import { createCoast, createBicycle } from './coast';
import { BayAmbience } from './ambience';

export function createBay({ host, resources, navigate }: SceneContext) {
  const memory = readProgress(),
    scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  ownThreeScene(resources, scene, renderer);
  const checkpoints = [
    new THREE.Vector3(-43, 0.04, cyclePoint(-43)[1]),
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(36, 0.04, cyclePoint(36)[1]),
  ];
  const spawn = memory.checkpoint
    ? checkpoints[memory.checkpoint].clone().add(new THREE.Vector3(0, 0, -2))
    : new THREE.Vector3(D.spawn[0], 0.04, D.spawn[1]);
  const physics = new PlayerController(spawn);
  resources.defer(() => physics.dispose());
  const coast = createCoast(scene, physics);
  const bicycle = new BicycleController(
    physics,
    checkpoints[memory.checkpoint],
  );
  bicycle.checkpoint.copy(checkpoints[memory.checkpoint]);
  const bike = createBicycle();
  scene.add(bike.group);
  bike.group.position.copy(bicycle.parked);
  bike.group.rotation.y = bicycle.heading;
  const avatar = createStudent('#e4b08a');
  scene.add(avatar.group);
  const ambient = new THREE.HemisphereLight('#aebae0', '#546776', 1.8);
  scene.add(ambient);
  const light = new THREE.DirectionalLight('#ffc486', 1.2);
  light.position.set(30, 45, 70);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {
    left: -70,
    right: 70,
    top: 70,
    bottom: -70,
    near: 1,
    far: 180,
  });
  light.shadow.normalBias = 0.05;
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(
      50,
      host.clientWidth / host.clientHeight,
      0.12,
      650,
    ),
    renderCamera = camera.clone(),
    boom = new ThirdPersonCamera();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI * 0.55;
  resources.defer(() => controls.dispose());
  const reset = () => {
    controls.target.copy(physics.position).add(new THREE.Vector3(0, 1, 0));
    camera.position.copy(physics.position).add(new THREE.Vector3(-7, 5, -9));
    controls.update();
    boom.reset();
  };
  reset();
  const ambience = new BayAmbience();
  resources.defer(() => ambience.dispose());
  let watching: 'gulls' | 'sunrise' | null = null,
    guide = false,
    sound = true,
    saveOK = true,
    feedback = '',
    elapsed = 0,
    dawn = memory.sunrise / D.sunriseSeconds,
    pose = 0,
    uiClock = 0,
    saveClock = 0,
    last = performance.now(),
    frame = 0;
  const keys = new Set<string>();
  const returnPose = {
    position: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };
  let returning = false;
  const triggers: InteractionTrigger<string>[] = [
    ['lookout', D.lookout, 5],
    ['parking', D.parking, 5],
    ['lawn', D.lawn, 3],
  ].map(([id, p, r]) => {
    const point = p as readonly number[];
    return {
      id: id as string,
      kind: 'moment',
      center: new THREE.Vector3(
        point[0],
        terrainY(point[0], point[1]) + 1,
        point[1],
      ),
      radius: r as number,
      height: 3,
      payload: id as string,
    };
  });
  const near = (id: string) =>
    physics.trigger(triggers.filter((t) => t.id === id)) !== null;
  const gullsDone = () => memory.gulls >= D.gullSeconds;
  const save = () => {
    saveOK = saveProgress(memory);
  };
  resources.defer(save);
  const chapter = () =>
    memory.complete
      ? 'complete'
      : memory.parked
        ? 'sunrise'
        : gullsDone()
          ? 'theatre'
          : memory.ride > 30
            ? 'gulls'
            : 'bicycle';
  const ui = document.createElement('section');
  ui.className = 'bay-hud';
  ui.setAttribute('aria-label', D.title);
  host.appendChild(ui);
  resources.defer(() => ui.remove());
  ui.innerHTML = `<div class="bay-note">${D.note}</div><div class="bay-stamps" aria-live="polite"></div><section class="bay-story"><button class="bay-fold" aria-label="${D.ui.fold}">−</button><h2></h2><p></p><div class="bay-progress"></div><div class="bay-feedback" role="status"></div><div class="bay-actions"><button data-action="primary"></button><button data-action="guide">${D.ui.guide}</button><button data-action="sound">${D.ui.mute}</button><button data-action="return">${D.ui.return}</button></div></section><div class="bay-drive"><button data-key="w"></button><button data-key="a">←</button><button data-key="s"></button><button data-key="d">→</button><button data-key="shift">${D.ui.boost}</button></div><div class="bay-instruction"></div><button class="bay-reset" aria-label="${D.ui.reset}">↺</button>`;
  const el = <T extends HTMLElement>(s: string) => ui.querySelector<T>(s)!;
  const primary = el<HTMLButtonElement>('[data-action="primary"]'),
    guideButton = el<HTMLButtonElement>('[data-action="guide"]'),
    audioButton = el<HTMLButtonElement>('[data-action="sound"]');
  function leave() {
    if (!watching) return;
    watching = null;
    returning = true;
    controls.enabled = false;
    keys.clear();
    ambience.stop();
    save();
  }
  function watch(mode: 'gulls' | 'sunrise') {
    if (mode === 'sunrise' && host.clientWidth < 700)
      ui.classList.add('folded');
    watching = mode;
    guide = false;
    keys.clear();
    bicycle.stop();
    returnPose.position.copy(camera.position);
    returnPose.target.copy(controls.target);
    controls.enabled = false;
    returning = false;
    if (sound) ambience.start();
    feedback = '';
  }
  function interact() {
    if (watching) {
      leave();
      return;
    }
    if (returning) return;
    if (bicycle.mounted) {
      if (bicycle.speed > 0.18) {
        feedback = D.ui.moving;
        return;
      }
      const parking = near('parking');
      if (!bicycle.dismount()) {
        feedback = D.ui.unsafe;
        return;
      }
      guide = false;
      if (parking && gullsDone()) {
        memory.parked = true;
        memory.checkpoint = 2;
        bicycle.checkpoint.copy(checkpoints[2]);
        save();
        feedback = D.ui.hill;
      } else feedback = '';
      return;
    }
    if (near('lookout') && memory.ride >= 30) {
      watch('gulls');
      return;
    }
    if (near('lawn') && memory.parked) {
      watch('sunrise');
      return;
    }
    const before = physics.position.clone();
    if (bicycle.mount()) {
      const delta = physics.position.clone().sub(before);
      camera.position.add(delta);
      controls.target.add(delta);
      guide = false;
      feedback = '';
    } else feedback = D.ui.unsafe;
  }
  resources.listen(primary, 'click', interact);
  resources.listen(el('[data-action="return"]'), 'click', () =>
    navigate('planet'),
  );
  resources.listen(guideButton, 'click', () => {
    guide = !guide;
    feedback = '';
    keys.clear();
  });
  resources.listen(audioButton, 'click', () => {
    sound = !ambience.state.active;
    if (watching && sound) ambience.start();
    else ambience.stop();
  });
  resources.listen(el('.bay-fold'), 'click', () => {
    ui.classList.toggle('folded');
    const folded = ui.classList.contains('folded');
    el('.bay-fold').textContent = folded ? '+' : '−';
    el('.bay-fold').setAttribute(
      'aria-label',
      folded ? D.ui.unfold : D.ui.fold,
    );
  });
  resources.listen(el('.bay-reset'), 'click', () => {
    if (!watching && !returning) reset();
  });
  const key = (name: string, pressed: boolean) => {
    const n = name.toLowerCase();
    if (pressed) {
      keys.add(n);
      guide = false;
    } else keys.delete(n);
  };
  resources.listen(window, 'keydown', (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA'].includes(e.target.tagName)
    )
      return;
    if (e.code === 'KeyE' && !e.repeat) {
      interact();
      return;
    }
    if (e.code === 'Escape') {
      leave();
      guide = false;
      return;
    }
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      if (!bicycle.mounted && !watching && !returning && !e.repeat)
        physics.jump();
      key('space', true);
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
      e.preventDefault();
    key(e.key, true);
  });
  resources.listen(window, 'keyup', (e: KeyboardEvent) =>
    key(e.code === 'Space' ? 'space' : e.key, false),
  );
  const pause = () => {
    keys.clear();
    guide = false;
    bicycle.stop();
    ambience.stop();
    save();
  };
  resources.listen(window, 'blur', pause);
  resources.listen(document, 'visibilitychange', () => {
    if (document.hidden) pause();
  });
  ui.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
    resources.listen(button, 'pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      key(button.dataset.key!, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      resources.listen(button, type, () => key(button.dataset.key!, false));
  });
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.25),
    new THREE.MeshBasicMaterial({ color: '#ffdf9a' }),
  );
  scene.add(marker);
  function destination() {
    if (bicycle.mounted)
      return gullsDone()
        ? new THREE.Vector3(36, 0, cyclePoint(36)[1])
        : new THREE.Vector3(0, 0, 0);
    if (memory.parked)
      return new THREE.Vector3(D.lawn[0], terrainY(...D.lawn), D.lawn[1]);
    if (
      memory.ride >= 30 &&
      !gullsDone() &&
      physics.position.distanceTo(new THREE.Vector3(0, 0, 0)) < 14
    )
      return new THREE.Vector3(D.lookout[0], 0, D.lookout[1]);
    return bicycle.parked.clone();
  }
  function refresh() {
    const data = D.chapters[chapter()];
    el('h2').textContent =
      watching === 'gulls'
        ? '海鸥经过的十秒'
        : watching === 'sunrise'
          ? '日出剧场 / 等第一束光'
          : data[0];
    el('.bay-story p').textContent =
      watching === 'gulls'
        ? gullsDone()
          ? D.ui.gullSaved
          : D.ui.gullWait
        : watching === 'sunrise'
          ? D.chapters.sunrise[1]
          : data[1];
    primary.textContent = watching
      ? D.ui.leave
      : bicycle.mounted
        ? D.ui.dismount
        : near('lookout') && memory.ride >= 30
          ? D.ui.gulls
          : near('lawn') && memory.parked
            ? D.ui.sunrise
            : D.ui.mount;
    primary.disabled =
      returning ||
      (!watching &&
        !bicycle.mounted &&
        !(near('lookout') && memory.ride >= 30) &&
        !(near('lawn') && memory.parked) &&
        physics.position.distanceTo(bicycle.parked) > 2.6);
    guideButton.hidden = !!watching || returning;
    guideButton.textContent = guide ? D.ui.stopGuide : D.ui.guide;
    audioButton.hidden = !watching;
    audioButton.textContent = ambience.state.active ? D.ui.mute : D.ui.sound;
    el('[data-action="return"]').hidden = !memory.complete || !!watching;
    el('.bay-feedback').textContent = !saveOK
      ? D.ui.saveFailed
      : ambience.state.failed
        ? D.ui.audioFailed
        : feedback;
    el('.bay-progress').textContent =
      watching === 'sunrise'
        ? `${Math.floor(memory.sunrise)} / ${D.sunriseSeconds} 秒 · ${D.ui.saved}`
        : watching === 'gulls'
          ? `${Math.floor(memory.gulls)} / ${D.gullSeconds} 秒`
          : bicycle.mounted
            ? `${Math.round(bicycle.speed * 3.6)} km/h · 松开踩踏即可滑行`
            : `${Math.floor(memory.ride)} m · 骑行印记`;
    el('.bay-stamps').textContent =
      `${memory.ride >= 30 ? '●' : '○'} 骑行　${gullsDone() ? '●' : '○'} 海鸥　${memory.complete ? '●' : '○'} 日出`;
    el('.bay-drive').hidden = !!watching || returning;
    el('.bay-instruction').textContent = bicycle.mounted
      ? D.ui.controls
      : D.ui.walkControls;
    for (const [k, label] of [
      ['w', bicycle.mounted ? D.ui.pedal : D.ui.forward],
      ['s', bicycle.mounted ? D.ui.brake : D.ui.backward],
      ['a', D.ui.left],
      ['d', D.ui.right],
    ]) {
      const b = el<HTMLButtonElement>(`[data-key="${k}"]`);
      b.setAttribute('aria-label', label);
      if (k === 'w' || k === 's') b.textContent = label;
    }
  }
  const resize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resources.defer(() => observer.disconnect());
  const held = (...names: string[]) => names.some((n) => keys.has(n));
  function tick(dt: number, render = true) {
    elapsed += dt;
    uiClock += dt;
    saveClock += dt;
    const before = physics.position.clone();
    if (watching) {
      bicycle.stop();
      if (watching === 'gulls')
        memory.gulls = Math.min(D.gullSeconds, memory.gulls + dt);
      else {
        memory.sunrise = Math.min(D.sunriseSeconds, memory.sunrise + dt);
        if (memory.sunrise >= D.sunriseSeconds && !memory.complete) {
          memory.complete = true;
          save();
        }
      }
    } else if (!returning) {
      if (bicycle.mounted) {
        let pedal = held('w', 'arrowup'),
          brake = held('s', 'arrowdown', 'space'),
          steer =
            Number(held('a', 'arrowleft')) - Number(held('d', 'arrowright'));
        if (guide) {
          const goal = destination(),
            distance = Math.hypot(goal.x - before.x, goal.z - before.z);
          if (distance < 3) {
            brake = true;
            pedal = false;
            if (bicycle.speed < 0.1) {
              guide = false;
              feedback = gullsDone()
                ? D.ui.parking
                : '停好了，下车走到观景平台。';
            }
          } else {
            const x = Math.min(goal.x, before.x + 3),
              point = cyclePoint(x),
              heading = Math.atan2(point[0] - before.x, point[1] - before.z),
              error = Math.atan2(
                Math.sin(heading - bicycle.heading),
                Math.cos(heading - bicycle.heading),
              );
            steer = THREE.MathUtils.clamp(error * 2.5, -1, 1);
            pedal = Math.abs(error) < 1.2;
            brake = distance < 3;
          }
        }
        memory.ride += bicycle.update(dt, pedal, brake, steer, held('shift'));
        for (const i of [1, 2] as const)
          if (physics.position.distanceTo(checkpoints[i]) < 3) {
            memory.checkpoint = i;
            bicycle.checkpoint.copy(checkpoints[i]);
          }
      } else {
        const direction = new THREE.Vector3();
        if (guide) {
          const delta = destination().sub(before);
          delta.y = 0;
          if (delta.length() < 1.1) guide = false;
          else direction.copy(delta).normalize();
        } else {
          const backward = camera.position.clone().sub(controls.target);
          backward.y = 0;
          backward.normalize();
          direction
            .copy(backward)
            .multiplyScalar(
              Number(held('s', 'arrowdown')) - Number(held('w', 'arrowup')),
            )
            .addScaledVector(
              new THREE.Vector3(backward.z, 0, -backward.x),
              Number(held('d', 'arrowright')) - Number(held('a', 'arrowleft')),
            )
            .normalize();
        }
        physics.update(dt, direction, held('shift'));
      }
    }
    const delta = physics.position.clone().sub(before);
    camera.position.add(delta);
    controls.target.add(delta);
    if (watching) {
      const low = watching === 'sunrise',
        desired = physics.position
          .clone()
          .add(
            new THREE.Vector3(
              low ? (host.clientWidth < 700 ? 0 : -5) : -3,
              low ? 3.2 : 2.7,
              low ? -8 : -6,
            ),
          ),
        target = physics.position
          .clone()
          .add(
            new THREE.Vector3(
              0,
              low ? (host.clientWidth < 700 ? 0.4 : 0.9) : 2,
              low ? 10 : 24,
            ),
          );
      camera.position.lerp(desired, 1 - Math.exp(-dt * 2));
      controls.target.lerp(target, 1 - Math.exp(-dt * 2));
    } else if (returning) {
      camera.position.lerp(returnPose.position, 1 - Math.exp(-dt * 3));
      controls.target.lerp(returnPose.target, 1 - Math.exp(-dt * 3));
      if (camera.position.distanceTo(returnPose.position) < 0.03) {
        returning = false;
        controls.enabled = true;
      }
    }
    pose = THREE.MathUtils.damp(pose, watching === 'sunrise' ? 1 : 0, 3, dt);
    avatar.group.position
      .copy(physics.position)
      .add(new THREE.Vector3(0, pose * 0.23, 0));
    avatar.group.rotation.x = (-pose * Math.PI) / 2;
    if (bicycle.mounted) {
      avatar.group.rotation.y = bicycle.heading;
      avatar.group.position.y += 0.14;
    } else if (delta.lengthSq() > 0.00001)
      avatar.group.rotation.y = Math.atan2(delta.x, delta.z);
    else if (watching) avatar.group.rotation.y = 0;
    avatar.legs.forEach((leg, i) => {
      leg.rotation.x = bicycle.mounted
        ? -0.65 +
          Math.sin(elapsed * 6 + i * Math.PI) *
            Math.min(0.35, bicycle.speed * 0.1)
        : Math.sin(elapsed * 7 + i * Math.PI) *
          (delta.lengthSq() > 0.00001 ? 0.45 : 0);
    });
    avatar.arms.forEach((arm) => (arm.rotation.x = bicycle.mounted ? -1 : 0));
    bike.group.position.copy(
      bicycle.mounted ? physics.position : bicycle.parked,
    );
    if (bicycle.mounted) bike.group.rotation.y = bicycle.heading;
    bike.wheels.forEach((w) => {
      if (bicycle.mounted) w.rotateZ((-bicycle.speed * dt) / 0.3);
    });
    const targetDawn = 0.08 + (memory.sunrise / D.sunriseSeconds) * 0.92;
    dawn = THREE.MathUtils.damp(dawn, targetDawn, 1.5, dt);
    coast.update(elapsed, dawn);
    ambient.intensity = 1.8 + dawn;
    light.intensity = 1.2 + dawn * 2;
    light.color.set('#b1bcec').lerp(new THREE.Color('#ffe3af'), dawn);
    marker.position.copy(destination());
    marker.position.y =
      terrainY(marker.position.x, marker.position.z) +
      1 +
      Math.sin(elapsed * 2) * 0.1;
    marker.visible = !watching;
    controls.update();
    renderCamera.copy(camera);
    renderCamera.position.copy(
      boom.resolve(physics, camera.position, physics.position, dt),
    );
    renderCamera.lookAt(controls.target);
    if (render) renderer.render(scene, renderCamera);
    if (uiClock > 0.1) {
      uiClock = 0;
      refresh();
    }
    if (saveClock > 2) {
      saveClock = 0;
      save();
    }
  }
  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) tick(dt);
  };
  resources.defer(() => cancelAnimationFrame(frame));
  refresh();
  frame = requestAnimationFrame(animate);
  const getState = () => ({
    memory: { ...memory },
    watching,
    returning,
    guide,
    speed: bicycle.speed,
    mounted: bicycle.mounted,
    heading: bicycle.heading,
    position: physics.position.toArray(),
    parked: bicycle.parked.toArray(),
    audio: ambience.state,
    pose,
    dawn,
    camera: renderCamera.position.toArray(),
    resets: physics.resets,
    saveOK,
  });
  if (process.env.NODE_ENV === 'development') {
    Object.assign(host, {
      bayDebug: {
        getState,
        physics,
        bicycle,
        ambience,
        camera: renderCamera,
        tick,
        interact,
        coast,
        key,
        teleport: (x: number, z: number) => {
          physics.teleport(new THREE.Vector3(x, physics.surface(x, z), z));
          physics.sync();
          reset();
        },
      },
    });
    resources.defer(() => Reflect.deleteProperty(host, 'bayDebug'));
  }
  return { interact, key, reset, getState, dispose: () => resources.dispose() };
}
