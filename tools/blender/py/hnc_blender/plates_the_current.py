"""Plate builders for "HNC: The Current" (see social/output/anime-tribute/storyboard.md).

Each builder receives a scene that already holds the verified canonical cast,
posed by the track, and adds presentation only: set, light, camera, Current FX.
Frames are 60 fps; the edit runs on a 150 BPM grid, so beat k of a plate is
frame 1 + 24 k (light strikes and aura surges land on beats).
Positions come from the posed canonical objects, never hard-coded bodies.
"""
import math
import random

from mathutils import Vector

from . import studio
from .interchange import base_name, gltf_to_blender

BEAT = 24


def _obj(roots, name):
    for root in roots.values():
        for o in (root, *root.children_recursive):
            if base_name(o.name) == name:
                return o
    raise KeyError(name)


def _w(scene, roots, name, frame):
    scene.frame_set(frame)
    p = _obj(roots, name).matrix_world.translation.copy()
    scene.frame_set(1)
    return p


def hnc(x, y, z):
    """HNC/Three point -> Blender."""
    return Vector(gltf_to_blender((x, y, z)))


def _pitch_markings(cols, pitch, near):
    """Canonical markings (HNC_PITCH, mirrors create-pitch.ts) near a point, as chalk strips."""
    chalk = studio.chalk_material()
    L, Wd = pitch["halfLength"], pitch["halfWidth"]
    segs = [((0, -Wd), (0, Wd), 0.12), ((-L, -Wd), (L, -Wd), 0.16), ((-L, Wd), (L, Wd), 0.16), ((L, -Wd), (L, Wd), 0.16)]
    box, area = L - pitch["penaltyLength"], L - pitch["goalAreaLength"]
    pw, aw = pitch["penaltyHalfWidth"], pitch["goalAreaHalfWidth"]
    segs += [((box, -pw), (box, pw), 0.12), ((L, -pw), (box, -pw), 0.12), ((L, pw), (box, pw), 0.12),
             ((area, -aw), (area, aw), 0.12), ((L, -aw), (area, -aw), 0.12), ((L, aw), (area, aw), 0.12)]
    for i, (a, b, w) in enumerate(segs):
        pa, pb = hnc(a[0], 0, a[1]), hnc(b[0], 0, b[1])
        if min((pa - near).length, (pb - near).length, _seg_dist(near, pa, pb)) < 60:
            studio.strip(cols["SET"], f"SET_Line.{i:02d}", pa, pb, w, chalk)
    studio.ring(cols["SET"], "SET_CentreCircle", (0, 0), 5.785, 0.17, chalk)
    studio.disc(cols["SET"], "SET_CentreSpot", (0, 0), 0.18, chalk, z=0.014)
    spot = hnc(L - pitch["penaltySpotDist"], 0, 0)
    studio.disc(cols["SET"], "SET_PenaltySpot", (spot.x, spot.y), 0.18, chalk, z=0.014)
    # Penalty arc outside the box (x < box line), as in create-pitch.ts.
    arc = [hnc(L - pitch["penaltySpotDist"] + math.cos(t) * pitch["arcRadius"], 0, math.sin(t) * pitch["arcRadius"])
           for t in [math.pi / 2 + math.pi * i / 24 for i in range(25)]]
    arc = [p for p in arc if p.x <= box + 1e-3]
    for i in range(len(arc) - 1):
        studio.strip(cols["SET"], f"SET_Arc.{i:02d}", arc[i], arc[i + 1], 0.12, chalk)
    return chalk


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


def _flicker_spark(level, start=1):
    """A Current that won't hold yet: a stuttering contact settling into a glow."""
    k = [(start, 0), (start + 7, 0), (start + 9, 0.6), (start + 11, 0.05), (start + 15, 0.7), (start + 17, 0.1), (start + 23, 0.85)]
    return [(f, v * level) for f, v in k] + [(start + 40, 0.8 * level), (start + 95, level)]


# ---------------------------------------------------------------- 01 eye


