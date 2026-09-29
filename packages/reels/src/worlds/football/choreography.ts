import type { HncCrowdMood } from '@floodlight/hnc-visuals';
import { HERO_ATTACK, HERO_TOUCHES, sampleHeroAttack, sampleHeroAttackBar } from './hero-attack';
import { FREE_KICK, sampleFreeKick } from './free-kick';
import { MIDNIGHT, sampleMidnightPenalty } from './midnight-penalty';
import { WALK_OUT, sampleWalkOut } from './walk-out';

/**
 * Deterministic football choreography contract: pure functions of moment
 * time that position canonical HNC players and the ball and request canonical
 * game poses. No coupling to the live game renderer.
 */

/** Game actions understood by the canonical applyHncGamePose(). */
export type ChoreoAction = 'idle' | 'run' | 'kick' | 'tackle' | 'dive' | 'slide' | 'fallen';

/**
 * Canonical game pose request (applyHncGamePose: run swing from speed, kick
 * snap, slide, dive, celebrations) plus small reel accents layered on the SAME
 * rig channels. Accents never touch geometry or proportions — only the joint
 * rotations / root lift the game itself animates.
 */
export interface ChoreoPose {
  action: ChoreoAction;
  actionTime: number;
  speed: number;
  /** Game clock fed to the pose (run swing + celebration phase). */
  clock: number;
  celebrating?: boolean;
  /** 0..1 anticipation dip before a burst / save. */
  crouch?: number;
  /** 0..1 kick backswing; with action 'kick' the snap starts from it. */
  windup?: number;
  /** 0..1 progress through a hurdle over a slide tackle. */
  hop?: number;
  /** 0..1 arms-spread celebration run. */
  airplane?: number;
  /** 0..1 keeper arms-overhead reach. */
  reach?: number;
  /** 0..1 settle a finished dive onto the grass. */
  grounded?: number;
  /** Head turn / nod (rad) on top of the game pose (acting beats). */
  headYaw?: number;
  headPitch?: number;
  /** Eye openness (1 normal, 0 closed, >1 wide). */
  eyeOpen?: number;
  /** 0..1 arms forward holding the ball at the chest. */
  cradle?: number;
  /** 0..1 slow walk: calmer arm swing. */
  walk?: number;
}

export interface ChoreoActor {
  team: 'home' | 'away' | 'keeper-home' | 'keeper-away';
  x: number;
  z: number;
  facing: number;
  /** Shirt number (canonical identity: skin palette, back number, celebration move). */
  number?: number;
  /** Canonical game pose. */
  pose?: ChoreoPose;
  /** Canonical procedural pose id (hncProceduralPose), e.g. 'facepalm'. */
  procedural?: string;
}

export interface ChoreoCrowd {
  mood: HncCrowdMood;
  intensity: number;
  moodTime: number;
  /** Which stand section (0 = x<0, 1 = x>0) holds the home supporters. */
  homeSection: 0 | 1;
}

export interface ChoreoFrame {
  ball: { x: number; y: number; z: number };
  actors: ChoreoActor[];
  crowdIntensity: number;
  phase: string;
  /** Semantic camera anchors (hero / rival / keeper) for anchored lenses. */
  anchors?: { hero: { x: number; z: number }; rival?: { x: number; z: number }; keeper?: { x: number; z: number } };
  crowd: ChoreoCrowd;
  /** Goal-net pulse (game renderer behaviour) for the goal at `side`. */
  net?: { side: 1 | -1; phaseTime: number };
  /** Explicit ball rotation (spin on the spot) instead of the rolling rule. */
  ballSpin?: { x: number; y: number; z: number };
  /** Ball not on the pitch (carried off / not yet placed). */
  ballHidden?: boolean;
}

/** Choreographies by id (pure functions of moment seconds). */
const MOMENTS: Record<string, (time: number) => ChoreoFrame> = {
  'hero-attack': sampleHeroAttack,
  'hero-attack-bar': sampleHeroAttackBar,
  'free-kick': sampleFreeKick,
  'midnight-penalty': sampleMidnightPenalty,
  'walk-out': sampleWalkOut,
};

/** Role name of each `actors[]` slot, per moment (cast members map onto roles). */
export const MOMENT_ROLES: Record<string, readonly string[]> = {
  'hero-attack': ['striker', 'rival', 'keeper', 'mate', 'holder'],
  'hero-attack-bar': ['striker', 'rival', 'keeper', 'mate', 'holder'],
  'free-kick': ['striker', 'keeper', 'wall-1', 'wall-2', 'wall-3'],
  'midnight-penalty': ['striker', 'keeper'],
  'walk-out': ['lead', 'left-1', 'right-1', 'left-2', 'right-2'],
};

/** Named beats (moment seconds) for `moment:` times, per moment. */
const beatsOf = (b: Record<string, number>) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'length'));
const heroBeats = { ...beatsOf(HERO_ATTACK), ...Object.fromEntries(HERO_TOUCHES.map((t, i) => [`touch-${i + 1}`, t])) };

export const MOMENT_BEATS: Record<string, Record<string, number>> = {
  'hero-attack': heroBeats,
  'hero-attack-bar': { ...heroBeats, barHit: HERO_ATTACK.goalLine },
  'free-kick': beatsOf(FREE_KICK),
  'midnight-penalty': beatsOf(MIDNIGHT),
  'walk-out': beatsOf(WALK_OUT),
};

export const MOMENT_LENGTH: Record<string, number> = {
  'hero-attack': HERO_ATTACK.length,
  'hero-attack-bar': HERO_ATTACK.length,
  'free-kick': FREE_KICK.length,
  'midnight-penalty': MIDNIGHT.length,
  'walk-out': WALK_OUT.length,
};

export const FOOTBALL_MOMENT_IDS = Object.keys(MOMENTS);

export function sampleFootballMoment(moment: string, time: number): ChoreoFrame {
  const f = MOMENTS[moment];
  if (!f) throw new Error(`Unknown football moment "${moment}" (known: ${FOOTBALL_MOMENT_IDS.join(', ')})`);
  return f(time);
}
