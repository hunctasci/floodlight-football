"""The ONE place HNC GLBs enter Blender (import options + coordinate contract).

Coordinate contract (mirrors tools/blender/src/interchange.ts):
  HNC/Three + GLB : right-handed, +Y up, metres, character front = +Z.
  Blender         : +Z up; the bundled glTF importer converts every node
                    (x, y, z) -> (x, -z, y), so the character faces -Y
                    (Blender's "Front" view). No scene code may add
                    rotateX-style fixes; use ``gltf_to_blender`` for maths.
"""
import json
import re

import bpy

from .paths import MANIFEST, inside_repo

# Pinned importer options (io_scene_gltf2 5.2.x). NORMALS keeps the ball's
# smooth normals and turns NORMAL-less primitives (HNC flat parts) sharp.
IMPORT_OPTIONS = dict(
    import_shading="NORMALS",
    merge_vertices=False,
    import_pack_images=True,
    import_scene_as_collection=False,
    import_scene_extras=True,
    import_select_created_objects=False,
)

GENERATED_TAG = "hnc_generated"


def gltf_to_blender(v):
    """HNC/glTF (Y-up) vector -> Blender (Z-up) vector."""
    x, y, z = v
    return (x, -z, y)


def gltf_box_to_blender(vmin, vmax):
    """Axis-aligned box conversion: the Z flip swaps min/max on Blender Y."""
    return (vmin[0], -vmax[2], vmin[1]), (vmax[0], -vmin[2], vmax[1])


def base_name(name: str) -> str:
    """Strip Blender's duplicate suffix (Body.001 -> Body)."""
    return re.sub(r"\.\d{3}$", "", name)


def load_manifest(path=MANIFEST) -> dict:
    with open(inside_repo(path), encoding="utf8") as f:
        return json.load(f)


def _layer_collection(layer, collection):
    if layer.collection == collection:
        return layer
    for child in layer.children:
        found = _layer_collection(child, collection)
        if found:
            return found
    return None


def import_hnc_glb(glb_path, collection, context=None):
    """Import one generated HNC GLB into ``collection``; return its root object.

    Imported datablocks are tagged ``hnc_generated`` so a rebuild can remove
    exactly what it created, and nothing else.
    """
    context = context or bpy.context
    path = inside_repo(glb_path)
    view_layer = context.view_layer
    target = _layer_collection(view_layer.layer_collection, collection)
    if target is None:
        raise RuntimeError(f"collection {collection.name} is not in the active view layer")
    view_layer.active_layer_collection = target

    before = {
        "objects": set(bpy.data.objects),
        "meshes": set(bpy.data.meshes),
        "materials": set(bpy.data.materials),
        "images": set(bpy.data.images),
    }
    result = bpy.ops.import_scene.gltf(filepath=str(path), **IMPORT_OPTIONS)
    if "FINISHED" not in result:
        raise RuntimeError(f"glTF import failed for {path}: {result}")

    new_objects = [o for o in bpy.data.objects if o not in before["objects"]]
    for kind in ("meshes", "materials", "images"):
        for block in getattr(bpy.data, kind):
            if block not in before[kind]:
                block[GENERATED_TAG] = True
    for o in new_objects:
        o[GENERATED_TAG] = True
    roots = [o for o in new_objects if o.parent is None]
    if len(roots) != 1:
        raise RuntimeError(f"{path.name}: expected one root, got {[o.name for o in roots]}")

    _presentation_defaults(new_objects)
    return roots[0]


def _presentation_defaults(objects):
    """Deterministic Blender-only presentation settings (never geometry).

    - Images get the material name (the importer calls them Image_0, ...).
    - Alpha-blended HNC materials (the shirt-number decal) must not cast a
      rectangular shadow from their transparent texels.
    """
    for o in objects:
        for slot in o.material_slots:
            m = slot.material
            if not m:
                continue
            if m.surface_render_method == "BLENDED":
                m.use_transparent_shadow = True
            for node in m.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and node.image.get(GENERATED_TAG):
                    node.image.name = f"{base_name(m.name)}.png"
