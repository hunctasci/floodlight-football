# HNC Player Diaries — production pipeline

One command per stage (repo root). Everything is deterministic and cached;
nothing here is committed output (plates, stems, MP4s are generated/ignored).

```sh
npm run blender:export                               # canonical HNC → GLBs (cast fixtures incl. family, supporters)
python3 tools/blender/py/fetch_external.py           # CC0 set dressing (Poly Haven), md5-verified
npm run diaries -- voices [L08 L22] [--takes 5]      # Kokoro reference timbres → Chatterbox takes (3/line, ASR-picked)
npm run diaries -- check                             # runtime, scene lengths, dialogue collisions
npm run diaries -- storyboard                        # storyboard.md from edit.json
npm run diaries -- ui                                # Remotion stills Blender maps into hybrid shots + grain tile
npm run diaries -- plates --quality animatic|preview|final [--only S06_SH08] [--jobs 3] [--force]
npm run diaries -- audio                             # SFX + score + mix → 4 stems + captions.srt
npm run diaries -- edit --quality final --out <mp4>  # Remotion assembly (plates + cards + grain + stems)
npm run diaries -- master --in <mp4> --out <mp4>     # −14 LUFS / −1 dBTP, H.264 high, AAC 256k, ffprobe report
npm run diaries -- sheet --in <mp4> --out <png>      # 1 fps contact sheet
blender -b --factory-startup --python tools/blender/py/hnc_cli.py -- rig-selftest     # rig sign conventions
blender -b --factory-startup --python tools/blender/py/hnc_cli.py -- acting-test --out <dir>   # rig QA shot
blender -b --factory-startup --python tools/blender/py/hnc_cli.py -- diaries-shot --shot S01_SH02 --quality preview --out <dir> --stills 1,60
```

Local tools outside the repo (never committed): `HNC_DIARIES_PY` (default
`../.tools/tts/.venv/bin/python`: numpy, scipy, soundfile, kokoro-onnx,
faster-whisper), `HNC_TTS_DIR` (default `../.tools/tts`: `kokoro-v1.0.onnx`,
`voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx releases),
`HNC_CHATTERBOX_PY` (default `../.tools/chatterbox/.venv/bin/python`: Python 3.11,
`chatterbox-tts`, `faster-whisper`, `setuptools<81` — the Perth watermarker still
imports `pkg_resources`), `HNC_BLENDER_BIN` (Blender 5.2 LTS).

Voice direction lives in `dialogue.json`: per speaker `ref_text` (the neutral
reference Kokoro renders), `exaggeration` (low = understated), `cfg` (low =
slower, more deliberate), `temperature`; per line overrides plus `say` (what is
voiced when it differs from the caption, e.g. "Needs… salt.", "Tur-kee-yeh").
Chatterbox copies the reference's habits along with its timbre — keep reference
texts free of hums and fillers.

## Single source of the cut

`packages/reels/src/diaries/<ep>/edit.json` — shot order, durations, renderer,
framing/lens/move notes, dialogue placement (shot-relative, may pre-lap), SFX
cues. Read by the Blender builders (`tools/blender/py/hnc_blender/diaries/<ep>/`),
the mixer (`tools/diaries/py/mix.py`) and Remotion (`packages/reels/src/diaries/`).
Re-time a shot and picture, sound, captions and storyboard all follow.

`dialogue.json` — lines, speakers, voices (fictional synthetic voices only),
explicit phonemes for Türkiye.

## Layers

| Layer | Where | What it gives the next episode |
|---|---|---|
| Canonical cast | `packages/hnc-visuals` (proportions, wardrobe) + `tools/blender/src/interchange.ts` fixtures | any HNC person, any look, any age, parity-verified |
| Performance rig | `hnc_blender/cine/rig.py` | armature on the canonical parts; elbows/knees via rest-neutral limb loops; IK feet/hands; look/gaze aim; blinks |
| Animation maths | `cine/anim.py` | sampled channels, easing (overshoot, settle), breath, drift, blinks |
| Performance library | `cine/perform.py`, `cine/football.py` | stance, weight shift, walk/elder/child/jog/sprint gaits, look, glance (side-eye), smile read, nod, reach, hold (auto-grip), point, sit/stand, lie, kneel · touch, strike, ball physics |
| Camera | `cine/camera.py` | physical lenses, `frame()` shot sizes calibrated to HNC heads, handheld styles, impacts, rack focus |
| Look | `cine/look.py` | PBR (CC0 textures), thin window glass, fabric, HDRI worlds, light helpers, render presets, compositor finish |
| Props | `cine/props.py` | soft furnishings, kitchen + table, mug/carafe/pour, phone, bag, ice, boots (canonical), TR shirt, clock… |
| Sets | `cine/sets/` | home (bedroom, child room, kitchen/dining, living, entry — 5 times of day), car (interior + moving world, night/day), bakery, training pitch (+ net rig), interview, street (car door, team bus), tunnel |
| Sound | `tools/diaries/py/` | ~50 designed cues, original score engine, mixer with per-speaker treatment + ducking |
| Edit | `packages/reels/src/diaries/` | episode composition, title/match/end cards, grain, captions |

## Rules that kept EP01 honest

- Identity is canonical; performance is cinematic. Never edit a GLB or re-model a person.
- Frame people with `frame()`: HNC heads are ~0.64 m wide — human shot-size instincts put the lens inside faces.
- Stage in world space with `heading()`; never hand-type facings.
- Every render is looked at (contact sheets, full-size problem frames) before it is called done.
