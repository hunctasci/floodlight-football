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
 *
 * Position/look travel a Catmull-Rom spline through the three keys, so the
 * dolly glides with continuous velocity instead of pausing mid-move (an
 * eased two-segment blend would stop dead at the middle key and read as a
 * hitch). FOV still eases per segment (slow drift, no visible step).
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
  // Catmull-Rom through a/b/c at parameter k (endpoints duplicated).
  const cr = (v0: number, v1: number, v2: number, v3: number, u: number): number => {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * v1 + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 + (-v0 + 3 * v1 - 3 * v2 + v3) * u3);
  };
  // Map k onto the two spans with their own local u (spans are equal here,
  // but the form stays correct if key times ever move).
  const seg = k < b.at
    ? { p0: a, p1: a, p2: b, p3: c, u: k / b.at }
    : { p0: a, p1: b, p2: c, p3: c, u: (k - b.at) / (c.at - b.at) };
  const { p0, p1, p2, p3, u } = seg;
  const fov = k < b.at
    ? lerp(a.fov, b.fov, smoothstep(k / b.at))
    : lerp(b.fov, c.fov, smoothstep((k - b.at) / (c.at - b.at)));
  return {
    pos: {
      x: cr(p0.pos.x, p1.pos.x, p2.pos.x, p3.pos.x, u) + lateral,
      y: cr(p0.pos.y, p1.pos.y, p2.pos.y, p3.pos.y, u),
      z: cr(p0.pos.z, p1.pos.z, p2.pos.z, p3.pos.z, u),
    },
    look: {
      x: cr(p0.look.x, p1.look.x, p2.look.x, p3.look.x, u) + lateral * 0.3,
      y: cr(p0.look.y, p1.look.y, p2.look.y, p3.look.y, u),
      z: cr(p0.look.z, p1.look.z, p2.look.z, p3.look.z, u),
    },
    fov,
  };
}
