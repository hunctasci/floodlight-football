"""Look development: materials, lights, worlds, render + compositor presets.

Environments are allowed to be more realistic than HNC characters (PBR, CC0
textures, practical lights); one lighting setup per shot unifies both.
Everything created here is tagged ``hnc_generated``. Colours are sRGB hex.
"""
import math

import bpy
from mathutils import Vector

from ..interchange import GENERATED_TAG
from ..paths import GENERATED
from ..scene import VIEW_TRANSFORM

EXTERNAL = GENERATED / "external" / "polyhaven"
_cache = {}


def tag(block):
    block[GENERATED_TAG] = True
    return block


def lin(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], a)


def look_at(obj, target, up="Y"):
    d = Vector(target) - obj.matrix_world.translation if obj.parent else Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", up).to_euler()


# ---------------------------------------------------------------- materials


def _new(name):
    key = ("mat", name)
    if key in _cache and _cache[key].name in bpy.data.materials:
        return _cache[key], False
    m = tag(bpy.data.materials.new(name))
    m.use_nodes = True
    _cache[key] = m
    return m, True


def flat(name, color, rough=0.6, metal=0.0, spec=0.5, coat=0.0, sheen=0.0, emit=None, emit_strength=0.0, alpha=1.0):
    """Plain principled material (procedural props, painted surfaces)."""
    m, new = _new(name)
    if not new:
        return m
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Sheen Weight"].default_value = sheen
    if emit:
        b.inputs["Emission Color"].default_value = lin(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    return m


def emission(name, color, strength=5.0):
    m, new = _new(name)
    if not new:
        return m
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = lin(color)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def glass(name="GlassClear", color="#ffffff", rough=0.02, tint=1.0):
    m, new = _new(name)
    if not new:
        return m
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = tint
    b.inputs["IOR"].default_value = 1.45
    return m


def _img(path, colorspace):
    key = ("img", str(path), colorspace)
    if key in _cache and _cache[key].name in bpy.data.images:
        return _cache[key]
    im = tag(bpy.data.images.load(str(path), check_existing=True))
    im.colorspace_settings.name = colorspace
    _cache[key] = im
    return im


def pbr(name, tex, scale=1.0, tint=None, rough_mul=1.0, rough_add=0.0, bump=1.0, res="2k", world=False, sat=1.0, value=1.0):
    """CC0 texture set (diffuse/rough/normal) with box projection in object (or world) space.

    ``scale`` = texture repeats per metre.
    """
    m, new = _new(name)
    if not new:
        return m
    nt = m.node_tree
    n = nt.nodes
    b = n["Principled BSDF"]
    base = EXTERNAL / tex
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs["Object" if not world else "Generated"], mapping.inputs["Vector"])
    if world:
        geo = n.new("ShaderNodeNewGeometry")
        nt.links.new(geo.outputs["Position"], mapping.inputs["Vector"])

    def tex_node(kind, cs):
        path = base / f"{tex}_{kind}_{res}.jpg"
        if not path.exists():
            return None
        t = n.new("ShaderNodeTexImage")
        t.image = _img(path, cs)
        t.projection = "BOX"
        t.projection_blend = 0.25
        nt.links.new(mapping.outputs["Vector"], t.inputs["Vector"])
        return t

    diff = tex_node("diff", "sRGB")
    if diff:
        out = diff.outputs["Color"]
        if sat != 1.0 or value != 1.0:
            hsv = n.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = sat
            hsv.inputs["Value"].default_value = value
            nt.links.new(out, hsv.inputs["Color"])
            out = hsv.outputs["Color"]
        if tint:
            mix = n.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs["B"].default_value = lin(tint)
            nt.links.new(out, mix.inputs["A"])
            out = mix.outputs["Result"]
        nt.links.new(out, b.inputs["Base Color"])
    rough = tex_node("rough", "Non-Color")
    if rough:
        mr = n.new("ShaderNodeMath")
        mr.operation = "MULTIPLY_ADD"
        mr.inputs[1].default_value = rough_mul
        mr.inputs[2].default_value = rough_add
        nt.links.new(rough.outputs["Color"], mr.inputs[0])
        nt.links.new(mr.outputs[0], b.inputs["Roughness"])
    nor = tex_node("nor_gl", "Non-Color")
    if nor and bump > 0:
        nm = n.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = bump
        nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def fabric(name, color, rough=0.85, sheen=0.6, noise=0.04, scale=60.0):
    """Soft cloth: sheen + a fine weave bump (procedural)."""
    m, new = _new(name)
    if not new:
        return m
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Roughness"].default_value = 0.6
    wave = nt.nodes.new("ShaderNodeTexNoise")
    wave.inputs["Scale"].default_value = scale
    bumpn = nt.nodes.new("ShaderNodeBump")
    bumpn.inputs["Strength"].default_value = noise
    nt.links.new(wave.outputs["Fac"], bumpn.inputs["Height"])
    nt.links.new(bumpn.outputs["Normal"], b.inputs["Normal"])
    return m


