"""Cameras: physical lenses, focus, moves and documentary handheld.

Portrait framing uses a 36 mm sensor on the long (vertical) side, so lens
choices mean what they mean on a full-frame camera turned on its side.
Moves are sampled per frame (same channel maths as performances), so a push,
a dolly and a handheld layer compose without Blender's auto handles.
"""
import math

import bpy
from mathutils import Euler, Vector

from . import anim
from .anim import Channel
from .look import tag
from .perform import write_tracks

# Handheld styles: rotation amplitude (deg) and frequencies. "Operated by a
# professional crew": low amplitude, slow sway, a little faster texture.
HANDHELD = {
    "none": (0.0, 0.0),
    "locked": (0.05, 0.3),  # tripod on a vibrating floor
    "subtle": (0.22, 0.45),
    "observational": (0.4, 0.5),
    "follow": (0.6, 0.7),
}


class Cam:
    def __init__(self, col, name, lens=35.0, fstop=None, frames=120, fps=60, seed=0):
        cam = tag(bpy.data.cameras.new(name))
        cam.lens = lens
        cam.sensor_fit = "AUTO"
        cam.sensor_width = 36.0
        cam.clip_start, cam.clip_end = 0.03, 400.0
        self.obj = tag(bpy.data.objects.new(name, cam))
        col.objects.link(self.obj)
        self.focus = tag(bpy.data.objects.new(f"{name}.Focus", None))
        col.objects.link(self.focus)
        if fstop:
            cam.dof.use_dof = True
            cam.dof.aperture_fstop = fstop
            cam.dof.aperture_blades = 7
            cam.dof.focus_object = self.focus
        self.frames, self.fps, self.seed = frames, fps, seed
        self.pos = Channel((0.0, -3.0, 1.5))
        self.target = Channel((0.0, 0.0, 1.2))
        self.focus_at = Channel((0.0, 0.0, 1.2))
        self.lens = Channel(lens)
        self.roll = Channel(0.0)
        self.hand = Channel(0.0)  # handheld amplitude multiplier
        self.style = "none"
        self.shake = Channel(0.0)  # impact shake (deg), decays
        self.focus_obj = None  # track a moving object for focus instead of a point

    def place(self, t, pos, target, focus=None, e="smooth"):
        self.pos.key(t, tuple(pos), e)
        self.target.key(t, tuple(target), e)
        self.focus_at.key(t, tuple(focus if focus is not None else target), e)
        return self

    def handheld(self, style="subtle", amount=1.0):
        self.style = style
        self.hand.key(0.0, amount, "linear")
        return self

    def bake(self):
        amp, freq = HANDHELD[self.style]
        tracks = {}

        def put(idb, path, vals):
            for i, v in enumerate(vals):
                tracks.setdefault((idb, path, i), []).append(float(v))

        prev = None
        for f in range(1, self.frames + 1):
            t = (f - 1) / self.fps
            p = Vector(self.pos.at(t))
            tg = Vector(self.target.at(t))
            d = tg - p
            q = d.to_track_quat("-Z", "Y")
            e = q.to_euler()
            a = amp * self.hand.at(t)
            s = self.shake.at(t)
            rx = a * anim.fbm(t, freq, self.seed + 11) + s * anim.value_noise(t, 18, self.seed + 3)
            ry = a * 0.6 * anim.fbm(t, freq * 0.8, self.seed + 12) + s * 0.5 * anim.value_noise(t, 16, self.seed + 4)
            rz = a * 0.5 * anim.fbm(t, freq * 0.7, self.seed + 13) + self.roll.at(t)
            # Handheld also breathes the position a little (the operator's body).
            p = p + Vector((anim.fbm(t, freq * 0.6, self.seed + 14), 0, anim.fbm(t, freq * 0.5, self.seed + 15))) * a * 0.004
            put(self.obj, "location", p)
            m = e.to_matrix() @ Euler((math.radians(rx), math.radians(ry), math.radians(rz))).to_matrix()
            eul = m.to_euler("XYZ", prev) if prev is not None else m.to_euler()
            prev = eul
            put(self.obj, "rotation_euler", eul)
            put(self.obj.data, "lens", (self.lens.at(t),))
            if self.focus_obj is None:
                put(self.focus, "location", self.focus_at.at(t))
        write_tracks(tracks, self.frames)
        if self.focus_obj is not None:
            self.obj.data.dof.focus_object = self.focus_obj
        return self.obj


def impact(cam, t, strength=1.2, decay=0.25):
    """Short decaying shake (strike, door slam)."""
    cam.shake.key(t - 0.001, 0.0, "hold")
    cam.shake.key(t + 0.02, strength, "out")
    cam.shake.key(t + decay, 0.0, "out")


# Horizontal coverage (m) of standard shot sizes, calibrated for HNC people:
# adult heads are ~0.64 m wide, so a "close-up" is wider than on a human.
SIZES = dict(ECU=0.55, CU=0.9, MCU=1.3, MS=1.9, MWS=2.8, WS=4.5, EWS=9.0)


def distance_for(size, lens):
    """Camera distance so a 9:16 frame (36 mm vertical sensor) covers ``size`` horizontally."""
    w = SIZES.get(size, size) if isinstance(size, str) else size
    return w * lens / 20.25, w


def frame(cam, t, subject, size, lens=None, heading=0.0, el=4.0, headroom=True, e="smooth", focus=None, aim=None):
    """Place the camera for a shot size around ``subject`` (usually a head).

    heading: world direction from the subject to the camera (0 = camera at -Y of it, CCW +).
    el: camera elevation (deg, + looks down on the subject). With ``headroom`` the
    subject sits on the upper third of the tall frame instead of the centre.
    """
    import math as _m
    lens = lens or cam.lens.at(t)
    dist, w = distance_for(size, lens)
    s = Vector(subject)
    h = _m.radians(heading)
    d = Vector((_m.sin(h), -_m.cos(h), 0.0))
    pos = s + d * dist * _m.cos(_m.radians(el)) + Vector((0, 0, dist * _m.sin(_m.radians(el))))
    tgt = Vector(aim) if aim is not None else s + (Vector((0, 0, -0.17 * w * 16 / 9)) if headroom else Vector())
    cam.place(t, pos, tgt, focus=focus if focus is not None else s, e=e)
    return pos
