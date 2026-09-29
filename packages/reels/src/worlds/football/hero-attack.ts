import type { ChoreoActor, ChoreoFrame, ChoreoPose } from './choreography';

/**
 * hero-attack — the HNC hero trailer's single continuous football action.
 *
 * faceoff -> burst -> dribble duel -> slide tackle hurdled -> wind-up ->
 * shot -> top-corner goal -> scorer celebration, as pure functions of
 * absolute moment time (seconds). Shots sample windows of this one timeline
 * through moment clocks, so cuts keep physical continuity.
 *
 * Poses are the canonical game poses (applyHncGamePose) with speeds/clocks
 * derived from the paths here; nothing in this file shapes a character.
 */

type V2 = { x: number; z: number };

/** Beat times (moment seconds). Compiler, effects and audio sync to these. */
export const HERO_ATTACK = {
  length: 12,
  kickoff: 2.5,
  slide: 4.28,
  hopStart: 4.4,
  hopEnd: 4.7,
  windup: 5.74,
  contact: 6.1,
  keeperDive: 6.2,
  goalLine: 6.5,
  netHit: 6.58,
  celebrate: 7.5,
  mateArrive: 8.4,
} as const;

const GOAL_X = 46;
const STRIKER_START: V2 = { x: -0.7, z: 0 };
const RIVAL_START: V2 = { x: 1.25, z: 0 };
const CONTACT_SPOT: V2 = { x: 29.8, z: 2.3 };
const CELEBRATION_SPOT: V2 = { x: 34.0, z: 7.0 };
const SHOT_TARGET = { x: GOAL_X, y: 2.05, z: -3.05 };
const NET_HIT = { x: 47.95, y: 1.9, z: -3.3 };
const KEEPER_X = 43.4;
const MATE_START: V2 = { x: -7.5, z: -6.5 };
const MATE_RUN_END: V2 = { x: 24.5, z: -7 };
const MATE_CELEBRATE: V2 = { x: 33.9, z: 8.1 };
const HOLDER_START: V2 = { x: -3.5, z: -3.8 };
const HOLDER_END: V2 = { x: 27.5, z: -3.6 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number): number => {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
const mix2 = (a: V2, b: V2, t: number): V2 => ({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) });

/**
 * Normalized distance of a trapezoid velocity profile: ramp up over [0,a],
 * cruise, ramp down over the last d to end-speed ratio r. Continuous speed —
 * the burst accelerates, the plant decelerates.
 */
function trapezoid(u: number, a: number, d: number, r: number): number {
  const x = clamp01(u);
  const total = 1 - a / 2 - ((1 - r) * d) / 2;
  let f: number;
  if (x < a) f = (x * x) / (2 * a);
  else if (x < 1 - d) f = a / 2 + (x - a);
  else {
    const w = x - (1 - d);
    f = a / 2 + (1 - d - a) + w - ((1 - r) * w * w) / (2 * d);
  }
  return f / total;
}

// --- Striker (TR #9, the hero) -------------------------------------------

function strikerRun(t: number): V2 {
  const u = seg(t, HERO_ATTACK.kickoff, HERO_ATTACK.contact);
  const k = trapezoid(u, 0.16, 0.28, 0.3);
  // Slip past the rival on the camera side, then veer to the right channel.
  const z = 1.15 * Math.sin(Math.PI * clamp01(u / 0.5)) + CONTACT_SPOT.z * smooth((u - 0.45) / 0.55);
  return { x: lerp(STRIKER_START.x, CONTACT_SPOT.x, k), z };
}

const FOLLOW_THROUGH: V2 = { x: CONTACT_SPOT.x + 0.9, z: CONTACT_SPOT.z + 0.25 };

function strikerPos(t: number): V2 {
  if (t <= HERO_ATTACK.kickoff) return STRIKER_START;
  if (t <= HERO_ATTACK.contact) return strikerRun(t);
  const followEnd = HERO_ATTACK.contact + 0.35;
  if (t <= followEnd) return mix2(CONTACT_SPOT, FOLLOW_THROUGH, easeOut(seg(t, HERO_ATTACK.contact, followEnd)));
  // Trapezoid, not cubic ease: a cubic triples the mean speed mid-run (~23 m/s).
  return mix2(FOLLOW_THROUGH, CELEBRATION_SPOT, trapezoid(seg(t, followEnd, HERO_ATTACK.celebrate), 0.3, 0.35, 0));
}

