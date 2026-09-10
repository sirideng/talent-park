import * as THREE from 'three';
import { RAPIER, PlayerController } from '../physics/player-controller';
import { coastZ, terrainY } from './chapter-data';

export function createCoast(scene: THREE.Scene, physics: PlayerController) {
  const mat = (color: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      flatShading: true,
    });
  const grass = mat('#77968a'),
    path = mat('#d9d3bb'),
    coral = mat('#ae706e'),
    rail = mat('#749297'),
    wood = mat('#9d8875');
  const mesh = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m = rail,
    solid = true,
  ) => {
    const o = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    if (solid)
      physics.add(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
      );
    return o;
  };
  const strip = (offset: number, width: number, m: THREE.Material) => {
    const v: number[] = [],
      idx: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = -58 + (i * 116) / 120;
      for (const d of [-width / 2, width / 2]) {
        const z = coastZ(x) + offset + d;
        v.push(x, terrainY(x, z) + 0.025, z);
      }
      if (i < 120) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return mesh(g, m);
  };
  // One rendered triangle surface is also the sole collidable ground, including the grass slope.
  const v: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= 116; i++)
    for (let j = 0; j <= 47; j++) {
      const x = -58 + i,
        z = coastZ(x) - 38 + j;
      v.push(x, terrainY(x, z), z);
      if (i < 116 && j < 47) {
        const k = i * 48 + j;
        idx.push(k, k + 1, k + 48, k + 1, k + 49, k + 48);
      }
    }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  ground.setIndex(idx);
  ground.computeVertexNormals();
  mesh(ground, grass);
  physics.add(
    RAPIER.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(idx)),
  );
  strip(0, 4, coral);
  strip(5, 3.5, path);
  strip(0, 0.09, path).position.y = 0.012;
  // A visibly fenced waterfront; upper transparent safety extension prevents jumps into sea.
  for (let i = 0; i < 58; i++) {
    const x = -58 + i * 2,
      a = new THREE.Vector3(x, 0, coastZ(x) + 8.5),
      b = new THREE.Vector3(x + 2, 0, coastZ(x + 2) + 8.5),
      mid = a.clone().add(b).multiplyScalar(0.5),
      length = a.distanceTo(b),
      angle = Math.atan2(-(b.z - a.z), b.x - a.x);
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle,
    );
    for (const y of [0.5, 1.15]) {
      const bar = box(mid.x, y, mid.z, length + 0.05, 0.075, 0.09, rail, false);
      bar.quaternion.copy(q);
    }
    box(x, 0.6, a.z, 0.07, 1.2, 0.07, rail, false);
    physics.add(
      RAPIER.ColliderDesc.cuboid(length / 2 + 0.04, 1.7, 0.08)
        .setTranslation(mid.x, 1.7, mid.z)
        .setRotation(q),
      'water-edge',
    );
  }
  for (const x of [-58, 58]) {
    const z = coastZ(x) - 14.5;
    box(x, 0.6, z, 0.3, 1.2, 47, rail, false);
    physics.add(
      RAPIER.ColliderDesc.cuboid(0.2, 2, 23.5).setTranslation(x, 2, z),
      'water-edge',
    );
  }
  for (let i = 0; i < 29; i++) {
    const x = -56 + i * 4,
      z = coastZ(x) - 37.5;
    box(x, 0.55, z, 4.2, 1.1, 0.3, rail);
  }
  physics.add(
    RAPIER.ColliderDesc.cuboid(90, 2, 110).setTranslation(0, -4, 0),
    'hazard',
  );
  const platform = box(0, 0.055, 6, 12, 0.1, 4, wood, false);
  // Parking bay and grass paths lead away from the through cycle lane.
  box(36, 0.04, 3.4, 8, 0.04, 5, path, false);
  for (const x of [33, 35, 37, 39])
    box(x, 0.065, 3.4, 0.07, 0.02, 4.5, coral, false);
  for (let r = 7; r <= 17; r += 3) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI + (i * Math.PI) / 64;
      const x = 36 + Math.cos(a) * r,
        z = -4 + Math.sin(a) * r;
      pts.push(new THREE.Vector3(x, terrainY(x, z) + 0.045, z));
    }
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        64,
        0.12,
        5,
        false,
      ),
      path,
    );
  }
  const lawnMark = mesh(
    new THREE.RingGeometry(1, 1.12, 48),
    path,
    36,
    terrainY(36, -10) + 0.05,
    -10,
  );
  lawnMark.rotation.x = -Math.PI / 2;
  let seed = 20260910;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const trees: { x: number; z: number }[] = [];
  for (let i = 0; i < 38; i++) {
    const x = -54 + rand() * 106,
      z = coastZ(x) - 16 - rand() * 15;
    if (x > 21 && z > -28) continue;
    const y = terrainY(x, z),
      h = 2.6 + rand();
    mesh(new THREE.CylinderGeometry(0.15, 0.24, h, 7), wood, x, y + h / 2, z);
    physics.add(
      RAPIER.ColliderDesc.cylinder(h / 2, 0.24).setTranslation(x, y + h / 2, z),
    );
    trees.push({ x, z });
    mesh(
      new THREE.IcosahedronGeometry(1.9, 1),
      mat(i % 2 ? '#547d78' : '#7a9683'),
      x,
      y + h,
      z,
    );
    physics.add(
      RAPIER.ColliderDesc.ball(1.9).setTranslation(x, y + h, z),
      'canopy',
    );
  }
  // Public skyline motifs only, separated into two misty groups rather than claimed geolocation.
  const skyline = new THREE.Group();
  scene.add(skyline);
  const cityMat = mat('#91a4b4');
  cityMat.transparent = true;
  cityMat.opacity = 0.32;
  skyline.add(box(25, 0.2, 140, 165, 0.6, 15, cityMat, false));
  for (let i = 0; i < 32; i++) {
    const x = -45 + i * 4.6,
      z = 135 + (i % 3) * 3,
      h = 4 + rand() * 10;
    const o = mesh(
      new THREE.BoxGeometry(2.1 + rand(), h, 2.5),
      cityMat,
      x,
      h / 2,
      z,
    );
    skyline.attach(o);
  }
  const tower = mesh(new THREE.ConeGeometry(2, 23, 5), cityMat, 78, 11.5, 140);
  skyline.attach(tower);
  const water = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, dawn: { value: 0 } },
    vertexShader: `varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 p;uniform float time;uniform float dawn;void main(){float ripple=sin(p.x*1.9+p.z*.65+time*1.3)*sin(p.z*2.7-time*.7);vec3 c=mix(vec3(.10,.19,.32),vec3(.30,.57,.61),dawn);float beam=exp(-pow((p.x-30.)/(4.+abs(p.z-5.)*.10),2.));float shine=smoothstep(.12,.9,ripple)*beam*dawn;gl_FragColor=vec4(c+ripple*.023+shine*vec3(.62,.39,.12),1.);}`,
  });
  const seaGeo = new THREE.PlaneGeometry(700, 700);
  seaGeo.rotateX(-Math.PI / 2);
  seaGeo.translate(0, -0.35, 160);
  const sea = mesh(seaGeo, water);
  sea.castShadow = false;
  // Single enclosing sky shader avoids hard horizon seams; water meets its fog band.
  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { dawn: { value: 0 } },
    vertexShader: `varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 p;uniform float dawn;void main(){float h=clamp(normalize(p).y*2.,0.,1.);vec3 top=mix(vec3(.16,.19,.34),vec3(.48,.68,.79),dawn);vec3 low=mix(vec3(.55,.42,.57),vec3(1.,.71,.40),dawn);gl_FragColor=vec4(mix(low,top,smoothstep(0.,1.,h)),1.);}`,
  });
  mesh(new THREE.SphereGeometry(450, 32, 20), sky);
  const sun = mesh(
    new THREE.SphereGeometry(6, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#ffe6a4' }),
    30,
    -6,
    180,
  );
  sun.castShadow = false;
  const birds = Array.from({ length: 18 }, (_, i) => {
    const group = new THREE.Group();
    scene.add(group);
    const white = mat('#f4f1e7');
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), white);
    body.scale.set(0.7, 0.7, 1.7);
    group.add(body);
    const wings = [-1, 1].map((sign) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [0, 0, 0, sign * 1.1, 0.08, -0.15, sign * 0.3, 0, 0.28],
          3,
        ),
      );
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, white);
      white.side = THREE.DoubleSide;
      group.add(m);
      return m;
    });
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.22, 5),
      mat('#aa6054'),
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.4;
    group.add(beak);
    return { group, wings, phase: (i / 18) * Math.PI * 2 };
  });
  const update = (time: number, dawn: number) => {
    water.uniforms.time.value = time;
    water.uniforms.dawn.value = dawn;
    sky.uniforms.dawn.value = dawn;
    sun.position.y = -6 + dawn * 31;
    birds.forEach(({ group, wings, phase }, i) => {
      const a = time * (i < 9 ? 0.22 : 0.09) + phase;
      group.position.set(
        Math.cos(a) * (i < 9 ? 17 : 29),
        i < 9 ? 1.4 + Math.sin(a * 2) * 0.5 : 8 + Math.sin(a) * 2,
        32 + Math.sin(a) * (i < 9 ? 9 : 19),
      );
      group.rotation.y = -a;
      wings.forEach((w, j) => {
        w.rotation.z = Math.sin(time * 3.5 + phase) * 0.4 * (j ? 1 : -1);
      });
    });
  };
  physics.sync();
  return { update, trees, platform, sun };
}

