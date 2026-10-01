"""S06 — 2009: Brussels, two–nil."""
from .room import chair_shot


def S06_SH01(sh):
    chair_shot(sh)


def S06_SH02(sh):
    chair_shot(sh)


def S06_SH03(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S06_SH")}
