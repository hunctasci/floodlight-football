/**
 * Original scores per content id (Node-only: offline stereo synthesis).
 * `reels:render` writes each piece's score WAV into public/ before bundling;
 * the spec plays it with its file cue (audio/registry.ts).
 */
import { renderTheCurrentScore } from './score/the-current';

export interface ScoreDef {
  /** File cue that plays it (its `file` is where the WAV is written). */
  cue: string;
  render: (seed: number) => Buffer;
}

export const SCORES: Record<string, ScoreDef> = {
  'the-current': { cue: 'score-the-current', render: renderTheCurrentScore },
};
