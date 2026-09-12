import * as THREE from 'three';
import { RAPIER, PlayerController } from '../physics/player-controller';

/** Original geometry inspired by public campus silhouettes. All layout is inferred. */
export function createCampus(scene: THREE.Scene, physics: PlayerController) {
  const cream = new THREE.MeshStandardMaterial({
    color: '#ebe1ce',
    roughness: 0.85,
    flatShading: true,
  });
  const red = new THREE.MeshStandardMaterial({
    color: '#b7614e',
    roughness: 1,
  });
  const teal = new THREE.MeshStandardMaterial({
    color: '#416c78',
    roughness: 0.5,
  });
  const green = new THREE.MeshStandardMaterial({
    color: '#81996c',
    roughness: 1,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: '#ffe5a5',
    emissive: '#ffbc70',
    emissiveIntensity: 1,
  });
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m = cream,
    solid = true,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid)
      physics.add(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
      );
    return mesh;
  };
  const pole = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m = teal,
  ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
    physics.add(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y, z));
    return mesh;
  };
  box(0, -0.45, 0, 110, 0.9, 104, green);
  // The ground is a single slab, with low boundary walls and an open gate aisle.
  for (const x of [-54, 54]) box(x, 0.5, 0, 0.4, 1, 104);
  box(0, 0.5, -51.5, 108, 1, 0.4);
  for (const x of [-29, 29]) box(x, 0.5, 51.5, 50, 1, 0.4);
  function ring(
    rx: number,
    rz: number,
    width: number,
    y: number,
    m: THREE.Material,
  ) {
    const v: number[] = [],
      idx: number[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      for (const r of [0, width])
        v.push(Math.cos(a) * (rx - r), y, Math.sin(a) * (rz - r));
      if (i < 128) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  red.side = THREE.DoubleSide;
  cream.side = THREE.DoubleSide;
  ring(38, 26, 8, 0.014, red);
  for (let i = 0; i < 6; i++)
    ring(31 + i * 1.2, 19 + i * 1.2, 0.065, 0.025, cream);
  // Field markings: visual only, on the same flat collidable ground.
  for (const z of [-15, 15]) box(0, 0.025, z, 42, 0.025, 0.08, cream, false);
  for (const x of [-21, 21]) box(x, 0.025, 0, 0.08, 0.025, 30, cream, false);
  box(0, 0.026, 0, 0.08, 0.025, 30, cream, false);
  ring(5, 5, 0.07, 0.025, cream);
  // Long white decks, blue window ribbons and a rounded bow: old campus motif.
  box(-14, 5.3, -39, 65, 10.6, 12, teal);
  for (let level = 0; level < 5; level++) {
    box(-14, level * 2.15 + 0.22, -39, 68, 0.3, 13.5);
    for (let x = -46; x < 20; x += 4)
      box(x, level * 2.15 + 1.2, -32.7, 0.22, 1.9, 0.45);
  }
  const bow = new THREE.Mesh(
    new THREE.CylinderGeometry(6.75, 6.75, 10.8, 32),
    cream,
  );
  bow.position.set(20, 5.4, -39);
  scene.add(bow);
  bow.castShadow = true;
  physics.add(
    RAPIER.ColliderDesc.cylinder(5.4, 6.75).setTranslation(20, 5.4, -39),
  );
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 6.8, 1.35, 32, 1, true),
      teal,
    );
    stripe.position.set(20, i * 2.15 + 1.2, -39);
    scene.add(stripe);
  }
  // Bleachers: 0.25 m treads and a clear front sitting apron.
  for (let i = 0; i < 6; i++)
    box(
      0,
      (i + 1) * 0.125,
      31 + i * 0.65,
      30,
      (i + 1) * 0.25,
      0.65,
      i % 2 ? cream : red,
    );
  for (const x of [-15.3, 15.3]) box(x, 1.4, 32.6, 0.15, 1, 4, teal);
  // Pull-up equipment, including the beam in the same physics world.
  for (const x of [38.8, 41.2]) pole(x, 1.35, -10, 0.1, 2.7);
  box(40, 2.7, -10, 2.6, 0.12, 0.12, teal);
  for (const x of [44, 46]) pole(x, 1.15, -10, 0.09, 2.3);
  box(45, 2.3, -10, 2.15, 0.1, 0.1, teal);
  // Gate image, not a reproduction of a specific historical gate.
  for (const x of [-5, 5]) box(x, 2, 46, 1.2, 4, 1.2);
  box(0, 4.1, 46, 12, 0.65, 1.4, teal);
  box(-10, 1.1, 46, 7, 2.2, 0.8);
  let seed = 20260909;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const foliage = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.3, 1),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        flatShading: true,
        roughness: 0.9,
      }),
      50,
    ),
    treePose = new THREE.Object3D();
  foliage.castShadow = true;
  scene.add(foliage);
  for (let i = 0; i < 50; i++) {
    const side = i % 2 ? -1 : 1,
      x = side * (47 + random() * 4),
      z = -28 + random() * 64,
      s = 0.75 + random() * 0.45;
    pole(x, s, z, 0.14 * s, s * 2);
    treePose.position.set(x, 2.6 * s, z);
    treePose.scale.setScalar(s);
    treePose.updateMatrix();
    foliage.setMatrixAt(i, treePose.matrix);
    foliage.setColorAt(i, new THREE.Color(i % 3 ? '#54785b' : '#78936b'));
    physics.add(
      RAPIER.ColliderDesc.ball(1.3 * s).setTranslation(x, 2.6 * s, z),
      'canopy',
    );
  }
  const lamps: THREE.Mesh[] = [];
  for (const x of [-3.5, 3.5])
    for (let z = 35; z <= 45; z += 2) {
      const lamp = box(x, 0.16, z, 0.22, 0.32, 0.22, gold, false);
      lamps.push(lamp);
    }
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#ffd98e' }),
  );
  sun.position.set(-70, 25, -55);
  scene.add(sun);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#fff8d5' }),
  );
  moon.position.set(-25, 28, -70);
  moon.visible = false;
  scene.add(moon);
  const clouds = new THREE.Group();
  scene.add(clouds);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: '#f4bda5',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      cloudMaterial,
    );
    mesh.position.set(-90 + i * 15, 30 + (i % 3) * 3, -80);
    mesh.scale.set(10, 1.2, 3);
    clouds.add(mesh);
  }
  physics.sync();
  return { sun, moon, clouds, lamps };
}

export function createStudent(color: string) {
  const group = new THREE.Group(),
    cloth = new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      flatShading: true,
    }),
    skin = new THREE.MeshStandardMaterial({
      color: '#e2c3a1',
      flatShading: true,
    });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.34), cloth);
  body.position.y = 0.94;
  group.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), skin);
  head.position.y = 1.52;
  group.add(head);
  const legs = [-0.14, 0.14].map((x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.6, 0.22), cloth);
    mesh.position.set(x, 0.35, 0);
    group.add(mesh);
    return mesh;
  });
  const arms = [-0.34, 0.34].map((x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), skin);
    mesh.position.set(x, 0.95, 0);
    group.add(mesh);
    return mesh;
  });
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { group, body, head, legs, arms };
}
