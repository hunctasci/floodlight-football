/**
 * Broadcast studio layout (world definition + renderer share it): anchor desk
 * facing +z, two seated anchors, a big wall screen behind them (in-world
 * canvas texture, so heads occlude it correctly), LED pillars.
 */
import { v3 } from '../types';

export const STUDIO = {
  deskZ: 0.12,
  deskTop: 0.72,
  deskW: 3.1,
  deskD: 0.78,
  anchorX: 0.68,
  anchorZ: -0.52,
  backZ: -2.6,
  screen: { center: v3(0, 2.28, -2.52), width: 3.3, height: 1.86 },
  pillarsX: [-2.55, 2.55] as const,
} as const;
