# HNC Content Engine — architecture

`packages/reels` turns a semantic **ContentSpec** (story intent) into
deterministic Remotion renders (Reel / Story / 4:5 / 1:1 video and stills).

```
ContentSpec (cast · scenes · beats · camera intents · actions · text · sound)
      │  engine/director/compile.ts   (pure, Node-safe)
      ▼
Timeline (frame-resolved shots · overlays · sound events · markers)
      │  engine/qa (framing + motion lint, no browser)
      ▼
render/ContentComposition.tsx ── ShotLayer per shot ── World scene + cast + camera
      │                                  └─ transitions composite neighbouring layers
      ▼
Remotion  →  MP4 (reel/story/portrait/square)  ·  PNG key art
```

## 1. Audit of the first-generation system (2026-09-29)

The first system produced one excellent piece (the 60fps HNC hero trailer) and
two weak ones. Rendered evidence (`reels:still` on OfficeRivalry): the office
two-shot framed both workers half out of frame, `desk-right-close` put the
lens inside a torso, `close-reaction` framed an empty wall, and the side-eye
never read. Root causes and verdicts:

| Area | Finding | Verdict |
|---|---|---|
| `ReelSpec` | Frame-level shot list; every story was a hand-written TS compiler doing frame arithmetic (`start.brand - 3`, `beatFrame(...)`). Football fields (`footballMoment`, `home`, `attackingTeam`, `momentClock`) were top-level on every shot. Timing of graphics was mixed shot-local / global. | **Replaced** by `ContentSpec` (authoring) + `Timeline` (compiled). Frame math moved into one timing grammar (`engine/spec/timing.ts`). |
| Stages | `Stage3D` was a string switch; `StageSpec.kind` unused; anchors were bare positions with no posture or ownership. | **Replaced** by a world registry (`worlds/*`): marks with posture, props, lights, surfaces, lenses, ambience, world effects. |
| Actors | No persistent identity: office skin = hash(actor id), footballer skin = shirt number, so one person changed face between worlds. Wardrobe inferred from model-name substrings (`'02'` → formal). Head turns rotated only the head mesh (hair and eyes were siblings), so no look ever read. | **Redesigned**: `cast` identity (country + number) drives skin, kit and back number everywhere; looks are explicit; head/eyes/hair move together (canonical rig change, see §5). |
| Cameras | Two parallel systems. Anchored football moves (good) and world-coordinate presets (broken off the pitch). Camera choice hacked by name substring (`c.includes('football')`). | **Unified**: every lens is a function of *subjects* (cast heads, props, lights, surfaces). Football moves kept verbatim as world moves. |
| Transitions | Screen overlays over a hard cut only; no access to either shot's camera. | **Redesigned**: transitions know both shots, can offset their cameras (whip), project world light sources (bloom), overlap and mask layers (wipe, zoom-through). |
| Formats | 1080×1920 hard-coded in presets, validator, graphics and effects. | **Redesigned**: `engine/formats.ts` + layout context; lenses keep horizontal FOV across aspect ratios. |
| Audio | Office cues (`typing`, `tension-rise`, `record-scratch`...) were procedural with no recipe, so they were silent. Only the hero opted into the SFX stem. | **Extended**: a social synth for sketch sounds, world ambience beds, transition default sounds, ducks; stem always on. |
| Football | `hero-attack` choreography, moment clocks, time ramps, anchored lenses, projected trails/bursts: excellent. Legacy moments (`crossbar-chaos`...) floated the ball and slid players. | **Kept** hero-attack + clocks + lenses. **Removed** the legacy moments. |
| Graphics | Trailer graphics (Scoreboard, GoalCall, WorldTable, BrandReveal, Eyebrow) speak the game's UI language. Meme captions were generic. | **Kept** the trailer set (now layout-aware). **Replaced** captions with a typography system that can also pin text to world subjects. |
| QA | Visual QA was manual stills only. | **Added** `engine/qa`: framing (subject in frame, lens not inside a body) and motion (camera/subject jumps, impossible speeds) linting, plus contact sheets. |

What stayed untouched: `@floodlight/hnc-visuals` as the single source for
players, ball, stadium, crowd and render profile; keyed RNG; absolute-frame
evaluation; asset provenance policy.

## 2. Authoring model

A **ContentSpec** is a list of **scenes**. A scene happens in a **world** and
is cut into **beats** (one beat = one shot). Beats say *what the camera
means* (`'close:hero push-in'`), *what the cast does*
(`{ at: 'desk-a', do: ['typing', { at: 1.2, do: 'side-eye', look: 'rival' }] }`),
what text appears and what sounds happen. Beats and scenes join through
**transitions** (`{ type: 'light-bloom', from: 'ceiling-light', to: 'floodlight' }`).

