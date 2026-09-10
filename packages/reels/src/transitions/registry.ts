export const TRANSITION_IDS = [
  'cut',
  'fade',
  'zoom',
  'whip-pan',
  'flash',
  'glitch',
  'pixelate',
  'cloud-puff',
] as const;

export type TransitionId = (typeof TRANSITION_IDS)[number];

/**
 * Coverage curve for full-screen transitions: 0 = outgoing fully visible,
 * 1 = incoming fully hidden (stage swap point). Deterministic in localFrame.
 * cloud-puff must reach 1.0 at/before midpoint and hold through the swap.
 */
export function transitionCoverage(
  type: string,
  localFrame: number,
  durationInFrames: number,
): number {
  const t = Math.min(1, Math.max(0, localFrame / Math.max(1, durationInFrames)));
  switch (type) {
    case 'cut':
      return t < 1 ? 0 : 1;
    case 'fade':
      return t;
    case 'cloud-puff': {
      // Fast expansion: full coverage by 45%, hold to 65%, dissipate by 100%.
      if (t < 0.45) return easeOutCubic(t / 0.45);
      if (t < 0.65) return 1;
      return 1 - easeInCubic((t - 0.65) / 0.35);
    }
    case 'zoom':
    case 'whip-pan':
    case 'flash':
    case 'glitch':
    case 'pixelate':
      return t;
    default:
      throw new Error(`Unknown transition: ${type}`);
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

/** Frame (local) at which the stage swap should occur: first full-coverage frame. */
export function transitionSwapFrame(type: string, durationInFrames: number): number {
  if (type !== 'cloud-puff') return Math.floor(durationInFrames / 2);
  return Math.floor(durationInFrames * 0.45);
}
