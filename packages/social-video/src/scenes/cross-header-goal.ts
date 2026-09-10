import { FIELD, type MatchState, type Player, type Team, type TeamId } from '../../../../apps/game/src/types';
import type { SocialActorPose, SocialEffects } from '../../../../apps/game/src/renderer';
import type { SocialCrowdState } from '../../../../apps/game/src/render/crowd';
import { goalCineShot, goalCineVariant } from '../../../../apps/game/src/render/camera';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { AttackStyle, ResolvedVideoSpec } from '../schema';
import type { SocialLens } from '../cameras/social-camera';
import { lerp, segmentProgress, smoothstep } from '../timeline/math';
import { ballSpeedAt, evaluateTrack, evaluateTrackCR, groundPass, velocityTrailGate, type ActorKeyframe, type Vec2, type Vec3 } from '../timeline/tracks';
import {
  applyArcadePose, applyHold, angleBlendFocus, arcadeBaseActor, arcadeFacing, arcadeMoveWindow,
  arcadeStride, armsUpPose, handsOnHeadPose, headerShot,
  keeperDivePose, keeperKneelPose, powerHeaderPose, whippedCross,
  type ArcadeActorFrame,
} from '../timeline/arcade';
import { seededRandom } from './faceoff';

/**
 * CROSS → HEADER → GOAL: winger sprint, whipped cross, ball-follow with a
 * ball-near-lens insert, striker + defender leap, slow-tension header,
 * keeper flies, goal, eruption. Deterministic semantic choreography over
 * real HNC entities — pure function of (spec, seed, time), random-access.
 */

export const GOAL_X = FIELD.halfLength;

/** Beat boundaries in seconds (6s default cut). */
export const CROSS_HEADER_BEATS = {
  crossContact: 1.3,
  lensStart: 1.7,
  lensEnd: 2.0,
  mouthStart: 2.0,
  leapStart: 2.3,
  contact: 2.6,
  /** Deliberate impact hold: contact freezes (3 frames at 60fps). */
  holdLen: 0.05,
  headerEnd: 3.15,
  netSettleEnd: 3.45,
  celebStart: 3.6,
} as const;

