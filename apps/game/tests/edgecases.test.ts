import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame, type TeamId } from '../src/types.ts';

const DT=1/60;
const tick=(g:MatchEngine,seconds:number,input:Partial<InputFrame>={})=>{
  for(let n=0;n<Math.ceil(seconds/DT);n++)g.update(DT,{...EMPTY_INPUT,...input});
};
const playing=(seed=7)=>{const g=new MatchEngine(0,180,seed);g.state.phase='playing';g.state.restart=null;return g};
const loose=(g:MatchEngine,x:number,z:number,y=FIELD.ballRadius,vx=0,vz=0)=>Object.assign(g.state.ball,{owner:null,x,z,y,vx,vz,vy:0,lock:0,lastTouch:0});

test('keeper reacts to a fast low shot and releases play after the save',()=>{
  const g=playing(); const s=g.state, keeper=s.players.find(p=>p.team===1&&p.keeper)!;
  // Keep all outfield bodies away so this asserts goalkeeper behaviour, not a nearby interception.
  for(const p of s.players)if(!p.keeper){p.x=p.team===0?-5:5;p.z=24;}
  keeper.x=keeper.homeX;keeper.z=0;
  loose(g,keeper.x-1.45,0,.3,22,0);s.ball.flight='shot';
  let saved=false;
  for(let frame=0;frame<90;frame++){g.update(DT,EMPTY_INPUT);saved ||= g.events.some(e=>e.type==='save');}
  assert.ok(saved,'keeper produces a save event for a fast shot in the goalmouth');
  assert.equal(s.phase,'playing');
  assert.notEqual(s.ball.owner,keeper.id,'save does not leave the goalkeeper holding play forever');
});

test('human-side goalkeeper also distributes without becoming the permanently controlled player',()=>{
  const g=playing(); const s=g.state, keeper=s.players.find(p=>p.team===0&&p.keeper)!;
  keeper.x=keeper.homeX;keeper.z=0;s.ball.owner=keeper.id;s.ball.lastTouch=0;keeper.think=s.time-1;
  tick(g,1.2);
  assert.equal(s.phase,'playing');
  assert.notEqual(s.ball.owner,keeper.id);
  assert.notEqual(s.controlled,keeper.id,'outfield control remains available after a keeper kick');
});

test('keepers do not catch a ball eight metres in the air',()=>{
  const g=playing();const s=g.state,keeper=s.players.find(p=>p.team===1&&p.keeper)!;
  loose(g,keeper.x,keeper.z,8,0,0); tick(g,.2);
  assert.notEqual(s.ball.owner,keeper.id);
  assert.ok(s.ball.y>4,'high aerial ball remains in flight');
});

test('second-half scoring and corner ownership work at both ends',()=>{
  const g=playing();const s=g.state;s.phase='halftime';g.continueHalf();s.phase='playing';s.restart=null;
  assert.deepEqual(s.attack,[-1,1]);
  for(const team of [0,1] as TeamId[]){
    s.phase='playing';s.restart=null;
    const sign=s.attack[team];const before=s.score[team];
    loose(g,sign*(FIELD.halfLength-.1),0,.4,sign*24,0);tick(g,.1);
    assert.equal(s.score[team],before+1,`team ${team} scores at its second-half attacking end`);
    s.phase='playing';s.restart=null;
    const defender=(1-team) as TeamId;
    loose(g,sign*(FIELD.halfLength-.05),11,.3,sign*15,0);s.ball.lastTouch=defender;tick(g,.1);
    assert.equal(s.phase,'corner');const restart=g.state.restart;assert.ok(restart);if(restart)assert.equal(restart.team,team);
  }
});

test('a human goal kick can be played short and control returns to outfield play',()=>{
  const g=playing();const s=g.state;s.phase='goalkick';s.restart={team:0,taker:0,x:-41,z:0,wait:0};
  loose(g,-41,0);tick(g,DT,{pass:true,x:1});
  assert.equal(s.phase,'playing');assert.equal(s.ball.owner,null);assert.ok(s.ball.vx>0);
  tick(g,.7);assert.notEqual(s.controlled,0,'keeper does not remain the selected player after a goal kick');
});

