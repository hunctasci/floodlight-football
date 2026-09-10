# HNC Social-Video Crowd Audio — Sources & Provenance

All real-crowd recordings in this directory were intentionally sourced from
**Freesound (https://freesound.org) under the Creative Commons 0 (CC0 1.0)
public-domain dedication**. CC0 permits copying, modification and commercial
use without permission or attribution; creator / page information is preserved
here anyway so provenance is never lost.

Do NOT add audio from YouTube, TV/broadcast football, commercial games, or
unverified internet clips. Every new crowd asset must extend this file with
the same fields.

Freesound license text: http://creativecommons.org/publicdomain/zero/1.0/

## Original masters (`source/`)

Bit-identical copies of the downloaded files (verified with `cmp` against
`~/Downloads` on import day). Never edit these in place — derive runtime clips
with FFmpeg and record the edit recipe below.

### 1. `source/original-arena-ckater-353418.wav`

- Original filename: `353418__ckater__football-game-in-a-big-arena.wav`
- Creator: **ckater** — https://freesound.org/people/ckater/
- Source page: https://freesound.org/people/ckater/sounds/353418/
- Title on source: "football game in a big arena"
- License: **Creative Commons 0 (CC0 1.0)** — no attribution required
- Recorded: 4 Sept 2016, big arena in Hannover, Germany (Tascam DR-100, no
  post-processing per the author's description: "chanting and cheering and
  some missed chances for a goal")
- Technical: WAV, 44.1 kHz, stereo, 16-bit PCM, 60.2 s, 10.6 MB
- Imported: 2026-09-10

### 2. `source/original-goal-reaction-djones-528799.flac`

- Original filename: `528799__djones__19-football-crowd-reaction-to-goal.flac`
- Creator: **D.jones** — https://freesound.org/people/D.jones/
- Source page: https://freesound.org/people/D.jones/sounds/528799/
- Title on source: "19 Football Crowd - Reaction To Goal.flac"
- License: **Creative Commons 0 (CC0 1.0)** — no attribution required
- Recorded: 24 July 2020 ("voice Reaction fans to goal in the stadium";
  near-silent first ~2 s, then the crowd gathers and erupts at ~4.2 s)
- Technical: FLAC, 44.1 kHz, stereo, 16-bit, 93.2 s, 8.2 MB
- Imported: 2026-09-10

### 3. `source/original-stadium-beeproductive-395592.wav`

- Original filename: `395592__beeproductive__football-stadium.wav`
- Creator: **BeeProductive** — https://freesound.org/people/BeeProductive/
- Source page: https://freesound.org/people/BeeProductive/sounds/395592/
- Title on source: "Football stadium.wav"
- License: **Creative Commons 0 (CC0 1.0)** — no attribution required
- Recorded: 17 June 2017 ("a recording of a football stadium crowd made from
  a couple of streets away from the stadium" — distant, calm bed character)
- Technical: WAV, 48 kHz, stereo, 24-bit PCM, 42.2 s, 12.2 MB
- Imported: 2026-09-10

## Runtime clips (`crowd/`)

All runtime clips are **48 kHz, stereo, 16-bit PCM WAV** (verified with
`ffprobe`). Edit recipe per clip (FFmpeg): accurate `-ss`/`-t` trim →
`aresample=48000` → stereo → measured peak-normalisation gain → short
`afade` edges (8 ms attack on roars to preserve impact, longer tails).
Erase nothing: the attack transient of every goal roar is preserved.

| Runtime asset | Derived from | Source range | Gain | Fades (in/out) | Use |
|---|---|---|---|---|---|
| `crowd/stadium-bed-01.wav` (15.0 s) | original-stadium-beeproductive-395592.wav | 1.0–16.0 s | +3.2 dB (peak −6 dBFS) | 0.5 / 0.5 s | Lively distant bed (presence) |
| `crowd/stadium-bed-02.wav` (15.0 s) | original-stadium-beeproductive-395592.wav | 18.0–33.0 s | +10.8 dB (peak −6 dBFS) | 0.5 / 0.5 s | Calm distant bed (quiet variant) |
| `crowd/anticipation-01.wav` (1.85 s) | original-goal-reaction-djones-528799.flac | 2.2–4.05 s | +4.5 dB (peak −3 dBFS) | 0.03 / 0.10 s | Real crowd rise ending exactly at the 4.15 s eruption onset |
| `crowd/anticipation-02.wav` (1.95 s) | original-arena-ckater-353418.wav | 11.6–13.55 s | +5.8 dB (peak −3 dBFS) | 0.03 / 0.10 s | Arena rise ending at the 13.65 s eruption onset |
| `crowd/goal-roar-01.wav` (4.5 s) | original-goal-reaction-djones-528799.flac | 3.95–8.45 s | +0.3 dB (peak −1.5 dBFS) | 0.008 / 0.45 s | Main eruption (onset ~4.15 s preserved) + sustain |
| `crowd/goal-roar-02.wav` (4.0 s) | original-arena-ckater-353418.wav | 13.45–17.45 s | +0.6 dB (peak −1.5 dBFS) | 0.008 / 0.45 s | Alternate-room eruption (onset ~13.65 s) + decay |
| `crowd/goal-roar-03.wav` (3.8 s) | original-arena-ckater-353418.wav | 46.9–50.7 s | −1.4 dB (peak −1.5 dBFS) | 0.008 / 0.45 s | Hush → huge eruption (onset ~47.2 s) + sustain |
| `crowd/disappointment-01.wav` (2.0 s) | original-arena-ckater-353418.wav | 40.3–42.3 s | −0.7 dB (peak −4 dBFS) | 0.02 / 0.30 s | Deflation slope after the 28–40 s hubbub (peak −3.3 dBFS at head, decays −30 dB mean). Energy-shape classification only — fits the "missed chance" passage the author describes, but was not auditioned against a labelled groan. |

Suspect transient peaks in the arena recording (35–37 s, 49–55 s, hitting
0 dBFS) were forensically checked (full-band vs 2–4 kHz band energy): they are
broadband crowd bangs/shouts, NOT referee whistles, so no bed/roar region had
to be rejected for whistle contamination. Roar normalisation absorbs them.

## What stays procedural vs what is now real

- REAL recordings: `ambience` (stadium beds), `anticipation`, `goal` eruption
  body, `crowd` celebration tails, `disappointment` (crossbar/miss groan).
- PROCEDURAL (kept intentionally — the HNC arcade identity): `kick`, `shot`,
  `cross`, `header` impact, `crossbar` metallic clang, `save` glove thud,
  `clearance`, `whoosh`, `impact` sub sweetener, `whistle`, `sting` sonic logo.
- Winning combination: synthetic arcade impact SFX + real human crowd.
