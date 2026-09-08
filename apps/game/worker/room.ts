import { DurableObject } from 'cloudflare:workers';
import {
  CLIENT_ID_RE,
  ROOM_TTL_SEC,
  addMember,
  authorizeRelay,
  isExpired,
  isValidClientId,
  isValidSignalPayload,
  parseInbound,
  peersOf,
  type RoomAttachment,
} from './room-logic';

interface Env {
  ROOMS: DurableObjectNamespace;
}

interface RoomRow {
  code: string;
  match_token: string;
  created_at: number;
  expires_at: number;
}

const err = (message: string): string => JSON.stringify({ t: 'error', message });

/**
 * One instance per multiplayer room (idFromName(roomCode)).
 *
 * Control plane only: relays SDP offer/answer, trickle ICE candidates and
 * presence between at most two peers. Reserved country rooms also relay
 * binary game packets; friend-room gameplay stays WebRTC P2P.
 *
 * Hibernation-safe: per-socket identity lives in WS attachments
 * (serializeAttachment/deserializeAttachment); room lifecycle lives in SQLite;
 * in-memory maps are rebuilt from attachments in the constructor.
 */
export class RoomDurableObject extends DurableObject<Env> {
  private sessions = new Map<WebSocket, RoomAttachment>();
  private relayRates = new Map<WebSocket, { second: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rebuild volatile session index from hibernated attachments.
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as RoomAttachment | null;
        if (att && typeof att.peerId === 'string') this.sessions.set(ws, att);
      } catch {
        /* corrupt attachment: socket will re-identify on next message */
      }
    }
  }

  private ensureTables(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS room (
        code TEXT PRIMARY KEY,
        match_token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS members (
        client_id TEXT PRIMARY KEY,
        joined_at INTEGER NOT NULL
      );`,
    );
  }

  private getRoom(): RoomRow | null {
    try {
      const row = this.ctx.storage.sql
        .exec(`SELECT code, match_token, created_at, expires_at FROM room LIMIT 1;`)
        .toArray()[0] as unknown as RoomRow | undefined;
      return row ?? null;
    } catch {
      return null;
    }
  }

  private listMembers(): string[] {
    try {
      const rows = this.ctx.storage.sql
        .exec(`SELECT client_id FROM members ORDER BY joined_at ASC;`)
        .toArray() as unknown as Array<{ client_id: string }>;
      return rows.map((r) => r.client_id);
    } catch {
      return [];
    }
  }

  private socketFor(clientId: string): WebSocket | null {
    for (const [ws, att] of this.sessions) {
      if (att.peerId === clientId) return ws;
    }
    // Fall back to hibernated sockets not yet re-indexed.
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as RoomAttachment | null;
        if (att?.peerId === clientId) {
          this.sessions.set(ws, att);
          return ws;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  private send(ws: WebSocket, text: string): void {
    try {
      ws.send(text);
    } catch {
      /* peer gone; close handler cleans up */
    }
  }

  /**
   * Reject a socket upgrade with a client-readable error instead of a bare
   * HTTP status: accept the WebSocket, deliver {t:'error'}, then close. The
   * browser client surfaces the message (ROOM IS FULL / expired invite)
   * instead of a generic upgrade failure. No membership side effects.
   */
  private rejectSocket(message: string, code: number): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.send(server, JSON.stringify({ t: 'error', message }));
    try {
      server.close(code, message);
    } catch {
      /* already gone */
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  private broadcastExcept(exceptPeerId: string, text: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      let att: RoomAttachment | null = this.sessions.get(ws) ?? null;
      if (!att) {
        try {
          att = ws.deserializeAttachment() as RoomAttachment | null;
          if (att) this.sessions.set(ws, att);
        } catch {
          continue;
        }
      }
      if (att && att.peerId !== exceptPeerId) this.send(ws, text);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    this.ensureTables();
    const url = new URL(request.url);

    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS allowed_peers (peer TEXT PRIMARY KEY)');

    // Internal init from the public Worker (POST /init {code, hostId, matchToken}).
    if (request.method === 'POST' && url.pathname.endsWith('/init')) {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return new Response(err('invalid message'), { status: 400 });
      }
      const code = body.code;
      const hostId = body.hostId;
      const matchToken = body.matchToken;
      if (typeof code !== 'string' || !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
        return new Response(err('invalid message'), { status: 400 });
      }
      if (!isValidClientId(hostId) || typeof matchToken !== 'string' || matchToken.length < 16) {
        return new Response(err('invalid message'), { status: 400 });
      }
      if (this.getRoom()) return new Response(err('room exists'), { status: 409 });
      if (Array.isArray(body.allowedPeers)) {
        if (body.allowedPeers.length !== 2 || !body.allowedPeers.every(isValidClientId) || !body.allowedPeers.includes(hostId)) return new Response(err('invalid roster'), { status: 400 });
        for (const peer of body.allowedPeers) this.ctx.storage.sql.exec('INSERT INTO allowed_peers(peer) VALUES (?)', peer as string);
      }
      const now = Date.now();
      const expiresAt = now + ROOM_TTL_SEC * 1000;
      this.ctx.storage.sql.exec(
        `INSERT INTO room (code, match_token, created_at, expires_at) VALUES (?, ?, ?, ?);`,
        code,
        matchToken as string,
        now,
        expiresAt,
      );
      this.ctx.storage.sql.exec(`INSERT OR IGNORE INTO members (client_id, joined_at) VALUES (?, ?);`, hostId, now);
      try {
        await this.ctx.storage.setAlarm(expiresAt);
      } catch {
        /* alarms unavailable in some local runtimes; lazy expiry still applies */
      }
      return Response.json({ ok: true, code, expiresAt });
    }

    // Public signaling socket (forwarded by the Worker after code validation).
    if (url.pathname.endsWith('/socket')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response(err('expected websocket'), { status: 426 });
      }
      const clientId = url.searchParams.get('clientId') ?? '';
      if (!CLIENT_ID_RE.test(clientId)) {
        return new Response(err('invalid message'), { status: 400 });
      }
      const room = this.getRoom();
      if (!room) return this.rejectSocket('room not found or expired', 4404);
      const now = Date.now();
      if (isExpired(room.expires_at, now)) {
        await this.destroyRoom();
        return this.rejectSocket('room not found or expired', 4404);
      }
      const allowed = this.ctx.storage.sql.exec('SELECT peer FROM allowed_peers').toArray();
      if (allowed.length && !allowed.some((row) => row.peer === clientId)) return this.rejectSocket('This match belongs to two other players', 4403);
      const members = this.listMembers();
      const added = addMember(members, clientId);
      if (!added.ok) {
        return this.rejectSocket('room is full', 4409);
      }
      const isRejoin = members.includes(clientId);
      if (!isRejoin) {
        this.ctx.storage.sql.exec(`INSERT INTO members (client_id, joined_at) VALUES (?, ?);`, clientId, now);
      }
      const freshMembers = this.listMembers();
      const role: RoomAttachment['role'] = freshMembers[0] === clientId ? 'host' : 'guest';

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const attachment: RoomAttachment = { peerId: clientId, role, joinedAt: now, relayed: allowed.length === 2 };
      server.serializeAttachment(attachment);
      this.sessions.set(server, attachment);

      // Tell the newcomer who is here (same shapes as the Node reference).
      this.send(
        server,
        JSON.stringify({
          t: 'room-joined',
          roomCode: room.code,
          peers: peersOf(freshMembers, clientId),
          matchToken: room.match_token,
        }),
      );
      // Tell the existing peer someone arrived.
      this.broadcastExcept(clientId, JSON.stringify({ t: 'peer-joined', clientId }));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response(err('not found'), { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.ensureTables();
    let att = this.sessions.get(ws) ?? null;
    if (!att) {
      try {
        att = ws.deserializeAttachment() as RoomAttachment | null;
        if (att) this.sessions.set(ws, att);
      } catch {
        att = null;
      }
    }
    if (!att?.peerId) {
      this.send(ws, err('join a room first'));
      return;
    }
    const selfId = att.peerId;


    // Lazy expiry: never resurrect a stale room.
    const room = this.getRoom();
    if (!room || isExpired(room.expires_at)) {
      if (!room) {
        // No metadata (already cleaned): just drop the socket.
      } else {
        await this.destroyRoom();
      }
      this.send(ws, err('room not found or expired'));
      try {
        ws.close(4401, 'room expired');
      } catch {
        /* already gone */
      }
      return;
    }

    if (message instanceof ArrayBuffer) {
      // Binary gameplay is only admitted in private matchmaking rooms.
      if (!att.relayed || message.byteLength > 65536) { ws.close(4400, 'invalid gameplay packet'); return; }
      const second = Math.floor(Date.now() / 1000);
      const rate = this.relayRates.get(ws);
      const next = rate?.second === second ? { second, count: rate.count + 1 } : { second, count: 1 };
      this.relayRates.set(ws, next);
      if (next.count > 240) { ws.close(4429, 'too many gameplay packets'); return; }
      for (const [other, otherAtt] of this.sessions) {
        if (otherAtt.peerId !== selfId && otherAtt.relayed) {
          try { other.send(message); } catch { /* Peer's close event handles removal. */ }
        }
      }
      return;
    }

    const parsed = parseInbound(message as string);
    if (parsed.kind === 'ping') {
      this.send(ws, JSON.stringify({ t: 'pong' }));
      return;
    }
    if (parsed.kind === 'leave-room') {
      await this.removePeer(ws, selfId);
      return;
    }
    if (parsed.kind === 'join-room') {
      // Idempotent re-assertion (e.g. legacy clients that send join-room
      // after the upgrade). Must match the attached identity + room.
      if (parsed.clientId !== selfId || parsed.code !== room.code) {
        this.send(ws, err('join a room first'));
        return;
      }
      this.send(
        ws,
        JSON.stringify({
          t: 'room-joined',
          roomCode: room.code,
          peers: peersOf(this.listMembers(), selfId),
          matchToken: room.match_token,
        }),
      );
      return;
    }
    if (parsed.kind === 'signal') {
      const members = this.listMembers();
      const authErr = authorizeRelay(members, selfId, parsed.to!);
      if (authErr) {
        this.send(ws, err(authErr));
        return;
      }
      const target = this.socketFor(parsed.to!);
      if (!target) {
        this.send(ws, err('peer offline'));
        return;
      }
      if (!isValidSignalPayload(parsed.payload)) {
        this.send(ws, err('invalid message'));
        return;
      }
      this.send(target, JSON.stringify({ t: 'signaled', from: selfId, payload: parsed.payload }));
      return;
    }
    // 'invalid' | 'unknown'
    this.send(ws, err(parsed.error ?? 'invalid message'));
  }

  override async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const att = this.sessions.get(ws) ?? (() => {
      try {
        return ws.deserializeAttachment() as RoomAttachment | null;
      } catch {
        return null;
      }
    })();
    this.sessions.delete(ws);
    this.relayRates.delete(ws);
    if (att?.peerId) await this.removePeer(ws, att.peerId);
  }

  override async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const att = this.sessions.get(ws) ?? null;
    this.sessions.delete(ws);
    this.relayRates.delete(ws);
    if (att?.peerId) await this.removePeer(ws, att.peerId);
  }

  override async alarm(): Promise<void> {
    await this.destroyRoom();
  }

  /**
   * True when another live socket still carries this peer identity (reconnect
   * race: old socket closed after the new one opened). Membership must survive
   * until the LAST socket for that peer goes away.
   */
  private hasLiveSocketFor(clientId: string): boolean {
    for (const ws of this.ctx.getWebSockets()) {
      const att = this.sessions.get(ws) ?? (() => {
        try {
          return ws.deserializeAttachment() as RoomAttachment | null;
        } catch {
          return null;
        }
      })();
      if (att?.peerId === clientId) return true;
    }
    return false;
  }

  private async removePeer(_ws: WebSocket, clientId: string): Promise<void> {
    this.ensureTables();
    // Reconnect race: a fresh socket for the same peer may already exist
    // (duplicate join before the old close fired). Keep the member and do
    // NOT broadcast peer-left while any live socket remains.
    if (this.hasLiveSocketFor(clientId)) return;
    try {
      this.ctx.storage.sql.exec(`DELETE FROM members WHERE client_id = ?;`, clientId);
    } catch {
      /* best-effort */
    }
    const remaining = this.listMembers();
    if (remaining.length === 0) {
      await this.destroyRoom();
      return;
    }
    this.broadcastExcept(clientId, JSON.stringify({ t: 'peer-left', clientId }));
  }

  private async destroyRoom(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4401, 'room closed');
      } catch {
        /* already gone */
      }
    }
    this.sessions.clear();
    try {
      this.ctx.storage.sql.exec(`DELETE FROM members;`);
    } catch {
      /* nothing stored */
    }
    try {
      this.ctx.storage.sql.exec(`DELETE FROM room;`);
    } catch {
      /* nothing stored */
    }
    try {
      await this.ctx.storage.deleteAlarm();
    } catch {
      /* no alarm */
    }
    try {
      await this.ctx.storage.deleteAll();
    } catch {
      /* local runtime may not support it */
    }
  }
}
