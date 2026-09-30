"""S07 — Recovery: not now (and then, obviously, now)."""
import math

import bpy
from mathutils import Vector

from ...cine import football as F
from ...cine import props
from ...cine import perform as P
from ...cine.camera import frame
from ...cine.cast import prop_identity
from ...cine.perform import heading, write_tracks
from ...cine.sets import home


def _set(sh, time="afternoon"):
    a = home.living(sh.scene, sh.cols["SET"], sh.cols["LGT"], time)
    bpy.context.view_layer.update()
    return a


def _resting(sh, a):
    """#9 on the sofa, head back, one leg out, ice on the right knee, phone face-down."""
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    s = a["seat_r"]
    P.sit(p, 0.0, (s.x, s.y, 0.0), face=0.0, seat_h=0.36, feet_fwd=0.5, lean=-12.0, e="hold")
    p.key("foot.R", 0.0, tuple(p.char_point(0.0, (-0.25, 0.85, p.dims["ankle"]))), "hold")  # leg out
    P.arms(p, 0.0, "L", 20.0, 22.0, 0.0, 30.0, e="hold")
    P.arms(p, 0.0, "R", 25.0, 14.0, 0.0, 45.0, e="hold")
    p.key("neck", 0.0, (-14.0, 0.0, 6.0), "hold")  # head back on the cushion
    p.key("lid.L", 0.0, 0.35, "hold")
    p.key("lid.R", 0.0, 0.35, "hold")
    p.prof.update(breath=1.3)
    ice = props.ice_pack(sh.cols["PROPS"], "PROP_Ice", (0, 0, 0))
    phone = props.phone(sh.cols["PROPS"], "PROP_Phone", tuple(a["table"] + Vector((0.2, -0.05, 0.005))), rot=(0, 0, 20), face_down=True)
    return p, ice


def _place_ice(sh, p, ice):
    """Seat the ice pack on the knee at frame 1, then let it ride on the shin bone."""
    p.bake()
    p._baked = True
    sh.scene.frame_set(1)
    arm = p.rig.arm
    knee = arm.matrix_world @ arm.pose.bones["shin.R"].head
    ice.location = knee + Vector((0, -0.02, 0.1))
    bpy.context.view_layer.update()
    p.holds = [(ice, "bone:shin.R", 0.0, 99.0, None)]
    p.bake_holds()


def S07_SH01(sh):
    a = _set(sh)
    p, ice = _resting(sh, a)
    _place_ice(sh, p, ice)
    cam = sh.camera(28, fstop=4.0)
    frame(cam, 0.0, a["sofa"] + Vector((0.2, 0, 0.9)), "WS", heading=-20, el=8, headroom=False)
    cam.handheld("locked", 1.0)
    sh.finish()


def _child_with_ball(sh, a, start, face):
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="child")
    P.stance(k, 0.0, (start.x, start.y, 0.0), face)
    ball = prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    return k, ball


def S07_SH02(sh):
    a = _set(sh)
    p, ice = _resting(sh, a)
    start = Vector((-2.4, 0.2, 0))
    k, ball = _child_with_ball(sh, a, start, heading(start, a["seat_l"]))
    carry = k.char_point(0.0, (0, 0.34, 0.62))
    ball.location = carry
    bpy.context.view_layer.update()
    for s_, dx in (("L", 0.2), ("R", -0.2)):
        P.reach(k, 0.0, s_, tuple(k.char_point(0.0, (dx, 0.3, 0.55))), dur=0.01)
    k.hold_prop(ball, "R", 0.02, 0.95)
    stop = a["seat_l"] + Vector((-0.2, -0.75, 0))
    t = P.walk(k, 0.05, [(stop.x, stop.y)], stride=0.36, cadence=2.3, style="child", end_face=heading(stop, a["seat_l"]), arms_swing=False)
    # hands ride with the body while walking: re-key the IK targets relative to the child
    for tt in [x / 10 for x in range(0, 9)]:
        for s_, dx in (("L", 0.2), ("R", -0.2)):
            k.key(f"hand.{s_}", tt, tuple(k.char_point(tt, (dx, 0.3, 0.55))), "linear")
    place = a["seat_l"] + Vector((0.05, 0.05, 0.36 + F.BALL_R))
    for s_, dx in (("L", 0.2), ("R", -0.2)):
        k.key(f"hand.{s_}", 0.95, tuple(place + Vector((dx * 0.9, -0.05, 0.02))), "soft")
    P.release(k, 1.0, "L")
    P.release(k, 1.0, "R")
    k.key("hips_rot", 0.9, (18.0, 0.0, 0.0), "soft")
    k.key("hips_rot", 1.3, (0.0, 0.0, 0.0), "soft")
    P.look(k, 1.1, p.char_point(0.0, (0, 0, 1.3)), w=0.9, dur=0.3)
    la, lb = sh.line("L19")
    p.key("lid.R", la - 0.2, 0.35, "hold")
    p.key("lid.R", la, 0.55, "soft")  # one eye, again
    _place_ice(sh, p, ice)
    k.bake()
    k._baked = True
    # the ball stays on the sofa once released
    sc = sh.scene
    sc.frame_set(sh.frames)
    cam = sh.camera(35, fstop=2.8)
    frame(cam, 0.0, a["sofa"] + Vector((-0.3, -0.3, 0.9)), "MWS", heading=-35, el=6, headroom=False)
    cam.handheld("locked", 1.0)
    sh.finish()


