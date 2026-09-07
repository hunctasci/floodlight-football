import type { SignalPayload } from './transport';

export interface RoomCreated {
  roomCode: string;
  matchToken: string;
}

export interface RoomJoined {
  roomCode: string;
  peers: string[];
  matchToken: string;
}

/**
 * Minimal signaling contract for 1v1 room coordination.
 *
 * Two implementations:
 * - AutoSignal (apps/server Node reference, WS /socket, self-host).
 * - CloudflareSignalingClient (production Worker + Durable Object rooms).
 *
 * The relayed payload is SDP (offer/answer) or a trickle ICE candidate.
 * Gameplay networking (NetDriver/lockstep/WebRTC) only sees this interface —
 * never Durable Object or Node internals. Solo never touches either.
 */
export interface SignalingClient {
  onPeerSignal: ((from: string, payload: SignalPayload) => void) | null;
  onPeerJoined: ((clientId: string) => void) | null;
  onPeerLeft: ((clientId: string) => void) | null;
  readonly connected: boolean;
  connect(baseHttp: string, timeoutMs?: number): Promise<void>;
  createRoom(clientId: string): Promise<RoomCreated>;
  joinRoom(code: string, clientId: string): Promise<RoomJoined>;
  sendSignal(to: string, payload: SignalPayload): void;
  close(): void;
}
