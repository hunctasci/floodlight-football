"""Original score for EP01 (synthesised here; no samples, no licensed music).

One motif — D5 F#5 A5, the same three notes as the HNC end sting — carries
the film. Sections are anchored to shot starts from the edit (markers), so
re-timing a shot moves the music with it. Dynamics follow the brief: almost
nothing under the cold open, a light documentary underscore, a rhythmic
drive, the training build that drops to silence before the strike, a quiet
home, the dead stop for the salt joke, strings under the interview inserts,
the matchday rise, the tunnel drone, the swell into white.
"""
import numpy as np

from dsp import SR, bp, db, env_ad, env_adsr, hp, ir, lp, noise, pan, reverb, rng, saw, sine, stereo, t_axis

HALL = ir(3.2, 1.6, seed=21, damp=5200, pre=0.02)
A4 = 440.0


def hz(n):
    """MIDI note -> Hz."""
    return A4 * 2 ** ((n - 69) / 12)


D, Fs, A, B, G, E, Cs = 62, 66, 69, 71, 67, 64, 73  # D4 … note numbers
CH = {
    "D": [50, 57, 62, 66, 69], "A": [45, 57, 61, 64, 69], "Bm": [47, 54, 59, 62, 66], "G": [43, 55, 59, 62, 67],
    "Em": [40, 52, 55, 59, 64], "F#m": [42, 54, 57, 61, 66], "Dsus": [50, 57, 62, 67, 69],
}


def piano(n, dur=2.5, vel=0.6, seed=0):
    f = hz(n)
    B_ = 0.0004
    x = np.zeros(int(dur * SR))
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + B_ * k * k)
        if fk > 12000:
            break
        a = vel / k ** 1.3
        x += sine(fk, dur, phase=k * 0.7) * a * env_ad(dur, 0.002, 1.8 / (k ** 0.6) * (220 / f) ** 0.25, 3.2)
    h = bp(noise(0.03, seed), 1000, 5000) * env_ad(0.03, 0.0005, 0.01, 5) * vel * 0.05  # hammer (felt)
    x[: len(h)] += h
    return lp(x, 4500 + vel * 3000)


def pad(chord, dur, level=0.05, bright=1200, attack=1.2, release=1.5, seed=0):
    x = np.zeros(int(dur * SR))
    for i, n in enumerate(chord):
        for dt in (-0.07, 0.0, 0.07):
            x += saw(hz(n) * (1 + dt / 100), dur, seed=seed + i * 3 + int(dt * 100))
    x = lp(x, bright, 2) * level / len(chord)
    return x * env_adsr(dur, attack, 0.5, 0.85, release)


def strings(chord, dur, level=0.06, swell=True, seed=0):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for i, n in enumerate(chord):
        vib = 1 + 0.004 * np.sin(2 * np.pi * (5.2 + i * 0.3) * t)
        for dt in (-0.12, 0.12):
            f0 = hz(n) * (1 + dt / 100)
            ph = np.cumsum(f0 * vib) / SR
            x += (2 * (ph % 1.0) - 1)
    cutoff = 900 + (2600 * np.clip(t / max(dur, 1e-3), 0, 1) if swell else 1400)
    # time-varying filter via 2 blended static filters
    lo, hi = lp(x, 900, 2), lp(x, 3500, 2)
    w = np.clip((cutoff - 900) / 2600, 0, 1)
    y = (lo * (1 - w) + hi * w) * level / len(chord)
    return y * env_adsr(dur, 0.8 if swell else 0.3, 0.3, 0.9, 1.2)


def pluck(n, dur=0.5, level=0.25, seed=0):
    """Karplus-Strong, damped (muted guitar / harp-ish pulse)."""
    f = hz(n)
    N = int(SR / f)
    buf = rng(seed).uniform(-1, 1, N)
    out = np.zeros(int(dur * SR))
    for i in range(len(out)):
        out[i] = buf[i % N]
        buf[i % N] = 0.5 * (buf[i % N] + buf[(i + 1) % N]) * 0.994
    return lp(out, 2500) * level * env_ad(dur, 0.001, dur * 0.6, 3)


def kick(level=0.9):
    d = 0.45
    return sine(lambda t: 45 + 110 * np.exp(-t * 28), d) * env_ad(d, 0.001, 0.18, 4) * level


