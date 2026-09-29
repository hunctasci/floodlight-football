/**
 * World events that persist across a scene's beats. A world effect written on
 * one beat (`{ type: 'ball-roll', at: 0.3 }`) changes the world for the rest
 * of the scene: the next beat still sees the ball where it stopped. Worlds
 * read every event of their scene from the timeline, so stills, video and QA
 * agree from any absolute frame. Pure.
 */
import type { FxEvent, Shot, Timeline } from '../engine/timeline/types';

export type SceneShots = Pick<Timeline, 'shots'>;

/** All fx of `type` in the shot's scene, in time order. */
export function sceneFx(tl: SceneShots | undefined, shot: Shot, type: string): FxEvent[] {
  const shots = tl ? tl.shots.filter((s) => s.scene === shot.scene) : [shot];
  return shots.flatMap((s) => s.fx.filter((e) => e.type === type)).sort((a, b) => a.start - b.start);
}

/** 0..1 progress through the latest started event of `type` (undefined = none yet). */
export function eventProgress(tl: SceneShots | undefined, shot: Shot, type: string, frame: number): { p: number; ev: FxEvent } | undefined {
  const evs = sceneFx(tl, shot, type).filter((e) => frame >= e.start);
  const ev = evs[evs.length - 1];
  if (!ev) return undefined;
  return { p: Math.min(1, Math.max(0, (frame - ev.start) / Math.max(1, ev.end - ev.start))), ev };
}

/** Has any event of `type` started by `frame`? */
export function happened(tl: SceneShots | undefined, shot: Shot, type: string, frame: number): boolean {
  return sceneFx(tl, shot, type).some((e) => frame >= e.start);
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const smooth01 = (v: number): number => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
