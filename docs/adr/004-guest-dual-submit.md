# ADR-004: Guest-first identity, dual-submit results

Date: 2026-09-06 · Status: accepted

## Context

The game promises no accounts. Leaderboards still need Sybil resistance
and score integrity without a login wall.

## Decision

- Identity: client-generated UUID stored locally; server treats it as opaque.
  `players` row created lazily, marked `upgradeable` for future accounts.
- Result integrity without accounts: room creation issues a `matchToken`
  (256-bit). Both peers POST their result with it; the server records only
  when both submissions agree (score, league, fixture), else `disputed`.
- Rate limits + match-token secrecy make farming costlier than playing.

## Consequences

+ Zero-friction onboarding preserved; leaderboard gaming requires winning
  real matches twice (once per side's submission).
− Determined colluders can still trade wins; acceptable for friend leagues.
  Server-reconciled scores arrive only with authoritative re-simulation
  (explicit non-goal: state hashes already exist for exactly this).
