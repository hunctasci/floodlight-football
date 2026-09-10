import type { SocialLens } from './social-camera';

/**
 * Director camera vocabulary: every shot exists for ONE narrative purpose.
 *
 *   GEOGRAPHY  viewer understands where everyone is (0.4–1.2s, wide)
 *   CHARACTER  a player feels important (3/4 angles, never flat frontal)
 *   SPEED      movement feels fast (parallax: boards/flags/supporters/posts)
 *   IMPACT     one event, memorable (0.15–0.45s punctuation)
 *   REACTION   emotional consequence (keeper/defender/crowd/scorer)
 *   REVEAL     comedy/geography payoff (wide disclosure after a tight shot)
 *
 * Raw x/y/z/FOV never reach AI specs — scenes pick these by purpose.
 * All builders are pure functions of anchors (ball/actor/goal), deterministic
 * and random-access safe.
 */

export type CameraPurpose =
  | 'geography'
  | 'character'
  | 'speed'
  | 'impact'
  | 'reaction'
  | 'reveal'
  | 'message'
  | 'brand';

export type CameraMotion =
  | 'static'
  | 'push-in'
  | 'pull-back'
  | 'tracking'
  | 'orbit-small'
  | 'pan'
  | 'tilt'
  | 'handheld-impact';

export type SocialCameraPreset =
  | 'broadcast-high'
  | 'broadcast-wide'
  | 'broadcast-medium'
  | 'high-sideline'
  | 'far-touchline'
  | 'wide-goal'
  | 'cross-follow'
  | 'attack-wide'
  | 'sideline-wide'
  | 'behind-attack'
  | 'striker-low'
  | 'winger-close'
  | 'keeper-close'
  | 'faceoff-low'
  | 'celebration-close'
  | 'touchline-run'
  | 'low-sideline'
  | 'ball-follow'
  | 'behind-runner'
  | 'ball-near-lens'
  | 'header-impact'
  | 'shot-impact'
  | 'keeper-glove'
  | 'crossbar-angle'
  | 'goal-net'
  | 'crowd-low'
  | 'behind-supporters'
  | 'behind-goal-net'
  | 'inside-goal'
  | 'keeper-shoulder'
  | 'striker-shoulder'
  | 'ground-ball'
  | 'corner-flag'
  | 'top-down-box'
  | 'reaction-defender'
  | 'reaction-keeper'
  | 'reaction-crowd'
  | 'goalpost-side'
  | 'crossbar-under'
  | 'duel-chase'
  | 'ball-chase'
  | 'player-portrait'
  | 'boot-ball'
  | 'keeper-eyes'
  | 'reaction-scorer';

export const CAMERA_PURPOSE: Record<SocialCameraPreset, CameraPurpose> = {
  'broadcast-high': 'geography',
  'broadcast-wide': 'geography',
  'broadcast-medium': 'geography',
  'high-sideline': 'geography',
  'far-touchline': 'geography',
  'wide-goal': 'geography',
  'cross-follow': 'speed',
  'attack-wide': 'geography',
  'sideline-wide': 'geography',
  'behind-attack': 'geography',
  'striker-low': 'character',
  'winger-close': 'character',
  'keeper-close': 'character',
  'faceoff-low': 'character',
  'celebration-close': 'character',
  'touchline-run': 'speed',
  'low-sideline': 'speed',
  'ball-follow': 'speed',
  'behind-runner': 'speed',
  'ball-near-lens': 'speed',
  'header-impact': 'impact',
  'shot-impact': 'impact',
  'keeper-glove': 'impact',
  'crossbar-angle': 'impact',
  'goal-net': 'impact',
  'crowd-low': 'reaction',
  'behind-supporters': 'reaction',
  'behind-goal-net': 'reveal',
  'inside-goal': 'reveal',
  'keeper-shoulder': 'character',
  'striker-shoulder': 'character',
  'ground-ball': 'speed',
  'corner-flag': 'geography',
  'top-down-box': 'reveal',
  'reaction-defender': 'reaction',
  'reaction-keeper': 'reaction',
  'reaction-crowd': 'reaction',
  'goalpost-side': 'impact',
  'crossbar-under': 'impact',
  'duel-chase': 'speed',
  'ball-chase': 'speed',
  'player-portrait': 'character',
  'boot-ball': 'character',
  'keeper-eyes': 'character',
  'reaction-scorer': 'reaction',
};

