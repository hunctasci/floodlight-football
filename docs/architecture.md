# Floodlight Football — architecture

Arcade 11v11 browser football: deterministic fixed-step sim, Three.js
presentation, P2P WebRTC lockstep for 1v1, thin Node backend for rooms and
leagues. Solo and direct-invite play work with no backend.

## Layout

```text
apps/game/src/
  main.ts                  # app orchestration: lifecycle, frame loop, navigation, net/league side effects
  engine.ts                # MatchEngine — central deterministic simulation authority (frozen)
  types.ts                 # sim types: MatchState, InputFrame, Ball, Player (shared with net)
  game/
    math.ts                # pure helpers (clamp/length/distance/direction/other), no THREE
    tuning.ts              # canonical TUNING + grouped read aliases (values frozen)
  input/
    keyboard.ts            # keyboard device state (down/pressed/released, blocked keys)
    touch.ts               # pure touch state (stick, buttons); DOM lives in ui/
    input.ts               # unified device state -> InputFrame (+ shootWasDown)
  render/
    camera.ts              # pure camera math (computeCamera/followFocus/cines)
  renderer.ts              # GameRenderer (Three.js) + re-exports of camera helpers
  ui/
    touch-controls.ts      # touch-control DOM (stick + pads), driven by TouchState
  audio/
    audio.ts               # synthesised soundscape (no assets)
  league/
    client.ts              # LeagueApi REST client + local identity/settings
    types.ts               # league DTO mirror (game stays decoupled from protocol)
  net/
    codec.ts               # InputFrame <-> 3 bytes (frozen wire format)
    proto.ts               # packet framing (input/hash/snapshot/control)
    session.ts             # LockstepSession: tick runs only when both inputs present
    driver.ts              # handshake, pump, pause/quit, drop recovery, resync
    transport.ts           # DataTransport (Loopback for tests, RTC for browsers)
    signal.ts              # seed negotiation, room-code envelope
    autosignal.ts          # server-relayed signaling client (rooms + SDP relay)

apps/server/src/
  server.ts                # HTTP (/healthz, /api/*) + WS (/socket) — signaling + league routes
  rooms.ts                 # RoomManager (codes, tokens, join/leave)
  store.ts                 # RoomStore interface + MemoryStore (dev/tests)
  redis-store.ts           # RedisStore (prod ephemeral rooms/presence/rate-limit)
  leagues/
    store.ts               # LeagueStore interface + MemoryLeagueStore
    service.ts             # LeagueManager + pure roundRobin/computeStandings
  db/
    schema.ts              # Drizzle Postgres schema (leagues/members/fixtures/submissions)
    pg-leagues.ts          # PgLeagueStore + boot migration runner
  config.ts / log.ts / index.ts  # env config, pino logging, store wiring + listen

packages/protocol/         # shared zod contracts: WS ClientMsg/ServerMsg, REST DTOs
```

Shims (`game/src/touch.ts`, `audio.ts`, `league.ts`, `server/src/leagues.ts`)
re-export the canonical modules so existing tests keep importing the old paths.
New code imports the canonical paths directly. No barrel files.

## Client

`main.ts` is orchestration: engine/renderer construction, fixed-step loop,
navigation, network lifecycle, league side effects. It owns top-level state
(screen, menuIndex, teamIndex, engine, net driver, room/invite/league state)
and delegates:

- keyboard state → `input/keyboard.ts` (DOM listeners stay in main, pure sets here)
- touch state → `input/touch.ts`, touch DOM → `ui/touch-controls.ts`
- `InputFrame` → `input/input.ts` (`buildInputFrame`, pure, tested)
- camera math → `render/camera.ts` (pure, tested), rendering → `renderer.ts`
- menus/HUD stay in `main.ts` deliberately: `handleMenuEnter()` coordinates app
  side effects (launch, net flows, league REST); extracting it into a DI menu
  framework would change semantics for no behavioral gain.

## Simulation (frozen)

`MatchEngine` is the authority. Fixed 60 Hz (`update(1/60, input, peerInput)`),
seeded RNG (`seed * 1664525 + 1013904223`), serial iteration order, snapshot/
restore (`structuredClone`), FNV-1a `hash()` over quantized fields. Helpers in
`game/math.ts` and constants in `game/tuning.ts` were relocated verbatim —
expressions, values, call order and float op order unchanged.

Three.js never enters simulation modules (`engine`, `game/*`, `types`,
`input/*`, `net/codec|proto|session`). Renderer-only helpers
(`scorerTeam`, `celebrationMove`) live in render code.

## Rendering

Three.js retained. No DPR/antialias/shadow/material/geometry/lighting/FOV
changes in this pass. `render/camera.ts` holds the already-pure framing math;
`GameRenderer` owns scene, avatars, ball, cinematics, shake/trail juice.
Cinematics are camera-only — the sim underneath never changes.

## Input

```text
raw browser input → device state → InputFrame → simulation
```

