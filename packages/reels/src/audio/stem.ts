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
import { renderSocialCue, SAMPLE_RATE, SOCIAL_RECIPES } from './social-synth';

/**
 * The game's synth levels suit its quiet arcade mix; against real stadium
 * recordings they vanish. Fixed gain (not peak-normalised, so a quiet office
 * scene stays quiet) calibrated on the hero trailer's former -3 dBFS stem.
 */
const GAME_GAIN = 2.6;
const LIMIT = 0.96;

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
    if (def.source !== 'social') return;
    if (!SOCIAL_RECIPES[s.cue]) throw new Error(`Cue "${s.cue}" has no social recipe`);
    const seconds = s.duration !== undefined ? s.duration / tl.fps : def.length;
    renderSocialCue(def.bus === 'foreground' ? fore : beds, s.cue, s.frame / tl.fps, seconds, s.volume, tl.seed, i);
  });
  const out = new Float32Array(n);
  const spf = SAMPLE_RATE / tl.fps;
  for (let i = 0; i < n; i++) {
    const v = game[i] * GAME_GAIN + fore[i] + beds[i] * duckGain(tl, i / spf);
    // Soft limit: transparent below ~0.7, never clips.
    out[i] = Math.abs(v) < 0.7 ? v : Math.sign(v) * (0.7 + (LIMIT - 0.7) * Math.tanh((Math.abs(v) - 0.7) / (LIMIT - 0.7)));
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
