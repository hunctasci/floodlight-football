"""EP01 cut: applies screenplay-v3, then screenplay-v4, to the v2 edit (git HEAD:edit.json).

    python3 tools/diaries/ep01_cut.py

Re-runnable: always rebuilds from the committed v2 edit, and sizes every
voice-over shot from the real take length in vo/voices.json (estimate when a
take does not exist yet), so re-voicing a line and re-running keeps the cut
honest. See social/player-diaries/ep01/screenplay-v3.md and screenplay-v4.md.
"""
import copy
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EDIT = REPO / "packages/reels/src/diaries/ep01/edit.json"
VOICES = REPO / "packages/reels/public/generated/diaries/ep01/vo/voices.json"

v2 = json.loads(subprocess.check_output(["git", "show", "HEAD:packages/reels/src/diaries/ep01/edit.json"], cwd=REPO))
voices = json.loads(VOICES.read_text()) if VOICES.exists() else {}
seconds = lambda line: voices.get(line, {}).get("seconds", 2.6)  # noqa: E731
shots = {s["id"]: s for s in v2["shots"]}
order = [s["id"] for s in v2["shots"]]


def shot(sid, **kw):
    s = copy.deepcopy(shots[sid]) if sid in shots else {}
    s.update(kw)
    s["id"] = sid
    return s


def vo(s, line, at, tail=0.35):
    """Place a voice-over line and make the shot long enough to hold it (+ a breath)."""
    s.setdefault("dialogue", []).append({"line": line, "at": at})
    s["dur"] = round(max(s["dur"], at + seconds(line) + tail), 2)
    return s


