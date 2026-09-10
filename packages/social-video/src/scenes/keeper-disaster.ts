import { FIELD, type MatchState, type Player, type Team, type TeamId } from '../../../../apps/game/src/types';
import type { SocialActorPose, SocialEffects } from '../../../../apps/game/src/renderer';
import type { SocialCrowdState } from '../../../../apps/game/src/render/crowd';
import { goalCineShot, goalCineVariant } from '../../../../apps/game/src/render/camera';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { AttackStyle, ResolvedVideoSpec } from '../schema';
import type { SocialLens } from '../cameras/social-camera';
import { assertShotTable, presetLens, type SceneShot } from '../cameras/presets';
import { lerp, segmentProgress } from '../timeline/math';
import { evaluateTrack, evaluateTrackCR, shotArc, type ActorKeyframe, type Vec2, type Vec3 } from '../timeline/tracks';
import {
  angleBlendFocus, applyArcadePose, applyHold, arcadeBaseActor, arcadeFacing,
  arcadeMoveWindow, arcadeStride, armsUpPose, handsOnHeadPose,
  keeperDivePose, keeperKneelPose, parryDeflect,
  type ArcadeActorFrame,
} from '../timeline/arcade';
import { seededRandom } from './faceoff';

/**
 * KEEPER DISASTER (10.5s readable cut): wide attack → shot + INCREDIBLE SAVE
 * → held reaction (the viewer believes the hero moment) → keeper prepares the
 * clearance (wide, receivers visible) → bad clearance travels DIRECTLY to the
 * poacher on one readable camera → control + setup → instant shot → goal →
 * keeper despair + celebration. The comedy is HERO → pause → IDIOT, and the
 * pause is exactly why this cut is longer.
 */

export const GOAL_X = FIELD.halfLength;

export const KEEPER_BEATS = {
  shotStart: 2.5,
  saveMoment: 3.3,
  /** Deliberate save hold: the parry hangs (3 frames at 60fps). */
  holdLen: 0.05,
  gatherEnd: 3.75,
  holdBallEnd: 4.6,
  /** The rushed punt contact. */
  clearanceKick: 5.8,
  /** The clearance lands at the poacher (the mistake completes). */
  clearanceEnd: 7.0,
  settleEnd: 7.55,
  /** Second shot contact (after the poacher's plant). */
  shot2Start: 7.8,
  instantShotEnd: 8.3,
  netSettleEnd: 8.55,
  celebStart: 8.6,
} as const;

/** Deliberate camera cuts — comedy pacing, never machine-gun edits. */
export const KEEPER_SHOTS: readonly SceneShot[] = [
  { name: 'broadcast-wide', start: 0.0, end: 2.5, kind: 'info' },
  { name: 'broadcast-medium', start: 2.5, end: 3.6, kind: 'info' },
  { name: 'keeper-close', start: 3.6, end: 4.6, kind: 'reaction' },
  { name: 'wide-goal', start: 4.6, end: 6.2, kind: 'info' },
  { name: 'broadcast-medium', start: 6.2, end: 7.8, kind: 'info' },
  { name: 'shot-impact', start: 7.8, end: 8.35, kind: 'impact' },
  { name: 'goal-cine', start: 8.35, end: 9.0, kind: 'info' },
  { name: 'celebration', start: 9.0, end: 10.5, kind: 'reaction' },
];
assertShotTable(KEEPER_SHOTS);

export interface KeeperFrameDescription {
  scene: 'keeper-disaster';
  frame: number;
  time: number;
  actors: ArcadeActorFrame[];
  ball: Vec3;
  camera: SocialLens;
  clock: number;
  effects: {
    trailFrom: Vec3 | null;
    trailIntensity: number;
    fovPunch: number;
    shakeX: number;
    shakeY: number;
  };
  crowd: SocialCrowdState;
}

export interface KeeperRenderInput {
  state: MatchState;
  camera: SocialLens;
  clock: number;
  pose: SocialActorPose[];
  effects: SocialEffects;
  crowd: SocialCrowdState;
}

