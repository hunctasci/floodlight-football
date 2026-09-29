/** Deterministic mix helpers shared by the Remotion track and the offline stem. */
import type { Timeline } from '../engine/timeline/types';
import { getCue } from './registry';

const HUSH_GAIN = 0.18;

/** Bed-bus gain at a frame: `hush` cues dip beds to ~-15 dB with short ramps. */
export function duckGain(tl: Pick<Timeline, 'sounds' | 'fps'>, frame: number): number {
  let g = 1;
  for (const s of tl.sounds) {
    if (s.cue !== 'hush') continue;
    const end = s.frame + (s.duration ?? Math.round(getCue('hush').length * tl.fps));
    const inRamp = Math.min(1, Math.max(0, (frame - (s.frame - 3)) / 3));
    const outRamp = Math.min(1, Math.max(0, (end + 6 - frame) / 6));
    const k = Math.min(inRamp, outRamp);
    g = Math.min(g, 1 - (1 - HUSH_GAIN) * k);
  }
  return g;
}
