"""S05 — 2000: Brussels. One night, two living rooms (as the two kids remember it)."""
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.perform import write_tracks
from ...cine.sets import home
from .room import chair_shot


def _living(sh, rug=None):
    a = home.living(sh.scene, sh.cols["SET"], sh.cols["LGT"], "night")
    if rug:  # a different family's room: the rug and the prints change
        r = bpy.data.objects.get("LIV_Rug")
        if r and r.data.materials:
            r.data.materials[0] = look.fabric("LivRug2000", rug, rough=0.95, sheen=0.3)
    bpy.context.view_layer.update()
    return a


def _crt(sh, at, face_y=1.0):
    """A 2000-era CRT on a low cabinet, screen toward +Y; its glow is a flickering area light."""
    c = sh.cols
    plastic = look.flat("CRT_Plastic", "#2a2b2e", rough=0.5)
    props.box(c["PROPS"], "CRT_Cabinet", (1.2, 0.48, 0.5), look.pbr("CRT_Wood", "walnut_veneer", scale=1.0), (at.x, at.y, 0.0), bevel=0.01)
    props.box(c["PROPS"], "CRT_Body", (0.82, 0.6, 0.6), plastic, (at.x, at.y, 0.5), bevel=0.04)
    glow = look.area(c["LGT"], "LGT_TVGlow", (at.x, at.y + 0.35 * face_y, 0.8), (at.x, at.y + 3.0 * face_y, 1.1), (0.7, 0.5), 55, "#bcd2ff")
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        flick = 1.0 + 0.18 * math.sin(t * 23.0) * math.sin(t * 7.3) + 0.08 * math.sin(t * 61.0)
        tr.setdefault((glow.data, "energy", 0), []).append(55 * flick)
    write_tracks(tr, sh.frames)
    return glow


def _wild_walls(sh, targets):
    """Film-set 'wild walls': hide any set piece standing between the lens and the subjects
    (walls, curtains) — raycast from the camera at the first and last frame."""
    sc = sh.scene
    for fr in (1, sh.frames):
        sc.frame_set(fr)
        dg = bpy.context.evaluated_depsgraph_get()
        c = sc.camera.matrix_world.translation
        for tgt in targets:
            for _ in range(6):
                hit, loc, _n, _i, obj, _m = sc.ray_cast(dg, c, (Vector(tgt) - c).normalized(), distance=(Vector(tgt) - c).length - 0.3)
                if not hit or obj.name not in sh.cols["SET"].all_objects:
                    break
                obj.hide_render = True
                obj.hide_viewport = True
                dg.update()
    sc.frame_set(1)


def S05_SH01(sh):
    chair_shot(sh)


