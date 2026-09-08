/**
 * Invite-URL helpers for Cloudflare-room multiplayer.
 *
 * One identity only: the 6-char room CODE. The URL carries no SDP, no reply
 * codes and no secrets — the room's matchToken is issued by the control plane
 * over the per-room WebSocket after joining. Both entry points (tapping a
 * shared link, typing a code) converge on `joinRoom(code)`.
 *
 * Pure functions (no DOM): unit-tested under Node via tsx --test.
 */

export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const ROOM_PARAM = 'room';

/** Normalize free-typed codes (case/whitespace tolerant); null when invalid. */
export function normalizeRoomCode(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  return ROOM_CODE_RE.test(code) ? code : null;
}

/** Build a shareable invite URL from the current origin (never hard-coded). */
export function buildInviteUrl(origin: string, pathname: string, code: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('invalid room code');
  const cleanOrigin = origin.replace(/\/+$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${cleanOrigin}${path}?${ROOM_PARAM}=${normalized}`;
}

/** Extract a room code from an invite URL or bare code string. */
export function parseInviteUrl(url: string): string | null {
  if (typeof url !== 'string' || !url) return null;
  const q = url.indexOf('?');
  if (q >= 0) {
    try {
      const params = new URLSearchParams(url.slice(q + 1).split('#')[0]);
      const v = params.get(ROOM_PARAM);
      if (v) return normalizeRoomCode(v);
    } catch {
      return null;
    }
    return null;
  }
  return normalizeRoomCode(url);
}

/** Pull the invite code from the current location search string. */
export function inviteCodeFromSearch(search: string): string | null {
  try {
    const v = new URLSearchParams(search).get(ROOM_PARAM);
    return v ? normalizeRoomCode(v) : null;
  } catch {
    return null;
  }
}

/**
 * Player-friendly lobby errors. Raw control-plane / WebRTC messages never
 * reach the UI: expired invites, full rooms and dead links all read the same.
 */
export function friendlyNetError(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e ?? '')).toUpperCase();
  if (/ROOM IS FULL/.test(raw)) return 'ROOM IS FULL';
  if (/BAD SERVER REPLY|NOT FOUND|EXPIRED|NO ROOM|BAD CODE|BAD INVITE|INVALID/.test(raw)) {
    return 'INVITE EXPIRED — ASK FOR A NEW LINK';
  }
  if (/RATE LIMITED/.test(raw)) return 'TOO MANY TRIES — WAIT A MOMENT';
  if (/TIMEOUT/.test(raw)) return 'CONNECTION FAILED — TRY AGAIN';
  if (/UNREACHABLE|SIGNAL LOST|SERVER|NETWORK|FETCH|OFFLINE/.test(raw)) {
    return 'CONNECTION FAILED — CHECK INTERNET';
  }
  if (/WEBRTC|BROWSER|SUPPORTED|RTC|ANSWER|OFFER|ICE|SDP/.test(raw)) {
    return 'CONNECTION FAILED — TRY AGAIN';
  }
  if (/CANCEL|LEFT|QUIT|CLOSED|HOST LEFT|FRIEND LEFT/.test(raw)) return 'FRIEND LEFT';
  return 'CONNECTION FAILED — TRY AGAIN';
}

/**
 * ICE no-path hint. When the handshake dies after SDP + candidates flowed
 * (nominated pair, zero bytes) and no TURN relay was configured, "try again"
 * is dishonest — retrying the same direct path fails the same way. Tell the
 * player what actually helps: another network or a TURN relay (?turn=…).
 * Pure function so headless tests can pin the copy.
 */
export function withRelayHint(message: string, relaySource: string): string {
  if (relaySource !== 'off') return message;
  if (/LOST|TIMEOUT|FAILED|UNREACHABLE|NEGOTIATION/.test(message.toUpperCase())) {
    return 'NO DIRECT PATH — TRY ANOTHER NETWORK OR ADD TURN (?turn=…)';
  }
  return message;
}

/** Copy text with a textarea fallback for older/mobile browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function canShare(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  } catch {
    return false;
  }
}
