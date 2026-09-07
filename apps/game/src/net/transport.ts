import { decodeCode, encodeCode } from './signal';

export type TransportState = 'connecting' | 'open' | 'closed';

/** Minimal byte-pipe abstraction. Browser WebRTC and in-process loopback
 *  both implement it, so session/driver code never touches RTCPeerConnection. */
export interface DataTransport {
  onmessage: ((data: Uint8Array) => void) | null;
  onstate: ((s: TransportState) => void) | null;
  readonly state: TransportState;
  send(data: Uint8Array): void;
  close(): void;
}

/** In-process pair for headless tests and same-machine demos. Delivery is
 *  synchronous (copied); the RTC transport is async — code must not rely
 *  on delivery timing. */
export class LoopbackTransport implements DataTransport {
  onmessage: ((data: Uint8Array) => void) | null = null;
  onstate: ((s: TransportState) => void) | null = null;
  state: TransportState = 'connecting';
  private peer: LoopbackTransport | null = null;

  static pair(): [LoopbackTransport, LoopbackTransport] {
    const a = new LoopbackTransport(), b = new LoopbackTransport();
    a.peer = b; b.peer = a;
    return [a, b];
  }

  open() {
    if (this.state === 'closed') return;
    this.state = 'open';
    this.onstate?.('open');
  }

  send(data: Uint8Array) {
    if (this.state !== 'open' || !this.peer || this.peer.state !== 'open') return;
    this.peer.onmessage?.(data.slice());
  }

  close() {
    this.state = 'closed';
    this.onstate?.('closed');
  }
}

export interface RTCOffer {
  code: string;
}

const STUN = 'stun:stun.l.google.com:19302';
const STUN_FALLBACKS = ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'];

/** Redundant STUN set: one Google endpoint down must not kill gathering. */
function iceServers(stun: string): RTCIceServer[] {
  const urls = [stun, ...STUN_FALLBACKS.filter((s) => s !== stun)];
  return [{ urls }];
}

/** DataChannel-only needs max-bundle + MUX; ignored where unsupported. */
function pcConfig(stun: string): RTCConfiguration {
  return {
    iceServers: iceServers(stun),
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

function waitIceComplete(pc: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const done = () => { pc.removeEventListener('icegatheringstatechange', done); resolve(); };
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') done();
    });
    setTimeout(done, timeoutMs);
  });
}

/** Signaling payload shape: matches the server's SignalPayloadSchema relay verbatim. */
export interface SdpInit {
  type: RTCSdpType;
  sdp: string;
}

/** Trickle ICE candidate relayed through the same signaling channel. */
export interface IceInit {
  type: 'candidate';
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

/** Any payload the control plane relays: SDP offer/answer or ICE candidate. */
export type SignalPayload = SdpInit | IceInit;

export function isIcePayload(p: SignalPayload): p is IceInit {
  return (p as IceInit).type === 'candidate';
}

export function isSdpPayload(p: SignalPayload): p is SdpInit {
  return (p as { type: string }).type !== 'candidate' && typeof (p as SdpInit).sdp === 'string';
}

/** Candidate family without storing the address (host/srflx/prflx/relay). */
function iceFamilyOf(candidate: string): string {
  const m = /\styp\s+(host|srflx|prflx|relay)\b/i.exec(candidate);
  return m ? m[1].toLowerCase() : 'unknown';
}

/** Structural check for inbound signaling payloads (never throws). */
export function isValidSignalPayload(v: unknown): v is SignalPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (p.type === 'candidate') {
    if (typeof p.candidate !== 'string' || p.candidate.length < 1 || p.candidate.length > 4096) return false;
    if (p.sdpMid !== undefined && p.sdpMid !== null && typeof p.sdpMid !== 'string') return false;
    const idx = p.sdpMLineIndex;
    if (idx !== undefined && idx !== null) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 32) return false;
    }
    return true;
  }
  if (p.type !== 'offer' && p.type !== 'answer' && p.type !== 'pranswer') return false;
  return typeof p.sdp === 'string' && p.sdp.length >= 1 && (p.sdp as string).length <= 16384;
}

/** Aggregate PC/ICE states for diagnostics (never SDP or addresses). */
export interface PcDebugState {
  connection: string;
  ice: string;
  signaling: string;
  gathering: string;
}

/** Per-candidate debug event: family only, never the raw candidate line. */
export interface IceDebugEvent {
  dir: 'local' | 'remote';
  family: string;
  ok: boolean;
  err?: string;
}

