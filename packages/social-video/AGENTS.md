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

# Unit tests (schema + timeline + presets + overlays + CLI errors + browser frames)
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

Recommended inspection frames for a default 9.5 sec / 30 fps attack-goal
(285 frames):

```text
0     broadcast-wide establishment (ball with the midfielder, goal readable)
36    first pass release (t=1.2)
50    first pass travelling
66    receiver catches the wide ball (t=2.2)
140   shooter settling the final ball, keeper set (t=4.67)
170   shot flying, keeper diving  ← the money frame, check this first
180   ball inside the net
240   celebration (t=8.0)
284   final hero frame (leave headroom for text)
```

```bash
npm run social:frame -- --scene attack-goal --home TR --away GR --frame 170 --output social/output/preview.png
```

`frame` is a deterministic random-access timeline position — no sequence
render is needed to preview it.

## Overlay concepts

Finished social creative ships as deterministic HTML/CSS layers over the
Three.js canvas (`render(spec, frame) = Three.js frame + overlay frame`).
Overlay state is evaluated purely from (spec, frame) — no CSS animations,
no wall clocks — so any frame renders standalone.

Semantic overlay kinds (styling is owned by the system, never the spec):

```text
versus    country rivalry title (stacked card on faceoff, strip on attack-goal)
headline  marketing line (PICK A SIDE / EVERY WIN COUNTS by default)
goal      country-specific goal punch (TÜRKIYE SCORES!)
cta       end-card call to action (PLAY FOR YOUR COUNTRY by default)
brand     HNC lockup + hncleague.com (logo file when valid, styled text otherwise)
```

Spec fields are copy-only, never CSS:

```bash
# Custom copy (plain text, max 48/80/48 chars for headline/secondary/cta)
npm run social:frame -- \
  --scene attack-goal \
  --home TR \
  --away GR \
  --headline "ONE WIN FROM #1" \
  --cta "PLAY FOR TÜRKİYE" \
  --frame 170 \
  --output social/output/preview.png
```

```bash
# Clean 3D without marketing layers (reproduces the pre-overlay output)
npm run social:frame -- --scene faceoff --home TR --away GR --no-overlays --output social/output/clean.png
```

## Render final video

Full deterministic pipeline (frames + SFX/ambience + H.264/AAC encode):

```bash
npm run social:render -- \
  --scene attack-goal \
  --home TR \
  --away GR \
  --seed 42 \
  --output social/output/tr-vs-gr.mp4
```

Produces `1080x1920`, spec FPS, H.264 + AAC with faststart. Temp PNGs are
deleted unless `--keep-frames` (kept at `<output>.frames/`); refuses to
overwrite without `--force`. Audio is synthesized offline from semantic
scene beats (kick/pass/shot/goal/crowd + ambience) — no browser recording.

## Add music

```bash
npm run social:render -- \
  --scene attack-goal \
  --home TR \
  --away GR \
  --music ./my-track.mp3 \
  --output social/output/tr-vs-gr.mp4
```

Music is mixed underneath the SFX (`--music-volume 0.25` default, 0–1),
trimmed/faded to the clip. Never commit supplied music. No music bundled.

## Recommended workflow

```text
1. render individual preview frames
2. inspect overlays/action
3. render full MP4
4. inspect audio sync
```

Do not render the whole video repeatedly while tuning one frame.

## Production Reel template

One command renders the finished 15.5s country-rivalry Reel (faceoff intro →
full 9.5s attack-goal → branded CTA outro, 465 frames at 30fps):

```bash
npm run social:render -- \
  --template country-rivalry-reel \
  --home TR \
  --away GR \
  --seed 42 \
  --output social/output/tr-vs-gr-reel.mp4
```

Preview template frames first (same frame indices as the MP4 timeline):

```bash
npm run social:frame -- --template country-rivalry-reel --home TR --away GR --frame 10 --output social/output/preview.png
```

