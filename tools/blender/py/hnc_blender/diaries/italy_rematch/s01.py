"""S01 — kitchen coincidence built from physical props and editorial occlusion."""
import bpy
from mathutils import Vector
from ...cine import look, perform as P, props
from ...cine.sets import home


def _kit(sh):
    a = home.kitchen(sh.scene, sh.cols["SET"], sh.cols["LGT"], "morning")
    bpy.context.view_layer.update(); return a


def _cook(sh, a):
    p = sh.person("TR-PLAYER-09", "home", profile="calm")
    P.stance(p, 0, tuple(a["cook"]), 0); P.relax_arms(p, 0); return p


def S01_SH01(sh):
    a = _kit(sh); p = _cook(sh, a); centre = a["pan"].matrix_world.translation + Vector((0,0,.047))
    # Correct EP01 fried-eggs: separate, unscaled whites/yolk domes, positioned on pan interior.
    positions = ((-.035,-.030), (.037,-.027), (-.030,.040), (.040,.037))
    eggs=[]
    for i,(x,y) in enumerate(positions):
        w,yolk=props.egg_fried(sh.cols["PROPS"], f"S01_FriedEgg_{i+1}", tuple(centre+Vector((x,y,.002))), seed=10+i); eggs += [w,yolk]
        if i:
            w.hide_render=yolk.hide_render=True; w.keyframe_insert("hide_render",frame=1); yolk.keyframe_insert("hide_render",frame=1); w.hide_render=yolk.hide_render=False; w.keyframe_insert("hide_render",frame=24); yolk.keyframe_insert("hide_render",frame=24)
    P.look(p, 0, tuple(centre), dur=.01, w=.7); P.glance(p,.55,.20,dur=.12,hold=.18,back=.15,head=.7)
    cam=sh.camera(50,fstop=3.4); cam.place(0, tuple(centre+Vector((.45,-.92,.82))), tuple(centre), focus=centre); cam.place(sh.dur,tuple(centre+Vector((.34,-.76,.67))),tuple(centre),focus=centre,e="linear")
    sh.scene["hnc_event_frame_four_eggs"] = 24; sh.scene["hnc_egg_method"]="EP01 corrected separate fried-white and yolk geometry; hard editorial reveal"
    sh.finish(glare=.06,threshold=1.45)


def _espresso_machine(sh, at):
    m=look.flat("S01_EspressoSteel","#24272b",rough=.25,metal=.78,coat=.45); B=props.box
    B(sh.cols["PROPS"],"S01_EspressoMachine",(.50,.28,.46),m,tuple(at),bevel=.025)
    button=B(sh.cols["PROPS"],"S01_OneEspressoButton",(.07,.015,.05),look.emission("S01_OneButton","#e8d2a1",2.5),tuple(at+Vector((-.12,-.145,.27))),bevel=.006)
    return button


def S01_SH02(sh):
    a=_kit(sh); p=_cook(sh,a); at=a["island"]+Vector((.52,.10,.04)); button=_espresso_machine(sh,at)
    cups=[]
    for i,x in enumerate((-.15,-.05,.05,.15)):
        cup=props.mug(sh.cols["PROPS"],f"S01_EspressoCup_{i+1}",color="#eee7db",loc=tuple(at+Vector((x,-.30,.04))),coffee=True,r=.034,h=.052); cups.append(cup)
        if i:
            cup.hide_render=True; cup.keyframe_insert("hide_render",frame=1); cup.hide_render=False; cup.keyframe_insert("hide_render",frame=14+i*7)
    P.reach(p,.08,"R",tuple(button.matrix_world.translation+Vector((0,-.04,.04))),dur=.20,rot=(-15,0,0)); P.release(p,.38,"R",dur=.15)
    cam=sh.camera(70,fstop=2.8); target=at+Vector((0,-.22,.18)); cam.place(0,tuple(target+Vector((.34,-.82,.28))),tuple(target),focus=target); cam.place(sh.dur,tuple(target+Vector((.28,-.68,.24))),tuple(target),focus=target,e="linear")
    sh.scene["hnc_event_frame_fourth_coffee"] = 35; sh.scene["hnc_coffee_method"]="cups remain physically parked under machine; rhythmic hard reveal behind machine-front occlusion"
    sh.finish(glare=.10,threshold=1.3)

SHOTS={"S01_SH01":S01_SH01,"S01_SH02":S01_SH02}
