import { seededRandom } from '../scenes/faceoff';
import { AUDIO_SAMPLE_RATE } from './compile';
import { preferredAssetId } from './library';
import type { CompiledAudio, MixDuck } from './types';

/**
 * Production stereo mix engine (48 kHz stereo).
 *
 * Semantic buses: foreground SFX / crowd / ambience / music / sweeteners.
 * Pre-impact ducks + 50–120 ms micro-silence create anticipation; major
 * contacts layer (header = thump + sub, shot = kick + whoosh, bar = clang +
 * sub) for emotional weight. Everything is seeded determinism: same plan +
 * same seed = byte-identical stereo WAV.
 *
 * External bundled WAVs (manifest) are the preferred layer when present;
 * this checkout ships catalogue-only (no binaries committed), so the mix
 * below — the procedural HNC fallback — IS the production renderer until an
 * operator drops licensed files into assets/audio/. `assetId` choices are
 * still recorded deterministically per event (see preferredAssetId) so a
 * future drop-in changes nothing structurally.
 */

export const MIX_SAMPLE_RATE = AUDIO_SAMPLE_RATE;
export const MIX_CHANNELS = 2;

/** dB → linear gain. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Equal-power stereo pan: -1 left … +1 right. */
export function panGains(pan: number): [number, number] {
  const p = Math.max(-1, Math.min(1, pan));
  const a = ((p + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

function oscValue(type: OscType, phase: number): number {
  const p = phase % (Math.PI * 2);
  switch (type) {
    case 'sine': return Math.sin(p);
    case 'square': return p < Math.PI ? 1 : -1;
    case 'sawtooth': return p / Math.PI - 1;
    case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
  }
}

function renderToneMono(
  out: Float32Array, sampleRate: number, start: number,
  freq: number, seconds: number, type: OscType, volume: number, slide: number,
): void {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const target = Math.max(25, freq * slide);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = freq * Math.pow(target / freq, t);
    phase += (f / sampleRate) * Math.PI * 2;
    const gain = volume * Math.exp(-t * Math.log(1000));
    const at = start + i;
    if (at >= 0 && at < out.length) out[at] += oscValue(type, phase) * gain;
  }
}

function renderNoiseMono(
  out: Float32Array, sampleRate: number, start: number,
  seconds: number, volume: number, rand: () => number, attackSeconds = 0,
): void {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const attack = Math.round(attackSeconds * sampleRate);
  for (let i = 0; i < n; i++) {
    const decay = 1 - i / n;
    const rise = attack > 0 ? Math.min(1, i / attack) : 1;
    const at = start + i;
    if (at >= 0 && at < out.length) out[at] += (rand() * 2 - 1) * decay * rise * volume;
  }
}

/** Bus gains (linear) — crowd erupts over music, foreground owns impacts. */
const BUS_GAIN: Record<string, number> = {
  foreground: 1.0,
  crowd: 0.9,
  ambience: 0.22,
  music: 0.18,
  sweetener: 0.55,
};

function eventBus(type: string): string {
  switch (type) {
    case 'ambience': return 'ambience';
    case 'crowd':
    case 'anticipation':
    case 'goal': return 'crowd';
    case 'impact':
    case 'sting': return 'sweetener';
    default: return 'foreground';
  }
}

function duckGainAt(ducks: readonly MixDuck[], bus: string, t: number): number {
  let g = 1;
  for (const d of ducks) {
    if (d.bus !== bus) continue;
    if (t < d.start || t >= d.end) continue;
    // 10 ms raised-cosine edges so ducks never click.
    const edge = 0.01;
    const rise = Math.min(1, (t - d.start) / edge);
    const fall = Math.min(1, (d.end - t) / edge);
    const k = Math.min(rise, fall);
    g *= dbToGain(-d.depthDb * k);
  }
  return g;
}

function renderEventMono(
  mono: Float32Array, sampleRate: number, seed: number, index: number,
  type: string, time: number, duration: number, intensity: number,
): void {
  const start = Math.round(time * sampleRate);
  const rand = seededRandom((seed ^ (index * 0x9e3779b9)) >>> 0 || 1);
  const k = intensity;
  // Deterministic per-event variant detune (±3%): same kick never identical.
  const variantShift = 1 + ((seededRandom(((seed * 31 + index * 101) >>> 0) || 1)() - 0.5) * 0.06);
  switch (type) {
    case 'kick':
      renderToneMono(mono, sampleRate, start, 160 * variantShift, 0.07, 'square', 0.05 * k, 0.55);
      renderNoiseMono(mono, sampleRate, start, 0.03, 0.02 * k, rand);
      break;
    case 'shot':
      renderNoiseMono(mono, sampleRate, start, 0.08, 0.055 * k, rand);
      renderToneMono(mono, sampleRate, start, (95 + 30 * 1.4) * variantShift, 0.18, 'sawtooth', 0.085 * k, 2.2);
      // Layered air rush on hard shots.
      renderNoiseMono(mono, sampleRate, start - Math.round(0.02 * sampleRate), 0.12, 0.025 * k, rand);
      break;
    case 'cross':
      renderToneMono(mono, sampleRate, start, 200 * variantShift, 0.09, 'square', 0.055 * k, 0.5);
      renderNoiseMono(mono, sampleRate, start, 0.12, 0.035 * k, rand);
      break;
    case 'header':
      // POWER HEADER layering: forehead THUMP + very short low sub.
      renderToneMono(mono, sampleRate, start, 120 * variantShift, 0.12, 'sine', 0.11 * k, 0.4);
      renderNoiseMono(mono, sampleRate, start, 0.05, 0.045 * k, rand);
      renderToneMono(mono, sampleRate, start, 55, 0.16, 'sine', 0.075 * k, 0.7);
      break;
    case 'crossbar':
      // Unmistakable CLANG with short metallic tail.
      renderNoiseMono(mono, sampleRate, start, 0.02, 0.07 * k, rand);
      renderToneMono(mono, sampleRate, start, 620 * variantShift, 0.6, 'triangle', 0.085 * k, 0.985);
      renderToneMono(mono, sampleRate, start, 930 * variantShift, 0.45, 'triangle', 0.05 * k, 0.98);
      renderToneMono(mono, sampleRate, start, 55, 0.2, 'sine', 0.06 * k, 0.6);
      break;
    case 'save':
      // Glove thud + short whoosh layer.
      renderToneMono(mono, sampleRate, start, 90 * variantShift, 0.14, 'sine', 0.11 * k, 0.45);
      renderNoiseMono(mono, sampleRate, start, 0.1, 0.055 * k, rand);
      renderNoiseMono(mono, sampleRate, start - Math.round(0.06 * sampleRate), 0.08, 0.025 * k, rand);
      break;
    case 'clearance':
      renderToneMono(mono, sampleRate, start, 140 * variantShift, 0.08, 'square', 0.055 * k, 0.5);
      break;
    case 'goal':
    case 'crowd': {
      // Wide eruption: slow-attack noise wash + rising swell.
      renderNoiseMono(mono, sampleRate, start, duration, 0.11 * k, rand, Math.min(0.4, duration / 3));
      renderToneMono(mono, sampleRate, start, 300, Math.min(0.7, duration), 'sawtooth', 0.05 * k, 2.8);
      break;
    }
    case 'anticipation': {
      // Rising "OOOH": band-ish swell that peaks at duration end.
      const n = Math.max(1, Math.round(duration * sampleRate));
      for (let i = 0; i < n; i++) {
        const p = i / n;
        const at = start + i;
        if (at >= 0 && at < mono.length) {
          mono[at] += (rand() * 2 - 1) * (0.02 + 0.075 * p * p) * k;
        }
      }
      renderToneMono(mono, sampleRate, start, 220 * variantShift, duration, 'sawtooth', 0.012 * k, 1.8);
      break;
    }
    case 'whoosh':
      renderNoiseMono(mono, sampleRate, start, Math.max(0.08, duration), 0.06 * k, rand);
      break;
    case 'impact':
      // Cinematic sub sweetener: supports, never overpowers.
      renderToneMono(mono, sampleRate, start, 55, 0.25, 'sine', 0.09 * k, 0.5);
      renderNoiseMono(mono, sampleRate, start, 0.06, 0.03 * k, rand);
      break;
    case 'whistle':
      renderToneMono(mono, sampleRate, start, 1500, 0.22, 'sine', 0.05 * k, 0.98);
      break;
    case 'sting':
      // Original procedural HNC sonic logo (~0.6s): tonal hit + arcade motif.
      renderToneMono(mono, sampleRate, start, 523, 0.12, 'square', 0.05 * k, 1.0);
      renderToneMono(mono, sampleRate, start + Math.round(0.1 * sampleRate), 659, 0.12, 'square', 0.05 * k, 1.0);
      renderToneMono(mono, sampleRate, start + Math.round(0.2 * sampleRate), 784, 0.28, 'square', 0.055 * k, 0.99);
      renderToneMono(mono, sampleRate, start, 110, 0.3, 'sine', 0.06 * k, 0.8);
      break;
    case 'ambience': {
      const n = Math.min(mono.length - start, Math.round(duration * sampleRate));
      for (let i = 0; i < n; i++) {
        const at = start + i;
        if (at >= 0 && at < mono.length) mono[at] += (rand() * 2 - 1) * 0.014 * k;
      }
      break;
    }
    default:
      throw new Error(`Unknown audio event: ${type}`);
  }
}

export interface StereoMix {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  stems?: {
    ambience: { left: Float32Array; right: Float32Array };
    crowd: { left: Float32Array; right: Float32Array };
    sfx: { left: Float32Array; right: Float32Array };
    music: { left: Float32Array; right: Float32Array };
  };
}

export interface StereoMixOptions {
  /** Preserve per-bus stems (debug flag, off by default). */
  stems?: boolean;
}

function makeStereo(n: number): { left: Float32Array; right: Float32Array } {
  return { left: new Float32Array(n), right: new Float32Array(n) };
}

/**
 * Render a compiled plan to a stereo mix. Deterministic: same plan + seed =
 * identical samples. Crowd renders decorrelated L/R (wide stereo); point
 * sources (kicks) respect event pan (subtle left→right for crosses).
 */
export function renderStereoMix(
  plan: CompiledAudio,
  seed: number,
  opts: StereoMixOptions = {},
): StereoMix {
  const sr = plan.sampleRate;
  const n = Math.round(plan.duration * sr);
  const masterL = new Float32Array(n);
  const masterR = new Float32Array(n);
  const ducks = plan.ducks ?? [];
  const wantStems = opts.stems === true;
  const stemAmbience = wantStems ? makeStereo(n) : null;
  const stemCrowd = wantStems ? makeStereo(n) : null;
  const stemSfx = wantStems ? makeStereo(n) : null;
  const stemMusic = wantStems ? makeStereo(n) : null;

  // Crowd/mono beds pre-rendered once per channel with different seeds so
  // the stereo image is wide, not dual-mono.
  plan.events.forEach((ev, index) => {
    void preferredAssetId(seed, ev.type, index);
    const bus = eventBus(ev.type);
    const gain = BUS_GAIN[bus] ?? 1;
    const [pgL, pgR] = panGains(ev.pan ?? defaultPanFor(ev.type, ev.time));
    const mono = new Float32Array(n);
    renderEventMono(mono, sr, seed, index, ev.type, ev.time, ev.duration, ev.intensity);
    const isWide = bus === 'crowd';
    // Decorrelated stereo: crowd right channel gets a 7 ms delayed copy.
    const delay = isWide ? Math.round(0.007 * sr) : 0;
    for (let i = 0; i < n; i++) {
      const v = mono[i];
      if (v === 0) continue;
      const t = i / sr;
      const dg = duckGainAt(ducks, bus, t);
      const g = gain * dg;
      masterL[i] += v * pgL * g;
      const rv = delay > 0 ? (i - delay >= 0 ? mono[i - delay] : 0) : v;
      masterR[i] += rv * pgR * g;
      if (wantStems) {
        if (bus === 'ambience' && stemAmbience) { stemAmbience.left[i] += v * pgL * g; stemAmbience.right[i] += rv * pgR * g; }
        else if (bus === 'crowd' && stemCrowd) { stemCrowd.left[i] += v * pgL * g; stemCrowd.right[i] += rv * pgR * g; }
        else if ((bus === 'foreground' || bus === 'sweetener') && stemSfx) { stemSfx.left[i] += v * pgL * g; stemSfx.right[i] += rv * pgR * g; }
        else if (stemMusic) { stemMusic.left[i] += v * pgL * g; stemMusic.right[i] += rv * pgR * g; }
      }
    }
  });

  // Conservative normalization: preserve balance, avoid clipping.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(masterL[i]);
    const b = Math.abs(masterR[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  if (peak > 0.89) {
    const g = 0.89 / peak;
    for (let i = 0; i < n; i++) { masterL[i] *= g; masterR[i] *= g; }
    if (wantStems) {
      for (const s of [stemAmbience, stemCrowd, stemSfx, stemMusic]) {
        if (!s) continue;
        for (let i = 0; i < n; i++) { s.left[i] *= g; s.right[i] *= g; }
      }
    }
  }
  return {
    sampleRate: sr,
    left: masterL,
    right: masterR,
    ...(wantStems
      ? { stems: { ambience: stemAmbience!, crowd: stemCrowd!, sfx: stemSfx!, music: stemMusic! } }
      : {}),
  };
}

/** Sensible default pans: crosses travel left→right, shots centred. */
function defaultPanFor(type: string, time: number): number {
  if (type === 'cross' || type === 'whoosh') {
    // Subtle travel with time so consecutive whooshes alternate sides.
    return Math.sin(time * 1.7) * 0.4;
  }
  return 0;
}

/** Peak absolute sample across both channels. */
export function stereoPeak(mix: StereoMix): number {
  let peak = 0;
  for (let i = 0; i < mix.left.length; i++) {
    const a = Math.abs(mix.left[i]);
    const b = Math.abs(mix.right[i]);
    if (a > peak) peak = a;
    if (b > peak) peak = b;
  }
  return peak;
}

/** Encode interleaved stereo 16-bit PCM WAV. */
export function encodeStereoWav(mix: StereoMix): Buffer {
  const n = mix.left.length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22); // stereo
  data.writeUInt32LE(mix.sampleRate, 24);
  data.writeUInt32LE(mix.sampleRate * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, mix.left[i]));
    const r = Math.max(-1, Math.min(1, mix.right[i]));
    data.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }
  return data;
}

/** Compile + stereo render + encode in one deterministic step. */
export function renderStereoToWav(plan: CompiledAudio, seed: number): Buffer {
  return encodeStereoWav(renderStereoMix(plan, seed));
}
