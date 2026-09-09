import type { TeamId } from '../types';

export const NET_PROTO = 2;
/**
 * Deterministic gameplay version: sim tick logic + wire/input codec + tuning.
 * Peers must agree on all three before kickoff; mismatches fail the
 * handshake gracefully instead of starting an invalid match.
 */
export const SIM_VERSION = 4;
export const INPUT_VERSION = 4;
/** Fingerprint of the canonical tuning table (see game/tuning.ts). */
export const TUNING_FINGERPRINT = 'arcade-1-pace';

/** Manual room-code envelope: base64url(JSON). Used for copy-paste SDP
 *  exchange now, and as the payload shape the F4 signal server will relay. */
export function encodeCode(obj: unknown): string {
  const bin = unescape(encodeURIComponent(JSON.stringify(obj)));
  let b64: string;
  if (typeof btoa !== 'undefined') b64 = btoa(bin);
  else b64 = Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCode<T>(code: string): T {
  const clean = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  let bin: string;
  if (typeof atob !== 'undefined') bin = atob(clean);
  else bin = Buffer.from(clean, 'base64').toString('binary');
  return JSON.parse(decodeURIComponent(escape(bin))) as T;
}

export interface HelloMsg {
  t: 'hello';
  proto: number;
  seedPart: number;
  clientId: string;
  sim: number;
  input: number;
  tune: string;
}

export interface WelcomeMsg {
  t: 'welcome';
  proto: number;
  seed: number;
  yourTeam: TeamId;
  sim: number;
  input: number;
  tune: string;
}

export function makeSeedPart(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Shared match seed: neither side controls it alone; never zero. */
export function decideSeed(a: number, b: number): number {
  return ((a ^ b) >>> 0) || 1;
}

/** Version block both sides must agree on before a match starts. */
export function localVersions() {
  return { sim: SIM_VERSION, input: INPUT_VERSION, tune: TUNING_FINGERPRINT };
}

/** Null when compatible, otherwise a human-readable mismatch reason. */
export function checkVersions(peer: { sim?: number; input?: number; tune?: string }): string | null {
  if (peer.sim !== undefined && peer.sim !== SIM_VERSION) return `sim version mismatch (got ${peer.sim})`;
  if (peer.input !== undefined && peer.input !== INPUT_VERSION) return `input version mismatch (got ${peer.input})`;
  if (peer.tune !== undefined && peer.tune !== TUNING_FINGERPRINT) return 'tuning mismatch — update the game';
  return null;
}

/** Host (offerer, team 0) answers a joiner, who always takes team 1. */
export function answerHello(hostPart: number, hello: HelloMsg): WelcomeMsg {
  if (hello.proto !== NET_PROTO) throw new Error(`net proto mismatch (got ${hello.proto})`);
  const mismatch = checkVersions(hello);
  if (mismatch) throw new Error(mismatch);
  return { t: 'welcome', proto: NET_PROTO, seed: decideSeed(hostPart, hello.seedPart), yourTeam: 1, ...localVersions() };
}

export function makeClientId(): string {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
