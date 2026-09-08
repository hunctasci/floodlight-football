/**
 * Online friend-match session helpers: the single source of truth for the
 * unified Cloudflare-room flow.
 *
 * - One host path: createRoom -> grouped 6-letter code for read-out.
 * - One join path: the friend types the code (JOIN WITH CODE).
 * - Explicit trickle-ICE lifecycle: candidates are accepted before offer,
 *   after offer, before answer, after answer and during async SDP work.
 * - Per-session peer identity: never reuse the persistent league/user id as
 *   the WebSocket/peer identity.
 * - Explicit control-plane selection: Cloudflare vs legacy Node is chosen
 *   from the server's explicit HTTP response, never by silently swallowing a
 *   Cloudflare network error.
 *
 * Pure helpers here are unit-tested under Node (tsx --test). Browser WebRTC
 * (RTCTransport) and DOM stay in main.ts; this module owns the state model.
 */

import { makeClientId } from './signal';
import type { SignalPayload } from './transport';

/** Minimal sink for trickle ICE (RTCTransport in browsers, fakes in tests). */
export interface CandidateSink {
  addIceCandidate(payload: SignalPayload): Promise<void> | void;
}

/**
 * Explicit negotiation state. The transport reference is NEVER nulled merely
 * because the answer SDP arrived: ICE keeps flowing until the data channel
 * opens and NetDriver takes over (and even then the same transport object is
 * reused by the driver, so late candidates still have a target).
 */
export interface NegotiationState {
  transport: CandidateSink | null;
  remotePeerId: string | null;
  offerHandled: boolean;
  answerHandled: boolean;
  pendingCandidates: SignalPayload[];
}

export function createNegotiationState(): NegotiationState {
  return {
    transport: null,
    remotePeerId: null,
    offerHandled: false,
    answerHandled: false,
    pendingCandidates: [],
  };
}

/** Bind the live WebRTC transport; returns queued candidates to flush in order. */
export function attachNegotiationTransport(
  state: NegotiationState,
  transport: CandidateSink,
): SignalPayload[] {
  state.transport = transport;
  const queued = state.pendingCandidates;
  state.pendingCandidates = [];
  return queued;
}

/**
 * Route one remote ICE candidate: deliver to the live transport when present,
 * otherwise queue for the flush after the transport exists. Never drops a
 * valid candidate because of SDP timing (before/after offer/answer).
 */
export async function ingestRemoteCandidate(
  state: NegotiationState,
  payload: SignalPayload,
): Promise<'queued' | 'delivered'> {
  if (state.transport) {
    try {
      await state.transport.addIceCandidate(payload);
    } catch {
      /* stale candidate: connectivity continues without it */
    }
    return 'delivered';
  }
  state.pendingCandidates.push(payload);
  return 'queued';
}

/** Flush helper for tests: deliver every queued candidate to the transport. */
export async function flushNegotiationCandidates(state: NegotiationState): Promise<number> {
  const t = state.transport;
  if (!t) return 0;
  const queued = state.pendingCandidates;
  state.pendingCandidates = [];
  for (const c of queued) {
    try {
      await t.addIceCandidate(c);
    } catch {
      /* ignore stale entries */
    }
  }
  return queued.length;
}

export function resetNegotiationState(state: NegotiationState): void {
  state.transport = null;
  state.remotePeerId = null;
  state.offerHandled = false;
  state.answerHandled = false;
  state.pendingCandidates = [];
}

// ---------------------------------------------------------------------------
// Peer identity: persistent user vs per-session connection identity.
// ---------------------------------------------------------------------------

/**
 * Fresh online peer/session id for ONE multiplayer attempt. Two tabs that
 * share the same persistent league id (localStorage) still get distinct
 * room members, so the second tab is never mistaken for a reconnect.
 */
export function createSessionPeerId(): string {
  return makeClientId();
}

// ---------------------------------------------------------------------------
// Test-only short match duration (cannot affect production).
// ---------------------------------------------------------------------------

/** True only when the page was opened with ?e2e (Playwright, dev/test only). */
export function isE2EMode(search: string): boolean {
  try {
    return new URLSearchParams(search).has('e2e');
  } catch {
    return false;
  }
}

/** E2E halves: 30s + 30s ~= one real minute including halftime UI. */
export const E2E_HALF_DURATION_SEC = 30;

/**
 * Host match length. Production uses the player's chosen duration; E2E uses
 * the short test-only duration. Guest duration always comes from the host's
 * welcome message, so only the host consults this.
 */
export function effectiveOnlineDuration(baseDuration: number, search: string): number {
  return isE2EMode(search) ? E2E_HALF_DURATION_SEC : baseDuration;
}

// ---------------------------------------------------------------------------
// Explicit control-plane selection (no silent architecture switching).
// ---------------------------------------------------------------------------

export type ControlPlaneKind = 'cloudflare' | 'legacy';

/**
 * Probe the origin that served the game. A Cloudflare control plane answers
 * GET /api/health with {status:'ok', service:'floodlight'}. Any other HTTP
 * response (e.g. Node self-host 404) explicitly selects the legacy path.
 * A network failure throws: production Cloudflare errors must surface as a
 * player-facing connection error, never silently switch architectures.
 */
export async function detectControlPlane(
  baseHttp: string,
  fetchFn: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
  timeoutMs = 5000,
): Promise<ControlPlaneKind> {
  const base = baseHttp.replace(/\/+$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchFn(base + '/api/health', { signal: ctrl.signal });
  } catch {
    throw new Error('SERVER UNREACHABLE');
  } finally {
    clearTimeout(t);
  }
  try {
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (body && body.status === 'ok' && (body as Record<string, unknown>).service === 'floodlight') {
        return 'cloudflare';
      }
    }
  } catch {
    /* malformed body: fall through to legacy selection */
  }
  return 'legacy';
}

// ---------------------------------------------------------------------------
// Debug lifecycle for test instrumentation (high-level, no secrets).
// ---------------------------------------------------------------------------

export type MultiplayerDebugState =
  | 'idle'
  | 'creating-room'
  | 'waiting-for-peer'
  | 'joining-room'
  | 'negotiating'
  | 'connected'
  | 'ready'
  | 'playing'
  | 'finished'
  | 'error';
