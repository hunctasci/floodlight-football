# Floodlight Football — gameplay manual

How the match plays, what each input does, and why things happen. Numbers
are the shipped `TUNING` values in `apps/game/src/game/tuning.ts`; behaviour
is pinned by `apps/game/tests/p0-*.test.ts`.

Design target: win possession → create an angle → pass/carry/lead a runner →
control with a meaningful first touch → create space → place the finish →
understand the outcome → next possession. Every important result should be
readable: you should usually know *why* you lost the ball or *why* a shot
was saved.

## Controls

One controlled footballer per human. The same three ideas on both devices:

| Idea | Desktop | Touch |
|---|---|---|
| Move | Arrow keys | Left stick (rim = sprint) |
| Sprint | E / Shift | Push the stick to the rim (latches until ~0.82) |
| Switch defender | Space (Q works too) | SWITCH button |
| Pass (X) / contain | S, tap = feet, hold = into space | PASS / CONTAIN button (label follows possession) |
| Lob pass / cross (Square) / slide tackle | A — lofted delivery into the box | CROSS / SLIDE button |
| Shoot (Circle) / standing tackle | D, tap or hold — quick finish on your facing (or hold LMB, drag to aim, release) | SHOOT / TACKLE button (hold + drag to aim) |
| Through pass (Triangle) / rush | W — firm driven ball to a teammate | THRU / RUSH button |
| Camera / pause | C / Esc | HUD chip / scoreboard |

On defence (FIFA): S (X) = contain/pressure, D (Circle) = standing tackle,
A (Square) = slide tackle, W (Triangle) = rush/pressure, Space = switch.
As keeper, S = short outlet, W = through outlet, A/D = long clearance. There are no finesse or
sprint-modified shot variants — see Shooting. There is no stamina meter:
sprint already costs through longer touches and heavier turning.

Default match: 90-second halves, ~1.5 s auto-halftime, quick result screen
with rematch first.

## Movement

Responsive arcade running: 7.4 m/s, sprint 9.2 m/s (1.24×), ~143 ms to 95%
speed, ~120 ms to a stop, ~183 ms to reverse, ~244 ms to reverse at full
sprint. Analog deflection scales speed smoothly from the dead zone — a small
deflection really walks. Facing turns toward the run (~17/s rate).

## Possession and first touch

`ball.owner` means *entitled to controlled touches*, never glued. The carrier
touches the ball every ~120 ms toward a point ahead (0.9 m jogging,
1.5 m sprinting — sprinting visibly exposes the ball); between touches the
ball runs free physics and anyone it physically reaches can take it.
Ownership breaks when the ball leaves the 1.8 m envelope, goes over head
height, or an opponent makes real contact. Contested balls go to the closest
contact (exact ties break by lower shirt number, deterministically).

Receiving never teleports: the ball stays where contact happened and keeps
some motion. Easy balls settle; hot or awkward ones skip ahead and must be
gathered — that *is* the first touch. Your movement steers the settling
touch. A 30 m/s rocket cannot be controlled by an outfielder (it deflects);
neither can a ball 8 m in the air. There is no tackle immunity after
receiving and no enlarged pickup for nominated receivers.

## Passing

- **Tap PASS** (release within ~183 ms): to feet.
- **Hold PASS** (release after): the *same* receiver, led 3–6 m into space
  along his run. Holding never changes *who*, only *where*.
- The press shows the nominee (target ring); the destination is fixed at
  release and the ball is never steered mid-flight (~18–26 m/s by distance).
- The aim cone is ±42°: nobody behind your aim is ever picked. Nothing
  sensible inside → manual directional ball, no nominee.
- Control stays with the passer until the receiver actually touches it, so
  you can SWITCH to the runner mid-flight and guide him yourself.
- A defender who reaches the lane first intercepts — physically, not by roll.

## Shooting and the reticle

