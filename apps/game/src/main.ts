import { renderShareCard, type ShareCardData, type CardFormat } from './share/card';
import type { BotAssignment } from './city-league/bot-match';
import { encodeInput, decodeInput } from './net/codec';
import { RoomTransport } from './net/room-transport';
import { queueRequest, type MatchAssignment } from './net/matchmaking';
import { countryTeams } from './city-league/kits';
import './style.css';
import { MatchEngine } from './engine';
import { AI_LEVELS, type AiLevel } from './engine';
import { GameRenderer } from './renderer';
import { EMPTY_INPUT, TEAMS, type InputFrame, type MatchState, type TeamId } from './types';
import { MatchAudio } from './audio/audio';
import { createTouchState, clearTouchEdges, resetTouch } from './input/touch';
import { createKeyboardState, keyDown, keyUp, isBlockedKey, clearKeyboardEdges, resetKeyboard } from './input/keyboard';
import { buildInputFrame } from './input/input';
import { SimulationClock, TICK_DT } from './game/clock';
import { initAnalytics, needsConsent, showConsentBanner, track } from './analytics';
import { setupTouchControls } from './ui/touch-controls';
import { NetDriver } from './net/driver';
import {
  RTCTransport, isIcePayload, persistTurnConfig, resolveExtraServers, summarizeStats,
} from './net/transport';
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
  copyText, formatRoomCode, friendlyNetError, normalizeRoomCode, withRelayHint,
} from './net/invite';
import {
  LeagueApi, LeagueApiError, dailyKey, dailySeed, getClientId, getDailyBest, getDisplayName, getLeagueCode, getServerUrl,
  normalizeCode, parseScore, setDailyBest, setDisplayName, setLeagueCode, setServerUrl, tableLine,
  type Fixture, type League,
} from './league/client';
import { CITIES, cityName, getCity } from './city-league/cities';
import { getCurrentSeasonEnd, getCurrentSeasonKey, getCurrentSeasonStart } from './city-league/season';
import {
  clearPendingInvite, getInviteCodeFromLocation, getPendingInvite, savePendingInvite,
  buildChallengeMessage, buildInviteUrl, buildWhatsAppUrl,
} from './city-league/invite';
import { CityLeagueApi, seasonCountdown, type CityLeagueResponse } from './city-league/api';
import { getProfile, saveProfile, type CityProfile } from './city-league/profile';

type Screen = 'title'|'team'|'match'|'pause'|'half'|'full'|'online'|'host'|'join'|'netready'
  |'league'|'leaguecreate'|'leaguejoin'|'leagueserver'|'leagueview'|'leaguesubmit'|'leagueresolve'|'leaguescore'
  |'onboard'|'city'|'search';
const app=document.querySelector<HTMLDivElement>('#app')!;
const renderer=new GameRenderer(app); const audio=new MatchAudio();
const flowTest=import.meta.env.DEV&&new URLSearchParams(location.search).has('test');
// Captured before invite-link handling clears the query string: drives the
// TEST-ONLY short match (?e2e=1) and test instrumentation. Production play
// never sets ?e2e, so production durations are unaffected.
const bootSearch = location.search;
const e2eMode = isE2EMode(bootSearch);
let screen:Screen='title', menuIndex=0, teamIndex=0, duration=60, engine=new MatchEngine(0,60,1), last=performance.now(), muted=audio.isMuted, devStatusAt=0, hudAt=0, menuDirty=true;
/** Arcade match lengths (half duration, seconds): 1-2-3-5 min halves, default 1 (2-min match). */
const MATCH_LENGTHS = [60, 120, 180, 300];
/** Solo difficulty for the AI opponent (online always plays pro on both peers). */
let aiLevel: AiLevel = 1;
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
/** TURN relay provenance for this attempt ('off' = STUN-only, see net/transport). */
let relaySource = 'off';
let roomCode = '', matchToken = '', peerId = '', myPeerId = '';
let peerReady = false, iAmReady = false;
// Shareable invite for the current host room (code only, no SDP/secrets).
let copyNote = '';
// ---- City League meta-layer (never enters the deterministic simulation) ----
let cityProfile: CityProfile | null = null;
let queueGeneration = 0, queueTicket = '', queueWaiting = 0, queueStarted = 0;
let queueTimer: ReturnType<typeof setTimeout> | undefined;
let botMatch: BotAssignment | null = null;
let botReplay: number[] = [];
let rankedMode = false, cityMatchBusy = false;
function cancelSearch() {
  queueGeneration++;
  clearTimeout(queueTimer);
  const ticket = queueTicket; queueTicket = '';
  if (ticket) void queueRequest('cancel', { ticket }).catch(() => {});
}
async function findCountryMatch() {
  if (!cityProfile || screen === 'search') return;
  closeNet(); cancelSearch();
  const generation = ++queueGeneration;
  screen = 'search'; queueStarted = Date.now(); queueWaiting = 0; netStatus = ''; menuDirty = true;
  const peerId = createSessionPeerId();
  const alive = () => generation === queueGeneration && screen === 'search';
  try {
    await cityApi().upsertProfile({ clientId: cityProfile.clientId, displayName: cityProfile.displayName, cityCode: cityProfile.cityCode });
    if (!alive()) return;
    const first = await queueRequest('join', { clientId: cityProfile.clientId, peerId });
    if (!alive()) { if (first.ticket) void queueRequest('cancel', { ticket: first.ticket }).catch(() => {}); return; }
    queueTicket = first.ticket ?? '';
    const update = async (reply: Awaited<ReturnType<typeof queueRequest>>) => {
      if (!alive()) return;
      queueWaiting = reply.waiting ?? 0; menuDirty = true;
      if (reply.status === 'matched' && reply.kind === 'bot' && reply.bot) { launchBot(reply.bot); return; }
      if (reply.status === 'matched' && reply.roomCode && reply.role && reply.peerId) {
        rankedMode = true; duration = 60;
        const assignment = reply as MatchAssignment;
        screen = assignment.role === 'host' ? 'host' : 'join';
        roomCode = assignment.roomCode; netStatus = 'OPPONENT FOUND · CONNECTING';
        void startRankedMatch(assignment);
        return;
      }
      if (reply.status === 'expired' || reply.status === 'cancelled') throw new Error('Search ended. Tap Play to find another opponent.');
      queueTimer = setTimeout(() => {
        void queueRequest('poll', { ticket: queueTicket }).then(update).catch(fail);
      }, 2500);
    };
    const fail = (error: unknown) => {
      if (!alive()) return;
      cancelSearch(); screen = 'title'; netStatus = error instanceof Error ? error.message : 'Could not find a match. Try again.'; menuDirty = true;
    };
    await update(first);
  } catch (error) {
    if (!alive()) return;
    cancelSearch(); screen = 'title'; netStatus = error instanceof Error ? error.message : 'Matchmaking unavailable'; menuDirty = true;
  }
}
addEventListener('pagehide', cancelSearch);
async function startRankedMatch(assignment: MatchAssignment) {
  const generation = ++netGen;
  netBusy = true; myPeerId = assignment.peerId; netlog.clear();
  netlog.log('signal', 'country match uses reserved Cloudflare room relay');
  mpState = 'negotiating';
  try {
    const connected = await RoomTransport.connect(location.origin, assignment.roomCode, assignment.peerId);
    if (generation !== netGen) { connected.transport.close(); return; }
    roomCode = assignment.roomCode; matchToken = connected.matchToken;
    hookDriver(new NetDriver(connected.transport, { host: assignment.role === 'host', duration: import.meta.env.DEV && e2eMode ? 5 : 60, delay: 12, matchToken, localProfile: myCityProfilePacket() }));
  } catch (error) {
    if (generation !== netGen) return;
    closeNet(); screen = 'title'; menuIndex = 0;
    netStatus = error instanceof Error ? error.message : 'Connection failed. Try again.'; menuDirty = true;
  }
}
function autoReadyRanked() {
  if (rankedMode && cityMatch && screen === 'netready' && !iAmReady) {
    setTimeout(() => { if (rankedMode && cityMatch && screen === 'netready' && !iAmReady) doReady(); }, 700);
  }
}

