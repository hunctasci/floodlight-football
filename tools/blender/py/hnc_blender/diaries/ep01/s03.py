"""S03 — Breakfast: eggs, and coffee (absurdly)."""
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.perform import write_tracks
from ...cine.sets import home


def _kitchen(sh, time="morning"):
    a = home.kitchen(sh.scene, sh.cols["SET"], sh.cols["LGT"], time)
    bpy.context.view_layer.update()
    return a


def _cook(sh, a, look_id="home"):
    p = sh.person("TR-PLAYER-09", look_id, profile="calm")
    c = a["cook"]
    P.stance(p, 0.0, (c.x, c.y, 0.0), 0.0)
    P.relax_arms(p, 0.0)
    return p


def _partner_back(sh, a, pos=(-2.35, 1.35), face=180.0):
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    P.stance(q, 0.0, (pos[0], pos[1], 0.0), face)
    P.arms(q, 0.0, "L", 35.0, 8.0, 0.0, 70.0)
    P.arms(q, 0.0, "R", 30.0, 8.0, 0.0, 65.0)
    return q


def _pan_hand(p, a, side="R"):
    """Hand on the pan handle (world point of the handle end)."""
    h = a["pan"].matrix_world @ Vector((0.13 + 0.16, 0, 0.05))
    P.reach(p, 0.0, side, tuple(h + Vector((0, 0, 0.05))), dur=0.01, rot=(-20.0, 0.0, 0.0))


def S03_SH01(sh):
    a = _kitchen(sh)
    c = sh.cols
    pan = a["pan"]
    centre = pan.matrix_world @ Vector((0, 0, 0.012))
    egg = props.egg_whole(c["PROPS"], "PROP_EggFalling", tuple(centre + Vector((0.01, 0, 0.5))))
    fried = props.egg_fried(c["PROPS"], "PROP_EggFried", tuple(centre + Vector((0.01, 0, 0.0))))
    oil = look.flat("Oil", "#e9c46a", rough=0.02, coat=1.0, alpha=0.35)
    props.cyl(c["PROPS"], "PROP_Oil", 0.11, 0.002, oil, tuple(centre + Vector((0, 0, -0.004))), segs=32)
    t_hit = 0.32
    tracks = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = min(1.0, t / t_hit)
        z = centre.z + 0.5 * (1 - u * u) + 0.012
        for i, v in enumerate((centre.x + 0.01, centre.y, z)):
            tracks.setdefault((egg, "location", i), []).append(v)
        spread = 0.0 if t < t_hit else min(1.0, 0.35 + (t - t_hit) / 0.12)
        s = max(0.001, spread)
        for i, v in enumerate((s, s, 1.0)):
            tracks.setdefault((fried, "scale", i), []).append(v)
        tracks.setdefault((egg, "hide_render", 0), []).append(1.0 if t >= t_hit else 0.0)
    write_tracks(tracks, sh.frames)
    cam = sh.camera(100, fstop=3.2)
    cam.place(0.0, centre + Vector((0.35, -0.95, 0.5)), centre + Vector((0, 0, 0.04)))
    cam.place(sh.dur, centre + Vector((0.32, -0.87, 0.46)), centre + Vector((0, 0, 0.04)), e="linear")
    cam.handheld("locked", 1.0)
    sh.finish(glare=0.5, threshold=0.8)


def S03_SH02(sh):
    a = _kitchen(sh)
    p = _cook(sh, a)
    _pan_hand(p, a, "R")
    q = _partner_back(sh, a)
    pan_c = a["pan"].matrix_world.translation
    P.look(p, 0.0, pan_c, w=0.85, dur=0.01, eyes_lead=0)
    p.key("chest", 0.0, (8.0, 0.0, 0.0), "hold")
    la, lb = sh.line("L07")
    P.nod(p, la + 0.05, depth=3.0, dur=0.35)
    ta, tb = sh.line("L08")
    # the pan gets a small shake while he waits (the answer really is just eggs)
    h = a["pan"].matrix_world @ Vector((0.29, 0, 0.1))
    p.key("hand.R", ta + 0.3, tuple(h + Vector((0.0, 0.0, 0.0))), "soft")
    p.key("hand.R", ta + 0.45, tuple(h + Vector((0.0, -0.03, 0.0))), "soft")
    p.key("hand.R", ta + 0.62, tuple(h), "soft")
    cam = sh.camera(35, fstop=2.8)
    c = a["cook"]
    cam.place(0.0, (c.x + 0.55, -2.25, 1.62), (c.x + 0.05, c.y, 1.18), focus=(c.x, c.y - 0.3, 1.5))
    cam.place(sh.dur, (c.x + 0.45, -2.15, 1.6), (c.x + 0.05, c.y, 1.18), focus=(c.x, c.y - 0.3, 1.5), e="linear")
    cam.handheld("observational", 1.0)
    sh.finish()


