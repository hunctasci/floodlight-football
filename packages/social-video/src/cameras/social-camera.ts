/**
 * Semantic social cameras. Agents pick a preset name; the numbers below are
 * tuned once for 9:16 portrait composition and never exposed to the CLI.
 */
import { lerp, smoothstep } from '../timeline/math';

export interface SocialLens {
  pos: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  fov: number;
}

/**
 * Faceoff lens: low-ish camera on the near touchline looking up-pitch toward
 * the far stand, so the frame holds pitch (bottom), both players (middle)
 * and stadium/crowd/sky (top) with headroom left for future text overlays.
 * A genuine portrait composition — not a cropped broadcast camera.
 */
export function faceoffCamera(): SocialLens {
  return {
    pos: { x: 0, y: 3.4, z: 10.5 },
    look: { x: 0, y: 1.0, z: -3.0 },
    fov: 55,
  };
}

interface LensKey {
  at: number;
  pos: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  fov: number;
}

/**
 * Faceoff camera as a pure function of time: wide establishing portrait at
 * t=0, medium shot mid-clip, tighter low-angle rivalry shot at the end.
 * `lateral` is a small seed-derived sideways offset (metres). Random-access
 * safe: no accumulated state, only interpolation between keyframes.
 */
export function faceoffCameraAt(time: number, duration: number, lateral = 0): SocialLens {
  const keys: [LensKey, LensKey, LensKey] = [
    { at: 0, pos: { x: 0, y: 3.9, z: 11.6 }, look: { x: 0, y: 0.9, z: -3.0 }, fov: 56 },
    { at: 0.5, pos: { x: 0, y: 3.4, z: 10.5 }, look: { x: 0, y: 1.0, z: -3.0 }, fov: 55 },
    { at: 1, pos: { x: 0, y: 2.6, z: 8.6 }, look: { x: 0, y: 1.25, z: -2.2 }, fov: 52 },
  ];
  const d = duration > 0 ? duration : 1;
  const k = Math.min(Math.max(time / d, 0), 1);
  const [a, b, c] = keys;
  const seg = k < b.at ? [a, b, k / b.at] as const : [b, c, (k - b.at) / (c.at - b.at)] as const;
  const [from, to, local] = seg;
  const e = smoothstep(local);
  return {
    pos: {
      x: lerp(from.pos.x, to.pos.x, e) + lateral,
      y: lerp(from.pos.y, to.pos.y, e),
      z: lerp(from.pos.z, to.pos.z, e),
    },
    look: {
      x: lerp(from.look.x, to.look.x, e) + lateral * 0.3,
      y: lerp(from.look.y, to.look.y, e),
      z: lerp(from.look.z, to.look.z, e),
    },
    fov: lerp(from.fov, to.fov, e),
  };
}
