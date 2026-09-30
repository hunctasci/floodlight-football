"""S11 — Callback: still not nervous? Ask Belgium. Into the light."""
import bpy
from mathutils import Vector

from ...cine import perform as P
from ...cine.camera import frame
from ...cine.perform import write_tracks
from ...cine.sets import tunnel

STOP = Vector((0.15, 9.0, 0))


def _set(sh):
    a = tunnel.tunnel(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    return a


def S11_SH01(sh):
    a = _set(sh)
    p = sh.person("TR-PLAYER-09", "kit", profile="calm")
    start = STOP - Vector((0, 2.2, 0))
    P.stance(p, -0.5, (start.x, start.y - 0.9, 0.0), 180.0)
    P.walk(p, -0.5, [(STOP.x, STOP.y)], stride=0.58, cadence=1.8, style="focused", lead="L", end_face=180.0)
    cam = sh.camera(35, fstop=2.0)
    for t in (0.0, sh.dur):
        y = p.ch["pos"].at(t)[1]
        cam.place(t, (0.55, y - 3.2, 1.55), (0.1, y + 6, 1.35), focus=(STOP.x, y, 1.5), e="linear")
    cam.handheld("follow", 0.6)
    sh.finish(glare=0.8, threshold=0.9, vignette=0.45)


def S11_SH02(sh):
    a = _set(sh)
    p = sh.person("TR-PLAYER-09", "kit", profile="still")
    P.stance(p, 0.0, (STOP.x, STOP.y, 0.0), 180.0)
    P.relax_arms(p, 0.0)
    la, lb = sh.line("L30")
    # he looks slightly back over his right shoulder — the same half-smile as the car
    p.key("neck", 0.1, (0.0, 0.0, 0.0), "hold")
    p.key("neck", 0.45, (2.0, 0.0, -34.0), "soft")
    p.key("chest", 0.45, (0.0, 0.0, -8.0), "soft")
    P.glance(p, 0.3, -0.7, 0.0, dur=0.12, hold=None)
    P.smile(p, la - 0.12, amount=0.5, dur=0.32, tilt=1.2, nod=0.8)
    p.blink_avoid.append((la - 0.4, lb))
    head = Vector((STOP.x, STOP.y, 1.7))
    cam = sh.camera(85, fstop=1.8)
    frame(cam, 0.0, head, "CU", heading=160.0, el=2)  # behind his right shoulder, the pitch rims him
    cam.handheld("locked", 0.6)
    sh.finish(glare=0.9, threshold=0.85, vignette=0.45)


def S11_SH03(sh):
    a = _set(sh)
    p = sh.person("TR-PLAYER-09", "kit", profile="calm")
    P.stance(p, 0.0, (STOP.x, STOP.y, 0.0), 180.0)
    P.walk(p, 0.05, [(0.1, 17.0)], stride=0.6, cadence=1.85, style="focused", lead="L")
    cam = sh.camera(35, fstop=2.8)
    cam.place(0.0, (0.4, 5.2, 1.5), (0.1, 20, 1.4))
    cam.handheld("subtle", 0.5)
    # exposure blooms to white as he reaches the light
    sc = sh.scene
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = max(0.0, (t - (sh.dur - 0.45)) / 0.45)
        tr.setdefault((sc, "view_settings.exposure", 0), []).append(4.5 * u * u)
    write_tracks(tr, sh.frames)
    sh.finish(glare=1.0, threshold=0.8, vignette=0.4)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S11_SH")}
