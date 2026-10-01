"""Performance layer: semantic acting channels -> per-frame rig keys.

Author a performance with the library below (stance, walk, sit, look,
glance, smile, reach, hold…); ``Performer.bake()`` samples every channel once
per frame and writes linear keys on the rig, its IK/aim empties and the
constraint influences. Additive micro-motion (breath, head drift, weight
drift, blinks) is layered at bake time so stillness never reads as dead.

Conventions (armature/world space): the character faces -Y at face=0,
face is degrees CCW from above (+90 = facing +X... i.e. turned to its left).
Angles in channels are degrees. Distances metres.
"""
import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

from . import anim
from .anim import Channel

D = math.radians


def rot_x(a):
    return Matrix.Rotation(D(a), 3, "X")


def rot_y(a):
    return Matrix.Rotation(D(a), 3, "Y")


def rot_z(a):
    return Matrix.Rotation(D(a), 3, "Z")


def body_rot(pitch, roll, yaw):
    """Armature-space rotation for a body segment: + pitch leans/nods forward,
    + roll tilts to the character's left, + yaw turns to its left."""
    return rot_z(yaw) @ rot_y(roll) @ rot_x(pitch)


PROFILES = {
    # breath (deg of chest pitch), head drift (deg), weight drift (m), blink mean (s)
    "calm": dict(breath=0.9, drift=1.1, sway=0.006, blink=3.6),
    "still": dict(breath=0.6, drift=0.45, sway=0.003, blink=4.2),
    "sport": dict(breath=1.6, drift=0.8, sway=0.004, blink=3.0),
    "asleep": dict(breath=1.4, drift=0.1, sway=0.0, blink=0),
    "child": dict(breath=1.0, drift=1.8, sway=0.010, blink=3.0),
    "elder": dict(breath=1.0, drift=0.9, sway=0.008, blink=3.4),
}


