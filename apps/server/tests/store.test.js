import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.ts';
import { RoomManager, RoomError } from '../src/rooms.ts';
import { RedisStore } from '../src/redis-store.ts';
test('manager allocates, joins idempotently, caps at two, normalizes case', async () => {
    const m = new RoomManager(new MemoryStore(), { codeGen: (() => { let i = 0; return () => `ABCDE${'ABCDEFGH'[i++]}`; })() });
    const { code, matchToken } = await m.create('AAAAAAA1');
    assert.equal(code, 'ABCDEA');
    assert.ok(matchToken.length >= 32);
    const r1 = await m.join('abcdea', 'BBBBBBB2');
    assert.deepEqual(r1.members, ['AAAAAAA1', 'BBBBBBB2']);
    const r2 = await m.join('ABCDEA', 'BBBBBBB2');
    assert.deepEqual(r2.members, ['AAAAAAA1', 'BBBBBBB2'], 'rejoin is idempotent');
    await assert.rejects(m.join('ABCDEA', 'CCCCCCC3'), (e) => e instanceof RoomError && e.code === 'FULL');
    await assert.rejects(m.join('ZZZZZZ', 'CCCCCCC3'), (e) => e instanceof RoomError && e.code === 'NOT_FOUND');
});
test('manager retries code collisions then gives up', async () => {
    const m = new RoomManager(new MemoryStore(), { codeGen: () => 'ABCDEF' });
    await m.create('AAAAAAA1');
    await assert.rejects(m.create('BBBBBBB2'), (e) => e instanceof RoomError && e.code === 'EXISTS');
});
test('memory store expires rooms and windows with an injectable clock', async () => {
    let t = 1_000_000;
    const s = new MemoryStore(() => t);
    assert.ok(await s.createRoom({ code: 'ABCDEF', members: ['x'], matchToken: 't', createdAt: t }, 10));
    assert.ok(await s.getRoom('ABCDEF'));
    t += 11_000;
    assert.equal(await s.getRoom('ABCDEF'), null, 'TTL expiry');
    t = 0;
    assert.ok(await s.allow('k', 2, 60));
    assert.ok(await s.allow('k', 2, 60));
    assert.ok(!(await s.allow('k', 2, 60)), 'third hit blocked');
    t = 61_000;
    assert.ok(await s.allow('k', 2, 60), 'window slides');
});
test('redis store round-trips when REDIS_URL is set', { skip: !process.env.REDIS_URL }, async () => {
    const s = new RedisStore(process.env.REDIS_URL);
    assert.equal(await s.ping(), true);
    const code = 'T' + Math.floor(Math.random() * 1e5).toString().padStart(5, '0');
    assert.equal(await s.createRoom({ code, members: ['a'], matchToken: 't', createdAt: Date.now() }, 30), true);
    assert.equal(await s.createRoom({ code, members: ['a'], matchToken: 't', createdAt: Date.now() }, 30), false);
    const j = await s.addMember(code, 'b', 2);
    assert.equal(j.status, 'ok');
    assert.equal((await s.addMember(code, 'c', 2)).status, 'full');
    assert.ok(await s.allow('test-key', 100, 60));
    await s.disconnect();
});
//# sourceMappingURL=store.test.js.map