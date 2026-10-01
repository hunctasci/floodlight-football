"""S13_SH01 — a physical coaching board clears the old score for the rematch."""
from mathutils import Vector

from ...cine import look, perform as P, props
from . import score


def _score(col, prefix, text, material, y):
    positions = {"1–4": (("1", -.50), ("–", 0.0), ("4", .50)),
                 "0–0": (("0", -.50), ("–", 0.0), ("0", .50))}[text]
    return [score.build_glyph(col, glyph, (x, y, 1.16), .50, depth=.006,
                              material=material, name=f"{prefix}_{i}", bevel=False)
            for i, (glyph, x) in enumerate(positions)]


def S13_SH01(sh):
    # A restrained field-side analysis bay: the board and the erase are real
    # geometry, not a screen treatment or a floating score graphic.
    wall = look.flat("S13_AnalysisWall", "#20282a", rough=.82)
    frame = look.flat("S13_BoardFrame", "#343d3d", rough=.34, metal=.72)
    board = look.flat("S13_DryErase", "#e9e5d9", rough=.38, spec=.34)
    old_ink = look.flat("S13_OldMarker", "#243441", rough=.52)
    reset_ink = look.flat("S13_ResetMarker", "#263c4a", rough=.52)
    props.plane(sh.cols["SET"], "S13_AnalysisFloor", (13, 13), look.flat("S13_Floor", "#52605c", rough=.76), (0, 0, 0))
    props.box(sh.cols["SET"], "S13_AnalysisWall", (8, .20, 4.2), wall, (0, 2.05, 0), bevel=.04)
    props.box(sh.cols["SET"], "S13_TacticalBoard", (3.25, .08, 2.10), board, (0, 1.89, 1.05), bevel=.025)
    for x, z, size in ((-1.68, 1.05, (.08, .12, 2.22)), (1.68, 1.05, (.08, .12, 2.22)), (0, 2.16, (3.42, .12, .08)), (0, -.06, (3.42, .12, .08))):
        props.box(sh.cols["SET"], "S13_BoardFrame", size, frame, (x, 1.84, z), bevel=.018)
    # The reset ink exists underneath, like a pre-written drill state.  It is
    # held out of view by the old score until the cloth passes it.
    old = _score(sh.cols["PROPS"], "S13_Old_14", "1–4", old_ink, 1.835)
    reset = _score(sh.cols["PROPS"], "S13_Reset_00", "0–0", reset_ink, 1.830)
    for o in reset:
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=1)
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=39)
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=40)
    # A real felt eraser travels once across the writing plane.  The single
    # handoff at its leading edge is the cinematic erase cheat, motivated by
    # an opaque pad rather than a dissolve or digital transformation.
    felt = look.flat("S13_Felt", "#cdbd99", rough=.9)
    eraser = props.box(sh.cols["PROPS"], "S13_FeltEraser", (.48, .13, .18), felt, (-1.16, 1.70, 1.17), bevel=.025)
    eraser.rotation_euler = (0.0, .22, 0.0)
    eraser.keyframe_insert("location", frame=18)
    eraser.location = (1.18, 1.70, 1.17)
    eraser.keyframe_insert("location", frame=48)
    for o in old:
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=1)
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=39)
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=40)
    p = sh.person("TR-PLAYER-09", "kit", profile="still")
    P.stance(p, 0.0, (-.82, .82, 0), 180.0)
    P.reach(p, .45, "R", (-1.12, 1.66, 1.17), dur=.28, rot=(8, 0, 0))
    P.reach(p, 1.03, "R", (1.10, 1.66, 1.17), dur=.78, rot=(8, 0, 0), e="linear")
    P.relax_arms(p, 1.94)
    P.look(p, .18, (0, 1.83, 1.16), w=.74, dur=.22)
    cam = sh.camera(50, fstop=4.2)
    cam.place(0.0, (2.34, -.78, 1.68), (0, 1.86, 1.20), focus=(0, 1.83, 1.16))
    cam.place(sh.dur, (2.26, -.70, 1.66), (0, 1.86, 1.20), focus=(0, 1.83, 1.16), e="smooth")
    cam.handheld("locked", .22)
    look.world(sh.scene, color="#172025", strength=.40)
    look.area(sh.cols["LGT"], "S13_SoftKey", (-2.2, -.9, 3.4), (0, 1.8, 1.3), (2.4, 2.4), 520, "#f4ead8")
    look.area(sh.cols["LGT"], "S13_BoardFill", (1.5, .1, 2.8), (0, 1.85, 1.3), (1.4, 1.4), 210, "#c6ddef")
    sh.scene["hnc_reset_method"] = "physical dry-erase board; felt eraser masks marker 1–4 while revealing pre-written 0–0 reset state"
    sh.finish(glare=.08, threshold=1.3, vignette=.13, dispersion=.0003)


SHOTS = {"S13_SH01": S13_SH01}
