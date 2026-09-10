import * as THREE from 'three';
import {SceneResources} from './resources';

/** Collect shared geometry/materials once, including line and instance buffers. */
export function ownThreeScene(resources: SceneResources, scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
 resources.defer(() => renderer.domElement.remove());
 resources.defer(() => renderer.forceContextLoss());
 resources.defer(() => renderer.dispose());
 resources.defer(() => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const cleanup = new SceneResources();
  scene.traverse(object => {
   if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
   } else if (object instanceof THREE.Sprite) materials.add(object.material);
   if (object instanceof THREE.InstancedMesh) cleanup.defer(() => object.dispose());
   if (object instanceof THREE.Light && 'shadow' in object) {
    const shadow = object.shadow as THREE.LightShadow | undefined;
    if (shadow) cleanup.defer(() => shadow.dispose());
   }
  });
  for (const material of materials) {
   for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
   if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
   }
   cleanup.defer(() => material.dispose());
  }
  for (const geometry of geometries) cleanup.defer(() => geometry.dispose());
  for (const texture of textures) cleanup.defer(() => texture.dispose());
  cleanup.dispose();
 });
}
