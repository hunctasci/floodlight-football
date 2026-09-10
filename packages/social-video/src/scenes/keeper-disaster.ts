import { FIELD, type MatchState, type Player, type Team, type TeamId } from '../../../../apps/game/src/types';
import type { SocialActorPose, SocialEffects } from '../../../../apps/game/src/renderer';
import type { SocialCrowdState } from '../../../../apps/game/src/render/crowd';
import { goalCineShot, goalCineVariant } from '../../../../apps/game/src/render/camera';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { AttackStyle, ResolvedVideoSpec } from '../schema';
import type { SocialLens } from '../cameras/social-camera';
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
 * KEEPER DISASTER: power shot → INCREDIBLE SAVE (brief glory) → keeper
 * gathers → BAD CLEARANCE straight to the poacher → instant shot → GOAL →
 * keeper collapses. Fast comedy timing; the first save must genuinely thrill
 * for half a second before the disaster. Deterministic, random-access.
 */

export const GOAL_X = FIELD.halfLength;

export const KEEPER_BEATS = {
  shotStart: 0.7,
  saveMoment: 1.15,
  /** Deliberate save hold: the parry hangs (3 frames at 60fps). */
  holdLen: 0.05,
  gatherEnd: 1.55,
  holdBallEnd: 2.2,
  clearanceEnd: 2.55,
  instantShotEnd: 3.0,
  netSettleEnd: 3.3,
  celebStart: 3.35,
} as const;

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

  const shooterStart = { x: 19, z: -3.5 * lane + j };
  const strikeSpot = { x: 24.5, z: -2.5 * lane + j * 0.5 };
  const shotFrom: Vec3 = { x: 25, y: 0.3, z: -2.5 * lane + j * 0.5 };
  // Fingertip parry, ~0.9m off the keeper's centre: close enough for honest
  // glove contact, far enough that his torso never eclipses the ball from
  // any social lens (a tighter parry hides the money frame behind him).
  const parryPoint: Vec3 = { x: 42.7, y: 1.25, z: 2.55 * lane + j * 0.2 };
  const gatherPoint: Vec3 = { x: 41.0, y: 0.3, z: 2.0 * lane + j * 0.2 };
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
    shooterStart, strikeSpot, shotFrom, parryPoint, gatherPoint,
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
    { time: 0.3, x: d.shooterStart.x + 2, z: d.shooterStart.z },
    { time: B.shotStart, x: d.strikeSpot.x, z: d.strikeSpot.z },
    { time: 99, x: d.strikeSpot.x + 1.5, z: d.strikeSpot.z },
  ];
}

function poacherKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.poacherStart.x, z: d.poacherStart.z },
    { time: 1.8, x: d.poacherStart.x + 1, z: d.poacherStart.z - 0.5 },
    { time: 2.5, x: d.interceptSpot.x, z: d.interceptSpot.z },
    { time: 99, x: d.interceptSpot.x + 1, z: d.interceptSpot.z },
  ];
}

function defKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.defStart.x, z: d.defStart.z },
    { time: B.shotStart, x: d.defStart.x + 2, z: d.defStart.z - 1 },
    { time: 2.0, x: d.defSpot.x, z: d.defSpot.z },
    { time: 99, x: d.defSpot.x, z: d.defSpot.z },
  ];
}

function keeperKeys(d: KeeperTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: B.shotStart, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 1.3, x: d.saveSpot.x, z: d.saveSpot.z },
    { time: B.holdBallEnd, x: d.gatherPoint.x - 0.5, z: d.gatherPoint.z },
    { time: 2.6, x: d.saveSpot.x + 0.5, z: d.saveSpot.z },
    { time: 3.1, x: d.scrambleSpot.x, z: d.scrambleSpot.z },
    { time: 99, x: d.scrambleSpot.x, z: d.scrambleSpot.z },
  ];
}

