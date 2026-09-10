import * as THREE from 'three';

export const PLANET_RADIUS = 20;
export const PLANET_SEED = 20260908;
export type IslandId = 'talent-park' | 'happy-harbor' | 'shenzhen-bay' | 'wutong' | 'school';
export type Island = {id: IslandId; latitude: number; longitude: number; size: number; seed: number};

// Memory geography, not a geographical projection of Shenzhen. The Fibonacci
// distribution spreads the five memories across both hemispheres and all longitudes.
export const ISLANDS: readonly Island[] = [
 {id: 'talent-park', latitude: 53.13, longitude: 25, size: .64, seed: 17},
 {id: 'happy-harbor', latitude: 23.58, longitude: 162.5, size: .61, seed: 31},
 {id: 'shenzhen-bay', latitude: 0, longitude: 300, size: .66, seed: 49},
 {id: 'wutong', latitude: -23.58, longitude: 77.5, size: .64, seed: 63},
 {id: 'school', latitude: -53.13, longitude: 215, size: .60, seed: 89},
];
export function seededRandom(seed = PLANET_SEED) {
 return () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
}
export function islandNormal(island: Island) {
 const lat = THREE.MathUtils.degToRad(island.latitude), lon = THREE.MathUtils.degToRad(island.longitude);
 return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
}
const frames = ISLANDS.map(island => {
 const normal = islandNormal(island);
 const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
 return {island, normal, inverse: rotation.clone().invert()};
});
const smooth = THREE.MathUtils.smoothstep;

export function sampleTerrain(normal: THREE.Vector3) {
 let closest = frames[0], ratio = Infinity, x = 0, z = 0;
 for (const frame of frames) {
  const local = normal.clone().applyQuaternion(frame.inverse);
  const angle = Math.acos(THREE.MathUtils.clamp(normal.dot(frame.normal), -1, 1));
  const azimuth = Math.atan2(local.z, local.x);
  const coast = 1 + .10 * Math.sin(azimuth * 3 + frame.island.seed) + .055 * Math.sin(azimuth * 7 - frame.island.seed);
  const candidate = angle / (frame.island.size * coast);
  if (candidate < ratio) {ratio = candidate; closest = frame; x = local.x * PLANET_RADIUS; z = local.z * PLANET_RADIUS;}
 }
 const inland = 1 - smooth(ratio, .70, 1.02);
 let height = inland * (.36 + .30 * (1 + Math.sin(x * .55 + z * .3)) + .18 * Math.cos(z * .8));
 if (closest.island.id === 'wutong') {
  // Connected, irregular mountain ridges, not separate cones standing on a plate.
  const ridge = Math.exp(-((z + .32 * x) ** 2) / 8);
  height += inland * ridge * (2.3 + 3.3 * Math.exp(-((x + 1) ** 2) / 5) + 1.2 * Math.exp(-((x - 4) ** 2) / 5));
  height += inland * .25 * Math.sin(x * 2.4 + z * 1.8);
 }
 if (closest.island.id === 'shenzhen-bay') {
  // Sea cuts a crescent into the southeastern shore; terraces overlook this bay.
  const bay = Math.sqrt((x - 5.8) ** 2 + (z - 2) ** 2);
  height *= smooth(bay, 4.6, 6.5);
  if (bay < 5.4) ratio = Math.max(ratio, 1.16 - (bay / 5.4) * .18);
 }
 const land = ratio < 1.01 && height > .025;
 return {height: land ? Math.max(.015, height) : -.035, ratio, land, island: closest.island, x, z};
}

export function createTerrain() {
 const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 192, 120).toNonIndexed();
 const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
 const deep = new THREE.Color('#185c70'), mid = new THREE.Color('#267f88'), shallow = new THREE.Color('#67b7ad');
 const sand = new THREE.Color('#e0c997'), grass = new THREE.Color('#78a66b'), forest = new THREE.Color('#4b805f'), rock = new THREE.Color('#acb6a1');
 const n = new THREE.Vector3(), color = new THREE.Color();
 for (let i = 0; i < positions.count; i++) {
  n.fromBufferAttribute(positions, i).normalize();
  const sample = sampleTerrain(n);
  positions.setXYZ(i, n.x * (PLANET_RADIUS + sample.height), n.y * (PLANET_RADIUS + sample.height), n.z * (PLANET_RADIUS + sample.height));
  if (sample.land) {
   color.copy(grass).lerp(forest, smooth(sample.height, .45, 2.4));
   color.lerp(sand, smooth(sample.ratio, .79, 1.02));
   if (sample.island.id === 'wutong') color.lerp(rock, smooth(sample.height, 3.5, 5.5));
  } else {
   color.copy(shallow).lerp(mid, smooth(sample.ratio, 1.0, 1.20)).lerp(deep, smooth(sample.ratio, 1.14, 1.55));
  }
  const variation = .025 * Math.sin(n.x * 79 + n.y * 43 + n.z * 67);
  color.multiplyScalar(1 + variation); color.toArray(colors, i * 3);
 }
 geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
 return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88, metalness: .02, flatShading: true}));
}

export function islandSurface(island: Island) {
 const normal = islandNormal(island), rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
 const point = (x: number, z: number, lift = 0) => {
  const direction = new THREE.Vector3(x, PLANET_RADIUS, z).normalize();
  const height = sampleTerrain(direction.clone().applyQuaternion(rotation)).height;
  return direction.multiplyScalar(PLANET_RADIUS + height + lift).sub(new THREE.Vector3(0, PLANET_RADIUS, 0));
 };
 return {normal, rotation, point};
}