out = []
for sid in order:
    s = shots[sid]
    if sid == "S01_SH01":
        out.append({
            "id": "S00_SH01", "scene": "S00", "dur": 6.0, "renderer": "remotion", "phone": "open",
            "hook": "POV: 48 hours before you play Belgium",
            "location": "phone", "framing": "full-screen phone: family group chat, then Lucas's DM", "lens": "-", "move": "-",
            "action": "06:46. Mum's links, ur late, out of salt, ok. Lucas 🇧🇪: see you friday 🙂. He types 'ask belgium.', deletes it, locks the phone.",
            "light": "screen", "transition": "cut to black (the phone locks)",
            "purpose": "Hook: native group-chat format + four planted payoffs + an unsent reply.",
            "sfx": [{"cue": "night-room", "at": 0.0, "gain": 0.25, "dur": 6.0}]
                   + [{"cue": "message-in", "at": t} for t in (0.2, 0.8, 1.35, 2.0, 2.65)]
                   + [{"cue": "message-out", "at": 3.25}, {"cue": "phone-buzz", "at": 3.75, "gain": 0.6}]
                   + [{"cue": "key-taps", "at": 4.5}, {"cue": "key-delete", "at": 5.55}, {"cue": "phone-lock", "at": 5.95}],
        })
        out.append(shot(sid, action="Black: the phone is locked. A question in the dark.", purpose="The interview's first question lands on the unsent reply."))
    elif sid == "S02_SH04":
        out.append(vo(shot(sid, action="You're late. He stares at the ceiling. VO: I've been awake since four. Don't tell him."), "L31", 1.15))
    elif sid == "S03_SH01":
        s1 = shot(sid, dur=1.5, framing="ECU: his hand cracks an egg on the pan rim; it slides into hot oil", lens="100mm f/2.8",
                  action="Tap, crack, the halves open, the egg slides into the oil. VO: My father made eggs before every game I ever played.",
                  dialogue=[], sfx=[{"cue": "room-morning", "at": 0.0, "gain": 0.35, "dur": 9}, {"cue": "egg-crack", "at": 0.45, "gain": 0.7},
                                    {"cue": "sizzle", "at": 0.85, "gain": 0.8, "dur": 6.5}])
        out.append(vo(s1, "L32", 0.1, tail=0.15))
    elif sid == "S03_SH02":
        out.append(shot(sid, dur=3.5, dialogue=[{"line": "L06", "at": 0.0}, {"line": "L07", "at": 2.0}, {"line": "L08", "at": 2.58}],
                        sfx=[{"cue": "pan-shuffle", "at": 1.3}]))
    elif sid == "S03_SH03":
        s3 = shot(sid, action=s["action"] + " VO: Eleven years. She has never let me finish a coffee.")
        out.append(vo(s3, "L33", 2.45, tail=0.3))
    elif sid == "S04_SH01":
        out.append(shot(sid, dialogue=[{"line": "L10", "at": 0.15}]))
    elif sid == "S05_SH05":
        out.append(vo(shot(sid, action="TWO. A small smile as he reaches the door. VO: He asked my father for two goals. Thirty years ago."), "L34", 1.05, tail=-0.6))
    elif sid == "S06_SH07":
        out.append(vo(shot(sid, action="Breath. Keeper sets. VO: This is the only place it goes quiet."), "L35", 0.25, tail=0.25))
    elif sid == "S07_SH04":
        out += [
            {"id": "S07_SH04", "scene": "S07", "dur": 1.3, "renderer": "blender", "location": "living", "framing": "MS: #9 on the sofa gives in",
             "lens": "35mm f/2.8", "move": "locked-off", "action": "He exhales, lifts the ice off his knee, stands.", "light": "same", "transition": "cut",
             "purpose": "He gives in.", "sfx": [{"cue": "ice-crinkle", "at": 0.25, "gain": 0.6}, {"cue": "cloth", "at": 0.7}]},
            {"id": "S07_SH05", "scene": "S07", "dur": 2.2, "renderer": "blender", "location": "living", "framing": "WS two-shot on the rug: passes",
             "lens": "28mm f/4", "move": "handheld, slight follow", "action": "Soft passes back and forth on the rug; Dad shows off a little (a sole drag).",
             "light": "same", "transition": "cut", "purpose": "Play.",
             "sfx": [{"cue": "touch", "at": t, "gain": 0.5} for t in (0.25, 0.85, 1.35, 1.75)]},
            {"id": "S07_SH06", "scene": "S07", "dur": 1.0, "renderer": "blender", "location": "living", "framing": "low, rug level: the kid nutmegs Dad",
             "lens": "24mm f/4", "move": "locked-off", "action": "The ball goes through Dad's legs.", "light": "same", "transition": "cut",
             "purpose": "The kid wins.", "sfx": [{"cue": "touch", "at": 0.2, "gain": 0.6}]},
        ]
        s7 = {"id": "S07_SH07", "scene": "S07", "dur": 2.4, "renderer": "blender", "location": "living",
              "framing": "MWS: two sofa cushions as a goal; the kid scores, then Dad's turn-away", "lens": "35mm f/2.8", "move": "locked-off",
              "action": "Goal between the cushions. The kid turns away without celebrating — Dad's move. Dad watches, the half-smile. VO: He's the only defender I'm afraid of.",
              "light": "same", "transition": "cut", "purpose": "Inheritance, played for a laugh.", "sfx": [{"cue": "ball-set", "at": 0.35, "gain": 0.7}]}
        out.append(vo(s7, "L36", 0.75, tail=0.2))
        out.append(shot("S07_SH08", **{k: v for k, v in s.items() if k != "id"}))
    elif sid == "S07_SH05":
        out.append(shot("S07_SH09", **{k: v for k, v in s.items() if k != "id"}))
        out.append({"id": "S07_SH10", "scene": "S07", "dur": 0.9, "renderer": "blender", "location": "living",
                    "framing": "WS: both frozen, each points at the other", "lens": "28mm f/4", "move": "locked-off",
                    "action": "Both point at each other: it was him.", "light": "same", "transition": "cut", "purpose": "Button.", "sfx": []})
    elif sid == "S08_SH07":
        out.append(vo(shot(sid, action="His shoulders sink a millimetre. VO: She told me at six forty-six."), "L37", 0.45, tail=0.3))
    elif sid == "S09_SH04":
        out.append(vo(shot(sid, action="Child asleep in the #9 shirt. VO: At his age I slept in my father's shirt too."), "L38", 0.25, tail=0.2))
    elif sid == "S11_SH03":
        s11 = shot(sid, action="Into the light. VO: …I've been awake since four. Then the roar. WHITE.")
        vo(s11, "L39", 0.3, tail=0.55)
        s11["sfx"] = [{"cue": "crowd-roar", "at": round(s11["dur"] - 0.5, 2), "gain": 1.0}]
        out.append(s11)
    elif sid == "S11_SH04":
        out.append(shot(sid))
        out.append({"id": "S12_SH01", "scene": "S12", "dur": 2.6, "renderer": "remotion", "phone": "teaser",
                    "location": "phone", "framing": "full-screen phone: Coach's message", "lens": "-", "move": "-",
                    "action": "Buzz. Coach: my office. 8am. (placeholder until the EP02 premise is set)", "light": "screen", "transition": "end",
                    "purpose": "The next-episode hook.", "sfx": [{"cue": "phone-buzz", "at": 0.15, "gain": 0.6}, {"cue": "message-in", "at": 0.35}]})
    else:
        out.append(copy.deepcopy(s))

