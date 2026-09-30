"""Generic unbranded car (interior shell + driver door exterior) and the moving
world around it. Filmmaking cheat: the car never moves — streetlights,
facades and the road travel past it, so real roof/pillar occlusion sweeps
light across the driver.

Car space: the car faces -Y, driver on the car's left (+X, left-hand drive),
floor at z=0. HNC scale (the driver is a 2 m HNC adult).
"""
import math

import bpy
from mathutils import Vector

from .. import look, props
from ..anim import Channel
from ..look import tag
from ..perform import write_tracks

DRIVER = Vector((0.42, 0.12, 0.0))  # driver seat root (hips over it)
WHEEL = Vector((0.42, -0.5, 0.93))  # steering wheel centre
WHEEL_R = 0.23
WHEEL_TILT = 62.0  # degrees from horizontal (column rake)


def _mats():
    return dict(
        dash=look.flat("Car_Dash", "#1b1c1f", rough=0.62, spec=0.3),
        trim=look.flat("Car_Trim", "#2a2b2f", rough=0.45, spec=0.4),
        seat=look.pbr("Car_Seat", "fabric_leather_02", scale=3.0, tint="#3a3a3e", rough_mul=0.9),
        head=look.fabric("Car_Headliner", "#8e8b86", rough=0.95, sheen=0.3),
        glass=_glass(),
        chrome=look.flat("Car_Chrome", "#c8c8cc", rough=0.18, metal=1.0),
        paint=look.flat("Car_Paint", "#1e2a36", rough=0.22, metal=0.6, coat=1.0),
        rubber=look.flat("Car_Rubber", "#0c0c0d", rough=0.8),
    )


def _glass():
    return look.window_glass("Car_Glass", reflect=0.45, tint="#e6eef0")


