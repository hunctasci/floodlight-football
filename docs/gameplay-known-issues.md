# Gameplay known issues (post-P0)

The specialist pass (ADR-006, commit `d3fcca8`) resolved the reserved list:
magnetic possession, teleport claims, immunity windows, hidden shot spread
and automatic curl, RNG keeper disks and teleport bubbles, instant RNG
tackles, nearest-switching, through/cross buttons, stamina cliffs, and AI
ball-piling all removed, with acceptance suites in `tests/p0-*.test.ts`.
Mechanics: `docs/gameplay.md`. Sim tech: `docs/simulation.md`.

Genuine remaining limitations (not regressions):

- **Browser GPU pass outstanding:** sim-side p95 is 0.02 ms, but renderer
  cost (shadows, 22 avatars, DPR tiers, trail churn) was only reviewed, not
  profiled on device. Needs a real phone + laptop sweep, including the
  reported bottom-bar/safe-area interplay on some phones.
- **Aerial game is basic:** high balls, chips and headers work through the
  same contact gates (1.0–1.2 m); no elaborate crossing/header gameplay by
  design, but feel needs playtest confirmation.
- **AI set pieces:** corners/throw-ins use scripted placements; no wider
  routines, no offside/fouls/cards (all out of scope for P0).
- **Keeper edge cases:** 1v1 chip timing vs smother trigger, and sweeper
  restraint when already beaten, could use more match-hours.
- **Tuning is calibration, not law:** conversion rates (placed corners vs
  body shots), presser lunge rate, outlet spacing were set from fixtures +
  scripted matches. Human playtesting should move individual numbers inside
  `game/tuning.ts` — the systems underneath no longer need redesign.

Where to look: `apps/game/src/engine.ts` (systems table in
`docs/simulation.md`), `apps/game/src/game/tuning.ts` (values),
`apps/game/tests/p0-*.test.ts` (acceptance contracts).