export interface CrossHeaderFrameDescription {
  scene: 'cross-header-goal';
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

export interface CrossHeaderRenderInput {
  state: MatchState;
  camera: SocialLens;
  clock: number;
  pose: SocialActorPose[];
  effects: SocialEffects;
  crowd: SocialCrowdState;
}

export interface CrossHeaderTimelineData {
  attackSign: 1 | -1;
  style: AttackStyle;
  lane: 1 | -1;
  cameraLateral: number;
  cineVariant: 0 | 1 | 2;
  wingStart: Vec2;
  crossSpot: Vec2;
  crossFrom: Vec3;
  contactPoint: Vec3;
  strikerStart: Vec2;
  meetGround: Vec2;
  defenderStart: Vec2;
  defGround: Vec2;
  keeperHome: Vec2;
  diveSpot: Vec2;
  headerTarget: Vec3;
  carrierDir: Vec2;
  lensPos: Vec3;
  lensLook: Vec3;
  bgSpots: { x: number; z: number; attack: boolean }[];
  breathPhases: number[];
}

export function compileCrossHeaderTimeline(
  spec: Pick<ResolvedVideoSpec, 'seed' | 'attackTeam' | 'attackStyle'>,
): CrossHeaderTimelineData {
  const rand = seededRandom(spec.seed * 7 + 13);
  const lane = (rand() < 0.5 ? -1 : 1) as 1 | -1;
  const j = (rand() - 0.5) * 3;
  const keeperJitter = (rand() - 0.5) * 2;
  const cameraLateral = (rand() - 0.5) * 0.7;
  const breathPhases = [rand(), rand(), rand(), rand()].map((r) => r * Math.PI * 2);

  const wingStart = { x: 8, z: 13 * lane + j };
  const crossSpot = { x: 26, z: 13 * lane + j * 0.5 };
  const crossFrom: Vec3 = { x: 26.7, y: 0.3, z: 13 * lane + j * 0.5 };
  const contactPoint: Vec3 = { x: 38.5, y: 1.8, z: 0.5 * lane + j * 0.3 };
  const strikerStart = { x: 31, z: -3.5 * lane + j };
  const meetGround = { x: 38.5, z: 0.5 * lane + j * 0.3 };
  const defenderStart = { x: 35.5, z: -4.5 * lane + j };
  const defGround = { x: 37.6, z: -1.2 * lane + j * 0.3 };
  const keeperHome = { x: GOAL_X - 2.7, z: 2.0 * lane + keeperJitter };
  const headerTarget: Vec3 = { x: GOAL_X + 1.2, y: 0.9, z: -2.8 * lane };
  const diveSpot = { x: GOAL_X - 2.0, z: -1.0 * lane };
  const carrierDir = { x: 1, z: 0 };

  // Ball-near-lens insert: parked beside the cross flight so the ball sweeps
  // past the lens mid-beat, then a hard cut away. Computed from the staged
  // flight (never eyeballed per seed). The side facing pitch centre is
  // chosen so the lens looks at the ball against crowd/pitch — never into a
  // floodlight pylon.
  const mid = whippedCross(crossFrom, contactPoint, 0.45, 3.4, 2.5);
  const mdx = contactPoint.x - crossFrom.x, mdz = contactPoint.z - crossFrom.z;
  const ml = Math.hypot(mdx, mdz) || 1;
  const px = -mdz / ml, pz = mdx / ml;
  const pylons = [[-58, -38], [58, -38], [-58, 38], [58, 38]];
  const scoreSide = (s: number): number => {
    const lx = mid.x + px * 4 * s, lz = mid.z + pz * 4 * s;
    const vx = mid.x - lx, vz = mid.z - lz;
    const vl = Math.hypot(vx, vz) || 1;
    let worst = Infinity;
    for (const [qx, qz] of pylons) {
      const wx = qx - lx, wz = qz - lz;
      const wl = Math.hypot(wx, wz) || 1;
      const cos = (vx * wx + vz * wz) / (vl * wl);
      if (cos > 0.9 && wl < worst) worst = wl;
    }
    return worst;
  };
  const side = scoreSide(1) >= scoreSide(-1) ? 1 : -1;
  const lensPos: Vec3 = { x: mid.x + px * 4.0 * side, y: mid.y + 0.2, z: mid.z + pz * 4.0 * side };
  const lensLook: Vec3 = { ...mid };

  const bgSpots = [
    { x: 2, z: 6 * lane, attack: true },
    { x: 14, z: -8 * lane, attack: true },
    { x: 30, z: 10 * lane, attack: false },
    { x: 20, z: -12 * lane, attack: false },
    { x: 40, z: -10 * lane, attack: false },
    { x: -8, z: -4 * lane, attack: false },
  ];
  return {
    attackSign: spec.attackTeam === 'home' ? 1 : -1,
    style: spec.attackStyle,
    lane,
    cameraLateral,
    cineVariant: goalCineVariant(1, headerTarget.x, headerTarget.z),
    wingStart, crossSpot, crossFrom, contactPoint,
    strikerStart, meetGround, defenderStart, defGround,
    keeperHome, diveSpot, headerTarget, carrierDir,
    lensPos, lensLook, bgSpots, breathPhases,
  };
}

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

const B = CROSS_HEADER_BEATS;

interface EvalCtx {
  data: CrossHeaderTimelineData;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
  time: number;
}

function wingKeys(d: CrossHeaderTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.wingStart.x, z: d.wingStart.z },
    { time: 0.3, x: d.wingStart.x, z: d.wingStart.z },
    { time: B.crossContact, x: d.crossSpot.x, z: d.crossSpot.z },
    { time: B.crossContact + 0.5, x: d.crossSpot.x + 1, z: d.crossSpot.z },
    { time: 99, x: d.crossSpot.x + 1, z: d.crossSpot.z },
  ];
}

