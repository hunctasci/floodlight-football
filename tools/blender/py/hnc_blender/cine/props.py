"""Props: mesh helpers, CC0 model import and procedural production props.

Procedural props are deliberately simple (silhouette + material + scale do
the work). Anything HNC-branded or character-like never comes from here.
Scale note: HNC adults are ~2.0 m tall with 0.67 m legs, so seat heights,
counters and steering wheels follow HNC ergonomics (see sets.ERGO).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import look
from .look import EXTERNAL, tag


def obj(col, name, mesh, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), parent=None, smooth=False):
    o = tag(bpy.data.objects.new(name, mesh))
    col.objects.link(o)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    o.scale = scale
    if mat:
        look.set_material(o, mat)
    if parent:
        o.parent = parent
    if smooth:
        for p in mesh.polygons:
            p.use_smooth = True
    return o


def _mesh(name, build):
    me = tag(bpy.data.meshes.new(name))
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    return me


def box(col, name, size, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, parent=None):
    """Box with its origin at the bottom centre (sets stack from the floor)."""
    sx, sy, sz = size

    def b(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * sx, v.co.y * sy, (v.co.z + 0.5) * sz))
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, profile=0.5, affect="EDGES")

    o = obj(col, name, _mesh(name, b), mat, loc, rot, parent=parent)
    if bevel > 0:
        for p in o.data.polygons:
            p.use_smooth = True
        o.data.shade_smooth()
    return o


def plane(col, name, size, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    sx, sy = size

    def b(bm):
        bm.loops.layers.uv.new("UVMap")  # calc_uvs fills an existing layer only
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True)  # UVs: decals, screens, flags
        for v in bm.verts:
            v.co.x *= sx
            v.co.y *= sy

    return obj(col, name, _mesh(name, b), mat, loc, rot, parent=parent)


def cyl(col, name, r, h, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), segs=32, r2=None, cap=True, smooth=True, parent=None, bottom=True):
    """Cylinder/cone with origin at the bottom centre."""
    def b(bm):
        bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)
        for v in bm.verts:
            v.co.z += h / 2 if bottom else 0

    o = obj(col, name, _mesh(name, b), mat, loc, rot, parent=parent)
    if smooth:
        o.data.shade_smooth()
    return o


def sphere(col, name, r, mat=None, loc=(0, 0, 0), scale=(1, 1, 1), segs=24, rings=12, smooth=True, parent=None):
    def b(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)

    o = obj(col, name, _mesh(name, b), mat, loc, scale=scale, parent=parent)
    if smooth:
        o.data.shade_smooth()
    return o


def torus(col, name, R, r, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), major=32, minor=12, arc=1.0, parent=None):
    def b(bm):
        verts = []
        for i in range(major + (0 if arc >= 1 else 1)):
            a = 2 * math.pi * arc * i / major
            ring = []
            for j in range(minor):
                t = 2 * math.pi * j / minor
                x = (R + r * math.cos(t)) * math.cos(a)
                y = (R + r * math.cos(t)) * math.sin(a)
                z = r * math.sin(t)
                ring.append(bm.verts.new((x, y, z)))
            verts.append(ring)
        rings = len(verts)
        for i in range(rings if arc >= 1 else rings - 1):
            a, c = verts[i], verts[(i + 1) % rings]
            for j in range(minor):
                bm.faces.new((a[j], c[j], c[(j + 1) % minor], a[(j + 1) % minor]))

    o = obj(col, name, _mesh(name, b), mat, loc, rot, parent=parent)
    o.data.shade_smooth()
    return o


def lathe(col, name, profile, mat=None, loc=(0, 0, 0), segs=40, parent=None, rot=(0, 0, 0)):
    """Surface of revolution from [(radius, z), …] (cups, bowls, pans, lamps)."""
    def b(bm):
        rings = []
        for rr, z in profile:
            ring = [bm.verts.new((rr * math.cos(2 * math.pi * i / segs), rr * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)]
            rings.append(ring)
        for a, c in zip(rings, rings[1:]):
            for i in range(segs):
                bm.faces.new((a[i], a[(i + 1) % segs], c[(i + 1) % segs], c[i]))
        if profile[0][0] > 1e-4:
            bm.faces.new(list(reversed(rings[0])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    o = obj(col, name, _mesh(name, b), mat, loc, rot, parent=parent)
    o.data.shade_smooth()
    return o


# ---------------------------------------------------------------- CC0 models


def external(col, model_id, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, name=None, ground=True):
    """Import a Poly Haven glTF under one pivot empty (origin at its footprint centre)."""
    path = EXTERNAL / model_id / f"{model_id}.gltf"
    if not path.exists():
        raise FileNotFoundError(f"{path} missing — run `python3 tools/blender/py/fetch_external.py {model_id}`")
    before = set(bpy.data.objects)
    layer = bpy.context.view_layer.layer_collection

    def find(lc):
        if lc.collection == col:
            return lc
        for ch in lc.children:
            r = find(ch)
            if r:
                return r
        return None

    lc = find(layer)
    if lc:
        bpy.context.view_layer.active_layer_collection = lc
    bpy.ops.import_scene.gltf(filepath=str(path), import_select_created_objects=False)
    new = [o for o in bpy.data.objects if o not in before]
    pivot = tag(bpy.data.objects.new(name or f"EXT_{model_id}", None))
    col.objects.link(pivot)
    for o in new:
        tag(o)
        if o.data is not None:
            tag(o.data)
        if o.parent is None:
            o.parent = pivot
    bpy.context.view_layer.update()
    if ground:
        pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
        if pts:
            lo = Vector([min(p[i] for p in pts) for i in range(3)])
            hi = Vector([max(p[i] for p in pts) for i in range(3)])
            off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
            for o in new:
                if o.parent is pivot:
                    o.location -= off
            pivot["hnc_size"] = tuple(hi - lo)
    pivot.location = loc
    pivot.rotation_euler = [math.radians(a) for a in rot]
    pivot.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    pivot["hnc_external"] = f"polyhaven:{model_id}"
    return pivot


# ---------------------------------------------------------------- production props


def mug(col, name="PROP_Mug", color="#e9e4da", loc=(0, 0, 0), coffee=True, r=0.042, h=0.095):
    """Ceramic mug (origin at the base centre, handle on +X)."""
    cer = look.flat(f"Ceramic_{color}", color, rough=0.22, coat=0.5)
    body = lathe(col, name, [(0.0, 0.0), (r * 0.92, 0.0), (r, 0.006), (r, h), (r * 0.9, h), (r * 0.88, 0.012), (0.0, 0.012)], cer, loc)
    # Full ring half-sunk into the wall; the part inside sits below the coffee line.
    torus(col, f"{name}.Handle", 0.024, 0.0065, cer, loc=(r + 0.012, 0, h * 0.5), rot=(90, 0, 0), parent=body)
    if coffee:
        cof = look.flat("Coffee", "#2a160c", rough=0.08, coat=0.9)
        cyl(col, f"{name}.Coffee", r * 0.87, 0.002, cof, loc=(0, 0, h * 0.82), parent=body)
    return body


def digital_clock(col, name="PROP_Clock", text="06:47", loc=(0, 0, 0), rot=(0, 0, 0), glow="#ff4a2e", strength=6.0):
    """Bedside clock: dark wedge body + emissive 7-segment digits (origin at base)."""
    body = box(col, name, (0.2, 0.08, 0.09), look.flat("ClockBody", "#15161a", rough=0.35, coat=0.3), loc, rot, bevel=0.008)
    face = box(col, f"{name}.Face", (0.17, 0.004, 0.062), look.flat("ClockGlass", "#050506", rough=0.05, coat=1.0), (0, -0.039, 0.014), parent=body)
    seg = look.emission(f"ClockSeg_{glow}", glow, strength)
    # 7-segment layout per digit, in a 0.03 x 0.05 cell
    SEG = {"a": (0, 1, 0.5, 1), "b": (1, 0.5, 1, 1), "c": (1, 0, 1, 0.5), "d": (0, 0, 0.5, 0), "e": (0, 0, 0, 0.5), "f": (0, 0.5, 0, 1), "g": (0, 0.5, 0.5, 0.5)}
    DIG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg"}
    w, hgt, th = 0.026, 0.044, 0.0055
    x0 = -0.066
    x = x0
    for ch in text:
        if ch == ":":
            for dz in (0.012, 0.03):
                box(col, f"{name}.Colon", (th, 0.002, th), seg, (x + 0.004, -0.042, 0.018 + dz), parent=body)
            x += 0.012
            continue
        for sname in DIG[ch]:
            xa, za, xb, zb = SEG[sname]
            horizontal = za == zb
            cx = x + (xa + (xb if horizontal else xa)) / (2 if horizontal else 1) * w * (1 if horizontal else 1)
            if horizontal:
                cx = x + w * 0.5
                cz = 0.018 + za * hgt
                box(col, f"{name}.Seg", (w * 0.78, 0.002, th), seg, (cx, -0.042, cz - th / 2), parent=body)
            else:
                cx = x + xa * w
                cz = 0.018 + min(za, zb) * hgt + hgt * 0.25
                box(col, f"{name}.Seg", (th, 0.002, hgt * 0.42), seg, (cx, -0.042, cz - hgt * 0.21 + 0.001), parent=body)
        x += w + 0.012
    return body


# ---------------------------------------------------------------- soft furnishing


def soft(col, name, size, mat, loc=(0, 0, 0), rot=(0, 0, 0), puff=0.02, levels=2, seed=0, parent=None, bevel=0.3):
    """Cushions, duvets, mattresses: bevelled box + subdivision + a lazy lumpy displace."""
    sx, sy, sz = size
    o = box(col, name, size, mat, loc, rot, bevel=min(sx, sy, sz) * bevel, parent=parent)
    sub = o.modifiers.new("Soft", "SUBSURF")
    sub.levels = sub.render_levels = levels
    if puff > 0:
        tex = tag(bpy.data.textures.new(f"{name}.Lumps", "CLOUDS"))
        tex.noise_scale = max(sx, sy) * 0.35
        tex.noise_basis = "ORIGINAL_PERLIN"
        d = o.modifiers.new("Lumps", "DISPLACE")
        d.texture = tex
        d.strength = puff
        d.mid_level = 0.5
        d.texture_coords = "OBJECT"
    o.data.shade_smooth()
    return o


def curtain(col, name, width, height, mat, loc, rot=(0, 0, 0), folds=9, depth=0.05):
    """Hanging curtain: a pleated sheet (sine folds), origin at the top centre."""
    def b(bm):
        nx, nz = folds * 6, 8
        verts = []
        for j in range(nz + 1):
            row = []
            for i in range(nx + 1):
                u = i / nx
                x = (u - 0.5) * width
                y = math.sin(u * folds * 2 * math.pi) * depth * (0.6 + 0.4 * j / nz)
                row.append(bm.verts.new((x, y, -height * j / nz)))
            verts.append(row)
        for j in range(nz):
            for i in range(nx):
                bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))

    o = obj(col, name, _mesh(name, b), mat, loc, rot)
    o.data.shade_smooth()
    return o


def rug(col, name, size, color, loc=(0, 0, 0)):
    return box(col, name, (size[0], size[1], 0.012), look.fabric(f"Rug_{color}", color, rough=0.95, sheen=0.3, noise=0.15, scale=180), loc, bevel=0.004)


# ---------------------------------------------------------------- kitchen / table


def pan(col, name="PROP_Pan", loc=(0, 0, 0), rot=(0, 0, 0), r=0.13):
    iron = look.flat("PanIron", "#1d1d20", rough=0.35, metal=0.9)
    body = lathe(col, name, [(0.0, 0.0), (r * 0.82, 0.0), (r, 0.04), (r * 1.02, 0.045), (r * 0.99, 0.047), (r * 0.8, 0.008), (0.0, 0.008)], iron, loc, rot=rot)
    handle = box(col, f"{name}.Handle", (0.2, 0.028, 0.02), look.flat("PanHandle", "#2a1d15", rough=0.6), (r + 0.1, 0, 0.035), rot=(0, -8, 0), parent=body)
    return body


# A real egg's profile (radius, height), blunt end down: widest at ~40 % of its height, a pointed top.
# Read at 1.2x life size so it holds its shape beside chunky HNC arms.
_EGG = [(0.0, 0.0), (0.012, 0.0015), (0.018, 0.006), (0.0215, 0.0135), (0.0225, 0.0225), (0.0215, 0.032),
        (0.0185, 0.0405), (0.0135, 0.048), (0.0072, 0.0538), (0.0, 0.0568)]
EGG_SCALE = 1.2


def _egg_profile(z0=0.0, z1=1.0):
    """Slice of the egg profile between height fractions z0..z1, centred on the egg's middle."""
    h = _EGG[-1][1]
    pts = []
    for (r0, a), (r1, b) in zip(_EGG, _EGG[1:]):
        for u in (0.0, 0.5):
            r, z = r0 + (r1 - r0) * u, a + (b - a) * u
            if z0 * h - 1e-6 <= z <= z1 * h + 1e-6:
                pts.append((r, z))
    if z1 >= 1.0:
        pts.append(_EGG[-1])
    return [(r * EGG_SCALE, (z - h * 0.5) * EGG_SCALE) for r, z in pts]


