/**
 * City League invite helpers — invitation context must survive onboarding.
 *
 * Current repo flow is code-only (host reads a 6-char code, friend types it).
 * This module adds shareable URLs on top without breaking that flow:
 *   canonical:  {origin}/friend/ABC123
 *   aliases:    ?join=ABC123 · ?room=ABC123 · ?code=ABC123 · /join/ABC123
 *
 * Pure functions (no DOM): unit-tested under Node via tsx --test.
 * Storage helpers persist the pending invite across the first-launch
 * profile setup so a fresh guest continues automatically into the room.
 */

export const INVITE_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const PENDING_INVITE_KEY = 'floodlight.pending-invite';

export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  return INVITE_CODE_RE.test(code) ? code : null;
}

/**
 * Extract an invite code from a URL. Accepts canonical /friend/CODE plus
 * query/hash aliases. Returns null when no valid code is present.
 */
export function getInviteCodeFromLocation(
  search: string = '',
  pathname: string = '/',
  hash: string = '',
): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    for (const key of ['join', 'room', 'code', 'invite']) {
      const v = params.get(key);
      const norm = v ? normalizeInviteCode(v) : null;
      if (norm) return norm;
    }
  } catch {
    /* malformed search: fall through to path parsing */
  }
  const pathMatch = pathname.match(/\/(?:friend|join|invite|room)\/([A-Za-z0-9-]{1,16})/i);
  if (pathMatch) {
    const norm = normalizeInviteCode(pathMatch[1]);
    if (norm) return norm;
  }
  if (hash) {
    const h = hash.startsWith('#') ? hash.slice(1) : hash;
    try {
      const hp = new URLSearchParams(h);
      for (const key of ['join', 'room', 'code', 'invite']) {
        const v = hp.get(key);
        const norm = v ? normalizeInviteCode(v) : null;
        if (norm) return norm;
      }
    } catch {
      /* ignore */
    }
    const bare = normalizeInviteCode(h.replace(/^[/?]+/, '').split(/[/?&]/)[0] ?? '');
    if (bare) return bare;
  }
  return null;
}

/** Canonical shareable URL for a room code (same origin as the game). */
export function buildInviteUrl(origin: string, code: string): string {
  const norm = normalizeInviteCode(code);
  if (!norm) throw new Error('invalid code');
  return `${origin.replace(/\/+$/, '')}/friend/${norm}`;
}

/** Turkish WhatsApp challenge copy (simple, no opponent knowledge needed). */
export function buildChallengeMessage(cityName: string, inviteUrl: string): string {
  const city = cityName.trim() || 'Şehrim';
  return `⚽ Floodlight Football'da sana meydan okuyorum.\n\n${city} için oynuyorum.\n\nBeni yenebilir misin?\n\n${inviteUrl}`;
}

/** Versus variant when the opponent city is already known. */
export function buildVersusMessage(homeCity: string, awayCity: string, inviteUrl: string): string {
  return `${homeCity} vs ${awayCity}.\n\nSahayı kuralım. ⚽\n\n${inviteUrl}`;
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

type SimpleStore = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

function inviteStore(): SimpleStore | null {
  try {
    const g = globalThis as Record<string, unknown>;
    const ls = g.localStorage as SimpleStore | undefined;
    if (ls && typeof ls.getItem === 'function') return ls;
  } catch {
    return null;
  }
  try {
    const g = globalThis as Record<string, unknown>;
    const ss = g.sessionStorage as SimpleStore | undefined;
    if (ss && typeof ss.getItem === 'function') return ss;
  } catch {
    return null;
  }
  return null;
}

export function savePendingInvite(code: string): void {
  const norm = normalizeInviteCode(code);
  if (!norm) return;
  try {
    inviteStore()?.setItem(PENDING_INVITE_KEY, norm);
  } catch {
    /* private mode */
  }
}

export function getPendingInvite(): string | null {
  try {
    return normalizeInviteCode(inviteStore()?.getItem(PENDING_INVITE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    inviteStore()?.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* ignore */
  }
}
