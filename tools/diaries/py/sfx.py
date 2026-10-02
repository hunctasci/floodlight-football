"""Designed sound cues for Player Diaries (original synthesis; the only
recordings used are the repo's CC0 stadium clips, see crowd()).

cue(name, dur, seed) -> stereo float array at dsp.SR. `dur` is the span the
edit asks for (beds fill it; one-shots ignore it).
"""
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from dsp import (SR, bp, brown, db, env_ad, env_adsr, fade, hp, ir, lp, noise, norm, pan, pink, reverb, rng, saw, sine,
                 stereo, t_axis)

REPO = Path(__file__).resolve().parents[3]
CROWD = REPO / "packages" / "social-video" / "assets" / "audio" / "crowd"

ROOM = ir(0.9, 5.5, seed=3, damp=5000)
HALL = ir(2.2, 2.2, seed=5, damp=4500)
TUNNEL = ir(2.8, 1.7, seed=9, damp=3500, pre=0.03)


# ---------------------------------------------------------------- recordings (CC0)


def _load(name, gain=1.0):
    x, sr = sf.read(CROWD / name, dtype="float64", always_2d=True)
    if sr != SR:
        x = np.stack([resample_poly(x[:, c], SR, sr) for c in range(x.shape[1])], 1)
    if x.shape[1] == 1:
        x = np.repeat(x, 2, 1)
    return x[:, :2] * gain


def crowd(name, dur, start=0.0, gain=1.0, muffle=None, rise=None):
    x = _load(name, gain)
    s = int(start * SR)
    n = int(dur * SR)
    while len(x) < s + n:
        x = np.concatenate([x, x])
    y = x[s:s + n].copy()
    if muffle:
        y = np.stack([lp(y[:, c], muffle, 4) for c in range(2)], 1)
    if rise:
        e = np.linspace(rise, 1.0, n) ** 2
        y *= e[:, None]
    return fade(y, 0.05, 0.25)


# ---------------------------------------------------------------- cars / roads


def car_night_bed(dur, seed=0):
    rumble = lp(brown(dur, seed), 120, 4) * 0.5
    tyre = bp(pink(dur, seed + 1), 300, 1800) * 0.08
    sw = 0.5 + 0.5 * np.sin(2 * np.pi * 0.21 * t_axis(dur))
    hum = sine(55, dur) * 0.05 + sine(110, dur) * 0.02
    x = rumble + tyre * (0.7 + 0.3 * sw) + hum
    return fade(stereo(x) * [1.0, 0.95], 0.3, 0.3)


def car_day_bed(dur, seed=0):
    x = car_night_bed(dur, seed)[:, 0] * 0.9 + bp(pink(dur, seed + 4), 800, 5000) * 0.03
    return fade(stereo(x), 0.2, 0.3)


def indicator(dur, seed=0):
    out = np.zeros(int(dur * SR))
    tick = bp(noise(0.02, seed), 1500, 6000) * env_ad(0.02, 0.0005, 0.006, 6)
    tock = bp(noise(0.02, seed + 1), 900, 4000) * env_ad(0.02, 0.0005, 0.008, 6) * 0.7
    t = 0.0
    while t < dur - 0.05:
        i = int(t * SR)
        out[i:i + len(tick)] += tick
        j = int((t + 0.36) * SR)
        if j + len(tock) < len(out):
            out[j:j + len(tock)] += tock
        t += 0.72
    return pan(out * 0.4, 0.3)


def knob(dur, seed=0):
    out = np.zeros(int(0.35 * SR))
    for k in range(6):
        c = bp(noise(0.006, seed + k), 2000, 8000) * env_ad(0.006, 0.0002, 0.002, 4)
        i = int(k * 0.045 * SR)
        out[i:i + len(c)] += c * (0.6 - k * 0.07)
    return pan(out * 0.6, -0.1)


def radio_off(dur, seed=0):
    c = bp(noise(0.03, seed), 600, 5000) * env_ad(0.03, 0.0005, 0.01, 5)
    thump = sine(120, 0.05) * env_ad(0.05, 0.001, 0.02, 5) * 0.4
    x = np.zeros(int(0.1 * SR))
    x[: len(c)] += c
    x[: len(thump)] += thump
    return pan(x * 0.7, -0.1)


