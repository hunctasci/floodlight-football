"""HNC anime studio kit (presentation only) for Blender plates.

Reusable building blocks for stylised football-anime shots: render presets,
night world, volumetric haze, spot "floodlight" beams, bokeh fields, a pitch
set, Current aura shells, embers, energy strips, animated cameras and the
compositor finish. Nothing here creates HNC characters: shells share the
canonical meshes' data, everything else is set dressing tagged
``hnc_generated``.

Colours arrive as sRGB hex strings from the pose track (the Current palette
lives in packages/reels/src/effects/current.ts).
"""
import math
import random

import bpy
from mathutils import Vector

from .interchange import GENERATED_TAG, base_name
from .scene import VIEW_TRANSFORM


def _t(block):
    block[GENERATED_TAG] = True
    return block


def hex_lin(h, a=1.0):
    """sRGB hex -> linear RGBA (Blender colour sockets are linear)."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def mix_hex(a, b, t):
    a, b = a.lstrip("#"), b.lstrip("#")
    ca = [int(a[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ca, cb))


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------- render


def setup_render(scene, frames, preview=False, exposure=0.0):
    r = scene.render
    r.resolution_x, r.resolution_y = 1080, 1920
    r.resolution_percentage = 50 if preview else 100
    r.fps, r.fps_base = 60, 1.0
    scene.frame_start, scene.frame_end = 1, frames
    r.engine = "BLENDER_EEVEE"
    ee = scene.eevee
    ee.taa_render_samples = 16 if preview else 64
    ee.use_shadows = True
    ee.shadow_ray_count = 2
    ee.shadow_step_count = 8
    ee.use_raytracing = True
    ee.volumetric_tile_size = "4" if preview else "2"
    ee.volumetric_samples = 48 if preview else 96
    ee.volumetric_start = 0.1
    ee.volumetric_end = 90.0
    ee.use_volumetric_shadows = True
    ee.volumetric_light_clamp = 0.0
    # Accumulation motion blur (anime smear on fast moves); off for lookdev.
    r.use_motion_blur = not preview
    r.motion_blur_shutter = 0.5
    ee.motion_blur_steps = 1  # post-process blur: slow plate moves need no accumulation
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = VIEW_TRANSFORM
    scene.view_settings.look = "None"
    scene.view_settings.exposure = exposure
    scene.render.use_compositing = True


def world(scene, color="#05080f", strength=1.0):
    w = _t(bpy.data.worlds.new(f"{scene.name}_World"))
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = hex_lin(color)
    bg.inputs["Strength"].default_value = strength
    scene.world = w
    return w


def compositor(scene, glare=0.55, threshold=0.9, dispersion=0.012, vignette=0.55, size=0.6):
    """Bloom (fog glow), a touch of lens dispersion and a soft vignette."""
    ng = _t(bpy.data.node_groups.new(f"{scene.name}_Comp", "CompositorNodeTree"))
    ng.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    n = ng.nodes
    rl = n.new("CompositorNodeRLayers")
    rl.scene = scene
    gl = n.new("CompositorNodeGlare")
    gl.inputs["Type"].default_value = "Fog Glow"
    gl.inputs["Quality"].default_value = "High"
    gl.inputs["Threshold"].default_value = threshold
    gl.inputs["Strength"].default_value = glare
    gl.inputs["Size"].default_value = size
    ld = n.new("CompositorNodeLensdist")
    ld.inputs["Dispersion"].default_value = dispersion
    ld.inputs["Fit"].default_value = True
    em = n.new("CompositorNodeEllipseMask")
    em.inputs["Size"].default_value = (1.35, 1.1)
    blur = n.new("CompositorNodeBlur")
    blur.inputs["Size"].default_value = (220, 220)
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = vignette
    out = n.new("NodeGroupOutput")
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], ld.inputs["Image"])
    ng.links.new(em.outputs["Mask"], blur.inputs["Image"])
    ng.links.new(ld.outputs["Image"], mix.inputs["A"])
    ng.links.new(blur.outputs["Image"], mix.inputs["B"])
    ng.links.new(mix.outputs["Result"], out.inputs[0])
    scene.compositing_node_group = ng
    return ng


# ---------------------------------------------------------------- set


def collection(scene, name):
    col = _t(bpy.data.collections.new(name))
    scene.collection.children.link(col)
    return col


def _obj(col, name, data):
    o = _t(bpy.data.objects.new(name, data))
    col.objects.link(o)
    return o


def emission_material(name, color, strength, additive=False):
    m = _t(bpy.data.materials.new(name))
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_lin(color)
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if additive:
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(em.outputs[0], add.inputs[0])
        nt.links.new(tr.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs["Surface"])
        m.surface_render_method = "BLENDED"
    else:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def fog(col, center, size, density, color="#9fb3d9", anisotropy=0.35):
    """A haze box (EEVEE volumetrics): makes spot beams and rim light visible."""
    me = _t(bpy.data.meshes.new("SET_Fog"))
    o = _obj(col, "SET_Fog", me)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    o.location = center
    o.scale = size
    m = _t(bpy.data.materials.new("SET_Fog_Mat"))
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = hex_lin(color)
    vol.inputs["Density"].default_value = density
    vol.inputs["Anisotropy"].default_value = anisotropy
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    me.materials.append(m)
    o.visible_shadow = False
    return o


def ground(col, size=120.0, color="#1d4f2a", roughness=0.9, location=(0, 0, 0)):
    """Night grass: canonical-ish pitch green with mowing stripes along X and a little noise."""
    import bmesh
    me = _t(bpy.data.meshes.new("SET_Grass"))
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    o = _obj(col, "SET_Grass", me)
    o.location = location
    m = _t(bpy.data.materials.new("SET_Grass_Mat"))
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = roughness
    tex = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    stripes = nt.nodes.new("ShaderNodeMath")
    stripes.operation = "PINGPONG"
    stripes.inputs[1].default_value = 8.0  # 16 m stripes like the canonical pitch
    step = nt.nodes.new("ShaderNodeMath")
    step.operation = "GREATER_THAN"
    step.inputs[1].default_value = 4.0
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 40.0
    ramp = nt.nodes.new("ShaderNodeMix")
    ramp.data_type = "RGBA"
    ramp.inputs["A"].default_value = hex_lin(color)
    ramp.inputs["B"].default_value = hex_lin(mix_hex(color, "#000000", 0.18))
    mix2 = nt.nodes.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    mix2.blend_type = "MULTIPLY"
    mix2.inputs["Factor"].default_value = 0.25
    nt.links.new(tex.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], stripes.inputs[0])
    nt.links.new(stripes.outputs[0], step.inputs[0])
    nt.links.new(step.outputs[0], ramp.inputs["Factor"])
    nt.links.new(ramp.outputs["Result"], mix2.inputs["A"])
    nt.links.new(noise.outputs["Color"], mix2.inputs["B"])
    nt.links.new(mix2.outputs["Result"], bsdf.inputs["Base Color"])
    me.materials.append(m)
    return o


def strip(col, name, p0, p1, width, material, z=0.012):
    """A flat strip on the ground from p0 to p1 (local X runs 0..length along it)."""
    import bmesh
    p0, p1 = Vector((*p0[:2], 0)), Vector((*p1[:2], 0))
    d = p1 - p0
    length = d.length
    me = _t(bpy.data.meshes.new(name))
    bm = bmesh.new()
    verts = [bm.verts.new(v) for v in ((0, -width / 2, 0), (length, -width / 2, 0), (length, width / 2, 0), (0, width / 2, 0))]
    bm.faces.new(verts)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x / max(1e-6, length), loop.vert.co.y / width + 0.5)
    bm.to_mesh(me)
    bm.free()
    o = _obj(col, name, me)
    o.location = (p0.x, p0.y, z)
    o.rotation_euler = (0, 0, math.atan2(d.y, d.x))
    me.materials.append(material)
    return o


def chalk_material():
    m = _t(bpy.data.materials.new("SET_Chalk"))
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hex_lin("#f4f4f0")
    b.inputs["Roughness"].default_value = 0.95
    return m


def disc(col, name, center, radius, material, z=0.013, segments=24):
    import bmesh
    me = _t(bpy.data.meshes.new(name))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=radius, segments=segments)
    bm.to_mesh(me)
    bm.free()
    o = _obj(col, name, me)
    o.location = (center[0], center[1], z)
    me.materials.append(material)
    return o


def ring(col, name, center, radius, width, material, z=0.013, start=0.0, end=2 * math.pi, segments=96):
    import bmesh
    me = _t(bpy.data.meshes.new(name))
    bm = bmesh.new()
    n = segments
    inner, outer = [], []
    for i in range(n + 1):
        a = start + (end - start) * i / n
        inner.append(bm.verts.new((math.cos(a) * (radius - width / 2), math.sin(a) * (radius - width / 2), 0)))
        outer.append(bm.verts.new((math.cos(a) * (radius + width / 2), math.sin(a) * (radius + width / 2), 0)))
    for i in range(n):
        bm.faces.new((inner[i], outer[i], outer[i + 1], inner[i + 1]))
    bm.to_mesh(me)
    bm.free()
    o = _obj(col, name, me)
    o.location = (center[0], center[1], z)
    me.materials.append(material)
    return o


# ---------------------------------------------------------------- lights


def spot(col, name, location, target, color, power, angle_deg=30, blend=0.6, radius=0.3, shadow=True, volume=1.0):
    light = _t(bpy.data.lights.new(name, "SPOT"))
    light.volume_factor = volume
    light.color = hex_lin(color)[:3]
    light.energy = power
    light.spot_size = math.radians(angle_deg)
    light.spot_blend = blend
    light.shadow_soft_size = radius
    light.use_shadow = shadow
    o = _obj(col, name, light)
    o.location = location
    look_at(o, target)
    return o


def area(col, name, location, target, size, power, color, volume=1.0):
    light = _t(bpy.data.lights.new(name, "AREA"))
    light.volume_factor = volume
    light.shape = "RECTANGLE"
    light.size, light.size_y = size
    light.energy = power
    light.color = hex_lin(color)[:3]
    o = _obj(col, name, light)
    o.location = location
    look_at(o, target)
    return o


def point(col, name, location, color, power, radius=0.1, volume=1.0):
    light = _t(bpy.data.lights.new(name, "POINT"))
    light.volume_factor = volume
    light.energy = power
    light.color = hex_lin(color)[:3]
    light.shadow_soft_size = radius
    o = _obj(col, name, light)
    o.location = location
    return o


def key_power(light_obj, keys):
    """[(frame, power)] keyframes on a light's energy (CONSTANT for strikes, LINEAR otherwise)."""
    for f, p in keys:
        light_obj.data.energy = p
        light_obj.data.keyframe_insert("energy", frame=f)


