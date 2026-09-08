import { BotLeagueService, BOT_WAIT_MS } from './city-league/bots';
import { CityLeagueError } from './city-league/service';
import { DurableObject } from 'cloudflare:workers';
import { makeMatchToken, makeRoomCode } from './room-logic';

interface Env { ROOMS: DurableObjectNamespace; DB: D1Database }
interface Ticket {
  ticket: string; client: string; peer: string; country: string;
  joined: number; expires: number; state: string; opponent: string | null; assignment: string | null;
}
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });

/** A single durable queue pairs different countries. Synchronous SQLite
 * reservations happen before room creation yields, preventing double pairing.
 * Only the Worker can call this object's internal routes. */
export class Matchmaker extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS tickets (
      ticket TEXT PRIMARY KEY, client TEXT UNIQUE, peer TEXT NOT NULL,
      country TEXT NOT NULL, joined INTEGER NOT NULL, expires INTEGER NOT NULL,
      state TEXT NOT NULL, opponent TEXT, assignment TEXT
    )`);
  }
  private get(ticket: string): Ticket | undefined {
    return this.ctx.storage.sql.exec('SELECT * FROM tickets WHERE ticket = ?', ticket).toArray()[0] as unknown as Ticket | undefined;
  }
  private expire() {
    const sql = this.ctx.storage.sql, now = Date.now();
    sql.exec(`UPDATE tickets SET state = 'cancelled' WHERE opponent IN (SELECT ticket FROM tickets WHERE expires < ? AND state IN ('queued','reserving'))`, now);
    sql.exec('DELETE FROM tickets WHERE expires < ?', now);
  }
  private status(row: Ticket) {
    const count = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM tickets WHERE state = 'queued'").one().n;
    return reply({ ticket: row.ticket, status: row.state === 'reserving' ? 'queued' : row.state,
      waiting: count, ...(row.assignment ? JSON.parse(row.assignment) : {}) });
  }
  override async fetch(request: Request): Promise<Response> {
    this.expire();
    const path = new URL(request.url).pathname;
    if (path === '/bot-result') {
      const body = await request.json() as { matchId: string; clientId: string; matchToken: string; replay: string };
      try { return reply(await new BotLeagueService(this.env.DB).finish(body.matchId,body.clientId,body.matchToken,body.replay)); }
      catch (e) { return reply({ error: e instanceof Error ? e.message : 'Result unavailable' }, e instanceof CityLeagueError && e.code === 'FORBIDDEN' ? 403 : 400); }
    }
    if (path === '/join') {
      const { clientId, peerId, countryCode } = await request.json() as { clientId: string; peerId: string; countryCode: string };
      const sql = this.ctx.storage.sql, now = Date.now();
      const existing = sql.exec('SELECT * FROM tickets WHERE client = ?', clientId).toArray()[0] as unknown as Ticket | undefined;
      if (existing && existing.state !== 'cancelled') return reply({ error: 'You are already searching in another tab. Cancel there or try again shortly.' }, 409);
      if (existing) sql.exec('DELETE FROM tickets WHERE ticket = ?', existing.ticket);
      const ticket = makeMatchToken();
      sql.exec("INSERT INTO tickets(ticket,client,peer,country,joined,expires,state) VALUES (?,?,?,?,?,?,'queued')", ticket, clientId, peerId, countryCode, now, now + 20000);
      const opponent = sql.exec("SELECT * FROM tickets WHERE state = 'queued' AND country != ? AND client != ? ORDER BY joined, ticket LIMIT 1", countryCode, clientId).toArray()[0] as unknown as Ticket | undefined;
      if (!opponent) return this.status(this.get(ticket)!);
      // Reserve both synchronously before the cross-object request.
      sql.exec("UPDATE tickets SET state = 'reserving', opponent = ?, expires = ? WHERE ticket = ?", opponent.ticket, now + 90000, ticket);
      sql.exec("UPDATE tickets SET state = 'reserving', opponent = ?, expires = ? WHERE ticket = ?", ticket, now + 90000, opponent.ticket);
      try {
        let roomCode = '', initialized = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          roomCode = makeRoomCode();
          const room = this.env.ROOMS.get(this.env.ROOMS.idFromName(roomCode));
          const result = await room.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code: roomCode, hostId: opponent.peer, matchToken: makeMatchToken(), allowedPeers: [opponent.peer, peerId] }) });
          if (result.ok) { initialized = true; break; }
          if (result.status !== 409) throw new Error('Room unavailable');
        }
        if (!initialized) throw new Error('Room unavailable');
        if (this.get(ticket)?.state !== 'reserving' || this.get(opponent.ticket)?.state !== 'reserving') throw new Error('Search cancelled');
        sql.exec("UPDATE tickets SET state='matched', assignment=? WHERE ticket=?", JSON.stringify({ roomCode, role: 'host', peerId: opponent.peer, opponentCountry: countryCode }), opponent.ticket);
        sql.exec("UPDATE tickets SET state='matched', assignment=? WHERE ticket=?", JSON.stringify({ roomCode, role: 'guest', peerId, opponentCountry: opponent.country }), ticket);
        return this.status(this.get(ticket)!);
      } catch {
        sql.exec("UPDATE tickets SET state='cancelled' WHERE ticket IN (?,?)", ticket, opponent.ticket);
        return reply({ error: 'Could not start this match. Please search again.' }, 503);
      }
    }
    const { ticket } = await request.json() as { ticket: string };
    const row = this.get(ticket);
    if (!row) return reply({ status: 'expired' });
    if (path === '/cancel') {
      this.ctx.storage.sql.exec("UPDATE tickets SET state='cancelled', assignment=NULL WHERE ticket IN (?,?)", ticket, row.opponent);
      return reply({ status: 'cancelled' });
    }
    if (row.state === 'queued' && Date.now() - row.joined >= BOT_WAIT_MS) {
      // Reserve before awaiting D1: a late human cannot also claim this player.
      this.ctx.storage.sql.exec("UPDATE tickets SET state='reserving', expires=? WHERE ticket=?", Date.now()+90000, ticket);
      try {
        const bot = await new BotLeagueService(this.env.DB).create(row.client,row.country);
        if (this.get(ticket)?.state !== 'reserving') return reply({ status: 'cancelled' });
        this.ctx.storage.sql.exec("UPDATE tickets SET state='matched',assignment=? WHERE ticket=?", JSON.stringify({ kind:'bot',bot }),ticket);
        return this.status(this.get(ticket)!);
      } catch {
        this.ctx.storage.sql.exec("UPDATE tickets SET state='cancelled' WHERE ticket=?",ticket);
        return reply({ error:'Could not prepare your opponent. Please try again.' },503);
      }
    }
    if (row.state === 'queued') this.ctx.storage.sql.exec('UPDATE tickets SET expires=? WHERE ticket=?', Date.now() + 20000, ticket);
    return this.status(row);
  }
}
