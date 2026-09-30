"""S09 — What it means: the interview, and who comes with him."""
import math

import bpy
from mathutils import Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.camera import frame
from ...cine.perform import heading
from ...cine.sets import home, interview, tunnel
from ...paths import GENERATED, REPO_ROOT

UI = REPO_ROOT / "packages" / "reels" / "public" / "generated" / "diaries" / "ep01" / "ui"


def _chair(sh):
    a = interview.interview(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    p = sh.person("TR-PLAYER-09", "interview", profile="still")
    s = a["seat"]
    P.sit(p, 0.0, (s.x, s.y, 0.0), face=12.0, seat_h=0.36, lean=4.0, e="hold")
    P.arms(p, 0.0, "L", 34.0, 10.0, 0.0, 55.0, e="hold")
    P.arms(p, 0.0, "R", 34.0, 10.0, 0.0, 55.0, e="hold")
    # eyeline just off the lens, to camera-left (the interviewer sits beside the camera)
    P.look(p, 0.0, a["eyeline"], w=0.75, dur=0.01, eyes_lead=0)
    p.key("gaze_at", 0.0, tuple(a["eyeline"]), "hold")
    p.key("gaze_w", 0.0, 0.9, "hold")
    head = Vector((s.x, s.y, 0.36 + 0.12 - p.dims["hip"] + 1.7))
    return a, p, head


def _cam(sh, head, size="MCU", lens=85, push=0.0, off=0.0):
    cam = sh.camera(lens, fstop=2.0)
    # off-centre: aim beside him so he sits on the right third, negative space camera-left
    aim = head + Vector((-0.22 - off, 0, -0.35 if size != "CU" else -0.2))
    frame(cam, 0.0, head, size, heading=20, el=0, aim=aim)
    if push:
        from ...cine.camera import SIZES
        frame(cam, sh.dur, head, SIZES[size] * (1 - push), heading=20, el=0, aim=aim, e="linear")
    cam.handheld("locked", 0.6)
    return cam


def S09_SH01(sh):
    a, p, head = _chair(sh)
    la, lb = sh.line("L23")
    P.nod(p, la + 0.9, depth=2.5, dur=0.4)
    p.key("chest", lb - 0.2, (0.0, 0.0, 0.0), "hold")
    p.key("chest", lb + 0.1, (-2.0, 0.0, 0.0), "soft")
    _cam(sh, head, "MCU")
    sh.finish(vignette=0.4)


def S09_SH02(sh):
    a, p, head = _chair(sh)
    la, lb = sh.line("L24")
    fa, fb = sh.line("L25")
    # "Finally." — a breath of a smile, shoulders let go
    p.key("chest", fa - 0.1, (0.0, 0.0, 0.0), "hold")
    p.key("chest", fa + 0.3, (3.0, 0.0, 0.0), "soft")
    P.smile(p, fa - 0.05, amount=0.4, dur=0.3, hold=0.5, tilt=2.0, nod=1.0)
    _cam(sh, head, "MS", lens=70, off=0.05)
    sh.finish(vignette=0.4)


def S09_SH03(sh):
    a, p, head = _chair(sh)
    qa, qb = sh.line("L26")
    # he listens; after the question the eyes drop, a long blink, thinking
    p.key("gaze_w", qb - 0.2, 0.9, "hold")
    p.key("gaze_w", qb + 0.1, 0.0, "soft")
    p.key("gaze", qb + 0.1, (0.15, -0.55), "soft")
    p.key("neck", qb, (0.0, 0.0, 0.0), "hold")
    p.key("neck", qb + 0.4, (7.0, 0.0, -3.0), "soft")
    p.extra_blinks.append(qb + 0.2)
    _cam(sh, head, "CU", push=0.06)
    sh.finish(vignette=0.45)


def S09_SH10(sh):
    a, p, head = _chair(sh)
    la, lb = sh.line("L28")
    # (L27 finishes over the top of this shot) — eyes come back up to the interviewer
    p.key("gaze_w", 0.0, 0.2, "hold")
    p.key("gaze_w", 0.35, 0.9, "soft")
    p.key("neck", 0.0, (5.0, 0.0, -2.0), "hold")
    p.key("neck", 0.5, (0.0, 0.0, 0.0), "soft")
    P.nod(p, 0.55, depth=2.0, dur=0.4)
    # the pause: a breath, eyes down and back
    p.key("gaze", la - 0.55, (0.0, 0.0), "hold")
    p.key("gaze", la - 0.35, (0.1, -0.35), "soft")
    p.key("gaze", la - 0.05, (0.0, 0.0), "soft")
    P.smile(p, lb - 0.35, amount=0.35, dur=0.4, tilt=1.5, nod=0.6)
    _cam(sh, head, "CU", push=0.05)
    sh.finish(vignette=0.45)


def S09_SH04(sh):
    """Insert: the child asleep in the #9 shirt."""
    a = home.child_room(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="asleep")
    pil = a["pillow"]
    P.lie(k, 0.0, (pil.x, pil.y - 1.0, pil.z + 0.15))
    k.key("tilt", 0.0, (-90.0, -78.0), "hold")  # on his side, toward the night-light
    k.key("lid.L", 0.0, 0.08, "hold")
    k.key("lid.R", 0.0, 0.08, "hold")
    props.soft(sh.cols["SET"], "CBED_Over", (1.0, 1.1, 0.35), look.fabric("KidDuvet", "#3b5a8a", rough=0.95, sheen=0.5),
               (pil.x, pil.y - 0.75, 0.3), puff=0.05)
    head = Vector((pil.x, pil.y, pil.z + 0.15))
    cam = sh.camera(35, fstop=2.0)
    frame(cam, 0.0, head, "MCU", heading=-60, el=16, headroom=False)
    cam.handheld("locked", 0.6)
    sh.finish(glare=0.5, threshold=0.6)


def S09_SH05(sh):
    """Insert: the TR #9 shirt on its hanger, moonlight."""
    a = home.bedroom(sh.scene, sh.cols["SET"], sh.cols["LGT"], "night")
    num = GENERATED / "textures" / "hnc-player-tr-09--HNC_Number_09.png"
    shirt = props.tr_shirt(sh.cols["PROPS"], "PROP_Shirt", (2.2, 1.6, 2.1), rot=(0, 0, 0), number_png=num)  # back to camera: the 9
    props.box(sh.cols["SET"], "BED_Wardrobe", (1.2, 0.6, 2.4), look.pbr("Home_Walnut", "walnut_veneer", scale=1.2), (2.2, 2.0, 0))
    look.area(sh.cols["LGT"], "LGT_Moon", (0.8, -0.5, 2.6), (2.2, 1.6, 1.6), (0.8, 1.4), 60, "#8aa2d8")
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, Vector((2.2, 1.6, 1.6)), 1.5, heading=-15, el=4, headroom=False)
    cam.handheld("locked", 0.5)
    sh.finish()


