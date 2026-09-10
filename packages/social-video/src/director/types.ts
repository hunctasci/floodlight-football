import type { CameraPurpose, SocialCameraPreset } from '../cameras/presets';

/**
 * Director layer: AI requests a STORY (semantic), the StoryCompiler turns it
 * into beats → shots → scene/action evaluations → audio cues → overlays.
 * No generic timeline-editing language, no raw camera exposure.
 */

export type StoryId =
  | 'last-second-winner'
  | 'crossbar-chaos'
  | 'keeper-disaster'
  | 'impossible-cross'
  | 'crowd-knew';

export const STORY_IDS: readonly StoryId[] = [
  'last-second-winner',
  'crossbar-chaos',
  'keeper-disaster',
  'impossible-cross',
  'crowd-knew',
];

export type StoryMood = 'hype' | 'chaos' | 'comedy' | 'dramatic';

export interface StorySpec {
  story: StoryId;
  home: string;
  away: string;
  seed?: number;
  mood?: StoryMood;
  headline?: string;
  cta?: string;
  music?: string;
}

/** One directed shot: purpose-first, camera by name, event-cut boundaries. */
export interface DirectedShot {
  start: number;
  end: number;
  purpose: CameraPurpose;
  camera: SocialCameraPreset;
  /** Human-readable beat label (hook/setup/tension/payoff/reaction/brand). */
  beat: 'hook' | 'setup' | 'tension' | 'payoff' | 'reaction' | 'brand';
  label: string;
}

export interface StoryPlan {
  story: StoryId;
  /** Existing scene implementation reused (no new choreography engine). */
  scene: 'attack-goal' | 'cross-header-goal' | 'crossbar-chaos' | 'keeper-disaster';
  home: string;
  away: string;
  seed: number;
  mood: StoryMood;
  fps: number;
  duration: number;
  headline: string;
  cta: string | undefined;
  shots: DirectedShot[];
  heroFrame: { time: number; description: string };
  audioCues: string[];
  reaction: string;
}
