/**
 * Social sketch sounds, synthesised offline (Node, deterministic): room
 * tones, typing, UI pings, risers, record scratch, fluorescent flicker,
 * bloom swell, zip, news stinger. Same spirit as the game's arcade recipes —
 * simple oscillators + seeded noise — at final output level (no normalising).
 */
import { rng } from '../utils/rng';

export const SAMPLE_RATE = 48000;

type Out = Float32Array;
type Rand = () => number;

function env(i: number, n: number, attack: number, release: number): number {
  const a = attack > 0 ? Math.min(1, i / attack) : 1;
  const r = release > 0 ? Math.min(1, (n - i) / release) : 1;
  return Math.max(0, Math.min(a, r));
}

function put(out: Out, at: number, v: number): void {
  if (at >= 0 && at < out.length) out[at] += v;
}

/** Sine / saw / square with exponential glide f0 → f1, custom envelope. */
function tone(out: Out, start: number, seconds: number, f0: number, f1: number, gain: number, shape: 'sine' | 'saw' | 'square' | 'tri', envelope: (p: number) => number): void {
  const n = Math.max(1, Math.round(seconds * SAMPLE_RATE));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const f = f0 * Math.pow(f1 / f0, p);
    ph += (2 * Math.PI * f) / SAMPLE_RATE;
    const x = ph % (2 * Math.PI);
    const v = shape === 'sine' ? Math.sin(x) : shape === 'saw' ? x / Math.PI - 1 : shape === 'square' ? (x < Math.PI ? 1 : -1) * 0.6 : (2 / Math.PI) * Math.asin(Math.sin(x));
    put(out, start + i, v * gain * envelope(p));
  }
}

/** Noise with a one-pole low-pass (lp 0..1, lower = darker) and envelope. */
function noise(out: Out, start: number, seconds: number, gain: number, rand: Rand, lp: number, envelope: (p: number) => number, hp = 0): void {
  const n = Math.max(1, Math.round(seconds * SAMPLE_RATE));
  let y = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    y += lp * (rand() * 2 - 1 - y);
    const v = hp ? y - prev * hp : y;
    prev = y;
    put(out, start + i, v * gain * envelope(i / n));
  }
}

const decay = (k: number) => (p: number) => Math.exp(-p * k);
const hit = (attack: number, k: number) => (p: number) => Math.min(1, p / attack) * Math.exp(-p * k);

/** Brown-ish bed (leaky integrated noise) + mains hum, faded at the edges. */
function bed(out: Out, start: number, seconds: number, rand: Rand, level: number, hum: number, humF: number): void {
  const n = Math.max(1, Math.round(seconds * SAMPLE_RATE));
  const fade = Math.min(n / 3, SAMPLE_RATE * 0.3);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = b * 0.985 + (rand() * 2 - 1) * 0.15;
    const t = i / SAMPLE_RATE;
    const h = Math.sin(2 * Math.PI * humF * t) * 0.6 + Math.sin(4 * Math.PI * humF * t) * 0.4;
    const breathe = 1 + 0.08 * Math.sin(t * 0.7);
    put(out, start + i, (b * level * breathe + h * hum) * env(i, n, fade, fade));
  }
}

export type SocialRecipe = (out: Out, start: number, seconds: number, gain: number, rand: Rand) => void;

