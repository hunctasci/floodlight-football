"""Group Chat V2 audio rebuild: neutral room, tactile SFX family, loud mix.

Replaces the V1 procedural bed whose 150/300 Hz join buzz, 880->620 Hz sine
blips and 50 Hz room hum read as broken-TV buzzing. V2 rules:

- room: neutral shaped noise only (high-passed, no tonal hum), very quiet,
  ducked 6-9 dB under voices.
- sfx: a coherent noise-transient family (vibration, tactile ticks, dry snap,
  air whoosh, paper/plastic thumps, ONE clean soft ding). No sine beeps, no
  buzz, no sweeps. SFX ducked under dialogue.
- voice: dominant. Qwen takes for players/supporters reused from V1 cache;
  hook (Croatia WER 0.0 take) + CTA regenerated. Hook/answer/hr takes are
  lightly time-compressed with WSOLA (ffmpeg atempo) to hit the 13.1 s edit.
- mix: voice-forward gains, then ffmpeg loudnorm to -15.5 LUFS / -1 dBTP.

Usage: python3 tools/shorts/py/audio_v2.py
Requires: numpy, scipy, ffmpeg. Writes stems + mix + captions + voices.json
into packages/reels/public/generated/shorts/group-chat-croatia-england-v2/.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[3]
V1 = REPO / "packages/reels/public/generated/shorts/group-chat-croatia-england"
V2 = REPO / "packages/reels/public/generated/shorts/group-chat-croatia-england-v2"
VO = V2 / "vo"
AUD = V2 / "audio"
SR = 48000

# Absolute voice placement (mirrors GROUP_CHAT_SPEC_V2 timedLines).
# (line_id, at_seconds, atempo)
LINES = [
    ("group-chat-croatia-england-v2-hook", 0.05, 1.8),
    ("group-chat-croatia-england-v2-polite-en", 1.22, 1.0),
    ("group-chat-croatia-england-v2-polite-hr", 1.98, 1.15),
    ("group-chat-croatia-england-v2-problem", 3.15, 1.0),
    ("group-chat-croatia-england-v2-answer", 4.10, 1.12),
    ("group-chat-croatia-england-v2-cta", 11.65, 1.0),
]
TOTAL = 13.10

# SFX timeline (absolute seconds).
TICKS = [1.27, 2.00, 4.90, 5.20, 5.50, 11.70]   # soft tactile message ticks
THOCKS = [2.85, 3.85]                            # slightly heavier join sounds
SNAP_AT = 4.12                                   # dry screenshot snap
WHOOSH_AT = 6.10                                 # 2D->3D transition whoosh
THUMPS = [6.45, 7.45, 8.25, 9.05, 9.75]          # physical card landings
DING_AT = 10.65                                  # one clean soft ding
VIB_AT = 0.02                                    # phone vibration (hook)
PRE_DIP = (2.75, 2.85)                           # 100 ms pre-hit room/SFX dip


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def read_mono_wav(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-f", "f32le", "-ar", str(SR), "-ac", "1", "pipe:1"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def write_wav_stereo(path: Path, left: np.ndarray) -> None:
    from scipy.io import wavfile
    stereo = np.stack([left, left], axis=1)
    stereo = np.clip(stereo, -1.0, 1.0)
    wavfile.write(str(path), SR, (stereo * 32767).astype(np.int16))


def atempo(src: Path, factor: float, dst: Path) -> None:
    if abs(factor - 1.0) < 1e-6:
        dst.write_bytes(src.read_bytes())
        return
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-af", f"atempo={factor}", "-ar", str(SR), "-ac", "1", str(dst)])


def envelope(x: np.ndarray, win: int = 2048) -> np.ndarray:
    from scipy.ndimage import uniform_filter1d
    return np.sqrt(uniform_filter1d(x ** 2, size=win))


def main() -> None:
    AUD.mkdir(parents=True, exist_ok=True)
    n = int(TOTAL * SR)
    rng = np.random.default_rng(7)

    # ---- voice assemblage ------------------------------------------------
    tmp = V2 / "tmp_atempo"
    tmp.mkdir(exist_ok=True)
    voice = np.zeros(n, dtype=np.float64)
    durs: dict[str, float] = {}
    for lid, at, factor in LINES:
        src = VO / f"{lid}.wav"
        if not src.exists():
            print(f"audio_v2: MISSING take {src}", file=sys.stderr)
            sys.exit(1)
        fit = tmp / f"{lid}.wav"
        atempo(src, factor, fit)
        take = read_mono_wav(fit).astype(np.float64)
        durs[lid] = len(take) / SR
        s0 = int(at * SR)
        s1 = min(n, s0 + len(take))
        voice[s0:s1] += take[: s1 - s0]
    peak = float(np.max(np.abs(voice))) or 1.0
    if peak > 0.98:
        voice *= 0.98 / peak

    # voice activity mask (for ducking), smoothed
    act = (envelope(voice) > 0.02).astype(np.float64)
    from scipy.ndimage import uniform_filter1d
    act_s = uniform_filter1d(act, size=int(0.12 * SR))
    duck_voice = 1.0 - 0.65 * np.clip(act_s, 0, 1)  # -9 dB under dialogue

    # ---- room: neutral shaped noise, no hum --------------------------------
    from scipy.signal import butter, sosfilt
    white = rng.standard_normal(n)
    sos_hp = butter(4, 80, btype="highpass", fs=SR, output="sos")
    sos_lp = butter(2, 6000, btype="lowpass", fs=SR, output="sos")
    room = sosfilt(sos_lp, sosfilt(sos_hp, white))
    room /= float(np.max(np.abs(room))) or 1.0
    room *= 0.035  # extremely quiet bed
    room *= duck_voice

    # ---- sfx: noise-transient family ----------------------------------------
    sfx = np.zeros(n, dtype=np.float64)

    def burst(at: float, dur: float, cutoff: float, amp: float, decay: float = 6.0,
              hp: float = 0.0, body: float = 0.0) -> None:
        from scipy.signal import butter, sosfilt
        m = max(1, int(dur * SR))
        s0 = int(at * SR)
        if s0 >= n:
            return
        m = min(m, n - s0)
        noise = rng.standard_normal(m)
        sos = butter(3, cutoff, btype="lowpass", fs=SR, output="sos")
        y = sosfilt(sos, noise)
        if hp > 0:
            sos_h = butter(2, hp, btype="highpass", fs=SR, output="sos")
            y = sosfilt(sos_h, y)
        env = np.exp(-decay * np.arange(m) / SR)
        y = y / (float(np.max(np.abs(y))) or 1.0) * amp * env
        if body > 0:
            tt = np.arange(m) / SR
            y += amp * 0.5 * np.sin(2 * np.pi * body * tt) * env
        sfx[s0: s0 + m] += y

    def vibration(at: float) -> None:
        # two short physical buzz bursts: band-limited noise, AM at ~28 Hz
        for j in range(2):
            m = int(0.11 * SR)
            s0 = int((at + j * 0.16) * SR)
            if s0 + m >= n:
                continue
            from scipy.signal import butter, sosfilt
            noise = rng.standard_normal(m)
            sos = butter(3, [140, 320], btype="bandpass", fs=SR, output="sos")
            y = sosfilt(sos, noise)
            tt = np.arange(m) / SR
            am = 0.5 + 0.5 * np.sin(2 * np.pi * 28 * tt)
            y = y / (float(np.max(np.abs(y))) or 1.0) * 0.5 * am
            sfx[s0: s0 + m] += y

    def whoosh(at: float, dur: float = 0.3) -> None:
        # air movement into the physical world: rising band-passed noise
        from scipy.signal import butter, sosfiltfilt
        m = int(dur * SR)
        s0 = int(at * SR)
        noise = rng.standard_normal(m + 512)
        out = np.zeros(m)
        steps = 8
        for j in range(steps):
            a, b = j * m // steps, (j + 1) * m // steps
            f = 400 * (3000 / 400) ** (j / (steps - 1))
            sos = butter(2, [max(60, f / 2), min(9000, f * 2)], btype="bandpass", fs=SR, output="sos")
            seg = sosfiltfilt(sos, noise[a: b + 512])[: b - a]
            u = (np.arange(a, b) / m)
            out[a:b] = seg * np.sin(np.pi * u) ** 0.5
        out /= float(np.max(np.abs(out))) or 1.0
        sfx[s0: s0 + m] += out * 0.45

    def ding(at: float) -> None:
        # the ONE tonal element: soft clean notification, fast decay
        m = int(0.6 * SR)
        s0 = int(at * SR)
        tt = np.arange(m) / SR
        env = np.exp(-7.0 * tt)
        y = (np.sin(2 * np.pi * 880 * tt) + 0.4 * np.sin(2 * np.pi * 1318.5 * tt)) * env * 0.35
        sfx[s0: s0 + m] += y

    vibration(VIB_AT)
    for t in TICKS:
        burst(t, 0.05, 4500, 0.30, decay=90.0, hp=1500.0)
    for t in THOCKS:
        burst(t, 0.09, 1800, 0.42, decay=45.0)
    burst(SNAP_AT, 0.04, 7000, 0.40, decay=110.0, hp=2500.0)
    whoosh(WHOOSH_AT)
    for t in THUMPS:
        burst(t, 0.13, 900, 0.50, decay=28.0)
    ding(DING_AT)

    # pre-hit dip: brief room/SFX pullback before the first disruption
    d0, d1 = int(PRE_DIP[0] * SR), int(PRE_DIP[1] * SR)
    room[d0:d1] *= 0.25
    sfx[d0:d1] *= 0.25
    # breathing room: near-total silence before the punchline
    b0, b1 = int(10.38 * SR), int(10.60 * SR)
    room[b0:b1] *= 0.15
    sfx[b0:b1] *= 0.1

    sfx *= 1.0 - 0.5 * np.clip(act_s, 0, 1)  # duck under dialogue
    for name, arr, cap in (("voice", voice, 0.98), ("sfx", sfx, 0.9), ("room", room, 0.2)):
        p = float(np.max(np.abs(arr))) or 1.0
        if p > cap:
            arr *= cap / p
        write_wav_stereo(AUD / f"{name}.wav", arr.astype(np.float32))
    write_wav_stereo(AUD / "music.wav", np.zeros(n, dtype=np.float32))

    # ---- mix + loudness ------------------------------------------------------
    mix = voice * 1.0 + sfx * 0.55 + room
    write_wav_stereo(V2 / "tmp_premix.wav", mix.astype(np.float32))
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(V2 / "tmp_premix.wav"),
         "-af", "loudnorm=I=-15.5:TP=-1.0:LRA=11:print_format=json", str(AUD / "audio-mix-v2.wav")])
    (V2 / "tmp_premix.wav").unlink(missing_ok=True)

    # ---- captions + voices.json (Remotion caption timing) ---------------------
    report = json.loads((VO / "voices.json").read_text())
    caps = []
    for lid, at, _ in LINES:
        secs = durs[lid]
        caps.append({"id": lid, "speaker": report[lid]["speaker"], "text": report[lid]["text"],
                     "a": round(at + 0.04, 3), "b": round(at + max(0.8, secs - 0.1), 3)})

    def ts(x: float) -> str:
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{(ms // 60000) % 60:02d}:{(ms // 1000) % 60:02d},{ms % 1000:03d}"

    (AUD / "captions.srt").write_text(
        "".join(f"{i + 1}\n{ts(c['a'])} --> {ts(max(c['b'], c['a'] + 0.7))}\n{c['text']}\n\n" for i, c in enumerate(caps)))
    (AUD / "captions.json").write_text(json.dumps({"total": TOTAL, "captions": caps}, indent=2) + "\n")

    # Remotion caption timing reads vo/voices.json seconds: point it at the
    # PLACED (post-atempo) durations, keeping take_seconds as the audit trail.
    for lid, _, _ in LINES:
        report[lid]["take_seconds"] = report[lid].get("take_seconds", report[lid]["seconds"])
        report[lid]["seconds"] = round(durs[lid], 3)
    (VO / "voices.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"audio_v2: {TOTAL:.2f}s mix -> {AUD / 'audio-mix-v2.wav'}")


if __name__ == "__main__":
    main()
