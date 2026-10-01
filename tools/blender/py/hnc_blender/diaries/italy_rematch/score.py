"""S11 physical score: real Barlow Condensed geometry and deterministic breakup.

This is intentionally shot-local.  The score is authored as three converted
font meshes, then split into exact Boolean-intersected pieces on a deliberately
uneven impact-biased grid.  The pieces are active rigid bodies, held kinematic
until the impact frame; their first two frames of motion are authored so the
direction of the kick reads before gravity takes over.
"""
import math
import random
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

from ...cine import look, props
from ...cine.look import tag


SEED = 110108
FONT = Path(__file__).resolve().parents[6] / "packages" / "reels" / "public" / "generated" / "diaries" / "fonts" / "BarlowCondensed-SemiBold.ttf"


def _mesh_box(name, lo, hi):
    me = tag(bpy.data.meshes.new(name))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((
            (hi.x + lo.x) * 0.5 + v.co.x * (hi.x - lo.x),
            (hi.y + lo.y) * 0.5 + v.co.y * (hi.y - lo.y),
            (hi.z + lo.z) * 0.5 + v.co.z * (hi.z - lo.z),
        ))
    bm.to_mesh(me)
    bm.free()
    return me


def _bounds(obj):
    pts = [Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def _apply_intersection(obj, lo, hi, name):
    cutter = tag(bpy.data.objects.new(f"{name}.Cutter", _mesh_box(f"{name}.CutterMesh", lo, hi)))
    bpy.context.scene.collection.objects.link(cutter)
    mod = obj.modifiers.new("ImpactCell", "BOOLEAN")
    mod.operation = "INTERSECT"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    finally:
        obj.select_set(False)
        bpy.data.objects.remove(cutter, do_unlink=True)
    obj.name = name
    return obj


def _font_char(collection, text, x, z, size, depth, material, name, y=7.0,
               rotation=(90.0, 0.0, 0.0), align_x="CENTER", align_y="BOTTOM"):
    if not FONT.exists():
        raise FileNotFoundError(f"licensed OFL font missing: {FONT}")
    cu = tag(bpy.data.curves.new(f"{name}.Curve", "FONT"))
    cu.body = text
    cu.align_x = align_x
    cu.align_y = align_y
    cu.size = size
    cu.extrude = depth
    cu.bevel_depth = 0.018
    cu.bevel_resolution = 2
    cu.resolution_u = 10
    cu.font = bpy.data.fonts.load(str(FONT), check_existing=True)
    obj = tag(bpy.data.objects.new(name, cu))
    collection.objects.link(obj)
    obj.location = (x, y, z)
    obj.rotation_euler = tuple(math.radians(a) for a in rotation)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def build_glyph(collection, text, loc, height, depth=0.12, material=None,
                name="ARCH_GLYPH", rotation=(90.0, 0.0, 0.0), bevel=True):
    """Build one physical Barlow glyph using the approved score type system.

    Architectural labels, elevator displays and the giant commuters all route
    through this helper so the episode never grows a second font/mesh path.
    """
    mat = material or look.flat(f"{name}_Mat", "#52616c", rough=0.63, spec=0.30, coat=0.08)
    obj = _font_char(collection, text, loc[0], loc[2], height, depth, mat, name,
                     y=loc[1], rotation=rotation)
    obj["hnc_score_role"] = "glyph"
    obj["hnc_score_environment"] = True
    if bevel:
        mod = obj.modifiers.new("Architectural edge softness", "BEVEL")
        mod.width = min(0.012, height * 0.006)
        mod.segments = 2
    return obj


def build_score_typography(scene, collection, height=5.05, seed=SEED):
    """Build the intact architectural score and return its construction record."""
    matte = look.flat("S11_Score_Matte", "#4b5661", rough=0.74, spec=0.28, coat=0.06)
    edge = look.flat("S11_Score_FractureEdge", "#65727d", rough=0.66, spec=0.35, coat=0.08)
    # Barlow Condensed proportions keep the score tall and leave a readable void
    # around the ball's line of travel.
    chars = [
        ("1", -1.55, 0.12),
        ("–", 0.00, 1.26),
        ("4", 1.48, 0.12),
    ]
    hero = []
    for text, x, z in chars:
        o = _font_char(collection, text, x, z, height, 0.30, matte, f"S11_SCORE_HERO_{text}")
        o["hnc_score_role"] = "intact"
        o["hnc_score_seed"] = seed
        hero.append(o)
    bpy.context.view_layer.update()
    return {"hero": hero, "material": matte, "edge_material": edge, "height": height, "seed": seed,
            "impact": Vector((0.32, 6.60, 2.10))}


def build_intact_score(collection, height=2.35, y=0.0, x=0.0, name_prefix="ARCH_SCORE",
                       material=None):
    """Reusable intact 1–4 typography for environmental/architectural shots."""
    mat = material or look.flat(f"{name_prefix}_Mat", "#52616c", rough=0.63, spec=0.30, coat=0.08)
    spread = height / 2.35
    chars = [("1", -0.68 * spread), ("–", 0.0), ("4", 0.66 * spread)]
    out = []
    for text, dx in chars:
        o = _font_char(collection, text, x + dx, 0.12, height, 0.18, mat,
                        f"{name_prefix}_{text}", y=y)
        o["hnc_score_role"] = "intact"
        o["hnc_score_environment"] = True
        out.append(o)
    return {"hero": out, "material": mat, "height": height, "y": y, "x": x}


def _fragment_cells(lo, hi, impact_x, impact_z):
    """Uneven deterministic cells: fine around the strike, broad at the edges."""
    # Structural glyphs remain in a few broad pieces.  Only cells near the
    # ball's world-space corridor get the finer subdivision; this is the main
    # visual distinction from a uniform voxel/Voronoi explosion.
    gap = 0.0 if lo.x <= impact_x <= hi.x else min(abs(lo.x - impact_x), abs(hi.x - impact_x))
    if gap > 0.78:
        xs = [lo.x - 0.04, (lo.x + hi.x) * 0.5, hi.x + 0.04]
        zs = [lo.z - 0.04, (lo.z + hi.z) * 0.46, hi.z + 0.04]
    else:
        xs = [lo.x - 0.04, impact_x - 0.14, impact_x + 0.14, hi.x + 0.04]
        zs = [lo.z - 0.04, 0.92, impact_z - 0.26, impact_z + 0.22, hi.z + 0.04]
    xs = sorted(set(max(lo.x - 0.04, min(hi.x + 0.04, x)) for x in xs))
    zs = sorted(set(max(lo.z - 0.04, min(hi.z + 0.04, z)) for z in zs))
    for xa, xb in zip(xs, xs[1:]):
        for za, zb in zip(zs, zs[1:]):
            if xb - xa > 0.025 and zb - za > 0.025:
                yield Vector((xa, lo.y - 0.04, za)), Vector((xb, hi.y + 0.04, zb))


def fracture_score(score, collection, frames, fps, impact_frame=57, seed=SEED, rigid_bodies=True):
    """Create deterministic, impact-biased score pieces and animate the burst."""
    rng = random.Random(seed)
    fragments = []
    ix, iz = score["impact"].x, score["impact"].z
    for glyph in score["hero"]:
        lo, hi = _bounds(glyph)
        for idx, (cell_lo, cell_hi) in enumerate(_fragment_cells(lo, hi, ix, iz)):
            frag = tag(bpy.data.objects.new(f"S11_SCORE_FRAG_{len(fragments):02d}", glyph.data.copy()))
            collection.objects.link(frag)
            frag.data.materials.append(score["edge_material"])
            # The overlap keeps the intact silhouette covered on the one-frame
            # handoff; the boolean creates real font-shaped sides, not cubes.
            cell_lo -= Vector((0.012, 0.018, 0.012))
            cell_hi += Vector((0.012, 0.018, 0.012))
            _apply_intersection(frag, cell_lo, cell_hi, frag.name)
            if len(frag.data.vertices) < 6:
                bpy.data.objects.remove(frag, do_unlink=True)
                continue
            frag["hnc_score_role"] = "fracture"
            frag["hnc_score_seed"] = seed
            frag["hnc_score_cell"] = idx
            frag.hide_render = True
            frag.keyframe_insert("hide_render", frame=1)
            frag.hide_render = True
            frag.keyframe_insert("hide_render", frame=impact_frame + 1)
            frag.hide_render = False
            frag.keyframe_insert("hide_render", frame=impact_frame + 2)
            # Impact-near cells receive more kick; structural edge cells drift
            # as heavier slabs and rotate less.
            centre = (cell_lo + cell_hi) * 0.5
            near = max(0.0, 1.0 - (centre - score["impact"]).length / 3.7)
            forward = 1.1 + near * 2.2 + rng.uniform(-0.12, 0.12)
            side = (centre.x - ix) * (0.18 + near * 0.4) + rng.uniform(-0.12, 0.12)
            lift = 0.12 + near * 0.55 + rng.uniform(-0.04, 0.08)
            vel = Vector((side, forward, lift))
            spin = Vector((rng.uniform(-1.3, 1.3), rng.uniform(-1.0, 1.0), rng.uniform(-1.7, 1.7))) * (0.35 + near)
            frag.location = (0, 0, 0)
            frag.rotation_mode = "XYZ"
            frag.keyframe_insert("location", frame=impact_frame + 1)
            frag.keyframe_insert("rotation_euler", frame=impact_frame + 1)
            frag.location = vel * 0.11
            frag.rotation_euler = tuple(spin * 0.10)
            frag.keyframe_insert("location", frame=impact_frame + 3)
            frag.keyframe_insert("rotation_euler", frame=impact_frame + 3)
            frag.location = vel * 0.38 + Vector((0, 0, -0.15 * (1.0 - near)))
            frag.rotation_euler = tuple(spin * 0.55)
            frag.keyframe_insert("location", frame=min(frames, impact_frame + 16))
            frag.keyframe_insert("rotation_euler", frame=min(frames, impact_frame + 16))
            # Gentle bevel catches the key light on freshly split edges.
            bevel = frag.modifiers.new("FractureEdgeSoftness", "BEVEL")
            bevel.width = 0.008
            bevel.segments = 2
            if rigid_bodies:
                bpy.context.view_layer.objects.active = frag
                frag.select_set(True)
                bpy.ops.rigidbody.object_add()
                frag.select_set(False)
                rb = frag.rigid_body
                rb.type = "ACTIVE"
                rb.collision_shape = "CONVEX_HULL"
                rb.mass = max(0.4, 2.2 * (1.0 - near * 0.45))
                rb.friction = 0.72
                rb.restitution = 0.08
                rb.kinematic = True
                rb.keyframe_insert("kinematic", frame=1)
                rb.keyframe_insert("kinematic", frame=impact_frame + 1)
                rb.kinematic = False
                rb.keyframe_insert("kinematic", frame=impact_frame + 2)
            fragments.append(frag)
    for hero in score["hero"]:
        hero.hide_render = False
        hero.keyframe_insert("hide_render", frame=1)
        hero.keyframe_insert("hide_render", frame=impact_frame + 1)
        hero.hide_render = True
        hero.keyframe_insert("hide_render", frame=impact_frame + 2)
    score["fragments"] = fragments
    score["impact_frame"] = impact_frame
    score["fragment_count"] = len(fragments)
    return score


def animate_score_impact(scene, score, collection, frames, fps, impact_frame=57, internal_light=True):
    """Add a restrained post-impact light and dust response."""
    at = score["impact"]
    if internal_light:
        light_data = tag(bpy.data.lights.new("S11_Score_InternalLight", "POINT"))
        light_data.color = look.lin("#d9efff")[:3]
        light_data.shadow_soft_size = 0.34
        light = tag(bpy.data.objects.new("S11_Score_InternalLight", light_data))
        collection.objects.link(light)
        light.location = at + Vector((0, -0.35, 0.0))
        light_data.energy = 0.0
        light_data.keyframe_insert("energy", frame=1)
        light_data.energy = 0.0
        light_data.keyframe_insert("energy", frame=impact_frame - 1)
        light_data.energy = 95.0
        light_data.keyframe_insert("energy", frame=impact_frame + 2)
        light_data.energy = 0.0
        light_data.keyframe_insert("energy", frame=min(frames, impact_frame + 13))
    # Small translucent puffs keep the response local without exposing a
    # rectangular volume boundary in portrait coverage.
    dust_mat = look.flat("S11_ImpactDust", "#8e9ba1", rough=1.0, spec=0.02, alpha=0.035)
    rng = random.Random(score["seed"] + 77)
    dust = []
    for i in range(9):
        puff = props.sphere(collection, f"S11_DustPuff_{i:02d}", 0.18, dust_mat,
                             loc=tuple(at + Vector((rng.uniform(-0.72, 0.72), rng.uniform(-0.22, 0.22), rng.uniform(-0.62, 0.62)))),
                             scale=(0.22, 0.11, 0.22), segs=10, rings=6, smooth=True)
        puff.hide_render = True
        puff.keyframe_insert("hide_render", frame=1)
        puff.keyframe_insert("hide_render", frame=impact_frame + 1)
        puff.hide_render = False
        puff.keyframe_insert("hide_render", frame=impact_frame + 2)
        puff.scale = (rng.uniform(0.55, 1.25), rng.uniform(0.24, 0.55), rng.uniform(0.55, 1.25))
        puff.keyframe_insert("scale", frame=impact_frame + 7)
        puff.scale = (0.08, 0.04, 0.08)
        puff.keyframe_insert("scale", frame=min(frames, impact_frame + 17))
        puff.hide_render = True
        puff.keyframe_insert("hide_render", frame=min(frames, impact_frame + 22))
        dust.append(puff)
    score["dust"] = dust
    score["internal_light"] = internal_light
    return score
