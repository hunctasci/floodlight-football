# HNC Reel Factory — asset sources & provenance

All binary 3D/audio assets must be recorded here before they ship.
Procedural placeholders keep every template renderable today; licensed
binaries slot in via `src/assets/manifest.ts` without touching story code.

## Policy

- 3D characters/environments/props: prefer CC0 or commercial-licensed low-poly
  packs (e.g. Sketchfab Store commercial license, Quaternius CC0, KayKit CC0/paid).
- Animations: Mixamo (free with Adobe account; check redistribution terms per
  project — prefer re-targeted CC0 packs for shipped binaries).
- Audio crowd: Freesound CC0 only (provenance below, reused from social-video).
- NEVER commit YouTube/TV/broadcast rips, EA/FIFA assets, or NC-licensed work
  for promotional content.
- Every new binary extends this file with source/author/license/attribution.

## Reused from packages/social-video (already vendored, CC0)

Real-crowd recordings live in `packages/social-video/assets/audio/crowd/` and are
single-sourced into this package via the symlink
`packages/reels/public/assets/audio/crowd -> packages/social-video/assets/audio/crowd`
(no binary duplication; Remotion serves symlinked public files — verified).
The manifest registers all 8 clips as bundled CC0 entries.

- `stadium-bed-01/02` — BeeProductive 395592 (CC0)
- `anticipation-01` — D.jones 528799 excerpt (CC0)
- `anticipation-02`, `goal-roar-02/03`, `disappointment-01` — ckater 353418 (CC0)
- `goal-roar-01` — D.jones 528799 eruption (CC0)

Full provenance: `packages/social-video/assets/audio/SOURCES.md`.
The Reel Factory references these semantically (`goal-roar`, `crowd-bed`);
copy or symlink them into `packages/reels/public/assets/audio/` when a
composition needs audible `<Audio>` (procedural cues render silent-safe today).

## Brand (single-sourced from the game)

`public/assets/brand -> apps/game/public/icons` (directory symlink, no binary
duplication). Asset id `hnc-logo` resolves to `brand/hnc-retro-v2.png`.
It must be a DIRECTORY symlink: Remotion's static server lstat()s the
requested path and 404s any file that is itself a symlink.

## Generated SFX stems (not committed)

`public/generated/<content-id>-sfx.wav` is rebuilt by `reels:render` for every piece. Sound = the game's own arcade synth recipes
(`apps/game/src/audio/audio.ts`) replayed offline by
`packages/social-video/src/audio/render.ts`; seeded, byte-deterministic.
Internal, no third-party material.

## Procedural (internal, no third-party material)

* Characters, office, studio, phone UI, title plates: HNC low-poly geometry
  (`@floodlight/hnc-visuals` + `src/worlds/*`), canvas-painted textures
  (flags use the platform's emoji font).
* Social sketch sounds (room tones, typing, UI pings, risers, record
  scratch, flicker, bloom, zip, news stinger): synthesised in
  `src/audio/social-synth.ts`, seeded and byte-deterministic.

## Import recipe

```bash
npm run reels:asset:import -- ./downloads/model.glb --id office-worker-male-01 --out packages/reels/public/assets/characters/office-worker-male-01.glb
```

Then update `src/assets/manifest.ts` (`bundled:true` + source/author/license)
and append a row above.