Cast members persist across scenes. A scene can change their **look**
(`office` → `kit`) while identity (skin, number, country) stays the same.
That is what makes "office worker becomes footballer" land.

Timing grammar (`engine/spec/timing.ts`): `0.4` (seconds into the beat),
`'60%'`, `'end-0.3'`, `'+3f'`, `'shot.end-3f'` (another beat), `'moment:contact'`
(football choreography beat), `'moment:6.1'`.

### Reusable vocabulary (full list: `docs/VOCABULARY.md`)

| Kind | Ids |
|---|---|
| Worlds | football, office, studio, phone (2D), title (2D) |
| Looks | kit, keeper-kit, office, office-formal, office-casual, manager, suit, commentator, fan, referee, hoodie |
| Actions | idle, freeze, typing, notice, side-eye, glare, stare-down, stand-up, sit-down, slam-desk, point, cheer, facepalm, shrug, sip, smug, gasp, deflate, talk, present, nod, head-shake, look-around, phone-look, phone-gasp, walk, storm |
| Lenses | close, medium, full, over-shoulder, two-shot, macro (± owner behind), low-angle, look-up, top-down + world lenses (office wide/pod-high, studio wide/desk/screen/jib, football hero moves) |
| Moves | push-in, pull-out, drift-l/r, orbit-l/r, rise, descend, snap-zoom, crash-zoom, handheld, tilt-to:, tilt-from:, `to` blends |
| Transitions | cut, match-cut, flash, dip, light-bloom, whip-pan, zoom-through, wipe, cloud-puff, glitch |
| Effects | impact-shake, zoom-punch, impact-burst, ball-trail, lights-on, cinebars, stadium-grade, flash, vignette, speed-lines, rival-grade, freeze-grade, confetti; world: lights-flicker, lights-surge, coworkers-look |
| Graphics | eyebrow, scoreboard, goal-call, world-table, brand-reveal, breaking-banner, lower-third, ticker, live-bug, chat, typing, system-note, notification, versus, timestamp, stamp, screen |
| Text | hook, pov, caption, kicker, impact, label (pinned `on:subject`), subtitle, whisper, stamp |
| Sound | game recipes (kick, shot, goal-sting, brand-sting, whistle…), CC0 crowd (crowd-bed, goal-roar, crowd-gasp…), social synth (office-tone, typing, notification, tension-rise, record-scratch, flicker, bloom, zip, news-sting, heartbeat…), `hush` |

## 3. Worlds

| World | Kind | Purpose |
|---|---|---|
| `football` | 3D | Canonical HNC stadium + choreography (`hero-attack`), cast mapped onto roles. |
| `office` | 3D | Facing-desk pod, background coworkers, fluorescent grid, desk clues from cast countries. |
| `studio` | 3D | Broadcast news set: anchor desk, back screen surface, studio lights. |
| `phone` | 2D | Messaging app: chat thread, typing indicator, push notification. |
| `title` | 2D | HNC-branded plate for brand cards / typography pieces. |

A world file declares marks, props, lights, surfaces, lenses, ambience and
parameters. Its scene component renders it. Adding a world = one definition
file + one scene component + a registry line.

## 4. Determinism

Compile is pure: same spec + seed → deep-equal Timeline. Rendering evaluates
everything from absolute frame. Randomness only via `rng(seed, key)`. The SFX
stem is seeded and byte-deterministic. `tests/determinism.test.ts` guards
`Math.random` / `Date.now`.

## 5. Canonical visual changes (hnc-visuals)

* `createHncPlayerVisual`: hair and eyes are now children of the head mesh
  (positions converted to head-local, identical world positions at rest).
  The game never rotates the head, so it renders pixel-identically. Reels
  can now turn heads and move eyes.
* `HncPlayerVisual.eyes` handles (optional field) for gaze/squint.
* New pose application `applyHncBodyPose` (reel-only animation on the same
  rig channels) and new wardrobes/accessories used only by social content.

## 6. QA

`engine/qa.ts` evaluates every frame of every 3D shot in Node: lens inside
a body, primary subject out of frame at mid-shot, subject crowding the edge,
subject screen jumps, camera discontinuities (not speed — a crane may move
fast), aim snaps outside deliberate impact shakes, cast walking speed,
players faster than an elite sprint. `validate` runs it for every declared
format; `tests/qa.test.ts` requires zero errors for all registered content
and proves the linter catches the first-generation bugs.

## 7. Known issues (honest list)

