"""'One Goal Between Us' cut -> packages/reels/src/diaries/rivals/edit.json.

    python3 tools/diaries/rivals_cut.py

Two interview rooms, cross-cut (TR #9 warm, eyeline camera-left; BE #4 cool, eyeline
camera-right), the history as the two kids remembered it, the tunnel in Liège tonight.
Shots are sized from the real take lengths (vo/voices.json); re-run after re-voicing.
Facts (verified 2026-10-01, TFF/UEFA/ESPN): 11 matches since 1957, 3 wins each, 5 draws,
goals 18–17 to Belgium; 2000 Brussels 0–2 (the co-hosts out); 2010 Istanbul 3–2 (78');
last met 3 June 2011; tonight Fri 2 Oct 2026, Liège, 21:45 TSİ; return 12 Nov.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EDIT = REPO / "packages/reels/src/diaries/rivals/edit.json"
VOICES = REPO / "packages/reels/public/generated/diaries/rivals/vo/voices.json"
voices = json.loads(VOICES.read_text()) if VOICES.exists() else {}
secs = lambda l: voices.get(l, {}).get("seconds", 1.6)  # noqa: E731
missing = set()

TR_SUPER = {"title": "Türkiye · #9", "sub": "Striker · Forvet", "side": "left", "color": "#e30a17"}
BE_SUPER = {"title": "Belgium · #4", "sub": "Defender · Defans", "side": "right", "color": "#c99a06"}
# Every question card is bilingual (the audio is English; the subtitles are Turkish).
TR_CARDS = {
    "Say something nice about Belgium.": "Belçika hakkında güzel bir şey söyle.",
    "Say something nice about Türkiye.": "Türkiye hakkında güzel bir şey söyle.",
    "When did it start?": "Her şey ne zaman başladı?",
    "June 2000?": "Haziran 2000?",
    "And 2010?": "Ya 2010?",
    "So who's winning?": "Peki kim önde?",
    "What do you respect about him?": "Ona en çok neyine saygı duyuyorsun?",
}
ROOM = {"TR": "interview-tr (warm)", "BE": "interview-be (cool)"}
CAM = {"A": ("MCU", "50mm f/2"), "B": ("profile CU", "85mm f/2"), "C": ("room wide", "24mm f/2.8")}
shots = []


def read(text):
    """Seconds to read a card before the answer lands (the answer may start under it)."""
    return 0.55 + 0.035 * len(text)


def chair(sid, who, cam, lines=(), card=None, push=0.0, act=(), tail=0.35, dur=None, super_=None, purpose="", sfx=None, light=None):
    s = {"id": sid, "scene": sid[:3], "renderer": "blender", "location": ROOM[who], "who": who, "cam": cam,
         "framing": CAM[cam][0], "lens": CAM[cam][1], "move": "slow push" if push else "locked-off",
         "action": "", "light": light or ("warm Rembrandt key, amber practical" if who == "TR" else "cool key, blue fill, white practical"),
         "transition": "cut", "purpose": purpose}
    t = 0.0
    if card:
        s["cards"] = [{"text": card, "tr": TR_CARDS[card], "at": 0.0, "dur": round(max(1.4, read(card) + 0.7), 2)}]
        t = round(read(card) * 0.8, 2)
    dl = []
    for line, gap in lines:
        t = round(t + gap, 2)
        dl.append({"line": line, "at": t})
        if line not in voices:
            missing.add(line)
        t += secs(line)
    if dl:
        s["dialogue"] = dl
    s["dur"] = round(dur if dur else max(1.0, t + tail), 2)
    if push:
        s["push"] = push
    if act:
        s["act"] = [list(a) for a in act]
    if super_:
        s["super"] = super_
    s["sfx"] = sfx if sfx is not None else [{"cue": "interview-tone", "at": 0.0, "gain": 0.35 if who == "TR" else 0.3}]
    shots.append(s)


def tv(sid, after, line, at, score, purpose="The memory, on the TV of the time."):
    """Cut away mid-line to the remembered broadcast: the line (placed in the previous chair shot,
    which is cut short at ``after`` s) keeps running over the TV; no close-up holds past ~3.5 s."""
    rest = round(at + secs(line) + 0.35 - after, 2)
    shot(sid, max(1.2, rest), "remotion", "tv", "the TV picture", "-", "-", f"{score['home']} {score['hs']}–{score['as']} {score['away']} · {score['line']}", purpose,
         screen={"type": "tv", "score": score}, sfx=[{"cue": "crowd-muffled", "at": 0.0, "gain": 0.35, "dur": max(1.2, rest)}])


def shot(sid, dur, renderer, location, framing, lens, move, action, purpose, **kw):
    s = {"id": sid, "scene": sid[:3], "dur": dur, "renderer": renderer, "location": location, "framing": framing, "lens": lens,
         "move": move, "action": action, "light": kw.pop("light", "-"), "transition": kw.pop("transition", "cut"), "purpose": purpose}
    s.update(kw)
    for d in s.get("dialogue", []):
        if d["line"] not in voices:
            missing.add(d["line"])
    shots.append(s)


# ---------------------------------------------------------------- S00 the opener · S01 the DM
# Football from frame 0: kinetic bilingual stats over match-world shots, an open loop, then the title.
def kin(sid, dur, location, framing, en, tr, sub=None, cue="sub-hit", gain=0.6, extra=()):
    shot(sid, dur, "blender", location, framing, "-", "cut on the beat", f"{en} / {tr}", "Opener beat.",
         kinetic={"en": en, "tr": tr, **({"sub": sub} if sub else {})}, sfx=[{"cue": cue, "at": 0.0, "gain": gain}, *extra])


kin("S00_SH01", 1.5, "stadium", "tracking past supporters behind the barrier, phone flashes", "Belgium vs Türkiye", "Belçika – Türkiye",
    sub="Tomorrow · Yarın · 21:45", gain=0.7, extra=[{"cue": "crowd-grow", "at": 0.0, "gain": 0.7, "dur": 1.5}, {"cue": "flashes", "at": 0.1}])
kin("S00_SH02", 1.15, "training", "low 3/4: plant, hips, strike", "69 years · 11 matches", "69 yıl · 11 maç", extra=[{"cue": "strike", "at": 0.5}])
kin("S00_SH03", 1.15, "training", "behind the goal: the net bulges", "3 wins each · 5 draws", "Üçer galibiyet · 5 beraberlik", extra=[{"cue": "net", "at": 0.12}, {"cue": "crowd-roar", "at": 0.15, "gain": 0.6}])
shot("S00_SH04", 1.6, "remotion", "card", "the all-time score", "-", "-", "18–17", "The number the whole film argues about.",
     screen={"type": "opener", "beats": [{"at": 0.0, "en": "🇧🇪 18–17 🇹🇷", "tr": "Belgium +1 · Belçika +1", "kind": "big"}]},
     sfx=[{"cue": "sub-hit", "at": 0.0, "gain": 0.8}])
kin("S00_SH05", 1.8, "tunnel", "from behind: #9 and #4, level, walking to the light", "…and one night in Brussels nobody forgot", "…ve Brüksel'de unutulmayan bir gece",
    gain=0.5, extra=[{"cue": "tunnel-steps", "at": 0.0}, {"cue": "crowd-muffled", "at": 0.0, "gain": 0.5, "dur": 1.8}])
shot("S00_SH06", 1.9, "remotion", "title", "title card", "-", "-", "ONE GOAL BETWEEN US", "The title.",
     screen={"type": "opener", "beats": [{"at": 0.0, "en": "One goal between us", "tr": "Aramızda tek gol var", "kind": "title"}]},
     sfx=[{"cue": "sub-hit", "at": 0.0, "gain": 0.9}])
shot("S01_SH01", 6.2, "remotion", "phone", "full-screen DM thread", "-", "-",
     "Thursday 23:12. Lucas: 18–17 / all-time goals. yes. i know. / just reminding you / brussels. 2000. / we don't talk about 2000 / see you in liège 🙂",
     "The rivalry in one native chat.", phone="open", hook="POV: your rival texts you the night before",
     hookTr="Maçtan önceki gece rakibin yazıyor",
     sfx=[{"cue": "night-room", "at": 0.0, "gain": 0.25, "dur": 6.2}] + [{"cue": "message-in", "at": t} for t in (0.25, 1.75, 3.85)]
     + [{"cue": "message-out", "at": t} for t in (1.0, 2.55, 4.85)] + [{"cue": "phone-lock", "at": 6.1}])

# ---------------------------------------------------------------- S02 the rooms
chair("S02_SH01", "TR", "C", dur=1.8, act=[("settle", 0.1)], super_=TR_SUPER, purpose="Meet him: the room, the lights, the chair.")
chair("S02_SH02", "BE", "C", dur=1.8, act=[("settle", 0.1)], super_=BE_SUPER, purpose="Meet his rival: the mirror room.")
chair("S02_SH03", "TR", "A", [("L01", 1.0)], card="Say something nice about Belgium.", act=[("think", 0.6), ("smile", 2.4)], purpose="The banter starts.")
chair("S02_SH04", "BE", "A", [("L02", 0.2)], card="Say something nice about Türkiye.", act=[("smile", 1.9)])

# ---------------------------------------------------------------- S03 1957–58
chair("S03_SH01", "BE", "B", [("L03", 0.1)], card="When did it start?")
shot("S03_SH02", 2.2, "blender", "newsreel-1957", "high wide over a muddy pitch: two teams in old kits", "35mm", "static, a slight pan",
     "1957. A newsreel: the ball, the mud, a goal-mouth scramble.", "History has a texture.", look="archive",
     sfx=[{"cue": "crowd-muffled", "at": 0.0, "gain": 0.4, "dur": 2.2}])
chair("S03_SH03", "TR", "B", [("L04", 0.15)])
chair("S03_SH04", "TR", "A", [("L05", 0.1)], tail=0.2)
chair("S03_SH05", "BE", "A", [("L06", 0.05)], tail=0.25, purpose="Both, at once: polite.")

# ---------------------------------------------------------------- S04 1997
chair("S04_SH01", "BE", "A", [("L07", 0.15)], dur=3.2)
tv("S04_SH09", 3.2, "L07", 0.15, {"home": "Türkiye", "away": "Belgium", "hs": 1, "as": 3, "clock": "45'", "line": "Istanbul · 30.04.1997", "era": "crt"})
chair("S04_SH02", "TR", "A", [("L08", 0.15)], tail=0.25)
chair("S04_SH03", "BE", "B", [("L09", 0.1)], act=[("glance", 0.9)], tail=0.4)

# ---------------------------------------------------------------- S05 2000 (the heart of the banter)
chair("S05_SH01", "TR", "A", [("L10", 0.3)], card="June 2000?", push=0.05, dur=3.6)
tv("S05_SH09", 3.6, "L10", round(read("June 2000?") * 0.8 + 0.3, 2), {"home": "Belgium", "away": "Türkiye", "hs": 0, "as": 0, "clock": "1'", "line": "Brussels · 19.06.2000", "era": "crt"},
   purpose="Kick-off on the TV; the next TV shot is the 0–2.")
shot("S05_SH02", round(max(3.0, 0.35 + secs("L11") + 0.5), 2), "blender", "living-tr-2000", "wide past the TV: a father lifts his son toward the ceiling", "24mm", "locked, slight handheld",
     "June 2000, a living room in Türkiye. The goal on the TV; his father lifts him so high his head knocks the lamp.",
     "The memory: joy, his father.", look="memory", dialogue=[{"line": "L11", "at": 0.35}],
     sfx=[{"cue": "crowd-roar", "at": 0.2, "gain": 0.35}, {"cue": "lamp-wobble", "at": 1.25, "gain": 0.7}, {"cue": "home-quiet", "at": 0.0, "gain": 0.2}])
shot("S05_SH03", round(max(1.3, 0.2 + secs("L32") + 0.35), 2), "remotion", "tv", "the TV picture", "-", "-", "BELGIUM 0–2 TÜRKİYE · Brussels · 19.06.2000", "The fact.",
     dialogue=[{"line": "L32", "at": 0.2}],
     screen={"type": "tv", "score": {"home": "Belgium", "away": "Türkiye", "hs": 0, "as": 2, "clock": "88'", "line": "Brussels · 19.06.2000", "era": "crt"}},
     sfx=[{"cue": "crowd-roar", "at": 0.0, "gain": 0.4}])
shot("S05_SH04", round(max(2.8, 0.4 + secs("L12") + 0.5), 2), "blender", "living-be-2000", "MS low: a boy in face paint crying on the sofa, his mum's arm around him", "35mm", "locked",
     "The same night, in Belgium. The co-hosts are out.", "The other side of the same memory.", look="memory",
     dialogue=[{"line": "L12", "at": 0.4}], sfx=[{"cue": "home-quiet", "at": 0.0, "gain": 0.25}])
chair("S05_SH05", "TR", "A", [("L13", 0.2)], act=[("smile", 0.2)])

# ---------------------------------------------------------------- S06 2009
chair("S06_SH01", "BE", "A", [("L14", 0.15)], dur=3.0)
tv("S06_SH09", 3.0, "L14", 0.15, {"home": "Belgium", "away": "Türkiye", "hs": 2, "as": 0, "clock": "83'", "line": "Brussels · 10.10.2009", "era": "hd"})
chair("S06_SH02", "TR", "A", [("L15", 0.25)], act=[("away", 0.0)], tail=0.25)
chair("S06_SH03", "BE", "B", [("L16", 0.15)], act=[("glance", 0.1)], tail=0.3)

# ---------------------------------------------------------------- S07 2010
chair("S07_SH01", "TR", "A", [("L17", 0.25)], card="And 2010?", dur=3.4)
tv("S07_SH02", 3.4, "L17", round(read("And 2010?") * 0.8 + 0.25, 2), {"home": "Türkiye", "away": "Belgium", "hs": 3, "as": 2, "clock": "78'", "line": "Istanbul · 07.09.2010", "era": "hd"})
chair("S07_SH03", "BE", "A", [("L18", 0.15)], tail=0.25)
chair("S07_SH04", "TR", "B", [("L19", 0.15)], act=[("smile", 0.9)], tail=0.25)
chair("S07_SH05", "BE", "A", [("L20", 0.15)], act=[("smile", 2.0)], tail=0.4)

# ---------------------------------------------------------------- S08 who's winning (fastest cross-cut)
chair("S08_SH01", "BE", "A", [("L21", 0.05)], card="So who's winning?", tail=0.15)
chair("S08_SH02", "TR", "A", [("L22", 0.05)], tail=0.12)
chair("S08_SH03", "BE", "B", [("L23", 0.05)], tail=0.1)
chair("S08_SH04", "TR", "B", [("L24", 0.05)], tail=0.1)
chair("S08_SH05", "BE", "A", [("L25", 0.05)], tail=0.1)
chair("S08_SH06", "TR", "A", [("L26", 0.15)], act=[("lean", 0.0)], tail=0.6)

# ---------------------------------------------------------------- S09 the turn
chair("S09_SH01", "TR", "A", [("L27", 1.6), ("L28", 0.9)], card="What do you respect about him?", push=0.12, act=[("down", 0.9), ("up", 3.8)], tail=0.8,
      light="the room darker: key down, the practical only", purpose="The sincere turn.")
chair("S09_SH02", "BE", "C", dur=1.3, act=[("still", 0.0)], purpose="He heard it.", sfx=[{"cue": "interview-tone", "at": 0.0, "gain": 0.2}])
chair("S09_SH03", "BE", "A", [("L29", 0.5)], push=0.08, act=[("down", 0.0), ("up", 0.45)], tail=0.7)

# ---------------------------------------------------------------- S10 tonight, Liège
shot("S10_SH01", 2.6, "blender", "tunnel", "wide from behind: two lines of players, #9 and #4 side by side", "35mm f/2.8", "slow follow",
     "Friday 2 October, Liège. The tunnel. They don't look at each other.", "Tonight.", stamp="Friday 2 October · Liège · 2 Ekim Cuma",
     sfx=[{"cue": "tunnel-tone", "at": 0.0, "gain": 0.5, "dur": 9}, {"cue": "crowd-muffled", "at": 0.0, "gain": 0.6, "dur": 9}, {"cue": "tunnel-steps", "at": 0.1}])
shot("S10_SH02", round(max(1.8, 0.5 + secs("L30") + 0.4), 2), "blender", "tunnel", "profile two-shot, waiting: #4 in front, #9 behind", "85mm f/2", "locked",
     "Eighteen.", "The last word…", dialogue=[{"line": "L30", "at": 0.5}])
shot("S10_SH03", round(max(1.8, 0.3 + secs("L31") + 0.6), 2), "blender", "tunnel", "CU #9, rim-lit from the pitch, the half-smile", "85mm f/1.8", "locked",
     "Not for long.", "…is his.", dialogue=[{"line": "L31", "at": 0.3}])
shot("S10_SH04", 2.0, "blender", "tunnel", "wide from behind: they walk into the light", "35mm", "static", "Into the light. WHITE.", "Release.",
     transition="white", sfx=[{"cue": "crowd-roar", "at": 1.2, "gain": 1.0}])

# ---------------------------------------------------------------- S11 tonight · end · S12 teaser
# posted the day before the match (Thursday 1 Oct): "tomorrow", not "tonight"
shot("S11_SH01", 2.2, "remotion", "card", "match card", "-", "-", "BELGIUM vs TÜRKİYE · TOMORROW · 21:45", "When to watch.",
     screen={"type": "title", "title": "Belgium vs Türkiye", "kicker": "Tomorrow · Yarın · Liège · 21:45 TSİ"}, sfx=[{"cue": "sub-hit", "at": 0.0}])
shot("S11_SH02", 1.4, "remotion", "end", "HNC LEAGUE end card on white", "-", "-", "HNC LEAGUE.", "Brand, once.",
     screen={"type": "end", "series": "Player Diaries · Episode 01"}, sfx=[{"cue": "brand-sting", "at": 0.15, "gain": 0.7}])
shot("S12_SH01", 2.6, "remotion", "phone", "full-screen DM thread", "-", "-", "Lucas: see you 12 november 🙂", "Next: the return match.",
     phone="teaser", sfx=[{"cue": "phone-buzz", "at": 0.15, "gain": 0.6}, {"cue": "message-in", "at": 0.35}])

# 30 fps: the platforms deliver 30, motion blur keeps it smooth, and it halves the render (owner: ~1 h)
edit = {"schema": "hnc-diaries-edit/1", "episode": "rivals-one-goal", "title": "One Goal Between Us", "fps": 30, "version": "v1",
        "note": "Single source of the cut (see tools/diaries/rivals_cut.py). Chair shots carry who/cam/push/act for the interview builder.",
        "shots": shots}
EDIT.write_text(json.dumps(edit, indent=2, ensure_ascii=False) + "\n")
print(f"rivals: {len(shots)} shots, {sum(s['dur'] for s in shots):.2f} s" + (f"  (estimated: {', '.join(sorted(missing))})" if missing else ""))
