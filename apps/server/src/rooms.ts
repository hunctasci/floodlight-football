import { randomBytes } from 'node:crypto';
import type { RoomRecord, RoomStore } from './store.js';

export class RoomError extends Error {
  constructor(public code: 'NOT_FOUND' | 'FULL' | 'EXISTS' | 'BAD_CODE', message: string) {
    super(message);
  }
}

/** Unambiguous 6-char codes (no 0/O/1/I) readable over voice chat. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface RoomManagerOpts {
  ttlSec?: number;
  maxMembers?: number;
  codeGen?: () => string;
  tokenGen?: () => string;
}

export class RoomManager {
  private ttlSec: number;
  private maxMembers: number;
  private codeGen: () => string;
  private tokenGen: () => string;

  constructor(private store: RoomStore, opts: RoomManagerOpts = {}) {
    this.ttlSec = opts.ttlSec ?? 7200;
    this.maxMembers = opts.maxMembers ?? 2;
    this.codeGen = opts.codeGen ?? (() =>
      Array.from(randomBytes(6)).map((b) => ALPHABET[b % ALPHABET.length]).join(''));
    this.tokenGen = opts.tokenGen ?? (() => randomBytes(32).toString('hex'));
  }

  async create(clientId: string): Promise<{ code: string; matchToken: string }> {
    for (let i = 0; i < 5; i++) {
      const code = this.codeGen();
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) continue;
      const rec: RoomRecord = { code, members: [clientId], matchToken: this.tokenGen(), createdAt: Date.now() };
      if (await this.store.createRoom(rec, this.ttlSec)) return { code, matchToken: rec.matchToken };
    }
    throw new RoomError('EXISTS', 'could not allocate a room code');
  }

  async join(code: string, clientId: string): Promise<RoomRecord> {
    const r = await this.store.addMember(code.toUpperCase(), clientId, this.maxMembers);
    if (r.status === 'missing') throw new RoomError('NOT_FOUND', 'room not found or expired');
    if (r.status === 'full') throw new RoomError('FULL', 'room is full');
    return r.room;
  }

  async leave(code: string, clientId: string): Promise<{ emptied: boolean }> {
    const r = await this.store.removeMember(code.toUpperCase(), clientId);
    return { emptied: r.emptied };
  }
}
