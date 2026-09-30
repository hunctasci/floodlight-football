"""Sampled animation channels (pure Python — no bpy).

A performance is authored as sparse keys with per-segment easing and sampled
once per frame; the rig writes every sample as a keyframe. That keeps timing
under our control (anticipation, overshoot, settle, holds) instead of relying
on Blender's auto handles, and lets additive layers (breath, drift) stack.

Values may be floats or tuples of floats (blended component-wise).
"""
import bisect
import math

# ---------------------------------------------------------------- easing


def _smooth(u):  # cubic ease-in-out
    return u * u * (3 - 2 * u)


def _smoother(u):  # quintic ease-in-out (softer starts/stops)
    return u * u * u * (u * (u * 6 - 15) + 10)


EASES = {
    "linear": lambda u: u,
    "smooth": _smooth,
    "soft": _smoother,
    "in": lambda u: u * u,  # slow start, fast end (a fall, a strike)
    "in3": lambda u: u * u * u,
    "out": lambda u: 1 - (1 - u) * (1 - u),  # fast start, slow end (a reaction)
    "out3": lambda u: 1 - (1 - u) ** 3,
    "hold": lambda u: 0.0 if u < 1 else 1.0,  # step at the key (cuts, snaps)
    # Back-out: passes the target by ~7% and settles (follow-through).
    "overshoot": lambda u: 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2,
    # Damped settle: arrives fast, wobbles once, rests (weight landing).
    "settle": lambda u: 1 - math.exp(-6.0 * u) * math.cos(7.5 * u) if u < 1 else 1.0,
}


def ease(name, u):
    u = min(1.0, max(0.0, u))
    return EASES[name](u)


def lerp(a, b, w):
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * w for x, y in zip(a, b))
    return a + (b - a) * w


def add(a, b):
    if isinstance(a, (tuple, list)):
        return tuple(x + y for x, y in zip(a, b))
    return a + b


# ---------------------------------------------------------------- channel


class Channel:
    """Sparse keys (time s, value, ease INTO this key). Before the first key and
    after the last the value holds."""

    def __init__(self, default):
        self.default = default
        self.keys = []  # (t, value, ease)
        self._times = []

    def key(self, t, value, ease_name="smooth"):
        # Replace a key at the same time (later authoring wins).
        i = bisect.bisect_left(self._times, t - 1e-6)
        if i < len(self._times) and abs(self._times[i] - t) <= 1e-6:
            self.keys[i] = (t, value, ease_name)
        else:
            self.keys.insert(i, (t, value, ease_name))
            self._times.insert(i, t)
        return self

    def clear_after(self, t):
        """Drop keys later than t (re-authoring a tail)."""
        i = bisect.bisect_right(self._times, t + 1e-6)
        del self.keys[i:], self._times[i:]
        return self

    def hold(self, t):
        """Key the current value at t (freeze until the next key)."""
        return self.key(t, self.at(t), "hold" if not self.keys else "linear")

    def at(self, t):
        if not self.keys:
            return self.default
        if t <= self._times[0]:
            return self.keys[0][1]
        if t >= self._times[-1]:
            return self.keys[-1][1]
        i = bisect.bisect_left(self._times, t)
        t0, v0, _ = self.keys[i - 1]
        t1, v1, e1 = self.keys[i]
        span = t1 - t0
        u = 1.0 if span <= 0 else (t - t0) / span
        return lerp(v0, v1, ease(e1, u))

    def last(self):
        return self.keys[-1][1] if self.keys else self.default


# ---------------------------------------------------------------- noise


def _hash(i, seed):
    x = math.sin(i * 127.1 + seed * 311.7) * 43758.5453123
    return x - math.floor(x)


def value_noise(t, freq=0.5, seed=0):
    """Smooth 1D value noise in [-1, 1] (deterministic, C1-continuous)."""
    x = t * freq
    i = math.floor(x)
    f = x - i
    a, b = _hash(i, seed) * 2 - 1, _hash(i + 1, seed) * 2 - 1
    return a + (b - a) * _smoother(f)


def fbm(t, freq=0.5, seed=0, octaves=2):
    """Two-octave noise: slow drift + a little faster texture."""
    out, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        out += value_noise(t, freq * (2.1 ** o), seed + o * 17) * amp
        norm += amp
        amp *= 0.45
    return out / norm


def breath(t, rate=0.23, seed=0):
    """Breathing cycle in [0, 1]: slower exhale than inhale, slight rate drift."""
    phase = t * rate * 2 * math.pi + 0.6 * value_noise(t, 0.07, seed)
    s = 0.5 - 0.5 * math.cos(phase)
    return s ** 1.3


def blink_curve(t, times, dur=0.16):
    """Eye openness multiplier from a list of blink start times (fast close, slower open)."""
    v = 1.0
    for b in times:
        u = (t - b) / dur
        if 0 <= u <= 1:
            close = u / 0.35 if u < 0.35 else 1 - (u - 0.35) / 0.65
            v = min(v, 1 - 0.92 * _smooth(max(0.0, min(1.0, close))))
    return v


def blink_times(t0, t1, seed=0, mean=3.4, avoid=()):
    """Deterministic, irregular blink schedule; `avoid` = [(a, b)] windows kept open."""
    out, t, i = [], t0 + 0.4 + _hash(0, seed) * 1.5, 1
    while t < t1:
        if not any(a - 0.2 <= t <= b for a, b in avoid):
            out.append(t)
            if _hash(i, seed + 3) < 0.12:  # occasional double blink
                out.append(t + 0.28)
        t += mean * (0.55 + _hash(i, seed) * 0.9)
        i += 1
    return out