def phone_buzz(dur, seed=0):
    d = 0.7
    t = t_axis(d)
    buzz = np.sign(np.sin(2 * np.pi * 150 * t)) * 0.3 * (np.sin(2 * np.pi * 150 * t) ** 2)
    gate = ((t % 0.35) < 0.22).astype(float)
    x = bp(buzz * gate, 120, 2500) * 0.4
    return pan(fade(x, 0.005, 0.02), -0.2)


def message_in(dur, seed=0):
    """Incoming chat bubble: a soft two-partial pop."""
    d = 0.18
    x = sine(lambda t: 1320 - 500 * np.minimum(1, t / 0.05), d) * env_ad(d, 0.002, 0.07, 5) * 0.2
    x += sine(660, d) * env_ad(d, 0.002, 0.05, 5) * 0.08
    return pan(x, 0.05)


def message_out(dur, seed=0):
    """Sent: a quick upward swoosh-pop."""
    d = 0.2
    x = sine(lambda t: 700 + 900 * np.minimum(1, t / 0.08), d) * env_ad(d, 0.003, 0.08, 5) * 0.16
    x += hp(noise(d, seed), 3000) * env_ad(d, 0.001, 0.03, 5) * 0.03
    return pan(x, -0.05)


def _taps(n, gap, seed, gain):
    r = rng(seed)
    out = np.zeros(int((n * gap + 0.1) * SR))
    for k in range(n):
        c = bp(noise(0.012, seed + k), 2500, 8000) * env_ad(0.012, 0.0002, 0.004, 5) * gain * r.uniform(0.7, 1.0)
        i = int((k * gap + r.uniform(-0.01, 0.01) + 0.01) * SR)
        out[i:i + len(c)] += c
    return out


def key_taps(dur, seed=0):
    """Phone keyboard taps while typing a short line."""
    return pan(_taps(11, 0.07, seed, 0.14), 0.0)


def key_delete(dur, seed=0):
    """Holding delete: faster, lighter taps."""
    return pan(_taps(10, 0.035, seed + 50, 0.1), 0.0)


def phone_lock(dur, seed=0):
    """The side-button lock click."""
    d = 0.08
    x = bp(noise(d, seed), 1200, 6000) * env_ad(d, 0.0005, 0.012, 5) * 0.35
    x += sine(180, d) * env_ad(d, 0.001, 0.02, 5) * 0.15
    return pan(x, 0.1)


def car_door(dur, seed=0):
    """A firm modern car door: latch clack + body thump + a short cabin ring."""
    d = 0.9
    thump = (sine(lambda t: 70 + 40 * np.exp(-t * 30), d) * env_ad(d, 0.001, 0.12, 5)) * 0.9
    body = lp(noise(d, seed), 400, 2) * env_ad(d, 0.001, 0.08, 6) * 0.6
    latch = bp(noise(0.04, seed + 1), 1500, 7000) * env_ad(0.04, 0.0005, 0.01, 5) * 0.5
    x = thump + body
    x[: len(latch)] += latch
    return reverb(pan(x, 0.05), ROOM, 0.12)


def bus_door(dur, seed=0):
    """Pneumatic hiss + seal release + the slide."""
    d = 1.3
    hiss = hp(noise(d, seed), 2500) * env_adsr(d, 0.02, 0.2, 0.5, 0.6) * 0.25
    seal = lp(noise(0.12, seed + 1), 800) * env_ad(0.12, 0.002, 0.05, 5) * 0.5
    slide = bp(noise(d, seed + 2), 200, 1200) * env_adsr(d, 0.1, 0.2, 0.4, 0.5) * 0.2
    clunk = sine(90, 0.2) * env_ad(0.2, 0.002, 0.07, 5) * 0.5
    x = hiss + slide
    x[: len(seal)] += seal
    i = int(0.5 * SR)
    x[i:i + len(clunk)] += clunk
    return reverb(pan(x, -0.1), HALL, 0.15)


# ---------------------------------------------------------------- home


def room_tone(dur, seed=0, color=1.0):
    x = lp(pink(dur, seed), 900 * color, 2) * 0.03 + sine(50, dur) * 0.004
    return fade(stereo(x), 0.4, 0.4)


