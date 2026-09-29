/** Deterministic camera-space impact math (pure). */

/**
 * Camera-space impact shake (metres) `framesSince` frames after a hit:
 * two incommensurate high frequencies under a fast exponential decay, so the
 * hit reads as one sharp jolt that settles — not a constant wobble.
 */
export function impactShake(
  framesSince: number,
  fps: number,
  intensity: number,
  seed = 42,
): { x: number; y: number; z: number } {
  if (framesSince < 0 || intensity <= 0) return { x: 0, y: 0, z: 0 };
  const t = framesSince / fps;
  const env = Math.exp(-t * 7) * intensity;
  const ph = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * Math.PI * 2;
  };
  const w = Math.PI * 2;
  return {
    x: (Math.sin(t * w * 17 + ph(1)) * 0.6 + Math.sin(t * w * 29 + ph(2)) * 0.4) * 0.09 * env,
    y: (Math.sin(t * w * 21 + ph(3)) * 0.6 + Math.sin(t * w * 33 + ph(4)) * 0.4) * 0.07 * env,
    z: Math.sin(t * w * 13 + ph(5)) * 0.03 * env,
  };
}

/** FOV delta (degrees) for a zoom punch: snaps in over 2 frames, relaxes out. */
export function zoomPunch(framesSince: number, fps: number, intensity: number): number {
  if (framesSince < 0) return 0;
  const t = framesSince / fps;
  const attack = 2 / 60;
  const k = t < attack ? t / attack : Math.exp(-(t - attack) * 6);
  return -6 * intensity * k;
}