export function createBicycle() {
  const group = new THREE.Group(),
    paint = new THREE.MeshStandardMaterial({
      color: '#dba67d',
      metalness: 0.2,
      roughness: 0.6,
    }),
    rubber = new THREE.MeshStandardMaterial({ color: '#233f49' });
  const tube = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    r = 0.035,
    m: THREE.Material = paint,
  ) => {
    const o = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, a.distanceTo(b), 7),
      m,
    );
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    group.add(o);
  };
  const wheels = [-0.48, 0.48].map((z) => {
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.045, 7, 20),
      rubber,
    );
    o.rotation.y = Math.PI / 2;
    o.position.set(0, 0.34, z);
    group.add(o);
    for (let a = 0; a < Math.PI; a += Math.PI / 4)
      tube(
        new THREE.Vector3(0, 0.34 + Math.sin(a) * 0.27, z + Math.cos(a) * 0.27),
        new THREE.Vector3(0, 0.34 - Math.sin(a) * 0.27, z - Math.cos(a) * 0.27),
        0.009,
      );
    return o;
  });
  const a = new THREE.Vector3(0, 0.34, -0.48),
    b = new THREE.Vector3(0, 0.32, 0),
    c = new THREE.Vector3(0, 0.8, -0.13),
    d = new THREE.Vector3(0, 0.82, 0.35),
    e = new THREE.Vector3(0, 0.34, 0.48);
  for (const [u, v] of [
    [a, b],
    [a, c],
    [b, c],
    [c, d],
    [b, d],
    [d, e],
  ])
    tube(u, v);
  tube(d, new THREE.Vector3(0, 1.05, 0.38));
  tube(
    new THREE.Vector3(-0.32, 1.05, 0.38),
    new THREE.Vector3(0.32, 1.05, 0.38),
  );
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.06, 0.3), rubber);
  seat.position.set(0, 0.85, -0.15);
  group.add(seat);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group, wheels };
}