// --- Numeric helpers (deterministic, fixed steps) --------------------------

const H = 1 / 120;

function velocity(path: (t: number) => V2, t: number): V2 {
  const a = path(t - H);
  const b = path(t + H);
  return { x: (b.x - a.x) / (2 * H), z: (b.z - a.z) / (2 * H) };
}

function speedOf(path: (t: number) => V2, t: number): number {
  const v = velocity(path, t);
  return Math.hypot(v.x, v.z);
}

/** Facing from velocity; keeps `fallback` when (nearly) standing. */
function facingOf(path: (t: number) => V2, t: number, fallback: number): number {
  const v = velocity(path, t);
  return Math.hypot(v.x, v.z) < 0.4 ? fallback : Math.atan2(v.x, v.z);
}

/**
 * Game run swing is sin(clock*(8+1.5*speed)+i). With a varying speed that
 * product makes legs flutter, so integrate the cadence instead and hand the
 * game an equivalent clock: clock*(8+1.5*speed) == integrated phase.
 */
function gaitClock(path: (t: number) => V2, t0: number, t: number): number {
  const speed = speedOf(path, t);
  let phase = 0;
  const steps = Math.max(1, Math.ceil((t - t0) * 60));
  const dt = (t - t0) / steps;
  for (let i = 0; i < steps; i++) phase += (8 + 1.5 * speedOf(path, t0 + (i + 0.5) * dt)) * dt;
  return phase / (8 + 1.5 * speed);
}

function unit(v: V2): V2 {
  const l = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / l, z: v.z / l };
}

// --- Ball -------------------------------------------------------------------

