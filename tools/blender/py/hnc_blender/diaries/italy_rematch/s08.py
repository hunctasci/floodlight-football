"""S08 — normal street, one literal plate, then the quiet decision."""
import bpy
from mathutils import Vector

from ...cine import look, perform as P, props
from ...cine.perform import write_tracks


def _street(sh, name):
    c = sh.cols
    props.plane(c["SET"], f"{name}_Pavement", (22, 16), look.pbr(f"{name}_Asphalt", "asphalt_02", scale=.38, tint="#92938f"), (0, 0, 0))
    props.box(c["SET"], f"{name}_Facade", (15.0, .28, 4.5), look.pbr(f"{name}_Plaster", "painted_plaster_wall", scale=.30, tint="#e1ddd2"), (0, 4.0, 0), bevel=.03)
    props.box(c["SET"], f"{name}_Door", (1.25, .10, 2.35), look.flat(f"{name}_DoorMat", "#49606a", rough=.55), (-2.4, 3.83, .02), bevel=.02)
    props.box(c["SET"], f"{name}_Awning", (3.2, .58, .24), look.flat(f"{name}_AwningMat", "#d8d3c6", rough=.72), (1.9, 3.55, 2.75), bevel=.03)
    look.world(sh.scene, hdri="urban_street_04", hdri_strength=1.0, rot_deg=250)
    look.sun(c["LGT"], f"{name}_Sun", (48, 0, -28), power=2.8, color="#f7f4ec", angle=1.6)
    look.area(c["LGT"], f"{name}_Sky", (0, -5.0, 3.2), (0, 1.2, 1.0), (7.0, 3.0), 470, "#dfe8f4")
    sh.scene.view_settings.exposure = -0.08


def _text(col, name, body, loc, size, mat):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.align_x, cu.align_y = body, "CENTER", "CENTER"
    cu.size, cu.extrude, cu.resolution_u = size, .006, 10
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    ob.location, ob.rotation_euler = loc, (1.5708, 0, 0)
    ob.data.materials.append(mat)
    return ob


def _car(sh):
    c = sh.cols
    root = bpy.data.objects.new("S08_GenericCar", None)
    c["PROPS"].objects.link(root)
    paint = look.flat("S08_CarPaint", "#536873", rough=.25, metal=.45, coat=.5)
    dark = look.flat("S08_Tyre", "#151719", rough=.82)
    chrome = look.flat("S08_PlateBase", "#eee8d5", rough=.35, metal=.12)
    props.box(c["PROPS"], "S08_CarBody", (2.75, 1.28, .68), paint, (0, 0, .30), bevel=.14, parent=root)
    props.box(c["PROPS"], "S08_CarCabin", (1.45, 1.10, .52), look.flat("S08_CarGlass", "#1d2931", rough=.12, metal=.22), (-.15, 0, .96), bevel=.10, parent=root)
    for x in (-.88, .88):
        for y in (-.57, .57):
            props.cyl(c["PROPS"], "S08_Wheel", .30, .18, dark, (x, y, .30), rot=(90, 0, 0), segs=20, parent=root)
    # Physical front plate faces the camera (-Y); all lettering is geometry.
    # Centre it on the visible bumper plane, safely clear of the wheel arch.
    props.box(c["PROPS"], "S08_HNC14_Plate", (.72, .035, .18), chrome, (0.0, -.662, .48), bevel=.012, parent=root)
    plate = _text(c["PROPS"], "S08_HNC14_Letters", "HNC 14", (0.0, -.685, .57), .135, look.flat("S08_PlateInk", "#10202a", rough=.45))
    plate.parent = root
    return root


