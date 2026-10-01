"""One Goal Between Us — the Belgium–Türkiye rivalry, argued in two rooms. Shot builders by scene module."""
from . import s00, s02, s03, s04, s05, s06, s07, s08, s09, s10

SHOTS = {}
for _m in (s00, s02, s03, s04, s05, s06, s07, s08, s09, s10,):
    SHOTS.update(_m.SHOTS)
