# Floodlight Football — architecture

Arcade 11v11 browser football: deterministic fixed-step sim, Three.js
presentation, P2P WebRTC lockstep for 1v1, Cloudflare control plane for rooms
and signaling in production. Solo play works with no backend.

## Layout

```text
apps/game/src/
  main.ts                  # app orchestration: lifecycle, frame loop, navigation, net/league side effects
  engine.ts                # MatchEngine — deterministic simulation (movement, ball, passing,
                           #   shooting, keeper, tackling, shape, restarts; see docs/simulation.md)
  types.ts                 # sim types: MatchState, InputFrame (+aim/hold edges), Ball, Player, action state
  game/
    math.ts                # pure helpers (clamp/length/distance/direction/other/segDist), no THREE
    tuning.ts              # canonical TUNING values (P0 rebuild values)
    clock.ts               # SimulationClock: fixed 60 Hz pacing, catch-up cap, debt rebase
  input/
    keyboard.ts            # keyboard device state (down/pressed/released, blocked keys)
    touch.ts               # pure touch state (stick, buttons, SHOOT drag-aim, sprint hysteresis)
    input.ts               # unified device state -> quantized InputFrame (+ hold-state carry)
  render/
    camera.ts              # pure camera math (computeCamera/followFocus/cines)
  renderer.ts              # GameRenderer (Three.js) + re-exports of camera helpers
  ui/
    touch-controls.ts      # touch-control DOM (stick + 3-button pad + SHOOT drag-aim)
  audio/
    audio.ts               # synthesised soundscape (no assets)
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
    signaling.ts           # SignalingClient contract (control-plane seam)
    autosignal.ts          # Node reference signaling client (WS /socket)
    cloudflare-signal.ts   # production signaling client (POST /api/rooms + per-room WS)

  worker/
    index.ts               # public Worker: /api/health, POST /api/rooms, per-room socket route
    room.ts                # RoomDurableObject: hibernated SDP relay + presence (one DO per room)
    room-logic.ts          # pure room helpers (codes, tokens, validation, limits) — unit-tested

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

## Simulation

`MatchEngine` is the authority. Fixed 60 Hz ticks driven by
`game/clock.ts` (`update(1/60, input, peerInput)`), seeded RNG, serial
iteration order, snapshot/restore (`structuredClone`), FNV-1a `hash()` over
the canonical quantized field list (see `docs/simulation.md` — every
future-affecting field, no presentation state). Gameplay systems
(movement, touch model, passing, shooting solve, keeper, challenges, shape)
are private methods with centralized `TUNING`; contributor rules
(no wall-clock/RNG in decisions, snapshot+hash+reset checklist) live in
`docs/simulation.md`, mechanics in `docs/gameplay.md`.

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
- `input/touch.ts`: `TouchState` + stick dead-zone/normalize + rim-sprint
  hysteresis (0.92 enter / 0.82 leave) + SHOOT drag-aim.
- `input/input.ts`: `buildInputFrame(kb, touch, shootWasDown, carry)` —
  arrows move, `E/Shift`/rim sprint, `S` pass (tap/hold), `A` long pass,
  `D/KeyK`/mouse shoot with reticle aim, `W` cross, `Space/Q` switch,
  unified press/hold/release carry. Axes and aim quantized to the wire format.

Frozen by `tests/input-mapping.test.ts`. MatchEngine never sees DOM.

## WebRTC networking (frozen)

1v1 P2P lockstep, both peers construct identical engines
(`humanTeam=0, remoteTeam=1`) and exchange 6-byte inputs per tick; a tick runs
only when due by match-clock time *and* both sides' inputs are present
(catch-up capped, debt rebased — see `docs/simulation.md`). Hashes every
`HASH_EVERY=15` ticks detect desyncs; host snapshots heal. Transport is a
byte pipe (`Loopback` in tests, `RTCDataChannel` in browsers). One player flow:

- **Cloudflare rooms (production)**: `CloudflareSignalingClient`
  (`POST /api/rooms`, `WS /api/rooms/:code/socket`) creates/joins a 6-char
  room on a per-room Durable Object, which relays SDP offer/answer, trickle
  ICE candidates and presence between the two members
  (TTL rooms, rate-limited creation, no room listing). The host shares an
  invite link (`?room=CODE`, code only — no SDP, no secrets); tapping it and
  typing the code converge on the same `joinRoom` path. Both sides bind the
  WebRTC handshake to the room's `matchToken`, so a stray peer can never land
  in a session. When the page is served next to Node instead (self-host),
  the client falls back to `AutoSignal` (`/socket`) automatically.
- **Manual SDP helpers retained** (`RTCTransport.createOffer`/`acceptOffer`,
  `signal.encodeCode`): low-level fallback for tests/debugging only, not the
  normal player path.

Codec (v2: buttons + move + shot aim), framing, hash cadence,
snapshot/resync, timing and version negotiation are covered by
`net-*.test.ts` + `determinism.test.ts` + `p0-clock.test.ts`. Peers with
mismatched sim/input/tuning versions fail the handshake instead of starting
an invalid match. No 4-player lockstep, rollback redesign, authoritative
server, matchmaking or spectator in this pass.

## Signaling / shared protocol

`packages/protocol` is the contract boundary: zod `ClientMsg`/`ServerMsg`
(room lifecycle + SDP relay), `RoomInfo`, `Health`, league DTOs
(`League/Member/Fixture/StandingsRow`, create/join/start/submit/resolve).
The Node server imports it; the game keeps structural mirrors so the sim
bundle stays decoupled; the Cloudflare Worker validates the same shapes with
Web-standard code (no Node modules in the Worker). Gameplay stays in the
game, room logic stays per-backend — only shared wire contracts live here.

## Backend

Two backends, one contract, different roles:

**Production — Cloudflare control plane** (`apps/game/worker/`): Worker +
per-room Durable Objects, same origin as the game (Static Assets). HTTP
(`POST /api/rooms`, `GET /api/health`) + per-room WebSocket hibernation
(`GET /api/rooms/:code/socket`), zod-mirrored validation, per-IP
best-effort rate limits, 64 KiB payload cap, ~2 h room TTL via DO alarms.
Observability is structured logs only. Responsibilities:

- signaling: room create, member-only SDP relay, presence join/leave
- rooms: 6-char codes (no 0/O/1/I), 2 members max, TTL (2 h), empty rooms
  deleted, never listed
- health: `GET /api/health` (alias `/healthz`) → `{status, service}`

**Reference — Node self-host** (`apps/server/`): Node + `ws`, structured
pino logs, zod-validated WS + REST, per-IP sliding-window rate limits, 64 KiB
payload cap. Responsibilities: the same room semantics over `/socket`, plus
league REST (create/join/start/submit/resolve, dual-submit agreement per
ADR-004). Health: `GET /healthz` → `{status, uptimeSec, redis}`.

The game probes Cloudflare first and falls back to the Node protocol, so
Docker self-hosts keep working with zero client changes.

Node league semantics (reference only): create/join/start/submit/resolve,
dual-submit agreement (ADR-004), standings (3/1/0 → GD → GF → name).

`RoomStore` (memory/Redis) and `LeagueStore` (memory/Postgres) provider
separation is the key design: tests/dev run memory-only, prod swaps adapters
via `REDIS_URL`/`DATABASE_URL` with no logic changes.

## Redis — ephemeral only (Node reference)

Rooms (`room:{code}` JSON + TTL), presence heartbeats, sliding-window rate
limits, signaling coordination. Atomic joins via Lua, one-round-trip rate
limits via `MULTI`. Loss only drops live rooms, never history. Memory adapter
for dev/tests, Docker Redis for local integration, supported self-host adapter
in prod. Permanent league history never lives in Redis. Cloudflare production
uses Durable Objects instead — no Redis there by design, not by omission.

## Postgres — durable only

Leagues, members, fixtures, submissions, guest players via Drizzle
(`drizzle/0001_leagues.sql`, re-runnable, applied on boot). No real-time match
state, no speculative future tables. Memory adapter for dev/tests.

## Deployment options

- **Cloudflare production** (one application: Worker + Static Assets +
  Durable Objects): full game, solo + room-code online via the control plane,
  PWA offline shell. No backend data store required. See `docs/deployment.md`.
- **Client-only** (static `dist/` anywhere): solo play,
  PWA offline shell. No backend required. (Online needs the control plane.)
- **Node/self-host reference** (Docker Compose: Caddy + server + Redis +
  Postgres): same room semantics over `/socket` plus league REST, with local
  parity. The game auto-falls-back to it when served next to Node.

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
