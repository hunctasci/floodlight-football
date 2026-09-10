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

## 3D placeholders (no binaries committed yet)

| Asset id | Wanted | Suggested source | License rule |
|---|---|---|---|
| office-worker-male-01/02, female-01/02 | Rigged low-poly office characters (Mixamo-compatible) | Sketchfab Store / CGTrader commercial, or Quaternius CC0 base + office attire | Commercial-use allowed; record author + license; attribution if required |
| office-modern-01 | Modern low-poly office environment | Sketchfab Store office pack / KayKit office | Same as above |
| office-desk/chair/monitor/laptop, coffee-cup/machine | Office props | KayKit / Quaternius CC0 props | CC0 preferred |
| anim idle/typing/sitting-idle/celebrate/side-eye/angry etc. | Mixamo-compatible skeletal clips | Mixamo (Adobe account) or CC0 motion packs | Verify redistribution; never commit NC clips |
| hnc-stadium | HNC stadium GLB (future) | Derived from in-repo procedural stadium (internal) | Internal |

## Import recipe

```bash
npm run reels:asset:import -- ./downloads/model.glb --id office-worker-male-01 --out packages/reels/public/assets/characters/office-worker-male-01.glb
```

Then update `src/assets/manifest.ts` (`bundled:true` + source/author/license)
and append a row above.
