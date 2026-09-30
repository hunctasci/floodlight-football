"""Acting test — the cinematic rig's QA shot (stand, look, walk, sit, hold a cup).

    blender -b --factory-startup --python tools/blender/py/hnc_cli.py -- acting-test --out <dir> [--quality preview]

Choreography (9 s @ 60 fps): TR #9 idles, notices the chair, walks over,
turns and sits, reaches for the mug on the side table, sips, lowers it,
then side-eyes the camera with the small HNC smile.
"""
import bpy
from mathutils import Vector

from . import cast, look, props
from . import perform as P

FPS = 60
SECONDS = 10.5


def build(scene, quality="preview"):
    frames = int(SECONDS * FPS)
    scene["hnc_generated"] = True
    col = bpy.data.collections.new("ACTING")
    scene.collection.children.link(col)
    look.setup_render(scene, frames, quality)
    look.world(scene, hdri="sunny_vondelpark", hdri_strength=0.35, rot_deg=110, bg_color="#20242b", bg_strength=1.0)

    # --- set: floor, wall, chair, side table, mug
    props.plane(col, "SET_Floor", (10, 10), look.pbr("Floor_Oak", "wood_floor", scale=0.5), (0, 0, 0))
    props.plane(col, "SET_Wall", (10, 4), look.pbr("Wall_Plaster", "white_plaster_02", scale=0.4, tint="#efe9df"), (0, 2.2, 2.0), rot=(90, 0, 0))
    chair = props.external(col, "dining_chair_02", loc=(0.8, 0.52, 0), rot=(0, 0, 180))
    size = chair["hnc_size"]
    chair.scale = [0.36 / 0.46] * 3  # model seat ≈ 0.46 m -> HNC seat 0.36 m
    wood = look.pbr("SideTable_Oak", "oak_veneer_01", scale=1.5)
    top_z = 0.56
    tbl = props.box(col, "SET_SideTable", (0.46, 0.46, 0.035), wood, (1.55, 0.45, top_z - 0.035), bevel=0.004)
    for dx in (-0.19, 0.19):
        for dy in (-0.19, 0.19):
            props.box(col, "SET_SideTable.Leg", (0.035, 0.035, top_z - 0.035), wood, (1.55 + dx, 0.45 + dy, 0))
    mug = props.mug(col, color="#2f5d62", loc=(1.42, 0.36, top_z))

    # --- cast
    p = cast.person(scene, col, "TR-PLAYER-09", "home", fps=FPS, frames=frames, seed=9)
    d = p.dims
    P.stance(p, 0.0, (-1.3, 0.25, 0.0), face=12.0)
    P.relax_arms(p, 0.0)
    # 0–1.3 idle; eyes drift to the chair, head follows
    P.look(p, 0.25, (-2.5, -3.0, 1.6), w=0.35, dur=0.6)
    P.weight_shift(p, 0.4, "R", dur=1.0, amount=0.025)
    P.glance(p, 1.25, -0.8, -0.15, dur=0.14, hold=None)
    P.look(p, 1.35, (0.8, 0.52, 0.6), w=0.8, dur=0.5, eyes=False)
    P.release_look(p, 2.1, dur=0.6)
    p.hold("gaze", 1.9)
    p.key("gaze", 2.3, (0.0, 0.0))
    p.key("hips", 1.9, (0.0, 0.0, 0.0))
    p.key("hips_rot", 1.9, (0.0, 0.0, 0.0))
    p.key("chest", 1.9, (0.0, 0.0, 0.0))
    # 2.0 walk to the chair, stop facing the camera
    t = P.walk(p, 2.0, [(-0.3, 0.02), (0.8, 0.14)], lead="R", end_face=0.0)
    # sit down (seat 0.36 m, chair at y 0.52)
    t = P.sit_down(p, t + 0.1, (0.8, 0.5, 0.0), face=0.0, seat_h=0.36)
    # reach left hand to the mug on the table at his left
    cup_top = Vector((1.42, 0.36, top_z))
    grip = Vector((0.0, 0.05, 0.075))  # hand-bone space: down the forearm, forward
    t_reach = t + 0.35
    P.look(p, t_reach - 0.15, cup_top + Vector((0, 0, 0.05)), w=0.45, dur=0.35)
    wrist = cup_top + Vector((-0.02, 0.0, 0.13))
    P.reach(p, t_reach, "L", tuple(wrist), dur=0.55, rot=(0.0, 0.0, 90.0))
    p.key("chest", t_reach + 0.5, (4.0, 5.0, 12.0), "soft")
    t_grab = t_reach + 0.6
    p.hold_prop(mug, "L", t_grab, 99.0)
    # lift to the face (a sip), head tips back a touch
    head = Vector(d["head"])
    seated_head = Vector((0.8, 0.5, 0.0)) + Vector((0.0, 0.0, head.z + (0.36 + 0.12 - d["hip"])))
    mouth = seated_head + Vector((0.1, -0.46, -0.12))
    P.release_look(p, t_grab + 0.1, 0.4)
    p.key("chest", t_grab + 0.6, (1.0, 1.0, 4.0), "soft")
    P.reach(p, t_grab + 0.15, "L", tuple(mouth + Vector((-0.03, 0.02, -0.06))), dur=0.7, rot=(55.0, 0.0, 90.0))
    t_sip = t_grab + 0.9
    p.hold("head", t_sip - 0.1)
    p.key("head", t_sip + 0.25, (-9.0, 0.0, 0.0), "soft")
    p.hold("head", t_sip + 0.6)
    p.key("head", t_sip + 0.95, (2.0, 0.0, 0.0), "soft")
    # lower the mug to rest on the thigh
    lap = Vector((0.8, 0.5, 0.0)) + Vector((0.12, -0.56, 0.66))  # in front of the torso (HNC torsos cover the lap)
    P.reach(p, t_sip + 0.65, "L", tuple(lap), dur=0.6, rot=(10.0, 0.0, 90.0))
    # side-eye to the lens, then the small smile
    cam_pos = Vector((-2.2, -6.4, 1.45))
    t_eye = t_sip + 1.35
    P.glance(p, t_eye, 0.0, 0.0, hold=None)
    p.hold("gaze_at", t_eye)
    p.key("gaze_at", t_eye, tuple(cam_pos), "hold")
    p.hold("gaze_w", t_eye)
    p.key("gaze_w", t_eye + 0.16, 1.0, "out")
    P.smile(p, t_eye + 0.45, amount=0.6, dur=0.4, tilt=3.0)
    p.blink_avoid.append((t_eye, t_eye + 0.5))
    p.bake()

    # --- camera: 35 mm observational, slight drift
    cam = bpy.data.objects.new("CAM", bpy.data.cameras.new("CAM"))
    col.objects.link(cam)
    cam.data.lens = 35
    cam.data.sensor_fit = "AUTO"
    cam.data.sensor_width = 36
    cam.location = cam_pos
    look.look_at(cam, (0.1, 0.35, 0.85))
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_object = p.rig.parts["head"]
    scene.camera = cam
    # --- light: window key from camera-left, soft fill, warm practical rim
    look.area(col, "KEY_Window", (-2.6, -1.4, 2.4), (0.3, 0.3, 1.0), (1.6, 2.2), 420, "#fff2e0")
    look.area(col, "FILL", (2.8, -3.0, 1.6), (0.5, 0.3, 1.0), (2.5, 2.5), 80, "#dfe8ff")
    look.area(col, "RIM", (1.8, 1.8, 2.3), (0.6, 0.3, 1.3), (0.6, 1.2), 160, "#ffd7a8")
    look.finish(scene)
    return p
