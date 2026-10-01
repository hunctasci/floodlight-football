"""S06 — Training: the quiet man is dangerous."""
import math

import bpy
from mathutils import Vector

from ...cine import football as F
from ...cine import look, props
from ...cine import perform as P
from ...cine.cast import prop_identity
from ...cine.perform import heading, write_tracks
from ...cine.camera import frame
from ...cine.sets import pitch as PITCH

SPOT = Vector((0.0, 0.5, 0.0))  # where he shoots from (~15.5 m out)
AIM = Vector((2.55, PITCH.GOAL_Y + 0.4, 2.05))  # the top corner


def _set(sh, goal=True):
    a = PITCH.pitch(sh.scene, sh.cols["SET"], sh.cols["LGT"], goal=goal)
    bpy.context.view_layer.update()
    return a


def _ball(sh, pos):
    b = prop_identity(sh.scene, sh.cols["PROPS"], "hnc-ball")
    b.location = pos
    return b


def _nine(sh, pos, face, t=0.0):
    p = sh.person("TR-PLAYER-09", "kit", profile="sport")
    P.stance(p, t, (pos[0], pos[1], 0.0), face)
    P.relax_arms(p, t)
    return p


def _keeper(sh, set_pos=Vector((0.0, PITCH.GOAL_Y - 0.6, 0))):
    k = sh.person("TR-PLAYER-01-GK", "kit", profile="sport")
    P.stance(k, 0.0, (set_pos.x, set_pos.y, 0.0), 0.0, width=1.4)
    k.key("hips", 0.0, (0.0, 0.0, -0.12), "hold")
    k.key("hips_rot", 0.0, (14.0, 0.0, 0.0), "hold")
    P.arms(k, 0.0, "L", 25.0, 38.0, 0.0, 40.0, e="hold")
    P.arms(k, 0.0, "R", 25.0, 38.0, 0.0, 40.0, e="hold")
    return k


def S06_SH01(sh):
    a = _set(sh, goal=False)
    face = 180.0
    p = _nine(sh, SPOT, face)
    P.kneel(p, 0.0, (SPOT.x, SPOT.y), face, e="hold", front="R")
    boot = p.char_point(0.0, (-0.2, 0.42, 0.1))
    for side, dx in (("R", -0.08), ("L", 0.08)):
        P.reach(p, 0.0, side, tuple(boot + Vector((dx, 0.0, 0.2))), dur=0.01, rot=(20.0, 0.0, 0.0))
        p.key(f"hand.{side}", 0.12, tuple(boot + Vector((dx, 0.0, 0.2))), "hold")
        p.key(f"hand.{side}", 0.32, tuple(boot + Vector((dx * 2.2, 0.0, 0.33))), "out")  # pulls tight
    p.bake()
    p._baked = True
    # laces: two white strips from the boot top to each hand, baked per frame
    lace = look.flat("Lace", "#f4f4f2", rough=0.7)
    sc = sh.scene
    tr = {}
    strips = [props.box(sh.cols["PROPS"], f"PROP_Lace{i}", (0.012, 0.012, 1.0), lace, (0, 0, 0)) for i in range(2)]
    for f in range(1, sh.frames + 1):
        sc.frame_set(f)
        for i, side in enumerate(("R", "L")):
            hb = p.rig.arm.pose.bones[f"hand.{side}"]
            h = p.rig.arm.matrix_world @ hb.head
            e = boot + Vector((0, 0, 0.06))
            d = h - e
            q = Vector((0, 0, 1)).rotation_difference(d)
            for k, v in enumerate(e):
                tr.setdefault((strips[i], "location", k), []).append(v)
            for k, v in enumerate(q.to_euler()):
                tr.setdefault((strips[i], "rotation_euler", k), []).append(v)
            tr.setdefault((strips[i], "scale", 2), []).append(d.length)
    write_tracks(tr, sh.frames)
    sc.frame_set(1)
    cam = sh.camera(100, fstop=2.8)
    frame(cam, 0.0, boot + Vector((0, 0, 0.18)), 0.6, heading=heading(SPOT, boot) + 60, el=25, headroom=False)
    cam.handheld("locked", 1.0)
    sh.finish()


