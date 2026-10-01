"""S03 — Breakfast: eggs, and coffee (absurdly)."""
import math

import bpy
from mathutils import Euler, Vector

from ...cine import look, props
from ...cine import perform as P
from ...cine.perform import write_tracks
from ...cine.sets import home


def _kitchen(sh, time="morning"):
    a = home.kitchen(sh.scene, sh.cols["SET"], sh.cols["LGT"], time)
    bpy.context.view_layer.update()
    return a


def _cook(sh, a, look_id="home"):
    p = sh.person("TR-PLAYER-09", look_id, profile="calm")
    c = a["cook"]
    P.stance(p, 0.0, (c.x, c.y, 0.0), 0.0)
    P.relax_arms(p, 0.0)
    return p


def _partner_back(sh, a, pos=(-2.35, 1.35), face=180.0):
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    P.stance(q, 0.0, (pos[0], pos[1], 0.0), face)
    P.arms(q, 0.0, "L", 35.0, 8.0, 0.0, 70.0)
    P.arms(q, 0.0, "R", 30.0, 8.0, 0.0, 65.0)
    return q


def _pan_hand(p, a, side="R"):
    """Hand on the pan handle (world point of the handle end)."""
    h = a["pan"].matrix_world @ Vector((0.13 + 0.16, 0, 0.05))
    P.reach(p, 0.0, side, tuple(h + Vector((0, 0, 0.05))), dur=0.01, rot=(-20.0, 0.0, 0.0))


def _follow(sh, p, side, objs_offsets):
    """Key objects to ride the end of an arm (HNC arms end in the 'hand': no fingers), per frame,
    after the performer is baked. ``objs_offsets`` = [(obj, world offset from the arm tip)]."""
    arm = p.rig.arm
    tracks = {}
    for f in range(1, sh.frames + 1):
        sh.scene.frame_set(f)
        tip = arm.matrix_world @ arm.pose.bones[f"hand.{side}"].tail
        for o, off in objs_offsets:
            for i, v in enumerate(tip + Vector(off)):
                tracks.setdefault((o, "location", i), []).append(v)
    write_tracks(tracks, sh.frames)
    sh.scene.frame_set(1)


