/**
 * "HNC: The Current" — original score. 150 BPM (beat 0.4 s), 32 bars = 51.2 s,
 * D minor resolving to F major. Composed to the edit in content/the-current.ts
 * (bar b starts at (b-1) * 1.6 s):
 *
 *   b1-5   invocation: sub boom, drone, floodlight taikos, pulse, BRAAM (destiny)
 *   b6-9   character theme: taiko groove, stabs Dm | Bb | Gm | A, riser
 *   b10-13 kickoff DROP: drums, driving bass, arp, hook teaser — full stop at the freeze
 *   b14-16 the run and the shot — tape-stop at the BLACKOUT parry (24.77 s)
 *   b17-18 darkness: drone + distant bells only
 *   b19-22 a nation answers: choir, relight taikos, charge build
 *   b23    the leap; b24 the apex — silence, one harmonic
 *   b25-32 MERIDIAN: explosion, goal, a 2-beat hush, the anthem hook, F major
 *
 * Every note is written here; nothing is sampled or quoted.
 */
import { Bus, SR, automate, choir, drums, m, masterWav, pingPong, play, reverb, riser, sidechain, tapeStop, type Note, type Patch } from './synth';

const BEAT = 0.4;
const T = (bar: number, beat = 0): number => ((bar - 1) * 4 + beat) * BEAT;
export const THE_CURRENT_SCORE_SECONDS = 51.2;

/** Edit sync points (seconds) — keep in step with content/the-current.ts. */
const SYNC = { eyeOpen: 0.8, freeze: 19.9, parry: 24.77, volley: 38.43, netHit: 40.04, hushEnd: 41.6 };

const CHORDS: Record<string, number[]> = {
  Dm: [50, 53, 57, 62],
  Bb: [46, 50, 53, 58],
  F: [48, 53, 57, 60],
  C: [48, 52, 55, 60],
  Gm: [50, 55, 58, 62],
  A: [49, 52, 57, 61],
};
const ROOT: Record<string, number> = { Dm: 38, Bb: 34, F: 41, C: 36, Gm: 43, A: 33 };

const PAD: Patch = { waves: ['saw'], voices: 5, detune: 22, width: 0.9, amp: { a: 0.45, d: 0.3, s: 0.8, r: 0.9 }, filter: { cut: 700, env: 1300, e: { a: 0.8, d: 0.5, s: 0.7, r: 0.8 } }, gain: 0.11 };
const STAB: Patch = { waves: ['saw'], voices: 5, detune: 26, width: 0.85, amp: { a: 0.004, d: 0.28, s: 0, r: 0.14 }, filter: { cut: 500, env: 5200, e: { a: 0.001, d: 0.2, s: 0.08, r: 0.1 } }, gain: 0.2 };
const BASS: Patch = { waves: ['saw', 'square'], amp: { a: 0.003, d: 0.12, s: 0.75, r: 0.05 }, filter: { cut: 160, env: 950, e: { a: 0.002, d: 0.13, s: 0.2, r: 0.05 }, res: 0.25 }, sub: 0.5, gain: 0.24, drive: 1.6 };
const ARP: Patch = { waves: ['square'], amp: { a: 0.002, d: 0.09, s: 0, r: 0.05 }, filter: { cut: 1200, env: 3500, e: { a: 0.001, d: 0.08, s: 0, r: 0.05 } }, gain: 0.07, pan: 0.2 };
const LEAD: Patch = { waves: ['saw', 'square'], voices: 2, detune: 9, width: 0.3, amp: { a: 0.012, d: 0.25, s: 0.78, r: 0.22 }, filter: { cut: 1900, env: 2400, e: { a: 0.01, d: 0.3, s: 0.5, r: 0.2 }, keytrack: 0.5 }, gain: 0.15, vibrato: { rate: 5.6, depth: 0.2, delay: 0.16 }, glide: 0.035 };
const BELL: Patch = { waves: ['sine', 'tri'], amp: { a: 0.001, d: 2.2, s: 0, r: 0.6 }, gain: 0.09 };
const BRAAM: Patch = { waves: ['saw'], voices: 4, detune: 16, width: 0.6, amp: { a: 0.02, d: 1.3, s: 0.5, r: 1.3 }, filter: { cut: 110, env: 1900, e: { a: 0.18, d: 1.1, s: 0.25, r: 0.9 } }, gain: 0.3, drive: 2.6 };
const HARMONIC: Patch = { waves: ['sine'], voices: 2, detune: 5, width: 0.7, amp: { a: 0.35, d: 0.1, s: 1, r: 0.25 }, gain: 0.05, vibrato: { rate: 4.8, depth: 0.05 } };

