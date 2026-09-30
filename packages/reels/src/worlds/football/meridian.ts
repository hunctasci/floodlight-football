import type { ChoreoActor, ChoreoFrame, ChoreoPose } from './choreography';
import { clamp01, easeOut, gait, lerp, mix2, seg, smooth, speedOf, type V2, type V3 } from './choreo-math';

/**
 * meridian — "HNC: The Current" (anime tribute). One continuous anime match:
 *
 * faceoff → kickoff burst → UNDERTOW slide (rival) → CRESCENT CUT hop-and-arc
 * → long run → first shot → BLACKOUT (keeper rises, the ball dies in his
 * hands and pops straight up) → the ball hangs on a real gravity arc (apex
 * ~9.4 m) while the striker walks under it → FULL CURRENT crouch → leap →
 * MERIDIAN volley in a dead-straight line → fingertip dive → net → stillness
 * → celebration.
 *
 * Anime physics are deliberate and bounded: runs stay under an elite sprint,
 * the leap lifts the root 1.7 m (superhuman — the one exaggeration), the dive
 * stretches past the game's 2.4 m bound. Everything else is plain ballistics.
 * The edit stretches time with slow moment clocks, never by bending this file.
 * Pure functions of moment seconds; nothing here shapes a character.
 */
export const MERIDIAN = {
  length: 13,
  kickoff: 2.5,
  slide: 4.25,
  hopStart: 4.38,
  hopEnd: 4.78,
  windup: 6.15,
  contact: 6.5,
  keeperRise: 6.62,
  parry: 6.92,
  walk: 7.3,
  arrive: 7.8,
  charge: 8.55,
  leap: 8.95,
  volley: 9.34,
  keeperDive: 9.38,
  goalLine: 9.62,
  netHit: 9.7,
  land: 9.8,
  celebrate: 11.2,
} as const;

const R = 0.25;
const G = 9.81;
const STRIKER_START: V2 = { x: -0.7, z: 0 };
const RIVAL_START: V2 = { x: 1.25, z: 0 };
const CONTACT_1: V2 = { x: 30.2, z: 1.6 };
/** Where the striker stands under the falling ball (edge of the box). */
const DROP: V2 = { x: 33.6, z: 1.45 };
const KEEPER_X = 45.2;
/** First shot meets the keeper's raised hands here (BLACKOUT). */
const PARRY: V3 = { x: 45.0, y: 2.0, z: -0.25 };
/** MERIDIAN contact: in front of the striker at the top of the leap. */
const VOLLEY: V3 = { x: DROP.x + 0.6, y: 2.35, z: DROP.z - 0.1 };
// Canonical goal 8.8 m x 2.8 m: far top corner just inside post and bar.
const CORNER: V3 = { x: 46, y: 2.3, z: -3.05 };
const NET: V3 = { x: 47.9, y: 2.1, z: -3.3 };
const MATE_START: V2 = { x: -7.5, z: -6.5 };
const MATE_RUN_END: V2 = { x: 26, z: -6.5 };
const MATE_CELEBRATE: V2 = { x: 34.9, z: 3.5 };
const MATE_GO = 9.8;
const MATE_ARRIVE = 11.6;
const HOLDER_START: V2 = { x: -3.5, z: -3.8 };
const HOLDER_END: V2 = { x: 27.5, z: -3.6 };

// --- helpers -----------------------------------------------------------------

/** Trapezoid velocity profile (see hero-attack): continuous speed, ends at ratio r. */
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

