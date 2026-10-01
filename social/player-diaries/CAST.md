# HNC Player Diaries — cast bible (persistent identities)

Every person here is a **canonical HNC build**: `createHncPlayerVisual()` from
`@floodlight/hnc-visuals`, optionally re-proportioned (`applyHncProportions`)
and dressed (`applyHncWardrobe`). Blender only ever receives them through
`npm run blender:export` (fixtures in `tools/blender/src/interchange.ts`), and
every import is parity-inspected before it is rigged
(`tools/blender/py/hnc_blender/cine/cast.py`, `PEOPLE` maps canon id → looks).
Reels cast the adult players by `person` id (`packages/reels/src/cast/people.ts`).

| Canon id | Who | Build | Looks (asset ids) | Voice (fictional, synthetic: Kokoro timbre → Chatterbox delivery) |
|---|---|---|---|---|
| `TR-PLAYER-09` | Türkiye #9 (Reels person `emre`; unnamed on screen in Player Diaries) | adult, id 9 → skin 1 | `kit` hnc-player-tr-09 · `home` …--tee (bone tee) · `hoodie` …--hoodie (charcoal) · `interview` …--interview (dark tee) · `travel` …--travel (red team top) | `am_michael` ref · exaggeration 0.3, cfg 0.3 (calm, deliberate) |
| `TR-FAMILY-CHILD-01` | his child | **child proportions**, id 5 → skin 1 (Dad's skin) | `home` hnc-family-tr-child-01--tee (mustard tee) · `kit` …--kit (replica #9 shirt + jeans, from the evening on) | `af_bella` ref pitched ×1.24 · exaggeration 0.5 |
| `TR-FAMILY-PARTNER-01` | his partner | adult, id 6 → skin 2 | `home` hnc-family-tr-partner-01 (sage tee, brown hair, bun) | `bf_isabella` ref · exaggeration 0.3 (deadpan) |
| `TR-SUPPORTER-ELDER-01` | the bakery regular | adult, id 12 → skin 0, stoop in the rig | `home` hnc-supporter-tr-elder-01 (`elder` wardrobe: tweed jacket, TR scarf, flat cap, grey hair, moustache) | `bm_george` ref, pitch 0.9 · exaggeration 0.55 (0.85 on "Two!") |
| `TR-PLAYER-01-GK` | the training keeper | adult keeper kit | hnc-player-tr-01-keeper | — |
| `FAN-TR` / `FAN-BE` | matchday supporters | adult `fan` wardrobe | hnc-fan-tr · hnc-fan-be | — |
| `IT-PLAYER-08` | Italy #8, original fictional technical-rival midfielder | adult, id 8 → skin 0 | `kit` hnc-player-it-08 · canonical Italy-inspired blue/white treatment, number 8 | — |
| Interviewer | off camera, always | — | — | `af_heart` ref · exaggeration 0.45 |

## Personality (how they act — the rig makes it possible, this makes it right)

**TR #9** — calm, quietly confident, dry, observant, family-first, slightly
sarcastic, never performing. Humour through restraint: small pauses, a
half-smile that is a *body read* (eyes squint ~0.5, head tilts 1–3°, a
millimetre nod), side-eye (eyes move, the head doesn't), tiny posture
changes. He does not wave his arms, does not deliver punchlines, and never
stares into the lens (eyeline sits just off it — the interviewer). The world
around him is funnier than he is. When football starts he is a different
animal: lean, fast, violent hips through the ball, then nothing — he turns
away without celebrating.

**The child** — confident around Dad, unimpressed by celebrity, deadpan.
Doesn't blink when making a point. Points without looking at what he points
at. Wears Dad's #9 from the evening before the match.

**The partner** — dry, economical, affectionate by action (takes the coffee,
leans on the doorframe). Pauses before verdicts.

**The regular** — old-school supporter: stooped, slow, certain. Does not want
a selfie. Wants goals. Two of them.

## Proportions + wardrobe are canonical code

- Child: `packages/hnc-visuals/src/player/proportions.ts` (torso ×0.62/0.55,
  head ×0.84, limbs ×0.68/0.53 — reads as a child, not a small adult).
- New wardrobe pieces (`hair`, `cap`, `moustache`, `bun`, `stripeTrim`;
  looks `tee-bun`, `replica`, `elder`): `packages/hnc-visuals/src/player/wardrobe.ts`.
  The game never applies them; TR #9's verification GLB is byte-identical
  to before (sha256 `10dd3264…`).