def clap(seed=0, level=0.3):
    d = 0.3
    x = np.zeros(int(d * SR))
    for k in range(3):
        s = bp(noise(0.02, seed + k), 900, 5000) * env_ad(0.02, 0.0005, 0.008, 5)
        i = int(k * 0.011 * SR)
        x[i:i + len(s)] += s
    x += bp(noise(d, seed + 9), 1000, 4000) * env_ad(d, 0.002, 0.08, 5) * 0.4
    return x * level


def hat(seed=0, level=0.08):
    d = 0.08
    return hp(noise(d, seed), 7000) * env_ad(d, 0.0005, 0.02, 5) * level


def taiko(seed=0, level=0.9):
    d = 1.4
    x = sine(lambda t: 58 + 40 * np.exp(-t * 16), d) * env_ad(d, 0.002, 0.4, 3.5)
    x += lp(noise(d, seed), 300) * env_ad(d, 0.001, 0.08, 5) * 0.6
    return x * level


def bass(n, dur, level=0.3):
    f = hz(n)
    x = sine(f, dur) + 0.3 * lp(saw(f, dur), 500)
    return x * env_adsr(dur, 0.01, 0.1, 0.8, 0.15) * level


class Track:
    def __init__(self, total):
        self.L = np.zeros(int(total * SR))
        self.R = np.zeros(int(total * SR))

    def add(self, t, x, p=0.0, g=1.0):
        if t < 0:
            x = x[int(-t * SR):]
            t = 0
        i = int(t * SR)
        if i >= len(self.L):
            return
        s = pan(x, p) if x.ndim == 1 else x
        n = min(len(s), len(self.L) - i)
        self.L[i:i + n] += s[:n, 0] * g
        self.R[i:i + n] += s[:n, 1] * g

    def arr(self):
        return np.stack([self.L, self.R], 1)