export interface KeeperTimelineData {
  attackSign: 1 | -1;
  style: AttackStyle;
  lane: 1 | -1;
  cameraLateral: number;
  cineVariant: 0 | 1 | 2;
  shooterStart: Vec2;
  strikeSpot: Vec2;
  shotFrom: Vec3;
  parryPoint: Vec3;
  gatherPoint: Vec3;
  puntSpot: Vec2;
  clearanceTarget: Vec3;
  poacherStart: Vec2;
  interceptSpot: Vec2;
  goalTarget: Vec3;
  keeperHome: Vec2;
  saveSpot: Vec2;
  scrambleSpot: Vec2;
  defStart: Vec2;
  defSpot: Vec2;
  bgSpots: { x: number; z: number; attack: boolean }[];
  breathPhases: number[];
}

export function compileKeeperTimeline(
  spec: Pick<ResolvedVideoSpec, 'seed' | 'attackTeam' | 'attackStyle'>,
): KeeperTimelineData {
  const rand = seededRandom(spec.seed * 29 + 5);
  const lane = (rand() < 0.5 ? -1 : 1) as 1 | -1;
  const j = (rand() - 0.5) * 3;
  const keeperJitter = (rand() - 0.5) * 1.5;
  const cameraLateral = (rand() - 0.5) * 0.7;
  const breathPhases = [rand(), rand(), rand(), rand()].map((r) => r * Math.PI * 2);

  const shooterStart = { x: 17, z: -3.5 * lane + j };
  const strikeSpot = { x: 24.5, z: -2.5 * lane + j * 0.5 };
  const shotFrom: Vec3 = { x: 25, y: 0.3, z: -2.5 * lane + j * 0.5 };
  // Fingertip parry, ~0.9m off the keeper's centre: close enough for honest
  // glove contact, far enough that his torso never eclipses the ball from
  // any social lens (a tighter parry hides the money frame behind him).
  const parryPoint: Vec3 = { x: 42.7, y: 1.25, z: 2.55 * lane + j * 0.2 };
  const gatherPoint: Vec3 = { x: 41.0, y: 0.3, z: 2.0 * lane + j * 0.2 };
  const puntSpot = { x: 40.4, z: 1.7 * lane + j * 0.2 };
  const clearanceTarget: Vec3 = { x: 30, y: 0.5, z: -1.0 * lane };
  const poacherStart = { x: 26, z: 1.0 * lane + j };
  const interceptSpot = { x: 30, z: -1.0 * lane + j * 0.2 };
  const goalTarget: Vec3 = { x: GOAL_X + 1.2, y: 1.0, z: 2.5 * lane };
  const keeperHome = { x: GOAL_X - 2.7, z: 0.5 * lane + keeperJitter };
  const saveSpot = { x: GOAL_X - 4.0, z: 2.0 * lane };
  const scrambleSpot = { x: GOAL_X - 2.2, z: 2.2 * lane };
  const defStart = { x: 28, z: 5 * lane + j };
  const defSpot = { x: 34, z: 3 * lane + j * 0.5 };

  const bgSpots = [
    { x: 8, z: 6 * lane, attack: true },
    { x: 14, z: -8 * lane, attack: true },
    { x: 32, z: 8 * lane, attack: false },
    { x: 20, z: 10 * lane, attack: false },
    { x: 40, z: -8 * lane, attack: false },
    { x: -6, z: -2 * lane, attack: false },
  ];
  return {
    attackSign: spec.attackTeam === 'home' ? 1 : -1,
    style: spec.attackStyle,
    lane,
    cameraLateral,
    cineVariant: goalCineVariant(1, goalTarget.x, goalTarget.z),
    shooterStart, strikeSpot, shotFrom, parryPoint, gatherPoint, puntSpot,
    clearanceTarget, poacherStart, interceptSpot, goalTarget,
    keeperHome, saveSpot, scrambleSpot, defStart, defSpot,
    bgSpots, breathPhases,
  };
}

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

const B = KEEPER_BEATS;

interface EvalCtx {
  data: KeeperTimelineData;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
  time: number;
}

function shooterKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.shooterStart.x, z: d.shooterStart.z },
    { time: 0.5, x: d.shooterStart.x + 2, z: d.shooterStart.z },
    { time: 2.0, x: d.strikeSpot.x, z: d.strikeSpot.z },
    { time: 99, x: d.strikeSpot.x + 1.5, z: d.strikeSpot.z },
  ];
}

function poacherKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.poacherStart.x, z: d.poacherStart.z },
    { time: 5.4, x: d.poacherStart.x + 1, z: d.poacherStart.z - 0.5 },
    { time: 7.0, x: d.interceptSpot.x, z: d.interceptSpot.z },
    { time: 7.55, x: d.interceptSpot.x + 0.6, z: d.interceptSpot.z },
    { time: 99, x: d.interceptSpot.x + 1, z: d.interceptSpot.z },
  ];
}

function defKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.defStart.x, z: d.defStart.z },
    { time: 2.0, x: d.defStart.x + 2, z: d.defStart.z - 1 },
    { time: 5.8, x: d.defSpot.x, z: d.defSpot.z },
    { time: 99, x: d.defSpot.x, z: d.defSpot.z },
  ];
}

function keeperKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: B.shotStart, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 3.45, x: d.saveSpot.x, z: d.saveSpot.z },
    { time: 4.0, x: d.gatherPoint.x - 0.5, z: d.gatherPoint.z },
    { time: 5.6, x: d.puntSpot.x, z: d.puntSpot.z },
    { time: 7.4, x: d.puntSpot.x - 1, z: d.puntSpot.z - 0.5 },
    { time: 8.3, x: d.scrambleSpot.x, z: d.scrambleSpot.z },
    { time: 99, x: d.scrambleSpot.x, z: d.scrambleSpot.z },
  ];
}

function keeperBallSpot(d: KeeperTimelineData, t: number): Vec3 {
  const k = evaluateTrack(keeperKeys(d), Math.min(t, B.clearanceKick));
  return { x: k.x + 0.5, y: 0.3, z: k.z };
}

function evaluateKeeperBall(ctx: EvalCtx): Vec3 {
  const { data: d, time: t } = ctx;
  if (t < B.shotStart) {
    const s = evaluateTrackCR(shooterKeys(d), t);
    return { x: s.x + 0.7, y: 0.25, z: s.z };
  }
  if (t < B.saveMoment) {
    return shotArc(d.shotFrom, d.parryPoint, (t - B.shotStart) / (B.saveMoment - B.shotStart), 0.6);
  }
  // Deliberate save hold: the parry hangs mid-air, then drops to the keeper.
  const { te } = applyHold(t, B.saveMoment, B.holdLen);
  if (te < B.saveMoment) return { ...d.parryPoint };
  if (te < B.gatherEnd) {
    return parryDeflect(d.parryPoint, d.gatherPoint, (te - B.saveMoment) / (B.gatherEnd - B.saveMoment), 0.5);
  }
  if (te < B.clearanceKick) return keeperBallSpot(d, te);
  if (te < B.clearanceEnd) {
    // Loopy, horrible, DIRECT clearance to the poacher — slow enough to
    // read, wrong enough to be funny.
    const p = (te - B.clearanceKick) / (B.clearanceEnd - B.clearanceKick);
    const from = keeperBallSpot(d, B.clearanceKick);
    return {
      x: lerp(from.x, d.clearanceTarget.x, p),
      y: lerp(from.y, d.clearanceTarget.y, p) + Math.sin(p * Math.PI) * 1.2,
      z: lerp(from.z, d.clearanceTarget.z, p),
    };
  }
  if (te < B.clearanceEnd + 0.05) {
    // First-touch settle: the poacher kills the clearance dead for 3 frames
    // at 60fps. Reads as control, not lag.
    return { ...d.clearanceTarget };
  }
  if (te < B.settleEnd) {
    // Control: the ball rides with the poacher while he steadies himself.
    const po = evaluateTrackCR(poacherKeys(d), te);
    return { x: po.x + 0.7, y: 0.25, z: po.z };
  }
  if (te < B.shot2Start) return { x: d.interceptSpot.x + 0.7, y: 0.25, z: d.interceptSpot.z };
  if (te < B.instantShotEnd) {
    const from: Vec3 = { x: d.interceptSpot.x + 0.7, y: 0.25, z: d.interceptSpot.z };
    return shotArc(from, d.goalTarget, (te - B.shot2Start) / (B.instantShotEnd - B.shot2Start), 0.8);
  }
  if (te < B.netSettleEnd) {
    const p = (te - B.instantShotEnd) / (B.netSettleEnd - B.instantShotEnd);
    return { x: d.goalTarget.x, y: lerp(d.goalTarget.y, 0.25, p * p), z: d.goalTarget.z };
  }
  return { x: d.goalTarget.x, y: 0.25, z: d.goalTarget.z };
}

