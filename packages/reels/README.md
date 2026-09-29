# @floodlight/reels — HNC content engine

Semantic, deterministic social-content engine for HNC League, built on
Remotion + React Three Fiber and the canonical HNC visuals
(`@floodlight/hnc-visuals`). One **ContentSpec** renders as a 9:16 Reel,
Story, 4:5 or 1:1 post, and key-art stills.

- `AGENTS.md` — how to author content (start here)
- `docs/ARCHITECTURE.md` — audit, design, determinism, canonical changes
- `docs/VOCABULARY.md` — every world / lens / action / look / transition / effect / graphic / cue (generated)
- `docs/CONCEPTS.md` — concept bank

## Commands (from the repo root)

```bash
npm run reels:validate -- --content office-rivalry            # spec + framing/motion QA, all formats
npm run reels:qa       -- --content office-rivalry --sheet --cuts
npm run reels:still    -- --content office-rivalry --key thumb --format square
npm run reels:render   -- --content office-rivalry --format all          # MP4s in social/output/
npm run reels:render   -- --content packages/reels/specs/passed-you.json   # any JSON spec
npm run reels:vocab                                            # regenerate docs/VOCABULARY.md
npm run reels:studio                                           # Remotion Studio
npm run reels:test
```

Registered content: `office-rivalry`, `group-chat`, `breaking-news`, `hnc-hero`
(`src/content/`); JSON specs in `specs/`.

## Layout

```
src/engine/      spec types, timing grammar, director (compile + validate), QA, formats
src/worlds/      world definitions (pure) + scene components: football, office, studio, phone, title
src/cast/        actions, looks, cast state (pose/gaze/posture), countries
src/camera/      subject-relative lenses, moves, intent parsing, evaluation, projection
src/transitions/ registry + camera side (whip); render/Transitions.tsx draws them
src/graphics/    typography + HNC UI graphics (scoreboard, World Table, news package, notification…)
src/audio/       cue registry, social synth, stem renderer, Remotion track
src/render/      ContentComposition, ShotLayer, overlays, effects, layout
src/content/     registered ContentSpecs
```
