import * as THREE from 'three';
import { RAPIER, PlayerController } from '../physics/player-controller';
import { HARBOR as D } from './setting';

export function createHarborCoast(
  scene: THREE.Scene,
  physics: PlayerController,
) {
  let seed = D.seed;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const mat = (color: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      flatShading: true,
    });
  const sand = mat('#d7c4a5'),
    grass = mat('#748d72'),
    stone = mat('#b39d79'),
    trunk = mat('#685951'),
    foliage = mat('#587760');
  const paving = mat('#cfccc3'),
    rail = mat('#536a71');
  const windows = new THREE.MeshStandardMaterial({
    color: '#ccc6b4',
    emissive: '#ffcb8b',
    emissiveIntensity: 0,
  });
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    solid = false,
  ) => {
    const b = mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    if (solid)
      physics.add(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
      );
    return b;
  };
  const land = (points: number[][], color: THREE.Material, y: number) => {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    const m = mesh(new THREE.ShapeGeometry(shape), color, 0, y, 0);
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  box(0, -0.5, -14, 112, 1, 48, paving, true);
  // The pedestrian precinct ends at visible rails/hedges, not at an invisible walkable mask.
  for (const x of [-55, 55]) {
    box(x, 1, -14, 0.25, 2, 48, rail, true);
    box(x - Math.sign(x) * 1.5, 0.55, -14, 2, 1.1, 46, grass, true);
  }
  box(0, 0.8, -37.5, 110, 1.6, 1.5, grass, true);
  box(0, 0.9, 9, 112, 1.8, 0.12, rail, true);
  // A jump-safe rail envelope is the same physical shoreline boundary, documented.
  physics.add(
    RAPIER.ColliderDesc.cuboid(56, 3, 0.1).setTranslation(0, 3, 9),
    'water-edge',
  );
  for (let x = -54; x <= 54; x += 3) box(x, 0.65, 8.8, 0.1, 1.3, 0.1, rail);
  box(0, 0.4, 8.9, 112, 0.055, 0.08, windows);
  for (let x = -47; x < 53; x += 12) {
    if (Math.abs(x) < 17) continue;
    box(x, 0.1, -23, 7, 0.2, 7, grass);
    mesh(new THREE.CylinderGeometry(0.2, 0.32, 3.2, 6), trunk, x, 1.6, -23);
    const crown = mesh(
      new THREE.IcosahedronGeometry(2.1, 1),
      foliage,
      x,
      4,
      -23,
    );
    crown.scale.y = 0.75;
    physics.add(
      RAPIER.ColliderDesc.cylinder(1.6, 0.32).setTranslation(x, 1.6, -23),
    );
    physics.add(
      RAPIER.ColliderDesc.ball(2).setTranslation(x, 4, -23),
      'canopy',
    );
    box(x, 0.65, -18, 3, 0.2, 0.8, stone, true);
  }
  for (let x = -48; x < 53; x += 8) {
    box(x, 1.5, 6, 0.1, 3, 0.1, rail);
    mesh(new THREE.SphereGeometry(0.2, 6, 4), windows, x, 3, 6);
  }
  // Eastern shore continues south; park is not a fictional isolated island.
  land(
    [
      [54, -40],
      [56, 10],
      [36, 42],
      [32, 64],
      [15, 90],
      [-2, 116],
      [20, 138],
      [29, 180],
      [46, 260],
      [270, 260],
      [270, -40],
    ],
    sand,
    -0.15,
  );
  land(
    [
      [58, -40],
      [60, 10],
      [41, 43],
      [37, 65],
      [20, 91],
      [4, 115],
      [24, 136],
      [34, 180],
      [52, 260],
      [270, 260],
      [270, -40],
    ],
    grass,
    0.05,
  );
  // Connect the plaza to Bao'an's northern mainland and the westward park coast.
  land(
    [
      [-320, -240],
      [270, -240],
      [270, -39],
      [56, -39],
      [56, 10],
      [-56, 10],
      [-95, 20],
      [-180, 17],
      [-320, 40],
    ],
    sand,
    -0.18,
  );
  land(
    [
      [-320, -240],
      [270, -240],
      [270, -39],
      [56, -39],
      [56, 6],
      [-56, 6],
      [-96, 16],
      [-180, 13],
      [-320, 35],
    ],
    grass,
    -0.02,
  );
  for (let i = 0; i < 105; i++) {
    const x = -290 + random() * 590,
      z = -42 - random() * 90;
    mesh(new THREE.CylinderGeometry(0.25, 0.45, 3, 5), trunk, x, 1.5, z);
    const crown = mesh(new THREE.IcosahedronGeometry(2.5, 0), foliage, x, 4, z);
    crown.scale.y = 0.8;
  }
  // Original low promenade buildings, not additional playable destinations.
  for (let i = 0; i < 10; i++) {
    const x = -130 + i * 27;
    box(x, 2.5, -68, 20, 5, 13, paving);
    box(x, 5.2, -68, 22, 0.4, 15, sand);
  }
  // Western Dachan peninsula: massing follows the published Net City concept,
  // not Tencent's separate two-tower Binhai headquarters.
  land(
    [
      [-160, 68],
      [-101, 83],
      [-78, 114],
      [-74, 172],
      [-100, 210],
      [-180, 219],
      [-202, 121],
    ],
    sand,
    -0.2,
  );
  land(
    [
      [-158, 74],
      [-105, 90],
      [-85, 117],
      [-81, 169],
      [-104, 203],
      [-178, 210],
      [-194, 122],
    ],
    grass,
    0.1,
  );
  for (let i = 0; i < 12; i++) {
    const x = -151 + (i % 4) * 18,
      z = 110 + Math.floor(i / 4) * 30,
      h = 9 + 8 * Math.sin(i * 1.4) ** 2;
    const tower = box(
      x,
      h / 2,
      z,
      12,
      h,
      16,
      mat(i % 2 ? '#9faeae' : '#c2c9c1'),
    );
    // Stepped upper terraces and low linking volumes read as a campus district.
    box(x + 2, h + 1, z, 8, 2, 12, paving);
    box(x + 8, 2, z + 5, 16, 4, 8, paving);
    for (let row = 2; row < h; row += 2)
      box(x, row, z - 8.03, 11, 0.3, 0.08, windows);
    tower.rotation.y = 0.08 * Math.sin(i);
  }
  // Qianhai Stone: warm boulder, low platform, lawn and palm-like silhouettes.
  const lawn = mesh(new THREE.CircleGeometry(15, 40), grass, 14, 0.12, 104);
  lawn.rotation.x = -Math.PI / 2;
  const platform = mesh(
    new THREE.CylinderGeometry(6, 6, 0.3, 24),
    paving,
    9,
    0.25,
    100,
  );
  platform.scale.z = 0.7;
  const rock = mesh(new THREE.IcosahedronGeometry(2.5, 0), stone, 9, 1.6, 100);
  rock.scale.set(1.8, 0.7, 0.6);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#754b3d';
    ctx.font = 'bold 68px serif';
    ctx.textAlign = 'center';
    ctx.fillText('前海', 128, 86);
  }
  const texture = new THREE.CanvasTexture(canvas);
  mesh(
    new THREE.PlaneGeometry(4, 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
    9,
    1.9,
    98.45,
  );
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      x = 15 + Math.cos(a) * 12,
      z = 105 + Math.sin(a) * 12;
    mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 5), trunk, x, 2, z);
    const top = mesh(new THREE.IcosahedronGeometry(1.6, 0), foliage, x, 4, z);
    top.scale.y = 0.35;
  }
  // CBD is a backdrop on land behind the park: differing crowns and clustered towers.
  for (let i = 0; i < 42; i++) {
    const x = 48 + (i % 7) * 14 + random() * 4,
      z = 160 + Math.floor(i / 7) * 17,
      h = 12 + random() * 29;
    box(
      x,
      h / 2,
      z,
      7 + random() * 3,
      h,
      9,
      mat(i % 3 ? '#839aa8' : '#a7b2b6'),
    );
    if (i % 4 === 0) {
      const crown = mesh(
        new THREE.ConeGeometry(5, 5, 4),
        paving,
        x,
        h + 2.5,
        z,
      );
      crown.rotation.y = Math.PI / 4;
    }
    for (let row = 2; row < h; row += 2.5)
      box(x, row, z - 4.55, 6.5, 0.35, 0.1, windows);
  }
  const water = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, night: { value: 0 } },
    vertexShader:
      'varying vec3 p; void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
    fragmentShader: `varying vec3 p; uniform float time; uniform float night;
      void main(){float w=sin(p.z*2.+sin(p.x*.24)+time*.6)*.5+.5;
      vec3 base=mix(vec3(.22,.39,.43),vec3(.035,.105,.20),night);
      float reflection=exp(-pow((p.x+70.+p.z*.32)/25.,2.))*(.3+.7*pow(w,10.));
      gl_FragColor=vec4(base+vec3(1.,.64,.32)*reflection*.34*(1.-night*.8)+w*.016,1.);}`,
  });
  const sea = mesh(new THREE.PlaneGeometry(1800, 1800), water, 0, -0.45, 0);
  sea.rotation.x = -Math.PI / 2;
  physics.add(
    RAPIER.ColliderDesc.cuboid(90, 1, 120).setTranslation(0, -3, 50),
    'hazard',
  );
  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { night: { value: 0 } },
    vertexShader:
      'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 p;uniform float night;void main(){float h=smoothstep(-.18,.55,normalize(p).y);
      vec3 day=mix(vec3(.94,.66,.48),vec3(.35,.49,.65),h);
      vec3 dark=mix(vec3(.20,.25,.40),vec3(.035,.075,.17),h);gl_FragColor=vec4(mix(day,dark,night),1.);}`,
  });
  mesh(new THREE.SphereGeometry(800, 32, 20), sky, 0, 0, 0);
  const sunMat = new THREE.MeshBasicMaterial({
    color: '#ffe5af',
    transparent: true,
  });
  const sun = mesh(new THREE.SphereGeometry(10, 24, 16), sunMat, -260, 40, 150);
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#e8b9ad' });
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 3; j++) {
      const c = mesh(
        new THREE.IcosahedronGeometry(1, 1),
        cloudMat,
        -350 + i * 85 + j * 13,
        78 + Math.sin(i) * 8 + j * 2,
        240 + Math.cos(i) * 30,
      );
      c.scale.set(19 + random() * 12, 3.5 + random() * 3, 7);
    }
  const hemi = new THREE.HemisphereLight('#f8dac0', '#4e6771', 2.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffd29a', 2.1);
  key.position.set(-100, 90, 100);
  scene.add(key);
  const nightColor = new THREE.Color('#3e4c72'),
    dayColor = cloudMat.color.clone();
  const daylight = new THREE.Color('#f8dac0'),
    blueLight = new THREE.Color('#8cacdc');
  physics.sync();
  return {
    update(time: number, night: number) {
      water.uniforms.time.value = time;
      water.uniforms.night.value = night;
      sky.uniforms.night.value = night;
      sun.position.y = 40 - night * 65;
      sunMat.opacity = 1 - night;
      windows.emissiveIntensity = night * 1.5;
      hemi.intensity = 2.1 - night * 0.9;
      key.intensity = 2.1 - night * 1.85;
      hemi.color.copy(daylight).lerp(blueLight, night);
      cloudMat.color.copy(dayColor).lerp(nightColor, night);
    },
  };
}