def S03_SH01(sh):
    """ECU: his hand taps an egg on the pan rim, the halves open, the egg drops into hot oil.
    The fried egg is two separate objects (no parent scaling — the v2 yolk spiked)."""
    a = _kitchen(sh)
    c = sh.cols
    pan = a["pan"]
    centre = pan.matrix_world @ Vector((0, 0, 0.012))
    oil = look.flat("Oil", "#e9c46a", rough=0.02, coat=1.0, alpha=0.35)
    props.cyl(c["PROPS"], "PROP_Oil", 0.11, 0.002, oil, tuple(centre + Vector((0, 0, -0.004))), segs=32)
    p = _cook(sh, a)
    # HNC arms are short: from where he stands the rim is out of reach, so he leans in from the
    # hips over the stove (the set stays exactly as in SH02). The reach is verified after baking.
    p.key("hips_rot", 0.0, (27.0, 0.0, 0.0), "hold")
    p.key("chest", 0.0, (16.0, 0.0, 0.0), "hold")
    _pan_hand(p, a, "R")
    # tap on the point of the rim nearest his left shoulder
    d = p.dims
    shoulder = p.char_point(0.0, (abs(d["hand_x"]["L"]) * 0.85, 0.0, d["shoulder"]))
    to_cook = Vector((shoulder.x - centre.x, shoulder.y - centre.y, 0)).normalized()
    rim = centre + to_cook * 0.12 + Vector((0, 0, 0.036))
    above = centre + to_cook * 0.02 + Vector((0, 0, 0.1))
    # The IK target is the wrist; the arm tip is the hand bone's length below it, and the egg
    # sits just under the tip. Keys below are written as egg-centre positions.
    off = Vector((0.0, -0.03, -0.05))  # just under and in front of the arm block, so the egg reads
    grip = -off + Vector((0, 0, p.rig.arm.pose.bones["hand.L"].length))
    rest = Vector((0, 0, 0.027))  # lying on its side, the egg's centre sits this high over the rim
    t_tap, t_open, t_drop, t_land = 0.45, 0.6, 0.72, 0.84
    P.reach(p, 0.0, "L", tuple(rim + rest + grip + Vector((0, 0, 0.12))), dur=0.01)
    p.key("hand.L", 0.34, tuple(rim + rest + grip + Vector((0, 0, 0.04))), "soft")
    p.key("hand.L", t_tap, tuple(rim + rest + grip), "in")  # tap
    p.key("hand.L", t_tap + 0.08, tuple(rim + rest + grip + Vector((0, 0, 0.03))), "out")
    p.key("hand.L", t_open, tuple(above + grip), "soft")
    p.key("hand.L", 1.15, tuple(above + grip + Vector((0, 0, 0.01))), "soft")
    p.key("hand.L", 1.7, tuple(above + grip + to_cook * 0.35 + Vector((0, 0, 0.42))), "soft")  # away, out of frame
    P.look(p, 0.0, centre, w=0.8, dur=0.01, eyes_lead=0)
    p.bake()
    p._baked = True
    sh.scene.frame_set(int(round(t_tap * sh.fps)) + 1)
    arm = p.rig.arm
    tip = arm.matrix_world @ arm.pose.bones["hand.L"].tail
    miss = (tip + off - (rim + rest)).length
    if miss > 0.03:
        pb = arm.pose.bones
        sh_w = arm.matrix_world @ pb["upperarm.L"].head
        chain = pb["upperarm.L"].length + pb["forearm.L"].length + pb["hand.L"].length
        tgt = Vector(p.ch["hand.L"].at(t_tap))
        raise RuntimeError(f"S03_SH01: the egg misses the pan rim by {miss * 100:.0f} cm at the tap: tip {tuple(round(v, 3) for v in tip)} "
                           f"rim {tuple(round(v, 3) for v in rim)} target {tuple(round(v, 3) for v in tgt)} ik_target_obj "
                           f"{tuple(round(v, 3) for v in p.rig.c['hand.L'].matrix_world.translation)} shoulder {tuple(round(v, 3) for v in sh_w)} "
                           f"chain {chain:.3f} dist {(tgt - sh_w).length:.3f} ik_w {p.ch['ik_hand.L'].at(t_tap):.2f}")
    sh.scene.frame_set(1)
    # the egg: whole until the tap, then two halves that open like a book toward the lens
    egg = props.egg_whole(c["PROPS"], "PROP_Egg", (0, 0, 0))
    egg.rotation_euler = (0.0, math.radians(90), math.radians(15))
    pivot, bottom, top = props.egg_halves(c["PROPS"], "PROP_EggShell", (0, 0, 0))
    pivot.rotation_euler = egg.rotation_euler
    _follow(sh, p, "L", [(egg, tuple(off)), (pivot, tuple(off))])
    white, yolk = props.egg_fried(c["PROPS"], "PROP_EggFried", tuple(centre + Vector((0.01, 0, 0.0))), seed=3)
    y_rest = yolk.location.copy()
    tracks = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        tracks.setdefault((egg, "hide_render", 0), []).append(0.0 if t < t_open else 1.0)
        for o in (bottom, top):
            tracks.setdefault((o, "hide_render", 0), []).append(1.0 if t < t_open else 0.0)
        u = max(0.0, min(1.0, (t - t_open) / 0.16))
        ang = math.radians(58) * (1 - (1 - u) ** 2)
        tracks.setdefault((bottom, "rotation_euler", 1), []).append(-ang)
        tracks.setdefault((top, "rotation_euler", 1), []).append(ang)
        tracks.setdefault((bottom, "location", 2), []).append(-0.006 * u)
        tracks.setdefault((top, "location", 2), []).append(0.006 * u)
        # the yolk falls from the crack (gravity), lands with a small squash; the white spreads around it
        sh.scene.frame_set(f)
        start = pivot.matrix_world.translation
        if t < t_drop:
            pos, sz, hide = start, 0.62, 1.0
        elif t < t_land:
            w = (t - t_drop) / (t_land - t_drop)
            pos, sz, hide = start.lerp(y_rest, w * w), 0.75, 0.0
        else:
            k = t - t_land
            pos, sz, hide = y_rest, 0.62 - 0.14 * math.exp(-k * 18) * math.cos(k * 30), 0.0
        for i, v in enumerate(pos):
            tracks.setdefault((yolk, "location", i), []).append(v)
        tracks.setdefault((yolk, "scale", 2), []).append(sz)
        tracks.setdefault((yolk, "hide_render", 0), []).append(hide)
        spread = 0.0 if t < t_land - 0.02 else min(1.0, 0.3 + 0.7 * (1 - math.exp(-(t - t_land) * 9)))
        for i in (0, 1):
            tracks.setdefault((white, "scale", i), []).append(max(0.001, spread))
        tracks.setdefault((white, "hide_render", 0), []).append(1.0 if spread <= 0 else 0.0)
    sh.scene.frame_set(1)
    write_tracks(tracks, sh.frames)
    cam = sh.camera(100, fstop=3.2)
    # high and steep: the arm enters from the top of frame, his (leaning) head stays out of it
    cam.place(0.0, centre + Vector((0.38, -0.95, 0.98)), centre - to_cook * 0.04 + Vector((0, 0, -0.03)), focus=centre + Vector((0, 0, 0.03)))
    cam.place(sh.dur, centre + Vector((0.33, -0.82, 0.86)), centre - to_cook * 0.05 + Vector((0, 0, -0.03)), focus=centre + Vector((0, 0, 0.02)), e="linear")
    cam.handheld("locked", 1.0)
    sh.finish(glare=0.5, threshold=0.8)


