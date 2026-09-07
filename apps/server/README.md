# @floodlight/server

Thin signaling + rooms service for Floodlight Football online play. Match traffic
stays P2P (WebRTC lockstep in `apps/game/src/net/`); this service only
relays SDP, tracks rooms/presence, and rate-limits. Leagues, results and
leaderboards land here in F4b.

## Run

```sh
# dev (memory store, no Redis needed)
npm run dev --workspace=@floodlight/server

# with Redis
REDIS_URL=redis://localhost:6379 npm run dev --workspace=@floodlight/server

# production build
npm run build --workspace=@floodlight/server
npm start --workspace=@floodlight/server
```

Config: see `.env.example`. All settings are env vars with sane defaults.

## Protocol

WebSocket endpoint: `ws://host:8080/socket`. Every message is validated
with `@floodlight/protocol` zod schemas; malformed input gets `{t:'error'}`
and the connection survives.

| Client → Server | Server → Client |
|---|---|
| `create-room` | `room-created {roomCode, matchToken}` |
| `join-room` | `room-joined {peers}` + `peer-joined` to host |
| `signal {to, payload}` | `signaled {from, payload}` (member-only) |
| `leave-room` / close | `peer-left` to the remaining peer |
| `ping` | `pong` |

Health: `GET /healthz` → `{status, uptimeSec, redis}`.

## Leagues (F4b REST)

Friend leagues with round-robin fixtures and dual-submit results (ADR-004).
DTOs live in `@floodlight/protocol`; output is re-validated before sending.

| Method | Path | Body → Result |
|---|---|---|
| POST | `/api/leagues` | `{name, clientId, displayName}` → `201 {id, code}` (creator seated) |
| POST | `/api/leagues/join` | `{code, clientId, displayName}` → `200 {id, code}` (lobby only) |
| GET | `/api/leagues/:code` | league + members + fixtures + standings |
| POST | `/api/leagues/:id/start` | `{clientId}` creator-only → round-robin fixtures |
| POST | `/api/fixtures/:id/submit` | `{clientId, homeScore, awayScore, matchToken}` → `pending` / `confirmed` / `disputed` |
| POST | `/api/fixtures/:id/resolve` | `{clientId, homeScore, awayScore}` creator ruling on disputes |

Errors: `400` bad body, `403` not creator / not a side, `404` unknown league/fixture,
`409` bad state (already started, solo start), `429` rate limited.

## Persistence

`DATABASE_URL` set → Postgres via Drizzle (`drizzle/0001_leagues.sql` applied on
boot, re-runnable). Unset → `MemoryLeagueStore` with a startup warning, mirroring
the rooms story: `LeagueStore` is an interface, tests stay hermetic.

## Design notes

- Rooms are ephemeral (TTL, default 2h); empty rooms are deleted, never listed.
- Rate limits are per-IP sliding windows in the store (Redis Lua/MULTI in prod).
- `RoomStore` is an interface: `MemoryStore` for tests/dev, `RedisStore` for prod.
- A fixture confirms only when home and away latest submissions agree; a clash
  flags it `disputed` for the creator to rule on. Standings count confirmed
  fixtures: 3/1/0, then GD, GF, name.
