"""S11_SH01 — the premium physical-score destruction prototype."""
import bpy
from mathutils import Vector

from ...cine import cast, football, look, perform as P, props
from ...cine.camera import impact
from ...cine.sets import pitch
from . import score


def _set(sh):
    # The full pitch helper asks for an optional HDRI that is not present on
    # this checkout; keep the reusable grass shader and use a local neutral
    # world for this isolated prototype.
    props.plane(sh.cols["SET"], "S11_Pitch_Grass", (120, 120), pitch.grass(), (0, 0, 0))
    look.world(sh.scene, color="#11151b", strength=0.36)
    look.sun(sh.cols["LGT"], "S11_KeySun", (38, -22, 148), power=3.8, color="#fff1de", angle=2.5)
    look.area(sh.cols["LGT"], "S11_Rim", (-4.0, 3.0, 6.0), (0.0, 5.2, 2.2), size=(4.0, 4.0), power=900.0, color="#b9d9ff")
    # A dark training-ground wall keeps the huge score legible without becoming
    # a second subject in this verification camera.
    wall = look.flat("S11_Backdrop", "#171b22", rough=0.9)
    props.box(sh.cols["SET"], "S11_BackdropWall", (22.0, 0.4, 8.0), wall, (0, 12.0, 0), bevel=0.2)


def S11_SH01(sh):
    """3.1 s / 93 frames: authored kick, canonical ball, physical score burst."""
    _set(sh)
    p = sh.person("TR-PLAYER-09", "kit", profile="sport")
    ball = cast.prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    ball_pos = Vector((0.35, 1.65, football.BALL_R))
    contact_t = 1.40
    impact_t = 1.87
    impact_frame = round(impact_t * sh.fps) + 1
    recovery = football.strike(p, contact_t, ball_pos, (0, 1, 0), side="R", power=1.0)
    P.relax_arms(p, recovery + 0.12)

    path = football.BallPath(ball, sh.frames, sh.fps)
    path.rest(0.0, contact_t, ball_pos)
    path.flight(contact_t, impact_t, ball_pos, (0.35, 6.38, 2.12), apex=0.34)
    path.flight(impact_t, sh.dur + 0.2, (0.35, 6.38, 2.12), (1.20, 10.8, 2.42), apex=0.34)
    path.bake()

    score_rec = score.build_score_typography(sh.scene, sh.cols["PROPS"], height=5.05, seed=score.SEED)
    score.fracture_score(score_rec, sh.cols["FX"], sh.frames, sh.fps, impact_frame=impact_frame, seed=score.SEED)
    score.animate_score_impact(sh.scene, score_rec, sh.cols["FX"], sh.frames, sh.fps,
                               impact_frame=impact_frame, internal_light=True)

    # Portrait coverage needs a little more breathing room than a landscape
    # three-quarter: keep the whole player in frame while the score still
    # dominates the vertical axis.
    cam = sh.camera(40, fstop=2.8)
    cam.place(0.0, (2.75, -10.2, 2.75), (-0.05, 4.6, 2.35), focus=(0.0, 3.9, 2.25), e="smooth")
    cam.place(sh.dur, (2.55, -9.4, 2.85), (-0.02, 5.25, 2.48), focus=(0.0, 5.9, 2.35), e="smooth")
    impact(cam, impact_t + 0.055, strength=0.34, decay=0.22)
    cam.handheld("locked", 0.55)
    sh.scene["hnc_s11_score_seed"] = score.SEED
    sh.scene["hnc_s11_score_fragments"] = score_rec["fragment_count"]
    sh.scene["hnc_s11_score_internal_light"] = True
    sh.scene["hnc_s11_fracture_method"] = "deterministic custom pre-fractured Boolean font mesh + rigid-body handoff"
    sh.finish(glare=0.42, threshold=1.05, vignette=0.20, dispersion=0.001)


SHOTS = {"S11_SH01": S11_SH01}
