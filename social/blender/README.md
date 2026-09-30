# HNC × Blender — production workspace

Blender is a **renderer** for HNC, never a source of truth. The HNC character and ball
are defined once in `@floodlight/hnc-visuals` (shared by the game and the Reel Factory).
This pipeline exports those exact THREE objects to GLB, imports them into Blender and
renders cinematic shots. Remotion stays responsible for timeline, copy, UI, audio and the
final assembly (see [`HYBRID_RENDERER.md`](HYBRID_RENDERER.md)).

```text
apps/game ──┐                         ┌── packages/reels (Remotion / R3F)
            └─► @floodlight/hnc-visuals ◄┘
                        │  createHncPlayerVisual() / createHncBallVisual()
                        ▼
      tools/blender/src/interchange.ts   (clone · name · flat-shading · provenance)
                        │  headless Chromium (real Canvas textures) + GLTFExporter
                        ▼
      social/blender/generated/*.glb + textures + manifest.json   (GENERATED)
                        │  tools/blender/py/hnc_blender/interchange.py (the ONLY import path)
                        ▼
      Blender 5.2 LTS scene ─► EEVEE (daily) / Cycles (hero) ─► PNG / MP4 plates
```

## Layout — source vs generated vs output

| Path | Kind | Committed |
|---|---|---|
| `tools/blender/` | **source** — exporter (TS), Blender package (Python), tests | yes |
| `social/blender/*.md`, `setup/*` | **source** — docs + setup evidence | yes |
| `social/blender/generated/` | **generated** — GLBs, baked textures, `manifest.json` | no (ignored) |
| `social/blender/library/hnc-cinematic-base.blend` | **generated** — reusable base scene | no (`*.blend` ignored) |
| `social/blender/verification/hnc-parity.blend`, `renders/` | **output** | no (ignored) |
| `social/blender/verification/*.json` | **output** — small parity / render-test reports | optional |

Everything generated is reproducible from the commands below; never edit it by hand.

## Commands (repository root)

| Command | What it does | Needs Blender |
|---|---|---|
| `npm run blender:export` | Canonical HNC → GLB + baked textures + manifest | no |
| `npm run blender:build` | Rebuild `hnc-parity.blend` + `hnc-cinematic-base.blend` headlessly (fails on parity mismatch) | yes |
| `npm run blender:verify` | Typecheck + interchange tests (incl. source-drift) + Blender parity inspection → `verification/parity-report.json` | yes |
| `npm run blender:render:test` | Plain `blender -b hnc-parity.blend -f 1` render → `renders/headless-eevee-0001.png` (add `-- --cycles` for a small Metal Cycles check) | yes |

| `npm run blender:plates -- --spec <id>` | Bake pose tracks from the canonical choreography, build + verify each plate scene headlessly, render PNG plates into `packages/reels/public/generated/plates/<plate>/` (`--only`, `--preview`, `--stills 1,48`, `--frames A-B`, `--bake-only`, `--save-blend`) | yes |

### Plates (hybrid shots for the Reel Factory)

A **plate** is a Blender-rendered shot the Reel Factory places with its `plate` world
(`packages/reels/src/worlds/plate/`): Remotion keeps time, cuts, text, fx and sound.

```text
TS plate spec (tools/blender/src/plates/<piece>.ts)      identities + choreography window / directed pose
   │  tools/blender/src/pose-track.ts                     canonical applyChoreoActor per frame → local TRS
   ▼                                                      of every export-named node + world probes
social/blender/generated/poses/<plate>.json
   │  hnc_cli.py plate → hnc_blender/plates.py            import GLBs, inspect parity (every identity),
   ▼                                                      keyframe (importer rule), verify probes
hnc_blender/plates_<piece>.py  (builder)  +  studio.py (anime studio kit: fog, beams, bokeh, pitch set,
   │                                                      aura shells, embers, pillar, Current strips, compositor)
   ▼
packages/reels/public/generated/plates/<plate>/0001.png…  (generated, ignored)
```

