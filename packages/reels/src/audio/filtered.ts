/**
 * Node-only: real CC0 crowd recordings run through a low-pass so the stadium
 * can be heard THROUGH something — an apartment wall (`crowd-distant`), a
 * tunnel door (`crowd-muffled`), or a tunnel that opens onto the pitch as you
 * walk out (`crowd-opening`: the filter sweeps open across the cue). Mixed
 * into the offline stem (the Remotion <Audio> path cannot filter).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLE_RATE } from './social-synth';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const cache = new Map<string, Float32Array>();

/** 16-bit PCM WAV → mono float at 48 kHz (the crowd set's native rate). */
export function loadWavMono(rel: string): Float32Array {
  const hit = cache.get(rel);
  if (hit) return hit;
  const buf = readFileSync(path.join(ROOT, 'public', rel));
  let off = 12;
  let channels = 2;
  let bits = 16;
  let rate = SAMPLE_RATE;
  let data: Buffer | undefined;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(off + 10);
      rate = buf.readUInt32LE(off + 12);
      bits = buf.readUInt16LE(off + 22);
    } else if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!data || bits !== 16 || rate !== SAMPLE_RATE) throw new Error(`${rel}: expected 16-bit ${SAMPLE_RATE} Hz PCM`);
  const frames = Math.floor(data.length / (2 * channels));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let v = 0;
    for (let c = 0; c < channels; c++) v += data.readInt16LE((i * channels + c) * 2) / 32768;
    out[i] = v / channels;
  }
  cache.set(rel, out);
  return out;
}

export interface FilteredCue {
  file: string;
  /** Low-pass cutoff (Hz) at the start and end of the cue (log sweep). */
  from: number;
  to: number;
  /** Gain at start / end. */
  gain: [number, number];
  loop?: boolean;
}

const CROWD = 'assets/audio/crowd';

export const FILTERED: Record<string, FilteredCue> = {
  'crowd-distant': { file: `${CROWD}/stadium-bed-02.wav`, from: 420, to: 420, gain: [0.5, 0.5], loop: true },
  'crowd-muffled': { file: `${CROWD}/stadium-bed-01.wav`, from: 300, to: 300, gain: [0.7, 0.7], loop: true },
  'crowd-opening': { file: `${CROWD}/stadium-bed-01.wav`, from: 260, to: 14000, gain: [0.55, 1.0], loop: true },
  'roar-muffled': { file: `${CROWD}/goal-roar-01.wav`, from: 380, to: 380, gain: [0.9, 0.9] },
  'roar-opening': { file: `${CROWD}/goal-roar-01.wav`, from: 500, to: 14000, gain: [0.6, 1.0] },
};

/** Render one filtered cue into `out` (two cascaded one-pole low-passes). */
export function renderFilteredCue(out: Float32Array, id: string, startSec: number, seconds: number, volume: number): void {
  const cue = FILTERED[id];
  if (!cue) throw new Error(`No filtered cue "${id}"`);
  const src = loadWavMono(cue.file);
  const start = Math.round(startSec * SAMPLE_RATE);
  const n = Math.round(seconds * SAMPLE_RATE);
  const fade = Math.min(n / 4, SAMPLE_RATE * 0.25);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const at = start + i;
    if (at < 0 || at >= out.length) continue;
    const j = cue.loop ? i % src.length : i;
    if (j >= src.length) break;
    const p = i / Math.max(1, n - 1);
    const fc = cue.from * Math.pow(cue.to / cue.from, p * p);
    const k = 1 - Math.exp((-2 * Math.PI * fc) / SAMPLE_RATE);
    a += k * (src[j] - a);
    b += k * (a - b);
    const g = cue.gain[0] + (cue.gain[1] - cue.gain[0]) * p;
    const env = Math.min(1, i / fade, (n - i) / fade);
    out[at] += b * g * volume * env;
  }
}
