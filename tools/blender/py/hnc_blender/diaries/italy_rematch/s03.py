"""S03 — rapid, grounded car-display discoveries."""
import bpy
from mathutils import Vector
from ...cine import look, perform as P, props
from ...cine.sets import car

def _label(sh,name,text,loc,size=.06):
    # Physical emissive label plane, aligned with the pre-existing dashboard surfaces.
    mat=look.emission(f"{name}_Mat","#d8ecff",2.0)
    cu=bpy.data.curves.new(name,"FONT"); cu.body=text; cu.align_x="CENTER"; cu.align_y="CENTER"; cu.size=size; cu.extrude=.001
    ob=bpy.data.objects.new(name,cu); sh.cols["PROPS"].objects.link(ob); ob.location=loc; ob.rotation_euler=(1.257,0,0); ob.data.materials.append(mat); return ob

def S03_SH01(sh):
    a=car.build_interior(sh.cols["SET"],"day",passenger=False); car.moving_world(sh.scene,sh.cols["SET"],sh.frames,sh.fps,"day",speed=8,seed=14); car.day_rig(sh.scene,sh.cols["LGT"],a)
    p=sh.person("TR-PLAYER-09","home",profile="calm"); P.sit(p,0,tuple(a["driver"]),face=0,seat_h=.30); P.look(p,0,(a["driver"].x,-10,1.2),dur=.01,w=.7)
    dash=_label(sh,"S03_Dashboard104","1:04",(a["wheel"].x,-.805,.875),.065); radio=_label(sh,"S03_Radio1041","104.1",(0,-.815,.735),.052); trip=_label(sh,"S03_Trip14km","TRIP  14 km",(a["wheel"].x,-.825,.805),.040)
    # Three concise switch gestures: off states are hard visibility changes, preserving the edit rhythm.
    for ob,frame in ((dash,17),(radio,36),(trip,54)):
        ob.keyframe_insert("hide_render",frame=1); ob.hide_render=True; ob.keyframe_insert("hide_render",frame=frame)
    P.reach(p,.32,"R",tuple(a["wheel"]+Vector((-.02,.03,-.10))),dur=.17); P.reach(p,.92,"R",tuple(a["knob"].matrix_world.translation+Vector((0,.02,.03))),dur=.16); P.reach(p,1.50,"R",tuple(a["wheel"]+Vector((.08,.02,-.12))),dur=.16)
    cam=sh.camera(35,fstop=3.4); cam.place(0,(-.55,.34,1.42),(.22,-.62,.92),focus=(.22,-.75,.85)); cam.place(sh.dur,(-.44,.22,1.40),(.16,-.66,.85),focus=(.16,-.72,.84),e="linear")
    sh.scene["hnc_event_frames"]={"dashboard_104":1,"radio_1041":22,"trip_14km":42}; sh.scene["hnc_car_display_method"]="physical font labels on canonical dashboard/radio surfaces; rapid insert-grade reframing and dismiss gestures"
    sh.finish(glare=.05,threshold=1.5,vignette=.1)
SHOTS={"S03_SH01":S03_SH01}
