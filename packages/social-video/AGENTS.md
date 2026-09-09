# HNC Social Video — agent interface

Generate HNC League social-media visuals/videos from the **actual game renderer**.
No editing UI exists on purpose: agents drive everything through semantic specs + CLI.

## Purpose

Deterministic TikTok / Reels / Shorts frames from the real HNC stadium, pitch,
player avatars, country kits and ball. Three.js is the implementation detail;
**semantic football scenes are the interface**.

Think in this vocabulary:

```text
FACEOFF · TURKEY · GREECE · SEED 42 · REEL
```

never in `THREE.Vector3` coordinates or camera FOVs.

## Commands

```bash
# Render one deterministic frame (primary command)
npm run social:frame -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff.png

# Same, with an explicit seed
npm run social:frame -- --scene faceoff --home TR --away GR --seed 42 --output social/output/tr-vs-gr-faceoff.png

# Validate a spec without launching a browser (fast, runs in CI)
npm run social:validate

# Validate any spec without rendering
npm run render-frame --workspace=@floodlight/social-video -- --dry-run --home BR --away AR

# Unit tests (schema + presets + CLI errors)
npm run test --workspace=@floodlight/social-video
```

Output directories are created automatically. Generated media under
`social/output/` is gitignored — commit specs and code, never PNGs.

## Supported formats

```text
reel = 1080x1920 (9:16, pixelRatio 1)   ← the only format for V1
```

## Supported scenes

```text
faceoff   Two staged players (home left/front, away right/back) facing each
          other over the ball, portrait cinematic camera, crowd behind.
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

- Prefer semantic scene presets (`scene`, `home`, `away`, `seed`). Never hand-place
  players or cameras unless you are implementing a **new** preset.
- New presets belong in `src/scenes/<name>.ts` + `src/cameras/social-camera.ts`
  as pure functions of the resolved spec; register the name in `src/schema.ts`.
- Preserve deterministic rendering: no `Math.random()` / `Date.now()` in scene
  code — derive all variation from `seed` (see `seededRandom()` in `faceoff.ts`).
- Reuse HNC game visuals (`GameRenderer`, `countryTeams`). Never duplicate kit
  colours or rebuild the stadium for social content.
- Keep the game untouched: renderer changes must stay backwards compatible
  (`new GameRenderer(container)` behaves exactly as before).
- After changes run: `npm run social:validate`, the workspace tests, and one
  real `social:frame` render; inspect the PNG before claiming success.
- Do NOT add: FFmpeg/MP4, audio, Remotion, MediaRecorder, timeline UI, backend
  integrations. Those are later phases.
