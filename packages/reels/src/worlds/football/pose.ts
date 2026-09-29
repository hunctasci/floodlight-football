import {
  applyHncGamePose,
  applyHncProceduralPose,
  type HncPlayerVisual,
} from '@floodlight/hnc-visuals';
import type { ChoreoActor } from './choreography';

/**
 * Pose one canonical HNC player from a choreography actor.
 *
 * `pose` actors go through the game's own applyHncGamePose() (run swing,
 * kick snap, slide, dive, celebrations — verbatim game behaviour), then get
 * optional reel accents on the SAME joints the game animates (leg/arm
 * rotations, root lift/tilt). Proportions and geometry are never touched.
 */
export function applyChoreoActor(v: HncPlayerVisual, a: ChoreoActor, localTime: number): void {
  if (a.pose) applyGamePose(v, a);
  else {
    applyHncProceduralPose(v, a.procedural ?? 'idle', localTime);
    v.root.position.x = a.x;
    v.root.position.z = a.z;
    v.root.rotation.y = a.facing;
  }
  v.shadow.position.set(a.x, 0.015, a.z);
  // Game: dive shadow stretches to 1.45 (renderer.ts avatar loop).
  v.shadow.scale.setScalar(a.pose?.action === 'dive' ? 1.45 : 1);
}

function applyGamePose(v: HncPlayerVisual, a: ChoreoActor): void {
  const p = a.pose!;
  applyHncGamePose(v, {
    clock: p.clock,
    index: a.number ?? 0,
    speed: p.speed,
    action: p.action,
    actionTime: p.actionTime,
    facingX: Math.sin(a.facing),
    facingZ: Math.cos(a.facing),
    celebrating: p.celebrating ?? false,
  });
  v.root.position.x = a.x;
  v.root.position.z = a.z;

  if (p.crouch) {
    v.root.position.y -= 0.07 * p.crouch;
    v.root.rotation.x += 0.1 * p.crouch;
    v.armL.rotation.z += 0.12 * p.crouch;
    v.armR.rotation.z -= 0.12 * p.crouch;
  }
  if (p.windup) {
    if (p.action === 'kick') {
      // Snap starts from the backswing instead of the game's neutral 0.
      v.legR.rotation.x = 0.8 + (-1.35 - 0.8) * Math.min(1, p.actionTime * 9);
    } else {
      v.legR.rotation.x = v.legR.rotation.x + (0.8 - v.legR.rotation.x) * p.windup;
      v.legL.rotation.x *= 1 - p.windup;
      v.root.rotation.x -= 0.1 * p.windup;
    }
    v.armL.rotation.z = 0.9 * p.windup;
    v.armR.rotation.z = -0.5 * p.windup;
  }
  if (p.hop !== undefined) {
    const s = Math.sin(Math.PI * p.hop);
    v.root.position.y += 0.55 * s;
    v.legL.rotation.x = -0.9 * s;
    v.legR.rotation.x = 0.6 * s;
    v.armL.rotation.z = 0.8 * s;
    v.armR.rotation.z = -0.8 * s;
  }
  if (p.airplane) {
    v.armL.rotation.x *= 1 - p.airplane;
    v.armR.rotation.x *= 1 - p.airplane;
    v.armL.rotation.z = 1.45 * p.airplane;
    v.armR.rotation.z = -1.45 * p.airplane;
  }
  if (p.reach) {
    v.armL.rotation.x = -2.7 * p.reach;
    v.armR.rotation.x = -2.7 * p.reach;
  }
  if (p.grounded) {
    v.root.position.y += (0.1 - v.root.position.y) * p.grounded;
    v.root.rotation.z *= 1 + 0.37 * p.grounded;
  }
}