const H = 1 / 120;
function velocity(path: (t: number) => V2, t: number): V2 {
  const a = path(t - H);
  const b = path(t + H);
  return { x: (b.x - a.x) / (2 * H), z: (b.z - a.z) / (2 * H) };
}
function facingOf(path: (t: number) => V2, t: number, fallback: number): number {
  const v = velocity(path, t);
  return Math.hypot(v.x, v.z) < 0.4 ? fallback : Math.atan2(v.x, v.z);
}
function unit(v: V2): V2 {
  const l = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / l, z: v.z / l };
}
function runPose(path: (t: number) => V2, t: number, t0: number, extra: Partial<ChoreoPose> = {}): ChoreoPose {
  const speed = speedOf(path, t);
  return { action: speed > 1 ? 'run' : 'idle', actionTime: 0, speed, clock: gait(path, t0, t), ...extra };
}
/** Head pitch (rad, negative = up) that looks from a head at (p, 1.7) to a point. */
function lookPitch(p: V2, target: V3, headY = 1.7): number {
  const d = Math.hypot(target.x - p.x, target.z - p.z);
  return -Math.min(1.05, Math.max(-0.4, Math.atan2(target.y - headY, Math.max(0.3, d))));
}

// --- striker (TR #9) ---------------------------------------------------------

/** Kickoff → shot: burst, the crescent arc around the slide, then the right channel. */
function strikerRun(t: number): V2 {
  const u = seg(t, MERIDIAN.kickoff, MERIDIAN.contact);
  const k = trapezoid(u, 0.14, 0.22, 0.3);
  // CRESCENT CUT: a wide arc to the camera side (+z) around the slide from -z.
  const crescent = 1.5 * Math.sin(Math.PI * seg(t, 3.9, 5.2));
  const channel = CONTACT_1.z * smooth((u - 0.6) / 0.4);
  return { x: lerp(STRIKER_START.x, CONTACT_1.x, k), z: crescent + channel };
}

const FOLLOW: V2 = { x: CONTACT_1.x + 0.9, z: CONTACT_1.z + 0.25 };
const LANDING: V2 = { x: DROP.x + 0.35, z: DROP.z };

function strikerPos(t: number): V2 {
  if (t <= MERIDIAN.kickoff) return STRIKER_START;
  if (t <= MERIDIAN.contact) return strikerRun(t);
  if (t <= MERIDIAN.contact + 0.35) return mix2(CONTACT_1, FOLLOW, easeOut(seg(t, MERIDIAN.contact, MERIDIAN.contact + 0.35)));
  if (t <= MERIDIAN.walk) return FOLLOW;
  if (t <= MERIDIAN.arrive) return mix2(FOLLOW, DROP, trapezoid(seg(t, MERIDIAN.walk, MERIDIAN.arrive), 0.3, 0.4, 0));
  if (t <= MERIDIAN.leap) return DROP;
  if (t <= MERIDIAN.land) return mix2(DROP, LANDING, smooth(seg(t, MERIDIAN.leap, MERIDIAN.land)));
  return LANDING;
}

/** Root lift (m) of the MERIDIAN leap; apex just after the volley. */
function leapLift(t: number): number {
  if (t <= MERIDIAN.leap || t >= MERIDIAN.land) return 0;
  return 1.7 * Math.sin(Math.PI * seg(t, MERIDIAN.leap, MERIDIAN.land));
}

// --- ball --------------------------------------------------------------------

