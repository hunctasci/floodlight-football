import { FIELD, type MatchState, type Player, type Team, type TeamId } from '../../../../apps/game/src/types';
import type { SocialActorPose, SocialEffects } from '../../../../apps/game/src/renderer';
import type { SocialCrowdState } from '../../../../apps/game/src/render/crowd';
import { goalCineShot, goalCineVariant } from '../../../../apps/game/src/render/camera';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { AttackStyle, ResolvedVideoSpec } from '../schema';
import type { SocialLens } from '../cameras/social-camera';
import { lerp, segmentProgress } from '../timeline/math';
import { evaluateTrack, facingBetween, groundPass, shotArc, type ActorKeyframe, type Vec2, type Vec3 } from '../timeline/tracks';
import { seededRandom } from './faceoff';

/**
 * First scripted football action scene: ATTACK → PASS → FINAL BALL → SHOT →
 * KEEPER DIVE → GOAL → CELEBRATION. Deterministic semantic choreography over
 * real HNC visual entities — NOT a MatchEngine replay. Every transform is a
 * pure function of (spec, seed, time); random-access safe.
 */

export const GOAL_X = FIELD.halfLength; // 46: the attacked goal line.

/** Beat boundaries in seconds (6s default cut). */
export const ATTACK_GOAL_BEATS = {
  pass1Start: 0.7,
  pass1End: 1.5,
  carryEnd: 2.1,
  pass2End: 2.6,
  settleEnd: 2.9,
  shotStart: 3.15,
  shotEnd: 3.65,
  diveStart: 3.25,
  diveEnd: 3.8,
  netSettleEnd: 3.95,
  cineEnd: 4.7,
  celebStart: 4.7,
} as const;

/** One staged hero/background actor at a timeline instant. */
export interface AttackGoalActorFrame {
  id: number;
  team: TeamId;
  number: number;
  name: string;
  keeper: boolean;
  x: number;
  z: number;
  facingX: number;
  facingZ: number;
  bob: number;
  lean: number;
  armLift: number;
  legSwing: number;
  armSpread: number;
  roll: number;
  spin: number;
}

export interface AttackGoalEffects {
  trailFrom: Vec3 | null;
  trailIntensity: number;
  fovPunch: number;
  shakeX: number;
  shakeY: number;
}

/** Complete deterministic description of one attack-goal frame. */
export interface AttackGoalFrameDescription {
  scene: 'attack-goal';
  frame: number;
  time: number;
  actors: AttackGoalActorFrame[];
  ball: Vec3;
  camera: SocialLens;
  clock: number;
  effects: AttackGoalEffects;
  /** Supporter choreography for this instant (WHEN/WHY owned by the scene). */
  crowd: SocialCrowdState;
}

/** Final renderer input derived from a frame description (no timeline left). */
export interface AttackGoalRenderInput {
  state: MatchState;
  camera: SocialLens;
  clock: number;
  pose: SocialActorPose[];
  effects: SocialEffects;
  crowd: SocialCrowdState;
}

/** Plain staging parameters for the attack-goal timeline (no THREE objects). */
export interface AttackGoalTimelineData {
  attackSign: 1 | -1;
  style: AttackStyle;
  /** 0 arms-up jump, 1 spin, 2 knee-slide (seed % 3). */
  celebration: 0 | 1 | 2;
  cameraLateral: number;
  cineVariant: 0 | 1 | 2;
  mid: Vec2;
  /** Winger's body mark at the catch. */
  recvMark: Vec2;
  /** First-pass catch point (= carry start, so the catch never teleports). */
  recv: Vec2;
  carry: Vec2;
  shooterStart: Vec2;
  shootSpot: Vec2;
  settleSpot: Vec2;
  shotStart: Vec3;
  shotTarget: Vec3;
  carrierDir: Vec2;
  keeperHome: Vec2;
  diveSpot: Vec2;
  defSpots: [Vec2, Vec2, Vec2];
  bgSpots: { x: number; z: number; attack: boolean }[];
  breathPhases: number[];
}

