# HNC Social Video — agent interface

Generate HNC League social-media visuals/videos from the **actual game renderer**.
No editing UI exists on purpose: agents drive everything through semantic specs + CLI.

## Purpose

Deterministic TikTok / Reels / Shorts frames from the real HNC stadium, pitch,
player avatars, country kits and ball. Three.js is the implementation detail;
**semantic football scenes are the interface**.

Think in this vocabulary:

```text
FACEOFF · TURKEY · GREECE · SEED 42 · REEL · 30 FPS · 4 SEC · FRAME 75
```

never in `THREE.Vector3` coordinates or camera FOVs.

## Core invariant

```text
render(spec, frame) = pure function
same spec + same frame = same image
```

`time = frame / fps`. The timeline is evaluated random-access per frame;
page lifetime and wall clocks never advance the scene.

## Commands

```bash
# Inspect ONE deterministic timeline frame (fast, random-access)
npm run social:frame -- \
  --scene faceoff \
  --home TR \
  --away GR \
  --frame 75 \
  --output social/output/preview.png

# Render a full PNG sequence (one reused browser session)
npm run social:frames -- \
  --scene faceoff \
  --home TR \
  --away GR \
  --output social/output/tr-gr/

# Same, with explicit timeline settings (defaults: seed=42 fps=30 duration=4)
npm run social:frames -- \
  --scene faceoff --home TR --away GR --seed 42 --fps 30 --duration 4 \
  --output social/output/tr-vs-gr-faceoff/

# Validate a spec without launching a browser (fast, runs in CI)
npm run social:validate

# Validate any spec without rendering
npm run render-frame --workspace=@floodlight/social-video -- --dry-run --home BR --away AR

# Unit tests (schema + timeline + presets + CLI errors + browser frames)
npm run test --workspace=@floodlight/social-video
```

Output directories are created automatically. Generated media under
`social/output/` is gitignored — commit specs and code, never PNGs.

## Agent workflow: inspect before rendering

A single frame renders in seconds; a full sequence takes minutes.
Always inspect a few frames before rendering a whole video.

Recommended inspection frames for a 4 sec / 30 fps faceoff:

```text
0    wide establishing shot
30   players moving toward confrontation
60   face-to-face tension
90   camera tighter
119  final rivalry composition (leave headroom for text)
```

```bash
npm run social:frame -- --scene faceoff --home TR --away GR --frame 60 --output social/output/preview.png
```

`frame` is a deterministic random-access timeline position — no sequence
render is needed to preview it.

## Supported formats

```text
reel = 1080x1920 (9:16, pixelRatio 1)   ← the only format for now
```

## Supported scenes

```text
faceoff   Staged 4-second rivalry shot: players approach over the ball while
          the portrait camera dollies from wide establishing to a tight
          low-angle final composition. Ball stays centered; no simulation.
```

## Country codes

Any ISO code from the game's canonical country list. Common examples:

```text
TR GR BR AR DE FR
```

Do NOT assume or hardcode the list. Validation uses the game's country source
(`apps/game/src/city-league/countries.ts` via `countryTeams()` in `kits.ts`),
so kits always match live gameplay. Unknown codes fail loudly:

```text
Unknown country code: XX
```

## Rules for agents

- Prefer semantic scene presets (`scene`, `home`, `away`, `seed`, `fps`,
  `duration`, `frame`). Never hand-place players or cameras unless you are
  implementing a **new** preset.
- New presets belong in `src/scenes/<name>.ts` + `src/cameras/social-camera.ts`
  as pure functions of (compiled spec, frame); register the name in
  `src/schema.ts` and dispatch it in `src/timeline.ts`.
- Preserve deterministic rendering: no `Math.random()` / `Date.now()` /
  `performance.now()` in scene code — derive all variation from `seed`, all
  motion from `time = frame / fps` via `src/timeline/math.ts` helpers.
- Never animate with incremental mutation (`x += speed * dt`). Every frame
  must evaluate directly from time so `evaluateFrame(75)` works standalone.
- Reuse HNC game visuals (`GameRenderer`, `countryTeams`). Never duplicate kit
  colours or rebuild the stadium for social content.
- Keep the game untouched: renderer changes must stay backwards compatible
  (`new GameRenderer(container)` behaves exactly as before; the renderer
  receives final visual state and knows no timelines or frame indices).
- Sequence output dirs only ever contain `NNNNNN.png` plus your own files:
  `renderFramesToDir` clears stale frame PNGs first so mixed-length renders
  can never corrupt a future encode.
- After changes run: `npm run social:validate`, the workspace tests, and one
  real `social:frame` render; inspect the PNG before claiming success.
- Do NOT add: FFmpeg/MP4, audio, Remotion, MediaRecorder, timeline UI, backend
  integrations. Those are later phases.
