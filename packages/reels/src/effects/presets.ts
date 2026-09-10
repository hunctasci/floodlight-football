export const EFFECT_IDS = [
  'screen-shake',
  'zoom-punch',
  'freeze-frame',
  'speed-lines',
  'confetti',
  'impact-flash',
  'emoji-burst',
  'glitch',
  'vignette',
  'film-grain',
  'chromatic-aberration',
  'bloom',
  'pixelation',
] as const;

export type EffectId = (typeof EFFECT_IDS)[number];

/**
 * Deterministic screen-shake offset (metres in camera space) from absolute frame.
 * Seeded so every Reel shakes differently but repeatably.
 */
export function screenShakeOffset(
  frame: number,
  intensity: number,
  seed = 42,
): { x: number; y: number } {
  if (intensity <= 0) return { x: 0, y: 0 };
  const t = frame * 0.9;
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const decay = 1;
  return {
    x: Math.sin(t * 5.3 + h(1) * 6.28) * 0.12 * intensity * decay,
    y: Math.cos(t * 7.1 + h(2) * 6.28) * 0.08 * intensity * decay,
  };
}
