"""S07 — 2010: Istanbul, 78th minute."""
from .room import chair_shot


def S07_SH01(sh):
    chair_shot(sh)


def S07_SH03(sh):
    chair_shot(sh)


def S07_SH04(sh):
    chair_shot(sh)


def S07_SH05(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S07_SH")}
