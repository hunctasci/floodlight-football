# Deployment

Three paths. Docker is for local parity / self-hosting only — it is never
required by the Cloudflare path.

## Cloudflare production (primary)

One Cloudflare application (`apps/game/`, see `wrangler.jsonc`): the Worker
serves the built game via Static Assets and the control-plane API from the
same origin.

```text
Browser ── same origin ──► Worker + Static Assets
  ├─ /               → game shell (SPA fallback, incl. /friend/:code)
  ├─ /api/health     → {status, service} (+ /healthz alias)
  ├─ POST /api/rooms → {roomCode, matchToken}
  ├─ /api/rooms/:code/socket → RoomDurableObject (one DO per room)
  ├─ POST /api/profile → guest profile upsert (City League, D1)
  ├─ GET  /api/city-league → {season, standings} (D1, current week)
  ├─ POST /api/city-league/matches → {matchId, matchToken, seasonKey}
  └─ POST /api/matches/:id/result → {status: pending|confirmed|disputed}
```

- Solo: entirely local (engine + renderer + input, no network).
- Multiplayer: `CloudflareSignalingClient` coordinates rooms; the match
  itself runs WebRTC P2P lockstep (3-byte inputs, hashes, resync).
- Rooms: 6-char codes, 2 members max, ~2 h TTL (DO alarms), SQLite lifecycle
  rows only, hibernated sockets with attachments. Shareable invites are
  `{origin}/friend/CODE` (same code alphabet, token never in the URL) plus
  WhatsApp `wa.me` share; codes remain the offline fallback.
- City League meta-layer (D1): `players` / `matches` / `submissions` only
  (see `apps/game/migrations/0001_city_league.sql`). Cities are static app
  config (`src/city-league/cities.ts`); seasons are Monday 00:00
  Europe/Istanbul weeks (`seasonKey YYYY-Www`, server authoritative).
  Standings derive from confirmed cross-city matches of the active season.
- PWA: installable, offline app shell (production service worker only).

## City League D1 setup (Cloudflare)

One D1 database bound as `DB` (see `apps/game/wrangler.jsonc`):

```sh
# one-time: create the database
npx wrangler d1 create floodlight-football --cwd apps/game

# put the returned database_id into apps/game/wrangler.jsonc (d1_databases[0])
# local schema + apply
npx wrangler d1 migrations list floodlight-football --local --cwd apps/game
npx wrangler d1 execute floodlight-football --local --file=migrations/0001_city_league.sql --cwd apps/game

# remote (production) apply + deploy
npx wrangler d1 execute floodlight-football --remote --file=migrations/0001_city_league.sql --cwd apps/game
npm run build --workspace=floodlight-football
npm run deploy
```

Local dev without D1 still runs: the Worker falls back to a per-isolate
memory store (parity for rooms/signaling, no persistence). Production must
bind D1 or standings will not persist across isolates.

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

## City League vs Node reference

Cloudflare production is `Worker + Durable Objects + D1 + WebRTC` only. The
Node/Postgres league (`apps/server`) remains as the self-hosted reference and
is never a dependency of the Cloudflare path — concepts/DTOs/dual-submit
were reused, the schema was deliberately not ported (no private leagues,
memberships or fixtures in D1).

## Leagues / persistence (later)

Friend leagues, profiles, results, and rankings need durable storage and are
not built in this pass — that is when D1 enters, with its own ADR. No empty
schemas were created for them. The current Node `LeagueStore` and the shared
`@floodlight/protocol` DTOs are the seam a D1 adapter can implement later.

### Country League upgrade

Country choices use ISO 3166-1 alpha-2 codes. The existing `cityCode` JSON
fields and `city_code` D1 columns are retained for storage/protocol compatibility;
their new values are country codes. `/api/country-league` is the current endpoint,
with `/api/city-league` retained as an alias.

Run `npm run db:migrate:local --workspace=floodlight-football` before local tests.
For production, run `npm run db:migrate:remote --workspace=floodlight-football`
then `npm run deploy`. Wrangler applies the tracked D1 migrations.
Migration 0002 maps existing Turkish city profiles to `TR`, preserving guest
identity and season locks. Historical city match snapshots are preserved and
excluded from country standings. Browser profiles receive the same conversion.
Countries compete weekly: wins earn 3 points, draws 1; same-country matches
are friendlies. Both players must submit matching results before points count.

### Country lobby and matchmaking

The main menu is now the country lobby: Play, Challenge a Friend, World Table.
Play searches for one other human from a different country. Each human controls
an 11-player national team; matches use two 60-second halves. Friend matches
remain available, and same-country games remain unranked friendlies.

`MATCHMAKER` is a SQLite Durable Object bound in Wrangler. One global queue
(`world-v1`) synchronously reserves pairs before allocating a room, preventing
a player from being paired twice. Queue tickets are random bearer secrets;
polls and cancellation require the ticket. Waiting tickets expire after 20
seconds without a heartbeat, while matched assignments last 90 seconds.
Rooms allocated by matchmaking admit only their two reserved session peer IDs.
D1 continues to own profiles, season locks, match records and score submissions.
Run `npm run cf:types` after binding changes, then deploy normally with Wrangler.

Country profiles determine team names and cosmetic kit colors on both peers.
Away colors change when shirts clash; this does not change gameplay or ratings.
Flag palette source: lipis/flag-icons v7.3.2 (MIT, see flag-icons-LICENSE), with
common national football colors overriding the flag-derived colors.

D1 now inserts immutable first score reports and resolves agreement/disagreement
in one atomic batch, including simultaneous submissions. Country choices at
match creation must match the players' saved profiles. Results still rely on
both clients reporting honestly; this is not server-authoritative anti-cheat.

Country matchmaking transports binary game packets through the reserved room's
Cloudflare WebSocket relay, avoiding direct WebRTC/NAT connectivity failures.
The relay accepts only the two reserved session IDs, caps packet sizes and
packet rates, and never calculates match scores. Friend invite rooms continue
to use WebRTC. For global scale, regional queue routing and relay latency
measurement should precede further expansion of the single global queue.
