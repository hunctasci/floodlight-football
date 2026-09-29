/**
 * ContentSpec — the semantic authoring language for HNC social content.
 *
 * Authors (people or agents) describe story intent: who is in it, which world
 * each scene happens in, what the camera means, what the cast does, what is
 * read and heard. They never write coordinates, frame numbers, asset paths or
 * CSS. `engine/director/compile.ts` turns this into a frame-exact Timeline.
 *
 * Times use the timing grammar (engine/spec/timing.ts): `0.4`, `'60%'`,
 * `'end-0.3'`, `'2f'`, `'faceoff.end-3f'`, `'moment:contact'`.
 */
import type { FormatId } from '../formats';

export type At = number | string;

export type Purpose =
  | 'hook'
  | 'setup'
  | 'clue'
  | 'reveal'
  | 'reaction'
  | 'tension'
  | 'escalation'
  | 'transform'
  | 'payoff'
  | 'punchline'
  | 'proof'
  | 'brand';

export interface ContentSpec {
  id: string;
  title: string;
  /** One-line concept (docs / gallery only). */
  logline?: string;
  fps?: 30 | 60;
  seed?: number;
  /** Formats this piece is designed for (first = primary). Default ['reel']. */
  formats?: FormatId[];
  cast: Record<string, CastSpec>;
  scenes: SceneSpec[];
  /** Named frames for key art / thumbnails: `{ thumb: 'faceoff@60%' }`. */
  keyArt?: Record<string, At>;
}

/**
 * A persistent character. Identity (country + number) drives skin palette,
 * kit, back number and flag in EVERY world, so an office worker and their
 * footballer self are recognisably the same HNC person.
 */
export interface CastSpec {
  /** Canonical game country code (apps/game city-league/countries). */
  country: string;
  /** Shirt number 1..99: HNC identity (skin palette = number % 4, back number). */
  number: number;
  /** On-screen name (chat, lower thirds). */
  name?: string;
  /** Default look; scenes may override. */
  look?: string;
  /** Personal clue colour (tie, hoodie). Defaults to the country primary. */
  accent?: string;
}

export interface SceneSpec {
  id: string;
  /** World id: football | office | studio | phone | title. */
  world: string;
  /** World parameters (each world documents and validates its own). */
  set?: Record<string, unknown>;
  /** Per-scene look overrides: `{ hero: 'kit' }`. */
  looks?: Record<string, string>;
  /** How this scene is entered from the previous one (default: cut). */
  enter?: TransitionSpec;
  /** Disable the world's default ambience bed. */
  ambience?: boolean;
  beats: BeatSpec[];
  /** Graphics spanning several beats (timed with beat references). */
  graphics?: GraphicSpec[];
  /** Scene-level sounds (e.g. `moment:` cues resolved to whichever beat covers them). */
  sound?: SoundSpec[];
}

/** One beat = one shot. */
export interface BeatSpec {
  id: string;
  purpose?: Purpose;
  /** On-screen seconds. */
  duration: number;
  /** Camera intent: `'close:hero push-in'` or an object (see CameraSpec). */
  camera: CameraSpec | string;
  cast?: Record<string, ActorDirection>;
  /** World clock window (football: moment seconds). */
  clock?: ClockSpec;
  text?: TextSpec[];
  graphics?: GraphicSpec[];
  fx?: EffectSpec[];
  sound?: (SoundSpec | string)[];
  /** Transition from the previous beat (default: cut). */
  enter?: TransitionSpec;
  /** Hold this beat's picture from `at` for the rest of the beat (comedic freeze). */
  freeze?: At;
}

export interface ClockSpec {
  from: number;
  to: number;
  ramp?: string;
}

/** What one cast member does in a beat. */
export interface ActorDirection {
  /** World mark (office: 'desk-a'); defaults to the previous beat's mark. */
  at?: string;
  /** Look for this beat (overrides scene/cast look). */
  look?: string;
  /** Action or timed action steps. */
  do?: string | ActionStep | (string | ActionStep)[];
  /** Default gaze target for all steps: cast id, prop or 'camera'. */
  lookAt?: string;
  /** Walk to another mark. */
  move?: { to: string; at?: At; duration?: number };
  /** Prop in hand: mug | phone | yellow-card | red-card | microphone. */
  hold?: string;
}

export interface ActionStep {
  at?: At;
  do: string;
  /** Gaze target for this step. */
  lookAt?: string;
}

/**
 * Camera intent. Lens is one of the generic subject-relative lenses (wide,
 * close, medium, full, over-shoulder, two-shot, macro, low-angle, look-up,
 * top-down) or a world lens/move (football: runner-lead, net-reverse...).
 */
export interface CameraSpec {
  lens: string;
  /** Primary subject: cast id, prop, light or surface. */
  on?: string;
  /** Secondary subject (over-shoulder target, two-shot partner). */
  at?: string;
  /** Movement modifiers: push-in, pull-out, drift-left, orbit-right, rise, snap-zoom, handheld... */
  move?: string[];
  /** Move strength multiplier (default 1). */
  amount?: number;
  /** Frame the subject on this side of the frame / shoot from this side. */
  side?: 'left' | 'right';
  /** End framing: interpolate from this lens to `to` across the beat (reveal pans, tilts). */
  to?: Omit<CameraSpec, 'to'> | string;
  ease?: string;
}

export interface TransitionSpec {
  type: string;
  /** Seconds (defaults per transition). */
  duration?: number;
  /** Subject in the outgoing shot (light-bloom: its light; zoom-through: its surface). */
  from?: string;
  /** Subject in the incoming shot. */
  to?: string;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface TextSpec {
  say: string;
  /** hook | pov | caption | kicker | impact | label | subtitle | whisper | stamp */
  style?: string;
  at?: At;
  until?: At;
  /** top | center | bottom | 'on:<subject>' (pinned to a world subject). */
  place?: string;
  /** Word-by-word reveal. */
  words?: boolean;
}

export interface GraphicSpec {
  /** Graphic kind (see graphics/registry.ts). */
  kind: string;
  at?: At;
  until?: At;
  /** Scene graphics: first / last beat the graphic spans. */
  from?: string;
  to?: string;
  text?: string;
  /** Kind-specific data. `at` and keys ending in `At` are times (timing grammar). */
  props?: Record<string, unknown>;
}

export interface EffectSpec {
  type: string;
  at?: At;
  until?: At;
  intensity?: number;
}

export interface SoundSpec {
  cue: string;
  at?: At;
  /** Seconds (beds / risers); default = the cue's natural length. */
  duration?: number;
  volume?: number;
}
