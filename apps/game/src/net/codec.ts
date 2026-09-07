import { EMPTY_INPUT, type InputFrame } from '../types';

/**
 * Lockstep wire codec, version 2: one InputFrame <-> 6 bytes.
 * Byte 0: button bitmask — bit0 sprint, bit1 pass(edge), bit2 passHeld,
 *   bit3 passReleased, bit4 shootPressed, bit5 shootHeld, bit6 shootReleased,
 *   bit7 switchPlayer.
 * Bytes 1-2: signed int8 stick axes (x/z * 100).
 * Bytes 3-4: signed int8 shot aim (aimU * 100, aimV * 100).
 * Byte 5: reserved, must be zero (future flags; decoders ignore nonzero).
 *
 * Legacy through/cross buttons are gone: lead passes derive from PASS hold
 * duration inside the sim, long restarts from SHOOT. Analog magnitude and
 * aim survive within half a percent — identical on both peers.
 */
export const INPUT_BYTES = 6;

const q = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 100)));

/** Quantize exactly as the wire does: solo and online share one representation. */
export function quantizeInput(f: InputFrame): InputFrame {
  return decodeInput(encodeInput(f));
}

export function encodeInput(f: InputFrame): Uint8Array {
  const out = new Uint8Array(INPUT_BYTES);
  let mask = 0;
  if (f.sprint) mask |= 1;
  if (f.pass) mask |= 2;
  if (f.passHeld) mask |= 4;
  if (f.passReleased) mask |= 8;
  if (f.shootPressed) mask |= 16;
  if (f.shootHeld) mask |= 32;
  if (f.shootReleased) mask |= 64;
  if (f.switchPlayer) mask |= 128;
  out[0] = mask;
  out[1] = q(f.x) & 0xff;
  out[2] = q(f.z) & 0xff;
  out[3] = q(f.aimU) & 0xff;
  out[4] = q(f.aimV) & 0xff;
  out[5] = 0;
  return out;
}

export function decodeInput(b: Uint8Array): InputFrame {
  const mask = b[0] ?? 0;
  const s8 = (v: number | undefined) => ((v ?? 0) << 24 >> 24) / 100;
  return {
    ...EMPTY_INPUT,
    sprint: !!(mask & 1),
    pass: !!(mask & 2),
    passHeld: !!(mask & 4),
    passReleased: !!(mask & 8),
    shootPressed: !!(mask & 16),
    shootHeld: !!(mask & 32),
    shootReleased: !!(mask & 64),
    switchPlayer: !!(mask & 128),
    x: s8(b[1]),
    z: s8(b[2]),
    aimU: s8(b[3]),
    aimV: s8(b[4]),
  };
}
