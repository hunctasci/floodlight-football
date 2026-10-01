"""S08 — Who's winning: the fastest cross-cut."""
from .room import chair_shot


def S08_SH01(sh):
    chair_shot(sh)


def S08_SH02(sh):
    chair_shot(sh)


def S08_SH03(sh):
    chair_shot(sh)


def S08_SH04(sh):
    chair_shot(sh)


def S08_SH05(sh):
    chair_shot(sh)


def S08_SH06(sh):
    chair_shot(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S08_SH")}
