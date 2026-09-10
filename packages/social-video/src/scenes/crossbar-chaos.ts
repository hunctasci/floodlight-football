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
  arcadeMoveWindow, arcadeStride, armsUpPose, handsOnHeadPose, headerShot,
  keeperDivePose, keeperKneelPose, skyRebound,
  type ArcadeActorFrame,
} from '../timeline/arcade';
import { seededRandom } from './faceoff';

/**
 * CROSSBAR CHAOS (9.5s readable cut): wide buildup → medium setup → long shot
 * → CLANG off the bar (false-dawn eruption) → ONE held wide-goal camera for
 * the whole rebound (ball up, keeper stranded, scramble underneath, poacher
 * arriving) → rebound volley → one strong goal angle → double eruption.
 * The comedy only lands because the viewer SEES the bar, the keeper and the
 * descending ball in a single understandable composition.
 */

export const GOAL_X = FIELD.halfLength;
/** The staged bar contact point (front face of the crossbar). */
export const BAR_POINT_Y = FIELD.goalHeight;

export const CROSSBAR_BEATS = {
  shotStart: 3.4,
  barHit: 4.3,
  /** Deliberate crossbar hold: frozen clang (4 frames at 60fps). */
  holdLen: 0.06,
  /** Rebound apex (seconds): the ball hangs, everyone reacts underneath. */
  apex: 5.4,
  volleyContact: 6.8,
  volleyEnd: 7.3,
  netSettleEnd: 7.6,
  celebStart: 7.7,
} as const;

/** Deliberate camera cuts — one continuous story, never a cut per event. */
export const CROSSBAR_SHOTS: readonly SceneShot[] = [
  { name: 'broadcast-wide', start: 0.0, end: 2.5, kind: 'info' },
  { name: 'broadcast-medium', start: 2.5, end: 3.4, kind: 'info' },
  { name: 'ball-follow', start: 3.4, end: 4.3, kind: 'info' },
  { name: 'wide-goal', start: 4.3, end: 6.8, kind: 'info' },
  { name: 'shot-impact', start: 6.8, end: 7.35, kind: 'impact' },
  { name: 'goal-cine', start: 7.35, end: 8.3, kind: 'info' },
  { name: 'celebration', start: 8.3, end: 9.5, kind: 'reaction' },
];
assertShotTable(CROSSBAR_SHOTS);

