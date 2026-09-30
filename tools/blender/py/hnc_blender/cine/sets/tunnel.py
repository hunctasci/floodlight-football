"""Stadium tunnel: concrete, fluorescent fixtures, haze, the pitch blazing at
the end. The tunnel runs along +Y; the mouth (pitch light) is at y = MOUTH.
"""
import bpy
from mathutils import Vector

from .. import look, props
from ..look import tag

MOUTH = 22.0
W, H = 4.2, 3.3


def haze(col, center, size, density=0.02, color="#cfd8e6"):
    m, new = look._new(f"Haze_{density}")
    if new:
        nt = m.node_tree
        nt.nodes.clear()
        v = nt.nodes.new("ShaderNodeVolumePrincipled")
        v.inputs["Density"].default_value = density
        v.inputs["Color"].default_value = look.lin(color)
        v.inputs["Anisotropy"].default_value = 0.45
        o = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(v.outputs[0], o.inputs["Volume"])
    b = props.box(col, "FX_Haze", size, m, (center[0], center[1], center[2] - size[2] / 2))
    return b


def tunnel(scene, col, lcol, lit=True):
    B = props.box
    wall = look.pbr("Tun_Wall", "concrete_wall_008", scale=0.35, tint="#b9b4ab", bump=0.8)
    floor = look.pbr("Tun_Floor", "concrete_floor_worn_001", scale=0.35, tint="#9d9890", rough_mul=0.7)
    B(col, "TUN_Floor", (W, MOUTH + 12, 0.05), floor, (0, MOUTH / 2 - 4, -0.05))
    for sx in (-1, 1):
        B(col, "TUN_Wall", (0.3, MOUTH + 12, H), wall, (sx * (W / 2 + 0.15), MOUTH / 2 - 4, 0))
        B(col, "TUN_Kick", (0.04, MOUTH + 12, 0.35), look.flat("TunKick", "#c8101b", rough=0.4, coat=0.3), (sx * (W / 2 - 0.02), MOUTH / 2 - 4, 0))
    B(col, "TUN_Ceiling", (W + 0.6, MOUTH + 12, 0.3), wall, (0, MOUTH / 2 - 4, H))
    # fixtures every 3.5 m
    fx_m = look.emission("TunTube", "#e8f0ff", 9.0 if lit else 0.5)
    y = -2.0
    while y < MOUTH - 2:
        B(col, "TUN_Fixture", (0.25, 1.4, 0.06), look.flat("FixtureBody", "#d9dadd", rough=0.4), (0, y, H - 0.06))
        B(col, "TUN_Tube", (0.14, 1.3, 0.02), fx_m, (0, y, H - 0.08))
        if lit:
            look.area(lcol, "LGT_Tube", (0, y, H - 0.1), (0, y, 0), (0.2, 1.3), 55, "#dfe8ff")
        y += 3.5
    # the mouth: the pitch as pure light (green-white), bright beyond the frame
    props.plane(col, "TUN_Pitch", (W * 3, H * 3), look.emission("PitchLight", "#f3fff0", 22.0), (0, MOUTH + 3.0, H / 2), rot=(90, 0, 0))
    props.plane(col, "TUN_PitchFloor", (W * 3, 8), look.emission("PitchFloorLight", "#9ee27f", 6.0), (0, MOUTH + 3.5, 0.0))
    look.area(lcol, "LGT_Mouth", (0, MOUTH + 1.0, H * 0.6), (0, 0, 1.2), (W, H), 2600, "#f4f8ff")
    haze(col, (0, MOUTH / 2 - 1, H), (W, MOUTH + 6, H), density=0.018)
    look.world(scene, color="#020203", strength=1.0)
    scene.eevee.volumetric_end = 60.0
    scene.view_settings.exposure = 0.0
    return dict(mouth=Vector((0, MOUTH, 0)))
