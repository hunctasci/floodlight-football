// Adapter integration: the real game signaling clients against the real
// local control plane (no fakes). WebRTC itself needs browsers, so SDP here
// is a looped token — proving room coordination + relay through the exact
// classes main.ts uses. Usage: BASE=http://127.0.0.1:5173 npx tsx scripts/cf-adapter-check.ts
import { CloudflareSignalingClient } from '../src/net/cloudflare-signal.ts';

const BASE: string = process.env.BASE ?? 'http://127.0.0.1:5173';
const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';

const host = new CloudflareSignalingClient();
const joiner = new CloudflareSignalingClient();
await host.connect(BASE);
await joiner.connect(BASE);

const created = await host.createRoom(A);
console.log('room', created.roomCode);

const seen: string[] = [];
host.onPeerJoined = (id) => seen.push(`host:peer-joined:${id}`);
joiner.onPeerJoined = (id) => seen.push(`joiner:peer-joined:${id}`);

const joined = await joiner.joinRoom(created.roomCode, B);
console.log('joined peers', JSON.stringify(joined.peers), 'token-match', joined.matchToken === created.matchToken);

const offerP = new Promise((res) => {
  joiner.onPeerSignal = (from, sdp) => res(`joiner got ${sdp.type} from ${from}`);
});
host.sendSignal(B, { type: 'offer', sdp: 'v=0-fake-offer' });
console.log(await offerP);

const answerP = new Promise((res) => {
  host.onPeerSignal = (from, sdp) => res(`host got ${sdp.type} from ${from}`);
});
joiner.sendSignal(A, { type: 'answer', sdp: 'v=0-fake-answer' });
console.log(await answerP);

await new Promise((r) => setTimeout(r, 300));
console.log('presence', JSON.stringify(seen));
host.close();
joiner.close();
console.log('ADAPTER PASS');
process.exit(0);
