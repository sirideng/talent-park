import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

let ready: Promise<void> | undefined;
export const preparePhysics = () => (ready ??= RAPIER.init());
export { RAPIER };
export type ColliderKind = 'solid' | 'water-edge' | 'canopy' | 'hazard';
export type InteractionTrigger<T> = {
  id: string;
  kind: 'place' | 'moment';
  center: THREE.Vector3;
  radius: number;
  height: number;
  payload: T;
};

/** One Rapier query world for capsule movement, support, triggers and camera casts.
 * Fixed substeps avoid frame-rate-dependent tunnelling. No parallel walkable() rules.
 */
export class PlayerController {
  readonly world = new RAPIER.World({ x: 0, y: -18, z: 0 });
  readonly capsule = this.world.createCollider(
    RAPIER.ColliderDesc.capsule(0.53, 0.32),
  );
  readonly motor = this.world.createCharacterController(0.025);
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly safePosition = new THREE.Vector3();
  readonly kinds = new Map<number, ColliderKind>();
  grounded = false;
  resets = 0;
  private accumulator = 0;
  private jumpRequested = false;
  private disposed = false;
  private cameraBall = new RAPIER.Ball(0.22);
  private clearBall = new RAPIER.Ball(0.23);
  constructor(
    start: THREE.Vector3,
    private bounds = { x: 65, z: 76, minY: -8 },
  ) {
    this.motor.setMaxSlopeClimbAngle(Math.PI / 4);
    this.motor.setMinSlopeSlideAngle(Math.PI * 0.27);
    this.motor.enableAutostep(0.3, 0.18, false);
    this.motor.enableSnapToGround(0.25);
    this.teleport(start);
    this.safePosition.copy(start);
  }
  add(desc: RAPIER.ColliderDesc, kind: ColliderKind = 'solid') {
    const collider = this.world.createCollider(desc);
    this.kinds.set(collider.handle, kind);
    return collider;
  }
  solid = (c: RAPIER.Collider) =>
    c.handle !== this.capsule.handle &&
    this.kinds.get(c.handle) !== 'canopy' &&
    this.kinds.get(c.handle) !== 'hazard';
  // Keep predicates JS-only: nested WASM collider getters in 0.20 query
  // callbacks can retain a Rust borrow and make world.free() fail.
  cameraSolid = (c: RAPIER.Collider) =>
    c.handle !== this.capsule.handle &&
    this.kinds.get(c.handle) !== 'water-edge' &&
    this.kinds.get(c.handle) !== 'hazard';
  sync() {
    this.world.step();
  }
  teleport(feet: THREE.Vector3) {
    this.position.copy(feet);
    this.velocity.set(0, 0, 0);
    this.jumpRequested = false;
    this.grounded = false;
    this.capsule.setTranslation({ x: feet.x, y: feet.y + 0.85, z: feet.z });
    this.accumulator = 0;
  }
  stop() {
    this.velocity.set(0, 0, 0);
    this.jumpRequested = false;
  }
  jump() {
    if (this.grounded) this.jumpRequested = true;
  }
  /** Surface queries are used only to place/reset the capsule, never to bypass it. */
  surface(x: number, z: number) {
    const hit = this.world.castRay(
      new RAPIER.Ray({ x, y: 70, z }, { x: 0, y: -1, z: 0 }),
      100,
      true,
      undefined,
      undefined,
      this.capsule,
      undefined,
      this.solid,
    );
    return hit ? 70 - hit.timeOfImpact + 0.03 : 1;
  }
  update(dt: number, direction: THREE.Vector3, running = false) {
    this.accumulator += Math.min(dt, 0.1);
    const step = 1 / 60;
    while (this.accumulator >= step) {
      this.accumulator -= step;
      const speed = running ? 7 : 3.8,
        rate = direction.lengthSq() > 0.001 ? 22 : 30;
      const approach = (v: number, t: number) =>
        v + THREE.MathUtils.clamp(t - v, -rate * step, rate * step);
      this.velocity.x = approach(this.velocity.x, direction.x * speed);
      this.velocity.z = approach(this.velocity.z, direction.z * speed);
      if (this.jumpRequested && this.grounded) {
        this.velocity.y = 6;
        this.grounded = false;
      }
      this.jumpRequested = false;
      this.velocity.y = Math.max(-25, this.velocity.y - 18 * step);
      this.motor.computeColliderMovement(
        this.capsule,
        {
          x: this.velocity.x * step,
          y: this.velocity.y * step,
          z: this.velocity.z * step,
        },
        undefined,
        undefined,
        this.solid,
      );
      const delta = this.motor.computedMovement();
      this.position.x += delta.x;
      this.position.y += delta.y;
      this.position.z += delta.z;
      this.grounded = this.motor.computedGrounded();
      if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;
      if (delta.y < this.velocity.y * step - 0.001 && this.velocity.y > 0)
        this.velocity.y = 0;
      this.capsule.setTranslation({
        x: this.position.x,
        y: this.position.y + 0.85,
        z: this.position.z,
      });
      this.world.step();
      let hazard = false;
      this.world.intersectionsWithShape(
        this.capsule.translation(),
        this.capsule.rotation(),
        this.capsule.shape,
        () => {
          hazard = true;
          return false;
        },
        undefined,
        undefined,
        this.capsule,
        undefined,
        (c) => this.kinds.get(c.handle) === 'hazard',
      );
      if (this.grounded && !hazard) this.safePosition.copy(this.position);
      if (
        hazard ||
        this.position.y < this.bounds.minY ||
        Math.abs(this.position.x) > this.bounds.x ||
        Math.abs(this.position.z) > this.bounds.z
      ) {
        this.resets++;
        this.teleport(this.safePosition);
        this.world.step();
      }
    }
    return this.position;
  }
  trigger<T>(triggers: InteractionTrigger<T>[]) {
    return (
      triggers.find((t) => {
        let hit = false;
        this.world.intersectionsWithShape(
          t.center,
          { x: 0, y: 0, z: 0, w: 1 },
          new RAPIER.Cylinder(t.height / 2, t.radius),
          (c) => {
            if (c.handle === this.capsule.handle) hit = true;
            return !hit;
          },
          undefined,
          undefined,
          undefined,
          undefined,
          (c) => c.handle === this.capsule.handle,
        );
        return hit;
      })?.payload ?? null
    );
  }
  cameraDistance(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
  ) {
    const hit = this.world.castShape(
      origin,
      { x: 0, y: 0, z: 0, w: 1 },
      direction,
      this.cameraBall,
      0.03,
      length,
      true,
      undefined,
      undefined,
      this.capsule,
      undefined,
      this.cameraSolid,
    );
    return hit ? Math.max(0, hit.time_of_impact - 0.04) : length;
  }
  cameraClear(point: THREE.Vector3) {
    let clear = true;
    this.world.intersectionsWithShape(
      point,
      { x: 0, y: 0, z: 0, w: 1 },
      this.clearBall,
      () => {
        clear = false;
        return false;
      },
      undefined,
      undefined,
      this.capsule,
      undefined,
      this.cameraSolid,
    );
    return clear;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
    this.kinds.clear();
  }
}

