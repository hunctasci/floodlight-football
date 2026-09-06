import './style.css';
import { MatchEngine } from './engine';
import { GameRenderer } from './renderer';
import { EMPTY_INPUT, TEAMS, type InputFrame, type MatchState } from './types';
import { MatchAudio } from './audio';
import { createTouchState, touchDown, touchUp, setStick, releaseStick, clearTouchEdges, resetTouch, TOUCH_BUTTONS, TOUCH_MENU } from './touch';

type Screen = 'title'|'team'|'match'|'pause'|'half'|'full';
const app=document.querySelector<HTMLDivElement>('#app')!;
const renderer=new GameRenderer(app); const audio=new MatchAudio();
const flowTest=import.meta.env.DEV&&new URLSearchParams(location.search).has('test');
let screen:Screen='title', menuIndex=0, teamIndex=0, duration=180, engine=new MatchEngine(0,180,1), last=performance.now(), acc=0, muted=audio.isMuted, devStatusAt=0, hudAt=0, menuDirty=true;
const down=new Set<string>(), pressed=new Set<string>(), released=new Set<string>(); let shootWasDown=false;
const touch=createTouchState();
const isTouchDevice=matchMedia('(pointer: coarse)').matches||'ontouchstart' in window;
const ui=document.createElement('div');ui.className='ui';app.append(ui);
const barTop=document.createElement('div');barTop.className='cinebar top';ui.append(barTop);
const barBottom=document.createElement('div');barBottom.className='cinebar bottom';ui.append(barBottom);
let camNote='',camNoteAt=0;
const radar=document.createElement('canvas'); radar.className='radar';radar.width=308;radar.height=184;
function keyName(e:KeyboardEvent){return e.code}
const blocked=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyC','KeyI','KeyJ','KeyK','KeyL','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape','KeyM'];
addEventListener('keydown',e=>{if(blocked.includes(keyName(e)))e.preventDefault(); if(!down.has(keyName(e)))pressed.add(keyName(e));down.add(keyName(e));audio.enable();});
addEventListener('keyup',e=>{if(blocked.includes(keyName(e)))e.preventDefault(); released.add(keyName(e)); down.delete(keyName(e));});
addEventListener('blur',()=>{down.clear();pressed.clear();released.clear();resetTouch(touch);if(screen==='match')openPause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='match')openPause();});
const hit=(k:string)=>pressed.has(k)||touch.pressed.has(k); const held=(k:string)=>down.has(k)||touch.down.has(k);
const consume=(k:string)=>{pressed.delete(k);touch.pressed.delete(k);};
function launch(){engine=new MatchEngine(teamIndex,flowTest?8:duration,Math.floor(Math.random()*999999));screen='match';menuIndex=0;audio.event({type:'whistle'});}
function openPause(){if(screen==='match'){engine.state.paused=true;screen='pause';menuIndex=0;menuDirty=true;down.clear();touch.down.clear();}}
// --- Touch controls (mobile): joystick + buttons emit the same key codes ---
let touchLayer: HTMLDivElement | null = null, stickZone: HTMLElement | null = null, stickNub: HTMLElement | null = null, menuPad: HTMLElement | null = null, matchPad: HTMLElement | null = null;
const STICK_R = 56;
function bindHold(el: Element, code: string) {
  const start = (e: Event) => { e.preventDefault(); touchDown(touch, code); audio.enable(); };
  const end = (e: Event) => { e.preventDefault(); touchUp(touch, code); };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
}
if (isTouchDevice) {
  touchLayer = document.createElement('div'); touchLayer.className = 'touch'; touchLayer.id = 'touch';
  touchLayer.innerHTML = `
    <div class="stick-zone"><div class="stick-base"><div class="stick-nub"></div></div></div>
    <div class="match-pad">
      <button class="tbtn small tpause" data-code="Escape">II</button>
      <button class="tbtn small tcam" data-code="KeyC">📷</button>
      <button class="tbtn tsprint" data-code="KeyE">SPRINT</button>
      <button class="tbtn tswitch" data-code="KeyQ">SWITCH</button>
      <button class="tbtn tpass" data-code="KeyS">PASS</button>
      <button class="tbtn tthru" data-code="KeyW">THRU</button>
      <button class="tbtn tcross" data-code="KeyA">CROSS</button>
      <button class="tbtn tshoot" data-code="KeyD">SHOOT</button>
    </div>
    <div class="menu-pad">
      <button class="tbtn mup" data-code="ArrowUp">▲</button>
      <button class="tbtn mleft" data-code="ArrowLeft">◀</button>
      <button class="tbtn mok" data-code="Enter">OK</button>
      <button class="tbtn mright" data-code="ArrowRight">▶</button>
      <button class="tbtn mdown" data-code="ArrowDown">▼</button>
      <button class="tbtn mback" data-code="Escape">BACK</button>
    </div>`;
  app.append(touchLayer);
  stickZone = touchLayer.querySelector('.stick-zone') as HTMLElement;
  stickNub = touchLayer.querySelector('.stick-nub') as HTMLElement;
  menuPad = touchLayer.querySelector('.menu-pad') as HTMLElement;
  matchPad = touchLayer.querySelector('.match-pad') as HTMLElement;
  touchLayer.querySelectorAll('button[data-code]').forEach(b => bindHold(b, (b as HTMLElement).dataset.code!));
  let stickId: number | null = null, anchorX = 0, anchorY = 0;
  stickZone.addEventListener('touchstart', (e: Event) => {
    e.preventDefault(); const t = (e as TouchEvent).changedTouches[0];
    stickId = t.identifier; anchorX = t.clientX; anchorY = t.clientY; audio.enable();
  }, { passive: false });
  stickZone.addEventListener('touchmove', (e: Event) => {
    e.preventDefault();
    for (const t of Array.from((e as TouchEvent).changedTouches)) if (t.identifier === stickId) {
      const dx = (t.clientX - anchorX) / STICK_R, dz = (t.clientY - anchorY) / STICK_R;
      setStick(touch, dx, dz);
      const n = Math.hypot(dx, dz), cl = n > 1 ? 1 / n : 1;
      stickNub!.style.transform = `translate(${(dx * cl * 34).toFixed(1)}px,${(dz * cl * 34).toFixed(1)}px)`;
    }
  }, { passive: false });
  const zoneEnd = (e: Event) => {
    for (const t of Array.from((e as TouchEvent).changedTouches)) if (t.identifier === stickId) {
      stickId = null; releaseStick(touch); stickNub!.style.transform = '';
    }
  };
  stickZone.addEventListener('touchend', zoneEnd); stickZone.addEventListener('touchcancel', zoneEnd);
}
function updateTouchVisibility() {
  if (!touchLayer || !menuPad || !matchPad || !stickZone) return;
  const inMatch = screen === 'match';
  matchPad.classList.toggle('hidden', !inMatch);
  stickZone.classList.toggle('hidden', !inMatch);
  menuPad.classList.toggle('hidden', inMatch);
}
function input():InputFrame {
// FIFA PC (arrow-keys) layout: arrows move/aim, S pass, W through, A cross/lob, D shoot, E/Shift sprint, Q/Space switch.
// Legacy J/L/I/K aliases kept so old muscle memory still works.
// Touch joystick vector is merged in so mobile plays the identical sim.
let x=(held('ArrowRight')?1:0)-(held('ArrowLeft')?1:0)+touch.stickX,z=(held('ArrowDown')?1:0)-(held('ArrowUp')?1:0)+touch.stickZ;const n=Math.hypot(x,z);if(n>1){x/=n;z/=n}const sh=held('KeyD')||held('KeyK');const out={x,z,sprint:held('ShiftLeft')||held('ShiftRight')||held('KeyE'),pass:hit('KeyS')||hit('KeyJ'),through:hit('KeyW')||hit('KeyL'),cross:hit('KeyA')||hit('KeyI'),shootPressed:hit('KeyD')||hit('KeyK'),shootHeld:sh,shootReleased:released.has('KeyD')||released.has('KeyK')||touch.released.has('KeyD')||(!sh&&shootWasDown),switchPlayer:hit('Space')||hit('KeyQ')};shootWasDown=sh;return out;}
function clock(s:MatchState){const football=Math.min(45,Math.floor(s.elapsed/s.halfDuration*45));return `${s.half===2?45+football:football}'`}
function drawRadar(s:MatchState){const c=radar.getContext('2d')!;c.clearRect(0,0,308,184);c.fillStyle='#1b6b43';c.fillRect(0,0,308,184);c.strokeStyle='#f8efdb';c.lineWidth=2;c.strokeRect(3,3,302,178);c.beginPath();c.moveTo(154,3);c.lineTo(154,181);c.stroke();for(const p of s.players){c.fillStyle=p.team===s.humanTeam?'#f7bf30':'#ef4054';c.beginPath();c.arc((p.x/46+1)*154,(p.z/29+1)*92, p.id===s.controlled?6:4,0,7);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc((s.ball.x/46+1)*154,(s.ball.z/29+1)*92,4,0,7);c.fill();}
function hud(s:MatchState){const me=s.players[s.controlled];const my=s.teams[s.humanTeam],away=s.teams[1-s.humanTeam];const how=s.phase==='corner'?'ARROWS AIM · A CROSS · S SHORT':s.phase==='throwin'?'ARROWS AIM · S THROW':s.phase==='goalkick'?'S SHORT · D LONG': 'ARROWS AIM · S KICK OFF';const restart=s.restart?`${s.teams[s.restart.team].name.toUpperCase()} ${s.phase==='throwin'?'THROW-IN':s.phase==='corner'?'CORNER':s.phase==='goalkick'?'GOAL KICK':'KICKOFF'}${s.restart.team===s.humanTeam?`<small>${how}</small>`:'<small>OPPONENT TAKING RESTART</small>'}`:'';const toast=performance.now()-camNoteAt<1600?`<div class="camtoast">📷 ${camNote}</div>`:'';const holder=s.ball.owner===null?null:s.players[s.ball.owner];const keeperHint=holder&&holder.keeper&&holder.team===s.humanTeam?`<div class="keeper-hint">🧤 KEEPER · ARROWS AIM<small>S SHORT · W THROUGH · D/A LONG</small></div>`:'';ui.innerHTML=`<div class="scoreboard"><div class="club">${my.short}</div><div class="score">${s.score[s.humanTeam]} – ${s.score[1-s.humanTeam]}</div><div class="club">${away.short}</div><div class="clock">${s.half===1?'1ST':'2ND'} ${clock(s)}</div></div><div class="attack">YOU: ${my.name.toUpperCase()}<br>ATTACK ${s.attack[s.humanTeam]>0?'→':'←'}</div><div class="camchip">📷 ${renderer.cameraLabel()}</div><div class="player-info">▲ ${me?.name||'PLAYER'}<div class="stamina"><i style="width:${(me?.stamina||0)*100}%"></i></div></div>${s.charge>0?`<div class="charge"><i style="width:${Math.min(100,s.charge/.6*100)}%"></i></div>`:''}<div class="strip">${isTouchDevice ? 'STICK MOVE · SPRINT HOLD · PASS · THRU · CROSS · SHOOT (HOLD=POWER)<br>SWITCH · CAM · PAUSE' : 'ARROWS MOVE · E/SHIFT SPRINT · S PASS / TACKLE · W THROUGH · A CROSS · D SHOOT / SLIDE<br>Q/SPACE SWITCH · C CAMERA · ESC PAUSE · M ' + (muted ? 'UNMUTE' : 'MUTE')}</div>${toast}${keeperHint}${!restart&&s.messageTime>0?`<div class="message">${s.message}<small>${s.phase==='goal'?'KICKOFF IN A MOMENT':''}</small></div>`:''}${restart?`<div class="message">${restart}</div>`:''}`;ui.append(barTop,barBottom,radar);drawRadar(s);}
function panel(content:string){ui.innerHTML=`<div class="screen"><div class="panel">${content}</div></div>`}
function menu(){ if(!menuDirty)return; menuDirty=false;
  if(screen==='title') { panel(`<div class="eyebrow">ARCADE FOOTBALL · 1998</div><div class="title">RETRO<br>FOOTBALL</div><div class="subtitle">SATURDAY CUP</div><div class="menu-item selected">▶ PLAY MATCH</div><div class="hint">${isTouchDevice ? 'TOUCH READY · TAP OK' : 'KEYBOARD ONLY · PRESS ENTER'}<br>ARROWS TO MOVE · S PASS · W THROUGH · A CROSS · D SHOOT · C CAMERA${isTouchDevice ? '<br>OR LEFT STICK + BUTTONS' : ''}</div>`); return; }
  if(screen==='team') { const t=TEAMS[teamIndex],o=TEAMS[(teamIndex+1)%TEAMS.length]; panel(`<div class="eyebrow">CHOOSE YOUR CLUB</div><div class="title" style="font-size:34px">SATURDAY CUP</div><div class="team-row"><div class="team-card active"><div class="team-swatch" style="background:${t.color}"></div>${t.name}<br><small>${t.city}</small></div><div class="team-card"><div class="team-swatch" style="background:${o.color}"></div>${o.name}<br><small>OPPONENT</small></div></div><div class="menu-item selected">${duration/60} MINUTE HALVES</div><div class="hint">← / → CHANGE TEAM · ↑ / ↓ CHANGE LENGTH<br>ENTER KICK OFF · ESC BACK</div>`); return; }
  if(screen==='pause') { const items=['RESUME','RESTART MATCH','MAIN MENU']; panel(`<div class="eyebrow">MATCH PAUSED</div><div class="title" style="font-size:38px">PAUSE</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">ARROWS MOVE · E/SHIFT SPRINT · S PASS/TACKLE · W THROUGH · A CROSS · D SHOOT/SLIDE<br>Q/SPACE SWITCH · C CAMERA (${renderer.cameraLabel()}) · ↑ / ↓ SELECT · ENTER CONFIRM · ESC RESUME</div>`); return; }
  if(screen==='half') { const s=engine.state; panel(`<div class="eyebrow">THE WHISTLE BLOWS</div><div class="title" style="font-size:42px">HALF TIME</div><div class="subtitle">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="hint">PRESS ENTER FOR THE SECOND HALF</div>`); return; }
  const s=engine.state,items=['PLAY AGAIN','MAIN MENU']; panel(`<div class="eyebrow">SATURDAY CUP · FINAL SCORE</div><div class="title" style="font-size:42px">FULL TIME</div><div class="subtitle">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
}
function handleMenu(){if(pressed.size||released.size||touch.pressed.size||touch.released.size)menuDirty=true;if(hit('KeyM')){muted=audio.toggle();consume('KeyM')}if(screen==='match'){if(hit('Escape')){consume('Escape');openPause()}if(hit('KeyC')){camNote=renderer.cycleCamera();camNoteAt=performance.now();consume('KeyC')}return}if(screen==='title'&&hit('Enter'))screen='team';else if(screen==='team'){if(hit('KeyA')||hit('ArrowLeft'))teamIndex=(teamIndex+3)%4;if(hit('KeyD')||hit('ArrowRight'))teamIndex=(teamIndex+1)%4;if(hit('KeyW')||hit('ArrowUp'))duration=duration===180?600:duration===300?180:300;if(hit('KeyS')||hit('ArrowDown'))duration=duration===180?300:duration===300?600:180;if(hit('Escape'))screen='title';if(hit('Enter'))launch()}else if(screen==='pause'){if(hit('Escape')){screen='match';engine.state.paused=false}if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(hit('Enter')){if(menuIndex===0){screen='match';engine.state.paused=false}else if(menuIndex===1)launch();else screen='title'}}else if(screen==='half'){if(hit('Enter')){engine.continueHalf();screen='match';audio.event({type:'whistle'})}}else if(screen==='full'){if(hit('KeyW')||hit('ArrowUp')||hit('KeyS')||hit('ArrowDown'))menuIndex=1-menuIndex;if(hit('Enter'))menuIndex===0?launch():screen='title'}menu();}
function frame(now:number){const raw=Math.min(.1,(now-last)/1000);last=now;let stepped=false;if(screen==='match'){handleMenu();if(screen==='match'){acc+=raw;let first=true;while(acc>=1/60){const f=input();if(!first){f.pass=false;f.through=false;f.cross=false;f.shootPressed=false;f.shootReleased=false;f.switchPlayer=false}engine.update(1/60,f);for(const e of engine.events.splice(0))audio.event(e);first=false;stepped=true;acc-=1/60}const s=engine.state;if(s.phase==='halftime'){screen='half';menuDirty=true;audio.event({type:'whistle'})}if(s.phase==='fulltime'){screen='full';menuIndex=0;menuDirty=true;audio.event({type:'whistle'})}renderer.render(s,raw);const cine=renderer.inCinematic();barTop.classList.toggle('on',cine);barBottom.classList.toggle('on',cine);if(now-hudAt>66){hud(s);hudAt=now}}}else {renderer.render(engine.state,raw,screen==='title'||screen==='team');barTop.classList.remove('on');barBottom.classList.remove('on');handleMenu()}updateTouchVisibility();if(import.meta.env.DEV&&now-devStatusAt>100){const s=engine.state,p=s.players[s.controlled],b=s.ball;document.body.dataset.match=JSON.stringify({phase:s.phase,screen,half:s.half,elapsed:s.elapsed,time:s.time,score:s.score,controlled:s.controlled,player:{x:p?.x,z:p?.z,vx:p?.vx,vz:p?.vz},ball:{x:b.x,z:b.z,y:b.y,owner:b.owner,flight:b.flight},stats:s.stats});devStatusAt=now}if(screen!=='match'||stepped){pressed.clear();released.clear();clearTouchEdges(touch)}requestAnimationFrame(frame)}
addEventListener('resize',()=>renderer.resize());
// PWA: offline app shell in production only (never cache dev iterations).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if(import.meta.env.DEV) Object.assign(window,{__retro:{get engine(){return engine},snapshot:()=>JSON.parse(JSON.stringify(engine.state)),start:launch}});
menu();requestAnimationFrame(frame);
