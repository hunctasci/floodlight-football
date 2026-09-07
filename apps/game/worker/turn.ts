/**
 * TURN relay credential plumbing (control plane only).
 *
 * Why this exists: STUN gives server-reflexive pairs, but same-NAT hairpin,
 * mDNS-unresolvable host candidates (cross-browser/VPN/guest-Wi-Fi) and
 * UDP-filtered networks all defeat direct pairs. RFC 8656 TURN relay is the
 * standard answer — not a workaround. Gameplay semantics stay P2P; the relay
 * only forwards encrypted DTLS packets when no direct path exists.
 *
 * Two provisioning modes (env vars, never committed):
 * - Static: TURN_URLS + TURN_USERNAME + TURN_PASSWORD (any TURN service).
 * - REST (coturn `use-auth-secret`): TURN_URLS + TURN_SHARED_SECRET
 *   (+ optional TURN_TTL_SEC, default 3600). The Worker mints time-limited
 *   credentials per RFC 5389 long-term style: username `<expiry>:floodlight`,
 *   password `base64(HMAC-SHA1(secret, username))`.
 *
 * Dependency-free WebCrypto so this runs in Workers AND plain Node tests.
 * Credentials are NEVER logged anywhere in this codebase.
 */

export interface TurnServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const MAX_URL_LEN = 256;

/** Accept only turn:/turns: URLs with an explicit port. */
export function isValidTurnUrl(v: unknown): v is string {
  return typeof v === 'string' && /^(turn|turns):[^/\s]+:\d{1,5}$/i.test(v.trim().slice(0, MAX_URL_LEN + 1));
}

export function normalizeTurnUrl(v: string): string | null {
  const t = v.trim().slice(0, MAX_URL_LEN);
  return isValidTurnUrl(t) ? t : null;
}

/** Parse a comma-separated TURN_URLS env value, dropping garbage. */
export function parseTurnUrls(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const u = normalizeTurnUrl(part);
    if (u && !out.includes(u)) out.push(u);
  }
  return out.slice(0, 4);
}

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  if (typeof btoa !== 'undefined') return btoa(bin);
  // Node fallback (never runs in the Worker).
  const g = globalThis as Record<string, unknown>;
  const buf = g.Buffer as unknown as { from(s: string, e: string): { toString(e: string): string } };
  return buf.from(bin, 'binary').toString('base64');
}

/**
 * Mint time-limited coturn REST credentials. Returns the username/password
 * pair; the caller decides the response shape. Pure except clock + WebCrypto.
 */
export async function mintCoturnCredentials(
  sharedSecret: string,
  ttlSec = 3600,
  nowMs: number = Date.now(),
): Promise<{ username: string; password: string; expiresAt: number }> {
  const expiresAt = Math.floor(nowMs / 1000) + Math.max(60, Math.min(86400, ttlSec));
  const username = `${expiresAt}:floodlight`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sharedSecret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username));
  return { username, password: b64(new Uint8Array(sig)), expiresAt };
}

export interface TurnEnv {
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_PASSWORD?: string;
  TURN_SHARED_SECRET?: string;
  TURN_TTL_SEC?: string;
}

/**
 * Resolve the ICE servers to hand out from env. Static credentials win;
 * otherwise mint REST credentials; otherwise STUN-only (`servers: []`).
 * Returns servers plus a coarse source label (never secrets).
 */
export async function resolveTurnServers(
  env: TurnEnv,
  nowMs: number = Date.now(),
): Promise<{ servers: TurnServer[]; source: 'static' | 'rest' | 'off' }> {
  const urls = parseTurnUrls(env.TURN_URLS);
  if (urls.length === 0) return { servers: [], source: 'off' };
  const username = (env.TURN_USERNAME ?? '').trim().slice(0, 128);
  const password = (env.TURN_PASSWORD ?? '').trim().slice(0, 256);
  if (username && password) {
    return { servers: [{ urls: urls.length === 1 ? urls[0] : urls, username, credential: password }], source: 'static' };
  }
  const secret = (env.TURN_SHARED_SECRET ?? '').trim();
  if (secret) {
    const ttl = Number.parseInt(env.TURN_TTL_SEC ?? '', 10);
    const minted = await mintCoturnCredentials(secret, Number.isFinite(ttl) ? ttl : 3600, nowMs);
    return {
      servers: [{ urls: urls.length === 1 ? urls[0] : urls, username: minted.username, credential: minted.password }],
      source: 'rest',
    };
  }
  return { servers: [], source: 'off' };
}
