"""S05_SH01 — the bakery callback: a deliberately dry shared acknowledgement."""
import bmesh
import bpy
from mathutils import Matrix, Vector

from ...cine import look, perform as P, props
from ...cine.sets import bakery


def _pose_mesh(name, fingers, material):
    """One low-poly, production hand-pose mesh: palm plus counted fingers."""
    bm = bmesh.new()
    def cube(center, scale):
        g = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0)), verts=g)
        bmesh.ops.translate(bm, vec=Vector(center), verts=g)
    cube((0.0, 0.0, 0.0), (.40, .13, .24))
    for x, h in fingers:
        cube((x, 0.0, .12 + h / 2), (.065, .11, h))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    return obj


def _counting_hands(sh, elder, hand_target):
    """Dedicated HAND_FOUR/HAND_ONE meshes follow the raised wrist by location.

    The canonical rig exposes no finger controls; this uses two explicit HNC
    low-poly pose meshes rather than a vague silhouette or a screen overlay.
    """
    skin = look.flat("S05_ElderHandSkin", "#a56d51", rough=.72)
    poses = {
        "HAND_FOUR": _pose_mesh("HAND_FOUR", ((-.135, .35), (-.045, .42), (.045, .39), (.135, .32)), skin),
        "HAND_ONE": _pose_mesh("HAND_ONE", ((-.045, .43),), skin),
    }
    for name, obj in poses.items():
        sh.cols["PROPS"].objects.link(obj)
        obj.location = hand_target
        obj["hnc_hand_pose"] = name
        # The authored wrist target stays planted here through both holds, so
        # the pose shares its exact wrist position without inheriting the rig's
        # arbitrary hand-control rotation.
        obj["hnc_attached_wrist"] = "TR-SUPPORTER-ELDER-01 hand.R (shared authored wrist target)"
    # 18 clear FOUR frames, then a clean replacement and 14 clear ONE frames.
    for frame in range(1, sh.frames + 1):
        four = 15 <= frame <= 32
        one = 39 <= frame <= 52
        for name, obj in poses.items():
            visible = four if name == "HAND_FOUR" else one
            obj.hide_render = not visible
            obj.hide_viewport = not visible
            obj.keyframe_insert("hide_render", frame=frame)
            obj.keyframe_insert("hide_viewport", frame=frame)
    return poses


def S05_SH01(sh):
    env = bakery.bakery(sh.scene, sh.cols["SET"], sh.cols["LGT"])
    # The location's front wall is a solid set shell.  Hide only that shell in
    # this exterior-through-window coverage; the actual window, furniture and
    # bakery lighting remain, giving the 50mm camera enough distance for both
    # people and the finger beat to read together.
    bpy.data.objects["BAK_FrontWall"].hide_render = True
    for obj in bpy.data.objects:
        if obj.name.startswith(("BAK_Window", "BAK_Mullion", "BAK_Rail")):
            obj.hide_render = True
        if obj.name.startswith("LGT_Pendant"):
            obj.data.energy *= .48
    bpy.data.objects["LGT_StreetKey"].data.energy = 280
    bpy.data.objects["LGT_Bounce"].data.energy = 28
    sh.scene.view_settings.exposure = -.45
    elder = sh.person("TR-SUPPORTER-ELDER-01", "home", profile="elder")
    nine = sh.person("TR-PLAYER-09", "home", profile="calm")

    # The supporter is already at the window table; #9 simply catches him on
    # the way past.  No broad staging or extra reaction.
    P.sit(elder, 0.0, env["elder_seat"], face=-58, seat_h=0.38, lean=3.0)
    P.stance(nine, 0.0, (-1.72, -1.62, 0.0), face=85, width=0.92)
    P.walk(nine, 0.06, [(-1.35, -1.63)], stride=0.54, cadence=1.45,
           style="casual", arms_swing=False)
    P.relax_arms(nine, 0.22)

    # The palm overlaps the elder's raised wrist/forearm rather than reading
    # as an isolated sign in the space between the two people.
    hand_target = (-2.45, -1.42, 1.43)
    P.look(elder, 0.18, (-0.10, -1.62, 1.38), w=0.58, dur=0.20)
    P.reach(elder, 0.24, "R", hand_target, dur=0.20, rot=(0, 0, 0), e="out")
    _counting_hands(sh, elder, hand_target)
    elder.hold("hand.R", 1.72)
    elder.hold("ik_hand.R", 1.72)
    P.nod(elder, 1.86, depth=2.8, dur=0.30)
    P.look(nine, 0.70, hand_target, w=0.72, dur=0.16)
    nine.key("head", 0.92, (1.7, -1.1, 0.0), "soft")
    # Dialogue is timing-only: use edit placement and a short dry body beat;
    # no audio is synthesized or generated in this task.
    line_start, line_end = sh.line_or("L01", (1.0, 1.46))
    P.talk(nine, line_start + 0.04, min(line_end, 1.52), [(line_start + 0.18, 0.42)], amount=0.26)

    cam = sh.camera(50, fstop=4.0)
    # Keep the 50mm camera just inside the front wall: this is a readable
    # interior two-shot, never an exterior view through the bakery facade.
    cam.place(0.0, (-1.00, -6.70, 1.62), (-2.18, -1.48, 1.34), focus=(-2.18, -1.48, 1.38))
    cam.place(sh.dur, (-.94, -6.62, 1.61), (-2.12, -1.48, 1.34), focus=(-2.12, -1.48, 1.38), e="linear")
    cam.handheld("locked", 0.28)
    sh.scene["hnc_event_frames"] = {"supporter_four_start": 15, "supporter_four_end": 32, "supporter_one_start": 39, "supporter_one_end": 52, "really_timing": 31, "supporter_nod": 57}
    sh.scene["hnc_dialogue_method"] = "L01 edit timing-only performance; no voice asset required"
    sh.finish(glare=0.05, threshold=1.55, vignette=0.10)


SHOTS = {"S05_SH01": S05_SH01}