class Performer:
    def __init__(self, rig, fps=60, frames=120, seed=0, profile="calm"):
        self.rig = rig
        self.fps = fps
        self.frames = frames
        self.seed = seed
        self.prof = dict(PROFILES[profile])
        d = rig.dims
        self.dims = d
        c = self.ch = {}
        c["pos"] = Channel((0.0, 0.0, 0.0))
        c["face"] = Channel(0.0)
        c["tilt"] = Channel((0.0, 0.0))  # whole-body pitch (+ forward), roll (+ onto its left side) — lying down
        c["hips"] = Channel((0.0, 0.0, 0.0))  # char space: +x left, +y forward, +z up
        c["hips_rot"] = Channel((0.0, 0.0, 0.0))  # pitch, roll, yaw
        c["chest"] = Channel((0.0, 0.0, 0.0))
        c["neck"] = Channel((0.0, 0.0, 0.0))  # pitch(+down), roll(+left), yaw(+left)
        c["head"] = Channel((0.0, 0.0, 0.0))
        c["look"] = Channel(0.0)
        c["look_at"] = Channel(tuple(Vector(d["head"]) + Vector((0, -3, 0))))
        c["gaze"] = Channel((0.0, 0.0))
        c["gaze_w"] = Channel(0.0)
        c["gaze_at"] = Channel(tuple(Vector(d["head"]) + Vector((0, -3, 0))))
        c["lids"] = Channel(1.0)
        c["squint"] = Channel(0.0)
        c["lid.L"] = Channel(1.0)  # per-eye openness (one eye opens first)
        c["lid.R"] = Channel(1.0)
        c["breath_amp"] = Channel(1.0)
        c["talk"] = Channel((0.0, 0.0, 0.0))  # additive head beats while speaking (see talk())
        c["talk_chest"] = Channel(0.0)  # additive chest pitch: the inhale before a phrase
        c["drift_amp"] = Channel(1.0)
        for s in "LR":
            c[f"arm.{s}"] = Channel((0.0, 7.0, 0.0, 6.0))  # fwd, out, twist, elbow
            c[f"ik_hand.{s}"] = Channel(0.0)
            c[f"hand.{s}"] = Channel((d["hand_x"][s], 0.0, d["ankle"] + d["arm_len"]))
            c[f"hand_rot.{s}"] = Channel((0.0, 0.0, 0.0))  # pitch, roll, yaw in char space
            c[f"ik_foot.{s}"] = Channel(1.0)
            c[f"foot.{s}"] = Channel((d["foot_x"][s], 0.0, d["ankle"]))
            c[f"foot_rot.{s}"] = Channel((0.0, 0.0))  # world yaw (deg), pitch (+ toe up)
            c[f"leg.{s}"] = Channel((0.0, 0.0, 0.0))  # FK: fwd, out, knee (used when ik_foot < 1)
        self.blink_avoid = []
        self.holds = []  # (prop, side, t0, t1, local offset Matrix)
        self.extra_blinks = []

    # ------------------------------------------------------------ helpers
    def t(self, frame):
        return (frame - 1) / self.fps

    def f(self, t):
        return int(round(t * self.fps)) + 1

    def key(self, name, t, value, e="smooth"):
        self.ch[name].key(t, value, e)
        return self

    def hold(self, name, t):
        v = self.ch[name].at(t)
        self.ch[name].key(t, v, "linear")
        return self

    def world_from_char(self, t, v):
        """Character-space offset (x left, y forward, z up) at time t -> world vector."""
        face = self.ch["face"].at(t)
        x, y, z = v
        m = rot_z(face)
        return m @ Vector((x, -y, z))

    def char_point(self, t, v):
        """Point in character space (relative to the root) -> world."""
        return Vector(self.ch["pos"].at(t)) + self.world_from_char(t, v)

    # ------------------------------------------------------------ bake
    def bake(self):
        rig = self.rig
        arm = rig.arm
        pb = arm.pose.bones
        P = self.prof
        n = self.frames
        blinks = anim.blink_times(0, n / self.fps + 1, self.seed, P["blink"], self.blink_avoid) if P["blink"] else []
        blinks = sorted(blinks + self.extra_blinks)
        rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        restq = {k: v.to_quaternion() for k, v in rest.items()}

        def lq(bone, m):
            b = rest[bone]
            return (b.inverted() @ m @ b).to_quaternion()

        tracks = {}  # (id, path, index) -> list of values

        def put(idb, path, values):
            for i, v in enumerate(values):
                tracks.setdefault((idb, path, i), []).append(float(v))

        foot_base = {s: rest[f"foot.{s}"] for s in "LR"}
        hand_base = {s: rest[f"hand.{s}"] for s in "LR"}
        for fr in range(1, n + 1):
            t = self.t(fr)
            c = {k: ch.at(t) for k, ch in self.ch.items()}
            face = c["face"]
            # --- root
            put(arm, "location", c["pos"])
            tp, tr = c["tilt"]
            put(arm, "rotation_euler", (D(tp), D(tr), D(face)))
            # --- micro layers
            br = anim.breath(t, 0.23, self.seed) * P["breath"] * c["breath_amp"]
            drift = P["drift"] * c["drift_amp"]
            nd = (anim.fbm(t, 0.33, self.seed + 1) * drift, anim.fbm(t, 0.27, self.seed + 2) * drift * 0.6,
                  anim.fbm(t, 0.21, self.seed + 3) * drift * 1.3)
            sway = P["sway"] * c["drift_amp"]
            hx, hy, hz = c["hips"]
            hx += anim.fbm(t, 0.11, self.seed + 4) * sway
            hy += anim.fbm(t, 0.09, self.seed + 5) * sway * 0.5
            # --- pelvis
            v_local = rest["pelvis"].inverted() @ Vector((hx, -hy, hz))
            put(pb["pelvis"], "location", v_local)
            hp, hr, hyaw = c["hips_rot"]
            put(pb["pelvis"], "rotation_quaternion", lq("pelvis", body_rot(hp, hr + anim.fbm(t, 0.1, self.seed + 6) * sway * 60, hyaw)))
            cp, cr, cy = c["chest"]
            put(pb["spine"], "rotation_quaternion", lq("spine", body_rot(cp - br + c["talk_chest"], cr, cy)))
            np_, nr, ny = c["neck"]
            put(pb["neck"], "rotation_quaternion", lq("neck", body_rot(np_ + nd[0] + br * 0.35, nr + nd[1], ny + nd[2])))
            hp2, hr2, hy2 = anim.add(c["head"], c["talk"])
            put(pb["head"], "rotation_quaternion", lq("head", body_rot(hp2, hr2, hy2)))
            gx, gy = c["gaze"]
            put(pb["eyes"], "rotation_quaternion", lq("eyes", rot_z(gx * 18.0) @ rot_x(-gy * 12.0)))
            lid = c["lids"] * (1 - 0.48 * c["squint"]) * anim.blink_curve(t, blinks)
            for s in "LR":
                if f"eye.{s}" in pb:
                    put(pb[f"eye.{s}"], "scale", (1.0, 1.0, max(0.08, lid * c[f"lid.{s}"])))
                    put(pb[f"eye.{s}"], "location", (0.0, 0.0, 0.012 * c["squint"]))
            # --- aim constraints
            put(pb["neck"], 'constraints["Aim"].influence', (c["look"],))
            put(pb["eyes_aim"], 'constraints["Aim"].influence', (c["gaze_w"],))
            put(rig.c["look"], "location", c["look_at"])
            put(rig.c["gaze"], "location", c["gaze_at"])
            # --- arms
            for s, sign in (("L", -1), ("R", 1)):
                fwd, out, tw, elb = c[f"arm.{s}"]
                up = rot_x(-fwd) @ rot_y(sign * out) @ rot_z(-sign * tw)
                put(pb[f"upperarm.{s}"], "rotation_quaternion", lq(f"upperarm.{s}", up))
                put(pb[f"forearm.{s}"], "rotation_quaternion", lq(f"forearm.{s}", rot_x(-elb)))
                w = c[f"ik_hand.{s}"]
                put(pb[f"forearm.{s}"], 'constraints["IK"].influence', (w,))
                put(pb[f"hand.{s}"], 'constraints["IKRot"].influence', (w,))
                hand = rig.c[f"hand.{s}"]
                put(hand, "location", c[f"hand.{s}"])
                hrp, hrr, hry = c[f"hand_rot.{s}"]
                q = (rot_z(face) @ body_rot(hrp, hrr, hry) @ hand_base[s]).to_quaternion()
                put(hand, "rotation_quaternion", q)
                # --- legs
                wf = c[f"ik_foot.{s}"]
                put(pb[f"shin.{s}"], 'constraints["IK"].influence', (wf,))
                put(pb[f"foot.{s}"], 'constraints["IKRot"].influence', (wf,))
                foot = rig.c[f"foot.{s}"]
                put(foot, "location", c[f"foot.{s}"])
                fy, fp = c[f"foot_rot.{s}"]
                put(foot, "rotation_quaternion", (rot_z(fy) @ rot_x(fp) @ foot_base[s]).to_quaternion())
                lf, lo, kn = c[f"leg.{s}"]
                put(pb[f"thigh.{s}"], "rotation_quaternion", lq(f"thigh.{s}", rot_x(-lf) @ rot_y(sign * lo)))
                put(pb[f"shin.{s}"], "rotation_quaternion", lq(f"shin.{s}", rot_x(kn)))
        for o in (rig.c[f"hand.{s}"] for s in "LR"):
            o.rotation_mode = "QUATERNION"
        for o in (rig.c[f"foot.{s}"] for s in "LR"):
            o.rotation_mode = "QUATERNION"
        write_tracks(tracks, n)
        self.bake_holds()

    # ------------------------------------------------------------ props
    def bake_holds(self):
        """Props held in a hand follow the evaluated hand bone (incl. IK) per frame."""
        if not self.holds:
            return
        sc = bpy.context.scene
        arm = self.rig.arm
        tracks = {}
        for prop, side, t0, t1, offset in self.holds:
            f0, f1 = self.f(t0), self.f(t1)
            bone = side[5:] if side.startswith("bone:") else f"hand.{side}"  # any bone (ice on a knee)
            if offset is None:
                # Auto grip: keep the prop exactly where it is relative to the hand at the grab frame.
                sc.frame_set(f0)
                hb = arm.pose.bones[bone]
                offset = (arm.matrix_world @ hb.matrix).inverted() @ prop.matrix_world
            for fr in range(1, self.frames + 1):
                if fr < f0 or fr > f1:
                    continue
                sc.frame_set(fr)
                hb = arm.pose.bones[bone]
                m = arm.matrix_world @ hb.matrix @ offset
                loc, rot, _ = m.decompose()
                tracks.setdefault(prop, {})[fr] = (loc, rot)
        sc.frame_set(1)
        for prop, keys in tracks.items():
            prop.rotation_mode = "QUATERNION"
            base_loc, base_rot = prop.location.copy(), prop.rotation_quaternion.copy()
            put = {}
            first, last = min(keys), max(keys)
            for fr in range(1, self.frames + 1):
                if fr in keys:
                    loc, rot = keys[fr]
                elif fr < first:
                    loc, rot = getattr(prop, "_before", (base_loc, base_rot))
                else:
                    loc, rot = keys[last] if not prop.get("hnc_release") else (Vector(prop["hnc_release_loc"]), Quaternion(prop["hnc_release_rot"]))
                for i, v in enumerate(loc):
                    put.setdefault((prop, "location", i), []).append(v)
                for i, v in enumerate(rot):
                    put.setdefault((prop, "rotation_quaternion", i), []).append(v)
            write_tracks(put, self.frames)

    def hold_prop(self, prop, side, t0, t1, grip=None, grip_rot=(0, 0, 0)):
        """Attach ``prop`` to the hand from t0 to t1. ``grip=None`` (default) keeps the
        prop's pose relative to the hand at t0 (no pop on pickup); otherwise a grip
        offset in hand-bone space (metres / degrees)."""
        m = None if grip is None else Matrix.Translation(Vector(grip)) @ Euler([D(a) for a in grip_rot]).to_matrix().to_4x4()
        self.holds.append((prop, side, t0, t1, m))