/** First touch: the moment the burst reaches the ball (0.35m behind it). */
const FIRST_TOUCH = (() => {
  let lo: number = HERO_ATTACK.kickoff;
  let hi = HERO_ATTACK.kickoff + 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (strikerRun(mid).x < -0.35) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** Dribble touches: [time, peak lead (m)]; the 4.18 poke sends it past the slide. */
const TOUCHES: readonly (readonly [number, number])[] = [
  [FIRST_TOUCH, 1.6],
  [3.12, 1.7],
  [3.55, 1.7],
  [4.18, 2.1],
  [4.86, 1.6],
  [5.32, 1.25],
];

/** Dribble touch times (moment seconds) — for audio sync. */
export const HERO_TOUCHES: readonly number[] = TOUCHES.map(([at]) => at);

function dribbleLead(t: number): number {
  for (let i = TOUCHES.length - 1; i >= 0; i--) {
    const [at, peak] = TOUCHES[i];
    if (t < at) continue;
    const next = i + 1 < TOUCHES.length ? TOUCHES[i + 1][0] : HERO_ATTACK.contact;
    const p = seg(t, at, next);
    if (i === TOUCHES.length - 1) {
      // Last touch sets the ball; he steps into it at contact (lead 0.45m).
      return 0.35 + peak * Math.sin(Math.PI * p) * (1 - 0.3 * p) + 0.1 * p;
    }
    return 0.35 + (peak - 0.35) * Math.sin(Math.PI * p);
  }
  return 0.35;
}

function dribbleBall(t: number): V2 {
  const s = strikerRun(t);
  const d = unit(velocity(strikerRun, t));
  const lead = dribbleLead(t);
  return { x: s.x + d.x * lead, z: s.z + d.z * lead };
}

const BALL_SPOT = dribbleBall(HERO_ATTACK.contact);

function ballPos(t: number): { x: number; y: number; z: number } {
  const R = 0.25;
  if (t < FIRST_TOUCH) return { x: 0, y: R, z: 0 };
  if (t < HERO_ATTACK.contact) {
    // Ease off the centre spot: the dribble offset carries the weave's
    // lateral drift, which would otherwise teleport the ball on first touch.
    const b = mix2({ x: 0, z: 0 }, dribbleBall(t), smooth(seg(t, FIRST_TOUCH, FIRST_TOUCH + 0.15)));
    return { x: b.x, y: R, z: b.z };
  }
  if (t < HERO_ATTACK.goalLine) {
    const k = seg(t, HERO_ATTACK.contact, HERO_ATTACK.goalLine);
    return {
      x: lerp(BALL_SPOT.x, SHOT_TARGET.x, k),
      // Slight outswing that bends back to the far top corner.
      y: lerp(R, SHOT_TARGET.y, k) + 0.55 * Math.sin(Math.PI * k),
      z: lerp(BALL_SPOT.z, SHOT_TARGET.z, k) + 0.8 * Math.sin(Math.PI * k),
    };
  }
  if (t < HERO_ATTACK.netHit) {
    const k = seg(t, HERO_ATTACK.goalLine, HERO_ATTACK.netHit);
    return { x: lerp(SHOT_TARGET.x, NET_HIT.x, k), y: lerp(SHOT_TARGET.y, NET_HIT.y, k), z: lerp(SHOT_TARGET.z, NET_HIT.z, k) };
  }
  // Net swallows it: drop, one small bounce, settle against the net.
  const dt = t - HERO_ATTACK.netHit;
  const fall = 0.42;
  const y = dt < fall
    ? R + (NET_HIT.y - R) * (1 - (dt / fall) * (dt / fall))
    : R + 0.3 * Math.abs(Math.sin(Math.PI * clamp01((dt - fall) / 0.32))) * (dt - fall < 0.32 ? 1 : 0);
  return { x: lerp(NET_HIT.x, 47.55, easeOut(dt / 0.8)), y, z: NET_HIT.z };
}

// --- Rival defender (GR #4) -------------------------------------------------

/** Chases on the far side (-z) so he never occludes the hero from +z lenses. */
function chaseTarget(t: number): V2 {
  const s = strikerRun(t);
  return { x: s.x - 1.1, z: s.z - 1.45 };
}

const SLIDE_START = chaseTarget(HERO_ATTACK.slide);
const HOP_PEAK = (HERO_ATTACK.hopStart + HERO_ATTACK.hopEnd) / 2;
/** The slide aims just ahead of the striker's feet at the hurdle peak. */
const SLIDE_AIM = (() => {
  const s = strikerRun(HOP_PEAK);
  const d = unit(velocity(strikerRun, HOP_PEAK));
  return { x: s.x + d.x * 0.3, z: s.z + d.z * 0.3 };
})();
const SLIDE_DUR = 0.5;
const SLIDE_DIR = unit({ x: SLIDE_AIM.x - SLIDE_START.x, z: SLIDE_AIM.z - SLIDE_START.z });
// easeOut(0.5) = 0.875 -> the slide reaches the aim point at the hurdle peak.
const SLIDE_LEN = Math.hypot(SLIDE_AIM.x - SLIDE_START.x, SLIDE_AIM.z - SLIDE_START.z) / 0.875;

function rivalPos(t: number): V2 {
  if (t <= HERO_ATTACK.kickoff + 0.12) return RIVAL_START;
  if (t < HERO_ATTACK.slide) return mix2(RIVAL_START, chaseTarget(t), smooth(seg(t, HERO_ATTACK.kickoff + 0.12, 3.6)));
  const k = easeOut(seg(t, HERO_ATTACK.slide, HERO_ATTACK.slide + SLIDE_DUR));
  return { x: SLIDE_START.x + SLIDE_DIR.x * SLIDE_LEN * k, z: SLIDE_START.z + SLIDE_DIR.z * SLIDE_LEN * k };
}

// --- Keeper (GR #1) ---------------------------------------------------------

const DIVE_DUR = 0.28; // game clamp(|dz|/diveSpeed, .12, .28)
const DIVE_DZ = -2.3; // game bound: |dz| <= 2.4

function keeperPos(t: number): V2 {
  const track = (tt: number): number => Math.max(-1.2, Math.min(1.2, 0.3 * ballPos(Math.min(tt, HERO_ATTACK.contact)).z));
  const z0 = track(HERO_ATTACK.keeperDive);
  if (t < HERO_ATTACK.keeperDive) return { x: KEEPER_X, z: track(t) };
  return { x: KEEPER_X, z: z0 + DIVE_DZ * easeOut(seg(t, HERO_ATTACK.keeperDive, HERO_ATTACK.keeperDive + DIVE_DUR)) };
}

// --- Background players ------------------------------------------------------

function matePos(t: number): V2 {
  if (t <= HERO_ATTACK.kickoff) return MATE_START;
  if (t <= HERO_ATTACK.contact) return mix2(MATE_START, MATE_RUN_END, easeInOut(seg(t, HERO_ATTACK.kickoff, HERO_ATTACK.contact)));
  return mix2(MATE_RUN_END, MATE_CELEBRATE, easeInOut(seg(t, 6.6, HERO_ATTACK.mateArrive)));
}

function holderPos(t: number): V2 {
  if (t <= HERO_ATTACK.kickoff) return HOLDER_START;
  return mix2(HOLDER_START, HOLDER_END, easeInOut(seg(t, HERO_ATTACK.kickoff + 0.2, HERO_ATTACK.contact)));
}

// --- Poses --------------------------------------------------------------------

function runPose(path: (t: number) => V2, t: number, t0: number, extra: Partial<ChoreoPose> = {}): ChoreoPose {
  const speed = speedOf(path, t);
  return {
    action: speed > 1 ? 'run' : 'idle',
    actionTime: 0,
    speed,
    clock: gaitClock(path, t0, t),
    ...extra,
  };
}

/** Anticipation dip in the last beat before kickoff (both duellists). */
const faceoffCrouch = (t: number): number => smooth(seg(t, 2.1, 2.45)) * (t < HERO_ATTACK.kickoff + 0.08 ? 1 : 0);

function strikerActor(t: number): ChoreoActor {
  const pos = strikerPos(t);
  const facing = facingOf(strikerPos, t, Math.PI / 2);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 9 };
  if (t < HERO_ATTACK.kickoff) {
    return { ...base, facing: Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: faceoffCrouch(t) } };
  }
  if (t >= HERO_ATTACK.celebrate) {
    // Game celebration move for #9 is 0 (jump, arms up). Shift the clock so
    // the jump rises from the ground at the first celebration frame:
    // 7*clock + 9*1.3 must start on a multiple of PI.
    const shift = (4 * Math.PI - 9 * 1.3) / 7;
    return { ...base, facing: -0.35, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t - HERO_ATTACK.celebrate + shift, celebrating: true } };
  }
  if (t >= HERO_ATTACK.contact) {
    const kick = t < HERO_ATTACK.contact + 0.3;
    const airplane = smooth(seg(t, HERO_ATTACK.goalLine + 0.1, HERO_ATTACK.goalLine + 0.45));
    return {
      ...base,
      facing: kick ? facingOf(strikerRun, HERO_ATTACK.contact - 0.02, Math.PI / 2) : facingOf(strikerPos, t, 0.6),
      pose: kick
        ? { action: 'kick', actionTime: t - HERO_ATTACK.contact, speed: 0, clock: t, windup: 1 }
        : runPose(strikerPos, t, HERO_ATTACK.contact, { airplane }),
    };
  }
  const touch = TOUCHES.find(([at]) => t >= at && t < at + 0.12);
  const hop = seg(t, HERO_ATTACK.hopStart, HERO_ATTACK.hopEnd);
  const windup = smooth(seg(t, HERO_ATTACK.windup, HERO_ATTACK.contact - 0.04));
  const pose = runPose(strikerPos, t, HERO_ATTACK.kickoff, {
    hop: hop > 0 && hop < 1 ? hop : undefined,
    windup: windup > 0 ? windup : undefined,
  });
  if (touch && hop <= 0) Object.assign(pose, { action: 'kick', actionTime: t - touch[0] });
  return { ...base, facing, pose };
}