export const SOCIAL_RECIPES: Record<string, SocialRecipe> = {
  'office-tone': (o, s, d, g, r) => bed(o, s, d, r, 0.05 * g, 0.004 * g, 60),
  'studio-tone': (o, s, d, g, r) => bed(o, s, d, r, 0.035 * g, 0.003 * g, 50),
  'room-tone': (o, s, d, g, r) => bed(o, s, d, r, 0.025 * g, 0, 60),
  buzz: (o, s, d, g) => {
    const n = Math.round(d * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const v = [1, 0.6, 0.45, 0.3].reduce((a, k, h) => a + k * Math.sin(2 * Math.PI * 120 * (h + 1) * t), 0);
      put(o, s + i, v * 0.006 * g * (1 + 0.3 * Math.sin(t * 37)) * env(i, n, 2000, 4000));
    }
  },
  typing: (o, s, d, g, r) => {
    let t = 0;
    while (t < d) {
      const at = s + Math.round(t * SAMPLE_RATE);
      const space = r() < 0.12;
      noise(o, at, space ? 0.02 : 0.009, (space ? 0.16 : 0.12 + r() * 0.08) * g, r, space ? 0.35 : 0.8, decay(9), 0.95);
      tone(o, at, 0.006, space ? 140 : 260, space ? 90 : 180, 0.05 * g, 'sine', decay(5));
      t += 0.06 + r() * 0.08 + (r() < 0.1 ? 0.18 : 0);
    }
  },
  clack: (o, s, _d, g, r) => {
    tone(o, s, 0.07, 190, 120, 0.25 * g, 'sine', decay(6));
    noise(o, s, 0.012, 0.18 * g, r, 0.6, decay(8));
  },
  slam: (o, s, _d, g, r) => {
    tone(o, s, 0.18, 80, 45, 0.5 * g, 'sine', decay(5));
    tone(o, s, 0.05, 420, 260, 0.18 * g, 'tri', decay(6));
    noise(o, s, 0.05, 0.3 * g, r, 0.5, decay(7));
  },
  chair: (o, s, d, g, r) => {
    noise(o, s, d, 0.05 * g, r, 0.08, (p) => Math.sin(Math.PI * p));
    tone(o, s + Math.round(0.05 * SAMPLE_RATE), 0.28, 360, 520, 0.03 * g, 'saw', (p) => Math.sin(Math.PI * p) * (0.6 + 0.4 * Math.sin(p * 60)));
  },
  notification: (o, s, _d, g) => {
    tone(o, s, 0.13, 1318.5, 1318.5, 0.14 * g, 'sine', hit(0.04, 5));
    tone(o, s + Math.round(0.11 * SAMPLE_RATE), 0.32, 1760, 1760, 0.14 * g, 'sine', hit(0.02, 5));
    tone(o, s + Math.round(0.11 * SAMPLE_RATE), 0.32, 3520, 3520, 0.03 * g, 'sine', hit(0.02, 8));
  },
  'message-in': (o, s, _d, g) => tone(o, s, 0.07, 620, 940, 0.16 * g, 'sine', hit(0.1, 4)),
  'message-out': (o, s, _d, g) => tone(o, s, 0.12, 420, 1250, 0.13 * g, 'sine', hit(0.08, 3)),
  pop: (o, s, _d, g) => tone(o, s, 0.05, 820, 420, 0.16 * g, 'sine', decay(4)),
  swipe: (o, s, d, g, r) => noise(o, s, d, 0.1 * g, r, 0.3, (p) => Math.sin(Math.PI * p)),
  tick: (o, s, _d, g) => tone(o, s, 0.008, 1600, 1500, 0.14 * g, 'square', decay(4)),
  'tension-rise': (o, s, d, g, r) => {
    tone(o, s, d, 110, 440, 0.1 * g, 'saw', (p) => p * p * env(p * 1000, 1000, 1, 20));
    tone(o, s, d, 111.5, 446, 0.1 * g, 'saw', (p) => p * p * env(p * 1000, 1000, 1, 20));
    tone(o, s, d, 55, 110, 0.14 * g, 'sine', (p) => p);
    noise(o, s, d, 0.14 * g, r, 0.2, (p) => p * p * p);
  },
  heartbeat: (o, s, _d, g) => {
    tone(o, s, 0.12, 62, 40, 0.5 * g, 'sine', hit(0.08, 4));
    tone(o, s + Math.round(0.19 * SAMPLE_RATE), 0.12, 58, 38, 0.38 * g, 'sine', hit(0.08, 4));
  },
  'record-scratch': (o, s, d, g, r) => {
    const n = Math.round(d * SAMPLE_RATE);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const f = p < 0.45 ? 900 - 700 * (p / 0.45) : 200 + 700 * ((p - 0.45) / 0.55);
      ph += (2 * Math.PI * f) / SAMPLE_RATE;
      const v = ((ph % (2 * Math.PI)) / Math.PI - 1) * 0.5 + (r() * 2 - 1) * 0.6;
      put(o, s + i, v * 0.13 * g * Math.sin(Math.PI * Math.min(1, p * 1.1)));
    }
  },
  flicker: (o, s, d, g, r) => {
    let t = 0;
    let on = true;
    while (t < d) {
      const len = 0.04 + r() * 0.09;
      if (on) {
        SOCIAL_RECIPES.buzz(o, s + Math.round(t * SAMPLE_RATE), len, 2.2 * g, r);
        tone(o, s + Math.round(t * SAMPLE_RATE), 0.02, 900, 500, 0.1 * g, 'square', decay(6));
      }
      on = !on;
      t += len;
    }
  },
  bloom: (o, s, d, g, r) => {
    noise(o, s, d, 0.45 * g, r, 0.35, (p) => Math.pow(p, 2.2));
    for (const f of [220, 277.2, 329.6, 440]) tone(o, s, d, f * 0.5, f, 0.08 * g, 'saw', (p) => Math.pow(p, 1.8));
  },
  boom: (o, s, d, g, r) => {
    tone(o, s, d, 92, 34, 0.6 * g, 'sine', hit(0.01, 3.5));
    noise(o, s, 0.12, 0.25 * g, r, 0.25, decay(6));
  },
  zip: (o, s, d, g, r) => {
    tone(o, s, d, 300, 2600, 0.09 * g, 'saw', (p) => Math.sin(Math.PI * Math.min(1, p * 1.05)));
    noise(o, s, d, 0.1 * g, r, 0.6, (p) => p);
  },
  glitch: (o, s, d, g, r) => {
    let t = 0;
    while (t < d) {
      const len = 0.02 + r() * 0.03;
      const f = 200 + r() * 1800;
      tone(o, s + Math.round(t * SAMPLE_RATE), len, f, f * (0.5 + r()), 0.08 * g, 'square', () => 1);
      t += len + r() * 0.02;
    }
  },
  'news-sting': (o, s, _d, g) => {
    const stab = (at: number, root: number, len: number, k: number) => {
      for (const [ratio, det] of [[1, 0], [1.26, 0.6], [1.5, -0.5], [2, 0.3]]) {
        tone(o, s + Math.round(at * SAMPLE_RATE), len, root * ratio + det, root * ratio + det, 0.045 * g * k, 'saw', hit(0.03, 4));
      }
      tone(o, s + Math.round(at * SAMPLE_RATE), len * 0.9, root / 2, root / 2.2, 0.2 * g * k, 'sine', hit(0.02, 3));
    };
    stab(0, 220, 0.3, 1);
    stab(0.18, 220, 0.25, 0.8);
    stab(0.45, 293.7, 0.7, 1.15);
    tone(o, s, 0.5, 80, 50, 0.35 * g, 'sine', hit(0.01, 4));
  },
  'news-bed': (o, s, d, g) => {
    const n = Math.round(d * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const pad = (Math.sin(2 * Math.PI * 110 * t) * 0.5 + Math.sin(2 * Math.PI * 164.8 * t) * 0.3 + Math.sin(2 * Math.PI * 220.5 * t) * 0.2) * 0.012;
      put(o, s + i, pad * g * env(i, n, 12000, 12000));
    }
    for (let t = 0; t < d; t += 0.25) tone(o, s + Math.round(t * SAMPLE_RATE), 0.01, t % 1 < 0.01 ? 1200 : 1800, 1500, 0.05 * g, 'square', decay(5));
  },
  // --- Campaign foley ------------------------------------------------------
  footsteps: (o, s, d, g, r) => {
    for (let t = 0.05; t < d; t += 0.52 + r() * 0.04) {
      const at = s + Math.round(t * SAMPLE_RATE);
      tone(o, at, 0.06, 110, 70, 0.22 * g, 'sine', hit(0.02, 7));
      noise(o, at, 0.035, 0.12 * g, r, 0.5, decay(9), 0.9);
    }
  },
  'footsteps-tunnel': (o, s, d, g, r) => {
    for (let t = 0.05; t < d; t += 0.48 + r() * 0.03) {
      const at = s + Math.round(t * SAMPLE_RATE);
      for (const [delay, k] of [[0, 1], [0.07, 0.35], [0.15, 0.18], [0.24, 0.09]] as const) {
        const a = at + Math.round(delay * SAMPLE_RATE);
        tone(o, a, 0.07, 150, 90, 0.2 * g * k, 'sine', hit(0.01, 6));
        noise(o, a, 0.03, 0.2 * g * k, r, 0.7, decay(10), 0.9);
        tone(o, a, 0.015, 2400, 1800, 0.03 * g * k, 'square', decay(6));
      }
    }
  },
  'machine-grind': (o, s, d, g, r) => {
    const n = Math.round(d * SAMPLE_RATE);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      y += 0.35 * (r() * 2 - 1 - y);
      const am = 0.6 + 0.4 * Math.sin(2 * Math.PI * 38 * t) * Math.sin(2 * Math.PI * 7 * t);
      put(o, s + i, y * 0.16 * g * am * env(i, n, 2000, 6000));
    }
    tone(o, s, d, 92, 88, 0.05 * g, 'saw', (p) => Math.sin(Math.PI * p));
  },
  'machine-hiss': (o, s, d, g, r) => {
    noise(o, s, d, 0.3 * g, r, 0.9, (p) => Math.min(1, p * 8) * (1 - p) ** 0.6, 0.97);
    noise(o, s, d, 0.12 * g, r, 0.2, (p) => Math.min(1, p * 5) * (1 - p));
    tone(o, s, d * 0.8, 58, 45, 0.18 * g, 'sine', (p) => Math.min(1, p * 6) * (1 - p));
  },
  'machine-beep': (o, s, _d, g) => {
    tone(o, s, 0.09, 1980, 1980, 0.09 * g, 'square', hit(0.02, 3));
    tone(o, s + Math.round(0.16 * SAMPLE_RATE), 0.09, 1980, 1980, 0.09 * g, 'square', hit(0.02, 3));
  },
  'cup-set': (o, s, _d, g, r) => {
    tone(o, s, 0.05, 520, 380, 0.14 * g, 'tri', decay(7));
    noise(o, s, 0.02, 0.12 * g, r, 0.6, decay(9), 0.8);
  },
  'cup-scrape': (o, s, d, g, r) => noise(o, s, d, 0.09 * g, r, 0.55, (p) => Math.sin(Math.PI * p) * (0.7 + 0.3 * Math.sin(p * 70)), 0.9),
  'cup-hit': (o, s, _d, g, r) => {
    tone(o, s, 0.1, 190, 110, 0.3 * g, 'sine', hit(0.01, 6));
    noise(o, s, 0.05, 0.25 * g, r, 0.35, decay(8));
    tone(o, s + Math.round(0.11 * SAMPLE_RATE), 0.05, 230, 150, 0.08 * g, 'sine', decay(6));
  },
  'ceramic-spin': (o, s, d, g, r) => {
    let t = 0;
    let gap = 0.05;
    while (t < d) {
      const at = s + Math.round(t * SAMPLE_RATE);
      tone(o, at, 0.02, 2900 + r() * 400, 2600, 0.035 * g, 'tri', decay(5));
      noise(o, at, 0.012, 0.04 * g, r, 0.8, decay(8), 0.9);
      t += gap;
      gap *= 1.06;
    }
  },
  'spoon-clink': (o, s, _d, g) => {
    tone(o, s, 0.25, 3520, 3500, 0.06 * g, 'sine', hit(0.005, 6));
    tone(o, s, 0.2, 5280, 5270, 0.025 * g, 'sine', hit(0.005, 8));
  },
  sip: (o, s, d, g, r) => noise(o, s, d, 0.06 * g, r, 0.25, (p) => Math.sin(Math.PI * p) * (0.5 + 0.5 * Math.sin(p * 40))),
  'ball-land': (o, s, _d, g, r) => {
    tone(o, s, 0.14, 95, 55, 0.5 * g, 'sine', hit(0.005, 6));
    noise(o, s, 0.05, 0.2 * g, r, 0.3, decay(8));
  },
  'ball-roll': (o, s, d, g, r) => noise(o, s, d, 0.07 * g, r, 0.06, (p) => Math.min(1, p * 4) * (1 - p) * (0.75 + 0.25 * Math.sin(p * 55))),
  blinds: (o, s, d, g, r) => {
    for (let t = 0; t < d; t += 0.018 + r() * 0.02) {
      tone(o, s + Math.round(t * SAMPLE_RATE), 0.012, 1800 + r() * 1400, 1500, 0.05 * g * (1 - t / d), 'tri', decay(6));
    }
    tone(o, s + Math.round(d * 0.92 * SAMPLE_RATE), 0.06, 300, 200, 0.12 * g, 'sine', decay(6));
  },
  drawer: (o, s, d, g, r) => {
    noise(o, s, d * 0.7, 0.07 * g, r, 0.25, (p) => Math.sin(Math.PI * p));
    tone(o, s + Math.round(d * 0.72 * SAMPLE_RATE), 0.12, 140, 80, 0.35 * g, 'sine', hit(0.005, 6));
  },
  door: (o, s, d, g, r) => {
    noise(o, s, d * 0.6, 0.04 * g, r, 0.12, (p) => Math.sin(Math.PI * p));
    tone(o, s + Math.round(d * 0.6 * SAMPLE_RATE), 0.2, 85, 55, 0.35 * g, 'sine', hit(0.005, 5));
    tone(o, s + Math.round(d * 0.62 * SAMPLE_RATE), 0.03, 1400, 900, 0.06 * g, 'square', decay(6));
  },
  knuckles: (o, s, _d, g, r) => {
    for (const at of [0.02, 0.22, 0.29]) noise(o, s + Math.round(at * SAMPLE_RATE), 0.012, 0.3 * g, r, 0.9, decay(12), 0.95);
  },
  cloth: (o, s, d, g, r) => noise(o, s, d, 0.05 * g, r, 0.15, (p) => Math.sin(Math.PI * p) * (0.6 + 0.4 * Math.sin(p * 23))),
  'phone-buzz': (o, s, d, g) => {
    for (const [a, b] of [[0, 0.3], [0.42, 0.72]]) {
      if (a >= d) break;
      tone(o, s + Math.round(a * SAMPLE_RATE), Math.min(b, d) - a, 175, 175, 0.12 * g, 'square', (p) => Math.min(1, p * 20) * Math.min(1, (1 - p) * 20));
    }
  },
  'dramatic-sting': (o, s, d, g, r) => {
    // Timpani + low brass stab + string tremolo swell, all descending a semitone: melodrama.
    tone(o, s, 0.9, 73, 55, 0.55 * g, 'sine', hit(0.005, 3.2));
    noise(o, s, 0.2, 0.2 * g, r, 0.2, decay(6));
    for (const [f, k] of [[110, 1], [138.6, 0.8], [164.8, 0.8], [220, 0.5]] as const) {
      tone(o, s, d, f, f * 0.94, 0.05 * g * k, 'saw', (p) => Math.min(1, p * 30) * Math.exp(-p * 2.2));
    }
    const n = Math.round(d * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const trem = 0.5 + 0.5 * Math.sin(2 * Math.PI * 13 * t);
      const v = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 466 * t) * 0.6) * 0.012 * g * trem;
      put(o, s + i, v * Math.min(1, t / 0.3) * Math.exp(-t * 1.2));
    }
  },
  'horror-drone': (o, s, d, g, r) => {
    const n = Math.round(d * SAMPLE_RATE);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      y += 0.02 * (r() * 2 - 1 - y);
      const v = Math.sin(2 * Math.PI * 41 * t) * 0.5 + Math.sin(2 * Math.PI * 43.3 * t) * 0.5 + Math.sin(2 * Math.PI * 61.7 * t) * 0.2;
      put(o, s + i, (v * 0.05 + y * 0.22) * g * env(i, n, SAMPLE_RATE * 0.8, SAMPLE_RATE * 0.5));
    }
  },
  'horror-hit': (o, s, d, g, r) => {
    tone(o, s, d, 60, 28, 0.7 * g, 'sine', hit(0.004, 2.5));
    noise(o, s, 0.4, 0.3 * g, r, 0.4, decay(4));
    for (const f of [1170, 1244, 1661]) tone(o, s, d * 0.8, f, f * 1.03, 0.025 * g, 'saw', (p) => Math.min(1, p * 50) * Math.exp(-p * 3));
  },
  wind: (o, s, d, g, r) => {
    const n = Math.round(d * SAMPLE_RATE);
    let y = 0;
    let z = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const gust = 0.55 + 0.45 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
      y += (0.01 + 0.03 * gust) * (r() * 2 - 1 - y);
      z += 0.3 * (y - z);
      put(o, s + i, z * 0.38 * g * gust * env(i, n, SAMPLE_RATE * 0.6, SAMPLE_RATE * 0.6));
    }
  },
  'flag-flap': (o, s, d, g, r) => {
    for (let t = 0; t < d; t += 0.11 + r() * 0.09) noise(o, s + Math.round(t * SAMPLE_RATE), 0.07, (0.06 + r() * 0.05) * g, r, 0.35, (p) => Math.sin(Math.PI * p));
  },
  'pad-swell': (o, s, d, g) => {
    // Restrained major pad: root, fifth, octave, major tenth; slow attack.
    for (const [f, k] of [[130.8, 1], [196, 0.7], [261.6, 0.6], [329.6, 0.45], [392, 0.25]] as const) {
      for (const det of [-0.6, 0.6]) tone(o, s, d, f + det, f + det, 0.018 * g * k, 'tri', (p) => Math.min(1, p / 0.45) * Math.min(1, (1 - p) / 0.25));
    }
  },
  'piano-note': (o, s, d, g) => {
    for (const [ratio, k] of [[1, 1], [2, 0.35], [3, 0.15], [4.02, 0.08]] as const) tone(o, s, d, 392 * ratio, 392 * ratio, 0.07 * g * k, 'sine', hit(0.004, 3 + ratio));
  },
  heartbeat2: (o, s, d, g) => {
    for (let t = 0; t < d; t += 0.95) {
      const at = s + Math.round(t * SAMPLE_RATE);
      tone(o, at, 0.12, 60, 40, 0.45 * g, 'sine', hit(0.06, 4));
      tone(o, at + Math.round(0.2 * SAMPLE_RATE), 0.12, 55, 38, 0.32 * g, 'sine', hit(0.06, 4));
    }
  },
  'stomp-clap': (o, s, d, g, r) => {
    // "We will…" style stadium rhythm: stomp, stomp, clap — building across the cue.
    for (let bar = 0, t = 0; t < d; bar++, t = bar * 1.0) {
      const k = 0.35 + 0.65 * Math.min(1, t / Math.max(0.1, d));
      for (const [at, kind] of [[0, 'stomp'], [0.25, 'stomp'], [0.5, 'clap']] as const) {
        const a = s + Math.round((t + at) * SAMPLE_RATE);
        if (kind === 'stomp') {
          tone(o, a, 0.16, 70, 45, 0.5 * g * k, 'sine', hit(0.01, 5));
          noise(o, a, 0.1, 0.25 * g * k, r, 0.08, decay(6));
        } else {
          for (let j = 0; j < 14; j++) noise(o, a + Math.round(r() * 0.03 * SAMPLE_RATE), 0.03, 0.07 * g * k, r, 0.8, decay(10), 0.9);
        }
      }
    }
  },
  'breaking-alarm': (o, s, d, g) => {
    for (const [at, f] of [[0, 880], [0.14, 1175], [0.28, 880], [0.42, 1175]] as const) {
      if (at > d) break;
      tone(o, s + Math.round(at * SAMPLE_RATE), 0.12, f, f, 0.07 * g, 'square', hit(0.01, 3));
    }
    tone(o, s, d, 55, 40, 0.3 * g, 'sine', hit(0.005, 3));
  },
  'riser-long': (o, s, d, g, r) => {
    tone(o, s, d, 80, 640, 0.08 * g, 'saw', (p) => p ** 2.5);
    tone(o, s, d, 81, 648, 0.08 * g, 'saw', (p) => p ** 2.5);
    noise(o, s, d, 0.2 * g, r, 0.3, (p) => p ** 3);
  },
  // --- THE CURRENT (anime tribute) — energy foley ---
  zap: (o, s, d, g, r) => {
    // Electric crawl: a falling chirp over dense crackle clicks and a 120 Hz buzz.
    tone(o, s, d, 2400, 520, 0.05 * g, 'saw', hit(0.01, 5));
    tone(o, s, d, 120, 118, 0.05 * g, 'square', (p) => (0.6 + 0.4 * Math.sin(p * 90)) * Math.exp(-p * 3));
    for (let t = 0; t < d; t += 0.004 + r() * 0.018) noise(o, s + Math.round(t * SAMPLE_RATE), 0.004, 0.22 * g * (1 - t / d), r, 0.9, decay(3), 0.7);
  },
  charge: (o, s, d, g, r) => {
    // Energy charge-up: a whine rising two octaves, a quickening wobble, crackle thickening to the end.
    const n = Math.round(d * SAMPLE_RATE);
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const f = 110 * Math.pow(8, p);
      const wob = 1 + 0.03 * Math.sin(2 * Math.PI * (4 + 24 * p * p) * (i / SAMPLE_RATE));
      ph += (2 * Math.PI * f * wob) / SAMPLE_RATE;
      ph2 += (2 * Math.PI * f * 1.503) / SAMPLE_RATE;
      const v = (((ph % (2 * Math.PI)) / Math.PI - 1) * 0.6 + Math.sin(ph2) * 0.4) * 0.07 * g * Math.pow(p, 1.6);
      put(o, s + i, v);
    }
    for (let t = 0; t < d; t += 0.003 + (1 - t / d) * 0.05 * r()) noise(o, s + Math.round(t * SAMPLE_RATE), 0.004, 0.2 * g * (t / d), r, 0.85, decay(3), 0.6);
  },
  shock: (o, s, d, g, r) => {
    // Shockwave: sub thump + a low air "whumph" that blooms and dies.
    tone(o, s, d, 78, 28, 0.65 * g, 'sine', hit(0.004, 4));
    noise(o, s, d, 0.35 * g, r, 0.06, (p) => Math.min(1, p * 25) * Math.exp(-p * 5));
    noise(o, s, 0.05, 0.25 * g, r, 0.9, decay(8), 0.6);
  },
  'slam-hit': (o, s, d, g, r) => {
    // Title-card slam: punchy low body, bright transient, a short metal ring.
    tone(o, s, d, 190, 55, 0.45 * g, 'sine', hit(0.002, 7));
    noise(o, s, 0.06, 0.3 * g, r, 0.95, decay(9), 0.5);
    for (const [f, k] of [[1660, 1], [2490, 0.6], [3733, 0.35]] as const) tone(o, s, d, f, f * 0.995, 0.02 * g * k, 'tri', hit(0.001, 6));
  },
  'aura-hum': (o, s, d, g, r) => {
    // Held aura: two detuned low saws under a tremolo, sparse crackle; fades at the edges.
    const n = Math.round(d * SAMPLE_RATE);
    const edge = Math.min(n / 3, SAMPLE_RATE * 0.25);
    let a = 0;
    let b = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      a += (2 * Math.PI * 55) / SAMPLE_RATE;
      b += (2 * Math.PI * 55.6) / SAMPLE_RATE;
      const raw = ((a % (2 * Math.PI)) / Math.PI - 1 + (b % (2 * Math.PI)) / Math.PI - 1) * 0.5;
      lp += 0.08 * (raw - lp);
      const trem = 0.7 + 0.3 * Math.sin(2 * Math.PI * 7 * t);
      put(o, s + i, lp * 0.11 * g * trem * env(i, n, edge, edge));
    }
    for (let t = 0; t < d; t += 0.02 + r() * 0.12) noise(o, s + Math.round(t * SAMPLE_RATE), 0.003, 0.1 * g, r, 0.9, decay(3), 0.7);
  },
  'power-down': (o, s, d, g, r) => {
    // A stadium grounding out: a whine sliding to nothing, relay clunks, the hum dying.
    tone(o, s, d, 1300, 45, 0.07 * g, 'saw', (p) => (1 - p) ** 1.5);
    tone(o, s, d, 100, 30, 0.12 * g, 'sine', (p) => 1 - p);
    for (const at of [0.08, 0.3, 0.55, 0.8]) {
      const a = s + Math.round(at * d * SAMPLE_RATE);
      tone(o, a, 0.12, 95, 50, 0.35 * g, 'sine', hit(0.002, 8));
      noise(o, a, 0.05, 0.2 * g, r, 0.4, decay(8));
    }
  },
  wave: (o, s, d, g, r) => {
    // UNDERTOW: a low wave of filtered noise that surges and pulls back, with body.
    noise(o, s, d, 0.4 * g, r, 0.05, (p) => Math.sin(Math.PI * Math.min(1, p * 1.4)) ** 2);
    noise(o, s, d, 0.12 * g, r, 0.4, (p) => Math.sin(Math.PI * Math.min(1, p * 1.2)) ** 3, 0.5);
    tone(o, s, d, 65, 40, 0.25 * g, 'sine', (p) => Math.sin(Math.PI * p));
  },
  ting: (o, s, d, g) => {
    // The freeze-frame "ting": two bright sine partials ringing out.
    tone(o, s, d, 2637, 2637, 0.09 * g, 'sine', hit(0.001, 3.2));
    tone(o, s, d, 5274, 5274, 0.04 * g, 'sine', hit(0.001, 5));
    tone(o, s, 0.01, 8000, 6000, 0.05 * g, 'sine', decay(8));
  },
  fracture: (o, s, d, g, r) => {
    // MERIDIAN: the air splits — a glassy crack, inharmonic shards, an air rip falling away.
    noise(o, s, 0.03, 0.5 * g, r, 0.98, decay(10), 0.4);
    for (const f of [1811, 2743, 3907, 5122, 6653]) tone(o, s, d * 0.6, f, f * 0.97, 0.018 * g, 'tri', hit(0.001, 7));
    for (let t = 0.02; t < d * 0.4; t += 0.015 + r() * 0.04) tone(o, s + Math.round(t * SAMPLE_RATE), 0.015, 3000 + r() * 4000, 2500, 0.02 * g, 'tri', decay(6));
    noise(o, s, d, 0.28 * g, r, 0.5, (p) => Math.min(1, p * 30) * (1 - p) ** 2, 0.3);
  },
  'sub-hit': (o, s, d, g, r) => {
    tone(o, s, d, 48, 30, 0.8 * g, 'sine', hit(0.004, 2.2));
    noise(o, s, 0.3, 0.18 * g, r, 0.15, decay(5));
  },
  'tv-off': (o, s, d, g) => {
    tone(o, s, 0.02, 900, 400, 0.12 * g, 'square', decay(8));
    tone(o, s, d, 15700, 15600, 0.02 * g, 'sine', decay(4));
    tone(o, s, 0.2, 90, 40, 0.2 * g, 'sine', decay(6));
  },
  crash: (o, s, d, g, r) => {
    tone(o, s, 0.35, 70, 38, 0.6 * g, 'sine', hit(0.003, 4));
    noise(o, s, 0.25, 0.45 * g, r, 0.7, decay(5), 0.6);
    for (const f of [612, 1377, 2293, 3150]) tone(o, s, d * 0.7, f, f * 0.98, 0.03 * g, 'tri', hit(0.002, 5));
    for (let t = 0.12; t < d; t += 0.06 + r() * 0.09) tone(o, s + Math.round(t * SAMPLE_RATE), 0.02, 2600 + r() * 2400, 2000, 0.03 * g * (1 - t / d), 'tri', decay(6));
  },
  'remote-click': (o, s, _d, g, r) => noise(o, s, 0.008, 0.25 * g, r, 0.9, decay(10), 0.95),
};

/** Render one social cue (seeded per cue index) into `out`. */
export function renderSocialCue(out: Out, recipe: string, startSec: number, seconds: number, gain: number, seed: number, index: number): void {
  const f = SOCIAL_RECIPES[recipe];
  if (!f) throw new Error(`No social synth recipe "${recipe}"`);
  f(out, Math.round(startSec * SAMPLE_RATE), seconds, gain, rng(seed, `social:${recipe}:${index}`));
}