def _face(scene, roots, tag, frame):
    """Eye midpoint and the direction the face points (from the posed canonical eyes)."""
    head = _w(scene, roots, f"{tag}.Head", frame)
    mid = (_w(scene, roots, f"{tag}.Eye.L", frame) + _w(scene, roots, f"{tag}.Eye.R", frame)) / 2
    d = mid - head
    d.z = 0
    return head, mid, d.normalized()


def _around(center, direction, dist, yaw=0.0, dz=0.0):
    """A point `dist` in front of `center` along `direction`, swung `yaw` rad about Z."""
    c, s_ = math.cos(yaw), math.sin(yaw)
    d = Vector((direction.x * c - direction.y * s_, direction.x * s_ + direction.y * c, 0))
    return center + d * dist + Vector((0, 0, dz))


def current_eye(scene, cols, roots, track):
    red = track["palette"]["TR"]
    studio.world(scene, "#010204")
    head, mid, fwd = _face(scene, roots, "TR09", 60)
    eye = _obj(roots, "TR09.Eye.L")
    # Face ECU on the face's own axis, a touch to his right; ~0.8 m of frame -> ~0.65 m.
    studio.camera(cols["CAM"], scene, "CAM_Eye", 75,
                  keys=[(1, _around(mid, fwd, 1.95, -0.12, 0.05)), (96, _around(mid, fwd, 1.62, -0.08, 0.02))],
                  target_keys=[(1, mid + Vector((0, 0, 0.0))), (96, mid + Vector((0, 0, -0.01)))],
                  fstop=1.8, focus=eye)
    studio.fog(cols["SET"], head - fwd * 2.0, (7, 5, 5), 0.014, "#5a6480")
    back = -fwd
    side = Vector((fwd.y, -fwd.x, 0))
    studio.spot(cols["LGT"], "LGT_RimCrimson", head + back * 1.5 + side * 1.0 + Vector((0, 0, 0.35)), head, red, 4200, 22, 0.3, 0.12)
    studio.spot(cols["LGT"], "LGT_RimCrimsonLow", head + back * 1.2 + side * 1.1 + Vector((0, 0, -0.25)), head, red, 2200, 22, 0.3, 0.12)
    studio.spot(cols["LGT"], "LGT_RimCool", head + back * 1.3 - side * 1.1 + Vector((0, 0, 0.4)), head, "#cfe0ff", 900, 22, 0.4, 0.12)
    strike = studio.spot(cols["LGT"], "LGT_Strike", head + fwd * 1.3 - side * 1.0 + Vector((0, 0, 1.15)), head, "#fff1dc", 8, 28, 0.25, 0.05)
    # The floodlight stutters, then strikes as the eyes open (beat 3 = frame 49).
    studio.key_power(strike, [(1, 12), (17, 12), (19, 40), (21, 4), (30, 4), (31, 25), (33, 3), (47, 5), (49, 520), (54, 380), (96, 420)])
    studio.bokeh(cols["SET"], 7, 30, head - fwd * 16 + Vector((0, 0, -0.2)), (26, 4, 6), ["#fff3dc", "#fff3dc", "#fff3dc", red], radius=0.07, strength=30)
    # Motes rise BEHIND the head (in front of the lens they bloom into discs over the face).
    studio.embers(cols["FX"], 11, 44, head - fwd * 1.1 + Vector((0, 0, -1.1)), 1.1, 2.4, red, 96, rise=0.35, size=0.01)
    aura = studio.aura(cols["FX"], roots["HNC_Player_TR_09"], red, strength=4.0, seed=3)
    studio.key_aura(aura, [(1, 0), (48, 0), (50, 0.9), (60, 0.45), (96, 0.55)])
    studio.compositor(scene, glare=0.7, threshold=0.85)


# ---------------------------------------------------------------- 03 chalk