def S06_SH02(sh):
    a = _set(sh)
    rest = SPOT + Vector((0.35, -0.2, F.BALL_R))
    ball = _ball(sh, rest)
    bp = F.BallPath(ball, sh.frames, sh.fps)
    # dropped from 0.3 m above: lands at 0.25 s, on the ball-land cue, inside the 0.45 s shot
    bp.rest(-1, 0.0, rest + Vector((0, 0, 0.3)))
    bp.drop(0.0, rest + Vector((0, 0, 0.3)), rest, bounces=2, e=0.42)
    bp.bake()
    cam = sh.camera(50, fstop=2.8)
    cam.place(0.0, rest + Vector((-0.6, -2.4, 0.18)), rest + Vector((0, 0, 0.35)), focus=rest)
    cam.handheld("subtle", 0.6)
    sh.finish()


def S06_SH03(sh):
    a = _set(sh)
    face = 180.0
    p = _nine(sh, SPOT, face)
    stop = SPOT + Vector((-0.22, 0.62, F.BALL_R))
    ball = _ball(sh, stop)
    bp = F.BallPath(ball, sh.frames, sh.fps)
    t_touch = 0.22
    bp.roll(0.0, t_touch, stop + Vector((2.6, 0.3, 0)), stop + Vector((0.12, 0.02, 0)), ease="linear")
    bp.roll(t_touch, t_touch + 0.25, stop + Vector((0.12, 0.02, 0)), stop, ease="out")
    bp.rest(t_touch + 0.25, 9, stop)
    bp.bake()
    F.touch(p, t_touch, "L", stop + Vector((0.1, 0, -F.BALL_R)))
    p.key("hips_rot", t_touch, (6.0, 0.0, -8.0), "soft")
    cam = sh.camera(35, fstop=2.8)
    frame(cam, 0.0, stop + Vector((0, 0, 0.3)), 1.5, heading=-35, el=6, headroom=False, focus=stop)
    cam.handheld("subtle", 0.8)
    sh.finish()


def S06_SH04(sh):
    a = _set(sh)
    y = 4.0
    p = _nine(sh, (-9.0, y), 90.0, t=-1.0)  # pre-roll: keyed before the cut
    # pre-roll: he is already at speed when the shot starts
    P.walk(p, -1.0, [(6.0, y)], stride=1.25, cadence=3.2, style="sprint", lead="R", end_face=90.0)
    ball = _ball(sh, (0, y, F.BALL_R))
    bp = F.BallPath(ball, sh.frames, sh.fps)
    xs = [(p.ch["pos"].at(t)[0] + 1.3) for t in (0.0, sh.dur)]
    bp.roll(-1, sh.dur + 0.1, (xs[0], y - 0.15, F.BALL_R), (xs[1] + 0.4, y - 0.15, F.BALL_R), ease="linear")
    bp.bake()
    cam = sh.camera(85, fstop=2.2)
    for t in (0.0, sh.dur * 0.5, sh.dur):
        x = p.ch["pos"].at(t)[0]
        cam.place(t, (x - 0.6, y - 9.5, 0.55), (x + 0.5, y, 1.0), focus=(x, y, 1.0), e="linear")
    cam.handheld("follow", 0.8)
    sh.finish()


