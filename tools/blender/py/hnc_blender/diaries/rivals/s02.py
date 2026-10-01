"""S02 — The rooms: meet them, and the first nice things."""
from .room import chair_shot


def S02_SH01(sh):
    chair_shot(sh)


def S02_SH02(sh):
    chair_shot(sh)


def S02_SH03(sh):
    chair_shot(sh)


def S02_SH04(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S02_SH")}
