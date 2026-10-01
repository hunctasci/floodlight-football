"""S08 — Dinner: needs salt."""
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.camera import frame
from ...cine.perform import heading, write_tracks
from ...cine.sets import home
from ...cine.sets.tunnel import haze


def _set(sh):
    a = home.kitchen(sh.scene, sh.cols["SET"], sh.cols["LGT"], "evening")
    bpy.context.view_layer.update()
    return a


def _steam(sh, at, size=(0.35, 0.35, 0.7)):
    """Rising steam: a volume with drifting noise density, backlit by the pendant."""
    m, new = look._new("Steam")
    if new:
        nt = m.node_tree
        nt.nodes.clear()
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 6.0
        tex.inputs["Detail"].default_value = 3.0
        coord = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        nt.links.new(coord.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.55
        ramp.color_ramp.elements[1].position = 0.8
        nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        nt.links.new(coord.outputs["Object"], grad.inputs["Vector"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(ramp.outputs["Color"], mul.inputs[0])
        nt.links.new(grad.outputs["Fac"], mul.inputs[1])
        dens = nt.nodes.new("ShaderNodeMath")
        dens.operation = "MULTIPLY"
        dens.inputs[1].default_value = 3.0
        nt.links.new(mul.outputs[0], dens.inputs[0])
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Color"].default_value = look.lin("#f4efe6")
        vol.inputs["Anisotropy"].default_value = 0.6
        nt.links.new(dens.outputs[0], vol.inputs["Density"])
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
        m["mapping"] = mp.name
    b = props.sphere(sh.cols["FX"], "FX_Steam", 0.5, m, at + Vector((0, 0, size[2] / 2)), scale=size, segs=12, rings=8)
    mp = m.node_tree.nodes[m["mapping"]]
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        tr.setdefault((m, f'node_tree.nodes["{mp.name}"].inputs[1].default_value', 2), []).append(-0.9 * t)
    write_tracks(tr, sh.frames)
    return b


def S08_SH01(sh):
    a = _set(sh)
    board = a["board"].matrix_world.translation + Vector((0, 0, 0.02))
    pep = props.pepper(sh.cols["PROPS"], "PROP_Pepper", tuple(board + Vector((0.02, 0.0, 0.04))))
    kn = props.knife(sh.cols["PROPS"], "PROP_Knife", tuple(board + Vector((-0.02, 0.0, 0.2))), rot=(0, 0, 90))
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = (t % 0.26) / 0.26
        z = 0.2 - 0.17 * (math.sin(u * math.pi) ** 0.7 if u < 1 else 0)
        z = 0.03 + 0.17 * abs(math.cos(u * math.pi))
        tr.setdefault((kn, "location", 2), []).append(board.z + z)
        tr.setdefault((kn, "location", 1), []).append(board.y - 0.03 + 0.012 * t)
    write_tracks(tr, sh.frames)
    cam = sh.camera(100, fstop=2.8)
    frame(cam, 0.0, board + Vector((0, 0, 0.06)), 0.45, heading=-35, el=22, headroom=False)
    cam.handheld("locked", 1.0)
    sh.finish(glare=0.4)


def S08_SH02(sh):
    a = _set(sh)
    pan = a["pan"].matrix_world.translation
    props.soft(sh.cols["PROPS"], "PROP_Stew", (0.2, 0.2, 0.03), look.flat("Stew", "#8e3a1a", rough=0.3, coat=0.8), tuple(pan + Vector((0, 0, 0.012))), puff=0.01)
    _steam(sh, pan + Vector((0, 0, 0.05)))
    look.area(sh.cols["LGT"], "LGT_SteamBack", tuple(pan + Vector((0.2, 1.4, 0.9))), tuple(pan + Vector((0, 0, 0.3))), (0.5, 0.5), 60, "#ffc27f")
    cam = sh.camera(85, fstop=2.2)
    frame(cam, 0.0, pan + Vector((0, 0, 0.3)), 0.7, heading=-10, el=8, headroom=False, focus=pan + Vector((0, 0, 0.15)))
    cam.handheld("locked", 1.0)
    sh.finish(glare=0.5, threshold=0.8)


def S08_SH03(sh):
    a = _set(sh)
    isl = a["island"] + Vector((0.35, -0.1, 0))
    pl = props.plate(sh.cols["PROPS"], "PROP_Plate", tuple(isl))
    food = props.dinner(sh.cols["PROPS"], "PROP_Dinner", (0, 0, 0.012), parent=pl)
    spoon = props.box(sh.cols["PROPS"], "PROP_Spoon", (0.03, 0.2, 0.01), look.flat("Steel", "#cfd2d6", rough=0.15, metal=1.0), tuple(isl + Vector((0.05, 0.1, 0.25))))
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        s = min(1.0, max(0.001, (t - 0.1) / 0.25))
        for i in range(3):
            tr.setdefault((food, "scale", i), []).append(s if i < 2 else s ** 0.5)
        tr.setdefault((spoon, "location", 2), []).append(isl.z + 0.25 - 0.18 * math.sin(min(1, t / 0.35) * math.pi))
    write_tracks(tr, sh.frames)
    cam = sh.camera(50, fstop=4.0)
    cam.place(0.0, isl + Vector((0.0, -0.05, 0.72)), isl, focus=isl)  # under the pendants
    sh.scene.view_settings.exposure = -1.6  # the pendant is right above the plate
    cam.roll.key(0, 0.0)
    cam.handheld("locked", 1.0)
    sh.finish()


def _table_cast(sh, a):
    t = a["table"]
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    seat = t + Vector((-0.95, 0, 0))
    P.sit(q, 0.0, (seat.x, seat.y, 0.0), face=heading(seat, t), seat_h=0.36, lean=8.0, e="hold")
    P.arms(q, 0.0, "L", 40.0, 8.0, 0.0, 55.0, e="hold")
    P.arms(q, 0.0, "R", 40.0, 8.0, 0.0, 55.0, e="hold")
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="child")
    kseat = t + Vector((0.0, 0.75, 0))
    P.sit(k, 0.0, (kseat.x, kseat.y, 0.0), face=heading(kseat, t), seat_h=0.36, feet_fwd=0.25, lean=6.0, e="hold")
    k.key("hips", 0.0, (0.0, 0.0, 0.18), "hold")  # a cushion on the chair: the child sits high
    P.arms(k, 0.0, "L", 45.0, 8.0, 0.0, 60.0, e="hold")
    P.arms(k, 0.0, "R", 45.0, 8.0, 0.0, 60.0, e="hold")
    place = t + Vector((-0.45, 0.0, 0.0))
    pl = props.plate(sh.cols["PROPS"], "PROP_DinnerPlate", tuple(place))
    props.dinner(sh.cols["PROPS"], "PROP_Dinner", (0, 0, 0.012), parent=pl)
    return q, k, pl, seat


def S08_SH04(sh):
    a = _set(sh)
    q, k, pl, seat = _table_cast(sh, a)
    t = a["table"]
    stand = t + Vector((-0.3, -0.85, 0))
    p = sh.person("TR-PLAYER-09", "home", profile="calm")
    start = stand + Vector((-1.4, -0.6, 0))
    P.stance(p, 0.0, (start.x, start.y, 0.0), heading(start, stand))
    # he carries it in (plate starts in his hands), presents it, sets it down
    target = pl.matrix_world.translation.copy()
    carry = p.char_point(0.0, (0, 0.5, 0.95))
    pl.location = carry
    bpy.context.view_layer.update()
    P.reach(p, 0.0, "R", tuple(carry + Vector((0, 0, 0.06))), dur=0.01)
    P.reach(p, 0.0, "L", tuple(carry + Vector((0.1, 0, 0.06))), dur=0.01)
    p.hold_prop(pl, "R", 0.02, 0.98)
    tt = P.walk(p, 0.05, [(stand.x, stand.y)], stride=0.5, lead="L", end_face=heading(stand, seat) + 10, arms_swing=False)
    for x in [i / 10 for i in range(0, 8)]:
        p.key("hand.R", x, tuple(p.char_point(x, (-0.05, 0.5, 1.0))), "linear")
        p.key("hand.L", x, tuple(p.char_point(x, (0.12, 0.5, 1.0))), "linear")
    p.key("chest", 0.75, (-6.0, 0.0, 0.0), "soft")  # proud
    p.key("neck", 0.75, (-6.0, 0.0, 0.0), "soft")
    p.key("hand.R", 0.98, tuple(target + Vector((0, 0, 0.06))), "soft")
    p.key("hand.L", 0.98, tuple(target + Vector((0.1, 0, 0.06))), "soft")
    P.release(p, 1.05, "R")
    P.release(p, 1.05, "L")
    P.look(q, 0.6, target, w=0.7, dur=0.3)
    P.look(k, 0.4, p.char_point(0.5, (0, 0, 1.6)), w=0.6, dur=0.3)
    p.bake()
    p._baked = True
    sh.scene.frame_set(sh.frames)
    cam = sh.camera(35, fstop=2.8)
    frame(cam, 0.0, t + Vector((-0.4, -0.2, 1.1)), "MWS", heading=-60, el=6, headroom=False)
    cam.handheld("subtle", 0.7)
    sh.finish()


def S08_SH05(sh):
    a = _set(sh)
    q, k, pl, seat = _table_cast(sh, a)
    t = a["table"]
    stand = t + Vector((-0.3, -0.85, 0))
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    P.stance(p, 0.0, (stand.x, stand.y, 0.0), heading(stand, seat) + 10)
    P.arms(p, 0.0, "L", 10.0, 8.0, 0.0, 20.0, e="hold")
    P.look(p, 0.0, seat + Vector((0, 0, 1.3)), w=0.8, dur=0.01, eyes_lead=0)
    food = pl.matrix_world.translation + Vector((0, 0, 0.05))
    mouth = q.char_point(0.0, (0.0, 0.45, 1.25 - 0.235))
    P.reach(q, 0.1, "R", tuple(food), dur=0.3)
    q.key("hand.R", 0.55, tuple(mouth), "soft")
    q.key("hand.R", 0.95, tuple(mouth), "hold")
    q.key("hand.R", 1.3, tuple(food + Vector((0.0, -0.1, 0.05))), "soft")
    P.look(q, 0.05, food, w=0.7, dur=0.25)
    P.release_look(q, 0.55, 0.3)
    q.key("lid.L", 0.6, 1.0, "hold")
    q.key("lid.L", 0.75, 0.55, "soft")  # chewing thoughtfully
    q.key("lid.R", 0.6, 1.0, "hold")
    q.key("lid.R", 0.75, 0.55, "soft")
    la, lb = sh.line("L21")
    sh.talk(p, "L21", amount=0.6)
    p.key("neck", la - 0.1, (0.0, 0.0, 0.0), "hold")
    p.key("neck", la + 0.15, (-3.0, 3.0, 0.0), "out")  # the tiniest lean-in
    cam = sh.camera(50, fstop=2.2)
    mid = (seat + stand) * 0.5 + Vector((0, 0, 1.3))
    frame(cam, 0.0, mid, "MWS", heading=heading(mid, t) - 150, el=4, headroom=False)
    cam.handheld("locked", 1.0)
    sh.finish()


def S08_SH06(sh):
    a = _set(sh)
    q, k, pl, seat = _table_cast(sh, a)
    t = a["table"]
    stand = t + Vector((-0.3, -0.85, 0))
    up = stand + Vector((0, 0, 1.75))
    P.look(q, 0.0, pl.matrix_world.translation, w=0.6, dur=0.01, eyes_lead=0)
    la, lb = sh.line("L22")
    sh.talk(q, "L22", amount=0.6)
    P.look(q, la - 0.25, stand + Vector((0, 0, 1.72)), w=0.8, dur=0.35, eyes_lead=0.12)  # eyes up to him first
    q.key("neck", la, (0.0, 3.0, 0.0), "soft")
    head = q.char_point(0.0, (0, 0, 1.7 - 0.235))
    # a dirty single beside his eyeline: she looks up at him (~37°), the lens sits at 62°
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, head, "CU", heading=62.0, el=-2)
    look.area(sh.cols["LGT"], "LGT_FaceKey", tuple(head + Vector((1.2, -0.4, 0.6))), tuple(head), (0.6, 0.6), 45, "#ffd2a0")
    cam.handheld("locked", 1.0)
    sh.finish()


def S08_SH07(sh):
    a = _set(sh)
    t = a["table"]
    q, k, pl, seat = _table_cast(sh, a)
    stand = t + Vector((-0.3, -0.85, 0))
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    face = heading(stand, seat) + 10
    P.stance(p, 0.0, (stand.x, stand.y, 0.0), face)
    P.look(p, 0.0, seat + Vector((0, 0, 1.3)), w=0.8, dur=0.01, eyes_lead=0)
    # devastated, HNC-size: the eyes drop, the chest sinks a hair, a slow exhale
    p.key("gaze", 0.2, (0.0, 0.0), "hold")
    p.key("gaze", 0.45, (0.1, -0.6), "soft")
    p.key("neck", 0.25, (0.0, 0.0, 0.0), "hold")
    p.key("neck", 0.7, (6.0, -2.0, 0.0), "soft")
    p.key("chest", 0.3, (0.0, 0.0, 0.0), "hold")
    p.key("chest", 0.85, (5.0, 0.0, 0.0), "soft")
    P.arms(p, 0.3, "L", 0.0, 4.0, 0.0, 6.0)
    P.arms(p, 0.3, "R", 0.0, 4.0, 0.0, 6.0)
    # VO "She told me at six forty-six." — the eyes come back up to her, then a breath out
    va, vb = sh.line("L37")
    p.key("gaze", va + 0.8, (0.1, -0.6), "hold")
    p.key("gaze", va + 1.1, (0.0, 0.05), "out")
    p.key("chest", vb - 0.2, (5.0, 0.0, 0.0), "hold")
    p.key("chest", vb + 0.3, (2.0, 0.0, 0.0), "soft")
    head = p.char_point(0.0, (0, 0, 1.7))
    # beside her eyeline (she is at 217° from him, the lens at 245°), warm key from the pendant side
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, head, "CU", heading=245.0, el=5)
    look.area(sh.cols["LGT"], "LGT_FaceKey", tuple(head + Vector((-0.9, 0.6, 0.7))), tuple(head), (0.6, 0.6), 55, "#ffd2a0")
    cam.handheld("locked", 1.0)
    sh.finish()


SHOTS = {f"S08_SH{i:02d}": globals()[f"S08_SH{i:02d}"] for i in range(1, 8)}