export const CAMERA_MOTION: Record<SocialCameraPreset, CameraMotion> = {
  'broadcast-high': 'static',
  'broadcast-wide': 'tracking',
  'broadcast-medium': 'tracking',
  'high-sideline': 'tracking',
  'far-touchline': 'tracking',
  'wide-goal': 'tracking',
  'cross-follow': 'tracking',
  'attack-wide': 'tracking',
  'sideline-wide': 'static',
  'behind-attack': 'tracking',
  'striker-low': 'push-in',
  'winger-close': 'tracking',
  'keeper-close': 'static',
  'faceoff-low': 'push-in',
  'celebration-close': 'pull-back',
  'touchline-run': 'tracking',
  'low-sideline': 'tracking',
  'ball-follow': 'tracking',
  'behind-runner': 'tracking',
  'ball-near-lens': 'static',
  'header-impact': 'handheld-impact',
  'shot-impact': 'handheld-impact',
  'keeper-glove': 'handheld-impact',
  'crossbar-angle': 'static',
  'goal-net': 'static',
  'crowd-low': 'tilt',
  'behind-supporters': 'pan',
  'behind-goal-net': 'static',
  'inside-goal': 'static',
  'keeper-shoulder': 'static',
  'striker-shoulder': 'push-in',
  'ground-ball': 'tracking',
  'corner-flag': 'static',
  'top-down-box': 'static',
  'reaction-defender': 'static',
  'reaction-keeper': 'push-in',
  'reaction-crowd': 'tilt',
  'goalpost-side': 'static',
  'crossbar-under': 'tilt',
  'duel-chase': 'tracking',
  'ball-chase': 'tracking',
  'player-portrait': 'push-in',
  'boot-ball': 'static',
  'keeper-eyes': 'push-in',
  'reaction-scorer': 'pull-back',
};

export interface CameraAnchor {
  ball: { x: number; y: number; z: number };
  actor?: { x: number; z: number };
  keeper?: { x: number; z: number };
  goalX?: number;
  lateral?: number;
}

/**
 * Editorial shot table: scenes declare their deliberate camera cuts as
 * tiled segments with a narrative purpose. Tests enforce the readability
 * budget from this single source of truth (establishing minimums, tracking
 * minimums, cut counts, spectacle share) so machine-gun editing can never
 * creep back in unnoticed.
 */
export type ShotKind = 'info' | 'spectacle' | 'impact' | 'reaction';

export interface SceneShot {
  /** Semantic camera name (preset vocabulary where possible). */
  name: string;
  start: number;
  end: number;
  kind: ShotKind;
}

/** Validate a shot table: tiled exactly from 0, every shot sane. */
export function assertShotTable(shots: readonly SceneShot[]): void {
  if (shots.length === 0) throw new Error('Shot table must not be empty');
  if (shots[0].start !== 0) throw new Error('Shot table must start at 0');
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (!(s.end > s.start)) throw new Error(`Shot ${s.name} must have positive duration`);
    if (i > 0 && s.start !== shots[i - 1].end) {
      throw new Error(`Shot ${s.name} does not tile after ${shots[i - 1].name}`);
    }
  }
}

const GOAL_X = 46;
const L = (a: CameraAnchor): number => a.lateral ?? 0;

