"""S10 — Matchday: shirt, bag, shoes, watch, goodbye… CAR DOOR → BUS DOOR."""
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.camera import frame, impact
from ...cine.perform import heading, write_tracks
from ...cine.sets import home, street, tunnel
from ...paths import GENERATED

# The match-cut frame: both door shots use this exact camera (same line, same lens).
DOOR_CAM = dict(pos=(-0.35, -3.3, 1.25), target=(-0.35, 0.0, 1.15), lens=35)


def _bedroom_bag(sh):
    a = home.bedroom(sh.scene, sh.cols["SET"], sh.cols["LGT"], "morning")
    bpy.context.view_layer.update()
    on_bed = Vector((a["bx"] - 0.2, a["by"] - 0.4, a["bed"].z))
    bag = props.duffel(sh.cols["PROPS"], "PROP_Bag", tuple(on_bed), rot=(0, 0, 10))
    return a, bag, on_bed


def S10_SH01(sh):
    a, bag, on_bed = _bedroom_bag(sh)
    shirt = props.tr_shirt(sh.cols["PROPS"], "PROP_ShirtFolded", tuple(on_bed + Vector((0, 0, 0.6))), rot=(0, 0, 10), folded=True)
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = min(1.0, t / 0.3)
        tr.setdefault((shirt, "location", 2), []).append(on_bed.z + 0.62 - 0.36 * (1 - (1 - u) ** 3))
    write_tracks(tr, sh.frames)
    cam = sh.camera(50, fstop=2.8)
    frame(cam, 0.0, on_bed + Vector((0, 0, 0.3)), 0.9, heading=-25, el=50, headroom=False)
    cam.handheld("subtle", 0.6)
    sh.finish()


def S10_SH02(sh):
    a, bag, on_bed = _bedroom_bag(sh)
    slider = props.box(sh.cols["PROPS"], "PROP_Zip", (0.04, 0.03, 0.02), look.flat("ZipMetal", "#c0c0c4", rough=0.2, metal=1.0), (0, 0, 0))
    slider.parent = bag
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = min(1.0, t / 0.3)
        tr.setdefault((slider, "location", 0), []).append(-0.25 + 0.5 * (1 - (1 - u) ** 2))
        tr.setdefault((slider, "location", 2), []).append(0.3)
    write_tracks(tr, sh.frames)
    cam = sh.camera(50, fstop=2.4)
    frame(cam, 0.0, on_bed + Vector((0, 0, 0.3)), 0.7, heading=-60, el=35, headroom=False)
    cam.handheld("subtle", 0.6)
    sh.finish()


def _entry_morning(sh, door_open=0.0):
    a = home.entry(sh.scene, sh.cols["SET"], sh.cols["LGT"], "morning", door_open=door_open)
    bpy.context.view_layer.update()
    return a


def S10_SH03(sh):
    """Shoes on: low on the entry mat, the boot comes down and plants (the travel-top sleeve above)."""
    a = _entry_morning(sh)
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    at = Vector((0.6, 1.1, 0))
    P.stance(p, 0.0, (at.x, at.y, 0.0), 0.0)
    f0 = Vector(p.ch["foot.R"].at(0))
    p.key("foot.R", 0.0, tuple(f0 + Vector((0.0, -0.05, 0.14))), "hold")
    p.key("foot.R", 0.22, tuple(f0), "in")  # stamps into the shoe
    p.key("hips", 0.0, (0.0, 0.0, -0.05), "hold")
    look.spot(sh.cols["LGT"], "LGT_FloorPool", tuple(f0 + Vector((-0.4, -0.6, 1.4))), tuple(f0), 160, "#fff1dd", angle=35, blend=0.6)
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, f0 + Vector((0.05, -0.1, 0.06)), 0.6, heading=-30, el=4, headroom=False)
    cam.handheld("subtle", 0.6)
    sh.finish()


