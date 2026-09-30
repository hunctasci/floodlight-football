"""Tiny deterministic DSP kit for the Player Diaries sound design (numpy/scipy)."""
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000


def rng(seed):
    return np.random.default_rng(int(seed) % 2**32)


def t_axis(dur, sr=SR):
    return np.arange(int(dur * sr)) / sr


def noise(dur, seed=0, sr=SR):
    return rng(seed).standard_normal(int(dur * sr)).astype(np.float64)


def pink(dur, seed=0, sr=SR):
    n = int(dur * sr)
    w = rng(seed).standard_normal(n)
    f = np.fft.rfft(w)
    k = np.arange(len(f))
    k[0] = 1
    f /= np.sqrt(k)
    x = np.fft.irfft(f, n)
    return x / (np.std(x) + 1e-9)


def brown(dur, seed=0, sr=SR):
    x = np.cumsum(rng(seed).standard_normal(int(dur * sr)))
    x -= np.convolve(x, np.ones(2048) / 2048, "same")
    return x / (np.std(x) + 1e-9)


def _sos(kind, f, order=2, sr=SR):
    if kind == "band":
        lo, hi = f
        return butter(order, [max(10, lo), min(sr / 2 - 100, hi)], "bandpass", fs=sr, output="sos")
    return butter(order, min(sr / 2 - 100, max(10, f)), kind, fs=sr, output="sos")


def lp(x, f, order=2):
    return sosfilt(_sos("lowpass", f, order), x)


def hp(x, f, order=2):
    return sosfilt(_sos("highpass", f, order), x)


def bp(x, lo, hi, order=2):
    return sosfilt(_sos("band", (lo, hi), order), x)


def env_ad(dur, a=0.005, d=0.2, curve=4.0, sr=SR):
    t = t_axis(dur, sr)
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-(t - a) * curve / max(d, 1e-6)))
    return e


def env_adsr(dur, a, d, s, r, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    e = np.interp(t, [0, a, a + d, max(a + d, dur - r), dur], [0, 1, s, s, 0])
    return e


def fade(x, fin=0.01, fout=0.05, sr=SR):
    y = x.copy()
    a, b = min(int(fin * sr), len(y)), min(int(fout * sr), len(y))
    shape = (-1, 1) if y.ndim == 2 else (-1,)
    if a:
        y[:a] *= np.linspace(0, 1, a).reshape(shape)
    if b:
        y[-b:] *= np.linspace(1, 0, b).reshape(shape)
    return y


def sine(freq, dur, phase=0.0, sr=SR):
    t = t_axis(dur, sr)
    if callable(freq):
        f = freq(t)
        return np.sin(2 * np.pi * np.cumsum(f) / sr + phase)
    return np.sin(2 * np.pi * freq * t + phase)


def saw(freq, dur, sr=SR, seed=0):
    t = t_axis(dur, sr)
    ph = (freq * t + rng(seed).random()) % 1.0
    return 2 * ph - 1


def ir(dur=1.8, decay=2.6, seed=7, pre=0.012, damp=6000, sr=SR, stereo=True):
    """Synthetic room impulse response: early reflections + a damped noise tail."""
    n = int(dur * sr)
    out = []
    for ch in range(2 if stereo else 1):
        r = rng(seed + ch)
        tail = r.standard_normal(n) * np.exp(-np.arange(n) / sr * decay)
        tail = lp(tail, damp)
        er = np.zeros(n)
        for k in range(8):
            i = int((pre + r.random() * 0.05) * sr)
            er[i] += (0.6 - k * 0.06) * (1 if r.random() > 0.5 else -1)
        h = er + tail * 0.35
        h[: int(pre * sr)] = 0
        out.append(h / np.sqrt(np.sum(h ** 2)))
    return np.stack(out, 1) if stereo else out[0]


def reverb(x, h, wet=0.25):
    """x mono or stereo, h stereo IR -> stereo."""
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([fftconvolve(x[:, c], h[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


def pan(x, p=0.0):
    """Equal-power pan of a mono signal (-1 left … +1 right)."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], 1)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


def db(g):
    return 10 ** (g / 20)