function strikerKeys(d: CrossHeaderTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.strikerStart.x, z: d.strikerStart.z },
    { time: 0.4, x: d.strikerStart.x + 2, z: d.strikerStart.z },
    { time: 2.5, x: d.meetGround.x, z: d.meetGround.z },
    { time: 99, x: d.meetGround.x, z: d.meetGround.z },
  ];
}

function defenderKeys(d: CrossHeaderTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.defenderStart.x, z: d.defenderStart.z },
    { time: 0.5, x: d.defenderStart.x + 1, z: d.defenderStart.z + 1 },
    { time: 2.55, x: d.defGround.x, z: d.defGround.z },
    { time: 99, x: d.defGround.x, z: d.defGround.z },
  ];
}

function keeperKeys(d: CrossHeaderTimelineData): ActorKeyframe[] {
  return [
    { time: 0, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 2.55, x: d.keeperHome.x, z: d.keeperHome.z },
    { time: 3.25, x: d.diveSpot.x, z: d.diveSpot.z },
    { time: 99, x: d.diveSpot.x, z: d.diveSpot.z },
  ];
}

function wingerBallAt(d: CrossHeaderTimelineData, t: number): Vec3 {
  const w = evaluateTrackCR(wingKeys(d), Math.min(t, B.crossContact));
  return { x: w.x + d.carrierDir.x * 0.7, y: 0.25, z: w.z + d.carrierDir.z * 0.7 };
}

function evaluateCrossBall(ctx: EvalCtx): Vec3 {
  const { data: d, time: t } = ctx;
  if (t < B.crossContact) return wingerBallAt(d, t);
  if (t < B.contact) {
    return whippedCross(d.crossFrom, d.contactPoint, (t - B.crossContact) / (B.contact - B.crossContact), 3.4, 2.5);
  }
  // Deliberate impact hold: the ball hangs at contact, then releases.
  const { te } = applyHold(t, B.contact, B.holdLen);
  if (te < B.contact) return { ...d.contactPoint };
  if (te < B.headerEnd) {
    return headerShot(d.contactPoint, d.headerTarget, (te - B.contact) / (B.headerEnd - B.contact), 0.7);
  }
  if (te < B.netSettleEnd) {
    const p = (te - B.headerEnd) / (B.netSettleEnd - B.headerEnd);
    return { x: d.headerTarget.x, y: lerp(d.headerTarget.y, 0.25, p * p), z: d.headerTarget.z };
  }
  return { x: d.headerTarget.x, y: 0.25, z: d.headerTarget.z };
}