def current_chalk(scene, cols, roots, track):
    red = track["palette"]["TR"]
    pitch = track["pitch"]
    studio.world(scene, "#020408")
    studio.ground(cols["SET"], 150)
    _pitch_markings(cols, pitch, Vector((0, 0, 0)))
    ball = roots["HNC_Ball"]
    bpos = _w(scene, roots, "HNC_Ball", 1)
    # The Current races along the halfway line from under the lens into the ball (0.95 s).
    cur = studio.current_material("FX_CurrentMat", red, head=0.0, tail=7.0, strength=9)
    far = bpos + Vector((0, -5.5, 0))  # starts just behind the lens: the whole run is on screen
    studio.strip(cols["FX"], "FX_Current", far, bpos + Vector((0, -0.18, 0)), 0.22, cur, z=0.02)
    studio.key_value(cur, "Head", [(1, 0.0), (57, 1.0), (96, 1.0)])
    carrier = studio.point(cols["LGT"], "LGT_Carrier", far + Vector((0, 0, 0.15)), red, 18, 0.1)
    for f, y in ((1, far.y), (57, bpos.y - 0.3)):
        carrier.location.y = y
        carrier.keyframe_insert("location", frame=f)
    hit = studio.point(cols["LGT"], "LGT_BallHit", bpos + Vector((0.1, 0.35, 0.05)), red, 0, 0.1)
    studio.key_power(hit, [(1, 0), (56, 0), (57, 70), (64, 25), (96, 18)])
    aura = studio.aura(cols["FX"], ball, red, strength=6.0, seed=5, scales=(1.12, 1.4))
    studio.key_aura(aura, [(1, 0), (56, 0), (57, 1.6), (68, 0.7), (96, 0.8)])
    # Night stadium: one cool high key, far floodlight bokeh, the crowd as tiny lights.
    studio.area(cols["LGT"], "LGT_Flood", (-6, -9, 12), bpos, (8, 8), 2600, "#dfe8ff")
    studio.fog(cols["SET"], (0, 14, 4), (60, 70, 10), 0.012, "#8b9bc0")
    studio.bokeh(cols["SET"], 13, 26, (0, 42, 11), (80, 6, 12), ["#fff4de", "#fff4de", "#e8f0ff"], radius=0.35, strength=50)
    studio.bokeh(cols["SET"], 17, 160, (0, 36, 3.2), (90, 5, 4), ["#f8cc54", "#ec5a61", "#5fcddd", "#f3ede0", "#514b91", "#ff9a3d", "#7ee08a"], radius=0.06, strength=6, name="SET_Crowd")
    # Low on the line, Emre's boot framing the left edge; a slow creep toward the ball.
    studio.camera(cols["CAM"], scene, "CAM_Chalk", 28,
                  keys=[(1, bpos + Vector((0.42, -1.45, -0.11))), (96, bpos + Vector((0.34, -1.12, -0.1)))],
                  target_keys=[(1, bpos + Vector((-0.12, 0.5, -0.06))), (96, bpos + Vector((-0.1, 0.4, -0.05)))],
                  fstop=2.0, focus=ball)
    studio.compositor(scene, glare=0.45, threshold=1.1)


# ---------------------------------------------------------------- 06-08 portraits


def current_portrait(scene, cols, roots, track):
    look = track["look"]
    color = track["palette"][look["color"]]
    keeper = bool(look.get("keeper"))
    side = 1 if look.get("side", "left") == "left" else -1
    root = next(iter(roots.values()))
    tag = base_name(root.name).replace("HNC_Player_", "").replace("_", "")
    head = _w(scene, roots, f"{tag}.Head", 48)
    studio.world(scene, "#020308")
    studio.ground(cols["SET"], 60, color="#173f22")
    studio.fog(cols["SET"], head, (12, 12, 7), 0.045 if not keeper else 0.06, "#8a96b4")
    studio.spot(cols["LGT"], "LGT_RimA", head + Vector((-1.35, 1.5, 0.8)), head + Vector((0, 0, -0.4)), color, 850, 55, 0.55, 0.3)
    studio.spot(cols["LGT"], "LGT_RimB", head + Vector((1.4, 1.35, 0.55)), head + Vector((0, 0, -0.4)), color, 620, 55, 0.55, 0.3)
    studio.area(cols["LGT"], "LGT_Key", head + Vector((0.9 * side, -2.1, -0.55)), head, (0.9, 0.9), 45, "#bcd0ff")
    studio.area(cols["LGT"], "LGT_Top", head + Vector((0, 0.3, 2.6)), head, (1.5, 1.5), 60, "#ffffff")
    studio.bokeh(cols["SET"], 21, 30, head + Vector((0, 16, 1.5)), (28, 5, 9), ["#fff3dc", "#fff3dc", color], radius=0.22, strength=40)
    studio.embers(cols["FX"], 31, 46, Vector((head.x, head.y + 0.9, 0.05)), 1.0, 2.6, color, track["frames"], rise=0.55, size=0.008)
    aura = studio.aura(cols["FX"], root, color, strength=4.5, seed=7)
    studio.key_aura(aura, _flicker_spark(0.4 if keeper else 0.6))
    studio.camera(cols["CAM"], scene, "CAM_Portrait", 42,
                  keys=[(1, Vector((-0.42 * side, -2.75, 0.72))), (96, Vector((-0.34 * side, -2.35, 0.8)))],
                  target_keys=[(1, head + Vector((0, 0, -0.42))), (96, head + Vector((0, 0, -0.36)))],
                  fstop=2.2, focus=_obj(roots, f"{tag}.Head"))
    studio.compositor(scene, glare=0.6)


