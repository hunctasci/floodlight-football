"""The two interview rooms that answer each other across the cut.

TR #9 sits in the warm room (the EP01 interview set, eyeline just off the lens to
camera-left). BE #4 sits in its mirror: the same set flipped left-right and re-lit
cool, eyeline camera-right — so in the cross-cut they seem to answer each other.

Every chair shot is data (edit.json): ``who`` (TR | BE), ``cam`` (A | B | C),
``push`` (fraction of the frame size closed over the shot), ``act`` cues.
Cameras (ASC talking-head practice): A = MCU just beside the eyeline, B = the
profile 90° off the eyeline (same side of the line), C = the room wide that shows
the lights and the crew (breathing room, documentary truth).
"""
import json
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.camera import frame
from ...cine.sets import interview
from ...paths import REPO_ROOT

DIALOGUE = REPO_ROOT / "packages" / "reels" / "src" / "diaries" / "rivals" / "dialogue.json"

ROOMS = {
    "TR": dict(canon="TR-PLAYER-09", speaker="NINE", m=1.0),
    "BE": dict(canon="BE-PLAYER-04", speaker="FOUR", m=-1.0),
}
# The Belgian room: same practicals, a cool palette.
BE_LIGHTS = {"LGT_Key": "#e2eaff", "LGT_Fill": "#7a98dd", "LGT_Edge": "#cfe0ff", "LGT_WallSlash": "#a7bdf0", "INT_Practical.Light": "#eef3ff"}
# Sizes are horizontal coverage (m). HNC heads are ~0.64 m wide, so the A-cam "MCU" is 1.0 m
# (head + chest); B and C distances are kept inside the set (side wall at |x| = 3.6, floor to y = -3.5).
CAMS = {
    "A": dict(lens=70.0, size=1.0, heading=20.0, el=0.0, fstop=2.0),
    "B": dict(lens=60.0, size=0.9, heading=76.0, el=2.0, fstop=2.0),
    "C": dict(lens=20.0, size=3.4, heading=34.0, el=6.0, fstop=2.8),
}


def _speakers():
    return {l["id"]: l["speaker"] for l in json.loads(DIALOGUE.read_text())["lines"]}


def _crew(sh, m):
    """What the C-cam wide sees: the softbox that is the key, its stand, a flag."""
    c = sh.cols["SET"]
    key = Vector((-1.7 * m, -1.9, 2.2))
    sub = Vector((0.0, 0.2, 1.45))
    d = (sub - key).normalized()
    yaw = math.degrees(math.atan2(d.x, -d.y))
    black = look.flat("Crew_Black", "#111214", rough=0.6)
    props.box(c, "CREW_Softbox", (0.8, 0.14, 0.8), black, tuple(key - d * 0.12 - Vector((0, 0, 0.4))), rot=(0, 0, yaw))
    props.plane(c, "CREW_Softbox.Diffusion", (0.74, 0.74), look.emission("Crew_Diffusion", "#fff4e6", 1.6),
                tuple(key - d * 0.04), rot=(90 - 18, 0, yaw))
    props.cyl(c, "CREW_Stand", 0.015, 1.85, black, (key.x, key.y, 0.0), segs=8)
    flag = Vector((2.3 * m, 1.2, 1.6))  # a bounce flag behind him, camera-side: in the wide, never in front of the lens
    props.box(c, "CREW_Flag", (0.6, 0.02, 0.45), black, tuple(flag), rot=(0, 0, -30 * m))
    props.cyl(c, "CREW_FlagStand", 0.012, 1.6, black, (flag.x, flag.y, 0.0), segs=8)


