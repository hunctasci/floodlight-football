"""The family home — one reusable HNC home with camera-driven zones.

Zones are built independently (a shot builds only the zone it films) but
share one art direction so cuts feel like one place: oak floor, warm white
plaster, black-framed windows onto a green street, oak joinery, marble
kitchen, sage and terracotta textiles, a football tucked somewhere.

Every zone: origin on the floor, the room's back wall at +Y, the camera side
open at -Y. Returns anchors (dict of named Vectors / objects).

Time of day (``time``): dawn | morning | afternoon | evening | night.
"""
import math

import bpy
from mathutils import Vector

from .. import look, props
from ..look import tag
from . import ERGO

C = ERGO["ceiling"]

# Window exterior backdrops per time (HDRI rotation / strength, key colour/power)
TIME = {
    "dawn": dict(hdri=0.15, sky="#2b3b5c", key="#8fb0ff", key_w=380, practical=True, exposure=0.45),
    "morning": dict(hdri=0.9, sky=None, key="#ffe2bd", key_w=900, practical=False, exposure=0.0),
    "afternoon": dict(hdri=0.55, sky=None, key="#e9ecf2", key_w=420, practical=False, exposure=0.05),
    "evening": dict(hdri=0.05, sky="#141c2e", key="#ffb070", key_w=0, practical=True, exposure=0.5),
    "night": dict(hdri=0.03, sky="#070b14", key="#6d88c7", key_w=40, practical=True, exposure=0.3),
}


def mats():
    return dict(
        floor=look.pbr("Home_Floor", "wood_floor", scale=0.45, tint="#e8d6c0", rough_mul=0.85),
        wall=look.pbr("Home_Wall", "white_plaster_02", scale=0.35, tint="#efe7dc", rough_add=0.1, bump=0.4),
        oak=look.pbr("Home_Oak", "oak_veneer_01", scale=1.2, tint="#f2e2cc"),
        walnut=look.pbr("Home_Walnut", "walnut_veneer", scale=1.2),
        marble=look.pbr("Home_Marble", "marble_01", scale=0.8, rough_mul=0.4),
        tile=look.pbr("Home_Tile", "long_white_tiles", scale=1.6, rough_mul=0.5),
        frame=look.flat("Home_WindowFrame", "#1b1d20", rough=0.4),
        base=look.flat("Home_Baseboard", "#ece6dc", rough=0.5),
        linen=look.pbr("Home_Linen", "rough_linen", scale=1.4, tint="#ebe6dc", rough_mul=1.0),
        sage=look.fabric("Home_Sage", "#7d9483", rough=0.9, sheen=0.5),
        terracotta=look.fabric("Home_Terracotta", "#b8674a", rough=0.9, sheen=0.5),
        cabinet=look.flat("Home_Cabinet", "#dcd5c8", rough=0.35, coat=0.2),
        black=look.flat("Home_Black", "#161719", rough=0.3, coat=0.4),
        glass=look.window_glass("Home_WindowGlass", reflect=0.25, tint="#eef3f5"),
    )


def room(col, m, w=6.0, d=5.0, back=2.0, left=True, right=False, ceiling=True):
    """Floor, back wall (+Y), optional side walls and ceiling, with baseboards.
    Walls are returned so windows/doors can cut real openings in them."""
    B = props.box
    walls = {}
    B(col, "HOME_Floor", (w, d, 0.02), m["floor"], (0, back - d / 2, -0.02))
    walls["back"] = B(col, "HOME_BackWall", (w, 0.12, C), m["wall"], (0, back + 0.06, 0))
    B(col, "HOME_Baseboard", (w, 0.02, 0.1), m["base"], (0, back - 0.01, 0))
    if left:
        walls["left"] = B(col, "HOME_LeftWall", (0.12, d, C), m["wall"], (-w / 2 - 0.06, back - d / 2, 0))
    if right:
        walls["right"] = B(col, "HOME_RightWall", (0.12, d, C), m["wall"], (w / 2 + 0.06, back - d / 2, 0))
    if ceiling:
        B(col, "HOME_Ceiling", (w, d, 0.1), m["wall"], (0, back - d / 2, C))
    return walls


