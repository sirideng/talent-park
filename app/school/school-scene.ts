import * as THREE from 'three';
import { reducedMotion } from '../shared/preferences';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PlayerController,
  ThirdPersonCamera,
  type InteractionTrigger,
} from '../physics/player-controller';
import { ownThreeScene } from '../scenes/three-resources';
import type { SceneContext } from '../scenes/types';
import {
  SCHOOL_CHAPTER as D,
  trackPoint,
  type ChapterStep,
} from './chapter-data';
import { readSchoolMemory, saveSchoolMemory } from './memory-store';
import { createCampus, createStudent } from './campus';

export function createSchool({ host, resources, navigate }: SceneContext) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6c3ac');
  scene.fog = new THREE.Fog('#e6c3ac', 100, 220);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  ownThreeScene(resources, scene, renderer);
  const physics = new PlayerController(
    new THREE.Vector3(D.spots.spawn[0], 0.03, D.spots.spawn[1]),
  );
  resources.defer(() => physics.dispose());
  const campus = createCampus(scene, physics);
  const ambient = new THREE.HemisphereLight('#ffe1be', '#546466', 2.5);
  scene.add(ambient);
  const light = new THREE.DirectionalLight('#ffd7a1', 3);
  light.position.set(-50, 36, -40);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {
    left: -60,
    right: 60,
    top: 60,
    bottom: -60,
    near: 1,
    far: 170,
  });
  light.shadow.normalBias = 0.04;
  scene.add(light);
  const avatar = createStudent('#567782');
  scene.add(avatar.group);
  avatar.group.position.copy(physics.position);
  const companions = [createStudent('#48505c'), createStudent('#5c6066')];
  companions.forEach((c) => {
    const old = new Set<THREE.Material>();
    const silhouette = new THREE.MeshStandardMaterial({
      color: '#505969',
      transparent: true,
      opacity: 0.58,
      flatShading: true,
    });
    c.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          old.add(m);
        o.material = silhouette;
      }
    });
    old.forEach((m) => m.dispose());
    scene.add(c.group);
  });
  const camera = new THREE.PerspectiveCamera(
      48,
      host.clientWidth / host.clientHeight,
      0.12,
      300,
    ),
    renderCamera = camera.clone();
  const controls = new OrbitControls(camera, renderer.domElement);
  resources.defer(() => controls.dispose());
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 4;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI * 0.55;
  const cameraCollision = new ThirdPersonCamera();
  function resetCamera() {
    controls.target.copy(physics.position).add(new THREE.Vector3(0, 1, 0));
    camera.position.copy(controls.target).add(new THREE.Vector3(8, 7, 11));
    controls.update();
    cameraCollision.reset();
  }
  resetCamera();
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#fff0b1' }),
  );
  scene.add(glow);
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.82, 40),
    new THREE.MeshBasicMaterial({
      color: '#ffe6a0',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  scene.add(glowRing);
  const moonRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.2, 48),
    new THREE.MeshBasicMaterial({
      color: '#f4edcd',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    }),
  );
  moonRing.rotation.x = -Math.PI / 2;
  moonRing.position.y = 0.04;
  scene.add(moonRing);
  const memory = readSchoolMemory();
  let saveOK = true;
  let step: ChapterStep = memory.chapterComplete
    ? 'complete'
    : memory.afterSchool
      ? 'home'
      : 'arrival';
  let guide = false,
    waypoint = 0,
    routeIndex = 0,
    reps = 0,
    practiceTime = 0,
    lastRepCycle = -1,
    repAnimation = 0,
    resting = false,
    restTime = 0,
    moonActive = false,
    moonTime = 0,
    nightBlend = 0,
    elapsed = 0,
    last = performance.now(),
    frame = 0;
  let feedback: string = D.estimate;
  const keys = new Set<string>();
  const skyColor = new THREE.Color(),
    duskColor = new THREE.Color('#e6c3ac'),
    nightColor = new THREE.Color('#172c48');
  const touchMove = new THREE.Vector2();
  const triggers: InteractionTrigger<string>[] = Object.entries(D.spots).map(
    ([id, p]) => ({
      id,
      kind: 'moment',
      center: new THREE.Vector3(p[0], 1, p[1]),
      radius: id === 'moon' ? 3 : 2,
      height: 2.5,
      payload: id,
    }),
  );
  const near = (id: string) =>
    physics.trigger(triggers.filter((t) => t.id === id)) !== null;
  const store = () => {
    saveOK = saveSchoolMemory(memory);
  };
  const ui = document.createElement('section');
  ui.className = 'school-hud';
  ui.setAttribute('aria-label', D.title);
  host.appendChild(ui);
  resources.defer(() => ui.remove());
  ui.innerHTML = `<div class="school-caption"><span>${D.estimate}</span><small>${D.note}</small></div><div class="school-memory" aria-live="polite"></div><section class="school-story"><button class="school-fold" aria-label="${D.ui.fold}">−</button><h2></h2><p></p><div class="school-rhythm" aria-label="${D.ui.rhythm}"><span></span></div><div class="school-progress"></div><div class="school-feedback" role="status"></div><div class="school-actions"><button data-action="interact"></button><button data-action="guide">${D.ui.guide}</button><button data-action="moon">${D.moon.action}</button><button data-action="replay">${D.ui.replay}</button></div></section><div class="school-pad">${D.ui.move.map((name, i) => `<button aria-label="${name}" data-key="${['w', 'a', 's', 'd'][i]}">${['↑', '←', '↓', '→'][i]}</button>`).join('')}</div><div class="school-key-hint">${D.ui.controls}</div>`;
  const element = <T extends HTMLElement>(selector: string) =>
    ui.querySelector<T>(selector)!;
  const heading = element('h2'),
    body = element('.school-story p'),
    progress = element('.school-progress'),
    status = element('.school-feedback'),
    rhythm = element('.school-rhythm'),
    rhythmDot = element('.school-rhythm span'),
    badge = element('.school-memory');
  const action = element<HTMLButtonElement>('[data-action="interact"]'),
    guideButton = element<HTMLButtonElement>('[data-action="guide"]'),
    moonButton = element<HTMLButtonElement>('[data-action="moon"]'),
    replayButton = element<HTMLButtonElement>('[data-action="replay"]');
  function interact() {
    if (moonActive) {
      moonActive = false;
      moonTime = 0;
      resetCamera();
      return;
    }
    if (step === 'arrival' && near('bars')) {
      step = 'practice';
      practiceTime = 0;
      guide = false;
      physics.teleport(
        new THREE.Vector3(D.practiceAnchor[0], 0.03, D.practiceAnchor[1]),
      );
      physics.sync();
      avatar.group.rotation.y = Math.PI;
      resetCamera();
      feedback = D.steps.practice.text;
    } else if (step === 'practice') {
      const cycle = Math.floor(practiceTime / D.practice.cycleSeconds),
        phase =
          (practiceTime % D.practice.cycleSeconds) / D.practice.cycleSeconds;
      if (cycle === lastRepCycle) {
        feedback = D.ui.success;
        return;
      }
      if (phase < D.practice.window[0] || phase > D.practice.window[1]) {
        feedback = D.ui.early;
        return;
      }
      lastRepCycle = cycle;
      repAnimation = 2;
      reps++;
      feedback = D.practice.encouragement[reps - 1];
      if (reps >= D.practice.repetitions) {
        step = 'run';
        waypoint = 0;
        guide = false;
      }
    } else if (step === 'run') {
      guide = !guide;
    } else if (step === 'rest' && near('seat')) {
      resting = !resting;
      guide = false;
      physics.stop();
      if (resting) {
        feedback = D.ui.sunset;
        controls.target
          .copy(physics.position)
          .add(new THREE.Vector3(-2, 1, -4));
        camera.position.copy(physics.position).add(new THREE.Vector3(6, 4, 9));
      }
    } else if (step === 'home') {
      guide = true;
      routeIndex = 0;
    } else if (step === 'complete') navigate('planet');
  }
  function moon() {
    if (moonActive) {
      interact();
      return;
    }
    if (!near('moon') || step === 'practice' || resting) return;
    moonActive = true;
    moonTime = 0;
    guide = false;
    physics.stop();
    feedback = D.moon.text;
    controls.target.copy(physics.position).add(new THREE.Vector3(-4, 5, -8));
    camera.position.copy(physics.position).add(new THREE.Vector3(6, 4, 8));
  }
  resources.listen(action, 'click', interact);
  resources.listen(guideButton, 'click', () => {
    guide = !guide;
    routeIndex = 0;
  });
  resources.listen(moonButton, 'click', moon);
  resources.listen(replayButton, 'click', () => {
    step = 'arrival';
    reps = 0;
    restTime = 0;
    waypoint = 0;
    practiceTime = 0;
    lastRepCycle = -1;
    guide = false;
    resting = false;
    feedback = D.estimate;
  });
  resources.listen(element('.school-fold'), 'click', () => {
    ui.classList.toggle('folded');
    element('.school-fold').textContent = ui.classList.contains('folded')
      ? '+'
      : '−';
    element('.school-fold').setAttribute(
      'aria-label',
      ui.classList.contains('folded') ? D.ui.unfold : D.ui.fold,
    );
  });
  const key = (name: string, pressed: boolean) => {
    if (pressed && name === ' ') {
      if (step !== 'practice' && !resting && !moonActive) physics.jump();
      return;
    }
    if (pressed) {
      keys.add(name.toLowerCase());
      guide = false;
    } else keys.delete(name.toLowerCase());
  };
  resources.listen(window, 'keydown', (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
    )
      return;
    if (event.code === 'KeyE' && !event.repeat) {
      interact();
      return;
    }
    if (event.code === 'Escape') {
      if (moonActive) interact();
      else if (resting) {
        resting = false;
        resetCamera();
      }
      guide = false;
      return;
    }
    if (event.code === 'Space') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (step !== 'practice' && !resting && !moonActive && !event.repeat)
        physics.jump();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
      event.preventDefault();
    key(event.key, true);
  });
  resources.listen(window, 'keyup', (event: KeyboardEvent) =>
    key(event.key, false),
  );
  resources.listen(window, 'blur', () => {
    keys.clear();
    guide = false;
  });
  ui.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
    resources.listen(button, 'pointerdown', (e: PointerEvent) => {
      button.setPointerCapture(e.pointerId);
      key(button.dataset.key!, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      resources.listen(button, type, () => key(button.dataset.key!, false));
  });
  const barsRoute: readonly (readonly number[])[] = [
    [0, 36],
    [41, 36],
    [42, 0],
    D.spots.bars,
  ];
  const homeRoute: readonly (readonly number[])[] = [[0, 36], D.spots.gate];
  function target(): readonly number[] {
    if (step === 'run') return trackPoint(waypoint);
    if (step === 'rest') return D.spots.seat;
    if (step === 'home')
      return homeRoute[Math.min(routeIndex, homeRoute.length - 1)];
    if (step === 'complete') return D.spots.moon;
    return barsRoute[Math.min(routeIndex, barsRoute.length - 1)];
  }
  function refresh() {
    const script = moonActive ? D.moon : D.steps[step];
    heading.textContent = script.title;
    body.textContent = moonActive
      ? moonTime >= D.moonSeconds
        ? D.moon.ending
        : D.moon.text
      : script.text;
    action.textContent = moonActive
      ? D.ui.moonLeave
      : resting
        ? D.ui.leaveSeat
        : D.steps[step].action;
    action.disabled =
      !moonActive &&
      ((step === 'arrival' && !near('bars')) ||
        (step === 'rest' && !resting && !near('seat')));
    guideButton.hidden =
      step === 'practice' || resting || moonActive || step === 'complete';
    guideButton.textContent = guide ? D.ui.stopGuide : D.ui.guide;
    moonButton.hidden =
      !near('moon') || moonActive || step === 'practice' || resting;
    replayButton.hidden = step !== 'complete' || moonActive;
    rhythm.hidden = step !== 'practice' || moonActive;
    const phase =
      (practiceTime % D.practice.cycleSeconds) / D.practice.cycleSeconds;
    rhythmDot.style.left = `${phase * 100}%`;
    rhythm.classList.toggle(
      'ready',
      phase >= D.practice.window[0] && phase <= D.practice.window[1],
    );
    progress.textContent = moonActive
      ? `${Math.min(100, Math.floor((moonTime / D.moonSeconds) * 100))}% · ${D.moon.title}`
      : step === 'practice'
        ? `${reps} / ${D.practice.repetitions} · ${phase >= D.practice.window[0] && phase <= D.practice.window[1] ? D.steps.practice.action : D.ui.waiting}`
        : step === 'run'
          ? `${Math.min(100, Math.round((waypoint / D.run.checkpoints) * 100))}% · ${D.ui.lap}`
          : resting
            ? `${Math.min(100, Math.floor((restTime / D.sunsetSeconds) * 100))}% · ${D.ui.sunset}`
            : '';
    status.textContent = feedback === body.textContent ? '' : feedback;
    badge.textContent = !saveOK
      ? D.ui.saveFailed
      : [
          memory.afterSchool ? D.ui.afterSchoolSaved : '',
          memory.midAutumn ? D.ui.moonSaved : '',
        ]
          .filter(Boolean)
          .join(' / ');
  }
  const resize = () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resources.defer(() => observer.disconnect());
  let lastUI = 0;
  function tick(dt: number) {
    elapsed += dt;
    repAnimation = Math.max(0, repAnimation - dt);
    if (!moonActive) {
      if (step === 'practice') practiceTime += dt;
      if (resting) {
        restTime += dt;
        if (restTime >= D.sunsetSeconds) {
          resting = false;
          step = 'home';
          memory.afterSchool = true;
          store();
          feedback = D.steps.home.text;
          routeIndex = 0;
        }
      }
    } else {
      moonTime += dt;
      if (moonTime >= D.moonSeconds && !memory.midAutumn) {
        memory.midAutumn = true;
        store();
        feedback = D.moon.ending;
      }
    }
    const before = physics.position.clone(),
      direction = new THREE.Vector3();
    if (step !== 'practice' && !resting && !moonActive) {
      if (guide) {
        const goal = target(),
          delta = new THREE.Vector3(goal[0] - before.x, 0, goal[1] - before.z);
        if (delta.length() < 0.65) {
          if (step === 'arrival' && routeIndex < barsRoute.length - 1)
            routeIndex++;
          else if (step === 'home' && routeIndex < homeRoute.length - 1)
            routeIndex++;
          else if (step !== 'run') guide = false;
        } else direction.copy(delta).normalize();
      } else {
        const backward = camera.position.clone().sub(controls.target);
        backward.y = 0;
        backward.normalize();
        const dx =
            Number(keys.has('d') || keys.has('arrowright')) -
            Number(keys.has('a') || keys.has('arrowleft')) +
            touchMove.x,
          dz =
            Number(keys.has('s') || keys.has('arrowdown')) -
            Number(keys.has('w') || keys.has('arrowup')) +
            touchMove.y;
        direction
          .copy(backward)
          .multiplyScalar(dz)
          .addScaledVector(new THREE.Vector3(backward.z, 0, -backward.x), dx)
          .normalize();
      }
      if (touchMove.lengthSq() > 0 && !guide)
        direction.multiplyScalar(Math.min(1, touchMove.length()));
      if (step === 'run') direction.multiplyScalar(D.run.speed / 3.8);
      physics.update(dt, direction, step !== 'run' && keys.has('shift'));
    } else physics.stop();
    const moved = physics.position.clone().sub(before);
    avatar.group.position.copy(physics.position);
    camera.position.add(moved);
    controls.target.add(moved);
    if (moved.lengthSq() > 0.00001)
      avatar.group.rotation.y = Math.atan2(moved.x, moved.z);
    if (step === 'run' && !moonActive) {
      const point = trackPoint(waypoint);
      if (
        physics.grounded &&
        Math.hypot(
          physics.position.x - point[0],
          physics.position.z - point[1],
        ) < 0.7
      ) {
        waypoint++;
        if (waypoint > D.run.checkpoints) {
          step = 'rest';
          guide = false;
          feedback = D.steps.rest.text;
        }
      }
    }
    if (step === 'home' && near('gate')) {
      step = 'complete';
      guide = false;
      memory.chapterComplete = true;
      store();
      feedback = D.ui.saved;
    }
    const seated = resting || moonActive;
    avatar.legs.forEach((leg, i) => {
      leg.rotation.x = seated
        ? -1.2
        : Math.sin(elapsed * 7 + i * Math.PI) *
          (moved.lengthSq() > 0.00001 ? 0.5 : 0);
      leg.position.z = seated ? 0.3 : 0;
    });
    avatar.body.position.y = seated ? 0.72 : 0.94;
    avatar.head.position.y = seated ? 1.3 : 1.52;
    const pull =
      step === 'practice' && repAnimation > 0
        ? Math.sin(((2 - repAnimation) / 2) * Math.PI) * 0.45
        : 0;
    avatar.arms.forEach((arm) => {
      arm.rotation.x = step === 'practice' ? Math.PI : seated ? -0.4 : 0;
      arm.position.y = step === 'practice' ? 1.7 - pull : 0.95;
      arm.position.z = step === 'practice' ? 0.25 : 0;
    });
    if (step === 'practice') avatar.group.position.y += 0.67 + pull;
    companions.forEach((c, i) => {
      c.group.visible = step === 'run' || moonActive || resting;
      if (moonActive) {
        c.group.position.set(i ? 2 : -2, 0.03, -1);
        c.legs.forEach((leg) => (leg.rotation.x = -1.2));
      } else {
        const a = Math.atan2(
          physics.position.z / D.run.radiusZ,
          physics.position.x / D.run.radiusX,
        );
        c.group.position.set(
          physics.position.x + Math.cos(a) * (i ? 2 : -2),
          0.03,
          physics.position.z + Math.sin(a) * (i ? 2 : -2),
        );
        c.group.rotation.y = avatar.group.rotation.y;
        c.legs.forEach(
          (leg, j) =>
            (leg.rotation.x = Math.sin(elapsed * 7 + i + j * Math.PI) * 0.45),
        );
      }
      if (seated) {
        c.legs.forEach((leg) => {
          leg.rotation.x = -1.2;
          leg.position.z = 0.3;
        });
        c.body.position.y = 0.72;
        c.head.position.y = 1.3;
      } else {
        c.legs.forEach((leg) => {
          leg.position.z = 0;
        });
        c.body.position.y = 0.94;
        c.head.position.y = 1.52;
      }
    });
    const goal = target();
    glow.position.set(
      goal[0],
      1.05 + (reducedMotion() ? 0 : Math.sin(elapsed * 2) * 0.12),
      goal[1],
    );
    glowRing.position.set(goal[0], 0.05, goal[1]);
    glow.visible = glowRing.visible =
      !moonActive && !resting && step !== 'practice';
    const targetNight = moonActive
      ? 1
      : step === 'home' || step === 'complete'
        ? 0.58
        : resting
          ? 0.58 * (restTime / D.sunsetSeconds)
          : 0.05;
    nightBlend = THREE.MathUtils.damp(nightBlend, targetNight, 1, dt);
    const sky = skyColor.copy(duskColor).lerp(nightColor, nightBlend);
    scene.background = sky;
    (scene.fog as THREE.Fog).color.copy(sky);
    ambient.intensity = 2.5 - nightBlend * 1.3;
    light.intensity = 3 - nightBlend * 2;
    campus.sun.position.y = 25 - nightBlend * 45;
    campus.moon.visible = moonActive;
    campus.lamps.forEach((l) => {
      (l.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.3 + nightBlend * 2;
    });
    controls.update();
    renderCamera.copy(camera);
    renderCamera.position.copy(
      cameraCollision.resolve(physics, camera.position, physics.position, dt),
    );
    renderCamera.lookAt(controls.target);
    renderer.render(scene, renderCamera);
    if (elapsed - lastUI > 0.1) {
      lastUI = elapsed;
      refresh();
    }
  }
  function animate(now: number) {
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!document.hidden) tick(dt);
  }
  resources.defer(() => cancelAnimationFrame(frame));
  refresh();
  frame = requestAnimationFrame(animate);
  const getState = () => ({
    resting,
    step,
    reps,
    waypoint,
    practiceTime,
    restTime,
    moonActive,
    moonTime,
    guide,
    elapsed,
    memory: { ...memory },
    saveOK,
    position: physics.position.toArray(),
  });
  if (process.env.NODE_ENV === 'development') {
    Object.assign(host, {
      schoolDebug: {
        getState,
        physics,
        camera: renderCamera,
        interact,
        moon,
        tick,
        teleport: (x: number, z: number) => {
          physics.teleport(new THREE.Vector3(x, 0.03, z));
          physics.sync();
          resetCamera();
        },
      },
    });
    resources.defer(() => Reflect.deleteProperty(host, 'schoolDebug'));
  }
  return {
    move: (x: number, y: number) => {
      touchMove.set(x, y);
      if (x || y) guide = false;
    },
    interact,
    key,
    getState,
    reset: resetCamera,
    dispose: () => resources.dispose(),
  };
}