function evaluateHeroes(ctx: EvalCtx, attackIdx: number, defendIdx: number): ArcadeActorFrame[] {
  const { data: d, time: t } = ctx;
  const ball = evaluateKeeperBall(ctx);
  const phases = d.breathPhases;
  const { te: teHold } = applyHold(t, B.saveMoment, B.holdLen);

  // Shooter: approaches, unleashes, collapses at the save, joins the party.
  const shPos = evaluateTrackCR(shooterKeys(d), t);
  const kickP = segmentProgress(t, B.shotStart - 0.1, B.shotStart + 0.05);
  let shooter: ArcadeActorFrame = {
    ...arcadeBaseActor(2, attackIdx, 9, 'Shooter', false, shPos, ball, phases[2], t),
    legSwing: arcadeStride(t, 1.0) * arcadeMoveWindow(t, 0.4, 2.0)
      - 1.1 * segmentProgress(t, B.shotStart - 0.35, B.shotStart) * (1 - kickP) + 0.9 * kickP,
  };
  if (t >= 3.5 && t < 4.8) shooter = applyArcadePose(shooter, handsOnHeadPose(segmentProgress(t, 3.5, 3.8) * (1 - segmentProgress(t, 4.5, 4.8))));
  if (t >= B.celebStart + 0.2) shooter = applyArcadePose(shooter, armsUpPose(segmentProgress(t, B.celebStart + 0.2, B.celebStart + 0.5)));
  {
    // Release gaze in angle space (touch happens at his feet).
    const ballAt22 = evaluateKeeperBall({ ...ctx, time: 2.2 });
    const ref = evaluateTrackCR(shooterKeys(d), 2.2);
    const goalMouth: Vec2 = { x: GOAL_X, z: 0 };
    let f: { facingX: number; facingZ: number };
    if (t < 2.2) f = arcadeFacing(shPos, ball);
    else if (t < 2.85) f = angleBlendFocus(ref, ballAt22, goalMouth, t, 2.2, 2.85);
    else f = arcadeFacing(shPos, ball);
    shooter.facingX = f.facingX; shooter.facingZ = f.facingZ;
  }

  // Poacher: reads the clearance, steps in, settles, first-time finish.
  const poPos = evaluateTrackCR(poacherKeys(d), t);
  const finishKick = segmentProgress(teHold, B.shot2Start - 0.1, B.shot2Start);
  let poacher: ArcadeActorFrame = {
    ...arcadeBaseActor(1, attackIdx, 7, 'Poacher', false, poPos, ball, phases[1], t),
    legSwing: arcadeStride(t, 2.2) * arcadeMoveWindow(t, 5.4, 7.4) + 0.9 * finishKick,
  };
  {
    // Intercept + finish gaze in angle space (both happen at his feet).
    const ballAt68 = evaluateKeeperBall({ ...ctx, time: 6.8 });
    const ref = evaluateTrackCR(poacherKeys(d), 6.8);
    const aim: Vec2 = { x: d.goalTarget.x, z: d.goalTarget.z };
    let f: { facingX: number; facingZ: number };
    if (t < 6.8) f = arcadeFacing(poPos, ball);
    else if (t < 7.5) f = angleBlendFocus(ref, ballAt68, aim, t, 6.8, 7.5);
    else f = arcadeFacing(poPos, aim);
    poacher.facingX = f.facingX; poacher.facingZ = f.facingZ;
  }
  if (t >= B.celebStart) poacher = applyArcadePose(poacher, armsUpPose(segmentProgress(t, B.celebStart, B.celebStart + 0.3)));

  // Defender: celebrates the save, then watches the disaster unfold.
  const defPos = evaluateTrackCR(defKeys(d), t);
  let defender: ArcadeActorFrame = {
    ...arcadeBaseActor(3, defendIdx, 5, 'Defender', false, defPos, ball, phases[3], t),
    legSwing: arcadeStride(t, 1.1) * arcadeMoveWindow(t, 0.4, 2.0),
    armLift: 1.6 * segmentProgress(t, 3.8, 4.1) * (1 - segmentProgress(t, 4.6, 4.9)),
    armSpread: 0.6 * segmentProgress(t, 3.8, 4.1) * (1 - segmentProgress(t, 4.6, 4.9)),
  };
  if (t >= 8.3) defender = applyArcadePose(defender, handsOnHeadPose(segmentProgress(t, 8.3, 8.7)));

  // Keeper: heroic launch, brief smug glory, walk-out, rushed punt, stranded
  // scramble, kneeling despair. The glory BEAT is the whole joke's setup.
  const keeperPos = evaluateTrack(keeperKeys(d), t);
  const diveP = segmentProgress(t, B.shotStart, 3.45);
  const landP = segmentProgress(t, 3.55, 4.0);
  const dirZ = Math.sign(d.saveSpot.z - d.keeperHome.z) || 1;
  let keeper = arcadeBaseActor(6, defendIdx, 1, 'Keeper', true, keeperPos, ball, phases[0] + 2, t);
  keeper = applyArcadePose(keeper, keeperDivePose(Math.min(1, diveP), dirZ, landP));
  if (t >= 3.8 && t < 4.5) {
    // Brief glory: fist pump with the ball at his feet.
    const g = segmentProgress(t, 3.8, 4.0) * (1 - segmentProgress(t, 4.25, 4.5));
    keeper = { ...keeper, armLift: keeper.armLift + 1.5 * g, bob: keeper.bob + 0.1 * g };
  }
  if (t >= 5.5) {
    // Rushed punt motion with a smooth release (never a branch-edge snap).
    keeper = { ...keeper, legSwing: -1.0 * segmentProgress(t, 5.5, 5.6) * (1 - segmentProgress(t, 5.6, 5.85)) };
  }
  if (t >= 7.4) {
    // Stranded scramble with a smooth release into the kneel.
    const sc = segmentProgress(t, 7.4, 8.0);
    const rel = 1 - segmentProgress(t, 8.0, 8.35);
    const dp = keeperDivePose(sc, dirZ * 0.5, 0);
    keeper = applyArcadePose(keeper, {
      bob: dp.bob * rel, lean: dp.lean * rel, armLift: dp.armLift * rel,
      armSpread: dp.armSpread * rel, legSwing: keeper.legSwing, roll: 0, spin: 0,
    });
  }
  if (t >= 8.6) keeper = applyArcadePose(keeper, keeperKneelPose(segmentProgress(t, 8.6, 9.1)));
  {
    // Save gaze: watches it into his hands (angle space), then eyes upfield
    // to the clearance target THROUGH the gather — the parried ball ends
    // draped 0.4m under him, where any gaze at it is singular. The punt
    // target is 11m away and exactly where the ball is going, so there is
    // no release whip either; the handoff back to the live ball lands on
    // the frozen first touch (identical point, zero step).
    const ballAt29 = evaluateKeeperBall({ ...ctx, time: 2.9 });
    const ref = evaluateTrack(keeperKeys(d), 2.9);
    const puntAim: Vec2 = { x: d.clearanceTarget.x, z: d.clearanceTarget.z };
    const ballAt74 = evaluateKeeperBall({ ...ctx, time: 7.4 });
    const ref74 = evaluateTrack(keeperKeys(d), 7.4);
    const goalAim: Vec2 = { x: d.goalTarget.x, z: d.goalTarget.z };
    let f: { facingX: number; facingZ: number };
    if (t < 2.9) f = arcadeFacing(keeperPos, ball);
    else if (t < 3.6) f = angleBlendFocus(ref, ballAt29, puntAim, t, 2.9, 3.6);
    else if (t < 7.4) f = arcadeFacing(keeperPos, puntAim);
    else if (t < 8.3) f = angleBlendFocus(ref74, ballAt74, goalAim, t, 7.4, 8.3);
    else f = arcadeFacing(keeperPos, ball);
    keeper.facingX = f.facingX; keeper.facingZ = f.facingZ;
  }

  // Midfielder: trails the first shot, joins the robbery celebration.
  const midPos = { x: d.shooterStart.x + 2 + t * 0.8, z: d.shooterStart.z + 2 };
  const mid: ArcadeActorFrame = {
    ...arcadeBaseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t),
    legSwing: arcadeStride(t, 0.4) * arcadeMoveWindow(t, 0.2, 2.4),
    armLift: 1.5 * segmentProgress(t, 8.8, 9.2),
    armSpread: 0.5 * segmentProgress(t, 8.8, 9.2),
  };

  return [mid, poacher, shooter, defender, keeper];
}