def S03_SH02(sh):
    a = _kitchen(sh)
    p = _cook(sh, a)
    _pan_hand(p, a, "R")
    q = _partner_back(sh, a)
    pan_c = a["pan"].matrix_world.translation
    P.look(p, 0.0, pan_c, w=0.85, dur=0.01, eyes_lead=0)
    p.key("chest", 0.0, (8.0, 0.0, 0.0), "hold")
    la, lb = sh.line("L07")
    P.nod(p, la + 0.05, depth=3.0, dur=0.35)
    sh.talk(p, "L07", amount=0.6)
    ta, tb = sh.card(1)  # Q: THAT'S IT?
    # the pan gets a small shake while he waits (the answer really is just eggs)
    h = a["pan"].matrix_world @ Vector((0.29, 0, 0.1))
    p.key("hand.R", ta + 0.3, tuple(h + Vector((0.0, 0.0, 0.0))), "soft")
    p.key("hand.R", ta + 0.45, tuple(h + Vector((0.0, -0.03, 0.0))), "soft")
    p.key("hand.R", ta + 0.62, tuple(h), "soft")
    cam = sh.camera(35, fstop=2.8)
    c = a["cook"]
    cam.place(0.0, (c.x + 0.55, -2.25, 1.62), (c.x + 0.05, c.y, 1.18), focus=(c.x, c.y - 0.3, 1.5))
    cam.place(sh.dur, (c.x + 0.45, -2.15, 1.6), (c.x + 0.05, c.y, 1.18), focus=(c.x, c.y - 0.3, 1.5), e="linear")
    cam.handheld("observational", 1.0)
    sh.finish()


def _stream(sh, carafe, mug, t0, t1):
    """Coffee stream from the carafe spout to the mug while pouring (baked per frame)."""
    st = props.cyl(sh.cols["PROPS"], "PROP_Stream", 0.006, 1.0, look.flat("StreamCoffee", "#2a1406", rough=0.05, coat=1.0), (0, 0, 0), segs=10, r2=0.0045)
    tracks = {}
    sc = sh.scene
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        sc.frame_set(f)
        spout = carafe.matrix_world @ Vector((0.062, 0, 0.2))
        target = mug.matrix_world @ Vector((0, 0, 0.08))
        on = t0 <= t <= t1
        down = Vector((spout.x, spout.y, target.z))
        L = max(0.01, spout.z - target.z)
        for i, v in enumerate(down):
            tracks.setdefault((st, "location", i), []).append(v)
        for i, v in enumerate((1.0, 1.0, L)):
            tracks.setdefault((st, "scale", i), []).append(v)
        tracks.setdefault((st, "hide_render", 0), []).append(0.0 if on else 1.0)
    write_tracks(tracks, sh.frames)
    sc.frame_set(1)


