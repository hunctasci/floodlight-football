# Italy Rematch — final render

Launch the interactive production renderer:

```bash
npm run diaries -- final-render --episode italy-rematch
```

The locked `final60` profile renders 1080×1920 PNG shot caches at true 60 fps
using EEVEE with 256 samples. It preserves the 48.500-second cut (2,910 output
frames) by building at the 30fps authored timebase and deterministically
retiming scene timing before delivery rendering.

Non-interactive commands:

```bash
npm run diaries -- final-render --episode italy-rematch --profile final60 --preflight
npm run diaries -- final-render --episode italy-rematch --profile final60 --resume
npm run diaries -- final-render --episode italy-rematch --profile final60 --shot S14_SH01
npm run diaries -- final-render --episode italy-rematch --profile final60 --assemble-only
```

Outputs live in `social/output/player-diaries/italy-rematch/final60/`: lossless
frames under `frames/`, Remotion frames under `remotion/`, masters under
`masters/`, logs under `logs/`, and resumable state in `render-state.json`.
Frames are intentionally retained after encoding. After reviewing the watch
copy, delete only the exact `final60/frames/` and `final60/remotion/` folders
if disk space is needed; keep masters, reports, logs, and state.