# ---------------------------------------------------------------- v4 (screenplay-v4.md)
# One question ("are you nervous??" — "no." — his son: "he is"), one narrator (the diary VO), no
# interviewer voice (her questions are on-screen cards), day/time stamps for the countdown.
by_id = {s["id"]: s for s in out}


def cards(sid, *cs):
    by_id[sid]["cards"] = [{"text": t, "at": at, "dur": d} for t, at, d in cs]


def lines(sid, *ls):
    by_id[sid]["dialogue"] = [{"line": l_, "at": at} for l_, at in ls]


def fit(sid, tail=0.3):
    """Shot long enough for its last line (+ a breath)."""
    s = by_id[sid]
    end = max([d["at"] + seconds(d["line"]) for d in s.get("dialogue", [])] + [0])
    s["dur"] = round(max(s["dur"], end + tail), 2)


s0 = by_id["S00_SH01"]
s0.update(dur=6.4, hook="POV: you play Belgium in 48 hours",
          framing="full-screen phone: the family group chat",
          action="06:46. Mum: they said on tv you look tired / are you nervous?? He types 'ask belgium.', deletes it, sends 'no.'. "
                 "Aşkım: we're out of salt. His son: he is. The phone locks.",
          transition="cut to black (the phone locks), then the title", purpose="Hook + the episode's one question, answered by his son.",
          sfx=[{"cue": "night-room", "at": 0.0, "gain": 0.25, "dur": 6.4}, {"cue": "message-in", "at": 0.25}, {"cue": "message-in", "at": 1.05},
               {"cue": "key-taps", "at": 1.8}, {"cue": "key-delete", "at": 3.1}, {"cue": "message-out", "at": 3.75},
               {"cue": "message-in", "at": 4.45}, {"cue": "message-in", "at": 5.45}, {"cue": "phone-lock", "at": 6.3}])
