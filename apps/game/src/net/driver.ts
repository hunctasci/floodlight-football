import { HASH_EVERY, LockstepSession } from './session';
import {
  decodeControl, decodePacket, encodeControlPacket, encodeHashPacket,
  encodeInputPacket, encodeSnapshotPacket,
} from './proto';
import { answerHello, makeClientId, makeSeedPart, NET_PROTO } from './signal';
import { decodeInput, encodeInput } from './codec';
import { EMPTY_INPUT, type InputFrame, type TeamId } from '../types';
import type { DataTransport } from './transport';

export type ControlMsg =
  | { t: 'hello'; proto: number; seedPart: number; clientId: string; teamIndex: number; duration: number; matchToken?: string }
  | { t: 'welcome'; proto: number; seed: number; yourTeam: TeamId; teamIndex: number; duration: number; matchToken?: string }
  | { t: 'ready' }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'quit' }
  | { t: 'resync-request'; tick: number }
  | { t: 'continue-half' };

export type DriverState = 'handshake' | 'playing' | 'closed';

export type DriverEvent =
  | { type: 'connected' }
  | { type: 'peerReady' }
  | { type: 'started'; seed: number; myTeam: TeamId }
  | { type: 'peerPaused'; paused: boolean }
  | { type: 'peerQuit' }
  | { type: 'peerDropped' }
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
  /** Edge buttons accumulate here until staged into exactly one tick. */
  private edgeAcc = { pass: false, through: false, cross: false, shootPressed: false, shootReleased: false, switchPlayer: false };
  /** Consecutive stalled frames before the link is declared dead. */
  static readonly DROP_AFTER_STALL = 600;
  private outbox: Uint8Array[] = [];

  constructor(private transport: DataTransport, opts: DriverOpts) {
    this.myTeam = opts.host ? 0 : 1;
    this.teamIndex = opts.teamIndex ?? 0;
    this.duration = opts.duration ?? 180;
    this.matchToken = opts.matchToken;
    this.delay = opts.delay ?? 3;
    this.openTimeoutMs = opts.openTimeoutMs ?? 20000;
    this.helloRetryMs = opts.helloRetryMs ?? 500;
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
    });
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
      if (!this.checkToken(m.matchToken)) return;
      try {
        const w = answerHello(this.hostPart, {
          t: 'hello', proto: m.proto, seedPart: m.seedPart, clientId: m.clientId,
        });
        this.sendControl({
          t: 'welcome', proto: NET_PROTO, seed: w.seed, yourTeam: 1,
          teamIndex: this.teamIndex, duration: this.duration,
          ...(this.matchToken ? { matchToken: this.matchToken } : {}),
        });
        this.begin(w.seed);
      } catch (e) { this.fail(e instanceof Error ? e.message : 'handshake failed'); }
    } else if (m.t === 'welcome' && this.myTeam === 1 && this.state === 'handshake') {
      if (m.proto !== NET_PROTO) { this.fail('net proto mismatch'); return; }
      if (!this.checkToken(m.matchToken)) return;
      this.teamIndex = m.teamIndex; this.duration = m.duration;
      this.begin(m.seed);
      if (this.localReady) this.sendControl({ t: 'ready' });
      this.maybeStart();
    } else if (m.t === 'hello' && this.myTeam === 0 && this.session && this.state === 'playing') {
      // Duplicate hello (guest never got our welcome): resend it verbatim.
      this.sendControl({
        t: 'welcome', proto: NET_PROTO, seed: this.seed, yourTeam: 1,
        teamIndex: this.teamIndex, duration: this.duration,
        ...(this.matchToken ? { matchToken: this.matchToken } : {}),
      });
    } else if (!this.session) {
      return;
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
      const e = this.session.engine;
      if (e.state.phase === 'halftime') e.continueHalf();
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
    this.edgeAcc.pass = this.edgeAcc.through = this.edgeAcc.cross = false;
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
    e.pass ||= input.pass; e.through ||= input.through; e.cross ||= input.cross;
    e.shootPressed ||= input.shootPressed; e.shootReleased ||= input.shootReleased;
    e.switchPlayer ||= input.switchPlayer;
    const move: InputFrame = {
      ...EMPTY_INPUT, x: input.x, z: input.z, sprint: input.sprint, shootHeld: input.shootHeld,
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
          pass: d.pass || e.pass, through: d.through || e.through, cross: d.cross || e.cross,
          shootPressed: d.shootPressed || e.shootPressed,
          shootReleased: d.shootReleased || e.shootReleased,
          switchPlayer: d.switchPlayer || e.switchPlayer,
        }));
        this.clearEdges();
      }
    }
  }

  /**
   * Pump one render frame with local input. Returns ticks stepped.
   * Call every rAF; also call poll() for handshake timeouts.
   */
  frame(input: InputFrame): number {
    const s = this.session;
    if (!s || this.state !== 'playing') return 0;
    if (s.engine.state.paused) return 0;
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
    while (n < 8 && s.step()) {
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
    this.state = 'closed';
    try { this.transport.close(); } catch { /* already gone */ }
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
