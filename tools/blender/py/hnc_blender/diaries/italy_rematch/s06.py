"""S06 reflection reveal and physical elevator reveal."""
import math

from ...cine import look, perform as P, props
from . import architecture, score


def S06_SH01(sh):
    architecture.shared(sh, "corridor")
    mirror = architecture.reflection_end(sh, y=2.72)
    p = sh.person("TR-PLAYER-09", "home", profile="calm")
    P.stance(p, 0.0, (-0.68, -2.20, 0.0), face=180.0, width=0.90)
    # Walk away from camera along +Y. Peripheral attention leads the restrained
    # head correction; the final look is back into an ordinary empty corridor.
    P.walk(p, 0.0, [(-0.68, 0.35)], stride=0.58, cadence=2.05, style="casual")
    P.glance(p, 0.86, -0.42, dur=0.13, hold=0.20, back=0.16, head=-1.8)
    P.look(p, 1.48, (-0.10, -2.25, 1.30), dur=0.24, w=0.72)

    # Cinematic mirror cheat: physically modelled, mirrored score geometry sits
    # in the shallow backing volume behind the glass aperture. It is lit and
    # perspective-projected by Blender, but cannot appear in open corridor space.
    reflected_mat = look.flat("S06_ReflectedScoreMat", "#c2cbcd", rough=0.40,
                              metal=0.18, spec=0.52, coat=0.08)
    look.area(sh.cols["LGT"], "S06_ReflectionVolumeLight", (0.0, 2.765, 2.30),
              (0.0, mirror["score_y"], 1.15), size=(1.45, 0.45), power=95,
              color="#d8e0df", spread=105.0)
    glyphs = []
    for text, xx in (("1", -0.30), ("–", 0.0), ("4", 0.30)):
        if text == "–":
            o = props.box(sh.cols["PROPS"], "S06_REFLECTED_SCORE_DASH",
                          (0.28, 0.075, 0.075), reflected_mat,
                          (xx, mirror["score_y"], 1.38), bevel=0.018)
        else:
            o = score.build_glyph(sh.cols["PROPS"], text,
                                  (xx, mirror["score_y"], 0.34), 2.20, depth=0.075,
                                  material=reflected_mat, name=f"S06_REFLECTED_SCORE_{text}",
                                  rotation=(90, 0, 0))
            o.scale.x = 0.68
        o["hnc_visibility"] = "reflection-volume-only"
        glyphs.append(o)
    # The full score crosses the panel as one heavy object behind #9.
    for o in glyphs:
        start_x = o.location.x + 0.50
        o.location.x = start_x
        o.keyframe_insert("location", frame=1)
        o.keyframe_insert("location", frame=15)
        o.location.x = start_x - 0.40
        o.keyframe_insert("location", frame=45)
        o.keyframe_insert("location", frame=sh.frames)

    cam = sh.camera(70, fstop=3.2)
    cam.place(0.0, (-0.72, -8.10, 1.48), (0.10, -0.70, 1.26),
              focus=(-0.05, -1.10, 1.25))
    cam.place(sh.dur, (-0.68, -6.35, 1.50), (0.12, 0.25, 1.28),
              focus=(-0.03, -0.05, 1.24))
    cam.handheld("observational", 0.32)
    sh.scene["hnc_s06_reflection"] = (
        "mirrored physical score geometry in a masked shallow volume behind architectural glass"
    )
    sh.scene["hnc_s06_direct_score"] = False
    sh.scene["hnc_s06_reflection_aperture"] = mirror["aperture"]
    sh.keep_in_frame(p)
    sh.finish(glare=0.06, threshold=1.55, vignette=0.15, dispersion=0.0004)


def S06_SH02(sh):
    info = architecture.shared(sh, "elevator")
    p = sh.person("TR-PLAYER-09", "home", profile="calm")
    P.stance(p, 0.0, (-0.55, -0.70, 0.0), face=180.0, width=0.94)  # fully in frame (v1 half off the left edge)
    P.look(p, 0.72, (0.05, 2.20, 1.18), dur=0.22, w=0.76)
    P.glance(p, 1.62, 0.14, dur=0.12, hold=None, back=0.12, head=0.8)

    number_mat = look.flat("S06_ElevatorScoreMat", "#4f5d63", rough=0.60,
                           metal=0.10, spec=0.34, coat=0.06)
    glyph_size = 3.20  # Barlow cap geometry resolves to ~1.78 m at this font size.
    one = score.build_glyph(sh.cols["PROPS"], "1", (-0.45, 2.55, 0.02), glyph_size,
                            depth=0.16, material=number_mat, name="S06_ELEVATOR_SCORE_1")
    four = score.build_glyph(sh.cols["PROPS"], "4", (0.42, 2.55, 0.02), glyph_size,
                             depth=0.16, material=number_mat, name="S06_ELEVATOR_SCORE_4")
    for o in (one, four):
        o["hnc_commuter_number"] = True
        o["hnc_font_size_m"] = glyph_size
    # Turned toward camera and rim-lit so they read as two standing objects, not a flat "14" sign.
    one.rotation_mode = "XYZ"
    one.rotation_euler[2] = math.radians(10)
    look.area(sh.cols["LGT"], "S06_CommuterRim", (0.0, 3.6, 2.6), (0, -.6, .4), (2.0, 1.0), 520, "#d8e6ff")
    # Hold after the reveal, then a tiny rigid acknowledgement from the 4.
    four.rotation_mode = "XYZ"
    four.rotation_euler[2] = math.radians(-12)
    four.keyframe_insert("rotation_euler", frame=1)
    four.keyframe_insert("rotation_euler", frame=47)
    four.rotation_euler[2] = math.radians(-14.6)
    four.keyframe_insert("rotation_euler", frame=57)
    four.keyframe_insert("rotation_euler", frame=sh.frames)

    for door, side in zip(info["doors"], (-1, 1)):
        door.keyframe_insert("location", frame=1)
        door.keyframe_insert("location", frame=11)
        door.location.x += side * 0.86
        door.keyframe_insert("location", frame=30)
        door.keyframe_insert("location", frame=sh.frames)

    cam = sh.camera(22, fstop=4.2)
    # Higher, over his shoulder: he no longer blocks the "1" (v2 review).
    cam.place(0.0, (0.42, -3.55, 1.95), (0.0, 1.48, 1.15), focus=(0.0, 2.32, 1.10))
    cam.place(sh.dur, (0.46, -3.20, 1.97), (0.0, 1.62, 1.16), focus=(0.0, 2.40, 1.10))
    cam.handheld("locked", 0.20)
    sh.scene["hnc_s06_elevator_numbers"] = "1,4; approved physical score grammar; 1.78m cap height"
    sh.scene["hnc_s06_elevator_cabin_m"] = info["cabin"]
    sh.scene["hnc_s06_four_rotation_deg"] = -2.6
    sh.keep_in_frame(p)
    sh.finish(glare=0.09, threshold=1.42, vignette=0.12, dispersion=0.0004)


SHOTS = {"S06_SH01": S06_SH01, "S06_SH02": S06_SH02}
