/**
 * Offline stereo music synth for original HNC scores (Node, deterministic).
 * Band-limited oscillators (polyBLEP), per-voice state-variable filters,
 * drum voices, a formant "choir", Freeverb-style reverb, ping-pong delay,
 * sidechain ducking and tape-stop. No samples, no third-party material:
 * every sound is computed here from the note list. Seeded noise only.
 */
import { rng } from '../../utils/rng';

export const SR = 48000;

export class Bus {
  readonly L: Float32Array;
  readonly R: Float32Array;
  constructor(readonly n: number) {
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  add(other: Bus, gain = 1): void {
    for (let i = 0; i < this.n; i++) {
      this.L[i] += other.L[i] * gain;
      this.R[i] += other.R[i] * gain;
    }
  }
}

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'D4', 'Bb3', 'F#5' → MIDI. */
export function m(name: string): number {
  const r = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  if (!r) throw new Error(`bad note ${name}`);
  return 12 * (Number(r[3]) + 1) + NOTE[r[1]] + (r[2] === 'b' ? -1 : r[2] === '#' ? 1 : 0);
}

const panGains = (pan: number): [number, number] => {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
};

function polyblep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export type Wave = 'saw' | 'square' | 'sine' | 'tri';

export interface Env {
  a: number;
  d: number;
  s: number;
  r: number;
}

/** ADSR at time t (s) of a note held for `hold` seconds. */
export function adsr(e: Env, t: number, hold: number): number {
  if (t < 0) return 0;
  const on = t < e.a ? t / Math.max(1e-4, e.a) : t < e.a + e.d ? 1 - (1 - e.s) * ((t - e.a) / Math.max(1e-4, e.d)) : e.s;
  if (t < hold) return on;
  const at = hold < e.a ? hold / Math.max(1e-4, e.a) : hold < e.a + e.d ? 1 - (1 - e.s) * ((hold - e.a) / Math.max(1e-4, e.d)) : e.s;
  const k = (t - hold) / Math.max(1e-4, e.r);
  return k >= 1 ? 0 : at * (1 - k) * (1 - k);
}

export interface Patch {
  waves: Wave[];
  /** Unison voices per wave and total detune spread (cents). */
  voices?: number;
  detune?: number;
  /** Stereo width of the unison (0 mono .. 1 wide). */
  width?: number;
  amp: Env;
  /** Low-pass: base cutoff Hz, envelope depth Hz, resonance 0..1. */
  filter?: { cut: number; env?: number; res?: number; e?: Env; keytrack?: number };
  gain: number;
  pan?: number;
  /** Sub sine one octave down (gain relative to the patch). */
  sub?: number;
  vibrato?: { rate: number; depth: number; delay?: number };
  /** Pitch glide from the previous note (s). */
  glide?: number;
  drive?: number;
}

export interface Note {
  t: number;
  dur: number;
  midi: number;
  vel?: number;
}

/**
 * Play notes through a patch into a bus. Each unison voice keeps its own
 * phase and filter state; cutoff is recomputed every 16 samples.
 */
export function play(bus: Bus, notes: Note[], p: Patch, seed = 1): void {
  const voices = p.voices ?? 1;
  const width = p.width ?? 0.5;
  const rand = rng(seed, `play:${notes.length}:${p.gain}`);
  let prevMidi: number | undefined;
  for (const n of notes) {
    const vel = n.vel ?? 1;
    const tail = p.amp.r + 0.02;
    const start = Math.round(n.t * SR);
    const len = Math.round((n.dur + tail) * SR);
    const from = prevMidi ?? n.midi;
    prevMidi = n.midi;
    const unison: { det: number; wave: Wave; phase: number; pan: [number, number]; lp: number; bp: number }[] = [];
    for (const wave of p.waves) {
      for (let v = 0; v < voices; v++) {
        const spread = voices === 1 ? 0 : v / (voices - 1) - 0.5;
        unison.push({ det: spread * (p.detune ?? 0), wave, phase: rand(), pan: panGains((p.pan ?? 0) + spread * 2 * width), lp: 0, bp: 0 });
      }
    }
    const norm = 1 / Math.sqrt(unison.length);
    let g = 0;
    let fcoef = 0.5;
    const q = 1 - 0.9 * (p.filter?.res ?? 0.1);
    let subPh = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= bus.n) continue;
      const t = i / SR;
      if ((i & 15) === 0) {
        g = adsr(p.amp, t, n.dur) * vel;
        if (p.filter) {
          const fe = p.filter.e ? adsr(p.filter.e, t, n.dur) : 1;
          const kt = p.filter.keytrack ? Math.pow(midiHz(n.midi) / 261.6, p.filter.keytrack) : 1;
          const cut = Math.min(18000, (p.filter.cut + (p.filter.env ?? 0) * fe) * kt);
          fcoef = 2 * Math.sin((Math.PI * cut) / SR);
        }
      }
      if (g <= 0 && t > n.dur) continue;
      const glideK = p.glide ? Math.min(1, t / p.glide) : 1;
      const mid = from + (n.midi - from) * glideK;
      const vib = p.vibrato && t > (p.vibrato.delay ?? 0) ? p.vibrato.depth * Math.sin(2 * Math.PI * p.vibrato.rate * t) * Math.min(1, (t - (p.vibrato.delay ?? 0)) / 0.25) : 0;
      const base = midiHz(mid + vib);
      let l = 0;
      let r = 0;
      for (const u of unison) {
        const f = base * Math.pow(2, u.det / 1200);
        const dt = f / SR;
        u.phase += dt;
        if (u.phase >= 1) u.phase -= 1;
        let s: number;
        if (u.wave === 'saw') s = 2 * u.phase - 1 - polyblep(u.phase, dt);
        else if (u.wave === 'square') s = (u.phase < 0.5 ? 1 : -1) + polyblep(u.phase, dt) - polyblep((u.phase + 0.5) % 1, dt);
        else if (u.wave === 'tri') s = 1 - 4 * Math.abs(u.phase - 0.5);
        else s = Math.sin(2 * Math.PI * u.phase);
        if (p.filter) {
          // Chamberlin SVF, two passes (12 dB -> 24 dB-ish)
          u.lp += fcoef * u.bp;
          const hp = s - u.lp - q * u.bp;
          u.bp += fcoef * hp;
          s = u.lp;
        }
        l += s * u.pan[0];
        r += s * u.pan[1];
      }
      let subv = 0;
      if (p.sub) {
        subPh += (base / 2) / SR;
        subv = Math.sin(2 * Math.PI * subPh) * p.sub;
      }
      let vl = (l * norm + subv) * g * p.gain;
      let vr = (r * norm + subv) * g * p.gain;
      if (p.drive) {
        vl = Math.tanh(vl * p.drive) / p.drive;
        vr = Math.tanh(vr * p.drive) / p.drive;
      }
      bus.L[idx] += vl;
      bus.R[idx] += vr;
    }
  }
}

