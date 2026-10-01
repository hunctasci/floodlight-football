# Animatic v3 review — 48 Hours Before Belgium

Reviewed: `social/output/player-diaries/ep01-belgium/animatic-v3.mp4` (111.4 s, 70 shots, animatic plates
at 40 %, real mix, burned-in captions), the 1 fps contact sheets `qa/v3/animatic-v3-sheet*.png`, and
full-size stills of every rebuilt shot (`qa/v3/`).

## What v3 changed (from the owner's notes)

| Note | v3 |
|---|---|
| Dull open, no hook | **S00 family group chat**: the frame-0 POV hook ("POV: 48 hours before you play Belgium"), a message every ~0.7 s, Lucas 🇧🇪's DM, "ask belgium." typed and deleted, phone locks → "Are you nervous?" |
| #9 barely talks; feeling doesn't come across | **Diary voice-over**: 9 lines (L31–L39), with the father thread and the "awake since four" reveal at the end; **talk()** body language on every on-camera line; **speaker captions** burned in |
| Egg doesn't look like an egg | Real egg profile, cracked on the rim by his hand, two shell halves; the fried egg rebuilt as two objects, so the yolk can't spike |
| The cup turns around | Root causes fixed: (1) the carafe was driven by a hand roll on the wrong axis, so it now leads and the hand follows its handle; (2) the partner stood ~1.1 m from the mug, so the auto-grip swung it around her far-away hand. She now stands beside him, leans in, and a guard checks the grab |
| Kid scene too short | the play goes from 1.3 s to ~11 s (whole scene 14.7 s): he gives in → passes + drag-back → nutmeg → cushion goal + the kid's no-celebration turn-away + VO "He's the only defender I'm afraid of." → lamp → "Careful!" → both point at each other |
| — | **EP02 teaser**: Coach: "my office. 8am." (placeholder copy) |

## Retention checkpoints

| Window | Read |
|---|---|
| 0–3 s | Strong: hook box on frame 0, Mum's messages arriving. Native, like our best-performing reel. |
| 3–10 s | Strong: notification → DM → unsent "ask belgium." → "Are you nervous?" → "Ask Belgium." |
| 15–25 s | Good: the voice-over lands ("awake since four", "my father made eggs") over the egg crack. |
| 30–40 s | Coffee joke reads now (her arm across him, the mug leaves upright), then the car. |
| 50–60 s | Training: the voice-over "the only place it goes quiet" holds the telephoto breath. |
| 57–72 s | The kid scene: the new emotional centre of the home half. |

## Known issues to fix before the final render

1. **S07_SH05/SH07** — Dad is mostly seen three-quarter from behind; his smile in SH07 is small on screen.
   A closer reverse on Dad for the smile would sell the "inheritance" beat.
2. **S03_SH01** — the bottom third of the egg ECU is dark cooktop (the higher camera keeps his leaning
   head out of frame).
3. **S03_SH03** — her head is cropped at frame right during the take; acceptable, but a slightly wider
   framing would show her face.
4. **Runtime 111 s.** Every 2–4 s something changes, but the owner should judge the pace. The cheapest trims
   if needed: S04 radio, S09 inserts, or one VO line (V04 bakery or V05 training).
5. **S04_SH03** — the screenplay's "Mum's links light up the dash phone" isn't built yet (only the buzz plays).
6. Whisper hears "six forty-six" as "646" (L37); the take itself is right.

## Next

Owner reviews `animatic-v3.mp4`. After approval: fix items 1–3 if wanted, then
`npm run diaries -- plates --quality final --jobs 3 --adopt`. Every shot re-renders (shared rig/props code
changed). That's about 6,700 frames, roughly 4 h on this Mac (last session: 3,400 frames ≈ 2 h), so run it overnight. Then `edit`, `master`, sheet, `copy.md`.
