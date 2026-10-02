# Italy Rematch v2 — "The Commentator Who Never Left"

Status: **draft for owner review** (2026-10-02). Supersedes the silent v1 cut for audio/text; keeps the v1 picture story.

## Intent

A ~52 s comedy reel for the days before **Italy vs Türkiye, Mon 5 Oct 2026, Dall'Ara, Bologna**.
Four days after **Türkiye 1–4 Italy** (Mon 28 Sep, Bursa, in the rain), the scoreline follows
TR #9 through his morning — and a match commentator is *still calling the game*. The comedy is
openly self-deprecating about the loss (owner-approved). It ends on a clean 0–0 reset: no
predicted result.

**Success = a cold viewer, sound off, understands in 2 s:** Türkiye lost 1–4, it haunts #9,
there is a rematch on Monday. Sound on, they laugh at least three times.

**One dramatic question (asked at 0 s, answered at the end):** *Can he get the 1–4 out of his head
before Monday?* → he destroys it; the board reads 0–0.

## Facts we use (verified, ≥2 sources each)

Türkiye 1–4 Italy, UEFA Nations League A, 28 Sep 2026, Bursa, rain · Italy 3–0 up by 27' ·
Türkiye scored at 47', Italy answered 3 minutes later · Türkiye had 54 % possession and lost by
three · return leg Mon 5 Oct, Bologna. The "1-4 / 14" wordplay is our own invention, not a meme.

**Never on screen or in VO:** real names (coach, keeper, scorers), the keeper's errors, the
resignation chants. HNC players stay fictional and unnamed; we laugh at the scoreline, not at people.

## Who speaks (every line placeable — EP01 lesson)

| Speaker | Who | How the viewer places it |
|---|---|---|
| `COMM` | off-screen match commentator, breathless British broadcast energy | caption tag **🎙 COMMENTARY** + the persistent TV score bug (below) — it reads as "TV commentary", not a mystery voice |
| `NINE` | TR #9 on camera (existing L01 "Really?", L02 "Enough.") | existing tag **🇹🇷 #9** |

Voice (owner-locked 2026-10-02, "Qwen B"): **Qwen3-TTS 1.7B VoiceDesign** (Apache-2.0, local via
`mlx-audio`, `mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16`), fictional voice designed from text — no
reference person. Description, verbatim:
> Male English football radio commentator in his fifties from the north of England, gravelly slightly hoarse
> voice, strong northern English accent. Very excitable and fast, shouting on big moments, then deadpan and
> understated for the punchline.

Every line is generated exactly as auditioned: VoiceDesign with the description above plus a short
per-line delivery note. Identity is held by take selection, not cloning: several seeded takes per line,
keep the one closest (speaker-embedding cosine) to the approved audition take `qwen_B_T1.wav`
(committed as the episode's `vo/refs/COMM.wav`) among those with a clean transcript.
No further voice auditions (owner decision).
Pronunciation: "nil–nil" is voiced as "Nill-nill" (`say` override; caption keeps "nil–nil").
Disclosure: post with Instagram's AI-info label.
#9's two lines are re-voiced in **am_onyx** (owner's pick for #9; v1 dialogue.json has no voice set).
Language: English VO + **Turkish burned-in captions** (owner decision 2026-10-02; `subtitles: 'tr'`); hook carries a Turkish sub-line.

## Always-on text (sound-off viewers)

1. **Frame-0 hook** (HookBox over S00): `After Türkiye 1–4 Italy…` / TR `Türkiye 1–4 İtalya'dan sonra…`
2. **TV score bug**, top-left, broadcast style: `TUR 1–4 ITA` from S00 through S12. At S13 (board wipe) it
   flips to `ITA 0–0 TUR · MON 5 OCT`. This is the commentator's on-screen identity and the series of
   jokes' anchor. Hidden on the end card.
3. Burned-in speaker captions (existing Captions.tsx + new COMM tag).
4. End card: `ITALY vs TÜRKİYE · MON 5 OCT · BOLOGNA · HNC LEAGUE`.

## Script (timed to the retimed cut)

Durations are targets; `italy_rematch_cut.py` sizes VO shots from real take lengths after voicing.
Commentator pace ≈ 3 words/s; lines may pre-lap a cut.

| Shot | dur v1→v2 | Picture | Line |
|---|---|---|---|
| S00_SH01–03 | 2.2→2.6 | black → clock 1:04 → **1–4** | COMM L03 "Good morning, and welcome back to Bursa… sorry. His bedroom." |
| S00_SH04 | 0.9→1.4 | #9 opens one eye | COMM L04 "Still one–four." |
| S01_SH01 | 1.5→2.4 | one egg cracked → four eggs | COMM L05 "One egg in. Four out. Defending: familiar." |
| S01_SH02 | 1.6→2.2 | one espresso pressed → four cups | COMM L06 "He ordered one espresso. Italy ordered four." |
| S02_SH01 | 2.0 | elevator 1 → 4 → 1 → 4, ding | COMM L07 "Going down. Again." |
| S03_SH01 | 2.1→2.8 | 1:04 · 104.1 · TRIP 14 km, switched off | COMM L08 "Trip: fourteen kilometres. Sat-nav suggests… Bologna." |
| S04_SH01 | 2.5→2.8 | walk past bay 14, bus 14, door 14 | COMM L09 "Fifty-four percent possession. Of the pavement. Still lost." |
| S05_SH01 | 2.7→3.2 | regular counts 1… then 4 fingers | COMM L10 "The locals remember." → NINE L01 "Really?" |
| S06_SH01 | 2.2→2.6 | 1–4 passes in the glass only | COMM L11 "Twenty-seven minutes. Three goals. He still feels it." |
| S06_SH02 | 2.7 | doors open on giant 1 and 4 | COMM L12 "Oh no. They've travelled." |
| S07_SH01 | 2.8 | #9 bolts down the stairs | COMM L13 "He's going long! He's going… down the stairs." |
| S08_SH01 | 2.1 | exit, silence, he breathes | — (silence is the joke) |
| S08_SH02 | 1.1 | plate HNC 14 | — |
| S08_SH03 | 0.9→1.2 | #9 looks | NINE L02 "Enough." |
| S09_SH01 | 0.9→1.4 | ball slams down — genre switch, music | COMM L14 "Last Monday: Bursa." |
| S10_SH01 | 3.0 | beats the giant 1 | COMM L15 "Next Monday: Bologna." … "Past the one!" (L16) |
| S10_SH02 | 3.1 | beats the giant 4 | COMM L17 "Past the four!" |
| S11_SH01 | 3.1 | strike, 1–4 shatters | COMM L18 "And—" (impact carries the rest) |
| S12_SH01 | 1.8 | ball rolls through debris | — |
| S13_SH01 | 2.4 | board 1–4 wiped → 0–0; score bug flips | COMM L19 "Every scoreboard resets." |
| S14_SH01 | 2.7→3.0 | IT #8 espresso, crema 0–0, small smile | COMM L20 "Even the Italian ones." |
| S15_SH01 | 2.5→2.8 | #9 and #8 walk out together | COMM L21 "Monday. Bologna. Nil–nil… for now." |
| S16_SH01 | 1.7 | end card | — (brand sting) |

Runtime ≈ 52 s (v1 48.5 s).

## Picture fixes (from the 2026-10-02 low-fi still review)

Stills: `social/output/player-diaries/italy-rematch/lofi-stills/page1–8.png` (`pages.txt` maps rows → shots).

**Continuity (all shots):** #9 wears `home` from S00 through S08; `kit` only from S09 (the genre
switch is the costume change). Changes S02_SH01, S06_SH01, S06_SH02, S07_SH01 from `kit` → `home`.

