"""S14_SH01 — Italy #8 catches an imperfect 0–0 in espresso crema."""
from ...cine import look, perform as P, props


def _espresso(col):
    ceramic = look.flat("S14_CupCeramic", "#e8e0d3", rough=.20, coat=.45)
    saucer = props.lathe(col, "S14_Saucer", [(0, 0), (.095, 0), (.12, .012), (.12, .018), (0, .018)], ceramic, loc=(-.18, .70, .77))
    cup = props.lathe(col, "S14_EspressoCup", [(0, 0), (.051, 0), (.057, .018), (.056, .064), (.048, .073), (0, .073)], ceramic, loc=(-.18, .70, .79))
    props.torus(col, "S14_CupHandle", .030, .006, ceramic, loc=(-.117, .70, .832), rot=(90, 0, 0), major=20, minor=8, parent=cup)
    crema = look.flat("S14_Crema", "#b86d32", rough=.43, spec=.18)
    foam = look.flat("S14_CremaFoam", "#e9bb76", rough=.62)
    props.cyl(col, "S14_CremaSurface", .0475, .0025, crema, (-.18, .70, .864), segs=48)
    # Imperfect micro-foam rings: recognisable only at a glance, not typography.
    props.torus(col, "S14_CremaZeroL", .010, .0021, foam, loc=(-.199, .701, .868), rot=(0, 0, 0), major=13, minor=5)
    props.torus(col, "S14_CremaZeroR", .0105, .0019, foam, loc=(-.161, .700, .868), rot=(0, 0, .16), major=12, minor=5)
    props.sphere(col, "S14_CremaDash", .0044, foam, loc=(-.18, .699, .868), scale=(1.25, .43, .30), segs=12, rings=6)
    return cup


def S14_SH01(sh):
    wood = look.flat("S14_Walnut", "#72533b", rough=.43, spec=.30)
    plaster = look.flat("S14_CafePlaster", "#b6aa9b", rough=.88)
    brass = look.flat("S14_Brass", "#9a7541", rough=.30, metal=.72)
    props.plane(sh.cols["SET"], "S14_CafeFloor", (12, 12), look.flat("S14_Floor", "#514a42", rough=.82), (0, 0, 0))
    props.box(sh.cols["SET"], "S14_CafeWall", (6.5, .16, 3.4), plaster, (0, 2.7, 0), bevel=.02)
    props.box(sh.cols["SET"], "S14_Table", (1.15, .78, .055), wood, (0, .15, .72), bevel=.05)
    props.cyl(sh.cols["SET"], "S14_TableStem", .075, .70, brass, (0, .15, .0), segs=20)
    # Tall, soft window shapes make the café feel inhabitable without new-set excess.
    glass = look.window_glass("S14_WindowGlass", reflect=.18, tint="#dce6e3", rough=.05)
    props.box(sh.cols["SET"], "S14_Window", (1.45, .03, 1.72), glass, (-1.75, 2.59, 1.05), bevel=.01)
    _espresso(sh.cols["PROPS"])
    p = sh.person("IT-PLAYER-08", "kit", profile="calm")
    P.stance(p, 0.0, (.33, 1.33, 0), 0.0)
    P.look(p, .10, (-.18, .70, .86), w=.82, dur=.28)
    p.key("neck", 1.36, (-5.0, 0.0, 0.0), "soft")
    P.look(p, 1.37, (.12, -.45, 1.58), w=.55, dur=.34)
    P.smile(p, 1.72, amount=.18, dur=.42, hold=.55, tilt=.35, nod=.0)
    cam = sh.camera(85, fstop=2.8)
    cam.place(0.0, (-.18, -.25, 1.18), (-.18, .70, .865), focus=(-.18, .70, .864))
    cam.place(.62, (-.18, -.25, 1.18), (-.18, .70, .865), focus=(-.18, .70, .864), e="hold")
    cam.place(1.55, (.60, -1.60, 1.30), (.17, .84, 1.38), focus=(.22, .88, 1.38), e="smooth")
    cam.place(sh.dur, (.58, -1.56, 1.31), (.22, .96, 1.48), focus=(.25, 1.00, 1.48), e="smooth")
    cam.handheld("locked", .15)
    look.world(sh.scene, color="#3b3028", strength=.32)
    look.area(sh.cols["LGT"], "S14_WindowKey", (-2.4, -.5, 2.8), (0, .25, .92), (2.0, 2.4), 760, "#e8eff1")
    look.area(sh.cols["LGT"], "S14_WarmPractical", (1.25, 1.4, 2.3), (.25, .25, 1.0), (.45, .45), 165, "#ffc77d")
    sh.scene["hnc_crema_method"] = "actual espresso surface with two irregular micro-foam torus loops and a small dash; no overlay or emissive text"
    sh.finish(glare=.10, threshold=1.22, vignette=.12, dispersion=.00035)


SHOTS = {"S14_SH01": S14_SH01}
