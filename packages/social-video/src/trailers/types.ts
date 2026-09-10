import type { SocialFormatId } from '../config';
import type { AttackStyle, AttackTeam, OverlayMode } from '../schema';
import type { SocialCameraPreset } from '../cameras/presets';
import type { OverlayPlanEntry } from '../overlays/types';
import type { CompiledAudio } from '../audio/types';
import type { CompiledSocialVideo } from '../timeline';

/**
 * Trailer / montage layer: multiple story excerpts + cinematic inserts +
 * reactions + game-concept beats + branding, cut into ONE 15–20s global
 * timeline. StoryPlan stays 5–12s single-scene; the trailer owns the montage.
 *
 * Pipeline: TrailerSpec → compileTrailer() → CompiledTrailer →
 * evaluateTrailerFrame(frame) → { scene input, overlay frame }.
 *
 * Source identity: each segment maps global trailer time → source-local time
 * and reuses the existing scene evaluators untouched. The trailer may
 * override camera / overlay / audio mix / time mapping, never choreography.
 */

export const TRAILER_IDS = ['world-league-hero'] as const;
export type TrailerId = (typeof TRAILER_IDS)[number];

/** Source scene a trailer excerpt reuses (faceoff + 4 action scenes). */
export type TrailerSourceScene =
  | 'faceoff'
  | 'attack-goal'
  | 'cross-header-goal'
  | 'crossbar-chaos'
  | 'keeper-disaster';

/** Which actor a camera override anchors to (scene-dependent indices). */
export type TrailerActorRef =
  | { kind: 'faceoff-home' }
  | { kind: 'faceoff-away' }
  | { kind: 'scene-index'; index: number }
  | { kind: 'keeper' }
  | { kind: 'ball' };

export type TrailerShotPurpose =
  | 'geography'
  | 'character'
  | 'speed'
  | 'impact'
  | 'reaction'
  | 'reveal'
  | 'message'
  | 'brand';

/** One directed trailer shot: global window + source excerpt + camera. */
export interface TrailerShotDef {
  /** Stable id for storyboard filenames (e.g. 's01-tr-portrait'). */
  id: string;
  /** Global start in seconds ([start, end) semantics). */
  start: number;
  /** Global end in seconds. */
  end: number;
  purpose: TrailerShotPurpose;
  /** Camera for this shot (source camera when 'source'). */
  camera: SocialCameraPreset | 'source';
  /** Actor anchor for actor-anchored overrides (portrait/reactions). */
  actor?: TrailerActorRef;
  /** Source excerpt reused (scene + matchup + local range). */
  source: TrailerSourceScene;
  /** Matchup index into the trailer countries pairs (0, 1, 2). */
  matchup: 0 | 1 | 2;
  /** Source-local start in seconds. */
  srcStart: number;
  /** Source-local end in seconds. */
  srcEnd: number;
  /** Human-readable beat label. */
  label: string;
  /** What this shot tells the viewer. */
  job: string;
}

export interface CompiledTrailerSegment extends TrailerShotDef {
  /** Segment duration (end - start). */
  duration: number;
  /** Source excerpt length (srcEnd - srcStart); rate = srcDur / duration. */
  srcDuration: number;
  /** Playback rate (1 = realtime, <1 = slowdown, >1 = speedup). */
  rate: number;
  /** Compiled source scene video reused for this matchup. */
  video: CompiledSocialVideo;
}

export interface CompiledTrailer {
  readonly trailer: TrailerId;
  /** Six country codes in matchup order: [TR,GR, BR,AR, DE,FR]. */
  readonly countries: readonly [string, string, string, string, string, string];
  readonly format: SocialFormatId;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly fps: number;
  readonly duration: number;
  readonly totalFrames: number;
  readonly attackTeam: AttackTeam;
  readonly attackStyle: AttackStyle;
  readonly overlaysMode: OverlayMode;
  readonly shots: readonly CompiledTrailerSegment[];
  /** Global overlay plan in trailer seconds (trailer owns all copy). */
  readonly overlayPlan: OverlayPlanEntry[];
  /** Global audio: one ambience bed + shifted source SFX + brand tail. */
  readonly audio: CompiledAudio;
}