def S07_SH03(sh):
    a = _set(sh)
    stop = Vector((-0.95, 0.5, 0))  # he has stepped back to stare
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="still")
    P.stance(k, 0.0, (stop.x, stop.y, 0.0), heading(stop, a["seat_r"]))
    P.relax_arms(k, 0.0)
    P.look(k, 0.0, a["seat_r"] + Vector((0, 0, 1.25)), w=0.9, dur=0.01, eyes_lead=0)
    k.blink_avoid.append((0, 9))  # he does not blink
    head = Vector((stop.x, stop.y, 1.0))
    # #9's POV from the sofa, seated eye height
    cam = sh.camera(35, fstop=2.0)
    cam.place(0.0, a["seat_r"] + Vector((0, -0.05, 1.22)), head + Vector((0, 0, -0.12)), focus=head)
    cam.handheld("locked", 1.0)
    sh.finish()


def S07_SH04(sh):
    a = _set(sh)
    nine_at = Vector((0.9, -0.35, 0))
    kid_at = Vector((-1.2, -0.1, 0))
    p = sh.person("TR-PLAYER-09", "home", profile="calm")
    P.stance(p, 0.0, (nine_at.x, nine_at.y, 0.0), heading(nine_at, kid_at))
    P.relax_arms(p, 0.0)
    k = sh.person("TR-FAMILY-CHILD-01", "kit", profile="child")
    P.stance(k, 0.0, (kid_at.x, kid_at.y, 0.0), heading(kid_at, nine_at))
    ball = prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    R = F.BALL_R
    b0 = kid_at + Vector((0.45, -0.05, R))
    t_kick, t_ctrl, t_flick = 0.12, 0.5, 0.7
    # the child's little pass
    k.key("foot.R", t_kick - 0.12, tuple(k.ch["foot.R"].at(0)), "hold")
    k.key("foot.R", t_kick, tuple(b0 + Vector((-0.2, 0, -R + k.dims["ankle"]))), "in")
    k.key("foot.R", t_kick + 0.2, tuple(k.ch["foot.R"].at(0)), "soft")
    ctrl = nine_at + Vector((-0.45, 0.05, R))
    F.touch(p, t_ctrl, "L", ctrl + Vector((0, 0, -R)))
    # the flick — a touch too much: toward the lamp
    lamp = a["lamp"].matrix_world.translation
    p.key("foot.R", t_flick - 0.1, tuple(p.ch["foot.R"].at(0)), "hold")
    p.key("foot.R", t_flick, tuple(ctrl + Vector((0.1, 0.1, -R + p.dims["ankle"] + 0.12))), "in")
    p.key("foot.R", t_flick + 0.25, tuple(p.ch["foot.R"].at(0)), "soft")
    bp = F.BallPath(ball, sh.frames, sh.fps)
    bp.rest(-1, t_kick, b0)
    bp.roll(t_kick, t_ctrl, b0, ctrl, ease="out")
    bp.rest(t_ctrl, t_flick, ctrl)
    hit = lamp + Vector((-0.15, -0.1, 0.35))
    bp.flight(t_flick, t_flick + 0.28, ctrl, hit, apex=0.5)
    bp.drop(t_flick + 0.28, hit, lamp + Vector((-0.5, -0.4, R)), bounces=2, e=0.4)
    bp.bake()
    # the lamp wobbles on its base (no fall — near miss)
    tr = {}
    L = a["lamp"]
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps - (t_flick + 0.28)
        w = 0.0 if t < 0 else 9.0 * math.exp(-3.2 * t) * math.sin(t * 14)
        tr.setdefault((L, "rotation_euler", 1), []).append(math.radians(w))
    write_tracks(tr, sh.frames)
    P.look(p, t_flick + 0.1, hit, w=0.8, dur=0.2, eyes_lead=0.05)
    P.look(k, t_flick + 0.1, hit, w=0.8, dur=0.25, eyes_lead=0.05)
    cam = sh.camera(24, fstop=4.0)
    frame(cam, 0.0, (nine_at + kid_at) * 0.5 + Vector((0.3, 0.5, 1.0)), "WS", heading=-10, el=10, headroom=False)
    cam.handheld("follow", 0.9)
    sh.finish()


def S07_SH05(sh):
    a = _set(sh)
    nine_at = Vector((0.9, -0.35, 0))
    p = sh.person("TR-PLAYER-09", "home", profile="still")
    face = heading(nine_at, (-1.2, -0.1))
    P.stance(p, 0.0, (nine_at.x, nine_at.y, 0.0), face)
    # frozen mid-move: right leg still up, arms out, then only the eyes move
    p.key("foot.R", 0.0, tuple(p.char_point(0.0, (-0.22, 0.25, p.dims["ankle"] + 0.18))), "hold")
    P.arms(p, 0.0, "L", 30.0, 45.0, 0.0, 25.0, e="hold")
    P.arms(p, 0.0, "R", -15.0, 35.0, 0.0, 20.0, e="hold")
    p.key("hips_rot", 0.0, (4.0, -4.0, 8.0), "hold")
    p.prof.update(breath=0.2, drift=0.05)
    p.key("drift_amp", 0.0, 0.1, "hold")
    P.glance(p, 0.35, -0.9, 0.0, dur=0.12, hold=None)  # eyes slide toward the kitchen, nothing else moves
    head = p.char_point(0.0, (0, 0, 1.7))
    cam = sh.camera(35, fstop=2.8)
    frame(cam, 0.0, head + Vector((0, 0, -0.35)), "MS", heading=face - 30, el=3)
    cam.handheld("locked", 1.0)
    sh.finish()


SHOTS = {f"S07_SH{i:02d}": globals()[f"S07_SH{i:02d}"] for i in range(1, 6)}