def S08_SH01(sh):
    _street(sh, "S08_Relief")
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    P.stance(p, 0.0, (-2.35, 2.92, 0.0), face=180, width=.92)
    P.walk(p, .04, [(-2.35, .92)], stride=.54, cadence=1.28, style="casual")
    P.weight_shift(p, 1.32, "L", dur=.48, amount=.016)
    p.key("chest", 1.60, (-1.4, 0.0, 0.0), "soft")  # small released breath
    P.release_look(p, .38, dur=.35)
    cam = sh.camera(50, fstop=5.0)
    cam.place(0.0, (-.10, -3.65, 1.70), (-2.18, 1.35, 1.22), focus=(-2.2, 1.2, 1.26))
    cam.place(sh.dur, (-.02, -3.56, 1.69), (-2.22, .88, 1.23), focus=(-2.22, .92, 1.26), e="linear")
    cam.handheld("locked", .12)
    sh.scene["hnc_false_relief"] = "normal street only; no numeral, gag, or surreal element"
    sh.finish(glare=.025, threshold=1.7, vignette=.055)


def S08_SH02(sh):
    _street(sh, "S08_Plate")
    car = _car(sh)
    # It is a quick ordinary pass, paced only slowly enough for the real plate
    # to resolve.  The camera tracks a fraction, not a staged hero reveal.
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        # Slower than v1: the passing vehicle traverses only 2.6 m in the
        # locked 1.10 s while the camera makes a restrained tracking pan.
        x = 1.25 - 2.60 * min(1.0, t / sh.dur)
        tr.setdefault((car, "location", 0), []).append(x)
        tr.setdefault((car, "location", 1), []).append(.28)
        tr.setdefault((car, "location", 2), []).append(0.0)
    write_tracks(tr, sh.frames)
    cam = sh.camera(85, fstop=7.1)
    # Offset the micro-pan so the full plate, including the initial H, stays
    # inside the portrait safe area at its clearest frame.
    cam.place(0.0, (1.55, -5.4, 1.02), (.80, .08, .58), focus=(.80, -.35, .58))
    cam.place(.18, (1.35, -5.4, 1.02), (.67, .08, .58), focus=(.67, -.35, .58), e="linear")
    cam.place(.84, (-.25, -5.4, 1.02), (-.89, .08, .58), focus=(-.89, -.35, .58), e="linear")
    cam.place(sh.dur, (-.55, -5.4, 1.02), (-1.23, .08, .58), focus=(-1.23, -.35, .58), e="linear")
    cam.handheld("locked", .08)
    sh.scene.render.use_motion_blur = False  # plate typography must resolve in one glance
    sh.scene["hnc_plate"] = "physical unbranded vehicle plate geometry: HNC 14"
    sh.scene["hnc_event_frames"] = {"hnc_14_clear_start": 6, "hnc_14_clear_end": 26}
    sh.finish(glare=.015, threshold=1.8, vignette=.045)


def S08_SH03(sh):
    _street(sh, "S08_Enough")
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    P.stance(p, 0.0, (-.35, .20, 0.0), face=0, width=.92)
    # He has already seen it: a very small off-camera eye line, pause, then a
    # timing-only quiet statement.  No angry body language follows.
    P.look(p, .05, (-.80, -2.0, 1.05), w=.68, dur=.11)
    p.key("head", .24, (1.2, 0.0, -.8), "soft")
    a, b = sh.line_or("L02", (.35, .72))
    P.talk(p, a + .03, min(b, .74), [(a + .16, .32)], amount=.16)
    p.key("chest", .80, (0.0, 0.0, 0.0), "soft")
    cam = sh.camera(85, fstop=2.8)
    cam.place(0.0, (.56, -3.45, 1.68), (-.33, -.02, 1.45), focus=(-.33, .0, 1.48))
    cam.handheld("locked", .10)
    sh.scene["hnc_event_frames"] = {"enough_pause": 8, "enough_timing": 12, "comedy_rhythm_end": 27}
    sh.scene["hnc_dialogue_method"] = "L02 edit timing-only performance; comedy rhythm ends on final frame"
    sh.keep_in_frame(p)
    sh.finish(glare=.02, threshold=1.7, vignette=.09)


SHOTS = {"S08_SH01": S08_SH01, "S08_SH02": S08_SH02, "S08_SH03": S08_SH03}
