/**
 * Football world lenses + moves (the HNC hero trailer's proven coverage).
 *
 * Semantic camera MOVES: eased paths between anchored lenses.
 *
 * A lens is a pose expressed relative to semantic anchors (hero / rival /
 * keeper / ball) instead of world coordinates, so the same move works for
 * any choreography that publishes anchors. Keys may also name a proven
 * canonical social lens (hncPresetLens) — reuse before inventing.
 *
 * Moves are keyed on shot progress u (0..1). Chained shots stay seamless
 * when one move ends on the lens the next begins with (anchors are
 * continuous across a shared moment-clock boundary). A lagged move may only
 * hand over continuously where the anchor is at rest (lagged == live).
 */
import { hncPresetLens, type HncLens, type HncSocialCameraPreset } from '@floodlight/hnc-visuals';
import { applyEasing, type EasingId } from '../../animation/easing';

type V2 = { x: number; z: number };
type V3 = { x: number; y: number; z: number };

export interface LensAnchors {
  ball: V3;
  hero: V2;
  rival: V2;
  keeper: V2;
}

export const DEFAULT_LENS_ANCHORS: LensAnchors = {
  ball: { x: 0, y: 0.25, z: 0 },
  hero: { x: -0.7, z: 0 },
  rival: { x: 1.25, z: 0 },
  keeper: { x: 43.4, z: 0 },
};

const lens = (pos: V3, look: V3, fov: number): HncLens => ({ pos, look, fov });
/** Offset from a ground anchor (x,z) with an absolute height. */
const at = (a: V2, dx: number, y: number, dz: number): V3 => ({ x: a.x + dx, y, z: a.z + dz });

/**
 * Portrait (9:16) lenses. Portrait is narrow (~29° horizontal at fov 50), so
 * two-player framings stack depth along the duel axis instead of side-by-side.
 */