test('short pass reaches its selected nearby receiver physically',()=>{
  const g=playing();const s=g.state;const kicker=s.players[s.controlled];const receiver=s.players.find(p=>p.team===0&&!p.keeper&&p.id!==kicker.id)!;
  for(const p of s.players)if(p.id!==kicker.id&&p.id!==receiver.id){p.x=p.team===0?-20:25;p.z=24;}
  kicker.x=0;kicker.z=0;kicker.facingX=1;kicker.facingZ=0;receiver.x=7;receiver.z=0;receiver.vx=0;receiver.vz=0;s.ball.owner=kicker.id;
  tick(g,DT,{pass:true,x:1});assert.equal(s.targetPlayer,receiver.id);
  tick(g,.8);
  assert.equal(s.ball.owner,receiver.id,'the pass is received rather than only acquiring launch velocity');
});

test('right-wing lead pass is delivered into the penalty area rather than toward own goal',()=>{
  const g=playing();const s=g.state;const p=s.players[s.controlled];p.x=27;p.z=21;p.facingX=1;p.facingZ=0;
  Object.assign(s.ball,{x:27.7,y:FIELD.ballRadius,z:21,vx:0,vy:0,vz:0,owner:p.id,lastTouch:0,lock:0,lastKicker:null,flight:'roll'});
  for(const q of s.players)if(q.team===0&&!q.keeper&&q.id!==p.id){q.x=30;q.z=(q.id%2?7:-7);}
  tick(g,DT,{pass:true,passHeld:true,x:1,z:-1});
  for(let i=0;i<14;i++)tick(g,DT,{passHeld:true,x:1,z:-1});
  tick(g,DT,{passReleased:true,x:1,z:-1});assert.equal(s.ball.flight,'through');
  const initialX=s.ball.x;tick(g,.45);
  assert.ok(s.ball.x>initialX+2,'lead pass progresses toward the attacking goal');
  assert.ok(Math.abs(s.ball.z)<18,'lead pass travels back toward the penalty area');
});

test('corner I delivery goes into the box instead of immediately beyond the goal line',()=>{
  const g=playing();const s=g.state;s.phase='corner';s.restart={team:0,taker:s.controlled,x:FIELD.halfLength,z:FIELD.halfWidth-1,wait:0};
  s.players[s.controlled].x=FIELD.halfLength-.7;s.players[s.controlled].z=FIELD.halfWidth-1;loose(g,FIELD.halfLength,FIELD.halfWidth-1);
  tick(g,DT,{shootPressed:true,x:-1,z:-1});assert.equal(s.phase,'playing');tick(g,.3);
  assert.ok(s.ball.x<FIELD.halfLength-1,'corner travels back into the field');
  assert.ok(s.ball.z<FIELD.halfWidth-2,'corner travels toward the packed box');
});

test('kickoff after a goal puts each non-taker on its own side of halfway',()=>{
  const g=playing();const s=g.state;loose(g,FIELD.halfLength-.1,0,.3,25,0);tick(g,.1);tick(g,2);
  assert.equal(s.phase,'kickoff');const r=s.restart!;
  for(const p of s.players)if(p.id!==r.taker){const ownSide=-s.attack[p.team];assert.ok(p.x*ownSide>=-.01,`player ${p.id} starts on own half`);}
});

test('idle human restarts still leave an active AI match with repeated attacking attempts',()=>{
  const g=new MatchEngine(0,180,99);
  for(let frame=0;frame<180/DT;frame++){
    const s=g.state, r=s.restart;
    const humanRestart=r?.team===s.humanTeam;
    const input=humanRestart ? { pass:s.phase!=='corner', cross:s.phase==='corner', shootPressed:s.phase==='goalkick', x:s.attack[s.humanTeam], z:0 } : EMPTY_INPUT;
    g.update(DT,{...EMPTY_INPUT,...input});
    if(s.phase==='halftime') break;
  }
  const total=g.state.stats.shots[0]+g.state.stats.shots[1];
  assert.ok(total>=3,`AI and support play create attempts while idle (got ${total})`);
});
