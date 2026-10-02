"""Physical chat cards: the reusable DIGITAL CHAT -> PHYSICAL CHAOS helper.

Same visual grammar as the Remotion GroupChatOverlay bubbles (white card for
the left/HR side, deep-navy card for the right/EN side, neutral dark card for
centred system messages), so the hard/wipe transition from screen-space
message to Blender-world object feels continuous. Foreground cards carry real
readable text (Blender text objects); background cards reuse the same builder
with shorter/abstracted copy so the pile stays cheap. Deterministic: every
placement is authored, never random.

V2 grammar: thin matte slabs (3 cm depth), small bevel highlights, NO
full-height side rails or debug-looking edge blocks. The only accent is a slim
ticket-stub strip along the card's bottom edge (sender colour), which also
sets up the match-ticket CTA flip that ends every episode.
"""
import bpy
from pathlib import Path

from ..cine import look, props
from ..cine.look import tag

# Remotion-side bubble grammar, matched in 3D (see GroupChatOverlay BUBBLE).
LEFT_BG = "#ffffff"
RIGHT_BG = "#1e3a8a"
CENTER_BG = "#2a3348"
LEFT_INK = "#101b31"
RIGHT_INK = "#ffffff"
CENTER_INK = "#f8efdb"

CARD_W, CARD_H = 0.42, 0.24
CARD_DEPTH = 0.03  # ~3 cm physical slab
STUB_H = 0.032  # ticket-stub accent strip height


def _text(col, name, body, width, ink):
    cur = tag(bpy.data.curves.new(f"{name}.Font", type="FONT"))
    cur.body = body
    font_path = Path(__file__).resolve().parents[5] / "packages/reels/public/generated/diaries/fonts/BarlowCondensed-SemiBold.ttf"
    if font_path.exists():
        cur.font = bpy.data.fonts.load(str(font_path), check_existing=True)
    cur.size = 0.078
    cur.space_character = 1.08
    cur.align_x = "CENTER"
    cur.align_y = "CENTER"
    # Callers keep copy short enough to fit the card; no auto-wrap.
    o = tag(bpy.data.objects.new(name, cur))
    col.objects.link(o)
    # Unlit ink keeps the country contrast intact under the lounge key light.
    m = look.emission(f"{name}.Ink", ink, strength=1.0)
    if o.data.materials:
        o.data.materials[0] = m
    else:
        o.data.materials.append(m)
    s = min(1.0, width / max(0.2, len(body) * 0.033))
    o.scale = (s, s, s)
    return o


def make_chat_card(col, name, text, loc, rot=(0, 0, 0), side="left", accent="#c8102e", scale=1.0):
    """One physical message card: thin matte slab + stub strip + readable text.

    ``side``: 'left' (white card, dark ink), 'right' (navy card, white ink),
    or 'center' (neutral dark card for system messages). The card is an
    upright slab (wide X, 3 cm Y, tall Z) facing the camera side (-Y) by
    default; ``rot`` spins it (degrees, usually about Z) for authored pile
    angles. Soft rough plastic/paper/composite — never glossy toy plastic.
    """
    if side == "right":
        bg, ink = RIGHT_BG, RIGHT_INK
    elif side == "center":
        bg, ink = CENTER_BG, CENTER_INK
    else:
        bg, ink = LEFT_BG, LEFT_INK
    w, h = CARD_W * scale, CARD_H * scale
    card = props.box(col, name, (w, CARD_DEPTH, h),
                     look.flat(f"{name}.Card", bg, rough=0.85), loc, rot, bevel=0.006)
    # Ticket-stub accent strip along the bottom edge (sender colour). The only
    # accent on the card; doubles as the hinge language for the CTA flip.
    stub = props.box(col, f"{name}.Stub", (w, CARD_DEPTH + 0.002, STUB_H * scale),
                     look.flat(f"{name}.Accent", accent, rough=0.8), (0, 0, 0), parent=card)
    stub.location = (0.0, 0.0, STUB_H * scale / 2)
    # Text rides just off the card face, parented so piles move as one.
    # Font curves face +Z; tipping 90 deg about X faces the -Y camera side.
    import math as _math
    t = _text(col, f"{name}.Text", text, w * 0.92, ink)
    t.parent = card
    t.location = (0.0, -(CARD_DEPTH / 2 + 0.003), h / 2 + STUB_H * scale)
    t.rotation_euler = (_math.radians(90.0), 0.0, 0.0)
    return card


def pile(col, prefix, specs):
    """Authored pile: ``specs`` = [(text, loc, rot, side, accent, scale)]."""
    out = []
    for i, (text, loc, rot, side, accent, scale) in enumerate(specs):
        out.append(make_chat_card(col, f"{prefix}_Card{i:02d}", text, loc, rot, side, accent, scale))
    return out
