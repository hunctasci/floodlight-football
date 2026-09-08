/**
 * Floodlight Football — Cloudflare control plane (production backend).
 *
 * - Serves the built Vite game via Workers Static Assets (same origin).
 * - POST /api/rooms            → create a 2-player room (code + matchToken).
 * - GET  /api/rooms/:code/socket → WebSocket signaling relayed by the room's
 *   Durable Object (SDP offer/answer + trickle ICE + presence).
 * - GET  /api/health (alias /healthz) → minimal liveness probe.
 * - POST /api/profile          → lazy guest profile upsert (City League).
 * - GET  /api/city-league      → weekly standings (confirmed cross-city).
 * - POST /api/city-league/matches → issue a league matchId + token.
 * - POST /api/matches/:id/result → dual-submit final score (ADR-004).
 *
 * Country matches relay binary packets through their reserved Room object.
 * Friend matches keep WebRTC P2P gameplay (see apps/game/src/net/).
 * The Node backend in apps/server remains as the self-hosted reference.
 */

import { RoomDurableObject } from './room';
import { CLIENT_ID_RE, ROOM_CODE_RE, createRateLimiter, makeMatchToken, makeRoomCode } from './room-logic';
import { resolveTurnServers } from './turn';
import { D1CityLeagueStore } from './city-league/d1-store';
import { CityLeagueError, CityLeagueService } from './city-league/service';
import { MemoryCityLeagueStore } from './city-league/store';

export { RoomDurableObject };
export { Matchmaker } from './matchmaker';

interface Env {
  ROOMS: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  DB?: D1Database;
  ASSETS?: Fetcher;
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_PASSWORD?: string;
  TURN_SHARED_SECRET?: string;
  TURN_TTL_SEC?: string;
}

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const getIp = (req: Request): string =>
  req.headers.get('CF-Connecting-IP')?.trim() ||
  req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
  'unknown';

/** Best-effort per-isolate limiter (shared with room-logic, tested). */
const limiter = createRateLimiter();

/** Per-isolate fallback when D1 is not bound (local dev without `wrangler d1`). */
let memoryFallback: MemoryCityLeagueStore | null = null;

function cityService(env: Env): CityLeagueService {
  const db = (env as unknown as Record<string, unknown>).DB as
    | import('./city-league/d1-store').D1Like
    | undefined;
  if (db && typeof (db as { prepare?: unknown }).prepare === 'function') {
    return new CityLeagueService(new D1CityLeagueStore(db));
  }
  if (!memoryFallback) memoryFallback = new MemoryCityLeagueStore();
  return new CityLeagueService(memoryFallback);
}