def room_morning(dur, seed=0):
    x = room_tone(dur, seed)
    # distant birds: sparse chirps high and far
    r = rng(seed + 9)
    out = np.zeros(len(x))
    t = 0.3
    while t < dur - 0.3:
        n = int(0.09 * SR)
        f0 = r.uniform(3200, 5200)
        ch = sine(lambda tt: f0 + 900 * np.sin(tt * 60), 0.09) * env_ad(0.09, 0.005, 0.05, 4) * 0.015
        i = int(t * SR)
        out[i:i + n] += ch[:n]
        t += r.uniform(0.35, 1.3)
    return x + stereo(lp(out, 6000)) * [0.8, 1.0]


def home_quiet(dur, seed=0):
    return room_tone(dur, seed, 0.8) * 0.9


def night_room(dur, seed=0):
    return room_tone(dur, seed, 0.6) * 0.7


def kitchen_evening(dur, seed=0):
    x = room_tone(dur, seed)
    x += stereo(lp(pink(dur, seed + 3), 500) * 0.01)  # the hob / fridge
    return x


def alarm(dur, seed=0):
    d = max(dur, 0.8)
    t = t_axis(d)
    beep = np.sign(np.sin(2 * np.pi * 2750 * t)) * 0.12
    gate = (((t % 0.5) < 0.09) | (((t % 0.5) > 0.14) & ((t % 0.5) < 0.23))).astype(float)
    x = lp(beep * gate, 7000)
    return reverb(pan(fade(x, 0.002, 0.01), -0.3), ROOM, 0.2)


def sheets(dur, seed=0):
    d = 0.9
    x = bp(noise(d, seed), 800, 6000) * env_adsr(d, 0.15, 0.2, 0.5, 0.4) * 0.12
    x *= 0.6 + 0.4 * np.abs(np.sin(t_axis(d) * 9))
    return pan(x, 0.1)


def cloth(dur, seed=0):
    d = 0.4
    x = bp(noise(d, seed), 1000, 7000) * env_adsr(d, 0.05, 0.1, 0.4, 0.2) * 0.12
    return pan(x, 0.0)


def sizzle(dur, seed=0):
    d = max(dur, 0.6)
    base = hp(noise(d, seed), 3000) * 0.05
    r = rng(seed + 1)
    pops = np.zeros(int(d * SR))
    for _ in range(int(d * 60)):
        i = r.integers(0, len(pops) - 400)
        pops[i:i + 300] += bp(noise(300 / SR, int(r.integers(1e6))), 2000, 9000) * np.exp(-np.arange(300) / 40) * r.uniform(0.1, 0.4)
    x = (base + pops) * env_adsr(d, 0.03, 0.1, 0.9, 0.3)
    return pan(x, 0.0)


def egg_crack(dur, seed=0):
    d = 0.25
    crack = bp(noise(0.03, seed), 1500, 8000) * env_ad(0.03, 0.0005, 0.008, 5) * 0.6
    splat = bp(noise(d, seed + 1), 300, 3000) * env_ad(d, 0.005, 0.06, 5) * 0.4
    x = np.zeros(int(d * SR))
    x[: len(crack)] += crack
    i = int(0.04 * SR)
    x[i:] += splat[: len(x) - i]
    return pan(x, 0.0)


def pan_shuffle(dur, seed=0):
    d = 0.4
    x = bp(noise(d, seed), 400, 3000) * env_adsr(d, 0.02, 0.1, 0.4, 0.2) * 0.12
    clink = sine(1900, 0.15) * env_ad(0.15, 0.001, 0.05, 5) * 0.05
    x[: len(clink)] += clink
    return pan(x, 0.05)


def coffee_pour(dur, seed=0):
    d = max(dur, 0.5)
    t = t_axis(d)
    # liquid into liquid: filtered noise whose resonance rises as the mug fills
    x = noise(d, seed)
    out = np.zeros_like(x)
    seg = int(0.05 * SR)
    for i in range(0, len(x), seg):
        u = i / len(x)
        f = 500 + 1300 * u
        out[i:i + seg] = bp(x[i:i + seg + 2000], f * 0.7, f * 1.6)[:seg][: len(out[i:i + seg])]
    out *= env_adsr(d, 0.04, 0.1, 0.8, 0.15) * 0.3
    gurgle = sine(lambda tt: 300 + 80 * np.sin(tt * 37), d) * 0.02 * (0.5 + 0.5 * np.sin(t * 13))
    return pan(out + gurgle, 0.05)


def cup_scrape(dur, seed=0):
    d = 0.35
    x = bp(noise(d, seed), 600, 4000) * env_adsr(d, 0.02, 0.05, 0.7, 0.1) * 0.25
    x *= 1 + 0.5 * np.sin(t_axis(d) * 170)
    return pan(x, 0.2)


