/**
 * Overlay type layer: semantic kinds only. AI-facing specs never carry CSS —
 * they carry copy (`headline`, `cta`) and the system owns styling. The pure
 * compiler/evaluator here is DOM-independent and unit-testable without
 * Chromium; `render-dom.ts` owns the DOM mapping.
 */

export type OverlayKind =
  | 'versus'
  | 'headline'
  | 'goal'
  | 'cta'
  | 'brand';

export type OverlayMode = 'default' | 'none';

export interface SocialCopy {
  headline?: string;
  secondary?: string;
  cta?: string;
}

/** Country display payload derived from canonical game data (never authored). */
export interface VersusPayload {
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
  /** Stacked title card (faceoff) vs compact strip (attack-goal). */
  layout: 'stacked' | 'strip';
}

/**
 * One compiled overlay: WHEN it is active plus its semantic payload.
 * Scene code decides timing; the DOM renderer decides styling.
 */
export interface OverlayPlanEntry {
  kind: OverlayKind;
  /** Active window in seconds: [start, end). */
  start: number;
  end: number;
  /** Plain text payload for headline/goal/cta (exact user or default copy). */
  text?: string;
  /** Supporting line rendered with the headline, when provided. */
  secondary?: string;
  versus?: VersusPayload;
}

/**
 * DOM-independent evaluated state for one overlay at one frame: absolute
 * opacity/scale/translation values computed from (spec, frame). The DOM
 * renderer writes these final values — no CSS animations, no wall clocks.
 */
export interface EvaluatedOverlay {
  kind: OverlayKind;
  text?: string;
  secondary?: string;
  versus?: VersusPayload;
  opacity: number;
  scale: number;
  translateX: number;
  translateY: number;
  /** Extra punch emphasis (goal pop), 0 when inactive styling. */
  emphasis: number;
}

/** Complete deterministic overlay description of one timeline frame. */
export interface OverlayFrameDescription {
  frame: number;
  time: number;
  overlays: EvaluatedOverlay[];
}
