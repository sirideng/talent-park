import * as THREE from 'three';
import dem from './elevation.json';

export function elevation(x: number, z: number) {
  const n = dem.size - 1,
    u = THREE.MathUtils.clamp((x / dem.extent + 1) * 0.5 * n, 0, n - 0.001),
    v = THREE.MathUtils.clamp((z / dem.extent + 1) * 0.5 * n, 0, n - 0.001);
  const ix = Math.floor(u),
    iz = Math.floor(v),
    tx = u - ix,
    tz = v - iz;
  return (
    THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(
        dem.heights[iz * dem.size + ix],
        dem.heights[iz * dem.size + ix + 1],
        tx,
      ),
      THREE.MathUtils.lerp(
        dem.heights[(iz + 1) * dem.size + ix],
        dem.heights[(iz + 1) * dem.size + ix + 1],
        tx,
      ),
      tz,
    ) * 0.18
  );
}
// A compressed northern ascent. This playable alignment is authored, not a GPS track.
// Round switchbacks have a 15.5-unit radius, wider than the stair ribbon.
const points = [new THREE.Vector3(-80, 0, -340)];
for (let row = 0; row < 10; row++) {
  const sign = row % 2 === 0 ? 1 : -1,
    z = -340 + row * 31;
  for (let j = 1; j <= 16; j++)
    points.push(new THREE.Vector3(-sign * 80 + sign * j * 10, 0, z));
  for (let j = 1; j <= 24; j++) {
    const angle = -Math.PI / 2 + (j / 24) * Math.PI;
    points.push(
      new THREE.Vector3(
        sign * (80 + 15.5 * Math.cos(angle)),
        0,
        z + 15.5 + 15.5 * Math.sin(angle),
      ),
    );
  }
}
for (let j = 1; j <= 10; j++)
  points.push(new THREE.Vector3(-80 + j * 8, 0, -30 + j * 3));
let distance = 0;
const distances = points.map((p, i) => {
  if (i) distance += p.distanceTo(points[i - 1]);
  return distance;
});
points.forEach((p, i) => (p.y = 18 + (distances[i] / distance) * 146));
const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
export const LENGTH = curve.getLength();
const count = Math.ceil(LENGTH / 0.4);
export const TRAIL = Array.from({ length: count + 1 }, (_, i) => {
  const point = curve.getPointAt(i / count);
  point.y = Math.floor(point.y / 0.16) * 0.16;
  const tangent = curve.getTangentAt(i / count);
  tangent.y = 0;
  tangent.normalize();
  return {
    point,
    tangent,
    side: new THREE.Vector3(-tangent.z, 0, tangent.x),
    s: (i / count) * LENGTH,
  };
});
export const at = (s: number) =>
  TRAIL[Math.round(THREE.MathUtils.clamp(s / LENGTH, 0, 1) * count)];
export function nearest(p: THREE.Vector3) {
  let best = 0,
    distance = Infinity;
  const d = (i: number) =>
    (TRAIL[i].point.x - p.x) ** 2 + (TRAIL[i].point.z - p.z) ** 2;
  for (let i = 0; i < TRAIL.length; i += 12) {
    const v = d(i);
    if (v < distance) {
      distance = v;
      best = i;
    }
  }
  const center = best;
  for (
    let i = Math.max(0, center - 12);
    i <= Math.min(count, center + 12);
    i++
  ) {
    const v = d(i);
    if (v < distance) {
      distance = v;
      best = i;
    }
  }
  return { ...TRAIL[best], distance: Math.sqrt(distance), index: best };
}
export function terrainHeight(x: number, z: number) {
  const near = nearest(new THREE.Vector3(x, 0, z)),
    natural = elevation(x, z);
  const blend = 1 - THREE.MathUtils.smoothstep(near.distance, 12, 28);
  const height = THREE.MathUtils.lerp(natural, near.point.y - 0.5, blend);
  const sight = portSightline(x, z);
  // An authored opening on the east-facing lookout; the source DEM remains elsewhere.
  const opening =
    (1 - THREE.MathUtils.smoothstep(sight.distance, 20, 42)) *
    THREE.MathUtils.smoothstep(sight.t, 0, 0.07);
  return THREE.MathUtils.lerp(
    height,
    Math.min(
      height,
      THREE.MathUtils.lerp(at(NODES[0].s).point.y - 3, -5, sight.t),
    ),
    opening,
  );
}
export const NODES = [
  {
    id: 'port',
    name: '盐田港观景段',
    s: LENGTH * 0.47,
    text: '山风穿过树梢。东偏南的海面上，吊机像一排安静的长颈鹿。',
  },
  {
    id: 'stone',
    name: '鹏城第一峰',
    s: LENGTH * 0.93,
    text: '再走几步，就到山顶了。把这一刻留在山石和晨光之间。',
  },
  {
    id: 'summit',
    name: '山顶 · 罗湖与福田',
    s: LENGTH - 3,
    text: '从罗湖望向福田，那些熟悉的高楼，成了山脚下的一段故事。',
  },
] as const;
export const GEO = {
  peak: [22.58227, 114.21467],
  port: [22.57494, 114.2684],
  pingan: [22.5367, 114.0503],
  kk100: [22.54583, 114.10156],
  diwang: [22.54528, 114.10583],
} as const;
export function mapPoint(pair: readonly number[], y = 0) {
  return new THREE.Vector3(
    (pair[1] - GEO.peak[1]) * Math.cos((GEO.peak[0] * Math.PI) / 180) * 10000,
    y,
    (GEO.peak[0] - pair[0]) * 10000,
  );
}
export function portSightline(x: number, z: number) {
  const a = at(NODES[0].s).point,
    b = mapPoint(GEO.port),
    dx = b.x - a.x,
    dz = b.z - a.z,
    t = THREE.MathUtils.clamp(
      ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
      0,
      1,
    );
  return { t, distance: Math.hypot(x - a.x - t * dx, z - a.z - t * dz) };
}