/** Browser WebRTC transport. Signaling (offer/answer + trickle ICE) stays
 *  outside: the Cloudflare control plane relays it; the data channel carries
 *  gameplay. Legacy non-trickle helpers remain for tests/debugging. */
export class RTCTransport implements DataTransport {
  onmessage: ((data: Uint8Array) => void) | null = null;
  onstate: ((s: TransportState) => void) | null = null;
  /** Fires for each locally gathered ICE candidate (trickle flow). */
  onCandidate: ((c: IceInit) => void) | null = null;
  /** PC/ICE state transitions; survives driver takeover (unlike onstate). */
  onPcState: ((s: PcDebugState) => void) | null = null;
  /** Redacted per-candidate outcomes for the net diagnostic log. */
  onIceDebug: ((e: IceDebugEvent) => void) | null = null;
  private _state: TransportState = 'connecting';
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  /** Remote candidates arriving before setRemoteDescription (flushed in order). */
  private pendingRemote: IceInit[] = [];
  private remoteReady = false;

  get state(): TransportState { return this._state; }

  /** Expose the underlying PC read-only for stats/state inspection. */
  get peerConnection(): RTCPeerConnection { return this.pc; }

  private constructor(pc: RTCPeerConnection) {
    this.pc = pc;
  }

  private setState(s: TransportState) {
    this._state = s;
    this.onstate?.(s);
  }

  private wire(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => this.setState('open');
    dc.onclose = () => this.setState('closed');
    dc.onmessage = (e) => this.onmessage?.(new Uint8Array(e.data as ArrayBuffer));
  }

  private watchIce() {
    this.pc.onicecandidate = (e) => {
      const c = e.candidate;
      if (!c || !c.candidate) return;
      try {
        this.onIceDebug?.({ dir: 'local', family: iceFamilyOf(c.candidate), ok: true });
      } catch {
        /* diagnostics only */
      }
      this.onCandidate?.({
        type: 'candidate',
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
      });
    };
  }

  private emitPcState() {
    try {
      this.onPcState?.({
        connection: this.pc.connectionState,
        ice: this.pc.iceConnectionState,
        signaling: this.pc.signalingState,
        gathering: this.pc.iceGatheringState,
      });
    } catch {
      /* diagnostics only */
    }
  }