function evaluateBackground(ctx: EvalCtx, attackIdx: number, defendIdx: number, ball: Vec3): ArcadeActorFrame[] {
  const { data: d, time: t } = ctx;
  const numbers = [3, 6, 3, 6, 8, 10];
  return d.bgSpots.map((s, i) => ({
    ...arcadeBaseActor(
      7 + i, s.attack ? attackIdx : defendIdx, numbers[i], s.attack ? 'Fullback' : 'Marker',
      false, { x: s.x, z: s.z }, ball, d.breathPhases[i % d.breathPhases.length] + i, t,
    ),
  }));
}

function activeShot(time: number): SceneShot {
  for (const s of KEEPER_SHOTS) {
    if (time < s.end) return s;
  }
  return KEEPER_SHOTS[KEEPER_SHOTS.length - 1];
}

function evaluateKeeperCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t } = ctx;
  const L = d.cameraLateral;
  const shot = activeShot(t);
  switch (shot.name) {
    case 'broadcast-wide':
      return presetLens('broadcast-wide', { ball, goalX: GOAL_X, lateral: L });
    case 'broadcast-medium':
      return presetLens('broadcast-medium', { ball, goalX: GOAL_X, lateral: L });
    case 'keeper-close': {
      // Keeper hero portrait: ball at his feet, crowd behind — the glory
      // beat the joke needs. Goal-side lens so the keeper reads front-on.
      const k = d.gatherPoint;
      return {
        pos: { x: k.x - 4.5 + L, y: 2.2, z: k.z + 5.5 },
        look: { x: k.x, y: 1.0, z: k.z },
        fov: 50,
      };
    }
    case 'wide-goal':
      // Keeper walk-out + punt + the mistake STARTING: keeper, goal and the
      // free poacher all in one readable frame (the viewer sees the error
      // happen spatially — never hidden behind a cut).
      return {
        pos: { x: ball.x - 9 + L, y: 10.5, z: ball.z + 12 },
        look: { x: ball.x + 5, y: 1.4, z: ball.z * 0.5 },
        fov: 58,
      };
    case 'shot-impact': {
      // Ball-riding impact punch: close at the first-time strike, then rides
      // the shot toward the goal so the finish stays readable.
      return {
        pos: { x: ball.x - 3.5 + L, y: 2.6, z: ball.z + 5 },
        look: { x: ball.x + 2.5, y: 1.1, z: ball.z - 1 },
        fov: 52,
      };
    }
    case 'goal-cine': {
      const g = goalCineShot(d.cineVariant, 1, ball.x, ball.z);
      return {
        pos: { x: g.pos.x + L * 0.3, y: g.pos.y, z: g.pos.z },
        look: { x: g.look.x, y: g.look.y, z: g.look.z },
        fov: 50,
      };
    }
    case 'celebration': {
      // One wide reaction shot: keeper despair + scorer + crowd together,
      // then a slow push toward the kneeling keeper (never a hard cut).
      const k = d.scrambleSpot;
      const p = segmentProgress(t, B.celebStart, 10.5);
      return {
        pos: {
          x: lerp(k.x + 7, k.x + 4.2, p) + L,
          y: lerp(4.6, 2.2, p),
          z: lerp(k.z + 10, k.z + 1.8, p),
        },
        look: { x: lerp(k.x - 4, k.x, p), y: 1.0, z: lerp(k.z, k.z, p) },
        fov: 50,
      };
    }
    default:
      throw new Error(`Unknown keeper shot: ${shot.name}`);
  }
}