def set_material(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------- lights


def area(col, name, loc, target, size=(1.0, 1.0), power=100.0, color="#ffffff", shape="RECTANGLE", spread=180.0, shadow_soft=None):
    L = tag(bpy.data.lights.new(name, "AREA"))
    L.shape = shape
    L.size, L.size_y = size
    L.energy = power
    L.color = lin(color)[:3]
    L.spread = math.radians(spread)
    o = tag(bpy.data.objects.new(name, L))
    o.location = loc
    col.objects.link(o)
    look_at(o, target)
    return o


def point(col, name, loc, power=50.0, color="#ffffff", radius=0.05):
    L = tag(bpy.data.lights.new(name, "POINT"))
    L.energy = power
    L.color = lin(color)[:3]
    L.shadow_soft_size = radius
    o = tag(bpy.data.objects.new(name, L))
    o.location = loc
    col.objects.link(o)
    return o


def spot(col, name, loc, target, power=500.0, color="#ffffff", angle=40.0, blend=0.4, radius=0.05):
    L = tag(bpy.data.lights.new(name, "SPOT"))
    L.energy = power
    L.color = lin(color)[:3]
    L.spot_size = math.radians(angle)
    L.spot_blend = blend
    L.shadow_soft_size = radius
    o = tag(bpy.data.objects.new(name, L))
    o.location = loc
    col.objects.link(o)
    look_at(o, target)
    return o


def sun(col, name, rot_deg, power=3.0, color="#ffffff", angle=1.5):
    L = tag(bpy.data.lights.new(name, "SUN"))
    L.energy = power
    L.color = lin(color)[:3]
    L.angle = math.radians(angle)
    o = tag(bpy.data.objects.new(name, L))
    o.rotation_euler = [math.radians(a) for a in rot_deg]
    col.objects.link(o)
    return o


# ---------------------------------------------------------------- world


def world(scene, color="#101216", strength=1.0, hdri=None, hdri_strength=1.0, rot_deg=0.0, bg_strength=None, bg_color=None):
    """Plain colour world, or an HDRI for light/reflections with an optional
    separate camera-visible background (``bg_strength`` / ``bg_color``)."""
    w = tag(bpy.data.worlds.new(f"{scene.name}_World"))
    w.use_nodes = True
    nt = w.node_tree
    n = nt.nodes
    bg = n["Background"]
    out = n["World Output"]
    if hdri:
        paths = list(EXTERNAL.joinpath(hdri).glob("*.hdr"))
        if not paths:
            hdri = None
        else:
            path = paths[0]
    if hdri:
        env = n.new("ShaderNodeTexEnvironment")
        env.image = _img(path, "Linear Rec.709")
        coord = n.new("ShaderNodeTexCoord")
        mp = n.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot_deg))
        nt.links.new(coord.outputs["Generated"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = hdri_strength
        if bg_strength is not None or bg_color is not None:
            # Light paths see the HDRI; the camera sees a controlled background.
            bg2 = n.new("ShaderNodeBackground")
            if bg_color:
                bg2.inputs["Color"].default_value = lin(bg_color)
            else:
                nt.links.new(env.outputs["Color"], bg2.inputs["Color"])
            bg2.inputs["Strength"].default_value = bg_strength if bg_strength is not None else hdri_strength
            lp = n.new("ShaderNodeLightPath")
            mix = n.new("ShaderNodeMixShader")
            nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
            nt.links.new(bg.outputs[0], mix.inputs[1])
            nt.links.new(bg2.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], out.inputs["Surface"])
    else:
        bg.inputs["Color"].default_value = lin(color)
        bg.inputs["Strength"].default_value = strength
    scene.world = w
    return w


# ---------------------------------------------------------------- render


QUALITY = {
    # samples, res %, motion blur, volumetric samples
    "animatic": dict(samples=8, pct=40, blur=False, vol=16, rt=False),
    "preview": dict(samples=24, pct=50, blur=True, vol=32, rt=True),
    "final": dict(samples=96, pct=100, blur=True, vol=96, rt=True),
    # full resolution, a third of the samples: ~3x faster than final; the edit's grain hides the difference
    "release": dict(samples=32, pct=100, blur=True, vol=48, rt=True),
    # Delivery profile: authored at 30fps then retimed to a true 60fps scene.
    "final60": dict(samples=256, pct=100, blur=True, vol=96, rt=True),
}


def setup_render(scene, frames, quality="preview", exposure=0.0, look_name="None", fps=60):
    q = QUALITY[quality]
    r = scene.render
    r.resolution_x, r.resolution_y = 1080, 1920
    r.resolution_percentage = q["pct"]
    r.fps, r.fps_base = fps, 1.0
    scene.frame_start, scene.frame_end = 1, frames
    r.engine = "BLENDER_EEVEE"
    ee = scene.eevee
    # Blender 5.2 retains this EEVEE sampling property.  Keep the guard so a
    # future Blender API change does not prevent a final render from starting.
    if hasattr(ee, "taa_render_samples"):
        ee.taa_render_samples = q["samples"]
    ee.use_shadows = True
    ee.shadow_ray_count = 2 if quality in ("final", "final60") else 1
    ee.shadow_step_count = 8 if quality in ("final", "final60") else 4
    ee.use_raytracing = q["rt"]
    ee.ray_tracing_options.resolution_scale = "1" if quality in ("final", "final60") else "2"
    ee.use_fast_gi = True
    ee.volumetric_tile_size = "4" if quality not in ("final", "final60") else "2"
    ee.volumetric_samples = q["vol"]
    ee.use_volumetric_shadows = True
    r.use_motion_blur = q["blur"]
    r.motion_blur_shutter = 0.5  # 180° shutter at 60 fps
    ee.motion_blur_steps = 1
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    r.image_settings.compression = 15
    scene.display_settings.display_device = "sRGB"
    scene.view_settings.view_transform = VIEW_TRANSFORM
    scene.view_settings.look = look_name
    scene.view_settings.exposure = exposure
    r.use_compositing = True
    return q


def finish(scene, glare=0.25, threshold=1.2, vignette=0.28, dispersion=0.004):
    """Compositor finish shared by every shot: soft bloom, gentle vignette and a
    touch of lens dispersion. Film grain + the final grade are applied once, in
    the edit, over Blender and Remotion shots alike (one picture language)."""
    ng = tag(bpy.data.node_groups.new(f"{scene.name}_Finish", "CompositorNodeTree"))
    ng.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    n = ng.nodes
    L = ng.links
    rl = n.new("CompositorNodeRLayers")
    rl.scene = scene
    img = rl.outputs["Image"]
    if glare > 0:
        gl = n.new("CompositorNodeGlare")
        gl.inputs["Type"].default_value = "Fog Glow"
        gl.inputs["Quality"].default_value = "High"
        gl.inputs["Threshold"].default_value = threshold
        gl.inputs["Strength"].default_value = glare
        gl.inputs["Size"].default_value = 0.55
        L.new(img, gl.inputs["Image"])
        img = gl.outputs["Image"]
    if dispersion > 0:
        ld = n.new("CompositorNodeLensdist")
        ld.inputs["Dispersion"].default_value = dispersion
        ld.inputs["Fit"].default_value = True
        L.new(img, ld.inputs["Image"])
        img = ld.outputs["Image"]
    if vignette > 0:
        em = n.new("CompositorNodeEllipseMask")
        em.inputs["Size"].default_value = (1.25, 1.05)
        bl = n.new("CompositorNodeBlur")
        bl.inputs["Size"].default_value = (260, 260)
        L.new(em.outputs["Mask"], bl.inputs["Image"])
        mix = n.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = vignette  # image * lerp(1, mask, vignette)
        L.new(img, mix.inputs["A"])
        L.new(bl.outputs["Image"], mix.inputs["B"])
        img = mix.outputs["Result"]
    out = n.new("NodeGroupOutput")
    L.new(img, out.inputs["Image"])
    scene.compositing_node_group = ng
    return ng


def window_glass(name="WindowGlass", reflect=0.35, tint="#dfe8ea", rough=0.02):
    """Thin architectural/car glass seen straight through: clear transmission
    (no refraction blur) + Fresnel reflections of the lights sliding over it."""
    m, new = _new(name)
    if not new:
        return m
    nt = m.node_tree
    n = nt.nodes
    n.clear()
    tr = n.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = lin(tint)
    gl = n.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = rough
    fr = n.new("ShaderNodeLayerWeight")
    fr.inputs["Blend"].default_value = 0.4
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY_ADD"
    mul.inputs[1].default_value = reflect
    mul.inputs[2].default_value = 0.04
    nt.links.new(fr.outputs["Fresnel"], mul.inputs[0])
    mix = n.new("ShaderNodeMixShader")
    nt.links.new(mul.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    out = n.new("ShaderNodeOutputMaterial")
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_transparent_shadow = True
    return m
