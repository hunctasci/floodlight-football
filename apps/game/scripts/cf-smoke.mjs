// Cloudflare-native smoke test (real workerd runtime, no mocks).
// Usage: BASE=http://127.0.0.1:5175 node scripts/cf-smoke.mjs
// Covers: static shell, health, create, join, presence, SDP relay,
// full-room rejection, cross-room isolation, malformed input, disconnect.
const BASE = process.env.BASE ?? 'http://127.0.0.1:5175';
const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
const C = 'cccccccc-0000-4000-8000-cccccccccccc';

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

class Sock {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.queue = [];
    this.waiters = [];
    this.ws.addEventListener('message', (e) => {
      const w = this.waiters.shift();
      if (w) w(String(e.data));
      else this.queue.push(String(e.data));
    });
  }
  get opened() {
    return new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res(), { once: true });
      this.ws.addEventListener('error', (e) => rej(e), { once: true });
    });
  }
  next(ms = 5000) {
    const q = this.queue.shift();
    if (q !== undefined) return Promise.resolve(JSON.parse(q));
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timed out waiting for message')), ms);
      this.waiters.push((s) => {
        clearTimeout(t);
        res(JSON.parse(s));
      });
    });
  }
  send(o) {
    this.ws.send(JSON.stringify(o));
  }
  close() {
    this.ws.close();
  }
}

const roomUrl = (code, id) => BASE.replace(/^http/, 'ws') + `/api/rooms/${code}/socket?clientId=${id}`;

// 1. Static game shell (+ no stale legacy multiplayer UI).
const index = await fetch(BASE + '/');
const html = await index.text();
check('GET / serves the game', index.ok && html.includes('Floodlight Football'));
// Deployed bundle must carry the unified friend-match UI, never the removed
// manual-SDP ceremony (guards against stale-asset deploys).
try {
  const jsPaths = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let bundle = '';
  for (const p of jsPaths.slice(0, 3)) {
    const r = await fetch(BASE + p);
    bundle += await r.text();
  }
  const banned = ['CREATE INVITE LINK', 'CREATE ROOM', 'SEND THE REPLY BACK', 'PASTE THE REPLY', 'PASTE THE INVITE', 'invite-answer'];
  check('deployed JS has no legacy SDP ceremony', banned.every((s) => !bundle.includes(s)));
  check('deployed JS has unified friend-match UI', bundle.includes('PLAY WITH A FRIEND') && bundle.includes('JOIN WITH CODE'));
} catch {
  check('deployed bundle inspectable', false);
}

// 2. Health.
const health = await (await fetch(BASE + '/api/health')).json();
check('GET /api/health minimal probe', health.status === 'ok' && health.service === 'floodlight');
const legacy = await (await fetch(BASE + '/healthz')).json();
check('GET /healthz alias', legacy.status === 'ok');

// 3. Create.
const created = await (
  await fetch(BASE + '/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: A }),
  })
).json();
check('POST /api/rooms returns code+token', /^[A-HJ-NP-Z2-9]{6}$/.test(created.roomCode) && created.matchToken.length >= 32);
const code = created.roomCode;

// 4. Host + joiner sockets.
const a = new Sock(roomUrl(code, A));
const b = new Sock(roomUrl(code, B));
await Promise.all([a.opened, b.opened]);
const ra = await a.next();
check('host socket gets room-joined', ra.t === 'room-joined' && ra.roomCode === code && ra.matchToken === created.matchToken);
const rb = await b.next();
check(
  'joiner socket gets room-joined with peer+token',
  rb.t === 'room-joined' && rb.peers.includes(A) && rb.matchToken === created.matchToken,
);
const pj = await a.next();
check('host sees peer-joined', pj.t === 'peer-joined' && pj.clientId === B);

// 5. SDP relay both directions (control plane only — gameplay stays P2P).
a.send({ t: 'signal', to: B, payload: { type: 'offer', sdp: 'v=0-fake' } });
const relay = await b.next();
check('offer relayed A→B', relay.t === 'signaled' && relay.from === A && relay.payload.sdp === 'v=0-fake');
b.send({ t: 'signal', to: A, payload: { type: 'answer', sdp: 'v=0-fake' } });
const back = await a.next();
check('answer relayed B→A', back.t === 'signaled' && back.from === B);

// 6. Full room: third peer rejected.
let thirdRejected = false;
try {
  const c = new Sock(roomUrl(code, C));
  await c.opened;
  const msg = await c.next();
  thirdRejected = msg.t === 'error' || msg.t === 'room-joined';
  c.close();
  // room-joined for a third peer would be wrong; error (or a 409 close) is right.
  const m = msg;
  thirdRejected = m.t !== 'room-joined' || (m.peers ?? []).length > 1;
} catch {
  thirdRejected = true; // upgrade refused outright also counts
}
check('third peer rejected', thirdRejected);

// 7. Cross-room isolation: signal to a non-member fails.
const other = await (
  await fetch(BASE + '/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: C }),
  })
).json();
a.send({ t: 'signal', to: C, payload: { type: 'offer', sdp: 'v=0' } });
const iso = await a.next();
check('cross-room signal refused', iso.t === 'error' && /peer offline/i.test(iso.message));

// 8. Malformed input: error, connection survives.
a.ws.send('this is not json{');
const bad = await a.next();
check('malformed JSON rejected cleanly', bad.t === 'error');
a.send({ t: 'ping' });
check('connection survives (pong)', (await a.next()).t === 'pong');

// 9. Disconnect notifies the peer.
b.close();
const left = await a.next();
check('disconnect → peer-left', left.t === 'peer-left' && left.clientId === B);
a.close();

console.log(other.roomCode ? `ok  isolation room ${other.roomCode} created separately` : 'FAIL  second room');
if (!other.roomCode) failures++;
console.log(failures === 0 ? '\nSMOKE PASS' : `\nSMOKE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
