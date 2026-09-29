import type { MomentClockSpec } from '../animation/time-ramp';

/**
 * Semantic Reel DSL. Callers describe WHAT they want (office, side-eye,
 * cloud-puff, crossbar-chaos); presets/components own coordinates, cameras,
 * asset paths and frame math.
 */

export type ReelFormat = 'instagram-reel' | 'tiktok' | 'youtube-short';

export interface ReelFormatSpec {
  width: number;
  height: number;
}

export const REEL_FORMATS: Record<ReelFormat, ReelFormatSpec> = {
  'instagram-reel': { width: 1080, height: 1920 },
  tiktok: { width: 1080, height: 1920 },
  'youtube-short': { width: 1080, height: 1920 },
};

export type BeatType =
  | 'hook'
  | 'setup'
  | 'reveal'
  | 'tension'
  | 'escalation'
  | 'transition'
  | 'payoff'
  | 'reaction'
  | 'punchline'
  | 'proof'
  | 'leaderboard'
  | 'cta'
  | 'brand';

export interface ActorSpec {
  id: string;
  model: string;
  country?: string;
  role?: 'office-worker' | 'boss' | 'intern' | 'supporter' | 'footballer' | 'goalkeeper' | 'presenter';
  wardrobe?: string;
  variant?: string;
  anchor?: string;
  animation?: string;
}

export interface StageSpec {
  id: string;
  kind: 'office' | 'football' | 'studio' | 'generic-three' | 'graphics-only';
  asset?: string;
  variant?: string;
}

export interface CameraSpec {
  preset: string;
}

export interface TransitionSpec {
  type: string;
  durationInFrames: number;
  intensity?: number;
}

export interface EffectSpec {
  type: string;
  intensity?: number;
  startFrame?: number;
  durationInFrames?: number;
}

export interface GraphicSpec {
  kind:
    | 'headline'
    | 'subheadline'
    | 'caption'
    | 'meme-text'
    | 'leaderboard'
    | 'versus'
    | 'goal-banner'
    | 'cta'
    | 'brand'
    | 'badge'
    | 'flag'
    | 'chat-bubble'
    | 'eyebrow'
    | 'scoreboard'
    | 'goal-call'
    | 'world-table'
    | 'brand-reveal';
  text?: string;
  preset?: string;
  startFrame?: number;
  durationInFrames?: number;
  data?: Record<string, unknown>;
}

export interface AudioCueSpec {
  cue: string;
  startFrame: number;
  durationInFrames?: number;
  volume?: number;
}

export interface ReelAudioSpec {
  cues?: AudioCueSpec[];
  music?: string;
  musicVolume?: number;
  ducking?: boolean;
  /**
   * Render procedural cues (kick, shot, whoosh, sting...) offline into one
   * SFX stem with the game's arcade synth recipes. Opt-in per template.
   */
  sfxStem?: boolean;
}

export interface CaptionCue {
  text: string;
  startFrame: number;
  durationInFrames: number;
  preset?: string;
}

export interface CaptionTrackSpec {
  preset?: string;
  cues?: CaptionCue[];
}

export interface BrandingSpec {
  league?: string;
  site?: string;
  logoAsset?: string;
  showLogo?: boolean;
}

export interface ThemeSpec {
  mood?: 'comedy' | 'hype' | 'dramatic' | 'chaos';
  primary?: string;
  accent?: string;
}

export interface BeatContentSpec {
  stage?: string;
  camera?: string;
  actors?: Array<{ actor: string; anchor?: string; animation?: string }>;
  footballMoment?: string;
  /**
   * Play a window of the moment's own timeline (seconds) instead of
   * restarting it per shot; shared boundaries make cuts continuous.
   */
  momentClock?: MomentClockSpec;
  home?: string;
  away?: string;
  attackingTeam?: 'home' | 'away';
  graphics?: GraphicSpec[];
  effects?: EffectSpec[];
  transitionIn?: TransitionSpec;
  transitionOut?: TransitionSpec;
  audio?: AudioCueSpec[];
  caption?: string;
  captionPreset?: string;
}

export interface BeatSpec {
  type: BeatType;
  duration: number;
  content?: BeatContentSpec;
}

export interface ReelSpec {
  id: string;
  format: ReelFormat;
  fps: 30 | 60;
  durationInSeconds: number;
  seed: number;
  theme?: ThemeSpec;
  cast?: ActorSpec[];
  stages?: StageSpec[];
  beats: BeatSpec[];
  audio?: ReelAudioSpec;
  captions?: CaptionTrackSpec;
  branding?: BrandingSpec;
}

export interface ShotActorSpec {
  actor: string;
  anchor?: string;
  animation?: string;
}

export interface ShotPropSpec {
  asset: string;
  anchor?: string;
}

export interface ShotSpec {
  id: string;
  stage: string;
  startFrame: number;
  durationInFrames: number;
  camera?: string;
  actors?: ShotActorSpec[];
  props?: ShotPropSpec[];
  overlays?: GraphicSpec[];
  transitionIn?: TransitionSpec;
  transitionOut?: TransitionSpec;
  effects?: EffectSpec[];
  audio?: AudioCueSpec[];
  footballMoment?: string;
  momentClock?: MomentClockSpec;
  home?: string;
  away?: string;
  attackingTeam?: 'home' | 'away';
}

export interface ShotPlan {
  specId: string;
  fps: number;
  totalFrames: number;
  width: number;
  height: number;
  seed: number;
  shots: ShotSpec[];
}

export interface TemplateInput {
  template: 'office-rivalry' | 'country-rivalry' | 'hnc-hero';
  home: string;
  away: string;
  seed?: number;
  fps?: 30 | 60;
  headline?: string;
  cta?: string;
  footballMoment?: string;
  mood?: ThemeSpec['mood'];
}
