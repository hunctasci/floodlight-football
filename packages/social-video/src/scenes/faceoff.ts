import type { MatchState, Player, Team, TeamId } from '../../../../apps/game/src/types';
import type { SocialActorPose } from '../../../../apps/game/src/renderer';
import { countryTeams } from '../../../../apps/game/src/city-league/kits';
import type { ResolvedFrameSpec, ResolvedVideoSpec } from '../schema';
import { faceoffCamera, faceoffCameraAt, type SocialLens } from '../cameras/social-camera';
import { lerp, segmentProgress } from '../timeline/math';

export interface CompiledFaceoff {
  state: MatchState;
  camera: SocialLens;
}

/** Deterministic PRNG (mulberry32): all variation derives from the spec seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function faceoffPlayer(
  id: number, team: TeamId, x: number, z: number, fx: number, fz: number, number: number,
): Player {
  const len = Math.hypot(fx, fz) || 1;
  return {
    id, team, number, name: team === 0 ? 'Home' : 'Away', keeper: false,
    x, z, vx: 0, vz: 0, facingX: fx / len, facingZ: fz / len,
    homeX: x, homeZ: z, stamina: 1, action: 'idle', actionTime: 0,
    cooldown: 0, think: 0, aiState: 'POSE', touchIn: 0,
  };
}

/**
 * Compile the `faceoff` scene: two HNC-style outfielders staged around the
 * centre spot in their canonical country kits, facing each other over the
 * ball. Staged cinematic pose — not gameplay. Pure function of the spec.
 */
export function compileFaceoff(spec: ResolvedFrameSpec): CompiledFaceoff {
  const rand = seededRandom(spec.seed);
  // Subtle staged variation (±12cm): seeds differ, composition never breaks.
  const jx = () => (rand() - 0.5) * 0.24;
  const jz = () => (rand() - 0.5) * 0.24;
  const [homeTeam, awayTeam] = countryTeams(spec.home, spec.away);

  const hx = -1.7 + jx(), hz = 0.9 + jz();
  const ax = 1.7 + jx(), az = -0.9 + jz();
  // Each player faces the other — derived from the staged positions so the
  // stare-down always connects regardless of seed jitter.
  const home = faceoffPlayer(0, 0, hx, hz, ax - hx, az - hz, 10);
  const away = faceoffPlayer(1, 1, ax, az, hx - ax, hz - az, 7);

  const state: MatchState = {
    players: [home, away],
    ball: { x: 0, z: 0, y: 0.25, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
    teams: [homeTeam, awayTeam],
    humanTeam: 0, controlled: 0, remoteTeam: null, peerControlled: -1, peerTarget: null,
    phase: 'playing', phaseTime: 0, half: 1, elapsed: 0, halfDuration: 60,
    score: [0, 0], attack: [1, -1], restart: null, paused: false,
    message: '', messageTime: 0, charge: 0, targetPlayer: null, time: 0,
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] },
  };
  return { state, camera: faceoffCamera() };
}

// ---------------------------------------------------------------------------
// Deterministic timeline: staged rivalry beats evaluated directly from time.
// ---------------------------------------------------------------------------

/** Plain staging parameters for the faceoff timeline (no THREE objects). */
export interface FaceoffTimelineData {
  homeBase: { x: number; z: number };
  awayBase: { x: number; z: number };
  /** Seed-derived sideways camera offset (metres, small). */
  cameraLateral: number;
  /** Seed-derived breathing phase offsets (radians). */
  breathPhaseHome: number;
  breathPhaseAway: number;
}

/** One actor's evaluated visual state at a timeline instant. */
export interface SocialActorFrame {
  x: number;
  z: number;
  facingX: number;
  facingZ: number;
  /** Vertical breathing bob in metres (applied to the avatar root). */
  bob: number;
  /** Forward lean in radians (subtle, chunky-retro friendly). */
  lean: number;
  /** Arm raise in radians (0 = relaxed at the sides). */
  armLift: number;
}

/** Complete deterministic description of one timeline frame. */
export interface SocialFrameDescription {
  scene: 'faceoff';
  frame: number;
  time: number;
  home: SocialActorFrame;
  away: SocialActorFrame;
  ball: { x: number; y: number; z: number };
  camera: SocialLens;
  /** Frozen social clock value for the renderer (always == time). */
  clock: number;
}

/** Final renderer input derived from a frame description (no timeline left). */
export interface FaceoffRenderInput {
  state: MatchState;
  camera: SocialLens;
  clock: number;
  pose: [SocialActorPose, SocialActorPose];
}

/**
 * Compile seed-derived staging. Draw order matches the V1 static preset, so
 * the timeline's base positions are identical to the original still.
 */
