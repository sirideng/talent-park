import * as THREE from 'three';
import { reducedMotion as prefersReducedMotion } from './shared/preferences';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneResources } from './scenes/resources';
import { ownThreeScene } from './scenes/three-resources';
import {
  PLANET_LOCATIONS,
  TALENT_PARK,
  type MemoryLocation,
} from './locations';
import {
  ISLANDS,
  PLANET_RADIUS,
  PLANET_SEED,
  createTerrain,
  islandNormal,
  seededRandom,
  sampleTerrain,
} from './planet-terrain';
import { createLandmark } from './planet-landmarks';

type Flight = {
  from: THREE.Vector3;
  turn: THREE.Quaternion;
  distance: number;
  destinationDistance: number;
  target: THREE.Vector3;
  destinationTarget: THREE.Vector3;
  progress: number;
  duration: number;
  enter?: MemoryLocation;
};

export function createPlanet(
  host: HTMLElement,
  onEnter: (location: MemoryLocation) => void,
  onSelect: (location: MemoryLocation) => void,
  resources = new SceneResources(),
) {
  let frame = 0,
    last = performance.now(),
    elapsed = 0;
  resources.defer(() => cancelAnimationFrame(frame));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#081d29');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  ownThreeScene(resources, scene, renderer);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  resources.defer(() => controls.dispose());
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minPolarAngle = 0.035;
  controls.maxPolarAngle = Math.PI - 0.035;
  controls.autoRotateSpeed = 0.18;
  controls.rotateSpeed = 0.7;
  const reducedMotion = {
    get matches() {
      return prefersReducedMotion();
    },
  };
  scene.add(new THREE.HemisphereLight('#d4e8e5', '#344b62', 2.4));
  const sun = new THREE.DirectionalLight('#ffe2b5', 2.5);
  sun.position.set(-36, 62, 70);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#b9dfea', 1.0);
  fill.position.set(40, -35, -60);
  scene.add(fill);
  const globe = new THREE.Group();
  scene.add(globe);
  const terrain = createTerrain();
  terrain.name = 'spherical-terrain';
  globe.add(terrain);
  const landmarks = ISLANDS.map((island) => createLandmark(island));
  globe.add(...landmarks);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS + 0.7, 64, 40),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      vertexShader:
        'varying vec3 p;varying vec3 n;void main(){p=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
      fragmentShader:
        'varying vec3 p;varying vec3 n;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(cameraPosition-p))),2.8);gl_FragColor=vec4(.40,.77,.82,rim*.25);}',
    }),
  );
  scene.add(atmosphere);
  const random = seededRandom(PLANET_SEED),
    cloudShell = new THREE.Group();
  scene.add(cloudShell);
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: '#e5ebe3',
    transparent: true,
    opacity: 0.34,
    flatShading: true,
    depthWrite: false,
    roughness: 1,
  });
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 14; i++) {
    const normal = new THREE.Vector3().setFromSphericalCoords(
      1,
      Math.acos(1 - (2 * (i + 0.5)) / 14),
      i * 2.399,
    );
    const cloud = new THREE.Group();
    cloud.position.copy(normal).multiplyScalar(PLANET_RADIUS + 3.2);
    cloud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
      puff.position.set((j - 1) * 0.9, 0, random() * 0.35);
      puff.scale.set(
        1.15 + random() * 0.6,
        0.28 + random() * 0.15,
        0.7 + random() * 0.4,
      );
      cloud.add(puff);
    }
    cloudShell.add(cloud);
  }
  const stars = new Float32Array(210 * 3);
  for (let i = 0; i < 210; i++)
    new THREE.Vector3()
      .setFromSphericalCoords(
        125 + random() * 50,
        Math.acos(random() * 2 - 1),
        random() * Math.PI * 2,
      )
      .toArray(stars, i * 3);
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: '#c7dcdf',
        size: 0.1,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    ),
  );
  const label = document.createElement('div');
  label.className = 'planet-hover-label';
  label.hidden = true;
  label.setAttribute('role', 'tooltip');
  label.id = 'planet-place-label';
  host.appendChild(label);
  resources.defer(() => label.remove());
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    'aria-label',
    '深圳记忆星球：拖动旋转，滚轮或双指缩放，方向键旋转，回车选择地点',
  );
  canvas.setAttribute('aria-describedby', 'planet-place-label');
  canvas.style.touchAction = 'none';
  let hovered: MemoryLocation | null = null,
    focused: MemoryLocation | null = null,
    selected = TALENT_PARK;
  let flight: Flight | null = null,
    idleSince = performance.now(),
    defaultDistance = 86;
  const pointers = new Map<number, { x: number; y: number }>();
  let gestureMoved = false;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const homeDirection = islandNormal(ISLANDS[0])
    .add(new THREE.Vector3(0.48, -0.15, 0.1))
    .normalize();
  function resize() {
    const width = host.clientWidth,
      height = host.clientHeight;
    camera.aspect = width / height;
    defaultDistance = Math.max(
      80,
      (PLANET_RADIUS /
        (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          Math.min(1, camera.aspect))) *
        1.33,
    );
    controls.minDistance = Math.max(37, defaultDistance * 0.55);
    controls.maxDistance = defaultDistance * 1.55;
    camera.setViewOffset(
      width,
      height,
      0,
      width < 680 ? height * 0.07 : 0,
      width,
      height,
    );
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (!camera.position.length())
      camera.position.copy(homeDirection).multiplyScalar(defaultDistance);
    else if (!flight)
      camera.position.setLength(
        THREE.MathUtils.clamp(
          camera.position.length(),
          controls.minDistance,
          controls.maxDistance,
        ),
      );
  }
  const observer = new ResizeObserver(resize);
  resources.defer(() => observer.disconnect());
  observer.observe(host);
  resize();
  controls.update();
  function startFlight(
    direction: THREE.Vector3,
    distance: number,
    enter?: MemoryLocation,
  ) {
    idleSince = performance.now();
    const position = camera.position.clone(),
      target = controls.target.clone();
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    controls.enabled = false;
    camera.position.copy(position);
    controls.target.copy(target);
    flight = {
      from: camera.position.clone().normalize(),
      turn: new THREE.Quaternion().setFromUnitVectors(
        camera.position.clone().normalize(),
        direction,
      ),
      distance: camera.position.length(),
      destinationDistance: distance,
      target: controls.target.clone(),
      destinationTarget: enter
        ? direction.clone().multiplyScalar(PLANET_RADIUS * 0.62)
        : new THREE.Vector3(),
      progress: 0,
      duration: reducedMotion.matches ? 0.01 : enter ? 1.6 : 1.3,
      enter,
    };
  }
  function focusLocation(location: MemoryLocation) {
    if (flight?.enter) return;
    const island = ISLANDS.find((item) => item.id === location.id);
    if (!island) return;
    selected = location;
    focused = location;
    onSelect(location);
    const normal = islandNormal(island),
      rotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        normal,
      );
    const direction = normal
      .clone()
      .multiplyScalar(0.84)
      .add(new THREE.Vector3(0, 0, 0.55).applyQuaternion(rotation))
      .normalize();
    startFlight(direction, defaultDistance);
    if (flight)
      flight.destinationTarget
        .copy(normal)
        .multiplyScalar(PLANET_RADIUS * 0.58);
  }
  function previewLocation(location: MemoryLocation | null) {
    focused = location;
    idleSince = performance.now();
  }
  function enterLocation(location: MemoryLocation) {
    if (flight?.enter) return;
    if (location.status !== 'ready') {
      focusLocation(location);
      return;
    }
    const island = ISLANDS.find((item) => item.id === location.id);
    if (!island) return;
    selected = location;
    onSelect(location);
    focused = null;
    hovered = null;
    startFlight(
      islandNormal(island),
      Math.max(37, defaultDistance * 0.51),
      location,
    );
  }
  function hitLocation(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([terrain, ...landmarks], true)[0];
    if (!hit) return null;
    let object: THREE.Object3D | null = hit.object;
    while (object && object !== globe) {
      if (object.userData.locationId)
        return (
          PLANET_LOCATIONS.find(
            (location) => location.id === object?.userData.locationId,
          ) ?? null
        );
      object = object.parent;
    }
    const sample = sampleTerrain(hit.point.clone().normalize());
    return sample.land
      ? (PLANET_LOCATIONS.find(
          (location) => location.id === sample.island.id,
        ) ?? null)
      : null;
  }
  resources.listen<PointerEvent>(canvas, 'pointerdown', (event) => {
    if (pointers.size === 0) gestureMoved = false;
    else gestureMoved = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    idleSince = performance.now();
    focused = null;
  });
  resources.listen<PointerEvent>(canvas, 'pointermove', (event) => {
    const down = pointers.get(event.pointerId);
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
      gestureMoved = true;
    hovered = pointers.size || flight ? null : hitLocation(event);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  resources.listen<PointerEvent>(canvas, 'pointerup', (event) => {
    const wasDown = pointers.has(event.pointerId);
    pointers.delete(event.pointerId);
    idleSince = performance.now();
    if (!wasDown || gestureMoved || pointers.size || flight?.enter) return;
    const location = hitLocation(event);
    if (!location) return;
    if (location.status === 'ready') enterLocation(location);
    else {
      focusLocation(location);
      if (event.pointerType === 'touch') focused = null;
    }
  });
  resources.listen<PointerEvent>(canvas, 'pointercancel', (event) => {
    pointers.delete(event.pointerId);
    gestureMoved = true;
  });
  resources.listen(canvas, 'pointerleave', () => {
    hovered = null;
  });
  resources.listen(
    canvas,
    'wheel',
    () => {
      idleSince = performance.now();
    },
    { passive: true },
  );
  resources.listen<KeyboardEvent>(canvas, 'keydown', (event) => {
    if (flight?.enter) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      enterLocation(hovered ?? selected);
      return;
    }
    if (
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    event.preventDefault();
    flight = null;
    controls.enabled = true;
    focused = null;
    idleSince = performance.now();
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    spherical.theta +=
      (Number(event.key === 'ArrowLeft') - Number(event.key === 'ArrowRight')) *
      0.13;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi +
        (Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp')) *
          0.1,
      0.05,
      Math.PI - 0.05,
    );
    camera.position.setFromSpherical(spherical);
    controls.target.set(0, 0, 0);
    controls.update();
  });
  const cancelFocusFlight = () => {
    idleSince = performance.now();
    if (flight && !flight.enter) {
      flight = null;
      controls.enabled = true;
    }
  };
  controls.addEventListener('start', cancelFocusFlight);
  resources.defer(() =>
    controls.removeEventListener('start', cancelFocusFlight),
  );
  const projected = new THREE.Vector3();
  function updateLabel() {
    const location = focused ?? hovered,
      island = ISLANDS.find((item) => item.id === location?.id);
    if (!location || !island || flight?.enter) {
      label.hidden = true;
      return;
    }
    const normal = islandNormal(island);
    if (normal.dot(camera.position.clone().normalize()) < 0.3) {
      label.hidden = true;
      return;
    }
    projected
      .copy(normal)
      .multiplyScalar(PLANET_RADIUS + 5.5)
      .project(camera);
    label.hidden = false;
    label.textContent = location.shortName;
    label.dataset.locationId = location.id;
    label.style.left = `${THREE.MathUtils.clamp((projected.x * 0.5 + 0.5) * host.clientWidth, 70, host.clientWidth - 70)}px`;
    label.style.top = `${THREE.MathUtils.clamp((-projected.y * 0.5 + 0.5) * host.clientHeight - 45, 50, host.clientHeight - 120)}px`;
  }
  function animate(now: number) {
    if (resources.signal.aborted) return;
    frame = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    elapsed += dt;
    controls.autoRotate =
      !reducedMotion.matches &&
      !flight &&
      !focused &&
      !hovered &&
      !pointers.size &&
      now - idleSince > 3500;
    if (flight) {
      flight.progress = Math.min(1, flight.progress + dt / flight.duration);
      const t = flight.progress,
        tween = t * t * t * (t * (t * 6 - 15) + 10);
      const turn = new THREE.Quaternion().slerpQuaternions(
        new THREE.Quaternion(),
        flight.turn,
        tween,
      );
      camera.position
        .copy(flight.from)
        .applyQuaternion(turn)
        .multiplyScalar(
          THREE.MathUtils.lerp(
            flight.distance,
            flight.destinationDistance,
            tween,
          ),
        );
      controls.target.lerpVectors(
        flight.target,
        flight.destinationTarget,
        tween,
      );
      camera.lookAt(controls.target);
      if (t >= 1) {
        const enter = flight.enter;
        flight = null;
        controls.enabled = true;
        if (enter) {
          onEnter(enter);
          return;
        }
      }
    } else controls.update(dt);
    if (!reducedMotion.matches) {
      cloudShell.rotation.y = elapsed * 0.009;
      cloudShell.rotation.z = Math.sin(elapsed * 0.025) * 0.025;
    }
    updateLabel();
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  return {
    enterLocation,
    focusLocation,
    previewLocation,
    zoom: (factor: number) => {
      if (flight?.enter) return;
      cancelFocusFlight();
      camera.position
        .multiplyScalar(factor)
        .clampLength(controls.minDistance, controls.maxDistance);
      controls.update();
    },
    reset: () => {
      if (flight?.enter) return;
      focused = null;
      hovered = null;
      selected = TALENT_PARK;
      onSelect(selected);
      startFlight(homeDirection, defaultDistance);
    },
    getState: () => ({
      scene: 'planet',
      seed: PLANET_SEED,
      selected: selected.id,
      flying: !!flight,
      autoRotate: controls.autoRotate,
      islands: ISLANDS.map((island) => ({
        id: island.id,
        latitude: island.latitude,
        longitude: island.longitude,
      })),
      camera: camera.position.toArray(),
    }),
    dispose: () => resources.dispose(),
  };
}
