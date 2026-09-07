import './style.css';
import { MatchEngine } from './engine';
import { GameRenderer } from './renderer';
import { EMPTY_INPUT, TEAMS, type InputFrame, type MatchState, type TeamId } from './types';
import { MatchAudio } from './audio/audio';
import { createTouchState, clearTouchEdges, resetTouch } from './input/touch';
import { createKeyboardState, keyDown, keyUp, isBlockedKey, clearKeyboardEdges, resetKeyboard } from './input/keyboard';
import { buildInputFrame } from './input/input';
import { setupTouchControls } from './ui/touch-controls';
import { NetDriver } from './net/driver';
import { RTCTransport, isIcePayload } from './net/transport';
import type { SignalPayload } from './net/transport';
import { AutoSignal } from './net/autosignal';
import { CloudflareSignalingClient } from './net/cloudflare-signal';
import type { SignalingClient } from './net/signaling';
import { makeClientId } from './net/signal';
import {
  buildInviteUrl, canShare, copyText, friendlyNetError, inviteCodeFromSearch, normalizeRoomCode,
} from './net/invite';
import {
  LeagueApi, LeagueApiError, dailyKey, dailySeed, getClientId, getDailyBest, getDisplayName, getLeagueCode, getServerUrl,
  normalizeCode, parseScore, setDailyBest, setDisplayName, setLeagueCode, setServerUrl, tableLine,
  type Fixture, type League,
} from './league/client';

type Screen = 'title'|'team'|'match'|'pause'|'half'|'full'|'online'|'host'|'join'|'joining'|'netready'
  |'league'|'leaguecreate'|'leaguejoin'|'leagueserver'|'leagueview'|'leaguesubmit'|'leagueresolve'|'leaguescore';
