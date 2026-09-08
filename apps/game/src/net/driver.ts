import { isValidCountryCode } from '../city-league/countries';
import { HASH_EVERY, LockstepSession } from './session';
import {
  decodeControl, decodePacket, encodeControlPacket, encodeHashPacket,
  encodeInputPacket, encodeSnapshotPacket,
} from './proto';
import { answerHello, checkVersions, localVersions, makeClientId, makeSeedPart, NET_PROTO } from './signal';
import { decodeInput, encodeInput } from './codec';
import { MAX_CATCH_UP, SimulationClock } from '../game/clock';
import { EMPTY_INPUT, type InputFrame, type TeamId } from '../types';
import type { DataTransport } from './transport';

export interface CityProfilePacket {
  clientId: string;
  displayName: string;
  cityCode: string;
}

export type ControlMsg =
  | { t: 'hello'; proto: number; seedPart: number; clientId: string; teamIndex: number; duration: number; matchToken?: string; sim: number; input: number; tune: string; profile?: CityProfilePacket }
  | { t: 'welcome'; proto: number; seed: number; yourTeam: TeamId; teamIndex: number; duration: number; matchToken?: string; sim: number; input: number; tune: string; profile?: CityProfilePacket }
  | { t: 'ready' }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'quit' }
  | { t: 'resync-request'; tick: number }
  | { t: 'continue-half' }
  | { t: 'profile'; profile: CityProfilePacket }
  | { t: 'city-match'; matchId: string; matchToken: string };

export type DriverState = 'handshake' | 'playing' | 'closed';

export type DriverEvent =
  | { type: 'connected' }
  | { type: 'peerReady' }
  | { type: 'started'; seed: number; myTeam: TeamId }
  | { type: 'peerPaused'; paused: boolean }
  | { type: 'peerQuit' }
  | { type: 'peerDropped' }
  | { type: 'peerProfile'; profile: CityProfilePacket }
  | { type: 'cityMatch'; matchId: string; matchToken: string }
  | { type: 'error'; message: string };

export interface DriverOpts {
  /** True for the offerer (team 0). The joiner always takes team 1. */
  host: boolean;
  teamIndex?: number;
  duration?: number;
  /** Room token from the signal server. When both sides present it, the
   *  handshake verifies equality — a stray peer from another room can never
   *  land in this session. Absent = legacy manual flow, check skipped. */
  matchToken?: string;
  /** Lockstep input delay in ticks. */
  delay?: number;
  openTimeoutMs?: number;
  helloRetryMs?: number;
  /** Persistent City League identity (optional, meta-layer only). */
  localProfile?: CityProfilePacket | null;
}

/**
 * Match driver: handshake (hello/welcome, shared seed, team assignment),
 * per-frame pump (inputs, hashes, snapshots), pause/resume/quit sync and
 * drop recovery (peer's team falls back to AI, match continues locally).
 */
export class NetDriver {
  state: DriverState = 'handshake';
  session: LockstepSession | null = null;
  readonly myTeam: TeamId;
  events: DriverEvent[] = [];
  onEvent: ((e: DriverEvent) => void) | null = null;
  private hostPart = makeSeedPart();
  private clientId = makeClientId();
  private teamIndex: number;
  private duration: number;
  private matchToken: string | undefined;
  private delay: number;
  private openTimeoutMs: number;
  private openedAt = Date.now();
  private flushed = 0;
  private lastDesyncs = 0;
  private lastHashTick = -1;
  private stallFrames = 0;
  private seed = 1;
  private lastHelloAt = 0;
  private helloRetryMs: number;
  /** Ready gate: the match starts only after BOTH sides press ready. */
  private localReady = false;
  private peerReady = false;
  private startedEmitted = false;
  /** City League meta-layer (never touches simulation determinism). */
  private localProfile: CityProfilePacket | null = null;
  remoteProfile: CityProfilePacket | null = null;
  cityMatch: { matchId: string; matchToken: string } | null = null;
  /** Edge buttons accumulate here until staged into exactly one tick. */
  private edgeAcc = { pass: false, passReleased: false, long: false, shootPressed: false, shootReleased: false, switchPlayer: false };
  /** Consecutive stalled frames before the link is declared dead. */
  static readonly DROP_AFTER_STALL = 600;
  private outbox: Uint8Array[] = [];
  /** Match clock: render frequency never sets simulation speed. Ticks run only
   *  when due by elapsed time AND the required inputs exist (see frame). */
  private clock = new SimulationClock();

