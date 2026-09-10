import * as THREE from 'three';
import {lake} from './geography';
import {PLANET_RADIUS, PLANET_SEED, islandSurface, sampleTerrain, seededRandom, type Island} from './planet-terrain';

/** Radial foundations and subdivided surfaces follow the island's actual relief. */
export function createLandmark(island: Island) {
 const {normal, rotation, point} = islandSurface(island);
 const group = new THREE.Group(); group.name = island.id; group.position.copy(normal).multiplyScalar(PLANET_RADIUS); group.quaternion.copy(rotation);
 const white = new THREE.MeshStandardMaterial({color: '#efe5cb', roughness: .8, flatShading: true});
 const glass = new THREE.MeshStandardMaterial({color: '#487e88', roughness: .4, metalness: .25, flatShading: true});
 const gold = new THREE.MeshStandardMaterial({color: '#e8ba75', roughness: .7});
 const green = new THREE.MeshStandardMaterial({color: '#9fb773', roughness: 1, side: THREE.DoubleSide});
 function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = group) {
  const object = new THREE.Mesh(geometry, material); parent.add(object); return object;
 }
 function anchor(x: number, z: number, lift = .03) {
  const base = new THREE.Group(); base.position.copy(point(x, z, lift));
  base.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, PLANET_RADIUS, z).normalize()); group.add(base); return base;
 }
 function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material = white) {
  const object = mesh(new THREE.BoxGeometry(w, h, d), material, parent); object.position.set(x, y, z); return object;
 }
 function line(points: THREE.Vector3[], material: THREE.Material = white, radius = .045, parent: THREE.Object3D = group) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(12, points.length * 3), radius, 5, false), material, parent);
 }
 function surfaceRing(cx: number, cz: number, rx: number, rz: number, width: number, lift: number, material: THREE.Material, start = 0, end = Math.PI * 2) {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 80; i++) {
   const a = start + (end - start) * i / 80;
   for (const offset of [-width / 2, width / 2]) vertices.push(...point(cx + (rx + offset) * Math.cos(a), cz + (rz + offset) * Math.sin(a), lift).toArray());
   if (i < 80) {const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);}
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  material.side = THREE.DoubleSide; return mesh(geometry, material);
 }
 function patch(outline: [number, number][], material: THREE.Material, lift = .07) {
  // Subdivide long edges too: four broad triangles would cut through the curved
  // track/terrain underneath a rectangular playing field.
  outline = outline.flatMap((p, i) => {
   const next = outline[(i + 1) % outline.length], count = Math.max(1, Math.ceil(Math.hypot(next[0] - p[0], next[1] - p[1]) / .35));
   return Array.from({length: count}, (_, j): [number, number] => [THREE.MathUtils.lerp(p[0], next[0], j / count), THREE.MathUtils.lerp(p[1], next[1], j / count)]);
  });
  const center = outline.reduce((p, v) => [p[0] + v[0] / outline.length, p[1] + v[1] / outline.length], [0, 0]);
  const vertices: number[] = [], indices: number[] = [], rings = 12;
  for (let r = 0; r <= rings; r++) for (const p of outline) vertices.push(...point(THREE.MathUtils.lerp(center[0], p[0], r / rings), THREE.MathUtils.lerp(center[1], p[1], r / rings), lift).toArray());
  const count = outline.length;
  for (let r = 0; r < rings; r++) for (let j = 0; j < count; j++) {const a = r * count + j, b = r * count + (j + 1) % count; indices.push(a, b, a + count, b, b + count, a + count);}
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); material.side = THREE.DoubleSide; return mesh(geometry, material);
 }
 if (island.id === 'talent-park') {
  const outline: [number, number][] = lake.map(([x, z]) => [x * .068 + .4, z * .078 + 1.2]);
  patch(outline, new THREE.MeshStandardMaterial({color: '#285f65', roughness: .38, metalness: .12}));
  line([...outline, outline[0]].map(([x, z]) => point(x, z, .14)), white, .085);
  const tower = anchor(-2.6, -3.7); tower.name = 'spring-bamboo';
  const profile = Array.from({length: 25}, (_, i) => {const t = i / 24; return new THREE.Vector2(.72 * (1 - .18 * t - .81 * t ** 4) + .015, t * 5.9);});
  mesh(new THREE.LatheGeometry(profile, 24), glass, tower);
  for (let i = 0; i < 16; i++) {
   const a = i / 16 * Math.PI * 2;
   line(profile.filter((_, j) => j < 24).map(p => new THREE.Vector3(Math.cos(a) * (p.x + .018), p.y, Math.sin(a) * (p.x + .018))), white, .018, tower);
  }
  for (const [x, z, h] of [[-4.1,-3.4,2.3],[-4.9,-1.9,1.6],[-.5,-4.5,1.9]]) box(anchor(x,z),0,h/2,0,.7,h,.7,glass);
  line([point(2.3, -.4, .25), point(2.4, 3.3, .25)], white, .12);
  for (let i = 0; i < 8; i++) box(anchor(2.5, -.3 + i * .46), 0, .32, 0, .045, .64, .045);
  surfaceRing(-2.7, .3, 1.0, 1.0, .2, .10, white); patch(Array.from({length: 40}, (_,i) => [-2.7 + .85 * Math.cos(i / 40 * Math.PI * 2), .3 + .85 * Math.sin(i / 40 * Math.PI * 2)]), green);
 } else if (island.id === 'happy-harbor') {
  const wheel = anchor(0, -1); wheel.name = 'bay-ferris-wheel';
  const radius = 3.35, height = 4.05;
  for (const z of [-.25, .25]) {
   const rim = mesh(new THREE.TorusGeometry(radius, .085, 6, 64), white, wheel); rim.position.set(0, height, z);
   for (let i = 0; i < 16; i++) {const a = i / 16 * Math.PI * 2; line([new THREE.Vector3(0,height,z),new THREE.Vector3(Math.cos(a)*radius,height+Math.sin(a)*radius,z)],white,.023,wheel);}
  }
  for (const x of [-1.8,1.8]) for (const z of [-.65,.65]) line([new THREE.Vector3(x,0,z),new THREE.Vector3(0,height,0)],white,.10,wheel);
  for (let i = 0; i < 20; i++) {const a = i / 20 * Math.PI * 2; const cabin = mesh(new THREE.SphereGeometry(.24, 8, 6), i%3?glass:gold, wheel); cabin.scale.set(1,1.35,1); cabin.position.set(Math.cos(a)*radius,height+Math.sin(a)*radius,0);}
  surfaceRing(0, -.8, 4.2, 3.7, .28, .08, white);
  for (const [x,z] of [[-4,2.8],[3.9,2.3]]) {const base=anchor(x,z);box(base,0,.4,0,2.2,.8,1.1);box(base,0,.87,0,2.4,.12,1.3,gold);}
 } else if (island.id === 'shenzhen-bay') {
  // Open semicircular grass terraces face the crescent shore, like an amphitheatre.
  const theatre = new THREE.Group(); theatre.name = 'sunrise-theatre'; group.add(theatre);
  for (let i = 0; i < 6; i++) {
   surfaceRing(2.8, .7, 2.9 + i * .34, 3.2 + i * .34, .3, .12 + i * .11, i % 2 ? green : white, Math.PI*.52, Math.PI*1.54);
  }
  line(Array.from({length: 60}, (_,i) => {const a=Math.PI*.52+i/59*Math.PI;return point(2.8+5.6*Math.cos(a),.7+5.9*Math.sin(a),.09);}),white,.095);
  for (let i=0;i<7;i++) box(anchor(-5+i*.85,-5),0,.35,0,.45,.7,.45,glass);
 } else if (island.id === 'wutong') {
  group.name = 'wutong-ridgeline';
  line(Array.from({length: 44}, (_,i) => {const x=-6+i/43*11;return point(x, -x*.32+Math.sin(i*.4)*.45, .10);}),gold,.055);
  const pavilion=anchor(-.8,-.4); box(pavilion,0,.55,0,.08,1.1,.08);
  const roof=mesh(new THREE.ConeGeometry(.60,.35,6),white,pavilion);roof.position.y=1.2;
 } else {
  // Old campus reference: rounded white bow, blue glazing, long horizontal
  // open corridors and repeating vertical columns (not the newer Chiwan campus).
  const campus = anchor(0,-1.8); campus.name='school-ship-building';
  for(let floor=0;floor<5;floor++) {
   const y=.2+floor*.55;
   box(campus,-1.5,y,0,5.1,.13,1.7);
   box(campus,-1.5,y+.27,-.1,4.9,.36,1.35,glass);
   const bow=mesh(new THREE.CylinderGeometry(1.28,1.28,.13,32,1,false,0,Math.PI),white,campus);bow.position.set(1.05,y,0);bow.rotation.y=Math.PI/2;
   const bowGlass=mesh(new THREE.CylinderGeometry(1.18,1.18,.39,32,1,false,0,Math.PI),glass,campus);bowGlass.position.set(1.05,y+.27,0);bowGlass.rotation.y=Math.PI/2;
  }
  for(let i=0;i<9;i++) box(campus,-3.8+i*.58,1.4,.86,.075,2.9,.075);
  box(campus,-1.5,2.99,0,5.2,.15,1.82);
  const bridgeRoof=mesh(new THREE.CylinderGeometry(1.34,1.34,.15,32,1,false,0,Math.PI),white,campus);bridgeRoof.position.set(1.05,2.99,0);bridgeRoof.rotation.y=Math.PI/2;
  for(let i=0;i<7;i++){const a=-Math.PI/2+i/6*Math.PI;box(campus,1.05+Math.cos(a)*1.3,1.4,Math.sin(a)*1.3,.075,2.9,.075);}
  box(campus,-2,1.25,-2.1,3.8,2.5,1.1);for(let i=0;i<4;i++)box(campus,-2,.5+i*.55,-1.53,3.65,.24,.02,glass);
  const court: [number,number][]=Array.from({length:64},(_,i)=>[-.6+3.6*Math.cos(i/64*Math.PI*2),3.25+1.8*Math.sin(i/64*Math.PI*2)]);
  patch(court,new THREE.MeshStandardMaterial({color:'#bd795d',roughness:1}));
  for(let i=0;i<3;i++)surfaceRing(-.6,3.25,3.5-i*.16,1.7-i*.16,.035,.10,white);
  patch([[-2.8,2.3],[1.6,2.3],[1.6,4.2],[-2.8,4.2]],green,.11);
  line([point(-.6,2.3,.15),point(-.6,4.2,.15)],white,.025);
  surfaceRing(-.6,3.25,.4,.4,.025,.15,white);
 }

 const random=seededRandom(PLANET_SEED+island.seed), placements: {x:number;z:number;scale:number}[]=[];
 for(let i=0;i<180;i++) {
  const x=(random()-.5)*22,z=(random()-.5)*22;
  const sample=sampleTerrain(new THREE.Vector3(x,PLANET_RADIUS,z).normalize().applyQuaternion(rotation));
  if(!sample.land||sample.ratio>.87||sample.island.id!==island.id)continue;
  if(island.id!=='wutong'&&Math.abs(x)<6&&Math.abs(z)<6)continue;
  if(island.id==='wutong'&&(sample.height>3.4||Math.abs(z+x*.32)<.75))continue;
  placements.push({x,z,scale:.65+random()*.75});
 }
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.085,.65,5),new THREE.MeshStandardMaterial({color:'#70634b'}),placements.length);
 const crowns=new THREE.InstancedMesh(island.id==='wutong'?new THREE.ConeGeometry(.4,1.1,6):new THREE.IcosahedronGeometry(.45,0),new THREE.MeshStandardMaterial({color:'#65906a',flatShading:true}),placements.length);
 const dummy=new THREE.Object3D();
 placements.forEach(({x,z,scale},i)=>{
  const radial=new THREE.Vector3(x,PLANET_RADIUS,z).normalize();dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),radial);dummy.scale.setScalar(scale);
  dummy.position.copy(point(x,z)).addScaledVector(radial,.32*scale);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  dummy.position.copy(point(x,z)).addScaledVector(radial,.85*scale);dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,new THREE.Color().setHSL(.29+random()*.06,.24,.29+random()*.16));
 });group.add(trunks,crowns);
 group.userData.locationId=island.id;
 return group;
}