export interface CrossbarFrameDescription {
  scene: 'crossbar-chaos';
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

export interface CrossbarRenderInput {
  state: MatchState;
  camera: SocialLens;
  clock: number;
  pose: SocialActorPose[];
  effects: SocialEffects;
  crowd: SocialCrowdState;
}

export interface CrossbarTimelineData {
  attackSign: 1 | -1;
  style: AttackStyle;
  lane: 1 | -1;
  cameraLateral: number;
  cineVariant: 0 | 1 | 2;
  shooterStart: Vec2;
  strikeSpot: Vec2;
  shotFrom: Vec3;
  barPoint: Vec3;
  reboundLand: Vec3;
  poacherStart: Vec2;
  dropPoint: Vec2;
  volleyTarget: Vec3;
  keeperHome: Vec2;
  diveSpot: Vec2;
  keeperScramble: Vec2;
  defStart: Vec2;
  defSpot: Vec2;
  defScramble: Vec2;
  bgSpots: { x: number; z: number; attack: boolean }[];
  breathPhases: number[];
}

export function compileCrossbarTimeline(
  spec: Pick<ResolvedVideoSpec, 'seed' | 'attackTeam' | 'attackStyle'>,
): CrossbarTimelineData {
  const rand = seededRandom(spec.seed * 13 + 71);
  const lane = (rand() < 0.5 ? -1 : 1) as 1 | -1;
  const j = (rand() - 0.5) * 3;
  const keeperJitter = (rand() - 0.5) * 2;
  const cameraLateral = (rand() - 0.5) * 0.7;
  const breathPhases = [rand(), rand(), rand(), rand()].map((r) => r * Math.PI * 2);

  const shooterStart = { x: 22, z: 4 * lane + j };
  const strikeSpot = { x: 28, z: 2.5 * lane + j * 0.5 };
  const shotFrom: Vec3 = { x: 28.5, y: 0.3, z: 2.5 * lane + j * 0.5 };
  const barPoint: Vec3 = { x: GOAL_X - 0.2, y: BAR_POINT_Y, z: 1.0 * lane + j * 0.2 };
  const poacherStart = { x: 33, z: -2.5 * lane + j };
  const dropPoint = { x: 40, z: 0.8 * lane + j * 0.3 };
  // The rebound lands exactly where the poacher meets it (first-time volley).
  const reboundLand: Vec3 = { x: dropPoint.x - 0.4, y: 0.5, z: dropPoint.z };
  const volleyTarget: Vec3 = { x: GOAL_X + 1.2, y: 1.1, z: -2.5 * lane };
  const keeperHome = { x: GOAL_X - 2.7, z: 0.5 * lane + keeperJitter };
  const diveSpot = { x: GOAL_X - 1.7, z: 1.8 * lane };
  const keeperScramble = { x: GOAL_X - 2.4, z: -1.5 * lane };
  const defStart = { x: 30, z: -6 * lane + j };
  const defSpot = { x: 36, z: -3 * lane + j * 0.5 };
  const defScramble = { x: 40.5, z: -1.5 * lane + j * 0.3 };

  const bgSpots = [
    { x: 10, z: 8 * lane, attack: true },
    { x: 18, z: -10 * lane, attack: true },
    { x: 34, z: 8 * lane, attack: false },
    { x: 24, z: -12 * lane, attack: false },
    { x: 42, z: -8 * lane, attack: false },
    { x: -4, z: 2 * lane, attack: false },
  ];
  return {
    attackSign: spec.attackTeam === 'home' ? 1 : -1,
    style: spec.attackStyle,
    lane,
    cameraLateral,
    cineVariant: goalCineVariant(1, volleyTarget.x, volleyTarget.z),
    shooterStart, strikeSpot, shotFrom, barPoint, reboundLand,
    poacherStart, dropPoint, volleyTarget,
    keeperHome, diveSpot, keeperScramble, defStart, defSpot, defScramble,
    bgSpots, breathPhases,
  };
}

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

const B = CROSSBAR_BEATS;

interface EvalCtx {
  data: CrossbarTimelineData;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
  time: number;
}

function shooterKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.shooterStart.x, z: d.shooterStart.z },
    { time: 0.6, x: d.shooterStart.x + 1.5, z: d.shooterStart.z },
    { time: 2.6, x: d.strikeSpot.x, z: d.strikeSpot.z },
    { time: 5.4, x: d.strikeSpot.x + 1, z: d.strikeSpot.z },
    { time: 6.9, x: 36.5, z: d.dropPoint.z - 3 },
    { time: 99, x: 36.5, z: d.dropPoint.z - 3 },
  ];
}

function poacherKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.poacherStart.x, z: d.poacherStart.z },
    { time: 4.2, x: d.poacherStart.x + 0.5, z: d.poacherStart.z },
    { time: 6.7, x: d.dropPoint.x, z: d.dropPoint.z },
    { time: 99, x: d.dropPoint.x + 1, z: d.dropPoint.z },
  ];
}

function defKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.defStart.x, z: d.defStart.z },
    { time: 2.6, x: d.defStart.x + 2, z: d.defStart.z + 1 },
    { time: 3.4, x: d.defSpot.x, z: d.defSpot.z },
    { time: 5.6, x: d.defSpot.x, z: d.defSpot.z },
    { time: 6.9, x: d.defScramble.x, z: d.defScramble.z },
    { time: 99, x: d.defScramble.x, z: d.defScramble.z },
  ];
}

function keeperKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 3.5, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 4.4, x: d.diveSpot.x, z: d.diveSpot.z },
    { time: 5.5, x: d.diveSpot.x - 0.4, z: d.diveSpot.z },
    { time: 6.9, x: d.keeperScramble.x, z: d.keeperScramble.z },
    { time: 99, x: d.keeperScramble.x, z: d.keeperScramble.z },
  ];
}