export function compileFaceoffTimeline(spec: Pick<ResolvedVideoSpec, 'seed'>): FaceoffTimelineData {
  const rand = seededRandom(spec.seed);
  const jx = () => (rand() - 0.5) * 0.24;
  const jz = () => (rand() - 0.5) * 0.24;
  const homeBase = { x: -1.7 + jx(), z: 0.9 + jz() };
  const awayBase = { x: 1.7 + jx(), z: -0.9 + jz() };
  return {
    homeBase,
    awayBase,
    cameraLateral: (rand() - 0.5) * 0.7,
    breathPhaseHome: rand() * Math.PI * 2,
    breathPhaseAway: rand() * Math.PI * 2,
  };
}

function approachPosition(
  base: { x: number; z: number },
  otherBase: { x: number; z: number },
  approach: number,
  finalPush: number,
): { x: number; z: number } {
  // Players drift toward each other (22% of the gap each), then settle a
  // touch closer for the final composition. Separation stays above ~1.7m.
  const ix = lerp(base.x, lerp(base.x, otherBase.x, 0.22), approach);
  const iz = lerp(base.z, lerp(base.z, otherBase.z, 0.22), approach);
  return {
    x: lerp(ix, lerp(ix, otherBase.x, 0.05), finalPush),
    z: lerp(iz, lerp(iz, otherBase.z, 0.05), finalPush),
  };
}

function assembleActor(
  pos: { x: number; z: number },
  otherPos: { x: number; z: number },
  breathPhase: number,
  time: number,
  finalPush: number,
): SocialActorFrame {
  const dx = otherPos.x - pos.x, dz = otherPos.z - pos.z;
  const len = Math.hypot(dx, dz) || 1;
  // Breathing swells slightly during the tension beat; arms lift a touch.
  const amp = 0.022 + 0.02 * segmentProgress(time, 1.8, 2.8);
  const breath = Math.sin((time / 1.7) * Math.PI * 2 + breathPhase);
  return {
    x: pos.x, z: pos.z,
    facingX: dx / len,
    facingZ: dz / len,
    bob: breath * amp,
    lean: 0.08 * finalPush,
    armLift: 0.1 * segmentProgress(time, 1.8, 2.8) + 0.25 * finalPush,
  };
}

/**
 * Evaluate one timeline frame. Pure function of (staging, frame, fps,
 * duration, countries): random-access safe, no prior-frame state.
 */
export function evaluateFaceoffFrame(args: {
  data: FaceoffTimelineData;
  home: string;
  away: string;
  frame: number;
  fps: number;
  duration: number;
}): SocialFrameDescription {
  const { data, frame, fps, duration } = args;
  const time = frame / fps;
  const approach = segmentProgress(time, 0.6, 1.8);
  const finalPush = segmentProgress(time, 2.8, duration);
  const homePos = approachPosition(data.homeBase, data.awayBase, approach, finalPush);
  const awayPos = approachPosition(data.awayBase, data.homeBase, approach, finalPush);
  const home = assembleActor(homePos, awayPos, data.breathPhaseHome, time, finalPush);
  const away = assembleActor(awayPos, homePos, data.breathPhaseAway, time, finalPush);
  return {
    scene: 'faceoff' as const,
    frame,
    time,
    home,
    away,
    ball: { x: 0, y: 0.25, z: 0 },
    camera: faceoffCameraAt(time, duration, data.cameraLateral),
    clock: time,
  };
}

/** Map a frame description onto renderer input (teams resolved canonically). */
export function faceoffFrameToRenderInput(
  desc: SocialFrameDescription,
  homeCode: string,
  awayCode: string,
): FaceoffRenderInput {
  const [homeTeam, awayTeam]: [Team, Team] = countryTeams(homeCode, awayCode);
  const toPlayer = (
    id: number, team: TeamId, a: SocialActorFrame, number: number,
  ): Player => ({
    id, team, number, name: team === 0 ? 'Home' : 'Away', keeper: false,
    x: a.x, z: a.z, vx: 0, vz: 0, facingX: a.facingX, facingZ: a.facingZ,
    homeX: a.x, homeZ: a.z, stamina: 1, action: 'idle', actionTime: 0,
    cooldown: 0, think: 0, aiState: 'POSE', touchIn: 0,
  });
  const state: MatchState = {
    players: [toPlayer(0, 0, desc.home, 10), toPlayer(1, 1, desc.away, 7)],
    ball: { x: desc.ball.x, z: desc.ball.z, y: desc.ball.y, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
    teams: [homeTeam, awayTeam],
    humanTeam: 0, controlled: 0, remoteTeam: null, peerControlled: -1, peerTarget: null,
    phase: 'playing', phaseTime: 0, half: 1, elapsed: 0, halfDuration: 60,
    score: [0, 0], attack: [1, -1], restart: null, paused: false,
    message: '', messageTime: 0, charge: 0, targetPlayer: null, time: desc.time,
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] },
  };
  const toPose = (a: SocialActorFrame): SocialActorPose => ({ bob: a.bob, lean: a.lean, armLift: a.armLift });
  return { state, camera: desc.camera, clock: desc.clock, pose: [toPose(desc.home), toPose(desc.away)] };
}
