"""Football performance: touches, the strike, the ball's flight.

Cinematic, not game-level: the shooter plants beside the ball, the hips
wind and unwind, the arms counterbalance, the kicking leg whips through
contact (knee bends via IK), follows through high and the weight recovers
onto the kicking foot. The canonical HNC ball travels on authored physics
(parabola, roll friction, spin from speed).
"""
import math

from mathutils import Vector

from . import perform as P
from .perform import rot_z, write_tracks

BALL_R = 0.25  # HNC_BALL_RADIUS (packages/hnc-visuals/src/ball/create-ball.ts; manifest params.radius)


class BallPath:
    """Piecewise ball motion: rest / roll / flight segments, sampled per frame."""

    def __init__(self, ball, frames, fps, radius=BALL_R):
        self.ball, self.frames, self.fps, self.r = ball, frames, fps, radius
        self.segs = []  # (t0, t1, fn(t)->Vector)

    def rest(self, t0, t1, pos):
        p = Vector(pos)
        self.segs.append((t0, t1, lambda t: p.copy()))
        return self

    def roll(self, t0, t1, a, b, ease="out"):
        a, b = Vector(a), Vector(b)
        from .anim import ease as E
        self.segs.append((t0, t1, lambda t: a.lerp(b, E(ease, (t - t0) / max(1e-6, t1 - t0)))))
        return self

    def flight(self, t0, t1, a, b, apex):
        a, b = Vector(a), Vector(b)

        def fn(t):
            u = (t - t0) / max(1e-6, t1 - t0)
            v = a.lerp(b, u)
            v.z += apex * 4 * u * (1 - u)
            return v
        self.segs.append((t0, t1, fn))
        return self

    def drop(self, t0, pos_from, pos_to, bounces=2, e=0.45):
        """Fall + bounces to rest at pos_to (ground contact), starting at t0."""
        a, b = Vector(pos_from), Vector(pos_to)
        g = 9.81
        h = a.z - b.z
        t_fall = math.sqrt(2 * max(1e-4, h) / g)
        segs = [(t0, t0 + t_fall, lambda t, a=a, b=b, T=t_fall: Vector((b.x, b.y, a.z - 0.5 * g * (t - t0) ** 2)))]
        tt = t0 + t_fall
        v = g * t_fall * e
        for _ in range(bounces):
            T = 2 * v / g
            segs.append((tt, tt + T, lambda t, t_s=tt, v=v: Vector((b.x, b.y, b.z + v * (t - t_s) - 0.5 * g * (t - t_s) ** 2))))
            tt += T
            v *= e
        segs.append((tt, 1e9, lambda t: b.copy()))
        self.segs += segs
        return tt

    def bake(self):
        tr = {}
        prev = None
        spin = 0.0
        axis = Vector((1, 0, 0))
        from mathutils import Quaternion
        q = Quaternion()
        for f in range(1, self.frames + 1):
            t = (f - 1) / self.fps
            pos = None
            for t0, t1, fn in self.segs:
                if t0 <= t <= t1:
                    pos = fn(t)
            if pos is None:
                pos = self.segs[-1][2](self.segs[-1][1]) if self.segs else Vector()
            if prev is not None:
                d = pos - prev
                horiz = Vector((d.x, d.y, 0))
                if horiz.length > 1e-5:
                    axis = Vector((0, 0, 1)).cross(horiz).normalized()
                    q = Quaternion(axis, horiz.length / self.r) @ q
            prev = pos
            for i, v in enumerate(pos):
                tr.setdefault((self.ball, "location", i), []).append(v)
            for i, v in enumerate(q):
                tr.setdefault((self.ball, "rotation_quaternion", i), []).append(v)
        self.ball.rotation_mode = "QUATERNION"
        write_tracks(tr, self.frames)


