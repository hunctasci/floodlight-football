"""Cinematic performance rig for an imported canonical HNC character.

Identity stays canonical: the rig only ADDS an armature and re-parents the
imported parts to it. Joint positions are measured from the imported parts
(so the adult, the child and every wardrobe rig themselves). The one
geometry-level change is topological and rest-neutral: each limb stick gets
two edge loops around its middle so an elbow / knee can bend; at rest every
vertex stays exactly where the canonical mesh has it (checked below).

Armature space = Blender object space of the rig: character faces -Y, its
left is +X, Z up. Semantic rotations are authored in that space and converted
per bone (``local_quat``), so bone rolls never leak into performance code.

Bones
  pelvis ─ spine ─ neck(aim) ─ head ─ eyes_aim ─ eyes ─ eye.L / eye.R
         │       ├ upperarm.L ─ forearm.L ─ hand.L      (and .R)
         └ thigh.L ─ shin.L ─ foot.L                    (and .R)
World-space control empties (per character):
  IK.foot.L/R, IK.hand.L/R  — IK targets (feet planted, hands on props)
  POLE.knee.L/R, POLE.elbow.L/R — bend directions (ride with the rig object)
  LOOK, GAZE — head aim / eye aim targets (constraint influence is animated)
"""
import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

from ..interchange import GENERATED_TAG, base_name

LOOP_DELTA = 0.035  # half-width of the elbow/knee blend band (m, rest length 0.67)


def _t(block):
    block[GENERATED_TAG] = True
    return block


def _parts(root):
    """Imported objects by canonical handle (hncPart) — never by guessed names."""
    out = {}
    for o in (root, *root.children_recursive):
        part = o.get("hncPart")
        if part:
            out[part] = o
    return out


def _bbox(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def _split_limb(obj):
    """Add two rest-neutral edge loops at mid-length; return (top_z, bottom_z) in local space."""
    me = obj.data
    before = sorted(tuple(round(c, 6) for c in v.co) for v in me.vertices)
    bm = bmesh.new()
    bm.from_mesh(me)
    zs = [v.co.z for v in bm.verts]
    top, bot = max(zs), min(zs)
    mid = (top + bot) / 2
    for z in (mid + LOOP_DELTA, mid - LOOP_DELTA):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1))
    bm.to_mesh(me)
    bm.free()
    me.update()
    # Rest-neutral: the original vertices are all still present and unmoved.
    after = {tuple(round(c, 6) for c in v.co) for v in me.vertices}
    missing = [p for p in before if p not in after]
    if missing:
        raise RuntimeError(f"{obj.name}: limb split moved canonical vertices")
    for p in me.polygons:  # new faces inherit the flat HNC look
        p.use_smooth = False
    return top, bot


def _weights(obj, upper, lower, top, bot):
    mid = (top + bot) / 2
    gu = obj.vertex_groups.new(name=upper)
    gl = obj.vertex_groups.new(name=lower)
    for v in obj.data.vertices:
        z = v.co.z
        if z > mid + LOOP_DELTA * 0.5:
            w = 1.0 if z > mid + LOOP_DELTA * 1.5 else 0.65
        elif z < mid - LOOP_DELTA * 0.5:
            w = 0.0 if z < mid - LOOP_DELTA * 1.5 else 0.35
        else:
            w = 0.5
        if w > 0:
            gu.add([v.index], w, "REPLACE")
        if w < 1:
            gl.add([v.index], 1 - w, "REPLACE")


def _empty(name, collection, loc, size=0.08, shape="SPHERE"):
    e = _t(bpy.data.objects.new(name, None))
    e.empty_display_type = shape
    e.empty_display_size = size
    e.location = loc
    collection.objects.link(e)
    return e


class CineRig:
    """Handles to one rigged character (armature + control empties + measurements)."""

    def __init__(self, arm, controls, dims, parts, tag):
        self.arm = arm
        self.c = controls
        self.dims = dims
        self.parts = parts
        self.tag = tag

    @property
    def pose(self):
        return self.arm.pose.bones

    def rest(self, bone):
        return self.arm.data.bones[bone].matrix_local.to_3x3()

    def local_quat(self, bone, rot):
        """Armature-space rotation (Quaternion/Matrix) -> this bone's pose quaternion."""
        b = self.rest(bone)
        m = rot.to_matrix() if isinstance(rot, Quaternion) else rot
        return (b.inverted() @ m @ b).to_quaternion()


