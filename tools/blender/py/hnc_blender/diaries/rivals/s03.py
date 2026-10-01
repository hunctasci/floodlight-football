"""S03 — 1957–58: where it started (and a newsreel)."""
import bpy
from mathutils import Vector

from ...cine import football as F
from ...cine import perform as P
from ...cine.cast import prop_identity
from ...cine.perform import heading
from ...cine.sets import pitch as PITCH
from .room import chair_shot


def S03_SH01(sh):
    chair_shot(sh)


def S03_SH03(sh):
    chair_shot(sh)


def S03_SH04(sh):
    chair_shot(sh)


def S03_SH05(sh):
    chair_shot(sh)


def S03_SH02(sh):
    """1957: a newsreel. Two players of the era chase a loose ball across a heavy pitch; the
    camera is the high, static stand camera of the time (the sepia and gate are added in the edit)."""
    a = PITCH.pitch(sh.scene, sh.cols["SET"], sh.cols["LGT"], goal=True)
    bpy.context.view_layer.update()
    ball = prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    R = F.BALL_R
    tr_ = sh.person("TR-PLAYER-10", "kit", profile="sport")
    be_ = sh.person("BE-PLAYER-10", "kit", profile="sport")
    b0, b1 = Vector((-3.0, 6.0, R)), Vector((4.5, 11.0, R))
    P.stance(tr_, 0.0, (-4.0, 5.2, 0.0), heading((-4.0, 5.2), b1))
    P.stance(be_, 0.0, (-2.4, 4.4, 0.0), heading((-2.4, 4.4), b1))
    bp = F.BallPath(ball, sh.frames, sh.fps)
    bp.rest(-1, 0.15, b0)
    F.touch(tr_, 0.15, "R", b0 - Vector((0, 0, R)))
    bp.roll(0.15, sh.dur, b0, b1, ease="out")
    bp.bake()
    P.walk(tr_, 0.2, [(3.6, 10.2)], stride=1.25, cadence=2.9, style="sprint", lead="L")
    P.walk(be_, 0.25, [(4.0, 9.4)], stride=1.2, cadence=2.9, style="sprint", lead="R")
    cam = sh.camera(35, fstop=8.0)
    cam.place(0.0, (-1.0, -9.0, 7.5), (0.0, 6.5, 0.6))
    cam.place(sh.dur, (-1.0, -9.0, 7.5), (1.6, 8.0, 0.6), e="linear")  # the operator pans with the ball
    cam.handheld("subtle", 0.6)
    sh.finish(glare=0.0, vignette=0.6)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S03_SH")}
