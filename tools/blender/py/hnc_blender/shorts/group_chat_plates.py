"""THE GROUP CHAT plates: 6 cheap EEVEE stills (1080x1920) for the Remotion film.

Headless: Blender -b --python group_chat_plates.py -- --out <plates_dir>

- One neutral pre-match room per player (same geometry, red/navy redress).
- Canonical HR-PLAYER-01 / EN-PLAYER-01 imports (parity-inspected on import,
  same path as every HNC plate) — never custom bodies.
- Blender phone = physical object + screen glow only; readable chat lives in
  Remotion. Physical message cards via shorts/cards.py (same bubble grammar).
- Deterministic: authored placements, seeded perform channels. No rigid-body
  sim, no external assets (flat/procedural materials only).
"""
import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hnc_blender.cine import cast, look, props  # noqa: E402
from hnc_blender.cine.perform import relax_arms, sit  # noqa: E402
from hnc_blender.shorts import cards as C  # noqa: E402

BLENDER_BIN_HINT = "HNC_BLENDER_BIN"

# Plate id -> (room side, canon id, accent, wall tint)
SIDES = {
    "hr": {"canon": "HR-PLAYER-01", "accent": "#c8102e", "wall": "#ece5d8", "stripe": "#c8102e"},
    "en": {"canon": "EN-PLAYER-01", "accent": "#1b2a5e", "wall": "#e2e6ee", "stripe": "#1b2a5e"},
}


def _scene(name):
    # Fresh plate without wm file ops (headless- and MCP-safe): unlink the
    # whole content tree and purge orphan datablocks instead of resetting.
    # The look-material cache is cleared first so it never holds dead pointers
    # (its liveness guard itself crashes on removed structs).
    try:
        look._cache.clear()
    except Exception:
        pass
    for scene in list(bpy.data.scenes):
        for child in list(scene.collection.children):
            try:
                scene.collection.children.unlink(child)
            except Exception:
                pass
    for coll in list(bpy.data.collections):
        try:
            bpy.data.collections.remove(coll)
        except Exception:
            pass
    for obj in list(bpy.data.objects):
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass
    for store in ("meshes", "curves", "materials", "lights", "cameras"):
        try:
            block = getattr(bpy.data, store)
            for dat in list(block):
                try:
                    block.remove(dat)
                except Exception:
                    pass
        except Exception:
            pass
    sc = bpy.context.scene
    sc.name = name
    cols = {}
    for cname in ("SET", "CAST", "PROPS", "LGT", "CAM", "FX"):
        c = bpy.data.collections.new(cname)
        sc.collection.children.link(c)
        cols[cname] = c
    return sc, cols


def _render_setup(sc, samples=48):
    import os as _os
    r = sc.render
    if _os.environ.get("HNC_QA"):
        # Cheap headless QA: 540x960, low samples. Full quality below.
        r.resolution_x, r.resolution_y = 540, 960
        samples = min(samples, 16)
    else:
        r.resolution_x, r.resolution_y = 1080, 1920
    r.resolution_percentage = 100
    r.film_transparent = False
    r.engine = "BLENDER_EEVEE"
    if hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = samples
    sc.eevee.use_shadows = True
    r.use_motion_blur = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    sc.display_settings.display_device = "sRGB"
    try:
        from hnc_blender.cine.look import VIEW_TRANSFORM
        sc.view_settings.view_transform = VIEW_TRANSFORM
    except Exception:
        sc.view_settings.view_transform = "Standard"
    sc.frame_start = sc.frame_end = 1