def strike(p, t_contact, ball_pos, direction, side="R", power=1.0):
    """Instep drive through the ball at t_contact. The performer must already be
    standing ~1 m behind the ball. Returns t of recovery."""
    d = Vector(direction).normalized()
    d.z = 0
    left = Vector((-d.y, d.x, 0))
    face = math.degrees(math.atan2(d.x, -d.y))
    kick, plant = (side, "L" if side == "R" else "R")
    ks = 1 if kick == "L" else -1  # kicking side offset direction (character left = +)
    b = Vector(ball_pos)
    ank = p.dims["ankle"]
    t0 = t_contact - 0.62
    # approach step: body moves to beside/behind the ball
    body_at = b - d * 0.62 + left * (-ks * 0.32)
    P.stance(p, t0, (body_at.x - d.x * 0.5, body_at.y - d.y * 0.5, 0.0), face, e="hold")
    p.key("pos", t_contact - 0.25, (body_at.x, body_at.y, 0.0), "smooth")
    p.key("pos", t_contact + 0.25, tuple(body_at + d * 0.35), "out")
    p.key("pos", t_contact + 0.6, tuple(body_at + d * 0.55), "soft")
    # plant foot lands beside the ball, a little behind it
    plant_at = b - d * 0.1 - left * ks * 0.34  # beside the ball, on the non-kicking side
    p.hold(f"foot.{plant}", t0 + 0.05)
    mid = Vector(p.ch[f"foot.{plant}"].at(t0)).lerp(Vector((plant_at.x, plant_at.y, ank)), 0.5)
    p.key(f"foot.{plant}", t_contact - 0.34, (mid.x, mid.y, ank + 0.1), "smooth")
    p.key(f"foot.{plant}", t_contact - 0.2, (plant_at.x, plant_at.y, ank), "out")
    p.key(f"foot_rot.{plant}", t_contact - 0.2, (face, 0.0), "out")
    # kicking foot: back-swing (knee folds), whip through contact, follow-through high, land
    kf = f"foot.{kick}"
    p.hold(kf, t_contact - 0.4)
    back = b - d * 0.72 + Vector((0, 0, 0.42 * power)) - left * ks * 0.18
    p.key(kf, t_contact - 0.14, tuple(back), "out")
    p.key(f"foot_rot.{kick}", t_contact - 0.14, (face - ks * 10, -40.0), "out")
    hit = b + Vector((0, 0, -BALL_R * 0.35)) - d * BALL_R * 0.8
    p.key(kf, t_contact, (hit.x, hit.y, max(ank, hit.z)), "in")
    p.key(f"foot_rot.{kick}", t_contact, (face, -55.0), "in")
    ft = b + d * 0.75 + Vector((0, 0, 0.75 * power))
    p.key(kf, t_contact + 0.18, tuple(ft), "out")
    land = b + d * 0.62 + left * ks * 0.15
    p.key(kf, t_contact + 0.48, (land.x, land.y, ank), "smooth")
    p.key(f"foot_rot.{kick}", t_contact + 0.48, (face, 0.0), "smooth")
    # hips wind open then unwind hard; chest counter-rotates; lean over the ball then back
    # yaw + = turn left; a right-foot strike (ks = -1) winds right first, then unwinds left
    p.key("hips_rot", t_contact - 0.2, (8.0, ks * 6.0, ks * 22.0), "soft")
    p.key("hips_rot", t_contact, (14.0, ks * 3.0, -ks * 18.0), "in")
    p.key("hips_rot", t_contact + 0.2, (-6.0, 0.0, -ks * 30.0), "out")
    p.key("hips_rot", t_contact + 0.6, (4.0, 0.0, 0.0), "soft")
    p.key("hips", t_contact - 0.2, (0.0, 0.0, -0.05), "soft")
    p.key("hips", t_contact + 0.18, (0.0, 0.0, 0.03), "out")
    p.key("hips", t_contact + 0.55, (0.0, 0.0, 0.0), "settle")
    p.key("chest", t_contact - 0.2, (6.0, 0.0, -ks * 14.0), "soft")
    p.key("chest", t_contact + 0.15, (2.0, 0.0, ks * 12.0), "out")
    p.key("chest", t_contact + 0.6, (0.0, 0.0, 0.0), "soft")
    # arms: the plant-side arm flies out for balance, the kick-side arm swings back
    P.arms(p, t_contact - 0.2, plant, 35.0, 55.0, 0.0, 25.0)
    P.arms(p, t_contact - 0.2, kick, -20.0, 30.0, 0.0, 20.0)
    P.arms(p, t_contact + 0.15, plant, -10.0, 70.0, 0.0, 30.0, e="out")
    P.arms(p, t_contact + 0.15, kick, 30.0, 35.0, 0.0, 35.0, e="out")
    P.relax_arms(p, t_contact + 0.8)
    # head stays down on the ball through contact, then lifts to follow it
    P.look(p, t_contact - 0.5, b, w=0.9, dur=0.2, eyes_lead=0.05)
    p.key("look_at", t_contact + 0.05, tuple(b), "hold")
    return t_contact + 0.6


def touch(p, t, side, ball_at, cushion=0.12):
    """A first touch: the foot meets the ball and gives with it."""
    b = Vector(ball_at)
    kf = f"foot.{side}"
    ank = p.dims["ankle"]
    p.hold(kf, t - 0.25)
    face = p.ch["face"].at(t)
    p.key(kf, t - 0.02, (b.x, b.y + 0.25, ank + 0.08), "soft")
    p.key(f"foot_rot.{side}", t - 0.02, (face, 12.0), "soft")
    p.key(kf, t + cushion, (b.x, b.y + 0.35, ank + 0.02), "out")
    p.key(f"foot_rot.{side}", t + cushion + 0.1, (face, 0.0), "soft")
    return t + cushion
