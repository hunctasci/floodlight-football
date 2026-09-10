/** Semantic easing library. Pure functions of t in [0,1]. */

export type EasingId = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'back-out' | 'bounce-out' | 'punch';

export function applyEasing(id: EasingId, t: number): number {
  const x = Math.min(1, Math.max(0, t));  switch (id) {
    case 'linear':
      return x;
    case 'ease-in':
      return x * x * x;
    case 'ease-out':
      return 1 - Math.pow(1 - x, 3);
    case 'ease-in-out':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'back-out': {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    }
    case 'bounce-out': {
      let y = x;
      if (y < 1 / 2.75) return 7.5625 * y * y;
      if (y < 2 / 2.75) return 7.5625 * (y -= 1.5 / 2.75) * y + 0.75;
      if (y < 2.5 / 2.75) return 7.5625 * (y -= 2.25 / 2.75) * y + 0.9375;
      return 7.5625 * (y -= 2.625 / 2.75) * y + 0.984375;
    }
    case 'punch':
      // Fast overshoot punch for comedic impacts: peaks at t≈0.35.
      return Math.sin(Math.min(1, x * 1.15) * Math.PI) * (1 - x * 0.25);
  }
}
