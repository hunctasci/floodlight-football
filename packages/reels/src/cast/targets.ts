/**
 * Gaze targets for a shot at a frame: 'camera' (the lens — talking to
 * camera), other cast members' heads, and the world's props / lights /
 * surfaces. Pure; shared by every 3D world scene.
 */
import type { Shot } from '../engine/timeline/types';
import { getWorld } from '../worlds/registry';
import type { Lens, Vec3 } from '../worlds/types';
import { actorState, headPoint } from './state';

export function gazeTargets(shot: Shot, frame: number, fps: number, lens?: Lens): (id: string) => Vec3 | undefined {
  const world = getWorld(shot.world);
  return (id) => {
    if (id === 'camera') return lens?.pos;
    const track = shot.actors.find((a) => a.cast === id);
    if (track) {
      const st = actorState(shot, track, frame, fps);
      return headPoint(st.pos, st.facing, st.pose);
    }
    return world.props[id]?.pos ?? world.lights[id] ?? world.surfaces[id]?.center;
  };
}
