"""S04 — The drive: the radio, the mother."""
import math

import bpy
from mathutils import Vector

from ...cine import look
from ...cine import perform as P
from ...cine.perform import write_tracks
from ...cine.sets import car
from .s01 import seat_driver


def _car_day(sh, passenger=True):
    c = sh.cols
    a = car.build_interior(c["SET"], "day", passenger=passenger)
    bpy.context.view_layer.update()
    car.moving_world(sh.scene, c["SET"], sh.frames, sh.fps, "day", speed=9.0, seed=11)
    car.day_rig(sh.scene, c["LGT"], a)
    p = sh.person("TR-PLAYER-09", "hoodie", profile="calm")
    seat_driver(sh, p, a)
    d = a["driver"]
    road = Vector((d.x - 0.3, -14.0, 1.35))
    P.look(p, 0.0, road, w=0.85, dur=0.01, eyes_lead=0.0)
    p.key("gaze_at", 0.0, tuple(road), "hold")
    p.key("gaze_w", 0.0, 0.8, "hold")
    return a, p


def _radio_screen(sh, a, off_at=None):
    scr = a["radio"].data.materials[0] if a["radio"].data.materials else None
    if scr is None or off_at is None:
        return
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        tr.setdefault((scr, 'node_tree.nodes["Emission"].inputs[1].default_value', 0), []).append(2.2 if t < off_at else 0.0)
    write_tracks(tr, sh.frames)


def _reach_knob(p, a, t, back_at, side="R", twist=0.0):
    knob = a["knob"].matrix_world.translation
    P.reach(p, t, side, tuple(knob + Vector((0.0, 0.03, 0.06))), dur=0.35, rot=(-60.0, twist, 0.0))
    # back to the wheel
    w = a["wheel_obj"].matrix_world @ Vector((-car.WHEEL_R * 0.98, 0, 0.02))
    p.key(f"hand.{side}", back_at, tuple(w + Vector((0, 0.03, 0.03))), "soft")
    p.key(f"hand_rot.{side}", back_at, (-55.0, 0.0, 0.0), "soft")


def S04_SH01(sh):
    a, p = _car_day(sh, passenger=False)  # the camera sits in the passenger seat
    _reach_knob(p, a, 0.85, 1.65, twist=-25.0)
    p.key("hand_rot.R", 1.35, (-60.0, -40.0, 0.0), "soft")  # turns it down
    cam = sh.camera(28, fstop=4.0)
    d = a["driver"]
    cam.place(0.0, (-0.6, 0.45, 1.45), (0.25, -0.05, 1.28), focus=(d.x, d.y - 0.1, 1.4))  # #9 + radio + pennant
    cam.handheld("subtle", 1.3)
    sh.finish()


def S04_SH02(sh):
    a, p = _car_day(sh)
    la, lb = sh.line("L12")
    _reach_knob(p, a, la + 0.05, la + 0.75)
    _radio_screen(sh, a, off_at=sh.sfx_at("radio-off") or la + 0.22)
    d = a["driver"]
    head = Vector((d.x, d.y - 0.04, 1.40))
    # eyes on the road, which is past the lens: aim them at a point off to the lens's side
    off = Vector((d.x - 0.9, -9.0, 1.2))
    p.key("gaze_at", 0.0, tuple(off), "hold")
    p.key("look_at", 0.0, tuple(off), "hold")
    ia, ib = sh.line("L11")
    P.glance(p, ia + 0.6, -0.25, 0.0, dur=0.12, hold=0.3, back=0.15)
    cam = sh.camera(50, fstop=2.8)
    cam.place(0.0, (d.x - 0.12, -2.55, 1.52), head + Vector((0, 0, -0.06)), focus=head + Vector((0, -0.3, 0)))
    cam.handheld("locked", 1.8)
    sh.finish()


def S04_SH03(sh):
    a, p = _car_day(sh, passenger=False)
    win = sh.scene.objects.get("CAR_WindowR")
    if win:
        win.hide_render = True  # window rolled down: no sky veil over the profile
    d = a["driver"]
    la, lb = sh.line("L13")
    # a beat of stillness, then the line; a tiny head shake on "anyway"
    P.smile(p, lb - 0.7, amount=0.3, dur=0.35, tilt=1.0, nod=0.5)
    p.key("neck", lb - 0.6, (0.0, 0.0, 3.0), "soft")
    p.key("neck", lb - 0.3, (0.0, 0.0, -2.0), "soft")
    p.key("neck", lb, (0.0, 0.0, 0.0), "soft")
    head = Vector((d.x, d.y - 0.04, 1.40))
    cam = sh.camera(85, fstop=2.0)
    cam.place(0.0, (d.x - 3.7, head.y - 0.8, 1.5), head + Vector((0, -0.1, -0.08)))
    cam.place(sh.dur, (d.x - 3.6, head.y - 0.78, 1.5), head + Vector((0, -0.1, -0.08)), e="linear")
    cam.handheld("locked", 1.6)
    sh.finish()


SHOTS = {"S04_SH01": S04_SH01, "S04_SH02": S04_SH02, "S04_SH03": S04_SH03}