/** OrbitControls operates on its unobstructed pose; only the rendered pose is shortened.
 * This avoids feeding collision corrections back into orbit damping (camera jitter).
 */
export class ThirdPersonCamera {
  private pivot = new THREE.Vector3();
  private elevated = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private arm = Infinity;
  private lift = 0;
  resolve(
    physics: PlayerController,
    desired: THREE.Vector3,
    feet: THREE.Vector3,
    dt: number,
  ) {
    // Above the hat: even a fully retracted arm cannot enter the player's head.
    const pivot = this.pivot.copy(feet);
    pivot.y += 1.95;
    // The player can stand under a low crown. A cast starting inside foliage
    // returns zero; lift the boom origin above it instead of rendering inside it.
    let requiredLift = 0;
    for (let i = 0; i < 16 && !physics.cameraClear(pivot); i++) {
      pivot.y += 0.25;
      requiredLift += 0.25;
    }
    this.lift =
      requiredLift > this.lift
        ? requiredLift
        : THREE.MathUtils.damp(this.lift, requiredLift, 5, dt);
    const elevated = this.elevated.copy(feet);
    elevated.y += 1.95 + this.lift;
    if (physics.cameraClear(elevated)) pivot.copy(elevated);
    const direction = this.direction.copy(desired).sub(pivot),
      length = direction.length();
    direction.normalize();
    const allowed = physics.cameraDistance(pivot, direction, length);
    this.arm =
      allowed < this.arm
        ? allowed
        : THREE.MathUtils.damp(this.arm, allowed, 5, dt);
    return pivot.addScaledVector(direction, Math.min(length, this.arm));
  }
  reset() {
    this.arm = Infinity;
    this.lift = 0;
  }
}