Useful template frames: `10` rivalry title, `89` faceoff final, `100`
attack establish, `270` goal, `320` celebration headline, `390` CTA+brand.
Only `country-rivalry-reel` exists — do not invent other template names.
`--scene` and `--template` are mutually exclusive; the template fixes its
own duration (15.5s). Custom `--headline` reaches the celebration (not the
intro title); custom `--cta` reaches the outro end card.

## Production trailer (world-league-hero)

One command renders the finished ~17.6s World League hero trailer
(54-shot montage across three country matchups, 1056 frames at 60fps):

```bash
npm run social:render -- \
  --trailer world-league-hero \
  --countries TR,GR,BR,AR,DE,FR \
  --seed 42 \
  --output social/output/world-league-hero.mp4
```

AI supplies only `trailer` + `countries` (6 codes = 3 matchups) + `seed`.
Shot timecodes, source excerpts, cameras and copy are internal director
decisions (`src/trailers/presets.ts`) — never pass them. The trailer fixes
its own duration (17.6s) and defaults to 60 FPS. `--scene` / `--template` /
`--trailer` are mutually exclusive.

```bash
# Preview trailer frames first (same frame indices as the MP4 timeline)
npm run social:frame -- --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR --seed 42 --frame 284 --output social/output/preview.png

# Full 54-shot storyboard (one PNG per shot midpoint, one browser session)
npm run social:trailer-board -- --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR --seed 42 --output social/output/storyboards/world-league-hero/
```

Useful trailer frames: `12` TR portrait hook, `122` duel-chase,
`284` header hero, `447` crossbar clang, `601` glove save,
`689` keeper despair, `1013` brand payoff. Only `world-league-hero`
exists — do not invent other trailer names.

## Agent prompt example

```text
Create a Turkey vs Greece country-rivalry-reel.

Turkey should attack using a counter.

Use seed 42.

Headline:
EVERY WIN COUNTS

CTA:
PLAY FOR YOUR COUNTRY
```

maps to:

```bash
npm run social:render -- \
  --template country-rivalry-reel \
  --home TR \
  --away GR \
  --attack-style counter \
  --seed 42 \
  --headline "EVERY WIN COUNTS" \
  --cta "PLAY FOR YOUR COUNTRY" \
  --output social/output/tr-vs-gr-reel.mp4
```

Recommended workflow:

```text
1. Pick matchup
2. Render key preview frames
3. Adjust headline/CTA/attack style/seed
4. Render full Reel
5. Watch MP4
6. If good, publish
```

Recommended overlay inspection frames (check copy + safe zones first):

```text
faceoff (4s/30fps):                15  45  90  119
attack-goal (9.5s/30fps):          30  170  180  240  262  284
cross-header-goal (8s/60fps):      120  250  290  330  360  420
crossbar-chaos (9.5s/60fps):       150  270  420  500  540
keeper-disaster (10.5s/60fps):     150  330  420  480  580  620
```

Country names/flags in `versus`/`goal` copy derive from the canonical game
country data (`apps/game/src/city-league/countries.ts`); uppercase uses the
default locale, so canonical "Türkiye" renders "TÜRKIYE". The brand logo
resolves to `apps/game/public/icons/hnc-retro-v2.png` and is pixel-validated
at harness boot — see `src/overlays/render-dom.ts`.

## Supported formats

```text
reel = 1080x1920 (9:16, pixelRatio 1)   ← the only format for now
```

## Supported scenes