const FIRST_TOUCH = (() => {
  let lo: number = MERIDIAN.kickoff;
  let hi = MERIDIAN.kickoff + 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (strikerRun(mid).x < -0.35) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** [time, peak lead (m)]: the 4.15 poke sends the ball round the slide, over the arc. */
const TOUCHES: readonly (readonly [number, number])[] = [
  [FIRST_TOUCH, 1.6],
  [3.12, 1.7],
  [3.6, 1.7],
  [4.15, 2.3],
  [4.95, 1.8],
  [5.45, 1.6],
  [5.95, 1.25],
];
export const MERIDIAN_TOUCHES: readonly number[] = TOUCHES.map(([at]) => at);

function dribbleLead(t: number): number {
  for (let i = TOUCHES.length - 1; i >= 0; i--) {
    const [at, peak] = TOUCHES[i];
    if (t < at) continue;
    const next = i + 1 < TOUCHES.length ? TOUCHES[i + 1][0] : MERIDIAN.contact;
    const p = seg(t, at, next);
    if (i === TOUCHES.length - 1) return 0.35 + peak * Math.sin(Math.PI * p) * (1 - 0.3 * p) + 0.1 * p;
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

const SPOT_1 = dribbleBall(MERIDIAN.contact);
/** Parry → volley on a true gravity arc (vertical launch speed solved from the endpoints). */
const HANG = MERIDIAN.volley - MERIDIAN.parry;
const VY0 = (VOLLEY.y - PARRY.y + 0.5 * G * HANG * HANG) / HANG;

export function meridianBall(t: number): V3 {
  if (t < FIRST_TOUCH) return { x: 0, y: R, z: 0 };
  if (t < MERIDIAN.contact) {
    const b = mix2({ x: 0, z: 0 }, dribbleBall(t), smooth(seg(t, FIRST_TOUCH, FIRST_TOUCH + 0.15)));
    return { x: b.x, y: R, z: b.z };
  }
  if (t < MERIDIAN.parry) {
    const k = seg(t, MERIDIAN.contact, MERIDIAN.parry);
    // Rising drive that bends back in toward the keeper (outswing on +z).
    return { x: lerp(SPOT_1.x, PARRY.x, k), y: lerp(R, PARRY.y, k) + 0.9 * Math.sin(Math.PI * k), z: lerp(SPOT_1.z, PARRY.z, k) + 1.1 * Math.sin(Math.PI * k) };
  }
  if (t < MERIDIAN.volley) {
    const dt = t - MERIDIAN.parry;
    const k = dt / HANG;
    return { x: lerp(PARRY.x, VOLLEY.x, k), y: PARRY.y + VY0 * dt - 0.5 * G * dt * dt, z: lerp(PARRY.z, VOLLEY.z, k) };
  }
  if (t < MERIDIAN.goalLine) {
    // MERIDIAN: one straight line from the boot to the corner.
    const k = seg(t, MERIDIAN.volley, MERIDIAN.goalLine);
    return { x: lerp(VOLLEY.x, CORNER.x, k), y: lerp(VOLLEY.y, CORNER.y, k), z: lerp(VOLLEY.z, CORNER.z, k) };
  }
  if (t < MERIDIAN.netHit) {
    const k = seg(t, MERIDIAN.goalLine, MERIDIAN.netHit);
    return { x: lerp(CORNER.x, NET.x, k), y: lerp(CORNER.y, NET.y, k), z: lerp(CORNER.z, NET.z, k) };
  }
  const dt = t - MERIDIAN.netHit;
  const y = dt < 0.42 ? R + (NET.y - R) * (1 - (dt / 0.42) ** 2) : R + 0.28 * Math.abs(Math.sin(Math.PI * clamp01((dt - 0.42) / 0.3))) * (dt - 0.42 < 0.3 ? 1 : 0);
  return { x: lerp(NET.x, 47.5, easeOut(dt / 0.8)), y, z: NET.z };
}

/** Dead ball after the BLACKOUT: a slow tumble instead of the rolling rule. */
function ballSpin(t: number): V3 | undefined {
  if (t < MERIDIAN.parry || t >= MERIDIAN.volley) return undefined;
  const dt = t - MERIDIAN.parry;
  return { x: 0.9 * dt, y: 0.35 * dt, z: 0.2 * dt };
}

// --- rival (GR #4): UNDERTOW -----------------------------------------------------

const HOP_APEX = (MERIDIAN.hopStart + MERIDIAN.hopEnd) / 2;
/** The slide aims just ahead of the striker's feet at the hop apex. */
const SLIDE_AIM = (() => {
  const s = strikerRun(HOP_APEX);
  const d = unit(velocity(strikerRun, HOP_APEX));
  return { x: s.x + d.x * 0.3, z: s.z + d.z * 0.3 };
})();
/** Goal-side and to the far side (-z): he gets ahead of the burst, then slides across. */
const SLIDE_START: V2 = { x: SLIDE_AIM.x + 0.9, z: SLIDE_AIM.z - 3.1 };
const SLIDE_DUR = 0.5;
const SLIDE_DIR = unit({ x: SLIDE_AIM.x - SLIDE_START.x, z: SLIDE_AIM.z - SLIDE_START.z });
// The eased slide reaches the aim exactly at the hop apex.
/** Quadratic ease-out: a slide decelerates, but a cubic would open with a 3x lunge. */
const slideEase = (k: number): number => 1 - (1 - clamp01(k)) ** 2;
const SLIDE_LEN = Math.hypot(SLIDE_AIM.x - SLIDE_START.x, SLIDE_AIM.z - SLIDE_START.z) / slideEase((HOP_APEX - MERIDIAN.slide) / SLIDE_DUR);
const SLIDE_END: V2 = { x: SLIDE_START.x + SLIDE_DIR.x * SLIDE_LEN, z: SLIDE_START.z + SLIDE_DIR.z * SLIDE_LEN };
/** Left in the grass while the striker runs away from him, then back to a post on the far side. */
const RIVAL_GETUP = 5.8;
const RIVAL_BACK = 7.2;
const RIVAL_POST: V2 = { x: 27.5, z: -2.6 };

function rivalPos(t: number): V2 {
  if (t <= MERIDIAN.kickoff + 0.1) return RIVAL_START;
  if (t < MERIDIAN.slide) return mix2(RIVAL_START, SLIDE_START, trapezoid(seg(t, MERIDIAN.kickoff + 0.1, MERIDIAN.slide), 0.3, 0.12, 0.7));
  if (t < MERIDIAN.slide + SLIDE_DUR) {
    const k = slideEase(seg(t, MERIDIAN.slide, MERIDIAN.slide + SLIDE_DUR));
    return { x: SLIDE_START.x + SLIDE_DIR.x * SLIDE_LEN * k, z: SLIDE_START.z + SLIDE_DIR.z * SLIDE_LEN * k };
  }
  if (t < RIVAL_GETUP) return SLIDE_END;
  return mix2(SLIDE_END, RIVAL_POST, trapezoid(seg(t, RIVAL_GETUP, RIVAL_BACK), 0.3, 0.35, 0));
}

function rivalActor(t: number, ball: V3): ChoreoActor {
  const pos = rivalPos(t);
  const base = { team: 'away' as const, x: pos.x, z: pos.z, number: 4 };
  if (t < MERIDIAN.kickoff + 0.1) {
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: smooth(seg(t, 2.1, 2.45)) } };
  }
  if (t >= MERIDIAN.slide && t < RIVAL_GETUP) {
    const slideFacing = Math.atan2(SLIDE_DIR.x, SLIDE_DIR.z);
    // Slide, then lie where it ended (the game's fallen pose) until he gets up.
    return t < MERIDIAN.slide + SLIDE_DUR + 0.25
      ? { ...base, facing: slideFacing, pose: { action: 'slide', actionTime: t - MERIDIAN.slide, speed: 0, clock: t } }
      : { ...base, facing: slideFacing, pose: { action: 'fallen', actionTime: t - MERIDIAN.slide - SLIDE_DUR, speed: 0, clock: t } };
  }
  if (t >= RIVAL_BACK) {
    // Watches the ball; drops his head once it is in.
    const toBall = Math.atan2(ball.x - pos.x, ball.z - pos.z);
    const beaten = smooth(seg(t, MERIDIAN.netHit + 0.2, MERIDIAN.netHit + 0.8));
    return { ...base, facing: toBall * (1 - beaten) + (toBall + 0.4) * beaten, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, headPitch: lookPitch(pos, ball) * (1 - beaten) + 0.42 * beaten } };
  }
  const t0 = t < MERIDIAN.slide ? MERIDIAN.kickoff : RIVAL_GETUP;
  return { ...base, facing: facingOf(rivalPos, t, Math.PI / 2), pose: runPose(rivalPos, t, t0) };
}

// --- keeper (GR #1): BLACKOUT, then the dive --------------------------------------

const DIVE_DZ = -2.9; // anime: past the game's 2.4 m bound, still a fingertip short

function keeperPos(t: number): V2 {
  const track = (tt: number): number => Math.max(-1.0, Math.min(1.0, 0.3 * meridianBall(Math.min(tt, MERIDIAN.contact)).z));
  if (t < MERIDIAN.keeperRise) return { x: KEEPER_X, z: track(t) };
  const z0 = track(MERIDIAN.keeperRise);
  if (t < MERIDIAN.keeperDive) {
    // Steps up into the shot, lands back on his line.
    const out = Math.sin(Math.PI * seg(t, MERIDIAN.keeperRise, MERIDIAN.parry + 0.35));
    return { x: KEEPER_X - 0.3 * out, z: lerp(z0, PARRY.z, smooth(seg(t, MERIDIAN.keeperRise, MERIDIAN.parry))) };
  }
  return { x: KEEPER_X, z: PARRY.z + DIVE_DZ * smooth(seg(t, MERIDIAN.keeperDive, MERIDIAN.keeperDive + 0.26)) };
}

function keeperActor(t: number, ball: V3): ChoreoActor {
  const pos = keeperPos(t);
  const base = { team: 'keeper-away' as const, x: pos.x, z: pos.z, number: 1 };
  if (t < MERIDIAN.keeperRise) {
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: smooth(seg(t, MERIDIAN.windup - 0.1, MERIDIAN.contact)) } };
  }
  if (t < MERIDIAN.parry + 0.35) {
    // BLACKOUT: rises with both arms overhead; the ball dies in his hands.
    const k = seg(t, MERIDIAN.keeperRise, MERIDIAN.parry + 0.35);
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, reach: smooth(k * 2.2), lift: 0.45 * Math.sin(Math.PI * k), headPitch: -0.35 } };
  }
  if (t < MERIDIAN.keeperDive) {
    return { ...base, facing: -Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: 0.6 * smooth(seg(t, MERIDIAN.leap, MERIDIAN.volley)), headPitch: lookPitch(pos, ball) } };
  }
  const k = seg(t, MERIDIAN.keeperDive, MERIDIAN.keeperDive + 0.26);
  return {
    ...base,
    facing: Math.PI,
    pose: { action: 'dive', actionTime: t - MERIDIAN.keeperDive, speed: 0, clock: t, reach: Math.min(1, k * 2.5), grounded: smooth(seg(t, MERIDIAN.keeperDive + 0.28, MERIDIAN.keeperDive + 0.6)) },
  };
}