def bokeh(col, seed, n, center, spread, colors, radius=0.12, strength=30.0, name="SET_Bokeh"):
    """Small emissive spheres far behind the subject: with DOF they become floodlight bokeh."""
    import bmesh
    rnd = random.Random(seed)
    me = _t(bpy.data.meshes.new(name))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
    bm.to_mesh(me)
    bm.free()
    mats = [emission_material(f"{name}_{i}", c, strength) for i, c in enumerate(colors)]
    out = []
    for i in range(n):
        m = _t(me.copy())
        m.materials.append(mats[i % len(mats)])
        o = _obj(col, f"{name}.{i:03d}", m)
        o.location = [center[k] + (rnd.random() - 0.5) * spread[k] for k in range(3)]
        s = 0.6 + rnd.random() * 1.1
        o.scale = (s, s, s)
        o.visible_shadow = False
        out.append(o)
    return out


# ---------------------------------------------------------------- Current FX


def _aura_material(name, color, strength, seed, layer):
    m = _t(bpy.data.materials.new(name))
    m.use_nodes = True
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    nt = m.node_tree
    nt.nodes.clear()
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (3.0, 3.0, 2.2)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 3.0
    # Flames rise: W advances with the frame (driver) and the mapping scrolls Z.
    drv = noise.inputs["W"].driver_add("default_value").driver
    drv.expression = f"frame / 60 * {1.4 + layer * 0.6} + {seed % 17}"
    zdrv = mapping.inputs["Location"].driver_add("default_value", 2).driver
    zdrv.expression = f"-frame / 60 * {2.6 + layer}"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[1].position = 0.72
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    level = nt.nodes.new("ShaderNodeValue")
    level.name = "AuraLevel"
    level.outputs[0].default_value = 1.0
    mul2 = nt.nodes.new("ShaderNodeMath")
    mul2.operation = "MULTIPLY"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_lin(mix_hex(color, "#ffffff", 0.18 if layer == 0 else 0.0))
    strength_n = nt.nodes.new("ShaderNodeMath")
    strength_n.operation = "MULTIPLY"
    strength_n.inputs[1].default_value = strength * (1.0 if layer == 0 else 0.55)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    add = nt.nodes.new("ShaderNodeAddShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(coord.outputs["Object"], mapping.inputs["Vector"])
    L(mapping.outputs["Vector"], noise.inputs["Vector"])
    L(noise.outputs["Fac"], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], mul.inputs[0])
    L(lw.outputs["Facing"], mul.inputs[1])
    L(mul.outputs[0], mul2.inputs[0])
    L(level.outputs[0], mul2.inputs[1])
    L(mul2.outputs[0], strength_n.inputs[0])
    L(strength_n.outputs[0], em.inputs["Strength"])
    L(em.outputs[0], add.inputs[0])
    L(tr.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs["Surface"])
    _ = geo
    return m


