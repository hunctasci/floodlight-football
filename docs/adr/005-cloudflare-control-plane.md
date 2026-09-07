# ADR-005: Cloudflare control plane + P2P data plane

## Status

Accepted. Implemented: Worker + per-room Durable Objects serve production
signaling; the Node backend is the self-hosted reference.

## Context

ADR-001 established P2P lockstep with a thin backend that only introduces
peers (rooms + SDP relay). The Node + Redis + Postgres backend served that
role, but it forces every deployment to run stateful infrastructure for what
is fundamentally ephemeral coordination: a 6-char code, two member ids, one
token, a handful of SDP messages, then nothing.

## Decision

Split the network into an explicit control plane and data plane:

- **Control plane (Cloudflare):** room creation, membership, SDP relay,
  presence. One Durable Object instance per room (`idFromName(code)`),
  SQLite for lifecycle rows only, WebSocket Hibernation with per-socket
  attachments (`{peerId, role, joinedAt}`), alarm-driven ~2 h TTL.
- **Data plane (WebRTC P2P):** InputFrames, hashes, snapshots, resync —
  unchanged lockstep, never routed through Cloudflare.
- **Simulation (browsers):** deterministic MatchEngine, unchanged.

No D1, no KV, no Redis, no accounts in this pass: V1 has no persistent data
to store. Rate limiting is best-effort per-isolate; stronger anti-abuse is
future work. The client speaks to Cloudflare by default and falls back to
the Node WS protocol when the page is served next to Node (self-host).

## Consequences

- Production is one Cloudflare application: same origin serves the game
  (Static Assets) and `/api/*` + per-room sockets. No CORS, no second origin.
- `apps/server` stays as the self-hosted/reference implementation with the
  same room semantics (codes, tokens, TTL, 2-player cap) — a seam, not dead
  code. Protocol shapes are mirrored, not forked.
- Durable Object storage must never become a match database: no gameplay
  state, no per-candidate writes. If future features need persistence
  (profiles, leagues, results), that is when D1 enters — with its own ADR.
