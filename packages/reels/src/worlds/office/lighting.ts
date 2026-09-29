/**
 * Office light level at a frame (pure): 1 = normal. `lights-flicker` stutters
 * on a seeded schedule (always blinking in its first slots so it reads
 * immediately); `lights-surge` climbs to an overexposed white for a
 * light-bloom exit.
 */
import { random01 } from '../../utils/rng';
import type { Shot } from '../../engine/timeline/types';

export function officeLightLevel(shot: Pick<Shot, 'id' | 'fx'>, frame: number, fps: number, seed: number): number {
  let level = 1;
  for (const e of shot.fx) {
    if (frame < e.start || frame >= e.end) continue;
    const t = (frame - e.start) / fps;
    if (e.type === 'lights-flicker') {
      const slot = Math.floor(t * 15);
      const r = random01(seed, `flicker:${shot.id}:${e.start}:${slot}`);
      const dark = slot === 1 || slot === 3 || r < 0.34;
      if (dark) level *= 0.22 + 0.4 * random01(seed, `flicker-depth:${shot.id}:${slot}`) * (1 / e.intensity);
    } else if (e.type === 'lights-surge') {
      const p = (frame - e.start) / Math.max(1, e.end - e.start);
      level *= 1 + 2.6 * e.intensity * p * p;
    }
  }
  return level;
}
