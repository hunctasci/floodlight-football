/**
 * Subject resolution for a shot at a frame: cast members (from their tracks,
 * or from the world when it drives them — football choreography), dynamic
 * world subjects (ball, keeper), props, lights and screens. Pure.
 */
import { actorState, headPoint } from '../cast/state';
import { getWorld } from '../worlds/registry';
import type { Subject } from '../worlds/types';
import type { Shot, Timeline } from './timeline/types';

export type SubjectResolver = (id: string) => Subject | undefined;

export function subjectsAt(tl: Pick<Timeline, 'cast' | 'fps'>, shot: Shot, frame: number): SubjectResolver {
  const world = getWorld(shot.world);
  const cache = new Map<string, Subject | undefined>();
  let castFromWorld: Record<string, Subject> | undefined;
  let dynamic: Record<string, Subject> | undefined;
  return (id: string) => {
    if (cache.has(id)) return cache.get(id);
    let s: Subject | undefined;
    if (tl.cast[id]) {
      if (world.castSubjects) {
        castFromWorld ??= world.castSubjects(shot, frame, tl.fps, tl) ?? {};
        s = castFromWorld[id];
      } else {
        const track = shot.actors.find((a) => a.cast === id);
        if (track) {
          const st = actorState(shot, track, frame, tl.fps);
          s = { kind: 'actor', pos: st.pos, head: headPoint(st.pos, st.facing, st.pose), facing: st.facing, radius: 0.45 };
        }
      }
    }
    if (!s && world.dynamicSubjects) {
      dynamic ??= world.dynamicSubjects(shot, frame, tl.fps);
      s = dynamic[id];
    }
    const prop = world.props[id];
    if (!s && prop) {
      const facing = prop.view ? Math.atan2(prop.view.x, prop.view.z) : 0;
      s = { kind: 'prop', pos: prop.pos, head: prop.pos, facing, radius: prop.size ?? 0.2 };
    }
    const light = world.lights[id];
    if (!s && light) s = { kind: 'light', pos: light, head: light, facing: 0, radius: 0.3 };
    const surf = world.surfaces[id];
    if (!s && surf) s = { kind: 'surface', pos: surf.center, head: surf.center, facing: surf.yaw, radius: Math.max(surf.width, surf.height) / 2 };
    cache.set(id, s);
    return s;
  };
}

/**
 * Camera-side resolver: actor subjects low-passed over the last ~0.15s so a
 * lens framing a head follows it like an operator (no snap when someone
 * stands up). Facing is locked to the shot's first frame: an operator tracks
 * a subject who turns to walk away, they don't orbit around them.
 * Static subjects pass through.
 */
export function smoothedSubjectsAt(tl: Pick<Timeline, 'cast' | 'fps'>, shot: Shot, frame: number): SubjectResolver {
  const step = Math.max(1, Math.round(tl.fps / 30));
  const taps = [0, 1, 2, 3, 4].map((i) => frame - i * step);
  const weights = [5, 4, 3, 2, 1];
  const resolvers = taps.map((f) => subjectsAt(tl, shot, f));
  const now = resolvers[0];
  const first = subjectsAt(tl, shot, shot.start);
  return (id: string) => {
    const s = now(id);
    if (!s || s.kind !== 'actor') return s;
    let sum = 0;
    const acc = { px: 0, pz: 0, hx: 0, hy: 0, hz: 0 };
    resolvers.forEach((r, i) => {
      const t = r(id);
      if (!t) return;
      const w = weights[i];
      sum += w;
      acc.px += t.pos.x * w;
      acc.pz += t.pos.z * w;
      acc.hx += t.head.x * w;
      acc.hy += t.head.y * w;
      acc.hz += t.head.z * w;
    });
    return { ...s, facing: first(id)?.facing ?? s.facing, pos: { x: acc.px / sum, y: 0, z: acc.pz / sum }, head: { x: acc.hx / sum, y: acc.hy / sum, z: acc.hz / sum } };
  };
}
