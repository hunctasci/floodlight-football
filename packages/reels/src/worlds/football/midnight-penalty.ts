import type { ChoreoActor, ChoreoFrame } from './choreography';
import { blink, clamp01, easeOut, faceTo, gait, lerp, mix2, seg, smooth, speedOf, travel, wrap, type V2, type V3 } from './choreo-math';

/**
 * midnight-penalty — Halloween. An empty stadium at night; a keeper on his
 * line who never moves and never blinks (only his head follows you). The
 * striker walks on, looks around, the ball rolls out to the spot on its own,
 * he takes the penalty. The spec cuts the lights before the ball arrives;
 * while it is dark the keeper is suddenly beside the striker, ball in his
 * hands. Pure functions of moment seconds.
 */
export const MIDNIGHT = {
  length: 17,
  walkIn: 0,
  lookAround: 4.4,
  roll: 6.2,
  rest: 9.2,
  approach: 9.4,
  runUp: 11.5,
  contact: 12.1,
  save: 12.55,
  swap: 12.7,
  turn: 14.2,
} as const;

const R = 0.25;
const SPOT: V2 = { x: 35, z: 0 };
const KEEPER_LINE: V2 = { x: 45.5, z: 0 };
const WALK_FROM: V2 = { x: 25.5, z: 9.5 };
const WALK_TO: V2 = { x: 32.4, z: 3.1 };
const RUN_FROM: V2 = { x: 32.75, z: 1.25 };
const CONTACT_POS: V2 = { x: 34.55, z: 0.3 };
const AFTER: V2 = { x: 35.25, z: 0.45 };
/** Where the keeper stands when the lights come back: at the striker's left shoulder. */
const BESIDE: V2 = { x: 35.55, z: 1.55 };
const BALL_FROM: V2 = { x: 44.6, z: -0.2 };
const SHOT_TO: V3 = { x: 46, y: 1.05, z: -2.7 };
const BLINKS = [1.1, 3.0, 4.9, 6.35, 8.8, 10.3, 11.05, 14.9, 15.6];

function strikerPos(t: number): V2 {
  if (t < MIDNIGHT.lookAround) return mix2(WALK_FROM, WALK_TO, travel(seg(t, 0, MIDNIGHT.lookAround), 0.2, 0.35));
  if (t < MIDNIGHT.approach) return WALK_TO;
  if (t < MIDNIGHT.runUp) return mix2(WALK_TO, RUN_FROM, travel(seg(t, MIDNIGHT.approach, MIDNIGHT.runUp - 0.3), 0.3, 0.4));
  if (t < MIDNIGHT.contact) return mix2(RUN_FROM, CONTACT_POS, travel(seg(t, MIDNIGHT.runUp, MIDNIGHT.contact), 0.5, 0.15));
  return mix2(CONTACT_POS, AFTER, easeOut(seg(t, MIDNIGHT.contact, MIDNIGHT.contact + 0.5)));
}

function ball(t: number): V3 {
  if (t < MIDNIGHT.roll) return { x: BALL_FROM.x, y: R, z: BALL_FROM.z };
  if (t < MIDNIGHT.contact) {
    // Rolls out of the dark on its own, slowing to a dead stop on the spot.
    const k = smooth(seg(t, MIDNIGHT.roll, MIDNIGHT.rest));
    const p = mix2(BALL_FROM, SPOT, k);
    return { x: p.x, y: R, z: p.z };
  }
  if (t < MIDNIGHT.swap) {
    const k = seg(t, MIDNIGHT.contact, MIDNIGHT.save);
    return { x: lerp(SPOT.x, SHOT_TO.x, k), y: lerp(R, SHOT_TO.y, k) + 0.3 * Math.sin(Math.PI * k), z: lerp(SPOT.z, SHOT_TO.z, k) };
  }
  // In the keeper's hands, at his chest, in front of him.
  const f = faceTo(BESIDE, AFTER);
  return { x: BESIDE.x + Math.sin(f) * 0.44, y: 1.08, z: BESIDE.z + Math.cos(f) * 0.44 };
}