def footsteps_soft(dur, seed=0, rate=1.8, surface=(250, 2500), gain=0.25):
    d = max(dur, 1.4)
    out = np.zeros(int(d * SR))
    t = 0.05
    r = rng(seed)
    k = 0
    while t < d - 0.2:
        s = bp(noise(0.12, seed + k), *surface) * env_ad(0.12, 0.004, 0.04, 5) * r.uniform(0.7, 1.0)
        heel = lp(noise(0.05, seed + 100 + k), 400) * env_ad(0.05, 0.002, 0.02, 5) * 0.5
        i = int(t * SR)
        out[i:i + len(s)] += s
        out[i:i + len(heel)] += heel
        t += 1 / rate * r.uniform(0.93, 1.07)
        k += 1
    return reverb(pan(out * gain, 0.0), ROOM, 0.12)


def kid_steps(dur, seed=0):
    return footsteps_soft(dur, seed, rate=3.0, surface=(400, 3500), gain=0.16)


def shop_bell(dur, seed=0):
    d = 1.6
    x = np.zeros(int(d * SR))
    for k, (f, a) in enumerate(((2210, 1.0), (3310, 0.5), (4850, 0.3), (6200, 0.15))):
        for hit in (0.0, 0.11, 0.19):
            s = sine(f * (1 + 0.002 * k), d - hit) * env_ad(d - hit, 0.001, 0.5, 3) * a * (1 - hit * 2.5)
            i = int(hit * SR)
            x[i:] += s[: len(x) - i]
    return reverb(pan(x * 0.12, -0.2), ROOM, 0.25)


def bakery_room(dur, seed=0):
    x = room_tone(dur, seed) * 1.2
    # a far-off oven fan + faint till beeps
    x += stereo(bp(pink(dur, seed + 2), 150, 500) * 0.012)
    return x


def paper_bag(dur, seed=0):
    d = 0.5
    x = bp(noise(d, seed), 1500, 9000) * env_adsr(d, 0.01, 0.1, 0.5, 0.2) * 0.2
    x *= (rng(seed).random(len(x)) > 0.7) * 0.8 + 0.2
    return pan(lp(x, 8000), 0.15)


def chair_scrape(dur, seed=0):
    d = 0.35
    t = t_axis(d)
    x = bp(noise(d, seed), 300, 2500) * env_adsr(d, 0.02, 0.1, 0.6, 0.1) * 0.2
    x += sine(lambda tt: 380 + 200 * tt, d) * 0.03 * env_adsr(d, 0.02, 0.1, 0.6, 0.1)
    return reverb(pan(x, -0.3), ROOM, 0.2)


# ---------------------------------------------------------------- football


def training_bed(dur, seed=0):
    wind = lp(pink(dur, seed), 400, 2) * 0.04
    far = bp(pink(dur, seed + 1), 400, 2500) * 0.006
    r = rng(seed + 2)
    out = np.zeros(int(dur * SR))
    t = 0.8
    while t < dur - 0.5:  # distant kicks from another drill
        k = lp(noise(0.08, int(r.integers(1e6))), 900) * env_ad(0.08, 0.002, 0.02, 5) * 0.03
        i = int(t * SR)
        out[i:i + len(k)] += k
        t += r.uniform(1.2, 2.6)
    x = wind + far + reverb(out, HALL, 0.6)[:, 0]
    return fade(stereo(x), 0.3, 0.3)


def ball_land(dur, seed=0):
    d = 0.3
    x = lp(noise(d, seed), 600, 2) * env_ad(d, 0.001, 0.04, 5) * 0.6
    x += sine(lambda t: 110 + 80 * np.exp(-t * 40), d) * env_ad(d, 0.001, 0.05, 5) * 0.5
    return pan(x, 0.0)


def touch(dur, seed=0):
    d = 0.18
    x = lp(noise(d, seed), 1500, 2) * env_ad(d, 0.0008, 0.02, 5) * 0.5
    x += sine(lambda t: 180 + 120 * np.exp(-t * 60), d) * env_ad(d, 0.001, 0.03, 5) * 0.35
    return pan(x, 0.0)


