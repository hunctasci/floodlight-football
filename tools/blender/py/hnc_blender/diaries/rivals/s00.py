"""S00 — The opener: football from frame 0. Kinetic bilingual stats ride over real match-world
shots (reused EP01 builders: the stadium crowd, the strike, the net; and tonight's tunnel)."""
from ..ep01 import s06 as ep01_s06
from ..ep01 import s10 as ep01_s10
from . import s10


def S00_SH01(sh):
    """The stadium: supporters behind the barrier, phone flashes (BELGIUM vs TÜRKİYE)."""
    ep01_s10.S10_SH08(sh)


def S00_SH02(sh):
    """The strike: plant, hips, contact (69 YEARS · 11 MATCHES)."""
    ep01_s06.S06_SH08(sh)


def S00_SH03(sh):
    """The net bulges (3 WINS EACH · 5 DRAWS)."""
    ep01_s06.S06_SH09(sh)


def S00_SH05(sh):
    """The two of them, level, walking to the light (…and one night in Brussels nobody forgot)."""
    s10.S10_SH01(sh)


SHOTS = {k: v for k, v in globals().items() if k.startswith("S00_SH")}