out = [s for s in out if s["id"] not in ("S01_SH01", "S01_SH02")]  # the interviewer's voice + the night drive
by_id = {s["id"]: s for s in out}
by_id["S02_SH01"]["stamp"] = "Wednesday · 06:47"
s2 = by_id["S02_SH02"]
s2.update(action="Alarm off — his eye is already open (VO: I've been awake since four). The kid, in Dad's #9, at the bed: You're late. — For what?")
lines("S02_SH02", ("L39", 0.3), ("L03", 2.05), ("L40", 3.15))
fit("S02_SH02", 0.35)
by_id["S02_SH03"].update(framing="reverse, low from the pillow: the kid lifts the ball into view", action="He holds up the ball. Says nothing.", purpose="What he's late for.")
s4 = by_id["S02_SH04"]
s4.update(dur=1.7, action="Not today. He stares at the ceiling. Exhales.")
lines("S02_SH04", ("L41", 0.15))
s31 = by_id["S03_SH01"]
lines("S03_SH01", ("L32", 0.1))
s31["dur"] = 1.5
fit("S03_SH01", 0.15)
cards("S03_SH02", ("Special diet before Belgium?", 0.0, 1.75), ("That's it?", 2.25, 1.15))
lines("S03_SH02", ("L07", 1.55))
by_id["S03_SH02"]["dur"] = 3.5
s33 = by_id["S03_SH03"]
s33["dur"] = 2.65
lines("S03_SH03", ("L09", 0.12), ("L33", 2.45))
fit("S03_SH03", 0.3)
cards("S04_SH02", ("You don't listen to that stuff?", 0.0, 1.6))
lines("S04_SH02", ("L12", 1.45))
s55 = by_id["S05_SH05"]
s55["dur"] = 1.3
lines("S05_SH05", ("L16", 0.22), ("L34", 1.05))
fit("S05_SH05", -0.6)
# the button on "…all of it anyway": the dash phone lights up with Mum's links (hybrid insert)
i = next(n for n, s_ in enumerate(out) if s_["id"] == "S04_SH03")
out[i]["sfx"] = [c for c in out[i].get("sfx", []) if c["cue"] != "phone-buzz"]
out.insert(i + 1, {"id": "S04_SH04", "scene": "S04", "dur": 1.2, "renderer": "hybrid", "location": "car-day",
                   "framing": "insert from above: the phone on the dash", "lens": "50mm f/2.4", "move": "tiny push",
                   "action": "Buzz. The lock screen lights up: three links from Annem.", "light": "daylight + screen glow",
                   "transition": "cut", "purpose": "Proof: she sends him all of it.", "sfx": [{"cue": "phone-buzz", "at": 0.1, "gain": 0.7}]})
by_id = {s_["id"]: s_ for s_ in out}
cards("S06_SH03", ("Everyone wants to know what happens Friday.", 0.0, 2.7))
lines("S06_SH03")
by_id["S07_SH01"]["stamp"] = "Wednesday · 16:20"
by_id["S08_SH01"]["stamp"] = "Wednesday · 20:10"
cards("S09_SH01", ("Does pressure get to you?", 0.0, 1.3))
lines("S09_SH01", ("L23", 0.35))
by_id["S09_SH01"]["stamp"] = "Thursday · 23:10"
fit("S09_SH01", 0.3)
cards("S09_SH02", ("Last one.", 0.0, 0.95))
lines("S09_SH02", ("L25", 0.75))
cards("S09_SH03", ("What does playing for Türkiye mean to you?", 0.0, 2.1))
lines("S09_SH03")
by_id["S10_SH01"]["stamp"] = "Friday · 08:30"
by_id["S10_SH07"]["stamp"] = "Friday · 19:05 · Brussels"
cards("S11_SH01", ("Still not nervous?", 0.15, 1.35))
lines("S11_SH01")

# title / match / end cards are data (PlayerDiaries `screen`), not shot ids
by_id = {s_["id"]: s_ for s_ in out}
by_id["S01_SH03"]["screen"] = {"type": "title", "title": "48 Hours Before Belgium", "kicker": "HNC Player Diaries · Episode 01"}
by_id["S10_SH09"]["screen"] = {"type": "match", "home": "Belgium", "away": "Türkiye", "line": "Friday · 20:45"}
by_id["S11_SH04"]["screen"] = {"type": "end", "series": "Player Diaries · Episode 01"}

edit = dict(v2, version="v4-one-question", shots=out)
EDIT.write_text(json.dumps(edit, indent=2, ensure_ascii=False) + "\n")
missing = [d["line"] for s in out for d in s.get("dialogue", []) if d["line"] not in voices]
print(f"edit v4: {len(out)} shots, {sum(s['dur'] for s in out):.2f} s" + (f"  (estimated takes: {', '.join(missing)})" if missing else ""))
