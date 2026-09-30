"""Canonical-parity inspection of imported HNC assets inside Blender.

Every expectation comes from the manifest's ``expected`` block, which
tools/blender/src/interchange.ts derives from the canonical THREE objects —
nothing here is hand-typed geometry.
"""
import datetime
import json

import bpy
from mathutils import Vector

from .interchange import base_name, gltf_box_to_blender, gltf_to_blender, load_manifest
from .paths import PARITY_REPORT, inside_repo, rel

TOL_POS = 1e-4
TOL_COLOR = 1e-4


def _close(a, b, tol):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def _r(v, n=5):
    return [round(float(x), n) for x in v]


def _world_box(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def _material_info(mat):
    """Colour / roughness / texture as the importer wired them."""
    nodes = mat.node_tree.nodes
    info = {"render_method": mat.surface_render_method, "color": None, "roughness": None,
            "metallic": None, "texture": None, "unlit": False}
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    emit = next((n for n in nodes if n.type == "EMISSION"), None)
    socket = None
    if bsdf is not None:
        socket = bsdf.inputs["Base Color"]
        info["roughness"] = bsdf.inputs["Roughness"].default_value
        info["metallic"] = bsdf.inputs["Metallic"].default_value
    elif emit is not None:  # KHR_materials_unlit → Emission + camera-ray mix
        info["unlit"] = True
        socket = emit.inputs["Color"]
    if socket is not None:
        if socket.is_linked and socket.links[0].from_node.type == "TEX_IMAGE":
            img = socket.links[0].from_node.image
            info["texture"] = {"name": img.name, "size": list(img.size), "packed": img.packed_file is not None,
                               "has_data": bool(img.has_data), "colorspace": img.colorspace_settings.name}
        elif not socket.is_linked:
            info["color"] = list(socket.default_value)[:3]
    return info


def _outward_fraction(obj):
    """Share of faces whose normal points away from the part centre (flipped-normal check)."""
    me = obj.data
    centre = sum((v.co for v in me.vertices), Vector()) / max(1, len(me.vertices))
    good = sum(1 for p in me.polygons if (p.center - centre).dot(p.normal) > 0)
    return good / max(1, len(me.polygons))


def inspect_asset(asset, scene, root=None):
    """``root``: inspect this imported instance (several copies of one identity may share a scene)."""
    exp = asset["expected"]
    checks = []

    def check(name, ok, expected=None, actual=None, node=None):
        checks.append({"check": name, "node": node, "pass": bool(ok), "expected": expected, "actual": actual})

    # Scene-local, suffix-tolerant: another scene in the same file may own the plain name.
    root = root or scene.objects.get(exp["root"]) or next((o for o in scene.objects if o.parent is None and base_name(o.name) == exp["root"]), None)
    check("root present", root is not None, exp["root"], root.name if root else None)
    if root is None:
        return _summary(asset, None, checks, None)
    objs = {base_name(o.name): o for o in (root, *root.children_recursive)}
    check("node count", len(objs) == len(exp["nodes"]), len(exp["nodes"]), len(objs))
    check("root transform is identity (coordinate conversion lives in the importer)",
          _close(root.matrix_basis.to_euler(), (0, 0, 0), 1e-6) and _close(root.scale, (1, 1, 1), 1e-6),
          "identity rotation/scale", {"rot": _r(root.matrix_basis.to_euler()), "scale": _r(root.scale)})

    offset = root.matrix_world.translation.copy()
    mesh_boxes = []
    for n in exp["nodes"]:
        o = objs.get(n["name"])
        check("node present", o is not None, n["name"], o.name if o else None, n["name"])
        if o is None:
            continue
        parent = base_name(o.parent.name) if o.parent else None
        check("parent", parent == n["parent"], n["parent"], parent, n["name"])
        check("canonical handle", o.get("hncPart") == n["part"], n["part"], o.get("hncPart"), n["name"])
        # glTF scale (x, y, z) -> Blender (x, z, y); non-unit only for re-proportioned characters.
        sx, sy, sz = n.get("scale", (1, 1, 1))
        check("canonical scale", _close(o.scale, (sx, sz, sy), 1e-5), [sx, sz, sy], _r(o.scale), n["name"])
        want_pos = Vector(gltf_to_blender(n["worldPosition"])) + offset
        got_pos = o.matrix_world.translation
        check("world position", _close(got_pos, want_pos, TOL_POS), _r(want_pos), _r(got_pos), n["name"])
        if n.get("lines"):
            # Line primitives (goal net) arrive as an edge-only mesh.
            ok = o.type == "MESH" and len(o.data.edges) == n["lines"] and len(o.data.polygons) == 0
            check("line segments", ok, n["lines"], len(o.data.edges) if o.type == "MESH" else o.type, n["name"])
            if o.type == "MESH":
                got_lo, got_hi = _world_box(o)
                mesh_boxes.append((got_lo, got_hi))
            continue
        if not n["mesh"]:
            check("is empty", o.type == "EMPTY", "EMPTY", o.type, n["name"])
            continue
        check("is mesh", o.type == "MESH", "MESH", o.type, n["name"])
        if o.type != "MESH":
            continue
        me = o.data
        me.calc_loop_triangles()
        check("triangles", len(me.loop_triangles) == n["triangles"], n["triangles"], len(me.loop_triangles), n["name"])
        lo, hi = gltf_box_to_blender(n["worldMin"], n["worldMax"])
        lo, hi = Vector(lo) + offset, Vector(hi) + offset
        got_lo, got_hi = _world_box(o)
        mesh_boxes.append((got_lo, got_hi))
        check("world bounds", _close(got_lo, lo, TOL_POS) and _close(got_hi, hi, TOL_POS),
              [_r(lo), _r(hi)], [_r(got_lo), _r(got_hi)], n["name"])
        smooth = sum(p.use_smooth for p in me.polygons)
        if n["hasNormals"]:
            # Exported normals arrive as custom normals; a planar decal is legitimately flat.
            planar = n["triangles"] <= 2
            want = n.get("smoothTriangles", len(me.polygons))
            ok = me.has_custom_normals and (planar or smooth == want)
            check("canonical normals kept (smooth/unlit part)", ok, "custom normals" + ("" if planar else f" + {want} smooth"),
                  {"smooth": smooth, "polys": len(me.polygons), "custom": me.has_custom_normals}, n["name"])
        else:
            check("flat shading kept (low-poly HNC style)", smooth == 0 and not me.has_custom_normals,
                  "0 smooth faces, no custom normals", {"smooth": smooth, "custom": me.has_custom_normals}, n["name"])
        degenerate = sum(1 for p in me.polygons if p.area < 1e-10)
        check("no degenerate faces", degenerate == 0, 0, degenerate, n["name"])
        if n["part"] != "number":  # the decal is an open single-sided plane
            frac = _outward_fraction(o)
            # Convex parts must be ~1; non-convex wardrobe (a torus scarf) must match the exporter's value.
            want = n.get("outward", 1.0)
            ok = frac >= 0.99 if want >= 0.99 else abs(frac - want) <= 0.02
            check("normals face outward", ok, ">= 0.99" if want >= 0.99 else f"{want} ± 0.02", round(frac, 4), n["name"])
        mat = o.material_slots[0].material if o.material_slots else None
        check("material", mat is not None and base_name(mat.name) == n["material"], n["material"],
              mat.name if mat else None, n["name"])

    # Materials: colour, roughness, unlit, texture.
    used = {base_name(s.material.name): s.material for o in objs.values() if o.type == "MESH"
            for s in o.material_slots if s.material}
    for m in exp["materials"]:
        mat = used.get(m["name"])
        check("material present", mat is not None, m["name"], None if mat is None else mat.name, m["name"])
        if mat is None:
            continue
        info = _material_info(mat)
        check("unlit flag", info["unlit"] == m["unlit"], m["unlit"], info["unlit"], m["name"])
        if m["map"]:
            tex = info["texture"]
            ok = bool(tex) and tex["size"] == [m["map"]["width"], m["map"]["height"]] and tex["packed"] and tex["has_data"]
            check("texture baked + packed", ok, m["map"], tex, m["name"])
        else:
            check("base colour (linear)", info["color"] is not None and _close(info["color"], m["baseColorLinear"], TOL_COLOR),
                  {"linear": m["baseColorLinear"], "hex": m["baseColorHex"]}, _r(info["color"] or [], 6), m["name"])
        if m["roughness"] is not None:
            check("roughness", info["roughness"] is not None and abs(info["roughness"] - m["roughness"]) < 1e-4,
                  m["roughness"], info["roughness"], m["name"])
        if m["transparent"]:
            check("alpha blended", info["render_method"] == "BLENDED", "BLENDED", info["render_method"], m["name"])

    # Whole-asset bounds / dimensions in Blender axes (X width, Y depth, Z height).
    lo, hi = gltf_box_to_blender(exp["boundsMin"], exp["boundsMax"])
    lo, hi = Vector(lo) + offset, Vector(hi) + offset
    got_lo = Vector([min(b[0][i] for b in mesh_boxes) for i in range(3)])
    got_hi = Vector([max(b[1][i] for b in mesh_boxes) for i in range(3)])
    check("asset bounds", _close(got_lo, lo, TOL_POS) and _close(got_hi, hi, TOL_POS),
          [_r(lo), _r(hi)], [_r(got_lo), _r(got_hi)])
    dims = _r(got_hi - got_lo, 4)

    if asset.get("sourceFactory") == "createHncPlayerVisual":
        tag = exp["root"].replace("HNC_Player_", "").replace("_", "")
        head, body = objs.get(f"{tag}.Head"), objs.get(f"{tag}.Body")
        eye, number = objs.get(f"{tag}.Eye.L"), objs.get(f"{tag}.ShirtNumber")
        if head and eye and body:
            check("faces -Y (Blender front): eyes in front of head",
                  eye.matrix_world.translation.y < head.matrix_world.translation.y,
                  "eye.y < head.y", [round(eye.matrix_world.translation.y, 4), round(head.matrix_world.translation.y, 4)])
            if number:  # wardrobes without a back number (tee, office) do not export it
                check("shirt number on the back (+Y)", number.matrix_world.translation.y > body.matrix_world.translation.y,
                      "number.y > body.y", [round(number.matrix_world.translation.y, 4), round(body.matrix_world.translation.y, 4)])
            check("anatomical left is +X", objs[f"{tag}.Leg.L"].matrix_world.translation.x > 0, "> 0",
                  round(objs[f"{tag}.Leg.L"].matrix_world.translation.x, 4))

    return _summary(asset, root, checks, {"x_width": dims[0], "y_depth": dims[1], "z_height": dims[2]})


def _summary(asset, root, checks, dims):
    failed = [c for c in checks if not c["pass"]]
    return {"assetId": asset["assetId"], "root": root.name if root else None, "pass": not failed,
            "checks_total": len(checks), "checks_failed": len(failed), "dimensions_m": dims,
            "failures": failed, "checks": checks}


def inspect_scene(scene=None, manifest=None):
    scene = scene or bpy.context.scene
    manifest = manifest or load_manifest()
    # Cast assets (plate identities) are inspected by the plates that import them.
    assets = [inspect_asset(a, scene) for a in manifest["assets"] if a.get("purpose", "verification") == "verification"]
    images = [i for i in bpy.data.images if i.get("hnc_generated")]
    missing = [i.name for i in images if not i.has_data or tuple(i.size) == (0, 0)]
    current = {a["assetId"]: a["sha256"] for a in manifest["assets"]}
    built_from = json.loads(scene["hnc_built_from"]) if "hnc_built_from" in scene else None
    fresh = built_from == current
    return {
        "schema": "hnc-blender-parity/1",
        "inspectedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "blender": bpy.app.version_string,
        "blendFile": rel(bpy.data.filepath) if bpy.data.filepath else "<unsaved>",
        "scene": scene.name,
        "manifestGitHead": manifest["git"]["head"],
        "manifestAssets": current,
        "missingTextures": missing,
        "builtFromCurrentAssets": fresh,
        "pass": all(a["pass"] for a in assets) and not missing and fresh,
        "assets": assets,
    }


def write_report(report, path=PARITY_REPORT):
    out = inside_repo(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    return out
