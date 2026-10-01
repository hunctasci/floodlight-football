"""Generate the locked Italy-rematch Player Diaries cut.

The JSON written here is the episode's single cut source of truth.  This file
contains data only: no scene construction, rendering, or audio generation.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EDIT = REPO / "packages/reels/src/diaries/italy-rematch/edit.json"

MOTIF = "score-14-motif"


def shot(sid, scene, dur, location, framing, action, purpose, *, renderer="blender", sfx=(), dialogue=()):
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
    return item


def motif(at=0.0):
    return {"cue": MOTIF, "at": at}


shots = [
    shot("S00_SH01", "S00", 0.30, "black / bedroom audio lead", "black frame", "Alarm begins before image.", "Audio-first hook.", sfx=({"cue": "alarm", "at": 0.0},)),
    shot("S00_SH02", "S00", 1.00, "bedroom", "100mm macro", "Alarm clock reads 1:04; TR #9's hand hits snooze.", "The digital score motif enters.", sfx=(motif(0.0),)),
    shot("S00_SH03", "S00", 0.90, "bedroom", "100mm macro", "Clock simply changes from 1:04 to 1–4; no glitch animation.", "Digital score discovery.", sfx=(motif(0.0),)),
    shot("S00_SH04", "S00", 0.90, "bedroom", "85mm CU", "TR #9 opens one eye and stares at the clock. No dialogue.", "His private annoyance begins."),
    shot("S01_SH01", "S01", 1.50, "kitchen", "50mm with macro insert", "TR #9 cracks one egg, looks away, and there are now four eggs in the pan.", "Environmental score discovery.", sfx=(motif(0.25),)),
    shot("S01_SH02", "S01", 1.60, "kitchen", "70mm detail/product-style", "Coffee machine receives one espresso command; four cups appear in escalating rhythm.", "The pattern spreads through the environment.", sfx=(motif(0.15),)),
    shot("S02_SH01", "S02", 2.00, "elevator", "28mm", "TR #9 presses 1; display changes 4, repeating 1 → 4 → 1 → 4. DING. Doors open on the wrong floor.", "Environmental score becomes impossible.", sfx=(motif(0.2), {"cue": "elevator-ding", "at": 1.7})),
    shot("S03_SH01", "S03", 2.10, "car", "35mm interior plus rapid inserts", "Dashboard reads 1:04, radio 104.1, trip 14 km; TR #9 switches each one off.", "The score follows him into transit.", sfx=(motif(0.2),)),
    shot("S04_SH01", "S04", 2.50, "street", "35mm lateral tracking", "TR #9 passes parking bay 14, a bus or vehicle numbered 14, building 14, and a courier with four boxes and one bag.", "Environmental motifs accumulate.", sfx=(motif(0.25),)),
    shot("S05_SH01", "S05", 2.70, "bakery", "50mm two-shot", "TR-SUPPORTER-ELDER-01 notices #9, raises four fingers, then lowers to one. #9 says: Really? The supporter silently nods.", "The motif becomes a shared joke.", sfx=(motif(0.6),), dialogue=(("L01", 1.0),)),
    shot("S06_SH01", "S06", 2.20, "corridor", "70mm tracking", "TR #9 walks. In glass reflection only, a massive physical 1–4 passes behind him. He looks back; nothing is there.", "Reflection: the score crosses into reality.", sfx=(motif(0.9),)),
    shot("S06_SH02", "S06", 2.70, "elevator", "18–24mm", "Doors open on giant physical 1 and 4 standing like silent commuters. One subtly rotates toward TR #9. No faces or limbs.", "Physical typography arrives.", sfx=(motif(0.35),)),
    shot("S07_SH01", "S07", 2.80, "stairwell", "18mm dynamic / controlled handheld", "TR #9 takes the stairs quickly. Score motifs appear through floor numbers, signs, shadows, and reflections; no literal characters chase him.", "Reality itself becomes impossible.", sfx=(motif(0.3),)),
    shot("S08_SH01", "S08", 2.10, "street exterior", "50mm", "TR #9 exits into silence. Everything appears normal; he catches his breath.", "False relief."),
    shot("S08_SH02", "S08", 1.10, "street exterior", "85mm insert", "A generic car passes. License plate reads HNC 14.", "The motif gets one last literal appearance.", sfx=(motif(0.1),)),
    shot("S08_SH03", "S08", 0.90, "street exterior", "85mm CU", "TR #9 looks at the plate. Pause. He says: Enough.", "The comedy motif stops; genre switch begins.", dialogue=(("L02", 0.35),)),
    shot("S09_SH01", "S09", 0.90, "training", "35mm low", "A football violently drops into frame with a large physical impact.", "Genre transition from comedy into premium football/VFX.", sfx=({"cue": "football-impact", "at": 0.0},)),
    shot("S10_SH01", "S10", 3.00, "training", "24mm low tracking", "Physical giant 1 functions as a defensive/gate obstacle. TR #9 accelerates, feints, and gets around it.", "Football obstacle: attack the score.", sfx=({"cue": "football-rhythm", "at": 0.0},)),
    shot("S10_SH02", "S10", 3.10, "training", "35mm orbit / medium-wide", "Physical giant 4 becomes a second football obstacle. TR #9 approaches differently, shapes to shoot one way, and cuts around it.", "The score becomes a football problem.", sfx=({"cue": "football-rhythm", "at": 0.0},)),
    shot("S11_SH01", "S11", 3.10, "training / VFX", "cinematic strike coverage", "Massive physical 1–4 ahead of TR #9: plant, hip rotation, shot, ball impact, typography fractures, debris, light through cracks, dust, motion blur, impact response. No fireball.", "Premium kinetic football typography; future VFX unit.", sfx=({"cue": "football-rhythm", "at": 0.0},)),
    shot("S12_SH01", "S12", 1.80, "training", "85mm / detail", "Ball rolls slowly through broken fragments. Brief breathing room.", "Destroyed score and aftermath."),
    shot("S13_SH01", "S13", 2.40, "training analysis area", "50mm OTS", "Tactical board reads 1–4. TR #9 wipes it away; underneath is 0–0. The next match starts fresh.", "Reset to 0–0; no predicted result."),
    shot("S14_SH01", "S14", 2.70, "café redress", "85mm", "IT-PLAYER-08 receives espresso. Crema subtly forms 0–0. Italy #8 notices, looks slightly upward, and gives a very small smile. No dialogue.", "Reset passes to Italy #8."),
    shot("S15_SH01", "S15", 2.50, "tunnel", "35mm symmetrical / parallel composition", "TR-PLAYER-09 and IT-PLAYER-08 move toward the match environment from mirrored/parallel staging. Crowd sound rises.", "The next match begins.", sfx=({"cue": "crowd-rise", "at": 0.0},)),
    shot("S16_SH01", "S16", 1.70, "end card", "graphic end card", "ITALY vs TÜRKİYE; 5 OCTOBER; minimal HNC LEAGUE.", "End card.", renderer="remotion", sfx=({"cue": "brand-sting", "at": 0.0},)),
]

edit = {
    "schema": "hnc-diaries-edit/1",
    "episode": "italy-rematch",
    "title": "The Score Won't Leave Him Alone",
    "fps": 30,
    "version": "v1",
    "note": "Single source of the locked Italy-rematch cut. Generated by tools/diaries/italy_rematch_cut.py; shot-local motif cues are data only.",
    "progression": ["digital", "environmental", "reflection", "physical", "football obstacle", "destroyed", "reset to 0–0"],
    "shots": shots,
}

EDIT.write_text(json.dumps(edit, indent=2, ensure_ascii=False) + "\n")
print(f"italy-rematch: {len(shots)} shots, {sum(s['dur'] for s in shots):.2f} s")