def _flip_faces_group(sides_only=False):
    """Inverted-hull modifier: flip faces; box parts also drop their horizontal
    faces (a shell's top face would otherwise float over the chin from low angles)."""
    name = "HNC_FlipFacesSides" if sides_only else "HNC_FlipFaces"
    ng = bpy.data.node_groups.get(name)
    if ng:
        return ng
    ng = _t(bpy.data.node_groups.new(name, "GeometryNodeTree"))
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gi = ng.nodes.new("NodeGroupInput")
    flip = ng.nodes.new("GeometryNodeFlipFaces")
    go = ng.nodes.new("NodeGroupOutput")
    src = gi.outputs[0]
    if sides_only:
        normal = ng.nodes.new("GeometryNodeInputNormal")
        sep = ng.nodes.new("ShaderNodeSeparateXYZ")
        ab = ng.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        gt = ng.nodes.new("ShaderNodeMath")
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = 0.7
        dele = ng.nodes.new("GeometryNodeDeleteGeometry")
        dele.domain = "FACE"
        ng.links.new(normal.outputs[0], sep.inputs[0])
        ng.links.new(sep.outputs["Z"], ab.inputs[0])
        ng.links.new(ab.outputs[0], gt.inputs[0])
        ng.links.new(src, dele.inputs["Geometry"])
        ng.links.new(gt.outputs[0], dele.inputs["Selection"])
        src = dele.outputs["Geometry"]
    ng.links.new(src, flip.inputs["Mesh"])
    ng.links.new(flip.outputs["Mesh"], go.inputs[0])
    return ng