// --- striker actor -----------------------------------------------------------------

function strikerActor(t: number, ball: V3): ChoreoActor {
  const pos = strikerPos(t);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 9 };
  if (t < MERIDIAN.kickoff) {
    return { ...base, facing: Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: smooth(seg(t, 2.1, 2.45)) } };
  }
  if (t < MERIDIAN.contact) {
    const touch = TOUCHES.find(([at]) => t >= at && t < at + 0.12);
    const hop = seg(t, MERIDIAN.hopStart, MERIDIAN.hopEnd);
    const windup = smooth(seg(t, MERIDIAN.windup, MERIDIAN.contact - 0.04));
    const pose = runPose(strikerPos, t, MERIDIAN.kickoff, { hop: hop > 0 && hop < 1 ? hop : undefined, windup: windup > 0 ? windup : undefined });
    if (touch && (hop <= 0 || hop >= 1)) Object.assign(pose, { action: 'kick', actionTime: t - touch[0] });
    return { ...base, facing: facingOf(strikerPos, t, Math.PI / 2), pose };
  }
  const shotFacing = facingOf(strikerRun, MERIDIAN.contact - 0.02, Math.PI / 2);
  if (t < MERIDIAN.contact + 0.3) {
    return { ...base, facing: shotFacing, pose: { action: 'kick', actionTime: t - MERIDIAN.contact, speed: 0, clock: t, windup: 1 } };
  }
  if (t < MERIDIAN.walk) {
    // Frozen on the follow-through spot, eyes on the dead ball.
    return { ...base, facing: shotFacing, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, headPitch: lookPitch(pos, ball) } };
  }
  if (t < MERIDIAN.arrive) {
    return { ...base, facing: facingOf(strikerPos, t, Math.PI / 2), pose: runPose(strikerPos, t, MERIDIAN.walk, { headPitch: 0.6 * lookPitch(pos, ball) }) };
  }
  if (t < MERIDIAN.leap) {
    // FULL CURRENT: power stance under the ball, arms low and out, the dip before the leap.
    const charge = smooth(seg(t, MERIDIAN.arrive, MERIDIAN.charge));
    return {
      ...base,
      facing: Math.PI / 2,
      pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, airplane: 0.28 * charge, crouch: smooth(seg(t, MERIDIAN.charge, MERIDIAN.leap)), headPitch: lookPitch(pos, ball) },
    };
  }
  if (t < MERIDIAN.land) {
    const lift = leapLift(t);
    const air = { lift, lean: -0.45 * Math.sin(Math.PI * seg(t, MERIDIAN.leap, MERIDIAN.land)), roll: 0.25 * Math.sin(Math.PI * seg(t, MERIDIAN.leap, MERIDIAN.land)) };
    if (t >= MERIDIAN.volley && t < MERIDIAN.volley + 0.3) {
      return { ...base, facing: Math.PI / 2, pose: { action: 'kick', actionTime: t - MERIDIAN.volley, speed: 0, clock: t, windup: 1, ...air } };
    }
    const windup = smooth(seg(t, MERIDIAN.volley - 0.22, MERIDIAN.volley - 0.02));
    return { ...base, facing: Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, windup: t < MERIDIAN.volley && windup > 0 ? windup : undefined, headPitch: -0.25, ...air } };
  }
  if (t >= MERIDIAN.celebrate) {
    // #9's game celebration is the arms-up jump; phase-shift so it starts grounded.
    const shift = (4 * Math.PI - 9 * 1.3) / 7;
    return { ...base, facing: -0.35, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t - MERIDIAN.celebrate + shift, celebrating: true } };
  }
  // Landed: absorbs, then looks up at the lights (the legend beat).
  const absorb = 0.7 * (1 - smooth(seg(t, MERIDIAN.land, MERIDIAN.land + 0.45)));
  return { ...base, facing: Math.PI / 2, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, crouch: absorb, headPitch: -0.5 * smooth(seg(t, 10.0, 10.6)) } };
}