  constructor(private transport: DataTransport, opts: DriverOpts) {
    this.myTeam = opts.host ? 0 : 1;
    this.teamIndex = opts.teamIndex ?? 0;
    this.duration = opts.duration ?? 90;
    this.matchToken = opts.matchToken;
    this.delay = opts.delay ?? 3;
    this.openTimeoutMs = opts.openTimeoutMs ?? 20000;
    this.helloRetryMs = opts.helloRetryMs ?? 500;
    this.localProfile = opts.localProfile ?? null;
    transport.onmessage = (d) => this.onData(d);
    transport.onstate = (s) => {
      if (s === 'open') this.onOpen();
      if (s === 'closed') this.onClose();
    };
    if (transport.state === 'open') this.onOpen();
  }

  private emit(e: DriverEvent) { this.events.push(e); this.onEvent?.(e); }

  private sendRaw(d: Uint8Array) {
    if (this.transport.state === 'open') this.transport.send(d);
    else this.outbox.push(d);
  }

  private sendControl(m: ControlMsg) {
    this.sendRaw(encodeControlPacket(JSON.stringify(m)));
  }

  private onOpen() {
    this.openedAt = Date.now();
    const box = this.outbox;
    this.outbox = [];
    for (const d of box) this.transport.send(d);
    if (this.state === 'handshake' && this.myTeam === 1) this.sendHello();
  }

  private sendHello(now = Date.now()) {
    this.lastHelloAt = now;
    this.sendControl({
      t: 'hello', proto: NET_PROTO, seedPart: this.hostPart,
      clientId: this.clientId, teamIndex: this.teamIndex, duration: this.duration,
      ...(this.matchToken ? { matchToken: this.matchToken } : {}),
      ...(this.localProfile ? { profile: this.localProfile } : {}),
      ...localVersions(),
    });
  }

  /** Update the local City League identity mid-lobby (profile loaded late). */
  setLocalProfile(p: CityProfilePacket | null) {
    this.localProfile = p;
    if (p && this.session) this.sendControl({ t: 'profile', profile: p });
  }

  /** Host announces the league matchId/token issued for this game. */
  announceCityMatch(matchId: string, matchToken: string) {
    this.cityMatch = { matchId, matchToken };
    if (this.session) this.sendControl({ t: 'city-match', matchId, matchToken });
  }

  private acceptProfile(p: unknown) {
    if (!p || typeof p !== 'object') return;
    const v = p as Record<string, unknown>;
    if (typeof v.clientId !== 'string' || typeof v.displayName !== 'string' || typeof v.cityCode !== 'string') return;
    if (v.clientId.length < 8 || v.clientId.length > 64) return;
    if (v.displayName.length < 1 || v.displayName.length > 24) return;
    if (!isValidCountryCode(v.cityCode)) return;
    this.remoteProfile = { clientId: v.clientId, displayName: v.displayName.slice(0, 24), cityCode: v.cityCode };
    this.emit({ type: 'peerProfile', profile: this.remoteProfile });
  }

  /** Both sides presented a room token but they differ: wrong room, refuse. */
  private checkToken(peerToken: string | undefined): boolean {
    if (this.matchToken && peerToken && peerToken !== this.matchToken) {
      this.fail('room mismatch');
      return false;
    }
    return true;
  }

  /** The match starts only after both sides press ready (see setReady). */
  private maybeStart() {
    if (this.session && this.localReady && this.peerReady && !this.startedEmitted) {
      this.startedEmitted = true;
      this.emit({ type: 'started', seed: this.seed, myTeam: this.myTeam });
    }
  }