def build_rig(root, collection, tag=None):
    """Rig an imported canonical character in place. Returns a CineRig.

    ``root`` is the imported GLB root (identity transform, standing at the
    origin facing -Y — call before placing it in the set).
    """
    parts = _parts(root)
    tag = tag or base_name(root.name).replace("HNC_Player_", "").replace("_", "")
    bpy.context.view_layer.update()

    head_o = parts["head"]
    head_c = head_o.matrix_world.translation.copy()
    head_r = (_bbox(head_o)[1].z - _bbox(head_o)[0].z) / 2
    body_lo, body_hi = _bbox(parts["body"])
    limbs = {}
    for side, leg, arm in (("L", "legR", "armR"), ("R", "legL", "armL")):  # canonical R = anatomical L
        for kind, part in (("leg", leg), ("arm", arm)):
            o = parts[part]
            lo, hi = _bbox(o)
            limbs[(kind, side)] = dict(obj=o, x=o.matrix_world.translation.x, top=hi.z, bot=lo.z,
                                       y=o.matrix_world.translation.y)
    hip_z = limbs[("leg", "L")]["top"]
    shoulder_z = limbs[("arm", "L")]["top"]
    neck_z = head_c.z - head_r * 0.62
    eyes = {("L" if o.matrix_world.translation.x > 0 else "R"): o for k, o in parts.items() if k.startswith("eyes[")}

    arm_data = _t(bpy.data.armatures.new(f"{tag}.RigData"))
    arm_data.display_type = "STICK"
    arm = _t(bpy.data.objects.new(f"{tag}.Rig", arm_data))
    collection.objects.link(arm)
    arm["hnc_rig"] = tag
    arm.show_in_front = True
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    fwd = Vector((0, -1, 0))

    def bone(name, head, tail, parent=None, roll_to=None, deform=False):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if roll_to is not None:
            b.align_roll(Vector(roll_to))
        if parent:
            b.parent = eb[parent]
        b.use_deform = deform
        return b

    bone("pelvis", (0, 0, hip_z), (0, 0, hip_z + 0.12), roll_to=fwd)
    bone("spine", (0, 0, hip_z + 0.06), (0, 0, shoulder_z), "pelvis", roll_to=fwd)
    bone("neck", (0, 0, neck_z), (0, -0.25, neck_z), "spine", roll_to=(0, 0, 1))
    bone("head", (0, 0, neck_z), (0, -0.22, neck_z), "neck", roll_to=(0, 0, 1))
    bone("eyes_aim", tuple(head_c), tuple(head_c + Vector((0, -0.2, 0))), "head", roll_to=(0, 0, 1))
    bone("eyes", tuple(head_c), tuple(head_c + Vector((0, -0.18, 0))), "eyes_aim", roll_to=(0, 0, 1))
    for s, eo in eyes.items():
        p = eo.matrix_world.translation
        bone(f"eye.{s}", tuple(p), tuple(p + Vector((0, -0.05, 0))), "eyes", roll_to=(0, 0, 1))
    for s in ("L", "R"):
        a = limbs[("arm", s)]
        mid = (a["top"] + a["bot"]) / 2
        # Elbow a hair behind the line: IK bends it backwards, like an elbow.
        # Shoulder pivot sits inside the torso (inset + below the stick top) so a raised
        # arm's top cap swings into the body instead of poking above the shoulder line.
        sx = a["x"] - (0.07 if a["x"] > 0 else -0.07) * (a["top"] - a["bot"]) / 0.67
        bone(f"upperarm.{s}", (sx, a["y"], a["top"] - 0.06 * (a["top"] - a["bot"]) / 0.67), (a["x"], a["y"] + 0.012, mid), "spine", roll_to=fwd, deform=True)
        bone(f"forearm.{s}", (a["x"], a["y"] + 0.012, mid), (a["x"], a["y"], a["bot"]), f"upperarm.{s}", roll_to=fwd, deform=True)
        eb[f"forearm.{s}"].use_connect = True
        bone(f"hand.{s}", (a["x"], a["y"], a["bot"]), (a["x"], a["y"], a["bot"] - 0.08), f"forearm.{s}", roll_to=fwd)
        eb[f"hand.{s}"].use_connect = True
        g = limbs[("leg", s)]
        mid = (g["top"] + g["bot"]) / 2
        # Knee a hair in front of the line: IK bends it forwards.
        bone(f"thigh.{s}", (g["x"], g["y"], g["top"]), (g["x"], g["y"] - 0.012, mid), "pelvis", roll_to=fwd, deform=True)
        bone(f"shin.{s}", (g["x"], g["y"] - 0.012, mid), (g["x"], g["y"], g["bot"]), f"thigh.{s}", roll_to=fwd, deform=True)
        eb[f"shin.{s}"].use_connect = True
        bone(f"foot.{s}", (g["x"], g["y"], g["bot"]), (g["x"], g["y"] - 0.2, g["bot"]), f"shin.{s}", roll_to=(0, 0, 1))
        eb[f"foot.{s}"].use_connect = True
    bpy.ops.object.mode_set(mode="OBJECT")

    # ---- controls (world-space empties) --------------------------------
    ctl = {}
    for s in ("L", "R"):
        g, a = limbs[("leg", s)], limbs[("arm", s)]
        ctl[f"foot.{s}"] = _empty(f"{tag}.IK.foot.{s}", collection, (g["x"], g["y"], g["bot"]), 0.1, "CUBE")
        ctl[f"hand.{s}"] = _empty(f"{tag}.IK.hand.{s}", collection, (a["x"], a["y"], a["bot"]), 0.06, "CUBE")
        pk = _empty(f"{tag}.POLE.knee.{s}", collection, (g["x"], -0.9, (g["top"] + g["bot"]) / 2), 0.05)
        pe = _empty(f"{tag}.POLE.elbow.{s}", collection, (a["x"] * 1.6, 0.9, (a["top"] + a["bot"]) / 2), 0.05)
        pk.parent = pe.parent = arm  # bend directions travel with the body
        ctl[f"pole.knee.{s}"], ctl[f"pole.elbow.{s}"] = pk, pe
    ctl["look"] = _empty(f"{tag}.LOOK", collection, tuple(head_c + Vector((0, -3, 0))), 0.1, "PLAIN_AXES")
    ctl["gaze"] = _empty(f"{tag}.GAZE", collection, tuple(head_c + Vector((0, -3, 0))), 0.06, "PLAIN_AXES")

    pb = arm.pose.bones
    for b in pb:
        b.rotation_mode = "QUATERNION"
    for s in ("L", "R"):
        for chain, tip, target, pole in (("shin", "foot", f"foot.{s}", f"pole.knee.{s}"),
                                         ("forearm", "hand", f"hand.{s}", f"pole.elbow.{s}")):
            ik = pb[f"{chain}.{s}"].constraints.new("IK")
            ik.name = "IK"
            ik.target = ctl[target]
            ik.pole_target = ctl[pole]
            ik.pole_angle = 0.0  # calibrated below
            ik.chain_count = 2
            ik.use_tail = True
            ik.influence = 1.0 if chain == "shin" else 0.0
            cr = pb[f"{tip}.{s}"].constraints.new("COPY_ROTATION")
            cr.name = "IKRot"
            cr.target = ctl[target]
            cr.influence = 1.0 if chain == "shin" else 0.0
    for bone_name, target, lim in (("neck", "look", 1.2), ("eyes_aim", "gaze", 0.34)):
        dt = pb[bone_name].constraints.new("DAMPED_TRACK")
        dt.name = "Aim"
        dt.target = ctl[target]
        dt.track_axis = "TRACK_Y"
        dt.influence = 0.0
        lr = pb[bone_name].constraints.new("LIMIT_ROTATION")
        lr.name = "Limit"
        lr.owner_space = "LOCAL"
        lr.use_limit_x = lr.use_limit_z = True
        lr.min_x, lr.max_x = -lim * 0.7, lim * 0.7
        lr.min_z, lr.max_z = -lim, lim

    # ---- parent the canonical parts --------------------------------------
    bpy.context.view_layer.update()
    rigid = {"body": "spine", "stripe": "spine", "number": "spine", "shorts": "pelvis", "head": "head"}
    keep = {}
    for part, o in parts.items():
        keep[o] = o.matrix_world.copy()

    def to_bone(o, b):
        o.parent = arm
        o.parent_type = "BONE"
        o.parent_bone = b

    for part, o in parts.items():
        if part in rigid:
            to_bone(o, rigid[part])
        elif part.startswith("eyes["):
            to_bone(o, f"eye.{'L' if keep[o].translation.x > 0 else 'R'}")
        elif part.endswith(".boot"):
            to_bone(o, "foot.L" if part == "legR.boot" else "foot.R")
        elif part.startswith("extras.") and o.parent is root:
            to_bone(o, "spine")  # torso wardrobe (jacket, scarf, hood…); head wear stays on the head
    for s, part in (("L", "armR"), ("R", "armL")):
        for kind, upper, lower in (("arm", "upperarm", "forearm"),):
            o = parts[part]
            top, bot = _split_limb(o)
            _weights(o, f"{upper}.{s}", f"{lower}.{s}", top, bot)
    for s, part in (("L", "legR"), ("R", "legL")):
        o = parts[part]
        top, bot = _split_limb(o)
        _weights(o, f"thigh.{s}", f"shin.{s}", top, bot)
    for part in ("armL", "armR", "legL", "legR"):
        o = parts[part]
        o.parent = arm
        o.parent_type = "OBJECT"
        mod = o.modifiers.new("Rig", "ARMATURE")
        mod.object = arm
        mod.use_deform_preserve_volume = True
    root.parent = arm
    bpy.context.view_layer.update()
    for o, m in keep.items():
        o.matrix_world = m
    root.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()

    dims = dict(hip=hip_z, shoulder=shoulder_z, neck=neck_z, head=tuple(head_c), head_r=head_r,
                arm_len=limbs[("arm", "L")]["top"] - limbs[("arm", "L")]["bot"],
                leg_len=limbs[("leg", "L")]["top"] - limbs[("leg", "L")]["bot"],
                foot_x={s: limbs[("leg", s)]["x"] for s in "LR"},
                hand_x={s: limbs[("arm", s)]["x"] for s in "LR"},
                ankle=limbs[("leg", "L")]["bot"], body_top=body_hi.z, body_bottom=body_lo.z)
    rig = CineRig(arm, ctl, dims, parts, tag)
    _calibrate_poles(rig)
    _check_rest(rig, keep)
    return rig