const chord = (name: string, t: number, dur: number, vel = 1, up = 0): Note[] => CHORDS[name].map((midi) => ({ t, dur, midi: midi + up, vel }));

/** Driving 8th bass: root, root, octave, root… (anime rock drive). */
function bassBar(name: string, bar: number, until = 4, vel = 1): Note[] {
  const r = ROOT[name];
  const pat = [0, 0, 12, 0, 0, 12, 0, 7];
  return pat.slice(0, until * 2).map((o, i) => ({ t: T(bar, i * 0.5), dur: 0.18, midi: r + o, vel: vel * (i % 2 ? 0.8 : 1) }));
}

/** 16th arpeggio over a chord (up the voicing, top octave). */
function arpBar(name: string, bar: number, until = 4): Note[] {
  const c = CHORDS[name].map((x) => x + 12);
  const order = [0, 1, 2, 3, 2, 1, 2, 3];
  return Array.from({ length: until * 4 }, (_, i) => ({ t: T(bar, i * 0.25), dur: 0.08, midi: c[order[i % order.length]], vel: i % 4 === 0 ? 1 : 0.7 }));
}

/** The hook (4 bars) over F | C | Dm | Bb, beats relative to `bar`. */
const HOOK: [string, number][][] = [
  [['A4', 1], ['D5', 0.5], ['E5', 0.5], ['F5', 1], ['E5', 0.5], ['D5', 0.5]],
  [['E5', 1.5], ['G5', 0.5], ['E5', 1], ['C5', 1]],
  [['D5', 1], ['F5', 0.5], ['G5', 0.5], ['A5', 1.5], ['G5', 0.5]],
  [['F5', 1], ['D5', 1], ['Bb4', 1], ['C5', 0.5], ['E5', 0.5]],
];
function hook(bar: number, bars = 4, stopAt = Infinity, up = 0): Note[] {
  const out: Note[] = [];
  HOOK.slice(0, bars).forEach((line, b) => {
    let beat = 0;
    for (const [n, len] of line) {
      const t = T(bar + b, beat);
      if (t < stopAt) out.push({ t, dur: Math.min(len * BEAT * 0.92, stopAt - t), midi: m(n) + up });
      beat += len;
    }
  });
  return out;
}

