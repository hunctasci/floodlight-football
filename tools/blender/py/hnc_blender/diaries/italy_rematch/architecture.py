"""Reusable modern residential-building set for the Italy-rematch previews.

The corridor, lift and stair core share a restrained material palette and real
metre dimensions. Shot modules only stage doors, displays and performances;
all architectural geometry lives here.
"""
import bpy
from mathutils import Vector

from ...cine import look, props
from . import score


CEILING = 2.76
CORRIDOR_HALF = 1.00


def _mat(name, color, rough=0.55, metal=0.0, spec=0.45, coat=0.0):
    return look.flat(f"ARCH_{name}", color, rough=rough, metal=metal, spec=spec, coat=coat)


def _textured(name, color, rough=0.7, bump=0.05, scale=7.0, metal=0.0,
              directional=False):
    """Small physically-based surface variation without a visible noise pattern."""
    mat = _mat(name, color, rough=rough, metal=metal, spec=0.38)
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.name = f"{name} micro variation"
    tex.noise_dimensions = "3D"
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = 2.0
    tex.inputs["Roughness"].default_value = 0.45
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    if directional:
        mapping.inputs["Scale"].default_value = (3.0, 180.0, 5.0)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (rough * 0.72,) * 3 + (1.0,)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (min(1.0, rough * 1.16),) * 3 + (1.0,)
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Roughness"])
    if bump:
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        bn.inputs["Distance"].default_value = 0.025 if not directional else 0.006
        nt.links.new(tex.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], bsdf.inputs["Normal"])
    if directional and "Anisotropic IOR Level" in bsdf.inputs:
        bsdf.inputs["Anisotropic IOR Level"].default_value = 0.32
    return mat


def materials():
    return {
        "wall": _textured("WarmPlaster", "#c8c5bd", rough=0.78, bump=0.035, scale=5.0),
        "wall_cool": _textured("CoolPaint", "#969b99", rough=0.82, bump=0.025, scale=6.0),
        "floor": _textured("StoneTile", "#646763", rough=0.52, bump=0.10, scale=11.0),
        "concrete": _textured("StairConcrete", "#707572", rough=0.80, bump=0.12, scale=9.0),
        "ceiling": _mat("Ceiling", "#dedbd3", rough=0.90, spec=0.16),
        "trim": _mat("Baseboard", "#555d5d", rough=0.46, metal=0.16, spec=0.42),
        "wood": _textured("OakDoor", "#765d45", rough=0.48, bump=0.06, scale=4.0),
        "metal": _textured("BrushedSteel", "#8a9293", rough=0.30, bump=0.10,
                           scale=55.0, metal=0.90, directional=True),
        "dark_metal": _textured("DarkMetal", "#303739", rough=0.38, bump=0.06,
                                scale=45.0, metal=0.72, directional=True),
        "black": _mat("DisplayBlack", "#101517", rough=0.22, metal=0.12, spec=0.70),
        "glass": look.window_glass("ARCH_Glass", reflect=0.20, tint="#cbd4d5", rough=0.045),
    }


def _label(col, text, loc, size=0.18, rotation=(90, 0, 0), name="ARCH_Label",
           color="#2d383c", depth=0.009):
    mat = _mat(f"Label_{name}", color, rough=0.52, spec=0.25)
    return score.build_glyph(col, text, loc, size, depth=depth, material=mat,
                             name=name, rotation=rotation, bevel=False)


def _practical(col, name, loc, target, color="#f3d5a4", power=115, size=(0.55, 0.16)):
    return look.area(col, name, loc, target, size=size, power=power, color=color,
                     shape="RECTANGLE", spread=125.0)


