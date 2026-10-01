"""S15_SH01 — parallel rivals walk toward the same pitch light."""
from ...cine import perform as P
from ...cine.camera import frame
from ...cine.sets import tunnel


def S15_SH01(sh):
    env = tunnel.tunnel(sh.scene, sh.cols["SET"], sh.cols["LGT"], lit=True)
    tr = sh.person("TR-PLAYER-09", "kit", profile="sport")
    it = sh.person("IT-PLAYER-08", "kit", profile="sport")
    P.stance(tr, 0.0, (-.78, 2.0, 0), 180.0)
    P.stance(it, 0.0, (.78, 2.0, 0), 180.0)
    P.walk(tr, .03, [(-.78, 5.8), (-.78, 10.0), (-.78, 15.8)], stride=.61, cadence=2.5, lead="L", style="focused", end_face=180.0)
    P.walk(it, .03, [(.78, 5.8), (.78, 10.0), (.78, 15.8)], stride=.61, cadence=2.5, lead="R", style="focused", end_face=180.0)
    cam = sh.camera(35, fstop=4.5)
    cam.place(0.0, (0, -.85, 1.05), (0, 9.6, 1.34), focus=(0, 7.5, 1.2))
    cam.place(sh.dur, (0, .10, 1.10), (0, 12.4, 1.40), focus=(0, 12.6, 1.25), e="smooth")
    cam.handheld("locked", .22)
    sh.scene["hnc_tunnel_staging"] = "TR #9 and IT #8 occupy mirrored lanes and walk parallel toward the shared pitch entrance; no confrontation"
    sh.scene["hnc_tunnel_camera"] = "35mm low-medium centered push, retaining tunnel depth and readable kits"
    sh.finish(glare=.16, threshold=1.36, vignette=.16, dispersion=.0004)


SHOTS = {"S15_SH01": S15_SH01}
