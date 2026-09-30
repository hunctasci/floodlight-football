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
  /** Hero root lift (m) when the choreography publishes it (leaps). */
  heroLift?: number;
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

  // --- THE CURRENT (anime tribute) — fixed-world lenses for the night myth ---
  /** On the grass at the centre looking up at the +x/-z pylon and the far stand (lights strike). */
  'dark-low': () => lens({ x: 4, y: 0.32, z: 7 }, { x: 44, y: 10.5, z: -30 }, 58),
  'dark-low-rise': () => lens({ x: 4.6, y: 0.9, z: 7.4 }, { x: 44, y: 11.5, z: -30 }, 56),
  /** High diagonal over the whole night pitch (lines can be read end to end). */
  'destiny-high': () => lens({ x: -34, y: 30, z: 40 }, { x: 4, y: 0, z: -3 }, 54),
  'destiny-high-drift': () => lens({ x: -26, y: 33, z: 44 }, { x: 6, y: 0, z: -2 }, 52),
  /** Straight-ish down on the whole pitch, +x end at the top of the portrait frame. */
  'kickoff-top': () => lens({ x: -16, y: 56, z: 0.5 }, { x: 3, y: 0, z: 0 }, 70),
  'kickoff-top-close': () => lens({ x: -9, y: 40, z: 0.4 }, { x: 3, y: 0, z: 0 }, 66),
  /** Wide, dark, low from midfield toward the home end (+x): pitch, box, the home terrace. */
  'chorus-wide': () => lens({ x: 10, y: 2.4, z: 15 }, { x: 52, y: 5.5, z: -7 }, 50),
  'chorus-wide-push': () => lens({ x: 13, y: 2.1, z: 13.5 }, { x: 52, y: 5.5, z: -7 }, 47),
  /** Low beside the box after the goal: scorer, net, keeper down; still air. */
  'hush-wide': () => lens({ x: 29.5, y: 1.3, z: 12.5 }, { x: 43, y: 1.6, z: -2.5 }, 46),
  'hush-wide-drift': () => lens({ x: 30.4, y: 1.2, z: 12.1 }, { x: 43, y: 1.55, z: -2.5 }, 45),

  // --- anchored anime lenses ---
  /** Overhead on a hop-and-cut: the arc it carves reads on the grass. */
  'crescent-top': (a: LensAnchors) => lens(at(a.hero, 0.4, 8.5, 2.2), at(a.hero, 1.2, 0, 0.2), 52),
  /** Dolly-zoom pair behind a runner: far + long lens → near + wide. Same runner size, the goal recedes. */
  'vertigo-far': (a: LensAnchors) => lens(at(a.hero, -10, 1.75, 0.7), at(a.hero, 12, 1.15, -0.3), 20),
  'vertigo-near': (a: LensAnchors) => lens(at(a.hero, -3.1, 1.45, 0.35), at(a.hero, 12, 1.15, -0.3), 60),
  /** Low on the camera side of a slide tackle coming across. */
  /** Low in the slide's path on the camera side: UNDERTOW comes at the lens, the striker crosses in. */
  'undertow-low': () => lens({ x: 16.3, y: 0.45, z: 6.8 }, { x: 16.0, y: 0.6, z: -0.5 }, 50),
  /** Keeper's eyes: the shot screaming in. */
  'keeper-pov': (a: LensAnchors) => lens({ x: a.keeper.x - 0.62, y: 1.72, z: a.keeper.z + 0.05 }, { x: a.ball.x, y: a.ball.y, z: a.ball.z }, 52),
  /** In front of the keeper, low: he rises into the shot, the floodlights behind the goal. */
  'blackout-front': (a: LensAnchors) => lens({ x: a.keeper.x - 5.8, y: 0.9, z: a.keeper.z + 2.2 }, { x: a.keeper.x, y: 2.3, z: a.keeper.z - 0.2 }, 50),
  /** From the grass under the dead ball, looking up at it. */
  'deadball-sky': (a: LensAnchors) => lens({ x: 40.2, y: 0.35, z: 3.4 }, { x: a.ball.x, y: a.ball.y, z: a.ball.z }, 56),
  /** Worm angle under the striker, a pylon behind him (re-light). */
  'relight-worm': (a: LensAnchors) => lens(at(a.hero, -0.4, 0.22, -2.6), at(a.hero, 3.2, 5.2, 7.5), 64),
  /** Worm angle close in front of a leap; the aim rises with him. */
  'leap-low': (a: LensAnchors) => lens(at(a.hero, 2.1, 0.22, 2.7), { x: a.hero.x + 0.2, y: 2.3 + (a.heroLift ?? 0) * 0.9, z: a.hero.z }, 62),
  /** Side-on at contact height in the air. */
  'volley-side': (a: LensAnchors) => lens({ x: a.hero.x + 0.4, y: 1.05 + (a.heroLift ?? 0), z: a.hero.z + 4.4 }, { x: a.hero.x + 0.5, y: 1.1 + (a.heroLift ?? 0), z: a.hero.z }, 42),
  'volley-side-tight': (a: LensAnchors) => lens({ x: a.hero.x + 0.45, y: 1.08 + (a.heroLift ?? 0), z: a.hero.z + 3.5 }, { x: a.hero.x + 0.55, y: 1.12 + (a.heroLift ?? 0), z: a.hero.z }, 40),
  /** Behind the striker in the air, along the MERIDIAN line to the far top corner. */
  'meridian-behind': (a: LensAnchors) => lens({ x: a.hero.x - 2.6, y: 1.85 + (a.heroLift ?? 0), z: a.hero.z + 1.2 }, { x: 46, y: 2.25, z: -3.05 }, 46),
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
  // --- THE CURRENT (anime tribute) ---
  'dark-rise': {
    description: 'On the grass under a dark pylon, a slow rise as the banks strike',
    keys: [[0, 'dark-low'], [1, 'dark-low-rise']],
    ease: ['ease-in-out'],
  },
  'destiny-drift': {
    description: 'High diagonal drift over the night pitch (lines charge end to end)',
    keys: [[0, 'destiny-high'], [1, 'destiny-high-drift']],
    ease: ['ease-out'],
  },
  'kickoff-drop': {
    description: 'Overhead on the whole pitch, dropping closer as the Currents flood the lines',
    keys: [[0, 'kickoff-top'], [1, 'kickoff-top-close']],
    ease: ['ease-in'],
  },
  'long-run-vertigo': {
    description: 'Dolly zoom behind the runner: long lens far → wide lens near; the goal recedes while he stays the same size',
    keys: [[0, 'vertigo-far'], [1, 'vertigo-near']],
    ease: ['ease-in-out'],
    lag: 0.06,
  },
  'chorus-push': {
    description: 'Slow push on the dark stadium toward the home end',
    keys: [[0, 'chorus-wide'], [1, 'chorus-wide-push']],
    ease: ['ease-in-out'],
  },
  'volley-side-push': {
    description: 'Side-on at contact height, creeping in while time nearly stops',
    keys: [[0, 'volley-side'], [1, 'volley-side-tight']],
    ease: ['ease-in'],
  },
  'hush-drift': {
    description: 'Still wide beside the box after the goal, a breath of drift',
    keys: [[0, 'hush-wide'], [1, 'hush-wide-drift']],
    ease: ['linear'],
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