def cut(col, wall, center, size):
    """Boolean opening in a wall (cutter hidden from render)."""
    c = props.box(col, f"{wall.name}.Cut", size, None, center)
    c.hide_render = True
    c.display_type = "WIRE"
    b = wall.modifiers.new("Opening", "BOOLEAN")
    b.operation = "DIFFERENCE"
    b.object = c
    b.solver = "EXACT"
    return c


def window(col, m, center, width=1.6, height=1.7, sill=0.85, wall_axis="Y", depth=0.12, curtains=None, wall=None):
    """A black-framed window cut into a wall plane (the wall behind is covered by
    two side panels + header/sill panels). ``center`` = (x or y along wall, wall pos)."""
    B = props.box
    frame = m["frame"]
    along, at = center
    if wall is not None:
        if wall_axis == "Y":
            cut(col, wall, (along, at, sill), (width, 0.5, height))
        else:
            cut(col, wall, (at, along, sill), (0.5, width, height))
    if wall_axis == "Y":  # window in the back wall (normal -Y)
        g = props.plane(col, "HOME_WindowGlass", (width, height), m["glass"], (along, at, sill + height / 2), rot=(90, 0, 0))
        for dx in (-width / 2, width / 2, 0):
            B(col, "HOME_WindowMullion", (0.05, depth, height), frame, (along + dx, at, sill))
        for z in (sill, sill + height):
            B(col, "HOME_WindowRail", (width + 0.05, depth, 0.05), frame, (along, at, z - 0.025))
        B(col, "HOME_WindowSill", (width + 0.2, 0.2, 0.04), m["base"], (along, at - 0.08, sill - 0.04))
    else:  # side wall at x=at (normal +X/-X)
        g = props.plane(col, "HOME_WindowGlass", (width, height), m["glass"], (at, along, sill + height / 2), rot=(90, 0, 90))
        for dy in (-width / 2, width / 2, 0):
            B(col, "HOME_WindowMullion", (depth, 0.05, height), frame, (at, along + dy, sill))
        for z in (sill, sill + height):
            B(col, "HOME_WindowRail", (depth, width + 0.05, 0.05), frame, (at, along, z - 0.025))
    g.visible_shadow = False
    if curtains:
        cm = curtains
        for s in (-1, 1):
            if wall_axis == "Y":
                props.curtain(col, "HOME_Curtain", width * 0.32, C - 0.1, cm, (along + s * (width / 2 + 0.12), at - 0.14, C - 0.08), folds=5)
            else:
                props.curtain(col, "HOME_Curtain", width * 0.32, C - 0.1, cm, (at + 0.14, along + s * (width / 2 + 0.12), C - 0.08), rot=(0, 0, 90), folds=5)
    return g


def light_time(scene, col, time, key_from, key_to, key_size=(1.6, 1.8), hdri_rot=0.0):
    """Window light for a time of day: HDRI through the glass + an area 'sun/sky' key."""
    t = TIME[time]
    if t["sky"]:
        look.world(scene, hdri="sunny_vondelpark", hdri_strength=t["hdri"], rot_deg=hdri_rot, bg_color=t["sky"], bg_strength=1.0)
    else:
        look.world(scene, hdri="sunny_vondelpark", hdri_strength=t["hdri"], rot_deg=hdri_rot)
    if t["key_w"]:
        look.area(col, "LGT_Window", key_from, key_to, key_size, t["key_w"], t["key"])
    scene.view_settings.exposure = t["exposure"]
    return t


# ================================================================ BEDROOM


