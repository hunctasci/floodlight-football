"""Exteriors for the matchday cut: the family car's driver door at home, and
the team bus arriving at the stadium. The two doors are staged for the MATCH
CUT: the car door's closing edge and the bus door's opening edge both travel
screen-left through the same frame line, with the same dark glass panel.
"""
import math

import bpy
from mathutils import Vector

from .. import look, props
from ..look import tag
from ..perform import write_tracks


def _paint(color):
    return look.flat(f"Paint_{color}", color, rough=0.2, metal=0.55, coat=1.0)


def car_door_exterior(scene, col, lcol, frames, fps, close_at=0.45, close_dur=0.32):
    """Side of the car (facing -Y toward the camera), driver door hinged at its
    front edge (+X, the car points to frame right) swinging shut.
    Returns anchors: door edge line etc."""
    B = props.box
    paint = _paint("#1e2a36")
    glass = look.window_glass("CarGlassTint", reflect=0.55, tint="#6f7a84")  # tinted but see-through: he's inside
    rubber = look.flat("Rubber", "#0c0c0d", rough=0.8)
    chrome = look.flat("Car_Chrome", "#c8c8cc", rough=0.18, metal=1.0)
    # body side panels around the door opening
    B(col, "CAR_BodyRear", (1.7, 1.8, 1.05), paint, (-1.35, 0.9, 0.35), bevel=0.04)
    B(col, "CAR_BodyFront", (1.7, 1.8, 1.0), paint, (2.15, 0.9, 0.35), bevel=0.04)
    B(col, "CAR_Roof", (4.9, 1.7, 0.08), paint, (0.4, 0.9, 1.9), bevel=0.03)
    B(col, "CAR_Sill", (1.1, 1.8, 0.2), paint, (0.4, 0.9, 0.3))
    B(col, "CAR_FarDoor", (2.2, 0.08, 1.5), look.flat("CarInt", "#1d1e22", rough=0.7), (0.4, 1.75, 0.35))
    B(col, "CAR_Seat", (0.62, 0.62, 0.22), look.pbr("Car_Seat", "fabric_leather_02", scale=3.0, tint="#3a3a3e"), (0.35, 0.75, 0.3), bevel=0.05)
    B(col, "CAR_SeatBack", (0.62, 0.16, 0.95), look.pbr("Car_Seat", "fabric_leather_02", scale=3.0, tint="#3a3a3e"), (0.35, 1.2, 0.5), rot=(-14, 0, 0), bevel=0.05)
    for x in (-1.6, 2.35):
        wheel = props.cyl(col, "CAR_Tyre", 0.36, 0.25, rubber, (x, 0.0, 0.36), rot=(90, 0, 0), segs=32)
        props.cyl(col, "CAR_Rim", 0.24, 0.02, chrome, (x, -0.13, 0.36), rot=(90, 0, 0), segs=24)
    # the door: hinge at its front (+X) edge
    hinge = tag(bpy.data.objects.new("CAR_DoorHinge", None))
    col.objects.link(hinge)
    hinge.location = (0.95, 0.02, 0.0)
    B(col, "CAR_DoorPanel", (1.1, 0.07, 0.95), paint, (-0.55, 0.0, 0.42), parent=hinge, bevel=0.02)
    g = B(col, "CAR_DoorGlass", (1.0, 0.02, 0.5), glass, (-0.57, 0.0, 1.37), parent=hinge)
    B(col, "CAR_DoorFrameTop", (1.05, 0.05, 0.04), rubber, (-0.56, 0.0, 1.87), parent=hinge)
    B(col, "CAR_DoorFrameRear", (0.04, 0.05, 0.52), rubber, (-1.08, 0.0, 1.36), parent=hinge)
    B(col, "CAR_DoorHandle", (0.16, 0.035, 0.03), chrome, (-0.85, -0.05, 1.1), parent=hinge)
    tr = {}
    for f in range(1, frames + 1):
        t = (f - 1) / fps
        u = max(0.0, min(1.0, (t - close_at + close_dur) / close_dur))
        ang = 58.0 * (1 - u ** 2.2)  # accelerates shut (a firm close, no bounce)
        if t > close_at:
            ang = -0.8 * math.exp(-(t - close_at) * 30) * math.sin((t - close_at) * 60)  # settle shudder
        # + opens outward toward the camera (-Y); closing sweeps the rear edge screen-left
        tr.setdefault((hinge, "rotation_euler", 2), []).append(math.radians(ang))
    write_tracks(tr, frames)
    # background: house front + hedge, soft
    props.box(col, "HOUSE_Wall", (14, 0.3, 5), look.pbr("House_Plaster", "painted_plaster_wall", scale=0.3, tint="#e8e0d2"), (0, 7.5, 0))
    props.box(col, "HOUSE_Hedge", (14, 1.0, 1.4), look.flat("Hedge", "#3f5a33", rough=0.9), (0, 5.5, 0))
    props.plane(col, "HOUSE_Drive", (30, 30), look.pbr("Drive", "asphalt_02", scale=0.25, tint="#8a8a88"), (0, 3, 0))
    look.world(scene, hdri="urban_street_04", hdri_strength=1.0, rot_deg=300)
    # clean cool morning: sun raking from camera-left-front, a big soft sky from behind the camera
    look.sun(lcol, "LGT_Sun", (58, 0, -30), power=3.4, color="#f4f6ff", angle=1.5)
    look.area(lcol, "LGT_Sky", (-0.5, -5.5, 3.0), (0.2, 0.3, 1.0), (6.0, 3.0), 900, "#dfe8f6")
    look.area(lcol, "LGT_CabinFill", (0.35, 1.5, 1.7), (0.35, 0.6, 1.3), (0.8, 0.6), 60, "#e9eef6")
    scene.view_settings.exposure = 0.1
    return dict(hinge=hinge, driver=Vector((0.35, 0.75, 0.0)), door_edge=Vector((0.95 - 1.1, 0.0, 1.2)))