function evaluateChaosBall(ctx: EvalCtx): Vec3 {
  const { data: d, time: t } = ctx;
  if (t < B.shotStart) {
    const s = evaluateTrackCR(shooterKeys(d), t);
    return { x: s.x + 0.7, y: 0.25, z: s.z };
  }
  if (t < B.barHit) {
    return shotArc(d.shotFrom, d.barPoint, (t - B.shotStart) / (B.barHit - B.shotStart), 0.9);
  }
  // Deliberate crossbar hold: the clang hangs, then the rebound launches.
  const { te } = applyHold(t, B.barHit, B.holdLen);
  if (te < B.barHit) return { ...d.barPoint };
  if (te < B.volleyContact) {
    // One long readable rebound: up, hang, descend straight to the poacher.
    return skyRebound(d.barPoint, d.reboundLand, (te - B.barHit) / (B.volleyContact - B.barHit), 7.5);
  }
  if (te < B.volleyEnd) {
    const contact: Vec3 = { ...d.reboundLand, y: 0.5 };
    return headerShot(contact, d.volleyTarget, (te - B.volleyContact) / (B.volleyEnd - B.volleyContact), 0.8);
  }
  if (te < B.netSettleEnd) {
    const p = (te - B.volleyEnd) / (B.netSettleEnd - B.volleyEnd);
    return { x: d.volleyTarget.x, y: lerp(d.volleyTarget.y, 0.25, p * p), z: d.volleyTarget.z };
  }
  return { x: d.volleyTarget.x, y: 0.25, z: d.volleyTarget.z };
}