def bedroom(scene, col, lcol, time="dawn", child_bed=False):
    """Double bed against the back wall, nightstand (clock + lamp) on the
    sleeper's right, window with curtains on the left wall."""
    m = mats()
    walls = room(col, m, w=6.0, d=6.0, back=2.2, left=True, right=True)
    bed_w, bed_l, top = 2.1, 2.9, ERGO["bed"]
    bx, by = 0.3, 2.2 - bed_l / 2
    props.box(col, "BED_Frame", (bed_w + 0.1, bed_l + 0.05, 0.28), m["walnut"], (bx, by, 0.0), bevel=0.02)
    props.box(col, "BED_Headboard", (bed_w + 0.1, 0.1, 1.15), m["walnut"], (bx, 2.12, 0.0), bevel=0.02)
    props.soft(col, "BED_Mattress", (bed_w, bed_l, top - 0.28), m["linen"], (bx, by, 0.28), puff=0.004, levels=1, bevel=0.15)
    for dx in (-0.5, 0.5):
        props.soft(col, "BED_Pillow", (0.85, 0.5, 0.18), m["linen"], (bx + dx, 1.8, top - 0.02), puff=0.02, bevel=0.45)
    duvet = props.soft(col, "BED_Duvet", (bed_w + 0.08, bed_l * 0.72, 0.16), look.fabric("Duvet", "#dfe3e6", rough=0.95, sheen=0.6, noise=0.02),
                       (bx, by - bed_l * 0.14, top - 0.06), puff=0.05, levels=2, bevel=0.35)
    props.box(col, "BED_Throw", (bed_w + 0.12, 0.55, 0.05), m["sage"], (bx, by - bed_l * 0.42, top + 0.04), bevel=0.02)
    # nightstand + clock + lamp on the sleeper's right (-X side of the bed)
    ns_x = bx - bed_w / 2 - 0.4
    ns = props.external(col, "ClassicNightstand_01", loc=(ns_x, 1.85, 0), rot=(0, 0, 0))
    ns.scale = [0.62 / max(0.3, ns["hnc_size"][2])] * 3
    ns_top = 0.62
    clock = props.digital_clock(col, text="06:47", loc=(ns_x + 0.05, 1.78, ns_top), rot=(0, 0, 20))
    lamp = props.lathe(col, "BED_LampShade", [(0.13, 0.0), (0.09, 0.2), (0.088, 0.2), (0.128, 0.0)],
                       look.flat("BedLampShade", "#efe3cc", rough=0.8, emit="#ffcf9a", emit_strength=0.0), (ns_x - 0.12, 1.95, ns_top + 0.3))
    props.cyl(col, "BED_LampBase", 0.05, 0.3, look.flat("LampCeramic", "#b8674a", rough=0.3), (ns_x - 0.12, 1.95, ns_top), segs=20)
    # window + curtains on the left wall; a door (hall light) on the right
    win = window(col, m, (0.4, -3.0), width=1.6, height=1.8, sill=0.8, wall_axis="X",
                 curtains=look.fabric("Curtain", "#c9c2b6", rough=0.9, sheen=0.5), wall=walls["left"])
    props.rug(col, "BED_Rug", (1.6, 2.2), "#8a6f5a", (ns_x - 0.2, 0.2, 0.0))
    t = light_time(scene, lcol, time, (-4.2, 0.6, 1.9), (0.2, 1.4, 0.6), (1.4, 1.8), hdri_rot=90)
    if t["practical"]:
        # warm hall spill through the door on the right + lamp off (dawn)
        look.area(lcol, "LGT_HallSpill", (3.2, -0.4, 1.4), (0.6, 1.5, 0.8), (0.4, 1.8), 60, "#ffc88a")
    look.area(lcol, "LGT_ClockGlow", (ns_x + 0.05, 1.62, ns_top + 0.06), (ns_x - 0.3, 1.4, 0.9), (0.15, 0.05), 1.5, "#ff5a3a")
    return dict(bed=Vector((bx, by, top)), pillow=Vector((bx + 0.5, 1.8, top + 0.12)), clock=clock, clock_pos=clock.matrix_world.translation.copy() + Vector((0, -0.04, 0.05)),
                nightstand=Vector((ns_x, 1.85, ns_top)), duvet=duvet, bed_w=bed_w, bed_l=bed_l, bx=bx, by=by)


def child_room(scene, col, lcol):
    """Night: small bed, star night-light, a football on the floor."""
    m = mats()
    room(col, m, w=4.5, d=4.5, back=1.6, left=True)
    top = 0.36
    props.box(col, "CBED_Frame", (1.2, 1.8, 0.2), m["oak"], (0, 0.65, 0), bevel=0.02)
    props.soft(col, "CBED_Mattress", (1.1, 1.75, top - 0.2), m["linen"], (0, 0.65, 0.2), puff=0.003, levels=1)
    props.soft(col, "CBED_Pillow", (0.6, 0.36, 0.14), m["linen"], (0, 1.3, top - 0.02), puff=0.015)
    duvet = props.soft(col, "CBED_Duvet", (1.16, 1.25, 0.12), look.fabric("KidDuvet", "#3b5a8a", rough=0.95, sheen=0.5), (0, 0.4, top - 0.05), puff=0.04)
    star = props.sphere(col, "CBED_NightLight", 0.07, look.emission("NightLight", "#ffc27a", 7.0), (-0.85, 1.4, 0.55), segs=5, rings=3, smooth=False)
    props.box(col, "CBED_Shelf", (0.5, 0.3, 0.55), m["oak"], (-0.85, 1.4, 0.0))
    look.point(lcol, "LGT_NightLight", (-0.8, 1.2, 0.62), 12, "#ffb970", radius=0.05)
    look.world(scene, color="#05070d", strength=1.0)
    look.area(lcol, "LGT_Moon", (1.8, -0.8, 2.4), (0, 0.8, 0.4), (1.0, 1.4), 60, "#7890c8")
    scene.view_settings.exposure = 0.5
    return dict(bed=Vector((0, 0.65, top)), pillow=Vector((0, 1.3, top + 0.1)), duvet=duvet)