interface StyleSpots {
  mid: Vec2;
  recv: Vec2;
  carry: Vec2;
  shooterStart: Vec2;
  shootSpot: Vec2;
}

function styleSpots(style: AttackStyle, s: 1 | -1, j: number): StyleSpots {
  if (style === 'wing') {
    return {
      mid: { x: 14, z: 12 * s },
      recv: { x: 24, z: 13 * s },
      carry: { x: 30, z: 12 * s },
      shooterStart: { x: 22, z: 1 * s },
      shootSpot: { x: 31, z: 5 * s },
    };
  }
  if (style === 'counter') {
    return {
      mid: { x: -10, z: j },
      recv: { x: 2, z: j + 3 * s },
      carry: { x: 10, z: j + 2 * s },
      shooterStart: { x: 13, z: j - 6 * s },
      shootSpot: { x: 22, z: j - s },
    };
  }
  return {
    mid: { x: 8, z: j },
    recv: { x: 18, z: j + 4 * s },
    carry: { x: 25, z: j + 2 * s },
    shooterStart: { x: 21, z: j - 6 * s },
    shootSpot: { x: 30, z: j - s },
  };
}

/**
 * Compile seed-derived staging. All coordinates live in attack-+x space;
 * evaluation mirrors to −x when the away side attacks.
 */
export function compileAttackGoalTimeline(spec: Pick<ResolvedVideoSpec, 'seed' | 'attackTeam' | 'attackStyle'>): AttackGoalTimelineData {
  const rand = seededRandom(spec.seed);
  const s = (rand() < 0.5 ? -1 : 1) as 1 | -1;
  const j = (rand() - 0.5) * 4;
  const targetZMag = 2.9 + rand() * 0.9;
  const shotH = 0.5 + rand() * 1.0;
  const keeperJitter = (rand() - 0.5) * 2;
  const celebration = (spec.seed % 3) as 0 | 1 | 2;
  const cameraLateral = (rand() - 0.5) * 0.7;
  const breathPhases = [rand(), rand(), rand(), rand()].map((r) => r * Math.PI * 2);
  const defJitter = [rand(), rand(), rand()].map((r) => (r - 0.5) * 2);

  const spots = styleSpots(spec.attackStyle, s, j);
  const dx = spots.carry.x - spots.recv.x, dz = spots.carry.z - spots.recv.z;
  const dl = Math.hypot(dx, dz) || 1;
  const carrierDir = { x: dx / dl, z: dz / dl };
  // The receiver meets the first pass slightly ahead of his mark so the
  // catch point and the carry start coincide exactly (no teleport).
  const recv = { x: spots.recv.x + carrierDir.x * 0.7, z: spots.recv.z + carrierDir.z * 0.7 };
  const recvMark = { ...spots.recv };
  const settleSpot = { x: spots.shootSpot.x + 0.6, z: spots.shootSpot.z };
  const shotStart: Vec3 = { x: settleSpot.x, y: 0.25, z: settleSpot.z };
  // Far corner away from the keeper's starting side, safely inside the
  // posts (|z| ≤ 3.8 < 4.4) and below the bar.
  const shotTarget: Vec3 = { x: GOAL_X + 1.2, y: shotH, z: -s * targetZMag };
  const keeperHome = { x: GOAL_X - 2.7, z: 1.5 * s + keeperJitter };
  // Dives the right way but short: same direction, ~40% of the way there.
  const diveSpot = { x: GOAL_X - 2.1, z: shotTarget.z * 0.4 };

  const defSpots: [Vec2, Vec2, Vec2] = [
    { x: spots.shootSpot.x + 4.5, z: spots.shootSpot.z + 1.5 + defJitter[0] },
    { x: spots.shootSpot.x + 3, z: spots.shootSpot.z - 4.5 + defJitter[1] },
    { x: spots.shootSpot.x + 7, z: spots.shootSpot.z + 6 + defJitter[2] },
  ];
  const bgSpots = [
    { x: -22, z: -10 * s, attack: true },
    { x: -6, z: -9 * s, attack: true },
    { x: 20, z: 12 * s, attack: false },
    { x: 6, z: -14 * s, attack: false },
    { x: -2, z: 8 * s, attack: false },
    { x: 38, z: -9 * s, attack: false },
  ];
  const cineVariant = goalCineVariant(1, shotTarget.x, shotTarget.z);
  return {
    attackSign: spec.attackTeam === 'home' ? 1 : -1,
    style: spec.attackStyle,
    celebration,
    cameraLateral,
    cineVariant,
    mid: spots.mid,
    recvMark,
    recv,
    carry: spots.carry,
    shooterStart: spots.shooterStart,
    shootSpot: spots.shootSpot,
    settleSpot,
    shotStart,
    shotTarget,
    carrierDir,
    keeperHome,
    diveSpot,
    defSpots,
    bgSpots,
    breathPhases,
  };
}

