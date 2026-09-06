# @retro/server

Thin signaling + rooms service for Retro Football online play. Match traffic
stays P2P (WebRTC lockstep in `apps/game/src/net/`); this service only
relays SDP, tracks rooms/presence, and rate-limits. Leagues, results and
leaderboards land here in F4b.

## Run

```sh
# dev (memory store, no Redis needed)
npm run dev --workspace=@retro/server

# with Redis
REDIS_URL=redis://localhost:6379 npm run dev --workspace=@retro/server

# production build
npm run build --workspace=@retro/server
npm start --workspace=@retro/server
```

Config: see `.env.example`. All settings are env vars with sane defaults.

## Protocol

WebSocket endpoint: `ws://host:8080/socket`. Every message is validated
with `@retro/protocol` zod schemas; malformed input gets `{t:'error'}`
and the connection survives.

| Client → Server | Server → Client |
|---|---|
| `create-room` | `room-created {roomCode, matchToken}` |
| `join-room` | `room-joined {peers}` + `peer-joined` to host |
| `signal {to, payload}` | `signaled {from, payload}` (member-only) |
| `leave-room` / close | `peer-left` to the remaining peer |
| `ping` | `pong` |

Health: `GET /healthz` → `{status, uptimeSec, redis}`.

## Design notes

- Rooms are ephemeral (TTL, default 2h); empty rooms are deleted, never listed.
- Rate limits are per-IP sliding windows in the store (Redis Lua/MULTI in prod).
- `RoomStore` is an interface: `MemoryStore` for tests/dev, `RedisStore` for prod.
- Match results are NOT accepted here yet (F4b, dual-submit + match tokens).