# ---------------------------------------------------------------- 24 charge


def _polystrip(col, name, pts, width, material):
    import bmesh
    import bpy
    me = studio._t(bpy.data.meshes.new(name))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    total = sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))
    acc = 0.0
    prev = None
    for i in range(len(pts)):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        d = (b - a).normalized()
        n = Vector((-d.y, d.x, 0)) * width * 0.5 * (1 - 0.8 * i / (len(pts) - 1))
        if i:
            acc += (pts[i] - pts[i - 1]).length
        v1, v2 = bm.verts.new(pts[i] + n), bm.verts.new(pts[i] - n)
        if prev:
            f = bm.faces.new((prev[0], prev[1], v2, v1))
            for loop in f.loops:
                loop[uv].uv = (prev[2] if loop.vert in prev[:2] else acc / total, 0.0 if loop.vert in (prev[0], v1) else 1.0)
        prev = (v1, v2, acc / total)
    bm.to_mesh(me)
    bm.free()
    o = studio._obj(col, name, me)
    me.materials.append(material)
    return o


def current_charge(scene, cols, roots, track):
    red = track["palette"]["TR"]
    azure = track["palette"]["GR"]
    pitch = track["pitch"]
    n = track["frames"]
    emre = roots["HNC_Player_TR_09"]
    feet = _w(scene, roots, "HNC_Player_TR_09", 1)
    head = _w(scene, roots, "TR09.Head", 1)
    studio.world(scene, "#010207")
    studio.ground(cols["SET"], 160)
    _pitch_markings(cols, pitch, feet)
    net = _obj(roots, "HNC_Goal.Net")
    studio.net_tubes(net)
    studio.fog(cols["SET"], feet + Vector((6, 0, 11)), (90, 110, 26), 0.045, "#9aa6c4")
    # Only the banks scatter in the haze: every other light is surface-only (no maroon wash).
    studio.area(cols["LGT"], "LGT_Night", feet + Vector((2, 0, 24)), feet, (30, 30), 2600, "#aebfe0", volume=0.0)
    # Four floodlight banks strike crimson on beats 1-4, all aimed at him (FULL CURRENT).
    heads = [hnc(58, 20.4, -38), hnc(58, 20.4, 38), hnc(-58, 20.4, -38), hnc(-58, 20.4, 38)]
    for i, h in enumerate(heads):
        s = studio.spot(cols["LGT"], f"LGT_Bank.{i}", h, feet + Vector((0, 0, 1.0)), studio.mix_hex("#ffffff", red, 0.6), 0, 4.5, 0.15, 0.4, volume=6.0)
        f = 1 + BEAT * i
        studio.key_power(s, [(1, 0), (f, 0), (f + 1, 110000), (f + 3, 30000), (f + 5, 80000), (n, 90000)])
        studio.bokeh(cols["SET"], 40 + i, 1, h, (0.1, 0.1, 0.1), [studio.mix_hex("#ffffff", red, 0.4)], radius=0.9, strength=0.0, name=f"SET_Head.{i}")
    for i, o in enumerate([o for o in cols["SET"].objects if o.name.startswith("SET_Head.")]):
        mat = o.data.materials[0]
        em = next(nd for nd in mat.node_tree.nodes if nd.type == "EMISSION")
        f = 1 + BEAT * i
        for fr, v in [(1, 0.0), (f, 0.0), (f + 1, 260.0), (f + 3, 80.0), (f + 5, 200.0)]:
            em.inputs["Strength"].default_value = v
            em.inputs["Strength"].keyframe_insert("default_value", frame=fr)
    glow = studio.point(cols["LGT"], "LGT_GroundGlow", feet + Vector((0, 0, 0.3)), red, 30, 0.3, volume=0.0)
    studio.key_power(glow, [(1, 30), (97, 160), (n, 420)])
    ball_obj = roots["HNC_Ball"]
    lamp = studio.point(cols["LGT"], "LGT_BallGlow", (0, 0, 0), studio.mix_hex("#ffffff", red, 0.5), 60, 0.05, volume=0.0)
    studio.follow(lamp, ball_obj, (-0.35, 0, -0.45), n)
    aura = studio.aura(cols["FX"], emre, red, strength=4.2, seed=9)
    studio.key_aura(aura, [(1, 0.55), (25, 0.62), (49, 0.72), (73, 0.85), (97, 1.05), (145, 1.25), (n, 1.45)])
    for rid, colr, lvl in (("HNC_Player_GR_04", azure, 0.3), ("HNC_Player_GR_01", azure, 0.4)):
        studio.key_aura(studio.aura(cols["FX"], roots[rid], colr, strength=3.5, seed=11), [(1, lvl), (n, lvl)])
    studio.key_aura(studio.aura(cols["FX"], roots["HNC_Ball"], red, strength=7.0, seed=13, scales=(1.15, 1.45)), [(1, 0.9), (n, 1.3)])
    # The ground cracks with light from his boots (bar 22).
    rnd = random.Random(77)
    crack = studio.current_material("FX_CrackMat", red, head=0.0, tail=3.0, strength=55)
    for c in range(9):
        a = c / 9 * math.tau + rnd.uniform(-0.25, 0.25)
        pts, p = [], feet + Vector((0, 0, 0.02))
        length = rnd.uniform(2.4, 5.2)
        for k in range(9):
            pts.append(p.copy())
            a += rnd.uniform(-0.45, 0.45)
            p = p + Vector((math.cos(a), math.sin(a), 0)) * (length / 8)
        _polystrip(cols["FX"], f"FX_Crack.{c}", pts, 0.16, crack)
    studio.key_value(crack, "Head", [(1, 0.0), (98, 0.0), (170, 1.0), (n, 1.0)])
    studio.embers(cols["FX"], 91, 40, feet, 1.0, 2.8, red, n, rise=1.1, size=0.01)
    # The charge peaks as a Current pillar (bar 22).
    pil = studio.pillar(cols["FX"], feet, 0.85, 7.0, red, strength=3.0)
    studio.key_aura([pil], [(1, 0.0), (97, 0.0), (120, 0.6), (170, 1.0), (n, 1.25)])
    # The home end answers: its lights in crimson (behind the goal + the far stand's home half).
    studio.bokeh(cols["SET"], 51, 240, (53.5, 0, 2.8), (5, 56, 2.5), [red, red, "#ffd9dc"], radius=0.07, strength=22, name="SET_HomeEnd")
    studio.bokeh(cols["SET"], 53, 200, (25, 36, 3.6), (48, 7, 4.5), [red, red, "#ffd9dc"], radius=0.07, strength=16, name="SET_HomeStand")
    # Orbit from behind him (ball high ahead) round the camera side, low, ending on the `leap` lens.
    end = feet + Vector((2.1, -2.7, 0.22))
    r0, r1 = 3.0, (end - feet).to_2d().length
    a0, a1 = math.pi, math.atan2(end.y - feet.y, end.x - feet.x) + 2 * math.pi
    keys, tkeys = [], []
    for f in list(range(1, n + 1, 8)) + [n]:
        u = (f - 1) / (n - 1)
        e = u * u * (3 - 2 * u)
        a = a0 + (a1 - a0) * e
        r = r0 + (r1 - r0) * e
        keys.append((f, feet + Vector((math.cos(a) * r, math.sin(a) * r, 0.55 + (0.22 - 0.55) * e))))
        # Always on him: first up past his shoulder toward the hanging ball, then down onto the stance.
        start_t, mid_t, end_t = head + Vector((1.1, 0.1, 1.3)), head + Vector((0.25, 0, 0.35)), feet + Vector((0.15, 0, 1.95))
        tkeys.append((f, start_t.lerp(mid_t, min(1, e * 2)) if e < 0.5 else mid_t.lerp(end_t, (e - 0.5) * 2)))
    studio.camera(cols["CAM"], scene, "CAM_Orbit", 30, keys=keys, target_keys=tkeys, fstop=2.8, focus=_obj(roots, "TR09.Head"))
    studio.compositor(scene, glare=0.8, threshold=0.8, size=0.7)


