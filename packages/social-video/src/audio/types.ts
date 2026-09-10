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
  | 'crowd'
  | 'cross'
  | 'header'
  | 'crossbar'
  | 'save'
  | 'clearance'
  | 'anticipation'
  | 'whoosh'
  | 'impact'
  | 'sting';

export interface AudioEvent {
  type: AudioEventType;
  /** Start time in seconds on the shared frame/fps timeline. */
  time: number;
  /** Audible length in seconds (crowd/ambience beds; one-shots ignore it). */
  duration: number;
  /** 0..1 emphasis (kick power, crowd size). */
  intensity: number;
  /** Equal-power stereo pan (-1 left … +1 right). Default 0 (centred). */
  pan?: number;
  /**
   * Deterministic external-asset preference id (manifest catalogue). When the
   * file is bundled it is layered/used; otherwise the procedural synth
   * renders. Omitted = procedural only.
   */
  assetId?: string;
}

/**
 * Semantic mix duck: a bus dips by depthDb over [start, end) to create
 * anticipation / micro-silence before an impact. Pure data, deterministic.
 */
export interface MixDuck {
  /** Bus to duck: music/crowd/ambience (foreground SFX never duck). */
  bus: 'music' | 'crowd' | 'ambience';
  start: number;
  end: number;
  /** Positive dB reduction (e.g. 3 = -3 dB). */
  depthDb: number;
}

export interface CompiledAudio {
  readonly sampleRate: number;
  readonly duration: number;
  readonly events: readonly AudioEvent[];
  /** Mix ducks (micro-silence / pre-impact anticipation). Default: none. */
  readonly ducks?: readonly MixDuck[];
}
