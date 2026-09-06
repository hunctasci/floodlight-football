import type { SdpInit } from './transport';

export interface RoomCreated {
  roomCode: string;
  matchToken: string;
}

export interface RoomJoined {
  roomCode: string;
  peers: string[];
  matchToken: string;
}

export class SignalError extends Error {}

type WsFactory = (url: string) => WebSocket;
type Msg = Record<string, unknown>;
interface Waiter { match: (m: Msg) => boolean; res: (m: Msg) => void; rej: (e: Error) => void }

const isCode = (v: unknown): v is string => typeof v === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(v);
const isToken = (v: unknown): v is string => typeof v === 'string' && v.length >= 16;

/**
 * Server-relayed signaling for one-click online matches. The host creates a
 * room and reads out a 6-char code; the joiner types it and lands directly
 * in the room — no SDP copy-paste. The server only relays SDP between the
 * two room members (TTL rooms, rate-limited joins, no room listing), and
 * both sides bind the WebRTC handshake to the room's matchToken, so a stray
 * peer can never land in someone else's session.
 */
export class AutoSignal {
  onPeerSignal: ((from: string, sdp: SdpInit) => void) | null = null;
  onPeerJoined: ((clientId: string) => void) | null = null;
  onPeerLeft: ((clientId: string) => void) | null = null;
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];

  constructor(private factory: WsFactory = (u) => new WebSocket(u)) {}

  static socketUrl(baseHttp: string): string {
    return baseHttp.replace(/\/+$/, '').replace(/^http/i, 'ws') + '/socket';
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === 1;
  }

  async connect(baseHttp: string, timeoutMs = 8000): Promise<void> {
    this.close();
    let ws: WebSocket;
    try {
      ws = this.factory(AutoSignal.socketUrl(baseHttp));
    } catch {
      throw new SignalError('SERVER UNREACHABLE');
    }
    this.ws = ws;
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new SignalError('SERVER UNREACHABLE')), timeoutMs);
      ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(t); rej(new SignalError('SERVER UNREACHABLE')); }, { once: true });
    });
    ws.addEventListener('message', (e) => this.route((e as MessageEvent).data));
    ws.addEventListener('close', () => this.failAll(new SignalError('SIGNAL LOST')));
  }

  async createRoom(clientId: string): Promise<RoomCreated> {
    const m = await this.ask({ t: 'create-room', clientId }, (r) => r.t === 'room-created');
    if (!isCode(m.roomCode) || !isToken(m.matchToken)) throw new SignalError('BAD SERVER REPLY');
    return { roomCode: m.roomCode, matchToken: m.matchToken };
  }

  async joinRoom(code: string, clientId: string): Promise<RoomJoined> {
    const m = await this.ask({ t: 'join-room', code, clientId }, (r) => r.t === 'room-joined');
    if (!isCode(m.roomCode) || !isToken(m.matchToken) || !Array.isArray(m.peers)) {
      throw new SignalError('BAD SERVER REPLY');
    }
    return { roomCode: m.roomCode, peers: m.peers.filter((p): p is string => typeof p === 'string'), matchToken: m.matchToken };
  }

  sendSignal(to: string, sdp: SdpInit): void {
    if (!this.connected) throw new SignalError('SIGNAL LOST');
    this.ws!.send(JSON.stringify({ t: 'signal', to, payload: sdp }));
  }

  close(): void {
    this.failAll(new SignalError('CANCELLED'));
    try { this.ws?.close(); } catch { /* already gone */ }
    this.ws = null;
  }

  private ask(send: object, match: (m: Msg) => boolean, timeoutMs = 10000): Promise<Msg> {
    if (!this.connected) return Promise.reject(new SignalError('SIGNAL LOST'));
    return new Promise<Msg>((res, rej) => {
      const waiter = {
        match,
        res: (m: Msg) => { clearTimeout(t); res(m); },
        rej: (e: Error) => { clearTimeout(t); rej(e); },
      };
      const t = setTimeout(() => { this.drop(waiter); rej(new SignalError('SERVER TIMEOUT')); }, timeoutMs);
      this.waiters.push(waiter);
      try { this.ws!.send(JSON.stringify(send)); }
      catch { this.drop(waiter); rej(new SignalError('SIGNAL LOST')); }
    });
  }

  private route(raw: unknown): void {
    let m: Msg;
    try {
      const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!v || typeof v !== 'object') return;
      m = v as Msg;
    } catch { return; }
    if (m.t === 'signaled' && typeof m.from === 'string' && m.payload && typeof m.payload === 'object') {
      this.onPeerSignal?.(m.from, m.payload as SdpInit);
      return;
    }
    if (m.t === 'peer-joined' && typeof m.clientId === 'string') { this.onPeerJoined?.(m.clientId); return; }
    if (m.t === 'peer-left' && typeof m.clientId === 'string') { this.onPeerLeft?.(m.clientId); return; }
    if (m.t === 'error') {
      const msg = String(m.message ?? 'SERVER ERROR').toUpperCase().slice(0, 64);
      this.failAll(new SignalError(msg));
      return;
    }
    const i = this.waiters.findIndex((w) => {
      try { return w.match(m); } catch { return false; }
    });
    if (i >= 0) this.waiters.splice(i, 1)[0].res(m);
  }

  private drop(waiter: Waiter): void {
    const i = this.waiters.indexOf(waiter);
    if (i >= 0) this.waiters.splice(i, 1);
  }

  private failAll(e: Error): void {
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) w.rej(e);
  }
}
