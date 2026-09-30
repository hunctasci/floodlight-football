"""Rig self-test: every semantic channel must move the body the way its name says.

    blender -b --factory-startup --python tools/blender/py/hnc_cli.py -- rig-selftest

Drives one channel at a time on a freshly rigged TR #9 and checks evaluated
world positions (character faces -Y, its left is +X, Z up).
"""
import bpy
from mathutils import Vector

from . import cast
from . import perform as P


def _world(p, bone, tail=True):
    pb = p.rig.arm.pose.bones[bone]
    return p.rig.arm.matrix_world @ (pb.tail if tail else pb.head)


def run(scene):
    col = bpy.data.collections.new("SELFTEST")
    scene.collection.children.link(col)
    p = cast.person(scene, col, "TR-PLAYER-09", "home", frames=2)
    p.prof = dict(breath=0, drift=0, sway=0, blink=0)
    results = []

    def probe(label, setup, measure, check):
        for name, ch in p.ch.items():  # reset
            ch.keys, ch._times = [], []
        P.stance(p, 0.0, (0, 0, 0), 0.0, toe_out=0.0)
        base = None
        p.bake()
        scene.frame_set(1)
        base = measure()
        for name, ch in p.ch.items():
            ch.keys, ch._times = [], []
        P.stance(p, 0.0, (0, 0, 0), 0.0, toe_out=0.0)
        setup()
        p.bake()
        scene.frame_set(2)
        scene.frame_set(1)
        got = measure()
        d = got - base
        ok = check(d)
        results.append((label, ok, tuple(round(x, 3) for x in d)))

    hand = lambda s: (lambda: _world(p, f"hand.{s}", tail=False))
    probe("arm.L fwd moves the left hand forward (-Y) and up", lambda: p.key("arm.L", 0, (60, 7, 0, 6)), hand("L"), lambda d: d.y < -0.2 and d.z > 0.05)
    probe("arm.R fwd moves the right hand forward (-Y) and up", lambda: p.key("arm.R", 0, (60, 7, 0, 6)), hand("R"), lambda d: d.y < -0.2 and d.z > 0.05)
    probe("arm.L out moves the left hand out (+X)", lambda: p.key("arm.L", 0, (0, 60, 0, 6)), hand("L"), lambda d: d.x > 0.2)
    probe("arm.R out moves the right hand out (-X)", lambda: p.key("arm.R", 0, (0, 60, 0, 6)), hand("R"), lambda d: d.x < -0.2)
    probe("arm.L elbow bends the forearm forward", lambda: p.key("arm.L", 0, (0, 7, 0, 90)), hand("L"), lambda d: d.y < -0.2 and abs(d.x) < 0.1)
    probe("arm.R elbow bends the forearm forward", lambda: p.key("arm.R", 0, (0, 7, 0, 90)), hand("R"), lambda d: d.y < -0.2 and abs(d.x) < 0.1)
    head = lambda: p.rig.parts["head"].matrix_world @ Vector((0, -0.3, 0))
    probe("neck yaw + turns the face to the character's left (+X)", lambda: p.key("neck", 0, (0, 0, 40)), head, lambda d: d.x > 0.1)
    probe("neck pitch + nods the face down", lambda: p.key("neck", 0, (30, 0, 0)), head, lambda d: d.z < -0.05)
    probe("hips pitch + leans the body forward", lambda: p.key("hips_rot", 0, (25, 0, 0)), lambda: _world(p, "spine"), lambda d: d.y < -0.15)
    probe("hips dz lowers the body (knees bend forward)", lambda: p.key("hips", 0, (0, 0, -0.2)), lambda: _world(p, "thigh.L"), lambda d: d.y < -0.05)
    eye = lambda: p.rig.parts["eyes[1]"].matrix_world.translation.copy()
    probe("gaze x + moves the eyes to the character's left", lambda: p.key("gaze", 0, (1, 0)), eye, lambda d: d.x > 0.02)
    probe("face + turns the whole body to its left", lambda: P.stance(p, 0.0, (0, 0, 0), 90.0), head, lambda d: d.x > 0.2)
    for label, ok, d in results:
        print(("PASS " if ok else "FAIL ") + label + f"  Δ={d}")
    return all(ok for _l, ok, _d in results)