def aura(col, root, color, strength=6.0, seed=1, scales=(1.1, 1.3)):
    """Current aura: inverted-hull shells around every canonical mesh part.

    Each shell is a child of its part (inherits the pose track), shares the
    canonical mesh data, is scaled about the part's own centre, faces flipped +
    backface culling -> only the silhouette halo shows. Returns the materials
    (their `AuraLevel` value node can be keyframed).
    """
    mats = [_aura_material(f"FX_Aura_{base_name(root.name)}_{i}", color, strength, seed, i) for i in range(len(scales))]
    flip_all, flip_sides = _flip_faces_group(), _flip_faces_group(sides_only=True)
    for part in [root, *root.children_recursive]:
        if part.type != "MESH" or not part.data.polygons:
            continue
        name = base_name(part.name)
        if name.endswith(("Eye.L", "Eye.R", "ShirtNumber")):
            continue
        c = sum((Vector(v.co) for v in part.data.vertices), Vector()) / len(part.data.vertices)
        for i, s in enumerate(scales):
            shell = _t(bpy.data.objects.new(f"FX_Aura.{name}.{i}", part.data))
            col.objects.link(shell)
            shell.parent = part
            shell.matrix_parent_inverse.identity()
            shell.location = c * (1 - s)
            shell.scale = (s, s, s)
            shell.visible_shadow = False
            shell.data.materials  # shares data; per-object material link below
            mod = shell.modifiers.new("Flip", "NODES")
            rounded = name.endswith(("Head", "Hair")) or name.startswith("HNC_Ball")
            mod.node_group = flip_all if rounded else flip_sides
            # Object-linked material so the canonical mesh keeps its own.
            for slot_i in range(len(shell.material_slots)):
                shell.material_slots[slot_i].link = "OBJECT"
                shell.material_slots[slot_i].material = mats[i]
    return mats