def build_interior(col, time="night", passenger=True):
    """Dash, wheel, console + radio, seats, doors, pillars, roof, glass. Returns anchors."""
    m = _mats()
    B = props.box
    # floor + seats
    B(col, "CAR_Floor", (1.9, 3.0, 0.05), m["rubber"], (0, 0.2, -0.05))
    # passenger=False: the crew pulled the passenger seat for the car-mount lens
    for x, name in ((DRIVER.x, "Driver"), (-DRIVER.x, "Passenger"))[: 2 if passenger else 1]:
        B(col, f"CAR_Seat{name}.Base", (0.62, 0.62, 0.22), m["seat"], (x, 0.2, 0.08), bevel=0.05)
        B(col, f"CAR_Seat{name}.Back", (0.62, 0.16, 0.95), m["seat"], (x, 0.58, 0.28), rot=(-14, 0, 0), bevel=0.05)
        B(col, f"CAR_Seat{name}.Rest", (0.34, 0.14, 0.2), m["seat"], (x, 0.78, 1.28), rot=(-10, 0, 0), bevel=0.04)
    # dashboard: lower + upper slab + hood of the instrument cluster
    B(col, "CAR_Dash.Lower", (1.9, 0.55, 0.7), m["dash"], (0, -1.05, 0.1), bevel=0.03)
    B(col, "CAR_Dash.Top", (1.9, 0.6, 0.12), m["dash"], (0, -1.1, 0.78), rot=(6, 0, 0), bevel=0.04)
    B(col, "CAR_Dash.Hood", (0.5, 0.2, 0.08), m["dash"], (WHEEL.x, -0.86, 0.9), rot=(8, 0, 0), bevel=0.03)
    cluster = look.emission("Car_Cluster", "#8fd4ff" if time == "night" else "#d8ecff", 1.6 if time == "night" else 0.6)
    props.plane(col, "CAR_Cluster", (0.36, 0.1), cluster, (WHEEL.x, -0.8, 0.86), rot=(62, 0, 0))
    # centre console + radio
    B(col, "CAR_Console", (0.34, 0.9, 0.5), m["trim"], (0, -0.45, 0.0), bevel=0.03)
    B(col, "CAR_Stack", (0.36, 0.18, 0.34), m["trim"], (0, -0.86, 0.5), rot=(-18, 0, 0), bevel=0.02)
    radio_on = look.emission("Car_Radio_On", "#ffb45a", 2.2)
    screen = props.plane(col, "CAR_Radio", (0.22, 0.08), radio_on, (0, -0.8, 0.72), rot=(72, 0, 0))
    knob = props.cyl(col, "CAR_Knob", 0.022, 0.025, m["chrome"], (0.13, -0.795, 0.66), rot=(72, 0, 0), segs=20)
    # steering column + wheel (a ring, a hub, three spokes)
    col_m = m["trim"]
    props.cyl(col, "CAR_Column", 0.045, 0.34, col_m, (WHEEL.x, -0.68, 0.8), rot=(90 - WHEEL_TILT + 90, 0, 0), segs=16)
    wheel = tag(bpy.data.objects.new("CAR_Wheel", None))
    col.objects.link(wheel)
    wheel.location = WHEEL
    wheel.rotation_euler = (math.radians(90 - WHEEL_TILT), 0, 0)
    props.torus(col, "CAR_Wheel.Rim", WHEEL_R, 0.022, m["rubber"], parent=wheel, major=48, minor=12)
    props.cyl(col, "CAR_Wheel.Hub", 0.07, 0.05, m["trim"], (0, 0, -0.025), parent=wheel, segs=24)
    for a in (0, 150, 210):
        sp = props.box(col, "CAR_Wheel.Spoke", (0.03, WHEEL_R, 0.018), m["trim"], (0, 0, -0.009), parent=wheel)
        sp.rotation_euler = (0, 0, math.radians(a))
        sp.location = (math.sin(math.radians(a)) * -WHEEL_R / 2, math.cos(math.radians(a)) * WHEEL_R / 2 * -1, -0.009)
    # doors (inner panels) + windows
    for sx, name in ((1, "L"), (-1, "R")):
        B(col, f"CAR_Door{name}", (0.08, 1.4, 0.95), m["trim"], (sx * 0.9, 0.05, 0.1), bevel=0.02)
        B(col, f"CAR_Sill{name}", (0.14, 1.4, 0.05), m["dash"], (sx * 0.86, 0.05, 1.03))
        g = props.plane(col, f"CAR_Window{name}", (1.25, 0.66), m["glass"], (sx * 0.93, -0.02, 1.38), rot=(90, 0, 90 * sx))
        g.visible_shadow = False
        B(col, f"CAR_PillarB{name}", (0.08, 0.12, 0.82), m["trim"], (sx * 0.92, 0.72, 1.03))
        # A-pillar leaning back along the windshield
        B(col, f"CAR_PillarA{name}", (0.08, 0.09, 1.02), m["trim"], (sx * 0.86, -1.18, 0.96), rot=(-52, 0, 0))
    # windshield + roof + rear
    ws = props.plane(col, "CAR_Windshield", (1.72, 1.1), m["glass"], (0, -0.9, 1.4), rot=(90 - 52 + 90, 0, 0))
    ws.rotation_euler = (math.radians(38), 0, 0)
    ws.visible_shadow = False
    B(col, "CAR_Roof", (1.9, 1.7, 0.06), m["head"], (0, 0.2, 1.84))
    B(col, "CAR_Rear", (1.9, 0.1, 0.9), m["trim"], (0, 1.05, 0.95))
    # exterior skin around the passenger window (the car-mount camera sees it)
    for sx, name in ((1, "L"), (-1, "R")):
        B(col, f"CAR_Skin{name}", (0.05, 2.9, 1.0), m["paint"], (sx * 0.99, 0.1, 0.06), bevel=0.02)
        B(col, f"CAR_SkinFrameTop{name}", (0.06, 1.5, 0.06), m["rubber"], (sx * 0.97, -0.02, 1.7))
    B(col, "CAR_RoofSkin", (2.0, 1.9, 0.05), m["paint"], (0, 0.18, 1.88), bevel=0.02)
    B(col, "CAR_Bonnet", (1.95, 1.6, 0.06), m["paint"], (0, -2.0, 0.96), rot=(4, 0, 0), bevel=0.03)
    # mirror + the Türkiye pennant (plain national flag — no federation/competition marks)
    mirror = B(col, "CAR_Mirror", (0.24, 0.05, 0.07), m["trim"], (0, -0.72, 1.66), bevel=0.01)
    props.box(col, "CAR_Mirror.Stem", (0.02, 0.02, 0.1), m["trim"], (0, -0.72, 1.72))
    pennant = pennant_tr(col, (0.0, -0.715, 1.6))
    # phone on the dash (for the "mother" beat)
    phone = props.box(col, "CAR_Phone", (0.075, 0.15, 0.009), look.flat("Phone_Body", "#101114", rough=0.3, coat=0.6), (-0.3, -0.9, 0.86), rot=(6, 0, 12))
    return dict(driver=DRIVER.copy(), wheel=WHEEL.copy(), wheel_obj=wheel, knob=knob, radio=screen, pennant=pennant, phone=phone,
                mirror=mirror)