def write_tracks(tracks, n):
    """Write sampled values (frame 1..n) as LINEAR keys, one action per ID."""
    by_id = {}
    for (idb, path, index), values in tracks.items():
        owner = idb.id_data
        full = path if owner is idb else f'{idb.path_from_id()}.{path}'
        by_id.setdefault(owner, []).append((full, index, values))
    for owner, curves in by_id.items():
        ad = owner.animation_data or owner.animation_data_create()
        action = ad.action
        if action is None:
            action = bpy.data.actions.new(f"{owner.name}.Perf")
            action["hnc_generated"] = True
            slot = action.slots.new(id_type=owner.id_type, name=owner.name)
            layer = action.layers.new("Performance")
            layer.strips.new(type="KEYFRAME")
            ad.action = action
            ad.action_slot = slot
        strip = action.layers[0].strips[0]
        bag = strip.channelbag(ad.action_slot, ensure=True)
        for path, index, values in curves:
            fc = bag.fcurves.find(path, index=index)
            if fc is not None:
                bag.fcurves.remove(fc)
            fc = bag.fcurves.new(path, index=index)
            fc.keyframe_points.add(len(values))
            co = []
            for i, v in enumerate(values):
                co += (i + 1, v)
            fc.keyframe_points.foreach_set("co", co)
            fc.keyframe_points.foreach_set("interpolation", [1] * len(values))  # LINEAR
            fc.update()


