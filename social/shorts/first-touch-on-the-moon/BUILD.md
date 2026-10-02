# Rebuild this episode locally

Run from the repository root. Acquired assets are already local. No other
episode, shared registration or shared Blender helper is modified.

## Fixtures (only needed if regenerating canonical exports)

`npx tsx tools/blender/lunar-export.ts`

## Look development and storyboard

`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python tools/blender/py/hnc_blender/shorts/lunar_film.py -- --mode lookdev`

Change `--mode` to `storyboard`, then run:

`python3 tools/shorts/py/lunar_delivery.py sheet`

Inspect the actual PNGs. The four lookdev frames and the full storyboard are
production checkpoints, not substitutes for motion review.

## Motion preview

Use `--mode preview --scale .35 --samples 12 --replace-frames` in the Blender
command, then `python3 tools/shorts/py/lunar_delivery.py preview`.

## Audio

`python3 tools/shorts/py/lunar_audio.py`

Exports the actual source RMS markers, continuous-excerpt waveform, stems and
measured constant-gain 48 kHz / 24-bit stereo mix. Source 43.20 s through actual
EOF is continuous at original tempo, with no added end fade. No compressor,
limiter or adaptive gain flattens the build. Keep publication attribution.
There is no dialogue or narration in the final cut. The former Qwen production
takes remain unused; voice regeneration is not part of this rebuild.

## Remotion preview

From `packages/reels`:

`npx remotion render src/lunar-entry.tsx HncLunarAwayDay ../../social/output/shorts/first-touch-on-the-moon/preview-film-music-v4.mp4 --props='{"mode":"preview","sound":true}' --scale=.5 --crf=23 --concurrency=4`

## Final

Render Blender with `--mode final --samples 48`. Physical shot plates render
natively at 60 fps, with no optical interpolation. Remotion adds the glow and
outro to produce the 2604-frame delivery. Existing frames resume; use
`--replace-frames` after making a scene change.

`python3 tools/shorts/py/lunar_delivery.py final`

From `packages/reels`:

`npx remotion render src/lunar-entry.tsx HncLunarAwayDay ../../social/output/shorts/first-touch-on-the-moon/assembled-final.mp4 --crf=16 --concurrency=4 --audio-bitrate=320k`

Then from the repository root, mux the master WAV with exact duration:

`ffmpeg -y -i social/output/shorts/first-touch-on-the-moon/assembled-final.mp4 -i social/output/shorts/first-touch-on-the-moon/audio-mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -t 43.4 -movflags +faststart social/output/shorts/first-touch-on-the-moon/first-touch-on-the-moon.mp4`

`python3 tools/shorts/py/lunar_delivery.py extract`

Inspect final MP4 frames, confirm native frame count with ffprobe, and measure
the encoded AAC with ffmpeg ebur128 / true-peak oversampling. Python requires
the already available NumPy, SciPy and Pillow. All assets/fonts are local.

## Creative decisions

- Dedicated canonical HNC proportions and faceted heads, not stock astronauts.
- Cream pressure textile, navy harness/boots/pack, aged-gold seals and ports.
- Original octagonal industrial lander and practical-light cabin.
- Cratered terrain, broad relief, granular regolith, small ballistic grains.
- Black camera-visible space sky, hard low sun, long shadows, restrained fill.
- No atmosphere, wind, neon HUD, flags, agency marks, or literal green pitch.
- Earth omitted to preserve empty-horizon compositions.
- No dialogue. Highest crest on the touch, then glow-to-white lunar brand outro.
- Assembly isolated in `src/lunar-entry.tsx`, preserving the in-progress root.

## Music / outro revision 4

The user-approved entry stays at source 43.20 s. Music continues without
internal cuts, speed changes, gain ramps or added end fades through actual EOF
at 86.073 s. The whole-recording RMS maximum at source 77.70 s maps to native
boot contact at film 34.50 s. The outro starts at 35.10 s and lasts 8.30 s:
scene light blooms to white, canonical HNC badge and lunar editorial identity
appear, then RATE THE TOUCH and the website hold through the natural decay.
Final duration 43.40 s / 2604 frames. No Clean line, subtitle or narration.
This longer timing supersedes the original 20-second target at user request.

For corrective Blender renders, use `--shots 0,1,2,3,4,6,7 --replace-frames`.
Other physical shot durations and choreography remain unchanged. The former
11-clean plate is an unused production artifact; final assembly omits it.