// ---------------------------------------------------------------------------
// Evaluation (pure functions of staging + time).
// ---------------------------------------------------------------------------

const B = ATTACK_GOAL_BEATS;

/** Stride oscillation for running actors (chunky retro run cycle). */
function stride(time: number, phase: number): number {
  return Math.sin((time / 0.45) * Math.PI * 2 + phase) * 0.55;
}

/** Smooth on/off window: 1 inside [on, off], eased edges. */
function moveWindow(time: number, on: number, off: number, edge = 0.2): number {
  if (time <= on || time >= off) return 0;
  const rise = Math.min(1, (time - on) / edge);
  const fall = Math.min(1, (off - time) / edge);
  return Math.min(rise, fall);
}

interface EvalCtx {
  data: AttackGoalTimelineData;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
  time: number;
}

function midKeys(d: AttackGoalTimelineData): ActorKeyframe[] {
  // Holds upfield after the buildup; celebrates in place with arms up.
  return [
    { time: 0, x: d.mid.x, z: d.mid.z },
    { time: B.pass1Start, x: d.mid.x, z: d.mid.z },
    { time: B.pass1End, x: d.mid.x + 3, z: d.mid.z + 1 },
    { time: B.pass2End, x: d.mid.x + 6, z: d.mid.z },
    { time: 99, x: d.mid.x + 6, z: d.mid.z },
  ];
}

function wingKeys(d: AttackGoalTimelineData): ActorKeyframe[] {
  const start = { x: d.recv.x - (d.carry.x - d.recv.x) * 0.4, z: d.recv.z - (d.carry.z - d.recv.z) * 0.4 };
  // Meets the pass at his body mark; the ball arrives 0.7m ahead at his feet.
  // Celebrates in place afterwards so he never blocks the celebration camera.
  const hold = { x: d.carry.x + 1, z: d.carry.z };
  return [
    { time: 0, x: start.x, z: start.z },
    { time: B.pass1Start, x: start.x, z: start.z },
    { time: B.pass1End, x: d.recvMark.x, z: d.recvMark.z },
    { time: B.carryEnd, x: d.carry.x, z: d.carry.z },
    { time: B.pass2End, x: hold.x, z: hold.z },
    { time: 99, x: hold.x, z: hold.z },
  ];
}

function shooterKeys(d: AttackGoalTimelineData): ActorKeyframe[] {
  const keys: ActorKeyframe[] = [
    { time: 0, x: d.shooterStart.x, z: d.shooterStart.z },
    { time: B.pass1End, x: d.shooterStart.x + 3, z: d.shooterStart.z + 1 },
    { time: B.pass2End, x: d.shootSpot.x, z: d.shootSpot.z },
    { time: B.shotEnd, x: d.shootSpot.x, z: d.shootSpot.z },
    { time: B.cineEnd, x: d.shootSpot.x + 1.2, z: d.shootSpot.z },
  ];
  if (d.celebration === 2) {
    keys.push({ time: 5.4, x: d.shootSpot.x + 2.8, z: d.shootSpot.z });
    keys.push({ time: 99, x: d.shootSpot.x + 2.8, z: d.shootSpot.z });
  } else {
    keys.push({ time: 99, x: d.shootSpot.x + 1.2, z: d.shootSpot.z });
  }
  return keys;
}

