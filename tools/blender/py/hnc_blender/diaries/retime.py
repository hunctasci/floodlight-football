"""Deterministically retime an authored Blender diary scene without changing seconds.

Italy-rematch builders mix seconds-aware helpers with explicit 30 fps frame keys.
They are therefore always built on the authored edit timebase, then this module
scales every frame-domain datum before rendering at a different delivery fps.
"""
import bpy


def _scale(value, factor):
    return value * factor


def _retime_action(action, factor):
    # Blender 5.2's slotted/layered Action API removed Action.fcurves.
    # Older files can still expose it, so accept both representations.
    if hasattr(action, "fcurves"):
        curves = action.fcurves
    else:
        curves = []
        for layer in action.layers:
            for strip in layer.strips:
                if hasattr(strip, "channelbags"):
                    for bag in strip.channelbags:
                        curves.extend(bag.fcurves)
    for curve in curves:
        for key in curve.keyframe_points:
            key.co.x = _scale(key.co.x, factor)
            key.handle_left.x = _scale(key.handle_left.x, factor)
            key.handle_right.x = _scale(key.handle_right.x, factor)
        for sample in curve.sampled_points:
            sample.co.x = _scale(sample.co.x, factor)
        curve.update()


def _retime_cache(cache, factor):
    if cache is None:
        return
    for attr in ("frame_start", "frame_end"):
        if hasattr(cache, attr):
            setattr(cache, attr, round(_scale(getattr(cache, attr), factor)))


def retime_scene(scene, source_fps, target_fps):
    """Scale all known Blender frame-domain timing from source to target fps.

    The scene is generated at ``source_fps`` first. Scaling complete F-curves,
    cache ranges, particles, markers and frame bounds afterwards prevents a
    direct ``scene.render.fps = 60`` from making authored frame values play
    twice as fast. Rigid bodies are not baked here: Blender evaluates them at
    the target scene fps, while their kinematic handoff keys are retimed.
    """
    if source_fps == target_fps:
        return
    factor = target_fps / source_fps
    for action in bpy.data.actions:
        _retime_action(action, factor)
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            _retime_cache(getattr(mod, "point_cache", None), factor)
        for ps in obj.particle_systems:
            settings = ps.settings
            for attr in ("frame_start", "frame_end", "lifetime"):
                if hasattr(settings, attr):
                    setattr(settings, attr, _scale(getattr(settings, attr), factor))
            _retime_cache(getattr(ps, "point_cache", None), factor)
    _retime_cache(getattr(getattr(scene, "rigidbody_world", None), "point_cache", None), factor)
    for marker in scene.timeline_markers:
        marker.frame = round(_scale(marker.frame, factor))
    scene.frame_start = round(_scale(scene.frame_start, factor))
    scene.frame_end = round(_scale(scene.frame_end, factor))
    scene.render.fps = target_fps
    scene.render.fps_base = 1.0
    scene["hnc_timebase"] = {"authored_fps": source_fps, "delivery_fps": target_fps, "factor": factor}
