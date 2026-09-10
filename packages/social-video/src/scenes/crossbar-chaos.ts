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
  arcadeMoveWindow, arcadeStride, armsUpPose, handsOnHeadPose, headerShot,
  keeperDivePose, keeperKneelPose, skyRebound,
  type ArcadeActorFrame,
} from '../timeline/arcade';
import { seededRandom } from './faceoff';

/**
 * CROSSBAR CHAOS: long shot → CLANG off the bar (false-dawn eruption) →
 * ball hangs in the sky (collective gasp) → scramble → rebound volley →
 * GOAL (double eruption). Deterministic, random-access, pure.
 */

export const GOAL_X = FIELD.halfLength;
/** The staged bar contact point (front face of the crossbar). */
export const BAR_POINT_Y = FIELD.goalHeight;

export const CROSSBAR_BEATS = {
  shotStart: 0.9,
  barHit: 1.6,
  /** Deliberate crossbar hold: frozen clang (4 frames at 60fps). */
  holdLen: 0.06,
  reboundEnd: 2.9,
  volleyContact: 3.4,
  volleyEnd: 3.85,
  netSettleEnd: 4.15,
  celebStart: 4.3,
} as const;

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
  const reboundLand: Vec3 = { x: 39.5, y: 0.4, z: 0.5 * lane + j * 0.3 };
  const poacherStart = { x: 33, z: -2.5 * lane + j };
  const dropPoint = { x: 40, z: 0.8 * lane + j * 0.3 };
  const volleyTarget: Vec3 = { x: GOAL_X + 1.2, y: 1.1, z: -2.5 * lane };
  const keeperHome = { x: GOAL_X - 2.7, z: 0.5 * lane + keeperJitter };
  const diveSpot = { x: GOAL_X - 1.7, z: 1.8 * lane };
  const keeperScramble = { x: GOAL_X - 2.4, z: -1.5 * lane };
  const defStart = { x: 30, z: -6 * lane + j };
  const defSpot = { x: 36, z: -3 * lane + j * 0.5 };

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
    keeperHome, diveSpot, keeperScramble, defStart, defSpot,
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
    { time: 0.4, x: d.shooterStart.x + 2, z: d.shooterStart.z },
    { time: B.shotStart, x: d.strikeSpot.x, z: d.strikeSpot.z },
    { time: 99, x: d.strikeSpot.x + 1, z: d.strikeSpot.z },
  ];
}

function poacherKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.poacherStart.x, z: d.poacherStart.z },
    { time: 1.6, x: d.poacherStart.x + 1.5, z: d.poacherStart.z },
    { time: 3.25, x: d.dropPoint.x, z: d.dropPoint.z },
    { time: 99, x: d.dropPoint.x + 1, z: d.dropPoint.z },
  ];
}

function defKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.defStart.x, z: d.defStart.z },
    { time: B.shotStart, x: d.defStart.x + 3, z: d.defStart.z + 1.5 },
    { time: 1.7, x: d.defSpot.x, z: d.defSpot.z },
    { time: 99, x: d.defSpot.x, z: d.defSpot.z },
  ];
}