  /** Local user pressed READY: tell the peer and start if they already did. */
  setReady() {
    this.localReady = true;
    if (this.session) this.sendControl({ t: 'ready' });
    this.maybeStart();
  }

  private onData(raw: Uint8Array) {
    const p = decodePacket(raw);
    if (p.kind === 'control') { this.onControl(decodeControl<ControlMsg>(p)); return; }
    const s = this.session;
    if (!s || this.state !== 'playing') return;
    if (p.kind === 'input') s.receiveRemote(p.tick, p.bytes);
    else if (p.kind === 'hash') s.receiveHash(p.tick, p.hash);
    else if (p.kind === 'snapshot') {
      try { s.applySnapshot(JSON.parse(p.json), p.tick); } catch { /* corrupt: ignore, hashes will re-fire */ }
    }
  }

  private onControl(m: ControlMsg | null) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello' && this.myTeam === 0 && this.state === 'handshake') {
      if (m.proto !== NET_PROTO) { this.fail('net proto mismatch'); return; }
      const mismatch = checkVersions(m);
      if (mismatch) { this.fail(mismatch); return; }
      if (!this.checkToken((m as { matchToken?: string }).matchToken)) return;
      if ((m as { profile?: unknown }).profile) this.acceptProfile((m as { profile?: unknown }).profile);
      try {
        const w = answerHello(this.hostPart, {
          t: 'hello', proto: m.proto, seedPart: m.seedPart, clientId: m.clientId,
          sim: (m as { sim: number }).sim, input: (m as { input: number }).input, tune: (m as { tune: string }).tune,
        });
        this.sendControl({
          t: 'welcome', proto: NET_PROTO, seed: w.seed, yourTeam: 1,
          teamIndex: this.teamIndex, duration: this.duration,
          ...(this.matchToken ? { matchToken: this.matchToken } : {}),
          ...(this.localProfile ? { profile: this.localProfile } : {}),
          ...localVersions(),
        });
        this.begin(w.seed);
        if (this.localProfile) this.sendControl({ t: 'profile', profile: this.localProfile });
      } catch (e) { this.fail(e instanceof Error ? e.message : 'handshake failed'); }
    } else if (m.t === 'welcome' && this.myTeam === 1 && this.state === 'handshake') {
      if (m.proto !== NET_PROTO) { this.fail('net proto mismatch'); return; }
      const mismatch = checkVersions(m);
      if (mismatch) { this.fail(mismatch); return; }
      if (!this.checkToken((m as { matchToken?: string }).matchToken)) return;
      if ((m as { profile?: unknown }).profile) this.acceptProfile((m as { profile?: unknown }).profile);
      this.teamIndex = (m as { teamIndex: number }).teamIndex;
      this.duration = (m as { duration: number }).duration;
      this.begin((m as { seed: number }).seed);
      if (this.localProfile) this.sendControl({ t: 'profile', profile: this.localProfile });
      if (this.localReady) this.sendControl({ t: 'ready' });
      this.maybeStart();
    } else if (m.t === 'hello' && this.myTeam === 0 && this.session && this.state === 'playing') {
      // Duplicate hello (guest never got our welcome): resend it verbatim.
      this.sendControl({
        t: 'welcome', proto: NET_PROTO, seed: this.seed, yourTeam: 1,
        teamIndex: this.teamIndex, duration: this.duration,
        ...(this.matchToken ? { matchToken: this.matchToken } : {}),
        ...(this.localProfile ? { profile: this.localProfile } : {}),
        ...localVersions(),
      });
    } else if (!this.session) {
      return;
    } else if (m.t === 'profile') {
      this.acceptProfile((m as { profile?: unknown }).profile);
    } else if (m.t === 'city-match') {
      const mm = m as { matchId?: unknown; matchToken?: unknown };
      if (typeof mm.matchId === 'string' && typeof mm.matchToken === 'string' && mm.matchToken.length >= 16) {
        this.cityMatch = { matchId: mm.matchId, matchToken: mm.matchToken };
        this.emit({ type: 'cityMatch', matchId: mm.matchId, matchToken: mm.matchToken });
      }
    } else if (m.t === 'ready') {
      this.peerReady = true;
      this.emit({ type: 'peerReady' });
      this.maybeStart();
    } else if (m.t === 'pause') {
      this.session.engine.state.paused = true;
      this.emit({ type: 'peerPaused', paused: true });
    } else if (m.t === 'resume') {
      this.session.engine.state.paused = false;
      this.emit({ type: 'peerPaused', paused: false });
    } else if (m.t === 'quit') {
      this.emit({ type: 'peerQuit' });
      this.session.engine.dropPeer();
    } else if (m.t === 'continue-half') {
      // Host drives half-time flow; resync heals the few ticks of skew.
      // Race: the packet can arrive BEFORE this engine reaches halftime
      // (fast host auto-continue, slow guest). Remember it and consume it
      // on the halftime boundary in frame() instead of dropping it — a
      // dropped packet strands the guest on HALF TIME forever.
      const e = this.session.engine;
      if (e.state.phase === 'halftime') e.continueHalf();
      else this.halfContinuePending = true;
    } else if (m.t === 'resync-request') {
      const snap = this.session.snapshotAt(m.tick);
      if (snap) this.transport.send(encodeSnapshotPacket(m.tick, JSON.stringify(snap)));
    }
  }

  private begin(seed: number) {
    this.seed = seed;
    this.session = new LockstepSession(seed, this.duration, this.myTeam, this.teamIndex, this.delay);
    this.flushed = 0;
    this.lastDesyncs = 0;
    this.state = 'playing';
    this.emit({ type: 'connected' });
    this.maybeStart();
  }

  private fail(message: string) {
    this.emit({ type: 'error', message });
    this.close();
  }

  private clearEdges() {
    this.edgeAcc.pass = this.edgeAcc.passReleased = this.edgeAcc.long = false;
    this.edgeAcc.shootPressed = this.edgeAcc.shootReleased = this.edgeAcc.switchPlayer = false;
  }

  /**
   * Stage local input across [tick, tick+delay]: every missing tick gets the
   * latest held state, and accumulated edge buttons land in exactly one tick
   * (the earliest gap, else OR'd into the frontier). Catch-up jumps can never
   * leave a tick input-less again.
   */
  private stageInput(s: LockstepSession, input: InputFrame) {
    const e = this.edgeAcc;
    e.pass ||= input.pass; e.passReleased ||= input.passReleased;
    e.long ||= input.long;
    e.shootPressed ||= input.shootPressed; e.shootReleased ||= input.shootReleased;
    e.switchPlayer ||= input.switchPlayer;
    const move: InputFrame = {
      ...EMPTY_INPUT, x: input.x, z: input.z, sprint: input.sprint,
      shootHeld: input.shootHeld, passHeld: input.passHeld,
      aimU: input.aimU, aimV: input.aimV,
    };
    const frontier = s.tick + this.delay;
    for (let t = s.tick; t <= frontier; t++) {
      // Sent ticks are frozen: peers may have stepped them already.
      if (t < this.flushed) continue;
      const cur = s.queuedLocal(t);
      if (!cur) {
        s.stageLocal(t, encodeInput({ ...move, ...this.edgeAcc }));
        this.clearEdges();
      } else if (t === frontier) {
        const d = decodeInput(cur);
        s.stageLocal(t, encodeInput({
          ...input,
          pass: d.pass || e.pass, long: d.long || e.long,
          shootPressed: d.shootPressed || e.shootPressed,
          shootReleased: d.shootReleased || e.shootReleased,
          switchPlayer: d.switchPlayer || e.switchPlayer,
        }));
        this.clearEdges();
      }
    }
  }

  /** Host's half-time signal arrived before this engine reached halftime. */
  private halfContinuePending = false;

  /**
   * Pump one render frame with local input. Returns ticks stepped.
   * Call every rAF with the frame's elapsed seconds; also call poll() for
   * handshake timeouts. A tick advances only when it is due by elapsed
   * simulation time AND both inputs exist — render frequency never sets
   * match speed. Catch-up is capped at MAX_CATCH_UP ticks per frame; deeper
   * debt is rebased, never fast-forwarded.
   */
  frame(input: InputFrame, elapsedSec = 1 / 60): number {    const s = this.session;
    if (!s || this.state !== 'playing') return 0;
    if (s.engine.state.paused) { this.clock.reset(); return 0; }
    // Consume an early half-time signal on the boundary it was meant for.
    if (this.halfContinuePending && s.engine.state.phase === 'halftime') {
      s.engine.continueHalf();
      this.halfContinuePending = false;
    }
    // Sent ticks are immutable: only rewind the watermark past a resync jump.
    if (this.flushed > s.tick + this.delay + 1) {
      this.flushed = s.tick;
      this.lastHashTick = -1;
    }
    this.stageInput(s, input);
    const upto = s.tick + this.delay;
    for (let t = this.flushed; t <= upto; t++) {
      const b = s.queuedLocal(t);
      if (b) this.transport.send(encodeInputPacket(t, b));
    }
    this.flushed = Math.max(this.flushed, upto + 1);
    let n = 0;
    for (let due = this.clock.push(elapsedSec); due > 0 && n < MAX_CATCH_UP; due--) {
      if (!s.step()) break;
      n++;
    }
    // Newest snapshotted tick always has state; hash it exactly once.
    const ht = s.tick - (s.tick % HASH_EVERY);
    if (ht !== this.lastHashTick && ht >= 0) {
      const h = s.hashAt(ht);
      if (h !== null) {
        this.transport.send(encodeHashPacket(ht, h));
        this.lastHashTick = ht;
      }
    }
    if (n === 0 && s.missingRemote()) {
      // Stalled on the peer (not paused, inputs flowing): link may be dead.
      if (++this.stallFrames > NetDriver.DROP_AFTER_STALL) {
        this.stallFrames = 0;
        this.onPeerGone();
      }
    } else {
      this.stallFrames = 0;
    }
    if (s.desyncs !== this.lastDesyncs) {
      this.lastDesyncs = s.desyncs;
      this.sendControl({ t: 'resync-request', tick: s.lastAgreeTick });
    }
    return n;
  }

  /** Unstepped simulation debt in seconds (for render interpolation). */
  debt(): number {
    return this.session && this.state === 'playing' ? this.clock.debt : 0;
  }

  /** Wall-clock maintenance (outside the sim): handshake timeout + hello retry. */
  poll(now = Date.now()) {
    if (this.state !== 'handshake') return;
    if (now - this.openedAt > this.openTimeoutMs) {
      this.fail('peer handshake timeout');
      return;
    }
    if (this.myTeam === 1 && this.transport.state === 'open' && now - this.lastHelloAt > this.helloRetryMs) {
      this.sendHello(now);
    }
  }

  setPaused(paused: boolean) {
    const s = this.session;
    if (!s || this.state !== 'playing') return;
    s.engine.state.paused = paused;
    this.sendControl(paused ? { t: 'pause' } : { t: 'resume' });
  }

  /** Host calls this when continuing from half-time; guests follow the packet. */
  broadcastHalf() {
    if (!this.session || this.state !== 'playing') return;
    this.sendControl({ t: 'continue-half' });
  }

  quit() {
    this.sendControl({ t: 'quit' });
    this.close();
  }

  close() {
    if (this.state === 'closed') return;
    // Mark closed BEFORE touching the transport: its synchronous 'closed'
    // event must hit the guard above instead of reporting a peer drop into
    // a newer session. Then detach so late bytes never reach a dead driver.
    this.state = 'closed';
    try { this.transport.close(); } catch { /* already gone */ }
    this.transport.onmessage = null;
    this.transport.onstate = null;
  }

  private onClose() {
    if (this.state === 'closed') return;
    if (this.session && this.state === 'playing') {
      // Link died mid-match: peer's team falls back to AI, match continues.
      // State stays playing; close()/quit() still tear down explicitly.
      this.onPeerGone();
    } else {
      this.fail('connection lost');
    }
  }

  private onPeerGone() {
    this.session?.engine.dropPeer();
    this.emit({ type: 'peerDropped' });
  }
}
