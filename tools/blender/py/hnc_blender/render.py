"""Verification still rendering (deterministic: fixed samples, fixed seed, no time input)."""
import time

import bpy

from . import scene as hnc_scene
from .paths import RENDERS, inside_repo, rel


def render_shot(scene, shot_id, out=None, suffix=""):
    out = inside_repo(out or RENDERS / f"{shot_id}{suffix}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    previous = scene.get("hnc_shot", hnc_scene.DEFAULT_SHOT)
    hnc_scene.apply_shot(scene, shot_id)
    scene.render.filepath = str(out)
    t0 = time.perf_counter()
    try:
        bpy.ops.render.render(write_still=True, scene=scene.name)
    finally:
        hnc_scene.apply_shot(scene, previous)
    return {"shot": shot_id, "file": rel(out), "engine": scene.render.engine,
            "seconds": round(time.perf_counter() - t0, 2)}


def render_turntable(scene, out=None, frames=120):
    """One linear 360° turn of the player (2 s @ 60 fps) under the cinematic rig -> H.264 MP4.

    Uses a temporary pivot; the scene is restored afterwards (nothing is saved).
    """
    out = inside_repo(out or RENDERS / "04-player-turntable.mp4")
    out.parent.mkdir(parents=True, exist_ok=True)
    player = next(o for o in scene.objects if o.get("hncFactory") == "createHncPlayerVisual")
    r, im = scene.render, scene.render.image_settings
    saved = (scene.camera, r.filepath, im.media_type, im.file_format, scene.frame_start, scene.frame_end,
             scene.get("hnc_shot", hnc_scene.DEFAULT_SHOT))
    hnc_scene.apply_shot(scene, "03-player-ball")
    for o in (scene.objects["HNC_Ball"], *scene.objects["HNC_Ball"].children_recursive):
        o.hide_render = True
    scene.camera = scene.objects["CAM_FullBody_50mm"]
    pivot = bpy.data.objects.new("TMP_TurntablePivot", None)
    scene.collection.objects.link(pivot)
    player.parent = pivot
    pivot.rotation_euler = (0, 0, 0)
    pivot.keyframe_insert("rotation_euler", index=2, frame=1)
    pivot.rotation_euler = (0, 0, 6.283185307179586)
    pivot.keyframe_insert("rotation_euler", index=2, frame=frames + 1)  # frame N+1 == frame 1: seamless loop
    _linear_keys(pivot)
    scene.frame_start, scene.frame_end = 1, frames
    im.media_type = "VIDEO"
    im.file_format = "FFMPEG"
    r.ffmpeg.format, r.ffmpeg.codec = "MPEG4", "H264"
    r.ffmpeg.constant_rate_factor, r.ffmpeg.ffmpeg_preset = "HIGH", "GOOD"
    r.ffmpeg.audio_codec = "NONE"
    r.filepath = str(out)
    t0 = time.perf_counter()
    try:
        bpy.ops.render.render(animation=True, scene=scene.name)
    finally:
        scene.frame_set(1)
        player.parent = None
        action = pivot.animation_data.action
        bpy.data.objects.remove(pivot)
        bpy.data.actions.remove(action)
        (scene.camera, r.filepath, im.media_type, im.file_format, scene.frame_start, scene.frame_end, shot) = saved
        hnc_scene.apply_shot(scene, shot)
    return {"file": rel(out), "frames": frames, "fps": scene.render.fps, "seconds": round(time.perf_counter() - t0, 2)}


def _linear_keys(obj):
    """Linear interpolation for every key (layered actions in Blender 5.x keep F-curves in channelbags)."""
    action = obj.animation_data.action
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(bag.fcurves)
    for fc in curves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"
