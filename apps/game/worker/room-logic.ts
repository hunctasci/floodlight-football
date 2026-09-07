/**
 * Pure room helpers shared by the Worker entry and the Room Durable Object.
 *
 * No Cloudflare imports here: this module is unit-testable under plain Node
 * (tsx --test) and never touches the deterministic football simulation.
 *
 * Wire shapes mirror @floodlight/protocol (zod) without importing zod, so the
 * Worker stays dependency-free and Web-standard. Game clients keep their own
 * structural validation (see apps/game/src/net/*).
 */

/** Unambiguous 6-char codes (no 0/O/1/I), readable over voice chat. */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
/** Guest device identity: uuid-style hex from the client (ADR-004). */
export const CLIENT_ID_RE = /^[0-9a-f-]{8,64}$/i;
export const MAX_MEMBERS = 2;
/** Room TTL seconds (~2h, matching the Node reference backend). */
export const ROOM_TTL_SEC = 7200;
/** Max WS/HTTP JSON payload bytes (matches Node maxPayloadBytes default). */
export const MAX_PAYLOAD_BYTES = 65536;

export interface RoomAttachment {
  peerId: string;
  role: 'host' | 'guest';
  joinedAt: number;
}

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  return ROOM_CODE_RE.test(code) ? code : null;
}

export function isValidCode(v: unknown): v is string {
  return typeof v === 'string' && ROOM_CODE_RE.test(v);
}

export function isValidClientId(v: unknown): v is string {
  return typeof v === 'string' && CLIENT_ID_RE.test(v);
}

/** Map 6 random bytes onto the room alphabet (caller supplies crypto bytes). */
export function codeFromBytes(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

export function makeRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return codeFromBytes(bytes);
}

/** 256-bit hex room token binding the WebRTC handshake (never logged). */
export function makeMatchToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type SdpType = 'offer' | 'answer' | 'pranswer';

export interface SdpPayload {
  type: SdpType;
  sdp: string;
}

export interface IcePayload {
  type: 'candidate';
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

/** Any signaling payload the control plane relays: SDP or ICE candidate. */
export type SignalPayload = SdpPayload | IcePayload;

export function isValidSdp(v: unknown): v is SdpPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (p.type !== 'offer' && p.type !== 'answer' && p.type !== 'pranswer') return false;
  return typeof p.sdp === 'string' && p.sdp.length >= 1 && p.sdp.length <= 16384;
}

export function isValidIce(v: unknown): v is IcePayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (p.type !== 'candidate') return false;
  if (typeof p.candidate !== 'string' || p.candidate.length < 1 || p.candidate.length > 4096) return false;
  if (p.sdpMid !== undefined && p.sdpMid !== null && typeof p.sdpMid !== 'string') return false;
  if (typeof p.sdpMid === 'string' && p.sdpMid.length > 64) return false;
  const idx = p.sdpMLineIndex;
  if (idx !== undefined && idx !== null) {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 32) return false;
  }
  return true;
}

/** Accept SDP offer/answer or a trickle ICE candidate (never throws). */
export function isValidSignalPayload(v: unknown): v is SignalPayload {
  return isValidSdp(v) || isValidIce(v);
}

export type InboundKind = 'signal' | 'ping' | 'leave-room' | 'join-room' | 'unknown' | 'invalid';

export interface ParsedInbound {
  kind: InboundKind;
  /** Human-safe error for {t:'error'} replies (never echoes secrets). */
  error?: string;
  to?: string;
  payload?: SignalPayload;
  code?: string;
  clientId?: string;
}

/** Validate one inbound WS JSON message without throwing. */
export function parseInbound(data: unknown): ParsedInbound {
  let v: unknown = data;
  if (typeof data === 'string') {
    if (data.length > MAX_PAYLOAD_BYTES) return { kind: 'invalid', error: 'message too large' };
    try {
      v = JSON.parse(data);
    } catch {
      return { kind: 'invalid', error: 'malformed JSON' };
    }
  }
  if (!v || typeof v !== 'object') return { kind: 'invalid', error: 'invalid message' };
  const m = v as Record<string, unknown>;
  if (m.t === 'ping') return { kind: 'ping' };
  if (m.t === 'leave-room') return { kind: 'leave-room' };
  if (m.t === 'join-room') {
    if (!isValidCode(m.code) || !isValidClientId(m.clientId)) {
      return { kind: 'invalid', error: 'invalid message' };
    }
    return { kind: 'join-room', code: m.code as string, clientId: m.clientId as string };
  }
  if (m.t === 'signal') {
    if (!isValidClientId(m.to) || !isValidSignalPayload(m.payload)) {
      return { kind: 'invalid', error: 'invalid message' };
    }
    return { kind: 'signal', to: m.to as string, payload: m.payload as SignalPayload };
  }
  if (m.t === 'create-room') {
    // Legacy Node WS shape: Cloudflare creates rooms over POST /api/rooms.
    // Accept the shape so old clients get a clear error, not a crash.
    return { kind: 'unknown', error: 'use POST /api/rooms' };
  }
  return { kind: 'invalid', error: 'invalid message' };
}

/** Room membership list helpers (max 2, idempotent re-join). */
export function addMember(members: string[], clientId: string): { ok: true; members: string[] } | { ok: false; reason: 'full' } {
  if (members.includes(clientId)) return { ok: true, members: [...members] };
  if (members.length >= MAX_MEMBERS) return { ok: false, reason: 'full' };
  return { ok: true, members: [...members, clientId] };
}

export function removeMember(members: string[], clientId: string): string[] {
  return members.filter((m) => m !== clientId);
}

/** Peers visible to a member (everyone except self). */
export function peersOf(members: string[], self: string): string[] {
  return members.filter((m) => m !== self);
}

/**
 * Authorize one SDP relay: sender and target must both be room members.
 * Returns the client-safe error message, or null when relay is allowed.
 * A client must never relay signaling into an unrelated room.
 */
export function authorizeRelay(
  members: string[],
  from: string,
  to: string,
): 'join a room first' | 'peer offline' | null {
  if (!members.includes(from)) return 'join a room first';
  if (!members.includes(to)) return 'peer offline';
  return null;
}

/** True once the room's expiry instant has passed (never resurrect stale rooms). */
export function isExpired(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt <= now;
}

export interface RateLimiter {
  allow(key: string, limit: number, windowSec: number): boolean;
}

/**
 * Best-effort sliding-window limiter (per-isolate memory, resets on eviction).
 * Adequate for V1 arcade rooms; stronger distributed abuse control is future work.
 */
export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, limit: number, windowSec: number): boolean {
      const t = now();
      const cutoff = t - windowSec * 1000;
      const arr = (hits.get(key) ?? []).filter((x) => x > cutoff);
      if (arr.length >= limit) {
        hits.set(key, arr);
        return false;
      }
      arr.push(t);
      hits.set(key, arr);
      if (hits.size > 2048) {
        for (const [k, v] of hits) {
          if (v.length === 0 || v[v.length - 1] < t - 600_000) hits.delete(k);
        }
      }
      return true;
    },
  };
}