# ====================================================================== library
# Every function keys channels on a Performer and returns the time it ends.


def stance(p, t, pos, face=0.0, width=1.0, toe_out=7.0, e="smooth", feet=True):
    """Stand at ``pos`` facing ``face``: root + planted feet (shoulder width)."""
    x, y = pos[0], pos[1]
    z = pos[2] if len(pos) > 2 else 0.0
    p.key("pos", t, (x, y, z), e)
    p.key("face", t, face, e)
    if feet:
        for s, sign in (("L", 1), ("R", -1)):
            off = rot_z(face) @ Vector((p.dims["foot_x"][s] * width, 0.0, 0.0))
            p.key(f"foot.{s}", t, (x + off.x, y + off.y, z + p.dims["ankle"]), e)
            p.key(f"foot_rot.{s}", t, (face + sign * toe_out, 0.0), e)
    return t


def weight_shift(p, t, side="L", dur=0.9, amount=0.03):
    """Shift weight onto one leg: hips slide + drop the free hip (contrapposto)."""
    sign = 1 if side == "L" else -1
    p.key("hips", t + dur, (sign * amount, 0.0, -0.008), "soft")
    p.key("hips_rot", t + dur, (0.0, -sign * 2.2, sign * 2.0), "soft")
    p.key("chest", t + dur, (0.0, sign * 1.4, -sign * 1.0), "soft")
    return t + dur


def look(p, t, target, w=1.0, dur=0.45, eyes_lead=0.1, eyes=True, e="soft"):
    """Look at a world point: the eyes arrive first, the head follows and settles."""
    if eyes:
        p.hold("gaze_at", t)
        p.hold("gaze_w", t)
        p.key("gaze_at", t + dur * 0.4, tuple(target), "out")
        p.key("gaze_w", t + dur * 0.4, min(1.0, w + 0.2) if w > 0 else 0.0, "out")
    p.hold("look_at", t + eyes_lead)
    p.hold("look", t + eyes_lead)
    p.key("look_at", t + eyes_lead + dur, tuple(target), e)
    p.key("look", t + eyes_lead + dur, w, e)
    return t + eyes_lead + dur


def release_look(p, t, dur=0.5):
    p.hold("look", t)
    p.hold("gaze_w", t)
    p.key("look", t + dur, 0.0, "soft")
    p.key("gaze_w", t + dur * 0.6, 0.0, "soft")
    return t + dur


def glance(p, t, x, y=0.0, dur=0.18, hold=0.6, back=0.22, head=0.0):
    """Eyes-only look (side-eye); optional tiny head follow (deg)."""
    p.hold("gaze", t)
    p.key("gaze", t + dur, (x, y), "out")
    if head:
        p.hold("head", t + 0.05)
        h = p.ch["head"].at(t)
        p.key("head", t + dur + 0.15, (h[0], h[1], h[2] + head), "soft")
    if hold is not None:
        p.hold("gaze", t + dur + hold)
        p.key("gaze", t + dur + hold + back, (0.0, 0.0), "soft")
        if head:
            p.hold("head", t + dur + hold)
            p.key("head", t + dur + hold + back + 0.2, (h[0], h[1], h[2]), "soft")
    return t + dur + (hold or 0) + back


def smile(p, t, amount=0.55, dur=0.35, hold=None, tilt=2.5, nod=1.5):
    """The HNC smile is a body read: eyes squint a little, head tilts + drops a hair."""
    p.hold("squint", t)
    p.key("squint", t + dur, amount, "soft")
    h = p.ch["head"].at(t)
    p.hold("head", t)
    p.key("head", t + dur * 1.3, (h[0] + nod, h[1] + tilt, h[2]), "soft")
    if hold is not None:
        p.hold("squint", t + dur + hold)
        p.key("squint", t + dur + hold + 0.5, 0.0, "soft")
        p.hold("head", t + dur + hold)
        p.key("head", t + dur + hold + 0.6, h, "soft")
    return t + dur


