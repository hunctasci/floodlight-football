"""EP01 — 48 Hours Before Belgium. Shot builders by scene module."""
from . import s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11

SHOTS = {}
for _m in (s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11):
    SHOTS.update(_m.SHOTS)