  private watchConnection() {
    this.pc.onconnectionstatechange = () => {
      this.emitPcState();
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        this.setState('closed');
      }
    };
    this.pc.oniceconnectionstatechange = () => this.emitPcState();
    this.pc.onsignalingstatechange = () => this.emitPcState();
    this.pc.onicegatheringstatechange = () => this.emitPcState();
  }

  /** Queue or apply one remote ICE candidate (trickle flow, never throws). */
  async addIceCandidate(init: SignalPayload): Promise<void> {
    if (!init || (init as { type: string }).type !== 'candidate') return;
    const c = init as IceInit;
    if (typeof c.candidate !== 'string' || !c.candidate) return;
    if (!this.remoteReady) {
      this.pendingRemote.push(c);
      return;
    }
    try {
      await this.pc.addIceCandidate(
        new RTCIceCandidate({
          candidate: c.candidate,
          sdpMid: c.sdpMid ?? undefined,
          sdpMLineIndex: c.sdpMLineIndex ?? undefined,
        }),
      );
      try {
        this.onIceDebug?.({ dir: 'remote', family: iceFamilyOf(c.candidate), ok: true });
      } catch {
        /* diagnostics only */
      }
    } catch (e) {
      /* stale candidate (e.g. after restart): connectivity continues without it */
      try {
        this.onIceDebug?.({
          dir: 'remote',
          family: iceFamilyOf(c.candidate),
          ok: false,
          err: e instanceof Error ? e.name.slice(0, 32) : 'error',
        });
      } catch {
        /* diagnostics only */
      }
    }
  }

  private async flushRemote(): Promise<void> {
    const q = this.pendingRemote;
    this.pendingRemote = [];
    for (const c of q) {
      try {
        await this.pc.addIceCandidate(
          new RTCIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid ?? undefined,
            sdpMLineIndex: c.sdpMLineIndex ?? undefined,
          }),
        );
        try {
          this.onIceDebug?.({ dir: 'remote', family: iceFamilyOf(c.candidate), ok: true });
        } catch {
          /* diagnostics only */
        }
      } catch (e) {
        /* ignore stale entries */
        try {
          this.onIceDebug?.({
            dir: 'remote',
            family: iceFamilyOf(c.candidate),
            ok: false,
            err: e instanceof Error ? e.name.slice(0, 32) : 'error',
          });
        } catch {
          /* diagnostics only */
        }
      }
    }
  }

  /** Host side (trickle): offer returns immediately; candidates flow via onCandidate. */
  static async createOfferTrickle(stun = STUN): Promise<{ transport: RTCTransport; offer: SdpInit }> {
    const pc = new RTCPeerConnection(pcConfig(stun));
    const t = new RTCTransport(pc);
    const dc = pc.createDataChannel('game', { ordered: true });
    t.wire(dc);
    t.watchConnection();
    t.watchIce();
    await pc.setLocalDescription(await pc.createOffer());
    const d = pc.localDescription!;
    return { transport: t, offer: { type: d.type, sdp: d.sdp } };
  }

  /** Joiner side (trickle): answer returns immediately; candidates flow via onCandidate. */
  static async acceptOfferTrickle(offer: SdpInit, stun = STUN): Promise<{ transport: RTCTransport; answer: SdpInit }> {
    const pc = new RTCPeerConnection(pcConfig(stun));
    const t = new RTCTransport(pc);
    pc.ondatachannel = (e) => t.wire(e.channel);
    t.watchConnection();
    t.watchIce();
    await pc.setRemoteDescription(offer);
    t.remoteReady = true;
    await t.flushRemote();
    await pc.setLocalDescription(await pc.createAnswer());
    const d = pc.localDescription!;
    return { transport: t, answer: { type: d.type, sdp: d.sdp } };
  }

  /** Host side: creates the offer + data channel, returns raw SDP for relay. */
  static async createOfferSdp(stun = STUN): Promise<{ transport: RTCTransport; offer: SdpInit }> {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: stun }] });
    const t = new RTCTransport(pc);
    const dc = pc.createDataChannel('game', { ordered: true });
    t.wire(dc);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') t.setState('closed');
    };
    await pc.setLocalDescription(await pc.createOffer());
    await waitIceComplete(pc);
    const d = pc.localDescription!;
    return { transport: t, offer: { type: d.type, sdp: d.sdp } };
  }

  /** Host side: creates the offer + data channel, returns a shareable code. */
  static async createOffer(stun = STUN): Promise<{ transport: RTCTransport; code: string }> {
    const { transport, offer } = await RTCTransport.createOfferSdp(stun);
    return { transport, code: encodeCode({ sdp: offer }) };
  }

  /** Joiner side: consumes a raw offer, returns a raw answer for relay. */
  static async acceptOfferSdp(offer: SdpInit, stun = STUN): Promise<{ transport: RTCTransport; answer: SdpInit }> {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: stun }] });
    const t = new RTCTransport(pc);
    pc.ondatachannel = (e) => t.wire(e.channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') t.setState('closed');
    };
    await pc.setRemoteDescription(offer);
    t.remoteReady = true;
    await t.flushRemote();
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIceComplete(pc);
    const d = pc.localDescription!;
    return { transport: t, answer: { type: d.type, sdp: d.sdp } };
  }

  /** Joiner side: consumes the host code, returns an answer code. */
  static async acceptOffer(code: string, stun = STUN): Promise<{ transport: RTCTransport; answer: string }> {
    const { sdp } = decodeCode<{ sdp: SdpInit }>(code);
    const { transport, answer } = await RTCTransport.acceptOfferSdp(sdp, stun);
    return { transport, answer: encodeCode({ sdp: answer }) };
  }

  /** Host side: completes the handshake with the joiner's raw answer. */
  async acceptAnswerSdp(answer: SdpInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    this.remoteReady = true;
    await this.flushRemote();
  }

  /** Host side: completes the handshake with the joiner's answer. */
  async acceptAnswer(code: string): Promise<void> {
    const { sdp } = decodeCode<{ sdp: SdpInit }>(code);
    await this.acceptAnswerSdp(sdp);
  }

  send(data: Uint8Array) {
    if (this._state === 'open' && this.dc?.readyState === 'open') {
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      this.dc.send(copy);
    }
  }

  close() {
    try { this.dc?.close(); } catch { /* already gone */ }
    try { this.pc.close(); } catch { /* already gone */ }
    this.setState('closed');
  }
}