function evaluateKeeperEffects(ctx: EvalCtx): KeeperFrameDescription['effects'] {
  const { data: d, seed, time: t } = ctx;
  const shotP = segmentProgress(t, B.shotStart, B.saveMoment);
  const instP = segmentProgress(t, B.shot2Start, B.instantShotEnd);
  const instFade = 1 - segmentProgress(t, B.instantShotEnd, B.netSettleEnd);
  const from = instP > 0 ? { x: d.interceptSpot.x + 0.7, y: 0.25, z: d.interceptSpot.z } : d.shotFrom;
  const intensity = Math.max(
    shotP > 0 && shotP < 1 ? 1 : 0,
    instP > 0 && instFade > 0 ? Math.min(instP * 4, 1) * instFade : 0,
  );
  // Save punch (heroic) + goal punch (comic); the clearance gets nothing —
  // the joke lands drier without juice.
  const savePunch = 3.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.saveMoment) / 0.4)));
  const goalPunch = 2.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.instantShotEnd) / 0.4)));
  const shakeAmp = 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.saveMoment) / 0.5)))
    + 0.08 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.instantShotEnd) / 0.5)));
  return {
    trailFrom: intensity > 0.01 ? { ...from } : null,
    trailIntensity: intensity,
    fovPunch: Math.max(0, savePunch) + Math.max(0, goalPunch),
    shakeX: Math.sin(t * 10.7 + seed) * shakeAmp,
    shakeY: Math.cos(t * 8.8 + seed * 1.2) * shakeAmp * 0.6,
  };
}