def S06_SH05(sh):
    a = _set(sh)
    pos = Vector((1.0, 2.0, 0))
    p = _nine(sh, pos, 180.0)
    b0 = pos + Vector((0.1, 0.75, F.BALL_R))
    ball = _ball(sh, b0)
    # drag-back: sole on the ball, pull it behind, spin away
    p.key("foot.R", 0.05, tuple(b0 + Vector((0.0, -0.05, 0.08))), "soft")
    p.key("foot_rot.R", 0.05, (180.0, 15.0), "soft")
    p.key("foot.R", 0.32, tuple(pos + Vector((-0.2, 0.15, p.dims["ankle"] + 0.05))), "out")
    p.key("foot.R", 0.45, tuple(pos + Vector((-0.2, 0.05, p.dims["ankle"]))), "soft")
    p.key("face", 0.3, 180.0, "hold")
    p.key("face", 0.65, 250.0, "out")
    p.key("hips_rot", 0.15, (10.0, 6.0, 0.0), "soft")
    p.key("hips_rot", 0.5, (8.0, -8.0, 20.0), "out")
    P.arms(p, 0.3, "L", 10.0, 45.0, 0.0, 30.0)
    P.arms(p, 0.3, "R", -10.0, 40.0, 0.0, 30.0)
    bp = F.BallPath(ball, sh.frames, sh.fps)
    bp.rest(-1, 0.1, b0)
    bp.roll(0.1, 0.42, b0, pos + Vector((-0.35, 0.05, F.BALL_R)), ease="out")
    bp.roll(0.55, sh.dur, pos + Vector((-0.35, 0.05, F.BALL_R)), pos + Vector((-1.2, -0.4, F.BALL_R)), ease="out")
    bp.bake()
    cam = sh.camera(50, fstop=2.8)
    cam.place(0.0, pos + Vector((2.2, -2.6, 1.1)), pos + Vector((0, 0.3, 0.7)), focus=pos + Vector((0, 0.3, 0.8)))
    cam.handheld("follow", 0.9)
    sh.finish()


def S06_SH06(sh):
    a = _set(sh)
    face = heading(SPOT, AIM)
    p = _nine(sh, SPOT - Vector((0, 0.55, 0)), face)
    ball = _ball(sh, SPOT + Vector((0, 0.1, F.BALL_R)))
    p.key("neck", 0.0, (22.0, 0.0, 0.0), "hold")  # over the ball
    la, lb = sh.line("L18")
    sh.talk(p, "L18", amount=0.5)
    p.key("neck", 0.35, (22.0, 0.0, 0.0), "hold")
    p.key("neck", 0.75, (-2.0, 0.0, 0.0), "soft")  # looks up at the goal
    P.look(p, 0.4, a["goal_mouth"], w=0.6, dur=0.4, eyes_lead=0.1)
    p.key("breath_amp", 0.0, 1.4, "hold")
    head = p.char_point(0.0, (0, 0, 1.7))
    cam = sh.camera(85, fstop=2.0)
    cam.place(0.0, head + Vector((1.8, 2.9, -0.15)), head + Vector((0, 0, -0.1)))
    cam.place(sh.dur, head + Vector((1.6, 2.6, -0.14)), head + Vector((0, 0, -0.08)), e="linear")
    cam.handheld("subtle", 0.7)
    sh.finish()


def S06_SH07(sh):
    a = _set(sh)
    face = heading(SPOT, AIM)
    p = _nine(sh, SPOT - Vector((0.3, 0.9, 0)), face)
    ball = _ball(sh, SPOT + Vector((0, 0.1, F.BALL_R)))
    k = _keeper(sh)
    k.key("hips", sh.dur - 0.8, (0.0, 0.0, 0.0), "hold")
    k.key("hips", sh.dur - 0.45, (0.0, 0.0, -0.16), "soft")  # the keeper sets, just before the strike
    p.key("breath_amp", 0.0, 1.6, "hold")
    P.look(p, 0.0, a["goal_mouth"], w=0.7, dur=0.01, eyes_lead=0)
    cam = sh.camera(135, fstop=2.8)
    cam.place(0.0, (-0.9, -10.5, 1.85), (0.0, 8.0, 1.2), focus=SPOT + Vector((0, -0.9, 1.5)))
    cam.handheld("locked", 1.5)
    sh.finish()


def S06_SH08(sh):
    a = _set(sh)
    face = heading(SPOT, AIM)
    d = (AIM - SPOT)
    d.z = 0
    d.normalize()
    bpos = SPOT + Vector((0, 0.1, F.BALL_R))
    p = _nine(sh, bpos - d * 1.3, face)
    t_hit = 0.5
    F.strike(p, t_hit, bpos, d, side="R")
    ball = _ball(sh, bpos)
    bp = F.BallPath(ball, sh.frames, sh.fps)
    bp.rest(-1, t_hit, bpos)
    bp.flight(t_hit, t_hit + 0.55, bpos, AIM, apex=0.6)
    bp.bake()
    cam = sh.camera(35, fstop=2.2)
    frame(cam, 0.0, bpos + Vector((0, -0.45, 0.85)), 2.6, heading=heading(bpos, AIM) - 110, el=3, headroom=False, focus=bpos)
    from ...cine.camera import impact
    impact(cam, t_hit, 0.9, 0.2)
    cam.handheld("locked", 1.0)
    sh.finish()


