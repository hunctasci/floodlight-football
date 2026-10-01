# THE SCORE WON'T LEAVE HIM ALONE — implementation handoff

## Existing systems to reuse

- Cut/runtime contract: `social/player-diaries/PIPELINE.md`; `packages/reels/src/diaries/edit.ts`; `packages/reels/src/diaries/PlayerDiaries.tsx`.
- Episode CLI/cache: `tools/diaries/diaries.ts`; shot context/episode lookup: `tools/blender/py/hnc_blender/diaries/shot.py`.
- Canonical export: `tools/blender/src/interchange.ts`; import/parity/rig: `tools/blender/py/hnc_blender/cine/cast.py`.
- Animation/performance: `tools/blender/py/hnc_blender/cine/anim.py`, `perform.py`, `football.py`; camera impact: `camera.py`.
- Look/render: `tools/blender/py/hnc_blender/cine/look.py`; props: `props.py`.

## New requirements

- Add canonical `IT-PLAYER-08` fixture/export and a `cast.py` `PEOPLE` mapping; use existing canonical factory/wardrobe only. No remodeling.
- Add one compact elevator/corridor set; none exists in `cine/sets/`.
- Add shot-local environmental number/display treatment and physical 3D typography. No generic typography helper exists.
- Hero score fracture/debris is new shot-specific work: deterministic controlled fracture/rigid-body, debris, internal light and dust. Do not implement in scaffold.
- Tactical board is a tiny new prop unless a later scoped search finds one.
- Café should first redress `bakery.py`, `home.py`, or `interview.py`; do not build a major set.

## Shot-builder mapping

- Alarm/breakfast: new episode builders reuse `home.bedroom`, `home.kitchen`, `props.digital_clock`, `props.pan`, `props.egg_*`, `props.carafe`, `props.mug`; espresso-machine/readout treatment is new/shot-local.
- Elevator/corridor/stairs: new compact set plus shot-local number/reflection staging.
- Car: reuse `car.build_interior`, `car.moving_world`/rig helpers; dashboard/radio exist, trip readout and HNC 14 plate are shot-local.
- Street: reuse `street.py` concepts/assets where useful; walking/parking/bus/building/plate motifs are shot-local staging, not a new city system.
- Bakery callback: reuse `bakery.bakery`, `TR-SUPPORTER-ELDER-01`, and `perform.glance`/`nod`/`point`.
- Football metaphor/aftermath: reuse `pitch.pitch`, canonical ball, `football.touch`/`strike`/`BallPath`, `camera.impact`; giant 1/4 obstacles and score destruction are new shot-local work.
- Reset/café/tunnel: new board prop plus reuse/redress decision above; reuse `tunnel.tunnel` and the `rivals/s10.py` two-player walk pattern.
- End: Remotion `screen`/end-card path in `PlayerDiaries.tsx`; no Blender plate needed.

## Character reuse

- `TR-PLAYER-09` reuses directly via `cast.py` existing kit/home mappings.
- Older supporter reuses `TR-SUPPORTER-ELDER-01` and existing exported GLB.
- `IT-PLAYER-08`: add `HNC_EXPORT_FIXTURES` player entry (IT, #8, canonical id/skin chosen by fixture convention), export with `npm run blender:export`, then add asset id/look mapping in `cast.py`. Add only required canonical wardrobe data in the visuals package.

## Props / sets

- Reuse: digital clock, pan, eggs, carafe/mug, car dashboard/radio, bakery, car, street primitives, pitch, ball, tunnel.
- New: elevator/corridor set; tactical board; giant physical score typography; likely espresso machine/readout and trip/parking/building/plate number treatments as shot-local props.
- No elevator/corridor or tactical-board helper was found in the scoped set/prop system.

## VFX requirements

- Reuse: emissive materials/display changes, glass/window reflections, `look.setup_render` volumetrics and motion blur, `camera.impact`, `pitch.net_bulge` precedent, deterministic `write_tracks`.
- New shot-specific: reflected-but-not-direct score, physical typography, giant obstacle animation, controlled fracture/rigid-body, debris/particles, internal crack light, dust, espresso `0–0` crema. No fireball.
- The recurring BUM + four ticks must be represented later as shared edit/audio cue data; this scaffold adds no sound design.

## Renderer split

- Blender: all character/set/prop plates, environmental discoveries, reflections, physical typography, football movement and future hero VFX.
- Remotion: final match/date/brand cards and any intentionally graphic overlays; `edit.json` remains the single cut source.

## Commands

- `npm run diaries -- check --episode italy-rematch`
- `npm run diaries -- storyboard --episode italy-rematch`
- `npm run diaries -- plates --episode italy-rematch --quality animatic --only Sxx_SHyy`
- `npm run diaries -- ui --episode italy-rematch`
- `npm run diaries -- audio --episode italy-rematch`
- `npm run diaries -- edit --episode italy-rematch --quality preview --out <mp4>`
- `npm run diaries -- master --episode italy-rematch --in <mp4> --out <mp4>`
- `npm run diaries -- sheet --episode italy-rematch --in <mp4> --out <png>`
- `npm run blender:export` (only after the canonical IT fixture exists)

## Constraints

- Do not alter the locked story; do not remodel canonical characters; reuse before building.
- `edit.json` is the cut source of truth. Render only changed shots via `--only`/cache.
- No render/audio/voice generation in this scaffold step. No commit or push.