def bus_arrival(scene, col, lcol, frames, fps, open_at=0.0, open_dur=0.45, door_x=-0.72):
    """Team bus side (dark, unbranded) with a sliding plug door that opens toward
    frame LEFT (continuing the car door's motion), steps, the stadium behind."""
    B = props.box
    paint = _paint("#11161d")
    glass = look.flat("BusGlass", "#070a0e", rough=0.04, metal=0.3, coat=1.0)
    red = look.flat("BusStripe", "#c8101b", rough=0.3, coat=0.6)
    # door_x: the door's right edge starts on the match-cut line (where the car door closed)
    X = door_x
    B(col, "BUS_BodyLeft", (6.0, 2.5, 3.1), paint, (X - 3.6, 1.3, 0.35), bevel=0.05)
    B(col, "BUS_BodyRight", (3.0, 2.5, 3.1), paint, (X + 2.1, 1.3, 0.35), bevel=0.05)
    B(col, "BUS_Top", (1.2, 2.5, 0.75), paint, (X, 1.3, 2.7))
    # stripe + window band stop at the door opening (X ± 0.6)
    B(col, "BUS_StripeL", (5.4, 0.02, 0.12), red, (X - 3.3, 0.04, 1.2))
    B(col, "BUS_StripeR", (2.4, 0.02, 0.12), red, (X + 1.8, 0.04, 1.2))
    B(col, "BUS_WindowsL", (5.4, 0.02, 1.1), glass, (X - 3.3, 0.03, 1.8))
    B(col, "BUS_WindowsR", (2.4, 0.02, 1.1), glass, (X + 1.8, 0.03, 1.8))
    B(col, "BUS_Stairwell", (1.2, 0.1, 2.3), look.flat("BusInt", "#1a1c21", rough=0.6), (X, 1.5, 0.35))
    B(col, "BUS_StepUpper", (1.2, 0.8, 0.35), look.flat("Step", "#2b2d33", rough=0.5, metal=0.4), (X, 0.9, 0.0))
    B(col, "BUS_Step", (1.2, 0.4, 0.18), look.flat("Step", "#2b2d33", rough=0.5, metal=0.4), (X, -0.15, 0.0))
    look.area(lcol, "LGT_BusInterior", (X, 1.2, 2.5), (X, 0.8, 1.2), (1.0, 0.8), 180, "#fff1dd")
    door = tag(bpy.data.objects.new("BUS_DoorSlide", None))
    col.objects.link(door)
    door.location = (X, 0.02, 0.35)
    B(col, "BUS_DoorPanel", (1.15, 0.07, 2.3), paint, (0, 0, 0), parent=door, bevel=0.02)
    B(col, "BUS_DoorGlass", (0.95, 0.02, 1.2), glass, (0, -0.03, 0.9), parent=door)
    tr = {}
    for f in range(1, frames + 1):
        t = (f - 1) / fps
        u = max(0.0, min(1.0, (t - open_at) / open_dur))
        e = 1 - (1 - u) ** 2.5
        # plug door: out a touch, then slides left
        tr.setdefault((door, "location", 0), []).append(X - 1.2 * max(0, (e - 0.15) / 0.85))
        tr.setdefault((door, "location", 1), []).append(0.02 - 0.12 * min(1, e / 0.15))
    write_tracks(tr, frames)
    # arrival forecourt, barrier, the stadium behind (HDRI)
    props.plane(col, "ARR_Ground", (60, 60), look.pbr("Forecourt", "asphalt_02", scale=0.2, tint="#9a9a98"), (0, -10, 0))
    for i in range(10):
        props.external(col, "concrete_road_barrier", loc=(-9 + i * 2.1, -4.5, 0), rot=(0, 0, 0), scale=1.0)
    look.world(scene, hdri="stadium_exterior", hdri_strength=1.1, rot_deg=180)
    look.sun(lcol, "LGT_Sun", (52, 0, -35), power=4.0, color="#f6f3ea", angle=1.2)
    look.area(lcol, "LGT_Sky", (-0.5, -6.0, 3.2), (0.0, 0.3, 1.2), (7.0, 3.0), 700, "#e6ecf5")
    scene.view_settings.exposure = 0.0
    return dict(door=door, step=Vector((X, -0.3, 0.18)), inside=Vector((X, 0.85, 0.35)), barrier_y=-4.5)


