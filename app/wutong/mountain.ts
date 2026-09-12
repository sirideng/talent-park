import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RAPIER, PlayerController } from '../physics/player-controller';
import {
  at,
  TRAIL,
  NODES,
  GEO,
  mapPoint,
  terrainHeight,
  nearest,
  portSightline,
} from './trail-data';

export function createMountain(scene: THREE.Scene, p: PlayerController) {
  let seed = 20260917;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const material = (color: string) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const soil = material('#77846b'),
    pathMat = material('#b7ada0'),
    wood = material('#65584a'),
    rockMat = material('#938b7d');
  const geometry = new THREE.PlaneGeometry(1200, 1200, 240, 240);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position,
    colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = new THREE.Color('#516d54').lerp(
      new THREE.Color('#a0a386'),
      THREE.MathUtils.clamp(h / 230, 0, 1),
    );
    const variation = 0.9 + random() * 0.15;
    c.multiplyScalar(variation);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Sample the actual triangles, not the pre-meshing elevation function: on a
  // steep slope their heights differ, which otherwise leaves trunks floating.
  const groundHeight = (x: number, z: number) => {
    const u = (x + 600) / 5,
      v = (z + 600) / 5,
      ix = Math.floor(u),
      iz = Math.floor(v),
      tx = u - ix,
      tz = v - iz;
    const a = pos.getY(iz * 241 + ix),
      b = pos.getY(iz * 241 + ix + 1),
      c = pos.getY((iz + 1) * 241 + ix),
      d = pos.getY((iz + 1) * 241 + ix + 1);
    return tx + tz <= 1
      ? a + (b - a) * tx + (c - a) * tz
      : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  };
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  p.add(
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(pos.array),
      new Uint32Array(geometry.index!.array),
    ),
  );
  const matrix = new THREE.Matrix4(),
    stepVertices: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    stepVertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  // Shared edges: overlapping rotated boxes can make an impassable wall at hairpins.
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const a = TRAIL[i],
      b = TRAIL[i + 1];
    const al = a.point.clone().addScaledVector(a.side, 3.5),
      ar = a.point.clone().addScaledVector(a.side, -3.5);
    const bl = b.point.clone().addScaledVector(b.side, 3.5),
      br = b.point.clone().addScaledVector(b.side, -3.5);
    const lowL = bl.clone().setY(a.point.y),
      lowR = br.clone().setY(a.point.y);
    triangle(al, lowL, ar);
    triangle(ar, lowL, lowR);
    triangle(lowL, bl, lowR);
    triangle(lowR, bl, br);
  }
  const stepGeo = new THREE.BufferGeometry();
  stepGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(stepVertices, 3),
  );
  stepGeo.computeVertexNormals();
  pathMat.side = THREE.DoubleSide;
  scene.add(new THREE.Mesh(stepGeo, pathMat));
  p.add(
    RAPIER.ColliderDesc.trimesh(
      new Float32Array(stepVertices),
      Uint32Array.from({ length: stepVertices.length / 3 }, (_, i) => i),
    ),
  );
  const mesh = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    point: THREE.Vector3,
  ) => {
    const o = new THREE.Mesh(g, m);
    o.position.copy(point);
    scene.add(o);
    return o;
  };
  const railSegments: THREE.Vector3[] = [];
  for (let i = 0; i < TRAIL.length; i += 15) {
    const t = TRAIL[i];
    if (i < TRAIL.length * 0.62) continue;
    for (const sign of [-1, 1]) {
      const point = t.point.clone().addScaledVector(t.side, sign * 3.35);
      railSegments.push(point);
    }
  }
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.07, 0.09, 1.2, 5),
    wood,
    railSegments.length,
  );
  railSegments.forEach((point, i) => {
    matrix.makeTranslation(point.x, point.y + 0.6, point.z);
    posts.setMatrixAt(i, matrix);
  });
  scene.add(posts);
  const rails = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.12, 1),
    wood,
    railSegments.length - 2,
  );
  // Continuous visible ridge rails share segment poses with Rapier.
  for (let i = 2; i < railSegments.length; i++) {
    const a = railSegments[i - 2],
      b = railSegments[i],
      mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += 1;
    const v = b.clone().sub(a),
      rotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        v.clone().normalize(),
      );
    matrix.compose(mid, rotation, new THREE.Vector3(1, 1, v.length()));
    rails.setMatrixAt(i - 2, matrix);
    p.add(
      RAPIER.ColliderDesc.cuboid(0.09, 0.6, v.length() / 2)
        .setTranslation(mid.x, mid.y - 0.4, mid.z)
        .setRotation(rotation),
    );
  }
  scene.add(rails);
  // Batched forest. Far canopies are low-detail instances; only nearby trunks collide.
  const trees: THREE.Vector3[] = [];
  for (let i = 30; i < TRAIL.length * 0.68; i += 24) {
    const t = TRAIL[i];
    for (const sign of [-1, 1]) {
      const point = t.point
        .clone()
        .addScaledVector(t.side, sign * (10 + random() * 2));
      if (portSightline(point.x, point.z).distance < 32) continue;
      point.y = groundHeight(point.x, point.z);
      trees.push(point);
    }
  }
  for (let i = 0; i < 1600; i++) {
    const x = (random() - 0.5) * 1040,
      z = (random() - 0.5) * 1040,
      point = new THREE.Vector3(x, 0, z),
      near = nearest(point);
    if (
      near.distance < 9 ||
      (near.point.y > 145 && near.distance < 50) ||
      portSightline(x, z).distance < 30
    )
      continue;
    point.y = groundHeight(x, z);
    if (point.y < 2) continue;
    trees.push(point);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.38, 5, 5),
    wood,
    trees.length,
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(3, 0),
    material('#385b47'),
    trees.length,
  );
  trees.forEach((v, i) => {
    const scale = 0.8 + random() * 0.7;
    matrix.compose(
      v.clone().add(new THREE.Vector3(0, 2.5, 0)),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    );
    trunks.setMatrixAt(i, matrix);
    matrix.compose(
      v.clone().add(new THREE.Vector3(0, 6, 0)),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale * 0.85, scale),
    );
    crowns.setMatrixAt(i, matrix);
    if (nearest(v).distance < 22) {
      p.add(
        RAPIER.ColliderDesc.cylinder(2.5, 0.4).setTranslation(
          v.x,
          v.y + 2.5,
          v.z,
        ),
      );
      p.add(
        RAPIER.ColliderDesc.ball(3 * scale).setTranslation(v.x, v.y + 6, v.z),
        'canopy',
      );
    }
  });
  scene.add(trunks, crowns);
  const stoneStop = at(NODES[1].s),
    stonePoint = stoneStop.point.clone().addScaledVector(stoneStop.side, -7.5);
  // Grounded irregular boulder with lettering painted directly on its surface.
  const stoneGeo = new THREE.SphereGeometry(1, 16, 10),
    sp = stoneGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i),
      f = 1 + 0.12 * Math.sin(sp.getX(i) * 13 + y * 7);
    sp.setXYZ(i, sp.getX(i) * 4.3 * f, y * 2.6, sp.getZ(i) * 2.3 * f);
  }
  stoneGeo.computeVertexNormals();
  const boulder = mesh(
    stoneGeo,
    rockMat,
    stonePoint.clone().add(new THREE.Vector3(0, 1.5, 0)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 106px serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#692c24';
  ctx.fillText('鹏城第一峰', 512, 280);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  boulder.updateMatrixWorld();
  const front = new THREE.Mesh(
    new DecalGeometry(
      boulder,
      stonePoint.clone().add(new THREE.Vector3(0, 1.7, -2)),
      new THREE.Euler(0, Math.PI, 0),
      new THREE.Vector3(7.5, 3.1, 3),
    ),
    new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    }),
  );
  scene.add(front);
  // The textured face is recessed into the rock's silhouette, not a floating label.
  const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(sp.array));
  if (hull)
    p.add(
      hull.setTranslation(
        boulder.position.x,
        boulder.position.y,
        boulder.position.z,
      ),
    );
  front.rotation.y = 0;
  const port = mapPoint(GEO.port, 0),
    sea = mesh(
      new THREE.PlaneGeometry(1300, 1300),
      material('#6c9da9'),
      port.clone().add(new THREE.Vector3(450, -4, 200)),
    );
  sea.rotation.x = -Math.PI / 2;
  mesh(
    new THREE.BoxGeometry(200, 3, 130),
    soil,
    port.clone().add(new THREE.Vector3(20, -2, 0)),
  );
  const cargo = new THREE.InstancedMesh(
    new THREE.BoxGeometry(7, 3, 3),
    material('#a77659'),
    180,
  );
  for (let i = 0; i < 180; i++) {
    matrix.makeTranslation(
      port.x - 75 + (i % 18) * 9,
      1 + Math.floor(i / 90) * 3,
      port.z - 40 + (Math.floor(i / 18) % 5) * 9,
    );
    cargo.setMatrixAt(i, matrix);
    cargo.setColorAt(
      i,
      new THREE.Color(['#af785a', '#476c7f', '#a69d76'][i % 3]),
    );
  }
  scene.add(cargo);
  for (let i = 0; i < 9; i++) {
    const x = port.x - 70 + i * 20,
      z = port.z + 47;
    for (const dx of [-4, 4])
      mesh(
        new THREE.BoxGeometry(1.2, 22, 1.2),
        pathMat,
        new THREE.Vector3(x + dx, 11, z),
      );
    mesh(
      new THREE.BoxGeometry(1.5, 1.5, 43),
      pathMat,
      new THREE.Vector3(x, 22, z + 13),
    );
    mesh(
      new THREE.BoxGeometry(10, 1.4, 3),
      pathMat,
      new THREE.Vector3(x, 20, z),
    );
  }
  const landmarkData = [
    ['pingan', '平安金融中心', 60],
    ['kk100', '京基100', 44],
    ['diwang', '地王大厦', 38],
  ] as const;
  const landmarks = landmarkData.map(([id, name, height]) => {
    const point = mapPoint(GEO[id], height * 0.65),
      base = point.clone();
    base.y = height / 2;
    const m = material(id === 'diwang' ? '#72a79e' : '#9fb5c0');
    if (id === 'pingan') {
      mesh(new THREE.CylinderGeometry(1, 6, height, 8), m, base);
    } else if (id === 'kk100') {
      const tower = mesh(
        new THREE.CylinderGeometry(3.2, 4, height, 16),
        m,
        base,
      );
      tower.scale.z = 0.65;
      const cap = mesh(
        new THREE.SphereGeometry(3.2, 12, 8),
        m,
        new THREE.Vector3(base.x, height, base.z),
      );
      cap.scale.y = 2;
    } else {
      mesh(new THREE.BoxGeometry(7, height, 5), m, base);
      for (const dx of [-2.5, 2.5])
        mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 8, 6),
          pathMat,
          new THREE.Vector3(base.x + dx, height + 4, base.z),
        );
    }
    return { id, name, point };
  });
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material('#879dab'),
    220,
  );
  for (let i = 0; i < 220; i++) {
    const x = -1800 + random() * 1050,
      z = 260 + random() * 300,
      h = 5 + random() * 15;
    matrix.compose(
      new THREE.Vector3(x, h / 2, z),
      new THREE.Quaternion(),
      new THREE.Vector3(5 + random() * 10, h, 6 + random() * 8),
    );
    buildings.setMatrixAt(i, matrix);
  }
  scene.add(buildings);
  buildings.userData.qualityDetail=true;buildings.userData.lodCenter=new THREE.Vector3(-1250,0,410);buildings.userData.lodDistance=2200;
  mesh(
    new THREE.BoxGeometry(1500, 2, 700),
    material('#86998d'),
    new THREE.Vector3(-1250, -2, 410),
  );
  const hemi = new THREE.HemisphereLight('#d8e8ec', '#586b50', 2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd79a', 2.6);
  sun.position.set(600, 450, -120);
  scene.add(sun);
  scene.background = new THREE.Color('#aec7d2');
  scene.fog = new THREE.Fog('#aec7d2', 1800, 3800);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: '#edf0e7',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const clouds = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 6),
    cloudMat,
    18,
  );
  for (let i = 0; i < 18; i++) {
    matrix.compose(
      new THREE.Vector3(
        (random() - 0.5) * 1500,
        45 + random() * 45,
        (random() - 0.5) * 1500,
      ),
      new THREE.Quaternion(),
      new THREE.Vector3(65, 3, 24),
    );
    clouds.setMatrixAt(i, matrix);
  }
  scene.add(clouds);
  p.sync();
  return {
    port,
    landmarks,
    stone: stonePoint,
    treeCount: trees.length,
    testTree: trees[0],
    update: (t: number) => {
      clouds.position.x = Math.sin(t * 0.006) * 20;
    },
  };
}