// --- noise-based voices ---------------------------------------------------------

type Rand = () => number;

/**
 * Stereo noise through a one-pole low-pass (`lp` coefficient, 1 = open) and an
 * optional high-pass (`hp` = coefficient of the low-tracker that is
 * subtracted: 0.07 ≈ 550 Hz, 0.3 ≈ 2.7 kHz, 0.6 ≈ 7 kHz).
 */
function noiseVoice(bus: Bus, t0: number, dur: number, gain: number, rand: Rand, opts: { lp?: number; hp?: number; env: (p: number, t: number) => number; pan?: number; width?: number }): void {
  const start = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  const lp = opts.lp ?? 1;
  const hp = opts.hp ?? 0;
  const [pl, pr] = panGains(opts.pan ?? 0);
  const w = opts.width ?? 0.3;
  let lpL = 0;
  let lpR = 0;
  let lowL = 0;
  let lowR = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= bus.n) continue;
    const common = rand() * 2 - 1;
    lpL += lp * (common * (1 - w) + (rand() * 2 - 1) * w - lpL);
    lpR += lp * (common * (1 - w) + (rand() * 2 - 1) * w - lpR);
    lowL += hp * (lpL - lowL);
    lowR += hp * (lpR - lowR);
    const e = opts.env(i / len, i / SR) * gain * 1.41;
    bus.L[idx] += (hp ? lpL - lowL : lpL) * e * pl;
    bus.R[idx] += (hp ? lpR - lowR : lpR) * e * pr;
  }
}