def key_aura(mats, keys):
    """[(frame, level)] on every aura material's AuraLevel."""
    for m in mats:
        node = m.node_tree.nodes["AuraLevel"]
        for f, v in keys:
            node.outputs[0].default_value = v
            node.outputs[0].keyframe_insert("default_value", frame=f)


def embers(col, seed, n, center, radius, height, color, frames, rise=0.9, size=0.018, fall=False, strength=40.0):
    """Current motes: tiny emissive specks drifting up (or down), keyframed every 8 frames."""
    import bmesh
    rnd = random.Random(seed)
    me = _t(bpy.data.meshes.new("FX_Ember"))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(emission_material("FX_Ember_Mat", color, strength))
    out = []
    for i in range(n):
        o = _obj(col, f"FX_Ember.{i:03d}", me)
        o.visible_shadow = False
        a = rnd.random() * math.tau
        r = radius * math.sqrt(rnd.random())
        z0 = rnd.random() * height
        speed = rise * (0.5 + rnd.random())
        swirl = (rnd.random() - 0.5) * 1.2
        s = 0.5 + rnd.random() * 1.2
        for f in list(range(1, frames + 1, 8)) + [frames]:
            t = (f - 1) / 60
            z = (z0 + speed * t * (-1 if fall else 1)) % height
            ang = a + swirl * t
            o.location = (center[0] + math.cos(ang) * r, center[1] + math.sin(ang) * r, center[2] + z)
            fade = math.sin(math.pi * z / height)
            o.scale = (s * fade + 0.01,) * 3
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
        out.append(o)
    return out