def _calibrate_poles(rig):
    """Pick the IK pole angle that reproduces the rest pose (no twist) per chain."""
    import math
    pb = rig.pose
    for s in ("L", "R"):
        for chain, first in (("shin", "thigh"), ("forearm", "upperarm")):
            ik = pb[f"{chain}.{s}"].constraints["IK"]
            old = ik.influence
            ik.influence = 1.0
            best = None
            for deg in range(-180, 180, 5):
                ik.pole_angle = math.radians(deg)
                bpy.context.view_layer.update()
                rest = rig.arm.data.bones[f"{first}.{s}"].matrix_local
                got = pb[f"{first}.{s}"].matrix
                err = sum(abs(a - b) for ra, rb in zip(rest, got) for a, b in zip(ra, rb))
                if best is None or err < best[0]:
                    best = (err, deg)
            ik.pole_angle = math.radians(best[1])
            ik.influence = old
    bpy.context.view_layer.update()


def _check_rest(rig, keep):
    """At rest (IK on the feet at their rest spots) every part must be where the import put it."""
    bpy.context.view_layer.update()
    worst = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    for o, m in keep.items():
        worst = max(worst, (o.matrix_world.translation - m.translation).length)
        if o.type == "MESH" and o.modifiers:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            src = o.data
            if len(me.vertices) == len(src.vertices):
                for a, b in zip(me.vertices, src.vertices):
                    worst = max(worst, (a.co - b.co).length)
            ev.to_mesh_clear()
    if worst > 1e-4:
        raise RuntimeError(f"{rig.tag}: rig changed the rest pose by {worst:.5f} m")
    rig.arm["hnc_rest_error"] = worst
