import * as THREE from 'three';
import {
  lake,
  northWater,
  starBridge,
  piBridge,
  northBridge,
  exploreBoundary,
  tideCenter,
  distanceToPath,
  type Point,
} from '../geography';
import {
  PlayerController,
  RAPIER,
  type ColliderKind,
} from './player-controller';

export function addSurface(physics: PlayerController, object: THREE.Mesh) {
  object.updateWorldMatrix(true, false);
  const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld),
    position = geometry.getAttribute('position');
  const vertices = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++)
    vertices.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
  const indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : Uint32Array.from({ length: position.count }, (_, i) => i);
  physics.add(RAPIER.ColliderDesc.trimesh(vertices, indices));
  geometry.dispose();
}
export function addBox(
  p: PlayerController,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  angle = 0,
  kind: ColliderKind = 'solid',
) {
  return p.add(
    RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(x, y, z)
      .setRotation({
        x: 0,
        y: Math.sin(angle / 2),
        z: 0,
        w: Math.cos(angle / 2),
      }),
    kind,
  );
}
function segment(
  p: PlayerController,
  a: Point,
  b: Point,
  y: number,
  h: number,
  w: number,
  kind: ColliderKind = 'solid',
) {
  addBox(
    p,
    (a[0] + b[0]) / 2,
    y,
    (a[1] + b[1]) / 2,
    w,
    h,
    Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.035,
    Math.atan2(b[0] - a[0], b[1] - a[1]),
    kind,
  );
}
export function addBridgeColliders(
  p: PlayerController,
  points: Point[],
  width: number,
) {
  const offsets = (side: number) =>
    points.map((v, i): Point => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [
        v[0] - ((b[1] - a[1]) / len) * side * width * 0.46,
        v[1] + ((b[0] - a[0]) / len) * side * width * 0.46,
      ];
    });
  for (const side of [-1, 1]) {
    const edge = offsets(side);
    for (let i = 1; i < edge.length; i++)
      segment(p, edge[i - 1], edge[i], 1.4, 0.84, 0.09);
  }
  // A submerged safety lip follows the same rail; unlike old walkable() gates,
  // it never cuts across the deck or the entrances. Excluded from camera queries.
  for (const side of [-1, 1]) {
    const edge = offsets(side);
    for (let i = 1; i < edge.length; i++)
      segment(p, edge[i - 1], edge[i], 2.5, 5, 0.035, 'water-edge');
  }
}
export function createParkColliders(
  p: PlayerController,
  surfaces: THREE.Mesh[],
  trunks: THREE.Matrix4[],
  crowns: THREE.Matrix4[],
) {
  // Rapier-only fallback below the water surface; bridge decks remain above it.
  for (const contour of [lake, northWater]) {
    const vertices = contour.map(([x, z]) => new THREE.Vector2(x, z));
    for (const triangle of THREE.ShapeUtils.triangulateShape(vertices, [])) {
      const points: number[] = [];
      for (const y of [-5, 0.73])
        for (const i of triangle) points.push(vertices[i].x, y, vertices[i].y);
      const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(points));
      if (hull) p.add(hull.setSensor(true), 'hazard');
    }
  }
  surfaces.forEach((s) => addSurface(p, s));
  const bridges: [Point[], number][] = [
    [starBridge, 2.3],
    [piBridge, 1.9],
    [northBridge, 1.7],
  ];
  bridges.forEach(([points, width]) => addBridgeColliders(p, points, width));
  for (const contour of [lake, northWater])
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2);
      const at = (t: number): Point => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
      ];
      let start: number | null = null;
      // Merge collinear pieces. Only bridge portals require splitting a shore edge.
      for (let j = 0; j <= n; j++) {
        const mid = at((j + 0.5) / n);
        const portal =
          j === n ||
          bridges.some(
            ([path, width]) =>
              distanceToPath(mid[0], mid[1], path) < width / 2 + 0.2,
          );
        if (portal && start !== null) {
          segment(p, at(start / n), at(j / n), 2, 5, 0.08, 'water-edge');
          start = null;
        }
        if (!portal && start === null) start = j;
      }
    }
  for (let i = 0; i < exploreBoundary.length; i++)
    segment(
      p,
      exploreBoundary[i],
      exploreBoundary[(i + 1) % exploreBoundary.length],
      2,
      5,
      0.1,
      'water-edge',
    );
  const pos = new THREE.Vector3(),
    scale = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  trunks.forEach((m) => {
    m.decompose(pos, rotation, scale);
    p.add(
      RAPIER.ColliderDesc.cylinder(scale.y / 2, scale.x).setTranslation(
        pos.x,
        pos.y,
        pos.z,
      ),
    );
  });
  crowns.forEach((m) => {
    m.decompose(pos, rotation, scale);
    p.add(
      RAPIER.ColliderDesc.ball(scale.x * 0.9).setTranslation(
        pos.x,
        pos.y,
        pos.z,
      ),
      'canopy',
    );
  });
  addBox(p, -37, 1.35, 20, 2.4, 1.5, 7);
  addBox(p, -37, 2.2, 20, 3.4, 0.2, 7.8);
  addBox(p, -18, 0.75, -46, 9, 0.3, 8);
  p.add(
    RAPIER.ColliderDesc.cylinder(19.6, 3.08).setTranslation(-18, 20.2, -46),
  );
  for (const [x, z, w, d, h] of [
    [-28, -43, 4, 5, 24],
    [-38, -45, 5, 5, 19],
    [-49, -41, 4, 5, 13],
  ])
    addBox(p, x, 0.6 + h / 2, z, w, h, d);
  addBox(p, -34, 2.1, -53, 17, 2.9, 6);
  addBox(p, -35, 3.8, -53.25, 15.5, 0.55, 5.4);
  addBox(p, -36.1, 4.3, -53.55, 11.2, 0.5, 4.1);
  addBox(p, -37.2, 4.72, -53.8, 7.5, 0.35, 3.1);
  // Low-poly convex ellipses follow the culture pods, not old circular blocking radii.
  for (const [x, z, rx, rz, h, angle] of [
    [-34, -22, 5.7, 5, 9.5, -0.22],
    [-42, 2, 6.9, 5.5, 5.3, 0.3],
    [-43, -22, 3.2, 2.6, 1.6, 0.4],
    [-42, -31, 2.4, 2, 2, 0.4],
    [-47, -9, 2.4, 2.1, 1.4, 0.4],
    [-43, 10, 2.5, 2, 2, 0.4],
    [-35, -6, 2.1, 1.8, 1.2, 0.4],
  ]) {
    const vertices: number[] = [];
    for (const [height, r] of [
      [0, 0.76],
      [0.15, 1],
      [0.72, 1],
      [1, 0.75],
    ])
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        vertices.push(Math.cos(a) * rx * r, height * h, Math.sin(a) * rz * r);
      }
    const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));
    if (hull)
      p.add(
        hull.setTranslation(x, 0.82, z).setRotation({
          x: 0,
          y: Math.sin(angle / 2),
          z: 0,
          w: Math.cos(angle / 2),
        }),
      );
  }
  const [tx, tz] = tideCenter;
  p.add(RAPIER.ColliderDesc.cylinder(0.075, 5.9).setTranslation(tx, 0.675, tz));
  p.add(RAPIER.ColliderDesc.cylinder(0.065, 3.85).setTranslation(tx, 0.79, tz));
  addBox(p, tx, 0.99, tz - 1.7, 2.2, 0.33, 0.55);
  p.sync();
}