function evaluateHeroes(ctx: EvalCtx, attackIdx: number, defendIdx: number): ArcadeActorFrame[] {
  const { data: d, time: t } = ctx;
  const ball = evaluateCrossBall(ctx);
  const phases = d.breathPhases;
  const { te: teHold } = applyHold(t, B.contact, B.holdLen);

  // Winger: sprint, cross, hold, late celebration. Gaze uses the
  // angle-domain blend (see striker): the touch happens at his own feet.
  const wingPos = evaluateTrackCR(wingKeys(d), t);
  const kickP = segmentProgress(t, B.crossContact - 0.12, B.crossContact);
  const wingLookAhead = { x: d.crossSpot.x + 8 * d.carrierDir.x, z: d.crossSpot.z + 8 * d.carrierDir.z };
  const ballAt1 = wingerBallAt(d, 1.0);
  const wingRef = evaluateTrackCR(wingKeys(d), 1.0);
  const ballAt19 = evaluateCrossBall({ ...ctx, time: 1.9 });
  const wingRef145 = evaluateTrackCR(wingKeys(d), 1.45);
  let wingFace: { facingX: number; facingZ: number };
  if (t < 1.0) {
    wingFace = arcadeFacing(wingPos, ball);
  } else if (t < 1.45) {
    wingFace = angleBlendFocus(wingRef, ballAt1, wingLookAhead, t, 1.0, 1.45);
  } else if (t < 1.9) {
    wingFace = angleBlendFocus(wingRef145, wingLookAhead, ballAt19, t, 1.45, 1.9);
  } else {
    wingFace = arcadeFacing(wingPos, ball);
  }
  let winger: ArcadeActorFrame = {
    ...arcadeBaseActor(1, attackIdx, 7, 'Winger', false, wingPos, ball, phases[1], t),
    legSwing: arcadeStride(t, 2.1) * arcadeMoveWindow(t, 0.2, 1.5) - 1.0 * kickP * (1 - kickP * 0.4),
    armLift: 1.5 * segmentProgress(t, 3.9, 4.3),
    armSpread: 0.5 * segmentProgress(t, 3.9, 4.3),
  };
  winger.facingX = wingFace.facingX; winger.facingZ = wingFace.facingZ;

  // Striker: run, leap, power header, arms-up celebration.
  const shPos = evaluateTrackCR(strikerKeys(d), t);
  const leapP = (teHold - B.leapStart) / 0.5;
  const leaping = teHold > B.leapStart && teHold < B.leapStart + 0.55;
  const contactP = (teHold - (B.contact - 0.15)) / 0.3;
  let striker: ArcadeActorFrame = {
    ...arcadeBaseActor(2, attackIdx, 9, 'Striker', false, shPos, ball, phases[2], t),
    legSwing: arcadeStride(t, 0.7) * arcadeMoveWindow(t, 0.2, 2.3),
  };
  if (leaping) striker = applyArcadePose(striker, powerHeaderPose(Math.min(1, Math.max(0, contactP))));
  // Striker gaze: the incoming-ball → far-corner line passes almost through
  // his own head, so point-lerping the focus whips the facing (1/r trap).
  // Instead the turn is interpolated in ANGLE space over long windows: eyes
  // on the cross, downfield commitment for the leap, watch it into the
  // corner, then the crowd. Pure, shortest-arc, no snaps.
  const downfield: Vec2 = { x: GOAL_X, z: d.meetGround.z };
  const ballAt2 = evaluateCrossBall({ ...ctx, time: 2.0 });
  const strikerRef = evaluateTrackCR(strikerKeys(d), 2.0);
  const crowdPt: Vec2 = { x: shPos.x + 7, z: shPos.z + 16 };
  let sFace: { facingX: number; facingZ: number };
  if (t < 2.0) {
    sFace = arcadeFacing(shPos, ball);
  } else if (t < 2.6) {
    sFace = angleBlendFocus(strikerRef, ballAt2, downfield, t, 2.0, 2.6);
  } else if (t < 3.0) {
    sFace = arcadeFacing(shPos, downfield);
  } else if (t < 3.45) {
    sFace = angleBlendFocus(strikerRef, downfield, d.headerTarget, t, 3.0, 3.45);
  } else if (t < B.celebStart) {
    sFace = angleBlendFocus(strikerRef, d.headerTarget, crowdPt, t, 3.45, B.celebStart);
  } else {
    sFace = arcadeFacing(shPos, crowdPt);
  }
  striker.facingX = sFace.facingX; striker.facingZ = sFace.facingZ;
  if (t >= B.celebStart) striker = applyArcadePose(striker, armsUpPose(segmentProgress(t, B.celebStart, B.celebStart + 0.3)));

  // Defender: chases late, mistimed leap, beaten hands-on-head.
  const defPos = evaluateTrackCR(defenderKeys(d), t);
  const dLeapP = (teHold - 2.45) / 0.5;
  const dLeaping = teHold > 2.45 && teHold < 3.0;
  let defender: ArcadeActorFrame = {
    ...arcadeBaseActor(3, defendIdx, 4, 'Defender', false, defPos, striker, phases[3], t),
    legSwing: arcadeStride(t, 1.3) * arcadeMoveWindow(t, 0.2, 2.5),
  };
  if (dLeaping) {
    const c = Math.min(1, Math.max(0, dLeapP));
    defender = applyArcadePose(defender, {
      bob: 4 * 0.38 * c * (1 - c), lean: 0.2 * Math.sin(c * Math.PI),
      armLift: 1.2 * Math.sin(c * Math.PI), armSpread: 0.3, legSwing: 0, roll: 0, spin: 0,
    });
  }
  if (t >= 3.3) defender = applyArcadePose(defender, handsOnHeadPose(segmentProgress(t, 3.3, 3.7)));

  // Keeper: set, heroic flight (short), ground, kneel.
  const keeperPos = evaluateTrack(keeperKeys(d), t);
  const diveP = segmentProgress(t, 2.55, 3.25);
  const landP = segmentProgress(t, 3.4, 4.0);
  const dirZ = Math.sign(d.diveSpot.z - d.keeperHome.z) || 1;
  let keeper = arcadeBaseActor(6, defendIdx, 1, 'Keeper', true, keeperPos, ball, phases[0] + 2, t);
  keeper = applyArcadePose(keeper, keeperDivePose(Math.min(1, diveP), dirZ, landP));
  if (t >= 3.9) keeper = applyArcadePose(keeper, keeperKneelPose(segmentProgress(t, 3.9, 4.4)));

  // Midfielder teammate: trails the play, joins celebration late.
  const midPos = { x: d.wingStart.x + 4 + t * 1.2, z: d.wingStart.z - 4 };
  const mid: ArcadeActorFrame = {
    ...arcadeBaseActor(0, attackIdx, 8, 'Midfielder', false, midPos, ball, phases[0], t),
    legSwing: arcadeStride(t, 0.4) * arcadeMoveWindow(t, 0.2, 2.0),
    armLift: 1.5 * segmentProgress(t, 4.0, 4.4),
    armSpread: 0.5 * segmentProgress(t, 4.0, 4.4),
  };

  return [mid, winger, striker, defender, keeper];
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

function evaluateCrossCamera(ctx: EvalCtx, ball: Vec3): SocialLens {
  const { data: d, time: t, duration } = ctx;
  const L = d.cameraLateral;
  if (t < 0.8) {
    return {
      pos: { x: ball.x - 4 + L, y: 10.5, z: ball.z + 12.5 },
      look: { x: ball.x + 2.5, y: 0.7, z: ball.z - 2 },
      fov: 52,
    };
  }
  if (t < B.crossContact) {
    const s = d.crossSpot;
    return {
      pos: { x: s.x + 3 + L, y: 3.2, z: s.z + 7.5 },
      look: { x: s.x, y: 1.0, z: s.z },
      fov: 50,
    };
  }
  if (t < B.lensStart) {
    return {
      pos: { x: ball.x - 7 + L, y: 4.2, z: ball.z + 8.5 },
      look: { x: ball.x + 2, y: 1.2, z: ball.z - 1 },
      fov: 53,
    };
  }
  if (t < B.lensEnd) {
    // Signature ball-near-lens: the cross sweeps past the parked camera.
    return { pos: { ...d.lensPos, x: d.lensPos.x + L }, look: { ...d.lensLook }, fov: 55 };
  }
  if (t < B.contact) {
    const m = d.meetGround;
    return {
      pos: { x: m.x - 2 + L, y: 2.6, z: m.z + 7 },
      look: { x: m.x, y: 1.6, z: m.z },
      fov: 52,
    };
  }
  if (t < 3.2) {
    // Header-impact hero: 3/4 striker angle, slightly lower and further out
    // so ball + striker face/body + defender challenge + keeper/goal all
    // read. The defender stays (contest = drama) but sits deeper/off-axis
    // instead of filling ~30% of the frame as a back.
    const m = d.contactPoint;
    return {
      pos: { x: m.x - 4.2 + L, y: 2.4, z: m.z + 6.2 },
      look: { x: m.x + 0.6, y: 1.7, z: m.z - 0.4 },
      fov: 50,
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
  const s = d.meetGround;
  const p = segmentProgress(t, B.celebStart, Math.min(duration, 6));
  return {
    pos: { x: lerp(s.x - 3, s.x - 2, p) + L, y: lerp(3.8, 3.1, p), z: lerp(s.z + 13, s.z + 11, p) },
    look: { x: s.x + 1, y: 1.1, z: s.z },
    fov: 52,
  };
}

function evaluateCrossEffects(ctx: EvalCtx): CrossHeaderFrameDescription['effects'] {
  const { data: d, seed, time: t } = ctx;
  const crossP = segmentProgress(t, B.crossContact, B.contact);
  const headP = segmentProgress(t, B.contact, B.headerEnd);
  const trailFade = 1 - segmentProgress(t, B.headerEnd, B.netSettleEnd);
  const crossTrail = crossP > 0 && crossP < 1 ? Math.min(crossP * 4, 1) : 0;
  const headTrail = headP > 0 && trailFade > 0 ? Math.min(headP * 4, 1) * trailFade : 0;
  let intensity = Math.max(crossTrail, headTrail);
  // Velocity gate: only the fastest flight gets the full trail (never a laser).
  const speed = ballSpeedAt((tt) => evaluateCrossBall({ ...ctx, time: tt }), t);
  intensity *= 0.35 + 0.65 * velocityTrailGate(speed);
  const from = headP > 0 ? d.contactPoint : d.crossFrom;
  // FOV punch: contact snap + goal-line punch.
  const contactPunch = 4 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.contact) / 0.35)));
  const linePunch = 2 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 3.0) / 0.4)));
  const shakeAmp = 0.12 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - B.contact) / 0.5)))
    + (t >= B.headerEnd && t <= B.headerEnd + 0.4 ? 0.06 * (1 - (t - B.headerEnd) / 0.4) : 0);
  return {
    trailFrom: intensity > 0.01 ? { ...from } : null,
    trailIntensity: intensity,
    fovPunch: Math.max(0, contactPunch) + Math.max(0, linePunch),
    shakeX: Math.sin(t * 9.4 + seed) * shakeAmp,
    shakeY: Math.cos(t * 7.9 + seed * 1.7) * shakeAmp * 0.6,
  };
}