function striker(t: number): ChoreoActor {
  const pos = strikerPos(t);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 9 };
  const eyeOpen = blink(t, BLINKS) * (t >= MIDNIGHT.turn + 0.35 ? 1.3 : 1);
  const speed = speedOf(strikerPos, t);
  if (t < MIDNIGHT.lookAround) {
    return { ...base, facing: faceTo(WALK_FROM, WALK_TO), pose: { action: speed > 0.3 ? 'run' : 'idle', actionTime: 0, speed, clock: gait(strikerPos, 0, t, 0.5), walk: 1, eyeOpen, headYaw: 0.25 * Math.sin(t * 0.9) } };
  }
  if (t < MIDNIGHT.approach) {
    // Looks around the empty stands; checks the keeper twice.
    const u = t - MIDNIGHT.lookAround;
    return { ...base, facing: faceTo(WALK_TO, SPOT) + 0.3, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, eyeOpen, headYaw: 0.95 * Math.sin(u * 1.7) * (1 - smooth(seg(t, MIDNIGHT.roll + 0.4, MIDNIGHT.roll + 1.0))) - 0.35 * smooth(seg(t, MIDNIGHT.roll + 0.4, MIDNIGHT.roll + 1.0)), headPitch: 0.25 * smooth(seg(t, MIDNIGHT.roll + 0.6, MIDNIGHT.rest)) } };
  }
  if (t < MIDNIGHT.contact) {
    const toBall = faceTo(pos, SPOT);
    const windup = smooth(seg(t, MIDNIGHT.contact - 0.3, MIDNIGHT.contact - 0.03));
    const t0 = t < MIDNIGHT.runUp ? MIDNIGHT.approach : MIDNIGHT.runUp;
    return { ...base, facing: t < MIDNIGHT.runUp - 0.3 ? faceTo(WALK_TO, RUN_FROM) : toBall, pose: { action: speed > 0.3 ? 'run' : 'idle', actionTime: 0, speed, clock: gait(strikerPos, t0, t, t < MIDNIGHT.runUp ? 0.5 : 1), walk: t < MIDNIGHT.runUp ? 1 : 0, eyeOpen, windup: windup > 0 ? windup : undefined } };
  }
  if (t < MIDNIGHT.contact + 0.3) return { ...base, facing: faceTo(RUN_FROM, CONTACT_POS), pose: { action: 'kick', actionTime: t - MIDNIGHT.contact, speed: 0, clock: t, windup: 1, eyeOpen } };
  // Frozen, facing the goal; then very slowly turns his head to the keeper beside him.
  const turn = smooth(seg(t, MIDNIGHT.turn, MIDNIGHT.turn + 1.1));
  const rel = wrap(faceTo(pos, BESIDE) - faceTo(RUN_FROM, CONTACT_POS));
  return { ...base, facing: faceTo(RUN_FROM, CONTACT_POS), pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, eyeOpen, headYaw: clamp01(Math.abs(rel)) * Math.sign(rel) * 1.05 * turn } };
}

function keeper(t: number, strikerAt: V2): ChoreoActor {
  const base = { team: 'keeper-away' as const, number: 1, pose: undefined };
  const eyeOpen = 1.22;
  if (t < MIDNIGHT.swap) {
    // Body dead still on the line; only the head tracks the striker.
    const facing = -Math.PI / 2;
    const rel = wrap(faceTo(KEEPER_LINE, strikerAt) - facing);
    return { ...base, x: KEEPER_LINE.x, z: KEEPER_LINE.z, facing, pose: { action: 'idle', actionTime: 0, speed: 0, clock: 0, headYaw: Math.max(-0.9, Math.min(0.9, rel)), eyeOpen } };
  }
  const facing = faceTo(BESIDE, AFTER);
  return { ...base, x: BESIDE.x, z: BESIDE.z, facing, pose: { action: 'idle', actionTime: 0, speed: 0, clock: 0, cradle: 1, eyeOpen, headPitch: 0.05 } };
}

export function sampleMidnightPenalty(time: number): ChoreoFrame {
  const t = Math.min(MIDNIGHT.length, Math.max(0, time));
  const s = striker(t);
  const k = keeper(t, { x: s.x, z: s.z });
  const b = ball(t);
  return {
    ball: b,
    ballSpin: t >= MIDNIGHT.swap ? { x: 0.3, y: 0.8, z: 0 } : undefined,
    actors: [s, k],
    crowdIntensity: 0,
    phase: t >= MIDNIGHT.swap ? 'beside' : t >= MIDNIGHT.contact ? 'shot' : 'walk',
    anchors: { hero: { x: s.x, z: s.z }, rival: { x: k.x, z: k.z }, keeper: { x: k.x, z: k.z } },
    crowd: { mood: 'idle', intensity: 0, moodTime: t, homeSection: 1 },
  };
}
