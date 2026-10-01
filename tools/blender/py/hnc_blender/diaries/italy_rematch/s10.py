"""S10 — #9 turns the physical score into a dribbling problem."""
from mathutils import Vector

from ...cine import cast, football, look, perform as P, props
from ...cine.sets import pitch
from . import score


def _set(sh, label):
    """The S09/S11 training-ground language, deliberately kept shot-local."""
    props.plane(sh.cols["SET"], f"{label}_Pitch_Grass", (120, 120), pitch.grass(), (0, 0, 0))
    props.box(sh.cols["SET"], f"{label}_BackdropWall", (22.0, .40, 8.0),
              look.flat(f"{label}_Backdrop", "#171b22", rough=.9), (0, 12.0, 0), bevel=.2)
    look.world(sh.scene, color="#11151b", strength=.36)
    look.sun(sh.cols["LGT"], f"{label}_KeySun", (38, -22, 148), power=3.8,
             color="#fff1de", angle=2.5)
    look.area(sh.cols["LGT"], f"{label}_Rim", (-4.0, 3.0, 6.0), (0.0, 5.2, 2.2),
              size=(4.0, 4.0), power=900.0, color="#b9d9ff")
    look.area(sh.cols["LGT"], f"{label}_TurfFill", (1.0, -2.1, 2.2), (0.0, 2.8, .12),
              size=(3.0, 3.0), power=360.0, color="#d7f0d4")


def _giant(sh, char, name):
    # Same Barlow mesh, depth, matte material and architectural scale as S11.
    glyph = score.build_glyph(sh.cols["PROPS"], char, (0.0, 5.10, .12), 5.05,
                              depth=.30, name=name)
    glyph["hnc_score_role"] = "static defensive gate"
    glyph["hnc_score_seed"] = score.SEED
    return glyph


def _ball_path(ball, sh, points):
    path = football.BallPath(ball, sh.frames, sh.fps)
    for (a, pa), (b, pb) in zip(points, points[1:]):
        path.roll(a, b, pa, pb, ease="soft" if b - a > .28 else "out")
    path.bake()


def S10_SH01(sh):
    """3.0 s / 90f — a left show, then a close right-side escape around the 1."""
    _set(sh, "S10_ONE")
    _giant(sh, "1", "S10_ONE_GIANT_1")
    p = sh.person("TR-PLAYER-09", "kit", profile="sport")
    ball = cast.prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    # S09 leaves the ball rolling on this corridor.  The near-side lateral touch
    # creates the feint; the clearance stays outside the actual mesh footprint.
    ball_points = [
        (0.00, (.10, 1.08, football.BALL_R)), (.52, (.04, 1.67, football.BALL_R)),
        (.92, (-.24, 2.20, football.BALL_R)), (1.22, (-.36, 2.54, football.BALL_R)),
        (1.48, (.40, 2.82, football.BALL_R)), (1.82, (.78, 3.35, football.BALL_R)),
        (2.26, (.86, 4.18, football.BALL_R)), (3.00, (.74, 5.48, football.BALL_R)),
    ]
    _ball_path(ball, sh, ball_points)
    P.stance(p, 0.0, (.10, .26, 0), 180.0)
    P.walk(p, .03, [(0.04, .92), (-.15, 1.65), (-.31, 2.19)], stride=.54,
           cadence=3.0, lead="L", style="jog", end_face=172.0)
    # Plant and torso sell the false lane before the right-side acceleration.
    P.weight_shift(p, .74, side="L", dur=.34, amount=.05)
    p.key("chest", 1.08, (10.0, 5.0, 13.0), "out")
    p.key("hips_rot", 1.10, (8.0, 2.5, 20.0), "out")
    P.arms(p, 1.08, "L", 25, 45, 0, 38, e="out")
    P.arms(p, 1.08, "R", -18, 30, 0, 44, e="out")
    football.touch(p, 1.18, "L", ball_points[3][1])
    P.walk(p, 1.20, [(.30, 2.72), (.69, 3.28), (.85, 4.18), (.74, 5.45)],
           stride=.62, cadence=3.45, lead="R", style="sprint", end_face=180.0)
    P.arms(p, 1.48, "L", -25, 54, 0, 72, e="out")
    P.arms(p, 1.48, "R", 30, 42, 0, 74, e="out")
    P.look(p, .18, ball_points[2][1], w=.78, dur=.25)
    p.key("look_at", 1.60, ball_points[5][1], "soft")
    P.relax_arms(p, 2.72)
    cam = sh.camera(24, fstop=4.0)
    cam.place(0.0, (2.65, -2.10, .52), (.02, 2.05, 1.48), focus=ball_points[1][1])
    cam.place(1.45, (2.38, .02, .46), (.12, 3.05, 1.65), focus=ball_points[4][1], e="smooth")
    cam.place(sh.dur, (2.18, 2.35, .62), (.42, 4.70, 1.72), focus=ball_points[-1][1], e="smooth")
    cam.handheld("subtle", .40)
    sh.scene["hnc_football_move"] = "approach / left show / planted feint / close right-side burst around static 1"
    sh.scene["hnc_ball_continuity"] = "S09 exit corridor at y=1.08; authored rolling touch path"
    sh.finish(glare=.20, threshold=1.14, vignette=.18, dispersion=.0007)