/** Every preset below keeps the ball identifiable: silhouette, scale, tracking. */
export function presetLens(preset: SocialCameraPreset, a: CameraAnchor): SocialLens {
  const b = a.ball;
  const gx = a.goalX ?? GOAL_X;
  switch (preset) {
    case 'broadcast-high': return { pos: { x: b.x - 4 + L(a), y: 10.5, z: b.z + 12.5 }, look: { x: b.x + 2.5, y: 0.7, z: b.z - 2 }, fov: 52 };
    case 'broadcast-wide': {
      // Social TV-wide for 9:16: far and high enough to read the whole
      // football situation (ball, multiple players, attacking direction,
      // goal in the final third, tribunes behind play) while players stay
      // mobile-sized. Wider FOV compensates the narrow portrait horizontal
      // slice — never a cropped 16:9 broadcast camera.
      return { pos: { x: b.x - 10 + L(a), y: 12.5, z: b.z + 16 }, look: { x: b.x + 4, y: 0.5, z: b.z - 3 }, fov: 58 };
    }
    case 'broadcast-medium': {
      // Readable middle distance: the whole move plays inside the frame for
      // seconds at a time (carries, cross preparation, shot setup).
      return { pos: { x: b.x - 5 + L(a), y: 8.5, z: b.z + 12 }, look: { x: b.x + 2.5, y: 0.8, z: b.z - 1.5 }, fov: 53 };
    }
    case 'high-sideline': {
      // Higher, farther, slightly diagonal — counters, through balls and
      // buildup stay followable for several seconds without a cut.
      return { pos: { x: b.x - 11 + L(a), y: 15, z: b.z + 18 }, look: { x: b.x + 3.5, y: 0.4, z: b.z - 2 }, fov: 50 };
    }
    case 'far-touchline': {
      // Touchline geography: ball + winger + box + goal depth in one frame,
      // supporters and far tribune filling the top of the portrait.
      return { pos: { x: b.x - 1 + L(a), y: 7, z: b.z + 22 }, look: { x: b.x + 1.5, y: 0.8, z: b.z - 1 }, fov: 52 };
    }
    case 'wide-goal': {
      // Goal-area geography: striker, defender, keeper, ball and goalmouth
      // ALL readable at once (header setups, rebounds, keeper errors). The
      // lens rides ~9m behind the ball and leads it toward the goal, so the
      // whole box — ball at the near edge, goal at the far edge — stays
      // inside the portrait frame for either attacking lane.
      return { pos: { x: b.x - 9 + L(a), y: 10.5, z: b.z + 12 }, look: { x: b.x + 5, y: 1.4, z: b.z * 0.5 }, fov: 58 };
    }
    case 'cross-follow': {
      // Flight follow kept wide enough that the ball, the target players and
      // the goal stay visible together — the viewer reads WHERE the cross is
      // going, not just that a ball is flying.
      return { pos: { x: b.x - 9.5 + L(a), y: 6.5, z: b.z + 11.5 }, look: { x: b.x + 2.5, y: 1.5, z: b.z - 1 }, fov: 54 };
    }
    case 'attack-wide': return { pos: { x: b.x - 6 + L(a), y: 9, z: b.z + 13 }, look: { x: b.x + 3, y: 0.7, z: b.z - 2 }, fov: 54 };
    case 'sideline-wide': return { pos: { x: b.x + L(a), y: 8, z: b.z + 16 }, look: { x: b.x, y: 0.8, z: b.z }, fov: 52 };
    case 'behind-attack': return { pos: { x: b.x - 9 + L(a), y: 5, z: b.z + 4 }, look: { x: b.x + 4, y: 1, z: b.z }, fov: 53 };
    case 'striker-low': return { pos: { x: b.x - 3.4 + L(a), y: 1.7, z: b.z + 5.4 }, look: { x: b.x + 1, y: 1.5, z: b.z - 0.5 }, fov: 50 };
    case 'winger-close': return { pos: { x: b.x + 3 + L(a), y: 3.2, z: b.z + 7.5 }, look: { x: b.x, y: 1, z: b.z }, fov: 50 };
    case 'keeper-close': {
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 4.5 + L(a), y: 2.4, z: k.z + 5.5 }, look: { x: k.x, y: 1, z: k.z }, fov: 50 };
    }
    case 'faceoff-low': return { pos: { x: 0 + L(a), y: 2.6, z: 8.6 }, look: { x: 0, y: 1.25, z: -2.2 }, fov: 52 };
    case 'celebration-close': return { pos: { x: b.x - 3 + L(a), y: 3.4, z: b.z + 12 }, look: { x: b.x + 1, y: 1.1, z: b.z }, fov: 52 };
    case 'touchline-run': return { pos: { x: b.x - 2 + L(a), y: 2.2, z: b.z + 9 }, look: { x: b.x + 3, y: 1, z: b.z - 1 }, fov: 54 };
    case 'low-sideline': return { pos: { x: b.x - 4 + L(a), y: 1.9, z: b.z + 8 }, look: { x: b.x + 2.5, y: 1, z: b.z - 1 }, fov: 53 };
    case 'ball-follow': return { pos: { x: b.x - 8 + L(a), y: 4.5, z: b.z + 9.5 }, look: { x: b.x + 2.5, y: 1.1, z: b.z - 1 }, fov: 53 };
    case 'behind-runner': {
      const r = a.actor ?? { x: b.x - 2, z: b.z };
      return { pos: { x: r.x - 3 + L(a), y: 2.6, z: r.z + 4.5 }, look: { x: r.x + 4, y: 1.1, z: r.z }, fov: 54 };
    }
    case 'ball-near-lens': return { pos: { x: b.x - 2.5 + L(a), y: b.y + 0.6, z: b.z + 3.2 }, look: { x: b.x + 1, y: b.y, z: b.z - 1 }, fov: 55 };
    case 'header-impact': return { pos: { x: b.x - 4.2 + L(a), y: 2.4, z: b.z + 6.2 }, look: { x: b.x + 0.6, y: 1.7, z: b.z - 0.4 }, fov: 50 };
    case 'shot-impact': return { pos: { x: b.x - 6 + L(a), y: 3.4, z: b.z + 7 }, look: { x: b.x + 2, y: 1.1, z: b.z - 1 }, fov: 52 };
    case 'keeper-glove': return { pos: { x: b.x + 3.5 + L(a) * 0.3, y: b.y + 1.2, z: b.z + 2.5 }, look: { x: b.x, y: b.y, z: b.z }, fov: 50 };
    case 'crossbar-angle': return { pos: { x: 38 + L(a), y: 3.0, z: 8 }, look: { x: gx, y: 2.5, z: 1 }, fov: 50 };
    case 'goal-net': return { pos: { x: gx + 4 + L(a) * 0.3, y: 2.4, z: 6 }, look: { x: gx, y: 1.2, z: 0 }, fov: 50 };
    case 'crowd-low': return { pos: { x: b.x * 0.3 + L(a), y: 2.0, z: -18 }, look: { x: 0, y: 4.5, z: -34 }, fov: 54 };
    case 'behind-supporters': return { pos: { x: 0 + L(a), y: 5.2, z: -38 }, look: { x: b.x * 0.4, y: 1, z: 10 }, fov: 52 };
    case 'behind-goal-net': return { pos: { x: gx + 5 + L(a) * 0.3, y: 2.6, z: 3 }, look: { x: gx - 8, y: 1.2, z: 0 }, fov: 50 };
    case 'inside-goal': return { pos: { x: gx + 1.6, y: 1.6, z: 0 }, look: { x: gx - 14, y: 1.2, z: 0 }, fov: 58 };
    case 'keeper-shoulder': {
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 1.6 + L(a), y: 2.3, z: k.z + 2.6 }, look: { x: k.x + 8, y: 0.9, z: k.z - 1 }, fov: 50 };
    }
    case 'striker-shoulder': {
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      return { pos: { x: s.x - 2 + L(a), y: 2.4, z: s.z + 3 }, look: { x: gx, y: 1.4, z: 0 }, fov: 50 };
    }
    case 'ground-ball': return { pos: { x: b.x - 3 + L(a), y: 1.1, z: b.z + 4.2 }, look: { x: b.x + 2, y: 0.5, z: b.z }, fov: 52 };
    case 'corner-flag': return { pos: { x: b.x - 5 + L(a), y: 2.2, z: b.z + 6 }, look: { x: gx, y: 1.6, z: 0 }, fov: 52 };
    case 'top-down-box': return { pos: { x: 34 + L(a), y: 26, z: 2 }, look: { x: 40, y: 0, z: 0 }, fov: 46 };
    case 'reaction-defender': {
      const d = a.actor ?? { x: b.x - 4, z: b.z + 2 };
      return { pos: { x: d.x - 1.5 + L(a), y: 2.2, z: d.z + 4.2 }, look: { x: d.x, y: 1.3, z: d.z }, fov: 48 };
    }
    case 'reaction-keeper': {
      const k = a.keeper ?? { x: gx - 2.4, z: 0 };
      // Goal-side lens looking back out: the beaten keeper faces the goal,
      // so despair only reads from +x — slump in front view, crowd behind.
      return { pos: { x: k.x + 4.2 + L(a), y: 2.2, z: k.z + 1.8 }, look: { x: k.x, y: 1.0, z: k.z }, fov: 48 };
    }
    case 'reaction-crowd': return { pos: { x: 6 + L(a), y: 3.4, z: -24 }, look: { x: -6, y: 3.6, z: -34 }, fov: 50 };
    case 'goalpost-side': return { pos: { x: gx - 1 + L(a), y: 2.2, z: 7.5 }, look: { x: gx, y: 2.2, z: 0 }, fov: 48 };
    case 'crossbar-under': return { pos: { x: gx - 3 + L(a), y: 1.2, z: 2 }, look: { x: gx, y: 3.4, z: 0.5 }, fov: 52 };
    case 'duel-chase': {
      // Trailer chase: low behind-side of the ball-carrier lane. During a
      // carry the ball glues 0.7m ahead of the carrier's feet, so a directly
      // behind lens hides it behind his legs — the lateral offset keeps the
      // ball peeking beside his boots while attacker + chasing defender +
      // growing goal still read with strong parallax. Ball-anchored, so
      // tracking is automatic (the ball drives).
      return { pos: { x: b.x - 3.6 + L(a), y: 1.7, z: b.z + 4.4 }, look: { x: b.x + 2.2, y: 1.3, z: b.z - 0.5 }, fov: 57 };
    }
    case 'ball-chase': {
      // Racing chase: trails behind/slightly above the moving ball (never
      // rigidly attached, never spinning with it). Ball large foreground,
      // receiver/goal growing ahead, field rushing beneath. The look stays
      // near the ball so it holds inside the portrait frame at speed.
      return { pos: { x: b.x - 3.4 + L(a), y: b.y + 1.5, z: b.z + 2.8 }, look: { x: b.x + 2.5, y: 1.0, z: b.z - 0.6 }, fov: 56 };
    }
    case 'player-portrait': {
      // 3/4 closeup from the FRONT: face + chest + country stripe with the
      // stadium alive behind. The front is derived from the ball side (in a
      // faceoff the ball sits between the rivals, so ball-ward ≈ facing).
      // A fixed behind-side offset would frame the shirt number, not the
      // rivalry stare — the trailer hook needs eyes, not backs. Framed at
      // ~4m with a wider lens so the head never becomes a floating giant:
      // the look sits at the chest, leaving the text band above the eyes.
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      const dx = b.x - s.x, dz = b.z - s.z;
      const dl = Math.hypot(dx, dz) || 1;
      const fx = dx / dl, fz = dz / dl;
      const px = -fz, pz = fx;
      return {
        pos: { x: s.x + fx * 3.4 + px * 2.3 + L(a), y: 2.4, z: s.z + fz * 3.4 + pz * 2.3 },
        look: { x: s.x, y: 1.3, z: s.z },
        fov: 52,
      };
    }
    case 'boot-ball': {
      // Grass-height Western-duel insert: ball large foreground, legs enter
      // frame, goal/pitch soft behind. Stillness before kickoff.
      return { pos: { x: b.x - 1.8 + L(a), y: 0.7, z: b.z + 2.6 }, look: { x: b.x + 0.4, y: 0.35, z: b.z - 0.4 }, fov: 52 };
    }
    case 'keeper-eyes': {
      // Tighter keeper tension portrait: head/body + purple kit + goal frame,
      // incoming action implied. Tighter than keeper-close.
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 2.6 + L(a), y: 2.0, z: k.z + 3.4 }, look: { x: k.x, y: 1.5, z: k.z - 0.4 }, fov: 47 };
    }
    case 'reaction-scorer': {
      // Scorer celebration closeup: tighter than celebration-close, arms read.
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      return { pos: { x: s.x - 2.0 + L(a), y: 2.2, z: s.z + 4.0 }, look: { x: s.x + 0.4, y: 1.3, z: s.z - 0.3 }, fov: 50 };
    }
  }
}