function evaluateHeroes(ctx: EvalCtx, attackIdx: number, defendIdx: number): ArcadeActorFrame[] {
  const { data: d, time: t } = ctx;
  const ball = evaluateChaosBall(ctx);
  const phases = d.breathPhases;
  const { te: teHold } = applyHold(t, B.barHit, B.holdLen);

  // Shooter: approaches, strikes, head-in-hands at the clang, joins the party.
  const shPos = evaluateTrackCR(shooterKeys(d), t);
  const kickP = segmentProgress(t, B.shotStart - 0.1, B.shotStart + 0.05);
  const ballAt25 = evaluateChaosBall({ ...ctx, time: 2.5 });
  const shooterRef = evaluateTrackCR(shooterKeys(d), 2.5);
  const goalMouth: Vec2 = { x: GOAL_X, z: 0 };
  let shooterFace: { facingX: number; facingZ: number };
  if (t < 2.5) {
    shooterFace = arcadeFacing(shPos, ball);
  } else if (t < 3.3) {
    shooterFace = angleBlendFocus(shooterRef, ballAt25, goalMouth, t, 2.5, 3.3);
  } else {
    shooterFace = arcadeFacing(shPos, goalMouth);
  }
  let shooter: ArcadeActorFrame = {
    ...arcadeBaseActor(2, attackIdx, 9, 'Shooter', false, shPos, ball, phases[2], t),
    legSwing: arcadeStride(t, 0.9) * arcadeMoveWindow(t, 0.5, 2.6)
      + arcadeStride(t, 1.0) * arcadeMoveWindow(t, 5.4, 6.9)
      - 1.1 * segmentProgress(t, B.shotStart - 0.35, B.shotStart) * (1 - kickP) + 0.9 * kickP,
  };
  shooter.facingX = shooterFace.facingX; shooter.facingZ = shooterFace.facingZ;
  if (t >= 4.5 && t < 5.4) shooter = applyArcadePose(shooter, handsOnHeadPose(segmentProgress(t, 4.5, 4.8) * (1 - segmentProgress(t, 5.1, 5.4))));
  if (t >= B.celebStart) shooter = applyArcadePose(shooter, armsUpPose(segmentProgress(t, B.celebStart, B.celebStart + 0.3)));

  // Poacher: reads the rebound, times the run, first-time volley, celebrates.
  const poPos = evaluateTrackCR(poacherKeys(d), t);
  const volleyKick = segmentProgress(teHold, B.volleyContact - 0.12, B.volleyContact);
  const ballAt55 = evaluateChaosBall({ ...ctx, time: 5.5 });
  const poacherRef = evaluateTrackCR(poacherKeys(d), 5.5);
  const volleyAim: Vec2 = { x: d.volleyTarget.x, z: d.volleyTarget.z };
  let poacherFace: { facingX: number; facingZ: number };
  if (t < 5.5) {
    poacherFace = arcadeFacing(poPos, ball);
  } else if (t < B.volleyContact) {
    poacherFace = angleBlendFocus(poacherRef, ballAt55, volleyAim, t, 5.5, B.volleyContact);
  } else {
    poacherFace = arcadeFacing(poPos, volleyAim);
  }
  let poacher: ArcadeActorFrame = {
    ...arcadeBaseActor(1, attackIdx, 7, 'Poacher', false, poPos, ball, phases[1], t),
    legSwing: arcadeStride(t, 2.4) * arcadeMoveWindow(t, 4.4, 6.7) + 0.9 * volleyKick,
  };
  poacher.facingX = poacherFace.facingX; poacher.facingZ = poacherFace.facingZ;
  if (t >= B.celebStart + 0.2) {
    poacher = applyArcadePose(poacher, armsUpPose(segmentProgress(t, B.celebStart + 0.2, B.celebStart + 0.5)));
  }

  // Defender: beaten by the shot, FREEZES at the clang, scrambles to the
  // drop, slumps at the goal.
  const defPos = evaluateTrackCR(defKeys(d), t);
  let defender: ArcadeActorFrame = {
    ...arcadeBaseActor(3, defendIdx, 4, 'Defender', false, defPos, ball, phases[3], t),
    legSwing: arcadeStride(t, 1.1) * arcadeMoveWindow(t, 0.4, 3.2) + arcadeStride(t, 1.5) * arcadeMoveWindow(t, 5.6, 6.9),
  };
  if (t >= 4.5 && t < 5.5) {
    defender = applyArcadePose(defender, handsOnHeadPose(segmentProgress(t, 4.5, 4.8) * (1 - segmentProgress(t, 5.2, 5.5))));
  }
  if (t >= B.volleyEnd) {
    defender = applyArcadePose(defender, handsOnHeadPose(segmentProgress(t, B.volleyEnd, B.celebStart)));
  }

  // Keeper: heroic dive at the shot, stranded look-up while the ball hangs,
  // desperate scramble at the volley, kneeling despair.
  const keeperPos = evaluateTrack(keeperKeys(d), t);
  const diveP = segmentProgress(t, 3.5, 4.4);
  const landP = segmentProgress(t, 4.5, 5.2);
  const dirZ = Math.sign(d.diveSpot.z - d.keeperHome.z) || 1;
  const diveGaze: Vec2 = { x: d.barPoint.x, z: d.barPoint.z };
  const ballAt37 = evaluateChaosBall({ ...ctx, time: 3.7 });
  const keeperRef = evaluateTrack(keeperKeys(d), B.barHit);
  const ballAt66 = evaluateChaosBall({ ...ctx, time: 6.6 });
  const keeperRef66 = evaluateTrack(keeperKeys(d), B.volleyEnd);
  const volleyCorner: Vec2 = { x: d.volleyTarget.x, z: d.volleyTarget.z };
  let keeperFace: { facingX: number; facingZ: number };
  if (t < 3.7) {
    keeperFace = arcadeFacing(keeperPos, ball);
  } else if (t < B.barHit) {
    keeperFace = angleBlendFocus(keeperRef, ballAt37, diveGaze, t, 3.7, B.barHit);
  } else if (t < 6.6) {
    keeperFace = arcadeFacing(keeperPos, ball);
  } else if (t < B.volleyEnd) {
    keeperFace = angleBlendFocus(keeperRef66, ballAt66, volleyCorner, t, 6.6, B.volleyEnd);
  } else {
    keeperFace = arcadeFacing(keeperPos, ball);
  }
  let keeper = arcadeBaseActor(6, defendIdx, 1, 'Keeper', true, keeperPos, ball, phases[0] + 2, t);
  keeper.facingX = keeperFace.facingX; keeper.facingZ = keeperFace.facingZ;
  keeper = applyArcadePose(keeper, keeperDivePose(Math.min(1, diveP), dirZ, landP));
  if (t >= 5.2 && t < 6.6) {
    // Stranded, tracking the ball hanging overhead: arched look-up.
    keeper = { ...keeper, lean: keeper.lean - 0.45 * segmentProgress(t, 5.2, 5.6) * (1 - segmentProgress(t, 6.3, 6.6)) };
  }
  if (t >= 6.6) {
    // Desperate second launch, released into the kneel.
    const sc = segmentProgress(t, 6.6, 7.2);
    const rel = 1 - segmentProgress(t, 7.2, 7.5);
    const dp = keeperDivePose(sc, -dirZ, 0);
    keeper = applyArcadePose(keeper, {
      bob: dp.bob * rel, lean: dp.lean * rel, armLift: dp.armLift * rel,
      armSpread: dp.armSpread * rel, legSwing: 0, roll: 0, spin: 0,
    });
  }
  if (t >= 7.6) keeper = applyArcadePose(keeper, keeperKneelPose(segmentProgress(t, 7.6, 8.1)));

  // Midfielder: trails, joins the second celebration.
  const midPos = { x: d.shooterStart.x + 2 + t * 0.9, z: d.shooterStart.z - 3 };
  const mid: ArcadeActorFrame = {
    ...arcadeBaseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t),
    legSwing: arcadeStride(t, 0.4) * arcadeMoveWindow(t, 0.2, 3.0),
    armLift: 1.5 * segmentProgress(t, 7.8, 8.2),
    armSpread: 0.5 * segmentProgress(t, 7.8, 8.2),
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
  for (const s of CROSSBAR_SHOTS) {
    if (time < s.end) return s;
  }
  return CROSSBAR_SHOTS[CROSSBAR_SHOTS.length - 1];
}

function evaluateChaosCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t } = ctx;
  const L = d.cameraLateral;
  const shot = activeShot(t);
  switch (shot.name) {
    case 'broadcast-wide':
      return presetLens('broadcast-wide', { ball, goalX: GOAL_X, lateral: L });
    case 'broadcast-medium':
      return presetLens('broadcast-medium', { ball, goalX: GOAL_X, lateral: L });
    case 'ball-follow':
      return presetLens('ball-follow', { ball, goalX: GOAL_X, lateral: L });
    case 'wide-goal':
      // One held camera for the whole rebound story: the ball rises, hangs
      // and descends while keeper + defenders + arriving poacher stay in
      // frame with the bar and goal. The look rides the ball's height so
      // the hang reads without losing the ground action.
      return {
        pos: { x: ball.x - 9 + L, y: 10.5, z: ball.z + 12 },
        look: { x: ball.x + 5, y: Math.max(1.4, 0.5 + ball.y * 0.35), z: ball.z * 0.5 },
        fov: 58,
      };
    case 'shot-impact': {
      // Ball-riding impact punch: close at the volley, then the camera rides
      // the ball toward the goal so the strike AND its target stay readable.
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
      const s = d.dropPoint;
      const p = segmentProgress(t, B.celebStart, 9.5);
      return {
        pos: { x: lerp(s.x - 3, s.x - 2, p) + L, y: lerp(3.8, 3.1, p), z: lerp(s.z + 13, s.z + 11, p) },
        look: { x: s.x + 1, y: 1.1, z: s.z },
        fov: 52,
      };
    }
    default:
      throw new Error(`Unknown cross shot: ${shot.name}`);
  }
}

