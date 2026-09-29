import type { ChoreoActor, ChoreoFrame } from './choreography';
import { gait, lerp, seg, smooth, speedOf, travel, type V2 } from './choreo-math';

/**
 * walk-out — five players walk out across an empty stadium together, the lead
 * in front and the others in a shallow V behind, slow and unhurried, and stop
 * short of the centre circle. No opponent, no ball: a ceremony, not a match.
 */
export const WALK_OUT = { length: 16, start: 0, stop: 13.2 } as const;

const SLOTS: readonly { dx: number; dz: number; delay: number; number: number }[] = [
  { dx: 0, dz: 0, delay: 0, number: 29 },
  { dx: -2.3, dz: 1.7, delay: 0.25, number: 10 },
  { dx: 2.3, dz: 1.7, delay: 0.3, number: 7 },
  { dx: -4.6, dz: 3.4, delay: 0.5, number: 4 },
  { dx: 4.6, dz: 3.4, delay: 0.55, number: 1 },
];
const FROM_Z = 25;
const TO_Z = 6.5;

function path(i: number): (t: number) => V2 {
  const s = SLOTS[i];
  return (t: number) => ({ x: s.dx, z: lerp(FROM_Z, TO_Z, travel(seg(t, s.delay, WALK_OUT.stop + s.delay * 0.4), 0.12, 0.2)) + s.dz });
}

function walker(i: number, t: number): ChoreoActor {
  const p = path(i);
  const pos = p(t);
  const speed = speedOf(p, t);
  const standing = speed < 0.25;
  return {
    team: 'home',
    x: pos.x,
    z: pos.z,
    number: SLOTS[i].number,
    facing: Math.PI,
    pose: { action: standing ? 'idle' : 'run', actionTime: 0, speed, clock: gait(p, 0, t, 0.48), walk: 1, headPitch: -0.12 * smooth(seg(t, WALK_OUT.stop, WALK_OUT.stop + 1.2)) },
  };
}

export function sampleWalkOut(time: number): ChoreoFrame {
  const t = Math.min(WALK_OUT.length, Math.max(0, time));
  const actors = SLOTS.map((_, i) => walker(i, t));
  return {
    ball: { x: 0, y: 0.25, z: 0 },
    ballHidden: true,
    actors,
    crowdIntensity: 0,
    phase: 'walk',
    anchors: { hero: { x: actors[0].x, z: actors[0].z }, rival: { x: actors[1].x, z: actors[1].z }, keeper: { x: 0, z: -20 } },
    crowd: { mood: 'idle', intensity: 0, moodTime: t, homeSection: 1 },
  };
}
