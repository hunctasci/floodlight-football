/** Apartment world state from scene events (pure). */
import type { Shot } from '../../engine/timeline/types';
import { eventProgress, happened, smooth01, type SceneShots } from '../events';
import type { Vec3 } from '../types';
import { APT } from './layout';

/** The ball rolls out of the hallway (`ball-roll`) and settles; before that it is nowhere. */
export function ballState(tl: SceneShots | undefined, shot: Shot, frame: number): { pos: Vec3; spin: number; visible: boolean } {
  const e = eventProgress(tl, shot, 'ball-roll', frame);
  if (!e) return { pos: APT.ballFrom, spin: 0, visible: false };
  // Decelerating roll (constant friction): distance ∝ 1-(1-p)^2.
  const k = 1 - (1 - e.p) ** 2;
  const pos = { x: APT.ballFrom.x + (APT.ballTo.x - APT.ballFrom.x) * k, y: 0.25, z: APT.ballFrom.z + (APT.ballTo.z - APT.ballFrom.z) * k };
  const dist = Math.hypot(pos.x - APT.ballFrom.x, pos.z - APT.ballFrom.z);
  return { pos, spin: dist / 0.25, visible: true };
}

/** 0..1: the room turning into floodlight (`room-shift`). */
export function roomShift(tl: SceneShots | undefined, shot: Shot, frame: number): number {
  const e = eventProgress(tl, shot, 'room-shift', frame);
  return e ? smooth01(e.p) : 0;
}

export const phoneAwake = (tl: SceneShots | undefined, shot: Shot, frame: number): boolean => happened(tl, shot, 'phone-wake', frame);
export const scarfPacked = (tl: SceneShots | undefined, shot: Shot, frame: number): boolean => happened(tl, shot, 'scarf-in', frame);
export const remoteDown = (tl: SceneShots | undefined, shot: Shot, frame: number): boolean => happened(tl, shot, 'remote-down', frame) || shot.set.remote === 'table';
