import type { ChoreoActor, ChoreoFrame } from './choreography';
import { easeOut, faceTo, gait, lerp, mix2, seg, smooth, speedOf, travel, type V2, type V3 } from './choreo-math';

/**
 * free-kick — a set piece in one continuous take: the ball spins on its spot
 * like a coin on a table (the espresso-cup match cut), the striker waits,
 * runs up, curls it over a three-man wall into the far top corner; the
 * keeper dives late; the striker runs off toward the corner flag.
 *
 * Geometry: goal at +x (46), spot 22 m out on the left channel, wall at the
 * regulation 9.15 m on the line to goal. Pure functions of moment seconds.
 */
export const FREE_KICK = {
  length: 9,
  settle: 2.0,
  runUp: 2.0,
  windup: 2.55,
  contact: 2.9,
  wallJump: 2.95,
  keeperDive: 3.3,
  goalLine: 3.78,
  netHit: 3.84,
  celebrate: 5.3,
} as const;

const R = 0.25;
const SPOT: V2 = { x: 24, z: 5 };
const GOAL_CENTRE: V2 = { x: 46, z: 0 };
// Canonical goal is 8.8 m wide x 2.8 m: far top corner just inside post and bar.
const TARGET: V3 = { x: 46, y: 2.3, z: -3.45 };
const NET: V3 = { x: 47.95, y: 2.1, z: -3.7 };
const STRIKER_START: V2 = { x: 21.3, z: 6.65 };
const RUN_DIR = (() => {
  const d = { x: SPOT.x - STRIKER_START.x, z: SPOT.z - STRIKER_START.z };
  const l = Math.hypot(d.x, d.z);
  return { x: d.x / l, z: d.z / l };
})();
const CONTACT_POS: V2 = { x: SPOT.x - RUN_DIR.x * 0.5, z: SPOT.z - RUN_DIR.z * 0.5 };
const FOLLOW: V2 = { x: CONTACT_POS.x + 1.0, z: CONTACT_POS.z - 0.3 };
const CELEBRATE_AT: V2 = { x: 31, z: 12.5 };
const TO_GOAL = (() => {
  const d = { x: GOAL_CENTRE.x - SPOT.x, z: GOAL_CENTRE.z - SPOT.z };
  const l = Math.hypot(d.x, d.z);
  return { x: d.x / l, z: d.z / l };
})();
const WALL_C: V2 = { x: SPOT.x + TO_GOAL.x * 9.15, z: SPOT.z + TO_GOAL.z * 9.15 };
const WALL_DIR: V2 = { x: -TO_GOAL.z, z: TO_GOAL.x };
const WALL = [-0.62, 0, 0.62].map((o) => ({ x: WALL_C.x + WALL_DIR.x * o, z: WALL_C.z + WALL_DIR.z * o }));
const KEEPER: V2 = { x: 45.2, z: -0.35 };

function strikerPos(t: number): V2 {
  if (t <= FREE_KICK.runUp) return STRIKER_START;
  if (t <= FREE_KICK.contact) return mix2(STRIKER_START, CONTACT_POS, travel(seg(t, FREE_KICK.runUp, FREE_KICK.contact), 0.45, 0.2));
  if (t <= FREE_KICK.contact + 0.45) return mix2(CONTACT_POS, FOLLOW, easeOut(seg(t, FREE_KICK.contact, FREE_KICK.contact + 0.45)));
  return mix2(FOLLOW, CELEBRATE_AT, travel(seg(t, FREE_KICK.contact + 0.45, FREE_KICK.celebrate), 0.3, 0.35));
}

function ball(t: number): V3 {
  if (t < FREE_KICK.contact) return { x: SPOT.x, y: R, z: SPOT.z };
  if (t < FREE_KICK.goalLine) {
    const k = seg(t, FREE_KICK.contact, FREE_KICK.goalLine);
    return { x: lerp(SPOT.x, TARGET.x, k), y: lerp(R, TARGET.y, k) + 1.95 * Math.sin(Math.PI * k), z: lerp(SPOT.z, TARGET.z, k) + 1.7 * Math.sin(Math.PI * k) };
  }
  if (t < FREE_KICK.netHit) {
    const k = seg(t, FREE_KICK.goalLine, FREE_KICK.netHit);
    return { x: lerp(TARGET.x, NET.x, k), y: lerp(TARGET.y, NET.y, k), z: lerp(TARGET.z, NET.z, k) };
  }
  const dt = t - FREE_KICK.netHit;
  const y = dt < 0.42 ? R + (NET.y - R) * (1 - (dt / 0.42) ** 2) : R;
  return { x: lerp(NET.x, 47.5, easeOut(dt / 0.8)), y, z: NET.z };
}

/** Spin on the spot: a decaying top-spin around the vertical, plus a slight wobble. */
function spin(t: number): { x: number; y: number; z: number } {
  const w = 13;
  const k = 0.75;
  const angle = (w / k) * (1 - Math.exp(-k * t));
  const wob = 0.12 * Math.exp(-0.6 * t);
  return { x: wob * Math.sin(angle * 0.5), y: angle, z: wob * Math.cos(angle * 0.5) };
}

