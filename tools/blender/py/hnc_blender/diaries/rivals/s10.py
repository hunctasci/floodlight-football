"""S10 — Tonight: the tunnel in Liège. Side by side, not looking at each other."""
import bpy
from mathutils import Vector

from ...cine import perform as P
from ...cine.perform import write_tracks
from ...cine.sets import tunnel

# Two lines of players walk out: TR on the left of the tunnel, BE on the right, #9 and #4 level.
NINE_X, FOUR_X = -0.65, 0.65
STOP_Y = 9.0


def _set(sh):
    a = tunnel.tunnel(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    bpy.context.view_layer.update()
    return a


def _pair(sh, walking=True, t0=-0.6, y0=None):
    nine = sh.person("TR-PLAYER-09", "kit", profile="calm")
    four = sh.person("BE-PLAYER-04", "kit", profile="calm")
    for p, x, lead in ((nine, NINE_X, "L"), (four, FOUR_X, "R")):
        y = (STOP_Y - 3.0) if y0 is None else y0
        P.stance(p, t0, (x, y, 0.0), 180.0)
        P.relax_arms(p, t0)
        if walking:
            P.walk(p, t0, [(x, STOP_Y + 9.0)], stride=0.6, cadence=1.8, style="focused", lead=lead, end_face=180.0)
    return nine, four


def S10_SH01(sh):
    """Wide from behind: the two of them level, walking toward the light."""
    _set(sh)
    nine, four = _pair(sh)
    cam = sh.camera(35, fstop=2.8)
    for t in (0.0, sh.dur):
        y = nine.ch["pos"].at(t)[1]
        cam.place(t, (0.0, y - 4.2, 1.65), (0.0, y + 8.0, 1.4), focus=(0.0, y, 1.5), e="linear")
    cam.handheld("follow", 0.6)
    sh.finish(glare=0.8, threshold=0.9, vignette=0.45)


def S10_SH02(sh):
    """Waiting to walk out: a profile two-shot, #4 nearest the lens. 'Eighteen.' He doesn't turn."""
    _set(sh)
    nine, four = _pair(sh, walking=False, y0=STOP_Y)
    la, lb = sh.line("L30")
    sh.talk(four, "L30", amount=0.6)
    P.glance(four, la - 0.1, 0.6, 0.0, dur=0.15, hold=0.6)  # eyes only, toward #9
    P.glance(nine, lb + 0.1, -0.5, 0.0, dur=0.15, hold=None)
    # from the tunnel's side (it is 4.2 m wide): stacked profiles, #4 nearest, #9 behind him
    cam = sh.camera(35, fstop=2.0)
    cam.place(0.0, (1.85, STOP_Y + 0.45, 1.62), (-0.4, STOP_Y, 1.55), focus=(FOUR_X, STOP_Y, 1.62))
    cam.handheld("locked", 0.8)
    sh.finish(glare=0.6, threshold=0.9, vignette=0.5)


def S10_SH03(sh):
    """CU #9, rim-lit by the pitch: 'Not for long.' The half-smile."""
    _set(sh)
    nine, four = _pair(sh, walking=False, y0=STOP_Y)
    la, lb = sh.line("L31")
    sh.talk(nine, "L31", amount=0.6)
    P.smile(nine, lb - 0.2, amount=0.3, dur=0.35, tilt=2.0)  # a half-smile: the eyes stay open in a CU
    head = Vector((NINE_X, STOP_Y, 1.72))
    cam = sh.camera(85, fstop=1.8)
    cam.place(0.0, (NINE_X - 0.4, STOP_Y + 3.0, 1.66), head + Vector((0, 0, -0.1)), focus=head)
    cam.handheld("locked", 0.6)
    sh.finish(glare=0.9, threshold=0.85, vignette=0.5)


def S10_SH04(sh):
    """Wide from behind: they walk into the light; it blooms to white."""
    _set(sh)
    nine, four = _pair(sh, t0=0.0, y0=STOP_Y)
    cam = sh.camera(35, fstop=2.8)
    cam.place(0.0, (0.2, STOP_Y - 3.6, 1.5), (0.0, STOP_Y + 12.0, 1.4))
    cam.handheld("subtle", 0.5)
    sc = sh.scene
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = max(0.0, (t - (sh.dur - 0.5)) / 0.5)
        tr.setdefault((sc, "view_settings.exposure", 0), []).append(4.5 * u * u)
    write_tracks(tr, sh.frames)
    sh.finish(glare=1.0, threshold=0.8, vignette=0.4)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S10_SH")}
