/**
 * Semantic audio plan types. Scene logic decides WHEN events occur;
 * `render.ts` decides HOW each one sounds. Pure data — no WebAudio, no
 * browser, no recording. Mirrors the overlay separation (compile vs render).
 */

export type AudioEventType =
  | 'kick'
  | 'shot'
  | 'goal'
  | 'whistle'
  | 'ambience'
  | 'crowd';

export interface AudioEvent {
  type: AudioEventType;
  /** Start time in seconds on the shared frame/fps timeline. */
  time: number;
  /** Audible length in seconds (crowd/ambience beds; one-shots ignore it). */
  duration: number;
  /** 0..1 emphasis (kick power, crowd size). */
  intensity: number;
}

export interface CompiledAudio {
  readonly sampleRate: number;
  readonly duration: number;
  readonly events: readonly AudioEvent[];
}