def fans(scene, col, people, positions, seed=5):
    """Supporters behind the barrier: instanced copies of the canonical fan builds (duplicates
    share mesh data, so identity stays the exported one)."""
    import random
    rnd = random.Random(seed)
    out = []
    for i, pos in enumerate(positions):
        p = people[i % len(people)]
        out.append((p, pos, rnd.uniform(-25, 25)))
    return out


def phone_flashes(col, frames, fps, positions, seed=9, rate=6.0):
    """Tiny bright camera-phone flashes among the crowd (deterministic)."""
    import random
    rnd = random.Random(seed)
    tr = {}
    for i, pos in enumerate(positions):
        m = look.emission(f"Flash_{i}", "#ffffff", 0.0)
        o = props.box(col, f"FX_Phone{i}", (0.08, 0.012, 0.15), look.flat("PhoneBack", "#15161a", rough=0.3), pos)
        fl = props.plane(col, f"FX_Flash{i}", (0.03, 0.03), m, (0, -0.007, 0.05), rot=(90, 0, 0), parent=o)
        L = look.point(col, f"FX_FlashLight{i}", tuple(Vector(pos) + Vector((0, -0.05, 0.05))), 0.0, "#ffffff", radius=0.01)
        times = sorted(rnd.uniform(0, frames / fps) for _ in range(int(rate * frames / fps / len(positions) * 3) + 1))
        em = m.node_tree.nodes["Emission"].inputs["Strength"]
        for f in range(1, frames + 1):
            t = (f - 1) / fps
            v = max((1 - (t - x) / 0.06) if 0 <= t - x <= 0.06 else 0 for x in times) if times else 0
            tr.setdefault((L.data, "energy", 0), []).append(40.0 * v)
            tr.setdefault((m, 'node_tree.nodes["Emission"].inputs[1].default_value', 0), []).append(400.0 * v)
    write_tracks(tr, frames)