function keeperKeys(d: CrossbarTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 0.95, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 1.7, x: d.diveSpot.x, z: d.diveSpot.z },
    { time: 2.4, x: d.diveSpot.x - 0.5, z: d.diveSpot.z },
    { time: 3.3, x: d.keeperScramble.x, z: d.keeperScramble.z },
    { time: 3.9, x: d.keeperScramble.x, z: d.keeperScramble.z },
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
  if (te < B.reboundEnd) {
    return skyRebound(d.barPoint, d.reboundLand, (te - B.barHit) / (B.reboundEnd - B.barHit), 7.5);
  }
  if (te < B.volleyContact) {
    const p = (te - B.reboundEnd) / (B.volleyContact - B.reboundEnd);
    return {
      x: lerp(d.reboundLand.x, d.dropPoint.x, p),
      y: lerp(d.reboundLand.y, 0.5, p),
      z: lerp(d.reboundLand.z, d.dropPoint.z, p),
    };
  }
  if (te < B.volleyEnd) {
    const contact: Vec3 = { ...d.dropPoint, y: 0.5 };
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

  // Shooter: strikes, grabs his head at the clang, celebrates the rebound.
  // Gaze in angle space: the release happens at his own feet.
  const shPos = evaluateTrackCR(shooterKeys(d), t);
  const kickP = segmentProgress(t, B.shotStart - 0.1, B.shotStart + 0.05);
  const ballAt06 = evaluateChaosBall({ ...ctx, time: 0.6 });
  const shooterRef = evaluateTrackCR(shooterKeys(d), 0.6);
  const goalMouth: Vec2 = { x: GOAL_X, z: 0 };
  let shooterFace: { facingX: number; facingZ: number };
  if (t < 0.6) {
    shooterFace = arcadeFacing(shPos, ball);
  } else if (t < 1.2) {
    shooterFace = angleBlendFocus(shooterRef, ballAt06, goalMouth, t, 0.6, 1.2);
  } else {
    shooterFace = arcadeFacing(shPos, goalMouth);
  }
  let shooter: ArcadeActorFrame = {
    ...arcadeBaseActor(2, attackIdx, 9, 'Shooter', false, shPos, ball, phases[2], t),
    legSwing: -1.1 * segmentProgress(t, B.shotStart - 0.3, B.shotStart) * (1 - kickP) + 0.9 * kickP,
  };
  shooter.facingX = shooterFace.facingX; shooter.facingZ = shooterFace.facingZ;
  if (t >= 1.7 && t < 3.3) shooter = applyArcadePose(shooter, handsOnHeadPose(segmentProgress(t, 1.7, 2.0) * (1 - segmentProgress(t, 3.0, 3.3))));
  if (t >= B.celebStart) shooter = applyArcadePose(shooter, armsUpPose(segmentProgress(t, B.celebStart, B.celebStart + 0.3)));

  // Poacher: reacts late, scrambles to the drop, volleys, celebrates. Gaze
  // in angle space: he stands exactly where the ball lands, so facing the
  // dropping ball in 2D is singular (it ends at his own feet). Instead he
  // picks out the volley target early — eyes up, correct technique — with
  // the blend anchored on the frozen ball at window start (identical point,
  // so the handoff is seamless) measured from the drop point where he then
  // stands statue-still.
  const poPos = evaluateTrackCR(poacherKeys(d), t);
  const volleyKick = segmentProgress(teHold, B.volleyContact - 0.12, B.volleyContact);
  const ballAt30 = evaluateChaosBall({ ...ctx, time: 3.0 });
  const poacherRef = evaluateTrackCR(poacherKeys(d), 3.0);
  const volleyAim: Vec2 = { x: d.volleyTarget.x, z: d.volleyTarget.z };
  let poacherFace: { facingX: number; facingZ: number };
  if (t < 3.0) {
    poacherFace = arcadeFacing(poPos, ball);
  } else if (t < B.volleyContact) {
    poacherFace = angleBlendFocus(poacherRef, ballAt30, volleyAim, t, 3.0, B.volleyContact);
  } else {
    poacherFace = arcadeFacing(poPos, volleyAim);
  }
  let poacher: ArcadeActorFrame = {
    ...arcadeBaseActor(1, attackIdx, 7, 'Poacher', false, poPos, ball, phases[1], t),
    legSwing: arcadeStride(t, 2.4) * arcadeMoveWindow(t, 1.7, 3.3) + 0.9 * volleyKick,
  };
  poacher.facingX = poacherFace.facingX; poacher.facingZ = poacherFace.facingZ;
  if (t >= B.celebStart + 0.2) {
    poacher = applyArcadePose(poacher, armsUpPose(segmentProgress(t, B.celebStart + 0.2, B.celebStart + 0.5)));
  }

  // Defender: beaten by the shot, FREEZES at the clang, slumps at the goal.
  const defPos = evaluateTrackCR(defKeys(d), t);
  let defender: ArcadeActorFrame = {
    ...arcadeBaseActor(3, defendIdx, 4, 'Defender', false, defPos, ball, phases[3], t),
    legSwing: arcadeStride(t, 1.1) * arcadeMoveWindow(t, 0, 1.6),
  };
  if (t >= 1.7) {
    const freeze = segmentProgress(t, 1.7, 2.0) * (1 - segmentProgress(t, B.volleyEnd, B.celebStart));
    defender = applyArcadePose(defender, handsOnHeadPose(freeze));
    defender = { ...defender, lean: defender.lean + 0.2 * segmentProgress(t, B.volleyEnd, B.celebStart) };
  }

  // Keeper: heroic dive, grounded look-up while the ball hangs, desperate
  // scramble at the volley, kneeling despair. The shot flies PAST his eyes
  // onto the bar, so tracking it turns his head ~160° either way: the turn
  // is spread over a long early window (pick it up early, ride it past)
  // instead of whipping at the pass-by. The blend reference is the DIVE END
  // position: this landing is arrival-critical (the clang frame must face
  // the bar exactly), and the start anchor is 15m away so the entry
  // parallax is a few degrees. After the clang the rebound rises almost
  // vertically in 2D, so live tracking stays calm; the lean arch sells the
  // look-up.
  const keeperPos = evaluateTrack(keeperKeys(d), t);
  const diveP = segmentProgress(t, 0.95, 1.7);
  const landP = segmentProgress(t, 1.8, 2.4);
  const dirZ = Math.sign(d.diveSpot.z - d.keeperHome.z) || 1;
  const diveGaze: Vec2 = { x: d.barPoint.x, z: d.barPoint.z };
  const ballAt10 = evaluateChaosBall({ ...ctx, time: 1.0 });
  const keeperRef = evaluateTrack(keeperKeys(d), B.barHit);
  const ballAt33 = evaluateChaosBall({ ...ctx, time: 3.3 });
  const keeperRef33 = evaluateTrack(keeperKeys(d), B.volleyEnd);
  const volleyCorner: Vec2 = { x: d.volleyTarget.x, z: d.volleyTarget.z };
  let keeperFace: { facingX: number; facingZ: number };
  if (t < 1.0) {
    keeperFace = arcadeFacing(keeperPos, ball);
  } else if (t < B.barHit) {
    keeperFace = angleBlendFocus(keeperRef, ballAt10, diveGaze, t, 1.0, B.barHit);
  } else if (t < 3.3) {
    keeperFace = arcadeFacing(keeperPos, ball);
  } else if (t < B.volleyEnd) {
    keeperFace = angleBlendFocus(keeperRef33, ballAt33, volleyCorner, t, 3.3, B.volleyEnd);
  } else {
    keeperFace = arcadeFacing(keeperPos, ball);
  }
  let keeper = arcadeBaseActor(6, defendIdx, 1, 'Keeper', true, keeperPos, ball, phases[0] + 2, t);
  keeper.facingX = keeperFace.facingX; keeper.facingZ = keeperFace.facingZ;
  keeper = applyArcadePose(keeper, keeperDivePose(Math.min(1, diveP), dirZ, landP));
  if (t >= 2.2 && t < 3.3) {
    // Stranded, tracking the ball hanging overhead: arched look-up.
    keeper = { ...keeper, lean: keeper.lean - 0.45 * segmentProgress(t, 2.2, 2.5) * (1 - segmentProgress(t, 3.0, 3.3)) };
  }
  if (t >= 3.3) {
    // Desperate second launch, then released smoothly into the kneel that
    // follows (never a branch-edge snap back to neutral).
    const sc = segmentProgress(t, 3.3, 3.9);
    const rel = 1 - segmentProgress(t, 3.9, 4.2);
    const dp = keeperDivePose(sc, -dirZ, 0);
    keeper = applyArcadePose(keeper, {
      bob: dp.bob * rel, lean: dp.lean * rel, armLift: dp.armLift * rel,
      armSpread: dp.armSpread * rel, legSwing: 0, roll: 0, spin: 0,
    });
  }
  if (t >= 4.2) keeper = applyArcadePose(keeper, keeperKneelPose(segmentProgress(t, 4.2, 4.7)));

  // Midfielder: trails, joins the second celebration.
  const midPos = { x: d.shooterStart.x + 2 + t * 0.9, z: d.shooterStart.z - 3 };
  const mid: ArcadeActorFrame = {
    ...arcadeBaseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t),
    legSwing: arcadeStride(t, 0.4) * arcadeMoveWindow(t, 0.2, 1.6),
    armLift: 1.5 * segmentProgress(t, 4.4, 4.8),
    armSpread: 0.5 * segmentProgress(t, 4.4, 4.8),
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

function evaluateChaosCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t, duration } = ctx;
  const L = d.cameraLateral;
  if (t < B.shotStart) {
    return {
      pos: { x: ball.x - 4 + L, y: 10.5, z: ball.z + 12.5 },
      look: { x: ball.x + 2.5, y: 0.7, z: ball.z - 2 },
      fov: 52,
    };
  }
  if (t < B.barHit) {
    return {
      pos: { x: ball.x - 8 + L, y: 4.5, z: ball.z + 9.5 },
      look: { x: ball.x + 2.5, y: 1.2, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < 2.0) {
    // Clang closeup: bar, net edge and stranded keeper in one frame.
    return {
      pos: { x: 38 + L, y: 3.0, z: 8 },
      look: { x: GOAL_X, y: 2.5, z: 1 },
      fov: 50,
    };
  }
  if (t < B.reboundEnd) {
    // The ball hangs: tilt up with it, keeper small below.
    return {
      pos: { x: 33 + L, y: 2.5, z: 10 },
      look: { x: ball.x + 1, y: Math.max(2.5, ball.y - 1), z: ball.z },
      fov: 54,
    };
  }
  if (t < B.volleyContact) {
    const s = d.dropPoint;
    return {
      pos: { x: s.x - 2 + L, y: 2.4, z: s.z + 6 },
      look: { x: s.x, y: 0.8, z: s.z },
      fov: 50,
    };
  }
  if (t < B.volleyEnd + 0.3) {
    const m = d.dropPoint;
    return {
      pos: { x: m.x - 1.5 + L, y: 2.2, z: m.z + 4.5 },
      look: { x: m.x + 2, y: 1.2, z: m.z - 1 },
      fov: 48,
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
  const s = d.dropPoint;
  const p = segmentProgress(t, B.celebStart, Math.min(duration, 6));
  return {
    pos: { x: lerp(s.x - 3, s.x - 2, p) + L, y: lerp(3.8, 3.1, p), z: lerp(s.z + 13, s.z + 11, p) },
    look: { x: s.x + 1, y: 1.1, z: s.z },
    fov: 52,
  };
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
  const from: Vec3 = volleyP > 0 ? { ...d.dropPoint, y: 0.5 } : d.shotFrom;
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
    return { mood: 'anticipation', intensity: 0.3 + 0.4 * p, time, seed, moodTime: time };
  }
  if (time < B.barHit) return { mood: 'anticipation', intensity: 1, time, seed, moodTime: time - B.shotStart };
  if (time < 1.95) {
    return { mood: 'goal', intensity: 1, time, seed, scoringTeam: attackIdx, moodTime: time - B.barHit };
  }
  if (time < 3.8) {
    return { mood: 'anticipation', intensity: 0.45, time, seed, moodTime: time - 1.95 };
  }
  const moodTime = time - 3.8;
  const intensity = time < 6 ? 1 - 0.3 * (moodTime / 2.2) : 0.6;
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
