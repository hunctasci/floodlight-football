/**
 * Floodlight Football — Cloudflare control plane (production backend).
 *
 * - Serves the built Vite game via Workers Static Assets (same origin).
 * - POST /api/rooms            → create a 2-player room (code + matchToken).
 * - GET  /api/rooms/:code/socket → WebSocket signaling relayed by the room's
 *   Durable Object (SDP offer/answer + trickle ICE + presence).
 * - GET  /api/health (alias /healthz) → minimal liveness probe.
 *
 * Gameplay never touches this Worker: post-handshake InputFrames stay
 * WebRTC P2P (see apps/game/src/net/). Solo needs no backend at all.
 * The Node backend in apps/server remains as the self-hosted reference.
 */

import { RoomDurableObject } from './room';
import { CLIENT_ID_RE, ROOM_CODE_RE, createRateLimiter, makeMatchToken, makeRoomCode } from './room-logic';

export { RoomDurableObject };

interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS?: Fetcher;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && (path === '/api/health' || path === '/healthz')) {
      return json({ status: 'ok', service: 'floodlight' });
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
