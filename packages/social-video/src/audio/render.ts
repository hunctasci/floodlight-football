import { seededRandom } from '../scenes/faceoff';
import { AUDIO_SAMPLE_RATE } from './compile';
import type { AudioEvent, CompiledAudio } from './types';

/**
 * Offline deterministic audio renderer: replays the HNC arcade synth recipes
 * from `apps/game/src/audio/audio.ts` (oscillator slides + decaying noise,
 * same frequencies/durations/gains) into a mono 48 kHz 16-bit PCM WAV —
 * without a browser, without recording. Noise is seeded from
 * (video seed, event index), so the same plan renders byte-identical audio.
 */

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function oscValue(type: OscType, phase: number): number {
  const p = phase % (Math.PI * 2);
  switch (type) {
    case 'sine':
      return Math.sin(p);
    case 'square':
      return p < Math.PI ? 1 : -1;
    case 'sawtooth':
      return (p / Math.PI) - 1;
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(p));
  }
}

/** One oscillator blip with exponential pitch slide + decay (game `tone`). */
function renderTone(
  out: Float32Array,
  sampleRate: number,
  startSample: number,
  freq: number,
  seconds: number,
  type: OscType,
  volume: number,
  slide: number,
): void {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const target = Math.max(25, freq * slide);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = freq * Math.pow(target / freq, t);
    phase += (f / sampleRate) * Math.PI * 2;
    const gain = volume * Math.exp(-t * Math.log(1000));
    const at = startSample + i;
    if (at >= 0 && at < out.length) out[at] += oscValue(type, phase) * gain;
  }
}

/** Decaying white-noise burst (game `noise`), seeded for determinism. */
function renderNoise(
  out: Float32Array,
  sampleRate: number,
  startSample: number,
  seconds: number,
  volume: number,
  rand: () => number,
  attackSeconds = 0,
): void {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const attack = Math.round(attackSeconds * sampleRate);
  for (let i = 0; i < n; i++) {
    const decay = 1 - i / n;
    const rise = attack > 0 ? Math.min(1, i / attack) : 1;
    const at = startSample + i;
    if (at >= 0 && at < out.length) out[at] += (rand() * 2 - 1) * decay * rise * volume;
  }
}