def _stream(sh, carafe, mug, t0, t1):
    """Coffee stream from the carafe spout to the mug while pouring (baked per frame)."""
    st = props.cyl(sh.cols["PROPS"], "PROP_Stream", 0.006, 1.0, look.flat("StreamCoffee", "#2a1406", rough=0.05, coat=1.0), (0, 0, 0), segs=10, r2=0.0045)
    tracks = {}
    sc = sh.scene
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        sc.frame_set(f)
        spout = carafe.matrix_world @ Vector((0.062, 0, 0.2))
        target = mug.matrix_world @ Vector((0, 0, 0.08))
        on = t0 <= t <= t1
        down = Vector((spout.x, spout.y, target.z))
        L = max(0.01, spout.z - target.z)
        for i, v in enumerate(down):
            tracks.setdefault((st, "location", i), []).append(v)
        for i, v in enumerate((1.0, 1.0, L)):
            tracks.setdefault((st, "scale", i), []).append(v)
        tracks.setdefault((st, "hide_render", 0), []).append(0.0 if on else 1.0)
    write_tracks(tracks, sh.frames)
    sc.frame_set(1)


def S03_SH03(sh):
    a = _kitchen(sh)
    p = _cook(sh, a)
    car, mug = a["carafe"], a["mug"]
    la, lb = sh.line("L09")
    handle = car.matrix_world @ Vector((-0.085, 0, 0.11))
    # pick up the carafe (right hand), lift over the mug, roll to pour… and keep pouring
    P.look(p, 0.0, mug.matrix_world.translation, w=0.7, dur=0.01, eyes_lead=0)
    P.reach(p, 0.0, "R", tuple(handle + Vector((-0.02, 0, 0.04))), dur=0.01, rot=(0.0, 0.0, -90.0))
    p.hold_prop(car, "R", 0.05, 99.0)
    over = mug.matrix_world @ Vector((-0.14, 0.0, 0.3))
    p.key("hand.R", 0.35, tuple(over), "soft")
    p.key("hand_rot.R", 0.35, (0.0, 0.0, -90.0), "soft")
    p.key("hand_rot.R", 0.6, (0.0, 48.0, -90.0), "soft")  # roll toward his left: the carafe tips over the mug
    t_take = 2.05
    p.key("hand_rot.R", t_take + 0.1, (0.0, 48.0, -90.0), "hold")
    p.key("hand_rot.R", t_take + 0.45, (0.0, 5.0, -90.0), "soft")  # stops when the mug leaves
    # mug fills while he pours (coffee disc rises)
    cof = next(o for o in mug.children if "Coffee" in o.name)
    base_z = cof.location.z
    cof.location.z = 0.02
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = max(0.0, min(1.0, (t - 0.6) / 1.4))
        tr.setdefault((cof, "location", 2), []).append(0.02 + (0.092 - 0.02) * u)
    write_tracks(tr, sh.frames)
    # the partner walks in from frame right, slides the mug away, leaves sipping
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    start = Vector((1.6, 0.95, 0.0))
    P.stance(q, 0.0, tuple(start), 90.0)
    P.relax_arms(q, 0.0)
    t = P.walk(q, 0.9, [(0.25, 0.95)], lead="R", end_face=90.0, stride=0.5)
    mpos = mug.matrix_world.translation
    P.reach(q, t_take - 0.3, "L", tuple(mpos + Vector((0.06, -0.02, 0.13))), dur=0.35)
    q.hold_prop(mug, "L", t_take, 99.0)
    q.key("hand.L", t_take + 0.35, tuple(mpos + Vector((0.55, -0.1, 0.25))), "soft")
    # his eyes follow the cup; the head a little behind them
    p.key("gaze_at", t_take, tuple(mpos), "hold")
    p.key("gaze_w", t_take, 0.0, "hold")
    p.key("gaze_w", t_take + 0.12, 1.0, "out")
    p.key("gaze_at", t_take + 0.7, tuple(mpos + Vector((1.2, -0.2, 0.3))), "soft")
    p.key("look_at", t_take + 0.2, tuple(mpos), "hold")
    p.key("look_at", t_take + 0.9, tuple(mpos + Vector((1.1, -0.3, 0.2))), "soft")
    P.stance(q, t_take + 0.5, (0.25, 0.95, 0.0), 90.0, e="hold")
    q.ch["face"].key(t_take + 0.8, -90.0 + 180.0 + 90.0, "soft")
    q.bake()
    q._baked = True
    p.bake()
    p._baked = True
    _stream(sh, car, mug, 0.62, t_take + 0.25)
    cam = sh.camera(50, fstop=2.4)
    c = a["cook"]
    cam.place(0.0, (c.x + 1.5, -2.0, 1.35), (c.x + 0.35, c.y - 0.25, 1.32), focus=(mpos.x, mpos.y, mpos.z + 0.3))
    cam.handheld("locked", 1.0)
    sh.finish()


SHOTS = {"S03_SH01": S03_SH01, "S03_SH02": S03_SH02, "S03_SH03": S03_SH03}
