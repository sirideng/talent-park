import * as THREE from 'three';
import { RAPIER, PlayerController } from '../physics/player-controller';
import { HARBOR as D } from './setting';

export function createWheel(scene: THREE.Scene, physics: PlayerController) {
  const white = new THREE.MeshStandardMaterial({
    color: '#e7e5d8',
    roughness: 0.55,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#344c5d',
    roughness: 0.5,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: '#eedaca',
    emissive: '#ffae72',
    emissiveIntensity: 0,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: '#a0c8d2',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    roughness: 0.3,
  });
  const rotor = new THREE.Group();
  rotor.position.y = D.hubHeight;
  scene.add(rotor);
  const bar = (
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    material = white,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6),
      material,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    parent.add(mesh);
    return mesh;
  };
  for (const z of [-0.9, 0.9]) {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(D.radius, 0.22, 6, 112),
      white,
    );
    rim.position.z = z;
    rotor.add(rim);
    const lamps = new THREE.Mesh(
      new THREE.TorusGeometry(D.radius + 0.28, 0.07, 5, 112),
      glow,
    );
    lamps.position.z = z;
    rotor.add(lamps);
    for (let i = 0; i < D.cabins; i++) {
      const a = (i / D.cabins) * Math.PI * 2;
      bar(
        rotor,
        new THREE.Vector3(0, 0, z),
        new THREE.Vector3(Math.sin(a) * D.radius, Math.cos(a) * D.radius, z),
        0.055,
      );
    }
  }
  // Asymmetric cantilever/fish-fin silhouette, rather than a generic A-frame.
  const fin = new THREE.Shape();
  fin.moveTo(-9, 0);
  fin.quadraticCurveTo(-4, 15, 0, D.hubHeight);
  fin.quadraticCurveTo(6, 12, 15, 0);
  fin.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-5.8, 1.8);
  opening.lineTo(11, 1.8);
  opening.quadraticCurveTo(4, 12, 0, 21.5);
  opening.quadraticCurveTo(-3, 11, -5.8, 1.8);
  fin.holes.push(opening);
  const support = new THREE.Mesh(
    new THREE.ExtrudeGeometry(fin, { depth: 1.3, bevelEnabled: false }),
    white,
  );
  support.position.z = -3.8;
  scene.add(support);
  // Same hollow fin triangles: its opening must not become an invisible wall.
  const vertices = new Float32Array(support.geometry.attributes.position.array);
  for (let i = 2; i < vertices.length; i += 3) vertices[i] -= 3.8;
  const indices = Uint32Array.from(
    { length: vertices.length / 3 },
    (_, i) => i,
  );
  physics.add(RAPIER.ColliderDesc.trimesh(vertices, indices));
  bar(
    scene,
    new THREE.Vector3(0, D.hubHeight, -4),
    new THREE.Vector3(0, D.hubHeight, 2),
    0.7,
    dark,
  );
  const cabins: THREE.Group[] = [];
  for (let i = 0; i < D.cabins; i++) {
    const cabin = new THREE.Group();
    scene.add(cabin);
    cabins.push(cabin);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), glass);
    shell.scale.set(2.25, 1.65, 1.8);
    cabin.add(shell);
    for (const y of [-1.2, 1.3]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(1.65, 1.65, 0.16, 16),
        y < 0 ? dark : white,
      );
      cap.scale.x = 1.2;
      cap.position.y = y;
      cabin.add(cap);
    }
    for (const x of [-1.5, 1.5])
      bar(
        cabin,
        new THREE.Vector3(x, -1.2, 0),
        new THREE.Vector3(x, 1.3, 0),
        0.07,
      );
    const light = new THREE.Mesh(
      new THREE.TorusGeometry(1.62, 0.055, 5, 24),
      glow,
    );
    light.rotation.x = Math.PI / 2;
    light.scale.x = 1.2;
    light.position.y = 1.4;
    cabin.add(light);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2, 0.25, 0.5), dark);
    bench.position.set(0, -0.65, -0.95);
    cabin.add(bench);
  }
  // Only occupied cabin needs collision. Query colliders follow the exact same
  // upright world pose as its visual. One Rapier world; no secondary simulation.
  const parts = [
    { half: [1.75, 0.08, 1.3], offset: [0, -1.2, 0] },
    { half: [1.75, 0.08, 1.3], offset: [0, 1.3, 0] },
    { half: [0.08, 1.25, 1.3], offset: [-1.75, 0.05, 0] },
    { half: [0.08, 1.25, 1.3], offset: [1.75, 0.05, 0] },
    { half: [1.75, 1.25, 0.08], offset: [0, 0.05, -1.3] },
    { half: [1.75, 1.25, 0.08], offset: [0, 0.05, 1.3] },
  ].map(({ half: [x, y, z], offset }) => ({
    collider: physics.add(RAPIER.ColliderDesc.cuboid(x, y, z)),
    offset: new THREE.Vector3(...offset),
  }));
  const anchor = new THREE.Vector3();
  const update = (angle: number) => {
    rotor.rotation.z = angle;
    cabins.forEach((cabin, i) => {
      const a = angle + (i / D.cabins) * Math.PI * 2;
      cabin.position.set(
        Math.sin(a) * D.radius,
        D.hubHeight - Math.cos(a) * D.radius,
        0,
      );
      // Deliberately NOT a child of rotor: gravity direction remains world +Y.
      cabin.quaternion.identity();
    });
    for (const part of parts)
      part.collider.setTranslation(cabins[0].position.clone().add(part.offset));
    anchor.copy(cabins[0].position).add(new THREE.Vector3(0, -1.09, 0));
  };
  update(0);
  return { cabins, anchor, glow, update, active: cabins[0] };
}
