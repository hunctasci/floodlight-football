import type { SocialFormatId } from '../config';
import type { AttackTeam, AttackStyle, OverlayMode, TemplateId } from '../schema';
import type { OverlayPlanEntry } from '../overlays/types';
import type { CompiledAudio } from '../audio/types';
import type { CompiledSocialVideo } from '../timeline';

/**
 * Template composition types. A template reuses existing scene compilers and
 * evaluators; segments carry their own compiled scene video plus global
 * timing. No scene choreography is duplicated here.
 */

export type TemplateSegmentKind = 'scene' | 'outro';

export interface CompiledSegment {
  kind: TemplateSegmentKind;
  /** Scene implementation reused for this segment. */
  scene: 'faceoff' | 'attack-goal';
  /** Global start in seconds ([start, end) semantics, end-exclusive). */
  start: number;
  /** Global length in seconds. */
  duration: number;
  /** Duration handed to the scene evaluators (scene-local clock). */
  localDuration: number;
  /** Scene video compiled for this segment (overlays disabled; template owns them). */
  video: CompiledSocialVideo;
}

/**
 * Compiled production template: plain data, no THREE objects, no browser.
 * Pipeline: spec → compileTemplate() → CompiledTemplate →
 * evaluateTemplateFrame(frame) → { scene input, overlay frame }.
 */
export interface CompiledTemplate {
  readonly template: TemplateId;
  readonly home: string;
  readonly away: string;
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
  readonly headline: string | undefined;
  readonly secondary: string | undefined;
  readonly cta: string | undefined;
  readonly segments: readonly CompiledSegment[];
  /** Global overlay plan in template seconds (scene entries shifted in). */
  readonly overlayPlan: OverlayPlanEntry[];
  /** Global audio plan: one ambience bed + shifted scene SFX + outro tail. */
  readonly audio: CompiledAudio;
}