def S10_SH02(sh):
    """3.1 s / 93f — a shooting shape to the right, a planted cut to the left."""
    _set(sh, "S10_FOUR")
    _giant(sh, "4", "S10_FOUR_GIANT_4")
    p = sh.person("TR-PLAYER-09", "kit", profile="sport")
    ball = cast.prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    ball_points = [
        (0.00, (.08, 1.08, football.BALL_R)), (.55, (.05, 1.72, football.BALL_R)),
        (.95, (.32, 2.32, football.BALL_R)), (1.28, (.56, 2.70, football.BALL_R)),
        (1.55, (.38, 3.02, football.BALL_R)), (1.78, (-.40, 3.30, football.BALL_R)),
        (2.14, (-.83, 3.90, football.BALL_R)), (2.58, (-.92, 4.68, football.BALL_R)),
        (3.10, (-.72, 5.62, football.BALL_R)),
    ]
    _ball_path(ball, sh, ball_points)
    P.stance(p, 0.0, (.08, .24, 0), 180.0)
    P.walk(p, .03, [(.02, .95), (.25, 1.72), (.51, 2.37)], stride=.55,
           cadence=2.95, lead="R", style="jog", end_face=164.0)
    # A shot-shaped body, held long enough for coverage to read the intended lane.
    P.weight_shift(p, .78, side="R", dur=.40, amount=.055)
    p.key("chest", 1.15, (12.0, -6.0, -18.0), "out")
    p.key("hips_rot", 1.17, (9.0, -3.0, -24.0), "out")
    P.arms(p, 1.13, "L", -16, 31, 0, 42, e="out")
    P.arms(p, 1.13, "R", 31, 52, 0, 52, e="out")
    football.touch(p, 1.30, "R", ball_points[3][1])
    # The right foot is planted by the gait; shoulder and hips unwind through
    # the opposite lane rather than turning the static numeral into an actor.
    p.key("chest", 1.58, (15.0, 6.0, 25.0), "in")
    p.key("hips_rot", 1.58, (13.0, 3.5, 31.0), "in")
    P.walk(p, 1.43, [(-.31, 3.28), (-.78, 3.86), (-.94, 4.70), (-.72, 5.60)],
           stride=.61, cadence=3.5, lead="L", style="sprint", end_face=180.0)
    P.arms(p, 1.63, "L", 30, 48, 0, 76, e="out")
    P.arms(p, 1.63, "R", -28, 54, 0, 74, e="out")
    P.look(p, .20, ball_points[2][1], w=.78, dur=.24)
    p.key("look_at", 1.83, ball_points[6][1], "soft")
    P.relax_arms(p, 2.82)
    cam = sh.camera(35, fstop=3.5)
    cam.place(0.0, (3.05, -2.35, 1.22), (.02, 2.30, 1.75), focus=ball_points[1][1])
    cam.place(1.52, (2.60, -.05, 1.36), (.02, 3.15, 1.82), focus=ball_points[5][1], e="smooth")
    cam.place(sh.dur, (1.72, 2.25, 1.45), (-.45, 4.72, 1.68), focus=ball_points[-1][1], e="smooth")
    cam.handheld("locked", .55)
    sh.scene["hnc_football_move"] = "right-side shot shape / right plant / sharp left cut / exit around static 4"
    sh.scene["hnc_ball_continuity"] = "rolling touches are authored in contact with the player path; no flight or reset"
    sh.finish(glare=.20, threshold=1.14, vignette=.18, dispersion=.0007)


SHOTS = {"S10_SH01": S10_SH01, "S10_SH02": S10_SH02}
