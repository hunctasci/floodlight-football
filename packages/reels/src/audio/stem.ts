/**
 * Node-only: render a timeline's synthesised cues into ONE deterministic WAV
 * stem — game recipes (social-video's offline replay of the game's WebAudio
 * synth) + social recipes (social-synth.ts), beds ducked by `hush`. Never
 * import from compositions (Node Buffers).
 */
import { encodeWav, renderAudioSamples } from '../../../social-video/src/audio/render';
import type { AudioEvent, AudioEventType } from '../../../social-video/src/audio/types';
import type { Timeline } from '../engine/timeline/types';
import { duckGain } from './mix';
import { getCue } from './registry';
import { renderFilteredCue } from './filtered';
import { renderSocialCue, SAMPLE_RATE, SOCIAL_RECIPES } from './social-synth';

/**
 * The game's synth levels suit its quiet arcade mix; against real stadium
 * recordings they vanish. Fixed gain (not peak-normalised, so a quiet office
 * scene stays quiet) calibrated on the hero trailer's former -3 dBFS stem.
 */
const GAME_GAIN = 2.6;
const LIMIT = 0.96;
/** Stem peak ceiling (−6 dBFS): headroom for the file cues mixed on top in Remotion. */
const LIMITER_CEILING = 0.5;

export function gameEvents(tl: Pick<Timeline, 'sounds' | 'fps'>): AudioEvent[] {
  return tl.sounds
    .filter((s) => getCue(s.cue).source === 'game')
    .map((s) => ({
      type: getCue(s.cue).recipe as AudioEventType,
      time: s.frame / tl.fps,
      duration: (s.duration ?? Math.round(tl.fps * 0.25)) / tl.fps,
      intensity: s.volume,
    }))
    .sort((a, b) => a.time - b.time);
}

export function renderStemSamples(tl: Timeline): Float32Array {
  const duration = tl.totalFrames / tl.fps;
  const n = Math.round(duration * SAMPLE_RATE);
  const game = renderAudioSamples({ sampleRate: SAMPLE_RATE, duration, events: gameEvents(tl) }, tl.seed);
  const fore = new Float32Array(n);
  const beds = new Float32Array(n);
  tl.sounds.forEach((s, i) => {
    const def = getCue(s.cue);
    if (def.source === 'filtered') {
      renderFilteredCue(def.bus === 'foreground' ? fore : beds, s.cue, s.frame / tl.fps, s.duration !== undefined ? s.duration / tl.fps : def.length, s.volume);
      return;
    }
    if (def.source !== 'social') return;
    if (!SOCIAL_RECIPES[s.cue]) throw new Error(`Cue "${s.cue}" has no social recipe`);
    const seconds = s.duration !== undefined ? s.duration / tl.fps : def.length;
    renderSocialCue(def.bus === 'foreground' ? fore : beds, s.cue, s.frame / tl.fps, seconds, s.volume, tl.seed, i);
  });
  const mix = new Float32Array(n);
  const spf = SAMPLE_RATE / tl.fps;
  for (let i = 0; i < n; i++) mix[i] = game[i] * GAME_GAIN + fore[i] + beds[i] * duckGain(tl, i / spf);
  return lookaheadLimit(mix);
}

/**
 * Look-ahead peak limiter (deterministic): the gain starts falling 3 ms before
 * a peak so it lands exactly at the ceiling, and recovers over ~80 ms. Only
 * the extreme transients (a save, a slam) are touched; the mix under them —
 * and every comedic silence — keeps its level, so mastering can bring every
 * piece to social loudness with one static gain. A final soft clip guards
 * the last sample of overshoot.
 */
export function lookaheadLimit(x: Float32Array, ceiling = LIMITER_CEILING): Float32Array {
  const n = x.length;
  const la = Math.round(0.003 * SAMPLE_RATE);
  const release = Math.exp(-1 / (0.08 * SAMPLE_RATE));
  // Required gain per sample, then a running minimum over the look-ahead window.
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(x[i]);
    need[i] = a > ceiling ? ceiling / a : 1;
  }
  const out = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    let target = 1;
    for (let j = i; j < Math.min(n, i + la); j++) if (need[j] < target) target = need[j];
    g = target < g ? g + (target - g) * (1 / Math.max(1, Math.min(la, 8))) : 1 - (1 - g) * release;
    if (g > target && target < 1 && need[i] < 1) g = Math.min(g, need[i]);
    const v = x[i] * g;
    out[i] = Math.abs(v) < 0.7 * LIMIT ? v : Math.sign(v) * Math.min(LIMIT, Math.abs(v));
  }
  return out;
}

export function renderStemWav(tl: Timeline): Buffer {
  return encodeWav(renderStemSamples(tl), SAMPLE_RATE);
}

/** Public-relative path of a piece's stem (formats share timing, so one stem). */
export function stemPath(tl: Pick<Timeline, 'id'>): string {
  return `generated/${tl.id}-sfx.wav`;
}