const REEL_LENSES = {
  /** Low behind the ball looking up at the far stand: ball + stadium + beams. */
  'ball-hero-low': (a: LensAnchors) =>
    lens({ x: a.ball.x + 0.6, y: 0.55, z: a.ball.z + 2.6 }, { x: a.ball.x - 0.1, y: 1.6, z: a.ball.z - 6 }, 52),
  /** Low 3/4 behind the hero, rival facing lens; ball between them. */
  'faceoff-depth-wide': (a: LensAnchors) => lens(at(a.hero, -3.2, 1.2, 1.6), at(a.hero, 2.0, 1.2, -0.3), 50),
  /** Same ray pushed ~0.45m: closer, but the rival's face stays clear. */
  'faceoff-depth-tight': (a: LensAnchors) => lens(at(a.hero, -2.78, 1.1, 1.45), at(a.hero, 2.0, 1.2, -0.3), 47),
  /** Follow from behind the hero toward goal (the rival drops out of frame). */
  'runner-follow': (a: LensAnchors) => lens(at(a.hero, -5.2, 1.7, 1.6), at(a.hero, 3.0, 0.95, -0.5), 50),
  /**
   * Leading camera ahead of the hero looking back: face to lens, ball rolling
   * toward it in the foreground, the chaser a step behind on the far side.
   * Aimed between hero and ball: the ball runs ahead of him, toward the lens.
   * Depth staging is what fits a duel into a ~29° wide portrait frame.
   */
  'runner-lead': (a: LensAnchors) => lens(at(a.hero, 6.0, 1.3, 1.6), at(a.hero, 0.3, 0.9, -0.2), 50),
  'runner-lead-close': (a: LensAnchors) => lens(at(a.hero, 5.4, 1.25, 1.45), at(a.hero, 0.3, 0.95, -0.2), 48),
  /**
   * Behind the hero on his kicking side (right = -z when facing +x) so the
   * backswing reads: shooter on the right third, keeper + goal left of centre.
   */
  'striker-windup': (a: LensAnchors) => lens(at(a.hero, -5.0, 1.55, -0.8), { x: a.hero.x + 9, y: 1.0, z: a.hero.z - 0.9 }, 48),
  'striker-windup-tight': (a: LensAnchors) => lens(at(a.hero, -4.3, 1.3, -0.65), { x: a.hero.x + 9, y: 1.1, z: a.hero.z - 0.9 }, 46),
  /**
   * Reverse angle from behind the +x goal (inside the end-stand fascia line,
   * x < 50.4): crossbar across the top, the top-corner strike flying at lens,
   * keeper mid-frame, the scorer distant.
   */
  'net-reverse': () => lens({ x: 50.2, y: 1.7, z: -4.8 }, { x: 38, y: 1.5, z: 0.3 }, 52),
  'net-reverse-close': () => lens({ x: 49.9, y: 1.6, z: -4.3 }, { x: 38, y: 1.45, z: 0.3 }, 48),
  /** Low hero angle on the scorer, full body with headroom for the jump. */
  'scorer-low': (a: LensAnchors) => lens(at(a.hero, -2.2, 1.1, 6.2), at(a.hero, 0.4, 1.6, -0.5), 50),
  'scorer-low-tight': (a: LensAnchors) => lens(at(a.hero, -1.7, 1.0, 5.0), at(a.hero, 0.3, 1.7, -0.4), 48),
  /** Behind the +x goal, low: the keeper's back in the foreground, the pitch (and whoever walks on) beyond. */
  'goal-behind': () => lens({ x: 49.2, y: 1.7, z: 0.9 }, { x: 29.3, y: 1.3, z: -0.5 }, 44),
  /** Low on the penalty spot looking at goal: a ball rolling at the lens, keeper on his line. */
  'spot-low': () => lens({ x: 32.9, y: 0.34, z: 0.3 }, { x: 44, y: 0.75, z: 0 }, 40),
  /** Straight down onto the ball (the espresso match cut); screen-up points at goal. */
  'ball-overhead': (a: LensAnchors) => lens({ x: a.ball.x, y: a.ball.y + 1.75, z: a.ball.z }, { x: a.ball.x + 0.09, y: a.ball.y, z: a.ball.z }, 40),
  'ball-overhead-wide': (a: LensAnchors) => lens({ x: a.ball.x, y: a.ball.y + 3.1, z: a.ball.z }, { x: a.ball.x + 0.15, y: a.ball.y, z: a.ball.z }, 40),
  /** High behind a set piece: taker, wall, keeper and goal in one frame. */
  'fk-high': (a: LensAnchors) => lens({ x: a.ball.x - 7.5, y: 10.5, z: a.ball.z + 4.5 }, { x: a.ball.x + 13, y: 0, z: a.ball.z - 3 }, 50),
  /** Behind the taker at shoulder height, toward the wall and the far corner. */
  'kick-behind': (a: LensAnchors) => lens(at(a.hero, -3.2, 1.6, 1.3), { x: a.hero.x + 14, y: 1.35, z: a.hero.z - 4 }, 42),
  /** Low in front of a walk-out, looking back up the pitch at the faces coming on. */
  'walkout-front': (a: LensAnchors) => lens({ x: a.hero.x + 0.6, y: 0.95, z: a.hero.z - 4.2 }, { x: a.hero.x, y: 1.55, z: a.hero.z + 10 }, 44),
  /** Behind a walk-out line at head height: three backs across the frame, the far stand ahead. */
  'walkout-back': (a: LensAnchors) => lens({ x: a.hero.x + 0.4, y: 1.75, z: a.hero.z + 6.8 }, { x: a.hero.x, y: 1.9, z: a.hero.z - 30 }, 44),
  /** High behind a walk-out: the players small on the grass, the far stand ahead. */
  'walkout-high': (a: LensAnchors) => lens({ x: a.hero.x + 3.2, y: 7.5, z: a.hero.z + 17 }, { x: a.hero.x, y: 1.5, z: a.hero.z - 30 }, 46),
  /** Horror key art: far behind a small striker, the keeper centred in his goal under one light. */
  'poster-horror': () => lens({ x: 25.6, y: 1.25, z: 1.6 }, { x: 45.5, y: 2.05, z: 0.1 }, 30),
  /** High crane over the scorer, stand in frame. */
  'stadium-high': (a: LensAnchors) => lens(at(a.hero, -9, 11, 14), at(a.hero, -6, 0, -9), 52),
  'stadium-high-drift': (a: LensAnchors) => lens(at(a.hero, -12.5, 12, 16), at(a.hero, -8, 0, -9), 52),
} as const;

export type ReelLensId = keyof typeof REEL_LENSES;
type LensKey = ReelLensId | HncSocialCameraPreset;

export const REEL_LENS_IDS = Object.keys(REEL_LENSES) as ReelLensId[];

/** A static football lens at the live anchors (e.g. `stadium-high`). */
export function evaluateReelLens(id: string, a: LensAnchors): HncLens {
  return evaluateLens(id as LensKey, a);
}

function evaluateLens(id: LensKey, a: LensAnchors): HncLens {
  const reel = (REEL_LENSES as Record<string, (a: LensAnchors) => HncLens>)[id];
  if (reel) return reel(a);
  return hncPresetLens(id as HncSocialCameraPreset, { ball: a.ball, actor: a.hero, keeper: a.keeper });
}