function cityError(e: unknown): Response {
  if (e instanceof CityLeagueError) {
    const status = e.code === 'NOT_FOUND' ? 404 : e.code === 'LOCKED' ? 423 : e.code === 'FORBIDDEN' ? 403 : 400;
    return json({ error: e.message.toLowerCase() }, status);
  }
  return json({ error: 'server error' }, 500);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && (path === '/api/health' || path === '/healthz')) {
      return json({ status: 'ok', service: 'floodlight' });
    }

    // TURN relay credentials for networks where direct pairs fail (NAT
    // hairpin, mDNS-unresolvable hosts, UDP-filtered Wi-Fi). Rate-limited
    // like room creation; credentials are short-lived when minted via REST.
    // Unconfigured deployments answer `{iceServers: []}` (STUN-only).
    if (request.method === 'GET' && path === '/api/turn') {
      const ip = getIp(request);
      if (!limiter.allow(`turn:${ip}`, 30, 60)) return json({ error: 'rate limited, slow down' }, 429);
      const { servers } = await resolveTurnServers(env);
      return json({ iceServers: servers });
    }

    if (request.method === 'POST' && ['/api/matchmaking/join', '/api/matchmaking/poll', '/api/matchmaking/cancel'].includes(path)) {
      const ip = getIp(request);
      const action = path.split('/').pop()!;
      if (!limiter.allow(`queue:${action}:${ip}`, action === 'join' ? 20 : 120, 60)) return json({ error: 'Too many requests. Try again shortly.' }, 429);
      const body = await readJson(request);
      if (!body) return json({ error: 'Invalid request' }, 400);
      let payload: Record<string, unknown> = body;
      if (action === 'join') {
        if (!env.DB) return json({ error: 'Matchmaking unavailable' }, 503);
        if (typeof body.clientId !== 'string' || !CLIENT_ID_RE.test(body.clientId) || typeof body.peerId !== 'string' || !CLIENT_ID_RE.test(body.peerId)) return json({ error: 'Invalid player' }, 400);
        const player = await env.DB.prepare('SELECT city_code FROM players WHERE client_id = ?').bind(body.clientId).first<{ city_code: string }>();
        if (!player) return json({ error: 'Choose your country first' }, 400);
        payload = { clientId: body.clientId, peerId: body.peerId, countryCode: player.city_code };
      } else if (typeof body.ticket !== 'string' || !/^[a-f0-9]{64}$/.test(body.ticket)) return json({ error: 'Invalid search ticket' }, 400);
      return env.MATCHMAKER.get(env.MATCHMAKER.idFromName('world-v1')).fetch(`https://queue/${action}`, { method: 'POST', body: JSON.stringify(payload) });
    }

    if (request.method === 'POST' && path === '/api/rooms') {
      const ip = getIp(request);
      if (!limiter.allow(`create:${ip}`, 10, 60)) return json({ error: 'rate limited, slow down' }, 429);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid body' }, 400);
      }
      const clientId = (body as Record<string, unknown>)?.clientId;
      if (typeof clientId !== 'string' || !CLIENT_ID_RE.test(clientId)) {
        return json({ error: 'invalid body' }, 400);
      }
      // Allocate a collision-resistant code, then init its Durable Object.
      for (let i = 0; i < 5; i++) {
        const code = makeRoomCode();
        const matchToken = makeMatchToken();
        const id = env.ROOMS.idFromName(code);
        const stub = env.ROOMS.get(id);
        const init = await stub.fetch(
          new Request('https://room/init', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code, hostId: clientId, matchToken }),
          }),
        );
        if (init.status === 409) continue; // collision: retry with a fresh code
        if (!init.ok) return json({ error: 'could not create room' }, 503);
        return json({ roomCode: code, matchToken }, 201);
      }
      return json({ error: 'could not allocate a room code' }, 503);
    }

    const socketMatch = path.match(/^\/api\/rooms\/([A-Za-z0-9]{6})\/socket$/);
    if (socketMatch) {
      const code = socketMatch[1].toUpperCase();
      if (!ROOM_CODE_RE.test(code)) return json({ error: 'invalid code' }, 400);
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ error: 'expected websocket' }, 426);
      }
      const clientId = url.searchParams.get('clientId') ?? '';
      if (!CLIENT_ID_RE.test(clientId)) return json({ error: 'invalid client' }, 400);
      const ip = getIp(request);
      if (!limiter.allow(`join:${ip}`, 30, 60)) return json({ error: 'rate limited, slow down' }, 429);
      // Never derive a DO id from raw user input beyond the validated code:
      // idFromName(code) scopes exactly one room per code, no global relay.
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(request);
    }

    // ---- City League meta layer (D1; never touches simulation/lockstep) ----
    if (request.method === 'POST' && path === '/api/profile') {
      const ip = getIp(request);
      if (!limiter.allow(`profile:${ip}`, 30, 60)) return json({ error: 'rate limited, slow down' }, 429);
      const body = await readJson(request);
      if (!body) return json({ error: 'invalid body' }, 400);
      try {
        const out = await cityService(env).upsertProfile({
          clientId: String(body.clientId ?? ''),
          displayName: String(body.displayName ?? ''),
          cityCode: String(body.cityCode ?? ''),
        });
        return json(out, 200);
      } catch (e) {
        return cityError(e);
      }
    }

    if (request.method === 'GET' && (path === '/api/country-league' || path === '/api/city-league')) {
      const ip = getIp(request);
      if (!limiter.allow(`table:${ip}`, 60, 60)) return json({ error: 'rate limited, slow down' }, 429);
      try {
        return json(await cityService(env).getTable(), 200);
      } catch {
        return json({ error: 'server error' }, 500);
      }
    }

    if (request.method === 'POST' && (path === '/api/country-league/matches' || path === '/api/city-league/matches')) {
      const ip = getIp(request);
      if (!limiter.allow(`cl-create:${ip}`, 20, 60)) return json({ error: 'rate limited, slow down' }, 429);
      const body = await readJson(request);
      if (!body) return json({ error: 'invalid body' }, 400);
      try {
        const out = await cityService(env).createMatch({
          roomCode: String(body.roomCode ?? ''),
          homeClientId: String(body.homeClientId ?? ''),
          awayClientId: String(body.awayClientId ?? ''),
          homeCityCode: String(body.homeCityCode ?? ''),
          awayCityCode: String(body.awayCityCode ?? ''),
        });
        return json(out, 201);
      } catch (e) {
        return cityError(e);
      }
    }

    const botResult = path.match(/^\/api\/bot-matches\/([a-f0-9-]{36})\/result$/);
    if (request.method === 'POST' && botResult) {
      if (!limiter.allow(`bot-result:${getIp(request)}`, 5, 60)) return json({ error: 'Please try again shortly' },429);
      const raw = await request.text();
      if (raw.length > 300000) return json({ error:'Replay too large' },413);
      let body: Record<string, unknown>;
      try { body = JSON.parse(raw); } catch { return json({ error:'Invalid replay' },400); }
      if (!body || typeof body.clientId !== 'string' || typeof body.matchToken !== 'string' || typeof body.replay !== 'string') return json({ error:'Invalid replay' },400);
      return env.MATCHMAKER.get(env.MATCHMAKER.idFromName('world-v1')).fetch('https://queue/bot-result', { method:'POST',body:JSON.stringify({ ...body,matchId:botResult[1] }) });
    }

    const resultMatch = path.match(/^\/api\/matches\/([A-Za-z0-9-]{1,64})\/result$/);
    if (request.method === 'POST' && resultMatch) {
      const ip = getIp(request);
      if (!limiter.allow(`cl-result:${ip}`, 30, 60)) return json({ error: 'rate limited, slow down' }, 429);
      const body = await readJson(request);
      if (!body) return json({ error: 'invalid body' }, 400);
      if (env.DB && await env.DB.prepare('SELECT match_id FROM bot_matches WHERE match_id=?').bind(resultMatch[1]).first()) return json({ error:'Computer matches require a verified replay' },403);
      try {
        const out = await cityService(env).submitResult(resultMatch[1], {
          clientId: String(body.clientId ?? ''),
          matchToken: String(body.matchToken ?? ''),
          homeScore: (body.homeScore as number) ?? -1,
          awayScore: (body.awayScore as number) ?? -1,
        });
        return json(out, 200);
      } catch (e) {
        return cityError(e);
      }
    }

    // Unknown /api route: JSON 404 (never leak internals).
    if (path.startsWith('/api/')) return json({ error: 'not found' }, 404);

    // Static game shell: prefer the assets binding when present (vite plugin
    // serves dist/ automatically in production; this covers wrangler dev).
    if (env.ASSETS) {
      try {
        return await env.ASSETS.fetch(request);
      } catch {
        return json({ error: 'not found' }, 404);
      }
    }
    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
