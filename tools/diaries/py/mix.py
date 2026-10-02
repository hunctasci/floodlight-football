"""Mixer: edit.json + dialogue takes + designed cues + the score -> aligned stems.

    $HNC_TTS_PY tools/diaries/py/mix.py <edit.json> <dialogue.json> <generated_dir>

Writes <generated_dir>/audio/{dialogue,sfx,ambience,music,mix}.wav (48 kHz,
stereo, 24-bit, full episode length, sample-aligned with the picture) and
captions.srt. Remotion plays the four stems; the final loudness pass
(-14 LUFS / -1 dBTP) happens on the encoded master (diaries master).
"""
import json
import sys
import zlib
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0, str(Path(__file__).resolve().parent))
import score  # noqa: E402
import sfx  # noqa: E402
from dsp import SR, bp, db, hp, ir, lp, reverb, stereo  # noqa: E402

ROOM = ir(0.7, 6.0, seed=31, damp=6000)
OFF = ir(1.1, 4.0, seed=33, damp=3500)
TUNNEL = ir(2.6, 1.8, seed=35, damp=3800, pre=0.03)



def load(path):
    x, sr = sf.read(path, dtype="float64", always_2d=True)
    x = x.mean(1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    return x


def place(buf, t, x):
    i = int(round(t * SR))
    if i < 0:
        x = x[-i:]
        i = 0
    n = min(len(x), len(buf) - i)
    if n > 0:
        buf[i:i + n] += x[:n]


def radio_fx(x):
    y = bp(x, 320, 3400, 4)
    y = np.tanh(y * 2.5) / 2.5
    return y * db(-6)


def envelope(x, attack=0.03, release=0.35):
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    e = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    # block-wise follower (fast enough in numpy)
    blk = 480
    m = e[: len(e) // blk * blk].reshape(-1, blk).max(1)
    out = np.zeros_like(m)
    v = 0.0
    for i, s in enumerate(m):
        c = a ** blk if s > v else r ** blk
        v = c * v + (1 - c) * s
        out[i] = v
    env = np.repeat(out, blk)
    return np.pad(env, (0, len(e) - len(env)), mode="edge")


def main():
    edit = json.loads(Path(sys.argv[1]).read_text())
    dialogue = json.loads(Path(sys.argv[2]).read_text())
    gen = Path(sys.argv[3])
    fps = edit["fps"]
    vo = gen / "vo"
    takes = json.loads((vo / "voices.json").read_text())
    starts = {}
    t = 0
    for s in edit["shots"]:
        starts[s["id"]] = t / fps
        t += max(1, round(s["dur"] * fps))
    total = t / fps
    n = int(total * SR)
    markers = dict(starts, end=total)

    dia = np.zeros((n, 2))
    vo_bus = np.zeros((n, 2))  # the diary voice-over alone (drives the deeper duck)
    fx = np.zeros((n, 2))
    amb = np.zeros((n, 2))
    captions = []
    speakers = {l["id"]: l["speaker"] for l in dialogue["lines"]}
    # per-line acoustics from the episode's dialogue.json: "off" (heard from outside the frame, 0..1 distance),
    # "tunnel" (reverb amount), "gain" (dB)
    OFFSCREEN = {l["id"]: l["off"] for l in dialogue["lines"] if "off" in l}
    TUNNEL_LINES = {l["id"]: l["tunnel"] for l in dialogue["lines"] if "tunnel" in l}
    LINE_GAIN = {l["id"]: db(l["gain"]) for l in dialogue["lines"] if "gain" in l}
    texts = {l["id"]: l["text"] for l in dialogue["lines"]}

    # ---- dialogue
    radio_knob = radio_off = None
    for s in edit["shots"]:
        for c in s.get("sfx", []):
            if c["cue"] == "knob":
                radio_knob = starts[s["id"]] + c["at"]
            if c["cue"] == "radio-off":
                radio_off = starts[s["id"]] + c["at"]
    for s in edit["shots"]:
        for d in s.get("dialogue", []):
            lid = d["line"]
            at = starts[s["id"]] + d["at"]
            x = load(vo / f"{lid}.wav") * LINE_GAIN.get(lid, 1.0)
            sp = speakers[lid]
            if sp == "RADIO":
                x = radio_fx(x)
                tt = at + np.arange(len(x)) / SR
                g = np.ones(len(x))
                if radio_knob is not None:
                    g *= np.interp(tt, [radio_knob, radio_knob + 0.35], [1.0, 0.32])
                if radio_off is not None:
                    g *= (tt < radio_off).astype(float)
                y = stereo(x * g) * [0.9, 1.0]
                y = reverb(y, ROOM, 0.15)
            elif lid in TUNNEL_LINES:
                y = reverb(stereo(x), TUNNEL, TUNNEL_LINES[lid])
            elif lid in OFFSCREEN:
                w = OFFSCREEN[lid]
                y = reverb(stereo(lp(x, 7000 - 4000 * w)), OFF, w)
            elif sp == "INT":
                y = reverb(stereo(hp(x, 90)), ROOM, 0.1) * db(-1.0)
            elif sp == "NINE_VO":
                # inside his head: dry, close, centred, a touch warmer than his on-camera voice
                y = stereo(lp(hp(x, 80), 9500)) * db(0.5)
                for c in range(2):
                    place(vo_bus[:, c], at, y[:, c])
            elif sp == "COMM":
                # TV commentary: band-limited broadcast mic, centred, a touch forward of the room.
                y = stereo(lp(hp(x, 140), 7800)) * db(1.0)
            else:
                y = stereo(hp(x, 70))
            for c in range(2):
                place(dia[:, c], at, y[:, c])
            if sp != "RADIO":
                captions.append((at + 0.04, at + len(x) / SR - 0.12, sp, texts[lid]))

    # ---- cues
    for s in edit["shots"]:
        s0 = starts[s["id"]]
        shot_end = s0 + s["dur"]
        for c in s.get("sfx", []):
            name = c["cue"]
            at = s0 + c["at"]
            span = c.get("dur", max(0.2, shot_end - at) if name in sfx.BEDS else 1.0)
            if name in sfx.BEDS and "dur" not in c:
                span = max(span, s["dur"])
            # stable seed (Python's hash() is salted per process): same edit -> same audio
            y = sfx.cue(name, span, seed=zlib.crc32((s["id"] + name).encode()) % 10000) * c.get("gain", 1.0)
            if name in sfx.BEDS:
                y = y[: int(span * SR)]
                k = min(len(y), int(0.08 * SR))
                y[-k:] *= np.linspace(1, 0, k)[:, None]
            target = amb if name in sfx.BEDS else fx
            for ch in range(2):
                place(target[:, ch], at, y[:, ch])

    # ---- music + ducking under dialogue
    # each episode has its own arrangement, anchored to its own shots
    ep = str(dialogue.get("episode", ""))
    build = score.build_rivals if ep.startswith("rivals") else score.build_italy if ep == "italy-rematch" else score.build
    mus = build(markers, total)
    mus = np.pad(mus, ((0, max(0, n - len(mus))), (0, 0)))[:n] * db(-4)
    env = envelope(dia)
    duck = 1.0 - np.clip(env / 0.08, 0, 1) * (1 - db(-8))
    # the voice-over sits further forward: score -3 dB more, beds and effects pulled back under it
    vo_env = np.clip(envelope(vo_bus, release=0.6) / 0.06, 0, 1)
    mus *= (duck * (1.0 - vo_env * (1 - db(-3))))[:, None]
    amb *= ((1.0 - np.clip(env / 0.08, 0, 1) * (1 - db(-3))) * (1.0 - vo_env * (1 - db(-3))))[:, None]
    fx *= (1.0 - vo_env * (1 - db(-2)))[:, None]

    out = gen / "audio"
    out.mkdir(parents=True, exist_ok=True)
    # dialogue leads; effects sit ~6 dB under it, beds and score below that
    stems = {"dialogue": dia * db(1.0), "sfx": fx * db(-8), "ambience": amb * db(-2), "music": mus * db(-1)}
    mix = sum(stems.values())
    peak = np.max(np.abs(mix))
    if peak > 0.98:  # safety only; loudness is set on the encoded master
        g = 0.98 / peak
        mix *= g
        for k in stems:
            stems[k] = stems[k] * g
    for k, v in stems.items():
        sf.write(out / f"{k}.wav", v.astype(np.float32), SR, subtype="PCM_24")
    sf.write(out / "mix.wav", mix.astype(np.float32), SR, subtype="PCM_24")

    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    srt = []
    for i, (a, b, sp, text) in enumerate(sorted(captions), 1):
        srt.append(f"{i}\n{ts(a)} --> {ts(max(b, a + 0.7))}\n{text}\n")
    (out / "captions.srt").write_text("\n".join(srt))
    (out / "mix.json").write_text(json.dumps({"total": total, "markers": markers, "captions": len(captions)}, indent=2))
    print(f"mix: {total:.2f} s, {len(captions)} captions, peak {peak:.3f} -> {out}")


if __name__ == "__main__":
    main()
