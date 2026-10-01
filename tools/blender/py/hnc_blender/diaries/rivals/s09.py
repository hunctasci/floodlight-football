"""S09 — The turn."""
from .room import chair_shot


def S09_SH01(sh):
    chair_shot(sh)


def S09_SH02(sh):
    chair_shot(sh)


def S09_SH03(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S09_SH")}
