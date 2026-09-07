# Floodlight Football — simulation and netcode

Technical reference for the deterministic match simulation. Player-facing
behaviour lives in `docs/gameplay.md`; room infrastructure in
`docs/architecture.md`. All paths below are under `apps/game/src/`.

## The one match clock

`game/clock.ts` (`SimulationClock`): the sim advances in fixed `1/60` s
ticks. Callers feed elapsed *render* time into `push()` and step that many
ticks — capped at `MAX_CATCH_UP = 4` per frame, with debt beyond `MAX_DEBT_S
= 0.25` s discarded (rebase, never fast-forward). Solo (`main.ts` +
`soloClock`) and online (`net/driver.ts` clock) use the same clock; online
additionally requires both inputs per tick. Rendering frequency never sets
match speed — pinned by `tests/p0-clock.test.ts` at 30/60/120/144 Hz.

Live-play slow motion does not exist: shot/slide juice is camera shake and
FOV only (`renderer.impact`).

## Determinism contract (read before touching the sim)

- Fixed `dt = 1/60`, serial iteration order, seeded RNG
  (`seed * 1664525 + 1013904223`), float op order preserved.
- **No `Math.random`, no `Date.now`, no wall clock in decisions.** RNG is a
  last resort (keeper panic-boot jitter); every tackle, save, bounce and
  interception is geometry with stable tie-breaks (usually lower player id).
- No THREE.js, no DOM in `engine`, `game/*`, `types`, `input/*`,
  `net/codec|proto|session`.
- Solo and online simulate **bit-identical** frames: device input is
  quantized to the wire representation before the sim ever sees it
  (`codec.quantizeInput`, axes/aim to 1/100).

### Adding future-affecting state? Do all five

1. Declare it on the engine (or `Player`/`MatchState`).
2. Include it in `EngineSnapshot` + `snapshot()`/`restore()` (tolerate
   missing fields for older snapshots with `??` defaults).
3. Mix it into `hash()` (quantize floats with `q = Math.round(v * 1000)`).
4. Reset it in `resetPositions()` (or the relevant claim/distribute path).
5. Cover it with a snapshot-round-trip + hash-equality test.
   Repeat offenders that were missed before: touch phase, dive commitments,
   gesture state, AI roles, restart buffers, RNG seed.

## Input frame and action contract

`types.InputFrame`: move axes, sprint, PASS edge/hold/release, SHOOT
press/hold/release, SWITCH edge, shot aim `aimU` (−1..1 across) / `aimV`
(0..1 height). Legacy `through`/`cross` fields decode false and only survive
as keeper-distribution and corner internals — no control produces them.