* `hero-attack`'s rival chase peaks at ~12.5 m/s (catch-up blend) and the
  slide tackle opens with a ~27 m/s lunge: a chaser who starts after
  kickoff physically trails by 4–5 m (verified with an acceleration-limited
  pursuit model). The trailer's coverage hides it; a proper fix is
  re-choreographing the duel (rival starts goal-side). QA reports it as a
  warning on shots that show that window.
* HNC stick arms pivot at their centre, so hand-to-face gestures
  (facepalm) read weakly in close-ups — prefer head/eye acting there.
* Close-ups in 1:1 are very tight (the crop keeps face width).
* Screen content inside the 3D world is canvas-painted; the zoom-through
  hands over to the DOM graphic (similar, not pixel-identical content).

## 8. Autumn 2026 campaign additions (2026-09-29)

Built because the ten campaign concepts needed them — each is used by at
least two pieces or is a genuine engine gap (listed with its first users).

| Addition | Where | Why |
|---|---|---|
| **People** (recurring identities) | `cast/people.ts`, `CastSpec.person` | Emre, Lucas, Nikos, Kaan… are one identity (country + number → face, kit, flag) across apartment, office, café, tunnel, stadium. Specs cast `{ person: 'emre' }`; identity can't drift. |
| **Scene world events** | `worlds/events.ts` | A world effect on one beat persists for the scene (a cup that fell stays fallen; a ball that rolled in stays put). Worlds read every event of their scene from the timeline, so stills/video/QA agree. |
| **New worlds** | `worlds/{apartment,breakroom,cafe,corridor,rooftop,stage}` | Night flat (#01), office kitchen with a live cup + machine display (#02, #09), café with a live espresso (#03), corridor→tunnel in one passage (#10), dawn rooftop with a waving geometric flag (#06), abstract cyclorama with a giant phone people step out of (#05). Shared set pieces in `worlds/interior/kit.tsx`. |
| **Office night + morph** | `worlds/office` | `time: 'night'` (monitors light faces), per-desk switchable screens, `stadium-morph` (carpet→pitch, panels→floodlights, workers→fans) (#04). |
| **Football atmosphere** | `worlds/football/atmosphere.tsx` | `light: day/night/dawn/horror`, `lights-out` / `lights-up` events, `crowd: 'empty'`, terrace `tifo`, HNC-owned pitch boards (the game's third-party ad creatives never appear in campaign content). The canonical stadium/players/ball are untouched. |
| **Canonical kit clash** | `FootballScene` → `apps/game/src/city-league/kits.ts` | Kits come from the game's own `countryTeams` (away changes shirt when too close): TR v BE is red v black, BE v TR is red v white. |
| **New choreographies** | `worlds/football/{free-kick,midnight-penalty,walk-out}.ts`, `hero-attack-bar` | Set piece with a spinning ball (#03), the no-blink penalty (#07), a ceremonial walk-out (#06), the attack that hits the bar (#09). `dropBall` restarts (#02). |
| **Acting** | `cast/actions.ts` | reach / pull (counter props), knuckles, adjust-tie, pull-cord, place, fold, lean-in, earbud, fake-type, exhale, stroll, walk-slow, fiddle, breath, proud, papers, nervous, look-up. |
| **Lenses** | `camera/lenses.ts` | `insert` (screen/sign detail), `follow`, `follow-low`; body-part subjects `<cast>.badge/.hands/.feet`. |
| **Transitions** | `transitions/registry.ts` | `white-out` (walk into the light), `dissolve` (ceremony only), 2D `buzz-shake`; zoom-through from a chat bubble (`last-bubble`). |
| **Type system** | `graphics/Text.tsx`, `graphics/case.ts` | Futura headline, Didot cinema/monument/dedication, DIN broadcast, Bodoni horror, typewriter; **Turkish-aware uppercase** (TÜRKİYE, not TÜRKIYE). |
| **Audio** | `audio/filtered.ts`, `social-synth.ts` | Crowd heard through walls / opening as you walk out (low-passed CC0 recordings in the stem), ~30 foley recipes; mastering to −14 LUFS by one static gain capped at −1.5 dBTP (`scripts/lib/master.ts`; no dynamic compression). |
| **Posters** | `posters/*`, `scripts/poster.ts` | Key art is composed, not grabbed: key-art specs → cropped plates → grade → a typography layer rendered transparent → sharp composite. |
| **Campaign pipeline** | `content/autumn-2026/campaign.ts`, `scripts/campaign.ts`, `engine/storyboard.ts` | One command renders reel.mp4 / post.png / storyboard.md / qa/ for every item. |

Known limits: see `social/output/autumn-2026/CAMPAIGN.md` (Known limitations).