/**
 * Supporter story: Mexican wave through the buildup, rising anticipation as
 * the cross flies, eruption when the header hits the net.
 */
export function evaluateCrossCrowd(time: number, seed: number, attackIdx: TeamId): SocialCrowdState {
  if (time < B.crossContact) return { mood: 'wave', intensity: 1, time, seed, moodTime: time };
  if (time < 3.0) {
    const p = (time - B.crossContact) / (3.0 - B.crossContact);
    return { mood: 'anticipation', intensity: 0.4 + 0.6 * p, time, seed, moodTime: time - B.crossContact };
  }
  const moodTime = time - 3.0;
  const intensity = time < 6 ? 1 - 0.4 * (moodTime / 3) : Math.max(0.4, 0.6 - 0.1 * ((time - 6) / 2.6));
  return { mood: 'goal', intensity, time, seed, scoringTeam: attackIdx, moodTime };
}

export function evaluateCrossHeaderFrame(args: {
  data: CrossHeaderTimelineData;
  home: string;
  away: string;
  seed: number;
  frame: number;
  fps: number;
  duration: number;
}): CrossHeaderFrameDescription {
  const { data, home, away, seed, frame, fps, duration } = args;
  void home;
  void away;
  const time = frame / fps;
  const ctx: EvalCtx = { data, seed, frame, fps, duration, time };
  const attackIdx = (data.attackSign === 1 ? 0 : 1) as TeamId;
  const defendIdx = (data.attackSign === 1 ? 1 : 0) as TeamId;

  const ball = evaluateCrossBall(ctx);
  const heroes = evaluateHeroes(ctx, attackIdx, defendIdx);
  const background = evaluateBackground(ctx, attackIdx, defendIdx, ball);
  const camera = evaluateCrossCamera(ctx, ball);
  const effects = evaluateCrossEffects(ctx);
  const crowd = evaluateCrossCrowd(time, seed, attackIdx);

  if (data.attackSign === 1) {
    return { scene: 'cross-header-goal', frame, time, actors: [...heroes, ...background], ball, camera, clock: time, effects, crowd };
  }
  const mirrorActor = (a: ArcadeActorFrame): ArcadeActorFrame => ({ ...a, x: -a.x, facingX: -a.facingX });
  return {
    scene: 'cross-header-goal',
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

export function crossHeaderFrameToRenderInput(
  desc: CrossHeaderFrameDescription,
  homeCode: string,
  awayCode: string,
): CrossHeaderRenderInput {
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
