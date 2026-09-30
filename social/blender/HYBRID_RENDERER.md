# Hybrid renderer boundary

> **Update 2026-09-30 — implemented for "HNC: The Current".** The seam shipped in its minimal form:
> a 2D `plate` world (`packages/reels/src/worlds/plate/`) shows `public/generated/plates/<id>/####.png`
> frame-for-frame (camera impacts become transforms); plates come from `npm run blender:plates`
> with pose tracks baked from the canonical choreography (see README "Plates"). The richer
> contract below (content-hashed plate keys, auto renderer selection) remains future work.

(Original proposal follows.)

Status: **design only.** Nothing in `packages/reels` (ContentSpec, director, Timeline,
compositions) has been changed. This document fixes the vocabulary and contract for the
follow-up task that lets each shot choose its renderer.

Today: `ContentSpec → director/compile → Timeline { shots[], overlays[], audio } → Remotion`.
Every `Shot` (`packages/reels/src/engine/timeline/types.ts`) is rendered by an R3F `world`
(football, office, studio, phone, title…) inside the Remotion composition.

## The three modes

| Mode | Who renders the picture | Who owns time, copy, UI, audio, cuts | Best for |
|---|---|---|---|
| `remotion` (default) | R3F / Three.js inside the composition, from `@floodlight/hnc-visuals` | Remotion | football gameplay, HNC stadium, World Table, phones/UI, graphic sequences, fast procedural social content |
| `blender` | Blender renders the whole shot (plate = final picture for that shot) | Remotion places it on the timeline and adds nothing on top | richer environments where the shot *is* the image: office, apartment, airport, café, supermarket, street, practical lighting, object close-ups, physical props |
| `hybrid` | Blender renders a cinematic **plate** (image sequence, optionally with alpha / passes) | Remotion composites typography, overlays, HNC UI, transitions, sound, final assembly | a Blender environment/character plate with HNC graphics or UI on top |

Rules that hold in every mode:

1. **Character identity is single-sourced.** Blender only ever receives HNC characters and
   the ball through `npm run blender:export` (canonical factories → GLB). No mode may
   hand-author an HNC player.
2. **Remotion is the only timeline.** Durations, cuts, transitions, captions, audio and the
   final encode stay in Remotion; Blender never produces a finished social video.
3. **Deterministic plates.** A plate is a pure function of (shot description, generated asset
   hashes, Blender version); fixed samples/seeds, no wall-clock input.

## Proposed shot contract (for the next task)

Minimal extension of the compiled `Shot` — the director decides, worlds stay unaware:

```ts
type ShotRenderer = 'remotion' | 'blender' | 'hybrid';

interface Shot {
  // …existing fields…
  renderer?: ShotRenderer;          // default 'remotion' — every current spec keeps working
  plate?: BlenderPlateRef;          // required when renderer !== 'remotion'
}

interface BlenderPlateRef {
  /** Content-addressed key: hash(shot render description + asset sha256s + blender version). */
  key: string;
  /** Frames the plate covers, in the composition's fps (60 for reels). */
  frames: number;
  /** e.g. public/generated/plates/<key>/####.png — ignored output, rebuilt on demand. */
  sequence: string;
  alpha: boolean;                   // hybrid plates may need a transparent film
  colorspace: 'sRGB (Khronos PBR Neutral)';
}
```

The Blender side consumes a **render description** derived from the shot (set/world id,
camera intent → lens/position, actor tracks → poses per frame, looks → wardrobe), runs
headless (`blender -b … --python tools/blender/py/hnc_cli.py -- plate <description.json>`),
and writes the sequence plus a small plate manifest. Remotion shows plates with an
image-sequence layer (verify the exact Remotion API via the Remotion skills at
implementation time) and keeps overlays/audio exactly as today.

Caching: plates are keyed by content hash, so an unchanged shot never re-renders; a changed
canonical asset (new GLB sha256) invalidates exactly the plates that used it.

## What `blender` / `hybrid` shots still need (Phase 22 — deliberately not built)

The verification export is a **static, correctly named hierarchy** — enough for identity
parity, not yet for acting. To animate HNC characters in Blender without a second animation
system:

| Need | Recommended approach |
|---|---|
| Poses (idle, run, kick, celebrate, side-eye, office acting) | Do **not** re-implement poses in Python. Evaluate the canonical pose functions (`hncProceduralPose`, `applyHncBodyPose`, `applyHncGamePose`) per frame in the exporter and bake them to glTF animation channels on the named nodes (node TRS keyframes, no skinning). Blender imports them as actions; one source of motion truth. |
| Head turn / side-eye | Already structural: hair and eyes are children of `Head`, so baked head/eye rotations carry correctly. |
| Run / kick | Baked `Leg.*` / `Arm.*` pivot rotations + root translation from the same timeline the Remotion world uses (`actorState`). |
| Wardrobes (office, manager, fan…) | Export per-look variants through `applyHncWardrobe` on the export clone (extras become named meshes), asset id e.g. `hnc-player-tr-09--office-worker`. |
| Held props (mug, phone, cards) | `setHncHeldProp` on the export clone → named child of the hand/arm node. |
| Keeper | `keeper: true` fixture (kit colour already handled by the factory). |
| Multi-character shots | Unique prefixes are already in place (`TR09.*`, `GR04.*`). |
| Environments (office, café, airport…) | Authored in Blender as `SET_*` collections in library files — presentation only, never HNC characters. |

An armature is not required for any of this: HNC is rigid parts with pivots, which glTF node
animation represents exactly.

## Recommended next steps (describe, do not implement yet)

`StorySpec → ShotPlan → renderer selection → Blender / Remotion → final Remotion assembly`

1. **StorySpec** — what today's ContentSpec already is (cast, beats, copy, world choices);
   add an optional per-scene `renderer` hint, never required.
2. **ShotPlan** — the director's compiled `Shot[]` plus a *render description* per shot:
   camera lens/pose, actor pose tracks (sampled from `actorState`), looks, set id. Pure data,
   testable without a renderer.
3. **Renderer selection** — a small pure function in the director: explicit hint wins;
   otherwise `remotion` (football/UI/phones stay procedural and fast). Validation fails loudly
   when a shot asks for `blender` but its world has no Blender set yet.
4. **Blender plates** — `blender:plates` renders only missing/changed plate keys headlessly
   (EEVEE daily preset; Cycles on request), writing ignored output + plate manifests.
5. **Remotion assembly** — compositions render `remotion` shots as today, and `blender` /
   `hybrid` shots from their image sequences under the same overlays, transitions and audio;
   `reels:validate` / `reels:qa` gain a check that every non-remotion shot has a fresh plate.

Entry criteria for starting that work: the verification outputs in
`social/blender/verification/` have been reviewed and approved.
