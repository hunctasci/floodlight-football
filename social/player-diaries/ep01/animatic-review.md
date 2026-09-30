# Animatic v1 review — 48 Hours Before Belgium

Reviewed: `animatic-v1.mp4` (81.19 s, 63 shots, animatic plates at 40 %), the
1 fps contact sheet `qa/animatic-v1-sheet.png`, and full-size problem frames
`qa/av1-problems.png`. Audio from the real mix (ASR-verified takes, designed
SFX, the original score).

## Verdict

The story works and the arc is right — hook → domestic comedy → the football
switch → the dry salt edit → sincerity → matchday → callback. **It is 9 s too
long and five key beats are unreadable.** Fix structure and readability before
any polish.

## Runtime

81.2 s vs the 65–72 s target. Scene budget vs brief:

| Scene | v1 | Brief | Note |
|---|---|---|---|
| S01 cold open | 3.8 | 3 | title can be 0.15 s tighter |
| S02 morning | 6.2 | 6 | ok |
| S03 breakfast | 6.7 | 7 | stove shot holds 0.3 s after "That's it?" |
| S04 drive | 6.8 | 6 | passenger-seat opener is dead air |
| S05 supporter | 7.0 | 7 | walk-over a touch slow |
| S06 training | 9.3 | 9 | ok — the best-paced stretch |
| S07 recovery | 7.0 | 7 | opening wide holds too long before the child |
| S08 dinner | 7.4 | 8 | ok, but the joke's two CUs are unreadable (below) |
| S09 what it means | **13.8** | 9 | where the overrun lives — see below |
| S10 matchday | 7.0 | 6 | inserts fine; the doors are unreadable |
| S11 callback | 6.1 | 4 + card | end card can be shorter |

The locked dialogue alone in S09 is 8.3 s, so S09 cannot hit 9 s without
cutting lines. Plan: J-cut the answer over the inserts (start "You feel like
everyone's coming with you" two inserts earlier), keep the pause before "Even
when you're playing away" (~0.5 s, it is the emotional beat) and trim the
frame-hold around every interview line. Target S09 ≈ 12 s and win the rest back
across the film in 0.1–0.3 s trims — none of them inside a comedy pause.

## What drags

- **17–19 s (S04_SH01):** passenger-seat view is mostly dashboard; #9 is at
  the frame edge while a 5.5 s radio line plays. Retention risk right at the
  15–25 s checkpoint. → Re-aim at #9, cut to 1.3 s, shorten the radio copy
  (it runs under the next line anyway and is cut by the off-click).
- **39.7–41.3 s (S07_SH01):** a static wide of a man on a sofa for 1.6 s,
  and his seated pose reads stiff. → 1.1 s; relax the pose (lean back, leg up
  on the table edge, arm on the backrest).
- **54–68 s (S09):** four near-identical interview frames. It earns its
  sincerity but the frame-holds are generous. → trims above; vary the push.

## What is confusing / unreadable

1. **S08_SH06 "Needs salt."** — the partner's face is turned away; the line
   lands on the back of a head. **The biggest joke in the film cannot fail on
   a camera angle.** → frontal CU, lit by the table pendant.
2. **S08_SH07 the devastated reaction** — nearly black, back of #9's head.
   → frontal CU, warm key; the reaction is eyes-down + a millimetre of chest.
3. **S10_SH06 / SH07 the match cut** — both doors are black slabs in shadow;
   the car door never reads as a car door and #9 is not visible stepping out
   of the bus. **This is "the expensive cut" and it currently reads as
   nothing.** → light both sides (morning sun rake + sky reflection on the
   paint), frame wider so the car is legible, #9 visible through the glass
   as the car door closes, and on the bus side his red top framed in the
   opening as the door slides away. Same screen line, same leftward motion.
4. **S06_SH09 the net** — only the keeper's legs; no ball, no net. → reframe
   from behind the goal, off-axis, so the net bulge is the picture.
5. **S02_SH02 the bed** — the head reads, the bed does not (a pale block
   beside the face). → soften and lower the duvet line, lift the dawn key,
   let the pillow read.
6. **S09 inserts** — boots, bag and phone are too dark to register at
   0.4–0.6 s. Child asleep and the empty tunnel are good. → brighter practicals,
   tighter framing; the phone's World Table must be legible (it is the only
   in-film HNC UI moment).

## Which joke misses (and which work)

- **Works:** "You're late / I'm not late / (points) / You're late" — the
  reverse onto the child is a small reveal and the timing sits. The bakery
  "Two goals / Good morning / TWO" plays well, the smile at the door lands.
  "Not now." → stare → hard cut to playing: works; the 1.0 s stare is right.
- **Misses today (fixable):** the coffee joke is almost there — pour, fill,
  the hand takes the mug — but his eyes following the cup need a clearer
  beat (hold the empty pour position a moment). "Needs salt." misses purely on
  the camera angle (above). The smash cut to "Pressure doesn't really affect
  me" works rhythmically — keep the 1.05–1.1 s reaction; **do not trim it**.

## Too long / too short

- Too long: S04_SH01 (1.8), S07_SH01 (1.6), S09_SH10 (3.4), end card (1.6),
  S01 title (1.1).
- Too short: nothing critical. The matchday inserts at 0.4 s are right for the
  montage rhythm; the S09 inserts can each lose 0.05 s but no more.

## Retention checkpoints

| Window | Read |
|---|---|
| 0–3 s | Strong: voice in black → premium car profile → smash title by 2.7 s. |
| 3–10 s | Good comedy, weak picture (dark bed). Fix the bed read. |
| 15–25 s | Weakest: dead car opener + a long radio line. Fix per above. |
| 30–40 s | Strong: training montage, the strike, the turn-away. |
| 50–60 s | Joke works in the edit but its CUs are unreadable; interview holds long. |

No dead 8-second patch remains once S04_SH01 and S09 are tightened: every
2–4 s something changes (location, a line, a joke, a football beat).

## Changes for v2 (applied)

- Timing: every shot re-cut in `edit.json` (target ≤ 72.5 s); L17 starts a
  shot earlier (over the touch), L27 J-cuts two inserts earlier, L10 radio copy
  shortened, five long lines re-voiced 4 % faster (still ASR-verified).
- Readability pass on: S02_SH02, S04_SH01, S06_SH09, S07_SH01, S08_SH06,
  S08_SH07, S09 inserts (boots, bag, phone), S10_SH06, S10_SH07, S10_SH08.
- Then production passes (lighting, materials, camera) and final renders.
