/**
 * Semantic social cameras. Agents pick a preset name; the numbers below are
 * tuned once for 9:16 portrait composition and never exposed to the CLI.
 */

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
