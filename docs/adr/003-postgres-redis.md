# ADR-003: Postgres for cold data, Redis for hot data

Date: 2026-09-06 · Status: accepted

## Context

F4 needs rooms (ephemeral, TTL), presence, rate limits (hot, losable) plus
leagues/results/leaderboards (durable, queryable).

## Decision

- Redis: rooms (`room:{code}` JSON+TTL), presence heartbeats, sliding-window
  rate limits, leaderboard sorted sets (`lb:league:{id}`).
- Postgres (Drizzle, F4b): leagues, memberships, fixtures, results
  (match_id idempotency key), player profiles.
- `RoomStore` interface with `MemoryStore` (tests/dev) and `RedisStore`
  (prod) so nothing but the adapter knows Redis exists.

## Consequences

+ Right tool per temperature; no cache-as-truth (Redis loss only drops
  live rooms, never history).
+ Tests stay hermetic (injectable clock + memory store); Redis covered by
  one gated integration test + CI service job.
− Two datastores to operate; both are single-container defaults.