function defKeys(d: AttackGoalTimelineData, i: 0 | 1 | 2, from: Vec2): ActorKeyframe[] {
  const to = d.defSpots[i];
  return [
    { time: 0, x: from.x, z: from.z },
    { time: B.pass1End, x: lerp(from.x, to.x, 0.4), z: lerp(from.z, to.z, 0.4) },
    { time: B.pass2End, x: to.x, z: to.z },
    { time: 99, x: to.x, z: to.z },
  ];
}

function keeperKeys(d: AttackGoalTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: B.diveStart, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: B.diveEnd, x: d.diveSpot.x, z: d.diveSpot.z },
    { time: 99, x: d.diveSpot.x, z: d.diveSpot.z },
  ];
}

/** Ball glued ahead of the carrier during the dribble. */
function carryBallAt(data: AttackGoalTimelineData, t: number): Vec3 {
  const w = evaluateTrack(wingKeys(data), Math.min(t, B.carryEnd));
  return { x: w.x + data.carrierDir.x * 0.7, y: 0.25, z: w.z + data.carrierDir.z * 0.7 };
}

function evaluateBall(ctx: EvalCtx): Vec3 {
  const { data: d, time: t } = ctx;
  const midFeet = (tt: number): Vec3 => {
    const m = evaluateTrack(midKeys(d), tt);
    return { x: m.x + 0.7, y: 0.25, z: m.z };
  };
  if (t < B.pass1Start) return midFeet(t);
  if (t < B.pass1End) {
    return groundPass(midFeet(B.pass1Start), { ...d.recv, y: 0.25 }, (t - B.pass1Start) / (B.pass1End - B.pass1Start));
  }
  if (t < B.carryEnd) {
    const w = evaluateTrack(wingKeys(d), t);
    return { x: w.x + d.carrierDir.x * 0.7, y: 0.25, z: w.z + d.carrierDir.z * 0.7 };
  }
  if (t < B.pass2End) {
    return groundPass(carryBallAt(d, B.carryEnd), { ...d.shootSpot, y: 0.25 }, (t - B.carryEnd) / (B.pass2End - B.carryEnd));
  }
  if (t < B.settleEnd) {
    const p = (t - B.pass2End) / (B.settleEnd - B.pass2End);
    return { x: lerp(d.shootSpot.x, d.settleSpot.x, p), y: 0.25, z: lerp(d.shootSpot.z, d.settleSpot.z, p) };
  }
  if (t < B.shotStart) return { ...d.settleSpot, y: 0.25 };
  if (t < B.shotEnd) {
    return shotArc(d.shotStart, d.shotTarget, (t - B.shotStart) / (B.shotEnd - B.shotStart), 1.0);
  }
  if (t < B.netSettleEnd) {
    const p = (t - B.shotEnd) / (B.netSettleEnd - B.shotEnd);
    return { x: d.shotTarget.x, y: lerp(d.shotTarget.y, 0.25, p * p), z: d.shotTarget.z };
  }
  return { x: d.shotTarget.x, y: 0.25, z: d.shotTarget.z };
}

function baseActor(
  id: number, team: TeamId, number: number, name: string, keeper: boolean,
  pos: Vec2, focus: Vec2, phase: number, time: number,
): AttackGoalActorFrame {
  const f = facingBetween(pos, focus);
  return {
    id, team, number, name, keeper,
    x: pos.x, z: pos.z, facingX: f.facingX, facingZ: f.facingZ,
    bob: Math.sin((time / 1.7) * Math.PI * 2 + phase) * 0.02,
    lean: 0, armLift: 0, legSwing: 0, armSpread: 0, roll: 0, spin: 0,
  };
}

