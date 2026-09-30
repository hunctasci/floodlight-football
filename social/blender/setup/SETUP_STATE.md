# HNC Blender pipeline — setup state

Idempotency checkpoint for the "Claude Code + Remotion + canonical HNC visuals + Blender +
Blender MCP" infrastructure brief. On rerun, read this file first.

Last updated: 2026-09-30 — **run 2 complete: all phases done; STOP condition reached.**
Awaiting owner review of `social/blender/verification/` before any creative/daily work.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 Preflight | ✅ | `preflight.md` (HEAD `b0a78be`, clean tree; run-2 addendum) |
| 1 Tooling audit | ✅ | `environment.json` |
| 2 Official Blender Lab MCP | ✅ configured (local scope), Connected | `environment.json` → `blenderMcp` |
| 3 Prove MCP control | ✅ create → read back → delete `HNC_MCP_CONNECTION_TEST` | `mcp-verification.json` |
| 4 Remotion Claude tooling | ✅ official `remotion@remotion` plugin 4.0.530, local scope | `environment.json` → `remotionClaudeTooling` |
| 5 Canonical audit | ✅ game → hnc-visuals ← reels confirmed; TR kit from `apps/game/src/city-league/country-colors.ts` | README "Interchange contract" |
| 6–10 Interchange + export + manifest + command | ✅ `npm run blender:export` (deterministic, byte-identical GLBs) | `generated/manifest.json` |
| 11–12 MCP import + inspection | ✅ via MCP into a new `HNC_Parity` scene; 237/237 checks | `verification/parity-report.json` |
| 13–16 Base scene, presets, cameras, lights, renders | ✅ 01/02/03 stills + 04 turntable | `verification/renders/` |
| 17–18 Visual inspection / flat shading | ✅ inspected; flat faces preserved; colour pipeline fixed (Khronos PBR Neutral) | README "Rendering and colour" |
| 19–20 Organisation + base library | ✅ | `library/hnc-cinematic-base.blend` (generated) |
| 21–22 Hybrid boundary + animation needs | ✅ design only | `../HYBRID_RENDERER.md` |
| 23 Headless render | ✅ `blender -b hnc-parity.blend -f 1` exit 0 | `verification/headless-*-render-test.json` |
| 24 Root commands | ✅ `blender:export`, `blender:build`, `blender:verify`, `blender:render:test` | `package.json` |
| 25 Setup doc | ✅ | `../README.md` |
| 26 Tests | ✅ existing suites unchanged-green + 8 new interchange tests | final report |

## On rerun (nothing to reinstall)

1. `claude mcp get blender` → `Scope: Local config`, `Status: ✔ Connected`;
   Blender GUI running (`lsof -nP -iTCP:9876 -sTCP:LISTEN`).
2. `claude plugin list` shows `remotion@remotion` (local, enabled).
3. `npm run blender:export && npm run blender:build && npm run blender:verify && npm run blender:render:test`
   — all exit 0. If `blender:verify` reports drift/stale, re-export + rebuild; do not edit files.
4. Only continue past this point with a new brief (daily-content migration).

## Files created/changed

Source / config (repository):

| Path | Change |
|---|---|
| `package.json` | + 4 `blender:*` scripts; root devDependencies `esbuild` 0.28.2, `playwright` 1.63.0, `tsx` 4.23.13 (versions already installed) |
| `package-lock.json` | + 3 lines (root devDependency declarations only; no version changes) |
| `.gitignore` | ignore `social/blender/generated/`, `verification/renders/`, `*.blend(1)`, `__pycache__/` |
| `tools/blender/export.ts` | `blender:export` CLI (esbuild bundle → headless Chromium → GLB/textures/manifest) |
| `tools/blender/blender.ts` | `blender:build / verify / render-test` CLI |
| `tools/blender/src/interchange.ts` | canonical factories → named export clones (single coordinate/flat-shading contract) |
| `tools/blender/src/browser-entry.ts` | in-browser GLTFExporter run |
| `tools/blender/src/glb.ts` | minimal GLB reader (tests + texture extraction) |
| `tools/blender/src/paths.ts` | repo paths, write guard, Blender discovery (no machine paths) |
| `tools/blender/tests/interchange.test.ts` | 8 tests (naming, sides, geometry reuse, flat normals, materials, ball, drift, GLB textures) |
| `tools/blender/tsconfig.json` | typecheck config |
| `tools/blender/py/hnc_cli.py` | headless entry (`build`, `inspect`, `render [--turntable]`) |
| `tools/blender/py/hnc_blender/{__init__,paths,interchange,scene,inspect_parity,render}.py` | shared bpy package (CLI + MCP) |
| `social/blender/README.md`, `social/blender/HYBRID_RENDERER.md` | docs |
| `social/blender/setup/*` | setup evidence |

Machine-local (not in the repo): `~/.claude.json` local MCP entry `blender`; local-scope
plugin marketplace `remotion` + plugin `remotion@remotion`; official MCP checkout in the
HNC tools directory outside the repo.

Not modified: `packages/hnc-visuals`, `packages/reels`, `apps/game` (read only).