`types.ControllerActionState` (per side, in snapshot+hash): one physical
edge = exactly one intended action. Identity, movement and aim are captured
on button-down; possession changes cancel held gestures instead of
reinterpreting them (keeper PASS can't become a receiver tackle; a lost
shot charge can't become a slide on release). Edge discipline: the first
catch-up tick of a render frame sees edges, the rest see held state only
(`main.ts`), and `NetDriver.stageInput` lands accumulated edges into exactly
one tick. Covered by `tests/p0-action.test.ts`, `tests/input-mapping.test.ts`.

Codec v2 (`net/codec.ts`): one frame ⇄ 6 bytes (button mask, move ×2, aim
×2, reserved zero). `net/proto.ts` frames input/hash/snapshot/control
packets; malformed input decodes to `unknown`, never throws.

## Events, snapshots, hashing

- Sim events are generated once per tick, queued, and consumed once:
  `LockstepSession` accumulates every stepped tick into `pendingEvents`;
  `drainEvents()` takes them exactly once per render frame (catch-up neither
  loses nor replays).
- `MatchEngine.snapshot()` deep-clones everything in the canonical list
  (state, seed, tick, actions, pass/shot/switch/keeper/challenge/AI/restart
  privates — see the `EngineSnapshot` interface, it *is* the list).
- `hash()` is FNV-1a over quantized gameplay fields only — no camera, audio,
  particles or UI. Same seed + same tick-indexed inputs ⇒ same hash on any
  peer, at any render rate.

## Version negotiation

`net/signal.ts`: `NET_PROTO = 2`, `SIM_VERSION = 2`, `INPUT_VERSION = 2`,
`TUNING_FINGERPRINT` (bump on any sim/codec/tuning change). Hello/welcome
carry all three; `checkVersions` fails the handshake gracefully on mismatch
instead of starting an invalid match. `NetDriver` also binds the handshake
to the room `matchToken`.

## Lockstep protocol (1v1 P2P, unchanged architecture)

Both peers build identical engines (`humanTeam=0, remoteTeam=1`) and step a
tick only when both inputs exist, `delay = 3` ticks hiding latency. Hashes
every `HASH_EVERY = 15` ticks detect desyncs; `resync-request` + host
snapshots heal; `DROP_AFTER_STALL = 600` stalled frames falls back to AI
(`dropPeer`). Pause/resume/quit/ready-gate/half-time broadcast ride control
packets. Signaling (Cloudflare rooms + invite URLs, Node fallback) is
byte-transport only — gameplay never leaves the clients.

## Subsystem map (`engine.ts` private systems)

| System | Owns | Key entry points |
|---|---|---|
| Movement | accel/decel/turn, sprint weight | `steer`, `seekVelocity`, `moveHumanSide` |
| Ball control | touches, envelope, first touch, swept contact | `dribbleTouch`, `firstTouch`, `collectBall`, `integrateBall` |
| Passing | cone select, hold nominee, fixed destination | `selectPassTarget`, `releasePass`, `pass` |
| Switching | cost cycle, fallen handoff | `selectControlSide`, `switchCandidates` |
| Shooting | reticle solve, contact gate, buffer, mishit | `strikeShot`, `solveShot`, `simCross`, `tryStrike` |
| Keeper | positioning, reaction, dive, contact, outlets | `goalkeeper`, `keeperClaim`, `keeperDecide`, `keeperOutlet`, `keeperKick` |
| Tackling | lunge/slide initiation + per-tick sweeps | `tackle`, `resolveChallenges` |
| Team shape | roles, outlets, buildup, carrier decisions | `updateRoles`, `updateAI`, `aiCarrier`, `aiShoot` |
| Restarts | setup, buffer, timeout default | `takeRestart`, `placeRestart`, `cross`, `kickoff` |

`TUNING` (`game/tuning.ts`) centralizes every value; grouped aliases are
read-only views. `game/math.ts` holds pure helpers incl. `segDist` (swept
contact).

## Rendering contract

`renderer.render(state, dt, menu, disp)`: `disp` carries interpolated
display positions (prev-tick lerp by leftover debt, computed in `main.ts`).
The renderer never steps gameplay; it snaps (`disp` = current) across true
discontinuities (restarts, recoveries — detected by phase change or tick
rewind). DPR stays capped at 1.5, HUD refreshes at ~15 Hz, camera work stays
in `render/camera.ts` (pure, tested).

## Performance profile (measured, Node)

`MatchEngine.update()`: avg 0.012 ms, p95 0.020 ms, p99 0.048 ms (target
p95 < 2 ms — 100× headroom, no sim optimization needed). Snapshot 0.03 ms,
hash 0.004 ms. Known sim costs are bounded and flat: 22-player separation
(231 pairs), role nearest-scans, fixed-iteration shot solves. Renderer GPU
cost still wants a browser-side pass (shadows, avatars, DPR tiers) — tracked
in `docs/gameplay-known-issues.md`.

## Test layout

`tests/p0-*.test.ts` are the acceptance suites (clock, action, movement,
passing, shooting, keeper, tackle, shape). Legacy suites pin invariants
(22 players, restarts, posts, halves, pause, replay, codec, rooms, PWA).
Tests that encoded removed designs (auto-finesse, RNG tackles, teleport
bubbles, magnet radii, nearest-switch, through/cross buttons, extrapolated
shot asserts) were replaced, not kept. Fixture rule: park non-participants
off-lane (AI chasers legitimately contest anything within reach).