def _room(sc, cols, side):
    """Neutral pre-match lounge: floor, back wall, baseboard, accent stripe,
    bench + cushion, floor lamp, picture frame. Camera side (-Y) stays open."""
    cfg = SIDES[side]
    m = dict(
        floor=look.flat("GC_Floor", "#b9a88f", rough=0.7),
        wall=look.flat("GC_Wall", cfg["wall"], rough=0.9),
        base=look.flat("GC_Base", "#f2ede2", rough=0.6),
        stripe=look.flat("GC_Stripe", cfg["stripe"], rough=0.5),
        bench=look.flat("GC_Bench", "#3a3f4a", rough=0.6),
        cushion=look.flat("GC_Cushion", cfg["accent"], rough=0.8),
        frame=look.flat("GC_Frame", "#1b1d20", rough=0.4),
        art=look.flat("GC_Art", "#f4f2ec", rough=0.8),
    )
    B = props.box
    B(cols["SET"], "GC_Floor", (6.0, 5.0, 0.05), m["floor"], (0, 0.5, -0.05))
    B(cols["SET"], "GC_BackWall", (6.0, 0.12, 3.6), m["wall"], (0, 2.56, 0))
    B(cols["SET"], "GC_Baseboard", (6.0, 0.03, 0.12), m["base"], (0, 2.49, 0))
    B(cols["SET"], "GC_LeftWall", (0.12, 5.0, 3.6), m["wall"], (-3.0, 0.5, 0))
    # Team accent stripe across the back wall (the only country signal in the set).
    B(cols["SET"], "GC_Stripe", (6.0, 0.02, 0.16), m["stripe"], (0, 2.49, 1.72))
    # Bench the player sits on + accent cushion.
    B(cols["SET"], "GC_Bench", (1.7, 0.55, 0.1), m["bench"], (0.25, 0.55, 0.26), bevel=0.01)
    for lx in (-0.45, 0.95):
        B(cols["SET"], "GC_BenchLeg", (0.08, 0.45, 0.26), m["bench"], (lx, 0.55, 0.0))
    B(cols["SET"], "GC_Cushion", (0.5, 0.4, 0.1), m["cushion"], (-0.35, 0.55, 0.36), bevel=0.02)
    # Warm practical + picture frame for depth.
    props.floor_lamp(cols["PROPS"], "GC_Lamp", (-1.35, 1.3, 0.0), on=True, power=60.0)
    B(cols["SET"], "GC_Frame", (0.7, 0.05, 0.9), m["frame"], (1.15, 2.48, 1.75))
    B(cols["SET"], "GC_Art", (0.58, 0.02, 0.78), m["art"], (1.15, 2.45, 1.75))
    # Lights: soft key from camera-left, cool rim from behind, dark arena void.
    look.area(cols["LGT"], "GC_Key", (-1.6, -2.2, 2.4), (0.2, 0.5, 1.0), size=(1.4, 1.4), power=260.0, color="#fff2e2")
    look.point(cols["LGT"], "GC_Fill", (1.8, -1.6, 1.6), 40.0, "#dfe8ff", radius=0.2)
    look.sun(cols["LGT"], "GC_Rim", (35, 0, 160), power=1.6, color="#cfe0ff")
    look.world(sc, color="#0a0f1e", strength=0.35)
    return m


def _phonelight(cols, loc=(0.25, -0.4, 1.05)):
    """Small cool glow at the phone: subtle face/phone-light interaction."""
    look.point(cols["LGT"], "GC_PhoneGlow", loc, 6.0, "#cfe0ff", radius=0.05)


def _player(cols, side, seed, gaze, smile_on=False, glance_x=0.0):
    """Canonical player seated on the bench, gazing at the phone target.

    Still-plate posing: every channel is keyed once at t=0 ("hold"), so the
    baked frame 1 IS the settled pose (no animated look/glide helpers whose
    excursions would land past the baked range).
    """
    cfg = SIDES[side]
    p = cast.person(bpy.context.scene, cols["CAST"], cfg["canon"], "kit", fps=60, frames=2, seed=seed)
    sit(p, 0.0, (0.25, 0.55, 0.0), face=0.0, seat_h=0.36, feet_fwd=0.36)
    relax_arms(p, 0.0)
    # Hands grip the phone zone (IK weights on: the keys below actually apply).
    p.key("hand.R", 0.0, (0.33, -0.02, 0.92), "hold")
    p.key("hand.L", 0.0, (0.17, -0.02, 0.92), "hold")
    p.key("ik_hand.R", 0.0, 1.0, "hold")
    p.key("ik_hand.L", 0.0, 1.0, "hold")
    # Head aims at the phone; eyes aim there too (side-eye via glance_x).
    p.key("look_at", 0.0, tuple(gaze), "hold")
    p.key("look", 0.0, 0.85, "hold")
    p.key("gaze_at", 0.0, tuple(gaze), "hold")
    p.key("gaze_w", 0.0, 1.0, "hold")
    p.key("gaze", 0.0, (glance_x, 0.0), "hold")
    if smile_on:
        p.key("squint", 0.0, 0.4, "hold")
        h = p.ch["head"].at(0.0)
        p.key("head", 0.0, (h[0] + 1.5, h[1] + 2.5, h[2]), "hold")
    p.bake()
    return p


