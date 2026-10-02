"""Commentator takes with Qwen3-TTS VoiceDesign (Apache-2.0), local + offline via mlx-audio.

    $HNC_QWEN_PY tools/diaries/py/voices_qwen.py <dialogue.json> <vo_dir> [L03 …] [--takes=6] [--retempo]

Each line is designed exactly as the owner auditioned "Qwen B": the speaker's fixed `design` text plus
the line's `delivery` note. Design can drift the timbre take to take, so identity is held by selection:
among takes whose transcript matches best, keep the one whose ECAPA speaker embedding is closest to
vo/refs/<SPEAKER>.wav (the approved audition take). Fictional voice; no real person is cloned.
"""
import json
import subprocess
import sys
from pathlib import Path

import mlx.core as mx
import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, str(Path(__file__).parent))
from voices_chatterbox import normalise, resample, trim, wer  # noqa: E402

SR = 48000
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"


def apply_tempo(a, tempo):
    """Pitch-preserving speed-up (ffmpeg atempo, WSOLA): Qwen B reads ~2 words/s, live commentary runs ~3."""
    if tempo == 1.0:
        return a
    out = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
                          "-filter:a", f"atempo={tempo}", "-f", "f32le", "pipe:1"], input=a.astype(np.float32).tobytes(),
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def tighten(a, max_gap=0.35, thresh_db=-38):
    """Cap pauses inside a take at `max_gap` s (dialogue editor's tighten): words and delivery stay, dead air goes."""
    win = int(0.02 * SR)
    env = np.sqrt(np.convolve(a ** 2, np.ones(win) / win, "same"))
    quiet = env < 10 ** (thresh_db / 20)
    keep = np.ones(len(a), bool)
    i = 0
    while i < len(a):
        if quiet[i]:
            j = i
            while j < len(a) and quiet[j]:
                j += 1
            if i > 0 and j < len(a) and (j - i) > max_gap * SR:
                cut = (j - i) - int(max_gap * SR)
                keep[i + (j - i - cut) // 2: i + (j - i - cut) // 2 + cut] = False
            i = j
        else:
            i += 1
    return a[keep]


def retempo(spec, vo):
    """Apply each speaker's `tempo` once to already-approved takes (voices.json records it so it never doubles)."""
    report_path = vo / "voices.json"
    report = json.loads(report_path.read_text())
    for line in spec["lines"]:
        sp, r = spec["speakers"][line["speaker"]], report.get(line["id"], {})
        tempo = sp.get("tempo", 1.0)
        if sp.get("engine") != "qwen" or (r.get("tempo", 1.0) == tempo and r.get("tightened")):
            continue
        a, _sr = sf.read(vo / f"{line['id']}.wav", dtype="float32")
        a = normalise(tighten(apply_tempo(a, tempo / r.get("tempo", 1.0))))
        sf.write(vo / f"{line['id']}.wav", a, SR, subtype="PCM_24")
        r.update(seconds=round(len(a) / SR, 3), tempo=tempo, tightened=True)
        print(f"{line['id']} tempo {tempo}: {r['seconds']:.2f}s")
    report_path.write_text(json.dumps(report, indent=2) + "\n")


def main():
    spec_path, vo = Path(sys.argv[1]), Path(sys.argv[2])
    only = {a for a in sys.argv[3:] if not a.startswith("--")}
    n_takes = next((int(a.split("=")[1]) for a in sys.argv[3:] if a.startswith("--takes=")), 6)
    spec = json.loads(spec_path.read_text())
    if "--retempo" in sys.argv:
        return retempo(spec, vo)
    from faster_whisper import WhisperModel
    from mlx_audio.tts.utils import load_model
    from speechbrain.inference.speaker import EncoderClassifier
    tts = load_model(model_path=MODEL)
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    spk = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb",
                                         savedir=str(Path.home() / ".cache/hnc/spkrec-ecapa"))

    def embed(a, sr):
        x = torch.from_numpy(resample(a.astype(np.float32), sr, 16000)).unsqueeze(0)
        e = spk.encode_batch(x).squeeze()
        return e / e.norm()

    refs = {}
    report_path = vo / "voices.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    for line in spec["lines"]:
        if only and line["id"] not in only:
            continue
        sp = spec["speakers"][line["speaker"]]
        if sp.get("engine") != "qwen":
            continue
        if line["speaker"] not in refs:
            r, rsr = sf.read(vo / "refs" / f"{line['speaker']}.wav", dtype="float32")
            refs[line["speaker"]] = embed(r if r.ndim == 1 else r.mean(1), rsr)
        text = line["text"]
        spoken = line.get("say", text)  # pronunciation override; the transcript is scored against the caption
        instruct = f"{sp['design']} Delivery for this line: {line.get('delivery', 'natural')}."
        takes = []
        for k in range(n_takes):
            mx.random.seed(2000 + k * 31 + int(line["id"][1:]))
            chunks = [np.array(r.audio, dtype=np.float32) for r in
                      tts.generate(text=spoken, instruct=instruct, lang_code=sp.get("lang", "en"),
                                   temperature=line.get("temperature", sp.get("temperature", 0.9)))]
            a = tighten(apply_tempo(trim(resample(np.concatenate(chunks), tts.sample_rate, SR), SR), sp.get("tempo", 1.0)))
            hyp = " ".join(s.text.strip() for s in asr.transcribe(resample(a, SR, 16000), beam_size=5, language="en")[0])
            sim = float(torch.dot(embed(a, SR), refs[line["speaker"]]))
            takes.append((round(wer(text, hyp), 2), -sim, k, a, hyp, sim))
        takes.sort(key=lambda t: (t[0], t[1]))
        err, _neg, k, a, hyp, sim = takes[0]
        a = normalise(a)
        sf.write(vo / f"{line['id']}.wav", a, SR, subtype="PCM_24")
        report[line["id"]] = {"speaker": line["speaker"], "text": text, "take": k, "seconds": round(len(a) / SR, 3),
                              "asr": hyp, "wer": err, "similarity": round(sim, 3), "engine": "qwen",
                              "tempo": sp.get("tempo", 1.0), "tightened": True}
        # 0.25 = just under the lowest score among the owner-approved audition lines (0.27); unrelated voices score ≈0.1.
        flag = "" if err == 0 and sim >= 0.25 else "  <-- CHECK"
        print(f"{line['id']} {line['speaker']:5s} {len(a) / SR:5.2f}s sim={sim:.2f} asr='{hyp}' wer={err:.2f}{flag}", flush=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
