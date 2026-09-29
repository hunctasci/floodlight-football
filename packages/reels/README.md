# @floodlight/reels — HNC Reel Factory

Semantic, deterministic, reusable Instagram Reels / TikToks / YouTube Shorts
factory built on **Remotion + React + Three.js / R3F + @remotion/three**.

Agents describe WHAT they want (`office`, `side-eye`, `cloud-puff`,
`crossbar-chaos`); presets own coordinates, cameras, asset paths and frame math.

## Quick start

```bash
# Studio preview
npm run reels:studio

# Validate without rendering
npm run reels:validate -- --template office-rivalry --home TR --away GR --seed 42

# Stills (deterministic frames)
npm run reels:still -- --composition OfficeRivalry --frame 200 --output social/output/still.png

# Full renders (1080x1920 MP4, H.264 + AAC)
npm run reels:render -- --template hnc-hero --home TR --away GR --seed 42 --output social/output/hnc-hero.mp4
npm run reels:render -- --template country-rivalry --home TR --away GR --seed 42 --output social/output/tr-gr.mp4
npm run reels:render -- --template office-rivalry --home TR --away GR --seed 42 --football-moment crossbar-chaos --output social/output/tr-gr-office.mp4

# Tests / typecheck
npm run reels:test
npm run build --workspace=@floodlight/reels
```

## Architecture

```text
TemplateInput (semantic JSON/TS)
  -> StoryCompiler (director/compile-story.ts)
  -> ReelSpec (reel/types.ts, semantic beats)
  -> ShotPlan (reel/compile.ts, concrete frames)
  -> Remotion composition (compositions/ReelComposition.tsx)
     -> Stage3D (stages/) + Actor + CameraRig + graphics + transitions + effects + AudioTrack
```

- `src/reel/` — ReelSpec DSL, schema/validation, compiler, production validator.
- `src/director/` — story compiler + `stories/office-rivalry.ts`, `country-rivalry.ts`.
- `src/stages/` — reusable worlds (`office`, `football`, `studio`, `generic`) with semantic anchors (`desk-left`, `faceoff-home`...).
- `src/actors/` — `Actor` + procedural `HumanActor` / `HncFootballer`; GLBs slot in via manifest.
- `src/animation/` — semantic ids (`side-eye`, `celebrate`...), absolute sampling (`sampleAnimation(frame)`), easing.
- `src/cameras/` — semantic presets (`close-reaction`, `football-broadcast`...), frame-derived poses.
- `src/transitions/` — registry + `cloud-puff` hero transition (deterministic seeded SVG).
- `src/effects/` — deterministic overlays + `@react-three/postprocessing` integration point.
- `src/graphics/` — Headline/Caption/Leaderboard/Versus/MemeText/ChatBubble/CTA/Brand (1080x1920 safe-zoned).
- `src/audio/` — semantic cues (`goal-roar`, `poof`...), Remotion `<AudioTrack>`, mix helpers. Real crowd files reused from social-video; impacts stay procedural.
- `src/assets/` — manifest/registry/validation + `loaders/gltf.ts` (Drei cache + Suspense fallback) + `scripts/import-glb.ts` (glTF Transform).
- `src/football/` — canonical country re-export (no duplication), HNC branding, choreography adapter, `FootballMoment` (faceoff/attack-goal/crossbar-chaos/keeper-disaster/cross-header-goal).
- `src/utils/` — keyed RNG (`rng(seed, key)`), pure math.

## ReelSpec

See `src/reel/types.ts`. Key rules:

- `format` is `instagram-reel | tiktok | youtube-short` (all 1080x1920 today).
- `fps` is `30 | 60` (prefer 60 for high-motion football).
- `beats` sum must equal `durationInSeconds`.
- Beats are semantic (`hook`, `payoff`, `cta`...); coordinates never appear.

## Templates

- `office-rivalry` (16s): hook -> setup -> reveal (leaderboard) -> reaction (side-eye) -> escalation (dramatic-push) -> cloud-puff transition -> football payoff -> punchline -> CTA.
- `country-rivalry` (15.5s): faceoff hook -> football payoff -> CTA/brand.
- `hnc-hero` (12s, **60fps**, composition `HncHeroReel`): the HNC League hero trailer.
  One continuous `hero-attack` choreography covered by ten shots — floodlights
  hook -> depth-stacked faceoff -> burst -> leading-camera duel + hurdle ->
  approach -> speed-ramped wind-up + shot -> reverse-angle goal -> celebration ->
  World Table climb -> brand card. Defined in `src/director/stories/hnc-hero.ts`.

