"""HNC shorts voices — free/local Qwen3-TTS VoiceDesign via mlx-audio (Apache-2.0).

Same mechanism as tools/diaries/py/voices_qwen.py, narrowed for shorts:
  $HNC_QWEN_PY tools/shorts/py/qwen_shorts.py <dialogue.json> <registry.json> <vo_dir> [--takes=2]

- MODEL, instruct format, lang_code, temperature, tempo, tighten, trim,
  normalise are identical to voices_qwen.py. No new Qwen options are invented.
- Cache: sha256(engine/model/design/lang/temperature/tempo/text/say/delivery)
  -> cache/<hash>.wav. Identical specs reuse audio without regeneration.
- Bootstrap: the first take for a voiceId with no vo/refs/<VOICE>.wav is scored
  by transcript match (WER) only, then promoted to refs/ as the identity anchor.
  Later lines use ECAPA similarity to that ref, exactly like diaries.
- Output: <vo_dir>/<line_id>.wav (48 kHz WAV PCM_24) + voices.json + captions.json.
"""
import hashlib
import json
import sys
from pathlib import Path

import mlx.core as mx
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "diaries" / "py"))
from voices_chatterbox import normalise, resample, trim, wer  # noqa: E402
from voices_qwen import SR, MODEL, apply_tempo, tighten  # noqa: E402

CACHE = "cache"


def cache_key(model, design, lang, temp, tempo, text, say, delivery):
    payload = json.dumps(
        {"engine": "qwen", "model": model, "design": design, "lang": lang,
         "temperature": temp, "tempo": tempo, "text": text, "say": say,
         "delivery": delivery}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def main():
    spec_path, reg_path, vo = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    n_takes = next((int(a.split("=")[1]) for a in sys.argv[4:] if a.startswith("--takes=")), 2)
    n_takes = min(n_takes, 2)
    spec = json.loads(spec_path.read_text())
    registry = json.loads(reg_path.read_text())
    (vo / CACHE).mkdir(parents=True, exist_ok=True)
    (vo / "refs").mkdir(parents=True, exist_ok=True)
    report_path = vo / "voices.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}

    from faster_whisper import WhisperModel
    from mlx_audio.tts.utils import load_model

    tts = load_model(model_path=registry.get("model", MODEL))
    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    spk = None
    refs = {}

    def embed(a, sr):
        nonlocal spk
        if spk is None:
            import torch
            from speechbrain.inference.speaker import EncoderClassifier
            spk = (torch, EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir=str(Path.home() / ".cache/hnc/spkrec-ecapa")))
        torch = spk[0]
        x = torch.from_numpy(resample(a.astype(np.float32), sr, 16000)).unsqueeze(0)
        e = spk[1].encode_batch(x).squeeze()
        return e / e.norm()

    import torch as _torch

    for line in spec["lines"]:
        lid = line["id"]
        reg = registry["voices"][line["speaker"]]
        if reg.get("engine", "qwen") != "qwen":
            continue
        tempo = line.get("tempo", reg.get("tempo", 1.0))
        key = cache_key(registry.get("model", MODEL), reg["design"], reg.get("lang", "en"),
                         line.get("temperature", reg.get("temperature", 0.9)),
                         tempo, line["text"], line.get("say", line["text"]),
                         line.get("delivery", reg.get("deliveryDefault", "natural")))
        cached = vo / CACHE / f"{key}.wav"
        if cached.exists() and report.get(lid, {}).get("cache") == key and (vo / f"{lid}.wav").exists():
            print(f"{lid} cache hit {key}")
            continue
        if cached.exists():
            a, _ = sf.read(cached, dtype="float32")
            sf.write(vo / f"{lid}.wav", a, SR, subtype="PCM_24")
            report[lid] = {"speaker": line["speaker"], "text": line["text"], "seconds": round(len(a) / SR, 3),
                           "engine": "qwen", "cache": key, "tempo": tempo, "tightened": True}
            report_path.write_text(json.dumps(report, indent=2) + "\n")
            print(f"{lid} reuse {key} {len(a) / SR:.2f}s")
            continue
        ref_path = vo / "refs" / f"{line['speaker']}.wav"
        has_ref = ref_path.exists()
        if has_ref and line["speaker"] not in refs:
            r, rsr = sf.read(ref_path, dtype="float32")
            refs[line["speaker"]] = embed(r if r.ndim == 1 else r.mean(1), rsr)
        text = line["text"]
        spoken = line.get("say", text)
        instruct = f"{reg['design']} Delivery for this line: {line.get('delivery', reg.get('deliveryDefault', 'natural'))}."
        takes = []
        for k in range(n_takes):
            mx.random.seed(5000 + k * 37 + int(hashlib.sha256(lid.encode()).hexdigest()[:8], 16) % 100000)
            chunks = [np.array(r.audio, dtype=np.float32) for r in
                      tts.generate(text=spoken, instruct=instruct, lang_code=reg.get("lang", "en"),
                                   temperature=line.get("temperature", reg.get("temperature", 0.9)))]
            a = tighten(apply_tempo(trim(resample(np.concatenate(chunks), tts.sample_rate, SR), SR), tempo))
            hyp = " ".join(s.text.strip() for s in asr.transcribe(resample(a, SR, 16000), beam_size=5, language="en")[0])
            if has_ref:
                sim = float(_torch.dot(embed(a, SR), refs[line["speaker"]]))
            else:
                sim = 1.0
            takes.append((round(wer(text, hyp), 2), -sim, k, a, hyp, sim))
        takes.sort(key=lambda t: (t[0], t[1]))
        err, _neg, k, a, hyp, sim = takes[0]
        a = normalise(a)
        sf.write(cached, a, SR, subtype="PCM_24")
        sf.write(vo / f"{lid}.wav", a, SR, subtype="PCM_24")
        if not has_ref:
            sf.write(ref_path, a, SR, subtype="PCM_24")
            print(f"{lid} bootstrap ref refs/{line['speaker']}.wav from take {k}")
        report[lid] = {"speaker": line["speaker"], "text": text, "take": k, "seconds": round(len(a) / SR, 3),
                       "asr": hyp, "wer": err, "similarity": round(float(sim), 3), "engine": "qwen",
                       "cache": key, "tempo": tempo, "tightened": True}
        flag = "" if err == 0 and (not has_ref or sim >= 0.25) else "  <-- CHECK"
        print(f"{lid} {line['speaker']} {len(a) / SR:5.2f}s sim={sim:.2f} asr='{hyp}' wer={err:.2f}{flag}", flush=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
