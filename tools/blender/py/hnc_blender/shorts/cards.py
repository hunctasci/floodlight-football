"""Physical chat cards: the reusable DIGITAL CHAT -> PHYSICAL CHAOS helper.

Same visual grammar as the Remotion GroupChatOverlay bubbles (white card for
the left/HR side, deep-navy card for the right/EN side, accent edge), so the
hard/wipe transition from screen-space message to Blender-world object feels
continuous. Foreground cards carry real readable text (Blender text objects);
background cards reuse the same builder with shorter/abstracted copy so the
pile stays cheap. Deterministic: every placement is authored, never random.
"""
import bpy

from ..cine import look, props
from ..cine.look import tag

# Remotion-side bubble grammar, matched in 3D.
LEFT_BG = "#f4f2ec"
RIGHT_BG = "#1e3a8a"
LEFT_INK = "#101b31"
RIGHT_INK = "#ffffff"

CARD_W, CARD_H = 0.42, 0.24


def _text(col, name, body, width, ink):
    cur = tag(bpy.data.curves.new(f"{name}.Font", type="FONT"))
    cur.body = body
    cur.size = 0.048
    cur.align_x = "CENTER"
    cur.align_y = "CENTER"
    # Callers keep copy short enough to fit the card; no auto-wrap.
    o = tag(bpy.data.objects.new(name, cur))
    col.objects.link(o)
    m = look.flat(f"{name}.Ink", ink, rough=0.7)
    if o.data.materials:
        o.data.materials[0] = m
    else:
        o.data.materials.append(m)
    s = min(1.0, width / max(0.2, len(body) * 0.027))
    o.scale = (s, s, s)
    return o


def make_chat_card(col, name, text, loc, rot=(0, 0, 0), side="left", accent="#c8102e", scale=1.0):
    """One physical message card: coloured block + accent edge + readable text.

    ``side``: 'left' (white card, dark ink) or 'right' (navy card, white ink).
    The card is an upright block (wide X, thin Y, tall Z) facing the camera
    side (-Y) by default; ``rot`` spins it (degrees, usually about Z) for
    authored pile angles.
    """
    bg = LEFT_BG if side == "left" else RIGHT_BG
    ink = LEFT_INK if side == "left" else RIGHT_INK
    card = props.box(col, name, (CARD_W * scale, 0.012, CARD_H * scale),
                     look.flat(f"{name}.Card", bg, rough=0.55), loc, rot, bevel=0.008)
    # Accent edge on the sender side (matches the Remotion sender dot).
    ax = -CARD_W * scale / 2 if side == "left" else CARD_W * scale / 2
    edge = props.box(col, f"{name}.Edge", (0.02 * scale, 0.014, CARD_H * scale),
                     look.flat(f"{name}.Accent", accent, rough=0.5), (0, 0, 0), parent=card)
    edge.location = (ax, 0.0, CARD_H * scale / 2)
    # Text rides just off the card face, parented so piles move as one.
    # Font curves face +Z; tipping 90 deg about X faces the -Y camera side.
    import math as _math
    t = _text(col, f"{name}.Text", text, CARD_W * scale, ink)
    t.parent = card
    t.location = (0.0, -0.012, CARD_H * scale / 2)
    t.rotation_euler = (_math.radians(90.0), 0.0, 0.0)
    return card


def pile(col, prefix, specs):
    """Authored pile: ``specs`` = [(text, loc, rot, side, accent, scale)]."""
    out = []
    for i, (text, loc, rot, side, accent, scale) in enumerate(specs):
        out.append(make_chat_card(col, f"{prefix}_Card{i:02d}", text, loc, rot, side, accent, scale))
    return out
