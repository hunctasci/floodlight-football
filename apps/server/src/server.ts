import { createServer as createHttp, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { HealthSchema, parseClientMsg, type ClientMsg, type ServerMsg } from '@retro/protocol';
import type { ServerConfig } from './config.js';
import type { Logger } from './log.js';
import { RoomError, RoomManager } from './rooms.js';
import type { RoomStore } from './store.js';

interface Peer {
  ws: WebSocket;
  clientId: string | null;
  room: string | null;
  ip: string;
}

export interface AppHandles {
  http: Server;
  wss: WebSocketServer;
  manager: RoomManager;
  close(): Promise<void>;
}

const text = (res: ServerResponse, code: number, body: string, origin: string) => {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
  });
  res.end(body);
};

export function createApp(
  store: RoomStore,
  config: ServerConfig,
  log: Logger,
  redisUp: () => boolean | Promise<boolean>,
): AppHandles {
  const startedAt = Date.now();
  const manager = new RoomManager(store, { ttlSec: config.roomTtlSec });
  const peers = new Map<WebSocket, Peer>();
  const byClient = new Map<string, WebSocket>();

  const send = (ws: WebSocket, msg: ServerMsg) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const fail = (ws: WebSocket, message: string) => send(ws, { t: 'error', message });

  const http = createHttp(async (req, res) => {
    if (req.method === 'GET' && req.url?.split('?')[0] === '/healthz') {
      const up = await redisUp();
      const body = HealthSchema.parse({
        status: 'ok',
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        redis: up ? 'up' : 'down',
      });
      text(res, 200, JSON.stringify(body), config.clientOrigin);
      return;
    }
    text(res, 404, JSON.stringify({ error: 'not found' }), config.clientOrigin);
  });

  const wss = new WebSocketServer({ server: http, path: '/socket', maxPayload: config.maxPayloadBytes });

  const detach = async (ws: WebSocket, peer: Peer) => {
    peers.delete(ws);
    if (peer.clientId) {
      if (byClient.get(peer.clientId) === ws) byClient.delete(peer.clientId);
      if (peer.room) {
        const other = await leaveRoom(peer.room, peer.clientId);
        if (other) send(other, { t: 'peer-left', clientId: peer.clientId });
      }
    }
  };

  const leaveRoom = async (code: string, clientId: string): Promise<WebSocket | null> => {
    const { emptied } = await manager.leave(code, clientId);
    if (emptied) return null;
    const room = await store.getRoom(code);
    const otherId = room?.members.find((m) => m !== clientId) ?? null;
    return (otherId && byClient.get(otherId)) || null;
  };

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    const peer: Peer = { ws, clientId: null, room: null, ip };
    peers.set(ws, peer);

    ws.on('message', async (raw: RawData) => {
      const parsed = parseClientMsg(raw.toString());
      if (!parsed.ok) { fail(ws, parsed.error); return; }
      const msg = parsed.msg satisfies ClientMsg;
      try {
        if (msg.t === 'ping') {
          if (peer.clientId) await store.heartbeat(peer.clientId, 60);
          send(ws, { t: 'pong' });
          return;
        }
        if (msg.t === 'create-room') {
          if (!(await store.allow(`rl:create:${ip}`, config.createPerMin, 60))) return fail(ws, 'rate limited, slow down');
          const { code, matchToken } = await manager.create(msg.clientId);
          peer.clientId = msg.clientId; peer.room = code;
          byClient.set(msg.clientId, ws);
          await store.heartbeat(msg.clientId, 60);
          send(ws, { t: 'room-created', roomCode: code, matchToken });
          return;
        }
        if (msg.t === 'join-room') {
          if (!(await store.allow(`rl:join:${ip}`, config.joinPerMin, 60))) return fail(ws, 'rate limited, slow down');
          const room = await manager.join(msg.code, msg.clientId);
          peer.clientId = msg.clientId; peer.room = room.code;
          byClient.set(msg.clientId, ws);
          await store.heartbeat(msg.clientId, 60);
          send(ws, { t: 'room-joined', roomCode: room.code, peers: room.members.filter((m) => m !== msg.clientId) });
          for (const m of room.members) {
            if (m !== msg.clientId) {
              const s = byClient.get(m);
              if (s) send(s, { t: 'peer-joined', clientId: msg.clientId });
            }
          }
          return;
        }
        if (msg.t === 'leave-room') {
          if (peer.clientId && peer.room) {
            const other = await leaveRoom(peer.room, peer.clientId);
            if (other) send(other, { t: 'peer-left', clientId: peer.clientId });
            peer.room = null;
          }
          return;
        }
        if (msg.t === 'signal') {
          if (!(await store.allow(`rl:signal:${ip}`, config.signalPerMin, 60))) return fail(ws, 'rate limited, slow down');
          if (!peer.clientId || !peer.room) return fail(ws, 'join a room first');
          const room = await store.getRoom(peer.room);
          if (!room || !room.members.includes(msg.to)) return fail(ws, 'peer offline');
          const target = byClient.get(msg.to);
          if (!target) return fail(ws, 'peer offline');
          send(target, { t: 'signaled', from: peer.clientId, payload: msg.payload });
          return;
        }
      } catch (e) {
        if (e instanceof RoomError) {
          fail(ws, e.code === 'NOT_FOUND' ? 'room not found or expired' : e.code === 'FULL' ? 'room is full' : e.message);
        } else {
          log.error({ err: e }, 'message handler failed');
          fail(ws, 'internal error');
        }
      }
    });

    ws.on('close', () => { void detach(ws, peer); });
    ws.on('error', () => { /* close follows; nothing to do */ });
  });

  return {
    http,
    wss,
    manager,
    close: () => new Promise<void>((resolve, reject) => {
      for (const ws of peers.keys()) { try { ws.terminate(); } catch { /* already gone */ } }
      peers.clear(); byClient.clear();
      wss.close((e) => {
        if (e) { reject(e); return; }
        http.close((e2) => (e2 ? reject(e2) : resolve()));
      });
    }),
  };
}