/** Reusable reaction beats (0.25–0.7s punctuation after payoffs). */
export type ReactionKind =
  | 'keeper-disbelief'
  | 'defender-hands-head'
  | 'supporters-home-goal'
  | 'supporters-away-loss'
  | 'striker-celebrate'
  | 'teammate-run-in';

export const REACTION_DURATION: Record<ReactionKind, number> = {
  'keeper-disbelief': 0.55,
  'defender-hands-head': 0.5,
  'supporters-home-goal': 0.6,
  'supporters-away-loss': 0.5,
  'striker-celebrate': 0.6,
  'teammate-run-in': 0.45,
};

export function reactionPresetFor(reaction: ReactionKind): SocialCameraPreset {
  switch (reaction) {
    case 'keeper-disbelief': return 'reaction-keeper';
    case 'defender-hands-head': return 'reaction-defender';
    case 'supporters-home-goal':
    case 'supporters-away-loss': return 'reaction-crowd';
    case 'striker-celebrate': return 'celebration-close';
    case 'teammate-run-in': return 'behind-runner';
  }
}

/** Finite-value guard for any computed lens (NaN/Infinity fail loudly). */
export function isFiniteLens(lens: SocialLens): boolean {
  return [lens.pos.x, lens.pos.y, lens.pos.z, lens.look.x, lens.look.y, lens.look.z, lens.fov]
    .every((v) => Number.isFinite(v));
}