function evaluateChaosEffects(ctx: EvalCtx): CrossbarFrameDescription['effects'] {
  const { data: d, seed, time: t } = ctx;
  const shotP = segmentProgress(t, B.shotStart, B.barHit);
  const volleyP = segmentProgress(t, B.volleyContact, B.volleyEnd);
  const volleyFade = 1 - segmentProgress(t, B.volleyEnd, B.netSettleEnd);
  const intensity = Math.max(
    shotP > 0 && shotP < 1 ? 1 : 0,
    volleyP > 0 && volleyFade > 0 ? Math.min(volleyP * 4, 1) * volleyFade : 0,
  );
  const from: Vec3 = volleyP > 0 ? { ...d.reboundLand, y: 0.5 } : d.shotFrom;
  // Crossbar clang: the biggest punch in the clip + metallic shake.
  const clang = 5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.barHit) / 0.45)));
  const volleyPunch = 3 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.volleyContact) / 0.35)));
  const shakeAmp = 0.16 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.barHit) / 0.6)))
    + 0.1 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.volleyContact) / 0.5)));
  return {
    trailFrom: intensity > 0.01 ? { ...from } : null,
    trailIntensity: intensity,
    fovPunch: Math.max(0, clang) + Math.max(0, volleyPunch),
    shakeX: Math.sin(t * 11.3 + seed) * shakeAmp,
    shakeY: Math.cos(t * 9.1 + seed * 1.4) * shakeAmp * 0.6,
  };
}

/**
 * Supporter comedy: rise for the shot, FALSE-DAWN eruption as the ball looks
 * in, frozen gasp while it hangs, then the real double eruption.
 */
export function evaluateChaosCrowd(time: number, seed: number, attackIdx: TeamId): SocialCrowdState {
  if (time < B.shotStart) {
    const p = Math.min(1, Math.max(0, time / B.shotStart));
    return { mood: 'anticipation', intensity: 0.25 + 0.45 * p, time, seed, moodTime: time };
  }
  if (time < B.barHit) return { mood: 'anticipation', intensity: 1, time, seed, moodTime: time - B.shotStart };
  if (time < 4.85) {
    return { mood: 'goal', intensity: 1, time, seed, scoringTeam: attackIdx, moodTime: time - B.barHit };
  }
  if (time < 5.5) {
    return { mood: 'anticipation', intensity: 0.35, time, seed, moodTime: time - 4.85 };
  }
  if (time < 7.3) {
    const p = (time - 5.5) / 1.8;
    return { mood: 'anticipation', intensity: 0.4 + 0.6 * p, time, seed, moodTime: time - 5.5 };
  }
  const moodTime = time - 7.3;
  const intensity = time < 9.5 ? 1 - 0.35 * (moodTime / 2.2) : 0.6;
  return { mood: 'goal', intensity, time, seed, scoringTeam: attackIdx, moodTime };
}

export function evaluateCrossbarFrame(args: {
  data: CrossbarTimelineData;
  home: string;
  away: string;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
}): CrossbarFrameDescription {
  const { data, home, away, seed, frame, fps, duration } = args;
  void home;
  void away;
  const time = frame / fps;
  const ctx: EvalCtx = { data, seed, frame, fps, duration, time };
  const attackIdx = (data.attackSign === 1 ? 0 : 1) as TeamId;
  const defendIdx = (data.attackSign === 1 ? 1 : 0) as TeamId;

  const ball = evaluateChaosBall(ctx);
  const heroes = evaluateHeroes(ctx, attackIdx, defendIdx);
  const background = evaluateBackground(ctx, attackIdx, defendIdx, ball);
  const camera = evaluateChaosCamera(ctx, ball);
  const effects = evaluateChaosEffects(ctx);
  const crowd = evaluateChaosCrowd(time, seed, attackIdx);

  if (data.attackSign === 1) {
    return { scene: 'crossbar-chaos', frame, time, actors: [...heroes, ...background], ball, camera, clock: time, effects, crowd };
  }
  const mirrorActor = (a: ArcadeActorFrame): ArcadeActorFrame => ({ ...a, x: -a.x, facingX: -a.facingX });
  return {
    scene: 'crossbar-chaos',
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

export function crossbarFrameToRenderInput(
  desc: CrossbarFrameDescription,
  homeCode: string,
  awayCode: string,
): CrossbarRenderInput {
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
