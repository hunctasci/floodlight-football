import { seededRandom } from '../scenes/faceoff';
import { AUDIO_SAMPLE_RATE } from './compile';
import { CROWD_POOL_BY_TYPE, preferredAssetId } from './library';
import { loadAudioManifest, resolveAssetFile } from './manifest-fs';
import { loadCrowdSample, type DecodedSample } from './samples';
import type { AudioEvent, CompiledAudio, MixDuck } from './types';

/**
 * Production stereo mix engine (48 kHz stereo).
 *
 * Semantic buses: foreground SFX / crowd / ambience / music / sweeteners.
 * Pre-impact ducks + 50–120 ms micro-silence create anticipation; major
 * contacts layer arcade procedural SFX (kick/header/bar/save + sub
 * sweetener + whoosh) while the HUMAN atmosphere — stadium beds,
 * anticipation rises, goal eruptions, disappointment groans — plays from
 * real bundled Freesound CC0 recordings (assets/audio/crowd/).
 *
 * Architecture: scene/choreography code decides WHAT/WHEN/INTENSITY (and
 * pins a deterministic variant via assetId); this mixer decides WHICH
 * ASSET file, HOW LOUD, PAN, FADES and MIX. No filesystem or decode logic
 * lives in scene code — only here (plus samples.ts).
 *
 * Fallback: a missing/corrupt crowd file renders the deterministic
 * procedural HNC synth for that event and records an explicit warning on
 * the result (never silent substitution). `--crowd-mode procedural`
 * forces the full procedural path for A/B comparison.
 *
 * Everything is seeded determinism: same plan + same seed = byte-identical
 * stereo WAV.
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

/**
 * Sample-voice gains (linear, replace the bus gain — crowd recordings are
 * pre-mastered so the hierarchy is baked in here): bed QUIET presence,
 * anticipation MEDIUM, roar VERY STRONG, celebration tails scale with
 * intensity. The goal feels huge because the baseline was lower.
 */
const SAMPLE_GAIN: Record<string, number> = {
  ambience: 0.9,
  anticipation: 0.55,
  goal: 0.95,
  crowd: 0.95,
  disappointment: 0.6,
};