def nod(p, t, depth=6.0, dur=0.42, count=1):
    h = p.ch["head"].at(t)
    p.hold("head", t)
    step = dur / (count * 2)
    tt = t
    for i in range(count):
        p.key("head", tt + step, (h[0] + depth * (1 - 0.3 * i), h[1], h[2]), "out")
        p.key("head", tt + 2 * step, (h[0], h[1], h[2]), "soft")
        tt += 2 * step
    return tt


def talk(p, t0, t1, beats, amount=1.0):
    """Speech body language for a mouthless HNC head (the line's caption names the speaker;
    this makes the picture agree): an inhale before the phrase, a small head beat on each
    stressed syllable of the actual take, a blink as the phrase lands. Additive on top of the
    shot's own acting. ``beats`` = [(t, strength 0..1)] in shot time (Shot.beats())."""
    p.key("talk_chest", t0 - 0.3, 0.0, "hold")
    p.key("talk_chest", t0 - 0.05, -1.6 * amount, "soft")
    p.key("talk_chest", t0 + 0.35, 0.0, "soft")
    for i, (bt, w) in enumerate(beats):
        side = 1 if i % 2 else -1
        p.key("talk", bt - 0.05, (0.0, 0.0, 0.0), "soft")
        p.key("talk", bt + 0.07, (2.4 * w * amount, 0.6 * side * w * amount, 0.9 * side * w * amount), "out")
        p.key("talk", bt + 0.24, (0.0, 0.0, 0.0), "soft")
    p.extra_blinks.append(t1 + 0.08)
    return t1


def arms(p, t, side, fwd, out, twist, elbow, e="soft"):
    p.key(f"arm.{side}", t, (fwd, out, twist, elbow), e)
    return t


def relax_arms(p, t, e="soft"):
    arms(p, t, "L", 0.0, 7.0, 0.0, 6.0, e)
    arms(p, t, "R", 0.0, 7.0, 0.0, 6.0, e)
    return t


def reach(p, t, side, target, dur=0.45, rot=(0, 0, 0), e="soft", w=1.0):
    """Hand IK to a world point (weight ramps with the move)."""
    p.hold(f"ik_hand.{side}", t)
    p.hold(f"hand.{side}", t)
    p.hold(f"hand_rot.{side}", t)
    if p.ch[f"ik_hand.{side}"].at(t) < 0.01:
        # Start the target where the FK hand is, so the blend is continuous.
        p.key(f"hand.{side}", t, tuple(p.hand_world(t, side)), "hold")
    p.key(f"hand.{side}", t + dur, tuple(target), e)
    p.key(f"hand_rot.{side}", t + dur, tuple(rot), e)
    p.key(f"ik_hand.{side}", t + dur * 0.7, w, "soft")
    return t + dur


def release(p, t, side, dur=0.4):
    p.hold(f"ik_hand.{side}", t)
    p.key(f"ik_hand.{side}", t + dur, 0.0, "soft")
    return t + dur


def sit(p, t, seat, face=0.0, seat_h=0.36, feet_fwd=0.34, width=1.05, lean=6.0, e="soft"):
    """Seated: hips on the seat, feet planted in front (knees bend through IK)."""
    x, y = seat[0], seat[1]
    z = seat[2] if len(seat) > 2 else 0.0
    p.key("pos", t, (x, y, z), e)
    p.key("face", t, face, e)
    drop = (seat_h + 0.12) - p.dims["hip"]  # hips 12 cm above the seat surface
    p.key("hips", t, (0.0, 0.0, drop), e)
    p.key("hips_rot", t, (lean, 0.0, 0.0), e)
    for s, sign in (("L", 1), ("R", -1)):
        off = rot_z(face) @ Vector((p.dims["foot_x"][s] * width, -feet_fwd, 0.0))
        p.key(f"foot.{s}", t, (x + off.x, y + off.y, z + p.dims["ankle"]), e)
        p.key(f"foot_rot.{s}", t, (face + sign * 6.0, 0.0), e)
    return t


def _hand_world(self, t, side):
    """Approximate FK hand position at time t (for IK blends): from the rest arm + channels."""
    d = self.dims
    fwd, out, tw, elb = self.ch[f"arm.{side}"].at(t)
    sign = -1 if side == "L" else 1
    L = d["arm_len"] / 2
    sh = Vector((d["hand_x"][side], 0.0, d["shoulder"] + self.ch["hips"].at(t)[2]))
    up = rot_x(-fwd) @ rot_y(sign * out)
    v1 = up @ Vector((0, 0, -L))
    v2 = up @ rot_x(-elb) @ Vector((0, 0, -L))
    local = sh + v1 + v2
    return Vector(self.ch["pos"].at(t)) + rot_z(self.ch["face"].at(t)) @ local


Performer.hand_world = _hand_world


