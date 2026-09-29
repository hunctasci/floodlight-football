/**
 * Breakroom world state from scene events (pure; renderer, camera and QA
 * share it): where the cup is, whether it is in someone's hand, blinds,
 * flicker level.
 */
import type { Shot } from '../../engine/timeline/types';
import { clamp01, eventProgress, happened, sceneFx, smooth01, type SceneShots } from '../events';
import type { Vec3 } from '../types';
import { BREAK, CUP_SLIDE } from './layout';

export interface CupState {
  pos: Vec3;
  /** Tumble rotation (rad) while falling. */
  roll: number;
  visible: boolean;
  onFloor: boolean;
}

/** Last cup: rests, slides toward one side (`cup-slide` intensity -1 left / +1 right), tips off the edge (`cup-tip`), is taken (`cup-take`). */
export function cupState(tl: SceneShots | undefined, shot: Shot, frame: number, fps: number): CupState {
  const present = shot.set.cup !== false;
  let x = BREAK.cup.x;
  for (const e of sceneFx(tl, shot, 'cup-slide')) {
    if (frame < e.start) continue;
    const p = smooth01((frame - e.start) / Math.max(1, e.end - e.start));
    x += Math.sign(e.intensity || 1) * CUP_SLIDE * p;
  }
  const base = { x, y: BREAK.cup.y, z: BREAK.cup.z };
  if (!present || happened(tl, shot, 'cup-take', frame)) return { pos: base, roll: 0, visible: false, onFloor: false };
  const tip = sceneFx(tl, shot, 'cup-tip').find((e) => frame >= e.start);
  if (!tip) return { pos: base, roll: 0, visible: true, onFloor: false };
  // Tips over the counter edge, then free-falls (real gravity) to the floor spot.
  const t = (frame - tip.start) / fps;
  const tipT = 0.22;
  if (t < tipT) {
    const k = smooth01(t / tipT);
    return { pos: { x: base.x + 0.03 * k, y: base.y - 0.02 * k, z: base.z + 0.12 * k }, roll: 0.9 * k, visible: true, onFloor: false };
  }
  const ft = t - tipT;
  const fall = Math.sqrt((2 * (base.y - 0.02 - BREAK.floorSpot.y)) / 9.81);
  if (ft < fall) {
    const k = ft / fall;
    return {
      pos: { x: base.x + 0.03 + (BREAK.floorSpot.x - base.x) * k, y: base.y - 0.02 - 0.5 * 9.81 * ft * ft, z: base.z + 0.12 + (BREAK.floorSpot.z - base.z - 0.12) * k },
      roll: 0.9 + 7.5 * ft,
      visible: true,
      onFloor: false,
    };
  }
  return { pos: { x: BREAK.floorSpot.x, y: BREAK.floorSpot.y - 0.02, z: BREAK.floorSpot.z }, roll: Math.PI / 2, visible: true, onFloor: true };
}

/** Frames (absolute) the cup reaches the floor, for match cuts / sounds. */
export function cupFloorFrame(fps: number, tipStart: number): number {
  const fall = Math.sqrt((2 * (BREAK.cup.y - 0.02 - BREAK.floorSpot.y)) / 9.81);
  return tipStart + Math.round((0.22 + fall) * fps);
}

/** Blinds 0 open .. 1 closed (`set.blinds` start value, `blinds-close` event). */
export function blindsState(tl: SceneShots | undefined, shot: Shot, frame: number): number {
  const base = typeof shot.set.blinds === 'number' ? (shot.set.blinds as number) : 0;
  const e = eventProgress(tl, shot, 'blinds-close', frame);
  return e ? base + (1 - base) * clamp01(e.p) : base;
}
