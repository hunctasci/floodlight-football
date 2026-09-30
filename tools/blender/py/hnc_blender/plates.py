"""Plates: HNC shots rendered in Blender for the Reel Factory's `plate` world.

A plate is built from generated inputs only:
  - canonical GLBs (``npm run blender:export``) — identity, verified on import
    with the same parity inspection as ``blender:verify``;
  - a pose track (``npm run blender:plates`` bakes it from the canonical
    choreography/poses) — motion, verified with world-space probes;
  - a builder (``plates_the_current.py``…) — set, lights, camera, FX: presentation.
"""
import json

import bpy
from mathutils import Quaternion, Vector

from . import inspect_parity, interchange
from .interchange import GENERATED_TAG
from .paths import GENERATED, inside_repo

PROBE_TOL = 2e-3


def load_track(path):
    with open(inside_repo(path), encoding="utf8") as f:
        track = json.load(f)
    if track.get("schema") != "hnc-pose-track/1":
        raise RuntimeError(f"not a pose track: {path}")
    return track


def _loc(v):
    return Vector(interchange.gltf_to_blender(v[0:3]))


def _quat(v):
    # glTF (x, y, z, w), Y-up -> Blender (w, x, -z, y), Z-up: same rule as the importer.
    return Quaternion((v[6], v[3], -v[5], v[4]))


def _scale(v):
    return Vector((v[7], v[9], v[8]))


def _asset(manifest, asset_id):
    for a in manifest["assets"]:
        if a["assetId"] == asset_id:
            return a
    raise RuntimeError(f"asset {asset_id} not exported — run `npm run blender:export`")


def import_cast(scene, collection, track, manifest=None):
    """Import every identity of the track (+ ball), inspect parity at rest, return roots by name."""
    manifest = manifest or interchange.load_manifest()
    roots = {}
    reports = []
    wanted = [(a["asset"], a["root"]) for a in track["actors"]]
    if track.get("ball"):
        wanted.append(("hnc-ball", track["ball"]["root"]))
    for prop in track.get("props", []):
        wanted.append((prop, _asset(manifest, prop)["expected"]["root"]))
    for asset_id, root_name in wanted:
        asset = _asset(manifest, asset_id)
        root = interchange.import_hnc_glb(GENERATED / "hnc" / f"{asset_id}.glb", collection)
        if asset_id == "hnc-ball":
            root.location = (0, 0, 0)
        report = inspect_parity.inspect_asset(asset, scene)
        if not report["pass"]:
            fails = [f"{c['check']} [{c['node']}]" for c in report["failures"]][:6]
            raise RuntimeError(f"{asset_id}: parity failed on import: {fails}")
        reports.append({"asset": asset_id, "checks": report["checks_total"]})
        roots[root_name] = root
    return roots, reports


def _objects_by_name(root):
    return {interchange.base_name(o.name): o for o in (root, *root.children_recursive)}


def apply_track(scene, roots, track):
    """Keyframe every named node on every frame (LINEAR keys: motion blur interpolates sub-frames)."""
    for actor in track["actors"]:
        objs = _objects_by_name(roots[actor["root"]])
        for name, frames in actor["nodes"].items():
            o = objs[name]
            o.rotation_mode = "QUATERNION"
            for i, v in enumerate(frames):
                f = i + 1
                o.location = _loc(v)
                o.rotation_quaternion = _quat(v)
                o.scale = _scale(v)
                o.keyframe_insert("location", frame=f)
                o.keyframe_insert("rotation_quaternion", frame=f)
                o.keyframe_insert("scale", frame=f)
            _linear(o)
    if track.get("ball"):
        o = roots[track["ball"]["root"]]
        o.rotation_mode = "QUATERNION"
        for i, v in enumerate(track["ball"]["frames"]):
            o.location = _loc(v)
            o.rotation_quaternion = _quat(v)
            o.keyframe_insert("location", frame=i + 1)
            o.keyframe_insert("rotation_quaternion", frame=i + 1)
        _linear(o)


def _linear(obj):
    action = obj.animation_data.action if obj.animation_data else None
    if not action:
        return
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = "LINEAR"


def verify_probes(scene, roots, track, frames=None):
    """World positions of probe nodes vs the canonical pose (converted). Raises on mismatch."""
    worst = 0.0
    n = track["frames"]
    frames = frames or sorted({1, n // 2, n})
    for actor in track["actors"]:
        objs = _objects_by_name(roots[actor["root"]])
        for name, pts in actor["probes"].items():
            for f in frames:
                scene.frame_set(f)
                got = objs[name].matrix_world.translation
                exp = Vector(interchange.gltf_to_blender(pts[f - 1]))
                worst = max(worst, (got - exp).length)
    scene.frame_set(1)
    if worst > PROBE_TOL:
        raise RuntimeError(f"pose track not reproduced: probe error {worst:.4f} m > {PROBE_TOL}")
    return round(worst, 6)


def tag(block):
    block[GENERATED_TAG] = True
    return block


COLLECTIONS = ("HNC_Assets", "SET", "LGT", "FX", "CAM")


def build_plate(scene, track, preview=False):
    """Verified cast + pose track + the plate's builder, on the given (empty) scene."""
    from . import plates_the_current, studio

    builders = dict(plates_the_current.BUILDERS)
    if track["builder"] not in builders:
        raise RuntimeError(f"unknown plate builder {track['builder']!r}")
    tag(scene)
    cols = {n: studio.collection(scene, n) for n in COLLECTIONS}
    roots, reports = import_cast(scene, cols["HNC_Assets"], track)
    apply_track(scene, roots, track)
    probe = verify_probes(scene, roots, track)
    studio.setup_render(scene, track["frames"], preview)
    builders[track["builder"]](scene, cols, roots, track)
    scene.frame_set(1)
    return {"plate": track["plate"], "identities": reports, "probeError": probe}


def render_plate(scene, out_dir, frames=None, stills=None):
    """PNG sequence 0001.png… (or selected stills) into ``out_dir`` (inside the repo)."""
    import time
    out = inside_repo(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    if stills:
        for f in stills:
            scene.frame_set(f)
            scene.render.filepath = str(out / f"{f:04d}.png")
            bpy.ops.render.render(write_still=True, scene=scene.name)
        count = len(stills)
    else:
        a, b = frames or (scene.frame_start, scene.frame_end)
        scene.frame_start, scene.frame_end = a, b
        scene.render.filepath = str(out) + "/"
        bpy.ops.render.render(animation=True, scene=scene.name)
        count = b - a + 1
    secs = time.perf_counter() - t0
    return {"frames": count, "seconds": round(secs, 1), "perFrame": round(secs / max(1, count), 2)}