def pennant_tr(col, loc):
    """Small hanging Türkiye flag (red field, white crescent + star) on a string."""
    img = bpy.data.images.new("FlagTR", 240, 160)
    tag(img)
    W, H = 240, 160
    px = [0.0] * (W * H * 4)
    red = look.lin("#e30a17")
    for y in range(H):
        for x in range(W):
            u, v = x / H, y / H  # flag proportions 3:2, unit = height
            c = red
            # crescent: outer circle (0.5, 0.5) r .25 minus inner (0.5625, 0.5) r .2; star at ~0.8
            d1 = math.hypot(u - 0.5, v - 0.5)
            d2 = math.hypot(u - 0.5625, v - 0.5)
            ang = math.atan2(v - 0.5, u - 0.8)
            rr = math.hypot(u - 0.8, v - 0.5)
            star = rr < 0.125 * (0.55 + 0.45 * math.cos(5 * (ang - math.pi / 2))) ** 2 + 0.035
            if (d1 < 0.25 and d2 > 0.2) or star:
                c = (1, 1, 1, 1)
            i = (y * W + x) * 4
            px[i:i + 4] = (c[0], c[1], c[2], 1.0)
    img.pixels = px
    img.pack()
    mat = look.flat("FlagTR_Mat", "#ffffff", rough=0.7, sheen=0.4)
    nt = mat.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    pivot = tag(bpy.data.objects.new("CAR_Pennant", None))
    col.objects.link(pivot)
    pivot.location = loc
    props.box(col, "CAR_Pennant.String", (0.004, 0.004, 0.08), look.flat("String", "#dddddd"), (0, 0, -0.08), parent=pivot)
    f = props.plane(col, "CAR_Pennant.Flag", (0.09, 0.06), mat, (0, 0, -0.11), rot=(90, 0, 0), parent=pivot)
    return pivot


# ---------------------------------------------------------------- the world outside


