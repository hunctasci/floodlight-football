"""S05 — The supporter: two goals."""
import math

import bpy
from mathutils import Vector

from ...cine import perform as P
from ...cine.perform import heading, write_tracks
from ...cine.camera import frame
from ...cine.sets import bakery

NINE_AT = Vector((0.35, 0.28, 0))  # at the counter
ELDER_TO = Vector((-0.75, -0.55, 0))  # where the regular stops, pointing


def _set(sh):
    a = bakery.bakery(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    return a


def _nine(sh, a, pos=NINE_AT, face=180.0):
    p = sh.person("TR-PLAYER-09", "hoodie", profile="calm")
    P.stance(p, 0.0, (pos.x, pos.y, 0.0), face)
    P.relax_arms(p, 0.0)
    return p


def _elder_seated(sh, a):
    e = sh.person("TR-SUPPORTER-ELDER-01", "home", profile="elder")
    s = a["elder_seat"]
    P.sit(e, 0.0, (s.x + 0.08, s.y, 0.0), face=90.0, seat_h=0.36, lean=10.0)  # facing the table (+X)
    P.arms(e, 0.0, "L", 40.0, 10.0, 0.0, 60.0)
    P.arms(e, 0.0, "R", 38.0, 10.0, 0.0, 58.0)
    e.key("neck", 0.0, (10.0, 0.0, 0.0), "hold")  # reading the tea
    return e


def _elder_standing(sh, pos=ELDER_TO, face=127.0):  # toward #9 at the counter
    e = sh.person("TR-SUPPORTER-ELDER-01", "home", profile="elder")
    P.stance(e, 0.0, (pos.x, pos.y, 0.0), face, width=0.9)
    P.relax_arms(e, 0.0)
    e.key("hips_rot", 0.0, (9.0, 0.0, 0.0), "hold")  # a slight stoop
    e.key("neck", 0.0, (-8.0, 0.0, 0.0), "hold")  # chin up to meet the eyes
    return e


def _bag_in_hand(p, a, t=0.0, side="R"):
    bag = a["bag"]
    top = bag.matrix_world @ Vector((0, 0, 0.27))
    P.reach(p, t, side, tuple(top + Vector((0, 0.0, 0.05))), dur=0.01)
    p.hold_prop(bag, side, t + 0.02, 99.0)


def S05_SH01(sh):
    a = _set(sh)
    p = _nine(sh, a)
    e = _elder_seated(sh, a)
    bag = a["bag"]
    top = bag.matrix_world @ Vector((0, 0, 0.27))
    P.reach(p, 0.45, "R", tuple(top + Vector((0, 0.0, 0.05))), dur=0.3)
    p.hold_prop(bag, "R", 0.8, 99.0)
    p.key("hand.R", 1.15, tuple(top + Vector((0.05, -0.35, -0.12))), "soft")
    # the regular looks up from his tea, finds him
    e.key("neck", 0.55, (10.0, 0.0, 0.0), "hold")
    e.key("neck", 0.95, (-4.0, 0.0, 0.0), "soft")
    P.look(e, 0.6, NINE_AT + Vector((0, 0, 1.7)), w=0.8, dur=0.45, eyes_lead=0.12)
    # Solved: from the front-right corner a 24 mm holds #9 at the counter AND the regular by the window.
    cam = sh.camera(24, fstop=4.0)
    cam.place(0.0, (3.2, -2.5, 1.72), (-0.36, -0.72, 1.05), focus=NINE_AT + Vector((0, 0, 1.4)))
    cam.handheld("locked", 1.0)
    sh.finish()


def S05_SH02(sh):
    a = _set(sh)
    p = _nine(sh, a)
    _bag_in_hand(p, a)
    e = sh.person("TR-SUPPORTER-ELDER-01", "home", profile="elder")
    s = a["elder_seat"]
    P.stance(e, 0.0, (s.x + 0.5, s.y + 0.05, 0.0), 90.0, width=0.9)
    P.relax_arms(e, 0.0)
    e.key("hips_rot", 0.0, (9.0, 0.0, 0.0), "hold")
    P.walk(e, 0.1, [(ELDER_TO.x, ELDER_TO.y)], stride=0.42, cadence=1.6, style="elder", end_face=127.0)
    P.look(e, 0.0, NINE_AT + Vector((0, 0, 1.7)), w=0.8, dur=0.2)
    # #9 half-turns: the selfie is coming (shoulders set, a breath, free hand ready)
    p.key("face", 0.35, 180.0, "hold")
    p.key("face", 0.75, 250.0, "soft")  # a half-turn toward him (he faces the old man at ~287°)
    P.look(p, 0.3, ELDER_TO + Vector((0, 0, 1.65)), w=0.8, dur=0.35, eyes_lead=0.1)
    p.key("chest", 0.8, (-3.0, 0.0, 0.0), "soft")
    P.arms(p, 0.9, "L", 18.0, 12.0, 0.0, 40.0)
    cam = sh.camera(28, fstop=2.8)
    mid = (NINE_AT + ELDER_TO) * 0.5 + Vector((0, 0, 1.55))
    frame(cam, 0.0, mid, "MWS", heading=heading(mid, (3.2, -2.5)), el=4, focus=NINE_AT + Vector((0, 0, 1.6)))
    cam.handheld("observational", 1.0)
    sh.finish()


def S05_SH03(sh):
    a = _set(sh)
    p = _nine(sh, a, face=287.0)
    _bag_in_hand(p, a)
    e = _elder_standing(sh)
    nine_head = NINE_AT + Vector((0, 0, 1.7))
    P.look(e, 0.0, nine_head, w=0.85, dur=0.01, eyes_lead=0)
    la, lb = sh.line("L14")
    P.point_at(e, la - 0.15, "R", nine_head, dur=0.3)
    e.key("hand.R", lb + 0.1, tuple(e.ch["hand.R"].at(la + 0.2)), "hold")
    P.nod(e, la + 0.55, depth=5.0, dur=0.3)
    cam = sh.camera(50, fstop=2.2)
    head = ELDER_TO + Vector((0, 0, 1.68))
    # MCU, a touch low (he looks up at the star… and tells him what to do)
    frame(cam, 0.0, head, "MCU", heading=heading(ELDER_TO, NINE_AT) - 42, el=-6)
    cam.handheld("subtle", 0.8)
    sh.finish()


def S05_SH04(sh):
    a = _set(sh)
    p = _nine(sh, a, face=287.0)
    _bag_in_hand(p, a)
    e = _elder_standing(sh)
    elder_head = ELDER_TO + Vector((0, 0, 1.65))
    P.look(p, 0.0, elder_head, w=0.8, dur=0.01, eyes_lead=0)
    la, lb = sh.line("L15")
    P.nod(p, la + 0.05, depth=4.0, dur=0.35)
    P.release_look(p, lb - 0.1, 0.3)
    # walks off toward the door, past the old man
    P.walk(p, lb + 0.05, [(-0.2, -1.2)], stride=0.56, lead="L")
    cam = sh.camera(50, fstop=2.2)
    head = NINE_AT + Vector((0, 0, 1.7))
    frame(cam, 0.0, head, "MCU", heading=heading(NINE_AT, ELDER_TO) + 18, el=2)
    frame(cam, sh.dur, head + Vector((-0.25, -0.5, 0)), "MS", heading=heading(NINE_AT, ELDER_TO) + 18, el=2)
    cam.handheld("subtle", 0.8)
    sh.finish()


def S05_SH05(sh):
    a = _set(sh)
    start = Vector((-0.25, -1.3, 0))
    p = _nine(sh, a, pos=start, face=5.0)
    _bag_in_hand(p, a)
    e = _elder_standing(sh, pos=ELDER_TO + Vector((0.1, 0.2, 0)), face=-10.0)
    la, lb = sh.line("L16")
    P.point_at(e, la - 0.12, "R", Vector((-0.1, -2.4, 1.6)), dur=0.25)
    e.key("hips_rot", la, (2.0, 0.0, 0.0), "out")  # he rises up onto it
    door = a["door"]
    P.walk(p, 0.0, [(door.x + 0.05, -2.25)], stride=0.56, lead="R")
    P.smile(p, lb - 0.1, amount=0.55, dur=0.35, tilt=2.0)
    # the door opens as he reaches it
    piv = a["door_pivot"]
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = max(0.0, min(1.0, (t - 1.15) / 0.35))
        tr.setdefault((piv, "rotation_euler", 2), []).append(math.radians(-75 * (1 - (1 - u) ** 2)))
    write_tracks(tr, sh.frames)
    cam = sh.camera(35, fstop=2.8)
    cam.place(0.0, (door.x + 0.35, -4.4, 1.55), (door.x - 0.2, -1.2, 1.35), focus=start + Vector((0, 0, 1.6)))
    cam.place(sh.dur, (door.x + 0.35, -4.6, 1.55), (door.x - 0.1, -1.6, 1.4), focus=Vector((door.x, -2.3, 1.6)))
    cam.handheld("subtle", 0.8)
    sh.finish()


SHOTS = {"S05_SH01": S05_SH01, "S05_SH02": S05_SH02, "S05_SH03": S05_SH03, "S05_SH04": S05_SH04, "S05_SH05": S05_SH05}
