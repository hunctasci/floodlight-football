"""Interview setup: a dark room, one warm practical, controlled shadows.

The subject sits in an armchair at the origin facing -Y, eyeline just off
the lens to camera-left (the interviewer sits beside the camera). Key from
camera-left (soft, warm-neutral), cool fill low from camera-right, a narrow
edge light from behind-right, the practical lamp soft in the background.
"""
from mathutils import Vector

from .. import look, props
from . import ERGO


def interview(scene, col, lcol):
    B = props.box
    wall = look.pbr("Int_Wall", "concrete_wall_008", scale=0.3, tint="#3b3632", rough_mul=1.0, bump=0.8)
    floor = look.pbr("Int_Floor", "wood_floor", scale=0.45, tint="#5a4636", rough_mul=0.8)
    B(col, "INT_Floor", (10, 10, 0.02), floor, (0, 1.5, -0.02))
    B(col, "INT_BackWall", (10, 0.2, 4), wall, (0, 3.4, 0))
    B(col, "INT_SideWall", (0.2, 8, 4), wall, (3.6, 0.8, 0))
    chair = props.external(col, "modern_arm_chair_01", loc=(0, 0.25, 0), rot=(0, 0, 180))
    cs = chair["hnc_size"]
    chair.scale = [ERGO["seat"] / (cs[2] * 0.5)] * 3
    lamp = props.floor_lamp(col, "INT_Practical", (1.7, 2.6, 0), on=True, power=35, color="#ffb870", height=1.7)
    props.external(col, "potted_plant_01", loc=(-1.9, 2.8, 0))
    side = B(col, "INT_SideTable", (0.45, 0.45, 0.5), look.pbr("Int_Walnut", "walnut_veneer", scale=1.2), (1.0, 0.6, 0), bevel=0.01)
    props.tea_glass(col, "INT_Tea", (1.0, 0.55, 0.5))
    look.world(scene, color="#050505", strength=1.0)
    look.area(lcol, "LGT_Key", (-1.7, -1.9, 2.2), (0, 0.2, 1.45), (1.2, 1.2), 110, "#ffe6cc")
    look.area(lcol, "LGT_Fill", (1.6, -2.2, 0.9), (0, 0.2, 1.3), (1.5, 1.0), 9, "#9fb4d8")
    look.area(lcol, "LGT_Edge", (1.6, 1.6, 2.1), (0, 0.2, 1.5), (0.3, 1.2), 90, "#ffd3a0")
    look.spot(lcol, "LGT_WallSlash", (-2.2, 0.5, 3.2), (-0.8, 3.3, 1.6), 260, "#ffc27f", angle=22, blend=0.7)
    scene.view_settings.exposure = 0.0
    return dict(seat=Vector((0, 0.25, 0)), eyeline=Vector((-0.55, -2.5, 1.45)), lamp=lamp)
