"""Training ground: mown grass, the canonical HNC goal (+ a net-bulge rig),
cones, spare balls, a real training-field HDRI behind (CC0).

Pitch space: the goal line at y = GOAL_Y, goal mouth centred on x = 0, the
shooter comes from -Y toward +Y... (the camera usually sits at -Y).
"""
import math

import bpy
from mathutils import Vector

from .. import look, props
from ..cast import prop_identity
from ..look import tag

GOAL_Y = 16.0


def grass():
    m, new = look._new("Pitch_Grass")
    if not new:
        return m
    nt = m.node_tree
    n = nt.nodes
    b = n["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Sheen Weight"].default_value = 0.4
    geo = n.new("ShaderNodeNewGeometry")
    sep = n.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    wave = n.new("ShaderNodeMath")
    wave.operation = "SINE"
    mul = n.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = math.pi / 5.5  # 5.5 m mowing stripes
    nt.links.new(sep.outputs["Y"], mul.inputs[0])
    nt.links.new(mul.outputs[0], wave.inputs[0])
    gt = n.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.0
    nt.links.new(wave.outputs[0], gt.inputs[0])
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.5
    ramp = n.new("ShaderNodeMix")
    ramp.data_type = "RGBA"
    ramp.inputs["A"].default_value = look.lin("#2e6a26")
    ramp.inputs["B"].default_value = look.lin("#3c7d2f")
    nt.links.new(gt.outputs[0], ramp.inputs["Factor"])
    mix2 = n.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    mix2.blend_type = "MULTIPLY"
    mix2.inputs["Factor"].default_value = 0.35
    nt.links.new(ramp.outputs["Result"], mix2.inputs["A"])
    nt.links.new(noise.outputs["Color"], mix2.inputs["B"])
    nt.links.new(mix2.outputs["Result"], b.inputs["Base Color"])
    fine = n.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 420.0
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def pitch(scene, col, lcol, goal=True, keeper=None):
    props.plane(col, "PITCH_Grass", (120, 120), grass(), (0, 0, 0))
    line = look.flat("Pitch_Line", "#eef0ea", rough=0.8)
    props.box(col, "PITCH_GoalLine", (30, 0.12, 0.004), line, (0, GOAL_Y, 0))
    props.box(col, "PITCH_Box18", (0.12, 16.5, 0.004), line, (-20.16, GOAL_Y - 8.25, 0))
    props.box(col, "PITCH_Box18b", (0.12, 16.5, 0.004), line, (20.16, GOAL_Y - 8.25, 0))
    props.box(col, "PITCH_Box18c", (40.3, 0.12, 0.004), line, (0, GOAL_Y - 16.5, 0))
    props.box(col, "PITCH_Box6", (18.3, 0.12, 0.004), line, (0, GOAL_Y - 5.5, 0))
    cone_m = look.flat("Cone", "#ff7a1a", rough=0.5)
    for i, (x, y) in enumerate(((-4, 2), (-2.5, 4), (-4, 6), (-2.5, 8), (5, 3), (6, 5))):
        props.cyl(col, "PITCH_Cone", 0.1, 0.28, cone_m, (x, y, 0), r2=0.015, segs=16)
    goal_root = None
    net = None
    if goal:
        goal_root = prop_identity(scene, col, "hnc-goal")
        # canonical goal is world-placed at the game's +x end: re-seat it on our goal line facing -Y
        goal_root.location = (0, 0, 0)
        goal_root.rotation_mode = "XYZ"  # the glTF importer leaves QUATERNION: Euler edits would be ignored
        goal_root.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        net = next((o for o in goal_root.children_recursive if o.get("hncPart") == "net"), None)
        frame = [o for o in goal_root.children_recursive if o.type == "MESH"]
        pts = [o.matrix_world @ Vector(c) for o in frame for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        # the game goal's mouth faces -X; +90° about Z turns it to face -Y, then centre it on x=0, line at GOAL_Y
        goal_root.rotation_euler = (0, 0, math.radians(90))
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in frame for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        goal_root.location = (-(lo.x + hi.x) / 2, GOAL_Y - lo.y, -lo.z)
        # net: the canonical net is glTF LINES (edges only). Render the same edges as thin tubes
        # (Geometry Nodes: Mesh to Curve -> Curve to Mesh); the bulge Displace runs before it.
        if net is not None:
            tm = look.flat("NetThread", "#f2f2f2", rough=0.7)
            mod = thread_tubes(net, radius=0.011)
            mod.node_group.nodes[net["hnc_thread_setmat"]].inputs["Material"].default_value = tm
    look.world(scene, hdri="suburban_football_field", hdri_strength=1.1, rot_deg=30)
    look.sun(lcol, "LGT_Sun", (40, 10, 150), power=4.2, color="#fff3e2", angle=2.0)
    scene.view_settings.exposure = -0.2
    return dict(goal=goal_root, net=net, goal_mouth=Vector((0, GOAL_Y, 1.2)))


def thread_tubes(obj, radius=0.01):
    ng = tag(bpy.data.node_groups.new("HNC_ThreadTubes", "GeometryNodeTree"))
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n = ng.nodes
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    m2c = n.new("GeometryNodeMeshToCurve")
    c2m = n.new("GeometryNodeCurveToMesh")
    circ = n.new("GeometryNodeCurvePrimitiveCircle")
    circ.inputs["Resolution"].default_value = 6
    circ.inputs["Radius"].default_value = radius
    mat = n.new("GeometryNodeSetMaterial")
    ng.links.new(gi.outputs[0], m2c.inputs["Mesh"])
    ng.links.new(m2c.outputs["Curve"], c2m.inputs["Curve"])
    ng.links.new(circ.outputs["Curve"], c2m.inputs["Profile Curve"])
    ng.links.new(c2m.outputs["Mesh"], mat.inputs["Geometry"])
    ng.links.new(mat.outputs["Geometry"], go.inputs[0])
    mod = obj.modifiers.new("Threads", "NODES")
    mod.node_group = ng
    obj["hnc_thread_setmat"] = mat.name
    return mod


def net_bulge(col, net, frames, fps, at, point, depth=0.6, dur=0.5):
    """Push the net out where the ball hits: a Displace keyed on strength, local via an empty."""
    if net is None:
        return
    ctl = tag(bpy.data.objects.new("FX_NetHit", None))
    col.objects.link(ctl)
    ctl.location = point
    tex = tag(bpy.data.textures.new("NetBulge", "BLEND"))
    tex.progression = "SPHERICAL"
    d = net.modifiers.new("Bulge", "DISPLACE")
    while net.modifiers.find("Bulge") > 0:
        bpy.context.view_layer.objects.active = net
        with bpy.context.temp_override(object=net):
            bpy.ops.object.modifier_move_up(modifier="Bulge")
    d.texture = tex
    d.texture_coords = "OBJECT"
    d.texture_coords_object = ctl
    d.direction = "Y"
    d.mid_level = 0.0
    ctl.scale = (1.6, 1.6, 1.6)
    from ..perform import write_tracks
    tr = {}
    for f in range(1, frames + 1):
        t = (f - 1) / fps
        u = (t - at) / dur
        s = 0.0 if u < 0 else depth * math.exp(-3.5 * u) * math.sin(min(math.pi / 2, u * 8) if u < 0.2 else math.pi / 2)
        tr.setdefault((d, "strength", 0), []).append(s)
    write_tracks(tr, frames)
