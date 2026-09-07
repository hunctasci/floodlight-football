# Deployment

Three paths. Docker is for local parity / self-hosting only — it is never
required by the Cloudflare path.

## Cloudflare production (primary)

One Cloudflare application (`apps/game/`, see `wrangler.jsonc`): the Worker
serves the built game via Static Assets and the control-plane API from the
same origin.

```text
Browser ── same origin ──► Worker + Static Assets
  ├─ /               → game shell (SPA fallback)
  ├─ /api/health     → {status, service} (+ /healthz alias)
  ├─ POST /api/rooms → {roomCode, matchToken}
  └─ /api/rooms/:code/socket → RoomDurableObject (one DO per room)
```

- Solo: entirely local (engine + renderer + input, no network).
- Multiplayer: `CloudflareSignalingClient` coordinates rooms; the match
  itself runs WebRTC P2P lockstep (3-byte inputs, hashes, resync).
- Rooms: 6-char codes, 2 members max, ~2 h TTL (DO alarms), SQLite lifecycle
  rows only, hibernated sockets with attachments. No D1, no KV, no Redis.
- PWA: installable, offline app shell (production service worker only).

```sh
npm run dev:game        # frontend + Worker + local DOs (vite plugin, no Docker)
npm test                # all workspaces (game 142, server, protocol)
npm run cf:check --workspace=floodlight-football   # Worker typecheck
npm run build --workspace=floodlight-football      # client + Worker bundle
npm run deploy          # build + wrangler deploy
npx wrangler whoami     # check auth before deployment ops (never commit secrets)
```

This is the default: the game boots and plays even when every backend is down.
Backend-required features report `SERVER UNREACHABLE` instead of breaking
local play.

## Client-only (static, no backend)

Any static host serving `dist/client/` (see the vite build output): solo
play, PWA offline shell. No backend required. (Online needs the control
plane; manual SDP helpers remain in code for tests/debugging only.)

## Node / self-host reference (Docker Compose)

```text
Browser (Caddy :80/:443)
  ├─ /socket* → server:8080 (WS signaling)
  ├─ /api/*   → server:8080 (league REST)
  └─ /*        → /srv/game  (static build)

server ── Redis (rooms/presence/rate-limit, TTL)
server ── Postgres (leagues/fixtures/results, Drizzle)
```

Services: `server`, `redis`, `postgres`, `caddy` (see `docker-compose.yml`).

```sh
npm run build --workspace=floodlight-football  # game dist first (mounted ro into Caddy)
docker compose up -d
docker compose config        # validate
docker build -f apps/server/Dockerfile .  # server image (CI also builds this)
```

- Redis has a healthcheck (`redis-cli ping`); server has one (`/healthz`
  contains `"status":"ok"`); Caddy waits on server healthy, server waits on
  Redis + Postgres healthy. All containers `restart: unless-stopped`.
- Postgres persists in the `pgdata` volume; Redis is ephemeral by design
  (room loss on restart is acceptable, never history loss).
- Production: copy `.env.example` → `.env`, set a strong `POSTGRES_PASSWORD`
  (never ship `change-me-in-production`), set `CLIENT_ORIGIN` to your game
  origin (default `*` is dev-only), set `DOMAIN` for Caddy TLS
  (`DOMAIN=football.example.com docker compose up -d`).
- Dev without Docker: `npm run dev:game` (game + Worker + local DOs via the
  Cloudflare Vite plugin) and `npm run dev:server` (memory store; add
  `REDIS_URL=redis://localhost:6379` for the Redis path). Point the game's
  LEAGUE → SERVER setting at the Node URL to exercise the reference backend.

## Leagues / persistence (later)

Friend leagues, profiles, results, and rankings need durable storage and are
not built in this pass — that is when D1 enters, with its own ADR. No empty
schemas were created for them. The current Node `LeagueStore` and the shared
`@floodlight/protocol` DTOs are the seam a D1 adapter can implement later.
