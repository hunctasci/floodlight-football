/**
 * Room-code helpers for Cloudflare-room multiplayer.
 *
 * Code-only joining: the host reads out a 6-char room CODE, the friend types
 * it into JOIN WITH CODE. No invite links, no SDP in the UI — the room's
 * matchToken is issued by the control plane over the per-room WebSocket
 * after joining. Both entry points (hosting, typing a code) converge on
 * `joinRoom(code)`.
 *
 * Pure functions (no DOM): unit-tested under Node via tsx --test.
 */

export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Normalize free-typed codes (case/space/dash tolerant); null when invalid. */
export function normalizeRoomCode(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  return ROOM_CODE_RE.test(code) ? code : null;
}

/** Readable display form: groups of three ("ABC DEF"). Display only —
 *  always normalize before comparing or joining. */
export function formatRoomCode(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return code.trim().toUpperCase();
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
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