```text
faceoff   Staged 4-second rivalry shot: players approach over the ball while
          the portrait camera dollies from wide establishing to a tight
          low-angle final composition. Ball stays centered; no simulation.

attack-goal   Scripted 9.5-second readable football (default): broadcast-wide
          establishment → pass → carry → final ball → settle → shot → keeper
          dive → goal → celebration, staged with real HNC entities and
          canonical kits. Semantic options only:
          --attack-team home|away (default home),
          --attack-style central|wing|counter (default central).
          No coordinates in the spec — never invent positions.

cross-header-goal   8-second arcade header, cut for readability: midfield
          pass wide → winger carry → whipped cross (held camera through the
          first flight, ball-near-lens insert) → wide-goal header setup with
          striker/defender/keeper/ball/goal ALL in frame → impact → one strong
          goal angle → eruption. Production: 60fps.

crossbar-chaos   9.5-second comedy: wide buildup → long shot → CLANG off the
          bar (false-dawn eruption) → ONE held wide-goal camera for the whole
          rebound (ball up, keeper stranded, scramble, poacher arriving) →
          rebound volley → goal (double eruption). Production: 60fps.

keeper-disaster   10.5-second comedy with a hero beat: wide attack → shot +
          INCREDIBLE SAVE → held reaction (keeper gets up proudly) → bad
          clearance travels DIRECTLY to the poacher on one readable camera →
          instant shot → goal → keeper despair. Production: 60fps.
```

## Editorial philosophy (readability milestone)

The social cut is paced so a first-time viewer can narrate the football:

```text
UNDERSTAND → ANTICIPATE → IMPACT → REACT
```

- Information cameras (broadcast-wide / broadcast-medium / high-sideline /
  far-touchline / wide-goal) cover ~65–75% of action scenes; cinematic
  inserts are reserved for impact, keeper reactions and celebration.
- Shots hold 1.5–2.5s during normal movement; sub-second cuts only for
  impact punches and the ball-near-lens insert. Cuts never follow every
  pass — actions happen INSIDE the frame.
- Every action scene opens with a ≥1.5s establishing shot and closes with
  a ≥1s reaction; dedicated flight tracking keeps the ball in frame for the
  whole flight (ball-in-frame and goal-in-frame are test-enforced via
  `tests/editorial.test.ts` and `tests/camera-presets.test.ts`).
- The 180-degree rule: consecutive information shots never flip the attack
  screen direction (enforced by the same tests).
- Camera cut counts are budgeted per scene (cross-header 8, crossbar 7,
  keeper 8, attack 6) — see the scene shot tables
  (`CROSS_HEADER_SHOTS`, `CROSSBAR_SHOTS`, `KEEPER_SHOTS`, `ATTACK_SHOTS`).
  Do not add tiny camera segments without updating those tables and the
  editorial budgets.

## Frame rates

```text
faceoff:              30 FPS is fine (slow dolly, breathing only)
high-action scenes:   60 FPS recommended (attack-goal, cross-header-goal,
                      crossbar-chaos, keeper-disaster)
```

30fps strobes on driven shots and 1:1 ball-follow cameras (the ball covers
1m+ per frame with no motion blur); 60fps halves every step and reads
clearly smoother on mobile. Camera shake and all motion are time-based, so
the same moment renders identically at either rate — only the sampling
density changes. Previews/tests may still use 30fps for speed; production
MP4s for the four action scenes should pass `--fps 60` (and the Reel
template renders great at 60 too).

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
- New overlay Kinds are out of scope (the set is versus/headline/goal/cta/
  brand); scene code owns overlay TIMING via `src/overlays/presets.ts`,
  the DOM renderer owns styling via `src/overlays/render-dom.ts` +
  `src/overlays/styles.css`. Never expose CSS/HTML in the spec, never use
  `innerHTML` for copy (use `textContent`), never add CSS animations or
  transitions as a timeline source.
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
- Audio rules: scene code decides WHAT/WHEN/INTENSITY via `compileAudioPlan`
  (semantic `AudioEvent[]` + `assetId` variant pins); `src/audio/mix.ts`
  decides WHICH ASSET/HOW LOUD/PAN/MIX. Crowd recordings live in
  `assets/audio/crowd/` (provenance in `assets/audio/SOURCES.md`) — never
  add YouTube/broadcast/commercial audio. Arcade impacts (kick/shot/header/
  bar/save) stay procedural by design. Debug flags: `--audio-plan` prints
  the event timeline, `--crowd-mode procedural` forces the legacy synth
  for A/B comparison (default `real`).
- Do NOT add: Remotion, MediaRecorder, timeline UI, backend
  integrations.