GAITS = {
    # lift (m), pelvis lean (deg), arm amp (deg), elbow (deg), swing share of a step, bob scale
    "casual": dict(lift=0.07, lean=3.5, arm=13.0, elbow=18.0, swing=0.82, bob=1.0),
    "focused": dict(lift=0.085, lean=7.0, arm=16.0, elbow=22.0, swing=0.82, bob=1.0),
    "elder": dict(lift=0.045, lean=9.0, arm=8.0, elbow=20.0, swing=0.85, bob=0.6),
    "child": dict(lift=0.06, lean=3.0, arm=18.0, elbow=20.0, swing=0.8, bob=1.3),
    "jog": dict(lift=0.14, lean=9.0, arm=28.0, elbow=70.0, swing=0.92, bob=1.6),
    "sprint": dict(lift=0.24, lean=15.0, arm=42.0, elbow=85.0, swing=0.96, bob=2.2),
}


def walk(p, t0, path, stride=0.56, cadence=1.85, lead="L", style="casual", end_face=None, arms_swing=True):
    """Walk (or run) along ``path`` [(x, y), …] from the current root. Feet plant (no slide),
    hips bob/sway/rotate, arms counter-swing with overlap. Returns the end time."""
    g = GAITS[style]
    focused = style != "casual"
    start = Vector(p.ch["pos"].at(t0))
    z = start.z
    pts = [Vector((start.x, start.y))] + [Vector((x, y)) for x, y in path]
    seg = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
    total = sum(seg)
    if total < 1e-3:
        return t0
    n = max(2, math.ceil(total / stride))
    step = total / n
    T = 1.0 / cadence

    def at_dist(s):
        s = max(0.0, min(total, s))
        for i, L in enumerate(seg):
            if s <= L or i == len(seg) - 1:
                u = 0 if L == 0 else s / L
                a, b = pts[i], pts[i + 1]
                d = (b - a).normalized() if L > 0 else Vector((0, -1))
                return a.lerp(b, min(1, u)), d
            s -= L
        return pts[-1], (pts[-1] - pts[-2]).normalized()

    def heading(d):
        # face 0 = -Y; face = atan2 of direction measured CCW from -Y.
        return math.degrees(math.atan2(d.x, -d.y))

    # Step times: first and last steps are slower (accelerate / decelerate).
    durs = [T * (1.3 if i == 0 else 1.2 if i == n - 1 else 1.0) for i in range(n)]
    times = [t0]
    for dd in durs:
        times.append(times[-1] + dd)
    t_end = times[-1]
    face0 = p.ch["face"].at(t0)
    # Root: distance follows the steps, eased at both ends.
    p.hold("pos", t0)
    p.hold("face", t0)
    samples = max(2, int((t_end - t0) * 30))
    for k in range(1, samples + 1):
        u = k / samples
        tt = t0 + (t_end - t0) * u
        s = total * anim.ease("soft", u) if n <= 2 else total * (0.5 - 0.5 * math.cos(math.pi * u)) * 0.25 + total * u * 0.75
        pt, d = at_dist(s)
        p.key("pos", tt, (pt.x, pt.y, z), "linear")
        hd = heading(d)
        # unwrap to stay near the previous facing
        prev = p.ch["face"].at(tt - 1 / 30)
        while hd - prev > 180:
            hd -= 360
        while hd - prev < -180:
            hd += 360
        p.key("face", tt, prev + (hd - prev) * 0.35 if k < samples else hd, "linear")
    if end_face is not None:
        p.key("face", t_end + 0.35, end_face, "soft")
    # Feet.
    feet = {"L": Vector(p.ch["foot.L"].at(t0)), "R": Vector(p.ch["foot.R"].at(t0))}
    side = lead
    lift = g["lift"]
    for i in range(n):
        ts, te = times[i], times[i] + durs[i] * g["swing"]
        s_land = min(total, (i + 1) * step + (0.0 if i == n - 1 else step * 0.12))
        pt, d = at_dist(s_land)
        # The character's left when facing d is d rotated +90° CCW: (-d.y, d.x).
        sign = 1 if side == "L" else -1
        left = Vector((-d.y, d.x))
        land = pt + left * abs(p.dims["foot_x"][side]) * sign
        land3 = Vector((land.x, land.y, z + p.dims["ankle"]))
        fy = heading(d) + sign * 6.0
        name = f"foot.{side}"
        p.hold(name, ts)
        p.hold(f"foot_rot.{side}", ts)
        a = feet[side]
        m = 5
        for k in range(1, m + 1):
            u = k / m
            tt = ts + (te - ts) * u
            hpos = a.lerp(land3, anim.ease("soft", u))
            hpos.z += lift * math.sin(math.pi * min(1, u * 1.08)) ** 1.2
            p.key(name, tt, tuple(hpos), "linear" if k < m else "out")
        # heel-off (toe down) then toe-up before contact, flat on landing
        p.key(f"foot_rot.{side}", ts + (te - ts) * 0.25, (fy, -14.0), "out")
        p.key(f"foot_rot.{side}", ts + (te - ts) * 0.8, (fy, 9.0), "smooth")
        p.key(f"foot_rot.{side}", te + 0.05, (fy, 0.0), "out")
        feet[side] = land3
        # Hips: drop on contact, rise at passing; sway over the stance foot; rotate with the swing leg.
        other = "R" if side == "L" else "L"
        osign = 1 if other == "L" else -1
        lean = g["lean"]
        p.key("hips", ts + (te - ts) * 0.5, (osign * 0.016, 0.0, 0.012 * g["bob"]), "smooth")
        p.key("hips", te, (osign * 0.008, 0.0, -0.022 * g["bob"]), "smooth")
        p.key("hips_rot", ts + (te - ts) * 0.5, (lean, -osign * 1.6, sign * 5.5), "smooth")
        p.key("hips_rot", te, (lean, -osign * 0.6, sign * 3.0), "smooth")
        p.key("chest", ts + (te - ts) * 0.5, (1.5 if focused else 0.0, osign * 0.8, -sign * 4.0), "smooth")
        if arms_swing:
            amp = g["arm"]
            # Opposite arm swings forward with the swinging leg; overlap: arms lag ~0.07 s.
            lag = 0.07 if style != "sprint" else 0.03
            p.key(f"arm.{other}", ts + (te - ts) * 0.75 + lag, (amp, 9.0, 0.0, g["elbow"]), "smooth")
            p.key(f"arm.{side}", ts + (te - ts) * 0.75 + lag, (-amp * 0.7, 9.0, 0.0, g["elbow"] * 0.6), "smooth")
        side = other
    # Settle: feet together (last foot already placed beside), hips centre, arms relax.
    p.key("hips", t_end + 0.25, (0.0, 0.0, 0.0), "settle")
    p.key("hips_rot", t_end + 0.3, (0.0, 0.0, 0.0), "soft")
    p.key("chest", t_end + 0.35, (0.0, 0.0, 0.0), "soft")
    if arms_swing:
        relax_arms(p, t_end + 0.45)
    # Final foot: bring the trailing foot beside the leading one at stance width.
    pt, d = at_dist(total)
    fface = heading(d) if end_face is None else end_face
    stance(p, t_end + 0.35, (pt.x, pt.y, z), fface, e="soft", feet=False)
    for s2, sgn in (("L", 1), ("R", -1)):
        off = rot_z(fface) @ Vector((p.dims["foot_x"][s2], 0.0, 0.0))
        target = (pt.x + off.x, pt.y + off.y, z + p.dims["ankle"])
        cur = Vector(p.ch[f"foot.{s2}"].at(t_end))
        if (cur - Vector(target)).length > 0.05:
            p.hold(f"foot.{s2}", t_end)
            mid = cur.lerp(Vector(target), 0.5)
            mid.z += 0.04
            p.key(f"foot.{s2}", t_end + 0.18, tuple(mid), "smooth")
            p.key(f"foot.{s2}", t_end + 0.34, target, "out")
        p.key(f"foot_rot.{s2}", t_end + 0.34, (fface + sgn * 7.0, 0.0), "soft")
    return t_end + 0.4