def _shell():
    return look.flat("EggShell", "#efe2cc", rough=0.55, sheen=0.25)


def egg_whole(col, name, loc, parent=None):
    """An uncracked egg (origin at its centre, blunt end down)."""
    return lathe(col, name, _egg_profile(), _shell(), loc, segs=36, parent=parent)


def egg_halves(col, name, loc):
    """A cracked egg: two open shell halves under a pivot empty at the crack line.
    Rotate the halves about their local X to open them. Returns (pivot, bottom, top)."""
    pivot = tag(bpy.data.objects.new(f"{name}.Pivot", None))
    col.objects.link(pivot)
    pivot.location = loc
    cut = 0.47  # the crack sits just below the widest point
    zc = (cut - 0.5) * _EGG[-1][1] * EGG_SCALE
    bottom = lathe(col, f"{name}.Bottom", [(r, z - zc) for r, z in _egg_profile(0.0, cut)], _shell(), (0, 0, 0), segs=36, parent=pivot)
    top = lathe(col, f"{name}.Top", [(r, z - zc) for r, z in reversed(_egg_profile(cut, 1.0))], _shell(), (0, 0, 0), segs=36, parent=pivot)
    for o in (bottom, top):
        o.rotation_mode = "XYZ"
    return pivot, bottom, top