const app=document.querySelector<HTMLDivElement>('#app')!;
const renderer=new GameRenderer(app); const audio=new MatchAudio();
const flowTest=import.meta.env.DEV&&new URLSearchParams(location.search).has('test');
let screen:Screen='title', menuIndex=0, teamIndex=0, duration=180, engine=new MatchEngine(0,180,1), last=performance.now(), acc=0, muted=audio.isMuted, devStatusAt=0, hudAt=0, menuDirty=true;
// Online match rides on serverless WebRTC invite links — live today.
const NET_LIVE = true;
// Friend leagues need the signaling/league server; COMING SOON until hosted.
const LEAGUES_LIVE = false;
let titleNote = '';
// Online (Cloudflare-room P2P lockstep) state. Null driver = local AI match.
let net: NetDriver | null = null;
let viewTeam: TeamId = 0;
let netStatus = '', netBusy = false;
let netOffer: RTCTransport | null = null;
// Daily Cup state: seeded engine + best-score persistence (visual only).
let dailyMode = false;
// Room session: 6-char code the friend taps or types; the matchToken binding
// the handshake arrives over the room socket (never in the URL, never logged).
let sig: SignalingClient | null = null;
let roomCode = '', matchToken = '', peerId = '';
let peerReady = false, iAmReady = false;
// Shareable invite for the current host room (code only, no SDP/secrets).
let inviteUrl = '', copyNote = '';
// Pending auto-join code from an invite link (startup ?room=…).
let pendingInvite: string | null = null;
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
const kb = createKeyboardState();
const down = kb.down, pressed = kb.pressed, released = kb.released;
let shootWasDown = false;
const touch=createTouchState();
const isTouchDevice=matchMedia('(pointer: coarse)').matches||'ontouchstart' in window;
const ui=document.createElement('div');ui.className='ui';app.append(ui);
const barTop=document.createElement('div');barTop.className='cinebar top';ui.append(barTop);
const barBottom=document.createElement('div');barBottom.className='cinebar bottom';ui.append(barBottom);
let camNote='',camNoteAt=0;let slowmoUntil=0;
const radar=document.createElement('canvas'); radar.className='radar';radar.width=308;radar.height=184;
function keyName(e:KeyboardEvent){return e.code}
addEventListener('keydown',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyDown(kb, keyName(e));audio.enable();});
addEventListener('keyup',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyUp(kb, keyName(e));});
addEventListener('blur',()=>{resetKeyboard(kb);resetTouch(touch);if(screen==='match')openPause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='match')openPause();});
const hit=(k:string)=>pressed.has(k)||touch.pressed.has(k); const held=(k:string)=>down.has(k)||touch.down.has(k);
const consume=(k:string)=>{pressed.delete(k);touch.pressed.delete(k);};
function launch(){closeNet();dailyMode=false;engine=new MatchEngine(teamIndex,flowTest?8:duration,Math.floor(Math.random()*999999));viewTeam=0;renderer.setFollow(null,null);screen='match';menuIndex=0;audio.event({type:'whistle'});}
/** Daily Cup: one deterministic match per calendar day, same seed worldwide. */
function launchDaily(){closeNet();dailyMode=true;engine=new MatchEngine(teamIndex,flowTest?8:duration,dailySeed());viewTeam=0;renderer.setFollow(null,null);screen='match';menuIndex=0;audio.event({type:'whistle'});}
/** Full-time share card: score + stats as a PNG via Web Share (or download). */
function shareResult(){
  const s=engine.state,my=s.teams[0],opp=s.teams[1];
  const c=document.createElement('canvas');c.width=1000;c.height=525;
  const x=c.getContext('2d')!;x.textAlign='center';
  x.fillStyle='#0c1f14';x.fillRect(0,0,1000,525);
  x.fillStyle='#f8efdb';x.font='bold 26px monospace';x.fillText(dailyMode?'FLOODLIGHT FOOTBALL · DAILY CUP':'FLOODLIGHT FOOTBALL · SATURDAY CUP',500,70);
  x.fillStyle=my.color;x.fillRect(130,110,44,44);x.fillStyle=opp.color;x.fillRect(826,110,44,44);
  x.fillStyle='#f8efdb';x.font='bold 34px monospace';
  x.fillText(my.name.toUpperCase(),340,142);x.fillText(opp.name.toUpperCase(),660,142);
  x.font='bold 110px monospace';x.fillText(`${s.score[0]} – ${s.score[1]}`,500,265);
  x.font='bold 24px monospace';x.fillStyle='#9fd7b2';
  const pos=Math.round(s.stats.possession[0]/Math.max(1,s.stats.possession[0]+s.stats.possession[1])*100);
  x.fillText(`SHOTS ${s.stats.shots[0]}–${s.stats.shots[1]}   SAVES ${s.stats.saves[0]}–${s.stats.saves[1]}   BALL ${pos}%`,500,330);
  if(dailyMode)x.fillText(`DAILY BEST ${Math.max(getDailyBest(),s.score[0])}`,500,385);
  x.fillStyle='#6f8f7c';x.font='22px monospace';x.fillText('FREE · OPEN SOURCE · PLAY IN YOUR BROWSER',500,470);
  c.toBlob((blob)=>{
    if(!blob)return;
    const file=new File([blob],'floodlight-result.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]}))void navigator.share({files:[file],title:'Floodlight Football'}).catch(()=>{});
    else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='floodlight-result.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
  });
}
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
  inviteUrl = ''; copyNote = '';
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
// DOM lives in ui/touch-controls.ts; app orchestration (screen, audio) stays here.
const touchControls = setupTouchControls(app, touch, isTouchDevice, () => audio.enable());
const touchLayer = touchControls.touchLayer;

function updateTouchVisibility() {
  touchControls.updateVisibility(screen);
}
function input():InputFrame {
  const { frame, shootWasDown: next } = buildInputFrame(kb, touch, shootWasDown);
  shootWasDown = next;
  return frame;
}
function clock(s:MatchState){const football=Math.min(45,Math.floor(s.elapsed/s.halfDuration*45));return `${s.half===2?45+football:football}'`}
function drawRadar(s:MatchState,vt:TeamId,ctl:number){const c=radar.getContext('2d')!;c.clearRect(0,0,308,184);c.fillStyle='#1b6b43';c.fillRect(0,0,308,184);c.strokeStyle='#f8efdb';c.lineWidth=2;c.strokeRect(3,3,302,178);c.beginPath();c.moveTo(154,3);c.lineTo(154,181);c.stroke();for(const p of s.players){c.fillStyle=p.team===vt?'#f7bf30':'#ef4054';c.beginPath();c.arc((p.x/46+1)*154,(p.z/29+1)*92, p.id===ctl?6:4,0,7);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc((s.ball.x/46+1)*154,(s.ball.z/29+1)*92,4,0,7);c.fill();}
function hud(s:MatchState){const vt=net?viewTeam:s.humanTeam,ctl=net?engine.controlOf(vt):s.controlled;const me=s.players[ctl];const my=s.teams[vt],away=s.teams[1-vt];const how=s.phase==='corner'?'ARROWS AIM · A CROSS · S SHORT':s.phase==='throwin'?'ARROWS AIM · S THROW':s.phase==='goalkick'?'S SHORT · D LONG': 'ARROWS AIM · S KICK OFF';const restart=s.restart?`${s.teams[s.restart.team].name.toUpperCase()} ${s.phase==='throwin'?'THROW-IN':s.phase==='corner'?'CORNER':s.phase==='goalkick'?'GOAL KICK':'KICKOFF'}${s.restart.team===vt?`<small>${how}</small>`:'<small>OPPONENT TAKING RESTART</small>'}`:'';const toast=performance.now()-camNoteAt<1600?`<div class="camtoast">📷 ${camNote}</div>`:'';const holder=s.ball.owner===null?null:s.players[s.ball.owner];const keeperHint=holder&&holder.keeper&&holder.team===vt?`<div class="keeper-hint">🧤 KEEPER · ARROWS AIM<small>S SHORT · W THROUGH · D/A LONG</small></div>`:holder&&holder.keeper?`<div class="keeper-hint">🧤 OPPONENT KEEPER PROTECTED<small>THEY'LL BACK OFF — PRESSURE COMES LATER</small></div>`:'';ui.innerHTML=`<div class="scoreboard"><div class="club">${my.short}</div><div class="score">${s.score[vt]} – ${s.score[1-vt]}</div><div class="club">${away.short}</div><div class="clock">${s.half===1?'1ST':'2ND'} ${clock(s)}</div></div><div class="attack">YOU: ${my.name.toUpperCase()}<br>ATTACK ${s.attack[vt]>0?'→':'←'}</div><div class="camchip">📷 ${renderer.cameraLabel()}</div><div class="player-info">▲ ${me?.name||'PLAYER'}<div class="stamina"><i style="width:${(me?.stamina||0)*100}%"></i></div></div>${s.charge>0?`<div class="charge"><i style="width:${Math.min(100,s.charge/.6*100)}%"></i></div>`:''}<div class="strip">${isTouchDevice ? 'STICK MOVE · SPRINT HOLD · PASS · THRU · CROSS · SHOOT (HOLD=POWER)<br>SWITCH · CAM · PAUSE' : 'ARROWS MOVE · E/SHIFT SPRINT · S PASS / TACKLE · W THROUGH · A CROSS · D SHOOT (HOLD=POWER · E+D DRIVEN) / SLIDE<br>Q/SPACE SWITCH · C CAMERA · ESC PAUSE · M ' + (muted ? 'UNMUTE' : 'MUTE')}</div>${toast}${keeperHint}${!restart&&s.messageTime>0?`<div class="message">${s.message}<small>${s.phase==='goal'?'KICKOFF IN A MOMENT':''}</small></div>`:''}${restart?`<div class="message">${restart}</div>`:''}`;ui.append(barTop,barBottom,radar);drawRadar(s,vt,ctl);}
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
  if(screen==='title') { const items=LEAGUES_LIVE?['PLAY MATCH','ONLINE MATCH','DAILY CUP','LEAGUE']:['PLAY MATCH','ONLINE MATCH','DAILY CUP','LEAGUE · COMING SOON']; panel(`<div class="eyebrow">ARCADE FOOTBALL · 1998</div><div class="title">FLOODLIGHT<br>FOOTBALL</div><div class="subtitle">SATURDAY CUP</div>${titleNote?`<div class="message">${titleNote}</div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">${isTouchDevice ? 'TOUCH READY · TAP OK' : 'KEYBOARD ONLY · PRESS ENTER'}<br>ARROWS TO MOVE · S PASS · W THROUGH · A CROSS · D SHOOT · C CAMERA${isTouchDevice ? '<br>OR LEFT STICK + BUTTONS' : ''}</div>`); wireMenuItems(); return; }
  if(screen==='team') { const t=TEAMS[teamIndex],o=TEAMS[(teamIndex+1)%TEAMS.length]; panel(`<div class="eyebrow">CHOOSE YOUR CLUB</div><div class="title" style="font-size:34px">SATURDAY CUP</div><div class="team-row"><div class="team-card active"><div class="team-swatch" style="background:${t.color}"></div>${t.name}<br><small>${t.city}</small></div><div class="team-card"><div class="team-swatch" style="background:${o.color}"></div>${o.name}<br><small>OPPONENT</small></div></div><div class="menu-item selected">${duration/60} MINUTE HALVES</div><div class="hint">← / → CHANGE TEAM · ↑ / ↓ CHANGE LENGTH<br>ENTER KICK OFF · ESC BACK</div>`); return; }
  if(screen==='pause') { const items=['RESUME','RESTART MATCH','MAIN MENU']; panel(`<div class="eyebrow">MATCH PAUSED</div><div class="title" style="font-size:38px">PAUSE</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">ARROWS MOVE · E/SHIFT SPRINT · S PASS/TACKLE · W THROUGH · A CROSS · D SHOOT/SLIDE<br>Q/SPACE SWITCH · C CAMERA (${renderer.cameraLabel()}) · ↑ / ↓ SELECT · ENTER CONFIRM · ESC RESUME</div>`); return; }
  if(screen==='online') { const items=['PLAY WITH A FRIEND','JOIN WITH CODE','BACK']; panel(`<div class="eyebrow">PLAY ONLINE · FRIEND MATCH</div><div class="title" style="font-size:38px">ONLINE</div><div class="subtitle">${TEAMS[teamIndex].short} · ${duration/60} MIN HALVES</div>${netStatus?`<div class="subtitle">${netStatus}</div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='host') { const share = canShare(); panel(`<div class="eyebrow">SHARE THE LINK · YOU ARE TEAM 1</div><div class="title" style="font-size:52px">${roomCode || '···'}</div><div class="subtitle">${netStatus || '…'}</div>${inviteUrl?`<textarea class="netpaste scorebox netcode" id="invitelink" rows="2" readonly>${inviteUrl}</textarea>${copyNote?`<div class="hint">${copyNote}</div>`:''}<div class="menu-item netbtn" data-act="copy">▶ COPY LINK</div>${share?`<div class="menu-item netbtn" data-act="share">▶ SHARE</div>`:''}`:''}<div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='join') { panel(`<div class="eyebrow">ENTER THE FRIEND CODE</div><div class="title" style="font-size:38px">JOIN</div><div class="subtitle">${netStatus || 'TYPE THE 6-LETTER CODE'}</div>${roomCode ? '' : `<textarea class="netpaste scorebox" style="width:180px" id="netcode" rows="1" maxlength="6" placeholder="ABCDEF"></textarea><div class="menu-item netbtn" data-act="join">▶ JOIN</div>`}<div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='joining') { panel(`<div class="eyebrow">JOINING MATCH…</div><div class="title" style="font-size:38px">${roomCode || '···'}</div><div class="subtitle">${netStatus || 'JOINING MATCH…'}</div><div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
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
  const s=engine.state,items=['PLAY AGAIN','MAIN MENU','SHARE RESULT']; panel(`<div class="eyebrow">${dailyMode?'DAILY CUP · FINAL SCORE':'SATURDAY CUP · FINAL SCORE'}</div><div class="title" style="font-size:42px">FULL TIME</div><div class="subtitle">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>${dailyMode?`<div class="statline"><span>DAILY BEST<strong>${Math.max(getDailyBest(),s.score[0])}</strong></span></div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
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
const netMsg = (e: unknown) => friendlyNetError(e);
function hookDriver(d: NetDriver) {
  attachDriver(d); net = d;
}
/**
 * Online signaling always targets the same origin that served the game
 * (Worker + Static Assets, no backend configuration). The Node server stays
 * as the self-hosted reference: if this origin speaks the legacy /socket
 * protocol instead (Docker/Caddy self-host), fall back to it. Either way the
 * match itself stays WebRTC P2P; solo never gets here.
 */
async function connectSignal(): Promise<SignalingClient> {
  const base = location.origin;
  const cf = new CloudflareSignalingClient();
  try {
    await cf.connect(base, 5000);
    return cf;
  } catch {
    /* not a Cloudflare control plane — try the Node reference */
  }
  const legacy = new AutoSignal();
  await legacy.connect(base);
  return legacy;
}
function webrtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}
/** Wire trickle ICE both ways between one transport and the room socket. */
function relayIce(transport: RTCTransport, signal: SignalingClient, peer: () => string | null) {
  transport.onCandidate = (c) => {
    const to = peer();
    if (!to) return;
    try {
      signal.sendSignal(to, c);
    } catch {
      /* socket closing; the data channel may still connect */
    }
  };
}
/** Host flow: create the Cloudflare room FIRST, then produce the invite URL. */
function startHost() {
  if (netBusy) return; netBusy = true;
  if (!webrtcSupported()) {
    deadNet('THIS BROWSER CAN’T PLAY ONLINE — TRY CHROME OR SAFARI');
    return;
  }
  const token = ++netGen;
  const alive = () => token === netGen && screen === 'host';
  const fini = (s: SignalingClient) => { try { s.close(); } catch { /* gone */ } };
  netStatus = 'CREATING ROOM…'; inviteUrl = ''; copyNote = ''; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    try {
      signal = await connectSignal();
    } catch (e) { if (alive()) deadNet(netMsg(e)); return; }
    if (!alive()) return fini(signal);
    sig = signal;
    signal.onPeerJoined = (peer) => {
      if (!alive() || peerId) return;
      peerId = peer; netStatus = 'FRIEND FOUND… CONNECTING…'; menuDirty = true;
      void (async () => {
        try {
          const { transport, offer } = await RTCTransport.createOfferTrickle();
          if (!alive()) { transport.close(); return; }
          netOffer = transport;
          relayIce(transport, signal, () => (alive() ? peerId : null));
          signal.sendSignal(peer, offer);
          netStatus = 'CONNECTING…'; menuDirty = true;
        } catch { if (alive()) deadNet('THIS BROWSER CAN’T PLAY ONLINE — TRY CHROME OR SAFARI'); }
      })();
    };
    signal.onPeerSignal = (from, payload) => {
      if (!alive() || from !== peerId || !netOffer) return;
      if (isIcePayload(payload)) {
        void netOffer.addIceCandidate(payload).catch(() => {});
        return;
      }
      if (payload.type !== 'answer') return;
      const offer = netOffer; netOffer = null;
      void offer.acceptAnswerSdp(payload).then(() => {
        if (!alive()) { offer.close(); return; }
        netStatus = 'CONNECTED'; menuDirty = true;
        hookDriver(new NetDriver(offer, { host: true, teamIndex, duration, matchToken }));
      }).catch(() => { if (alive()) deadNet(netMsg('negotiation failed')); });
    };
    signal.onPeerLeft = () => { if (alive()) deadNet('FRIEND LEFT'); };
    try {
      const created = await signal.createRoom(getClientId());
      if (!alive()) return fini(signal);
      roomCode = created.roomCode; matchToken = created.matchToken;
      inviteUrl = buildInviteUrl(location.origin, location.pathname, roomCode);
      netStatus = 'WAITING FOR FRIEND…'; menuDirty = true;
    } catch (e) { if (alive()) deadNet(netMsg(e)); }
  })();
}
/**
 * Single Cloudflare join implementation. Both the tapped invite link and the
 * manually typed code converge here: joinRoom(code) → signaling → WebRTC →
 * NetDriver → ready lobby. No reply codes, no SDP in the UI.
 */
function cloudJoin(code: string) {
  if (netBusy) return; netBusy = true;
  if (!webrtcSupported()) {
    deadNet('THIS BROWSER CAN’T PLAY ONLINE — TRY CHROME OR SAFARI');
    return;
  }
  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    netGen++; closeNet();
    netStatus = 'INVITE EXPIRED — ASK FOR A NEW LINK'; screen = 'online'; menuIndex = 0; menuDirty = true;
    return;
  }
  const token = ++netGen;
  const alive = () => token === netGen && (screen === 'join' || screen === 'joining');
  const fini = (s: SignalingClient) => { try { s.close(); } catch { /* gone */ } };
  netStatus = 'JOINING MATCH…'; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    try {
      signal = await connectSignal();
    } catch (e) {
      if (alive()) {
        netGen++; closeNet();
        netStatus = netMsg(e); screen = 'online'; menuIndex = 0; menuDirty = true;
      }
      return;
    }
    if (!alive()) return fini(signal);
    sig = signal;
    let answered = false;
    signal.onPeerSignal = (from, payload) => {
      if (!alive() || net || answered) return;
      if (isIcePayload(payload)) {
        // Candidate arriving before the offer (reordered relay): stash it and
        // flush into the answer transport once it exists.
        pendingCandidates.push(payload);
        return;
      }
      if (payload.type !== 'offer') return;
      answered = true;
      peerId = from; netStatus = 'FRIEND FOUND… CONNECTING…'; menuDirty = true;
      void RTCTransport.acceptOfferTrickle(payload).then(({ transport, answer }) => {
        if (!alive()) { transport.close(); return; }
        relayIce(transport, signal, () => (alive() ? peerId : null));
        for (const c of pendingCandidates) void transport.addIceCandidate(c).catch(() => {});
        pendingCandidates = [];
        try { signal.sendSignal(from, answer); }
        catch { transport.close(); if (alive()) failJoin('SIGNAL LOST'); return; }
        netStatus = 'CONNECTED'; menuDirty = true;
        hookDriver(new NetDriver(transport, { host: false, matchToken }));
      }).catch(() => { if (alive()) failJoin('negotiation failed'); });
    };
    let pendingCandidates: SignalPayload[] = [];
    const failJoin = (reason: unknown) => {
      if (!alive()) return;
      netGen++; closeNet();
      netStatus = netMsg(reason); screen = 'online'; menuIndex = 0; menuDirty = true;
    };
    signal.onPeerLeft = () => { if (alive()) failJoin('HOST LEFT'); };
    try {
      const joined = await signal.joinRoom(normalized, getClientId());
      if (!alive()) return fini(signal);
      roomCode = joined.roomCode; matchToken = joined.matchToken;
      netStatus = joined.peers.length > 0 ? 'FRIEND FOUND… CONNECTING…' : 'CONNECTING… WAITING FOR HOST…';
      menuDirty = true;
    } catch (e) { if (alive()) failJoin(e); }
  })();
}
function doJoin() {
  const raw = areaVal('netcode');
  const code = normalizeRoomCode(raw) ?? raw;
  if (!normalizeRoomCode(raw)) {
    netStatus = 'INVALID CODE — CHECK AND TRY AGAIN'; menuDirty = true; return;
  }
  cloudJoin(code);
}
function doCopyLink() {
  if (!inviteUrl) return;
  void copyText(inviteUrl).then((ok) => {
    copyNote = ok ? 'LINK COPIED — SEND IT TO YOUR FRIEND' : 'TAP THE LINK TO SELECT IT';
    menuDirty = true;
  });
}
function doShareLink() {
  if (!inviteUrl) return;
  try {
    const p = (navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }).share?.({
      title: 'Floodlight Football',
      text: `Join my Floodlight match — code ${roomCode}`,
      url: inviteUrl,
    });
    void p?.catch(() => { doCopyLink(); });
  } catch {
    doCopyLink();
  }
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
    if (menuIndex === 0) { screen = 'team'; titleNote = ''; }
    else if (menuIndex === 1) { if (NET_LIVE) screen = 'online'; else titleNote = 'ONLINE MATCH — COMING SOON'; }
    else if (menuIndex === 2) launchDaily();
    else if (LEAGUES_LIVE) { screen = 'league'; menuIndex = 0; leagueMsg = ''; }
    else titleNote = 'FRIEND LEAGUES — COMING SOON';
  }
  else if (screen === 'team') launch();
  else if (screen === 'online') {
    if (menuIndex === 0) { screen = 'host'; menuIndex = 0; roomCode = ''; netStatus = ''; inviteUrl = ''; copyNote = ''; startHost(); }
    else if (menuIndex === 1) { screen = 'join'; menuIndex = 0; roomCode = ''; netStatus = ''; }
    else { screen = 'title'; menuIndex = 0; netStatus = ''; }
  }
  else if (screen === 'host') {
    if (act === 'cancel') cancelNet();
    else if (act === 'copy') doCopyLink();
    else if (act === 'share') doShareLink();
  }
  else if (screen === 'join') {
    if (act === 'cancel') cancelNet(); else if (act === 'join') doJoin();
  }
  else if (screen === 'joining') {
    if (act === 'cancel') cancelNet();
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
    else if (menuIndex === 2) shareResult();
    else { closeNet(); screen = 'title'; }
  }
  menuDirty = true;
}
function handleMenu(){if(pressed.size||released.size||touch.pressed.size||touch.released.size)menuDirty=true;if(hit('KeyM')){muted=audio.toggle();consume('KeyM')}if(screen==='match'){if(hit('Escape')){consume('Escape');openPause()}if(hit('KeyC')){camNote=renderer.cycleCamera();camNoteAt=performance.now();consume('KeyC')}return}const confirm=hit('Enter');if(confirm)consume('Enter');const up=hit('KeyW')||hit('ArrowUp'),dn=hit('KeyS')||hit('ArrowDown');if(screen==='title'){if(up||dn)menuIndex=(menuIndex+(up?3:1))%4;if(hit('Escape'))menuIndex=0;if(confirm)handleMenuEnter()}else if(screen==='team'){if(hit('KeyA')||hit('ArrowLeft'))teamIndex=(teamIndex+3)%4;if(hit('KeyD')||hit('ArrowRight'))teamIndex=(teamIndex+1)%4;if(hit('KeyW')||hit('ArrowUp'))duration=duration===180?600:duration===300?180:300;if(hit('KeyS')||hit('ArrowDown'))duration=duration===180?300:duration===300?600:180;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='online'){if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='host'){if(hit('Escape'))cancelNet();}else if(screen==='join'){if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter('join');}else if(screen==='joining'){if(hit('Escape'))cancelNet();}else if(screen==='netready'){if(up||dn)menuIndex=1-menuIndex;if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter();}else if(screen==='league'){if(up)menuIndex=(menuIndex+4)%5;if(dn)menuIndex=(menuIndex+1)%5;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='leaguecreate'||screen==='leaguejoin'||screen==='leagueserver'){if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leagueview'){const n=Math.max(1,leagueActions.length);if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguesubmit'||screen==='leagueresolve'){const n=leaguePick.length+1;if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='leagueview';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguescore'){if(hit('Escape')){screen=scoreMode==='resolve'?'leagueresolve':'leaguesubmit';menuIndex=0}else if(confirm)handleMenuEnter()}else if(screen==='pause'){if(hit('Escape'))resumePlay();if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}else if(screen==='half'){if(confirm)handleMenuEnter()}else if(screen==='full'){if(up)menuIndex=(menuIndex+2)%3;if(dn)menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}menu();}
function frame(now:number){const raw=Math.min(.1,(now-last)/1000);last=now;let stepped=false;if(screen==='match'){handleMenu();if(screen==='match'){if(net&&net.session){net.poll();const f=input();net.frame(f);stepped=true;for(const e of net.session.lastEvents)audio.event(e);renderer.setFollow(engine.controlOf(viewTeam),engine.targetOf(viewTeam));}else{acc+=raw*(performance.now()<slowmoUntil?.35:1);let first=true;while(acc>=1/60){const f=input();if(!first){f.pass=false;f.through=false;f.cross=false;f.shootPressed=false;f.shootReleased=false;f.switchPlayer=false}engine.update(1/60,f);for(const e of engine.events.splice(0)){audio.event(e);if(e.type==='shot'){renderer.impact(e.power??28);if(Math.abs(engine.state.ball.x)>28)slowmoUntil=performance.now()+460}if(e.type==='tackle'&&e.slide){renderer.impact(9);slowmoUntil=performance.now()+260}}first=false;stepped=true;acc-=1/60}}const s=engine.state;if(s.phase==='halftime'){screen='half';menuDirty=true;audio.event({type:'whistle'})}if(s.phase==='fulltime'){screen='full';menuIndex=0;menuDirty=true;audio.event({type:'whistle'});if(dailyMode)setDailyBest(s.score[0])}renderer.render(s,raw);const cine=renderer.inCinematic();barTop.classList.toggle('on',cine);barBottom.classList.toggle('on',cine);if(now-hudAt>66){hud(s);hudAt=now}}}else {renderer.render(engine.state,raw,screen==='title'||screen==='team');barTop.classList.remove('on');barBottom.classList.remove('on');handleMenu()}updateTouchVisibility();if(import.meta.env.DEV&&now-devStatusAt>100){const s=engine.state,p=s.players[s.controlled],b=s.ball;document.body.dataset.match=JSON.stringify({phase:s.phase,screen,half:s.half,elapsed:s.elapsed,time:s.time,score:s.score,controlled:s.controlled,player:{x:p?.x,z:p?.z,vx:p?.vx,vz:p?.vz},ball:{x:b.x,z:b.z,y:b.y,owner:b.owner,flight:b.flight},stats:s.stats});devStatusAt=now}if(screen!=='match'||stepped){clearKeyboardEdges(kb);clearTouchEdges(touch)}requestAnimationFrame(frame)}
addEventListener('resize',()=>renderer.resize());
// PWA: offline app shell in production only (never cache dev iterations).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if(import.meta.env.DEV) Object.assign(window,{__retro:{get engine(){return engine},snapshot:()=>JSON.parse(JSON.stringify(engine.state)),start:launch}});
// Invite links (?room=CODE): skip the menu, join the Cloudflare room directly.
// The URL carries only the public code — the matchToken arrives over the
// room socket. Legacy ?invite= links (SDP blobs) show an expiry notice.
if (NET_LIVE) {
  const roomParam = inviteCodeFromSearch(location.search);
  if (roomParam) {
    screen = 'joining'; roomCode = roomParam; pendingInvite = roomParam;
    try { history.replaceState(null, '', location.pathname); } catch { /* keep the URL */ }
  } else if (new URLSearchParams(location.search).has('invite')) {
    netStatus = 'THAT INVITE LINK EXPIRED — ASK FOR A NEW LINK';
    screen = 'online'; menuIndex = 0;
    try { history.replaceState(null, '', location.pathname); } catch { /* keep the URL */ }
  }
}
menu();
if (pendingInvite) {
  const code = pendingInvite;
  pendingInvite = null;
  cloudJoin(code);
}
requestAnimationFrame(frame);