def strike(dur, seed=0):
    """The strike: a hard leather slap + low punch + a whoosh tail (the quiet man is dangerous)."""
    d = 1.0
    slap = bp(noise(0.05, seed), 900, 7000) * env_ad(0.05, 0.0003, 0.012, 5) * 1.0
    punch = sine(lambda t: 60 + 90 * np.exp(-t * 35), d) * env_ad(d, 0.001, 0.14, 5) * 1.0
    whoosh = bp(noise(d, seed + 1), 400, 3000) * env_adsr(d, 0.02, 0.1, 0.35, 0.6) * 0.25
    x = punch + whoosh
    x[: len(slap)] += slap
    return reverb(pan(x, 0.0), HALL, 0.18)


def net(dur, seed=0):
    d = 1.0
    swish = bp(noise(d, seed), 1200, 8000) * env_adsr(d, 0.01, 0.15, 0.3, 0.5) * 0.35
    thud = lp(noise(0.2, seed + 1), 500) * env_ad(0.2, 0.002, 0.06, 5) * 0.4
    rattle = bp(noise(d, seed + 2), 2000, 6000) * env_ad(d, 0.01, 0.3, 4) * 0.12 * (np.sin(t_axis(d) * 90) > 0)
    x = swish + rattle
    x[: len(thud)] += thud
    return reverb(pan(x, 0.1), HALL, 0.2)


def grass_run(dur, seed=0):
    d = max(dur, 0.9)
    out = np.zeros(int(d * SR))
    t = 0.0
    k = 0
    while t < d - 0.1:
        s = bp(noise(0.07, seed + k), 200, 3000) * env_ad(0.07, 0.002, 0.02, 5) * 0.3
        i = int(t * SR)
        out[i:i + len(s)] += s
        t += 1 / 3.2
        k += 1
    return pan(out, 0.0)


def breath(dur, seed=0):
    d = 0.9
    x = bp(noise(d, seed), 500, 3500) * env_adsr(d, 0.25, 0.1, 0.6, 0.45) * 0.08
    return pan(x, 0.0)


def lace_pull(dur, seed=0):
    d = 0.35
    x = bp(noise(d, seed), 1500, 7000) * env_adsr(d, 0.01, 0.05, 0.6, 0.15) * 0.15
    x *= 1 + np.sin(t_axis(d) * 240)
    return pan(x, 0.0)


def ball_set(dur, seed=0):
    return touch(dur, seed) * 0.5


def ball_bounce(dur, seed=0):
    d = 0.3
    x = sine(lambda t: 140 + 60 * np.exp(-t * 50), d) * env_ad(d, 0.001, 0.05, 5) * 0.5
    x += lp(noise(d, seed), 1200) * env_ad(d, 0.001, 0.02, 5) * 0.3
    return reverb(pan(x, 0.1), ROOM, 0.25)


def lamp_wobble(dur, seed=0):
    d = 1.0
    t = t_axis(d)
    rattle = bp(noise(d, seed), 800, 5000) * 0.12 * np.exp(-t * 3.5) * (np.sin(t * 2 * np.pi * 7) > 0.3)
    ting = sine(2600, d) * env_ad(d, 0.001, 0.25, 4) * 0.03
    return reverb(pan(rattle + ting, 0.35), ROOM, 0.2)


def ice_crinkle(dur, seed=0):
    d = 0.6
    x = bp(noise(d, seed), 2000, 9000) * env_adsr(d, 0.02, 0.1, 0.4, 0.3) * 0.1
    x *= (rng(seed).random(len(x)) > 0.85) * 1.0
    return pan(lp(x, 9000), 0.1)


# ---------------------------------------------------------------- dinner


def knife_chop(dur, seed=0):
    d = max(dur, 0.5)
    out = np.zeros(int(d * SR))
    t = 0.0
    k = 0
    while t < d - 0.1:
        c = lp(noise(0.06, seed + k), 2500) * env_ad(0.06, 0.0005, 0.012, 5) * 0.5
        c += sine(260, 0.06) * env_ad(0.06, 0.0005, 0.015, 5) * 0.2
        i = int(t * SR)
        out[i:i + len(c)] += c
        t += 0.26
        k += 1
    return reverb(pan(out, 0.0), ROOM, 0.1)


def plate_set(dur, seed=0):
    d = 0.5
    x = sine(1450, d) * env_ad(d, 0.001, 0.12, 5) * 0.08 + sine(2380, d) * env_ad(d, 0.001, 0.08, 5) * 0.04
    thud = lp(noise(0.05, seed), 1200) * env_ad(0.05, 0.0005, 0.012, 5) * 0.3
    x[: len(thud)] += thud
    return reverb(pan(x, 0.0), ROOM, 0.15)


