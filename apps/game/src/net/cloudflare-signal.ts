import type { SignalPayload } from './transport';
import type { RoomCreated, RoomJoined, SignalingClient } from './signaling';

export type { RoomCreated, RoomJoined };
export type { SignalingClient };

export class SignalError extends Error {}

type WsFactory = (url: string) => WebSocket;
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Msg = Record<string, unknown>;
interface Waiter {
  match: (m: Msg) => boolean;
  res: (m: Msg) => void;
  rej: (e: Error) => void;
}

const isCode = (v: unknown): v is string => typeof v === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(v);
const isToken = (v: unknown): v is string => typeof v === 'string' && v.length >= 16;

/**
 * Production signaling over the Cloudflare control plane:
 *
 *   POST /api/rooms {clientId} → {roomCode, matchToken}
 *   WS   /api/rooms/:code/socket?clientId=… → room-joined / peer-joined /
 *        signaled / peer-left / error
 *
 * Same room-code alphabet, same matchToken handshake binding, same SDP relay
 * semantics as the Node reference (AutoSignal) — different transport only.
 * The match itself stays WebRTC P2P; this client never sees InputFrames.
 */
export class CloudflareSignalingClient implements SignalingClient {
  onPeerSignal: ((from: string, payload: SignalPayload) => void) | null = null;
  onPeerJoined: ((clientId: string) => void) | null = null;
  onPeerLeft: ((clientId: string) => void) | null = null;
  private ws: WebSocket | null = null;
  private waiters: Waiter[] = [];
  private base = '';
  /** room-joined frames arriving before waitForJoin registers (fast LAN/loopback). */
  private pendingJoins: Msg[] = [];
  private pendingError: string | null = null;

  constructor(
    private factory: WsFactory = (u) => new WebSocket(u),
    private fetchFn: FetchLike = fetch,
  ) {}

  static socketUrl(baseHttp: string, code: string, clientId: string): string {
    return (
      baseHttp.replace(/\/+$/, '').replace(/^http/i, 'ws') +
      `/api/rooms/${code}/socket?clientId=${encodeURIComponent(clientId)}`
    );
  }

  get connected(): boolean {
    return !!this.ws && this.ws.readyState === 1;
  }

