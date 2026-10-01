"""S00 — quiet bedside hook: physical clock, then a restrained first look."""
import bpy
from mathutils import Vector

from ...cine import look, perform as P, props
from ...cine.perform import write_tracks
from ...cine.sets import home


def _bedroom(sh, text):
    a = home.bedroom(sh.scene, sh.cols["SET"], sh.cols["LGT"], "dawn")
    # Replace the generic room clock with shot-specific, correctly timed physical display.
    bpy.data.objects.remove(a["clock"], do_unlink=True)
    # The shared segment builder has no dash glyph; author it as a physical bar over its colon.
    clock = props.digital_clock(sh.cols["PROPS"], "S00_Alarm", text=("1:4" if text == "1-4" else text),
                                loc=tuple(a["nightstand"] + Vector((0.05, -0.07, 0.0))), rot=(0, 0, 20), strength=9.0)
    if text == "1-4":
        seg = look.emission("S00_Dash", "#ff4a2e", 9.0)
        props.box(sh.cols["PROPS"], "S00_DisplayDash", (.018, .002, .004), seg,
                  tuple(a["nightstand"] + Vector((.056, -.114, .049))))
    bpy.context.view_layer.update()
    return a, clock


def S00_SH01(sh):
    """Audio lead-in: a deterministic, camera-visible pure-black plate."""
    look.world(sh.scene, color="#000000", strength=0.0)
    camera_data = bpy.data.cameras.new("S00_BlackCamera")
    camera = bpy.data.objects.new("S00_BlackCamera", camera_data)
    sh.cols["CAM"].objects.link(camera)
    sh.scene.camera = camera
    # No geometry, lights, compositor effects, fade, or animation.
    sh.scene.render.film_transparent = False
    sh.finish(glare=0.0, vignette=0.0, dispersion=0.0)


def S00_SH02(sh):
    a, clock = _bedroom(sh, "1:04")
    p = sh.person("TR-PLAYER-09", "home", profile="asleep")
    P.lie(p, 0.0, tuple(a["bed"] + Vector((0.35, -0.10, 0.18))), face=90.0)
    # The wrist target lands immediately above the top-button plane; small vertical travel sells the contact.
    top = clock.matrix_world.translation + Vector((0.0, 0.005, 0.098))
    P.reach(p, 0.10, "R", tuple(top + Vector((0, 0.01, 0.11))), dur=0.18, rot=(10, 0, 0))
    p.key("hand.R", 0.40, tuple(top + Vector((0, 0.01, 0.028))), "in")
    p.key("hand.R", 0.55, tuple(top + Vector((0, 0.01, 0.11))), "out")
    p.bake(); p._baked = True
    button = props.box(sh.cols["PROPS"], "S00_SnoozeButton", (0.052, 0.025, 0.008), look.flat("S00_Button", "#25272b", rough=0.38), tuple(top + Vector((0, 0, -0.002))), bevel=0.003)
    button.keyframe_insert("location", frame=1); button.location.z -= .006; button.keyframe_insert("location", frame=14); button.location.z += .006; button.keyframe_insert("location", frame=20)
    cam = sh.camera(100, fstop=2.6)
    face = clock.matrix_world.translation + Vector((0, -0.045, .050))
    cam.place(0, tuple(face + Vector((.19, -.48, .13))), tuple(face), focus=face)
    cam.place(sh.dur, tuple(face + Vector((.17, -.43, .12))), tuple(face), focus=face, e="linear")
    sh.scene["hnc_event_frame_alarm_104"] = 1
    sh.scene["hnc_clock_method"] = "physical wedge clock with emissive seven-segment display and pressed snooze button"
    sh.finish(glare=.18, threshold=1.2, vignette=.16)


def S00_SH03(sh):
    a, clock = _bedroom(sh, "1-4")
    cam = sh.camera(100, fstop=2.6)
    face = clock.matrix_world.translation + Vector((0, -0.045, .050))
    cam.place(0, tuple(face + Vector((.19, -.48, .13))), tuple(face), focus=face)
    cam.place(sh.dur, tuple(face + Vector((.17, -.43, .12))), tuple(face), focus=face, e="linear")
    sh.scene["hnc_event_frame_alarm_14"] = 1
    sh.scene["hnc_display_change"] = "hard cut composition; no animated glitch, flicker, sparks, or VFX"
    sh.finish(glare=.18, threshold=1.2, vignette=.16)


def S00_SH04(sh):
    a, _ = _bedroom(sh, "1-4")
    p = sh.person("TR-PLAYER-09", "home", profile="asleep")
    P.lie(p, 0.0, tuple(a["bed"] + Vector((0.32, -0.10, 0.18))), face=90.0)
    # One small correction toward the nightstand; blink layer remains the only other movement.
    p.key("neck", .28, (0.0, 0.0, -4.0), "soft")
    p.key("neck", .62, (0.0, 0.0, -5.5), "hold")
    P.look(p, .30, tuple(a["clock_pos"]), dur=.22, w=.74)
    head = p.char_point(0, (0, 0, p.dims["shoulder"] + .29))
    cam = sh.camera(85, fstop=2.0)
    cam.place(0, tuple(head + Vector((-.88, -.65, .18))), tuple(head + Vector((0, .03, -.03))), focus=head)
    cam.handheld("locked", .12)
    sh.scene["hnc_reaction_animation"] = "single eye/head correction toward clock; no broad reaction"
    sh.finish(glare=.08, threshold=1.4, vignette=.14)


SHOTS = {"S00_SH01": S00_SH01, "S00_SH02": S00_SH02, "S00_SH03": S00_SH03, "S00_SH04": S00_SH04}