// --- background players -------------------------------------------------------------

function matePos(t: number): V2 {
  if (t <= MERIDIAN.kickoff) return MATE_START;
  if (t <= MERIDIAN.contact) return mix2(MATE_START, MATE_RUN_END, trapezoid(seg(t, MERIDIAN.kickoff, MERIDIAN.contact), 0.25, 0.3, 0));
  if (t <= MATE_GO) return MATE_RUN_END;
  return mix2(MATE_RUN_END, MATE_CELEBRATE, trapezoid(seg(t, MATE_GO, MATE_ARRIVE), 0.3, 0.35, 0));
}

function mateActor(t: number, ball: V3): ChoreoActor {
  const pos = matePos(t);
  const base = { team: 'home' as const, x: pos.x, z: pos.z, number: 10 };
  if (t >= MATE_ARRIVE) return { ...base, facing: -0.9, pose: { action: 'idle', actionTime: 0, speed: 0, clock: t - MATE_ARRIVE, celebrating: true } };
  if (t > MERIDIAN.contact && t <= MATE_GO) return { ...base, facing: Math.atan2(ball.x - pos.x, ball.z - pos.z), pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, headPitch: lookPitch(pos, ball) } };
  const t0 = t > MERIDIAN.contact ? MATE_GO : MERIDIAN.kickoff;
  return { ...base, facing: facingOf(matePos, t, Math.PI / 2), pose: runPose(matePos, t, t0) };
}

