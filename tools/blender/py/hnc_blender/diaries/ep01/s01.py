"""S01 — Cold open: the night drive."""
from mathutils import Vector

from ...cine import perform as P
from ...cine.sets import car


def seat_driver(sh, p, anchors, grip_deg=(180.0, 0.0)):
    """#9 in the driver's seat, both hands on the wheel (IK), feet on the pedals."""
    d = anchors["driver"]
    P.sit(p, 0.0, (d.x, d.y, 0.0), face=0.0, seat_h=0.3, feet_fwd=0.62, width=0.9, lean=-4.0)
    wheel = anchors["wheel_obj"]
    import math
    for side, ang in (("L", 0.0), ("R", 180.0)):
        a = math.radians(ang)
        local = Vector((math.cos(a) * car.WHEEL_R * 0.98, math.sin(a) * car.WHEEL_R * 0.98, 0.02))
        grip = wheel.matrix_world @ local
        p.key(f"ik_hand.{side}", 0.0, 1.0, "hold")
        p.key(f"hand.{side}", 0.0, tuple(grip + Vector((0, 0.03, 0.03))), "hold")
        p.key(f"hand_rot.{side}", 0.0, (-55.0, 0.0, 0.0), "hold")
    p.key("chest", 0.0, (-3.0, 0.0, 0.0), "hold")
    return p


def S01_SH02(sh):
    c = sh.cols
    anchors = car.build_interior(c["SET"], "night", passenger=False)
    import bpy
    bpy.context.view_layer.update()
    car.moving_world(sh.scene, c["SET"], sh.frames, sh.fps, "night", speed=12.0)
    car.night_rig(sh.scene, c["LGT"], anchors)
    a, b = sh.line("L02")
    # two streetlights pass: one as the eyes flick, one across the smile + the line
    car.sweep(c["LGT"], anchors, sh.frames, sh.fps, peaks=(a - 0.2, a + 0.75))
    p = sh.person("TR-PLAYER-09", "hoodie", profile="still")
    seat_driver(sh, p, anchors)
    d = anchors["driver"]
    road = Vector((d.x, -12.0, 1.3))
    P.look(p, 0.0, road, w=0.9, dur=0.01, eyes_lead=0.0)
    p.key("gaze_at", 0.0, tuple(road), "hold")
    p.key("gaze_w", 0.0, 0.8, "hold")
    a, b = sh.line("L02")
    # eyes flick toward the voice (passenger side) and back, head never leaves the road
    p.key("gaze_w", a - 0.3, 0.8, "linear")
    p.key("gaze_w", a - 0.22, 0.0, "out")
    P.glance(p, a - 0.3, -0.55, -0.05, dur=0.1, hold=0.22, back=0.16)
    p.key("gaze_w", a + 0.1, 0.0, "linear")
    p.key("gaze_w", a + 0.25, 0.8, "soft")
    # the half-smile lands just before the line, stays through it
    P.smile(p, a - 0.12, amount=0.5, dur=0.32, tilt=1.2, nod=0.8)
    p.blink_avoid.append((a - 0.4, b))
    # camera: 85 mm through the passenger window, tripod on a vibrating car
    head = Vector((d.x, d.y - 0.04, 1.40))
    cam = sh.camera(85, fstop=1.8)
    # 9:16 at 85 mm covers ~0.24 m per metre horizontally: 2.8 m frames the head profile with air.
    # HNC heads are ~0.64 m wide: at 85 mm a 9:16 frame needs ~3.8 m to hold the profile with air.
    # A slow push (3.8 -> 3.55 m) over the shot.
    # ~15° in front of true profile: the eye line and the city through the windshield both read.
    cam.place(0.0, (d.x - 3.7, head.y - 0.95, 1.5), head + Vector((0, -0.1, -0.08)))
    cam.place(sh.dur, (d.x - 3.45, head.y - 0.89, 1.49), head + Vector((0, -0.1, -0.08)), e="linear")
    cam.handheld("locked", 1.6)
    cam.focus_obj = p.rig.parts["eyes[0]"]
    sh.finish(glare=0.4, threshold=0.9, vignette=0.35)


SHOTS = {"S01_SH02": S01_SH02}