def current_material(name, color, head, tail=6.0, strength=40.0):
    """Energy along a strip's U (0..1 = length): a bright head at `Head` (keyframable value node)."""
    m = _t(bpy.data.materials.new(name))
    m.use_nodes = True
    m.surface_render_method = "BLENDED"
    nt = m.node_tree
    nt.nodes.clear()
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    hv = nt.nodes.new("ShaderNodeValue")
    hv.name = "Head"
    hv.outputs[0].default_value = head
    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"  # behind = head - u
    gt = nt.nodes.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.0
    ex = nt.nodes.new("ShaderNodeMath")
    ex.operation = "MULTIPLY"
    ex.inputs[1].default_value = -tail
    exp = nt.nodes.new("ShaderNodeMath")
    exp.operation = "EXPONENT"
    glow = nt.nodes.new("ShaderNodeMath")
    glow.operation = "MULTIPLY_ADD"
    glow.inputs[1].default_value = 0.75
    glow.inputs[2].default_value = 0.25
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    across = nt.nodes.new("ShaderNodeMath")
    across.operation = "PINGPONG"
    across.inputs[1].default_value = 0.5
    edge = nt.nodes.new("ShaderNodeMath")
    edge.operation = "POWER"
    edge.inputs[1].default_value = 0.6
    final = nt.nodes.new("ShaderNodeMath")
    final.operation = "MULTIPLY"
    st = nt.nodes.new("ShaderNodeMath")
    st.operation = "MULTIPLY"
    st.inputs[1].default_value = strength
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_lin(color)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    add = nt.nodes.new("ShaderNodeAddShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(uv.outputs["UV"], sep.inputs[0])
    L(hv.outputs[0], sub.inputs[0])
    L(sep.outputs["X"], sub.inputs[1])
    L(sub.outputs[0], gt.inputs[0])
    L(sub.outputs[0], ex.inputs[0])
    L(ex.outputs[0], exp.inputs[1])
    exp.inputs[0].default_value = math.e
    L(exp.outputs[0], glow.inputs[0])
    L(glow.outputs[0], mask.inputs[0])
    L(gt.outputs[0], mask.inputs[1])
    L(sep.outputs["Y"], across.inputs[0])
    L(across.outputs[0], edge.inputs[0])
    L(mask.outputs[0], final.inputs[0])
    L(edge.outputs[0], final.inputs[1])
    L(final.outputs[0], st.inputs[0])
    L(st.outputs[0], em.inputs["Strength"])
    L(em.outputs[0], add.inputs[0])
    L(tr.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs["Surface"])
    return m


def key_value(mat, node_name, keys, interpolation="LINEAR"):
    node = mat.node_tree.nodes[node_name]
    for f, v in keys:
        node.outputs[0].default_value = v
        node.outputs[0].keyframe_insert("default_value", frame=f)


# ---------------------------------------------------------------- camera


def camera(col, scene, name, lens, keys, fstop=None, focus=None, target_keys=None):
    """Animated camera: keys = [(frame, location)], target_keys = [(frame, look point)] via Track To."""
    cam = _t(bpy.data.cameras.new(name))
    cam.lens = lens
    cam.sensor_fit = "AUTO"
    cam.sensor_width = 36.0
    cam.clip_start, cam.clip_end = 0.02, 300.0
    o = _obj(col, name, cam)
    tgt = _obj(col, f"{name}_Target", None)
    for f, loc in keys:
        o.location = loc
        o.keyframe_insert("location", frame=f)
    for f, loc in (target_keys or []):
        tgt.location = loc
        tgt.keyframe_insert("location", frame=f)
    con = o.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    if fstop:
        cam.dof.use_dof = True
        cam.dof.aperture_fstop = fstop
        cam.dof.focus_object = focus or tgt
    scene.camera = o
    return o, tgt


def ease_keys(obj, data_path="location"):
    """Bezier ease-in-out on an object's keys (camera moves)."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return
    for layer in getattr(ad.action, "layers", []):
        for strip_ in layer.strips:
            for bag in strip_.channelbags:
                for fc in bag.fcurves:
                    if fc.data_path == data_path:
                        for k in fc.keyframe_points:
                            k.interpolation = "BEZIER"
                            k.easing = "AUTO"


def net_tubes(net_obj, radius=0.012, color="#eef3ee"):
    """Give an edge-only canonical net thickness at render time (GN: mesh → curve → tube)."""
    ng = bpy.data.node_groups.get("HNC_NetTubes")
    if not ng:
        ng = _t(bpy.data.node_groups.new("HNC_NetTubes", "GeometryNodeTree"))
        ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        n = ng.nodes
        gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
        m2c = n.new("GeometryNodeMeshToCurve")
        prof = n.new("GeometryNodeCurvePrimitiveCircle")
        prof.inputs["Resolution"].default_value = 5
        prof.inputs["Radius"].default_value = radius
        c2m = n.new("GeometryNodeCurveToMesh")
        setm = n.new("GeometryNodeSetMaterial")
        ng.links.new(gi.outputs[0], m2c.inputs["Mesh"])
        ng.links.new(m2c.outputs["Curve"], c2m.inputs["Curve"])
        ng.links.new(prof.outputs["Curve"], c2m.inputs["Profile Curve"])
        ng.links.new(c2m.outputs["Mesh"], setm.inputs["Geometry"])
        ng.links.new(setm.outputs["Geometry"], go.inputs[0])
        mat = _t(bpy.data.materials.new("SET_NetTube"))
        mat.use_nodes = True
        b = mat.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = hex_lin(color)
        b.inputs["Roughness"].default_value = 0.8
        setm.inputs["Material"].default_value = mat
    mod = net_obj.modifiers.new("NetTubes", "NODES")
    mod.node_group = ng
    return mod


def pillar(col, center, radius, height, color, strength=6.0, seed=1):
    """A Current pillar: an open additive cylinder, bright at the ground, streaked, fading upward.
    Returns its material (keyframe `AuraLevel` with key_aura)."""
    import bmesh
    me = _t(bpy.data.meshes.new("FX_Pillar"))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=48, radius1=radius, radius2=radius * 1.25, depth=height)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, height / 2))
    bm.to_mesh(me)
    bm.free()
    o = _obj(col, "FX_Pillar", me)
    o.location = center
    o.visible_shadow = False
    m = _t(bpy.data.materials.new("FX_Pillar_Mat"))
    m.use_nodes = True
    m.surface_render_method = "BLENDED"
    nt = m.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    fall = nt.nodes.new("ShaderNodeMath")
    fall.operation = "MULTIPLY_ADD"  # 1 - z / height
    fall.inputs[1].default_value = -1.0 / height
    fall.inputs[2].default_value = 1.0
    powr = nt.nodes.new("ShaderNodeMath")
    powr.operation = "POWER"
    powr.inputs[1].default_value = 2.2
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (6.0, 6.0, 0.35)
    zdrv = mapping.inputs["Location"].driver_add("default_value", 2).driver
    zdrv.expression = "-frame / 60 * 1.6"
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 2.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.8
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.4
    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    level = nt.nodes.new("ShaderNodeValue")
    level.name = "AuraLevel"
    level.outputs[0].default_value = 0.0
    m3 = nt.nodes.new("ShaderNodeMath")
    m3.operation = "MULTIPLY"
    st = nt.nodes.new("ShaderNodeMath")
    st.operation = "MULTIPLY"
    st.inputs[1].default_value = strength
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_lin(color)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    add = nt.nodes.new("ShaderNodeAddShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(coord.outputs["Object"], sep.inputs[0])
    L(sep.outputs["Z"], fall.inputs[0])
    L(fall.outputs[0], powr.inputs[0])
    L(coord.outputs["Object"], mapping.inputs["Vector"])
    L(mapping.outputs["Vector"], noise.inputs["Vector"])
    L(noise.outputs["Fac"], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], m1.inputs[0])
    L(powr.outputs[0], m1.inputs[1])
    L(m1.outputs[0], m2.inputs[0])
    L(lw.outputs["Facing"], m2.inputs[1])
    L(m2.outputs[0], m3.inputs[0])
    L(level.outputs[0], m3.inputs[1])
    L(m3.outputs[0], st.inputs[0])
    L(st.outputs[0], em.inputs["Strength"])
    L(em.outputs[0], add.inputs[0])
    L(tr.outputs[0], add.inputs[1])
    L(add.outputs[0], out.inputs["Surface"])
    me.materials.append(m)
    return m


def follow(obj, target, offset, frames, step=4):
    """Keyframe `obj` at `target`'s world position + offset (lights riding a moving ball)."""
    scene = bpy.context.scene
    for f in list(range(1, frames + 1, step)) + [frames]:
        scene.frame_set(f)
        obj.location = target.matrix_world.translation + Vector(offset)
        obj.keyframe_insert("location", frame=f)
    scene.frame_set(1)