let onboardName = '', onboardCity = 'TR', onboardMsg = '';
let pendingInviteCode: string | null = null;
let autoJoinAttempted = false;
let cityTable: CityLeagueResponse | null = null, cityMsg = '', cityBusy = false;
let cityMatch: { matchId: string; matchToken: string; homeClientId: string; awayClientId: string; homeCity: string; awayCity: string } | null = null;
let cityResult: { status: 'idle' | 'confirming' | 'confirmed' | 'disputed' | 'friendly' | 'error'; detail: string; rankText: string } = { status: 'idle', detail: '', rankText: '' };
let preMatchRanks: Record<string, number> = {};
const cityApi = () => new CityLeagueApi(location.origin);
function myCityProfilePacket(): { clientId: string; displayName: string; cityCode: string } | null {
  if (!cityProfile) return null;
  return { clientId: cityProfile.clientId, displayName: cityProfile.displayName, cityCode: cityProfile.cityCode };
}
async function syncProfileToServer() {
  if (!cityProfile) return;
  try {
    await cityApi().upsertProfile({ clientId: cityProfile.clientId, displayName: cityProfile.displayName, cityCode: cityProfile.cityCode });
  } catch { /* offline: local profile still rules; retry next launch */ }
}
async function refreshCityTable(silent = false) {
  if (cityBusy) return;
  cityBusy = true; if (!silent) menuDirty = true;
  try {
    cityTable = await cityApi().getTable();
    try {
      const ranks: Record<string, number> = {};
      for (const r of cityTable.standings) ranks[r.cityCode] = r.rank;
      if (Object.keys(preMatchRanks).length === 0) preMatchRanks = ranks;
    } catch { /* ignore */ }
    cityMsg = '';
  } catch {
    if (!silent) cityMsg = 'TABLE UNAVAILABLE — CHECK CONNECTION';
  }
  cityBusy = false; menuDirty = true;
}
function inviteUrlFor(code: string): string {
  try { return buildInviteUrl(import.meta.env.DEV ? location.origin : 'https://hncleague.com', code); } catch { return ''; }
}
function myCityName(): string {
  return cityProfile ? (getCity(cityProfile.cityCode)?.name ?? cityProfile.cityCode) : '';
}
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
const isTouchDevice=(import.meta.env.DEV&&new URLSearchParams(location.search).has('touch'))||matchMedia('(pointer: coarse)').matches||'ontouchstart' in window;
const ui=document.createElement('div');ui.className='ui';app.append(ui);
const barTop=document.createElement('div');barTop.className='cinebar top';ui.append(barTop);
const barBottom=document.createElement('div');barBottom.className='cinebar bottom';ui.append(barBottom);
let camNote='',camNoteAt=0;
const radar=document.createElement('canvas'); radar.className='radar';radar.width=308;radar.height=184;
function keyName(e:KeyboardEvent){return e.code}
addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('textarea, input, select, button, summary, [contenteditable]'))return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyDown(kb, keyName(e));audio.enable();});
addEventListener('keyup',e=>{if((e.target as HTMLElement)?.matches('textarea, input, select, button, summary, [contenteditable]'))return;if(isBlockedKey(keyName(e)))e.preventDefault(); keyUp(kb, keyName(e));});
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
function launch(){closeNet();dailyMode=false;track('match_start',{mode:'solo',halves:duration/60,cpu:aiLevel});engine=new MatchEngine(teamIndex,flowTest?8:duration,Math.floor(Math.random()*999999),aiLevel);viewTeam=0;renderer.setFollow(null,null);screen='match';menuIndex=0;audio.event({type:'whistle'});}
/** Daily Cup: one deterministic match per calendar day, same seed worldwide. */
function launchDaily(){closeNet();dailyMode=true;track('match_start',{mode:'daily',halves:duration/60});engine=new MatchEngine(teamIndex,flowTest?8:duration,dailySeed(),aiLevel);viewTeam=0;renderer.setFollow(null,null);screen='match';menuIndex=0;audio.event({type:'whistle'});}
/** Full-time share card: score + stats as a PNG via Web Share (or download). */
const publicGameUrl = import.meta.env.DEV ? location.origin + '/' : 'https://hncleague.com/';
let resultShareNote = '';
function resultShareText() {
  const s = engine.state;
  return `HNC League · ${s.teams[0].name} ${s.score[0]}–${s.score[1]} ${s.teams[1].name}\nI played for ${s.teams[viewTeam].name}. Can you do better for your country?`;
}
async function shareCountryResult(copyOnly = false) {
  const text = resultShareText(), url = publicGameUrl;
  try {
    if (!copyOnly && navigator.share) { await navigator.share({ title: 'HNC League · Full time', text, url }); return; }
    resultShareNote = await copyText(`${text}\n${url}`) ? 'RESULT LINK COPIED · SEND IT TO YOUR FRIENDS' : 'COULD NOT COPY · TRY WHATSAPP OR SAVE THE CARD';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    resultShareNote = 'SHARING UNAVAILABLE · TRY COPY OR SAVE THE CARD';
  }
  menuDirty = true;
}
function shareResult(){
  if (document.querySelector('.share-studio')) return;
  const s=engine.state, mine=viewTeam, rival=mine===0?1:0;
  const friendly=!cityMatch || cityMatch.homeCity===cityMatch.awayCity;
  const points=cityResult.status==='confirmed'&&!friendly ? (s.score[mine]>s.score[rival]?3:s.score[mine]===s.score[rival]?1:0) : null;
  const data:ShareCardData={mine:s.teams[mine],rival:s.teams[rival],myScore:s.score[mine],rivalScore:s.score[rival],myShots:s.stats.shots[mine],rivalShots:s.stats.shots[rival],points,friendly};
  const priorFocus=document.activeElement as HTMLElement|null;
  const modal=document.createElement('dialog');modal.className='share-studio';modal.setAttribute('aria-labelledby','share-studio-title');
  modal.innerHTML=`<div class="share-studio-head"><div><div class="eyebrow">TAKE THE RIVALRY WITH YOU</div><h2 id="share-studio-title">Make the group chat interesting.</h2></div><button class="share-close" aria-label="Close share preview">×</button></div><div class="share-formats" role="group" aria-label="Card format"><button data-format="feed" aria-pressed="true">POST <small>4:5</small></button><button data-format="story" aria-pressed="false">STORY <small>9:16</small></button></div><div class="share-card-preview"></div><div class="share-studio-actions"><button data-share-save data-testid="download-share-card">DOWNLOAD CARD ↓</button><button data-share-send>SHARE CARD ↗</button></div><p class="share-feedback" role="status">Your country. Your score. Your bragging rights.</p>`;
  document.body.appendChild(modal);
  let format:CardFormat='feed',file:File|null=null,revision=0;
  const save=modal.querySelector<HTMLButtonElement>('[data-share-save]')!,send=modal.querySelector<HTMLButtonElement>('[data-share-send]')!;
  const feedback=modal.querySelector<HTMLElement>('.share-feedback')!;
  function render() {
    const version=++revision;file=null;save.disabled=send.disabled=true;
    const canvas=renderShareCard(data,format);canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${data.mine.name} ${data.myScore}, ${data.rival.name} ${data.rivalScore} — ${format} share card`);
    modal.querySelector('.share-card-preview')!.replaceChildren(canvas);
    canvas.toBlob(blob=>{if(!blob||version!==revision)return;file=new File([blob],`hnc-league-${format}.png`,{type:'image/png'});save.disabled=send.disabled=false;});
    modal.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.format===format)));
  }
  function close(){modal.close();modal.remove();priorFocus?.focus();}
  modal.querySelector('.share-close')!.addEventListener('click',close);
  modal.addEventListener('cancel',e=>{e.preventDefault();close();});
  modal.addEventListener('keydown',e=>e.stopPropagation());
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  modal.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(b=>b.onclick=()=>{format=b.dataset.format as CardFormat;render();});
  save.onclick=()=>{
    if(!file)return;const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
    feedback.textContent='Saved. Add it to your next post or story.';
  };
  send.onclick=()=>{
    if(!file)return;
    if(navigator.canShare?.({files:[file]})) {
      void navigator.share({files:[file],title:'HNC League',text:resultShareText(),url:publicGameUrl}).catch(error=>{if(error?.name!=='AbortError')feedback.textContent='Sharing unavailable. Download the card instead.';});
    } else { save.click(); feedback.textContent='Card downloaded. Attach it to your post or story.'; }
  };
  render();modal.showModal();modal.querySelector<HTMLButtonElement>('.share-close')!.focus();
}
/** Enter an online match once the driver's handshake completes. */
function launchBot(assignment: BotAssignment) {
  closeNet(); botMatch = assignment; botReplay = []; dailyMode = false;
  cityMatch = { matchId: assignment.matchId, matchToken: assignment.matchToken,
    homeClientId: assignment.homeClientId, awayClientId: assignment.awayClientId,
    homeCity: assignment.homeCountry, awayCity: assignment.opponentCountry };
  cityResult = { status: 'idle', detail: '', rankText: '' };
  preMatchRanks = Object.fromEntries((cityTable?.standings ?? []).map(r => [r.cityCode, r.rank]));
  engine = new MatchEngine(0, assignment.halfDuration, assignment.seed, assignment.difficulty as AiLevel);
  engine.state.teams = countryTeams(assignment.homeCountry, assignment.opponentCountry);
  viewTeam = 0; soloClock.reset(); renderer.setFollow(null, null);
  screen = 'match'; menuIndex = 0; menuDirty = true;
  audio.event({ type: 'whistle' });
}
function stepSolo(frame: InputFrame) {
  if (engine.state.phase === 'fulltime' || engine.state.phase === 'halftime') return;
  if (botMatch) {
    const bytes = encodeInput(frame);
    botReplay.push(...bytes);
    engine.update(1 / 60, decodeInput(bytes));
  } else engine.update(1 / 60, frame);
}
async function submitBotResult() {
  let binary = '';
  for (const byte of botReplay) binary += String.fromCharCode(byte);
  const response = await fetch(`/api/bot-matches/${botMatch!.matchId}/result`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: cityProfile!.clientId, matchToken: botMatch!.matchToken, replay: btoa(binary) }),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Result could not be confirmed');
  return result;
}
function launchNet(driver: NetDriver) {
  net = driver;
  engine = driver.session!.engine;
  viewTeam = driver.myTeam;
  const local = cityProfile?.cityCode, remote = driver.remoteProfile?.cityCode;
  if (local && remote) engine.state.teams = driver.myTeam === 0 ? countryTeams(local, remote) : countryTeams(remote, local);
  renderer.setFollow(engine.controlOf(viewTeam), engine.targetOf(viewTeam));
  screen = 'match'; menuIndex = 0; soloClock.reset();
  mpState = 'playing';
  try {
    if (cityTable) {
      const ranks: Record<string, number> = {};
      for (const r of cityTable.standings) ranks[r.cityCode] = r.rank;
      preMatchRanks = ranks;
    }
  } catch { /* best-effort */ }
  if (!cityMatch) {
    const isHost = driver.myTeam === 0;
    if (isHost) void ensureCityMatch(true);
  } else {
    try { driver.announceCityMatch(cityMatch.matchId, cityMatch.matchToken); } catch { /* ignore */ }
  }
  track('match_start', { mode: 'online', halves: engine.state.halfDuration / 60 });
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
  cancelSearch(); rankedMode = false; botMatch = null; botReplay = [];
  // Invalidate every in-flight async handshake step FIRST: a stale offer,
  // answer or join that resolves after teardown must never hook a driver
  // into a solo match or a newer session (second-connect cross-talk).
  netGen++;
  stopStatsWatch();
  if (net) { try { net.quit(); } catch { /* link already dead */ } net = null; }
  closeNegTransport();
  if (sig) { try { sig.close(); } catch { /* already gone */ } sig = null; }
  roomCode = ''; matchToken = ''; peerId = ''; myPeerId = ''; relaySource = 'off';
  copyNote = '';
  peerReady = false; iAmReady = false;
  netStatus = ''; netBusy = false;
  if (screen !== 'full') {
    cityMatch = null;
    cityResult = { status: 'idle', detail: '', rankText: '' };
  }
  if (mpState !== 'playing' && mpState !== 'finished' && mpState !== 'error') mpState = 'idle';
  viewTeam = 0; renderer.setFollow(null, null);
}
function openPause(){if(screen==='match'){engine.state.paused=true;if(net)net.setPaused(true);screen='pause';menuIndex=0;menuDirty=true;resetKeyboard(kb);resetTouch(touch);mouseAim.down=false;mouseAim.aimU=mouseAim.aimV=0;}}
function resumePlay(){screen='match';engine.state.paused=false;if(net)net.setPaused(false);}
/** Leave the HALF TIME screen: guests follow the host's packet, everyone
 *  else continues the sim (and the host broadcasts). Called from the menu
 *  (Enter) and the auto-continue timer (fast arcade flow, no stuck halves). */
function continueFromHalf() {
  if (net && viewTeam === 1) {
    // Guest follows the host's broadcastHalf packet (engine already left
    // halftime): return to the match screen so simulation resumes. While
    // the engine still shows halftime, keep waiting for the host.
    if (engine.state.phase !== 'halftime') { screen = 'match'; audio.event({ type: 'whistle' }); }
    return;
  }
  engine.continueHalf(); if (net) net.broadcastHalf(); screen = 'match'; audio.event({ type: 'whistle' });
}
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
/** Landscape-by-default on phones: the installed PWA already declares it
 *  (manifest), and on kickoff we ask the OS to lock while the tap gesture
 *  is fresh. Browser tabs reject the lock — caught, and the portrait nudge
 *  in hud() covers those. Back on the title hub we release the lock. */
let orientMode: '' | 'locked' | 'free' = '';
function fitOrientation() {
  if (!isTouchDevice) return;
  try {
    const o = window.screen?.orientation;
    if (!o) return;
    if (screen === 'match') {
      if (orientMode !== 'locked') {
        orientMode = 'locked';
        void o.lock('landscape').catch(() => {});
      }
    } else if (screen === 'title' && orientMode !== 'free') {
      orientMode = 'free';
      o.unlock();
    }
  } catch { /* lock unavailable: portrait-tolerant rendering + nudge */ }
}
function input():InputFrame {
  const r = buildInputFrame(kb, touch, shootWasDown,
    { passWasDown, stickSprintOn, aim: (mouseAim.down || kb.released.has('MouseL')) ? mouseAim : undefined });
  shootWasDown = r.shootWasDown; passWasDown = r.passWasDown; stickSprintOn = r.stickSprint;
  return r.frame;
}
function clock(s:MatchState){const football=Math.min(45,Math.floor(s.elapsed/s.halfDuration*45));return `${s.half===2?45+football:football}'`}
function drawRadar(s:MatchState,vt:TeamId,ctl:number){const c=radar.getContext('2d')!;c.clearRect(0,0,308,184);c.fillStyle='#1b6b43';c.fillRect(0,0,308,184);c.strokeStyle='#f8efdb';c.lineWidth=2;c.strokeRect(3,3,302,178);c.beginPath();c.moveTo(154,3);c.lineTo(154,181);c.stroke();for(const p of s.players){c.fillStyle=p.team===vt?'#f7bf30':'#ef4054';c.beginPath();c.arc((p.x/46+1)*154,(p.z/29+1)*92, p.id===ctl?6:4,0,7);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc((s.ball.x/46+1)*154,(s.ball.z/29+1)*92,4,0,7);c.fill();}
function onlineCityShorts(): { my: string; opp: string } | null {
  try {
    if (!net || !cityProfile) return null;
    if (cityMatch && cityMatch.homeCity && cityMatch.awayCity) {
      const home = (getCity(cityMatch.homeCity)?.short ?? cityMatch.homeCity);
      const away = (getCity(cityMatch.awayCity)?.short ?? cityMatch.awayCity);
      return viewTeam === 0 ? { my: home, opp: away } : { my: away, opp: home };
    }
    const remote = (net as unknown as { remoteProfile?: { cityCode: string } }).remoteProfile;
    if (remote?.cityCode) {
      const my = (getCity(cityProfile.cityCode)?.short ?? cityProfile.cityCode);
      const opp = (getCity(remote.cityCode)?.short ?? remote.cityCode);
      return viewTeam === 0 ? { my, opp } : { my: opp, opp: my };
    }
  } catch { /* display only */ }
  return null;
}
function hud(s:MatchState){const portrait=isTouchDevice&&innerHeight>innerWidth;const vt=net?viewTeam:s.humanTeam,ctl=net?engine.controlOf(vt):s.controlled;const me=s.players[ctl];const cityShorts=onlineCityShorts();const myDisp=cityShorts?{...s.teams[vt],short:cityShorts.my}:s.teams[vt];const awayDisp=cityShorts?{...s.teams[1-vt],short:cityShorts.opp}:s.teams[1-vt];const my=myDisp,away=awayDisp;const how=s.phase==='corner'?'AIM · LONG CROSS · PASS SHORT':s.phase==='throwin'?'AIM · PASS THROW':s.phase==='goalkick'?'PASS SHORT · LONG CLEAR': 'PASS KICK OFF · LONG BALL';const restart=s.restart?`${s.teams[s.restart.team].name.toUpperCase()} ${s.phase==='throwin'?'THROW-IN':s.phase==='corner'?'CORNER':s.phase==='goalkick'?'GOAL KICK':'KICKOFF'}${s.restart.team===vt?`<small>${how}</small>`:'<small>OPPONENT TAKING RESTART</small>'}`:'';const toast=performance.now()-camNoteAt<1600?`<div class="camtoast">📷 ${camNote}</div>`:'';const holder=s.ball.owner===null?null:s.players[s.ball.owner];const keeperHint=holder&&holder.keeper&&holder.team===vt?`<div class="keeper-hint">🧤 KEEPER<small>PASS SHORT · LONG CLEAR</small></div>`:holder&&holder.keeper?`<div class="keeper-hint">🧤 OPPONENT KEEPER HAS IT<small>SHAPE UP — PRESSURE AFTER RELEASE</small></div>`:'';touchControls.updateOffense((holder !== null && holder.team === vt) || s.restart?.team === vt);const aimU=mouseAim.down?mouseAim.aimU:(touch.aimU||0),aimV=mouseAim.down?mouseAim.aimV:(touch.aimV||0);const reticle=s.charge>0?`<div class="reticle"><div class="rgoal"><div class="rposts"></div><i class="raim" style="left:${(50+aimU*46).toFixed(1)}%;bottom:${(8+aimV*80).toFixed(1)}%"></i></div><small>AIM ${aimU===0&&aimV===0?'LOW FINISH':'PLACED'} · POWER ${Math.min(100,s.charge/.45*100).toFixed(0)}%</small></div>`:'';ui.innerHTML=`<div class="scoreboard"><div class="club">${my.short}</div><div class="score">${s.score[vt]} – ${s.score[1-vt]}</div><div class="club">${away.short}</div><div class="clock">${s.half===1?'1ST':'2ND'} ${clock(s)}</div></div>${portrait&&s.phase==='playing'&&s.messageTime<=0&&s.elapsed<8?`<div class="rotate-hint">\u27F3 ROTATE FOR THE FULL PITCH</div>`:''}<div class="attack">YOU: ${my.name.toUpperCase()}<br>ATTACK ${s.attack[vt]>0?'→':'←'}</div><div class="camchip">📷 ${renderer.cameraLabel()}</div><div class="player-info">▲ ${me?.name||'PLAYER'}</div>${s.charge>0?`<div class="charge"><i style="width:${Math.min(100,s.charge/.45*100)}%"></i></div>`:''}${reticle}<div class="strip">${isTouchDevice ? 'STICK MOVE · RIM SPRINT<br>PASS/TACKLE · LONG/SLIDE · SHOOT/TACKLE · SWITCH' : 'ARROWS MOVE · S PASS · W/A LONG · D SHOOT · SPACE SWITCH<br>E/SHIFT SPRINT · C CAMERA · ESC PAUSE · M ' + (muted ? 'UNMUTE' : 'MUTE')}</div>${toast}${keeperHint}${!restart&&s.messageTime>0?`<div class="message">${s.message}<small>${s.phase==='goal'?'KICKOFF IN A MOMENT':''}</small></div>`:''}${restart?`<div class="message">${restart}</div>`:''}`;ui.append(barTop,barBottom,radar);drawRadar(s,vt,ctl);}
function panel(content:string){ui.innerHTML=`<div class="screen"><div class="panel">${content}</div></div>`;wireMenuItems();}
/** Touch/mouse: tapping a menu item selects it (keyboard flow unchanged).
 *  Team-setup rows carry data-act="cycle-N": tapping cycles that row's value
 *  instead of kicking off. */
function wireMenuItems() {
  ui.querySelectorAll<HTMLElement>('.menu-item[data-mi]').forEach(el => {
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    el.onclick = () => { menuIndex = Number(el.dataset.mi); menuDirty = true; handleMenuEnter(el.dataset.act); };
  });
  ui.querySelectorAll<HTMLElement>('.netbtn').forEach(el => {
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    el.onclick = () => handleMenuEnter(el.dataset.act);
  });
  const code = ui.querySelector<HTMLTextAreaElement>('.netcode');
  if (code && code.readOnly) code.onclick = () => { code.focus(); code.select(); };
}
/**
 * Waiting-progress readout for the lobby (host + join screens): four
 * stages with done/active states derived from mpState, plus a CSS spinner.
 * Pure display — the handshake state machine is untouched. Stages:
 * ROOM (created/joined) → FRIEND (peer present) → LINK (WebRTC + driver) → READY.
 */
function waitSteps(): string {
  const order: MultiplayerDebugState[] = ['creating-room', 'joining-room'];
  const stage = order.includes(mpState) ? 0
    : mpState === 'waiting-for-peer' ? 1
    : mpState === 'negotiating' ? 2
    : 3;
  const labels = screen === 'host'
    ? ['ROOM', 'FRIEND', 'LINK', 'READY']
    : ['ROOM', 'JOIN', 'LINK', 'READY'];
  const steps = labels.map((label, i) =>
    `<span class="wstep${i < stage ? ' done' : ''}${i === stage ? ' active' : ''}">${i < stage ? '✓ ' : ''}${label}</span>`,
  ).join('<span class="wsep">·</span>');
  return `<div class="waitspinner" data-testid="wait-spinner" aria-hidden="true"></div>`
    + `<div class="waitsteps" data-testid="wait-steps">${steps}</div>`;
}
function menu(){ if(!menuDirty)return; menuDirty=false;
  if(screen==='onboard') {
    panel(`<div class="eyebrow">HNC LEAGUE</div><div class="title tlg">PLAY FOR<br>YOUR COUNTRY.</div>`
      + `<label class="hint" for="onboard-name">YOUR NAME</label>`
      + `<textarea class="netpaste netcode" id="onboard-name" data-testid="onboard-name" rows="1" maxlength="16" placeholder="HUNÇ" autocapitalize="words" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>`
      + `<label class="hint" for="onboard-country">CHOOSE YOUR COUNTRY</label>`
      + `<select class="netcode" id="onboard-country" data-testid="onboard-country">${CITIES.map(c => `<option value="${c.code}" ${c.code === onboardCity ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('')}</select>`
      + `${onboardMsg?`<div class="subtitle" data-testid="onboard-msg">${onboardMsg}</div>`:''}`
      + `<button class="menu-item netbtn" data-act="onboard-continue" data-testid="onboard-continue">▶ CONTINUE</button>`
      + `<div class="hint">NO SIGNUP · ONE COUNTRY PER WEEK<br>WIN +3 · DRAW +1 · PLAY FOR NATIONAL PRIDE</div>`);
    const nameInput = ui.querySelector<HTMLTextAreaElement>('#onboard-name')!;
    nameInput.value = onboardName;
    nameInput.oninput = () => { onboardName = nameInput.value; };
    nameInput.onkeydown = (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault(); doOnboardContinue();
      }
    };
    ui.querySelector<HTMLSelectElement>('#onboard-country')!.onchange = (event) => {
      onboardCity = (event.target as HTMLSelectElement).value;
      onboardMsg = '';
    };
    wireMenuItems();
    return;
  }
  if(screen==='title') {
    const country = cityProfile ? getCity(cityProfile.cityCode) : null;
    if (country) engine.state.teams = countryTeams(country.code, country.code === 'BR' ? 'TR' : 'BR');
    const mine = cityTable?.standings.find(r => r.cityCode === cityProfile?.cityCode);
    const ends = cityTable ? seasonCountdown(Date.now(), cityTable.season.endsAt) : '';
    panel(`<div class="eyebrow">HNC LEAGUE · WORLD LOBBY</div>
      <div class="country-hero"><span class="country-flag">${country?.flag ?? '⚽'}</span><h1>${country?.name ?? 'Your country'}</h1><p>${cityProfile?.displayName ?? ''}, your country needs you.</p></div>
      <div class="country-stats"><div><strong>${mine ? '#' + mine.rank : '—'}</strong><span>WORLD RANK</span></div><div><strong>${mine?.points ?? '—'}</strong><span>COUNTRY POINTS</span></div><div><strong>${ends || 'WEEKLY'}</strong><span>SEASON ENDS</span></div></div>
      <button class="menu-item lobby-play ${menuIndex === 0 ? 'selected' : ''}" data-mi="0" data-testid="find-match">PLAY FOR ${country?.name.toUpperCase() ?? 'YOUR COUNTRY'} <span>FIND A 1V1 OPPONENT →</span></button>
      <div class="lobby-friend"><button class="menu-item ${menuIndex === 1 ? 'selected' : ''}" data-mi="1" data-testid="challenge-friend">PLAY WITH A FRIEND <span>CREATE A LINK · SHARE · KICK OFF →</span></button></div><div class="lobby-secondary"><button class="menu-item netbtn" data-act="join-friend">JOIN WITH CODE</button><button class="menu-item ${menuIndex === 2 ? 'selected' : ''}" data-mi="2" data-testid="world-table">WORLD TABLE</button></div>
      ${netStatus ? `<div class="subtitle" role="status">${netStatus.replace(/[<>&]/g, '')}</div>` : ''}
      <div class="hint">COUNTRY VS COUNTRY · NATIONAL TEAMS<br>WIN +3 · DRAW +1 · EVERY CONFIRMED RESULT COUNTS</div>
      <p class="matchmaking-info">Computer-controlled opponents may fill empty slots. These matches also count toward country standings.</p><a class="rules-link" href="/how-to-play.html" target="_blank" rel="noopener">RULES & HOW TO PLAY ↗</a><details class="lobby-help"><summary>HOW IT WORKS & CONTROLS</summary><p>We find an opponent representing another country. Control your full national team. Play two 60-second halves and climb the weekly world table together.</p><p>Your country stays locked for the week. Matches between the same country are friendlies. Points count after the result is verified.</p><p>${isTouchDevice ? 'STICK: MOVE · PASS · LONG · SHOOT · SWITCH' : 'ARROWS: MOVE · S: PASS · W/A: LONG · D: SHOOT · SPACE: SWITCH · SHIFT: SPRINT'}</p></details>`);
    return;
  }
  if(screen==='search') {
    const country = cityProfile ? getCity(cityProfile.cityCode) : null;
    panel(`<div class="eyebrow">HNC LEAGUE · MATCHMAKING</div><div class="country-flag">${country?.flag ?? '⚽'}</div><div class="title tlg">FINDING YOUR<br>OPPONENT</div><div class="waitspinner"></div><div class="subtitle">Representing ${country?.name ?? 'your country'}</div><div class="hint" role="status">${queueWaiting > 1 ? `${queueWaiting} PLAYERS SEARCHING` : 'FINDING A RIVAL FROM ANOTHER COUNTRY'}<br>${Date.now() - queueStarted > 20000 ? 'Preparing your match. You can also invite a friend.' : 'Another country. Your next rivalry.'}</div><button class="menu-item netbtn" data-act="search-cancel" data-testid="cancel-search">CANCEL SEARCH</button><button class="menu-item netbtn" data-act="search-friend">INVITE A FRIEND INSTEAD</button>`);
    return;
  }
  if(rankedMode && (screen === 'host' || screen === 'join')) {
    panel(`<div class="eyebrow">COUNTRY MATCH · 1V1</div><div class="title tlg">OPPONENT<br>FOUND</div>${waitSteps()}<div class="subtitle">${netStatus}</div><div class="hint">CONNECTING YOUR MATCH · TWO 60-SECOND HALVES</div><button class="menu-item netbtn" data-act="cancel">CANCEL</button>`);
    return;
  }
  if(screen==='team') { const t=TEAMS[teamIndex],o=TEAMS[(teamIndex+1)%TEAMS.length]; const lvl=AI_LEVELS.find((l)=>l.id===aiLevel)?.label ?? 'PRO'; const rows=[`CLUB · ${t.name.toUpperCase()}`, `LENGTH · ${duration/60} MIN HALVES`, `CPU · ${lvl}`]; panel(`<div class="eyebrow">CHOOSE YOUR CLUB</div><div class="title tmd">SATURDAY CUP</div><div class="team-row"><div class="team-card active"><div class="team-swatch" style="background:${t.color}"></div>${t.name}<br><small>${t.city}</small></div><div class="team-card"><div class="team-swatch" style="background:${o.color}"></div>${o.name}<br><small>OPPONENT</small></div></div>${rows.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}" data-act="cycle-${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="menu-item ${menuIndex===3?'selected':''}" data-mi="3" data-act="kickoff">${menuIndex===3?'▶ ':''}★ KICK OFF</div><div class="hint">${isTouchDevice ? 'TAP A ROW TO CHANGE IT · TAP ★ KICK OFF' : '↑ / ↓ PICK ROW · ← / → CHANGE · ENTER KICK OFF · ESC BACK'}</div>`); return; }
  if(screen==='pause') { const items=['RESUME',botMatch?'FIND NEW MATCH':'RESTART MATCH','MAIN MENU']; panel(`<div class="eyebrow">MATCH PAUSED</div><div class="title tlg">PAUSE</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">${isTouchDevice ? 'STICK MOVE · RIM SPRINT · SWITCH NEAREST<br>PASS: TAP TO FEET, HOLD INTO SPACE<br>SHOOT: HOLD & DRAG TO AIM · LONG: LOFT / SLIDE<br>TAP RESUME TO PLAY' : `ARROWS MOVE · S PASS/TACKLE · D/MOUSE SHOOT/TACKLE · LONG CROSS & SLIDE<br>SPACE SWITCH (AUTO-SWITCH ON) · E/SHIFT SPRINT · C CAMERA (${renderer.cameraLabel()}) · ↑ / ↓ SELECT · ENTER CONFIRM · ESC RESUME`}</div>`); return; }
  if(screen==='online') { const items=['PLAY WITH A FRIEND','JOIN WITH CODE','BACK']; panel(`<div class="eyebrow">CHALLENGE A FRIEND · ONLINE</div><div class="title tlg" data-testid="online-title">ONLINE</div><div class="subtitle">${myCityName().toUpperCase()} · 1V1 · 2 MIN MATCH</div>${netStatus?`<div class="subtitle" data-testid="online-status">${netStatus}</div><div class="menu-item netbtn" data-act="copylog" data-testid="copy-debug-log">▶ COPY DEBUG LOG</div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}" data-testid="online-${x.toLowerCase().replace(/[^a-z]+/g, '-')}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='host') {
    const url = roomCode ? inviteUrlFor(roomCode) : '';
    const city = myCityName().toUpperCase() || 'YOUR COUNTRY';
    panel(`<div class="eyebrow">YOUR CHALLENGE IS READY · YOU ARE TEAM 1</div>`
      + `<div class="title room-code txl" data-testid="room-code">${roomCode ? formatRoomCode(roomCode) : '···'}</div>`
      + `<div class="subtitle">${city} · WAITING FOR OPPONENT…</div>`
      + `<div class="subtitle" data-testid="host-status">${netStatus || '…'}</div>${waitSteps()}`
      + (url?`<textarea class="netpaste netcode" readonly data-testid="invite-url" rows="2">${url}</textarea>`:'')
      + `<button class="menu-item netbtn lobby-play" data-act="share-invite">SHARE INVITE LINK →</button>`
      + `<div class="menu-item netbtn" data-act="whatsapp" data-testid="host-whatsapp">▶ CHALLENGE ON WHATSAPP</div>`
      + `<div class="menu-item netbtn" data-act="copy-invite" data-testid="host-copy">▶ COPY CHALLENGE</div>`
      + `${copyNote?`<div class="hint">${copyNote}</div>`:''}<div class="menu-item netbtn" data-act="copylog" data-testid="copy-debug-log">▶ COPY DEBUG LOG</div><div class="menu-item netbtn" data-act="cancel" data-testid="host-cancel">▶ CANCEL</div>`);
    return;
  }
  if(screen==='join') { panel(`<div class="eyebrow">ENTER THE FRIEND CODE</div><div class="title tlg">JOIN</div><div class="subtitle" data-testid="join-status">${netStatus || 'TYPE THE 6-LETTER CODE'}</div><div class="hint">READ IT OFF YOUR FRIEND\u2019S SCREEN · DASHES OK</div>${roomCode ? '' : `<textarea class="netpaste netcode" id="netcode" data-testid="join-code-input" rows="1" maxlength="7" placeholder="ABC DEF" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><div class="menu-item netbtn" data-act="join" data-testid="join-submit">▶ JOIN</div>`}<div class="menu-item netbtn" data-act="cancel">▶ CANCEL</div>`); return; }
  if(screen==='netready') {
    const items=["I'M READY",'CANCEL'];
    let vs = '';
    try {
      const remote = (net as unknown as { remoteProfile?: { displayName: string; cityCode: string } } | null)?.remoteProfile;
      if (cityProfile) {
        const myC = cityName(cityProfile.cityCode).toUpperCase();
        if (remote) {
          const opC = cityName(remote.cityCode).toUpperCase();
          vs = `<div class="subtitle">${myC} · ${cityProfile.displayName.toUpperCase()} VS ${opC} · ${remote.displayName.toUpperCase()}</div>`;
        } else {
          vs = `<div class="subtitle">${myC} · ${cityProfile.displayName.toUpperCase()} VS …</div>`;
        }
      }
    } catch { /* display only */ }
    panel(`<div class="eyebrow" data-testid="ready-room">${rankedMode ? 'COUNTRY MATCH' : 'FRIEND MATCH'} · 1V1</div><div class="title tlg">READY?</div>${vs}<div class="subtitle" data-testid="ready-status">YOU ${iAmReady ? 'READY ✓' : '…'} · OPPONENT ${peerReady ? 'READY ✓' : '…'}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}" data-testid="ready-${x.toLowerCase().replace(/[^a-z]+/g, '-')}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">${rankedMode ? 'YOUR MATCH STARTS AUTOMATICALLY WHEN CONNECTED' : 'BOTH SIDES PRESS READY — THEN KICK OFF'}</div>`); return;
  }
  if(screen==='city') {
    const rows = cityTable?.standings ?? [];
    const ends = cityTable ? seasonCountdown(Date.now(), cityTable.season.endsAt) : '';
    const top3 = rows.slice(0, 3).map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const mine = cityProfile && r.cityCode === cityProfile.cityCode ? ' ← YOU' : '';
      return `<div class="statline"><span>${medal} ${r.cityName.toUpperCase()} ${r.points}${mine}</span></div>`;
    }).join('');
    const table = rows.map((r) => {
      const mine = cityProfile && r.cityCode === cityProfile.cityCode ? ' ← YOU' : '';
      const gd = r.goalDifference >= 0 ? `+${r.goalDifference}` : `${r.goalDifference}`;
      return `<div class="statline"><span>${r.rank} ${r.cityName.toUpperCase()} ${r.played}P ${gd} ${r.points} PTS${mine}</span></div>`;
    }).join('');
    panel(`<div class="eyebrow">COUNTRY LEAGUE · ${cityTable?.season.key ?? '…'}</div><div class="title tlg">WORLD TABLE</div><button class="menu-item netbtn" data-act="city-back">← LOBBY</button>`
      + (cityTable ? `<div class="hint">SEASON ENDS IN ${ends}</div>${top3}${table}` : `<div class="subtitle">${cityBusy ? 'LOADING…' : (cityMsg || 'TABLE UNAVAILABLE')}</div>`)
      + `<div class="menu-item netbtn" data-act="city-refresh">▶ REFRESH</div><div class="menu-item netbtn" data-act="city-back">▶ BACK</div>`
      + `<div class="hint"># COUNTRY P GD PTS · FULL STATS ON WIDE SCREENS</div>`);
    return;
  }
  if(screen==='league') { const items=['OPEN LEAGUE','CREATE LEAGUE','JOIN LEAGUE','SERVER','BACK']; const saved=getLeagueCode(); panel(`<div class="eyebrow">FRIEND LEAGUES · ROUND ROBIN</div><div class="title tlg">LEAGUE</div><div class="subtitle">${saved ? 'SAVED CODE ' + saved : getServerUrl()}</div>${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return; }
  if(screen==='leaguecreate') { panel(`<div class="eyebrow">START A FRIEND LEAGUE</div><div class="title tmd">CREATE</div><textarea class="netpaste" id="lgname" rows="2" placeholder="LEAGUE NAME"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-create">▶ CREATE LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leaguejoin') { panel(`<div class="eyebrow">JOIN WITH A 6-LETTER CODE</div><div class="title tmd">JOIN</div><textarea class="netpaste" id="lgcode" rows="1" placeholder="LEAGUE CODE" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><textarea class="netpaste" id="lgwho" rows="1" placeholder="YOUR NICKNAME">${getDisplayName()}</textarea><div class="menu-item netbtn" data-act="do-join">▶ JOIN LEAGUE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
  if(screen==='leagueserver') { panel(`<div class="eyebrow">WHERE THE LEAGUE SERVER LIVES</div><div class="title tmd">SERVER</div><textarea class="netpaste" id="lgurl" rows="1">${getServerUrl()}</textarea><div class="menu-item netbtn" data-act="save-server">▶ SAVE</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div>`); return; }
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
    panel(`<div class="eyebrow">CODE ${L?.code ?? '…'} · ${(L?.status ?? '').toUpperCase()} · ${L?.members.length ?? 0} PLAYERS</div><div class="title tsm">${(L?.name ?? 'LEAGUE').toUpperCase()}</div>${L ? L.fixtures.map(fxLine).join('') : `<div class="subtitle">${leagueBusy ? 'LOADING…' : leagueMsg}</div>`}${table}${leagueActions.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}${leagueMsg && L ? `<div class="subtitle">${leagueMsg}</div>` : ''}<div class="hint">PLAY THE MATCH FIRST — THEN BOTH SIDES SUBMIT THE SCORE HERE</div>`); return;
  }
  if(screen==='leaguesubmit'||screen==='leagueresolve') {
    const resolving = screen === 'leagueresolve';
    leaguePick = resolving
      ? (leagueData?.fixtures ?? []).filter((f) => f.status === 'disputed')
      : myOpenFixtures();
    const label = (f: Fixture) => `R${f.round} ${leagueName(f.homeClientId)} ${f.status === 'confirmed' ? `${f.homeScore}-${f.awayScore}` : 'v'} ${leagueName(f.awayClientId)}${f.status === 'disputed' ? ' ⚠' : ''}`;
    panel(`<div class="eyebrow">${resolving ? 'CREATOR RULING' : 'PICK YOUR FIXTURE'}</div><div class="title tmd">${resolving ? 'RESOLVE' : 'SUBMIT'}</div>${leaguePick.length === 0 ? '<div class="subtitle">NOTHING TO DO HERE</div>' : ''}${leaguePick.map((f,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${label(f)}</div>`).join('')}<div class="menu-item ${menuIndex===leaguePick.length?'selected':''}" data-mi="${leaguePick.length}">${menuIndex===leaguePick.length?'▶ ':''}BACK</div><div class="hint">↑ / ↓ SELECT · ENTER CONFIRM · ESC BACK</div>`); return;
  }
  if(screen==='leaguescore') {
    const f = scoreFixture;
    const label = f ? `R${f.round} ${leagueName(f.homeClientId)} v ${leagueName(f.awayClientId)}` : '…';
    panel(`<div class="eyebrow">${scoreMode === 'resolve' ? 'CREATOR RULING — FINAL SCORE' : 'WHAT WAS THE FINAL SCORE?'}</div><div class="title tsm">${label}</div><div class="score-row"><div><div class="hint">${f ? leagueName(f.homeClientId) : 'HOME'}</div><textarea class="netpaste scorebox" id="scoreH" rows="1" placeholder="0" inputmode="numeric" autocomplete="off"></textarea></div><div><div class="hint">${f ? leagueName(f.awayClientId) : 'AWAY'}</div><textarea class="netpaste scorebox" id="scoreA" rows="1" placeholder="0" inputmode="numeric" autocomplete="off"></textarea></div></div><div class="menu-item netbtn" data-act="do-score">▶ ${scoreMode === 'resolve' ? 'CONFIRM RULING' : 'SEND SCORE'}</div><div class="menu-item netbtn" data-act="back">▶ BACK</div><div class="subtitle">${leagueMsg}</div><div class="hint">BOTH SIDES SUBMIT · MATCHING SCORES CONFIRM · CLASHES GO TO THE CREATOR</div>`); return;
  }
  if(screen==='half') { const hs=engine.state; panel(`<div class="eyebrow">HALF TIME · ${hs.score[0]} – ${hs.score[1]}</div><div class="title tlg" data-testid="halftime-title">HALF TIME</div><div class="subtitle" data-testid="halftime-score">${hs.teams[0].short} ${hs.score[0]} – ${hs.score[1]} ${hs.teams[1].short}</div><div class="hint">SECOND HALF STARTS SHORTLY — PRESS ENTER TO CONTINUE</div>`); return; }
  {
    const s=engine.state;
    if ((net || botMatch) && cityMatch) {
      const homeC = cityName(cityMatch.homeCity).toUpperCase();
      const awayC = cityName(cityMatch.awayCity).toUpperCase();
      const sameCity = cityMatch.homeCity === cityMatch.awayCity;
      let cityLine = '';
      if (cityResult.status === 'confirming') cityLine = `<div class="subtitle" data-testid="city-status">CONFIRMING RESULT…</div>`;
      else if (cityResult.status === 'confirmed') cityLine = `<div class="subtitle" data-testid="city-status">RESULT CONFIRMED · ${cityResult.detail}</div>${cityResult.rankText?`<div class="hint">${cityResult.rankText}</div>`:''}`;
      else if (cityResult.status === 'disputed') cityLine = `<div class="subtitle" data-testid="city-status">RESULT COULD NOT BE VERIFIED</div>`;
      else if (cityResult.status === 'error') cityLine = `<div class="subtitle">RESULT NOT CONFIRMED · CHECK YOUR CONNECTION</div><button class="menu-item netbtn" data-act="retry-result">RETRY RESULT</button>`;
      else if (sameCity) cityLine = `<div class="subtitle" data-testid="city-status">FRIENDLY MATCH · NO COUNTRY LEAGUE POINTS</div>`;
      else if (cityResult.status === 'friendly') cityLine = `<div class="subtitle" data-testid="city-status">FRIENDLY MATCH · NO COUNTRY LEAGUE POINTS</div>`;
      else cityLine = `<div class="subtitle" data-testid="city-status">CONFIRMING RESULT…</div>`;
      const items=['PLAY NEXT MATCH','CHALLENGE A FRIEND','WORLD TABLE','LOBBY'];
      panel(`<div class="eyebrow">FULL TIME</div><div class="title tlg" data-testid="fulltime-title">FULL TIME</div>`
        + `<div class="subtitle" data-testid="fulltime-score">${homeC} ${s.score[0]} – ${s.score[1]} ${awayC}</div>${cityLine}`
        + `<button class="menu-item netbtn lobby-play" data-act="share-result" data-testid="share-result">SHARE YOUR RESULT →</button><div class="lobby-secondary"><button class="menu-item netbtn" data-act="result-whatsapp">WHATSAPP</button><button class="menu-item netbtn" data-act="result-copy">COPY RESULT LINK</button></div><button class="menu-item netbtn" data-act="result-x">POST ON X</button><button class="menu-item netbtn" data-act="result-card">PREVIEW SHARE CARD</button>${resultShareNote ? `<div class="hint" role="status">${resultShareNote}</div>` : ''}`
        + `<div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>`
        + `${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
      return;
    }
    const items=['PLAY AGAIN','MAIN MENU','SHARE RESULT'];
    panel(`<div class="eyebrow">${dailyMode?'DAILY CUP · FINAL SCORE':'SATURDAY CUP · FINAL SCORE'}</div><div class="title tlg" data-testid="fulltime-title">FULL TIME</div><div class="subtitle" data-testid="fulltime-score">${s.teams[0].short} ${s.score[0]} – ${s.score[1]} ${s.teams[1].short}</div><div class="statline"><span>SHOTS<strong>${s.stats.shots[0]}–${s.stats.shots[1]}</strong></span><span>SAVES<strong>${s.stats.saves[0]}–${s.stats.saves[1]}</strong></span></div>${dailyMode?`<div class="statline"><span>DAILY BEST<strong>${Math.max(getDailyBest(),s.score[0])}</strong></span></div>`:''}${items.map((x,i)=>`<div class="menu-item ${menuIndex===i?'selected':''}" data-mi="${i}">${menuIndex===i?'▶ ':''}${x}</div>`).join('')}<div class="hint">↑ / ↓ SELECT · ENTER CONFIRM</div>`);
    return;
  }
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
  let last: string | null = null;
  t.onstate = (s) => {
    if (s === last) {
      try { prev?.(s); } catch { /* driver handler */ }
      return;
    }
    last = s;
    netlog.log('dc', `${role} datachannel=${s}`);
    if (s === 'closed') {
      // Best-effort final pair diagnosis (consent lost vs no pair at all).
      void summarizeStats(t.peerConnection)
        .then((sum) => netlog.log('stats', `${role} final ${sum}`))
        .catch(() => {});
    }
    try { prev?.(s); } catch { /* driver handler */ }
  };
}
/** Shared fetch with a stable identity (bare `fetch` loses `this` in Chrome). */
const boundFetch: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init);
let statsTimer: ReturnType<typeof setInterval> | undefined;
function stopStatsWatch() {
  if (statsTimer !== undefined) { clearInterval(statsTimer); statsTimer = undefined; }
}
/** Nominated-pair snapshots while the lobby handshake is pending. */
function startStatsWatch(t: RTCTransport, role: string, token: number) {
  stopStatsWatch();
  statsTimer = setInterval(() => {
    if (token !== netGen || net?.session) { stopStatsWatch(); return; }
    void summarizeStats(t.peerConnection)
      .then((sum) => { if (token === netGen) netlog.log('stats', `${role} ${sum}`); })
      .catch(() => {});
  }, 2500);
}
function attachDriver(d: NetDriver) {
  d.onEvent = (e) => {
    if (e.type === 'connected') {
      netlog.log('driver', 'handshake connected → READY lobby');
      track('online_connected', {});
      stopStatsWatch();
      try {
        const pkt = myCityProfilePacket();
        if (pkt) d.setLocalProfile(pkt);
      } catch { /* meta-layer only */ }
      screen = 'netready'; menuIndex = 0; peerReady = false; iAmReady = false; menuDirty = true;
      mpState = 'connected';
      if (d.myTeam === 0) void ensureCityMatch(true);
      autoReadyRanked();
    }
    else if (e.type === 'peerProfile') {
      menuDirty = true;
      try {
        if (d.myTeam === 0) void ensureCityMatch(true);
      } catch { /* ignore */ }
    }
    else if (e.type === 'cityMatch') {
      try {
        const me = myCityProfilePacket();
        const remote = (d as unknown as { remoteProfile?: { clientId: string; displayName: string; cityCode: string } }).remoteProfile;
        if (!cityMatch && me && remote) {
          const home = d.myTeam === 0 ? me : remote;
          const away = d.myTeam === 0 ? remote : me;
          cityMatch = { matchId: e.matchId, matchToken: e.matchToken, homeClientId: home.clientId, awayClientId: away.clientId, homeCity: home.cityCode, awayCity: away.cityCode };
          cityResult = home.cityCode === away.cityCode
            ? { status: 'friendly', detail: '', rankText: '' }
            : { status: 'idle', detail: '', rankText: '' };
          menuDirty = true; autoReadyRanked();
        } else if (!cityMatch) {
          cityMatch = { matchId: e.matchId, matchToken: e.matchToken, homeClientId: '', awayClientId: '', homeCity: '', awayCity: '' };
        }
      } catch { /* ignore */ }
    }
    else if (e.type === 'peerReady') { netlog.log('driver', 'peer ready'); peerReady = true; menuDirty = true; if (mpState === 'connected') mpState = 'ready'; }
    else if (e.type === 'started') { netlog.log('driver', 'both ready → kickoff'); stopStatsWatch(); mpState = 'playing'; launchNet(d); }
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
        const wasRanked = rankedMode;
        netGen++; closeNet(); mpState = 'error';
        netStatus = 'OPPONENT LEFT · FIND ANOTHER MATCH'; screen = wasRanked ? 'title' : 'online'; menuIndex = 0; menuDirty = true;
      } else {
        closeNet(); screen = 'title'; menuIndex = 0; netStatus = 'OPPONENT DISCONNECTED · NO COUNTRY POINTS AWARDED'; menuDirty = true;
      }
    }
    else if (e.type === 'error') {
      const msg = e.message.toUpperCase();
      netlog.log('error', `driver error: ${msg.slice(0, 80)}`);
      const relay = relaySource;
      track('online_error', { msg: msg.slice(0, 80), relay });
      const wasRanked = rankedMode;
      closeNet(); mpState = 'error';
      // STUN-only direct path failed after signaling succeeded: say what
      // helps (another network / TURN relay) instead of "try again".
      netStatus = wasRanked ? msg : withRelayHint(msg, relay); screen = wasRanked ? 'title' : 'online'; menuIndex = 0; menuDirty = true;
    }
  };
}
let netGen = 0;
function cancelNet() { const wasRanked = rankedMode; netGen++; closeNet(); mpState = 'idle'; screen = wasRanked ? 'title' : 'online'; menuIndex = 0; menuDirty = true; }
/** Lobby failure: invalidate in-flight async steps, tear down, show why. */
function deadNet(message: string) {
  const wasRanked = rankedMode;
  netGen++; closeNet(); mpState = 'error';
  netStatus = message; screen = wasRanked ? 'title' : 'online'; menuIndex = 0; menuDirty = true;
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
  netlog.log('info', `host start room peer=${shortPeer(myPeerId)} ua=${browserTag()}`);
  mpState = 'creating-room';
  netStatus = 'CREATING ROOM…'; copyNote = ''; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    let extraServers: RTCIceServer[] = [];
    try {
      const [sigConnected, relay] = await Promise.all([
        connectSignal(),
        resolveExtraServers(location.origin),
      ]);
      signal = sigConnected;
      extraServers = relay.servers;
      relaySource = relay.source;
      netlog.log('signal', `relay source=${relay.source}`);
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
          const { transport, offer } = await RTCTransport.createOfferTrickle(undefined, extraServers);
          if (!alive()) { transport.close(); return; }
          // Attach BEFORE sending the offer so early trickle candidates have
          // a target; flush anything queued while the offer was being built.
          const queued = attachNegotiationTransport(neg, transport);
          watchTransport(transport, 'host');
          startStatsWatch(transport, 'host', token);
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
        hookDriver(new NetDriver(t, { host: true, teamIndex, duration: onlineDuration, matchToken, localProfile: myCityProfilePacket() }));
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
 * Single Cloudflare join implementation. The friend reads the 6-letter code
 * off the host screen and types it here: joinRoom(code) → signaling →
 * WebRTC → NetDriver → ready lobby. No links, no SDP in the UI.
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
  const alive = () => token === netGen && screen === 'join';
  const fini = (s: SignalingClient) => { try { s.close(); } catch { /* gone */ } };
  resetNegotiationState(neg);
  myPeerId = createSessionPeerId();
  netlog.clear();
  for (const k of Object.keys(iceLogStats.sent)) delete iceLogStats.sent[k];
  for (const k of Object.keys(iceLogStats.recv)) delete iceLogStats.recv[k];
  netlog.log('info', `guest join ${code} peer=${shortPeer(myPeerId)} ua=${browserTag()}`);
  mpState = 'joining-room';
  netStatus = 'JOINING MATCH…'; menuDirty = true;
  void (async () => {
    let signal: SignalingClient;
    let extraServers: RTCIceServer[] = [];
    try {
      const [sigConnected, relay] = await Promise.all([
        connectSignal(),
        resolveExtraServers(location.origin),
      ]);
      signal = sigConnected;
      extraServers = relay.servers;
      relaySource = relay.source;
      netlog.log('signal', `relay source=${relay.source}`);
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
        if (screen !== 'join' && screen !== 'netready') return;
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
      void RTCTransport.acceptOfferTrickle(payload, undefined, extraServers).then(({ transport, answer }) => {
        if (!alive()) { transport.close(); return; }
        // Attach BEFORE sending the answer; flush pre-offer candidates in
        // order, keep the reference for post-offer candidates.
        const queued = attachNegotiationTransport(neg, transport);
        watchTransport(transport, 'guest');
        startStatsWatch(transport, 'guest', token);
        relayIce(transport, signal, () => (token === netGen ? peerId : null));
        for (const c of queued) void transport.addIceCandidate(c).catch(() => {});
        try { signal.sendSignal(from, answer); }
        catch { transport.close(); if (alive()) failJoin('SIGNAL LOST'); return; }
        netlog.log('sdp', `answer sent ${answer.sdp.length}B`);
        // SDP done ≠ driver ready. Keep CONNECTING until hello/welcome → netready.
        netStatus = 'CONNECTING…'; menuDirty = true;
        hookDriver(new NetDriver(transport, { host: false, matchToken, localProfile: myCityProfilePacket() }));
        wrapDcState(transport, 'guest');
        netlog.log('driver', 'guest handshake started (waiting for datachannel)');
      }).catch(() => { if (alive()) failJoin('negotiation failed'); });
    };
    const failJoin = (reason: unknown) => {
      if (token !== netGen) return;
      if (screen !== 'join' && screen !== 'netready') return;
      netGen++; closeNet(); mpState = 'error';
      netStatus = netMsg(reason); screen = 'online'; menuIndex = 0; menuDirty = true;
    };
    signal.onPeerLeft = () => {
      if (token !== netGen) return;
      if (screen === 'join' || screen === 'netready') failJoin('HOST LEFT');
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
function doReady() {
  if (rankedMode && !cityMatch) return;
  if (!net || iAmReady) return;
  iAmReady = true; mpState = 'ready'; net.setReady(); menuDirty = true;
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
/** Cycle one team-setup row (0 club, 1 length, 2 CPU difficulty). */
function cycleTeamRow(row: number, dir: 1 | -1) {
  if (row === 0) teamIndex = (teamIndex + dir + TEAMS.length) % TEAMS.length;
  else if (row === 1) {
    const i = MATCH_LENGTHS.indexOf(duration);
    duration = MATCH_LENGTHS[(i < 0 ? 0 : i + dir + MATCH_LENGTHS.length) % MATCH_LENGTHS.length];
  }
  else if (row === 2) aiLevel = (((aiLevel + dir) + 3) % 3) as AiLevel;
  menuDirty = true;
}
function doOnboardContinue() {
  const raw = ui.querySelector<HTMLTextAreaElement>('#onboard-name')?.value ?? onboardName;
  onboardName = raw;
  try {
    const seasonKey = getCurrentSeasonKey();
    const existing = getProfile();
    cityProfile = saveProfile({ displayName: raw, cityCode: onboardCity, seasonKey, existing });
    onboardMsg = '';
    void syncProfileToServer();
    menuIndex = 0;
    const pending = pendingInviteCode ?? getPendingInvite();
    if (pending) {
      pendingInviteCode = pending;
      clearPendingInvite();
      pendingInviteCode = pending;
      screen = 'join'; menuDirty = true;
      cloudJoin(pending);
    } else {
      screen = 'title'; menuDirty = true;
      void refreshCityTable(true);
    }
  } catch (e) {
    onboardMsg = e instanceof Error ? e.message : 'NAME MUST BE 3–16 CHARACTERS';
    menuDirty = true;
  }
}
async function doShareInvite() {
  if (!roomCode) return;
  if (!navigator.share) { doCopyInvite(); return; }
  try { await navigator.share({ title: 'HNC League', text: 'Represent your country. Challenge me in HNC League!', url: inviteUrlFor(roomCode) }); }
  catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) doCopyInvite(); }
}
function doWhatsApp() {
  if (!roomCode) return;
  const url = inviteUrlFor(roomCode);
  if (!url) return;
  const msg = buildChallengeMessage(myCityName(), url);
  try {
    window.open(buildWhatsAppUrl(msg), '_blank', 'noopener');
  } catch { /* popup blocked */ }
  copyNote = 'WHATSAPP OPENED — SEND THE CHALLENGE';
  menuDirty = true;
}
function doCopyInvite() {
  if (!roomCode) return;
  const url = inviteUrlFor(roomCode);
  if (!url) return;
  void copyText(url).then((ok) => {
    copyNote = ok ? 'CHALLENGE COPIED — SEND IT TO YOUR FRIEND' : url;
    menuDirty = true;
  });
}
/** Host issues the league match record once both identities are known. */
async function ensureCityMatch(hostSide: boolean) {
  if (!net || !cityProfile) return;
  if (cityMatch) {
    try { net.announceCityMatch(cityMatch.matchId, cityMatch.matchToken); } catch { /* ignore */ }
    return;
  }
  const remote = (net as unknown as { remoteProfile?: { clientId: string; displayName: string; cityCode: string } }).remoteProfile;
  if (!remote) return;
  const me = myCityProfilePacket();
  if (!me) return;
  // Home is always the host (team 0). Guest waits for the host announcement.
  if (!hostSide || cityMatchBusy) return;
  cityMatchBusy = true;
  const matchDriver = net;
  const home = viewTeam === 0 ? me : remote;
  const away = viewTeam === 0 ? remote : me;
  try {
    const created = await cityApi().createMatch({
      roomCode,
      homeClientId: home.clientId,
      awayClientId: away.clientId,
      homeCityCode: home.cityCode,
      awayCityCode: away.cityCode,
    });
    if (net !== matchDriver) return;
    cityMatch = {
      matchId: created.matchId,
      matchToken: created.matchToken,
      homeClientId: home.clientId,
      awayClientId: away.clientId,
      homeCity: home.cityCode,
      awayCity: away.cityCode,
    };
    autoReadyRanked();
    try { net.announceCityMatch(created.matchId, created.matchToken); } catch { /* peer gets it on retry */ }
    if (cityMatch.homeCity === cityMatch.awayCity) {
      cityResult = { status: 'friendly', detail: '', rankText: '' };
    } else {
      cityResult = { status: 'idle', detail: '', rankText: '' };
    }
    menuDirty = true;
  } catch {
    if (net !== matchDriver) return;
    if (rankedMode) { deadNet('COUNTRY LEAGUE UNAVAILABLE · PLEASE TRY AGAIN'); return; }
    cityResult = { status: 'friendly', detail: '', rankText: '' };
  } finally { cityMatchBusy = false; }
}
/** Final-whistle dual-submit (meta-layer only, never blocks rematch). */
async function submitCityResult() {
  if ((!net && !botMatch) || dailyMode) return;
  if (!cityMatch || !cityProfile) {
    if (net && !cityMatch) cityResult = { status: 'friendly', detail: '', rankText: '' };
    menuDirty = true;
    return;
  }
  if (cityMatch.homeCity === cityMatch.awayCity) {
    cityResult = { status: 'friendly', detail: '', rankText: '' };
    menuDirty = true;
    return;
  }
  cityResult = { status: 'confirming', detail: '', rankText: '' };
  menuDirty = true;
  const s = engine.state;
  try {
    const resultMatch = cityMatch;
    const submission = {
      clientId: cityProfile.clientId,
      matchToken: cityMatch.matchToken,
      homeScore: s.score[0],
      awayScore: s.score[1],
    };
    let res = botMatch ? await submitBotResult() : await cityApi().submitResult(resultMatch.matchId, submission);
    for (let attempt = 0; res.status === 'pending' && attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (cityMatch !== resultMatch) return;
      res = await cityApi().submitResult(resultMatch.matchId, submission);
    }
    if (cityMatch !== resultMatch) return;
    if (res.status === 'confirmed') {
      const myCity = cityProfile.cityCode;
      const won = (myCity === cityMatch.homeCity && s.score[0] > s.score[1]) || (myCity === cityMatch.awayCity && s.score[1] > s.score[0]);
      const draw = s.score[0] === s.score[1];
      const pts = won ? 3 : draw ? 1 : 0;
      cityResult = { status: 'confirmed', detail: `+${pts} COUNTRY POINTS`, rankText: '' };
      try {
        const before = preMatchRanks[myCity];
        await refreshCityTable(true);
        const after = cityTable?.standings.find((r) => r.cityCode === myCity);
        if (after) {
          cityResult.rankText = before && before !== after.rank
            ? `${cityName(myCity).toUpperCase()} #${before} → #${after.rank}`
            : `${cityName(myCity).toUpperCase()} IS NOW #${after.rank}`;
        }
      } catch { /* rank display best-effort */ }
    } else if (res.status === 'disputed') {
      cityResult = { status: 'disputed', detail: '', rankText: '' };
    } else {
      cityResult = { status: 'confirming', detail: '', rankText: '' };
      try { await refreshCityTable(true); } catch { /* ignore */ }
    }
  } catch {
    cityResult = { status: 'error', detail: '', rankText: '' };
  }
  menuDirty = true;
}
function handleMenuEnter(act?: string) {
  if (screen === 'full') {
    if (act === 'share-result') { shareResult(); return; }
    if (act === 'result-copy') { void shareCountryResult(true); return; }
    if (act === 'result-x') { window.open('https://twitter.com/intent/tweet?' + new URLSearchParams({ text: resultShareText(), url: publicGameUrl }), '_blank', 'noopener,noreferrer'); return; }
    if (act === 'result-card') { shareResult(); return; }
    if (act === 'result-whatsapp') { window.open(buildWhatsAppUrl(resultShareText() + '\n' + publicGameUrl), '_blank', 'noopener,noreferrer'); return; }
  }
  if (act === 'retry-result') { void submitCityResult(); return; }
  if (act === 'join-friend') { closeNet(); screen = 'join'; menuIndex = 0; menuDirty = true; return; }
  if (screen === 'onboard') {
    if (act === 'onboard-continue') { doOnboardContinue(); return; }
    doOnboardContinue(); return;
  }
  if (screen === 'search') {
    cancelSearch(); screen = act === 'search-friend' ? 'online' : 'title'; menuIndex = 0; menuDirty = true; return;
  }
  if (screen === 'title') {
    if (menuIndex === 0 && act !== 'goto-city') { void findCountryMatch(); return; }
    if (menuIndex === 1 && act !== 'goto-city') { rankedMode = false; screen = 'host'; menuIndex = 0; netStatus = ''; startHost(); }
    else { screen = 'city'; menuIndex = 0; void refreshCityTable(); }
  }
  else if (screen === 'team') {
    if (act === 'cycle-0') cycleTeamRow(0, 1);
    else if (act === 'cycle-1') cycleTeamRow(1, 1);
    else if (act === 'cycle-2') cycleTeamRow(2, 1);
    else launch();
  }
  else if (screen === 'online') {
    if (act === 'copylog') { doCopyLog(); return; }
    if (menuIndex === 0) { screen = 'host'; menuIndex = 0; roomCode = ''; netStatus = ''; copyNote = ''; startHost(); }
    else if (menuIndex === 1) { screen = 'join'; menuIndex = 0; roomCode = ''; netStatus = ''; }
    else { screen = 'title'; menuIndex = 0; netStatus = ''; }
  }
  else if (screen === 'host') {
    if (act === 'cancel') cancelNet();
    else if (act === 'copylog') doCopyLog();
    else if (act === 'share-invite') void doShareInvite();
    else if (act === 'whatsapp') doWhatsApp();
    else if (act === 'copy-invite') doCopyInvite();
  }
  else if (screen === 'join') {
    if (act === 'cancel') cancelNet(); else if (act === 'join') doJoin();
  }
  else if (screen === 'netready') {
    if (menuIndex === 0) doReady(); else cancelNet();
  }
  else if (screen === 'city') {
    if (act === 'city-refresh') { void refreshCityTable(); return; }
    screen = 'title'; menuIndex = 2; menuDirty = true; return;
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
    else if (menuIndex === 1) { if (botMatch) { closeNet(); screen = 'title'; void findCountryMatch(); } else launch(); }
    else { closeNet(); screen = 'title'; }
  }
  else if (screen === 'half') continueFromHalf();
  else if (screen === 'full') {
    if ((net || botMatch) && cityMatch) {
      if (menuIndex === 0) {
        closeNet(); screen = 'title'; menuIndex = 0;
        void findCountryMatch();
        return;
      } else if (menuIndex === 1) {
        closeNet();
        cityMatch = null;
        cityResult = { status: 'idle', detail: '', rankText: '' };
        screen = 'online'; menuIndex = 0; menuDirty = true; return;
      } else if (menuIndex === 2) {
        screen = 'city'; menuIndex = 0; menuDirty = true; void refreshCityTable(); return;
      } else { closeNet(); cityMatch = null; cityResult = { status: 'idle', detail: '', rankText: '' }; screen = 'title'; menuIndex = 0; }
    } else {
      if (menuIndex === 0 && !net) launch();
      else if (menuIndex === 2) shareResult();
      else { closeNet(); screen = 'title'; }
    }
  }
  menuDirty = true;
}
function handleMenu(){if(pressed.size||released.size||touch.pressed.size||touch.released.size)menuDirty=true;if(hit('KeyM')){muted=audio.toggle();consume('KeyM')}if(screen==='match'){if(hit('Escape')){consume('Escape');openPause()}if(hit('KeyC')){camNote=renderer.cycleCamera();camNoteAt=performance.now();consume('KeyC')}return}const confirm=hit('Enter');if(confirm)consume('Enter');const up=hit('KeyW')||hit('ArrowUp'),dn=hit('KeyS')||hit('ArrowDown');if(screen==='onboard'){if(up||dn){const idx=CITIES.findIndex((c)=>c.code===onboardCity);const n=CITIES.length;const nxt=CITIES[((idx<0?0:idx)+(up?n-1:1))%n].code;onboardCity=nxt;}if(hit('Escape')){}if(confirm)handleMenuEnter('onboard-continue');}else if(screen==='title'){if(up||dn)menuIndex=(menuIndex+(up?2:1))%3;if(hit('Escape'))menuIndex=0;if(confirm)handleMenuEnter()}else if(screen==='search'){if(hit('Escape'))handleMenuEnter('search-cancel');}else if(screen==='team'){if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+3)%4;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%4;if(hit('KeyA')||hit('ArrowLeft'))cycleTeamRow(menuIndex,-1);if(hit('KeyD')||hit('ArrowRight'))cycleTeamRow(menuIndex,1);if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='online'){if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='host'){if(hit('Escape'))cancelNet();}else if(screen==='join'){if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter('join');}else if(screen==='netready'){if(up||dn)menuIndex=1-menuIndex;if(hit('Escape'))cancelNet();else if(confirm)handleMenuEnter();}else if(screen==='league'){if(up)menuIndex=(menuIndex+4)%5;if(dn)menuIndex=(menuIndex+1)%5;if(hit('Escape'))screen='title';if(confirm)handleMenuEnter()}else if(screen==='leaguecreate'||screen==='leaguejoin'||screen==='leagueserver'){if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leagueview'){const n=Math.max(1,leagueActions.length);if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='league';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguesubmit'||screen==='leagueresolve'){const n=leaguePick.length+1;if(up)menuIndex=(menuIndex+n-1)%n;if(dn)menuIndex=(menuIndex+1)%n;if(hit('Escape')){screen='leagueview';menuIndex=0}if(confirm)handleMenuEnter()}else if(screen==='leaguescore'){if(hit('Escape')){screen=scoreMode==='resolve'?'leagueresolve':'leaguesubmit';menuIndex=0}else if(confirm)handleMenuEnter()}else if(screen==='pause'){if(hit('Escape'))resumePlay();if(hit('KeyW')||hit('ArrowUp'))menuIndex=(menuIndex+2)%3;if(hit('KeyS')||hit('ArrowDown'))menuIndex=(menuIndex+1)%3;if(confirm)handleMenuEnter()}else if(screen==='half'){if(net&&viewTeam===1&&engine.state.phase!=='halftime')handleMenuEnter();else if(confirm)handleMenuEnter();else if(performance.now()-halfAt>(net&&viewTeam===1?5000:1500))handleMenuEnter()}else if(screen==='city'){if(confirm)handleMenuEnter('city-back');if(hit('Escape')){screen='title';menuIndex=2;}}else if(screen==='full'){const fn=((net||botMatch)&&cityMatch)?4:3;if(up)menuIndex=(menuIndex+fn-1)%fn;if(dn)menuIndex=(menuIndex+1)%fn;if(confirm)handleMenuEnter()}menu();}
function frame(now:number){const raw=Math.min(.1,(now-last)/1000);last=now;let stepped=false;if(net&&(screen==='host'||screen==='join'||screen==='netready')){try{net.poll();}catch{/* poll never throws; error surfaces via driver events */}}if(screen==='match'){handleMenu();if(screen==='match'){capturePrev(engine.state);if(net&&net.session){net.poll();const f=input();net.frame(f,raw);stepped=true;for(const e of net.session.drainEvents()){audio.event(e);if(e.type==='goal')track('goal',{a:engine.state.score[0],b:engine.state.score[1]});}renderer.setFollow(engine.controlOf(viewTeam),engine.targetOf(viewTeam));}else{const due=soloClock.push(raw);let first=true;for(let n=0;n<due;n++){const f=input();if(!first){f.pass=false;f.passReleased=false;f.long=false;f.shootPressed=false;f.shootReleased=false;f.switchPlayer=false}stepSolo(f);for(const e of engine.events.splice(0)){audio.event(e);if(e.type==='goal')track('goal',{a:engine.state.score[0],b:engine.state.score[1]});if(e.type==='shot'){renderer.impact(e.power??28)}if(e.type==='tackle'&&e.slide){renderer.impact(9)}}first=false;stepped=true;}}const s=engine.state;if(s.phase==='halftime'){screen='half';halfAt=performance.now();menuDirty=true;audio.event({type:'whistle'})}if(s.phase==='fulltime'){screen='full';resultShareNote='';menuIndex=0;menuDirty=true;if(net)mpState='finished';audio.event({type:'whistle'});track('match_end',{a:s.score[0],b:s.score[1],mode:dailyMode?'daily':(net?'online':'solo')});if(dailyMode)setDailyBest(s.score[0]);if((net||botMatch)&&!dailyMode)void submitCityResult()}let alpha=1;if(s.phase!==interpPhase||engine.tick<interpTickMark){capturePrev(s)}else{const debt=net?net.debt():soloClock.debt;alpha=Math.max(0,Math.min(1,debt/TICK_DT))}interpPhase=s.phase;interpTickMark=engine.tick;renderer.render(s,raw,false,displayPositions(s,alpha));const cine=renderer.inCinematic();barTop.classList.toggle('on',cine);barBottom.classList.toggle('on',cine);if(now-hudAt>66){hud(s);hudAt=now}}}else {renderer.render(engine.state,raw,screen==='title'||screen==='team');barTop.classList.remove('on');barBottom.classList.remove('on');if(screen==='half'&&now-halfAt>2500)continueFromHalf();handleMenu()}updateTouchVisibility();fitOrientation();if(import.meta.env.DEV&&now-devStatusAt>100){const s=engine.state,p=s.players[s.controlled],b=s.ball;document.body.dataset.match=JSON.stringify({phase:s.phase,screen,half:s.half,elapsed:s.elapsed,time:s.time,score:s.score,controlled:s.controlled,player:{x:p?.x,z:p?.z,vx:p?.vx,vz:p?.vz},ball:{x:b.x,z:b.z,y:b.y,owner:b.owner,flight:b.flight},stats:s.stats});devStatusAt=now}if(screen!=='match'||stepped){clearKeyboardEdges(kb);clearTouchEdges(touch)}requestAnimationFrame(frame)}
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
// sticky per-browser). Credentials never enter logs or the room.
try { persistTurnConfig(location.search); } catch { /* best-effort */ }
// ---- City League boot: profile first, invite context survives onboarding ----
try {
  const found = getInviteCodeFromLocation(location.search, location.pathname, location.hash);
  if (found) {
    pendingInviteCode = found;
    savePendingInvite(found);
    try {
      const u = new URL(location.href);
      u.searchParams.delete('join'); u.searchParams.delete('room'); u.searchParams.delete('code'); u.searchParams.delete('invite');
      let p = u.pathname.replace(/\/(friend|join|invite|room)\/[A-Za-z0-9-]+/i, '/') || '/';
      if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
      u.pathname = p; u.hash = '';
      history.replaceState(null, '', u.pathname + u.search);
    } catch { /* keep URL */ }
  } else {
    pendingInviteCode = getPendingInvite();
  }
} catch { /* invite parsing best-effort */ }
try {
  cityProfile = getProfile();
  if (!cityProfile && e2eMode) {
    // E2E/headless: provision a throwaway profile so the existing online
    // happy-path tests run unchanged (no onboarding UI in ?e2e).
    try {
      const rnd = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0').slice(0, 8);
      cityProfile = saveProfile({ displayName: `E2E ${rnd}`.slice(0, 12), cityCode: 'TR', seasonKey: getCurrentSeasonKey(), existing: null });
    } catch { cityProfile = getProfile(); }
  }
} catch { cityProfile = null; }
if (!cityProfile && !e2eMode) {
  screen = 'onboard'; menuIndex = 0;
} else {
  screen = 'title'; menuIndex = 0;
  void syncProfileToServer();
  void refreshCityTable(true);
  // Returning player opening an invite: continue automatically into the room.
  if (pendingInviteCode && cityProfile && !e2eMode && !autoJoinAttempted) {
    autoJoinAttempted = true;
    const code = pendingInviteCode;
    clearPendingInvite();
    pendingInviteCode = null;
    // Defer one frame so the first menu paint happens, then join.
    setTimeout(() => {
      try {
        if (screen === 'title') { screen = 'join'; menuIndex = 0; menuDirty = true; cloudJoin(code); }
      } catch { /* join errors surface in UI */ }
    }, 50);
  }
}
initAnalytics();
if (needsConsent()) showConsentBanner();
menu();
requestAnimationFrame(frame);