function evaluateKeeper(ctx: EvalCtx, defendIdx: TeamId, ball: Vec3): AttackGoalActorFrame {
  const { data: d, time: t } = ctx;
  const pos = evaluateTrack(keeperKeys(d), t);
  const setP = segmentProgress(t, B.pass2End, B.diveStart) * (1 - segmentProgress(t, B.diveStart, B.diveStart + 0.15));
  const diveP = segmentProgress(t, B.diveStart, B.diveEnd);
  // After the goal the keeper lands and stays down, beaten — never frozen
  // mid-air through the celebration.
  const landP = segmentProgress(t, B.shotEnd + 0.35, B.cineEnd - 0.1);
  const airP = diveP * (1 - landP);
  const diveDirZ = Math.sign(d.diveSpot.z - d.keeperHome.z) || 1;
  return {
    ...baseActor(6, defendIdx, 1, 'Keeper', true, pos, ball, d.breathPhases[0] + 2, t),
    // Crouch to set, then launch: body tips toward the dive side (world
    // frame), arms spread wide, briefly airborne, then grounded.
    bob: -0.1 * setP + 0.3 * airP + 0.05 * landP,
    lean: -diveDirZ * (0.9 * airP + 0.4 * landP),
    armSpread: 0.3 * setP + 1.4 * airP + 0.3 * landP,
  };
}

function applyCelebration(
  actor: AttackGoalActorFrame, variant: 0 | 1 | 2, time: number,
): AttackGoalActorFrame {
  const jt = time - B.celebStart;
  if (jt < 0) return actor;
  const cp = segmentProgress(time, B.celebStart, B.celebStart + 0.3);
  if (variant === 0) {
    // Arms-up jump, spread into a V so it reads from frontal cameras too
    // (pure forward lift foreshortens into the torso silhouette head-on).
    return { ...actor, armLift: 2.0 * cp, armSpread: 0.9 * cp, bob: Math.abs(Math.sin(jt * 7)) * 0.5 * cp };
  }
  if (variant === 1) {
    // Full spin with arms spread wide, then hold.
    return { ...actor, spin: Math.PI * 2 * Math.min(jt / 1.3, 1), armSpread: 1.5 * cp };
  }
  // Knee-slide lean-back with a bounce.
  return {
    ...actor,
    lean: 0.45 * cp,
    armLift: 2.2 * cp,
    armSpread: 0.6 * cp,
    bob: Math.abs(Math.sin(jt * 5)) * 0.15 * cp,
  };
}

