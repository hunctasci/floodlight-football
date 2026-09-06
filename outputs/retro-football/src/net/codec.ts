import { EMPTY_INPUT, type InputFrame } from '../types';

/**
 * Lockstep wire codec: one InputFrame <-> 3 bytes.
 * Byte 0: button bitmask — bit0 sprint, bit1 pass, bit2 through, bit3 cross,
 *   bit4 shootPressed, bit5 shootHeld, bit6 shootReleased, bit7 switchPlayer.
 * Bytes 1-2: signed int8 stick axes (x/z * 100). Analog magnitude survives
 *   within half a percent — identical on both peers, so the sim stays in sync.
 */
export const INPUT_BYTES = 3;

const q = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 100)));

export function encodeInput(f: InputFrame): Uint8Array {
  const out = new Uint8Array(INPUT_BYTES);
  let mask = 0;
  if (f.sprint) mask |= 1;
  if (f.pass) mask |= 2;
  if (f.through) mask |= 4;
  if (f.cross) mask |= 8;
  if (f.shootPressed) mask |= 16;
  if (f.shootHeld) mask |= 32;
  if (f.shootReleased) mask |= 64;
  if (f.switchPlayer) mask |= 128;
  out[0] = mask;
  out[1] = q(f.x) & 0xff;
  out[2] = q(f.z) & 0xff;
  return out;
}

export function decodeInput(b: Uint8Array): InputFrame {
  const mask = b[0] ?? 0;
  const s8 = (v: number | undefined) => ((v ?? 0) << 24 >> 24) / 100;
  return {
    ...EMPTY_INPUT,
    sprint: !!(mask & 1),
    pass: !!(mask & 2),
    through: !!(mask & 4),
    cross: !!(mask & 8),
    shootPressed: !!(mask & 16),
    shootHeld: !!(mask & 32),
    shootReleased: !!(mask & 64),
    switchPlayer: !!(mask & 128),
    x: s8(b[1]),
    z: s8(b[2]),
  };
}
