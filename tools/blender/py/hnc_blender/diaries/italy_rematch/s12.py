"""S12_SH01 — quiet, deterministic aftermath of S11's physical score impact."""
import random

from mathutils import Vector

from ...cine import cast, football, look, props
from ...cine.sets import pitch
from . import score


def _set(sh):
    props.plane(sh.cols["SET"], "S12_Pitch_Grass", (120, 120), pitch.grass(), (0, 0, 0))
    props.box(sh.cols["SET"], "S12_BackdropWall", (22.0, .40, 8.0),
              look.flat("S12_Backdrop", "#171b22", rough=.9), (0, 12.0, 0), bevel=.2)
    look.world(sh.scene, color="#11151b", strength=.36)
    look.sun(sh.cols["LGT"], "S12_KeySun", (38, -22, 148), power=3.8, color="#fff1de", angle=2.5)
    look.area(sh.cols["LGT"], "S12_Rim", (-4.0, 3.0, 6.0), (0.0, 7.0, 1.2),
              size=(4.0, 4.0), power=720.0, color="#b9d9ff")


def _aftermath(sh):
    """Use S11's exact Boolean font fracture meshes and seed, settled by hand."""
    rec = score.build_score_typography(sh.scene, sh.cols["PROPS"], height=5.05, seed=score.SEED)
    # This invokes the approved deterministic cell layout/material grammar but
    # does not run or alter S11's rigid-body handoff.  The resulting slabs are
    # positioned as a post-impact still state for this separate shot.
    score.fracture_score(rec, sh.cols["FX"], sh.frames, sh.fps, impact_frame=1,
                         seed=score.SEED, rigid_bodies=False)
    for hero in rec["hero"]:
        hero.hide_render = True
    rng = random.Random(score.SEED + 120)
    for i, frag in enumerate(rec["fragments"]):
        # Spread forward from the S11 wall and settle its Boolean-cut font slabs
        # onto the turf.  Heavier outer cells remain clustered; fine impact cells
        # travel farther.  No new explosion animation is introduced.
        lane = (i % 7 - 3) * .43 + rng.uniform(-.14, .14)
        forward = 5.10 + (i // 7) * .63 + rng.uniform(-.20, .22)
        lo, _hi = score._bounds(frag)
        frag.location = (lane, forward, -lo.z + rng.uniform(.008, .035))
        frag.rotation_euler = (rng.uniform(-.18, .18), rng.uniform(-.32, .32), rng.uniform(-.52, .52))
        # The fracture helper normally reveals pieces at the S11 impact.  This
        # shot begins after that event, so its deterministic final state is
        # already fully visible on the first frame.
        frag.hide_render = False
        for f in (1, 2, 3):
            frag.keyframe_insert("hide_render", frame=f)
        frag.keyframe_insert("location", frame=1)
        frag.keyframe_insert("rotation_euler", frame=1)
        # A nearly imperceptible final settle makes dust and mass read without a
        # second hit event.
        frag.location += Vector((rng.uniform(-.012, .012), rng.uniform(.010, .030), -.012))
        frag.rotation_euler.rotate_axis("Z", rng.uniform(-.025, .025))
        frag.keyframe_insert("location", frame=sh.frames)
        frag.keyframe_insert("rotation_euler", frame=sh.frames)
    dust_mat = look.flat("S12_SettlingDust", "#8e9ba1", rough=1.0, spec=.02, alpha=.022)
    for i in range(6):
        puff = props.sphere(sh.cols["FX"], f"S12_SettlingDust_{i:02d}", .20, dust_mat,
                             loc=(rng.uniform(-1.35, 1.35), rng.uniform(5.0, 8.5), rng.uniform(.13, .38)),
                             scale=(rng.uniform(.28, .55), rng.uniform(.12, .24), rng.uniform(.14, .28)),
                             segs=10, rings=6, smooth=True)
        puff.keyframe_insert("location", frame=1)
        puff.keyframe_insert("scale", frame=1)
        puff.location.z -= rng.uniform(.05, .12)
        puff.scale *= .72
        puff.keyframe_insert("location", frame=sh.frames)
        puff.keyframe_insert("scale", frame=sh.frames)
    return rec


def S12_SH01(sh):
    _set(sh)
    rec = _aftermath(sh)
    ball = cast.prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    # S11's struck ball continues down its +Y line, now grounded and decelerating
    # through the same broken score corridor rather than being reset sideways.
    path = football.BallPath(ball, sh.frames, sh.fps)
    path.roll(0.0, sh.dur, (.30, 4.38, football.BALL_R), (.44, 7.32, football.BALL_R), ease="out")
    path.bake()
    cam = sh.camera(85, fstop=4.6)
    cam.place(0.0, (2.10, 1.08, .72), (.28, 5.62, .30), focus=(.30, 4.80, football.BALL_R))
    cam.place(sh.dur, (2.00, 1.32, .70), (.40, 6.20, .31), focus=(.44, 6.42, football.BALL_R), e="smooth")
    cam.handheld("locked", .28)
    sh.scene["hnc_s12_debris_continuity"] = f"S11 Boolean score fracture meshes, seed {score.SEED}, same matte and fracture-edge materials; deterministic settled state"
    sh.scene["hnc_s12_ball_continuity"] = "continues S11 +Y strike direction as a damped ground roll"
    sh.scene["hnc_s12_fragment_count"] = rec["fragment_count"]
    sh.finish(glare=.10, threshold=1.25, vignette=.20, dispersion=.0005)


SHOTS = {"S12_SH01": S12_SH01}
