"""Metadata-only 30→60 timing regression check; does not render frames."""
import importlib
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender" / "py"))
from hnc_blender.diaries.shot import Shot
from hnc_blender.diaries.retime import retime_scene
from hnc_blender.cine import look

EP = "italy-rematch"
SHOTS = ("S00_SH02", "S05_SH01", "S08_SH01", "S10_SH01", "S11_SH01", "S14_SH01")


def curves():
    out = []
    for action in bpy.data.actions:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out.extend((c.data_path, c.array_index, tuple(round(k.co.x, 5) for k in c.keyframe_points)) for c in bag.fcurves)
    return sorted(out)


for shot_id in SHOTS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Source modules intentionally cache image datablocks; factory reset removes
    # those datablocks between representative-shot checks.
    look._cache.clear()
    scene = bpy.context.scene
    ep = importlib.import_module("hnc_blender.diaries.italy_rematch")
    shot = Shot(scene, EP, shot_id, "final60")
    ep.SHOTS[shot_id](shot)
    before = curves()
    authored_end = scene.frame_end
    retime_scene(scene, 30, 60)
    after = curves()
    assert scene.frame_end == authored_end * 2, (shot_id, scene.frame_end, authored_end)
    assert len(before) == len(after), shot_id
    for a, b in zip(before, after):
        assert a[:2] == b[:2] and len(a[2]) == len(b[2]), shot_id
        assert all(abs(y - x * 2) < .001 for x, y in zip(a[2], b[2])), (shot_id, a, b)
    print(f"PASS {shot_id}: {authored_end}/30s -> {scene.frame_end}/60s; all action keys retimed")

# The end card is Remotion-only: timeline rounding must remain 48.5 seconds.
import json
edit = json.load(open("packages/reels/src/diaries/italy-rematch/edit.json"))
total = sum(round(s["dur"] * 60) for s in edit["shots"])
assert total == 2910, total
print("PASS S16_SH01: Remotion delivery timeline is 2910 frames at 60fps")