# ================================================================ KITCHEN


def kitchen(scene, col, lcol, time="morning"):
    """Island with the cooktop facing the camera; back counter + window; dining
    table to the right. #9 cooks behind the island facing -Y."""
    m = mats()
    walls = room(col, m, w=8.0, d=6.5, back=2.4, left=True, right=False)
    B = props.box
    # back counter run + uppers + window
    B(col, "KIT_BackBase", (4.2, 0.62, ERGO["counter"] - 0.04), m["cabinet"], (-1.2, 2.08, 0))
    B(col, "KIT_BackTop", (4.25, 0.66, 0.04), m["marble"], (-1.2, 2.07, ERGO["counter"] - 0.04))
    B(col, "KIT_Backsplash", (4.2, 0.02, 0.2), m["tile"], (-1.2, 2.38, ERGO["counter"]))
    B(col, "KIT_Upper", (1.3, 0.36, 0.8), m["cabinet"], (-2.6, 2.2, 1.75))
    window(col, m, (-0.9, 2.42), width=2.0, height=1.25, sill=ERGO["counter"] + 0.2, wall=walls["back"])
    for i in range(6):  # cabinet door seams
        B(col, "KIT_Seam", (0.008, 0.005, 0.72), m["black"], (-3.2 + i * 0.7, 1.765, 0.1))
    # island (cooktop faces the camera)
    ix, iy = -0.6, 0.1  # HNC bodies are ~0.96 m deep: the cook stands at y≈1.08 without touching either counter
    B(col, "KIT_IslandBase", (2.3, 0.95, ERGO["counter"] - 0.04), m["oak"], (ix, iy, 0))
    B(col, "KIT_IslandTop", (2.4, 1.05, 0.04), m["marble"], (ix, iy, ERGO["counter"] - 0.04))
    top = ERGO["counter"]
    B(col, "KIT_Cooktop", (0.7, 0.5, 0.008), look.flat("Cooktop", "#0c0c0e", rough=0.08, coat=1.0), (ix - 0.4, iy + 0.05, top))
    pan = props.pan(col, loc=(ix - 0.45, iy + 0.12, top + 0.008), rot=(0, 0, 200))
    # coffee corner on the island (right of the cooktop)
    car = props.carafe(col, loc=(ix - 0.72, iy + 0.36, top))
    mug = props.mug(col, "PROP_Mug9", color="#2f5d62", loc=(ix - 0.22, iy + 0.32, top))
    board = props.external(col, "wooden_cutting_board", loc=(ix + 0.75, iy - 0.05, top), rot=(0, 0, 10))
    props.external(col, "wooden_bowl_01", loc=(-2.4, 2.05, top), rot=(0, 0, 0))
    for i in range(3):
        props.external(col, "lemon", loc=(-2.45 + i * 0.07, 2.05, top + 0.03), rot=(0, 0, i * 40))
    props.external(col, "potted_plant_04", loc=(0.6, 2.1, top))
    # dining table + chairs to the right
    tx, ty = 2.6, 0.2
    tbl = props.external(col, "WoodenTable_02", loc=(tx, ty, 0), rot=(0, 0, 90))
    ts = tbl["hnc_size"]
    tbl.scale = (ERGO["table"] / ts[2],) * 3
    chairs = []
    for i, (dx, dy, rz) in enumerate(((-0.95, 0.0, -90), (0.95, 0.0, 90), (0.0, 0.75, 180))):
        ch = props.external(col, "dining_chair_02", loc=(tx + dx, ty + dy, 0), rot=(0, 0, rz))
        ch.scale = [0.36 / 0.46] * 3
        chairs.append(ch)
    # pendants
    for x in (ix - 0.5, ix + 0.5, tx):
        props.cyl(col, "KIT_PendantCord", 0.004, 0.9, m["black"], (x, iy if x != tx else ty, C - 0.9), segs=6)
        props.lathe(col, "KIT_Pendant", [(0.0, 0.0), (0.16, 0.0), (0.12, 0.16), (0.03, 0.2), (0.0, 0.2)],
                    look.flat("PendantShell", "#2b2b2d", rough=0.35, metal=0.5), (x, iy if x != tx else ty, C - 1.1))
    t = light_time(scene, lcol, time, (-0.9, 4.6, 2.3), (-0.6, 0.3, 0.9), (2.4, 1.6), hdri_rot=180)
    if t["practical"]:
        for x in (ix - 0.5, ix + 0.5, tx):
            L = look.spot(lcol, "LGT_Pendant", (x, iy if x != tx else ty, C - 1.12), (x, iy if x != tx else ty, 0), 900, "#ffc27f", angle=100, blend=0.8, radius=0.1)
        look.area(lcol, "LGT_WarmFill", (tx - 2.6, ty - 3.0, 1.9), (tx - 0.6, ty, 1.2), (2.0, 1.6), 140, "#ffb877")
        look.area(lcol, "LGT_WarmBounce", (tx + 1.5, ty - 1.5, 0.6), (tx - 0.4, ty, 1.3), (1.2, 1.0), 40, "#ff9f6a")
        props.sphere(col, "KIT_PendantBulb", 0.04, look.emission("Bulb", "#ffd9a8", 30), (tx, ty, C - 1.12))
    else:
        look.area(lcol, "LGT_KitchenFill", (1.5, -3.5, 2.2), (-0.5, 0.5, 1.2), (3, 2), 90, "#e8eef8")
    return dict(island=Vector((ix, iy, top)), stove=Vector((ix - 0.45, iy + 0.05, top)), pan=pan, carafe=car, mug=mug,
                cook=Vector((ix - 0.42, iy + 0.98, 0.0)), table=Vector((tx, ty, ERGO["table"])), chairs=chairs, board=board)