function sineSweep(bus: Bus, t0: number, dur: number, f0: number, f1: number, gain: number, env: (p: number, t: number) => number, pan = 0, curve = 1): void {
  const start = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  const [pl, pr] = panGains(pan);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= bus.n) continue;
    const p = i / len;
    const f = f0 * Math.pow(f1 / f0, Math.pow(p, curve));
    ph += f / SR;
    const v = Math.sin(2 * Math.PI * ph) * env(p, i / SR) * gain;
    bus.L[idx] += v * pl * 1.41;
    bus.R[idx] += v * pr * 1.41;
  }
}

export interface Drums {
  kick(t: number, vel?: number): void;
  snare(t: number, vel?: number): void;
  hat(t: number, vel?: number, open?: boolean): void;
  taiko(t: number, vel?: number, pan?: number): void;
  clap(t: number, vel?: number): void;
  crash(t: number, vel?: number): void;
  reverseCymbal(end: number, dur: number, vel?: number): void;
  boom(t: number, vel?: number): void;
}

/** Drum kit writing into `bus`; kicks are recorded for sidechain ducking. */
export function drums(bus: Bus, seed: number, kicks: number[]): Drums {
  const rand = rng(seed, 'drums');
  return {
    kick(t, vel = 1) {
      kicks.push(t);
      sineSweep(bus, t, 0.42, 160, 44, 0.95 * vel, (p, s) => Math.min(1, s / 0.002) * Math.exp(-s * 7.5), 0, 0.25);
      noiseVoice(bus, t, 0.012, 0.35 * vel, rand, { lp: 0.9, env: (p) => 1 - p, width: 0 });
    },
    snare(t, vel = 1) {
      sineSweep(bus, t, 0.14, 240, 180, 0.35 * vel, (p, s) => Math.exp(-s * 26));
      noiseVoice(bus, t, 0.26, 0.55 * vel, rand, { lp: 0.8, hp: 0.12, env: (p, s) => Math.min(1, s / 0.001) * Math.exp(-s * 16), width: 0.35 });
    },
    hat(t, vel = 1, open = false) {
      noiseVoice(bus, t, open ? 0.26 : 0.05, (open ? 0.2 : 0.16) * vel, rand, { lp: 1, hp: 0.6, env: (p, s) => Math.exp(-s * (open ? 12 : 70)), pan: 0.25, width: 0.5 });
    },
    taiko(t, vel = 1, pan = 0) {
      sineSweep(bus, t, 0.9, 110, 52, 0.8 * vel, (p, s) => Math.min(1, s / 0.003) * Math.exp(-s * 4.2), pan, 0.4);
      noiseVoice(bus, t, 0.25, 0.3 * vel, rand, { lp: 0.12, env: (p, s) => Math.exp(-s * 14), pan, width: 0.2 });
    },
    clap(t, vel = 1) {
      for (const d of [0, 0.011, 0.023]) noiseVoice(bus, t + d, 0.16, 0.3 * vel, rand, { lp: 0.7, hp: 0.2, env: (p, s) => Math.exp(-s * 30), width: 0.6 });
    },
    crash(t, vel = 1) {
      noiseVoice(bus, t, 2.6, 0.28 * vel, rand, { lp: 0.95, hp: 0.5, env: (p, s) => Math.min(1, s / 0.002) * Math.exp(-s * 1.6), width: 0.8 });
    },
    reverseCymbal(end, dur, vel = 1) {
      noiseVoice(bus, end - dur, dur, 0.3 * vel, rand, { lp: 0.9, hp: 0.45, env: (p) => Math.pow(p, 3), width: 0.8 });
    },
    boom(t, vel = 1) {
      sineSweep(bus, t, 2.4, 70, 26, 1.0 * vel, (p, s) => Math.min(1, s / 0.004) * Math.exp(-s * 1.6), 0, 0.5);
      noiseVoice(bus, t, 0.9, 0.35 * vel, rand, { lp: 0.05, env: (p, s) => Math.exp(-s * 4), width: 0.5 });
    },
  };
}