def S05_SH02(sh):
    """Türkiye, June 2000: the goal on the TV; his father lifts him so high his head knocks the lamp."""
    a = _living(sh)
    tv = Vector((0.0, -1.55, 0.0))
    _crt(sh, tv, face_y=1.0)
    stand = Vector((0.0, -0.35, 0.0))
    f = sh.person("TR-FAMILY-FATHER-01", "home", profile="calm")
    P.stance(f, 0.0, (stand.x, stand.y, 0.0), 0.0, width=1.15)  # facing the TV (-Y)
    k = sh.person("TR-PLAYER-09-KID", "home", profile="child")
    P.stance(k, 0.0, (stand.x, stand.y - 0.45, 0.0), 0.0)
    for s in "LR":
        k.key(f"ik_foot.{s}", 0.0, 0.0, "hold")  # legs dangle (FK) once he's off the floor
        k.key(f"leg.{s}", 0.0, (12.0, 6.0, 28.0), "hold")
    # the lift: hands under his arms, chest height → overhead on the goal; two bounces of joy
    t_goal = 0.3
    zs = [(0.0, 1.15, "hold"), (t_goal, 1.15, "hold"), (t_goal + 0.85, 2.08, "out"), (t_goal + 1.15, 1.92, "soft"), (t_goal + 1.45, 2.06, "soft"), (t_goal + 1.8, 1.98, "soft")]
    for s_, dx in (("L", 0.2), ("R", -0.2)):
        P.reach(f, 0.0, s_, tuple(f.char_point(0.0, (dx, 0.42, 1.15))), dur=0.01)
        for t, z, e in zs:
            f.key(f"hand.{s_}", t, tuple(f.char_point(t, (dx, 0.42 - 0.12 * (z - 1.15), z))), e)
    f.key("neck", t_goal + 0.3, (0.0, 0.0, 0.0), "hold")
    f.key("neck", t_goal + 0.9, (-14.0, 0.0, 0.0), "soft")  # looks up at him
    f.key("chest", t_goal + 0.9, (-6.0, 0.0, 0.0), "soft")
    f.bake()
    f._baked = True
    # the kid rides the father's hands (per frame, from the baked arm tips)
    arm = f.rig.arm
    sc = sh.scene
    sh_z = k.dims["shoulder"]
    for fr in range(1, sh.frames + 1, 2):
        t = (fr - 1) / sh.fps
        sc.frame_set(fr)
        tips = [arm.matrix_world @ arm.pose.bones[f"hand.{s_}"].tail for s_ in "LR"]
        mid = (tips[0] + tips[1]) * 0.5
        k.key("pos", t, (mid.x, mid.y - 0.12, mid.z - sh_z + 0.06), "linear")
    sc.frame_set(1)
    P.arms(k, t_goal + 0.2, "L", 160.0, 25.0, 0.0, 15.0)  # arms up: goal
    P.arms(k, t_goal + 0.2, "R", 160.0, 25.0, 0.0, 15.0)
    P.smile(k, t_goal + 0.3, amount=0.8, dur=0.3)
    k.bake()
    k._baked = True
    # the pendant hangs exactly where his head peaks: the knock is contact, not a guess
    # (the head bone points forward from the neck: the crown is the neck joint + head height, not the bone tip)
    karm = k.rig.arm
    crown_up = (k.dims["head"][2] - k.dims["neck"]) + k.dims["head_r"]

    def crown(fr):
        sc.frame_set(fr)
        return karm.matrix_world @ karm.pose.bones["head"].head + Vector((0.0, 0.0, crown_up))

    peak_f = max(range(1, sh.frames + 1, 2), key=lambda fr: crown(fr).z)
    top = crown(peak_f) + Vector((0.0, 0.04, 0.0))  # a touch behind the crown: it clips the back of his head
    sc.frame_set(1)
    ceiling = 2.95
    pivot = bpy.data.objects.new("LIV_PendantPivot", None)
    pivot["hnc_generated"] = True
    sh.cols["PROPS"].objects.link(pivot)
    pivot.location = (top.x + 0.08, top.y, ceiling)
    cord = ceiling - (top.z + 0.02)
    shade_m = look.flat("Pendant2000", "#c8b48a", rough=0.6)
    props.cyl(sh.cols["PROPS"], "LIV_PendantCord", 0.004, cord, look.flat("Cord", "#1a1a1a"), (0, 0, -cord), segs=6, parent=pivot)
    props.lathe(sh.cols["PROPS"], "LIV_PendantShade", [(0.0, 0.0), (0.2, 0.0), (0.15, 0.17), (0.03, 0.22), (0.0, 0.22)], shade_m, (0, 0, -cord - 0.22 + 0.22), parent=pivot)
    look.point(sh.cols["LGT"], "LGT_Pendant2000", (top.x + 0.08, top.y, top.z - 0.05), 60, "#ffd29a", radius=0.06)
    t_hit = (peak_f - 1) / sh.fps
    tr = {}
    for fr in range(1, sh.frames + 1):
        u = (fr - 1) / sh.fps - t_hit
        w = 0.0 if u < 0 else 16.0 * math.exp(-1.6 * u) * math.sin(u * 5.2)
        tr.setdefault((pivot, "rotation_euler", 0), []).append(math.radians(w))
    write_tracks(tr, sh.frames)
    # past the TV (its dark back in the foreground), up at them: room for the lamp above.
    # The room's front wall is at y ≈ -2.8: the camera stays inside it.
    cam = sh.camera(20, fstop=2.8)
    cam.place(0.0, (0.85, -2.6, 1.15), (0.0, -0.6, 1.6), focus=(0.0, -0.65, 1.6))
    cam.place(sh.dur, (0.8, -2.5, 1.15), (0.0, -0.6, 1.65), focus=(0.0, -0.65, 1.6), e="linear")
    cam.handheld("subtle", 0.7)
    sh.cam.bake()
    _wild_walls(sh, [(0.0, -0.6, 1.0), (0.0, -0.6, 1.7), (0.0, -0.8, 2.3)])
    sh.finish(glare=0.4, threshold=0.9, vignette=0.45)