def _carafe_pose(car, base0, mug_top, t, t_up, t_tilt, t_stop, t_down, tilt=52.0):
    """World pose of the carafe: lifted toward the mug, spout (+X) yawed at the mug, tipped
    about its own Y so the spout dips (v2 drove this from a hand roll: it spun toward the lens)."""
    d = Vector((mug_top.x - base0.x, mug_top.y - base0.y, 0))
    yaw = math.atan2(d.y, d.x)
    spout = Vector((0.062, 0.0, 0.2))

    def ease(u):
        u = max(0.0, min(1.0, u))
        return u * u * (3 - 2 * u)

    up = ease((t - 0.05) / (t_up - 0.05)) * (1 - ease((t - t_stop) / (t_down - t_stop)))
    th = math.radians(tilt) * ease((t - t_up) / (t_tilt - t_up)) * (1 - ease((t - t_stop) / 0.4))
    rot = Euler((0.0, th, yaw), "XYZ")
    # at full tilt the spout sits 6 cm over the mug's rim; in between, slide from the counter
    over = mug_top + Vector((0, 0, 0.06)) - rot.to_matrix() @ spout
    pos = base0.lerp(over, up)
    return pos, rot


def S03_SH03(sh):
    """And coffee. He pours and keeps pouring; she slides the mug away and walks off with it;
    his eyes follow the cup; the carafe comes down. The carafe leads, his hand follows its handle."""
    a = _kitchen(sh)
    p = _cook(sh, a)
    car, mug = a["carafe"], a["mug"]
    sh.talk(p, "L09", amount=0.7)
    base0 = car.matrix_world.translation.copy()
    mpos = mug.matrix_world.translation.copy()
    mug_top = mpos + Vector((0, 0, 0.095))
    t_up, t_tilt, t_take = 0.45, 0.62, 2.05
    t_stop, t_down = t_take + 0.15, t_take + 2.6
    handle_local = Vector((-0.085, 0, 0.11))
    tr = {}
    car.rotation_mode = "XYZ"
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        pos, rot = _carafe_pose(car, base0, mug_top, t, t_up, t_tilt, t_stop, t_down)
        for i, v in enumerate(pos):
            tr.setdefault((car, "location", i), []).append(v)
        for i, v in enumerate(rot):
            tr.setdefault((car, "rotation_euler", i), []).append(v)
        if f % 3 == 1 or f == sh.frames:  # the hand rides the handle
            h = pos + rot.to_matrix() @ handle_local
            p.key("hand.R", t, tuple(h), "linear")
    write_tracks(tr, sh.frames)
    p.key("ik_hand.R", 0.0, 1.0, "hold")
    p.key("hand_rot.R", 0.0, (0.0, 0.0, -90.0), "hold")
    P.look(p, 0.0, mpos, w=0.7, dur=0.01, eyes_lead=0)
    # mug fills while he pours (coffee disc rises)
    cof = next(o for o in mug.children if "Coffee" in o.name)
    cof.location.z = 0.02
    tr = {}
    for f in range(1, sh.frames + 1):
        t = (f - 1) / sh.fps
        u = max(0.0, min(1.0, (t - 0.6) / 1.4))
        tr.setdefault((cof, "location", 2), []).append(0.02 + (0.092 - 0.02) * u)
    write_tracks(tr, sh.frames)
    # the partner walks in from frame right to stand beside him, leans in and takes the mug with her
    # right hand (v2 stopped her ~1.1 m away: the auto-grip then swung the mug around her far hand)
    q = sh.person("TR-FAMILY-PARTNER-01", "home", profile="calm")
    start = Vector((1.05, 1.0, 0.0))
    P.stance(q, 0.0, tuple(start), -90.0)
    P.relax_arms(q, 0.0)
    # shoulder to shoulder with him, facing the island like he does (HNC bodies are wide: her right
    # arm is then on his side, and the lean covers the rest of the reach)
    beside = (a["cook"].x + 1.05, 1.02)
    t_there = P.walk(q, 0.0, [beside], lead="R", end_face=0.0, stride=0.56)
    # she reaches as she arrives (the grab stays on the edit's cup-scrape cue)
    assert t_there < t_take - 0.15, f"S03_SH03: she arrives at {t_there:.2f}s, too late for the take"
    q.key("hips_rot", t_take - 0.35, (0.0, 0.0, 0.0), "hold")
    q.key("hips_rot", t_take - 0.02, (20.0, 0.0, 0.0), "soft")  # leans in
    grab = mpos + Vector((0.0, 0.0, 0.06))
    P.reach(q, t_take - 0.32, "R", tuple(grab + Vector((0.0, 0.0, 0.13))), dur=0.2)
    q.key("hand.R", t_take, tuple(grab + Vector((0.0, 0.0, 0.1))), "soft")
    q.hold_prop(mug, "R", t_take, 99.0)
    q.key("hand.R", t_take + 0.35, tuple(grab + Vector((0.12, 0.12, 0.3))), "soft")
    q.key("hips_rot", t_take + 0.4, (0.0, 0.0, 0.0), "soft")
    t_go = t_take + 0.7
    exit_to = (2.4, 1.0)
    t_out = P.walk(q, t_go, [exit_to], lead="L", end_face=P.heading(beside, exit_to), stride=0.5, arms_swing=False)
    # the cup rides with her, held in front at chest height (the IK target follows her body)
    tt = t_take + 0.45
    while tt <= min(sh.dur, t_out + 0.2):
        q.key("hand.R", tt, tuple(q.char_point(tt, (-0.16, 0.34, 1.12))), "linear")
        tt += 0.1
    # his eyes follow the cup; the head a little behind them; then back to the carafe, and a breath
    p.key("gaze_at", t_take, tuple(mpos), "hold")
    p.key("gaze_w", t_take, 0.0, "hold")
    p.key("gaze_w", t_take + 0.12, 1.0, "out")
    p.key("gaze_at", t_take + 0.7, tuple(mpos + Vector((1.2, -0.2, 0.3))), "soft")
    p.key("gaze_at", t_go + 0.9, tuple(mpos + Vector((2.2, 0.0, 0.4))), "soft")
    p.key("look_at", t_take + 0.2, tuple(mpos), "hold")
    p.key("look_at", t_take + 0.9, tuple(mpos + Vector((1.1, -0.3, 0.2))), "soft")
    p.key("look_at", t_go + 1.0, tuple(mpos + Vector((2.0, -0.2, 0.3))), "soft")
    p.key("gaze_at", t_down - 0.4, tuple(mpos + Vector((2.2, 0.0, 0.4))), "hold")
    p.key("gaze_at", t_down, tuple(base0), "soft")
    p.key("look_at", t_down - 0.3, tuple(mpos + Vector((2.0, -0.2, 0.3))), "hold")
    p.key("look_at", t_down + 0.2, tuple(base0 + Vector((0, 0, 0.2))), "soft")
    p.key("chest", t_down + 0.1, (0.0, 0.0, 0.0), "hold")
    p.key("chest", t_down + 0.5, (-2.5, 0.0, 0.0), "out")  # the small exhale
    q.bake()
    q._baked = True
    sh.scene.frame_set(int(round(t_take * sh.fps)) + 1)
    qa = q.rig.arm
    tip = qa.matrix_world @ qa.pose.bones["hand.R"].tail
    miss = (tip - mug.matrix_world.translation).length
    if miss > 0.2:
        sw = qa.matrix_world @ qa.pose.bones["upperarm.R"].head
        raise RuntimeError(f"S03_SH03: her hand is {miss * 100:.0f} cm from the mug at the grab: tip {tuple(round(v, 2) for v in tip)} "
                           f"mug {tuple(round(v, 2) for v in mug.matrix_world.translation)} root {tuple(round(v, 2) for v in q.ch['pos'].at(t_take))} "
                           f"face {q.ch['face'].at(t_take):.0f} shoulderR {tuple(round(v, 2) for v in sw)} target {tuple(round(v, 2) for v in q.ch['hand.R'].at(t_take))} "
                           f"ik {q.ch['ik_hand.R'].at(t_take):.2f} beside {beside} cook {tuple(round(v, 2) for v in a['cook'])}")
    sh.scene.frame_set(1)
    p.bake()
    p._baked = True
    _stream(sh, car, mug, 0.62, t_stop + 0.05)
    cam = sh.camera(50, fstop=2.4)
    c = a["cook"]
    cam.place(0.0, (c.x + 1.5, -2.0, 1.35), (c.x + 0.35, c.y - 0.25, 1.32), focus=(mpos.x, mpos.y, mpos.z + 0.3))
    cam.handheld("locked", 1.0)
    sh.finish()


SHOTS = {"S03_SH01": S03_SH01, "S03_SH02": S03_SH02, "S03_SH03": S03_SH03}
