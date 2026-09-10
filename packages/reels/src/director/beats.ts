import type { BeatSpec } from '../reel/types';

/** Semantic beat helpers: durations only, never coordinates. */

export function beat(type: BeatSpec['type'], duration: number, content?: BeatSpec['content']): BeatSpec {
  return { type, duration, content };
}

export const BEAT_DURATIONS = {
  hook: 0.8,
  setup: 2.0,
  reveal: 1.2,
  tension: 1.0,
  escalation: 0.8,
  transition: 0.7,
  payoff: 6.3,
  reaction: 1.2,
  punchline: 1.2,
  proof: 1.5,
  leaderboard: 1.2,
  cta: 2.0,
  brand: 1.0,
} as const;
