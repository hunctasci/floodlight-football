"""Dialogue takes for HNC Player Diaries (local, offline, deterministic).

    $HNC_TTS_PY tools/diaries/py/voices.py packages/reels/src/diaries/ep01/dialogue.json <out_dir> [L01 L02 …]

Voices: Kokoro-82M (Apache-2.0) via kokoro-onnx — fictional synthetic voices,
never modelled on a real person. For each line three takes are synthesised
(speed −4 % / 0 / +4 %); faster-whisper transcribes each take and the one
with the best word match, then confidence, is kept. That is our only
objective ear: every take is ASR-verified intelligible. Then: pitch shaping
by resampling (the child is a pitched-up voice generated slower so the
tempo lands where directed), silence trim with breathing room, and level
normalisation. Room / radio treatment happens in the mix, not here.

Environment (outside the repo, see social/player-diaries/PIPELINE.md):
  HNC_TTS_DIR  folder with kokoro-v1.0.onnx + voices-v1.0.bin
"""
import json
import os
import re
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

SR = 48000
TTS_DIR = Path(os.environ.get("HNC_TTS_DIR", Path(__file__).resolve().parents[4] / ".tools" / "tts"))


def words(s):
    return re.findall(r"[a-z']+", s.lower().replace("türkiye", "turkey"))


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


def trim(a, sr, head=0.05, tail=0.16, thresh_db=-42):
    env = np.convolve(np.abs(a), np.ones(int(sr * 0.01)) / (sr * 0.01), "same")
    on = np.where(env > 10 ** (thresh_db / 20))[0]
    if len(on) == 0:
        return a
    s = max(0, on[0] - int(head * sr))
    e = min(len(a), on[-1] + int(tail * sr))
    out = a[s:e].copy()
    fade = int(0.008 * sr)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def normalise(a, rms_db=-21.0, peak_db=-3.0):
    rms = np.sqrt(np.mean(a[np.abs(a) > 1e-4] ** 2)) if np.any(np.abs(a) > 1e-4) else 1e-4
    g = 10 ** (rms_db / 20) / rms
    g = min(g, 10 ** (peak_db / 20) / max(1e-6, np.max(np.abs(a))))
    return (a * g).astype(np.float32)


def refs(spec, out_dir, tts):
    """Kokoro renders each character's neutral reference clip (its timbre = the character)."""
    rd = out_dir / "refs"
    rd.mkdir(parents=True, exist_ok=True)
    for key, sp in spec["speakers"].items():
        if "ref_text" not in sp:
            continue
        a, sr = tts.create(sp["ref_text"], voice=sp["voice"], speed=sp["speed"] / sp["pitch"], lang=sp["lang"])
        a = resample(a.astype(np.float32), int(round(sr * sp["pitch"])), SR)
        sf.write(rd / f"{key}.wav", normalise(trim(a, SR)), SR, subtype="PCM_24")
        print(f"ref {key}: {len(a) / SR:.1f}s ({sp['voice']})")


def main():
    spec_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[3:])
    spec = json.loads(spec_path.read_text())
    out_dir.mkdir(parents=True, exist_ok=True)
    from kokoro_onnx import Kokoro
    if "--refs" in only:
        refs(spec, out_dir, Kokoro(str(TTS_DIR / "kokoro-v1.0.onnx"), str(TTS_DIR / "voices-v1.0.bin")))
        return
    from faster_whisper import WhisperModel
    tts = Kokoro(str(TTS_DIR / "kokoro-v1.0.onnx"), str(TTS_DIR / "voices-v1.0.bin"))
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    report_path = out_dir / "voices.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    for line in spec["lines"]:
        if only and line["id"] not in only:
            continue
        sp = spec["speakers"][line["speaker"]]
        speed = line.get("speed", sp["speed"])
        pitch = line.get("pitch", sp["pitch"])
        text = line["text"]
        phon = None
        for word, ipa in spec.get("phonemes", {}).items():
            if word in text:
                base = tts.tokenizer.phonemize(text.replace(word, "Turkey"), sp["lang"])
                turkey = tts.tokenizer.phonemize("Turkey", sp["lang"]).strip(" .?!,")
                phon = base.replace(turkey, ipa)
        takes = []
        for k, mul in enumerate((0.96, 1.0, 1.04)):
            s = speed * mul / pitch  # generate slower when pitching up so the tempo lands as directed
            if phon:
                a, sr = tts.create(phon, voice=sp["voice"], speed=s, lang=sp["lang"], is_phonemes=True)
            else:
                a, sr = tts.create(text, voice=sp["voice"], speed=s, lang=sp["lang"])
            a = a.astype(np.float32)
            # pitch by resampling: play back `pitch` times faster
            a = resample(a, int(round(sr * pitch)), SR)
            a = trim(a, SR)
            a16 = resample(a, SR, 16000)
            segs, _ = asr.transcribe(a16, beam_size=5, language="en")
            segs = list(segs)
            hyp = " ".join(x.text.strip() for x in segs)
            lp = float(np.mean([x.avg_logprob for x in segs])) if segs else -9
            takes.append((wer(text, hyp), -lp, k, a, hyp, lp))
        takes.sort(key=lambda x: (x[0], x[1]))
        err, _nlp, k, a, hyp, lp = takes[0]
        a = normalise(a)
        path = out_dir / f"{line['id']}.wav"
        sf.write(path, a, SR, subtype="PCM_24")
        report[line["id"]] = {
            "speaker": line["speaker"], "text": text, "take": k, "seconds": round(len(a) / SR, 3),
            "asr": hyp, "wer": round(err, 3), "logprob": round(lp, 3), "voice": sp["voice"],
        }
        flag = "" if err == 0 else "  <-- CHECK"
        print(f"{line['id']} {line['speaker']:7s} {len(a) / SR:5.2f}s  asr='{hyp}' wer={err:.2f}{flag}")
    report_path.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
