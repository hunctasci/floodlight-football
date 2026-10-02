"""S02_SH01 — understated elevator button/display gag."""
import bpy

from ...cine import look, perform as P, props
from . import architecture, score


def _visibility(obj, ranges, frames):
    """Hard-cut render visibility over inclusive frame ranges."""
    changes = {1, frames}
    for a, b in ranges:
        changes.update((max(1, a), min(frames, b + 1)))
    for frame in sorted(changes):
        obj.hide_render = not any(a <= frame <= b for a, b in ranges)
        obj.hide_viewport = obj.hide_render
        obj.keyframe_insert("hide_render", frame=frame)
        obj.keyframe_insert("hide_viewport", frame=frame)


def S02_SH01(sh):
    info = architecture.shared(sh, "elevator")
    # Threshold composition: actor, call/floor panel, overhead display and
    # opening doors share one observational frame.
    p = sh.person("TR-PLAYER-09", "home", profile="calm")  # home clothes until the S09 genre switch
    P.stance(p, 0.0, (-0.18, -1.02, 0.0), face=140.0, width=0.92)
    button_at = (0.81, -0.175, 0.91)
    P.look(p, 0.0, button_at, dur=0.18)
    P.reach(p, 0.18, "R", button_at, dur=0.28, rot=(0, 10, -8), w=1.0)
    P.release(p, 0.58, "R", dur=0.18)
    P.look(p, 0.54, (0.0, -0.06, 2.49), dur=0.22)
    P.glance(p, 0.94, 0.14, dur=0.12, hold=0.16, back=0.14, head=1.2)
    P.reach(p, 1.24, "R", button_at, dur=0.23, rot=(0, 10, -8), w=1.0)
    P.release(p, 1.60, "R", dur=0.16)
    P.look(p, 1.52, (0.0, -0.06, 2.49), dur=0.16)

    # Physical button travel and a restrained ring light prove hand contact.
    button = info["button"]
    button.keyframe_insert("location", frame=1)
    button.keyframe_insert("location", frame=10)
    button.location.y += 0.014
    button.keyframe_insert("location", frame=14)
    button.location.y -= 0.014
    button.keyframe_insert("location", frame=18)
    button.keyframe_insert("location", frame=39)
    button.location.y += 0.014
    button.keyframe_insert("location", frame=44)
    button.location.y -= 0.014
    button.keyframe_insert("location", frame=48)
    ring = props.torus(sh.cols["PROPS"], "ARCH_Button1_LitRing", 0.045, 0.005,
                       look.emission("ARCH_Button1_Amber", "#f2c27a", 3.2),
                       (0.81, -0.169, 0.91), rot=(90, 0, 0), major=24, minor=8)
    _visibility(ring, [(11, 18), (40, 49)], sh.frames)

    # The display is shot data: four separate physical glyphs with immediate
    # visibility changes (no digital glitch or interpolation).
    display_mat = look.emission("ARCH_DisplayGlyph", "#dceff0", 4.2)
    spans = (("1", 1, 12), ("4", 13, 24), ("1", 25, 36), ("4", 37, sh.frames))
    for i, (text, a, b) in enumerate(spans):
        glyph = score.build_glyph(sh.cols["PROPS"], text, (0.0, -0.145, 2.275),
                                  0.42, depth=0.010, material=display_mat,
                                  name=f"ARCH_DisplayGlyph_{i}", rotation=(90, 0, 0),
                                  bevel=False)
        glyph["hnc_floor_display_value"] = text
        _visibility(glyph, [(a, b)], sh.frames)

    # A large, plausible landing marker makes the opened destination clearly 4.
    plaque = props.box(sh.cols["SET"], "ARCH_WrongFloorPlaque", (0.035, 0.56, 0.48),
                       look.flat("ARCH_WrongFloorPlaqueMat", "#ece7dc", rough=0.66),
                       (-0.935, -1.15, 1.34), bevel=0.014)
    score.build_glyph(sh.cols["PROPS"], "4", (-0.905, -1.15, 1.42), 0.31,
                      depth=0.010, material=look.flat("ARCH_WrongFloor4", "#2d393d", rough=0.56),
                      name="ARCH_WrongFloor4", rotation=(90, 0, -90), bevel=False)

    for door, side in zip(info["doors"], (-1, 1)):
        door.keyframe_insert("location", frame=1)
        door.keyframe_insert("location", frame=48)
        door.location.x += side * 0.86
        door.keyframe_insert("location", frame=60)

    cam = sh.camera(28, fstop=4.0)
    # Three-quarter side: his face and the overhead display share the frame (v1 showed only his back).
    cam.place(0.0, (-0.85, -3.05, 1.45), (0.12, -0.40, 1.40), focus=(-0.18, -1.02, 1.30))  # corridor is ±1.0 m wide
    cam.place(sh.dur, (-0.82, -2.85, 1.47), (0.12, -0.30, 1.42), focus=(-0.18, -1.02, 1.30))
    cam.handheld("locked", 0.22)
    sh.scene["hnc_architecture"] = "shared modern residential corridor/elevator"
    sh.scene["hnc_s02_display_sequence"] = "1-4-1-4"
    sh.scene["hnc_s02_button_contact"] = "TR-PLAYER-09.R IK -> ARCH_Button_1; 14 mm button travel"
    sh.scene["hnc_s02_wrong_floor"] = 4
    sh.keep_in_frame(p)
    sh.finish(glare=0.10, threshold=1.45, vignette=0.14, dispersion=0.0004)


SHOTS = {"S02_SH01": S02_SH01}