def _beam_between(col, name, a, b, radius, mat, segs=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    beam = props.cyl(col, name, radius, d.length, mat, tuple(a), segs=segs)
    beam.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return beam


def corridor(sh, y0=-7.0, y1=7.0, doors=True):
    c, m = sh.cols["SET"], materials()
    length, mid = y1 - y0, (y0 + y1) * 0.5
    props.box(c, "ARCH_CorridorFloor", (CORRIDOR_HALF * 2, length, 0.10), m["floor"],
              (0, mid, -0.10), bevel=0.018)
    props.box(c, "ARCH_CorridorCeiling", (CORRIDOR_HALF * 2, length, 0.10), m["ceiling"],
              (0, mid, CEILING))
    for side, sx in (("L", -1), ("R", 1)):
        props.box(c, f"ARCH_CorridorWall{side}", (0.10, length, CEILING), m["wall"],
                  (sx * CORRIDOR_HALF, mid, 0), bevel=0.012)
        props.box(c, f"ARCH_CorridorBase{side}", (0.045, length, 0.115), m["trim"],
                  (sx * (CORRIDOR_HALF - 0.07), mid, 0), bevel=0.006)
    grout = _mat("FloorJoint", "#414744", rough=0.78, spec=0.12)
    for i in range(1, int(length / 1.20)):
        yy = y0 + i * 1.20
        props.box(c, f"ARCH_FloorJoint_{i}", (1.94, 0.012, 0.003), grout, (0, yy, 0.001))
    if doors:
        for idx, (side, yy, number) in enumerate(((-1, -3.6, "12"), (1, -0.8, "14"),
                                                  (-1, 2.7, "16"), (1, 5.3, "18"))):
            x = side * (CORRIDOR_HALF - 0.066)
            props.box(c, f"ARCH_AptDoor_{idx}", (0.045, 0.91, 2.14), m["wood"],
                      (x, yy, 0.0), bevel=0.022)
            props.box(c, f"ARCH_DoorLintel_{idx}", (0.07, 1.02, 0.06), m["trim"],
                      (side * (CORRIDOR_HALF - 0.09), yy, 2.14), bevel=0.008)
            props.cyl(c, f"ARCH_DoorHandle_{idx}", 0.018, 0.075, m["metal"],
                      (side * (CORRIDOR_HALF - 0.13), yy - 0.30, 1.03),
                      rot=(0, 90, 0), segs=12)
            _label(c, number, (side * (CORRIDOR_HALF - 0.125), yy + 0.30, 1.72),
                   size=0.115, rotation=(90, 0, 90 if side > 0 else -90),
                   name=f"ARCH_DoorNumber_{idx}")
    warm = _mat("WarmPracticalLens", "#e9d2aa", rough=0.32, spec=0.35, coat=0.10)
    for i, yy in enumerate((-5.2, -2.2, 0.8, 3.8, 6.2)):
        if not y0 < yy < y1:
            continue
        props.box(c, f"ARCH_CorridorFixture_{i}", (0.58, 0.16, 0.032), warm,
                  (0, yy, CEILING - 0.035), bevel=0.018)
        _practical(sh.cols["LGT"], f"ARCH_CorridorPractical_{i}",
                   (0, yy, CEILING - 0.10), (0, yy + 0.25, 0.7), power=95)
    return {"materials": m, "bounds": (-CORRIDOR_HALF, CORRIDOR_HALF, y0, y1, 0, CEILING)}


def elevator(sh):
    """Build a 2.34 x 2.72 m cabin opening onto corridor y<0."""
    c, m = sh.cols["SET"], materials()
    cab_half, depth, height = 1.17, 2.72, 2.58
    props.box(c, "ARCH_ElevatorFloor", (cab_half * 2, depth, 0.10), m["floor"],
              (0, 1.44, -0.10), bevel=0.015)
    props.box(c, "ARCH_ElevatorBack", (cab_half * 2, 0.08, height), m["metal"],
              (0, 2.80, 0), bevel=0.012)
    props.box(c, "ARCH_ElevatorCeiling", (cab_half * 2, depth, 0.08), m["dark_metal"],
              (0, 1.44, height))
    props.box(c, "ARCH_ElevatorSideL", (0.08, depth, height), m["metal"],
              (-cab_half, 1.44, 0), bevel=0.012)
    props.box(c, "ARCH_ElevatorSideR", (0.08, depth, height), m["metal"],
              (cab_half, 1.44, 0), bevel=0.012)
    for side, sx in (("L", -1), ("R", 1)):
        props.box(c, f"ARCH_ElevatorJamb{side}", (0.09, 0.12, 2.38), m["dark_metal"],
                  (sx * 1.14, -0.03, 0), bevel=0.012)
    props.box(c, "ARCH_ElevatorHeader", (2.37, 0.12, 0.20), m["dark_metal"],
              (0, -0.03, 2.38), bevel=0.012)
    door_l = props.box(c, "ARCH_ElevatorDoorL", (1.10, 0.06, 2.30), m["metal"],
                       (-0.55, 0.035, 0), bevel=0.010)
    door_r = props.box(c, "ARCH_ElevatorDoorR", (1.10, 0.06, 2.30), m["metal"],
                       (0.55, 0.035, 0), bevel=0.010)
    # Exterior call/floor panel is front-facing on the right jamb so a single
    # threshold composition can read hand, controls, display and doors.
    panel = props.box(c, "ARCH_ElevatorPanel", (0.30, 0.032, 0.76), m["dark_metal"],
                      (0.87, -0.115, 0.70), bevel=0.012)
    button_mat = _mat("ElevatorButton", "#b8c0c0", rough=0.22, metal=0.72, spec=0.72)
    buttons = {}
    for idx, number in enumerate((1, 2, 3, 4)):
        row, col = divmod(idx, 2)
        x, z = 0.81 + col * 0.13, 0.91 + row * 0.23
        b = props.cyl(c, f"ARCH_Button_{number}", 0.036, 0.018, button_mat,
                      (x, -0.145, z), rot=(90, 0, 0), segs=20)
        b["hnc_floor_button"] = number
        buttons[number] = b
        _label(c, str(number), (x, -0.167, z - 0.024), size=0.065,
               rotation=(90, 0, 0), name=f"ARCH_ButtonLabel_{number}",
               color="#20282a", depth=0.004)
    display = props.box(c, "ARCH_FloorDisplay", (0.66, 0.038, 0.31), m["black"],
                        (0, -0.105, 2.255), bevel=0.012)
    display["hnc_floor_display"] = True
    lens = _mat("ElevatorLightLens", "#dce5e6", rough=0.36, spec=0.45)
    props.box(c, "ARCH_ElevatorLightLens", (1.32, 0.52, 0.028), lens,
              (0, 1.48, height - 0.035), bevel=0.018)
    _practical(sh.cols["LGT"], "ARCH_ElevatorLight", (0, 1.48, height - 0.12),
               (0, 1.48, 0.7), color="#d9e6e9", power=225, size=(1.28, 0.50))
    return {"display": display, "doors": (door_l, door_r), "panel": panel,
            "buttons": buttons, "button": buttons[1],
            "cabin": {"width": cab_half * 2, "depth": depth, "height": height},
            "materials": m}


def reflection_wall(sh, y=-0.3, length=4.7):
    """A framed dark-glass recess that masks reflection-only geometry."""
    c, m = sh.cols["SET"], materials()
    x, frame = CORRIDOR_HALF - 0.075, m["dark_metal"]
    old_wall = bpy.data.objects.get("ARCH_CorridorWallR")
    if old_wall is not None:
        old_wall.hide_render = True
        old_wall.hide_viewport = True
    old_base = bpy.data.objects.get("ARCH_CorridorBaseR")
    if old_base is not None:
        old_base.hide_render = True
        old_base.hide_viewport = True
    lo, hi = y - length * 0.5, y + length * 0.5
    # Restore the solid wall before/after the aperture; the panel is not an
    # unbounded window into black space when viewed on a long lens.
    for i, (a, b) in enumerate(((-7.0, lo), (hi, 7.0))):
        props.box(c, f"ARCH_ReflectionWallSegment_{i}", (0.10, b - a, CEILING), m["wall"],
                  (CORRIDOR_HALF, (a + b) * 0.5, 0), bevel=0.012)
        props.box(c, f"ARCH_ReflectionBaseSegment_{i}", (0.045, b - a, 0.115), m["trim"],
                  (CORRIDOR_HALF - 0.07, (a + b) * 0.5, 0), bevel=0.006)
    glass = props.box(c, "ARCH_CorridorReflectionGlass", (0.022, length, 2.18), m["glass"],
                      (x - 0.016, y, 0.26), bevel=0.008)
    glass["hnc_reflection_method"] = "mirrored in-scene geometry behind framed architectural glass"
    for i, yy in enumerate((y - length * 0.5, y + length * 0.5)):
        props.box(c, f"ARCH_GlassFrameSide_{i}", (0.09, 0.075, 2.30), frame,
                  (x - 0.045, yy, 0.20), bevel=0.008)
    props.box(c, "ARCH_GlassFrameTop", (0.09, length, 0.075), frame,
              (x - 0.045, y, 2.40), bevel=0.008)
    props.box(c, "ARCH_GlassFrameBottom", (0.09, length, 0.075), frame,
              (x - 0.045, y, 0.18), bevel=0.008)
    backing = props.box(c, "ARCH_ReflectionBacking", (0.045, length - 0.12, 2.10),
                        _mat("ReflectionBacking", "#20282b", rough=0.64, spec=0.20),
                        (x + 0.23, y, 0.29), bevel=0.004)
    return {"glass": glass, "backing": backing, "plane_x": x - 0.005,
            "score_x": x + 0.095, "aperture": (lo, hi, 0.26, 2.44)}


def reflection_end(sh, y=2.72):
    """Large end-of-corridor reflective panel for readable long-lens staging."""
    c, m = sh.cols["SET"], materials()
    glass = props.box(c, "ARCH_CorridorReflectionGlass", (1.78, 0.022, 2.16), m["glass"],
                      (0.0, y, 0.24), bevel=0.008)
    glass["hnc_reflection_method"] = "mirrored in-scene geometry behind framed architectural glass"
    frame = m["dark_metal"]
    for i, xx in enumerate((-0.93, 0.93)):
        props.box(c, f"ARCH_EndGlassFrameSide_{i}", (0.075, 0.09, 2.29), frame,
                  (xx, y - 0.025, 0.18), bevel=0.008)
    props.box(c, "ARCH_EndGlassFrameTop", (1.94, 0.09, 0.075), frame,
              (0, y - 0.025, 2.40), bevel=0.008)
    props.box(c, "ARCH_EndGlassFrameBottom", (1.94, 0.09, 0.075), frame,
              (0, y - 0.025, 0.17), bevel=0.008)
    backing = props.box(c, "ARCH_ReflectionBacking", (1.76, 0.045, 2.08),
                        _mat("ReflectionBacking", "#20282b", rough=0.62, spec=0.22),
                        (0, y + 0.23, 0.29), bevel=0.004)
    return {"glass": glass, "backing": backing, "score_y": y + 0.11,
            "aperture": (-0.89, 0.89, 0.24, 2.40)}


def stairwell(sh):
    c, m = sh.cols["SET"], materials()
    rise, run, steps, low_y = 0.18, 0.32, 10, -1.62
    props.box(c, "ARCH_StairLowerLanding", (2.0, 2.0, 0.12), m["concrete"],
              (0, low_y - 1.05, -0.12), bevel=0.015)
    for i in range(steps):
        top, yy = i * rise, low_y + i * run
        props.box(c, f"ARCH_Stair_{i:02d}", (1.34, run + 0.025, max(0.12, top + 0.12)),
                  m["concrete"], (0, yy, -0.12), bevel=0.008)
    _label(c, "14", (0.0, low_y + 5 * run - run * 0.53, 0.52), size=0.48,
           name="ARCH_RiserMarker14", color="#d9ddd8", depth=0.006)
    high_z = (steps - 1) * rise
    props.box(c, "ARCH_StairUpperLanding", (2.0, 2.0, high_z + 0.12), m["concrete"],
              (0, low_y + steps * run + 0.95, -0.12), bevel=0.015)
    for side, sx in (("L", -1), ("R", 1)):
        props.box(c, f"ARCH_StairWall{side}", (0.10, 7.2, 3.45), m["wall_cool"],
                  (sx * 1.02, -0.15, 0), bevel=0.012)
    props.box(c, "ARCH_StairBackWall", (2.04, 0.10, 3.45), m["wall_cool"],
              (0, 3.38, 0), bevel=0.012)
    rail_x = 0.73
    for i, step_i in enumerate((1, 3, 5, 7)):
        yy, zz = low_y + step_i * run, step_i * rise
        props.cyl(c, f"ARCH_RailBar_{i+1}", 0.020, 0.88, m["dark_metal"],
                  (rail_x, yy, zz), segs=12)
    props.box(c, "ARCH_RailStructuralOne", (0.055, 0.055, 1.02), m["dark_metal"],
              (rail_x, low_y + 9 * run, 1.38), bevel=0.006)
    _beam_between(c, "ARCH_StairHandrail", (rail_x, low_y - 0.10, 0.90),
                  (rail_x, low_y + (steps - 1) * run + 0.15, high_z + 0.98),
                  0.032, m["dark_metal"], segs=16)
    plaque = _mat("LandingPlaque", "#e7e4dc", rough=0.62, spec=0.22)
    props.box(c, "ARCH_LandingPlaque14", (0.72, 0.035, 0.42), plaque,
              (-0.48, 3.30, 2.16), bevel=0.016)
    _label(c, "14", (-0.48, 3.265, 2.20), size=0.30, name="ARCH_LandingMarker14",
           color="#263237", depth=0.012)
    green = _mat("EmergencyGreen", "#295f54", rough=0.58, spec=0.22)
    props.box(c, "ARCH_EmergencySign", (0.035, 0.70, 0.50), green,
              (-0.955, -0.62, 1.18), bevel=0.014)
    _label(c, "1  4", (-0.925, -0.62, 1.28), size=0.34, rotation=(90, 0, -90),
           name="ARCH_EmergencyOneFour", color="#eef3e9", depth=0.008)
    props.box(c, "ARCH_StairServiceDoor", (0.045, 0.92, 2.08), m["dark_metal"],
              (0.955, 2.37, high_z), bevel=0.018)
    _label(c, "1", (0.925, 2.16, high_z + 1.58), size=0.14, rotation=(90, 0, 90),
           name="ARCH_ServiceOne", color="#e8e5dd")
    for j in range(4):
        props.box(c, f"ARCH_ServiceFourBar_{j}", (0.012, 0.16, 0.055), plaque,
                  (0.925, 2.52 + j * 0.075, high_z + 1.57), bevel=0.003)
    cool_lens = _mat("StairLightLens", "#c9d7d8", rough=0.38, spec=0.34)
    for i, (yy, zz) in enumerate(((-1.0, 2.28), (1.85, 3.02))):
        props.box(c, f"ARCH_StairFixture_{i}", (0.42, 0.13, 0.04), cool_lens,
                  (0, yy, zz), bevel=0.016)
        _practical(sh.cols["LGT"], f"ARCH_StairPractical_{i}", (0, yy, zz - 0.08),
                   (0, yy - 0.25, 0.8 + i * 0.8), color="#cfe0e2", power=120)
    return {"rise": rise, "run": run, "steps": steps, "low_y": low_y,
            "high_z": high_z, "materials": m}


def shared(sh, include="corridor"):
    look.world(sh.scene, color="#11171a", strength=0.28)
    if include in ("corridor", "elevator"):
        corridor(sh, y0=-7.0, y1=0.0 if include == "elevator" else 7.0,
                 doors=include != "elevator")
        if include == "elevator":
            return elevator(sh)
    if include == "stairs":
        return stairwell(sh)
    return None
