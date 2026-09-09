import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT } from '../src/types.ts';
import { createKeyboardState, keyDown, keyUp } from '../src/input/keyboard.ts';
import { createTouchState, touchDown, touchUp, setShootAim, clearTouchEdges } from '../src/input/touch.ts';
import { buildInputFrame } from '../src/input/input.ts';

function defense() {
  const g = new MatchEngine(0,180,71), s = g.state;
  s.phase='playing'; s.restart=null;
  for (const p of s.players) { p.x=-35; p.z=p.id*2-22; p.vx=p.vz=0; p.think=100; }
  Object.assign(s.ball,{x:0,z:0,y:3,owner:null,vx:0,vy:0,vz:0});
  const mates=s.players.filter(p=>p.team===0&&!p.keeper);
  mates[0].x=2; mates[0].z=0; mates[0].cooldown=1; mates[0].aiState='MARK';
  mates[1].x=-5; mates[1].z=0;
  s.controlled=mates[5].id;
  return {g,s,mates};
}
test('manual switch selects nearest despite cooldown, marking and wrong side',()=>{
  for(const x of [0,1]) {
    const {g,s,mates}=defense();
    g.update(1/60,{...EMPTY_INPUT,x,switchPlayer:true});
    assert.equal(s.controlled,mates[0].id);
  }
});
test('manual alternate survives the next idle tick and can return to nearest',()=>{
  const {g,s,mates}=defense(); s.controlled=mates[0].id;
  g.update(1/60,{...EMPTY_INPUT,switchPlayer:true});
  assert.equal(s.controlled,mates[1].id);
  g.update(1/60); assert.equal(s.controlled,mates[1].id);
  g.update(1/60,{...EMPTY_INPUT,switchPlayer:true}); assert.equal(s.controlled,mates[0].id);
});
test('fallen nearest does not block automatic selection of next available player',()=>{
  const {g,s,mates}=defense(); mates[0].action='fallen';mates[0].actionTime=1;
  g.update(1/60); assert.equal(s.controlled,mates[1].id);
});
test('switch grace survives snapshot restore deterministically',()=>{
  const {g}=defense(); g.update(1/60,{...EMPTY_INPUT,switchPlayer:true});
  const copy=new MatchEngine(0,180,71);copy.restore(g.snapshot());
  for(let i=0;i<60;i++){ g.update(1/60);copy.update(1/60);assert.equal(g.hash(),copy.hash()); }
});
test('touch shot placement survives release until edges are consumed',()=>{
  const t=createTouchState(), kb=createKeyboardState();
  touchDown(t,'KeyK');setShootAim(t,48,-48);touchUp(t,'KeyK');
  const {frame}=buildInputFrame(kb,t,true);
  assert.equal(frame.shootReleased,true);assert.equal(frame.aimU,.5);assert.equal(frame.aimV,.5);
  clearTouchEdges(t);assert.equal(t.aimU,0);assert.equal(t.aimV,0);
});
test('releasing one device does not fire an action still held by another',()=>{
  for(const code of ['KeyK','KeyS']) {
    const t=createTouchState(),kb=createKeyboardState();keyDown(kb,code);touchDown(t,code);touchUp(t,code);
    let r=buildInputFrame(kb,t,true,{passWasDown:true});
    assert.equal(code==='KeyK'?r.frame.shootReleased:r.frame.passReleased,false);
    keyUp(kb,code);r=buildInputFrame(kb,t,true,{passWasDown:true});
    assert.equal(code==='KeyK'?r.frame.shootReleased:r.frame.passReleased,true);
  }
});

test('LONG kickoff launches a lofted ball rather than a short pass',()=>{
  const g=new MatchEngine(0,180,72);
  g.state.restart!.wait=0;
  g.update(1/60,{...EMPTY_INPUT,long:true,x:1});
  assert.equal(g.state.phase,'playing');
  assert.equal(g.state.ball.flight,'cross');
  assert.ok(g.state.ball.vy>3);
});
test('peer throw-in updates the shared flight and peer target, preserving local target',()=>{
  const g=new MatchEngine(0,180,73),s=g.state;
  s.remoteTeam=1;s.phase='throwin';
  s.restart={team:1,taker:12,x:0,z:29,wait:0};
  Object.assign(s.players[12],{x:0,z:29});
  Object.assign(s.ball,{x:0,z:29,owner:null});
  const localTarget=s.targetPlayer;
  g.update(1/60,EMPTY_INPUT,{...EMPTY_INPUT,pass:true,z:-1});
  assert.equal(s.targetPlayer,localTarget);
  assert.equal(g.snapshot().receiver,g.snapshot().peerReceiver);
  assert.equal(s.players[g.snapshot().peerReceiver!].team,1);
});
test('peer manual switch selects the nearest without changing local control',()=>{
  const {g,s}=defense();s.remoteTeam=1;
  const mates=s.players.filter(p=>p.team===1&&!p.keeper);
  mates[0].x=3;mates[0].z=0;mates[0].cooldown=1;
  s.peerControlled=mates[5].id;
  const local=s.controlled;
  g.update(1/60,{...EMPTY_INPUT,x:1},{...EMPTY_INPUT,switchPlayer:true});
  assert.equal(s.peerControlled,mates[0].id);assert.equal(s.controlled,local);
});