def sit_down(p, t, seat, face, seat_h=0.36, dur=1.15, lean=6.0, hands="lap"):
    """Stand -> sit on a seat behind the character. Anticipation: lean forward
    and push the hips back; descend with control; settle into the backrest.
    Feet stay planted (IK) — stand ``feet_fwd`` in front of the seat first."""
    x, y = seat[0], seat[1]
    z = seat[2] if len(seat) > 2 else 0.0
    for ch in ("pos", "hips", "hips_rot", "chest", "arm.L", "arm.R", "neck"):
        p.hold(ch, t)
    p0 = Vector(p.ch["pos"].at(t))
    drop = (seat_h + 0.12) - p.dims["hip"]
    # 1. anticipation: chest forward over the feet, hips start back, arms reach forward to balance
    a = t + dur * 0.32
    p.key("hips_rot", a, (24.0, 0.0, 0.0), "soft")
    p.key("hips", a, (0.0, 0.0, drop * 0.2), "soft")
    p.key("pos", a, tuple(p0.lerp(Vector((x, y, z)), 0.25)), "soft")
    p.key("neck", a, (-10.0, 0.0, 0.0), "soft")  # keep the eyes level while the body tips
    arms(p, a, "L", 22.0, 10.0, 0.0, 30.0)
    arms(p, a, "R", 22.0, 10.0, 0.0, 30.0)
    # 2. controlled descent onto the seat
    b = t + dur * 0.78
    p.key("pos", b, (x, y, z), "smooth")
    p.key("hips", b, (0.0, 0.0, drop - 0.012), "in")
    p.key("hips_rot", b, (18.0, 0.0, 0.0), "smooth")
    p.key("face", b, face, "smooth")
    # 3. weight lands and settles back
    c = t + dur
    p.key("hips", c + 0.12, (0.0, 0.0, drop), "settle")
    p.key("hips_rot", c + 0.35, (lean, 0.0, 0.0), "soft")
    p.key("neck", c + 0.35, (0.0, 0.0, 0.0), "soft")
    if hands == "lap":
        arms(p, c + 0.3, "L", 32.0, 9.0, 0.0, 52.0)
        arms(p, c + 0.3, "R", 32.0, 9.0, 0.0, 52.0)
    return c + 0.35


