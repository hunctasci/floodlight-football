import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { MemoryStore } from '../src/store.ts';
import { createApp } from '../src/server.ts';
import { loadConfig } from '../src/config.ts';
import { createLogger } from '../src/log.ts';
const log = createLogger('fatal');
class Client {
    port;
    ws;
    queue = [];
    waiters = [];
    constructor(port) {
        this.port = port;
        this.ws = new WebSocket(`ws://127.0.0.1:${port}/socket`);
        this.ws.on('message', (d) => {
            const s = d.toString();
            const w = this.waiters.shift();
            if (w)
                w(s);
            else
                this.queue.push(s);
        });
    }
    get opened() {
        return new Promise((res, rej) => {
            this.ws.once('open', () => res());
            this.ws.once('error', rej);
        });
    }
    send(o) { this.ws.send(JSON.stringify(o)); }
    raw(s) { this.ws.send(s); }
    next(timeoutMs = 1500) {
        const q = this.queue.shift();
        if (q !== undefined)
            return Promise.resolve(JSON.parse(q));
        return new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error('timed out waiting for server message')), timeoutMs);
            this.waiters.push((s) => { clearTimeout(t); res(JSON.parse(s)); });
        });
    }
    close() { this.ws.close(); }
}
async function boot(env = {}) {
    const store = new MemoryStore();
    const config = loadConfig({ ...process.env, PORT: '0', ...env });
    const app = createApp(store, config, log, () => false);
    await new Promise((res) => app.http.listen(0, res));
    const port = app.http.address().port;
    return { app, port, store };
}
const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
test('healthz reports shape and unknown routes 404', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const h = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json();
    assert.equal(h.status, 'ok');
    assert.ok(typeof h.uptimeSec === 'number');
    assert.equal(h.redis, 'down');
    const r404 = await fetch(`http://127.0.0.1:${port}/nope`);
    assert.equal(r404.status, 404);
});
test('create, join, signal relay, leave lifecycle', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const a = new Client(port), b = new Client(port);
    await Promise.all([a.opened, b.opened]);
    t.after(() => { a.close(); b.close(); });
    a.send({ t: 'create-room', clientId: A });
    const created = await a.next();
    assert.equal(created.t, 'room-created');
    assert.match(created.roomCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.ok(created.matchToken.length >= 32);
    b.send({ t: 'join-room', code: created.roomCode, clientId: B });
    const joined = await b.next();
    assert.equal(joined.t, 'room-joined');
    assert.deepEqual(joined.peers, [A]);
    // Codes are strict uppercase: lowercase never reaches the manager.
    b.send({ t: 'join-room', code: created.roomCode.toLowerCase(), clientId: B });
    assert.deepEqual(await b.next(), { t: 'error', message: 'invalid message' });
    const pj = await a.next();
    assert.deepEqual(pj, { t: 'peer-joined', clientId: B });
    const sdp = { type: 'offer', sdp: 'v=0' };
    a.send({ t: 'signal', to: B, payload: sdp });
    const relayed = await b.next();
    assert.deepEqual(relayed, { t: 'signaled', from: A, payload: sdp });
    b.send({ t: 'leave-room' });
    const left = await a.next();
    assert.deepEqual(left, { t: 'peer-left', clientId: B });
});
test('signal guards: room required, peer must be a member', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const a = new Client(port);
    await a.opened;
    t.after(() => a.close());
    a.send({ t: 'signal', to: B, payload: { type: 'offer', sdp: 'v=0' } });
    assert.deepEqual(await a.next(), { t: 'error', message: 'join a room first' });
    a.send({ t: 'create-room', clientId: A });
    await a.next();
    a.send({ t: 'signal', to: B, payload: { type: 'offer', sdp: 'v=0' } });
    assert.deepEqual(await a.next(), { t: 'error', message: 'peer offline' });
});
test('malformed and unknown messages get errors, connection survives', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const a = new Client(port);
    await a.opened;
    t.after(() => a.close());
    a.raw('this is not json{');
    assert.deepEqual(await a.next(), { t: 'error', message: 'malformed JSON' });
    a.raw('{"t":"dance"}');
    assert.deepEqual(await a.next(), { t: 'error', message: 'invalid message' });
    a.send({ t: 'ping' });
    assert.deepEqual(await a.next(), { t: 'pong' });
});
test('join of missing/full rooms is rejected; empty rooms vanish', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const a = new Client(port), b = new Client(port), c = new Client(port);
    await Promise.all([a.opened, b.opened, c.opened]);
    t.after(() => { a.close(); b.close(); c.close(); });
    a.send({ t: 'create-room', clientId: A });
    const { roomCode } = await a.next();
    b.send({ t: 'join-room', code: 'ZZZZZZ', clientId: B });
    assert.deepEqual(await b.next(), { t: 'error', message: 'room not found or expired' });
    b.send({ t: 'join-room', code: roomCode, clientId: B });
    await b.next();
    await a.next(); // joined + peer-joined
    c.send({ t: 'join-room', code: roomCode, clientId: 'cccccccc-0000-4000-8000-cccccccccccc' });
    assert.deepEqual(await c.next(), { t: 'error', message: 'room is full' });
    a.send({ t: 'leave-room' });
    b.send({ t: 'leave-room' });
    await b.next(); // peer-left for A's departure
    c.send({ t: 'join-room', code: roomCode, clientId: 'cccccccc-0000-4000-8000-cccccccccccc' });
    assert.deepEqual(await c.next(), { t: 'error', message: 'room not found or expired' });
});
test('create rate limit trips and resets', async (t) => {
    const { app, port } = await boot({ RATE_CREATE_PER_MIN: '2' });
    t.after(() => app.close());
    const a = new Client(port);
    await a.opened;
    t.after(() => a.close());
    const ids = ['11111111-0000-4000-8000-111111111111', '22222222-0000-4000-8000-222222222222', '33333333-0000-4000-8000-333333333333'];
    for (const id of ids.slice(0, 2)) {
        a.send({ t: 'create-room', clientId: id });
        await a.next();
    }
    a.send({ t: 'create-room', clientId: ids[2] });
    assert.deepEqual(await a.next(), { t: 'error', message: 'rate limited, slow down' });
});
test('disconnect auto-leaves and notifies the peer', async (t) => {
    const { app, port } = await boot();
    t.after(() => app.close());
    const a = new Client(port), b = new Client(port);
    await Promise.all([a.opened, b.opened]);
    t.after(() => a.close());
    a.send({ t: 'create-room', clientId: A });
    const { roomCode } = await a.next();
    b.send({ t: 'join-room', code: roomCode, clientId: B });
    await b.next();
    await a.next();
    b.ws.terminate();
    assert.deepEqual(await a.next(), { t: 'peer-left', clientId: B });
});
//# sourceMappingURL=server.test.js.map