# ---------------------------------------------------------------- 31 legend


def current_legend(scene, cols, roots, track):
    red = track["palette"]["TR"]
    azure = track["palette"]["GR"]
    pitch = track["pitch"]
    n = track["frames"]
    feet = _w(scene, roots, "HNC_Player_TR_09", 1)
    studio.world(scene, "#010207")
    studio.ground(cols["SET"], 160)
    _pitch_markings(cols, pitch, feet)
    studio.net_tubes(_obj(roots, "HNC_Goal.Net"))
    studio.fog(cols["SET"], feet + Vector((8, 0, 8)), (60, 80, 20), 0.016, "#9aa6c4")
    tint = studio.mix_hex("#ffffff", red, 0.5)
    for i, y in enumerate((-18, 18)):
        studio.spot(cols["LGT"], f"LGT_Front.{i}", Vector((62, y, 21)), feet + Vector((0, 0, 1.5)), tint, 260000, 9, 0.4, 0.8)
    studio.area(cols["LGT"], "LGT_Back", feet + Vector((-2.6, -1.4, 1.6)), feet + Vector((0, 0, 1.3)), (1.2, 1.2), 70, "#c8d6ff")
    # Cool fill keeps the grass green under the crimson key.
    studio.area(cols["LGT"], "LGT_Night", feet + Vector((4, 0, 24)), feet, (30, 30), 5200, "#aebfe0", volume=0.0)
    studio.bokeh(cols["SET"], 61, 18, (64, 0, 22), (3, 64, 3), [tint, "#fff5e0"], radius=0.7, strength=70, name="SET_Banks")
    studio.bokeh(cols["SET"], 63, 260, (53.5, 0, 2.8), (5, 56, 2.5), [red, red, "#ffd9dc"], radius=0.07, strength=24, name="SET_HomeEnd")
    studio.embers(cols["FX"], 65, 150, feet + Vector((4, 0, 0)), 7.0, 7.0, red, n, rise=0.5, size=0.014, fall=True)
    aura = studio.aura(cols["FX"], roots["HNC_Player_TR_09"], red, strength=4.0, seed=15)
    studio.key_aura(aura, [(1, 0.4), (n, 0.5)])
    studio.key_aura(studio.aura(cols["FX"], roots["HNC_Player_GR_01"], azure, strength=2.5, seed=17), [(1, 0.15), (n, 0.1)])
    studio.camera(cols["CAM"], scene, "CAM_Legend", 30,
                  keys=[(1, feet + Vector((-4.4, -1.5, 0.32))), (n, feet + Vector((-3.7, -1.25, 0.4)))],
                  target_keys=[(1, feet + Vector((6, 0.9, 3.0))), (n, feet + Vector((6, 0.9, 3.4)))],
                  fstop=2.8, focus=_obj(roots, "TR09.Head"))
    studio.compositor(scene, glare=0.75, threshold=0.8)


BUILDERS = {
    "current_eye": current_eye,
    "current_chalk": current_chalk,
    "current_portrait": current_portrait,
    "current_charge": current_charge,
    "current_legend": current_legend,
}
