/**
 * Timeline — the compiled, frame-exact form of a ContentSpec. Pure data
 * (JSON-serialisable): the renderer, the QA linter and the audio stem all
 * read the same object. Every time here is an ABSOLUTE frame.
 */
import type { FormatId } from '../formats';
import type { Purpose } from '../spec/types';

export interface CastMember {
  id: string;
  country: string;
  number: number;
  name: string;
  accent: string;
  look: string;
}

/** Normalised camera intent (lens + subjects + modifiers). */
export interface CameraIntent {
  lens: string;
  on?: string;
  at?: string;
  move: string[];
  amount: number;
  side?: 'left' | 'right';
  ease: string;
  to?: Omit<CameraIntent, 'to'>;
}

export interface ActionKey {
  frame: number;
  action: string;
  lookAt?: string;
  /** Frame the action's own clock started (a gaze-only change keeps it running). */
  origin?: number;
}

export interface ActorTrack {
  cast: string;
  mark: string;
  look: string;
  keys: ActionKey[];
  move?: { to: string; start: number; end: number };
  hold?: string;
}

export interface TransitionEvent {
  type: string;
  /** Cut frame (= incoming shot start). */
  cut: number;
  /** Transition window [start, end) around the cut. */
  start: number;
  end: number;
  from?: string;
  to?: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Incoming shot renders under the outgoing one across the window. */
  overlap: boolean;
}

export interface FxEvent {
  type: string;
  start: number;
  end: number;
  intensity: number;
  on?: string;
  props?: Record<string, unknown>;
}

export interface Shot {
  id: string;
  scene: string;
  beat: string;
  purpose?: Purpose;
  world: string;
  set: Record<string, unknown>;
  start: number;
  duration: number;
  camera: CameraIntent;
  actors: ActorTrack[];
  /** Resolved look per cast member in this shot. */
  looks: Record<string, string>;
  clock?: { from: number; to: number; ramp?: string };
  fx: FxEvent[];
  /** Absolute frame to hold the picture from (freeze). */
  freeze?: number;
  enter?: TransitionEvent;
  exit?: TransitionEvent;
}

export interface OverlayEvent {
  id: string;
  kind: 'text' | 'graphic';
  /** text style or graphic kind */
  type: string;
  start: number;
  end: number;
  text?: string;
  place?: string;
  words?: boolean;
  /** Shot id when bound to one shot (moves with the shot through transitions). */
  shot?: string;
  props: Record<string, unknown>;
}

export interface SoundEvent {
  cue: string;
  frame: number;
  /** Frames (beds / risers); undefined = natural length. */
  duration?: number;
  volume: number;
}

export interface Timeline {
  id: string;
  title: string;
  fps: number;
  seed: number;
  format: FormatId;
  width: number;
  height: number;
  totalFrames: number;
  cast: Record<string, CastMember>;
  shots: Shot[];
  overlays: OverlayEvent[];
  sounds: SoundEvent[];
  /** Named frames: every beat start (`<scene>/<beat>`), beat ids, key art. */
  markers: Record<string, number>;
}
