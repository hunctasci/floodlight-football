"""HNC cinematic base scene: collections, render presets, cameras, lights.

Everything here is presentation. HNC geometry/materials only ever arrive via
``interchange.import_hnc_glb`` from the generated GLBs, so a rebuild after
``npm run blender:export`` always reflects the current canonical visuals.

Conventions:
  - the subject stands at the world origin facing -Y (Blender Front view);
  - collections: HNC_Assets (generated imports), SET_*, CAM_*, LGT_*;
  - every datablock created here is tagged ``hnc_generated``.
"""
import json

import bpy
import bmesh
from mathutils import Vector

from . import interchange
from .interchange import GENERATED_TAG
from .paths import GENERATED

RES_X, RES_Y, FPS = 1080, 1920, 60
ASSETS = ("hnc-player-tr-09", "hnc-ball")
# Ball rests on the ground beside the character's left boot (+X = anatomical left).
BALL_LOCATION = (0.62, -0.32, 0.25)
HEAD = Vector((0.0, 0.0, 1.78))

COLLECTIONS = ("HNC_Assets", "SET_Ground", "CAM_Rig", "LGT_Cinematic", "LGT_Neutral")

# World background per light set (linear RGB, strength).
LIGHT_SETS = {
    "LGT_Neutral": ((0.62, 0.64, 0.66), 1.2),
    "LGT_Cinematic": ((0.018, 0.02, 0.026), 1.0),
}

# View transform: Khronos PBR Neutral keeps glTF base colours (TR red, white
# trim, skin) as authored with a soft highlight roll-off. AgX was evaluated
# and rejected: it desaturates the saturated kit red toward salmon.
VIEW_TRANSFORM = "Khronos PBR Neutral"
SHOTS = {
    "01-player-neutral": dict(camera="CAM_FullBody_50mm", lights="LGT_Neutral", view=VIEW_TRANSFORM, ball=False),
    "02-player-cinematic": dict(camera="CAM_Portrait_85mm", lights="LGT_Cinematic", view=VIEW_TRANSFORM, ball=False),
    "03-player-ball": dict(camera="CAM_PlayerBall_35mm", lights="LGT_Cinematic", view=VIEW_TRANSFORM, ball=True),
}
DEFAULT_SHOT = "02-player-cinematic"


def _tag(block):
    block[GENERATED_TAG] = True
    return block


def _look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------- presets


def preset_eevee_daily(scene):
    """Fast realtime preset for frequent social production (the saved default)."""
    scene.render.engine = "BLENDER_EEVEE"
    ee = scene.eevee
    ee.taa_render_samples = 64
    ee.use_shadows = True
    ee.shadow_ray_count = 2
    ee.shadow_step_count = 8
    ee.use_raytracing = True


def preset_cycles_hero(scene):
    """Stored hero-still settings; select with `-E CYCLES` (see README).

    ``device='GPU'`` only takes effect when a compute backend is chosen: pass
    ``-- --cycles-device METAL`` on the CLI instead of editing preferences.
    """
    cy = scene.cycles
    cy.samples = 256
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.01
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.seed = 0
    cy.use_animated_seed = False
    cy.device = "GPU"


def configure_output(scene):
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = RES_X, RES_Y, 100
    r.fps, r.fps_base = FPS, 1.0
    scene.frame_start, scene.frame_end, scene.frame_current = 1, FPS, 1
    r.film_transparent = False
    r.use_motion_blur = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = VIEW_TRANSFORM
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    preset_eevee_daily(scene)
    preset_cycles_hero(scene)


# ---------------------------------------------------------------- building blocks


def _collection(scene, name):
    col = _tag(bpy.data.collections.new(name))
    if col.name != name:
        raise RuntimeError(f"collection name {name!r} already taken ({col.name}); build into a clean file/scene")
    scene.collection.children.link(col)
    return col


def _world(scene):
    world = _tag(bpy.data.worlds.new(f"{scene.name}_World"))
    world.use_nodes = True
    scene.world = world
    return world


def _ground(col):
    mesh = _tag(bpy.data.meshes.new("SET_Ground"))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30.0)
    bm.to_mesh(mesh)
    bm.free()
    mat = _tag(bpy.data.materials.new("SET_Ground_Mat"))
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.16, 0.16, 0.165, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85
    mesh.materials.append(mat)
    obj = _tag(bpy.data.objects.new("SET_Ground", mesh))
    col.objects.link(obj)


def _camera(col, name, lens, location, target, fstop=None, focus=None):
    cam = _tag(bpy.data.cameras.new(name))
    cam.lens = lens
    cam.sensor_fit = "AUTO"  # 36 mm maps to the long (vertical) side of 9:16
    cam.sensor_width = 36.0
    cam.clip_start, cam.clip_end = 0.05, 200.0
    obj = _tag(bpy.data.objects.new(name, cam))
    obj.location = location
    _look_at(obj, target)
    if fstop:
        cam.dof.use_dof = True
        cam.dof.aperture_fstop = fstop
        cam.dof.focus_distance = (Vector(focus or target) - obj.location).length
    col.objects.link(obj)
    return obj


def _area(col, name, location, target, size, power, color):
    light = _tag(bpy.data.lights.new(name, "AREA"))
    light.shape = "RECTANGLE"
    light.size, light.size_y = size
    light.energy = power
    light.color = color
    obj = _tag(bpy.data.objects.new(name, light))
    obj.location = location
    _look_at(obj, target)
    col.objects.link(obj)
    return obj


