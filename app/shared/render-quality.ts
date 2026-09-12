import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, onSettings, type Quality } from './preferences';
import type { SceneResources } from '../scenes/resources';

export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: 0, lod: 180 },
  medium: { dpr: 1.25, shadows: true, bloom: 0, lod: 320 },
  high: { dpr: 1.6, shadows: true, bloom: 0.13, lod: 550 },
};
type Tier = Exclude<Quality, 'auto'>;
/** One render policy for every scene. Camera and time-of-day remain scene-owned. */
export function ownQuality(
  resources: SceneResources,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
) {
  const original = renderer.render.bind(renderer),
    size = new THREE.Vector2(),
    lastSize = new THREE.Vector2(),
    worldPos = new THREE.Vector3();
  const touch = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
  let tier: Tier = touch ? 'medium' : 'high',
    configured = '',
    initialized = false,
    inside = false,
    composer: EffectComposer | null = null,
    pass: RenderPass | null = null,
    bloom: UnrealBloomPass | null = null,
    output: OutputPass | null = null;
  let last = 0,
    windowStart = 0,
    frames = 0,
    slow = 0,
    lastLOD = 0;
  const samples: number[] = [];
  const details: THREE.Object3D[] = [];
  const stats = {
    tier: tier as Tier,
    frames: 0,
    frameMs: 0,
    calls: 0,
    triangles: 0,
    dpr: 1,
    geometries: 0,
    textures: 0,
    disposed: false,
  };
  const disposePost = () => {
    bloom?.dispose();
    output?.dispose();
    composer?.dispose();
    composer = null;
    pass = null;
    bloom = null;
    output = null;
  };
  const apply = () => {
    const selection = settings().quality;
    if (selection !== 'auto') tier = selection;
    const q = QUALITY[tier];
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.dpr));
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    stats.tier = tier;
    stats.dpr = renderer.getPixelRatio();
    configured = selection + ':' + tier;
    if (!q.bloom) disposePost();
    lastSize.set(-1, -1);
  };
  let selection = settings().quality;
  resources.defer(
    onSettings(() => {
      selection = settings().quality;
      configured = '';
    }),
  );
  renderer.render = (s: THREE.Object3D, c: THREE.Camera) => {
    if (inside) {
      original(s, c);
      return;
    }
    const now = performance.now();
    if (last) {
      const dt = now - last;
      if (!document.hidden && dt > 1) {
        samples.push(dt);
        if (samples.length > 600) samples.shift();
        stats.frameMs = dt;
        frames++;
      }
    }
    last = now;
    if (!initialized) {
      initialized = true;
      scene.traverse((o) => {
        if (o.userData.qualityDetail) details.push(o);
        if (
          o instanceof THREE.Mesh &&
          o.material instanceof THREE.MeshStandardMaterial
        ) {
          o.material.roughness = Math.max(0.32, o.material.roughness);
        }
      });
    }
    if (selection + ':' + tier !== configured) apply();
    if (!document.hidden && now - windowStart > 5000) {
      if (windowStart && selection === 'auto') {
        const fps = (frames * 1000) / (now - windowStart);
        slow = fps < (touch ? 30 : 52) ? slow + 1 : 0;
        if (slow >= 2 && tier !== 'low') {
          tier = tier === 'high' ? 'medium' : 'low';
          apply();
          slow = 0;
        }
      }
      frames = 0;
      windowStart = now;
    }
    if (now - lastLOD > 300) {
      for (const o of details) {
        const limit =
          (QUALITY[tier].lod / 550) * (o.userData.lodDistance ?? 550);
        if (o.userData.lodCenter) worldPos.copy(o.userData.lodCenter);
        else o.getWorldPosition(worldPos);
        o.visible = worldPos.distanceToSquared(c.position) < limit * limit;
      }
      lastLOD = now;
    }
    renderer.getSize(size);
    renderer.info.autoReset = false;
    renderer.info.reset();
    if (QUALITY[tier].bloom) {
      if (!composer) {
        composer = new EffectComposer(renderer);
        pass = new RenderPass(scene, c);
        bloom = new UnrealBloomPass(size, 0.13, 0.35, 1.15);
        output = new OutputPass();
        composer.addPass(pass);
        composer.addPass(bloom);
        composer.addPass(output);
      }
      if (!size.equals(lastSize)) {
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(size.x, size.y);
        lastSize.copy(size);
      }
      pass!.camera = c;
      inside = true;
      try {
        composer.render();
      } finally {
        inside = false;
      }
    } else original(s, c);
    stats.frames++;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    stats.geometries = renderer.info.memory.geometries;
    stats.textures = renderer.info.memory.textures;
  };
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  if (!canvas.hasAttribute('aria-label'))
    canvas.setAttribute('aria-label', '场景视图：拖动观察，滚轮或双指缩放');
  if (process.env.NODE_ENV !== 'production') {
    Object.assign(canvas, {
      qualityDebug: { stats, samples, renderer, scene },
    });
    resources.defer(() => Reflect.deleteProperty(canvas, 'qualityDebug'));
  }
  resources.defer(() => {
    stats.disposed = true;
    renderer.render = original;
    disposePost();
  });
}
