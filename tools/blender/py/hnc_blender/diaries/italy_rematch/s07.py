"""S07_SH01 — controlled stair escape with coincidental 1–4 motifs."""
from mathutils import Vector

from ...cine import look, perform as P
from . import architecture


def _descend(p, info, start=0.0, step_time=0.235):
    """Fast authored descent: alternating feet land on actual tread heights."""
    low_y, run, rise = info["low_y"], info["run"], info["rise"]
    top = info["steps"] - 1
    start_y, start_z = low_y + top * run, top * rise
    P.stance(p, start, (0.0, start_y, start_z), face=0.0, width=0.90)
    feet = {
        side: Vector(p.ch[f"foot.{side}"].at(start))
        for side in ("L", "R")
    }
    for k in range(1, info["steps"]):
        side = "L" if k % 2 else "R"
        other = "R" if side == "L" else "L"
        t0, t1 = start + (k - 1) * step_time, start + k * step_time
        tread = top - k
        y, z = low_y + tread * run, tread * rise
        x = p.dims["foot_x"][side] * 0.90
        target = Vector((x, y, z + p.dims["ankle"]))
        p.hold(f"foot.{side}", t0)
        mid = feet[side].lerp(target, 0.55)
        mid.z += 0.10
        p.key(f"foot.{side}", (t0 + t1) * 0.5, tuple(mid), "smooth")
        p.key(f"foot.{side}", t1, tuple(target), "out")
        p.key(f"foot_rot.{side}", t1, ((6.0 if side == "L" else -6.0), -3.0), "out")
        feet[side] = target
        # Root drops onto each tread, with a small controlled forward pitch.
        p.key("pos", t1, (0.0, y + 0.05, z), "linear")
        p.key("hips", (t0 + t1) * 0.5, ((0.015 if other == "L" else -0.015), 0.0, 0.018), "smooth")
        p.key("hips", t1, (0.0, 0.0, -0.012), "out")
        p.key("hips_rot", t1, (8.0, 0.0, 3.0 if side == "L" else -3.0), "smooth")
        P.arms(p, t1, other, 24.0, 9.0, 0.0, 58.0)
        P.arms(p, t1, side, -14.0, 8.0, 0.0, 42.0)
    end = start + (info["steps"] - 1) * step_time
    # Two quick landing steps carry him clear of the flight without foot slide.
    p.key("pos", end + 0.30, (0.0, low_y - 0.34, 0.0), "linear")
    p.key("pos", end + 0.62, (0.0, low_y - 0.92, 0.0), "linear")
    for side, sign in (("L", 1), ("R", -1)):
        p.key(f"foot.{side}", end + 0.31 + (0.12 if side == "R" else 0.0),
              (p.dims["foot_x"][side] * 0.9, low_y - 0.38, p.dims["ankle"] + 0.08), "smooth")
        p.key(f"foot.{side}", end + 0.53 + (0.12 if side == "R" else 0.0),
              (p.dims["foot_x"][side] * 0.9, low_y - 0.86, p.dims["ankle"]), "out")
        p.key(f"foot_rot.{side}", end + 0.55, (sign * 6.0, 0.0), "out")
    return end + 0.62


def S07_SH01(sh):
    info = architecture.shared(sh, "stairs")
    p = sh.person("TR-PLAYER-09", "home", profile="sport")
    _descend(p, info)
    # He notices the pattern without stopping or turning the beat into a scare.
    P.glance(p, 0.72, -0.30, dur=0.12, hold=0.18, back=0.14, head=-1.0)
    P.glance(p, 1.52, 0.26, dur=0.11, hold=0.14, back=0.12, head=0.7)

    # A broad source from the lower landing is motivated by the stairwell door
    # and keeps his face/kit readable while the cooler practicals shape walls.
    look.area(sh.cols["LGT"], "ARCH_StairLowerFill", (0.0, -3.35, 2.35),
              (0.0, -0.10, 1.20), size=(1.7, 1.2), power=360,
              color="#d9e4e2", spread=120.0)

    # Descending-backward coverage: camera remains ahead of him and eases down
    # with the flight. Wide, but the move is controlled and spatially legible.
    cam = sh.camera(18, fstop=5.0)
    cam.place(0.0, (-0.30, -3.38, 1.24), (0.02, 0.85, 1.70), focus=(0.0, 0.95, 1.72))
    cam.place(sh.dur, (-0.24, -4.25, 0.88), (0.02, -1.28, 0.92), focus=(0.0, -1.20, 0.95))
    cam.handheld("follow", 0.30)
    sh.scene["hnc_s07_motifs"] = [
        "landing marker 14",
        "one structural post plus four railing balusters",
        "emergency sign 1 4",
        "service-door 1 with four horizontal bars",
    ]
    sh.scene["hnc_s07_contact"] = "nine authored tread landings at 0.18m rise"
    sh.keep_in_frame(p)
    sh.finish(glare=0.05, threshold=1.55, vignette=0.13, dispersion=0.0004)


SHOTS = {"S07_SH01": S07_SH01}