Rules: plates never re-implement poses (the bake runs the same pose code as the Remotion football
world); cast identities beyond the verification fixtures are exported as `purpose: 'cast'` (Nikos GR
#4, Petros GR #1 keeper, the canonical goal) and are parity-inspected when a plate imports them;
colours (the Current palette) and pitch dimensions (`HNC_PITCH`) travel inside the pose track.
Lookdev through the MCP uses the same `plates.build_plate` on a scene named `HNC_Plate_<id>`.

No Blender extensions are required: camera-attached/multiplane needs are a few lines of `bpy`
(reproducible in headless runs); Camera Plane, Frame By Plane, BagaPaste and Copy Attributes Menu
were evaluated for "HNC: The Current" and not installed.

Verification stills / turntable (on demand):

```sh
BL=/Applications/Blender.app/Contents/MacOS/Blender   # or $HNC_BLENDER_BIN
$BL -b social/blender/verification/hnc-parity.blend --python tools/blender/py/hnc_cli.py -- render               # 01–03 stills
$BL -b social/blender/verification/hnc-parity.blend --python tools/blender/py/hnc_cli.py -- render --turntable   # 04 MP4
```

After any change to `packages/hnc-visuals` or country colours: `blender:export` → `blender:build`
→ `blender:verify`. `blender:verify` fails when canonical sources changed since the last export
(drift) or when the `.blend` was built from older GLBs (stale).

## Local setup

1. **Blender 5.1+** (verified: **5.2.2 LTS**). Discovery order: `HNC_BLENDER_BIN` →
   `BLENDER_PATH` → `/Applications/Blender.app/Contents/MacOS/Blender` → `blender` on `PATH`.
   No machine path is committed.
2. **Official Blender Lab MCP** (Blender Authors — <https://projects.blender.org/lab/blender_mcp>,
   verified v1.0.3). Do **not** substitute community servers (`ahujasid/blender-mcp`,
   `teamipc/blender-mcp`, …): different protocols.
   Follow <https://www.blender.org/lab/mcp-server/> (requires Blender 5.1+):
   - Add-on: drag-and-drop the official repository and then the extension into Blender
     (gives update notifications), or download the ZIP and use *Install from Disk*. Enable it,
     keep auto-start on, and allow **online access** (Preferences → System → Network — the
     add-on refuses to start otherwise). It listens on `localhost:9876`.
   - Server (source install, used here): clone the official repository into an HNC tools
     directory outside this repo and run `uv sync` in its `mcp/` folder (entry point
     `blender-mcp`). Newer clients can instead use the `.mcpb` bundle from the release page.
3. **Connect Claude Code** (local scope — machine-specific, never in a shared `.mcp.json`):

   ```sh
   claude mcp add --scope local blender \
     -e BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender \
     -- uv --directory <hnc-tools>/blender_mcp/mcp run blender-mcp
   claude mcp get blender          # Scope: Local config · Status: ✔ Connected
   ```

   Start Blender (GUI) first; restart Claude Code after adding the server — the
   `mcp__blender__*` tools only appear in a new session.
4. **Remotion agent tooling** (official, local scope):
   `claude plugin marketplace add remotion-dev/claude-code-plugin --scope local` then
   `claude plugin install remotion@remotion --scope local` (bundles the Remotion Agent Skills).
5. `npm install` provides `esbuild` + `playwright` (headless Chromium for Canvas textures).

## Interactive workflow (Claude ↔ Blender MCP)

Claude runs the **same repository code** the CLI runs, never ad-hoc geometry:

```python
import sys, bpy; sys.path.insert(0, "<repo>/tools/blender/py")
import hnc_blender; hnc_blender.reload()
from hnc_blender import scene as S, inspect_parity as I
S.remove_generated_scene("HNC_Parity")          # only removes datablocks tagged hnc_generated
sc = bpy.data.scenes.new("HNC_Parity"); bpy.context.window.scene = sc
S.build_verification(sc, bpy.context); I.inspect_scene(sc)["pass"]
```

The user's own scenes are left untouched; `bpy.data.libraries.write(path, {sc})` saves only the HNC scene.

## Interchange contract

**Coordinates** — defined once, in `tools/blender/src/interchange.ts` (export) and
`tools/blender/py/hnc_blender/interchange.py` (import):

| Space | Up | Character front | Units | Transform |
|---|---|---|---|---|
| HNC / Three.js | +Y | +Z | metres, origin on the ground | canonical |
| GLB | +Y | +Z (glTF asset convention) | metres | **identity** — nothing is rotated |
| Blender | +Z | −Y (Blender “Front”) | metres | importer: `(x, y, z) → (x, −z, y)` |

No scene code may add `rotateX(π/2)`-style fixes; use `gltf_to_blender()` for maths.

**Names** — export clones get stable semantic names (`HNC_Player_TR_09`, `TR09.Body`,
`TR09.ChestStripe`, `TR09.ShirtNumber`, `TR09.Head` → `TR09.Hair`, `TR09.Eye.L/R`,
`TR09.Leg.L/R` → `TR09.Boot.L/R`, `TR09.Arm.L/R`, `TR09.Shorts`; `HNC_Ball` → `HNC_Ball.Leather`).
`.L/.R` are **anatomical** (Blender mirror convention): the canonical `legL`/`armL` sit at −X,
which is the character's *right* — each object carries its canonical handle in the `hncPart`
custom property, and the root carries country / number / id / keeper / kit / skin.

**Flat shading** — glTF has no `flatShading` flag and `GLTFExporter` writes smooth vertex
normals, which would round off the low-poly look. The exporter omits `NORMAL` on flat-shaded
parts (the glTF-spec way to request flat normals); Blender's importer marks those faces sharp
with no custom normals. The ball and unlit eyes/number keep their normals. Canonical geometry
is never modified — only export clones.

**Textures** — shirt numbers and the ball skin are painted with the browser Canvas API; in
Node they are 1×1 fallbacks. The exporter therefore runs the canonical factories in headless
Chromium, so GLBs embed the real 64×64 number and 256×128 ball PNGs. Copies land in
`generated/textures/` byte-identical to the GLB payload (stored in glTF UV orientation, i.e.
vertically flipped relative to the canvas). The number uses `bold 44px monospace` — the
same system-font dependency the game has; the manifest records the Chromium build.

**Excluded** — the canonical blob shadows (`visual.shadow`) are world-mounted game fakes;
Blender renders real shadows instead.

**Determinism** — GLBs are byte-identical across exports; `manifest.json` timestamps are
provenance only. Renders use fixed samples/seeds and never read time.

## Rendering and colour

- **Daily preset (saved default): EEVEE**, 1080×1920 portrait, 60 fps project, 64 samples,
  ray-traced shadows/reflections. Measured on the M4 Max: ~1.2–1.7 s per full-res frame.
- **Hero preset: Cycles** (256 adaptive samples, OIDN, seed 0) stored in the scene; select with
  `-E CYCLES` and force Metal with `-- --cycles-device METAL` (no preference edits). First
  Metal run compiles kernels (~2 min, cached); afterwards 540×960 @ 64 samples takes ~2 s.
- **View transform: Khronos PBR Neutral** for every shot. It shows glTF base colours as
  authored with soft highlight roll-off. AgX was evaluated and rejected (TR red → salmon);
  Standard clips. Three.js uses ACES Filmic at exposure 1.12 plus hemisphere lighting, so
  game and Blender pixels differ by design — identity (geometry, proportions, kit/skin/hair
  colours, number, ball, silhouette) is what matches. Canonical colours are never adjusted
  for Blender; presentation lives in Blender.
- Measured colour parity (`01-player-neutral`, front faces): kit `#e2101b` vs authored
  `#e30a17`, skin `#935229` vs `#985c3c`.

Scene conventions (`tools/blender/py/hnc_blender/scene.py`): subject at the origin facing −Y;
collections `HNC_Assets` (generated imports only), `SET_Ground`, `CAM_Rig`
(`CAM_Portrait_85mm` f/4, `CAM_FullBody_50mm`, `CAM_PlayerBall_35mm` f/5.6; 36 mm sensor on the
long side), `LGT_Cinematic` (key/fill/rim area lights), `LGT_Neutral` (sun + grey world).
The base library file contains no HNC assets — refresh assets with `blender:export` +
`blender:build` rather than editing a `.blend`.

## Security caveat

Official warning: *"The MCP server will execute LLM generated code in Blender without any
guards in place to protect your data from removal or being sent to a remote location."*
Treat it as trusted-but-dangerous (a VM or a machine without sensitive data is safest): MCP code in this project only calls `hnc_blender`, which
refuses writes outside the repository (`paths.inside_repo`), removes only datablocks tagged
`hnc_generated`, never deletes files, never touches credentials or other directories, and never
runs shell commands. Review any MCP code that does more before approving it.

## Troubleshooting the MCP connection

| Symptom | Check / fix |
|---|---|
| No `mcp__blender__*` tools in Claude | Restart Claude Code after `claude mcp add`; `claude mcp list` must show `blender … ✔ Connected`. |
| `claude mcp get blender` fails | `uv --directory <hnc-tools>/blender_mcp/mcp run blender-mcp` must start by hand; re-run `uv sync`. |
| Tools exist but calls time out / refuse | Blender GUI must be running with the `mcp` add-on enabled: `lsof -nP -iTCP:9876 -sTCP:LISTEN` should list Blender. |
| Add-on will not start | Preferences → System → Network → *Allow Online Access* must be on. |
| Wrong protocol / odd tool names | A community Blender MCP is configured; remove it and use the official Blender Lab server. |
| `hnc_blender` has no attribute `reload` | Stale modules in Blender's long-lived Python: delete `hnc_blender*` from `sys.modules` and re-import. |
