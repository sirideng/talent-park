import * as THREE from 'three';
import { PlayerController, RAPIER } from '../physics/player-controller';

/** A mode adapter, NOT a second physics engine: all movement/queries use the same world.
 * The wider capsule contains both wheels even during zero-speed turns. */
export class BicycleController {
  mounted = false;
  speed = 0;
  heading = Math.PI / 2;
  private stalled = 0;
  readonly parked = new THREE.Vector3();
  readonly checkpoint = new THREE.Vector3();
  constructor(
    readonly player: PlayerController,
    parked: THREE.Vector3,
  ) {
    this.parked.copy(parked);
    this.checkpoint.copy(parked);
  }
  safeGround(x: number, z: number, radius = 0.32) {
    const p = this.player;
    const hit = p.world.castRayAndGetNormal(
      new RAPIER.Ray({ x, y: 60, z }, { x: 0, y: -1, z: 0 }),
      80,
      true,
      undefined,
      undefined,
      p.capsule,
      undefined,
      p.solid,
    );
    if (!hit || hit.normal.y < 0.9) return null;
    const feet = new THREE.Vector3(x, 60 - hit.timeOfImpact + 0.04, z);
    // Wide support footprint rules out perching on rail tops or dismounting over edges.
    for (const [dx, dz] of [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
    ]) {
      const support = p.world.castRay(
        new RAPIER.Ray(
          { x: x + dx, y: feet.y + 0.15, z: z + dz },
          { x: 0, y: -1, z: 0 },
        ),
        0.4,
        true,
        undefined,
        undefined,
        p.capsule,
        undefined,
        p.solid,
      );
      if (!support) return null;
    }
    let blocked = false;
    p.world.intersectionsWithShape(
      { x, y: feet.y + 0.85, z },
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Capsule(0.85 - radius, radius),
      () => {
        blocked = true;
        return false;
      },
      undefined,
      undefined,
      p.capsule,
      undefined,
      p.solid,
    );
    return blocked ? null : feet;
  }
  mount() {
    if (!this.player.grounded) return false;
    if (this.mounted || this.player.position.distanceTo(this.parked) > 2.6)
      return false;
    const safe = this.safeGround(this.parked.x, this.parked.z, 0.8);
    if (!safe || Math.abs(safe.y - this.parked.y) > 0.35) return false;
    this.player.capsule.setShape(new RAPIER.Capsule(0.05, 0.8));
    this.player.teleport(safe);
    this.player.sync();
    this.mounted = true;
    this.speed = 0;
    return true;
  }
  dismount() {
    if (!this.mounted || this.speed > 0.18 || !this.player.grounded)
      return false;
    for (const a of [
      this.heading + Math.PI / 2,
      this.heading - Math.PI / 2,
      this.heading + Math.PI,
    ]) {
      const safe = this.safeGround(
        this.player.position.x + Math.sin(a) * 1.6,
        this.player.position.z + Math.cos(a) * 1.6,
      );
      if (!safe || Math.abs(safe.y - this.player.position.y) > 0.35) continue;
      this.parked.copy(this.player.position);
      this.player.capsule.setShape(new RAPIER.Capsule(0.53, 0.32));
      this.player.teleport(safe);
      this.player.sync();
      this.mounted = false;
      return true;
    }
    return false;
  }
  update(
    dt: number,
    pedal: boolean,
    brake: boolean,
    steer: number,
    boost: boolean,
  ) {
    const before = this.player.position.clone(),
      resets = this.player.resets;
    this.heading += steer * 1.35 * dt; // May turn in place to escape a stopped collision.
    this.speed = brake
      ? Math.max(0, this.speed - 12 * dt)
      : pedal
        ? Math.min(boost ? 8.5 : 5.5, this.speed + 2.7 * dt)
        : Math.max(0, this.speed - 0.65 * dt);
    this.player.update(
      dt,
      new THREE.Vector3(
        Math.sin(this.heading),
        0,
        Math.cos(this.heading),
      ).multiplyScalar(this.speed / 3.8),
    );
    const travelled = this.player.position.distanceTo(before);
    if (this.player.resets !== resets) {
      this.player.teleport(this.checkpoint);
      this.player.sync();
      this.speed = 0;
      return 0;
    }
    this.stalled =
      this.speed > 0.5 && travelled < dt * this.speed * 0.2
        ? this.stalled + dt
        : 0;
    if (this.stalled > 0.12) {
      this.speed = 0;
      this.stalled = 0;
    }
    return travelled;
  }
  stop() {
    this.speed = 0;
    this.player.stop();
  }
}