def room(sh, who, dark=False):
    """Build the room for ``who``; returns anchors (seat, eyeline) already mirrored."""
    m = ROOMS[who]["m"]
    before = set(bpy.data.objects)
    a = interview.interview(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    built = [o for o in bpy.data.objects if o not in before and o.parent is None]
    if m < 0:
        # mirror the whole room (geometry + lights) through x = 0
        piv = bpy.data.objects.new("SET_Mirror", None)
        piv["hnc_generated"] = True
        sh.cols["SET"].objects.link(piv)
        piv.scale = (-1.0, 1.0, 1.0)
        for o in built:
            o.parent = piv
        for o in bpy.data.objects:
            if o.type == "LIGHT" and o.name in BE_LIGHTS:
                o.data.color = look.lin(BE_LIGHTS[o.name])[:3]
    if dark:  # chapter 5: the interview has gone late — key down, the practical carries it
        for o in bpy.data.objects:
            if o.type == "LIGHT" and o.name in ("LGT_Key", "LGT_Edge", "LGT_WallSlash"):
                o.data.energy *= {"LGT_Key": 0.35, "LGT_Edge": 0.6, "LGT_WallSlash": 0.3}[o.name]
    _crew(sh, m)
    bpy.context.view_layer.update()
    a["seat"] = Vector((a["seat"].x * m, a["seat"].y, a["seat"].z))
    a["eyeline"] = Vector((a["eyeline"].x * m, a["eyeline"].y, a["eyeline"].z))
    return a


def sitter(sh, who, a):
    r = ROOMS[who]
    m = r["m"]
    p = sh.person(r["canon"], "kit", profile="still")  # in the national shirt: players, not pundits
    s = a["seat"]
    P.sit(p, 0.0, (s.x, s.y, 0.0), face=12.0 * m, seat_h=0.36, lean=4.0, e="hold")
    P.arms(p, 0.0, "L", 34.0, 10.0, 0.0, 55.0, e="hold")
    P.arms(p, 0.0, "R", 34.0, 10.0, 0.0, 55.0, e="hold")
    P.look(p, 0.0, a["eyeline"], w=0.75, dur=0.01, eyes_lead=0)
    p.key("gaze_at", 0.0, tuple(a["eyeline"]), "hold")
    p.key("gaze_w", 0.0, 0.9, "hold")
    head = Vector((s.x, s.y, 0.36 + 0.12 - p.dims["hip"] + 1.7))
    return p, head


def camera(sh, who, kind, head, push=0.0):
    m = ROOMS[who]["m"]
    c = CAMS[kind]
    cam = sh.camera(c["lens"], fstop=c["fstop"])
    if kind == "A":  # off-centre: negative space on the side he looks to
        aim = head + Vector((-0.18 * m, 0, -0.28))
    elif kind == "B":
        aim = head + Vector((0, 0, -0.12))
    else:
        aim = head + Vector((0, 0.2, -0.75))
        sh.scene.view_settings.exposure = 0.7  # the room wide reads the dark set, not only the lit face
    frame(cam, 0.0, head, c["size"], heading=c["heading"] * m, el=c["el"], aim=aim)
    if push:
        frame(cam, sh.dur, head, c["size"] * (1 - push), heading=c["heading"] * m, el=c["el"], aim=aim, e="linear")
    cam.handheld("locked", 0.6)
    return cam


# ---------------------------------------------------------------- acting cues (``act`` in edit.json)
def _settle(p, t, m):
    p.key("hips", t, (0.0, 0.0, 0.0), "hold")
    p.key("hips", t + 0.6, (0.0, -0.025, 0.0), "soft")
    P.nod(p, t + 0.4, depth=2.0, dur=0.4)


def _think(p, t, m):
    P.glance(p, t, -0.5 * m, 0.45, dur=0.25, hold=0.9)


def _smile(p, t, m):
    P.smile(p, t, amount=0.5, dur=0.3, hold=0.8, tilt=2.0 * m)


def _glance(p, t, m):
    """A look toward the lens side (the Office look): he knows."""
    P.glance(p, t, 0.85 * m, 0.0, dur=0.12, hold=0.5, back=0.2, head=3.0 * m)


def _away(p, t, m):
    P.glance(p, t, -0.8 * m, -0.1, dur=0.15, hold=0.8, head=-6.0 * m)


def _down(p, t, m):
    p.key("neck", t, (0.0, 0.0, 0.0), "hold")
    p.key("neck", t + 0.5, (11.0, 0.0, -3.0 * m), "soft")
    p.key("gaze", t + 0.3, (0.1 * m, -0.6), "soft")


def _up(p, t, m):
    p.key("neck", t, (11.0, 0.0, -3.0 * m), "hold")
    p.key("neck", t + 0.6, (0.0, 0.0, 0.0), "soft")
    p.key("gaze", t + 0.4, (0.0, 0.0), "soft")


def _lean(p, t, m):
    p.key("chest", t, (0.0, 0.0, 0.0), "hold")
    p.key("chest", t + 0.4, (6.0, 0.0, 0.0), "soft")


def _still(p, t, m):
    p.key("drift_amp", t, 0.25, "hold")


ACT = dict(settle=_settle, think=_think, smile=_smile, glance=_glance, away=_away, down=_down, up=_up, lean=_lean, still=_still)


def chair_shot(sh):
    """Any interview shot, from its edit.json description."""
    s = sh.spec
    who = s["who"]
    m = ROOMS[who]["m"]
    a = room(sh, who, dark=s["scene"] == "S09")
    p, head = sitter(sh, who, a)
    spk = _speakers()
    for d in s.get("dialogue", []):
        if spk.get(d["line"]) == ROOMS[who]["speaker"]:
            sh.talk(p, d["line"], amount=0.6)
    for name, t in s.get("act", []):
        ACT[name](p, t, m)
    camera(sh, who, s.get("cam", "A"), head, s.get("push", 0.0))
    sh.finish(vignette=0.4)