def moving_world(scene, col, frames, fps, time="night", speed=8.0, seed=3):
    """Road, facades, trees and streetlights that travel +Y past the parked car."""
    root = tag(bpy.data.objects.new("WORLD_Move", None))
    col.objects.link(root)
    rnd = __import__("random").Random(seed)
    length = speed * frames / fps + 60
    road = look.pbr("Road_Asphalt", "asphalt_02", scale=0.25, tint="#8a8a8a" if time == "day" else "#5a5a5a", rough_mul=0.9)
    props.plane(col, "WORLD_Road", (14, length + 80), road, (0, -length / 2, -0.25), parent=root)
    line = look.emission("Road_Line", "#d8d4c8", 0.25 if time == "night" else 0.0) if time == "night" else look.flat("Road_LineDay", "#e8e4d8", rough=0.6)
    y = 20.0
    while y > -length - 40:
        props.box(col, "WORLD_Dash", (0.12, 2.2, 0.01), line, (-1.6, y, -0.245), parent=root)
        y -= 6.0
    facade_day = [look.pbr(f"Facade_{i}", t, scale=0.35, tint=c) for i, (t, c) in enumerate(
        [("painted_plaster_wall", "#e6ddcf"), ("white_plaster_02", "#d7dde2"), ("painted_plaster_wall", "#d9c3a8"), ("concrete_wall_008", "#c8c4bc")])]
    win_night = [look.emission(f"Win_{i}", c, s) for i, (c, s) in enumerate([("#ffcf8a", 2.0), ("#ffe2b8", 1.2), ("#9cc4ff", 0.8), ("#ffb870", 3.0)])]
    dark = look.flat("Facade_Night", "#0d0f14", rough=0.8)
    glass_day = look.flat("Facade_Glass", "#56697a", rough=0.08, metal=0.3, coat=1.0)
    for side in (1, -1):
        y = 20.0
        while y > -length - 40:
            w = rnd.uniform(7, 14)
            h = rnd.uniform(6, 16)
            x = side * rnd.uniform(9.5, 12)
            if time == "day":
                b = props.box(col, "WORLD_Bldg", (4, w - 0.6, h), facade_day[rnd.randrange(4)], (x + side * 2, y - w / 2, -0.25), parent=root)
                for k in range(int(h // 3)):
                    props.box(col, "WORLD_BldgWin", (0.05, w * 0.7, 1.1), glass_day, (x - side * 0.02, y - w / 2, 1.2 + k * 3), parent=root)
            else:
                props.box(col, "WORLD_Bldg", (4, w - 0.6, h), dark, (x + side * 2, y - w / 2, -0.25), parent=root)
                for k in range(int(h // 3)):
                    for j in range(int(w // 1.6)):
                        if rnd.random() < 0.4:
                            props.box(col, "WORLD_Lit", (0.05, 0.6, 0.55), win_night[rnd.randrange(4)], (x - side * 0.02, y - 0.9 - j * 1.6, 1.5 + k * 2.2), parent=root)
                # shop fronts / signs at street level: small saturated points (bokeh colour)
                for j in range(int(w // 3)):
                    if rnd.random() < 0.5:
                        c = ("#ff5a4a", "#5ad1ff", "#ffd36a", "#ffffff", "#7dff9a")[rnd.randrange(5)]
                        props.box(col, "WORLD_Sign", (0.05, rnd.uniform(0.4, 1.2), 0.18), look.emission(f"Sign_{c}", c, 6.0), (x - side * 0.05, y - 1 - j * 3, rnd.uniform(0.9, 2.4)), parent=root)
            y -= w
        # trees (day) / streetlights (both)
        y = 12.0
        while y > -length - 40:
            if time == "day" and rnd.random() < 0.7:
                trunk = props.cyl(col, "WORLD_Trunk", 0.12, 2.6, look.flat("Bark", "#4a3b2e", rough=0.9), (side * 6.8, y, -0.25), parent=root, segs=8)
                props.sphere(col, "WORLD_Crown", 1.6, look.flat("Leaf", "#48633a", rough=0.85), (side * 6.8, y, 3.4), scale=(1, 1, 0.85), parent=root, segs=10, rings=6)
            y -= rnd.uniform(9, 14)
    # streetlights: pole + head + light, 26 m apart on the driver's side and over the road
    lamp_m = look.emission("Lamp_Sodium", "#ffb45e", 25.0)
    pole_m = look.flat("Pole", "#2b2d31", rough=0.5, metal=0.6)
    y = 6.0
    lamps = []
    while y > -length - 20:
        for side in (1, -1):
            props.cyl(col, "WORLD_Pole", 0.08, 7.0, pole_m, (side * 7.2, y, -0.25), parent=root, segs=10)
            props.box(col, "WORLD_Arm", (2.8, 0.14, 0.1), pole_m, (side * 5.9, y, 6.6), parent=root)
            head = props.box(col, "WORLD_LampHead", (0.7, 0.3, 0.08), lamp_m, (side * 4.7, y, 6.5), parent=root)
            if time == "night":
                L = look.point(col, "WORLD_Streetlight", (side * 4.7, y, 6.3), power=2600, color="#ffae55", radius=0.3)
                L.parent = root
                lamps.append(L)
        y -= 14.0 if time == "night" else 40.0
    # travel
    tracks = {}
    for f in range(1, frames + 1):
        t = (f - 1) / fps
        for i, v in enumerate((0.0, speed * t, 0.0)):
            tracks.setdefault((root, "location", i), []).append(v)
    write_tracks(tracks, frames)
    return root


def night_rig(scene, col, anchors):
    """Opening look: deep blue ambience; a cool soft key through the windshield
    (city sky glow), a cyan dash under-glow, warm radio spill; the moving
    sodium streetlights sweep over the top of this."""
    look.world(scene, hdri="cobblestone_street_night", hdri_strength=0.25, rot_deg=40, bg_color="#03050a", bg_strength=1.0)
    d = anchors["driver"]
    look.area(col, "LGT_CityKey", (d.x - 0.3, -1.9, 1.9), (d.x, d.y, 1.42), (1.4, 0.8), 38.0, "#6f8fd6")
    look.area(col, "LGT_DashGlow", (d.x - 0.05, -0.62, 1.0), (d.x, d.y - 0.05, 1.45), (0.4, 0.12), 14.0, "#7fc4ff")
    look.area(col, "LGT_RadioSpill", (0.05, -0.75, 0.8), (d.x, d.y, 1.35), (0.2, 0.1), 5.0, "#ffae62")
    look.area(col, "LGT_CityRim", (d.x + 1.6, 0.4, 1.7), (d.x, d.y, 1.45), (1.0, 1.0), 28.0, "#b9c9ff")
    scene.view_settings.exposure = 0.4


def sweep(col, anchors, frames, fps, peaks, color="#ffab52", power=520.0, travel=0.75):
    """A streetlight passing overhead, timed: an area light that crosses the
    windshield and the driver's face with its peak at each time in ``peaks``."""
    d = anchors["driver"]
    L = look.area(col, "LGT_Sweep", (d.x - 0.6, -3.0, 2.3), (d.x, d.y, 1.4), (0.9, 0.5), power, color)
    tracks = {}
    start, end = Vector((d.x - 0.7, -3.4, 2.5)), Vector((d.x - 0.2, 2.2, 2.35))
    for f in range(1, frames + 1):
        t = (f - 1) / fps
        u, w = 1.2, 0.0
        for pk in peaks:
            k = (t - (pk - travel / 2)) / travel
            if -0.1 <= k <= 1.1:
                u, w = k, max(0.0, 1 - abs(k - 0.5) * 2) ** 0.8
        pos = start.lerp(end, max(0, min(1, u)))
        for i, v in enumerate(pos):
            tracks.setdefault((L, "location", i), []).append(v)
        tracks.setdefault((L.data, "energy", 0), []).append(power * w)
        q = (Vector((d.x, d.y, 1.4)) - pos).to_track_quat("-Z", "Y").to_euler()
        for i, v in enumerate(q):
            tracks.setdefault((L, "rotation_euler", i), []).append(v)
    write_tracks(tracks, frames)
    return L


def day_rig(scene, col, anchors):
    """Daylight: the sun + the sky through each window (portal area lights), so a
    closed cabin still reads like daylight rather than a dark box."""
    look.world(scene, hdri="urban_street_04", hdri_strength=1.0, rot_deg=0)
    look.sun(col, "LGT_Sun", (48, 8, 145), power=3.2, color="#fff4e6", angle=1.2)
    d = anchors["driver"]
    look.area(col, "LGT_SkyWindshield", (0.0, -1.6, 1.75), (d.x, d.y, 1.3), (1.6, 0.8), 70, "#eef3fb")
    look.area(col, "LGT_SkyDriverWin", (1.35, 0.0, 1.45), (d.x, d.y, 1.35), (1.2, 0.6), 40, "#f3f5fa")
    look.area(col, "LGT_SkyPassWin", (-1.35, 0.0, 1.45), (d.x, d.y, 1.35), (1.2, 0.6), 30, "#f3f5fa")
    scene.view_settings.exposure = -0.3