  /** Probe the control plane; the per-room socket opens in create/joinRoom. */
  async connect(baseHttp: string, timeoutMs = 8000): Promise<void> {
    this.close();
    this.base = baseHttp.replace(/\/+$/, '');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await this.fetchFn(this.base + '/api/health', { signal: ctrl.signal });
      if (!res.ok) throw new SignalError('SERVER UNREACHABLE');
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || body.status !== 'ok') throw new SignalError('SERVER UNREACHABLE');
    } catch (e) {
      if (e instanceof SignalError) throw e;
      throw new SignalError('SERVER UNREACHABLE');
    } finally {
      clearTimeout(t);
    }
  }

  async createRoom(clientId: string): Promise<RoomCreated> {
    if (!this.base) throw new SignalError('SIGNAL LOST');
    let res: Response;
    try {
      res = await this.fetchFn(this.base + '/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
    } catch {
      throw new SignalError('SERVER UNREACHABLE');
    }
    if (res.status === 429) throw new SignalError('RATE LIMITED, SLOW DOWN');
    if (!res.ok) throw new SignalError('SERVER ERROR');
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !isCode(body.roomCode) || !isToken(body.matchToken)) {
      throw new SignalError('BAD SERVER REPLY');
    }
    const created = { roomCode: body.roomCode, matchToken: body.matchToken as string };
    await this.openSocket(created.roomCode, clientId);
    const joined = await this.waitForJoin(created.roomCode);
    if (joined.matchToken !== created.matchToken) throw new SignalError('BAD SERVER REPLY');
    return created;
  }

  async joinRoom(code: string, clientId: string): Promise<RoomJoined> {
    if (!this.base) throw new SignalError('SIGNAL LOST');
    const normalized = code.trim().toUpperCase();
    if (!isCode(normalized)) throw new SignalError('BAD CODE — 6 LETTERS, NO 0/O/1/I');
    await this.openSocket(normalized, clientId);
    return this.waitForJoin(normalized);
  }

  sendSignal(to: string, payload: SignalPayload): void {
    if (!this.connected) throw new SignalError('SIGNAL LOST');
    this.ws!.send(JSON.stringify({ t: 'signal', to, payload }));
  }

  close(): void {
    this.failAll(new SignalError('CANCELLED'));
    this.pendingJoins = [];
    this.pendingError = null;
    try {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(JSON.stringify({ t: 'leave-room' }));
        } catch {
          /* closing anyway */
        }
      }
    } catch {
      /* already gone */
    }
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.ws = null;
  }

  private async openSocket(code: string, clientId: string, timeoutMs = 8000): Promise<void> {
    this.failAll(new SignalError('CANCELLED'));
    this.pendingJoins = [];
    this.pendingError = null;
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    let ws: WebSocket;
    try {
      ws = this.factory(CloudflareSignalingClient.socketUrl(this.base, code, clientId));
    } catch {
      throw new SignalError('SERVER UNREACHABLE');
    }
    this.ws = ws;
    // Listen immediately: the room sends room-joined right after the upgrade,
    // potentially before the open promise below resolves on fast links.
    ws.addEventListener('message', (e) => this.route((e as MessageEvent).data));
    ws.addEventListener('close', () => this.failAll(new SignalError('SIGNAL LOST')));
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new SignalError('SERVER UNREACHABLE')), timeoutMs);
      ws.addEventListener('open', () => {
        clearTimeout(t);
        res();
      }, { once: true });
      ws.addEventListener('error', () => {
        clearTimeout(t);
        rej(new SignalError('SERVER UNREACHABLE'));
      }, { once: true });
    });
  }

  private waitForJoin(code: string, timeoutMs = 10000): Promise<RoomJoined> {
    // A fast room-joined may already sit in the buffer (sent right after the
    // WS upgrade, before this waiter registered). Consume it synchronously.
    const early = this.pendingJoins.findIndex((r) => r.roomCode === code);
    if (early >= 0) {
      const [m] = this.pendingJoins.splice(early, 1);
      if (!isCode(m.roomCode) || !isToken(m.matchToken) || !Array.isArray(m.peers)) {
        return Promise.reject(new SignalError('BAD SERVER REPLY'));
      }
      return Promise.resolve({
        roomCode: m.roomCode as string,
        peers: (m.peers as unknown[]).filter((p): p is string => typeof p === 'string'),
        matchToken: m.matchToken as string,
      });
    }
    if (this.pendingError) {
      const msg = this.pendingError;
      this.pendingError = null;
      return Promise.reject(new SignalError(msg));
    }
    return new Promise<RoomJoined>((res, rej) => {
      const t = setTimeout(() => {
        this.dropByTag(joinedWaiter);
        rej(new SignalError('SERVER TIMEOUT'));
      }, timeoutMs);
      const joinedWaiter: Waiter = {
        match: (r) => r.t === 'room-joined',
        res: (m) => {
          clearTimeout(t);
          if (!isCode(m.roomCode) || !isToken(m.matchToken) || !Array.isArray(m.peers)) {
            rej(new SignalError('BAD SERVER REPLY'));
            return;
          }
          if ((m.roomCode as string) !== code) {
            rej(new SignalError('BAD SERVER REPLY'));
            return;
          }
          res({
            roomCode: m.roomCode as string,
            peers: (m.peers as unknown[]).filter((p): p is string => typeof p === 'string'),
            matchToken: m.matchToken as string,
          });
        },
        rej: (e) => {
          clearTimeout(t);
          rej(e);
        },
      };
      this.waiters.push(joinedWaiter);
    });
  }

  private route(raw: unknown): void {
    let m: Msg;
    try {
      const v: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!v || typeof v !== 'object') return;
      m = v as Msg;
    } catch {
      return;
    }
    if (m.t === 'signaled' && typeof m.from === 'string' && m.payload && typeof m.payload === 'object') {
      this.onPeerSignal?.(m.from, m.payload as SignalPayload);
      return;
    }
    if (m.t === 'peer-joined' && typeof m.clientId === 'string') {
      this.onPeerJoined?.(m.clientId);
      return;
    }
    if (m.t === 'peer-left' && typeof m.clientId === 'string') {
      this.onPeerLeft?.(m.clientId);
      return;
    }
    if (m.t === 'room-joined') {
      const i = this.waiters.findIndex((w) => {
        try {
          return w.match(m);
        } catch {
          return false;
        }
      });
      if (i >= 0) this.waiters.splice(i, 1)[0].res(m);
      else {
        // No waiter yet (create/joinRoom still opening the socket): buffer so
        // the immediately following waitForJoin resolves instead of timing out.
        this.pendingJoins.push(m);
        if (this.pendingJoins.length > 4) this.pendingJoins.shift();
      }
      return;
    }
    if (m.t === 'error') {
      const msg = String(m.message ?? 'SERVER ERROR').toUpperCase().slice(0, 64);
      if (this.waiters.length > 0) this.failAll(new SignalError(msg));
      else this.pendingError = msg;
      return;
    }
    const i = this.waiters.findIndex((w) => {
      try {
        return w.match(m);
      } catch {
        return false;
      }
    });
    if (i >= 0) this.waiters.splice(i, 1)[0].res(m);
  }

  private dropByTag(waiter: Waiter): void {
    const i = this.waiters.indexOf(waiter);
    if (i >= 0) this.waiters.splice(i, 1);
  }

  private failAll(e: Error): void {
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) w.rej(e);
  }
}