def S09_SH06(sh):
    """Insert: boots by the door."""
    a = home.entry(sh.scene, sh.cols["SET"], sh.cols["LGT"], "night")
    spot = a["floor_by_door"]
    props.boots_canonical(sh.scene, sh.cols["PROPS"], tuple(spot), rot=(0, 0, 15))
    look.spot(sh.cols["LGT"], "LGT_HallPool", tuple(spot + Vector((0.3, 0.2, 2.2))), tuple(spot), 180, "#ffc58a", angle=40, blend=0.7)
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, spot + Vector((0, 0, 0.08)), 0.75, heading=-20, el=18, headroom=False)
    cam.handheld("locked", 0.5)
    sh.finish()


def S09_SH07(sh):
    """Insert: the packed bag."""
    a = home.entry(sh.scene, sh.cols["SET"], sh.cols["LGT"], "night")
    b = a["bench"]
    props.duffel(sh.cols["PROPS"], "PROP_Bag", tuple(Vector((b.x - 0.1, b.y - 0.05, 0.0))), rot=(0, 0, 8))
    props.boots_canonical(sh.scene, sh.cols["PROPS"], tuple(a["floor_by_door"]), rot=(0, 0, 15))
    look.spot(sh.cols["LGT"], "LGT_HallPool", (b.x, b.y - 0.4, 2.3), (b.x - 0.1, b.y, 0.2), 220, "#ffc58a", angle=45, blend=0.7)
    cam = sh.camera(50, fstop=2.0)
    frame(cam, 0.0, Vector((b.x - 0.1, b.y, 0.25)), 1.3, heading=-35, el=10, headroom=False)
    cam.handheld("locked", 0.5)
    sh.finish()


def S09_SH08(sh):
    """Insert (hybrid): the phone on the coffee table glowing with the HNC World Table."""
    a = home.living(sh.scene, sh.cols["SET"], sh.cols["LGT"], "night")
    png = UI / "world-table-phone.png"
    if png.exists():
        img = bpy.data.images.load(str(png), check_existing=True)
        scr = look.emission("PhoneWorldTable", "#ffffff", 2.4)
        nt = scr.node_tree
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = img
        nt.links.new(t.outputs["Color"], nt.nodes["Emission"].inputs["Color"])
    else:
        scr = look.emission("PhonePlaceholder", "#1b2a44", 1.2)
    ph = props.phone(sh.cols["PROPS"], "PROP_Phone", tuple(a["table"] + Vector((0.05, -0.05, 0.005))), rot=(0, 0, 12), screen=scr)
    look.area(sh.cols["LGT"], "LGT_ScreenGlow", tuple(a["table"] + Vector((0.05, -0.05, 0.12))), tuple(a["table"] + Vector((0.05, -0.05, 0.4))), (0.08, 0.15), 3, "#9fc0ff")
    cam = sh.camera(50, fstop=2.4)
    at = a["table"] + Vector((0.05, -0.05, 0.02))
    frame(cam, 0.0, at, 0.3, heading=-10, el=58, headroom=False)
    frame(cam, sh.dur, at, 0.27, heading=-10, el=58, headroom=False, e="linear")
    cam.handheld("locked", 0.5)
    sh.finish(glare=0.5, threshold=0.8)


def S09_SH09(sh):
    """Insert: the empty tunnel, the pitch light at the end."""
    a = tunnel.tunnel(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    cam = sh.camera(35, fstop=2.8)
    cam.place(0.0, (0.35, 1.0, 1.5), (0.0, 22.0, 1.4))
    cam.place(sh.dur, (0.35, 1.5, 1.5), (0.0, 22.0, 1.4), e="linear")
    cam.handheld("locked", 0.5)
    sh.finish(glare=0.8, threshold=0.9, vignette=0.5)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S09_SH")}
