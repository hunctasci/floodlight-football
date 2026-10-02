"""Two retained local Qwen candidates for one understated fictional identity.

Uses the existing free Qwen model, resampling, trimming, tightening and
normalisation helpers. Candidates stay available for delivery review; no WER
ranking selects an identity automatically.
"""
import json
import sys
from pathlib import Path
import numpy as np
import mlx.core as mx
import soundfile as sf

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'tools/diaries/py'))
from voices_chatterbox import trim,resample,normalise
from voices_qwen import MODEL,SR,tighten
from mlx_audio.tts.utils import load_model

OUT=ROOT/'social/output/shorts/first-touch-on-the-moon/vo'
DESIGN='Young adult male footballer, neutral international English, calm dry understated conversational voice, relaxed soft natural speaking register, one quiet deadpan approving word, no excitement, no narrator or announcer energy, never imitating a real person.'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    model=load_model(model_path=MODEL)
    for k in range(2):
        dest=OUT/f'clean-take-{k+1}.wav'
        if dest.exists():continue
        mx.random.seed(7150+k*37)
        chunks=[np.array(r.audio,dtype=np.float32) for r in model.generate(text='Clean.',
          instruct=DESIGN+' Delivery for this line: brief, dry, calm, gently approving, completely serious.',lang_code='en',temperature=.85)]
        a=normalise(tighten(trim(resample(np.concatenate(chunks),model.sample_rate,SR),SR)))
        sf.write(dest,a,SR,subtype='PCM_24')
        print(f'{dest.name}: {len(a)/SR:.3f}s',flush=True)
    (OUT/'identity.json').write_text(json.dumps({'voiceId':'HNC-LUNAR-02','model':MODEL,'engine':'qwen',
      'design':DESIGN,'temperature':.85,'takes':2,'text':'Clean.','selection':'pending delivery review'},indent=2)+'\n')

if __name__=='__main__':main()