/**
 * Supporter tragedy-comedy: rise, visiting-keeper glory (brief home groan),
 * uneasy clearance, home eruption + away collapse.
 */
export function evaluateKeeperCrowd(time: number, seed: number, attackIdx: TeamId, defendIdx: TeamId): SocialCrowdState {
  if (time < B.shotStart) {
    const p = Math.min(1, Math.max(0, time / B.shotStart));
    return { mood: 'anticipation', intensity: 0.3 + 0.4 * p, time, seed, moodTime: time };
  }
  if (time < B.saveMoment) return { mood: 'anticipation', intensity: 1, time, seed, moodTime: time - B.shotStart };
  if (time < B.holdBallEnd) {
    // The keeper's glory moment: his section erupts, the attackers groan.
    return { mood: 'goal', intensity: 0.85, time, seed, scoringTeam: defendIdx, moodTime: time - B.saveMoment };
  }
  if (time < 8.3) {
    const p = (time - B.holdBallEnd) / (8.3 - B.holdBallEnd);
    return { mood: 'anticipation', intensity: 0.4 + 0.4 * p, time, seed, moodTime: time - B.holdBallEnd };
  }
  const moodTime = time - 8.3;
  const intensity = time < 10.5 ? 1 - 0.35 * (moodTime / 2.2) : 0.6;
  return { mood: 'goal', intensity, time, seed, scoringTeam: attackIdx, moodTime };
}

export function evaluateKeeperFrame(args: {
  data: KeeperTimelineData;
  home: string;
  away: string;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
}): KeeperFrameDescription {
  const { data, home, away, seed, frame, fps, duration } = args;
  void home;
  void away;
  const time = frame / fps;
  const ctx: EvalCtx = { data, seed, frame, fps, duration, time };
  const attackIdx = (data.attackSign === 1 ? 0 : 1) as TeamId;
  const defendIdx = (data.attackSign === 1 ? 1 : 0) as TeamId;

  const ball = evaluateKeeperBall(ctx);
  const heroes = evaluateHeroes(ctx, attackIdx, defendIdx);
  const background = evaluateBackground(ctx, attackIdx, defendIdx, ball);
  const camera = evaluateKeeperCamera(ctx, ball);
  const effects = evaluateKeeperEffects(ctx);
  const crowd = evaluateKeeperCrowd(time, seed, attackIdx, defendIdx);

  if (data.attackSign === 1) {
    return { scene: 'keeper-disaster', frame, time, actors: [...heroes, ...background], ball, camera, clock: time, effects, crowd };
  }
  const mirrorActor = (a: ArcadeActorFrame): ArcadeActorFrame => ({ ...a, x: -a.x, facingX: -a.facingX });
  return {
    scene: 'keeper-disaster',
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

export function keeperFrameToRenderInput(
  desc: KeeperFrameDescription,
  homeCode: string,
  awayCode: string,
): KeeperRenderInput {
  const [homeTeam, awayTeam]: [Team, Team] = countryTeams(homeCode, awayCode);
  const toPlayer = (a: ArcadeActorFrame): Player => ({
    id: a.id, team: a.team as TeamId, number: a.number, name: a.name, keeper: a.keeper,
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
  const toPose = (a: ArcadeActorFrame): SocialActorPose => ({
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
