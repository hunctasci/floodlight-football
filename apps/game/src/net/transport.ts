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

/** Signaling payload shape: matches the server's SdpSchema relay verbatim. */
export interface SdpInit {
  type: RTCSdpType;
  sdp: string;
}

/** Browser WebRTC transport. Signaling (offer/answer exchange) stays outside:
 *  the F4 signal server relays it; manual copy-paste codes remain as fallback. */
export class RTCTransport implements DataTransport {
  onmessage: ((data: Uint8Array) => void) | null = null;
  onstate: ((s: TransportState) => void) | null = null;
  private _state: TransportState = 'connecting';
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;

  get state(): TransportState { return this._state; }

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
