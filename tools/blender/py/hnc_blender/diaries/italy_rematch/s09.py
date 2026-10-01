"""S09_SH01 — the hard-cut ball impact that starts the football film."""
from mathutils import Vector

from ...cine import cast, football, look, props
from ...cine.camera import impact
from ...cine.sets import pitch


def S09_SH01(sh):
    # Keep the existing pitch language, but use a local world fallback so an
    # optional HDRI can never block this preview.  This shot is ball-first.
    props.plane(sh.cols["SET"], "S09_Pitch_Grass", (120, 120), pitch.grass(), (0, 0, 0))
    props.box(sh.cols["SET"], "S09_TrainingWall", (24, .35, 4.4), look.flat("S09_Backdrop", "#1c2830", rough=.88), (0, 8.5, 0), bevel=.08)
    look.world(sh.scene, color="#182127", strength=.42)
    look.sun(sh.cols["LGT"], "S09_DirectionalKey", (36, -24, 142), power=4.0, color="#fff1dc", angle=1.5)
    look.area(sh.cols["LGT"], "S09_CoolRim", (-3.4, 3.1, 4.7), (0, .55, .45), size=(3.0, 3.0), power=680, color="#b8d7e5")
    look.area(sh.cols["LGT"], "S09_TurfFill", (0.8, -1.8, 2.1), (0, .40, .10), size=(2.6, 2.6), power=380, color="#d7f0d4")
    ball = cast.prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    ground = Vector((0.0, .40, football.BALL_R))
    # Author physical fall + damped rebound: entry at the cut, contact at
    # frame 13 (0.40 s), then a usable forward roll into the next beat.
    path = football.BallPath(ball, sh.frames, sh.fps)
    settle = path.drop(.00, (0.0, .40, 1.18), ground, bounces=1, e=.35)
    path.roll(settle, sh.dur + .15, ground, (0.10, 1.08, football.BALL_R), ease="out")
    path.bake()
    cam = sh.camera(35, fstop=3.5)
    cam.place(0.0, (.92, -2.08, .39), (0.0, .40, .43), focus=(0.0, .40, football.BALL_R))
    cam.place(sh.dur, (.86, -1.98, .41), (.04, .64, .34), focus=(.04, .64, football.BALL_R), e="linear")
    impact(cam, .42, strength=.48, decay=.18)
    cam.handheld("locked", .34)
    sh.scene["hnc_ball"] = "canonical hnc-ball / HNC_Ball; authored gravity drop, damped rebound, forward roll"
    sh.scene["hnc_event_frames"] = {"ball_enters": 1, "ball_ground_contact": 13, "ball_rebound": 19, "ball_roll": 24}
    sh.scene["hnc_genre_switch"] = "hard cut from S08; sculpted directional football-commercial light"
    sh.finish(glare=.16, threshold=1.18, vignette=.14, dispersion=.0005)


SHOTS = {"S09_SH01": S09_SH01}
