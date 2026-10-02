"""HNC Lunar Away Day: isolated EEVEE shot production, canonical cast + ball.

Build/inspect stills first, then preview, then final. No other episode files
are written. Frames are authored at 60 fps; --step only speeds preview QA.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from hnc_blender import interchange, inspect_parity
from hnc_blender.cine import cast, look, props, rig
from hnc_blender.cine.perform import Performer, stance, walk, relax_arms

ROOT = Path(__file__).resolve().parents[5]
ASSETS = ROOT / 'social/shorts/first-touch-on-the-moon/assets'
OUT = ROOT / 'social/output/shorts/first-touch-on-the-moon'
SHOTS = [('01-space',5.6),('02-cabin',2.7),('03-prep',2.4),('04-approach',4.0),
         ('05-airlock',2.4),('06-first-step',1.9),('07-lunar-wide',8.6),
         ('08-build',3.5),('09-play',2.3),('10-first-touch',1.7),
         ('11-clean',1.2),('12-cta',2.3)]


def key(o, prop, values):
    for t,v in values:
        setattr(o,prop,v)
        o.keyframe_insert(data_path=prop,frame=round(t*60)+1)


def fresh(name, scale, samples):
    look._cache.clear()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    sc=bpy.context.scene
    sc.name=name
    col=bpy.data.collections.new('LUNAR')
    sc.collection.children.link(col)
    sc.render.engine='BLENDER_EEVEE'
    sc.eevee.taa_render_samples=samples
    sc.render.resolution_x,sc.render.resolution_y=1080,1920
    sc.render.resolution_percentage=round(scale*100)
    sc.render.fps=60
    sc.render.image_settings.file_format='PNG'
    sc.render.image_settings.color_mode='RGB'
    sc.render.film_transparent=False
    sc.view_settings.view_transform='AgX'
    sc.view_settings.look='AgX - Medium High Contrast'
    w=look.world(sc,color='#b4afa4',strength=.14)
    nt=w.node_tree
    black=nt.nodes.new('ShaderNodeBackground');black.inputs['Strength'].default_value=0
    lp=nt.nodes.new('ShaderNodeLightPath');mix=nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'],mix.inputs[0])
    nt.links.new(nt.nodes['Background'].outputs[0],mix.inputs[1])
    nt.links.new(black.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],nt.nodes['World Output'].inputs[0])
    mats={
        'cream':look.fabric('Lunar pressure textile','#e9e4d7',rough=.72,sheen=.2,noise=.012),
        'navy':look.flat('HNC technical navy','#111e31',rough=.38,metal=.18),
        'gold':look.flat('Aged gold hardware','#a8874d',rough=.36,metal=.72),
        'metal':look.flat('Brushed titanium','#777a7c',rough=.4,metal=.75),
        'black':look.flat('Graphite elastomer','#101112',rough=.8),
        'lamp':look.emission('Warm practical','#fff0cc',3),
    }
    return sc,col,mats


def camera(sc,col,pos,target,lens=40,end=None):
    d=bpy.data.cameras.new('Lunar cinematography')
    d.lens=lens
    d.clip_end=1000
    d.clip_start=.025
    o=bpy.data.objects.new('Lunar camera',d)
    col.objects.link(o)
    o.location=pos
    look.look_at(o,target)
    sc.camera=o
    if end:
        key(o,'location',[(0,pos),(sc.frame_end/60,end)])
    return o


def rod(col,name,a,b,r,mat,parent=None):
    a,b=Vector(a),Vector(b)
    o=props.cyl(col,name,r,(b-a).length,mat,a,parent=parent)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o


def bone_parent(o,p,bone):
    bpy.context.view_layer.update()
    mw=o.matrix_world.copy()
    o.parent=p.rig.arm
    o.parent_type='BONE'
    o.parent_bone=bone
    o.matrix_world=mw


def physical_label(col,body,loc,size,mat):
    d=bpy.data.curves.new('Woven mission label','FONT');d.body=body;d.size=size;d.align_x='CENTER'
    o=bpy.data.objects.new('Physical HNC mission label',d);col.objects.link(o)
    o.location=loc;o.rotation_euler=(math.pi/2,0,0);d.materials.append(mat)
    return o


def player(sc,col,m,n,frames,pos=(0,0,0),face=0):
    aid=f'hnc-lunar-0{n}'
    rec=next(a for a in json.loads((ASSETS/'cast-manifest.json').read_text())['assets'] if a['assetId']==aid)
    root=interchange.import_hnc_glb(ASSETS/f'{aid}.glb',col)
    report=inspect_parity.inspect_asset(rec,sc,root)
    if not report['pass']:
        raise RuntimeError(f'Lunar {n} canonical parity: {report["failures"][:2]}')
    p=Performer(rig.build_rig(root,col,tag=f'LUNAR0{n}'),fps=60,frames=frames,seed=81+n,profile='still')
    p.rig.arm['hnc_person']=f'HNC-LUNAR-0{n}'
    parts=p.rig.parts
    for name,o in parts.items():
        if name.startswith(('arm','leg')) and not name.endswith('boot'):
            o.data.materials.clear();o.data.materials.append(m['cream'])
        if name.endswith('boot'):
            o.data.materials.clear();o.data.materials.append(m['navy'])
    for name in ('stripe','number'):
        if name in parts: parts[name].hide_render=True
    parts['shorts'].data.materials.clear();parts['shorts'].data.materials.append(m['cream'])
    parts['hair'].hide_render=True
    # Wardrobe accessories ride the canonical rig; body/head meshes stay intact.
    for x in (-.28,.28):
        o=props.box(col,'Navy pressure harness',(.09,.04,.67),m['navy'],(x,-.485,.72),bevel=.018)
        bone_parent(o,p,'spine')
    o=props.box(col,'Mission chest panel',(.36,.07,.27),m['navy'],(0,-.50,1.08),bevel=.025)
    bone_parent(o,p,'spine')
    o=physical_label(col,f'HNC / 0{n}',(0,-.576,1.29),.052,m['cream']);bone_parent(o,p,'spine')
    for x in (-.12,0,.12):
        o=props.cyl(col,'Gold pressure port',.033,.03,m['gold'],(x,-.555,1.16),rot=(90,0,0))
        bone_parent(o,p,'spine')
    o=props.box(col,'Life support pack',(.60,.28,.68),m['navy'],(0,.43,.79),bevel=.065)
    bone_parent(o,p,'spine')
    for z in (.88,1.08,1.28):
        o=props.box(col,'Pack titanium rib',(.56,.025,.025),m['metal'],(0,.721,z),bevel=.008)
        bone_parent(o,p,'spine')
    hz=p.dims['head'][2]
    # Rear shell is a half-sphere, leaving the canonical face open behind glass.
    verts=[];faces=[]
    for j in range(17):
        th=math.pi*j/16
        for i in range(25):
            ph=math.pi*i/24
            verts.append((.405*math.sin(th)*math.cos(ph),.405*math.sin(th)*math.sin(ph),hz+.405*math.cos(th)))
    for j in range(16):
        for i in range(24):
            a=j*25+i;faces.append((a,a+1,a+26,a+25))
    me=bpy.data.meshes.new('HNC helmet rear shell');me.from_pydata(verts,[],faces)
    o=props.obj(col,'HNC helmet shell',me,m['cream'],smooth=True);bone_parent(o,p,'head')
    o=props.torus(col,'Gold visor seal',.405,.018,m['gold'],(0,0,hz),rot=(90,0,0),major=64)
    bone_parent(o,p,'head')
    visor=look.flat('Lightly reflective clear visor','#cad4d8',rough=.09,metal=.18,coat=.5,alpha=.075)
    o=props.sphere(col,'Clear visor',.409,visor,(0,0,hz),segs=48,rings=24)
    bone_parent(o,p,'head')
    o=props.torus(col,'Pressure neck seal',.29,.05,m['navy'],(0,0,hz-.32),major=48)
    bone_parent(o,p,'neck')
    # Cuffs and gloves: physical suit hardware, no agency marks.
    for s in 'LR':
        x=p.dims['hand_x'][s]
        o=props.sphere(col,'Lunar glove',.105,m['cream'],(x,0,.77),scale=(.9,1,1.35))
        bone_parent(o,p,f'hand.{s}')
        o=props.torus(col,'Gold glove lock',.098,.018,m['gold'],(x,0,.86),major=32)
        bone_parent(o,p,f'forearm.{s}')
        x=p.dims['foot_x'][s]
        o=props.box(col,'Football boot pressure gaiter',(.205,.30,.16),m['navy'],(x,-.08,.05),bevel=.04)
        bone_parent(o,p,f'foot.{s}')
        for z in (.08,.13):
            o=props.box(col,'Gold boot fastening',(.19,.025,.022),m['gold'],(x,-.224,z),bevel=.008)
            bone_parent(o,p,f'foot.{s}')
    stance(p,0,pos,face=face,width=1.13)
    relax_arms(p,0)
    return p


def ball(sc,col,loc):
    o=cast.prop_identity(sc,col,'hnc-ball')
    o.scale=(.8,.8,.8)
    o.location=loc
    return o


CRATERS=[(-18,16,7,1.0),(14,22,10,1.3),(-32,48,16,2.0),(39,54,19,2.5),(-5,75,22,3.3),(5,9,2.4,.23),(-5,-5,3.3,.75),(0,-9,3.8,.8)]


def height(x,y):
    h=.14*noise.noise_vector(Vector((x*.15,y*.15,3)))[0]
    h+=.035*noise.noise_vector(Vector((x*1.1,y*1.1,8)))[1]
    h+=math.exp(-((y-62)/24)**2)*(2.0+2.2*noise.noise(Vector((x*.045,3.7,4))))
    for cx,cy,r,d in CRATERS:
        q=math.hypot(x-cx,y-cy)/r
        h+=d*(.24*math.exp(-((q-1)/.12)**2)-.65*math.exp(-(q/.72)**4))
    # Keep the tiny training area physically flat enough for planted feet.
    fade=min(1,max(0,(math.hypot(x,y)-3)/5))
    return h*fade


def terrain(col):
    m=look.flat('Lunar basalt regolith','#72716c',rough=.96)
    nt=m.node_tree;n=nt.nodes;b=n['Principled BSDF']
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=110
    tex.inputs['Detail'].default_value=3.5
    coord=n.new('ShaderNodeNewGeometry');nt.links.new(coord.outputs['Position'],tex.inputs['Vector'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.36;bump.inputs['Distance'].default_value=.018
    nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],b.inputs['Normal'])
    broad=n.new('ShaderNodeTexNoise');broad.inputs['Scale'].default_value=.65
    nt.links.new(coord.outputs['Position'],broad.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=look.lin('#4d4e4a');ramp.color_ramp.elements[1].color=look.lin('#92918b')
    nt.links.new(broad.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],b.inputs['Base Color'])
    N=180;verts=[];faces=[]
    for j in range(N+1):
        y=-35+j/N*180
        for i in range(N+1):
            x=-90+i/N*180;verts.append((x,y,height(x,y)))
    for j in range(N):
        for i in range(N):
            a=j*(N+1)+i;faces.append((a,a+1,a+N+2,a+N+1))
    me=bpy.data.meshes.new('Cratered lunar terrain');me.from_pydata(verts,[],faces);me.update()
    props.obj(col,'Lunar terrain 180m',me,m,smooth=True)
    rng=random.Random(104)
    rockmat=look.flat('Fractured basalt','#585a57',rough=.95)
    for i in range(100):
        x=rng.uniform(-24,24);y=rng.uniform(-12,65)
        if math.hypot(x,y)<2.7:continue
        r=rng.uniform(.06,.40)*(1.7 if y>16 else 1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=(x,y,height(x,y)+r*.23))
        o=bpy.context.object;o.name='Angular lunar ejecta'
        for v in o.data.vertices:v.co*=rng.uniform(.72,1.25)
        o.scale=(1.4,1,.68);o.rotation_euler=(rng.random(),rng.random(),rng.random()*6)
        o.data.materials.append(rockmat)
    return m


def sunrise(col,fill=True):
    sun=look.sun(col,'Hard lunar sunrise',(84,0,-24),power=4.0,color='#ffe4b2',angle=.28)
    # Direction derives from a low horizon point; no atmospheric volume/fog.
    sun.rotation_euler=Vector((18,-45,-4.2)).to_track_quat('-Z','Y').to_euler()
    if fill:
        look.area(col,'Regolith bounce',(-8,-14,10),(0,0,1),size=(20,20),power=6500,color='#d5d2c8')
    props.sphere(col,'Solar disc',.25,look.emission('Solar white gold','#fff4dd',14),
                 (-18,45,4.2),segs=32,rings=16)


def ship(col,m,loc=(0,0,0),scale=1):
    root=bpy.data.objects.new('HNC AWAY vehicle',None);col.objects.link(root);root.location=loc;root.scale=(scale,)*3
    B=lambda name,size,mat,pos,**kw:props.box(col,name,size,mat,pos,parent=root,**kw)
    props.cyl(col,'Octagonal pressure cabin',1.35,2.15,m['cream'],(0,0,1.08),segs=8,r2=1.03,parent=root)
    props.cyl(col,'Descent hardware',1.38,.67,m['gold'],(0,0,.4),segs=8,parent=root)
    props.cyl(col,'Upper crown',1.04,.16,m['navy'],(0,0,3.21),segs=8,parent=root)
    props.cyl(col,'Engine bell',.30,.48,m['black'],(0,0,.05),segs=24,r2=.19,parent=root)
    B('Pilot window',(.72,.05,.46),m['navy'],(0,-1.32,2.36),bevel=.08)
    B('Airlock hatch',(.80,.09,1.31),m['navy'],(0,-1.39,1.08),bevel=.10)
    o=physical_label(col,'HNC / AWAY',(0,-1.442,2.05),.12,m['cream']);o.parent=root
    for x in (-.43,.43):B('Gold hatch jamb',(.04,.10,1.30),m['gold'],(x,-1.43,1.08),bevel=.01)
    for x,y in ((-1,-1),(1,-1),(-1,1),(1,1)):
        a=(x*.89,y*.89,1.33);b=(x*2.05,y*2.05,.06)
        rod(col,'Landing compression strut',a,b,.075,m['metal'],parent=root)
        rod(col,'Landing brace',(x*.95,y*.95,.5),b,.035,m['gold'],parent=root)
        props.cyl(col,'Landing pad',.32,.07,m['navy'],(b[0],b[1],-.01),segs=16,parent=root)
    for x in (-1,1):
        props.sphere(col,'External pressure tank',.31,m['metal'],(x*1.28,.15,1.75),scale=(1,1,1.7),parent=root)
    rod(col,'Antenna mast',(.55,.35,3.3),(.55,.35,4.0),.025,m['metal'],parent=root)
    props.cyl(col,'Mission antenna',.24,.06,m['cream'],(.55,.35,3.96),rot=(30,0,0),parent=root)
    for z in (.40,.64,.88):
        B('Airlock ladder rung',(.64,.17,.035),m['metal'],(0,-1.5,z),bevel=.01)
    return root


def cabin(col,m):
    props.box(col,'Cabin floor',(4,5,.12),m['navy'],(0,0,-.12),bevel=.02)
    props.box(col,'Cabin back bulkhead',(4,.18,3.3),m['navy'],(0,2.3,0),bevel=.08)
    for x in (-1.8,1.8):
        props.box(col,'Cabin wall',(.16,5,3.3),m['navy'],(x,0,0),bevel=.06)
        for y in (-1.5,-.3,.9,2.1):
            props.box(col,'Titanium pressure rib',(.10,.08,3.1),m['metal'],(x*.96,y,0),bevel=.02)
        props.box(col,'Warm cabin strip',(.045,3.8,.04),m['lamp'],(x*.94,.1,2.8),bevel=.01)
    for y in (-1,.2,1.4):
        props.box(col,'Floor service seam',(3.4,.018,.01),m['metal'],(0,y,.006))
    for x in (-1.15,1.15):
        props.box(col,'Analog service housing',(.66,.13,1.1),m['cream'],(x,2.16,.8),bevel=.045)
        for j in range(4):
            props.cyl(col,'Physical control dial',.045,.025,m['black'],(x-.19+j*.13,2.0,1.55),rot=(90,0,0))
    look.area(col,'Cabin practical',(-1.4,-1,2.7),(0,0,1.1),size=(.8,2),power=190,color='#fff0d1')
    look.area(col,'Cabin rim',(1.5,1.7,2.7),(0,0,1.5),size=(.3,1.5),power=150,color='#d6dfdf')


def dust(col,m,center,t0):
    rng=random.Random(39)
    for i in range(18):
        a=rng.random()*math.tau;v=rng.uniform(.12,.4)
        o=props.sphere(col,'Ballistic regolith grain',rng.uniform(.006,.014),m,center,segs=6,rings=4)
        key(o,'scale',[(0,(0,0,0)),(t0-.02,(0,0,0)),(t0,(1,1,1)),(t0+.35,(.7,.7,.7)),(t0+.6,(0,0,0))])
        key(o,'location',[(t0,center),(t0+.25,(center[0]+math.cos(a)*v*.4,center[1]+math.sin(a)*v*.4,.07+rng.random()*.06)),(t0+.6,(center[0]+math.cos(a)*v,center[1]+math.sin(a)*v,.009))])


def build(idx,scale=.5,samples=24):
    name,dur=SHOTS[idx];sc,col,m=fresh(name,scale,samples);sc.frame_start=1;sc.frame_end=round(dur*60)
    frames=sc.frame_end
    if idx==0:
        if (ASSETS/'moon.glb').exists():
            before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ASSETS/'moon.glb'))
            objs=set(bpy.data.objects)-before
            roots=[o for o in objs if o.parent is None]
            pivot=bpy.data.objects.new('LRO lunar globe',None);col.objects.link(pivot)
            for o in roots:o.parent=pivot
            bpy.context.view_layer.update()
            pts=[o.matrix_world@Vector(v) for o in objs if o.type=='MESH' for v in o.bound_box]
            extent=max(max(p[i] for p in pts)-min(p[i] for p in pts) for i in range(3))
            pivot.scale=(170/extent,)*3;pivot.location=(0,75,-83)
        else:
            props.sphere(col,'Moon globe',85,look.flat('Orbital lunar grey','#747470',rough=1),(0,75,-83),segs=128,rings=64)
        s=ship(col,m,(-1,0,6),1.3)
        key(s,'location',[(0,(-1.7,0,6.2)),(dur,(-.4,1.1,5.8))])
        sunrise(col,False)
        look.area(col,'Orbital lunar reflection',(5,-10,15),(0,0,7),size=(8,8),power=1800,color='#dedbd2')
        camera(sc,col,(14,-28,13),(0,4,5),lens=46,end=(13.7,-27.6,12.8))
    elif idx in (1,2):
        cabin(col,m)
        if idx==1:
            b=ball(sc,col,(0,0,1.08));b.scale=(1.0,)*3
            props.cyl(col,'Ball cargo pedestal',.46,.68,m['navy'],(0,0,0),segs=16)
            props.torus(col,'Ball restraint cradle',.33,.025,m['gold'],(0,0,.87))
            for x in (-.37,.37):
                o=props.box(col,'Ball restraint jaw',(.06,.07,.38),m['metal'],(x,0,.8),bevel=.01)
                key(o,'location',[(0,(x,0,.8)),(.6,(x,0,.8)),(1.2,(x*1.6,0,.65))])
            key(b,'location',[(0,(0,0,1.08)),(.65,(0,0,1.08)),(dur,(0,0,1.21))])
            p=player(sc,col,m,1,frames,pos=(.8,.55,0),face=-25)
            p.key('ik_hand.R',0,1,'hold');p.key('hand.R',0,(.25,-.10,1.0),'hold')
            p.key('hand.R',dur,(.62,.0,1.1));p.bake()
            camera(sc,col,(-1.4,-2.6,1.70),(0,0,1.1),lens=52,end=(-1.33,-2.50,1.68))
        else:
            p=player(sc,col,m,1,frames,pos=(-.15,.2,0),face=-12)
            p.key('head',0,(0,0,-5));p.key('head',dur,(1,0,5));p.bake()
            q=player(sc,col,m,2,frames,pos=(.83,1.4,0),face=10);q.bake()
            camera(sc,col,(-.75,-2.3,1.94),(-.12,.15,1.66),lens=65,end=(-.7,-2.2,1.94))
    elif idx==4:
        cabin(col,m)
        for o in col.objects:
            if o.type=='LIGHT':o.data.energy*=.10
        # Tall exit beyond the cabin is physical: sunlight reveals terrain.
        ground=terrain(col);sunrise(col)
        for x in (-.84,.84):
            props.box(col,'Airlock surround',(.18,.36,3.3),m['cream'],(x,-1.35,0),bevel=.025)
        props.box(col,'Airlock lintel',(1.85,.36,.38),m['cream'],(0,-1.35,2.9),bevel=.025)
        door=props.box(col,'Sliding pressure door',(1.5,.14,2.9),m['navy'],(0,-1.34,0),bevel=.04)
        key(door,'location',[(0,(0,-1.34,0)),(.25,(0,-1.34,0)),(1.05,(1.6,-1.34,0))])
        p=player(sc,col,m,1,frames,pos=(0,-.8,0),face=0)
        for s in 'LR':
            p.key(f'ik_hand.{s}',0,1,'hold');p.key(f'hand.{s}',0,(.19 if s=='L' else -.19,-1.23,1.0),'hold')
        p.bake();ball(sc,col,(0,-1.28,1.0))
        look.area(col,'Airlock sunlight slice',(2,-4,3),(0,0,1),size=(.45,2),power=900,color='#ffe3ae')
        camera(sc,col,(0,1.95,1.45),(0,-1.2,1.4),lens=28,end=(0,1.75,1.45))
    else:
        ground=terrain(col);sunrise(col)
        if idx==3:
            s=ship(col,m,(0,8,1.2))
            key(s,'location',[(0,(-1.1,9,1.5)),(dur,(0,7.6,.06))])
            camera(sc,col,(8,-15,2.5),(0,8,2.0),lens=55,end=(7.8,-14.6,2.5))
        else:
            if idx in (5,6):ship(col,m,(0,7,0))
            p=player(sc,col,m,1,frames)
            q=None
            if idx in (5,6,8,10):q=player(sc,col,m,2,frames,pos=(1.8,-2.7,0),face=-146)
            if idx==5:
                stance(p,0,(0,1.3,0));stance(q,0,(.85,2.2,0))
                walk(p,0,[(0,.3)],stride=.55,cadence=1.32,style='casual')
                walk(q,0,[(.85,1.3)],stride=.5,cadence=1.32)
                b=ball(sc,col,(0,.82,1.03))
                key(b,'location',[(0,(0,.82,1.03)),(dur,(0,-.18,1.03))])
                for s in 'LR':
                    p.key(f'ik_hand.{s}',0,1,'hold')
                    p.key(f'hand.{s}',0,(.19 if s=='L' else -.19,.85,1.0),'hold')
                    p.key(f'hand.{s}',dur,(.19 if s=='L' else -.19,-.15,1.0))
                dust(col,ground,(.22,.4,.025),1.0)
                camera(sc,col,(.65,-1.1,.22),(.07,.6,.18),lens=55,end=(.65,-1.0,.22))
            elif idx==6:
                stance(q,0,(1.8,-2.7,0),face=-146)
                ball(sc,col,(0,-.50,1.03))
                for s in 'LR':
                    p.key(f'ik_hand.{s}',0,1,'hold');p.key(f'hand.{s}',0,(.19 if s=='L' else -.19,-.47,1.0),'hold')
                camera(sc,col,(-8,-13,3.2),(.5,1.5,1.0),lens=25,end=(-7.7,-12.7,3.2))
            elif idx==7:
                b=ball(sc,col,(.26,-.45,.20))
                key(b,'location',[(0,(.26,-.45,.58)),(.75,(.26,-.45,.2)),(dur,(.26,-.45,.2))])
                p.key('chest',0,(12,0,0));p.key('chest',dur,(0,0,0))
                p.key('ik_hand.L',0,1);p.key('hand.L',0,(.26,-.45,.68));p.key('hand.L',.75,(.26,-.45,.30));p.key('hand.L',dur,(.48,-.05,.8))
                camera(sc,col,(-.80,-1.6,.43),(.22,-.4,.22),lens=70,end=(-.74,-1.52,.43))
            elif idx==8:
                b=ball(sc,col,(1.6,-2.6,.2))
                key(b,'location',[(0,(1.6,-2.6,.2)),(.35,(1.6,-2.6,.2)),(1.3,(1.0,-1.5,.64)),(dur,(.52,-.67,.51))])
                q.key('foot.L',.35,(1.62,-2.57,.08));q.key('foot.L',.65,(1.44,-2.28,.18));q.key('foot.L',1.2,(1.74,-2.64,.08))
                p.key('gaze_at',0,(1.6,-2.6,.5));p.key('gaze_w',0,1)
                camera(sc,col,(-3.5,-7.5,2.0),(.8,-1.2,1.0),lens=32,end=(-3.3,-7.2,2.0))
            elif idx==9:
                b=ball(sc,col,(.52,-.67,.51))
                key(b,'location',[(0,(.52,-.67,.51)),(.7,(.32,-.39,.30)),(1.10,(.23,-.33,.225)),(1.35,(.23,-.31,.2)),(dur,(.23,-.30,.2))])
                p.key('foot.L',0,(.226,-.1,.08));p.key('foot.L',.7,(.226,-.1,.08));p.key('foot.L',1.1,(.23,-.17,.12));p.key('foot.L',1.35,(.23,-.10,.08))
                p.key('foot_rot.L',.9,(0,10));p.key('foot_rot.L',1.35,(0,0))
                dust(col,ground,(.23,-.33,.015),1.10)
                camera(sc,col,(-.90,-2.5,.28),(.05,-.1,.8),lens=33,end=(-.85,-2.4,.30))
            elif idx==10:
                p.key('head',0,(0,0,-2));p.key('head',dur,(2,0,-2))
                q.key('head',0,(0,0,0));q.key('head',dur,(1,0,0))
                ball(sc,col,(.23,-.3,.2))
                camera(sc,col,(-1.2,.9,1.9),(1.8,-2.7,1.68),lens=65)
            elif idx==11:
                b=ball(sc,col,(.23,-.30,.2))
                key(b,'location',[(0,(.23,-.30,.2)),(dur,(.04,-.59,.2))])
                camera(sc,col,(-1.9,-4.2,.8),(0,.0,1.1),lens=42,end=(-1.85,-4.1,.8))
            p.bake()
            if q:q.bake()
    look.finish(sc,glare=.08,threshold=2.5,vignette=.12,dispersion=0)
    return sc


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--mode',choices=['lookdev','storyboard','preview','final'],default='lookdev')
    ap.add_argument('--only',type=int);ap.add_argument('--scale',type=float);ap.add_argument('--samples',type=int)
    ap.add_argument('--replace-frames',action='store_true')
    ap.add_argument('--shots',help='Comma-separated shot indices for isolated corrective renders')
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    scale=args.scale or (1 if args.mode=='final' else .5)
    samples=args.samples or (48 if args.mode=='final' else 16)
    indices=[int(x) for x in args.shots.split(',')] if args.shots else ([args.only] if args.only is not None else ([0,1,4,9] if args.mode=='lookdev' else range(12)))
    for idx in indices:
        sc=build(idx,scale,samples);name,dur=SHOTS[idx]
        if args.mode in ('lookdev','storyboard'):
            folder=OUT/args.mode;folder.mkdir(parents=True,exist_ok=True)
            sc.frame_set(round(sc.frame_end*.72));sc.render.filepath=str(folder/f'{name}.png')
            bpy.ops.render.render(write_still=True)
        else:
            folder=OUT/args.mode/name;folder.mkdir(parents=True,exist_ok=True)
            step=4 if args.mode=='preview' else 1
            for frame in range(1,sc.frame_end+1,step):
                path=folder/f'{frame:04d}.png'
                if path.exists() and not args.replace_frames:continue
                sc.frame_set(frame);sc.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        print(f'LUNAR_DONE {args.mode} {name}',flush=True)


if __name__=='__main__':main()
