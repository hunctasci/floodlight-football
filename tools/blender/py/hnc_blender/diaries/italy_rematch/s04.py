"""S04 — a single lateral walk through accumulating, unbranded 14 motifs."""
from mathutils import Vector
from ...cine import look, perform as P, props

def _street(sh):
    c=sh.cols; ground=look.pbr("S04_Pavement","asphalt_02",scale=.45,tint="#888780")
    props.plane(c["SET"],"S04_Pavement",(18,8),ground,(0,0,0)); props.box(c["SET"],"S04_Facade",(16,.35,4.5),look.pbr("S04_Plaster","painted_plaster_wall",scale=.35,tint="#ddd6ca"),(-1,3.3,0))
    look.world(sh.scene,hdri="urban_street_04",hdri_strength=1.0,rot_deg=250); look.sun(c["LGT"],"S04_Sun",(48,0,-28),power=3.0,color="#f6f1e6",angle=1.6); look.area(c["LGT"],"S04_Sky",(0,-5,3),(0,1,1),(7,3),600,"#dfe8f4")
def _num(sh,name,text,loc,size=.30):
    # scores are physical plaques / vehicle paint, never graphics overlays.
    import bpy
    m=look.flat(f"{name}Mat","#263238",rough=.55); cu=bpy.data.curves.new(name,"FONT"); cu.body=text;cu.align_x="CENTER";cu.align_y="CENTER";cu.size=size;cu.extrude=.01
    o=bpy.data.objects.new(name,cu);sh.cols["PROPS"].objects.link(o);o.location=loc;o.rotation_euler=(1.5708,0,0);o.data.materials.append(m);return o
def S04_SH01(sh):
    _street(sh); c=sh.cols
    # Ordered parallax: curb parking marker, unbranded city vehicle, doorway plaque, courier load.
    props.box(c["PROPS"],"S04_ParkingSign",(.08,.06,.55),look.flat("S04_Sign","#e9ece8",rough=.5),(-2.3,1.1,.2),bevel=.01); _num(sh,"S04_Parking14","14",(-2.3,1.06,.55),.22)
    props.box(c["PROPS"],"S04_GenericBus",(2.0,.65,1.05),look.flat("S04_BusPaint","#6c7880",rough=.35,metal=.15),(.3,2.0,.25),bevel=.04); _num(sh,"S04_Bus14","14",(.3,1.66,.98),.26)
    props.box(c["PROPS"],"S04_Door",(.75,.05,1.85),look.flat("S04_DoorMat","#44505a",rough=.45), (2.4,3.05,.05)); _num(sh,"S04_Door14","14",(2.4,3.00,1.75),.20)
    courier=sh.person("TR-SUPPORTER-ELDER-01","home",profile="calm"); P.stance(courier,0,(4.0,1.8,0),face=180,width=.92)
    for i in range(4): props.box(c["PROPS"],f"S04_CourierBox{i+1}",(.30,.22,.22),look.flat("S04_Cardboard","#a87748",rough=.8),(3.68+(i%2)*.32,1.45,.15+(i//2)*.24),bevel=.008)
    props.box(c["PROPS"],"S04_CourierOneBag",(.22,.12,.30),look.fabric("S04_Bag","#394d5a",rough=.8),(4.34,1.45,.1),bevel=.04)
    p=sh.person("TR-PLAYER-09","home",profile="calm"); P.stance(p,0,(-3.1,-.1,0),face=-90,width=.92); P.walk(p,0,[(3.2,-.1)],stride=.57,cadence=1.85,style="casual"); P.glance(p,1.48,.15,dur=.12,hold=.12,back=.14,head=.5)
    cam=sh.camera(35,fstop=4.0); cam.place(0,(-3.0,-4.1,1.38),(-1.3,.1,1.12),focus=(-1.3,0,1.1)); cam.place(sh.dur,(2.0,-4.1,1.40),(1.0,.35,1.15),focus=(1.0,.3,1.1),e="linear"); cam.handheld("observational",.25)
    sh.scene["hnc_event_frames"]={"parking_14":5,"vehicle_14":24,"doorway_14":43,"courier_4_boxes_1_bag":61}; sh.scene["hnc_street_camera"]="single 35mm lateral tracking move with ordered foreground/midground motifs"
    sh.finish(glare=.03,threshold=1.6,vignette=.08)
SHOTS={"S04_SH01":S04_SH01}