export function renderTheCurrentScore(seed = 150): Buffer {
  const n = Math.round(THE_CURRENT_SCORE_SECONDS * SR) + SR; // + 1 s tail room
  const music = new Bus(n);
  const drumBus = new Bus(n);
  const dark = new Bus(n);
  const leadBus = new Bus(n);
  const kicks: number[] = [];
  const d = drums(drumBus, seed, kicks);

  // ── b1-5 invocation ────────────────────────────────────────────────
  d.boom(0, 1);
  play(music, [{ t: 0, dur: 6.2, midi: m('D2'), vel: 0.8 }, { t: 0, dur: 6.2, midi: m('A2'), vel: 0.6 }], { ...PAD, amp: { a: 1.2, d: 0.5, s: 0.9, r: 0.6 }, filter: { cut: 300, env: 600 } }, seed);
  d.reverseCymbal(SYNC.eyeOpen, 0.75, 0.8);
  play(music, [{ t: SYNC.eyeOpen, dur: 0.8, midi: m('D6'), vel: 0.5 }, { t: SYNC.eyeOpen, dur: 0.8, midi: m('A6'), vel: 0.35 }], BELL, seed);
  for (let i = 0; i < 4; i++) d.taiko(T(2, i), 0.9, i % 2 ? 0.25 : -0.25);
  for (let b = 3; b <= 4; b++) {
    play(music, bassBar('Dm', b).map((x) => ({ ...x, vel: 0.55 })), { ...BASS, filter: { cut: 120, env: 500, e: { a: 0.002, d: 0.1, s: 0.1, r: 0.05 } } }, seed);
    for (let i = 0; i < 16; i++) d.hat(T(b, i * 0.25), i % 2 ? 0.25 : 0.4);
    d.kick(T(b, 0), 0.6);
    d.kick(T(b, 2), 0.5);
  }
  for (let i = 0; i < 8; i++) d.snare(T(4, 2 + i * 0.25), 0.25 + i * 0.08);
  riser(music, T(3, 2), T(5) - T(3, 2), 0.18, seed);
  // Destiny: the BRAAM on the downbeat, the Currents meet on beat 3.
  play(music, [m('D1'), m('D2'), m('A2'), m('F3')].map((midi) => ({ t: T(5), dur: 1.3, midi })), BRAAM, seed);
  d.crash(T(5), 0.9);
  d.kick(T(5), 1);
  d.taiko(T(5, 3), 1);
  choir(music, chord('Dm', T(5), 1.5, 0.8, 12), 0.5, seed);

  // ── b6-9 character theme ───────────────────────────────────────────
  const theme = ['Dm', 'Bb', 'Gm', 'A'];
  theme.forEach((c, i) => {
    const b = 6 + i;
    play(music, chord(c, T(b), 0.3), STAB, seed + b);
    play(music, chord(c, T(b, 2.5), 0.25, 0.7), STAB, seed + b + 50);
    play(music, chord(c, T(b), 1.5, 0.45), { ...PAD, filter: { cut: 500, env: 700 } }, seed + b);
    // Held roots first, the 8th drive only from b8: the kickoff drop must lift.
    if (b < 8) play(music, [{ t: T(b), dur: 1.5, midi: ROOT[c], vel: 0.7 }], { ...BASS, filter: { cut: 140, env: 400 } }, seed + b);
    else play(music, bassBar(c, b, 4, 0.7), { ...BASS, filter: { cut: 130, env: 600, e: { a: 0.002, d: 0.1, s: 0.15, r: 0.05 } } }, seed + b);
    for (const [beat, vel] of [[0, 1], [1.5, 0.7], [2, 0.9], [3, 0.8], [3.5, 0.5]] as const) d.taiko(T(b, beat), vel * 0.8, beat % 2 ? 0.3 : -0.3);
    for (let k = 0; k < 8; k++) d.hat(T(b, k * 0.5), 0.35);
    d.kick(T(b, 0), 0.9);
  });
  for (let i = 0; i < 16; i++) d.snare(T(9, i * 0.25), 0.2 + i * 0.05);
  riser(music, T(9), 1.6, 0.25, seed + 9);

  // ── b10-13 kickoff DROP ───────────────────────────────────────────────
  const drive = ['Dm', 'Bb', 'F', 'C'];
  drive.forEach((c, i) => {
    const b = 10 + i;
    const cut = b === 13 ? 2.75 : 4; // the Crescent Cut freeze stops the band
    d.crash(T(b), i % 2 ? 0.55 : 0.9);
    for (let k = 0; k < cut * 2; k++) d.hat(T(b, k * 0.5), k % 2 ? 0.45 : 0.3, k % 4 === 3);
    for (const beat of [0, 1.5, 2]) if (beat < cut) d.kick(T(b, beat), 1);
    for (const beat of [1, 3]) if (beat < cut) d.snare(T(b, beat), 1);
    play(music, bassBar(c, b, cut), BASS, seed + b);
    play(music, arpBar(c, b, cut), ARP, seed + b);
    play(music, chord(c, T(b), cut * BEAT, 0.8), { ...PAD, gain: 0.14, amp: { a: 0.03, d: 0.3, s: 0.8, r: 0.3 }, filter: { cut: 1500, env: 2500, e: { a: 0.02, d: 0.6, s: 0.6, r: 0.3 } } }, seed + b);
    play(music, chord(c, T(b), 0.3, 1), STAB, seed + b + 90);
  });
  play(leadBus, hook(12, 2, SYNC.freeze).map((x) => ({ ...x, vel: 0.8 })), { ...LEAD, waves: ['square'], gain: 0.11 }, seed);
  d.reverseCymbal(T(14), T(14) - SYNC.freeze, 0.9);

  // ── b14-16 the run, the shot, the blackout ────────────────────────────
  (['Gm', 'A'] as const).forEach((c, i) => {
    const b = 14 + i;
    d.crash(T(b), 0.8);
    for (let k = 0; k < 8; k++) d.hat(T(b, k * 0.5), 0.45);
    for (let k = 0; k < (b === 15 ? 8 : 4); k++) d.kick(T(b, k * (b === 15 ? 0.5 : 1)), 1);
    d.snare(T(b, 1));
    d.snare(T(b, 3));
    play(music, bassBar(c, b), BASS, seed + b);
    play(music, arpBar(c, b), ARP, seed + b);
    play(music, chord(c, T(b), 1.6, 0.8), PAD, seed + b);
  });
  for (let i = 0; i < 8; i++) d.snare(T(15, 2 + i * 0.25), 0.4 + i * 0.07);
  riser(music, T(14), 3.2, 0.25, seed + 14);
  // b16: the shot's Current screaming in… until the keeper grounds it.
  d.crash(T(16), 1);
  d.kick(T(16), 1);
  d.kick(T(16, 1), 1);
  d.snare(T(16, 1), 1);
  play(music, bassBar('Dm', 16, 2), BASS, seed + 16);
  play(music, chord('Dm', T(16), 0.8, 1), STAB, seed + 16);
  play(music, chord('Dm', T(16), 2, 0.8), PAD, seed + 16);

  // ── b17-18 darkness (not affected by the tape stop) ─────────────────────
  play(dark, [{ t: SYNC.parry + 0.5, dur: 3.4, midi: m('D1'), vel: 0.9 }], { ...PAD, waves: ['sine'], voices: 1, amp: { a: 0.8, d: 0.2, s: 1, r: 0.6 }, filter: undefined, gain: 0.13 }, seed);
  play(dark, [
    { t: T(17, 1), dur: 1, midi: m('D6'), vel: 0.4 },
    { t: T(17, 3.5), dur: 1, midi: m('A5'), vel: 0.3 },
    { t: T(18, 2), dur: 1, midi: m('F5'), vel: 0.35 },
  ], BELL, seed);

  // ── b19-22 a nation answers ─────────────────────────────────────────────
  choir(music, [...chord('Dm', T(19), 1.6, 0.7), ...chord('F', T(20), 1.6, 0.9)], 0.75, seed + 19);
  play(music, [{ t: T(19), dur: 3.2, midi: m('D2'), vel: 0.6 }], { ...BASS, amp: { a: 0.6, d: 0.2, s: 1, r: 0.3 } }, seed + 19);
  for (let k = 0; k < 4; k++) {
    d.taiko(T(20, k), 1, k % 2 ? 0.3 : -0.3);
    d.kick(T(20, k), 0.9);
  }
  play(music, chord('Bb', T(20), 1.6, 0.8), STAB, seed + 20);
  (['C', 'A'] as const).forEach((c, i) => {
    const b = 21 + i;
    play(music, chord(c, T(b), 1.6, 0.8), { ...PAD, amp: { a: 0.3, d: 0.3, s: 0.9, r: 0.4 }, filter: { cut: 500 + i * 900, env: 2200, e: { a: 1.4, d: 0.2, s: 1, r: 0.3 } } }, seed + b);
    play(music, bassBar(c, b).map((x) => ({ ...x, vel: 0.7 + 0.15 * i })), BASS, seed + b);
    choir(music, chord(c, T(b), 1.6, 0.8, 12), 0.45, seed + b);
    d.kick(T(b, 0), 1);
    d.snare(T(b, 2), 0.9);
    if (b === 22) for (let k = 0; k < 16; k++) d.snare(T(22, k * 0.25), 0.3 + k * 0.045);
    else for (let k = 0; k < 8; k++) d.hat(T(b, k * 0.5), 0.4);
  });
  riser(music, T(21), 3.2, 0.35, seed + 21);

  // ── b23 the leap, b24 the apex (silence) ─────────────────────────────────
  d.crash(T(23), 1);
  for (const beat of [0, 1.5, 2, 3, 3.5]) d.kick(T(23, beat), 1);
  d.snare(T(23, 1));
  d.snare(T(23, 3));
  for (let k = 0; k < 8; k++) d.hat(T(23, k * 0.5), 0.5);
  play(music, bassBar('Dm', 23), BASS, seed + 23);
  play(music, chord('Dm', T(23), 1.6, 1), { ...PAD, gain: 0.14 }, seed + 23);
  play(music, [{ t: T(23), dur: 1.5, midi: m('D5'), vel: 0.8 }], LEAD, seed + 23);
  play(dark, [{ t: T(24), dur: 1.5, midi: m('D6') }, { t: T(24), dur: 1.5, midi: m('A6'), vel: 0.6 }], HARMONIC, seed + 24);
  d.reverseCymbal(SYNC.volley, 1.4, 1.1);

  // ── b25-32 MERIDIAN → the anthem ─────────────────────────────────────────
  play(music, [m('D1'), m('D2'), m('A2'), m('D3'), m('F3')].map((midi) => ({ t: SYNC.volley, dur: 1.2, midi })), { ...BRAAM, gain: 0.34 }, seed + 25);
  d.boom(SYNC.volley, 0.9);
  const final = [['Dm', 25], ['Bb', 26], ['F', 27], ['C', 28], ['Dm', 29], ['Bb', 30]] as const;
  for (const [c, b] of final) {
    const hushBar = b === 26; // the 2-beat hush after the net
    const beats = hushBar ? 2 : 4;
    d.crash(T(b), b === 26 || b === 27 ? 1 : 0.7);
    for (let k = 0; k < beats * 2; k++) d.hat(T(b, k * 0.5), k % 2 ? 0.5 : 0.35, k % 4 === 3);
    for (const beat of [0, 1.5, 2, 3.5]) if (beat < beats) d.kick(T(b, beat), 1);
    for (const beat of [1, 3]) if (beat < beats) d.snare(T(b, beat), 1);
    play(music, bassBar(c, b, beats), BASS, seed + b);
    play(music, arpBar(c, b, beats), ARP, seed + b);
    play(music, chord(c, T(b), beats * BEAT, 0.9), { ...PAD, gain: 0.14, amp: { a: 0.04, d: 0.3, s: 0.85, r: hushBar ? 0.8 : 0.3 } }, seed + b);
    play(music, chord(c, T(b), 0.3, 0.9), STAB, seed + b + 7);
  }
  // Fanfare over the strike + goal, then the anthem hook from the legend shot.
  play(leadBus, [
    { t: T(25), dur: 0.7, midi: m('A4') },
    { t: T(25, 2), dur: 0.35, midi: m('D5') },
    { t: T(25, 2.5), dur: 0.35, midi: m('E5') },
    { t: T(25, 3), dur: 0.35, midi: m('F5') },
    { t: T(25, 3.5), dur: 0.35, midi: m('G5') },
    { t: T(26), dur: 0.7, midi: m('A5') },
  ], LEAD, seed + 25);
  play(leadBus, hook(27, 4), LEAD, seed + 27);
  play(leadBus, hook(27, 4).map((x) => ({ ...x, midi: x.midi - 12, vel: 0.5 })), { ...LEAD, waves: ['sine'], voices: 1, gain: 0.1 }, seed + 28);
  choir(music, [...chord('F', T(27), 1.6, 0.8, 12), ...chord('C', T(28), 1.6, 0.8, 12), ...chord('Dm', T(29), 1.6, 0.8, 12), ...chord('Bb', T(30), 1.6, 0.8, 12)], 0.5, seed + 27);
  // b31: F major — resolution under the brand card, long tail to the end.
  d.crash(T(31), 1);
  d.kick(T(31), 1);
  d.taiko(T(31), 1);
  play(music, [m('F1'), m('F2'), m('C3'), m('F3'), m('A3')].map((midi) => ({ t: T(31), dur: 2.8, midi })), { ...BRAAM, gain: 0.22, filter: { cut: 300, env: 1400, e: { a: 0.1, d: 1.5, s: 0.4, r: 1 } } }, seed + 31);
  play(music, chord('F', T(31), 2.9, 0.9), { ...PAD, gain: 0.15, amp: { a: 0.05, d: 0.5, s: 0.85, r: 1.4 } }, seed + 31);
  choir(music, chord('F', T(31), 2.6, 0.9, 12), 0.6, seed + 31);
  play(leadBus, [{ t: T(31), dur: 2.4, midi: m('F5') }], LEAD, seed + 31);
  d.taiko(T(32, 3), 0.5);

  // ── mix ─────────────────────────────────────────────────────────────────
  sidechain(music, kicks, 0.5, 0.15);
  const echoes = pingPong(leadBus, BEAT * 0.75, 0.33);
  music.add(leadBus);
  music.add(echoes, 0.35);
  const main = new Bus(n);
  main.add(music);
  main.add(drumBus, 0.9);
  // Silences the edit asks for (tails, not hard cuts): the freeze and the apex.
  automate(main, [
    [0, 1],
    // The character theme sits ~3 dB under the kickoff drop.
    [T(5, 3), 1],
    [T(6), 0.85],
    [T(10) - 0.02, 0.9],
    [T(10), 1],
    [SYNC.freeze - 0.02, 1],
    [SYNC.freeze + 0.06, 0.08],
    [T(14) - 0.35, 0.3],
    [T(14), 1],
    [T(24) - 0.05, 1],
    [T(24) + 0.12, 0.05],
    [SYNC.volley - 0.02, 0.05],
    [SYNC.volley, 1],
    [T(26, 2) - 0.02, 1],
    [T(26, 2) + 0.15, 0.25],
    [SYNC.hushEnd - 0.05, 0.25],
    [SYNC.hushEnd, 1],
  ]);
  // BLACKOUT: the whole band grinds to a halt with the stadium.
  tapeStop(main, SYNC.parry, 0.55, T(19) - 0.02);
  main.add(dark);
  const wet = reverb(main, 0.86, 0.35);
  main.add(wet, 0.32);
  return masterWav(main, 0.72);
}
