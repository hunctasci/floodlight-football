# ADR-006: P0 gameplay engine rebuild (deterministic, physical, readable)

Date: 2026-09-07. Status: accepted and implemented (`d3fcca8`).

## Context

The arcade foundation was sound (11v11, fixed-step seeded sim, P2P lockstep,
Cloudflare rooms, Three.js) but gameplay decided results opaquely: online
speed followed render rate, possession was magnetic (2.3 m receiver radius,
teleport claims, 450 ms immunity), shots carried hidden spread and automatic
curl, keepers saved via RNG disks and teleport bubbles, tackles rolled dice
instantly, and AI collapsed onto the ball. `docs/gameplay-known-issues.md
listed the symptoms; tuning could not fix architectural causes.

## Decision

Surgical rebuild inside the existing architecture, in dependency order
(clock → movement/possession → passing → shooting → keeper → tackling →
shape), deleting each legacy system once its replacement proved out:

- One 60 Hz match clock for solo and online (cap 4 catch-up ticks, rebase
  deep debt); slow motion removed from sim time.
- Physical possession: discrete touches, swept contact, earliest-contact
  wins, meaningful first touch — no magnets, no immunity, no teleports.
- PASS tap = feet / hold = same-receiver lead; cost-ordered switch cycle.
- One shoot action (reticle placement + power) solved against real
  gravity/drag with a foot-contact gate; keeper reads ball physics only
  (reaction, one bounded dive, catch/parry, committed smothers).
- Geometry-decided tackling with per-tick slide sweeps; role-based AI shape
  (presser/cover/runner + hysteresis) with a keeper-distribution phase.
- Codec v2 + sim/input/tuning version negotiation; exact-once events;
  canonical snapshot/hash extended to all future-affecting state.

## Consequences

Net protocol bumped (`NET_PROTO = 2`): old clients fail the handshake
gracefully instead of desyncing. Match feel changes everywhere by design;
tests encoding removed behaviours were replaced, invariants kept. Engine
p95 0.02 ms — no perf work required sim-side. Preserved untouched:
Cloudflare rooms/invite/ICE flow, lockstep/delay/hash/snapshot design,
Three.js renderer, pitch/goals/restarts, seeded P2P model.