/** Filtered-noise riser that peaks at t0 + dur (+ a rising saw). */
export function riser(bus: Bus, t0: number, dur: number, gain: number, seed: number): void {
  const rand = rng(seed, `riser:${t0}`);
  const start = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  let bp = 0;
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= bus.n) break;
    const p = i / len;
    const f = 2 * Math.sin((Math.PI * (300 + 7000 * p * p)) / SR);
    const x = rand() * 2 - 1;
    lp += f * bp;
    const hp = x - lp - 0.5 * bp;
    bp += f * hp;
    const v = bp * gain * Math.pow(p, 2.2);
    bus.L[idx] += v;
    bus.R[idx] += v * 0.9;
  }
  play(bus, [{ t: t0, dur, midi: 38 }], { waves: ['saw'], voices: 3, detune: 30, amp: { a: dur * 0.9, d: 0.01, s: 1, r: 0.02 }, filter: { cut: 200, env: 5000, e: { a: dur, d: 0.01, s: 1, r: 0.05 } }, gain: gain * 0.5, glide: dur }, seed);
}

/** Formant "aah" choir: detuned saws through three vowel formants. */
export function choir(bus: Bus, notes: Note[], gain: number, seed: number, pan = 0): void {
  const tmp = new Bus(bus.n);
  play(tmp, notes, { waves: ['saw'], voices: 4, detune: 18, width: 0.8, amp: { a: 0.6, d: 0.2, s: 0.9, r: 1.2 }, gain: 1, pan, vibrato: { rate: 5.2, depth: 0.12, delay: 0.3 } }, seed);
  const F = [
    [800, 1, 0.08],
    [1150, 0.5, 0.09],
    [2900, 0.12, 0.12],
  ] as const;
  const state = F.map(() => ({ l: [0, 0], r: [0, 0] }));
  for (let i = 0; i < bus.n; i++) {
    let l = 0;
    let r = 0;
    F.forEach(([f, k, bw], j) => {
      const c = 2 * Math.sin((Math.PI * f) / SR);
      const q = bw * 4;
      const s = state[j];
      s.l[0] += c * s.l[1];
      const hl = tmp.L[i] - s.l[0] - q * s.l[1];
      s.l[1] += c * hl;
      s.r[0] += c * s.r[1];
      const hr = tmp.R[i] - s.r[0] - q * s.r[1];
      s.r[1] += c * hr;
      l += s.l[1] * k;
      r += s.r[1] * k;
    });
    bus.L[i] += l * gain;
    bus.R[i] += r * gain;
  }
}

// --- effects ---------------------------------------------------------------------

/** Freeverb-style stereo reverb (8 combs + 4 allpasses per side), returns the wet bus. */
export function reverb(src: Bus, size = 0.84, damp = 0.3): Bus {
  const out = new Bus(src.n);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round((d * SR) / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round((d * SR) / 44100));
  for (const [ch, spread] of [[0, 0], [1, 23]] as const) {
    const input = ch === 0 ? src.L : src.R;
    const o = ch === 0 ? out.L : out.R;
    const cb = combs.map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const ab = aps.map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < src.n; n++) {
      const x = input[n] * 0.015;
      let acc = 0;
      for (const c of cb) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * size;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const a of ab) {
        const y = a.buf[a.i];
        a.buf[a.i] = acc + y * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        acc = y - acc;
      }
      o[n] = acc;
    }
  }
  return out;
}

