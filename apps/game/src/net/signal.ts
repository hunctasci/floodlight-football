import type { TeamId } from '../types';

export const NET_PROTO = 1;

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
}

export interface WelcomeMsg {
  t: 'welcome';
  proto: number;
  seed: number;
  yourTeam: TeamId;
}

export function makeSeedPart(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/** Shared match seed: neither side controls it alone; never zero. */
export function decideSeed(a: number, b: number): number {
  return ((a ^ b) >>> 0) || 1;
}

/** Host (offerer, team 0) answers a joiner, who always takes team 1. */
export function answerHello(hostPart: number, hello: HelloMsg): WelcomeMsg {
  if (hello.proto !== NET_PROTO) throw new Error(`net proto mismatch (got ${hello.proto})`);
  return { t: 'welcome', proto: NET_PROTO, seed: decideSeed(hostPart, hello.seedPart), yourTeam: 1 };
}

export function makeClientId(): string {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
