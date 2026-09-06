import { MatchEngine, type EngineSnapshot } from '../engine';
import { EMPTY_INPUT, type GameEvent, type InputFrame, type TeamId } from '../types';
import { decodeInput, encodeInput } from './codec';

/**
 * Lockstep session for 1v1 (team vs team). Both peers construct IDENTICAL
 * engines (humanTeam=0, remoteTeam=1) and exchange 3-byte inputs per tick;
 * a tick runs only when both sides' inputs are present, in fixed slot order,
 * so both simulations stay bit-identical. State hashes exchanged every
 * HASH_EVERY ticks detect desyncs; applySnapshot() recovers from the host.
 */
export const HASH_EVERY = 15;

export class LockstepSession {
  readonly engine: MatchEngine;
  readonly myTeam: TeamId;
  tick = 0;
  desyncs = 0;
  lastAgreeTick = -1;
  /** Events produced by the most recent stepped tick (goals, saves, whistle…). */
  lastEvents: GameEvent[] = [];
  private delay: number;
  private maxHistory: number;
  private local = new Map<number, Uint8Array>();
  private remote = new Map<number, Uint8Array>();
  private snaps = new Map<number, EngineSnapshot>();
  private peerHashes = new Map<number, number>();

  constructor(seed: number, duration: number, myTeam: TeamId, teamIndex = 0, delay = 3, maxHistory = 240) {
    this.engine = new MatchEngine(teamIndex, duration, seed);
    this.engine.setRemoteTeam(1);
    this.myTeam = myTeam;
    this.delay = Math.max(1, delay);
    this.maxHistory = Math.max(HASH_EVERY * 2, maxHistory);
    // Startup burst: my first `delay` ticks are EMPTY until real input arrives.
    // The peer's burst arrives over the wire; both sides step once it does.
    const idle = encodeInput(EMPTY_INPUT);
    for (let t = 0; t < this.delay; t++) this.local.set(t, idle);
  }

  /** Queue my input for a future tick; the delay hides network latency. */
  sendLocal(frame: InputFrame) {
    this.local.set(this.tick + this.delay, encodeInput(frame));
  }

  /** Store a peer input for an absolute tick. Prunes acknowledged history. */
  receiveRemote(tick: number, bytes: Uint8Array) {
    this.remote.set(tick, bytes);
    for (const m of [this.local, this.remote, this.snaps, this.peerHashes]) {
      for (const k of m.keys()) if (k < tick - this.maxHistory) m.delete(k);
    }
  }

  /** Record the peer's state hash for a tick; counts desyncs against ours. */
  receiveHash(tick: number, h: number) {
    this.peerHashes.set(tick, h);
    const snap = this.snaps.get(tick);
    if (snap !== undefined) {
      // Re-hash the historical state without disturbing the live sim.
      const live = this.engine.snapshot();
      this.engine.restore(snap);
      const mine = this.engine.hash();
      this.engine.restore(live);
      if (mine === h) this.lastAgreeTick = Math.max(this.lastAgreeTick, tick);
      else this.desyncs++;
    } else if (tick === this.tick) {
      // Quiescent live point (both peers stepped the same ticks): compare now.
      if (this.hash() === h) this.lastAgreeTick = Math.max(this.lastAgreeTick, tick);
      else this.desyncs++;
    }
  }

  /** Advance one tick when both inputs are present; false = stalled on network. */
  step(): boolean {
    const l = (this.myTeam === 0 ? this.local : this.remote).get(this.tick);
    const r = (this.myTeam === 1 ? this.local : this.remote).get(this.tick);
    if (!l || !r) return false;
    if (this.tick % HASH_EVERY === 0) this.snaps.set(this.tick, this.engine.snapshot());
    this.engine.update(1 / 60, decodeInput(l), decodeInput(r));
    this.lastEvents = this.engine.events.splice(0);
    this.tick++;
    return true;
  }

  hash(): number { return this.engine.hash(); }

  /** Host-authoritative recovery: adopt an externally agreed snapshot + tick. */
  applySnapshot(snap: EngineSnapshot, tick: number) {
    this.engine.restore(snap);
    this.tick = tick;
    this.snaps.clear();
    this.snaps.set(tick, this.engine.snapshot());
  }

  /** My input stream for drive loops/tests (decoded, for debugging). */
  debugLocal(tick: number): InputFrame {
    const b = this.local.get(tick);
    return b ? decodeInput(b) : { ...EMPTY_INPUT };
  }
}