# ================================================================ LIVING ROOM


def living(scene, col, lcol, time="afternoon"):
    """Sofa facing the camera, coffee table, floor lamp (the one that wobbles)."""
    m = mats()
    walls = room(col, m, w=7.0, d=6.0, back=2.2, left=True, right=True)
    sofa = props.external(col, "sofa_02", loc=(0.0, 1.45, 0), rot=(0, 0, 0))
    ss = sofa["hnc_size"]
    # scale the model so its seat lands at HNC sofa height (model seat ≈ 0.45 of its height)
    # HNC adults are ~2 m: a real-proportion sofa, scaled so its seat lands at HNC sofa height and it seats two of them
    k = ERGO["sofa"] / (ss[2] * 0.52)
    sofa.scale = (k * 1.35, k * 1.2, k)
    ct = props.external(col, "modern_coffee_table_01", loc=(0.0, 0.3, 0), rot=(0, 0, 0))
    cts = ct["hnc_size"]
    ct.scale = [0.38 / cts[2]] * 3
    props.rug(col, "LIV_Rug", (3.0, 2.2), "#b8674a", (0, 0.6, 0.0))
    lamp = props.floor_lamp(col, "LIV_FloorLamp", (1.75, 1.6, 0.0), on=time in ("evening", "night"))
    props.external(col, "potted_plant_01", loc=(-1.9, 1.7, 0))
    props.external(col, "standing_picture_frame_01", loc=(-0.9, 0.3, 0.38), rot=(0, 0, 20))
    window(col, m, (-3.5, 0.6), width=1.8, height=1.9, sill=0.6, wall_axis="X", curtains=look.fabric("LivCurtain", "#d8d0c2", rough=0.9, sheen=0.5), wall=walls["left"])
    for i, x in enumerate((-1.2, 0.3, 1.1)):
        f = props.box(col, "LIV_Frame", (0.5 if i != 1 else 0.8, 0.03, 0.6), m["black"], (x, 2.19, 1.35))
        props.plane(col, "LIV_FramePrint", (0.42 if i != 1 else 0.72, 0.52), look.flat(f"Print{i}", ("#c9b79a", "#7d9483", "#d7c3b0")[i], rough=0.8), (x, 2.172, 1.65), rot=(90, 0, 0))
    t = light_time(scene, lcol, time, (-4.8, 0.4, 1.8), (0.0, 1.0, 0.8), (1.6, 2.0), hdri_rot=90)
    look.area(lcol, "LGT_LivFill", (2.0, -3.2, 2.0), (0, 1.0, 0.8), (3, 2), 60, "#e0e6ef")
    return dict(sofa=Vector((0.0, 1.45, ERGO["sofa"])), seat_l=Vector((-0.45, 1.3, 0)), seat_r=Vector((0.45, 1.3, 0)), table=Vector((0.0, 0.3, 0.38)),
                lamp=lamp, sofa_obj=sofa)


