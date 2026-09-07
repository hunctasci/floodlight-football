import './style.css';
import { MatchEngine } from './engine';
import { GameRenderer } from './renderer';
import { EMPTY_INPUT, TEAMS, type InputFrame, type MatchState, type TeamId } from './types';
import { MatchAudio } from './audio/audio';
import { createTouchState, clearTouchEdges, resetTouch } from './input/touch';
import { createKeyboardState, keyDown, keyUp, isBlockedKey, clearKeyboardEdges, resetKeyboard } from './input/keyboard';
import { buildInputFrame } from './input/input';
import { SimulationClock, TICK_DT } from './game/clock';
import { setupTouchControls } from './ui/touch-controls';
import { NetDriver } from './net/driver';
import { RTCTransport, isIcePayload, persistTurnConfig, readTurnConfig } from './net/transport';
import { AutoSignal } from './net/autosignal';
import { CloudflareSignalingClient } from './net/cloudflare-signal';
import type { SignalingClient } from './net/signaling';
import { makeClientId } from './net/signal';
import {
  attachNegotiationTransport, createNegotiationState, createSessionPeerId, detectControlPlane,
  effectiveOnlineDuration, ingestRemoteCandidate, isE2EMode, resetNegotiationState,
  type MultiplayerDebugState,
} from './net/online-session';
import { candidateFamily, netlog, redactCandidate, shortPeer } from './net/netlog';
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
// Captured before invite-link handling clears the query string: drives the
// TEST-ONLY short match (?e2e=1) and test instrumentation. Production play
// never sets ?e2e, so production durations are unaffected.
const bootSearch = location.search;
const e2eMode = isE2EMode(bootSearch);
let screen:Screen='title', menuIndex=0, teamIndex=0, duration=90, engine=new MatchEngine(0,90,1), last=performance.now(), muted=audio.isMuted, devStatusAt=0, hudAt=0, menuDirty=true;
// One match clock for solo play (online uses the driver's identical clock).
const soloClock = new SimulationClock();
// Render interpolation: previous-tick positions + leftover debt fraction.
// Never lerps across true discontinuities (restarts, recoveries).
const interpPrev = { px: new Float32Array(22), pz: new Float32Array(22), bx: 0, by: 0.25, bz: 0 };
let interpPhase = '', interpTickMark = -1;
function capturePrev(s: MatchState) {
  for (let i = 0; i < 22 && i < s.players.length; i++) { interpPrev.px[i] = s.players[i].x; interpPrev.pz[i] = s.players[i].z; }
  interpPrev.bx = s.ball.x; interpPrev.by = s.ball.y; interpPrev.bz = s.ball.z;
}
function displayPositions(s: MatchState, alpha: number) {
  const n = s.players.length;
  const px = new Float32Array(n), pz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = interpPrev.px[i] + (s.players[i].x - interpPrev.px[i]) * alpha;
    pz[i] = interpPrev.pz[i] + (s.players[i].z - interpPrev.pz[i]) * alpha;
  }
  return {
    px, pz,
    bx: interpPrev.bx + (s.ball.x - interpPrev.bx) * alpha,
    by: interpPrev.by + (s.ball.y - interpPrev.by) * alpha,
    bz: interpPrev.bz + (s.ball.z - interpPrev.bz) * alpha,
  };
}
export type DisplayPositions = ReturnType<typeof displayPositions>;
// Online match rides on serverless WebRTC invite links — live today.
const NET_LIVE = true;
// Friend leagues need the signaling/league server; COMING SOON until hosted.
const LEAGUES_LIVE = false;
let titleNote = '';
// Online (Cloudflare-room P2P lockstep) state. Null driver = local AI match.
let net: NetDriver | null = null;
let viewTeam: TeamId = 0;
let netStatus = '', netBusy = false;
// Explicit trickle-ICE negotiation state: the transport reference is kept for
// the whole negotiation (offer -> answer -> late candidates -> DataChannel),
// never nulled merely because the answer SDP arrived.
let neg = createNegotiationState();
// High-level lifecycle for UI + test instrumentation (no secrets).
let mpState: MultiplayerDebugState = 'idle';
// Daily Cup state: seeded engine + best-score persistence (visual only).
let dailyMode = false;
// Room session: 6-char code the friend taps or types; the matchToken binding
// the handshake arrives over the room socket (never in the URL, never logged).
// myPeerId is a FRESH per-session connection identity (never the persistent
// league/user id): two tabs sharing one device id still join as two peers.
let sig: SignalingClient | null = null;
let roomCode = '', matchToken = '', peerId = '', myPeerId = '';
let peerReady = false, iAmReady = false;
// Shareable invite for the current host room (code only, no SDP/secrets).
let inviteUrl = '', copyNote = '';
// Pending auto-join code from an invite link (startup ?room=…).
let pendingInvite: string | null = null;
// League (F4b REST) state. Null data = not loaded yet; msg surfaces API errors.
let leagueData: League | null = null, leagueMsg = '', leagueBusy = false;let leagueActions: string[] = [], leaguePick: Fixture[] = [];
/** Wall-clock moment halftime started (auto-continue ~1.5s, guest fallback 5s). */
let halfAt = 0;
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
let shootWasDown = false, passWasDown = false, stickSprintOn = false;
const touch=createTouchState();
// Mouse shot aim (desktop): hold LMB and drag relative to button-down;
// release fires. Keyboard KeyK is the button-only fallback.
const mouseAim = { down: false, startX: 0, startY: 0, aimU: 0, aimV: 0 };
const isTouchDevice=matchMedia('(pointer: coarse)').matches||'ontouchstart' in window;
const ui=document.createElement('div');ui.className='ui';app.append(ui);
const barTop=document.createElement('div');barTop.className='cinebar top';ui.append(barTop);
const barBottom=document.createElement('div');barBottom.className='cinebar bottom';ui.append(barBottom);
let camNote='',camNoteAt=0;
const radar=document.createElement('canvas'); radar.className='radar';radar.width=308;radar.height=184;
function keyName(e:KeyboardEvent){return e.code}
addEventListener('keydown',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyDown(kb, keyName(e));audio.enable();});
addEventListener('keyup',e=>{if((e.target as HTMLElement)?.tagName==='TEXTAREA')return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyUp(kb, keyName(e));});
// LMB is the shot button: hold to charge, drag to aim, release to shoot.
renderer.canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || screen !== 'match') return;
  audio.enable();
  keyDown(kb, 'MouseL');
  mouseAim.down = true; mouseAim.startX = e.clientX; mouseAim.startY = e.clientY;
  mouseAim.aimU = 0; mouseAim.aimV = 0;
});
addEventListener('mousemove', (e) => {
  if (!mouseAim.down) return;
  mouseAim.aimU = Math.max(-1, Math.min(1, (e.clientX - mouseAim.startX) / 128));
  mouseAim.aimV = Math.max(0, Math.min(1, (mouseAim.startY - e.clientY) / 128));
});
addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  if (mouseAim.down) { mouseAim.down = false; keyUp(kb, 'MouseL'); }
});
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
  screen = 'match'; menuIndex = 0; soloClock.reset();
  mpState = 'playing';
  audio.event({ type: 'whistle' });
}
function closeNegTransport() {
  // The negotiation transport is owned by the NetDriver once connected; only
  // close it here when no driver took ownership (cancel before handshake).
  const t = neg.transport as unknown as { close?: () => void } | null;
  if (t && !net) {
    try { t.close?.(); } catch { /* already gone */ }
  }
  resetNegotiationState(neg);
}
function closeNet() {
  if (net) { try { net.quit(); } catch { /* link already dead */ } net = null; }
  closeNegTransport();
  if (sig) { try { sig.close(); } catch { /* already gone */ } sig = null; }
  roomCode = ''; matchToken = ''; peerId = ''; myPeerId = '';
  inviteUrl = ''; copyNote = '';
  peerReady = false; iAmReady = false;
  netStatus = ''; netBusy = false;
  if (mpState !== 'playing' && mpState !== 'finished' && mpState !== 'error') mpState = 'idle';
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
  const r = buildInputFrame(kb, touch, shootWasDown,
    { passWasDown, stickSprintOn, aim: mouseAim.down ? mouseAim : undefined });
  shootWasDown = r.shootWasDown; passWasDown = r.passWasDown; stickSprintOn = r.stickSprint;
  return r.frame;
}
function clock(s:MatchState){const football=Math.min(45,Math.floor(s.elapsed/s.halfDuration*45));return `${s.half===2?45+football:football}'`}
function drawRadar(s:MatchState,vt:TeamId,ctl:number){const c=radar.getContext('2d')!;c.clearRect(0,0,308,184);c.fillStyle='#1b6b43';c.fillRect(0,0,308,184);c.strokeStyle='#f8efdb';c.lineWidth=2;c.strokeRect(3,3,302,178);c.beginPath();c.moveTo(154,3);c.lineTo(154,181);c.stroke();for(const p of s.players){c.fillStyle=p.team===vt?'#f7bf30':'#ef4054';c.beginPath();c.arc((p.x/46+1)*154,(p.z/29+1)*92, p.id===ctl?6:4,0,7);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc((s.ball.x/46+1)*154,(s.ball.z/29+1)*92,4,0,7);c.fill();}
function hud(s:MatchState){const vt=net?viewTeam:s.humanTeam,ctl=net?engine.controlOf(vt):s.controlled;const me=s.players[ctl];const my=s.teams[vt],away=s.teams[1-vt];const how=s.phase==='corner'?'AIM · D LONG · S SHORT':s.phase==='throwin'?'AIM · S THROW':s.phase==='goalkick'?'S SHORT · D LONG': 'AIM · S KICK OFF';const restart=s.restart?`${s.teams[s.restart.team].name.toUpperCase()} ${s.phase==='throwin'?'THROW-IN':s.phase==='corner'?'CORNER':s.phase==='goalkick'?'GOAL KICK':'KICKOFF'}${s.restart.team===vt?`<small>${how}</small>`:'<small>OPPONENT TAKING RESTART</small>'}`:'';const toast=performance.now()-camNoteAt<1600?`<div class="camtoast">📷 ${camNote}</div>`:'';const holder=s.ball.owner===null?null:s.players[s.ball.owner];const keeperHint=holder&&holder.keeper&&holder.team===vt?`<div class="keeper-hint">🧤 KEEPER<small>S SHORT · D LONG</small></div>`:holder&&holder.keeper?`<div class="keeper-hint">🧤 OPPONENT KEEPER HAS IT<small>SHAPE UP — PRESSURE AFTER RELEASE</small></div>`:'';const aimU=mouseAim.down?mouseAim.aimU:(touch.aimU||0),aimV=mouseAim.down?mouseAim.aimV:(touch.aimV||0);const reticle=s.charge>0?`<div class="reticle"><div class="rgoal"><div class="rposts"></div><i class="raim" style="left:${(50+aimU*46).toFixed(1)}%;bottom:${(8+aimV*80).toFixed(1)}%"></i></div><small>AIM ${aimU===0&&aimV===0?'LOW FINISH':'PLACED'} · POWER ${Math.min(100,s.charge/.45*100).toFixed(0)}%</small></div>`:'';ui.innerHTML=`<div class="scoreboard"><div class="club">${my.short}</div><div class="score">${s.score[vt]} – ${s.score[1-vt]}</div><div class="club">${away.short}</div><div class="clock">${s.half===1?'1ST':'2ND'} ${clock(s)}</div></div><div class="attack">YOU: ${my.name.toUpperCase()}<br>ATTACK ${s.attack[vt]>0?'→':'←'}</div><div class="camchip">📷 ${renderer.cameraLabel()}</div><div class="player-info">▲ ${me?.name||'PLAYER'}</div>${s.charge>0?`<div class="charge"><i style="width:${Math.min(100,s.charge/.45*100)}%"></i></div>`:''}${reticle}<div class="strip">${isTouchDevice ? 'STICK MOVE · RIM SPRINT · PASS TAP/HOLD=LEAD<br>SHOOT HOLD+DRAG=AIM · SWITCH' : 'ARROWS MOVE · S PASS · A LONG · D SHOOT · W CROSS · SPACE SWITCH<br>E/SHIFT SPRINT · C CAMERA · ESC PAUSE · M ' + (muted ? 'UNMUTE' : 'MUTE')}</div>${toast}${keeperHint}${!restart&&s.messageTime>0?`<div class="message">${s.message}<small>${s.phase==='goal'?'KICKOFF IN A MOMENT':''}</small></div>`:''}${restart?`<div class="message">${restart}</div>`:''}`;ui.append(barTop,barBottom,radar);drawRadar(s,vt,ctl);}
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
  if(screen==='title') { const items=LEAGUES_LIVE?['PLAY MATCH','ONLINE MATCH','DAILY CUP','LEAGUE']:['PLAY MATCH','ONLINE MATCH','DAILY CUP','LEAGUE · COMING SOON']; panel(`<div class="eyebrow">ARCADE FOOTBALL · 1998</div><div class="title">FLOODLIGHT<br>FOOTBALL</div><div class="subtitle">SATURDAY CUP</div>${titleNote?`<div class="message">${titleNote}</div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">${isTouchDevice ? 'TOUCH READY · TAP OK' : 'KEYBOARD ONLY · PRESS ENTER'}<br>ARROWS MOVE · S PASS · A LONG · D SHOOT · W CROSS · SPACE SWITCH${isTouchDevice ? '<br>OR LEFT STICK + BUTTONS' : ''}</div>`); wireMenuItems(); return; }
  if(screen==='team') { const t=TEAMS[teamIndex],o=TEAMS[(teamIndex+1)%TEAMS.length]; panel(`<div class="eyebrow">CHOOSE YOUR CLUB</div><div class="title" style="font-size:34px">SATURDAY CUP</div><div class="team-row"><div class="team-card active"><div class="team-swatch" style="background:${t.color}"></div>${t.name}<br><small>${t.city}</small></div><div class="team-card"><div class="team-swatch" style="background:${o.color}"></div>${o.name}<br><small>OPPONENT</small></div></div><div class="menu-item selected">${duration/60} MINUTE HALVES</div><div class="hint">← / → CHANGE TEAM · ↑ / ↓ CHANGE LENGTH<br>ENTER KICK OFF · ESC BACK</div>`); return; }
  if(screen==='pause') { const items=['RESUME','RESTART MATCH','MAIN MENU']; panel(`<div class="eyebrow">MATCH PAUSED</div><div class="title" style="font-size:38px">PAUSE</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">ARROWS MOVE · S PASS/TACKLE · A LONG · D/MOUSE SHOOT/SLIDE · W CROSS<br>SPACE SWITCH · E/SHIFT SPRINT · C CAMERA (${renderer.cameraLabel()}) · ↑ / ↓ SELECT · ENTER CONFIRM · ESC RESUME</div>`); return; }
  if(screen==='online') { const items=['PLAY WITH A FRIEND','JOIN WITH CODE','BACK']; panel(`<div class="eyebrow">PLAY ONLINE · FRIEND MATCH</div><div class="title" style="font-size:38px" data-testid="online-title">ONLINE</div><div class="subtitle">${TEAMS[teamIndex].short} · ${duration/60} MIN HALVES</div>${netStatus?`<div class="subtitle" data-testid="online-status">${netStatus}</div><div class="menu-item netbtn" data-act="copylog" data-testid="copy-debug-log">▶ COPY DEBUG LOG</div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}" data-testid="online-${x.toLowerCase().replace(/[^a-z]+/g, '-')}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='host') { const share = canShare(); panel(`<div class="eyebrow">SHARE THE LINK · YOU ARE TEAM 1</div><div class="title" style="font-size:52px" data-testid="room-code">${roomCode || '···'}</div><div class="subtitle" data-testid="host-status">${netStatus || '…'}</div>${inviteUrl?`<textarea class="netpaste netcode" id="invitelink" data-testid="invite-url" rows="2" readonly>${inviteUrl}</textarea>${copyNote?`<div class="hint">${copyNote}</div>`:''}<div class="menu-item netbtn" data-act="copy">▶ COPY LINK</div>${share?`<div class="menu-item netbtn" data-act="share">▶ SHARE</div>`:''}`:''}<div class="menu-item netbtn" data-act="copylog" data-testid="copy-debug-log">▶ COPY DEBUG LOG</div><div class="menu-item netbtn" data-act="cancel" data-testid="host-cancel">▶ CANCEL</div>`); return; }
  if(screen==='join') { panel(`<div class="eyebrow">ENTER THE FRIEND CODE</div><div class="title" style="font-size:38px">JOIN</div><div class="subtitle" data-testid="join-status">${netStatus || 'TYPE THE 6-LETTER CODE'}</div>${roomCode ? '' : `<textarea class="netpaste netcode" id="netcode" data-testid="join-code-input" rows="1" maxlength="6" placeholder="ABCDEF" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><div class="menu-item netbtn" data-act="join" data-testid="join-submit">▶ JOIN</div>`}<div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='joining') { panel(`<div class="eyebrow">JOINING MATCH…</div><div class="title" style="font-size:38px" data-testid="room-code">${roomCode || '···'}</div><div class="subtitle" data-testid="joining-status">${netStatus || 'JOINING MATCH…'}</div><div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='netready') { const items=["I'M READY",'CANCEL']; panel(`<div class="eyebrow" data-testid="ready-room">ROOM ${roomCode} · ${TEAMS[teamIndex].short} · ${duration/60} MIN</div><div class="title" style="font-size:38px">READY?</div><div class="subtitle" data-testid="ready-status">YOU ${iAmReady ? 'READY ✓' : '…'} · FRIEND ${peerReady ? 'READY ✓' : '…'}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}" data-testid="ready-${x.toLowerCase().replace(/[^a-z]+/g, '-')}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">BOTH SIDES PRESS READY — THEN KICK OFF</div>`); return; }
  if(screen==='league') { const items=['OPEN LEAGUE','CREATE LEAGUE','JOIN LEAGUE','SERVER','BACK']; const saved=getLeagueCode(); panel(`<div class="eyebrow">FRIEND LEAGUES · ROUND ROBIN</div><div class="title" style="font-size:38px">LEAGUE</div><div class="subtitle">${saved ? 'SAVED CODE ' + saved : getServerUrl()}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='leaguecreate') { panel(`<div class="eyebrow">START A FRIEND LEAGUE</div><div class="title" style="font-size:34px">CREATE</div><textarea class="netpaste" id="lgname" rows="2" placeholder="LEAGUE NAME"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-create">▶ CREATE LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leaguejoin') { panel(`<div class="eyebrow">JOIN WITH A 6-LETTER CODE</div><div class="title" style="font-size:34px">JOIN</div><textarea class="netpaste" id="lgcode" rows="1" placeholder="LEAGUE CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-join">▶ JOIN LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
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
    panel(`<div class="eyebrow">${scoreMode === 'resolve' ? 'CREATOR RULING — FINAL SCORE' : 'WHAT WAS THE FINAL SCORE?'}</div><div class="title" style="font-size:30px">${label}</div><div class="score-row"><div><div class="hint">${f ? leagueName(f.homeClientId) : 'HOME'}</div><textarea class="netpaste scorebox" id="scoreH" rows="1" placeholder="0" inputmode="numeric" autocomplete="off"></textarea></div><div><div class="hint">${f ? leagueName(f.awayClientId) : 'AWAY'}</div><textarea class="netpaste scorebox" id="scoreA" rows="1" placeholder="0" inputmode="numeric" autocomplete="off"></textarea></div></div><div class="menu-item netbtn" data-act="do-score">▶ ${scoreMode === 'resolve' ? 'CONFIRM RULING' : 'SEND SCORE'}</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div><div class="hint">BOTH SIDES SUBMIT · MATCHING SCORES CONFIRM · CLASHES GO TO THE CREATOR</div>`); return;
  }
  if(screen==='half') { const hs=engine.state; panel(`<div class="eyebrow">HALF TIME · ${hs.score[0]} – ${hs.score[1]}</div><div class="title" style="font-size:42px" data-testid="halftime-title">HALF TIME</div><div class="subtitle" data-testid="halftime-score">${hs.teams[0].short} ${hs.score[0]} – ${hs.score[1]} ${hs.teams[1].short}</div><div class="hint">SECOND HALF STARTS SHORTLY — PRESS ENTER TO CONTINUE</div>`); return; }
  const s=engine.state,items=['PLAY AGAIN','MAIN MENU','SHARE RESULT']; panel(`<div class="eyebrow">${dailyMode?'DAILY CUP · FINAL SCORE':'SATURDAY CUP · FINAL SCORE'}</div><div class="title" style="font-size:42px" data-testid="fulltime-title">FULL TIME</div><div class="subtitle" data-testid="fulltime-score">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>${dailyMode?`<div class="statline"><span>DAILY BEST<strong>${Math.max(getDailyBest(),s.score[0])}</strong></span></div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
}
/** Per-session ICE family counters (categories only, never addresses). */
const iceLogStats = { sent: {} as Record<string, number>, recv: {} as Record<string, number> };
function noteIceStat(dir: 'sent' | 'recv', family: string) {
  const m = dir === 'sent' ? iceLogStats.sent : iceLogStats.recv;
  m[family] = (m[family] ?? 0) + 1;
}
/** Attach redacted diagnostics to a fresh RTCTransport.
 * onPcState/onIceDebug survive driver takeover; the dc wrapper must be
 * applied AFTER `new NetDriver` (its constructor owns transport.onstate). */
function watchTransport(t: RTCTransport, role: string) {
  t.onPcState = (s) => {
    netlog.log('pc', `${role} pc=${s.connection} ice=${s.ice} sig=${s.signaling} gather=${s.gathering}`);
  };
  t.onIceDebug = (e) => {
    noteIceStat(e.dir === 'local' ? 'sent' : 'recv', e.family);
    netlog.log('ice', `${role} ice-${e.dir} typ=${e.family} ok=${e.ok ? 1 : 0}${e.err ? ` err=${e.err}` : ''}`);
  };
}
function wrapDcState(t: RTCTransport, role: string) {
  const prev = t.onstate;
  t.onstate = (s) => {
    netlog.log('dc', `${role} datachannel=${s}`);
    try { prev?.(s); } catch { /* driver handler */ }
  };
}
function attachDriver(d: NetDriver) {
  d.onEvent = (e) => {
    if (e.type === 'connected') {
      netlog.log('driver', 'handshake connected → READY lobby');
      screen = 'netready'; menuIndex = 0; peerReady = false; iAmReady = false; menuDirty = true;
      mpState = 'connected';
    }
    else if (e.type === 'peerReady') { netlog.log('driver', 'peer ready'); peerReady = true; menuDirty = true; if (mpState === 'connected') mpState = 'ready'; }
    else if (e.type === 'started') { netlog.log('driver', 'both ready → kickoff'); mpState = 'playing'; launchNet(d); }
    else if (e.type === 'peerPaused') {
      if (e.paused) openPause();
      else if (screen === 'pause' && !engine.state.paused) screen = 'match';
      menuDirty = true;
    }
    else if (e.type === 'peerQuit') { netlog.log('driver', 'peer quit'); closeNet(); screen = 'title'; menuIndex = 0; menuDirty = true; }
    else if (e.type === 'peerDropped') {
      netlog.log('driver', `peer dropped screen=${screen}`);
      // Lobby drop (READY shown, match not started): clean FRIEND LEFT.
      // Mid-match drop: AI takes over so solo can continue.
      if (screen === 'netready') {
        netGen++; closeNet(); mpState = 'error';
        netStatus = 'FRIEND LEFT'; screen = 'online'; menuIndex = 0; menuDirty = true;
      } else {
        engine.state.message = 'PEER LEFT — AI TAKES OVER'; engine.state.messageTime = 3;
      }
    }
    else if (e.type === 'error') {
      const msg = e.message.toUpperCase();
      netlog.log('error', `driver error: ${msg.slice(0, 80)}`);
      closeNet(); mpState = 'error';
      netStatus = msg; screen = 'online'; menuIndex = 0; menuDirty = true;
    }
  };
}
let netGen = 0;
function cancelNet() { netGen++; closeNet(); mpState = 'idle'; screen = 'online'; menuIndex = 0; menuDirty = true; }
/** Lobby failure: invalidate in-flight async steps, tear down, show why. */
function deadNet(message: string) {
  netGen++; closeNet(); mpState = 'error';
  netStatus = message; screen = 'online'; menuIndex = 0; menuDirty = true;
}
const netMsg = (e: unknown) => friendlyNetError(e);
function hookDriver(d: NetDriver) {
  attachDriver(d); net = d;
}
/**
 * Online signaling always targets the same origin that served the game
 * (Worker + Static Assets, no backend configuration). The Node server stays
 * as the self-hosted reference, selected EXPLICITLY: the origin's
 * GET /api/health response decides the architecture. A Cloudflare network
 * failure throws and surfaces as a player-facing connection error — it never
 * silently switches to the legacy protocol. Gameplay stays WebRTC P2P.
 */
async function connectSignal(): Promise<SignalingClient> {
  const base = location.origin;
  const boundFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init);
  const kind = await detectControlPlane(base, boundFetch, 5000);
  netlog.log('signal', `control-plane=${kind}`);
  if (kind === 'cloudflare') {
    const cf = new CloudflareSignalingClient(undefined, boundFetch);
    await cf.connect(base, 5000);
    netlog.log('signal', 'socket probe ok');
    return cf;
  }
  const legacy = new AutoSignal();
  await legacy.connect(base);
  netlog.log('signal', 'legacy socket open');
  return legacy;
}
function webrtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}
/** Short UA tag for diagnostics (engine only, no full UA string in logs). */
function browserTag(): string {
  try {
    const ua = navigator.userAgent;
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
    if (/Edg\//.test(ua)) return 'edge';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Chrome\//.test(ua)) return 'chrome';
    return 'other';
  } catch {
    return 'unknown';
  }
}
/** Wire trickle ICE both ways between one transport and the room socket. */
function relayIce(transport: RTCTransport, signal: SignalingClient, peer: () => string | null) {
  transport.onCandidate = (c) => {
    const to = peer();
    if (!to) return;
    netlog.log('ice', `ice-send ${redactCandidate(c)}`);
    noteIceStat('sent', candidateFamily(c.candidate));
    try {
      signal.sendSignal(to, c);
    } catch {
      netlog.log('error', 'ice-send failed: socket closing');
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
  resetNegotiationState(neg);
  myPeerId = createSessionPeerId();
  netlog.clear();
  for (const k of Object.keys(iceLogStats.sent)) delete iceLogStats.sent[k];
  for (const k of Object.keys(iceLogStats.recv)) delete iceLogStats.recv[k];
  netlog.log('info', `host start room peer=${shortPeer(myPeerId)} ua=${browserTag()} turn=${readTurnConfig() ? 'on' : 'off'}`);
  mpState = 'creating-room';
  netStatus = 'CREATING ROOM…'; inviteUrl = ''; copyNote = ''; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    try {
      signal = await connectSignal();
    } catch (e) { if (alive()) { mpState = 'error'; deadNet(netMsg(e)); } return; }
    if (!alive()) return fini(signal);
    sig = signal;
    signal.onPeerJoined = (peer) => {
      if (!alive() || peerId) return;
      peerId = peer; neg.remotePeerId = peer;
      netlog.log('signal', `peer-joined peer=${shortPeer(peer)}`);
      mpState = 'negotiating';
      netStatus = 'FRIEND FOUND… CONNECTING…'; menuDirty = true;
      void (async () => {
        try {
          const { transport, offer } = await RTCTransport.createOfferTrickle();
          if (!alive()) { transport.close(); return; }
          // Attach BEFORE sending the offer so early trickle candidates have
          // a target; flush anything queued while the offer was being built.
          const queued = attachNegotiationTransport(neg, transport);
          watchTransport(transport, 'host');
          for (const c of queued) void transport.addIceCandidate(c).catch(() => {});
          relayIce(transport, signal, () => (token === netGen ? peerId : null));
          signal.sendSignal(peer, offer);
          netlog.log('sdp', `offer sent ${offer.sdp.length}B`);
          netStatus = 'CONNECTING…'; menuDirty = true;
        } catch { if (alive()) { mpState = 'error'; deadNet('THIS BROWSER CAN’T PLAY ONLINE — TRY CHROME OR SAFARI'); } }
      })();
    };
    signal.onPeerSignal = (from, payload) => {
      if (token !== netGen || from !== peerId) return;
      // Trickle ICE is accepted for the whole lobby (waiting + READY): before
      // AND after the answer SDP. The transport is never nulled on answer.
      if (isIcePayload(payload)) {
        if (screen !== 'host' && screen !== 'netready') return;
        netlog.log('ice', `host ice-recv ${redactCandidate(payload)}`);
        void ingestRemoteCandidate(neg, payload);
        return;
      }
      if (!alive()) return;
      if (payload.type !== 'answer') return;
      if (neg.answerHandled) return;
      const t = neg.transport as RTCTransport | null;
      if (!t) return;
      neg.answerHandled = true;
      netlog.log('sdp', `answer recv ${payload.sdp.length}B`);
      void t.acceptAnswerSdp(payload).then(() => {
        if (!alive()) { t.close(); return; }
        // Keep neg.transport pointing at the live transport so LATE
        // candidates (arriving after the answer) still reach addIceCandidate.
        // NOTE: SDP done ≠ driver ready. Keep showing CONNECTING until the
        // NetDriver hello/welcome handshake fires 'connected' → netready.
        netStatus = 'CONNECTING…'; menuDirty = true;
        mpState = 'negotiating';
        const onlineDuration = effectiveOnlineDuration(duration, bootSearch);
        hookDriver(new NetDriver(t, { host: true, teamIndex, duration: onlineDuration, matchToken }));
        wrapDcState(t, 'host');
        netlog.log('driver', 'host handshake started (waiting for datachannel)');
      }).catch(() => { if (alive()) { mpState = 'error'; deadNet(netMsg('negotiation failed')); } });
    };
    signal.onPeerLeft = () => {
      // Lobby leave: waiting (host) or READY (both). Mid-match leaves go
      // through the NetDriver (AI takeover), not the signaling socket.
      if (token !== netGen) return;
      if (screen === 'host' || screen === 'netready') { mpState = 'error'; deadNet('FRIEND LEFT'); }
    };
    try {
      const created = await signal.createRoom(myPeerId);
      if (!alive()) return fini(signal);
      roomCode = created.roomCode; matchToken = created.matchToken;
      inviteUrl = buildInviteUrl(location.origin, location.pathname, roomCode);
      netlog.log('signal', `room created code=${roomCode}`);
      mpState = 'waiting-for-peer';
      netStatus = 'WAITING FOR FRIEND…'; menuDirty = true;
    } catch (e) {
      if (alive()) {
        netlog.log('error', `create-room failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}`);
        mpState = 'error'; deadNet(netMsg(e));
      }
    }
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
  resetNegotiationState(neg);
  myPeerId = createSessionPeerId();
  netlog.clear();
  for (const k of Object.keys(iceLogStats.sent)) delete iceLogStats.sent[k];
  for (const k of Object.keys(iceLogStats.recv)) delete iceLogStats.recv[k];
  netlog.log('info', `guest join ${code} peer=${shortPeer(myPeerId)} ua=${browserTag()} turn=${readTurnConfig() ? 'on' : 'off'}`);
  mpState = 'joining-room';
  netStatus = 'JOINING MATCH…'; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    try {
      signal = await connectSignal();
    } catch (e) {
      if (alive()) {
        netGen++; closeNet(); mpState = 'error';
        netStatus = netMsg(e); screen = 'online'; menuIndex = 0; menuDirty = true;
      }
      return;
    }
    if (!alive()) return fini(signal);
    sig = signal;
    signal.onPeerSignal = (from, payload) => {
      if (token !== netGen) return;
      // ICE is accepted throughout the lobby (joining + READY): before the
      // offer (reordered relay), while the answer is being built, and after
      // the NetDriver exists (late candidates). Never gated on offerHandled.
      if (isIcePayload(payload)) {
        if (screen !== 'join' && screen !== 'joining' && screen !== 'netready') return;
        if (peerId && from !== peerId) return;
        netlog.log('ice', `guest ice-recv ${redactCandidate(payload)}`);
        void ingestRemoteCandidate(neg, payload);
        return;
      }
      if (!alive()) return;
      if (payload.type !== 'offer') return;
      if (neg.offerHandled) return;
      if (peerId && from !== peerId) return;
      neg.offerHandled = true;
      peerId = from; neg.remotePeerId = from;
      netlog.log('signal', `offer recv from=${shortPeer(from)}`);
      mpState = 'negotiating';
      netStatus = 'FRIEND FOUND… CONNECTING…'; menuDirty = true;
      void RTCTransport.acceptOfferTrickle(payload).then(({ transport, answer }) => {
        if (!alive()) { transport.close(); return; }
        // Attach BEFORE sending the answer; flush pre-offer candidates in
        // order, keep the reference for post-offer candidates.
        const queued = attachNegotiationTransport(neg, transport);
        watchTransport(transport, 'guest');
        relayIce(transport, signal, () => (token === netGen ? peerId : null));
        for (const c of queued) void transport.addIceCandidate(c).catch(() => {});
        try { signal.sendSignal(from, answer); }
        catch { transport.close(); if (alive()) failJoin('SIGNAL LOST'); return; }
        netlog.log('sdp', `answer sent ${answer.sdp.length}B`);
        // SDP done ≠ driver ready. Keep CONNECTING until hello/welcome → netready.
        netStatus = 'CONNECTING…'; menuDirty = true;
        hookDriver(new NetDriver(transport, { host: false, matchToken }));
        wrapDcState(transport, 'guest');
        netlog.log('driver', 'guest handshake started (waiting for datachannel)');
      }).catch(() => { if (alive()) failJoin('negotiation failed'); });
    };
    const failJoin = (reason: unknown) => {
      if (token !== netGen) return;
      if (screen !== 'join' && screen !== 'joining' && screen !== 'netready') return;
      netGen++; closeNet(); mpState = 'error';
      netStatus = netMsg(reason); screen = 'online'; menuIndex = 0; menuDirty = true;
    };
    signal.onPeerLeft = () => {
      if (token !== netGen) return;
      if (screen === 'join' || screen === 'joining' || screen === 'netready') failJoin('HOST LEFT');
    };
    try {
      const joined = await signal.joinRoom(normalized, myPeerId);
      if (!alive()) return fini(signal);
      roomCode = joined.roomCode; matchToken = joined.matchToken;
      netlog.log('signal', `room joined code=${roomCode} peers=${joined.peers.length}`);
      mpState = 'negotiating';
      netStatus = joined.peers.length > 0 ? 'FRIEND FOUND… CONNECTING…' : 'CONNECTING… WAITING FOR HOST…';
      menuDirty = true;
    } catch (e) {
      if (alive()) {
        netlog.log('error', `join-room failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}`);
        failJoin(e);
      }
    }
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
  iAmReady = true; net.setReady(); mpState = 'ready'; menuDirty = true;
}
/** Copy the redacted net diagnostic log (no token/SDP/IPs) for bug reports. */
function doCopyLog() {
  const summary =
    `ice sent ${JSON.stringify(iceLogStats.sent)} recv ${JSON.stringify(iceLogStats.recv)}\n` +
    netlog.dump();
  void copyText(summary).then((ok) => {
    copyNote = ok ? 'DEBUG LOG COPIED — PASTE IT IN YOUR BUG REPORT' : 'TAP THE LOG TO SELECT IT';
    menuDirty = true;
  });
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
    if (act === 'copylog') { doCopyLog(); return; }
    if (menuIndex === 0) { screen = 'host'; menuIndex = 0; roomCode = ''; netStatus = ''; inviteUrl = ''; copyNote = ''; startHost(); }
    else if (menuIndex === 1) { screen = 'join'; menuIndex = 0; roomCode = ''; netStatus = ''; }
    else { screen = 'title'; menuIndex = 0; netStatus = ''; }
  }
  else if (screen === 'host') {
    if (act === 'cancel') cancelNet();
    else if (act === 'copy') doCopyLink();
    else if (act === 'share') doShareLink();
    else if (act === 'copylog') doCopyLog();
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
    if (net && viewTeam === 1) {
      // Guest follows the host's broadcastHalf packet (engine already left
      // halftime): return to the match screen so simulation resumes. While
      // the engine still shows halftime, keep waiting for the host.
      if (engine.state.phase !== 'halftime') { screen = 'match'; audio.event({ type: 'whistle' }); }
      return;
    }
    engine.continueHalf(); if (net) net.broadcastHalf(); screen = 'match'; audio.event({ type: 'whistle' });
  }
  else if (screen === 'full') {
    if (menuIndex === 0 && !net) launch();
    else if (menuIndex === 2) shareResult();
    else { closeNet(); screen = 'title'; }
  }
  menuDirty = true;
}
function handleMenu(){if(pressed.size||released.size||touch.pressed.size||touch.released.size)menuDirty=true;if(hit('KeyM')){muted=audio.toggle();consume('KeyM')}if(screen==='match'){if(hit('Escape')){consume('Escape');openPause()}if(hit('KeyC')){camNote=renderer.cycleCamera();camNoteAt=performance.now();consume('KeyC')}return}const confirm=hit('Enter');if(confirm)consume('Enter');const up=hit('KeyW')||hit('ArrowUp'),dn=hit('KeyS')||hit('ArrowDown');if(screen==='title'){if(up||dn)menuIndex=(menuIndex+(up?3:1))%4;if(hit('Escape'))menuIndex=0;if(confirm)handleMenuEnter()}else if(screen==='team'){if(hit('KeyA')||hit('ArrowLeft'))teamIndex=(teamIndex+3)%4;if(hit('KeyD')||hit('ArrowRight'))teamIndex=(teamIndex+1)%4;if(hit('KeyW')||hit('ArrowUp'))duration=duration===90?180:duration===180?300:90;if(hit('KeyS')||hit('ArrowDown'))duration=duration===90?300:duration===300?180:90;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='online'){if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='host'){if(hit('Escape'))cancelNet();}else if(screen==='join'){if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter('join');}else if(screen==='joining'){if(hit('Escape'))cancelNet();}else if(screen==='netready'){if(up||dn)menuIndex=1-menuIndex;if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter();}else if(screen==='league'){if(up)menuIndex=(menuIndex+4)%5;if(dn)menuIndex=(menuIndex+1)%5;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='leaguecreate'||screen==='leaguejoin'||screen==='leagueserver'){if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leagueview'){const n=Math.max(1,leagueActions.length);if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguesubmit'||screen==='leagueresolve'){const n=leaguePick.length+1;if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='leagueview';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguescore'){if(hit('Escape')){screen=scoreMode==='resolve'?'leagueresolve':'leaguesubmit';menuIndex=0}else if(confirm)handleMenuEnter()}else if(screen==='pause'){if(hit('Escape'))resumePlay();if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}else if(screen==='half'){if(net&&viewTeam===1&&engine.state.phase!=='halftime')handleMenuEnter();else if(confirm)handleMenuEnter();else if(performance.now()-halfAt>(net&&viewTeam===1?5000:1500))handleMenuEnter()}else if(screen==='full'){if(up)menuIndex=(menuIndex+2)%3;if(dn)menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}menu();}
function frame(now:number){const raw=Math.min(.1,(now-last)/1000);last=now;let stepped=false;if(net&&(screen==='host'||screen==='join'||screen==='joining'||screen==='netready')){try{net.poll();}catch{/* poll never throws; error surfaces via driver events */}}if(screen==='match'){handleMenu();if(screen==='match'){capturePrev(engine.state);if(net&&net.session){net.poll();const f=input();net.frame(f,raw);stepped=true;for(const e of net.session.drainEvents())audio.event(e);renderer.setFollow(engine.controlOf(viewTeam),engine.targetOf(viewTeam));}else{const due=soloClock.push(raw);let first=true;for(let n=0;n<due;n++){const f=input();if(!first){f.pass=false;f.passReleased=false;f.through=false;f.cross=false;f.shootPressed=false;f.shootReleased=false;f.switchPlayer=false}engine.update(1/60,f);for(const e of engine.events.splice(0)){audio.event(e);if(e.type==='shot'){renderer.impact(e.power??28)}if(e.type==='tackle'&&e.slide){renderer.impact(9)}}first=false;stepped=true;}}const s=engine.state;if(s.phase==='halftime'){screen='half';halfAt=performance.now();menuDirty=true;audio.event({type:'whistle'})}if(s.phase==='fulltime'){screen='full';menuIndex=0;menuDirty=true;if(net)mpState='finished';audio.event({type:'whistle'});if(dailyMode)setDailyBest(s.score[0])}let alpha=1;if(s.phase!==interpPhase||engine.tick<interpTickMark){capturePrev(s)}else{const debt=net?net.debt():soloClock.debt;alpha=Math.max(0,Math.min(1,debt/TICK_DT))}interpPhase=s.phase;interpTickMark=engine.tick;renderer.render(s,raw,false,displayPositions(s,alpha));const cine=renderer.inCinematic();barTop.classList.toggle('on',cine);barBottom.classList.toggle('on',cine);if(now-hudAt>66){hud(s);hudAt=now}}}else {renderer.render(engine.state,raw,screen==='title'||screen==='team');barTop.classList.remove('on');barBottom.classList.remove('on');handleMenu()}updateTouchVisibility();if(import.meta.env.DEV&&now-devStatusAt>100){const s=engine.state,p=s.players[s.controlled],b=s.ball;document.body.dataset.match=JSON.stringify({phase:s.phase,screen,half:s.half,elapsed:s.elapsed,time:s.time,score:s.score,controlled:s.controlled,player:{x:p?.x,z:p?.z,vx:p?.vx,vz:p?.vz},ball:{x:b.x,z:b.z,y:b.y,owner:b.owner,flight:b.flight},stats:s.stats});devStatusAt=now}if(screen!=='match'||stepped){clearKeyboardEdges(kb);clearTouchEdges(touch)}requestAnimationFrame(frame)}
addEventListener('resize',()=>renderer.resize());
// PWA: offline app shell in production only (never cache dev iterations).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
if(import.meta.env.DEV) Object.assign(window,{__retro:{get engine(){return engine},snapshot:()=>JSON.parse(JSON.stringify(engine.state)),start:launch}});
// TEST-ONLY diagnostics (dev or ?e2e): high-level multiplayer + sim state for
// the real-browser E2E, plus the redacted net log (categories/counts only —
// never matchToken, SDP bodies, or candidate IPs). The normal player flow is
// still driven through the visible menu; this only lets the test assert
// internal invariants (distinct peer ids, tick sync, hashes).
if (import.meta.env.DEV || e2eMode) {
  Object.assign(window, {
    __floodlightTest: {
      getScreen: () => screen,
      getRoomCode: () => roomCode,
      getInviteUrl: () => inviteUrl,
      getOnlinePeerId: () => myPeerId,
      getRemotePeerId: () => peerId,
      getNetStatus: () => netStatus,
      getMpState: () => mpState,
      getReady: () => ({ iAmReady, peerReady }),
      getNetState: () => (net ? net.state : 'none'),
      hasNetSession: () => !!net?.session,
      isE2E: () => e2eMode,
      getNetLog: () => netlog.dump(),
      getIceStats: () => JSON.parse(JSON.stringify(iceLogStats)),
      getSimulationState: () => {
        const s = engine.state;
        let hash = 0;
        try { hash = engine.hash(); } catch { hash = 0; }
        return {
          tick: engine.tick,
          hash,
          score: [...s.score],
          half: s.half,
          phase: s.phase,
          elapsed: s.elapsed,
          screen,
          mpState,
          roomCode,
        };
      },
    },
  });
}
// Optional TURN relay (`?turn=turn:host:port&turnuser=u&turnpass=p`, also
// sticky per-browser): persisted before invite handling clears the query.
// Credentials never enter logs, URLs built by the game, or the room.
try { persistTurnConfig(location.search); } catch { /* best-effort */ }
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