def egg_fried(col, name, loc, seed=0):
    """Fried egg: an irregular flat white (baked at its real size: no parent scaling, so the yolk
    can never be stretched) + a separate glossy yolk dome. Returns (white, yolk); scale the white
    in X/Y only to spread it."""
    white = look.flat("EggWhite", "#f7f3ea", rough=0.3, coat=0.5)
    yolk = look.flat("EggYolk", "#f5a81e", rough=0.12, coat=0.9)
    R, H, segs = 0.068, 0.006, 48
    rnd = [math.sin(seed * 12.9898 + k * 78.233) * 43758.5453 % 1.0 for k in range(7)]

    def edge(th):  # a few low-frequency lobes: the white never spreads round
        return 1.0 + sum(0.07 * math.sin((k + 2) * th + rnd[k] * 6.28) / (k + 1) for k in range(4))

    def b(bm):
        top = bm.verts.new((0.0, 0.0, H))
        rings = []
        for f, z in ((0.45, H * 0.92), (0.8, H * 0.55), (1.0, 0.0)):
            rings.append([bm.verts.new((R * f * edge(2 * math.pi * i / segs) * math.cos(2 * math.pi * i / segs),
                                        R * f * edge(2 * math.pi * i / segs) * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
        for i in range(segs):
            bm.faces.new((top, rings[0][i], rings[0][(i + 1) % segs]))
        for ra, rb in zip(rings, rings[1:]):
            for i in range(segs):
                bm.faces.new((ra[i], rb[i], rb[(i + 1) % segs], ra[(i + 1) % segs]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])

    w = obj(col, name, _mesh(name, b), white, loc, smooth=True)
    y = sphere(col, f"{name}.Yolk", 0.024, yolk, (loc[0] + 0.008, loc[1] + 0.004, loc[2] + H * 0.8), scale=(1.0, 1.0, 0.62), segs=32, rings=16)
    return w, y


def carafe(col, name="PROP_Carafe", loc=(0, 0, 0), level=0.6):
    """Glass coffee carafe with a handle; coffee inside up to ``level`` of its height."""
    g = look.window_glass("CarafeGlass", reflect=0.18, tint="#f2f4f4")
    h = 0.2
    body = lathe(col, name, [(0.0, 0.0), (0.06, 0.0), (0.068, 0.02), (0.07, 0.12), (0.055, 0.17), (0.05, h), (0.052, h + 0.005)], g, loc)
    cof = look.flat("CarafeCoffee", "#1f0e06", rough=0.08, coat=1.0)
    lathe(col, f"{name}.Coffee", [(0.0, 0.002), (0.058, 0.002), (0.064, 0.02), (0.066, h * level)] + [(0.0, h * level)], cof, (0, 0, 0), parent=body)
    box(col, f"{name}.Handle", (0.02, 0.02, 0.12), look.flat("CarafeHandle", "#141416", rough=0.4), (-0.085, 0, 0.05), parent=body)
    box(col, f"{name}.Band", (0.15, 0.02, 0.02), look.flat("CarafeHandle", "#141416", rough=0.4), (-0.02, 0, 0.16), parent=body)
    return body


def pour_stream(col, name, a, b, r=0.006):
    """A thin coffee stream from spout ``a`` to cup ``b`` (straight, slight sag)."""
    cof = look.flat("StreamCoffee", "#2a1406", rough=0.05, coat=1.0)
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    o = cyl(col, name, r, L, cof, a, segs=10, r2=r * 0.8)
    d = (b - a).normalized()
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    return o


def plate(col, name="PROP_Plate", loc=(0, 0, 0), r=0.13, color="#f3efe8", parent=None):
    cer = look.flat(f"Plate_{color}", color, rough=0.2, coat=0.6)
    return lathe(col, name, [(0.0, 0.0), (r * 0.6, 0.0), (r * 0.65, 0.008), (r * 0.95, 0.018), (r, 0.022), (r * 0.97, 0.024), (r * 0.62, 0.012), (0.0, 0.012)], cer, loc, parent=parent)


def dinner(col, name, loc, parent=None):
    """A plated dinner: rice mound, a stew, greens (warm, appetising colours)."""
    base = tag(bpy.data.objects.new(name, None))
    col.objects.link(base)
    base.location = loc
    if parent:
        base.parent = parent
    soft(col, f"{name}.Rice", (0.09, 0.09, 0.035), look.flat("Rice", "#efe6d2", rough=0.7), (-0.03, 0.02, 0.012), puff=0.006, parent=base)
    soft(col, f"{name}.Stew", (0.1, 0.08, 0.028), look.flat("Stew", "#8e3a1a", rough=0.3, coat=0.8), (0.035, -0.015, 0.012), puff=0.008, parent=base)
    for i, (x, y) in enumerate(((0.05, 0.045), (0.07, 0.03), (0.03, 0.055))):
        sphere(col, f"{name}.Green{i}", 0.012, look.flat("Greens", "#4f7d2b", rough=0.6), (x, y, 0.03), scale=(1.4, 0.8, 0.5), parent=base, segs=8, rings=5)
    return base


def pepper(col, name, loc, color="#c8261c"):
    return sphere(col, name, 0.04, look.flat(f"Pepper_{color}", color, rough=0.18, coat=0.9), loc, scale=(1, 0.9, 1.15), segs=12, rings=8)


def knife(col, name, loc, rot=(0, 0, 0)):
    k = box(col, name, (0.2, 0.004, 0.035), look.flat("Steel", "#cfd2d6", rough=0.15, metal=1.0), loc, rot)
    box(col, f"{name}.Handle", (0.11, 0.016, 0.022), look.flat("KnifeHandle", "#1c1c1c", rough=0.5), (-0.155, 0, 0.006), parent=k)
    return k


def tea_glass(col, name, loc):
    """Turkish tea glass (ince belli) with tea, on a saucer."""
    g = look.window_glass("TeaGlass", reflect=0.5, tint="#fbfbf6")
    sau = lathe(col, f"{name}.Saucer", [(0.0, 0.0), (0.05, 0.0), (0.055, 0.008), (0.0, 0.006)], look.flat("Saucer", "#f2f0ea", rough=0.2), loc)
    gl = lathe(col, name, [(0.0, 0.006), (0.024, 0.006), (0.028, 0.03), (0.02, 0.055), (0.03, 0.095), (0.031, 0.1)], g, (0, 0, 0), parent=sau)
    lathe(col, f"{name}.Tea", [(0.0, 0.008), (0.023, 0.008), (0.027, 0.03), (0.02, 0.055), (0.026, 0.082), (0.0, 0.082)], look.flat("Tea", "#8a2a08", rough=0.05, coat=1.0, alpha=0.92), (0, 0, 0), parent=sau)
    return sau


def paper_bag(col, name, loc, rot=(0, 0, 0)):
    kraft = look.flat("Kraft", "#b98f5e", rough=0.85, sheen=0.2)
    b = soft(col, name, (0.2, 0.12, 0.27), kraft, loc, rot, puff=0.008, levels=1, bevel=0.06)
    return b


def phone(col, name, loc, rot=(0, 0, 0), screen=None, face_down=False):
    body = box(col, name, (0.078, 0.16, 0.009), look.flat("PhoneBody", "#121317", rough=0.3, coat=0.6), loc, rot, bevel=0.003)
    if screen is not None:
        plane(col, f"{name}.Screen", (0.07, 0.15), screen, (0, 0, 0.0095 if not face_down else -0.0005), rot=(0, 0, 0) if not face_down else (180, 0, 0), parent=body)
    return body


def ice_pack(col, name, loc, rot=(0, 0, 0)):
    gel = look.flat("IceGel", "#6fb6e8", rough=0.12, coat=1.0)
    return soft(col, name, (0.2, 0.14, 0.035), gel, loc, rot, puff=0.004, bevel=0.3)


def duffel(col, name, loc, rot=(0, 0, 0), color="#1f2530"):
    cloth = look.fabric(f"Duffel_{color}", color, rough=0.7, sheen=0.3, noise=0.05, scale=90)
    b = soft(col, name, (0.62, 0.3, 0.3), cloth, loc, rot, puff=0.01, bevel=0.45)
    red = look.flat("DuffelTrim", "#c8141e", rough=0.6)
    box(col, f"{name}.Stripe", (0.64, 0.02, 0.05), red, (0, -0.15, 0.13), parent=b)
    box(col, f"{name}.Strap", (0.5, 0.04, 0.012), look.flat("Strap", "#101216", rough=0.6), (0, 0, 0.3), parent=b)
    return b


def floor_lamp(col, name, loc, on=True, power=40.0, color="#ffcf9a", height=1.9):
    metal = look.flat("LampBrass", "#8a6a3a", rough=0.3, metal=1.0)
    base = cyl(col, name, 0.16, 0.03, metal, loc, segs=32)
    cyl(col, f"{name}.Pole", 0.012, height, metal, (0, 0, 0.03), parent=base, segs=10)
    shade_m = look.flat("LampShade", "#efe3cc", rough=0.8, sheen=0.3, emit=color if on else None, emit_strength=1.5 if on else 0)
    shade = lathe(col, f"{name}.Shade", [(0.2, 0.0), (0.12, 0.3), (0.118, 0.3), (0.198, 0.0)], shade_m, (0, 0, height - 0.2), parent=base)
    if on:
        L = look.point(col, f"{name}.Light", (0, 0, height - 0.05), power, color, radius=0.08)
        L.parent = base
    return base


def tr_shirt(col, name, loc, rot=(0, 0, 0), number_png=None, folded=False):
    """A Türkiye #9 shirt in the HNC language (hex torso + sleeves, white stripe,
    the canonical number texture on the back) — for the hanger / bag inserts."""
    red = look.flat("ShirtTR", "#e30a17", rough=0.8, sheen=0.4)
    white = look.flat("ShirtTRTrim", "#ffffff", rough=0.85, sheen=0.3)
    root = tag(bpy.data.objects.new(name, None))
    col.objects.link(root)
    root.location = loc
    root.rotation_euler = [math.radians(a) for a in rot]
    if folded:
        soft(col, f"{name}.Fold", (0.42, 0.34, 0.06), red, (0, 0, 0), puff=0.004, parent=root, bevel=0.2)
        box(col, f"{name}.FoldStripe", (0.43, 0.08, 0.004), white, (0, 0.06, 0.06), parent=root)
        return root
    torso = cyl(col, f"{name}.Torso", 0.34, 0.66, red, (0, 0, -0.72), segs=6, smooth=False, parent=root, r2=0.3)
    torso.scale = (1, 0.42, 1)
    band = cyl(col, f"{name}.Stripe", 0.352, 0.14, white, (0, 0, -0.26), segs=6, smooth=False, parent=root, r2=0.315)
    band.scale = (1, 0.43, 1)
    for sx in (1, -1):
        sl = cyl(col, f"{name}.Sleeve", 0.1, 0.34, red, (sx * 0.36, 0, -0.1), segs=5, smooth=False, parent=root)
        sl.rotation_euler = (0, math.radians(sx * 140), 0)
    if number_png:
        im = bpy.data.images.load(str(number_png), check_existing=True)
        m = look.flat("ShirtNumber9", "#ffffff", rough=0.8)
        nt = m.node_tree
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        t.interpolation = "Closest"
        b = nt.nodes["Principled BSDF"]
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
        m.surface_render_method = "BLENDED"
        # the exported number PNG is stored in glTF UV orientation (flipped vertically): flip the decal back
        nb = plane(col, f"{name}.Number", (0.36, 0.36), m, (0, -0.15, -0.5), rot=(90, 0, 0), parent=root)
        nb.scale = (1, -1, 1)
    # hanger
    wood = look.flat("Hanger", "#6b4a2e", rough=0.5)
    box(col, f"{name}.Hanger", (0.62, 0.02, 0.025), wood, (0, 0, -0.03), parent=root)
    torus(col, f"{name}.Hook", 0.035, 0.004, look.flat("Steel", "#cfd2d6", rough=0.15, metal=1.0), (0, 0, 0.04), rot=(90, 0, 0), parent=root)
    return root


def boots_canonical(scene, col, loc, rot=(0, 0, 0)):
    """The canonical HNC boots (copied from the exported TR #9) standing as a pair."""
    from .cast import import_identity
    root, _a = import_identity(scene, col, "hnc-player-tr-09")
    parts = {o.get("hncPart"): o for o in root.children_recursive}
    pair = tag(bpy.data.objects.new("PROP_Boots", None))
    col.objects.link(pair)
    pair.location = loc
    pair.rotation_euler = [math.radians(a) for a in rot]
    keep = []
    for i, key in enumerate(("legL.boot", "legR.boot")):
        b = parts[key]
        mw = b.matrix_world.copy()
        b.parent = pair
        b.matrix_parent_inverse.identity()
        b.location = ((i - 0.5) * 0.2, 0, 0.06)
        b.rotation_euler = (0, 0, math.radians((i - 0.5) * 16))
        keep.append(b)
    for o in [root, *root.children_recursive]:
        if o not in keep:
            bpy.data.objects.remove(o)
    return pair