function striker(t: number): ChoreoActor {
  const pos = strikerPos(t);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 9 };
  if (t < FREE_KICK.runUp) {
    // Waits, reads the wall; a slow breath.
    return { ...base, facing: faceTo(STRIKER_START, SPOT) - 0.25, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: 0.25 * smooth(seg(t, 1.3, 1.95)), headPitch: 0.08 - 0.12 * smooth(seg(t, 0.6, 1.4)) } };
  }
  if (t >= FREE_KICK.celebrate) {
    const shift = (4 * Math.PI - 9 * 1.3) / 7;
    return { ...base, facing: -2.4, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t - FREE_KICK.celebrate + shift, celebrating: true } };
  }
  if (t >= FREE_KICK.contact && t < FREE_KICK.contact + 0.3) {
    return { ...base, facing: faceTo(STRIKER_START, SPOT), pose: { action: 'kick', actionTime: t - FREE_KICK.contact, speed: 0, clock: t, windup: 1 } };
  }
  const speed = speedOf(strikerPos, t);
  const t0 = t < FREE_KICK.contact ? FREE_KICK.runUp : FREE_KICK.contact + 0.3;
  const windup = smooth(seg(t, FREE_KICK.windup, FREE_KICK.contact - 0.03));
  const facing = t < FREE_KICK.contact ? faceTo(STRIKER_START, SPOT) : faceTo(FOLLOW, CELEBRATE_AT);
  return { ...base, facing, pose: { action: speed > 1 ? 'run' : 'idle', actionTime: 0, speed, clock: gait(strikerPos, t0, t), windup: windup > 0 && t < FREE_KICK.contact ? windup : undefined, airplane: smooth(seg(t, FREE_KICK.goalLine + 0.2, FREE_KICK.goalLine + 0.6)) } };
}

function wallActor(i: number, t: number): ChoreoActor {
  const p = WALL[i];
  const jump = seg(t, FREE_KICK.wallJump + i * 0.03, FREE_KICK.wallJump + 0.42 + i * 0.03);
  return {
    team: 'away',
    x: p.x,
    z: p.z,
    number: [4, 5, 6][i],
    facing: faceTo(p, SPOT),
    pose: { action: 'idle', actionTime: 0, speed: 0, clock: t + i, hop: jump > 0 && jump < 1 ? jump : undefined, crouch: 0.4 * smooth(seg(t, 2.3, 2.85)) * (t < FREE_KICK.wallJump ? 1 : 0), headPitch: -0.05 },
  };
}

function keeper(t: number): ChoreoActor {
  const base = { team: 'keeper-away' as const, x: KEEPER.x, z: KEEPER.z, number: 1 };
  if (t < FREE_KICK.keeperDive) {
    const shuffle = 0.25 * smooth(seg(t, 2.5, 3.1));
    return { ...base, z: KEEPER.z + shuffle, facing: -Math.PI / 2 + 0.15, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: smooth(seg(t, 2.4, 2.9)) } };
  }
  const k = seg(t, FREE_KICK.keeperDive, FREE_KICK.keeperDive + 0.28);
  return { ...base, z: KEEPER.z + 0.25 - 2.3 * easeOut(k), facing: Math.PI, pose: { action: 'dive', actionTime: t - FREE_KICK.keeperDive, speed: 0, clock: t, reach: Math.min(1, k * 2.5), grounded: smooth(seg(t, FREE_KICK.keeperDive + 0.28, FREE_KICK.keeperDive + 0.6)) } };
}

export function sampleFreeKick(time: number): ChoreoFrame {
  const t = Math.min(FREE_KICK.length, Math.max(0, time));
  const scored = t >= FREE_KICK.goalLine;
  const crowd = scored
    ? { mood: 'goal' as const, intensity: 1, moodTime: t - FREE_KICK.goalLine, homeSection: 1 as const }
    : t >= FREE_KICK.runUp - 0.6
      ? { mood: 'anticipation' as const, intensity: 0.3 + 0.7 * smooth(seg(t, 1.4, FREE_KICK.contact)), moodTime: t, homeSection: 1 as const }
      : { mood: 'idle' as const, intensity: 0.3, moodTime: t, homeSection: 1 as const };
  const s = striker(t);
  const k = keeper(t);
  const w = [0, 1, 2].map((i) => wallActor(i, t));
  return {
    ball: ball(t),
    ballSpin: t < FREE_KICK.contact ? spin(t) : undefined,
    actors: [s, k, ...w],
    crowdIntensity: crowd.intensity,
    phase: scored ? 'goal' : t >= FREE_KICK.contact ? 'shot' : 'set-piece',
    anchors: { hero: { x: s.x, z: s.z }, rival: WALL_C, keeper: { x: k.x, z: k.z } },
    crowd,
    net: scored ? { side: 1, phaseTime: t - FREE_KICK.goalLine } : undefined,
  };
}
