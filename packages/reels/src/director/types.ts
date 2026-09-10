import type { CameraPresetId } from '../cameras/registry';

export type StoryBeatType =
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

export interface DirectedShot {
  start: number;
  end: number;
  beat: StoryBeatType;
  camera: CameraPresetId | string;
  label: string;
}

export interface StoryPlan {
  story: string;
  home: string;
  away: string;
  seed: number;
  fps: number;
  duration: number;
  shots: DirectedShot[];
  heroFrame: { time: number; description: string };
}