def _cameras(col):
    # A — medium character portrait: 85 mm at ~4.5 m (hair to shorts), f/4, focused on the face.
    _camera(col, "CAM_Portrait_85mm", 85.0, (1.5, -4.2, 1.6), (0.0, 0.0, 1.35), fstop=4.0, focus=HEAD)
    # B — full body parity: 50 mm, near-frontal, everything in focus.
    _camera(col, "CAM_FullBody_50mm", 50.0, (0.95, -3.7, 1.15), (0.0, 0.0, 1.02))
    # B' — player + ball from the rear three-quarter (back number + ball).
    _camera(col, "CAM_PlayerBall_35mm", 35.0, (2.35, 3.3, 1.35), (0.2, -0.05, 0.9), fstop=5.6, focus=(0.3, 0.0, 1.0))


def _lights(neutral, cinematic):
    # Restrained key / fill / rim. Key from the character's right-front.
    _area(cinematic, "LGT_Key", (-2.1, -2.5, 3.1), (0.0, 0.0, 1.45), (1.2, 1.2), 320.0, (1.0, 0.95, 0.88))
    _area(cinematic, "LGT_Fill", (2.8, -2.0, 1.4), (0.0, 0.0, 1.2), (3.0, 3.0), 70.0, (0.92, 0.95, 1.0))
    _area(cinematic, "LGT_Rim", (1.4, 2.8, 2.7), (0.0, 0.0, 1.6), (0.6, 2.0), 380.0, (0.86, 0.92, 1.0))
    sun = _tag(bpy.data.lights.new("LGT_NeutralSun", "SUN"))
    # Measured: sun 2.0 + world 1.2 renders the front kit face #e2101b vs authored
    # #e30a17 (skin #935229 vs #985c3c) — the neutral shot is a colour-parity reference.
    sun.energy = 2.0
    sun.angle = 0.1
    obj = _tag(bpy.data.objects.new("LGT_NeutralSun", sun))
    obj.rotation_euler = (0.75, 0.0, -0.45)
    neutral.objects.link(obj)


def build_base(scene):
    """Reusable cinematic base: settings, collections, cameras, lights, ground."""
    _tag(scene)
    scene["hnc_conventions"] = (
        "Subject at origin facing -Y. HNC_Assets holds generated GLB imports only "
        "(refresh: npm run blender:export && npm run blender:build). SET_/CAM_/LGT_ are presentation."
    )
    configure_output(scene)
    _world(scene)
    cols = {name: _collection(scene, name) for name in COLLECTIONS}
    _ground(cols["SET_Ground"])
    _cameras(cols["CAM_Rig"])
    _lights(cols["LGT_Neutral"], cols["LGT_Cinematic"])
    return cols


def import_assets(scene, cols, context=None):
    """Import the generated canonical GLBs into HNC_Assets."""
    roots = {}
    for asset in ASSETS:
        roots[asset] = interchange.import_hnc_glb(GENERATED / "hnc" / f"{asset}.glb", cols["HNC_Assets"], context)
    roots["hnc-ball"].location = BALL_LOCATION  # centre-origin ball resting on the ground
    return roots


def apply_shot(scene, shot_id):
    """Select camera, light set, world and view transform for a verification shot."""
    shot = SHOTS[shot_id]
    scene.camera = scene.objects[shot["camera"]]
    for name in LIGHT_SETS:
        col = scene.collection.children[name]
        col.hide_render = col.hide_viewport = name != shot["lights"]
    color, strength = LIGHT_SETS[shot["lights"]]
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*color, 1.0)
    bg.inputs["Strength"].default_value = strength
    scene.view_settings.view_transform = shot["view"]
    ball = scene.objects.get("HNC_Ball")
    if ball:
        for o in (ball, *ball.children_recursive):
            o.hide_render = not shot["ball"]
    scene["hnc_shot"] = shot_id


def build_verification(scene, context=None):
    """Base scene + canonical TR #9 + canonical ball, left on the default shot."""
    cols = build_base(scene)
    import_assets(scene, cols, context)
    # Stamp the GLB hashes this file was built from (stale-.blend detection in blender:verify).
    manifest = interchange.load_manifest()
    scene["hnc_built_from"] = json.dumps({a["assetId"]: a["sha256"] for a in manifest["assets"]}, sort_keys=True)
    apply_shot(scene, DEFAULT_SHOT)
    return cols


def remove_generated_scene(name):
    """Remove a scene this module created, and only datablocks tagged by it."""
    scene = bpy.data.scenes.get(name)
    if scene is None:
        return
    if not scene.get(GENERATED_TAG):
        raise PermissionError(f"scene {name!r} was not created by HNC tools; refusing to remove it")
    ids = [o for o in scene.objects if o.get(GENERATED_TAG)]
    ids += [o.data for o in ids if o.data is not None and o.data.get(GENERATED_TAG)]
    ids += [c for c in scene.collection.children_recursive if c.get(GENERATED_TAG)]
    if scene.world is not None and scene.world.get(GENERATED_TAG):
        ids.append(scene.world)
    ids.append(scene)
    bpy.data.batch_remove(set(ids))
    # Materials free their images only once removed, so sweep in dependency order.
    for kind in ("meshes", "materials", "images"):
        bpy.data.batch_remove({b for b in getattr(bpy.data, kind) if b.get(GENERATED_TAG) and b.users == 0})