### Trailer building blocks (reusable)

- **Moment clocks** (`momentClock` on a beat): a shot plays a window of one
  longer choreography, optionally reshaped by a time ramp
  (`animation/time-ramp.ts`: `linear`, `anticipation-snap`). Shots sharing
  `to`/`from` boundaries cut inside one continuous action.
- **Game poses**: choreography actors may carry `pose` — routed through the
  canonical `applyHncGamePose` (run swing, kick, slide, dive, celebrations) plus
  small accents on the same joints (`crouch`, `windup`, `hop`, `airplane`,
  `reach`, `grounded`) in `football/adapter/pose.ts`.
- **Anchored camera moves** (`cameras/moves.ts`): lenses relative to semantic
  anchors (hero / rival / keeper / ball), eased between keys, optional anchor
  lag. Keys may name canonical `hncPresetLens` presets. IDs: `ball-rise-reveal`,
  `faceoff-depth-push`, `runner-burst`, `runner-lead`, `runner-approach`,
  `striker-windup`, `net-reverse`, `scorer-push`, `crane-out`, `stadium-drift`.
  `cameras/shot-camera.ts` is the single per-frame pose for the 3D rig AND 2D
  projections (`cameras/project.ts`).
- **Cinematic effects** (`effects/cinematic.tsx` + camera-space presets):
  `lights-on`, `cinebars` (game .cinebar), `ball-trail`, `impact-burst`,
  `impact-shake`, `zoom-punch`, `stadium-grade` (game menu backdrop).
- **Game-UI graphics** (tokens mirrored from the game CSS in `graphics/hnc-ui.ts`):
  `eyebrow`, `scoreboard` (in-game HUD, score flip), `goal-call` (game goal
  message), `world-table` (weekly World Table climb), `brand-reveal` (real badge
  + promise + site). Timings in `data` are global frames so an element can span
  shot cuts.
- **SFX stem** (`audio.sfxStem: true`): `reels:render` synthesizes procedural
  cues (kick, shot, whoosh, impact, goal-sting, brand-sting) with the game's
  arcade recipes (reused from social-video) into
  `public/generated/<spec-id>-sfx.wav`. Studio previews play crowd audio only
  unless a stem was rendered.

```bash
npm run reels:render -- --template office-rivalry --home TR --away GR --seed 42 --football-moment crossbar-chaos --output social/output/tr-gr-office.mp4
```

JSON inputs compile via `parseTemplateInput` (`reels/examples/*.json`).

## Adding things (semantic only)

- Environment: add GLB id to `assets/manifest.ts`, implement/extend a stage in `stages/`, expose anchors in `stages/registry.ts`.
- Actor: add model id to manifest + `actors/actor-registry.ts`; stories use `actor` + `anchor` + `animation`.
- Camera preset: add to `cameras/registry.ts` with base pose (+ optional `pushTo`).
- Transition: add id to `transitions/registry.ts` + coverage curve + renderer in `transitions/Transition.tsx`.
- Animation: add id to `animation/animation-registry.ts` (+ optional GLB asset id); pose via `sampleAnimation` + `proceduralPose`.
- Audio: add cue to `audio/registry.ts` (file or procedural); stories use `cue` + `startFrame`.
- GLB import: `npm run reels:asset:import -- ./downloads/model.glb --id <asset-id> --out public/assets/...`; record provenance in `assets/SOURCES.md`.

## Determinism

All visible motion derives from `(frame, fps, seed, props)` via `useCurrentFrame()`.
No `Date.now()`, `Math.random()`, or accumulated `mixer.update(delta)`.
Keyed RNG: `rng(seed, 'cloud-puff-4')` — unrelated additions never shift outputs.

## Render output

MP4, H.264 + AAC, 1080x1920, 30/60fps via Remotion CLI (FFmpeg inside Remotion).
`yuv420p`/faststart handled by Remotion defaults; verify with `ffprobe`.

## How AI agents should use this

See `AGENTS.md`. TL;DR: use templates, named actors/anchors/animations/cameras/effects/transitions; never hand-author coordinates, GLB paths, CSS, or unseeded randomness.

## Migration from social-video

`packages/social-video` (Playwright PNG + FFmpeg) is kept until the new
`country-rivalry` output is audited against the old `country-rivalry-reel`.
Reused: country data/kits, HNC branding, stadium/crowd concepts, football story
beats, audio catalogue/provenance, deterministic-seed discipline.
Replaced: custom timeline/render harness with Remotion + R3F.