def _phone(cols, loc=(0.25, -0.05, 0.9)):
    screen = look.emission("GC_Screen", "#bcd2ff", 2.2)
    return props.phone(cols["PROPS"], "GC_Phone", loc, rot=(55, 0, 0), screen=screen)


def _camera(cols, pos, target, lens=52.0):
    data = bpy.data.cameras.new("GC_Cam")
    data.lens = lens
    data.clip_start, data.clip_end = 0.03, 100.0
    obj = bpy.data.objects.new("GC_Cam", data)
    cols["CAM"].objects.link(obj)
    obj.location = pos
    look.look_at(obj, target)
    bpy.context.scene.camera = obj
    return obj


def _plate_hook():
    """Hook close-up: player checking a buzzing phone. Partial torso/hands/phone
    shot (70mm), NO message cards yet — the chat has not opened. Remotion adds
    the vibration wobble and HNC editorial typography over this movement."""
    sc, cols = _scene("GC_hook")
    _render_setup(sc)
    _room(sc, cols, "en")
    gaze = Vector((0.25, -0.05, 0.9))
    _player(cols, "en", 11, gaze)
    _phone(cols)
    _phonelight(cols)
    _camera(cols, (0.25, -2.3, 1.2), (0.25, 0.1, 0.85), lens=58.0)
    look.finish(sc, glare=0.15, threshold=1.2, vignette=0.16)
    return sc


def _plate_polite(side, seed):
    sc, cols = _scene(f"GC_{side}")
    _render_setup(sc)
    _room(sc, cols, side)
    gaze = Vector((0.25, -0.05, 0.9))
    _player(cols, side, seed, gaze)
    _phone(cols)
    _phonelight(cols)
    # The polite exchange is modern Remotion UI. Keep the filmed plate clean:
    # physical cards do not enter the room until the signature takeover.
    # Tighter 65mm-equivalent framing with subtle DOF feel; EN stays
    # screen-right, HR screen-left via small lateral offsets.
    xoff = 0.12 if side == "en" else -0.12
    _camera(cols, (0.1 + xoff, -2.9, 1.45), (0.2 + xoff, 0.5, 0.95), lens=62.0)
    look.finish(sc, glare=0.15, threshold=1.2, vignette=0.16)
    return sc


def _plate_reaction(side, seed, glance_x=0.0, smile_on=False):
    sc, cols = _scene(f"GC_{side}")
    _render_setup(sc)
    _room(sc, cols, side)
    gaze = Vector((0.25, -0.05, 0.9))
    _player(cols, side, seed, gaze, smile_on=smile_on, glance_x=glance_x)
    _phone(cols)
    _phonelight(cols)
    # Reaction plates also remain card-free. UI hierarchy stays in Remotion,
    # and the character performance remains readable behind it.
    xoff = 0.1 if side == "en" else -0.1
    _camera(cols, (0.05 + xoff, -3.3, 1.5), (0.25 + xoff, 0.4, 1.0), lens=50.0)
    look.finish(sc, glare=0.15, threshold=1.2, vignette=0.16)
    return sc