def S10_SH04(sh):
    """Watch: it waits on the entry bench; his hand takes it."""
    a = _entry_morning(sh)
    b = a["bench"]
    spot = Vector((b.x - 0.25, b.y - 0.05, b.z))
    w = props.external(sh.cols["PROPS"], "digital_wrist_watch", loc=tuple(spot), rot=(0, 0, 25))
    w.scale = [1.8] * 3
    look.spot(sh.cols["LGT"], "LGT_BenchPool", tuple(spot + Vector((0.2, -0.3, 1.2))), tuple(spot), 120, "#fff1dd", angle=30, blend=0.6)
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    at = spot + Vector((0.1, -0.85, 0))
    P.stance(p, 0.0, (at.x, at.y, 0.0), 0.0 + 180.0)
    bpy.context.view_layer.update()
    top = w.matrix_world.translation
    P.reach(p, 0.0, "R", tuple(top + Vector((0.0, 0.05, 0.25))), dur=0.01)
    p.key("hand.R", 0.14, tuple(top + Vector((0.0, 0.02, 0.06))), "out")
    p.hold_prop(w, "R", 0.16, 99.0)
    p.key("hand.R", 0.4, tuple(top + Vector((0.05, -0.1, 0.3))), "soft")
    cam = sh.camera(85, fstop=2.2)
    frame(cam, 0.0, top + Vector((0, 0, 0.16)), 0.85, heading=-60, el=24, headroom=False)  # front-left, inside the room; wide enough for his hand
    cam.handheld("subtle", 0.5)
    sh.finish()


def S10_SH05(sh):
    """The goodbye: he kneels, the child runs in, the partner in the doorway."""
    a = _entry_morning(sh, door_open=1.0)
    d = a["door"]
    kneel_at = Vector((0.2, 0.9, 0))
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    face = heading(kneel_at, (-1.6, 0.3))
    P.kneel(p, 0.0, (kneel_at.x, kneel_at.y), face, e="hold", front="L")
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="child")
    kstart = Vector((-2.0, -0.2, 0))
    hug_at = kneel_at + (Vector((-1.6, 0.3, 0)) - kneel_at).normalized() * 0.62
    P.stance(k, 0.0, (kstart.x, kstart.y, 0.0), heading(kstart, kneel_at))
    t = P.walk(k, 0.0, [(hug_at.x, hug_at.y)], stride=0.42, cadence=2.8, style="child", end_face=heading(hug_at, kneel_at))
    # the hug: his arms close around the child as the child arrives; the child's arms go around his neck
    t_h = 0.75
    back = hug_at + (hug_at - kneel_at).normalized() * 0.1
    for s_, dx in (("L", 0.22), ("R", -0.22)):
        P.reach(p, t_h - 0.3, s_, tuple(p.char_point(t_h, (dx * 1.3, 0.55, 0.85))), dur=0.35)
        P.reach(k, t_h - 0.05, s_, tuple(p.char_point(t_h, (dx * 1.1, 0.1, 1.2))), dur=0.25)
    p.key("chest", t_h, (10.0, 0.0, 0.0), "soft")
    p.key("neck", t_h + 0.1, (8.0, 0.0, 6.0), "soft")
    P.smile(p, t_h + 0.1, amount=0.45, dur=0.4)
    # the partner leans on the doorframe
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    qpos = Vector((d.x + 0.35, d.y - 0.45, 0))
    P.stance(q, 0.0, (qpos.x, qpos.y, 0.0), heading(qpos, kneel_at))
    q.key("hips_rot", 0.0, (0.0, 5.0, 0.0), "hold")
    P.arms(q, 0.0, "L", 45.0, 10.0, 0.0, 100.0, e="hold")  # arms folded
    P.arms(q, 0.0, "R", 45.0, 10.0, 0.0, 100.0, e="hold")
    P.look(q, 0.0, kneel_at + Vector((0, 0, 1.2)), w=0.8, dur=0.01, eyes_lead=0)
    cam = sh.camera(35, fstop=2.8)
    frame(cam, 0.0, kneel_at + Vector((-0.4, -0.2, 1.05)), "MWS", heading=-25, el=4, headroom=False)
    cam.handheld("subtle", 0.7)
    sh.finish()


def _door_cam(sh):
    cam = sh.camera(DOOR_CAM["lens"], fstop=4.0)
    cam.place(0.0, DOOR_CAM["pos"], DOOR_CAM["target"])
    cam.handheld("locked", 1.0)
    return cam


def S10_SH06(sh):
    """CAR DOOR CLOSES — its rear edge sweeps screen-left and slams on the cut line."""
    close_at = sh.sfx_at("car-door") or 0.45
    a = street.car_door_exterior(sh.scene, sh.cols["SET"], sh.cols["LGT"], sh.frames, sh.fps, close_at=close_at)
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    d = a["driver"]
    # he has just sat down: hand still pulling the door, eyes forward
    P.sit(p, 0.0, (d.x, d.y, 0.0), face=90.0, seat_h=0.52, feet_fwd=0.45, e="hold")
    P.look(p, 0.0, (d.x + 6, d.y, 1.6), w=0.7, dur=0.01, eyes_lead=0)
    cam = _door_cam(sh)
    impact(cam, close_at, 0.5, 0.2)
    sh.finish()


