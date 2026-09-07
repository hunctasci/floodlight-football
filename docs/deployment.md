# Deployment

Three paths. Docker is for local parity / self-hosting only — it is never
required by the Cloudflare path.

## Client-only (Cloudflare game hosting, no backend)

The production game is static (`apps/game/dist/`, see `wrangler.jsonc`) hosted
on Cloudflare Workers Free as assets.

- Solo: entirely local (engine + renderer + input, no network).
- Multiplayer: WebRTC P2P deterministic match via **serverless invite links**
  (host creates an offer link, joiner opens it, reply code goes back — SDP
  travels by copy-paste/chat app, no server in the loop).
- PWA: installable, offline app shell (production service worker only).

This is the default: the game boots and plays even when every backend is down.
Backend-required features (room codes, leagues) report `SERVER UNREACHABLE`
instead of breaking local play.

## Node / self-host (Docker Compose)

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
- Dev without Docker: `npm run dev:game` (Vite `:5173`, falls back to
  `http://127.0.0.1:8080` for the server URL) and `npm run dev:server`
  (memory store; add `REDIS_URL=redis://localhost:6379` for the Redis path).

## Future Cloudflare-native coordination (not built)

For user-friendly rooms/matchmaking later, without changing the match itself:

```text
Browser → Cloudflare Worker → Durable Object (room membership, signaling, presence, transient coordination)
Browser → D1 (leagues, fixtures, results, rankings, profiles)
```

Match simulation/inputs stay WebRTC P2P unless future evidence justifies a
change. The current Node `RoomStore`/`LeagueStore` interfaces and the shared
`@floodlight/protocol` DTOs are the seam: a Worker/Durable-Object adapter can
implement the same room contract, and D1 can implement the same league
contract, with no protocol/domain-model break. No Supabase/Neon/Upstash/
Firebase or other hosted DB was added in this pass — no new provider is needed
today, and provider adapters stay optional.