function keeperBallSpot(d: KeeperTimelineData, t: number): Vec3 {
  const k = evaluateTrack(keeperKeys(d), Math.min(t, B.holdBallEnd));
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
  if (te < B.holdBallEnd) return keeperBallSpot(d, te);
  if (te < B.clearanceEnd) {
    // Flat horrible clearance straight to the poacher's lane.
    const p = (te - B.holdBallEnd) / (B.clearanceEnd - B.holdBallEnd);
    const from = keeperBallSpot(d, B.holdBallEnd);
    return {
      x: lerp(from.x, d.clearanceTarget.x, p),
      y: lerp(from.y, d.clearanceTarget.y, p) + Math.sin(p * Math.PI) * 1.2,
      z: lerp(from.z, d.clearanceTarget.z, p),
    };
  }
  if (te < B.clearanceEnd + 0.05) {
    // First-touch settle: the poacher kills the clearance dead for 3 frames
    // at 60fps, then volleys it first-time. Reads as control, not lag.
    return { ...d.clearanceTarget };
  }
  if (te < B.instantShotEnd) {
    return shotArc(d.clearanceTarget, d.goalTarget, (te - B.clearanceEnd) / (B.instantShotEnd - B.clearanceEnd), 0.8);
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

  // Shooter: unleashes, collapses at the save, joins the late party.
  const shPos = evaluateTrackCR(shooterKeys(d), t);
  const kickP = segmentProgress(t, B.shotStart - 0.1, B.shotStart + 0.05);
  let shooter: ArcadeActorFrame = {
    ...arcadeBaseActor(2, attackIdx, 9, 'Shooter', false, shPos, ball, phases[2], t),
    legSwing: -1.1 * segmentProgress(t, B.shotStart - 0.3, B.shotStart) * (1 - kickP) + 0.9 * kickP,
  };
  if (t >= 1.25 && t < 2.4) shooter = applyArcadePose(shooter, handsOnHeadPose(segmentProgress(t, 1.25, 1.55) * (1 - segmentProgress(t, 2.1, 2.4))));
  if (t >= B.celebStart + 0.2) shooter = applyArcadePose(shooter, armsUpPose(segmentProgress(t, B.celebStart + 0.2, B.celebStart + 0.5)));
  {
    // Release gaze in angle space (touch happens at his feet).
    const ballAt06 = evaluateKeeperBall({ ...ctx, time: 0.55 });
    const ref = evaluateTrackCR(shooterKeys(d), 0.55);
    const goalMouth: Vec2 = { x: GOAL_X, z: 0 };
    let f: { facingX: number; facingZ: number };
    if (t < 0.55) f = arcadeFacing(shPos, ball);
    else if (t < 1.05) f = angleBlendFocus(ref, ballAt06, goalMouth, t, 0.55, 1.05);
    else f = arcadeFacing(shPos, ball);
    shooter.facingX = f.facingX; shooter.facingZ = f.facingZ;
  }

  // Poacher: reads the clearance, steps in, first-time finish, celebrates.
  const poPos = evaluateTrackCR(poacherKeys(d), t);
  const finishKick = segmentProgress(teHold, 2.5, 2.6);
  let poacher: ArcadeActorFrame = {
    ...arcadeBaseActor(1, attackIdx, 7, 'Poacher', false, poPos, ball, phases[1], t),
    legSwing: arcadeStride(t, 2.2) * arcadeMoveWindow(t, 1.8, 2.55) + 0.9 * finishKick,
  };
  {
    // Intercept + finish gaze in angle space (both happen at his feet).
    const ballAt23 = evaluateKeeperBall({ ...ctx, time: 2.3 });
    const ref = evaluateTrackCR(poacherKeys(d), 2.3);
    const aim: Vec2 = { x: d.goalTarget.x, z: d.goalTarget.z };
    let f: { facingX: number; facingZ: number };
    if (t < 2.3) f = arcadeFacing(poPos, ball);
    else if (t < 2.62) f = angleBlendFocus(ref, ballAt23, aim, t, 2.3, 2.62);
    else f = arcadeFacing(poPos, aim);
    poacher.facingX = f.facingX; poacher.facingZ = f.facingZ;
  }
  if (t >= B.celebStart) poacher = applyArcadePose(poacher, armsUpPose(segmentProgress(t, B.celebStart, B.celebStart + 0.3)));

  // Defender: celebrates the save, then watches the disaster unfold.
  const defPos = evaluateTrackCR(defKeys(d), t);
  let defender: ArcadeActorFrame = {
    ...arcadeBaseActor(3, defendIdx, 5, 'Defender', false, defPos, ball, phases[3], t),
    legSwing: arcadeStride(t, 1.1) * arcadeMoveWindow(t, 0, 1.0),
    armLift: 1.6 * segmentProgress(t, 1.4, 1.7) * (1 - segmentProgress(t, 2.2, 2.5)),
    armSpread: 0.6 * segmentProgress(t, 1.4, 1.7) * (1 - segmentProgress(t, 2.2, 2.5)),
  };
  if (t >= 3.2) defender = applyArcadePose(defender, handsOnHeadPose(segmentProgress(t, 3.2, 3.6)));

  // Keeper: heroic launch, brief smug glory, rushed punt, stranded scramble,
  // kneeling despair.
  const keeperPos = evaluateTrack(keeperKeys(d), t);
  const diveP = segmentProgress(t, B.shotStart, 1.3);
  const landP = segmentProgress(t, 1.35, 1.8);
  const dirZ = Math.sign(d.saveSpot.z - d.keeperHome.z) || 1;
  let keeper = arcadeBaseActor(6, defendIdx, 1, 'Keeper', true, keeperPos, ball, phases[0] + 2, t);
  keeper = applyArcadePose(keeper, keeperDivePose(Math.min(1, diveP), dirZ, landP));
  if (t >= 1.6 && t < 2.2) {
    // Brief glory: fist pump with the ball at his feet.
    const g = segmentProgress(t, 1.6, 1.8) * (1 - segmentProgress(t, 2.0, 2.2));
    keeper = { ...keeper, armLift: keeper.armLift + 1.5 * g, bob: keeper.bob + 0.1 * g };
  }
  if (t >= 2.1) {
    // Rushed punt motion with a smooth release (never a branch-edge snap).
    keeper = { ...keeper, legSwing: -1.0 * segmentProgress(t, 2.1, 2.2) * (1 - segmentProgress(t, 2.2, 2.45)) };
  }
  if (t >= 2.6) {
    // Stranded scramble with a smooth release into the kneel (the kneel
    // ramps from 3.3 while the dive releases through 3.4: no snap).
    const sc = segmentProgress(t, 2.6, 3.15);
    const rel = 1 - segmentProgress(t, 3.15, 3.4);
    const dp = keeperDivePose(sc, dirZ * 0.5, 0);
    keeper = applyArcadePose(keeper, {
      bob: dp.bob * rel, lean: dp.lean * rel, armLift: dp.armLift * rel,
      armSpread: dp.armSpread * rel, legSwing: keeper.legSwing, roll: 0, spin: 0,
    });
  }
  if (t >= 3.3) keeper = applyArcadePose(keeper, keeperKneelPose(segmentProgress(t, 3.3, 3.8)));
  {
    // Save gaze: watches it into his hands (angle space), then eyes upfield
    // to the clearance target THROUGH the gather — the parried ball ends
    // draped 0.4m under him, where any gaze at it is singular. The punt
    // target is 11m away and exactly where the ball is going, so there is
    // no release whip either; the handoff back to the live ball lands on
    // the frozen first touch (identical point, zero step).
    const ballAt10 = evaluateKeeperBall({ ...ctx, time: 1.0 });
    const ref = evaluateTrack(keeperKeys(d), 1.0);
    const puntAim: Vec2 = { x: d.clearanceTarget.x, z: d.clearanceTarget.z };
    const ballAt26 = evaluateKeeperBall({ ...ctx, time: 2.6 });
    const ref31 = evaluateTrack(keeperKeys(d), 3.1);
    const goalAim: Vec2 = { x: d.goalTarget.x, z: d.goalTarget.z };
    let f: { facingX: number; facingZ: number };
    if (t < 1.0) f = arcadeFacing(keeperPos, ball);
    else if (t < 1.6) f = angleBlendFocus(ref, ballAt10, puntAim, t, 1.0, 1.6);
    else if (t < 2.6) f = arcadeFacing(keeperPos, puntAim);
    else if (t < 3.1) f = angleBlendFocus(ref31, ballAt26, goalAim, t, 2.6, 3.1);
    else f = arcadeFacing(keeperPos, ball);
    keeper.facingX = f.facingX; keeper.facingZ = f.facingZ;
  }

  // Midfielder: trails the first shot, joins the robbery celebration.
  const midPos = { x: d.shooterStart.x + 2 + t * 0.8, z: d.shooterStart.z + 2 };
  const mid: ArcadeActorFrame = {
    ...arcadeBaseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t),
    legSwing: arcadeStride(t, 0.4) * arcadeMoveWindow(t, 0.2, 1.2),
    armLift: 1.5 * segmentProgress(t, 3.5, 3.9),
    armSpread: 0.5 * segmentProgress(t, 3.5, 3.9),
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

function evaluateKeeperCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t, duration } = ctx;
  const L = d.cameraLateral;
  if (t < B.shotStart) {
    return {
      pos: { x: ball.x - 4 + L, y: 10.5, z: ball.z + 12.5 },
      look: { x: ball.x + 2.5, y: 0.7, z: ball.z - 2 },
      fov: 52,
    };
  }
  if (t < B.saveMoment) {
    return {
      pos: { x: ball.x - 8 + L, y: 4.5, z: ball.z + 9.5 },
      look: { x: ball.x + 2.5, y: 1.2, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < 1.7) {
    // WHAT A SAVE closeup: shot from the goal side back out at the keeper,
    // so the parried ball reads IN FRONT of his torso. (A pitch-side lens
    // hides the ball exactly behind his body: the parry point sits 0.4m off
    // his centre by design, i.e. body contact.)
    const p = d.parryPoint;
    return {
      pos: { x: p.x + 3.5 + L * 0.3, y: p.y + 1.2, z: p.z + 2.5 },
      look: { x: p.x, y: p.y, z: p.z },
      fov: 50,
    };
  }
  if (t < B.holdBallEnd) {
    const k = d.gatherPoint;
    return {
      pos: { x: k.x - 4.5 + L, y: 2.2, z: k.z + 5.5 },
      look: { x: k.x, y: 0.7, z: k.z },
      fov: 50,
    };
  }
  if (t < B.clearanceEnd + 0.1) {
    return {
      pos: { x: ball.x - 7 + L, y: 4.0, z: ball.z + 8.5 },
      look: { x: ball.x + 2, y: 0.8, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < B.instantShotEnd + 0.3) {
    return {
      pos: { x: ball.x - 7 + L, y: 4.2, z: ball.z + 8.5 },
      look: { x: ball.x + 2.5, y: 1.0, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < B.celebStart) {
    const g = goalCineShot(d.cineVariant, 1, ball.x, ball.z);
    return {
      pos: { x: g.pos.x + L * 0.3, y: g.pos.y, z: g.pos.z },
      look: { x: g.look.x, y: g.look.y, z: g.look.z },
      fov: 50,
    };
  }
  if (t < B.celebStart + 0.9) {
    // Dedicated REACTION-KEEPER payoff: kneeling despair shot from the GOAL
    // side looking back out (was ~14m away). The keeper faces the goal (+x,
    // where the ball died), so his front is only visible from +x: the lens
    // sits just inside the goal mouth, catching his slump with the crowd
    // behind him — never another back-of-shirt closeup.
    const k = d.scrambleSpot;
    return {
      pos: { x: k.x + 4.2 + L, y: 2.2, z: k.z + 1.8 },
      look: { x: k.x, y: 1.0, z: k.z },
      fov: 48,
    };
  }
  const s = d.interceptSpot;
  const p = segmentProgress(t, B.celebStart, Math.min(duration, 5.5));
  return {
    pos: { x: lerp(s.x - 3, s.x - 2, p) + L, y: lerp(3.8, 3.1, p), z: lerp(s.z + 13, s.z + 11, p) },
    look: { x: s.x + 1, y: 1.1, z: s.z },
    fov: 52,
  };
}

function evaluateKeeperEffects(ctx: EvalCtx): KeeperFrameDescription['effects'] {
  const { data: d, seed, time: t } = ctx;
  const shotP = segmentProgress(t, B.shotStart, B.saveMoment);
  const instP = segmentProgress(t, B.clearanceEnd, B.instantShotEnd);
  const instFade = 1 - segmentProgress(t, B.instantShotEnd, B.netSettleEnd);
  const from = instP > 0 ? d.clearanceTarget : d.shotFrom;
  const intensity = Math.max(
    shotP > 0 && shotP < 1 ? 1 : 0,
    instP > 0 && instFade > 0 ? Math.min(instP * 4, 1) * instFade : 0,
  );
  // Save punch (heroic) + goal punch (comic); the clearance gets nothing —
  // the joke lands drier without juice.
  const savePunch = 3.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.saveMoment) / 0.4)));
  const goalPunch = 2.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 2.9) / 0.4)));
  const shakeAmp = 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.saveMoment) / 0.5)))
    + 0.08 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 2.9) / 0.5)));
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
  if (time < 2.9) {
    const p = (time - B.holdBallEnd) / (2.9 - B.holdBallEnd);
    return { mood: 'anticipation', intensity: 0.4 + 0.4 * p, time, seed, moodTime: time - B.holdBallEnd };
  }
  const moodTime = time - 2.9;
  const intensity = time < 5.5 ? 1 - 0.35 * (moodTime / 2.6) : 0.6;
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