def S10_SH07(sh):
    """BUS DOOR OPENS — same frame line, same direction; he steps out in the red travel top."""
    a = street.bus_arrival(sh.scene, sh.cols["SET"], sh.cols["LGT"], sh.frames, sh.fps, open_at=0.0)
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    ins = a["inside"]
    X = ins.x
    P.stance(p, 0.0, (X, ins.y, 0.35), 0.0)
    P.relax_arms(p, 0.0)
    # waits on the top step as the door slides, then steps down onto the forecourt
    p.key("pos", 0.42, (X, ins.y, 0.35), "hold")
    p.key("pos", 0.72, (X, 0.3, 0.18), "smooth")
    p.key("pos", 1.02, (X, -0.55, 0.0), "smooth")
    for s_, dx in (("L", 0.2), ("R", -0.2)):
        p.key(f"foot.{s_}", 0.42, (X + dx, ins.y, 0.35 + p.dims["ankle"]), "hold")
    p.key("foot.L", 0.58, (X + 0.2, 0.2, 0.18 + p.dims["ankle"] + 0.06), "smooth")
    p.key("foot.L", 0.68, (X + 0.2, 0.05, 0.18 + p.dims["ankle"]), "out")
    p.key("foot.R", 0.8, (X - 0.2, -0.3, p.dims["ankle"] + 0.08), "smooth")
    p.key("foot.R", 0.92, (X - 0.2, -0.45, p.dims["ankle"]), "out")
    p.key("foot.L", 1.02, (X + 0.2, -0.6, p.dims["ankle"] + 0.06), "smooth")
    p.key("foot.L", 1.1, (X + 0.2, -0.75, p.dims["ankle"]), "out")
    P.look(p, 0.5, (X - 2.5, -6.0, 1.7), w=0.6, dur=0.4)  # the noise to his right
    cam = _door_cam(sh)
    sh.finish()


def S10_SH08(sh):
    """Tracking past supporters behind the barrier; phones flash."""
    a = street.bus_arrival(sh.scene, sh.cols["SET"], sh.cols["LGT"], sh.frames, sh.fps, open_at=-5)
    p = sh.person("TR-PLAYER-09", "travel", profile="calm")
    y = -3.2
    P.stance(p, -0.8, (-3.5, y, 0.0), 90.0)
    P.walk(p, -0.8, [(3.0, y)], stride=0.6, cadence=1.9, style="focused", lead="L")
    flashes = []
    for i, x in enumerate((-2.4, -1.2, 0.2, 1.4, 2.6)):
        who = "FAN-TR" if i % 2 == 0 else "FAN-BE"
        f = sh.person(who, "home", profile="calm")
        fpos = Vector((x, a["barrier_y"] - 0.7, 0))
        P.stance(f, 0.0, (fpos.x, fpos.y, 0.0), 180.0)
        side = "R" if i % 2 else "L"
        P.arms(f, 0.0, side, 120.0 if i % 2 else 75.0, 20.0, 0.0, 40.0, e="hold")  # phones up
        f.key("hips", 0.0, (0.0, 0.0, 0.0), "hold")
        for tt in (0.2, 0.5, 0.8):
            f.key("hips", tt + i * 0.05, (0.0, 0.0, 0.03), "soft")
            f.key("hips", tt + 0.15 + i * 0.05, (0.0, 0.0, 0.0), "soft")
        flashes.append((x, a["barrier_y"] - 0.55, 2.2))
    street.phone_flashes(sh.cols["FX"], sh.frames, sh.fps, flashes)
    # from the bus side: he walks sharp in the foreground, the supporters soft behind the barrier
    cam = sh.camera(50, fstop=1.8)
    for t in (0.0, sh.dur):
        x = p.ch["pos"].at(t)[0]
        cam.place(t, (x + 0.6, -0.35, 1.75), (x - 0.2, -4.2, 1.45), focus=(x, y, 1.6), e="linear")
    cam.handheld("follow", 0.7)
    sh.finish()


def S10_SH09(sh):
    """The match-graphic plate: the tunnel mouth, slow push (Remotion sets the type over it)."""
    a = tunnel.tunnel(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    cam = sh.camera(35, fstop=2.8)
    cam.place(0.0, (0.0, 4.0, 1.4), (0.0, 22.0, 1.5))
    cam.place(sh.dur, (0.0, 4.8, 1.4), (0.0, 22.0, 1.5), e="linear")
    cam.handheld("locked", 0.4)
    sh.finish(glare=0.8, threshold=0.9, vignette=0.5)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S10_SH")}
