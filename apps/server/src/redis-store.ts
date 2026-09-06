import { createClient, type RedisClientType } from 'redis';
import type { JoinResult, RoomRecord, RoomStore } from './store.js';

const ROOM = (code: string) => `room:${code}`;
const RL = (key: string) => `rl:${key}`;
const PRES = (id: string) => `presence:${id}`;

/** Redis-backed store for production: TTL expiry, atomic joins, sliding windows. */
export class RedisStore implements RoomStore {
  private client: RedisClientType;
  private ready: Promise<void>;

  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', () => { /* surfaced via health check, not thrown */ });
    this.ready = this.client.connect().then(() => undefined);
  }

  async ping(): Promise<boolean> {
    try { await this.ready; return (await this.client.ping()) === 'PONG'; }
    catch { return false; }
  }

  async disconnect(): Promise<void> {
    try { await this.client.quit(); } catch { /* already gone */ }
  }

  async createRoom(rec: RoomRecord, ttlSec: number): Promise<boolean> {
    await this.ready;
    const r = await this.client.set(ROOM(rec.code), JSON.stringify(rec), { NX: true, EX: ttlSec });
    return r === 'OK';
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    await this.ready;
    const raw = await this.client.get(ROOM(code));
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as RoomRecord;
      if (typeof v.code !== 'string' || !Array.isArray(v.members)) return null;
      return v;
    } catch { return null; }
  }

  // Atomic check-and-add: concurrent joins can never overfill a room.
  private static readonly JOIN_LUA = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 'missing' end
    local rec = cjson.decode(raw)
    for _, m in ipairs(rec.members) do
      if m == ARGV[1] then return cjson.encode(rec) end
    end
    if #rec.members >= tonumber(ARGV[2]) then return 'full' end
    rec.members[#rec.members + 1] = ARGV[1]
    redis.call('SET', KEYS[1], cjson.encode(rec), 'KEEPTTL')
    return cjson.encode(rec)`;

  async addMember(code: string, clientId: string, max: number): Promise<JoinResult> {
    await this.ready;
    const out = (await this.client.eval(RedisStore.JOIN_LUA, {
      keys: [ROOM(code)],
      arguments: [clientId, String(max)],
    })) as string;
    if (out === 'missing') return { status: 'missing' };
    if (out === 'full') return { status: 'full' };
    return { status: 'ok', room: JSON.parse(out) as RoomRecord };
  }

  async removeMember(code: string, clientId: string): Promise<{ room: RoomRecord | null; emptied: boolean }> {
    await this.ready;
    const cur = await this.getRoom(code);
    if (!cur) return { room: null, emptied: true };
    const members = cur.members.filter((m) => m !== clientId);
    if (members.length === 0) {
      await this.client.del(ROOM(code));
      return { room: null, emptied: true };
    }
    const next = { ...cur, members };
    await this.client.set(ROOM(code), JSON.stringify(next), { KEEPTTL: true });
    return { room: next, emptied: false };
  }

  async heartbeat(clientId: string, ttlSec: number): Promise<void> {
    await this.ready;
    await this.client.set(PRES(clientId), '1', { EX: ttlSec });
  }

  // Sliding window: ZADD now, evict stale, count, expire — one round trip.
  async allow(key: string, limit: number, windowSec: number): Promise<boolean> {
    await this.ready;
    const nowMs = Date.now();
    const k = RL(key);
    const multi = this.client.multi();
    multi.zAdd(k, { score: nowMs, value: `${nowMs}:${Math.random().toString(36).slice(2)}` });
    multi.zRemRangeByScore(k, 0, nowMs - windowSec * 1000);
    multi.zCard(k);
    multi.expire(k, windowSec + 1);
    const res = await multi.exec();
    const count = (res?.[2] as number) ?? limit + 1;
    return count <= limit;
  }
}