function renderEvent(
  out: Float32Array,
  sampleRate: number,
  seed: number,
  index: number,
  ev: AudioEvent,
): void {
  const start = Math.round(ev.time * sampleRate);
  const rand = seededRandom((seed ^ (index * 0x9e3779b9)) >>> 0 || 1);
  const k = ev.intensity;
  switch (ev.type) {
    case 'kick': // game kick: square 160Hz → ×0.55, 70ms.
      renderTone(out, sampleRate, start, 160, 0.07, 'square', 0.045 * k, 0.55);
      break;
    case 'shot': { // game shot (power 30): noise + rising sawtooth.
      const power = 30;
      renderNoise(out, sampleRate, start, 0.08, 0.05 * k, rand);
      renderTone(out, sampleRate, start, 95 + power * 1.4, 0.18, 'sawtooth', (0.055 + Math.min(0.05, power * 0.0011)) * k, 2.2);
      break;
    }
    case 'goal': // game goal: noise wash + rising sawtooth swell.
      renderNoise(out, sampleRate, start, 0.5, 0.12 * k, rand);
      renderTone(out, sampleRate, start, 300, 0.7, 'sawtooth', 0.075 * k, 2.8);
      break;
    case 'whistle': // game whistle, slightly softened for the sting.
      renderTone(out, sampleRate, start, 1500, 0.22, 'sine', 0.05 * k, 0.98);
      break;
    case 'ambience': { // subtle stadium bed: low looped noise, arcade-quiet.
      const n = Math.min(out.length - start, Math.round(ev.duration * sampleRate));
      for (let i = 0; i < n; i++) {
        const at = start + i;
        if (at >= 0 && at < out.length) out[at] += (rand() * 2 - 1) * 0.012 * k;
      }
      break;
    }
    case 'crowd': // celebration swell: slow-attack noise wash.
      renderNoise(out, sampleRate, start, ev.duration, 0.1 * k, rand, Math.min(0.4, ev.duration / 3));
      break;
    case 'cross': // whipped cross: brighter, longer kick with air noise.
      renderTone(out, sampleRate, start, 200, 0.09, 'square', 0.05 * k, 0.5);
      renderNoise(out, sampleRate, start, 0.09, 0.03 * k, rand);
      break;
    case 'header': // forehead thump: low sine burst + short noise.
      renderTone(out, sampleRate, start, 120, 0.12, 'sine', 0.09 * k, 0.4);
      renderNoise(out, sampleRate, start, 0.05, 0.04 * k, rand);
      break;
    case 'crossbar': { // deterministic metallic clang: detuned triangle partials + click.
      renderNoise(out, sampleRate, start, 0.02, 0.06 * k, rand);
      renderTone(out, sampleRate, start, 620, 0.6, 'triangle', 0.075 * k, 0.985);
      renderTone(out, sampleRate, start, 930, 0.45, 'triangle', 0.045 * k, 0.98);
      break;
    }
    case 'save': // glove thud: low sine + soft noise burst.
      renderTone(out, sampleRate, start, 90, 0.14, 'sine', 0.1 * k, 0.45);
      renderNoise(out, sampleRate, start, 0.1, 0.05 * k, rand);
      break;
    case 'clearance': // rushed punt: lower, duller kick.
      renderTone(out, sampleRate, start, 140, 0.08, 'square', 0.05 * k, 0.5);
      break;
    case 'anticipation': { // rising OOOH swell peaking at duration end.
      const n = Math.max(1, Math.round(ev.duration * sampleRate));
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const at = start + i;
        if (at >= 0 && at < out.length) out[at] += (rand() * 2 - 1) * (0.02 + 0.06 * p * p) * k;
      }
      break;
    }
    case 'whoosh': // air rush for ball-near-lens / hard cuts.
      renderNoise(out, sampleRate, start, Math.max(0.08, ev.duration), 0.045 * k, rand);
      break;
    case 'impact': // low cinematic sweetener under major contacts.
      renderTone(out, sampleRate, start, 55, 0.25, 'sine', 0.08 * k, 0.5);
      renderNoise(out, sampleRate, start, 0.06, 0.025 * k, rand);
      break;
    case 'sting': // procedural HNC sonic logo (~0.6s arcade motif).
      renderTone(out, sampleRate, start, 523, 0.12, 'square', 0.04 * k, 1.0);
      renderTone(out, sampleRate, start + Math.round(0.1 * sampleRate), 659, 0.12, 'square', 0.04 * k, 1.0);
      renderTone(out, sampleRate, start + Math.round(0.2 * sampleRate), 784, 0.28, 'square', 0.045 * k, 0.99);
      break;
    default:
      throw new Error(`Unknown audio event: ${(ev as AudioEvent).type}`);
  }
}

/** Render a compiled plan to mono float samples (exactly duration × rate). */
export function renderAudioSamples(plan: CompiledAudio, seed: number): Float32Array {
  const total = Math.round(plan.duration * plan.sampleRate);
  const out = new Float32Array(total);
  plan.events.forEach((ev, index) => renderEvent(out, plan.sampleRate, seed, index, ev));
  // Conservative normalization: preserve mix balance, avoid clipping.
  let peak = 0;
  for (const v of out) {
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak > 0.89) {
    const g = 0.89 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= g;
  }
  return out;
}

/** Encode mono float samples as a 16-bit PCM WAV buffer. */
export function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28); // byte rate
  data.writeUInt16LE(2, 32); // block align
  data.writeUInt16LE(16, 34); // bits per sample
  data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return data;
}

/** Compile + render + encode in one deterministic step. */
export function renderAudioToWav(plan: CompiledAudio, seed: number): Buffer {
  return encodeWav(renderAudioSamples(plan, seed), plan.sampleRate);
}
