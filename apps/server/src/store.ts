/** Ephemeral room state. Postgres (F4b) owns leagues/results; rooms never touch disk. */
export interface RoomRecord {
  code: string;
  members: string[];
  matchToken: string;
  createdAt: number;
}

export type JoinResult =
  | { status: 'ok'; room: RoomRecord }
  | { status: 'missing' }
  | { status: 'full' };

export interface RoomStore {
  /** Insert only if absent (code collision guard). */
  createRoom(rec: RoomRecord, ttlSec: number): Promise<boolean>;
  getRoom(code: string): Promise<RoomRecord | null>;
  addMember(code: string, clientId: string, max: number): Promise<JoinResult>;
  removeMember(code: string, clientId: string): Promise<{ room: RoomRecord | null; emptied: boolean }>;
  /** Presence heartbeat for future matchmaking; best-effort. */
  heartbeat(clientId: string, ttlSec: number): Promise<void>;
  /** Sliding-window rate limit: true when the action is allowed. */
  allow(key: string, limit: number, windowSec: number): Promise<boolean>;
}

const SERDE = {
  parse(raw: string): RoomRecord | null {
    try {
      const v = JSON.parse(raw) as Partial<RoomRecord>;
      if (typeof v.code !== 'string' || !Array.isArray(v.members) || typeof v.matchToken !== 'string') return null;
      return { code: v.code, members: v.members.filter((m): m is string => typeof m === 'string'), matchToken: v.matchToken, createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0 };
    } catch { return null; }
  },
};

/** Hermetic in-process store: unit tests, local dev without Redis. */
export class MemoryStore implements RoomStore {
  private rooms = new Map<string, { rec: RoomRecord; exp: number }>();
  private presence = new Map<string, number>();
  private hits = new Map<string, number[]>();

  constructor(private now: () => number = Date.now) {}

  private get(code: string): RoomRecord | null {
    const e = this.rooms.get(code);
    if (!e || e.exp <= this.now()) { this.rooms.delete(code); return null; }
    return { ...e.rec, members: [...e.rec.members] };
  }

  async createRoom(rec: RoomRecord, ttlSec: number): Promise<boolean> {
    if (this.get(rec.code)) return false;
    this.rooms.set(rec.code, { rec: { ...rec, members: [...rec.members] }, exp: this.now() + ttlSec * 1000 });
    return true;
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    return this.get(code);
  }

  async addMember(code: string, clientId: string, max: number): Promise<JoinResult> {
    const cur = this.get(code);
    if (!cur) return { status: 'missing' };
    if (cur.members.includes(clientId)) return { status: 'ok', room: cur };
    if (cur.members.length >= max) return { status: 'full' };
    const e = this.rooms.get(code)!;
    e.rec.members.push(clientId);
    return { status: 'ok', room: { ...e.rec, members: [...e.rec.members] } };
  }

  async removeMember(code: string, clientId: string): Promise<{ room: RoomRecord | null; emptied: boolean }> {
    const cur = this.get(code);
    if (!cur) return { room: null, emptied: true };
    const members = cur.members.filter((m) => m !== clientId);
    if (members.length === 0) { this.rooms.delete(code); return { room: null, emptied: true }; }
    this.rooms.get(code)!.rec.members = members;
    return { room: { ...cur, members }, emptied: false };
  }

  async heartbeat(clientId: string, ttlSec: number): Promise<void> {
    this.presence.set(clientId, this.now() + ttlSec * 1000);
  }

  async allow(key: string, limit: number, windowSec: number): Promise<boolean> {
    const t = this.now(), cutoff = t - windowSec * 1000;
    const arr = (this.hits.get(key) ?? []).filter((x) => x > cutoff);
    if (arr.length >= limit) { this.hits.set(key, arr); return false; }
    arr.push(t);
    this.hits.set(key, arr);
    return true;
  }

  static serdeForTest = SERDE;
}
