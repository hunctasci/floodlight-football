import './style.css';
import { MatchEngine } from './engine';
import { GameRenderer } from './renderer';
import { EMPTY_INPUT, TEAMS, type InputFrame, type MatchState, type TeamId } from './types';
import { MatchAudio } from './audio';
import { createTouchState, touchDown, touchUp, setStick, releaseStick, clearTouchEdges, resetTouch, stickSprint, TOUCH_BUTTONS, TOUCH_MENU } from './touch';
import { NetDriver } from './net/driver';
import { RTCTransport } from './net/transport';
import { AutoSignal, SignalError } from './net/autosignal';
import { makeClientId } from './net/signal';
import {
  LeagueApi, LeagueApiError, getClientId, getDisplayName, getLeagueCode, getServerUrl,
  normalizeCode, parseScore, setDisplayName, setLeagueCode, setServerUrl, tableLine,
  type Fixture, type League,
} from './league';

type Screen = 'title'|'team'|'match'|'pause'|'half'|'full'|'online'|'netcreate'|'netjoin'|'netready'
  |'league'|'leaguecreate'|'leaguejoin'|'leagueserver'|'leagueview'|'leaguesubmit'|'leagueresolve'|'leaguescore';
const app=document.querySelector<HTMLDivElement>('#app')!;
const renderer=new GameRenderer(app); const audio=new MatchAudio();
const flowTest=import.meta.env.DEV&&new URLSearchParams(location.search).has('test');
let screen:Screen='title', menuIndex=0, teamIndex=0, duration=180, engine=new MatchEngine(0,180,1), last=performance.now(), acc=0, muted=audio.isMuted, devStatusAt=0, hudAt=0, menuDirty=true;
// Online (server-relayed P2P lockstep) state. Null driver = local AI match.
let net: NetDriver | null = null;
let viewTeam: TeamId = 0;
let netStatus = '', netBusy = false;
let netOffer: RTCTransport | null = null;
// Room session: 6-char code the friend types, token binding the handshake.
let sig: AutoSignal | null = null;
let roomCode = '', matchToken = '', peerId = '';
let peerReady = false, iAmReady = false;
// League (F4b REST) state. Null data = not loaded yet; msg surfaces API errors.
let leagueData: League | null = null, leagueMsg = '', leagueBusy = false;
let leagueActions: string[] = [], leaguePick: Fixture[] = [];
let scoreFixture: Fixture | null = null, scoreMode: 'submit'|'resolve' = 'submit';
const leagueApi = () => new LeagueApi(getServerUrl());
const leagueName = (id: string) => leagueData?.members.find((m) => m.clientId === id)?.displayName.toUpperCase() || '???';
const myOpenFixtures = (): Fixture[] => {
  const me = getClientId();
  return (leagueData?.fixtures ?? []).filter((f) =>
    leagueData?.status === 'active' && f.status !== 'confirmed'
    && (f.homeClientId === me || f.awayClientId === me));
};
async function refreshLeague(silent = false) {
  const code = getLeagueCode();
  if (!code) { leagueData = null; if (!silent) { leagueMsg = 'NO LEAGUE SAVED — CREATE OR JOIN ONE'; menuDirty = true; } return; }
  leagueBusy = true; if (!silent) menuDirty = true;
  try {
    leagueData = await leagueApi().getLeague(code);
    leagueMsg = '';
  } catch (e) { leagueMsg = e instanceof LeagueApiError ? e.message : 'LEAGUE LOAD FAILED'; }
  leagueBusy = false; menuDirty = true;
}
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
addEventListener('keydown',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(blocked.includes(keyName(e)))e.preventDefault(); if(!down.has(keyName(e)))pressed.add(keyName(e));down.add(keyName(e));audio.enable();});
addEventListener('keyup',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(blocked.includes(keyName(e)))e.preventDefault(); released.add(keyName(e)); down.delete(keyName(e));});
addEventListener('blur',()=>{down.clear();pressed.clear();released.clear();resetTouch(touch);if(screen==='match')openPause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='match')openPause();});
const hit=(k:string)=>pressed.has(k)||touch.pressed.has(k); const held=(k:string)=>down.has(k)||touch.down.has(k);
const consume=(k:string)=>{pressed.delete(k);touch.pressed.delete(k);};
function launch(){closeNet();engine=new MatchEngine(teamIndex,flowTest?8:duration,Math.floor(Math.random()*999999));viewTeam=0;renderer.setFollow(null,null);screen='match';menuIndex=0;audio.event({type:'whistle'});}
/** Enter an online match once the driver's handshake completes. */
function launchNet(driver: NetDriver) {
  net = driver;
  engine = driver.session!.engine;
  viewTeam = driver.myTeam;
  renderer.setFollow(engine.controlOf(viewTeam), engine.targetOf(viewTeam));
  screen = 'match'; menuIndex = 0; acc = 0;
  audio.event({ type: 'whistle' });
}
function closeNet() {
  if (net) { try { net.quit(); } catch { /* link already dead */ } net = null; }
  if (netOffer) { try { netOffer.close(); } catch { /* already gone */ } netOffer = null; }
  if (sig) { try { sig.close(); } catch { /* already gone */ } sig = null; }
  roomCode = ''; matchToken = ''; peerId = '';
  peerReady = false; iAmReady = false;
  netStatus = ''; netBusy = false;
  viewTeam = 0; renderer.setFollow(null, null);
}
function openPause(){if(screen==='match'){engine.state.paused=true;if(net)net.setPaused(true);screen='pause';menuIndex=0;menuDirty=true;down.clear();touch.down.clear();}}
function resumePlay(){screen='match';engine.state.paused=false;if(net)net.setPaused(false);}
// Telefonda pause butonu yok: skorboard'a dokunmak pauze acar (cihaz uykusu zaten otomatik pauzeliyor).
// Kamera butonu da yok: sol ustteki kamera cipine dokunmak kamerayi degistirir (masaustunde C tusu ayni).
ui.addEventListener('click',(e)=>{if(screen!=='match')return;const t=(e.target as HTMLElement).closest?.('.scoreboard,.camchip');if(!t)return;if(t.classList.contains('camchip')){camNote=renderer.cycleCamera();camNoteAt=performance.now();menuDirty=true}else openPause();});
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
let x=(held('ArrowRight')?1:0)-(held('ArrowLeft')?1:0)+touch.stickX,z=(held('ArrowDown')?1:0)-(held('ArrowUp')?1:0)+touch.stickZ;const n=Math.hypot(x,z);if(n>1){x/=n;z/=n}const sh=held('KeyD')||held('KeyK');const out={x,z,sprint:held('ShiftLeft')||held('ShiftRight')||held('KeyE')||stickSprint(touch),pass:hit('KeyS')||hit('KeyJ'),through:hit('KeyW')||hit('KeyL'),cross:hit('KeyA')||hit('KeyI'),shootPressed:hit('KeyD')||hit('KeyK'),shootHeld:sh,shootReleased:released.has('KeyD')||released.has('KeyK')||touch.released.has('KeyD')||(!sh&&shootWasDown),switchPlayer:hit('Space')||hit('KeyQ')};shootWasDown=sh;return out;}
function clock(s:MatchState){const football=Math.min(45,Math.floor(s.elapsed/s.halfDuration*45));return `${s.half===2?45+football:football}'`}
function drawRadar(s:MatchState,vt:TeamId,ctl:number){const c=radar.getContext('2d')!;c.clearRect(0,0,308,184);c.fillStyle='#1b6b43';c.fillRect(0,0,308,184);c.strokeStyle='#f8efdb';c.lineWidth=2;c.strokeRect(3,3,302,178);c.beginPath();c.moveTo(154,3);c.lineTo(154,181);c.stroke();for(const p of s.players){c.fillStyle=p.team===vt?'#f7bf30':'#ef4054';c.beginPath();c.arc((p.x/46+1)*154,(p.z/29+1)*92, p.id===ctl?6:4,0,7);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc((s.ball.x/46+1)*154,(s.ball.z/29+1)*92,4,0,7);c.fill();}
function hud(s:MatchState){const vt=net?viewTeam:s.humanTeam,ctl=net?engine.controlOf(vt):s.controlled;const me=s.players[ctl];const my=s.teams[vt],away=s.teams[1-vt];const how=s.phase==='corner'?'ARROWS AIM · A CROSS · S SHORT':s.phase==='throwin'?'ARROWS AIM · S THROW':s.phase==='goalkick'?'S SHORT · D LONG': 'ARROWS AIM · S KICK OFF';const restart=s.restart?`${s.teams[s.restart.team].name.toUpperCase()} ${s.phase==='throwin'?'THROW-IN':s.phase==='corner'?'CORNER':s.phase==='goalkick'?'GOAL KICK':'KICKOFF'}${s.restart.team===vt?`<small>${how}</small>`:'<small>OPPONENT TAKING RESTART</small>'}`:'';const toast=performance.now()-camNoteAt<1600?`<div class="camtoast">📷 ${camNote}</div>`:'';const holder=s.ball.owner===null?null:s.players[s.ball.owner];const keeperHint=holder&&holder.keeper&&holder.team===vt?`<div class="keeper-hint">🧤 KEEPER · ARROWS AIM<small>S SHORT · W THROUGH · D/A LONG</small></div>`:'';ui.innerHTML=`<div class="scoreboard"><div class="club">${my.short}</div><div class="score">${s.score[vt]} – ${s.score[1-vt]}</div><div class="club">${away.short}</div><div class="clock">${s.half===1?'1ST':'2ND'} ${clock(s)}</div></div><div class="attack">YOU: ${my.name.toUpperCase()}<br>ATTACK ${s.attack[vt]>0?'→':'←'}</div><div class="camchip">📷 ${renderer.cameraLabel()}</div><div class="player-info">▲ ${me?.name||'PLAYER'}<div class="stamina"><i style="width:${(me?.stamina||0)*100}%"></i></div></div>${s.charge>0?`<div class="charge"><i style="width:${Math.min(100,s.charge/.6*100)}%"></i></div>`:''}<div class="strip">${isTouchDevice ? 'STICK MOVE · SPRINT HOLD · PASS · THRU · CROSS · SHOOT (HOLD=POWER)<br>SWITCH · CAM · PAUSE' : 'ARROWS MOVE · E/SHIFT SPRINT · S PASS / TACKLE · W THROUGH · A CROSS · D SHOOT / SLIDE<br>Q/SPACE SWITCH · C CAMERA · ESC PAUSE · M ' + (muted ? 'UNMUTE' : 'MUTE')}</div>${toast}${keeperHint}${!restart&&s.messageTime>0?`<div class="message">${s.message}<small>${s.phase==='goal'?'KICKOFF IN A MOMENT':''}</small></div>`:''}${restart?`<div class="message">${restart}</div>`:''}`;ui.append(barTop,barBottom,radar);drawRadar(s,vt,ctl);}
function panel(content:string){ui.innerHTML=`<div class="screen"><div class="panel">${content}</div></div>`;wireMenuItems();}
/** Touch/mouse: tapping a menu item selects it (keyboard flow unchanged). */
function wireMenuItems() {
  ui.querySelectorAll<HTMLElement>('.menu-item[data-mi]').forEach(el => {
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    el.onclick = () => { menuIndex = Number(el.dataset.mi); menuDirty = true; handleMenuEnter(); };
  });
  ui.querySelectorAll<HTMLElement>('.netbtn').forEach(el => {
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    el.onclick = () => handleMenuEnter(el.dataset.act);
  });
  const code = ui.querySelector<HTMLTextAreaElement>('.netcode');
  if (code && code.readOnly) code.onclick = () => { code.focus(); code.select(); };
}
function menu(){ if(!menuDirty)return; menuDirty=false;
  if(screen==='title') { const items=['PLAY MATCH','ONLINE MATCH','LEAGUE']; panel(`<div class="eyebrow">ARCADE FOOTBALL · 1998</div><div class="title">RETRO<br>FOOTBALL</div><div class="subtitle">SATURDAY CUP</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">${isTouchDevice ? 'TOUCH READY · TAP OK' : 'KEYBOARD ONLY · PRESS ENTER'}<br>ARROWS TO MOVE · S PASS · W THROUGH · A CROSS · D SHOOT · C CAMERA${isTouchDevice ? '<br>OR LEFT STICK + BUTTONS' : ''}</div>`); wireMenuItems(); return; }
  if(screen==='team') { const t=TEAMS[teamIndex],o=TEAMS[(teamIndex+1)%TEAMS.length]; panel(`<div class="eyebrow">CHOOSE YOUR CLUB</div><div class="title" style="font-size:34px">SATURDAY CUP</div><div class="team-row"><div class="team-card active"><div class="team-swatch" style="background:${t.color}"></div>${t.name}<br><small>${t.city}</small></div><div class="team-card"><div class="team-swatch" style="background:${o.color}"></div>${o.name}<br><small>OPPONENT</small></div></div><div class="menu-item selected">${duration/60} MINUTE HALVES</div><div class="hint">← / → CHANGE TEAM · ↑ / ↓ CHANGE LENGTH<br>ENTER KICK OFF · ESC BACK</div>`); return; }
  if(screen==='pause') { const items=['RESUME','RESTART MATCH','MAIN MENU']; panel(`<div class="eyebrow">MATCH PAUSED</div><div class="title" style="font-size:38px">PAUSE</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">ARROWS MOVE · E/SHIFT SPRINT · S PASS/TACKLE · W THROUGH · A CROSS · D SHOOT/SLIDE<br>Q/SPACE SWITCH · C CAMERA (${renderer.cameraLabel()}) · ↑ / ↓ SELECT · ENTER CONFIRM · ESC RESUME</div>`); return; }
  if(screen==='online') { const items=['CREATE ROOM','JOIN ROOM','BACK']; panel(`<div class="eyebrow">PLAY ONLINE · P2P LOCKSTEP</div><div class="title" style="font-size:38px">ONLINE</div><div class="subtitle">${TEAMS[teamIndex].short} · ${duration/60} MIN HALVES</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">HOST READS OUT A 6-LETTER CODE · FRIEND JOINS · BOTH PRESS READY<br>USES YOUR TEAM + LENGTH SETTINGS · ↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='netcreate') { panel(`<div class="eyebrow">HOST A ROOM · YOU ARE TEAM 1</div><div class="title" style="font-size:52px">${roomCode || '···'}</div><div class="subtitle">${netStatus || '…'}</div><div class="hint">READ THE CODE TO YOUR FRIEND<br>VIA ${getServerUrl()}</div><div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='netjoin') { panel(`<div class="eyebrow">JOIN A ROOM · YOU ARE TEAM 2</div><div class="title" style="font-size:38px">JOIN</div><div class="subtitle">${netStatus || 'TYPE THE HOST CODE'}</div>${roomCode ? '' : `<textarea class="netpaste scorebox" style="width:180px" id="netcode" rows="1" maxlength="6" placeholder="ABCDEF"></textarea><div class="menu-item netbtn" data-act="join">▶ JOIN ROOM</div>`}<div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div><div class="hint">VIA ${getServerUrl()} · CHANGE IN LEAGUE → SERVER</div>`); return; }
  if(screen==='netready') { const items=["I'M READY",'CANCEL']; panel(`<div class="eyebrow">ROOM ${roomCode} · ${TEAMS[teamIndex].short} · ${duration/60} MIN</div><div class="title" style="font-size:38px">READY?</div><div class="subtitle">YOU ${iAmReady ? 'READY ✓' : '…'} · FRIEND ${peerReady ? 'READY ✓' : '…'}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">BOTH SIDES PRESS READY — THEN KICK OFF</div>`); return; }
  if(screen==='league') { const items=['OPEN LEAGUE','CREATE LEAGUE','JOIN LEAGUE','SERVER','BACK']; const saved=getLeagueCode(); panel(`<div class="eyebrow">FRIEND LEAGUES · ROUND ROBIN</div><div class="title" style="font-size:38px">LEAGUE</div><div class="subtitle">${saved ? 'SAVED CODE ' + saved : getServerUrl()}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='leaguecreate') { panel(`<div class="eyebrow">START A FRIEND LEAGUE</div><div class="title" style="font-size:34px">CREATE</div><textarea class="netpaste" id="lgname" rows="2" placeholder="LEAGUE NAME"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-create">▶ CREATE LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leaguejoin') { panel(`<div class="eyebrow">JOIN WITH A 6-LETTER CODE</div><div class="title" style="font-size:34px">JOIN</div><textarea class="netpaste" id="lgcode" rows="1" placeholder="LEAGUE CODE"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-join">▶ JOIN LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leagueserver') { panel(`<div class="eyebrow">WHERE THE LEAGUE SERVER LIVES</div><div class="title" style="font-size:34px">SERVER</div><textarea class="netpaste" id="lgurl" rows="1">${getServerUrl()}</textarea><div class="menu-item netbtn" data-act="save-server">▶ SAVE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leagueview') {
    leagueActions = ['REFRESH'];
    if (leagueData && leagueData.createdBy === getClientId() && leagueData.status === 'lobby' && leagueData.members.length >= 2) leagueActions.push('START SEASON');
    if (myOpenFixtures().length > 0) leagueActions.push('SUBMIT SCORE');
    if (leagueData && leagueData.createdBy === getClientId() && leagueData.fixtures.some((f) => f.status === 'disputed')) leagueActions.push('RESOLVE DISPUTES');
    leagueActions.push('BACK');
    const L = leagueData;
    const fxLine = (f: Fixture) => {
      const score = f.status === 'confirmed' ? ` ${f.homeScore}-${f.awayScore} ✓` : f.status === 'disputed' ? ' ⚠ DISPUTED' : ' · OPEN';
      return `<div class="statline"><span>R${f.round} ${leagueName(f.homeClientId)} v ${leagueName(f.awayClientId)}${score}</span></div>`;
    };
    const table = (L?.standings ?? []).map((r, i) => `<div class="statline"><span>${tableLine(i + 1, r.displayName, r.played, r.points, r.goalsFor, r.goalsAgainst)}</span></div>`).join('');
    panel(`<div class="eyebrow">CODE ${L?.code ?? '…'} · ${(L?.status ?? '').toUpperCase()} · ${L?.members.length ?? 0} PLAYERS</div><div class="title" style="font-size:32px">${(L?.name ?? 'LEAGUE').toUpperCase()}</div>${L ? L.fixtures.map(fxLine).join('') : `<div class="subtitle">${leagueBusy ? 'LOADING…' : leagueMsg}</div>`}${table}${leagueActions.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}${leagueMsg && L ? `<div class="subtitle">${leagueMsg}</div>` : ''}<div class="hint">PLAY THE MATCH FIRST — THEN BOTH SIDES SUBMIT THE SCORE HERE</div>`); return;
  }
  if(screen==='leaguesubmit'||screen==='leagueresolve') {
    const resolving = screen === 'leagueresolve';
    leaguePick = resolving
      ? (leagueData?.fixtures ?? []).filter((f) => f.status === 'disputed')
      : myOpenFixtures();
    const label = (f: Fixture) => `R${f.round} ${leagueName(f.homeClientId)} ${f.status === 'confirmed' ? `${f.homeScore}-${f.awayScore}` : 'v'} ${leagueName(f.awayClientId)}${f.status === 'disputed' ? ' ⚠' : ''}`;
    panel(`<div class="eyebrow">${resolving ? 'CREATOR RULING' : 'PICK YOUR FIXTURE'}</div><div class="title" style="font-size:34px">${resolving ? 'RESOLVE' : 'SUBMIT'}</div>${leaguePick.length === 0 ? '<div class="subtitle">NOTHING TO DO HERE</div>' : ''}${leaguePick.map((f,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${label(f)}</div>`).join('')}<div class="menu-item ${menuIndex===leaguePick.length?'selected':''}" data-mi="${leaguePick.length}">${menuIndex===leaguePick.length?'▶ ':''}BACK</div><div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return;
  }
  if(screen==='leaguescore') {
    const f = scoreFixture;
    const label = f ? `R${f.round} ${leagueName(f.homeClientId)} v ${leagueName(f.awayClientId)}` : '…';
    panel(`<div class="eyebrow">${scoreMode === 'resolve' ? 'CREATOR RULING — FINAL SCORE' : 'WHAT WAS THE FINAL SCORE?'}</div><div class="title" style="font-size:30px">${label}</div><div class="score-row"><div><div class="hint">${f ? leagueName(f.homeClientId) : 'HOME'}</div><textarea class="netpaste scorebox" id="scoreH" rows="1" placeholder="0"></textarea></div><div><div class="hint">${f ? leagueName(f.awayClientId) : 'AWAY'}</div><textarea class="netpaste scorebox" id="scoreA" rows="1" placeholder="0"></textarea></div></div><div class="menu-item netbtn" data-act="do-score">▶ ${scoreMode === 'resolve' ? 'CONFIRM RULING' : 'SEND SCORE'}</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div><div class="hint">BOTH SIDES SUBMIT · MATCHING SCORES CONFIRM · CLASHES GO TO THE CREATOR</div>`); return;
  }
  const s=engine.state,items=['PLAY AGAIN','MAIN MENU']; panel(`<div class="eyebrow">SATURDAY CUP · FINAL SCORE</div><div class="title" style="font-size:42px">FULL TIME</div><div class="subtitle">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
}
function attachDriver(d: NetDriver) {
  d.onEvent = (e) => {
    if (e.type === 'connected') {
      screen = 'netready'; menuIndex = 0; peerReady = false; iAmReady = false; menuDirty = true;
    }
    else if (e.type === 'peerReady') { peerReady = true; menuDirty = true; }
    else if (e.type === 'started') launchNet(d);
    else if (e.type === 'peerPaused') {
      if (e.paused) openPause();
      else if (screen === 'pause' && !engine.state.paused) screen = 'match';
      menuDirty = true;
    }
    else if (e.type === 'peerQuit') { closeNet(); screen = 'title'; menuIndex = 0; menuDirty = true; }
    else if (e.type === 'peerDropped') {
      engine.state.message = 'PEER LEFT — AI TAKES OVER'; engine.state.messageTime = 3;
    }
    else if (e.type === 'error') {
      const msg = e.message.toUpperCase();
      closeNet(); netStatus = msg; screen = 'online'; menuIndex = 0; menuDirty = true;
    }
  };
}
let netGen = 0;
function cancelNet() { netGen++; closeNet(); screen = 'online'; menuIndex = 0; menuDirty = true; }
/** Lobby failure: invalidate in-flight async steps, tear down, show why. */
function deadNet(message: string) {
  netGen++; closeNet();
  netStatus = message; screen = 'online'; menuIndex = 0; menuDirty = true;
}
const netMsg = (e: unknown) => e instanceof SignalError ? e.message : 'CONNECTION FAILED';
function hookDriver(d: NetDriver) {
  attachDriver(d); net = d;
}
/** Host flow: create a room, read out the code, auto-connect on join. */
function startHost() {
  if (netBusy) return; netBusy = true;
  const token = ++netGen;
  const alive = () => token === netGen && screen === 'netcreate';
  const fini = (s: AutoSignal) => { try { s.close(); } catch { /* gone */ } };
  netStatus = 'CONNECTING…'; menuDirty = true;
  const signal = new AutoSignal(); sig = signal;
  signal.connect(getServerUrl()).then(async () => {
    if (!alive()) return fini(signal);
    try {
      const created = await signal.createRoom(getClientId());
      if (!alive()) return fini(signal);
      roomCode = created.roomCode; matchToken = created.matchToken;
      netStatus = 'WAITING FOR FRIEND…'; menuDirty = true;
    } catch (e) { if (alive()) deadNet(netMsg(e)); }
  }).catch((e) => { if (alive()) deadNet(netMsg(e)); });
  signal.onPeerJoined = (peer) => {
    if (!alive() || peerId) return;
    peerId = peer; netStatus = 'FRIEND JOINED · CONNECTING…'; menuDirty = true;
    void (async () => {
      try {
        const { transport, offer } = await RTCTransport.createOfferSdp();
        if (!alive()) { transport.close(); return; }
        netOffer = transport;
        signal.sendSignal(peer, offer);
        netStatus = 'CONNECTING…'; menuDirty = true;
      } catch { if (alive()) deadNet('WEBRTC UNAVAILABLE HERE'); }
    })();
  };
  signal.onPeerSignal = (from, sdp) => {
    if (!alive() || from !== peerId || !netOffer || sdp.type !== 'answer') return;
    const offer = netOffer; netOffer = null;
    void offer.acceptAnswerSdp(sdp).then(() => {
      if (!alive()) { offer.close(); return; }
      hookDriver(new NetDriver(offer, { host: true, teamIndex, duration, matchToken }));
    }).catch(() => { if (alive()) deadNet('BAD ANSWER'); });
  };
  signal.onPeerLeft = () => { if (alive()) deadNet('FRIEND LEFT'); };
}
/** Guest flow: type the host code, land directly in the room. */
function startJoin(code: string) {
  if (netBusy) return; netBusy = true;
  const token = ++netGen;
  const alive = () => token === netGen && screen === 'netjoin';
  const fini = (s: AutoSignal) => { try { s.close(); } catch { /* gone */ } };
  netStatus = 'JOINING…'; menuDirty = true;
  const signal = new AutoSignal(); sig = signal;
  signal.connect(getServerUrl()).then(async () => {
    if (!alive()) return fini(signal);
    try {
      const joined = await signal.joinRoom(code, getClientId());
      if (!alive()) return fini(signal);
      roomCode = joined.roomCode; matchToken = joined.matchToken;
      netStatus = 'JOINED · WAITING FOR HOST…'; menuDirty = true;
    } catch (e) { if (alive()) deadNet(netMsg(e)); }
  }).catch((e) => { if (alive()) deadNet(netMsg(e)); });
  signal.onPeerSignal = (from, sdp) => {
    if (!alive() || net || sdp.type !== 'offer') return;
    peerId = from; netStatus = 'CONNECTING…'; menuDirty = true;
    void RTCTransport.acceptOfferSdp(sdp).then(({ transport, answer }) => {
      if (!alive()) { transport.close(); return; }
      try { signal.sendSignal(from, answer); }
      catch { transport.close(); if (alive()) deadNet('SIGNAL LOST'); return; }
      hookDriver(new NetDriver(transport, { host: false, matchToken }));
    }).catch(() => { if (alive()) deadNet('BAD ROOM CODE'); });
  };
  signal.onPeerLeft = () => { if (alive()) deadNet('HOST LEFT'); };
}
function doJoin() {
  const code = normalizeCode(areaVal('netcode'));
  if (!code) { netStatus = 'BAD CODE — 6 LETTERS, NO 0/O/1/I'; menuDirty = true; return; }
  startJoin(code);
}
function doReady() {
  if (!net || iAmReady) return;
  iAmReady = true; net.setReady(); menuDirty = true;
}
function areaVal(id: string): string {
  return (ui.querySelector<HTMLTextAreaElement>(`#${id}`)?.value || '').trim();
}
async function doLeagueCreate() {
  if (leagueBusy) return;
  const name = areaVal('lgname'), who = areaVal('lgwho');
  if (!name || !who) { leagueMsg = 'NAME + NICKNAME NEEDED'; menuDirty = true; return; }
  leagueBusy = true; leagueMsg = 'CREATING…'; menuDirty = true;
  try {
    const { code } = await leagueApi().createLeague(name.slice(0, 48), getClientId(), who.slice(0, 24));
    setDisplayName(who.slice(0, 24)); setLeagueCode(code);
    leagueMsg = ''; await refreshLeague(true);
    screen = 'leagueview'; menuIndex = 0;
  } catch (e) { leagueMsg = e instanceof LeagueApiError ? e.message : 'CREATE FAILED'; }
  leagueBusy = false; menuDirty = true;
}
async function doLeagueJoin() {
  if (leagueBusy) return;
  const code = normalizeCode(areaVal('lgcode')), who = areaVal('lgwho');
  if (!code) { leagueMsg = 'BAD CODE — 6 LETTERS, NO 0/O/1/I'; menuDirty = true; return; }
  if (!who) { leagueMsg = 'NICKNAME NEEDED'; menuDirty = true; return; }
  leagueBusy = true; leagueMsg = 'JOINING…'; menuDirty = true;
  try {
    await leagueApi().joinLeague(code, getClientId(), who.slice(0, 24));
    setDisplayName(who.slice(0, 24)); setLeagueCode(code);
    leagueMsg = ''; await refreshLeague(true);
    screen = 'leagueview'; menuIndex = 0;
  } catch (e) { leagueMsg = e instanceof LeagueApiError ? e.message : 'JOIN FAILED'; }
  leagueBusy = false; menuDirty = true;
}
async function doLeagueStart() {
  if (leagueBusy || !leagueData) return;
  leagueBusy = true; leagueMsg = 'DRAWING FIXTURES…'; menuDirty = true;
  try {
    await leagueApi().startLeague(leagueData.id, getClientId());
    await refreshLeague(true);
  } catch (e) { leagueMsg = e instanceof LeagueApiError ? e.message : 'START FAILED'; }
  leagueBusy = false; menuIndex = 0; menuDirty = true;
}
async function doLeagueScore() {
  if (leagueBusy || !scoreFixture) return;
  const hs = parseScore(areaVal('scoreH')), as = parseScore(areaVal('scoreA'));
  if (hs === null || as === null) { leagueMsg = 'SCORES 0-99 ONLY'; menuDirty = true; return; }
  leagueBusy = true; leagueMsg = 'SENDING…'; menuDirty = true;
  try {
    if (scoreMode === 'resolve') {
      await leagueApi().resolveResult(scoreFixture.id, getClientId(), hs, as);
    } else {
      // No room token for a manually reported score: fresh random audit id per
      // submission. Agreement of both sides is the real check (ADR-004).
      await leagueApi().submitResult(scoreFixture.id, getClientId(), hs, as, makeClientId() + makeClientId());
    }
    await refreshLeague(true);
    screen = scoreMode === 'resolve' ? 'leagueresolve' : 'leaguesubmit'; menuIndex = 0;
  } catch (e) { leagueMsg = e instanceof LeagueApiError ? e.message : 'SUBMIT FAILED'; }
  leagueBusy = false; menuDirty = true;
}
function handleMenuEnter(act?: string) {
  if (screen === 'title') {
    if (menuIndex === 0) screen = 'team';
    else if (menuIndex === 1) screen = 'online';
    else { screen = 'league'; menuIndex = 0; leagueMsg = ''; }
  }
  else if (screen === 'team') launch();
  else if (screen === 'online') {
    if (menuIndex === 0) { screen = 'netcreate'; menuIndex = 0; roomCode = ''; netStatus = ''; startHost(); }
    else if (menuIndex === 1) { screen = 'netjoin'; menuIndex = 0; roomCode = ''; netStatus = ''; }
    else screen = 'title';
  }
  else if (screen === 'netcreate') {
    if (act === 'cancel') cancelNet();
  }
  else if (screen === 'netjoin') {
    if (act === 'cancel') cancelNet(); else if (act === 'join') doJoin();
  }
  else if (screen === 'netready') {
    if (menuIndex === 0) doReady(); else cancelNet();
  }
  else if (screen === 'league') {
    if (menuIndex === 0) { screen = 'leagueview'; menuIndex = 0; leagueMsg = ''; refreshLeague(); }
    else if (menuIndex === 1) { screen = 'leaguecreate'; leagueMsg = ''; }
    else if (menuIndex === 2) { screen = 'leaguejoin'; leagueMsg = ''; }
    else if (menuIndex === 3) { screen = 'leagueserver'; leagueMsg = ''; }
    else screen = 'title';
    menuIndex = 0;
  }
  else if (screen === 'leaguecreate' || screen === 'leaguejoin') {
    if (act === 'back') { screen = 'league'; menuIndex = 0; }
    else if (screen === 'leaguecreate') doLeagueCreate();
    else doLeagueJoin();
  }
  else if (screen === 'leagueserver') {
    if (act === 'back') { screen = 'league'; menuIndex = 0; }
    else {
      const url = areaVal('lgurl').replace(/\/+$/, '');
      if (!/^https?:\/\/.+/.test(url)) leagueMsg = 'URL MUST START WITH HTTP(S)';
      else { setServerUrl(url); leagueMsg = 'SAVED'; screen = 'league'; menuIndex = 0; }
    }
  }
  else if (screen === 'leagueview') {
    const a = leagueActions[menuIndex] ?? 'BACK';
    if (a === 'REFRESH') refreshLeague();
    else if (a === 'START SEASON') doLeagueStart();
    else if (a === 'SUBMIT SCORE') { screen = 'leaguesubmit'; menuIndex = 0; }
    else if (a === 'RESOLVE DISPUTES') { screen = 'leagueresolve'; menuIndex = 0; }
    else { screen = 'league'; menuIndex = 0; }
  }
  else if (screen === 'leaguesubmit' || screen === 'leagueresolve') {
    if (menuIndex >= leaguePick.length) screen = 'leagueview';
    else {
      scoreFixture = leaguePick[menuIndex];
      scoreMode = screen === 'leagueresolve' ? 'resolve' : 'submit';
      leagueMsg = ''; screen = 'leaguescore';
    }
    menuIndex = 0;
  }
  else if (screen === 'leaguescore') {
    if (act === 'back') { screen = scoreMode === 'resolve' ? 'leagueresolve' : 'leaguesubmit'; menuIndex = 0; }
    else doLeagueScore();
  }
  else if (screen === 'pause') {
    if (menuIndex === 0) resumePlay();
    else if (menuIndex === 1) launch();
    else { closeNet(); screen = 'title'; }
  }
  else if (screen === 'half') {
    if (net && viewTeam === 1) return; // guest waits for the host
    engine.continueHalf(); if (net) net.broadcastHalf(); screen = 'match'; audio.event({ type: 'whistle' });
  }
  else if (screen === 'full') {
    if (menuIndex === 0 && !net) launch();
    else { closeNet(); screen = 'title'; }
  }
  menuDirty = true;
}
function handleMenu(){if(pressed.size||released.size||touch.pressed.size||touch.released.size)menuDirty=true;if(hit('KeyM')){muted=audio.toggle();consume('KeyM')}if(screen==='match'){if(hit('Escape')){consume('Escape');openPause()}if(hit('KeyC')){camNote=renderer.cycleCamera();camNoteAt=performance.now();consume('KeyC')}return}const confirm=hit('Enter');if(confirm)consume('Enter');const up=hit('KeyW')||hit('ArrowUp'),dn=hit('KeyS')||hit('ArrowDown');if(screen==='title'){if(up||dn)menuIndex=(menuIndex+(up?2:1))%3;if(hit('Escape'))menuIndex=0;if(confirm)handleMenuEnter()}else if(screen==='team'){if(hit('KeyA')||hit('ArrowLeft'))teamIndex=(teamIndex+3)%4;if(hit('KeyD')||hit('ArrowRight'))teamIndex=(teamIndex+1)%4;if(hit('KeyW')||hit('ArrowUp'))duration=duration===180?600:duration===300?180:300;if(hit('KeyS')||hit('ArrowDown'))duration=duration===180?300:duration===300?600:180;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='online'){if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='netcreate'){if(hit('Escape'))cancelNet();}else if(screen==='netjoin'){if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter('join');}else if(screen==='netready'){if(up||dn)menuIndex=1-menuIndex;if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter();}else if(screen==='league'){if(up)menuIndex=(menuIndex+4)%5;if(dn)menuIndex=(menuIndex+1)%5;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='leaguecreate'||screen==='leaguejoin'||screen==='leagueserver'){if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leagueview'){const n=Math.max(1,leagueActions.length);if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguesubmit'||screen==='leagueresolve'){const n=leaguePick.length+1;if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='leagueview';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguescore'){if(hit('Escape')){screen=scoreMode==='resolve'?'leagueresolve':'leaguesubmit';menuIndex=0}else if(confirm)handleMenuEnter()}else if(screen==='pause'){if(hit('Escape'))resumePlay();if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}else if(screen==='half'){if(confirm)handleMenuEnter()}else if(screen==='full'){if(hit('KeyW')||hit('ArrowUp')||hit('KeyS')||hit('ArrowDown'))menuIndex=1-menuIndex;if(confirm)handleMenuEnter()}menu();}
function frame(now:number){const raw=Math.min(.1,(now-last)/1000);last=now;let stepped=false;if(screen==='match'){handleMenu();if(screen==='match'){if(net&&net.session){net.poll();const f=input();net.frame(f);stepped=true;for(const e of net.session.lastEvents)audio.event(e);renderer.setFollow(engine.controlOf(viewTeam),engine.targetOf(viewTeam));}else{acc+=raw;let first=true;while(acc>=1/60){const f=input();if(!first){f.pass=false;f.through=false;f.cross=false;f.shootPressed=false;f.shootReleased=false;f.switchPlayer=false}engine.update(1/60,f);for(const e of engine.events.splice(0))audio.event(e);first=false;stepped=true;acc-=1/60}}const s=engine.state;if(s.phase==='halftime'){screen='half';menuDirty=true;audio.event({type:'whistle'})}if(s.phase==='fulltime'){screen='full';menuIndex=0;menuDirty=true;audio.event({type:'whistle'})}renderer.render(s,raw);const cine=renderer.inCinematic();barTop.classList.toggle('on',cine);barBottom.classList.toggle('on',cine);if(now-hudAt>66){hud(s);hudAt=now}}}else {renderer.render(engine.state,raw,screen==='title'||screen==='team');barTop.classList.remove('on');barBottom.classList.remove('on');handleMenu()}updateTouchVisibility();if(import.meta.env.DEV&&now-devStatusAt>100){const s=engine.state,p=s.players[s.controlled],b=s.ball;document.body.dataset.match=JSON.stringify({phase:s.phase,screen,half:s.half,elapsed:s.elapsed,time:s.time,score:s.score,controlled:s.controlled,player:{x:p?.x,z:p?.z,vx:p?.vx,vz:p?.vz},ball:{x:b.x,z:b.z,y:b.y,owner:b.owner,flight:b.flight},stats:s.stats});devStatusAt=now}if(screen!=='match'||stepped){pressed.clear();released.clear();clearTouchEdges(touch)}requestAnimationFrame(frame)}
addEventListener('resize',()=>renderer.resize());
// PWA: offline app shell in production only (never cache dev iterations).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if(import.meta.env.DEV) Object.assign(window,{__retro:{get engine(){return engine},snapshot:()=>JSON.parse(JSON.stringify(engine.state)),start:launch}});
menu();requestAnimationFrame(frame);
