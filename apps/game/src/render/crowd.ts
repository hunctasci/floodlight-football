import type { TeamId } from '../types';

/**
 * Deterministic social crowd reactions. Pure math, no THREE, no randomness,
 * no accumulation: given (spec, seed, frame) every supporter transform is
 * identical on every evaluation.
 *
 * Split of responsibilities:
 * - scene/template code decides WHEN/WHY (mood + intensity + scoring side),
 * - the renderer decides HOW blocks move (`crowdFanOffset` per instance).
 * The renderer never learns what a "goal scene" is; it only sees the final
 * evaluated `SocialCrowdState`.
 */

/** Global crowd story beat for one social frame. */
export type SocialCrowdMood =
  | 'idle'
  | 'anticipation'
  | 'wave'
  | 'goal'
  | 'disbelief';

export interface SocialCrowdState {
  mood: SocialCrowdMood;
  /** 0..1 emphasis for the current mood. */
  intensity: number;
  /** Scene-local time in seconds (drives bob/bounce phases). */
  time: number;
  /** Spec seed (wave direction + per-fan phase variation). */
  seed: number;
  /** Attacking/scoring side for asymmetric goal reactions. */
  scoringTeam?: TeamId;
  /** Seconds since the current mood started (wave travel, bounce clock). */
  moodTime: number;
}

/** Fan x-range of the built far stand (metres, stadium space). */
export const CROWD_MIN_X = -49;
export const CROWD_MAX_X = 49;

/** Mexican-wave calibration (exaggerated to read in a 9:16 mobile frame). */
export const CROWD_WAVE_SIGMA = 10;
export const CROWD_WAVE_AMPLITUDE = 1.45;
export const CROWD_WAVE_STRETCH = 0.32;
/** Wave traversals per second (a full stand crossing takes ~2.7s). */
export const CROWD_WAVE_SPEED = 0.45;

/** Idle motion stays tiny: drift + jitter never exceed this. */
export const CROWD_IDLE_MAX = 0.08;
/** Anticipation rise (supporters stand) at full intensity. */
export const CROWD_ANTICIPATION_RISE = 0.38;
/** Scoring-section eruption jump at full intensity. */
export const CROWD_GOAL_JUMP = 1.0;
export const CROWD_GOAL_RISE = 0.3;
/** Conceding-section drop / standalone disbelief drop. */
export const CROWD_CONCEDE_DROP = 0.24;
export const CROWD_DISBELIEF_DROP = 0.2;

/** Stand section for team-colour regions: x < 0 is home, x >= 0 is away. */
export function fanSection(x: number): TeamId {
  return x < 0 ? 0 : 1;
}

/**
 * Deterministic per-fan pseudo-random in [0, 1). Sine-hash: pure, stateless,
 * identical for the same (n, seed) on every call and every machine.
 */
export function hash01(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Wave travel direction from the seed: even seeds run left → right,
 * odd seeds right → left. Same seed always produces the same direction.
 */
export function waveDirection(seed: number): 1 | -1 {
  return (seed >>> 0) % 2 === 0 ? 1 : -1;
}

/**
 * Horizontal centre of the Mexican wave in stadium metres. Travels across
 * (and slightly beyond) the stand as a pure function of mood time, wrapping
 * so long wave holds loop seamlessly.
 */
export function waveCenterX(moodTime: number, seed: number): number {
  const span = CROWD_MAX_X - CROWD_MIN_X + 20; // 10m run-in/out each side
  const p = (((moodTime * CROWD_WAVE_SPEED) % 1.2) + 1.2) % 1.2 / 1.2;
  const dir = waveDirection(seed);
  const from = dir === 1 ? CROWD_MIN_X - 10 : CROWD_MAX_X + 10;
  const to = dir === 1 ? CROWD_MAX_X + 10 : CROWD_MIN_X - 10;
  return from + (to - from) * p;
}

/**
 * Wave hump response 0..1 for a fan at fanX given the wave centre.
 * Gaussian falloff: ~1 at the centre, ~0.37 one sigma out, ~0 past 2 sigma.
 */
export function waveResponse(fanX: number, center: number): number {
  const d = (fanX - center) / CROWD_WAVE_SIGMA;
  return Math.exp(-d * d);
}

export interface CrowdFanSpot {
  x: number;
  row: number;
  /** Stable per-fan index (position in the build order). */
  index: number;
}

export interface CrowdFanOffset {
  /** Vertical metres to add to the base position. */
  dy: number;
  /** Pitch-ward (+) / away (−) shift in metres. */
  dz: number;
  /** Vertical stretch (1 = unchanged). */
  sy: number;
}

function clampIntensity(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Per-supporter transform for one social frame. Pure function of the fan
 * spot + evaluated crowd state: random-access safe, no prior-frame state.
 */
export function crowdFanOffset(fan: CrowdFanSpot, state: SocialCrowdState): CrowdFanOffset {
  const intensity = clampIntensity(state.intensity);
  const phase = hash01(fan.index, state.seed) * Math.PI * 2;
  const t = state.time;
  switch (state.mood) {
    case 'idle': {
      const jitter = (hash01(fan.index * 7 + 1, state.seed) - 0.5) * 0.03;
      return { dy: Math.sin(t * 1.4 + phase) * 0.035 + jitter, dz: 0, sy: 1 };
    }
    case 'anticipation': {
      return {
        dy: CROWD_ANTICIPATION_RISE * intensity + Math.sin(t * 3.1 + phase) * 0.07 * intensity,
        dz: 0.18 * intensity,
        sy: 1 + 0.06 * intensity,
      };
    }
    case 'wave': {
      const r = waveResponse(fan.x, waveCenterX(state.moodTime, state.seed));
      return {
        dy: r * CROWD_WAVE_AMPLITUDE * intensity + Math.sin(t * 1.4 + phase) * 0.03,
        dz: r * 0.1 * intensity,
        sy: 1 + r * CROWD_WAVE_STRETCH * intensity,
      };
    }
    case 'goal': {
      const scoring = state.scoringTeam;
      if (scoring !== undefined && fanSection(fan.x) !== scoring) {
        // Conceding side: brief freeze into a partial drop, tiny lean back.
        return {
          dy: -CROWD_CONCEDE_DROP * intensity + Math.sin(t * 1.1 + phase) * 0.02,
          dz: -0.12 * intensity,
          sy: 1 - 0.06 * intensity,
        };
      }
      // Scoring side: strong repeated bounce with a deterministic per-row
      // cascade (row 0 fires first) plus per-fan chaotic phase.
      const bounce = Math.abs(Math.sin(state.moodTime * 7 + fan.row * 0.9 + phase * 0.3));
      const amp = scoring === undefined ? 0.6 : 1.0;
      return {
        dy: (CROWD_GOAL_RISE + bounce * CROWD_GOAL_JUMP * amp) * intensity,
        dz: 0.12 * intensity,
        sy: 1 + 0.12 * intensity * bounce,
      };
    }
    case 'disbelief': {
      const stagger = Math.sin(t * 0.9 + phase + fan.x * 0.05) * 0.02;
      return {
        dy: -CROWD_DISBELIEF_DROP * intensity + stagger,
        dz: -0.1 * intensity,
        sy: 1 - 0.05 * intensity,
      };
    }
  }
}