def S06_SH09(sh):
    a = _set(sh)
    k = _keeper(sh)
    # the keeper's late dive to his left
    k.key("pos", 0.05, (0.0, PITCH.GOAL_Y - 0.6, 0.0), "hold")
    k.key("pos", 0.45, (1.6, PITCH.GOAL_Y - 0.7, 0.35), "out")
    k.key("tilt", 0.05, (0.0, 0.0), "hold")
    k.key("tilt", 0.45, (0.0, 70.0), "out")
    P.arms(k, 0.25, "L", 10.0, 150.0, 0.0, 10.0, e="out")
    P.arms(k, 0.25, "R", 10.0, 150.0, 0.0, 10.0, e="out")
    for s in "LR":
        k.key(f"ik_foot.{s}", 0.1, 0.0, "soft")
    ball = _ball(sh, AIM)
    t_net = 0.12
    start = AIM - (AIM - SPOT).normalized() * 3.5
    bp = F.BallPath(ball, sh.frames, sh.fps)
    bp.flight(-0.1, t_net, start, AIM, apex=0.1)
    bp.roll(t_net, t_net + 0.15, AIM, AIM + Vector((-0.2, 0.55, -0.3)), ease="out")
    bp.drop(t_net + 0.15, AIM + Vector((-0.2, 0.55, -0.3)), Vector((AIM.x - 0.3, PITCH.GOAL_Y + 0.9, F.BALL_R)), bounces=2)
    bp.bake()
    PITCH.net_bulge(sh.cols["FX"], a["net"], sh.frames, sh.fps, t_net, AIM + Vector((0, 0.6, 0)), depth=0.5)
    cam = sh.camera(35, fstop=4.0)
    cam.place(0.0, (AIM.x + 2.4, PITCH.GOAL_Y + 3.4, 1.0), (AIM.x - 0.6, PITCH.GOAL_Y - 1.0, 1.5), focus=AIM + Vector((0, 0.5, 0)))
    from ...cine.camera import impact
    impact(cam, t_net, 0.6, 0.25)
    cam.handheld("locked", 1.0)
    sh.finish()


def S06_SH10(sh):
    a = _set(sh)
    face = heading(SPOT, AIM)
    at = SPOT + Vector((0.6, 1.4, 0))
    p = _nine(sh, at, face)
    k = sh.person("TR-PLAYER-01-GK", "kit", profile="sport")
    P.lie(k, 0.0, (1.8, PITCH.GOAL_Y - 0.9, 0.35))
    k.key("tilt", 0.0, (-90.0, 0.0), "hold")
    k.key("face", 0.0, 100.0, "hold")
    # he turns away: no celebration, just breath
    P.walk(p, 0.15, [(at.x - 0.5, at.y - 1.6)], stride=0.6, lead="L")
    p.key("breath_amp", 0.0, 1.8, "hold")
    p.key("neck", 0.4, (6.0, 0.0, 0.0), "soft")
    cam = sh.camera(85, fstop=2.8)
    cam.place(0.0, at + Vector((3.2, -9.5, 1.3)), at + Vector((0.0, 3.0, 1.1)), focus=at + Vector((0, 0, 1.2)))
    cam.place(sh.dur, at + Vector((3.1, -9.2, 1.3)), at + Vector((-0.2, 2.5, 1.1)), focus=at + Vector((-0.3, -0.8, 1.2)))
    cam.handheld("subtle", 0.8)
    sh.finish()


SHOTS = {f"S06_SH{i:02d}": globals()[f"S06_SH{i:02d}"] for i in range(1, 11)}
