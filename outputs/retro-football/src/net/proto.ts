/**
 * Match packet framing over a DataTransport (1-byte tag, big-endian u32s).
 * Tag 0 input:    [0, tick u32, 3 input bytes]
 * Tag 1 hash:     [1, tick u32, hash u32]
 * Tag 2 snapshot: [2, tick u32, byteLen u32, utf8 JSON...]
 * Tag 3 control:  [3, byteLen u32, utf8 JSON...] (hello/welcome/pause/resume/quit)
 * Anything malformed decodes to { kind: 'unknown' } — never throws.
 */
export type NetPacket =
  | { kind: 'input'; tick: number; bytes: Uint8Array }
  | { kind: 'hash'; tick: number; hash: number }
  | { kind: 'snapshot'; tick: number; json: string }
  | { kind: 'control'; json: string }
  | { kind: 'unknown' };

export function encodeInputPacket(tick: number, bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + 4 + 3);
  const v = new DataView(out.buffer);
  out[0] = 0; v.setUint32(1, tick >>> 0); out.set(bytes.subarray(0, 3), 5);
  return out;
}

export function encodeHashPacket(tick: number, hash: number): Uint8Array {
  const out = new Uint8Array(1 + 4 + 4);
  const v = new DataView(out.buffer);
  out[0] = 1; v.setUint32(1, tick >>> 0); v.setUint32(5, hash >>> 0);
  return out;
}

export function encodeControlPacket(json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const out = new Uint8Array(1 + 4 + body.length);
  const v = new DataView(out.buffer);
  out[0] = 3; v.setUint32(1, body.length);
  out.set(body, 5);
  return out;
}

export function decodeControl<T>(p: Extract<NetPacket, { kind: 'control' }>): T | null {
  try { return JSON.parse(p.json) as T; } catch { return null; }
}

export function encodeSnapshotPacket(tick: number, json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const out = new Uint8Array(1 + 4 + 4 + body.length);
  const v = new DataView(out.buffer);
  out[0] = 2; v.setUint32(1, tick >>> 0); v.setUint32(5, body.length);
  out.set(body, 9);
  return out;
}

export function decodePacket(data: Uint8Array): NetPacket {
  try {
    if (data.length < 1) return { kind: 'unknown' };
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const tag = data[0];
    if (tag === 0 && data.length >= 8) {
      return { kind: 'input', tick: v.getUint32(1), bytes: data.slice(5, 8) };
    }
    if (tag === 1 && data.length >= 9) {
      return { kind: 'hash', tick: v.getUint32(1), hash: v.getUint32(5) };
    }
    if (tag === 2 && data.length >= 9) {
      const len = v.getUint32(5);
      if (9 + len > data.length) return { kind: 'unknown' };
      return { kind: 'snapshot', tick: v.getUint32(1), json: new TextDecoder().decode(data.subarray(9, 9 + len)) };
    }
    if (tag === 3 && data.length >= 5) {
      const len = v.getUint32(1);
      if (5 + len > data.length) return { kind: 'unknown' };
      return { kind: 'control', json: new TextDecoder().decode(data.subarray(5, 5 + len)) };
    }
    return { kind: 'unknown' };
  } catch {
    return { kind: 'unknown' };
  }
}