export interface CameraMoveDef {
  description: string;
  /** [shot progress u, lens] keys, u strictly increasing from 0 to 1. */
  keys: readonly (readonly [number, LensKey])[];
  /** Easing per segment (keys.length - 1 entries). */
  ease: readonly EasingId[];
  /** Anchor lag (moment seconds): the rig trails the action it follows. */
  lag?: number;
}

export const CAMERA_MOVES = {
  'ball-rise-reveal': {
    description: 'Hold low on the ball under the lights, then sweep up into the faceoff depth framing',
    keys: [[0, 'ball-hero-low'], [0.38, 'ball-hero-low'], [1, 'faceoff-depth-wide']],
    ease: ['linear', 'ease-in-out'],
  },
  'faceoff-depth-push': {
    description: 'Tension push-in on the depth-stacked faceoff',
    keys: [[0, 'faceoff-depth-wide'], [1, 'faceoff-depth-tight']],
    ease: ['ease-in'],
  },
  'runner-burst': {
    description: 'Out of the faceoff framing into a follow from behind as the hero bursts',
    keys: [[0, 'faceoff-depth-tight'], [1, 'runner-follow']],
    ease: ['ease-in-out'],
    lag: 0.12,
  },
  'runner-lead': {
    description: 'Leading camera backpedalling ahead of the hero (duel + ball in one portrait frame)',
    keys: [[0, 'runner-lead'], [1, 'runner-lead-close']],
    ease: ['linear'],
    lag: 0.08,
  },
  'runner-approach': {
    description: 'Follow into the box and swing over the shoulder for the wind-up',
    keys: [[0, 'runner-follow'], [1, 'striker-windup']],
    ease: ['ease-in-out'],
  },
  'striker-windup': {
    description: 'Over-shoulder push through the wind-up toward goal',
    keys: [[0, 'striker-windup'], [0.7, 'striker-windup-tight'], [1, 'striker-windup-tight']],
    ease: ['ease-in-out', 'linear'],
  },
  'net-reverse': {
    description: 'Reverse angle from behind the net, quick push on impact',
    keys: [[0, 'net-reverse'], [1, 'net-reverse-close']],
    ease: ['ease-out'],
  },
  'scorer-push': {
    description: 'Low push-in on the scorer',
    keys: [[0, 'scorer-low'], [1, 'scorer-low-tight']],
    ease: ['ease-in-out'],
  },
  'ball-overhead-rise': {
    description: 'Hold straight down on a spinning ball, then crane up and back to reveal the whole set piece',
    keys: [[0, 'ball-overhead'], [0.35, 'ball-overhead'], [1, 'fk-high']],
    ease: ['linear', 'ease-in-out'],
  },
  'crane-out': {
    description: 'Crane up and out from the scorer to a high stadium view',
    keys: [[0, 'scorer-low-tight'], [1, 'stadium-high']],
    ease: ['ease-in-out'],
  },
  'stadium-drift': {
    description: 'Slow high drift over the stadium (end-card plate)',
    keys: [[0, 'stadium-high'], [1, 'stadium-high-drift']],
    ease: ['ease-out'],
  },
} as const satisfies Record<string, CameraMoveDef>;

export type CameraMoveId = keyof typeof CAMERA_MOVES;
export const CAMERA_MOVE_IDS = Object.keys(CAMERA_MOVES) as CameraMoveId[];

export function isCameraMoveId(id: string): id is CameraMoveId {
  return id in CAMERA_MOVES;
}

export function cameraMoveLag(id: CameraMoveId): number {
  return (CAMERA_MOVES[id] as CameraMoveDef).lag ?? 0;
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });

/** Evaluate a move at shot progress u with the (possibly lagged) anchors. */
export function evaluateCameraMove(id: CameraMoveId, u: number, anchors: LensAnchors): HncLens {
  const def = CAMERA_MOVES[id] as CameraMoveDef;
  const x = Math.min(1, Math.max(0, u));
  let k = 0;
  while (k < def.keys.length - 2 && x > def.keys[k + 1][0]) k++;
  const [u0, l0] = def.keys[k];
  const [u1, l1] = def.keys[k + 1];
  const w = applyEasing(def.ease[k] ?? 'linear', (x - u0) / Math.max(1e-6, u1 - u0));
  const a = evaluateLens(l0, anchors);
  const b = evaluateLens(l1, anchors);
  return { pos: mix3(a.pos, b.pos, w), look: mix3(a.look, b.look, w), fov: mix(a.fov, b.fov, w) };
}