def cutlery(dur, seed=0):
    d = 0.4
    x = sine(3100, d) * env_ad(d, 0.001, 0.06, 5) * 0.05 + sine(4700, d) * env_ad(d, 0.001, 0.04, 5) * 0.03
    return reverb(pan(x, -0.1), ROOM, 0.15)


# ---------------------------------------------------------------- interview / matchday / tunnel


def interview_tone(dur, seed=0):
    x = lp(pink(dur, seed), 350, 2) * 0.02 + sine(60, dur) * 0.002
    return fade(stereo(x), 0.05, 0.3)


def tunnel_tone(dur, seed=0):
    x = lp(brown(dur, seed), 200, 2) * 0.06 + bp(pink(dur, seed + 1), 100, 800) * 0.02
    return fade(stereo(x), 0.1, 0.3)


def tunnel_steps(dur, seed=0):
    d = max(dur, 1.8)
    out = np.zeros(int(d * SR))
    t = 0.05
    k = 0
    while t < d - 0.2:
        s = bp(noise(0.05, seed + k), 800, 6000) * env_ad(0.05, 0.0005, 0.01, 5) * 0.5  # studs on concrete
        s2 = bp(noise(0.05, seed + 50 + k), 1500, 7000) * env_ad(0.05, 0.0005, 0.008, 5) * 0.3
        i = int(t * SR)
        out[i:i + len(s)] += s
        j = i + int(0.018 * SR)
        out[j:j + len(s2)] += s2
        t += 1 / 1.8
        k += 1
    return reverb(pan(out * 0.4, 0.0), TUNNEL, 0.45)


def zip_(dur, seed=0):
    d = 0.35
    x = bp(noise(d, seed), 1500, 9000) * env_adsr(d, 0.01, 0.05, 0.8, 0.05) * 0.2
    x *= 1 + np.sin(2 * np.pi * np.cumsum(np.linspace(80, 260, len(x))) / SR)
    return pan(x, 0.1)


def watch_click(dur, seed=0):
    d = 0.2
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0.0, 0.05)):
        c = bp(noise(0.01, seed + k), 3000, 9000) * env_ad(0.01, 0.0002, 0.003, 5) * 0.4
        i = int(at * SR)
        x[i:i + len(c)] += c
    return pan(x, 0.0)


def flashes(dur, seed=0):
    d = max(dur, 1.0)
    out = np.zeros(int(d * SR))
    r = rng(seed)
    for _ in range(int(d * 7)):
        c = bp(noise(0.02, int(r.integers(1e6))), 2500, 9000) * env_ad(0.02, 0.0003, 0.005, 5) * r.uniform(0.05, 0.15)
        i = r.integers(0, len(out) - 1000)
        out[i:i + len(c)] += c
    return stereo(out)


def sub_hit(dur, seed=0):
    d = 1.6
    x = sine(lambda t: 38 + 30 * np.exp(-t * 8), d) * env_ad(d, 0.002, 0.6, 3) * 0.9
    x += lp(noise(d, seed), 200) * env_ad(d, 0.001, 0.15, 5) * 0.3
    return reverb(stereo(x), HALL, 0.2)


def brand_sting(dur, seed=0):
    """HNC sonic signature, restrained: three soft bell-piano notes over a low swell."""
    d = 2.2
    out = np.zeros(int(d * SR))
    for k, (f, at) in enumerate(((587.33, 0.0), (739.99, 0.16), (880.0, 0.32))):
        n = int((d - at) * SR)
        s = sum(sine(f * m, d - at) * a * env_ad(d - at, 0.003, 0.9 / m, 3) for m, a in ((1, 1.0), (2, 0.35), (3, 0.12), (4.2, 0.05)))
        i = int(at * SR)
        out[i:i + n] += s[:n] * 0.12
    swell = lp(saw(146.83, d) + saw(147.5, d, seed=2), 700) * env_adsr(d, 0.4, 0.3, 0.6, 1.2) * 0.05
    return reverb(stereo(out + swell), HALL, 0.35)


def _lay(out, x, at):
    """Add stereo clip `x` into stereo `out` at `at` seconds (clipped to `out`)."""
    i = int(at * SR)
    n = max(0, min(len(x), len(out) - i))
    out[i:i + n] += x[:n]
    return out