- `input/keyboard.ts`: `down/pressed/released`, `BLOCKED_KEYS`, pure transitions.
- `input/touch.ts`: `TouchState` + stick dead-zone/normalize + `stickSprint(>0.92)`.
- `input/input.ts`: `buildInputFrame(kb, touch, shootWasDown)` — arrows + stick
  merged and normalized, `E/Shift/stick-rim` sprint, `S/W/A/D` + `J/L/I/K`
  aliases, `Q/Space` switch, unified `shootWasDown` release detection.

Frozen by `tests/input-mapping.test.ts`. MatchEngine never sees DOM.

## WebRTC networking (frozen)

1v1 P2P lockstep, both peers construct identical engines
(`humanTeam=0, remoteTeam=1`) and exchange 3-byte inputs per tick; a tick runs
only when both sides' inputs are present. Hashes every `HASH_EVERY=15` ticks
detect desyncs; host snapshots heal. Transport is a byte pipe (`Loopback` in
tests, `RTCDataChannel` in browsers). Two flows:

- **Serverless invite links** (no backend): host `createOffer` → link carries
  SDP → joiner `acceptOffer` → reply code back. Works offline/local.
- **Server-relayed rooms**: `AutoSignal` (`/socket`) creates/joins a 6-char
  room, relays SDP, both sides bind the WebRTC handshake to the room's
  `matchToken` so stray peers can't land in a session.

Codec, framing, hash cadence, snapshot/resync, timing — all frozen and covered
by `net-*.test.ts` + `determinism.test.ts`. No 4-player lockstep, rollback
redesign, authoritative server, matchmaking or spectator in this pass.

## Signaling / shared protocol

`packages/protocol` is the contract boundary: zod `ClientMsg`/`ServerMsg`
(room lifecycle + SDP relay), `RoomInfo`, `Health`, league DTOs
(`League/Member/Fixture/StandingsRow`, create/join/start/submit/resolve).
Game and server import it; neither duplicates protocol shapes. Gameplay stays
in the game, server logic stays in the server — only shared wire contracts
live here.

## Backend

Node + `ws`, structured pino logs, zod-validated WS + REST, per-IP sliding
window rate limits, 64 KiB payload cap. Observability is structured logs only
(service, level, err context) — no Prometheus/Grafana/OTel collectors in this
pass; those are a future scaling concern once the self-host path needs SLOs. Responsibilities:

- signaling: room create/join/leave, member-only SDP relay, presence heartbeat
- rooms: 6-char codes (no 0/O/1/I), 2 members max, TTL (default 2 h), empty
  rooms deleted, never listed
- leagues: create/join/start/submit/resolve, dual-submit agreement
  (ADR-004), standings (3/1/0 → GD → GF → name)
- health: `GET /healthz` → `{status, uptimeSec, redis}`

`RoomStore` (memory/Redis) and `LeagueStore` (memory/Postgres) provider
separation is the key design: tests/dev run memory-only, prod swaps adapters
via `REDIS_URL`/`DATABASE_URL` with no logic changes.

## Redis — ephemeral only

Rooms (`room:{code}` JSON + TTL), presence heartbeats, sliding-window rate
limits, signaling coordination. Atomic joins via Lua, one-round-trip rate
limits via `MULTI`. Loss only drops live rooms, never history. Memory adapter
for dev/tests, Docker Redis for local integration, supported self-host adapter
in prod. Permanent league history never lives in Redis.

## Postgres — durable only

Leagues, members, fixtures, submissions, guest players via Drizzle
(`drizzle/0001_leagues.sql`, re-runnable, applied on boot). No real-time match
state, no speculative future tables. Memory adapter for dev/tests.

## Deployment options

- **Client-only** (Cloudflare Workers Free, static `dist/`): solo + direct
  WebRTC invites, PWA offline shell. No backend required.
- **Node/self-host** (Docker Compose: Caddy + server + Redis + Postgres):
  adds room codes + league REST with local parity. See `docs/deployment.md`.
- **Future Cloudflare-native**: Worker + Durable Object (rooms/signaling/
  presence) + D1 (leagues/results), same protocol/domain model. Not built in
  this pass — boundaries kept compatible (see below).

Docker containers are never required by the Cloudflare path.

## Future 2v2 boundary (not implemented)

```text
Team 0: Controller A + Controller B → 11 footballers (9 AI)
Team 1: Controller C + Controller D → 11 footballers (9 AI)
```

Each human drives one distinct footballer; the rest stay AI. The architecture
doesn't block this: `input/` already isolates one controller stream
(`KeyboardState + TouchState + shootWasDown → InputFrame`), the sim already
takes `(input, peerInput)` per side, and the protocol codec is per-frame bytes.
Still unsolved (deliberately): controller IDs, player ownership, switch
arbitration, duplicate-selection prevention, pass-to-human, disconnect
fallback, four deterministic InputFrames, lockstep changes. See
`docs/deployment.md` and the 2v2 note in `input/input.ts`.