def _plate_chaos(stage=9):
    sc, cols = _scene("GC_chaos")
    _render_setup(sc, samples=48)
    _room(sc, cols, "en")
    gaze = Vector((0.25, -0.4, 0.9))
    _player(cols, "en", 41, gaze, glance_x=9.0)
    _phone(cols, loc=(0.3, -0.1, 0.95))
    _phonelight(cols, loc=(0.3, -0.45, 1.05))
    # Authored escalation: each stage adds cards to the same deterministic
    # composition (2 -> 4 -> 6 -> 8 -> 9), so the pile grows instead of
    # jumping between unrelated rooms or camera angles.
    acc_r, acc_n = SIDES["hr"]["accent"], SIDES["en"]["accent"]
    specs = [
        ("DELETE THAT", (0.15, -0.9, 1.7), (0, 0, 3), "right", acc_n, 0.95),
        ("easy win.", (0.55, -0.7, 1.5), (0, 0, -10), "right", acc_n, 0.95),
        ("screenshot taken.", (-0.35, -0.5, 1.3), (0, 0, 8), "left", acc_r, 0.95),
        ("saved.", (-0.4, -0.8, 0.75), (0, 0, -14), "left", acc_r, 0.9),
        ("WE WILL COME BACK", (-0.3, 0.3, 1.3), (0, 0, 12), "left", acc_r, 0.9),
        ("mute him", (0.8, 0.0, 1.0), (0, 0, -8), "right", acc_n, 0.85),
        ("talk after full time", (0.3, -1.1, 0.6), (0, 0, 5), "right", acc_n, 0.9),
        ("seen.", (1.0, -1.0, 0.5), (0, 0, 10), "right", acc_n, 0.8),
        ("ADMIN", (0.75, 0.35, 1.85), (0, 0, 6), "right", acc_n, 0.8),
    ]
    C.pile(cols["PROPS"], "GC_Chaos", specs[:stage])
    _camera(cols, (0.0, -3.6, 1.55), (0.1, 0.4, 0.95), lens=52.0)
    look.finish(sc, glare=0.15, threshold=1.2, vignette=0.18)
    return sc


def _plate_takeover_physical():
    """First physical frame continues the navy DELETE THAT card in close-up."""
    sc, cols = _scene("GC_takeover_physical")
    _render_setup(sc)
    _room(sc, cols, "en")
    gaze = Vector((0.25, -0.4, 0.9))
    _player(cols, "en", 41, gaze, glance_x=9.0)
    _phone(cols, loc=(0.3, -0.1, 0.95))
    _phonelight(cols, loc=(0.3, -0.45, 1.05))
    C.make_chat_card(cols["PROPS"], "GC_Takeover", "DELETE THAT", (0.1, -2.2, 0.95), (0, 0, 0),
                     "right", SIDES["en"]["accent"], scale=1.8)
    _camera(cols, (0.0, -3.6, 1.55), (0.1, 0.4, 0.95), lens=52.0)
    look.finish(sc, glare=0.12, threshold=1.2, vignette=0.18)
    return sc


def _plate_final():
    sc, cols = _scene("GC_final")
    _render_setup(sc)
    _room(sc, cols, "hr")
    gaze = Vector((0.3, -0.6, 1.2))
    _player(cols, "hr", 77, gaze)
    _phone(cols)
    _phonelight(cols)
    # Punchline is isolated: one pristine physical card, no buried messages.
    C.make_chat_card(cols["PROPS"], "GC_Final", "SEE YOU AFTER FULL TIME.", (0.2, -1.1, 1.25), (0, 0, 0),
                     "left", SIDES["hr"]["accent"], scale=1.45)
    _camera(cols, (0.15, -3.2, 1.5), (0.2, 0.4, 1.05), lens=52.0)
    look.finish(sc, glare=0.12, threshold=1.2, vignette=0.14)
    return sc


PLATES = {
    "01-hook": _plate_hook,
    "02-polite-en": lambda: _plate_polite("en", 11),
    "02-polite-hr": lambda: _plate_polite("hr", 22),
    "03-easy-win": lambda: _plate_reaction("en", 33, glance_x=7.0),
    "04-screenshot": lambda: _plate_reaction("hr", 44, smile_on=True),
    "05-takeover-physical": _plate_takeover_physical,
    "05-chaos-a": lambda: _plate_chaos(2),
    "05-chaos-b": lambda: _plate_chaos(4),
    "05-chaos-c": lambda: _plate_chaos(6),
    "05-chaos-d": lambda: _plate_chaos(8),
    "05-overwhelm": lambda: _plate_chaos(9),
    "05-chaos": lambda: _plate_chaos(9),
    "06-final-message": _plate_final,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--only", default="")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    only = [s for s in args.only.split(",") if s] or sorted(PLATES)
    for pid in only:
        sc = PLATES[pid]()
        if args.samples != 48 and hasattr(sc.eevee, "taa_render_samples"):
            sc.eevee.taa_render_samples = args.samples  # noqa: override from CLI
        sc.render.filepath = str(out / f"{pid}.png")
        bpy.ops.render.render(write_still=True)
        print(f"plate {pid} -> {sc.render.filepath}")
    print("HNC_RESULT plates ok")


if __name__ == "__main__":
    main()