function eventBus(type: string): string {
  switch (type) {
    case 'ambience': return 'ambience';
    case 'crowd':
    case 'anticipation':
    case 'disappointment':
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
    case 'disappointment': {
      // Procedural FALLBACK "awww" (only when the real groan is missing):
      // descending tonal sigh + deflating noise wash.
      renderToneMono(mono, sampleRate, start, 380 * variantShift, Math.max(0.3, duration), 'sawtooth', 0.03 * k, 0.6);
      renderToneMono(mono, sampleRate, start, 190 * variantShift, Math.max(0.3, duration), 'triangle', 0.04 * k, 0.65);
      renderNoiseMono(mono, sampleRate, start, Math.max(0.3, duration), 0.05 * k, rand, 0.05);
      break;
    }
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
  /**
   * Explicit fallback report: one entry per crowd event that could not use
   * its real recording (missing/corrupt file) and rendered procedurally
   * instead. Absent/empty means the mix is fully real where designed.
   */
  warnings?: string[];
}

export type CrowdMode = 'real' | 'procedural';

export interface StereoMixOptions {
  /** Preserve per-bus stems (debug flag, off by default). */
  stems?: boolean;
  /**
   * 'real' (default): bundled crowd recordings where designed, procedural
   * fallback + warning otherwise. 'procedural': force the legacy synth for
   * A/B comparison against the old game-engine sound.
   */
  crowdMode?: CrowdMode;
}

function makeStereo(n: number): { left: Float32Array; right: Float32Array } {
  return { left: new Float32Array(n), right: new Float32Array(n) };
}

interface SampleVoice {
  sample: DecodedSample;
  /** Pre-mastered linear gain (already includes intensity; replaces bus gain). */
  gain: number;
  bed: boolean;
}

/**
 * Resolve a sample-backed event to its bundled recording. Deterministic:
 * same seed + event type + occurrence index = same file. Returns null when
 * the event is procedural-only (kicks, impacts, …) or when crowdMode forces
 * the synth; records a warning and returns null when a designed recording
 * is missing or corrupt (caller renders the procedural fallback).
 */
function resolveVoice(
  seed: number, ev: AudioEvent, index: number, warnings: string[],
): SampleVoice | null {
  let id = ev.assetId ?? null;
  if (!id) {
    const pool = CROWD_POOL_BY_TYPE[ev.type];
    if (!pool) return null;
    id = preferredAssetId(seed, pool, index);
  }
  const manifest = loadAudioManifest();
  const asset = manifest.assets.find((a) => a.id === id);
  if (!asset) {
    warnings.push(`crowd asset "${id}" (${ev.type}@${ev.time.toFixed(2)}s): not in manifest — procedural fallback`);
    return null;
  }
  const file = resolveAssetFile(asset);
  if (!file) {
    warnings.push(`crowd asset "${id}" (${ev.type}@${ev.time.toFixed(2)}s): file missing (${asset.file}) — procedural fallback`);
    return null;
  }
  try {
    const sample = loadCrowdSample(file, MIX_SAMPLE_RATE);
    const gain = (SAMPLE_GAIN[ev.type] ?? 0.8) * ev.intensity;
    return { sample, gain, bed: ev.type === 'ambience' };
  } catch (error) {
    warnings.push(`crowd asset "${id}" (${ev.type}@${ev.time.toFixed(2)}s): ${error instanceof Error ? error.message : String(error)} — procedural fallback`);
    return null;
  }
}

/** Raised-cosine ramp 0→1 over n samples (click-free voice attack). */
function attackRamp(i: number, n: number): number {
  if (n <= 0 || i >= n) return 1;
  const k = Math.sin((Math.PI / 2) * (i / n));
  return k * k;
}

/**
 * Render a one-shot crowd sample (roar/anticipation/groan) into the master
 * buses at event time. The voice plays at most ev.duration (the plan's
 * dramatic window) with a short release fade when truncated; files carry
 * their own attack fades, plus a few-ms safety attack here.
 */
function renderSampleOneshot(
  masterL: Float32Array, masterR: Float32Array,
  stems: StereoMix['stems'] | null, bus: string,
  voice: SampleVoice, startSample: number, durSamples: number, panL: number, panR: number,
  ducks: readonly MixDuck[], sampleRate: number,
): void {
  const n = masterL.length;
  const playLen = Math.min(voice.sample.left.length, durSamples, n - startSample);
  if (playLen <= 0) return;
  const attack = Math.round(0.008 * sampleRate);
  const release = Math.min(Math.round(0.1 * sampleRate), Math.floor(playLen / 2));
  for (let i = 0; i < playLen; i++) {
    const at = startSample + i;
    if (at < 0) continue;
    const tail = playLen - 1 - i;
    const rel = tail < release ? Math.sin((Math.PI / 2) * (tail / release)) ** 2 : 1;
    const t = at / sampleRate;
    const g = voice.gain * attackRamp(i, attack) * rel * duckGainAt(ducks, bus, t);
    const l = voice.sample.left[i] * panL * g;
    const r = voice.sample.right[i] * panR * g;
    masterL[at] += l;
    masterR[at] += r;
    if (stems) routeStem(stems, bus, at, l, r);
  }
}

/**
 * Render a looping stadium bed across [startSample, startSample+durSamples)
 * with an equal-power crossfade at the loop joint. The baked 0.5 s file
 * edges are excluded from the loop region so the seam stays inaudible.
 */
function renderBedLoop(
  masterL: Float32Array, masterR: Float32Array,
  stems: StereoMix['stems'] | null, bus: string,
  voice: SampleVoice, startSample: number, durSamples: number,
  ducks: readonly MixDuck[], sampleRate: number,
): void {
  const n = masterL.length;
  const frames = Math.min(durSamples, n - startSample);
  if (frames <= 0) return;
  const edge = Math.round(0.5 * sampleRate);
  const sN = voice.sample.left.length;
  const regionStart = Math.min(edge, Math.floor(sN / 4));
  const regionLen = Math.max(1, sN - regionStart * 2);
  const xf = Math.max(1, Math.min(Math.round(1.0 * sampleRate), Math.floor(regionLen / 2)));
  const loopLen = regionLen - xf;
  for (let i = 0; i < frames; i++) {
    const at = startSample + i;
    if (at < 0) continue;
    const p = loopLen > 0 ? i % loopLen : 0;
    let l: number;
    let r: number;
    if (p < xf && loopLen > 0) {
      const a = (Math.PI / 2) * (p / xf);
      const gIn = Math.sin(a);
      const gOut = Math.cos(a);
      const head = regionStart + p;
      const tail = regionStart + p + loopLen;
      l = voice.sample.left[head] * gIn + voice.sample.left[tail] * gOut;
      r = voice.sample.right[head] * gIn + voice.sample.right[tail] * gOut;
    } else {
      const s = regionStart + p;
      l = voice.sample.left[s];
      r = voice.sample.right[s];
    }
    const t = at / sampleRate;
    const g = voice.gain * duckGainAt(ducks, bus, t);
    const lv = l * g;
    const rv = r * g;
    masterL[at] += lv;
    masterR[at] += rv;
    if (stems) routeStem(stems, bus, at, lv, rv);
  }
}

function routeStem(
  stems: NonNullable<StereoMix['stems']>, bus: string, at: number, l: number, r: number,
): void {
  if (bus === 'ambience') { stems.ambience.left[at] += l; stems.ambience.right[at] += r; }
  else if (bus === 'crowd') { stems.crowd.left[at] += l; stems.crowd.right[at] += r; }
  else if (bus === 'foreground' || bus === 'sweetener') { stems.sfx.left[at] += l; stems.sfx.right[at] += r; }
  else { stems.music.left[at] += l; stems.music.right[at] += r; }
}

/**
 * Render a compiled plan to a stereo mix. Deterministic: same plan + seed =
 * identical samples. Crowd recordings keep their natural stereo width;
 * point sources (kicks) respect event pan (subtle left→right for crosses,
 * scoring-stand lean for eruptions).
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
  const realCrowd = (opts.crowdMode ?? 'real') === 'real';
  const stemAmbience = wantStems ? makeStereo(n) : null;
  const stemCrowd = wantStems ? makeStereo(n) : null;
  const stemSfx = wantStems ? makeStereo(n) : null;
  const stemMusic = wantStems ? makeStereo(n) : null;
  const stems = wantStems
    ? { ambience: stemAmbience!, crowd: stemCrowd!, sfx: stemSfx!, music: stemMusic! }
    : null;
  const warnings: string[] = [];

  // Crowd/mono beds pre-rendered once per channel with different seeds so
  // the stereo image is wide, not dual-mono.
  plan.events.forEach((ev, index) => {
    const bus = eventBus(ev.type);
    const [pgL, pgR] = panGains(ev.pan ?? defaultPanFor(ev.type, ev.time));
    const voice = realCrowd ? resolveVoice(seed, ev, index, warnings) : null;
    if (voice) {
      const startSample = Math.round(ev.time * sr);
      if (voice.bed) {
        renderBedLoop(masterL, masterR, stems, bus, voice, startSample, Math.round(ev.duration * sr), ducks, sr);
      } else {
        renderSampleOneshot(masterL, masterR, stems, bus, voice, startSample, Math.round(ev.duration * sr), pgL, pgR, ducks, sr);
      }
      return;
    }
    const gain = BUS_GAIN[bus] ?? 1;
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
      if (stems) {
        if (bus === 'ambience') { stems.ambience.left[i] += v * pgL * g; stems.ambience.right[i] += rv * pgR * g; }
        else if (bus === 'crowd') { stems.crowd.left[i] += v * pgL * g; stems.crowd.right[i] += rv * pgR * g; }
        else if ((bus === 'foreground' || bus === 'sweetener')) { stems.sfx.left[i] += v * pgL * g; stems.sfx.right[i] += rv * pgR * g; }
        else { stems.music.left[i] += v * pgL * g; stems.music.right[i] += rv * pgR * g; }
      }
    }
  });

  // Conservative gain staging: preserve balance, light peak protection only.
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
    if (stems) {
      for (const s of [stems.ambience, stems.crowd, stems.sfx, stems.music]) {
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
    ...(warnings.length > 0 ? { warnings } : {}),
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
