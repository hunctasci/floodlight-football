"""Natural dialogue takes with Chatterbox (MIT, Resemble AI), local + offline.

    $HNC_CHATTERBOX_PY tools/diaries/py/voices_chatterbox.py <dialogue.json> <vo_dir> [L01 L02 …]

Each character speaks in the timbre of its own reference clip (vo/refs/<SPEAKER>.wav,
rendered from a fictional Kokoro voice by `voices.py --refs`) — no real person is
cloned. Direction per speaker/line: `exaggeration` (expressiveness; low = understated),
`cfg` (lower = slower, more deliberate), `temperature`. Three seeded takes per line;
faster-whisper transcribes each; among the takes with the best word match the one
closest to the current cut length is kept (the edit barely moves). Level-normalised,
trimmed with breathing room; room/radio treatment happens in the mix.
"""
import json
import os
import re
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly

SR = 48000


def words(s):
    # Türkiye is voiced as "Tur-kee-yeh"; an English ASR hears "Turkey yet/yeah/yay/I" — all count as the word.
    s = re.sub(r"\bturkey[\s,.-]+(yet|yeah|yay|yeh|ye|i|a)\b", "turkey", s.lower().replace("türkiye", "turkey"))
    return re.findall(r"[a-z']+", s)


def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0] = range(len(r) + 1)
    d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r), len(h)] / max(1, len(r))


def resample(a, src, dst):
    f = Fraction(dst, src).limit_denominator(2000)
    return resample_poly(a, f.numerator, f.denominator).astype(np.float32)


def trim(a, sr, head=0.06, tail=0.2, thresh_db=-40):
    env = np.convolve(np.abs(a), np.ones(int(sr * 0.01)) / (sr * 0.01), "same")
    on = np.where(env > 10 ** (thresh_db / 20))[0]
    if len(on) == 0:
        return a
    s, e = max(0, on[0] - int(head * sr)), min(len(a), on[-1] + int(tail * sr))
    out = a[s:e].copy()
    f = int(0.01 * sr)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def normalise(a, rms_db=-21.0, peak_db=-3.0):
    loud = np.abs(a) > 1e-3
    rms = np.sqrt(np.mean(a[loud] ** 2)) if np.any(loud) else 1e-3
    g = min(10 ** (rms_db / 20) / rms, 10 ** (peak_db / 20) / max(1e-6, np.max(np.abs(a))))
    return (a * g).astype(np.float32)


def main():
    spec_path, vo = Path(sys.argv[1]), Path(sys.argv[2])
    only = {a for a in sys.argv[3:] if not a.startswith("--")}
    n_takes = next((int(a.split("=")[1]) for a in sys.argv[3:] if a.startswith("--takes=")), 3)
    spec = json.loads(spec_path.read_text())
    from chatterbox.tts import ChatterboxTTS
    from faster_whisper import WhisperModel
    # NVIDIA (CUDA) on a PC, Apple GPU (MPS) on a Mac, else CPU (slow but works).
    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    tts = ChatterboxTTS.from_pretrained(device=device)
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    report_path = vo / "voices.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    say = spec.get("say", {})
    for line in spec["lines"]:
        if only and line["id"] not in only:
            continue
        sp = spec["speakers"][line["speaker"]]
        if sp.get("engine") != "chatterbox":
            continue
        text = line["text"]
        spoken = line.get("say", text)  # per-line spoken override (captions keep `text`)
        for w, r in say.items():
            spoken = spoken.replace(w, r)
        ref = vo / "refs" / f"{line['speaker']}.wav"
        target = report.get(line["id"], {}).get("seconds")
        ex = line.get("exaggeration", sp.get("exaggeration", 0.5))
        cfg = line.get("cfg", sp.get("cfg", 0.5))
        temp = line.get("temperature", sp.get("temperature", 0.8))
        takes = []
        for k in range(n_takes):
            torch.manual_seed(1000 + k * 17 + int(line["id"][1:]))
            wav = tts.generate(spoken, audio_prompt_path=str(ref), exaggeration=ex, cfg_weight=cfg, temperature=temp)
            a = trim(resample(wav.squeeze(0).numpy(), tts.sr, SR), SR)
            segs = list(asr.transcribe(resample(a, SR, 16000), beam_size=5, language="en")[0])
            hyp = " ".join(x.text.strip() for x in segs)
            err = wer(text, hyp)
            dur = len(a) / SR
            takes.append((err, abs(dur - target) if target else 0.0, k, a, hyp))
        takes.sort(key=lambda x: (round(x[0], 2), x[1]))
        err, _dt, k, a, hyp = takes[0]
        a = normalise(a)
        sf.write(vo / f"{line['id']}.wav", a, SR, subtype="PCM_24")
        report[line["id"]] = {"speaker": line["speaker"], "text": text, "take": k, "seconds": round(len(a) / SR, 3), "asr": hyp,
                              "wer": round(err, 3), "engine": "chatterbox", "exaggeration": ex, "cfg": cfg}
        print(f"{line['id']} {line['speaker']:7s} {len(a) / SR:5.2f}s (was {target or 0:.2f})  asr='{hyp}' wer={err:.2f}{'' if err == 0 else '  <-- CHECK'}", flush=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