def stand_up(p, t, to, face, dur=1.0):
    """Seated -> standing at ``to`` (feet already there): lean, push, rise, settle."""
    x, y = to[0], to[1]
    z = to[2] if len(to) > 2 else 0.0
    for ch in ("pos", "hips", "hips_rot", "arm.L", "arm.R", "neck"):
        p.hold(ch, t)
    a = t + dur * 0.35
    p.key("hips_rot", a, (26.0, 0.0, 0.0), "soft")
    p.key("neck", a, (-12.0, 0.0, 0.0), "soft")
    arms(p, a, "L", 18.0, 10.0, 0.0, 30.0)
    arms(p, a, "R", 18.0, 10.0, 0.0, 30.0)
    b = t + dur * 0.85
    p.key("pos", b, (x, y, z), "smooth")
    p.key("hips", b, (0.0, 0.0, -0.01), "out")
    p.key("hips_rot", b, (6.0, 0.0, 0.0), "smooth")
    p.key("face", b, face, "smooth")
    c = t + dur
    p.key("hips", c + 0.15, (0.0, 0.0, 0.0), "settle")
    p.key("hips_rot", c + 0.3, (0.0, 0.0, 0.0), "soft")
    p.key("neck", c + 0.3, (0.0, 0.0, 0.0), "soft")
    relax_arms(p, c + 0.35)
    return c + 0.35


def lie(p, t, pos, face=0.0, on="back", e="hold"):
    """Lying down (bed / sofa): the whole body tilts; legs go FK-straight (IK off)."""
    p.key("pos", t, tuple(pos), e)
    p.key("face", t, face, e)
    p.key("tilt", t, (-90.0, 0.0) if on == "back" else (-90.0, 0.0), e)
    for s in "LR":
        p.key(f"ik_foot.{s}", t, 0.0, e)
        p.key(f"leg.{s}", t, (0.0, 3.0, 4.0), e)
    arms(p, t, "L", 0.0, 4.0, 0.0, 10.0, e)
    arms(p, t, "R", 0.0, 4.0, 0.0, 10.0, e)
    return t


def point_at(p, t, side, target, dur=0.35, hold=None, e="out"):
    """Point with a straight arm (HNC arms are the finger): IK hand along the line to target."""
    d = p.dims
    sign = 1 if side == "L" else -1
    sh = p.char_point(t, (sign * abs(d["hand_x"][side]) * 0.85, 0.0, d["shoulder"] + p.ch["hips"].at(t)[2]))
    v = (Vector(target) - sh)
    v.normalize()
    reach(p, t, side, tuple(sh + v * d["arm_len"] * 0.93), dur=dur, e=e)
    if hold is not None:
        release(p, t + dur + hold, side, 0.4)
    return t + dur


def heading(frm, to):
    """Facing (deg, 0 = -Y, CCW +) that points from ``frm`` toward ``to`` on the floor."""
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    return math.degrees(math.atan2(dx, -dy))


def kneel(p, t, pos, face, e="soft", front="L"):
    """Down on one knee (goodbyes, laces): front foot planted ahead, back knee near the floor."""
    x, y = pos[0], pos[1]
    back = "R" if front == "L" else "L"
    fwd = rot_z(face) @ Vector((0, -1, 0))
    side = rot_z(face) @ Vector((1, 0, 0))
    ank = p.dims["ankle"]
    p.key("pos", t, (x, y, 0.0), e)
    p.key("face", t, face, e)
    p.key("hips", t, (0.0, 0.0, -(p.dims["hip"] - p.dims["leg_len"] * 0.55)), e)
    p.key("hips_rot", t, (10.0, 0.0, 0.0), e)
    fs = 1 if front == "L" else -1
    f_at = Vector((x, y, ank)) + fwd * 0.42 + side * fs * p.dims["foot_x"]["L"] * 0.9
    b_at = Vector((x, y, ank + 0.02)) - fwd * 0.3 + side * -fs * p.dims["foot_x"]["L"] * 0.9
    p.key(f"foot.{front}", t, tuple(f_at), e)
    p.key(f"foot_rot.{front}", t, (face, 0.0), e)
    p.key(f"foot.{back}", t, tuple(b_at), e)
    p.key(f"foot_rot.{back}", t, (face, -55.0), e)
    return t