function rivalActor(t: number): ChoreoActor {
  const pos = rivalPos(t);
  const base = { team: 'away' as const, x: pos.x, z: pos.z, number: 4 };
  if (t < HERO_ATTACK.kickoff + 0.12) {
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: faceoffCrouch(t) } };
  }
  if (t >= HERO_ATTACK.slide) {
    return { ...base, facing: Math.atan2(SLIDE_DIR.x, SLIDE_DIR.z), pose: { action: 'slide', actionTime: t - HERO_ATTACK.slide, speed: 0, clock: t } };
  }
  // Turns toward the camera side (through +z) as he gives chase.
  const turn = smooth(seg(t, HERO_ATTACK.kickoff + 0.12, 2.95));
  const chase = facingOf(rivalPos, t, Math.PI / 2);
  return { ...base, facing: lerp(-Math.PI / 2, chase, turn), pose: runPose(rivalPos, t, HERO_ATTACK.kickoff) };
}

function keeperActor(t: number): ChoreoActor {
  const pos = keeperPos(t);
  const base = { team: 'keeper-away' as const, x: pos.x, z: pos.z, number: 1 };
  if (t < HERO_ATTACK.keeperDive) {
    const crouch = smooth(seg(t, HERO_ATTACK.windup - 0.1, HERO_ATTACK.contact));
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch } };
  }
  // Game dive: facing = dive direction (0, sign dz), roll 0.95, lift 0.26.
  const k = seg(t, HERO_ATTACK.keeperDive, HERO_ATTACK.keeperDive + DIVE_DUR);
  const grounded = smooth(seg(t, HERO_ATTACK.keeperDive + DIVE_DUR, HERO_ATTACK.keeperDive + DIVE_DUR + 0.3));
  return {
    ...base,
    facing: Math.PI,
    pose: { action: 'dive', actionTime: t - HERO_ATTACK.keeperDive, speed: 0, clock: t, reach: Math.min(1, k * 2.5), grounded },
  };
}

