"""Generate the Italy-rematch Player Diaries cut (v2: the commentator who never left).

The JSON written here is the episode's single cut source of truth.  This file
contains data only: no scene construction, rendering, or audio generation.
Spec: social/player-diaries/italy-rematch/screenplay-v2-commentary.md
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EDIT = REPO / "packages/reels/src/diaries/italy-rematch/edit.json"
VOICES = REPO / "packages/reels/public/generated/diaries/italy-rematch/vo/voices.json"

MOTIF = "score-14-motif"
GAP = 0.12  # minimum breath between two spoken lines


def shot(sid, scene, dur, location, framing, action, purpose, *, renderer="blender", sfx=(), dialogue=(), extra=None):
    item = {
        "id": sid,
        "scene": scene,
        "dur": dur,
        "renderer": renderer,
        "location": location,
        "framing": framing,
        "lens": "-",
        "move": "-",
        "action": action,
        "light": "-",
        "transition": "cut",
        "purpose": purpose,
    }
    if sfx:
        item["sfx"] = list(sfx)
    if dialogue:
        item["dialogue"] = [{"line": line, "at": at} for line, at in dialogue]
    if extra:
        item.update(extra)
    return item


def motif(at=0.0):
    return {"cue": MOTIF, "at": at}


def fit_to_takes(shots):
    """Grow the shot holding a line until it no longer runs into the next line (deterministic).

    Lines may spill over a cut (commentary runs across pictures); only line-on-line collisions grow the cut.
    """
    secs = {k: v["seconds"] for k, v in json.loads(VOICES.read_text()).items()} if VOICES.exists() else {}
    for _ in range(100):
        t, placed = 0.0, []
        for i, s in enumerate(shots):
            for d in s.get("dialogue", []):
                placed.append((t + d["at"], t + d["at"] + secs.get(d["line"], 1.0), i, d))
            t += s["dur"]
        placed.sort(key=lambda p: p[0])
        clash = next(((p, q) for p, q in zip(placed, placed[1:]) if q[0] < p[1] + GAP), None)
        if clash is None:
            return shots
        (_a0, b0, _i0, _d0), (a1, _b1, i1, d1) = clash
        push = round(b0 + GAP - a1 + 0.005, 2)
        # Hold the picture the long line ENDS over (never the black lead-in it started on).
        t, j = 0.0, 0
        while j < i1 and t + shots[j]["dur"] <= b0:
            t += shots[j]["dur"]
            j += 1
        if j == i1:
            # Same shot as the later line: it and every line after it in this shot move; the shot grows with them.
            for d in shots[j]["dialogue"]:
                if d["at"] >= d1["at"]:
                    d["at"] = round(d["at"] + push, 2)
        shots[j]["dur"] = round(shots[j]["dur"] + push, 2)
    raise SystemExit("fit_to_takes did not converge")


shots = [
    shot("S00_SH01", "S00", 0.30, "black / bedroom audio lead", "black frame", "Alarm begins before image.", "Audio-first hook.", sfx=({"cue": "alarm", "at": 0.0},), dialogue=(("L03", 0.15),)),
    shot("S00_SH02", "S00", 1.20, "bedroom", "100mm macro", "Alarm clock reads 1:04; TR #9's hand hits snooze.", "The digital score motif enters.", sfx=(motif(0.0),)),
    shot("S00_SH03", "S00", 1.10, "bedroom", "100mm macro", "Clock simply changes from 1:04 to 1-4; no glitch animation.", "Digital score discovery."),
    shot("S00_SH04", "S00", 1.40, "bedroom", "28mm clock POV", "From the clock's point of view, TR #9 opens one eye and turns to glare at it.", "His private annoyance begins.", dialogue=(("L04", 0.20),)),
    shot("S01_SH01", "S01", 2.40, "kitchen", "50mm", "TR #9 cracks one egg; hard reveal: four eggs in the pan.", "Environmental score discovery.", sfx=(motif(0.25),), dialogue=(("L05", 0.10),)),
    shot("S01_SH02", "S01", 2.20, "kitchen", "45mm detail", "One espresso button press; four cups appear in escalating rhythm.", "The pattern spreads through the environment.", sfx=(motif(0.15),), dialogue=(("L06", 0.10),)),
    shot("S02_SH01", "S02", 2.00, "elevator", "28mm", "TR #9 presses 1; display changes 4, repeating 1 → 4 → 1 → 4. DING. Doors open on the wrong floor.", "Environmental score becomes impossible.", sfx=(motif(0.2), {"cue": "elevator-ding", "at": 1.7}), dialogue=(("L07", 0.40),)),
    shot("S03_SH01", "S03", 2.80, "car", "35mm dashboard", "Dashboard reads 1:04, radio 104.1, trip 14 km; TR #9 switches each one off.", "The score follows him into transit.", sfx=(motif(0.2),), dialogue=(("L08", 0.15),)),
    shot("S04_SH01", "S04", 2.80, "street", "35mm lateral tracking", "TR #9 passes parking bay 14, a vehicle numbered 14 and building 14.", "Environmental motifs accumulate.", sfx=(motif(0.25),), dialogue=(("L09", 0.10),)),
    shot("S05_SH01", "S05", 3.20, "bakery", "50mm two-shot", "TR-SUPPORTER-ELDER-01 notices #9, raises one finger, then four. #9 says: Really? The supporter silently nods.", "The motif becomes a shared joke.", sfx=(motif(0.6),), dialogue=(("L10", 0.05), ("L01", 1.70))),
    shot("S06_SH01", "S06", 2.60, "corridor", "70mm tracking", "TR #9 walks. In glass reflection only, a massive physical 1–4 passes behind him. He looks back; nothing is there.", "Reflection: the score crosses into reality.", sfx=(motif(0.9),), dialogue=(("L11", 0.10),)),
    shot("S06_SH02", "S06", 2.70, "elevator", "22mm", "Doors open on giant physical 1 and 4 standing like silent commuters. One subtly rotates toward TR #9. No faces or limbs.", "Physical typography arrives.", sfx=(motif(0.35),), dialogue=(("L12", 0.90),)),
    shot("S07_SH01", "S07", 2.80, "stairwell", "18mm dynamic / controlled handheld", "TR #9 takes the stairs quickly. Score motifs appear through floor numbers and signs; no literal characters chase him.", "Reality itself becomes impossible.", sfx=(motif(0.3),), dialogue=(("L13", 0.20),)),
    shot("S08_SH01", "S08", 1.60, "street exterior", "50mm", "TR #9 exits into silence. Everything appears normal; he catches his breath.", "False relief."),
    shot("S08_SH02", "S08", 0.90, "street exterior", "85mm insert", "A generic car passes. License plate reads HNC 14.", "The motif gets one last literal appearance.", sfx=(motif(0.1),)),
    shot("S08_SH03", "S08", 1.20, "street exterior", "85mm CU", "TR #9 looks at the plate. Pause. He says: Enough.", "The comedy motif stops; genre switch begins.", dialogue=(("L02", 0.25),)),
    shot("S09_SH01", "S09", 1.40, "training", "35mm low", "A football violently drops into frame with a large physical impact.", "Genre transition from comedy into premium football/VFX.", sfx=({"cue": "football-impact", "at": 0.0},), dialogue=(("L14", 0.15),)),
    shot("S10_SH01", "S10", 3.00, "training", "24mm low tracking", "Physical giant 1 functions as a defensive/gate obstacle. TR #9 accelerates, feints, and gets around it.", "Football obstacle: attack the score.", sfx=({"cue": "football-rhythm", "at": 0.0},), dialogue=(("L15", 0.10), ("L16", 1.90))),
    shot("S10_SH02", "S10", 3.10, "training", "35mm orbit / medium-wide", "Physical giant 4 becomes a second football obstacle. TR #9 approaches differently, shapes to shoot one way, and cuts around it.", "The score becomes a football problem.", sfx=({"cue": "football-rhythm", "at": 0.0},), dialogue=(("L17", 0.90),)),
    shot("S11_SH01", "S11", 3.10, "training / VFX", "cinematic strike coverage", "Massive physical 1–4 ahead of TR #9: plant, hip rotation, shot, ball impact, typography fractures, debris, light through cracks, dust. No fireball.", "Premium kinetic football typography.", sfx=({"cue": "football-rhythm", "at": 0.0},), dialogue=(("L18", 0.60),)),
    shot("S12_SH01", "S12", 1.30, "training", "85mm / detail", "Ball rolls slowly through broken fragments. Brief breathing room.", "Destroyed score and aftermath."),
    shot("S13_SH01", "S13", 2.40, "training analysis area", "50mm OTS", "Tactical board reads 1–4. TR #9 wipes it away; underneath is 0–0. The next match starts fresh.", "Reset to 0–0; no predicted result.", dialogue=(("L19", 0.30),)),
    shot("S14_SH01", "S14", 2.60, "café redress", "85mm", "IT-PLAYER-08 receives espresso. Crema subtly forms 0–0. Italy #8 notices, looks slightly upward, and gives a very small smile. No dialogue.", "Reset passes to Italy #8.", dialogue=(("L20", 1.10),),
         extra={"super": {"title": "🇮🇹 #8", "sub": "ITALY", "side": "right", "color": "#1f5fbf"}}),
    shot("S15_SH01", "S15", 2.80, "tunnel", "35mm symmetrical / parallel composition", "TR-PLAYER-09 and IT-PLAYER-08 move toward the match environment from mirrored/parallel staging. Crowd sound rises.", "The next match begins.", sfx=({"cue": "crowd-rise", "at": 0.0},), dialogue=(("L21", 0.20),)),
    shot("S16_SH01", "S16", 3.00, "end card", "graphic end card", "ITALY vs TÜRKİYE; MON 5 OCT · BOLOGNA; minimal HNC LEAGUE.", "End card.", renderer="remotion", sfx=({"cue": "brand-sting", "at": 0.0},)),
]

edit = {
    "schema": "hnc-diaries-edit/1",
    "episode": "italy-rematch",
    "title": "The Score Won't Leave Him Alone",
    "fps": 30,
    "version": "v2",
    "note": "Single source of the Italy-rematch cut (v2: commentator). Generated by tools/diaries/italy_rematch_cut.py; shot durations grow to fit the approved takes.",
    "progression": ["digital", "environmental", "reflection", "physical", "football obstacle", "destroyed", "reset to 0–0"],
    "hook": {"text": "After Türkiye 1–4 Italy…", "tr": "Türkiye 1–4 İtalya'dan sonra…", "dur": 2.6},
    "scoreBug": {"before": "TUR 1–4 ITA", "after": "ITA 0–0 TUR · MON 5 OCT", "flip": {"shot": "S13_SH01", "at": 1.3}, "hideOn": ["S16_SH01"]},
    "shots": fit_to_takes(shots),
}

EDIT.write_text(json.dumps(edit, indent=2, ensure_ascii=False) + "\n")
print(f"italy-rematch: {len(shots)} shots, {sum(s['dur'] for s in shots):.2f} s")