def build(markers, total, bpm=84):
    """markers: dict shot_id -> start seconds (plus 'end'). Returns stereo float array."""
    m = markers
    beat = 60 / bpm
    trk = Track(total + 3)
    dry = Track(total + 3)  # percussion bus (less reverb)

    def seq(t0, t1, fn, step):
        t = t0
        i = 0
        while t < t1 - 1e-6:
            fn(t, i)
            t += step
            i += 1

    # 1. MORNING underscore: sparse felt piano motif + soft pad (S02 → S04)
    a, b = m["S02_SH02"], m["S04_SH01"]
    prog = ["D", "Bm", "G", "A"]
    bar = beat * 4
    seq(a, b, lambda t, i: trk.add(t, pad(CH[prog[i % 4]], bar * 1.05, level=0.035, bright=900), 0.0), bar)
    motif = [(0, 74), (1.0, 78), (2.0, 81), (4.0, 78), (6.0, 76), (8.0, 74), (9.0, 78), (10.0, 83), (12.0, 81)]
    for bt, n in motif:
        t = a + 0.4 + bt * beat
        if t < b - 0.3:
            trk.add(t, piano(n, 3.0, 0.45, seed=int(bt * 10)), 0.15)
    # 2. THE DRIVE / SHOP: a plucked pulse joins (S04 → S06)
    a, b = m["S04_SH01"], m["S06_SH01"]
    seq(a, b, lambda t, i: trk.add(t, pad(CH[prog[i % 4]], bar * 1.05, level=0.03, bright=1000), 0.0), bar)
    seq(a, b, lambda t, i: trk.add(t, pluck([62, 69, 66, 69][i % 4] + (0 if (i // 8) % 2 == 0 else -3), 0.45, 0.16, seed=i), -0.25 if i % 2 else 0.25), beat / 2)
    seq(a, b, lambda t, i: dry.add(t, bass([38, 35, 31, 33][(i // 4) % 4], beat * 0.9, 0.18)), beat)
    rise_at = m["S05_SH05"]  # "cut into music rise"
    trk.add(rise_at, strings(CH["A"], (m["S06_SH01"] - rise_at) + 0.4, level=0.05), 0.0)
    # 3. TRAINING: the build — kick on the beat, clap on 2/4, bass, rising strings; drop at SH07
    a, drop = m["S06_SH01"], m["S06_SH07"]
    b2 = beat / 1.25  # the montage quickens (tempo feel ~105)
    seq(a, drop, lambda t, i: dry.add(t, kick(0.85)), b2)
    seq(a + b2, drop, lambda t, i: dry.add(t, clap(seed=i, level=0.22)), b2 * 2)
    seq(a, drop, lambda t, i: dry.add(t, hat(seed=i, level=0.05), 0.2), b2 / 2)
    seq(a, drop, lambda t, i: dry.add(t, bass([38, 38, 43, 45][(i // 4) % 4], b2 * 0.9, 0.24)), b2)
    trk.add(a, strings(CH["Bm"], drop - a + 0.2, level=0.07), 0.0)
    for k, n in enumerate((74, 78, 81, 86)):
        trk.add(a + k * b2 * 2, piano(n, 1.6, 0.35, seed=40 + k), 0.2)
    # silence (a breath) … then the strike lands on the edit's sfx; the music answers once, low
    strike_t = m["S06_SH08"] + 0.5
    dry.add(strike_t, taiko(seed=3, level=0.8))
    trk.add(strike_t + 0.02, strings(CH["D"], 2.2, level=0.06, swell=False), 0.0)
    # 4. HOME / RECOVERY: drop back — two soft piano notes, then a playful pluck under the living-room game
    a = m["S07_SH01"]
    trk.add(a + 0.3, piano(69, 3.0, 0.3, seed=51), -0.1)
    trk.add(a + 1.9, piano(66, 3.0, 0.25, seed=52), 0.1)
    g0, g1 = m["S07_SH04"], m["S07_SH05"]
    seq(g0, g1, lambda t, i: trk.add(t, pluck([74, 78, 81, 78][i % 4], 0.3, 0.18, seed=60 + i), 0.3 if i % 2 else -0.3), beat / 2)
    # 5. DINNER: warm pad only… dead stop on the smash cut (no music under the joke)
    a, b = m["S08_SH01"], m["S08_SH05"]
    trk.add(a, pad(CH["G"], b - a + 0.6, level=0.03, bright=800, release=0.5), 0.0)
    # 6. WHAT IT MEANS: nothing under the question; strings + the motif under the inserts and the answer
    a, b = m["S09_SH04"], m["S10_SH01"]
    trk.add(a - 0.2, strings(CH["Bm"], (b - a) * 0.5 + 0.6, level=0.05), 0.0)
    trk.add(a + (b - a) * 0.5 - 0.2, strings(CH["G"], (b - a) * 0.55, level=0.045, swell=False), 0.0)
    for k, (bt, n) in enumerate(((0.0, 74), (1.2, 78), (2.4, 81), (5.2, 79), (6.6, 78))):
        t = a + bt
        if t < b:
            trk.add(t, piano(n, 3.5, 0.33, seed=70 + k), 0.12)
    # 7. MATCHDAY: the cinematic rise — ostinato, taiko on the doors, strings climbing
    a, b = m["S10_SH01"], m["S11_SH01"]
    seq(a, b, lambda t, i: trk.add(t, pluck([62, 69, 74, 69][i % 4], 0.35, 0.2, seed=80 + i), -0.2 if i % 2 else 0.2), beat / 2)
    seq(a, b, lambda t, i: dry.add(t, bass([38, 38, 35, 43][(i // 4) % 4], beat * 0.95, 0.26)), beat)
    trk.add(a, strings(CH["D"], (m["S10_SH06"] - a) + 0.2, level=0.05), 0.0)
    door = m["S10_SH06"] + 0.45
    dry.add(door, taiko(seed=5, level=0.7))
    dry.add(m["S10_SH07"] + 0.02, taiko(seed=6, level=0.6))
    trk.add(m["S10_SH07"], strings(CH["A"], b - m["S10_SH07"] + 0.3, level=0.07), 0.0)
    seq(m["S10_SH07"], b, lambda t, i: dry.add(t, kick(0.7)), beat)
    dry.add(m["S10_SH09"], taiko(seed=7, level=1.0))
    # 8. TUNNEL: a low drone under the callback, the swell into white, then the sting takes over
    a = m["S11_SH01"]
    white = m["S11_SH04"]
    trk.add(a, pad([38, 45, 50], white - a + 0.2, level=0.05, bright=380, attack=0.3, release=0.3), 0.0)
    trk.add(m["S11_SH03"], strings(CH["D"] + [74], white - m["S11_SH03"] + 0.25, level=0.1), 0.0)
    x = reverb(trk.arr(), HALL, 0.35) + reverb(dry.arr(), HALL, 0.12)
    return x[: int(total * SR)]


def build_rivals(markers, total, bpm=92):
    """'One Goal Between Us': banter pulse under the cross-cut interview, an old upright for the
    1957 newsreel, the 2000 rise (taiko on the TV), the scoreline argument quickening, a dead stop
    before the turn ("He's not here for this one"), the tunnel drone and the swell into white."""
    m = markers
    beat = 60 / bpm
    bar = beat * 4
    trk = Track(total + 3)
    dry = Track(total + 3)

    def seq(t0, t1, fn, step):
        t, i = t0, 0
        while t < t1 - 1e-6:
            fn(t, i)
            t += step
            i += 1

    # the opener's title beat: one hit + the motif as a chord, under the DM
    t0 = m["S00_SH06"]
    dry.add(t0, taiko(seed=11, level=0.9))
    trk.add(t0, strings(CH["D"], m["S02_SH01"] - t0 + 0.4, level=0.06, swell=False), 0.0)
    # the rooms + the early years: a light plucked pulse; TR's motif up, BE's answer down
    a, b = m["S02_SH01"], m["S05_SH01"]
    prog = ["D", "Bm", "G", "A"]
    seq(a, b, lambda t, i: trk.add(t, pad(CH[prog[i % 4]], bar * 1.05, level=0.03, bright=1000), 0.0), bar)
    seq(a, b, lambda t, i: trk.add(t, pluck([62, 66, 69, 66][i % 4] if (i // 8) % 2 == 0 else [69, 66, 62, 66][i % 4], 0.4, 0.15, seed=i), -0.3 if (i // 8) % 2 == 0 else 0.3), beat / 2)
    seq(a, b, lambda t, i: dry.add(t, bass([38, 35, 31, 33][(i // 4) % 4], beat * 0.9, 0.16)), beat)
    # the newsreel: an old upright, staccato
    n0, n1 = m["S03_SH02"], m["S03_SH03"]
    seq(n0, n1, lambda t, i: trk.add(t, piano([74, 78, 81, 78, 76, 74][i % 6], 0.35, 0.3, seed=90 + i), 0.0), beat / 2)
    # 2000: strings rise from the question; the TV hit; minor under the Belgian sofa; back to major
    a, tv, sofa, b = m["S05_SH01"], m["S05_SH03"], m["S05_SH04"], m["S06_SH01"]
    trk.add(a, strings(CH["A"], tv - a + 0.3, level=0.06), 0.0)
    dry.add(tv, taiko(seed=12, level=0.9))
    trk.add(tv, strings(CH["D"], sofa - tv + 0.2, level=0.07, swell=False), 0.0)
    trk.add(sofa, pad(CH["Bm"], b - sofa + 0.4, level=0.035, bright=700), 0.0)
    for k, n in enumerate((71, 69, 66)):
        trk.add(sofa + 0.3 + k * beat * 1.5, piano(n, 2.5, 0.3, seed=100 + k), 0.1)
    # 2009–2010: the pulse returns
    a, b = m["S06_SH01"], m["S08_SH01"]
    seq(a, b, lambda t, i: trk.add(t, pluck([62, 69, 66, 69][i % 4], 0.35, 0.14, seed=120 + i), -0.25 if i % 2 else 0.25), beat / 2)
    seq(a, b, lambda t, i: dry.add(t, bass([38, 43, 45, 38][(i // 4) % 4], beat * 0.9, 0.18)), beat)
    # the scoreline argument: it quickens, kick + clap, strings climbing
    a, b = m["S08_SH01"], m["S09_SH01"]
    b2 = beat / 1.3
    seq(a, b, lambda t, i: dry.add(t, kick(0.75)), b2)
    seq(a + b2, b, lambda t, i: dry.add(t, clap(seed=i, level=0.2)), b2 * 2)
    seq(a, b, lambda t, i: dry.add(t, hat(seed=i, level=0.05), 0.2), b2 / 2)
    trk.add(a, strings(CH["Bm"], b - a + 0.1, level=0.06), 0.0)
    # the turn: dead stop on the question … then two piano notes and strings under the answer
    a, b = m["S09_SH01"], m["S10_SH01"]
    for k, (bt, n) in enumerate(((2.0, 74), (3.6, 78), (5.4, 81), (7.4, 78))):
        if a + bt < b:
            trk.add(a + bt, piano(n, 3.5, 0.3, seed=140 + k), 0.12)
    trk.add(a + 2.0, strings(CH["G"], b - a - 1.6, level=0.045), 0.0)
    # the tunnel: low drone, the swell into white; the match card hits
    a, white = m["S10_SH01"], m["S11_SH01"]
    trk.add(a, pad([38, 45, 50], white - a + 0.2, level=0.05, bright=380, attack=0.3, release=0.3), 0.0)
    trk.add(m["S10_SH03"], strings(CH["D"] + [74], white - m["S10_SH03"] + 0.25, level=0.1), 0.0)
    dry.add(white, taiko(seed=13, level=1.0))
    x = reverb(trk.arr(), HALL, 0.35) + reverb(dry.arr(), HALL, 0.12)
    return x[: int(total * SR)]


def build_italy(markers, total, bpm=100):
    """'The Score Won't Leave Him Alone': a sneaky pizzicato pulse under the commentary (the score
    following him), a dead stop for the 'Enough.' beat, a driving build through the football act with
    the hit on the shatter, two quiet piano notes for the 0–0 reset, the tunnel swell into the card."""
    m = markers
    beat = 60 / bpm
    bar = beat * 4
    trk = Track(total + 3)
    dry = Track(total + 3)

    def seq(t0, t1, fn, step):
        t, i = t0, 0
        while t < t1 - 1e-6:
            fn(t, i)
            t += step
            i += 1

    # 1. THE COMEDY: staccato plucks tiptoeing in Bm under the commentator, a soft bass on 1 and 3
    a, b = m["S00_SH02"], m["S08_SH01"]
    prog = ["Bm", "G", "Em", "F#m"]
    seq(a, b, lambda t, i: trk.add(t, pad(CH[prog[i % 4]], bar * 1.05, level=0.022, bright=800), 0.0), bar)
    seq(a, b, lambda t, i: trk.add(t, pluck([71, 74, 78, 74][i % 4] - (5 if (i // 8) % 2 else 0), 0.25, 0.12, seed=i), -0.3 if i % 2 else 0.3), beat / 2)
    seq(a, b, lambda t, i: dry.add(t, bass([35, 31, 28, 30][(i // 8) % 4], beat * 0.8, 0.13)), beat * 2)
    # the escalation (physical numbers, the stairs): strings creep in
    trk.add(m["S06_SH02"], strings(CH["Bm"], b - m["S06_SH02"] + 0.2, level=0.04), 0.0)
    # 2. S08: dead stop — the silence is the joke ("Enough.")
    # 3. THE FOOTBALL ACT: the ball's impact, then the drive
    a, strike = m["S09_SH01"], m["S11_SH01"]
    dry.add(a, taiko(seed=21, level=0.9))
    b2 = beat / 1.15
    seq(m["S10_SH01"], strike, lambda t, i: dry.add(t, kick(0.8)), b2)
    seq(m["S10_SH01"] + b2, strike, lambda t, i: dry.add(t, clap(seed=i, level=0.2)), b2 * 2)
    seq(m["S10_SH01"], strike, lambda t, i: dry.add(t, hat(seed=i, level=0.05), 0.2), b2 / 2)
    seq(m["S10_SH01"], strike, lambda t, i: dry.add(t, bass([38, 38, 43, 45][(i // 4) % 4], b2 * 0.9, 0.24)), b2)
    trk.add(m["S10_SH01"], strings(CH["D"], strike - m["S10_SH01"] + 0.3, level=0.07), 0.0)
    # the strike: a breath of near-silence, then the hit as the 1–4 shatters (impact ≈ 1.9 s into S11)
    hit = strike + 1.9
    dry.add(hit, taiko(seed=22, level=1.0))
    trk.add(hit + 0.02, strings(CH["D"] + [74], 2.4, level=0.07, swell=False), 0.0)
    # 4. THE RESET: two soft piano notes over the wipe and the crema
    trk.add(m["S13_SH01"] + 0.2, piano(74, 3.0, 0.3, seed=31), -0.1)
    trk.add(m["S13_SH01"] + 1.25, piano(69, 3.0, 0.26, seed=32), 0.1)
    trk.add(m["S14_SH01"] + 0.6, piano(78, 3.0, 0.24, seed=33), 0.0)
    # 5. THE TUNNEL: low drone, strings swell into the card (the brand sting takes over)
    a, card = m["S15_SH01"], m["S16_SH01"]
    trk.add(a, pad([38, 45, 50], card - a + 0.3, level=0.05, bright=380, attack=0.3, release=0.3), 0.0)
    trk.add(a, strings(CH["D"] + [74], card - a + 0.3, level=0.09), 0.0)
    x = reverb(trk.arr(), HALL, 0.35) + reverb(dry.arr(), HALL, 0.12)
    return x[: int(total * SR)]