# ================================================================ ENTRY


def entry(scene, col, lcol, time="morning", door_open=0.0):
    """Front door in the back wall (opens inward to the left), bench, hooks, shoes."""
    m = mats()
    walls = room(col, m, w=5.0, d=5.0, back=2.0, left=True, right=True)
    B = props.box
    dw, dh = 1.05, ERGO["door"]
    cut(col, walls["back"], (0, 2.06, 0.0), (dw, 0.5, dh))
    for dx in (-dw / 2 - 0.05, dw / 2 + 0.05):
        B(col, "ENT_DoorFrame", (0.1, 0.16, dh + 0.05), m["base"], (dx, 1.98, 0))
    B(col, "ENT_DoorHeader", (dw + 0.2, 0.16, 0.1), m["base"], (0, 1.98, dh))
    # the wall panel above/around the doorway replaces the solid back wall section
    pivot = tag(bpy.data.objects.new("ENT_DoorPivot", None))
    col.objects.link(pivot)
    pivot.location = (-dw / 2, 1.96, 0)
    leaf = B(col, "ENT_DoorLeaf", (dw, 0.06, dh - 0.02), look.flat("DoorPaint", "#2f3a44", rough=0.35, coat=0.3), (dw / 2, 0, 0.01), parent=pivot)
    props.cyl(col, "ENT_Handle", 0.012, 0.14, look.flat("Brass", "#b89556", rough=0.25, metal=1.0), (dw - 0.1, -0.05, 1.0), rot=(0, 90, 0), parent=pivot)
    pivot.rotation_euler = (0, 0, math.radians(-100 * door_open))
    # outside: a bright street (plane with the HDRI-lit exterior feel)
    outside = props.plane(col, "ENT_Outside", (4, 3), look.emission("Outside", "#dfe8f0" if time != "night" else "#101828", 2.5 if time != "night" else 0.3),
                          (0, 3.6, 1.4), rot=(90, 0, 0))
    bench = B(col, "ENT_Bench", (1.2, 0.4, 0.4), m["oak"], (1.55, 1.7, 0), bevel=0.01)
    for i in range(3):
        props.cyl(col, "ENT_Hook", 0.012, 0.06, m["black"], (1.2 + i * 0.35, 1.93, 1.9), rot=(90, 0, 0), segs=8)
    coat = props.soft(col, "ENT_Coat", (0.36, 0.14, 0.8), look.fabric("Coat", "#3d4a3a", rough=0.9, sheen=0.4), (1.55, 1.86, 1.1), puff=0.03)
    props.rug(col, "ENT_Mat", (1.2, 0.7), "#7a6552", (0, 1.4, 0.0))
    t = light_time(scene, lcol, time if time != "night" else "night", (0.0, 4.5, 1.6), (0, 0.8, 1.0), (1.2, 2.2), hdri_rot=0)
    if time == "night":
        look.point(lcol, "LGT_HallLamp", (-0.8, 0.6, 2.6), 260, "#ffc58a", radius=0.1)
        look.area(lcol, "LGT_HallFill", (1.5, -1.8, 1.4), (0.5, 1.4, 0.3), (1.0, 1.0), 25, "#ffd2a0")
    return dict(door=Vector((0, 1.96, 0)), door_pivot=pivot, bench=Vector((1.55, 1.7, 0.4)), floor_by_door=Vector((0.9, 1.4, 0.0)))