| Shot | Problem seen | Fix |
|---|---|---|
| S00_SH02 | the "4" of 1:04 is cropped at frame edge; no snooze hand | reframe so the whole display sits in the centre third; hand enters to hit snooze |
| S00_SH03 | reads "1:4" (colon kept) — a broken time, not a score | display becomes **1–4** (dash, colon segments off) |
| S00_SH04 | camera misses him: empty wall | re-aim on the actual head after `P.lie`; one eye opens toward the red glow |
| S01_SH01 | no hands; four eggs ≠ "1–4" | hands visible cracking one egg; keep the four-egg reveal — L05 ("One egg in. Four out.") carries the 1→4 |
| S01_SH02 | cups in a black void, overlapping; machine invisible | light the machine and counter; four cups in a clean row, no intersections; one-button press visible |
| S02_SH01 | back-only, kit | home look; side angle so his face reads the display flip |
| S03_SH01 | white arm fills frame; **TRIP 14 km renders mirrored**; labels unreadable | fix label rotation/facing; camera on the dashboard displays with his hand entering, not his shoulder |
| S04_SH01 | **#9 not in any frame**; courier = the bakery regular | camera tracks with #9 (he is always in frame); remove the courier (the regular's first appearance becomes S05) |
| S05_SH01 | single raised finger beside the face reads rude; counts 4→1 (score backwards); #9 cropped | count **1 then 4** with the hand away from the face, palm out; frame both faces |
| S06_SH01 | 14 sign visible directly, not reflection-only | the 1–4 exists only in the glass; he turns, the corridor is empty |
| S06_SH02 | flat "14" panel, #9 half off frame | two free-standing giant **1** and **4** inside the car, like commuters; #9 fully in frame |
| S07_SH01 | motifs barely visible | floor numbers 1/4 big on the landing walls; keep the closing approach (works) |
| S09_SH01 | mint pitch looks like plastic floor | darker natural turf grade, night-training key light |
| S10_SH01/02 | grey numbers on navy: low contrast | numbers lit (rim + warm key) so they read as opponents |
| S11_SH01 | #9 tiny in a wide shot; strike from behind | tighter, 3/4 angle on the strike, then the shatter (hero VFX stays a later unit) |
| S14_SH01 | #8 first seen at 41 s, unknown; crema too small | caption tag **🇮🇹 #8** on first appearance; macro on the 0–0 crema before the smile |

Kept as is: S08_SH02 plate, S13 board wipe, S15 tunnel (strongest frame), S12.

## Engineering units

1. **Voice** — `dialogue.json`: add `COMM` speaker + L03–L21; set NINE to am_onyx; audition, owner picks; voice.
2. **Cut** — `tools/diaries/italy_rematch_cut.py`: retime, dialogue cues, hook, score-bug data → regenerate `edit.json`.
3. **Remotion** — HookBox over non-phone shots; new `ScoreBug` overlay driven by edit data; `COMM` + `IT8`
   caption tags; end card copy (MON 5 OCT · BOLOGNA).
4. **Blender** — the picture fixes above, shot by shot, verified with low-fi stills each.
5. **Animatic** — `plates --quality animatic` + `audio` + `edit` → contact sheet + frame review → iterate.

Out of scope: hero fracture VFX polish (S11), final60 render.

## Pipeline fix found during review

`diaries-shot` exits 0 when a shot raises (S14/S15 failed on `hnc-player-it-08 not exported`
and still returned success). Batch scripts must check for `HNC_RESULT` in the log.
