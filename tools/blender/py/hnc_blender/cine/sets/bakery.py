"""A small neighbourhood bakery (fırın): compact, warm, built to camera.

Counter + glass display along the back (+Y), bread shelves on the back wall,
pendants, the street window and a glass door with a bell in the front wall
(-Y), and the regular's window table (tea glass) at front-left.
"""
import bpy
from mathutils import Vector

from .. import look, props
from ..look import tag
from . import ERGO
from .home import cut

C = 2.9


def bakery(scene, col, lcol):
    B = props.box
    floor = look.pbr("Bak_Floor", "floor_tiles_06", scale=0.6, tint="#e9e2d6", rough_mul=0.7)
    wall = look.flat("Bak_Wall", "#eadbc2", rough=0.85)
    wood = look.pbr("Bak_Wood", "walnut_veneer", scale=1.2)
    frame = look.flat("Bak_Frame", "#2a2420", rough=0.4)
    glass = look.window_glass("Bak_Glass", reflect=0.3)
    B(col, "BAK_Floor", (7, 6.5, 0.02), floor, (0, -0.4, -0.02))
    back = B(col, "BAK_BackWall", (7, 0.12, C), wall, (0, 1.9, 0))
    front = B(col, "BAK_FrontWall", (7, 0.12, C), wall, (0, -2.7, 0))
    B(col, "BAK_LeftWall", (0.12, 6.5, C), wall, (-3.5, -0.4, 0))
    B(col, "BAK_RightWall", (0.12, 6.5, C), wall, (3.5, -0.4, 0))
    B(col, "BAK_Ceiling", (7, 6.5, 0.1), wall, (0, -0.4, C))
    # counter + glass display
    B(col, "BAK_Counter", (3.2, 0.7, ERGO["counter"] - 0.05), wood, (0.6, 1.1, 0))
    B(col, "BAK_CounterTop", (3.3, 0.75, 0.05), look.pbr("Bak_Marble", "marble_01", scale=0.8, rough_mul=0.5), (0.6, 1.1, ERGO["counter"] - 0.05))
    case = B(col, "BAK_Case", (1.6, 0.6, 0.42), glass, (1.25, 1.05, ERGO["counter"]))
    case.visible_shadow = False
    B(col, "BAK_CaseShelf", (1.55, 0.55, 0.015), look.flat("Bak_CaseShelf", "#f4efe6", rough=0.3), (1.25, 1.05, ERGO["counter"] + 0.02))
    for i in range(6):
        props.external(col, "croissant", loc=(0.62 + i * 0.25, 1.0 + (i % 2) * 0.12, ERGO["counter"] + 0.04), rot=(0, 0, i * 37), scale=1.1)
    reg = props.external(col, "CashRegister_01", loc=(-0.45, 1.1, ERGO["counter"]), rot=(0, 0, 180))
    reg.scale = [0.35 / max(0.1, reg["hnc_size"][2])] * 3
    # shelves of bread on the back wall
    sh = props.external(col, "wooden_display_shelves_01", loc=(0.0, 1.72, 0), rot=(0, 0, 180))
    sh.scale = [2.1 / max(0.1, sh["hnc_size"][2])] * 3
    for k in range(3):
        for i in range(5):
            props.external(col, "hamburger_buns", loc=(-0.7 + i * 0.35, 1.7, 0.75 + k * 0.5), rot=(0, 0, i * 50), scale=1.6)
    for i in range(3):
        props.external(col, "wicker_basket_01", loc=(-2.6 + i * 0.5, 1.6, ERGO["counter"] - 0.0), scale=0.9)
    B(col, "BAK_SideCounter", (1.6, 0.6, ERGO["counter"]), wood, (-2.3, 1.6, 0))
    # front: window (left) + door (right of it) with a bell
    cut(col, front, (-2.0, -2.7, 0.8), (2.2, 0.5, 1.7))
    g = props.plane(col, "BAK_Window", (2.2, 1.7), glass, (-2.0, -2.68, 1.65), rot=(90, 0, 0))
    g.visible_shadow = False
    for dx in (-1.1, 0, 1.1):
        B(col, "BAK_Mullion", (0.05, 0.1, 1.7), frame, (-2.0 + dx, -2.7, 0.8))
    for z in (0.8, 2.5):
        B(col, "BAK_Rail", (2.25, 0.1, 0.05), frame, (-2.0, -2.7, z - 0.025))
    door_x = -0.1
    cut(col, front, (door_x, -2.7, 0.0), (1.1, 0.5, 2.45))
    pivot = tag(bpy.data.objects.new("BAK_DoorPivot", None))
    col.objects.link(pivot)
    pivot.location = (door_x - 0.55, -2.7, 0)
    B(col, "BAK_DoorFrame", (1.1, 0.06, 0.08), frame, (0.55, 0, 2.37), parent=pivot)
    B(col, "BAK_DoorStile", (0.08, 0.06, 2.45), frame, (0.04, 0, 0), parent=pivot)
    B(col, "BAK_DoorStile2", (0.08, 0.06, 2.45), frame, (1.06, 0, 0), parent=pivot)
    B(col, "BAK_DoorKick", (1.1, 0.06, 0.25), frame, (0.55, 0, 0), parent=pivot)
    dg = props.plane(col, "BAK_DoorGlass", (0.95, 2.1), glass, (0.55, 0, 1.3), rot=(90, 0, 0), parent=pivot)
    dg.visible_shadow = False
    bell = props.lathe(col, "BAK_Bell", [(0.0, 0.08), (0.02, 0.075), (0.035, 0.02), (0.04, 0.0), (0.0, 0.0)], look.flat("Brass", "#b89556", rough=0.25, metal=1.0),
                       (door_x + 0.3, -2.6, 2.3))
    # the regular's window table
    tbl = props.external(col, "WoodenTable_02", loc=(-2.25, -1.55, 0), rot=(0, 0, 0))
    tbl.scale = (0.62 / tbl["hnc_size"][0], 0.62 / tbl["hnc_size"][1], ERGO["table"] / tbl["hnc_size"][2])
    chair = props.external(col, "dining_chair_02", loc=(-2.85, -1.55, 0), rot=(0, 0, -90))
    chair.scale = [0.36 / 0.46] * 3
    tea = props.tea_glass(col, "PROP_Tea", (-2.12, -1.6, ERGO["table"]))
    props.external(col, "croissant", loc=(-2.32, -1.42, ERGO["table"] + 0.01), rot=(0, 0, 30), scale=1.1)
    bag = props.paper_bag(col, "PROP_BreadBag", (0.35, 0.85, ERGO["counter"]))
    # pendants
    for x in (-1.0, 0.6, 2.0):
        props.cyl(col, "BAK_Cord", 0.004, 0.7, frame, (x, 0.6, C - 0.7), segs=6)
        props.sphere(col, "BAK_Globe", 0.16, look.flat("Bak_Globe", "#fff2dc", rough=0.3, emit="#ffd9a3", emit_strength=4.0), (x, 0.6, C - 0.85))
        look.point(lcol, "LGT_Pendant", (x, 0.6, C - 0.9), 90, "#ffc98f", radius=0.15)
    # daylight: street HDRI through the front, a soft window key
    look.world(scene, hdri="urban_street_04", hdri_strength=0.85, rot_deg=200)
    look.area(lcol, "LGT_StreetKey", (-2.0, -4.2, 1.9), (-1.0, 0.2, 1.1), (2.4, 1.8), 520, "#f2f4f8")
    look.area(lcol, "LGT_Bounce", (1.8, -1.0, 0.3), (0, 0.5, 1.4), (2.0, 1.0), 45, "#ffe3c4")
    scene.view_settings.exposure = 0.1
    return dict(counter=Vector((0.35, 0.55, 0)), bag=bag, tea=tea, elder_seat=Vector((-2.85, -1.55, 0)), table=Vector((-2.25, -1.55, ERGO["table"])),
                door=Vector((door_x, -2.7, 0)), door_pivot=pivot, bell=bell, chair=chair)