def score_motif(dur, seed=0):
    """Italy rematch: the recurring 1–4 motif — one low BUM, then four dry ticks (the score as rhythm)."""
    out = np.zeros((int(SR * max(dur, 1.0)), 2))
    _lay(out, sub_hit(1.6, seed) * 0.9, 0.0)
    for k in range(4):
        _lay(out, watch_click(0.08, seed + k) * 0.7, 0.32 + k * 0.13)
    return out


def elevator_ding(dur, seed=0):
    """Two-partial lift chime with a soft ring-out."""
    d = max(dur, 0.9)
    x = (sine(1318.5, d) * 0.5 + sine(1975.5, d) * 0.25) * env_ad(d, 0.002, 0.6, 4) * 0.5
    return reverb(stereo(x), ROOM, 0.15)


def football_impact(dur, seed=0):
    """Genre switch: a sub drop under a hard ball slap."""
    out = np.zeros((int(SR * max(dur, 1.6)), 2))
    _lay(out, sub_hit(1.6, seed), 0.0)
    _lay(out, ball_land(0.5, seed) * 1.2, 0.0)
    return out


CUES = {
    "car-night-bed": car_night_bed, "car-day-bed": car_day_bed, "indicator": indicator, "knob": knob, "radio-off": radio_off,
    "phone-buzz": phone_buzz, "car-door": car_door, "bus-door": bus_door,
    "message-in": message_in, "message-out": message_out, "key-taps": key_taps, "key-delete": key_delete, "phone-lock": phone_lock,
    "room-morning": room_morning, "home-quiet": home_quiet, "night-room": night_room, "kitchen-evening": kitchen_evening,
    "alarm": alarm, "sheets": sheets, "cloth": cloth, "sizzle": sizzle, "egg-crack": egg_crack, "pan-shuffle": pan_shuffle,
    "coffee-pour": coffee_pour, "cup-scrape": cup_scrape, "footsteps-soft": footsteps_soft, "kid-steps": kid_steps,
    "shop-bell": shop_bell, "bakery-room": bakery_room, "paper-bag": paper_bag, "chair-scrape": chair_scrape,
    "training-bed": training_bed, "ball-land": ball_land, "touch": touch, "strike": strike, "net": net,
    "grass-run": grass_run, "breath": breath, "lace-pull": lace_pull, "ball-set": ball_set, "ball-bounce": ball_bounce,
    "lamp-wobble": lamp_wobble, "ice-crinkle": ice_crinkle, "knife-chop": knife_chop, "plate-set": plate_set,
    "cutlery": cutlery, "interview-tone": interview_tone, "tunnel-tone": tunnel_tone, "tunnel-steps": tunnel_steps,
    "zip": zip_, "watch-click": watch_click, "flashes": flashes, "sub-hit": sub_hit, "brand-sting": brand_sting,
    # Italy rematch (THE SCORE WON'T LEAVE HIM ALONE)
    "score-14-motif": score_motif, "elevator-ding": elevator_ding, "football-impact": football_impact,
    "football-rhythm": training_bed,
    "crowd-rise": lambda dur, seed=0: crowd("stadium-bed-02.wav", max(dur, 2.0), 1.0, 0.8, rise=0.15),
    # CC0 stadium recordings (packages/social-video/assets/audio/SOURCES.md)
    "crowd-roar": lambda dur, seed=0: crowd("goal-roar-01.wav", max(dur, 2.0), 0.0, 1.0),
    "crowd-grow": lambda dur, seed=0: crowd("stadium-bed-02.wav", max(dur, 2.0), 1.0, 0.8, rise=0.15),
    "crowd-muffled": lambda dur, seed=0: crowd("stadium-bed-01.wav", max(dur, 2.0), 2.0, 0.9, muffle=500),
}

# Beds fill the span they are given; one-shots play at their natural length.
BEDS = {"car-night-bed", "car-day-bed", "room-morning", "home-quiet", "night-room", "kitchen-evening", "bakery-room",
        "training-bed", "interview-tone", "tunnel-tone", "crowd-muffled", "crowd-grow", "sizzle", "coffee-pour", "alarm",
        "football-rhythm", "crowd-rise"}


def cue(name, dur, seed=0):
    return stereo(CUES[name](dur, seed))
