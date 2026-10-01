"""S04 — 1997: Istanbul, three–one."""
from .room import chair_shot


def S04_SH01(sh):
    chair_shot(sh)


def S04_SH02(sh):
    chair_shot(sh)


def S04_SH03(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S04_SH")}
