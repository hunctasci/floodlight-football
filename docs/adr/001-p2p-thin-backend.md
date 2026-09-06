# ADR-001: P2P lockstep sim + thin signaling backend

Date: 2026-09-06 · Status: accepted

## Context

Online 1v1 needs sub-100ms-fair gameplay between two browsers. Options:
(a) authoritative server simulating every match at 60Hz,
(b) P2P lockstep with a thin relay/signaling backend.

## Decision

P2P WebRTC lockstep (`apps/game/src/net/`), backend relays SDP only.
The sim is deterministic (fixed 1/60 step, seeded RNG, serializable state,
FNV-1a hashes), so peers exchange 3-byte inputs per tick and verify with
hashes; snapshots heal divergence.

## Consequences

+ Zero per-match server cost; latency is direct peer RTT, not server RTT.
+ Backend stays a cheap CRUD/relay tier (this service).
− No server-side cheat authority; mitigated in F4b with dual-submit results.
− NAT traversal needs STUN now, TURN later for symmetric NATs.