def S05_SH04(sh):
    """Belgium, the same night: the co-hosts are out. A boy cries into his hands; his mum holds him."""
    a = _living(sh, rug="#4b5a73")
    tv = Vector((0.0, -1.4, 0.0))
    _crt(sh, tv, face_y=1.0)
    k = sh.person("BE-PLAYER-04-KID", "home", profile="child")
    sl, sr = a["seat_l"], a["seat_r"]
    P.sit(k, 0.0, (sl.x + 0.12, sl.y, 0.0), face=0.0, seat_h=0.36, feet_fwd=0.22, lean=14.0, e="hold")
    k.key("neck", 0.0, (24.0, 0.0, 6.0), "hold")  # head down
    face = k.char_point(0.0, (0.0, 0.32, k.dims["head"][2] - 0.08))
    for s_, dx in (("L", 0.13), ("R", -0.13)):  # hands over his eyes
        P.reach(k, 0.0, s_, tuple(face + k.world_from_char(0.0, (dx, 0.0, 0.0))), dur=0.01)
    for i in range(int(sh.dur / 0.32)):  # the sobs: small fast shudders of the chest and shoulders
        t = 0.1 + i * 0.32
        k.key("chest", t, (2.0, 0.0, 0.0), "soft")
        k.key("chest", t + 0.12, (-2.5, 0.0, 0.0), "out")
    k.key("drift_amp", 0.0, 0.3, "hold")
    mum = sh.person("BE-FAMILY-MUM-01", "home", profile="calm")
    P.sit(mum, 0.0, (sr.x - 0.05, sr.y, 0.0), face=-28.0, seat_h=0.36, lean=8.0, e="hold")
    far_shoulder = k.char_point(0.0, (0.26, -0.02, k.dims["shoulder"]))
    P.reach(mum, 0.0, "L", tuple(far_shoulder), dur=0.01)  # her arm around him
    P.look(mum, 0.0, face, w=0.8, dur=0.01, eyes_lead=0)
    mum.key("head", 0.0, (8.0, 6.0, 0.0), "hold")
    for t in (0.6, 1.5, 2.4):  # she rubs his back
        mum.key("hand.L", t, tuple(far_shoulder + Vector((0.0, 0.0, -0.05))), "soft")
        mum.key("hand.L", t + 0.45, tuple(far_shoulder), "soft")
    # front-left, low, off the TV's axis: her face turned to him, his hands over his eyes, the glow on both
    cam = sh.camera(28, fstop=2.4)
    cam.place(0.0, (-1.15, -1.0, 1.05), (-0.1, 1.3, 0.9), focus=(sl.x + 0.1, sl.y, 0.95))
    cam.place(sh.dur, (-1.1, -0.92, 1.05), (-0.1, 1.3, 0.9), focus=(sl.x + 0.1, sl.y, 0.95), e="linear")
    cam.handheld("locked", 0.8)
    sh.finish(glare=0.3, threshold=1.0, vignette=0.5)


def S05_SH05(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S05_SH")}