function holderPos(t: number): V2 {
  if (t <= MERIDIAN.kickoff) return HOLDER_START;
  return mix2(HOLDER_START, HOLDER_END, trapezoid(seg(t, MERIDIAN.kickoff + 0.2, MERIDIAN.contact + 0.3), 0.25, 0.3, 0));
}

function holderActor(t: number, ball: V3): ChoreoActor {
  const pos = holderPos(t);
  const base = { team: 'away' as const, x: pos.x, z: pos.z, number: 6 };
  if (t >= MERIDIAN.goalLine + 0.3) return { ...base, facing: 1.2, procedural: 'facepalm' };
  if (t > MERIDIAN.contact + 0.3) return { ...base, facing: Math.atan2(ball.x - pos.x, ball.z - pos.z), pose: { action: 'idle', actionTime: 0, speed: 0, clock: t, headPitch: lookPitch(pos, ball) } };
  return { ...base, facing: facingOf(holderPos, t, Math.PI / 2), pose: runPose(holderPos, t, MERIDIAN.kickoff) };
}

// --- frame -------------------------------------------------------------------------

export function sampleMeridian(time: number): ChoreoFrame {
  const t = Math.min(MERIDIAN.length, Math.max(0, time));
  const ball = meridianBall(t);
  const scored = t >= MERIDIAN.goalLine;
  const crowd = scored
    ? { mood: 'goal' as const, intensity: 1, moodTime: t - MERIDIAN.goalLine, homeSection: 1 as const }
    : t >= MERIDIAN.parry && t < MERIDIAN.arrive
      ? { mood: 'disbelief' as const, intensity: 0.7, moodTime: t - MERIDIAN.parry, homeSection: 1 as const }
      : t >= 3.4
        ? { mood: 'anticipation' as const, intensity: t >= MERIDIAN.arrive ? 1 : 0.2 + 0.8 * smooth(seg(t, 3.4, MERIDIAN.contact)), moodTime: t, homeSection: 1 as const }
        : { mood: 'idle' as const, intensity: 0.3, moodTime: t, homeSection: 1 as const };
  const phase = scored
    ? t >= MERIDIAN.celebrate ? 'celebration' : 'goal'
    : t >= MERIDIAN.volley ? 'meridian'
      : t >= MERIDIAN.leap ? 'leap'
        : t >= MERIDIAN.arrive ? 'charge'
          : t >= MERIDIAN.parry ? 'blackout'
            : t >= MERIDIAN.contact ? 'shot'
              : t >= MERIDIAN.kickoff ? 'duel' : 'faceoff';
  const striker = strikerActor(t, ball);
  const rival = rivalActor(t, ball);
  const keeper = keeperActor(t, ball);
  return {
    ball,
    ballSpin: ballSpin(t),
    actors: [striker, rival, keeper, mateActor(t, ball), holderActor(t, ball)],
    crowdIntensity: crowd.intensity,
    phase,
    anchors: { hero: { x: striker.x, z: striker.z }, rival: { x: rival.x, z: rival.z }, keeper: { x: keeper.x, z: keeper.z }, heroLift: striker.pose?.lift ?? 0 },
    crowd,
    net: scored ? { side: 1, phaseTime: t - MERIDIAN.goalLine } : undefined,
  };
}

/** Striker root lift at a moment (lenses that follow the leap). */
export function meridianLift(t: number): number {
  return leapLift(t);
}