function mateActor(t: number): ChoreoActor {
  const pos = matePos(t);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 10 };
  if (t >= HERO_ATTACK.mateArrive) {
    return { ...base, facing: -0.9, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t - HERO_ATTACK.mateArrive, celebrating: true } };
  }
  const t0 = t > HERO_ATTACK.contact ? 6.6 : HERO_ATTACK.kickoff;
  return { ...base, facing: facingOf(matePos, t, Math.PI / 2), pose: runPose(matePos, t, t0) };
}

function holderActor(t: number): ChoreoActor {
  const pos = holderPos(t);
  const base = { team: 'away' as const, x: pos.x, z: pos.z, number: 6 };
  if (t >= HERO_ATTACK.goalLine + 0.3) return { ...base, facing: 1.2, procedural: 'facepalm' };
  return { ...base, facing: facingOf(holderPos, t, Math.PI / 2), pose: runPose(holderPos, t, HERO_ATTACK.kickoff) };
}

// --- Frame ------------------------------------------------------------------

export function sampleHeroAttack(time: number): ChoreoFrame {
  const t = Math.min(HERO_ATTACK.length, Math.max(0, time));
  const scored = t >= HERO_ATTACK.goalLine;
  const anticipation = 0.15 + 0.85 * smooth(seg(t, 3.6, HERO_ATTACK.contact));
  const crowd = scored
    ? { mood: 'goal' as const, intensity: 1, moodTime: t - HERO_ATTACK.goalLine, homeSection: 1 as const }
    : t >= 3.6
      ? { mood: 'anticipation' as const, intensity: anticipation, moodTime: t, homeSection: 1 as const }
      : { mood: 'idle' as const, intensity: 0.2, moodTime: t, homeSection: 1 as const };
  const phase = scored
    ? t >= HERO_ATTACK.celebrate ? 'celebration' : 'goal'
    : t >= HERO_ATTACK.contact ? 'shot'
      : t >= HERO_ATTACK.windup ? 'windup'
        : t >= HERO_ATTACK.kickoff ? 'duel' : 'faceoff';
  const striker = strikerActor(t);
  const rival = rivalActor(t);
  const keeper = keeperActor(t);
  return {
    ball: ballPos(t),
    actors: [striker, rival, keeper, mateActor(t), holderActor(t)],
    crowdIntensity: crowd.intensity,
    phase,
    anchors: {
      hero: { x: striker.x, z: striker.z },
      rival: { x: rival.x, z: rival.z },
      keeper: { x: keeper.x, z: keeper.z },
    },
    crowd,
    net: scored ? { side: 1, phaseTime: t - HERO_ATTACK.goalLine } : undefined,
  };
}
