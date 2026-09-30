"""S02 — Morning: 06:47, one eye, the child is right."""
from mathutils import Vector

from ...cine import perform as P
from ...cine.sets import home


def _bedroom(sh):
    c = sh.cols
    a = home.bedroom(sh.scene, c["SET"], c["LGT"], "dawn")
    import bpy
    bpy.context.view_layer.update()
    a["clock_pos"] = a["clock"].matrix_world @ Vector((0, -0.05, 0.05))
    return a


def _sleeper(sh, a):
    """#9 on his back on his side of the bed, head on the pillow, covered to the chest."""
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    head = a["pillow"] + Vector((0, 0.0, 0.3))
    P.lie(p, 0.0, (head.x, head.y - 1.7, head.z - 0.0))
    from ...cine import props, look
    props.soft(sh.cols["SET"], "BED_DuvetOver", (1.3, 1.9, 0.42), look.fabric("Duvet", "#dfe3e6", rough=0.95, sheen=0.6, noise=0.02),
               (head.x, head.y - 1.55, a["bed"].z - 0.08), puff=0.07, levels=2, bevel=0.5)
    p.key("lid.L", 0.0, 0.08, "hold")
    p.key("lid.R", 0.0, 0.08, "hold")
    p.key("neck", 0.0, (0.0, 0.0, -32.0), "hold")  # face turned toward the child / camera side
    p.prof.update(breath=1.4, drift=0.35)
    return p, head


def _child(sh, a, pos=(-1.0, 1.08), face=90.0):
    k = sh.person("TR-FAMILY-CHILD-01", "home", profile="child")
    P.stance(k, 0.0, (pos[0], pos[1], 0.0), face)
    P.relax_arms(k, 0.0)
    return k


def S02_SH01(sh):
    a = _bedroom(sh)
    clk = a["clock"]
    front = clk.matrix_world @ Vector((0, -0.85, 0.07))
    cam = sh.camera(100, fstop=2.8)
    tgt = clk.matrix_world @ Vector((0, 0, 0.045))
    cam.place(0.0, front, tgt)
    cam.place(sh.dur, clk.matrix_world @ Vector((0, -0.78, 0.065)), tgt, e="linear")
    cam.handheld("locked", 1.0)
    sh.finish(glare=0.6, threshold=0.7)


def _ots(sh, a, k, head):
    """Over the child's shoulder onto #9 on the pillow; the clock soft in the foreground."""
    # The child's eye-line: slightly above, looking down at #9 on the pillow (the child is off-screen).
    cam = sh.camera(35, fstop=2.2)
    cam.place(0.0, (-0.55, 1.2, 1.55), head + Vector((-0.12, -0.05, -0.04)), focus=head + Vector((-0.28, 0, 0.05)))
    cam.handheld("subtle", 0.6)
    return cam


def S02_SH02(sh):
    a = _bedroom(sh)
    p, head = _sleeper(sh, a)
    k = _child(sh, a)
    P.look(k, 0.0, head, w=0.9, dur=0.01, eyes_lead=0)
    kid_head = Vector((-1.0, 1.08, 1.0))
    # one eye opens, finds the child
    p.key("lid.R", 0.38, 0.08, "hold")
    p.key("lid.R", 0.62, 0.72, "out")
    P.look(p, 0.4, kid_head, w=0.0, dur=0.2, eyes_lead=0.0)
    p.key("gaze_w", 0.62, 1.0, "out")
    l3a, l3b = sh.line("L03")
    k.key("head", l3a + 0.05, (5.0, 0.0, 0.0), "soft")
    k.key("head", l3b, (0.0, 0.0, 0.0), "soft")
    # the eye slides to the clock, then back; the head never lifts
    p.key("gaze_at", l3b + 0.1, tuple(kid_head), "hold")
    p.key("gaze_at", l3b + 0.3, tuple(a["clock_pos"]), "out")
    l4a, l4b = sh.line("L04")
    p.key("gaze_at", l4a + 0.45, tuple(a["clock_pos"]), "hold")
    p.key("gaze_at", l4a + 0.65, tuple(kid_head), "soft")
    p.key("neck", l4a, (0.0, 0.0, -32.0), "hold")
    p.key("neck", l4a + 0.5, (4.0, 0.0, -30.0), "soft")
    p.blink_avoid.append((0.0, sh.dur))
    _ots(sh, a, k, head)
    sh.finish()


def S02_SH03(sh):
    a = _bedroom(sh)
    p, head = _sleeper(sh, a)
    k = _child(sh, a)
    # Deadpan: he keeps staring at Dad and points at the clock without looking at it.
    P.look(k, 0.0, head + Vector((0, 0, 0.05)), w=0.9, dur=0.01, eyes_lead=0)
    P.point_at(k, 0.12, "L", a["clock_pos"], dur=0.28)
    from ...cine import look
    look.area(sh.cols["LGT"], "LGT_PillowBounce", (0.1, 1.5, 0.7), (-1.0, 1.08, 1.0), (0.8, 0.5), 25, "#9fb6e8")
    # The reverse: from the pillow, low, up at the child — the clock soft at frame right.
    cam = sh.camera(35, fstop=2.0)
    cam.place(0.0, (0.3, 1.72, 0.92), (-1.0, 1.1, 0.95), focus=(-1.0, 1.08, 1.02))
    cam.handheld("subtle", 0.5)
    sh.finish()


def S02_SH04(sh):
    a = _bedroom(sh)
    p, head = _sleeper(sh, a)
    k = _child(sh, a)
    P.look(k, 0.0, head, w=0.9, dur=0.01, eyes_lead=0)
    p.key("lid.R", 0.0, 0.72, "hold")
    p.key("lid.L", 0.0, 0.08, "hold")
    p.key("lid.L", 0.45, 0.08, "hold")
    p.key("lid.L", 0.7, 0.6, "out")
    p.key("neck", 0.0, (4.0, 0.0, -30.0), "hold")
    p.key("neck", 0.55, (0.0, 0.0, -4.0), "soft")  # turns to the ceiling
    p.key("gaze", 0.55, (0.0, 0.35), "soft")
    p.key("breath_amp", 0.8, 1.0, "hold")
    p.key("chest", 0.85, (0.0, 0.0, 0.0), "hold")
    p.key("chest", 1.15, (-3.0, 0.0, 0.0), "out")  # the exhale
    _ots(sh, a, k, head)
    sh.finish()


SHOTS = {"S02_SH01": S02_SH01, "S02_SH02": S02_SH02, "S02_SH03": S02_SH03, "S02_SH04": S02_SH04}