/** Ping-pong delay (seconds), returns the wet bus. */
export function pingPong(src: Bus, time: number, feedback = 0.38, tone = 0.35): Bus {
  const out = new Bus(src.n);
  const d = Math.round(time * SR);
  const bl = new Float32Array(d);
  const br = new Float32Array(d);
  let i = 0;
  let lpL = 0;
  let lpR = 0;
  for (let n = 0; n < src.n; n++) {
    const yl = bl[i];
    const yr = br[i];
    lpL += tone * (yl - lpL);
    lpR += tone * (yr - lpR);
    bl[i] = (src.L[n] + src.R[n]) * 0.5 + lpR * feedback;
    br[i] = lpL * feedback;
    i = (i + 1) % d;
    out.L[n] = yl;
    out.R[n] = yr;
  }
  return out;
}

/** Duck a bus after every kick (pumping, the pulse of the track). */
export function sidechain(bus: Bus, kicks: number[], depth = 0.55, release = 0.16): void {
  const sorted = [...kicks].sort((a, b) => a - b);
  let k = 0;
  for (let i = 0; i < bus.n; i++) {
    const t = i / SR;
    while (k + 1 < sorted.length && sorted[k + 1] <= t) k++;
    const since = sorted.length && sorted[k] <= t ? t - sorted[k] : Infinity;
    const g = 1 - depth * Math.exp(-since / release) * Math.min(1, since / 0.004);
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
}

/** Tape stop: from t0 the bus slows to a halt over `dur`, then silence until `until`. */
export function tapeStop(bus: Bus, t0: number, dur: number, until: number): void {
  const s = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const e = Math.round(until * SR);
  const L = bus.L.slice(s, s + n * 2);
  const R = bus.R.slice(s, s + n * 2);
  let pos = 0;
  for (let i = 0; i < n && s + i < bus.n; i++) {
    const rate = Math.pow(1 - i / n, 1.6);
    pos += rate;
    const j = Math.floor(pos);
    const f = pos - j;
    const fade = 1 - i / n;
    bus.L[s + i] = ((L[j] ?? 0) * (1 - f) + (L[j + 1] ?? 0) * f) * fade;
    bus.R[s + i] = ((R[j] ?? 0) * (1 - f) + (R[j + 1] ?? 0) * f) * fade;
  }
  for (let i = s + n; i < Math.min(e, bus.n); i++) {
    bus.L[i] = 0;
    bus.R[i] = 0;
  }
}

/** Gain automation: linear ramps between [time, gain] keys. */
export function automate(bus: Bus, keys: [number, number][]): void {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  let j = 0;
  for (let i = 0; i < bus.n; i++) {
    const t = i / SR;
    while (j + 1 < k.length && k[j + 1][0] <= t) j++;
    let g: number;
    if (t <= k[0][0]) g = k[0][1];
    else if (j + 1 >= k.length) g = k[k.length - 1][1];
    else {
      const [t0, g0] = k[j];
      const [t1, g1] = k[j + 1];
      g = g0 + (g1 - g0) * ((t - t0) / Math.max(1e-6, t1 - t0));
    }
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
}

/** Soft-clip + peak-normalise to `peak`, returns interleaved 16-bit WAV. */
export function masterWav(bus: Bus, peak = 0.7): Buffer {
  let mx = 1e-9;
  for (let i = 0; i < bus.n; i++) {
    bus.L[i] = Math.tanh(bus.L[i] * 1.1);
    bus.R[i] = Math.tanh(bus.R[i] * 1.1);
    mx = Math.max(mx, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  }
  const g = peak / mx;
  const data = Buffer.alloc(44 + bus.n * 4);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + bus.n * 4, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(bus.n * 4, 40);
  for (let i = 0; i < bus.n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.L[i] * g)) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus.R[i] * g)) * 32767), 46 + i * 4);
  }
  return data;
}