function evaluateHeroes(ctx: EvalCtx, attackIdx: TeamId, defendIdx: TeamId): AttackGoalActorFrame[] {
  const { data: d, time: t } = ctx;
  const ball = evaluateBall(ctx);
  const phases = d.breathPhases;

  // Teammates celebrate in place / with a short jog: arms up, small hop.
  const teamCeleb = segmentProgress(t, B.celebStart, B.celebStart + 0.3);
  const hop = t >= B.celebStart ? Math.abs(Math.sin((t - B.celebStart) * 6)) * 0.25 * teamCeleb : 0;
  const midPos = evaluateTrack(midKeys(d), t);
  const midBase = baseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t);
  const mateLift = 1.5 * segmentProgress(t, 5.0, 5.4);
  const mid: AttackGoalActorFrame = {
    ...midBase,
    legSwing: stride(t, 0.4) * moveWindow(t, 0.7, 2.8),
    armLift: mateLift,
    armSpread: 0.5 * segmentProgress(t, 5.0, 5.4),
    bob: midBase.bob + hop,
  };
  const wingPos = evaluateTrack(wingKeys(d), t);
  const wingBase = baseActor(1, attackIdx, 7, 'Winger', false, wingPos, ball, phases[1], t);
  const wing: AttackGoalActorFrame = {
    ...wingBase,
    legSwing: stride(t, 2.1) * moveWindow(t, 0.7, 2.8),
    armLift: mateLift,
    armSpread: 0.5 * segmentProgress(t, 5.0, 5.4),
    bob: wingBase.bob + hop,
  };

  const shPos = evaluateTrack(shooterKeys(d), t);
  const goalMouth = { x: GOAL_X, z: 0 };
  // Three-quarter turn to the crowd: celebration reads from the side-on
  // celebration camera instead of foreshortening into the torso.
  const crowd = { x: shPos.x + 7, z: shPos.z + 16 };
  const shooterFocus = t < B.pass2End ? ball : t < B.cineEnd ? goalMouth : crowd;
  const f = facingBetween(shPos, shooterFocus);
  const setupP = segmentProgress(t, B.pass2End, B.shotStart);
  const kickP = segmentProgress(t, B.shotStart, B.shotStart + 0.15);
  const kickHold = 1 - segmentProgress(t, B.shotStart + 0.15, B.shotStart + 0.45);
  let shooter: AttackGoalActorFrame = {
    ...baseActor(2, attackIdx, 9, 'Shooter', false, shPos, shooterFocus, phases[2], t),
    facingX: f.facingX, facingZ: f.facingZ,
    // Plant: right leg draws back winding up, then swings through the strike.
    legSwing: -1.1 * setupP * (1 - kickP) + 0.9 * kickP * kickHold,
    bob: 0,
  };
  shooter = applyCelebration(shooter, d.celebration, t);

  const defFrom: [Vec2, Vec2, Vec2] = [
    { x: d.mid.x + 9, z: d.mid.z + 1 },
    { x: d.mid.x + 7, z: d.mid.z - 7 },
    { x: d.mid.x + 4, z: d.mid.z + 9 },
  ];
  const defs = ([4, 5, 2] as const).map((num, k) => {
    const pos = evaluateTrack(defKeys(d, k as 0 | 1 | 2, defFrom[k]), t);
    const slump = segmentProgress(t, B.shotEnd, B.cineEnd);
    return {
      ...baseActor(3 + k, defendIdx, num, `Defender${k + 1}`, false, pos, ball, phases[3] + k, t),
      legSwing: stride(t, 1.1 + k * 0.9) * moveWindow(t, 0, 2.8),
      lean: 0.2 * slump,
    };
  });

  const keeper = evaluateKeeper(ctx, defendIdx, ball);
  return [mid, wing, shooter, ...defs, keeper];
}

function evaluateBackground(
  ctx: EvalCtx, attackIdx: TeamId, defendIdx: TeamId, ball: Vec3,
): AttackGoalActorFrame[] {
  const { data: d, time: t } = ctx;
  const numbers = [3, 6, 3, 6, 8, 10];
  return d.bgSpots.map((s, i) => ({
    ...baseActor(
      7 + i, s.attack ? attackIdx : defendIdx, numbers[i], s.attack ? 'Fullback' : 'Marker',
      false, { x: s.x, z: s.z }, ball, d.breathPhases[i % d.breathPhases.length] + i, t,
    ),
  }));
}

function evaluateAttackCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t, duration } = ctx;
  const L = d.cameraLateral;
  if (t < B.pass2End) {
    // Broadcast-like attack tracking riding with the ball.
    return {
      pos: { x: ball.x - 4 + L, y: 10.5, z: ball.z + 12.5 },
      look: { x: ball.x + 2.5, y: 0.7, z: ball.z - 2 },
      fov: 52,
    };
  }
  if (t < B.shotStart) {
    // Deliberate cut: closeup on the shooter setting the strike, shot from
    // the goal side so the ball stays visible beside his feet.
    const s = d.settleSpot;
    return {
      pos: { x: s.x + 2.5 + L, y: 3.4, z: s.z + 8 },
      look: { x: s.x - 1, y: 1.0, z: s.z - 0.5 },
      fov: 50,
    };
  }
  if (t < B.cineEnd - 1.0) {
    // Deliberate cut: fast ball-follow for the flight.
    return {
      pos: { x: ball.x - 8 + L, y: 4.5, z: ball.z + 9.5 },
      look: { x: ball.x + 2.5, y: 1.0, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < B.cineEnd) {
    // Deliberate cut: behind-the-net goal angle (pure game helper math).
    const g = goalCineShot(d.cineVariant, 1, ball.x, ball.z);
    return {
      pos: { x: g.pos.x + L * 0.3, y: g.pos.y, z: g.pos.z },
      look: { x: g.look.x, y: g.look.y, z: g.look.z },
      fov: 50,
    };
  }
  // Deliberate cut: side-on celebration framing. The camera sits just
  // behind the play looking up-pitch, so celebrating teammates behind it
  // stay out of frame and the shooter owns the shot.
  const s = d.shootSpot;
  const p = segmentProgress(t, B.cineEnd, Math.min(duration, 6));
  return {
    pos: { x: lerp(s.x - 3, s.x - 2, p) + L, y: lerp(3.8, 3.1, p), z: lerp(s.z + 13, s.z + 11, p) },
    look: { x: s.x + 1, y: 1.1, z: s.z },
    fov: 52,
  };
}

function evaluateAttackEffects(ctx: EvalCtx): AttackGoalEffects {
  const { data: d, seed, frame, time: t } = ctx;
  const shotP = segmentProgress(t, B.shotStart, B.shotEnd);
  const trailFade = 1 - segmentProgress(t, B.shotEnd, B.netSettleEnd);
  const intensity = shotP > 0 && trailFade > 0 ? Math.min(shotP * 3, 1) * trailFade : 0;
  const fovPunch = shotP > 0 ? 3 * Math.sin(Math.PI * Math.min(1, Math.max(0, shotP))) : 0;
  // Deterministic impact shake: decaying aftermath of the strike, derived
  // from frame + seed only — no accumulation, no RNG state.
  const shakeAmp = 0.1 * Math.sin(Math.PI * Math.min(1, Math.max(0, shotP)))
    + (t >= B.shotEnd && t <= B.shotEnd + 0.4 ? 0.08 * (1 - (t - B.shotEnd) / 0.4) : 0);
  return {
    trailFrom: intensity > 0.01 ? { ...d.shotStart } : null,
    trailIntensity: intensity,
    fovPunch,
    shakeX: Math.sin(frame * 12.9 + seed) * shakeAmp,
    shakeY: Math.cos(frame * 7.7 + seed * 1.3) * shakeAmp * 0.6,
  };
}

function mirrorVec2<T extends Vec2>(v: T): T {
  return { ...v, x: -v.x };
}

/**
 * Supporter choreography for the attack: the stand watches quietly, rises
 * as the ball reaches dangerous territory (early enough to read in the
 * pre-cut wide shots), peaks as the shot flies, then the scoring section
 * erupts while the conceding section drops. Past the 6s end (outro
 * continuation) the celebration slowly settles. Pure function of local
 * time + seed + attacking side.
 */
export function evaluateAttackCrowd(time: number, seed: number, attackIdx: TeamId): SocialCrowdState {
  if (time < 2.2) return { mood: 'idle', intensity: 0.2, time, seed, moodTime: time };
  if (time < 3.15) {
    const p = (time - 2.2) / 0.95;
    return { mood: 'anticipation', intensity: 0.25 + 0.45 * p, time, seed, moodTime: time - 2.2 };
  }
  if (time < B.shotEnd) {
    const p = (time - 3.15) / (B.shotEnd - 3.15);
    return { mood: 'anticipation', intensity: 0.7 + 0.3 * p, time, seed, moodTime: time - 3.15 };
  }
  const moodTime = time - B.shotEnd;
  const intensity = time < 6 ? 1 - 0.4 * (moodTime / (6 - B.shotEnd)) : Math.max(0.4, 0.6 - 0.15 * ((time - 6) / 2.6));
  return { mood: 'goal', intensity, time, seed, scoringTeam: attackIdx, moodTime };
}

/**
 * Evaluate one timeline frame. Pure function of (staging, frame, fps,
 * duration, countries): random-access safe, no prior-frame state. Away
 * attacks are compiled in attack-+x space and mirrored here.
 */
export function evaluateAttackGoalFrame(args: {
  data: AttackGoalTimelineData;
  home: string;
  away: string;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
}): AttackGoalFrameDescription {
  const { data, home, away, seed, frame, fps, duration } = args;
  void home;
  void away;
  const time = frame / fps;
  const ctx: EvalCtx = { data, seed, frame, fps, duration, time };
  const attackIdx = (data.attackSign === 1 ? 0 : 1) as TeamId;
  const defendIdx = (data.attackSign === 1 ? 1 : 0) as TeamId;

  const ball = evaluateBall(ctx);
  const heroes = evaluateHeroes(ctx, attackIdx, defendIdx);
  const background = evaluateBackground(ctx, attackIdx, defendIdx, ball);
  const camera = evaluateAttackCamera(ctx, ball);
  const effects = evaluateAttackEffects(ctx);
  const crowd = evaluateAttackCrowd(time, seed, attackIdx);

  if (data.attackSign === 1) {
    return { scene: 'attack-goal', frame, time, actors: [...heroes, ...background], ball, camera, clock: time, effects, crowd };
  }
  // Mirror the whole staged world across the halfway line for away attacks.
  const mirrorActor = (a: AttackGoalActorFrame): AttackGoalActorFrame => ({
    ...a, x: -a.x, facingX: -a.facingX,
  });
  return {
    scene: 'attack-goal',
    frame,
    time,
    actors: [...heroes, ...background].map(mirrorActor),
    ball: { x: -ball.x, y: ball.y, z: ball.z },
    camera: {
      pos: { x: -camera.pos.x, y: camera.pos.y, z: camera.pos.z },
      look: { x: -camera.look.x, y: camera.look.y, z: camera.look.z },
      fov: camera.fov,
    },
    clock: time,
    effects: {
      ...effects,
      trailFrom: effects.trailFrom ? { x: -effects.trailFrom.x, y: effects.trailFrom.y, z: effects.trailFrom.z } : null,
      shakeX: -effects.shakeX,
    },
    crowd,
  };
}

/** Map a frame description onto renderer input (teams resolved canonically). */
export function attackGoalFrameToRenderInput(
  desc: AttackGoalFrameDescription,
  homeCode: string,
  awayCode: string,
): AttackGoalRenderInput {
  const [homeTeam, awayTeam]: [Team, Team] = countryTeams(homeCode, awayCode);
  const toPlayer = (a: AttackGoalActorFrame): Player => ({
    id: a.id, team: a.team, number: a.number, name: a.name, keeper: a.keeper,
    x: a.x, z: a.z, vx: 0, vz: 0, facingX: a.facingX, facingZ: a.facingZ,
    homeX: a.x, homeZ: a.z, stamina: 1, action: 'idle', actionTime: 0,
    cooldown: 0, think: 0, aiState: 'POSE', touchIn: 0,
  });
  const state: MatchState = {
    players: desc.actors.map(toPlayer),
    ball: { x: desc.ball.x, z: desc.ball.z, y: desc.ball.y, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
    teams: [homeTeam, awayTeam],
    humanTeam: 0, controlled: 0, remoteTeam: null, peerControlled: -1, peerTarget: null,
    phase: 'playing', phaseTime: 0, half: 1, elapsed: 0, halfDuration: 60,
    score: [0, 0], attack: [1, -1], restart: null, paused: false,
    message: '', messageTime: 0, charge: 0, targetPlayer: null, time: desc.time,
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] },
  };
  const toPose = (a: AttackGoalActorFrame): SocialActorPose => ({
    bob: a.bob, lean: a.lean, armLift: a.armLift,
    legSwing: a.legSwing, armSpread: a.armSpread, roll: a.roll, spin: a.spin,
  });
  const fx = desc.effects;
  const effects: SocialEffects = {
    trail: fx.trailFrom ? { fromX: fx.trailFrom.x, fromY: fx.trailFrom.y, fromZ: fx.trailFrom.z, intensity: fx.trailIntensity } : undefined,
    fovPunch: fx.fovPunch,
    shakeX: fx.shakeX,
    shakeY: fx.shakeY,
  };
  return { state, camera: desc.camera, clock: desc.clock, pose: desc.actors.map(toPose), effects, crowd: desc.crowd };
}