One action: **placement + power**. While charging, the HUD shows a goal
strip (posts, bar, aim dot): U across, V height. Full deflection can miss —
beyond ~0.85 U is outside the posts, above ~0.87 V is over the bar — so the
boundaries you see are the boundaries you get. No drag = quick low finish
on your facing. Power (0–450 ms hold) sets speed only, 25 → 35 m/s: a harder
strike lands in the same sector on a flatter arc. No automatic curl, no
sprint variant, no hidden spread.

A strike needs foot contact: owned balls always fire (the strike *is* the
next touch); loose balls fire within 1.2 m, buffer ~150 ms when contact is
imminent (first-time finishes), and cancel beyond that — the game never
remotely kicks a sprint touch 1.5 m ahead. Shooting with a marker draped
over you scuffs pace deterministically without moving your placement.

## Goalkeepers (and why your shot was saved)

Keepers read the ball, never your aim or inputs. Before the shot they
shuffle on the ball–goal angle (4.5 m/s). After release they take ~200 ms
to read it, predict the arrival, and commit to at most one bounded dive
(~1.8 m max). Then:

- **Slow/central at the body** → caught cleanly, and the keeper distributes.
- **Fierce or stretched contact** → parried outward into a live rebound that
  anyone can contest (never instantly re-caught).
- **Placed corner beyond reach** → goal. No miracle saves without reach.
- **Point-blank rockets** → goal; no human reacts in 60 ms either.
- **Wrong-footed or shaded keepers** concede the far side.

Close carriers invite a committed smother dive: it strips the ball outward
and gathers on the follow-through — never a proximity vacuum. Keepers
gather slow loose balls near the box but won't kamikaze 17 m and empty
the net. While holding, opponents are held at a 2 m cylinder (a movement
constraint, not a teleport).

## Tackling and slides

No dice anywhere — geometry decides, identically for every seed:

- **Standing (PASS):** short lunge window; the foot sweeps body→foot (~1.45 m
  max, ~25° of aim help). Solid contact knocks the ball loose (grazes glance
  off); a slow loose ball at the feet is gathered, never whacked into your
  own net. Quick recovery (~0.3–0.5 s).
- **Slide (SHOOT):** direction locks, ~750 ms committed, collision checked on
  *every* tick of the ~450 ms active sweep. Launching outside range and
  sliding into the ball wins late; ball-first contact may floor the carrier
  briefly; clean misses keep the attacker going and leave you recovering.
- Sidestepping a slide beats it. Beating the presser creates a real
  advantage — nobody else is already tackling.

## AI shape and roles

No ball-chasing pile. Each side holds persistent roles with ~20% hysteresis
(the incumbent keeps his job unless someone is materially better):

- **Exactly one presser** (or you, if you're actively pressing — the AI
  won't double up beside you), one goalside **cover** 4–6 m behind, the rest
  holding lanes, marking, and staying goal-side.
- **In possession:** width, staggered depth, short support angles, a backward
  outlet, and at most one committed forward runner (~1.1 s) for lead passes
  to find. The AI carrier decides a few times per second from scored options
  (clear shot, cross, safe outlet under pressure, runner lead, carry).
- **Keeper distribution** is a real phase: two deep diagonal outlets plus
  width and a second line open up within ~1.5 s; at most one opponent
  screens while the rest reorganise. Open outlets go short; covered ones are
  cleared long. After release, normal pressure returns with no protection.

## Restarts

~450 ms setup, your early input is buffered, and a ~4 s timeout takes a safe
short default so nobody stalls (online included). S (X) = short,
D (Circle) / W (Triangle) / A (Square) = long (corners, goal kicks);
throw-ins and kickoffs play short to a chosen outlet.

## Readability checklist (the playtest gate)

Lost it? It was a touch too far while sprinting, a lane defender's foot, a
smother dive, or a presser arriving as you held too long. Saved? Central or
at him (he catches those), or stretched (watch the rebound). Missed? Check
the reticle — full-deflection aims are outside the frame on purpose. Scored
on? The far corner while shaded, or a slow recovery after your missed slide.
