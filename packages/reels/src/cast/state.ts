/**
 * Cast member state at a frame — ONE pure function shared by the renderer
 * (pose the canonical rig), the camera (frame the head) and QA (framing,
 * speed). Deterministic from absolute frame: action keys, marks and moves
 * are all resolved in the Timeline.
 */
import { blendHncBodyPose, HNC_SIT_DROP, type HncBodyPose } from '@floodlight/hnc-visuals';
import type { ActorTrack, Shot } from '../engine/timeline/types';
import { getWorld } from '../worlds/registry';
import type { Mark, Vec3 } from '../worlds/types';
import { v3 } from '../worlds/types';
import { actionPose, getAction } from './actions';

export interface ActorState {
  pos: Vec3;
  facing: number;
  pose: HncBodyPose;
  moving: boolean;
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const smooth = (x: number): number => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const DEFAULT_BLEND = 0.18;

export function markOf(shot: Shot, id: string): Mark {
  const m = getWorld(shot.world).marks[id];
  if (!m) throw new Error(`Unknown mark "${id}" in world "${shot.world}"`);
  return m;
}

/** Posture (1 seated / 0 standing) in force before key `k`. */
function postureBefore(track: ActorTrack, k: number, base: number): number {
  let sit = base;
  for (let i = 0; i < k; i++) {
    const p = getAction(track.keys[i].action).posture;
    if (p) sit = p === 'sit' ? 1 : 0;
  }
  return sit;
}

function placement(shot: Shot, track: ActorTrack, frame: number): { pos: Vec3; facing: number; moving: boolean; walkT: number } {
  const from = markOf(shot, track.mark);
  const mv = track.move;
  if (!mv || frame <= mv.start) return { pos: v3(from.x, 0, from.z), facing: from.facing, moving: false, walkT: 0 };
  const to = markOf(shot, mv.to);
  const p = clamp((frame - mv.start) / Math.max(1, mv.end - mv.start), 0, 1);
  const k = smooth(p);
  const pos = v3(from.x + (to.x - from.x) * k, 0, from.z + (to.z - from.z) * k);
  const travel = Math.atan2(to.x - from.x, to.z - from.z);
  // Turn into the walk quickly, turn to the destination facing on arrival.
  const turnIn = smooth(p / 0.18);
  const turnOut = smooth((p - 0.8) / 0.2);
  const facing = from.facing + wrap(travel - from.facing) * turnIn + wrap(to.facing - travel) * turnOut;
  return { pos, facing, moving: p < 1, walkT: frame - mv.start };
}

/**
 * State at `frame`. `target` resolves a gaze target to a world point; omit
 * it (camera / subject evaluation) to skip gaze.
 */
export function actorState(shot: Shot, track: ActorTrack, frame: number, fps: number, target?: (id: string) => Vec3 | undefined): ActorState {
  const base = markOf(shot, track.mark).posture === 'sit' ? 1 : 0;
  const { pos, facing, moving, walkT } = placement(shot, track, frame);
  let k = 0;
  while (k + 1 < track.keys.length && track.keys[k + 1].frame <= frame) k++;
  const key = track.keys[k];
  const def = getAction(key.action);
  const sitNow = track.move && frame > track.move.start ? 0 : postureBefore(track, k, base);
  let pose = actionPose(key.action, (frame - (key.origin ?? key.frame)) / fps, sitNow);
  const blendFrames = Math.max(1, (def.blend ?? DEFAULT_BLEND) * fps);
  const w = k > 0 ? smooth((frame - key.frame) / blendFrames) : 1;
  if (k > 0 && w < 1) {
    const prev = track.keys[k - 1];
    const prevPose = actionPose(prev.action, (frame - (prev.origin ?? prev.frame)) / fps, postureBefore(track, k - 1, base));
    pose = blendHncBodyPose(prevPose, pose, w);
  }
  if (track.move && frame > track.move.start) {
    const loco = actionPose(def.locomotion ? key.action : 'walk', walkT / fps, 0);
    const out = moving ? 1 : 1 - smooth((frame - track.move.end) / (0.25 * fps));
    pose = blendHncBodyPose(pose, { ...pose, legLX: loco.legLX, legRX: loco.legRX, armLX: loco.armLX, armRX: loco.armRX, y: loco.y }, out);
  }
  if (target && key.lookAt) pose = withGaze(pose, def.gaze, headPoint(pos, facing, pose), facing, target(key.lookAt), w);
  return { pos, facing, pose, moving };
}

/** World position of the head centre for a posed actor. */
export function headPoint(pos: Vec3, facing: number, pose: HncBodyPose): Vec3 {
  const rootY = pose.y - HNC_SIT_DROP * pose.sit;
  const fwd = 1.7 * Math.sin(pose.pitch);
  const yaw = facing + pose.yaw;
  return v3(pos.x + Math.sin(yaw) * fwd, rootY + 1.7 * Math.cos(pose.pitch), pos.z + Math.cos(yaw) * fwd);
}

function withGaze(
  pose: HncBodyPose,
  gaze: { eyes: number; head: number; body: number },
  head: Vec3,
  facing: number,
  point: Vec3 | undefined,
  w: number,
): HncBodyPose {
  if (!point) return pose;
  const dx = point.x - head.x;
  const dz = point.z - head.z;
  const rel = wrap(Math.atan2(dx, dz) - facing - pose.yaw);
  const elev = Math.atan2(point.y - head.y, Math.hypot(dx, dz));
  const body = clamp(rel * gaze.body, -0.9, 0.9);
  const rest = rel - body;
  const headYaw = clamp(rest * gaze.head, -1.05, 1.05);
  const eyeYaw = clamp(((rest - headYaw) / 0.32) * gaze.eyes, -1, 1);
  const headPitch = clamp(-elev * gaze.head, -0.6, 0.6);
  const eyePitch = clamp(((elev + headPitch) / 0.22) * gaze.eyes, -1, 1);
  const g = w;
  return {
    ...pose,
    yaw: pose.yaw + body * g,
    headYaw: pose.headYaw + headYaw * g,
    headPitch: pose.headPitch + headPitch * g,
    gazeX: clamp(pose.gazeX + eyeYaw * g, -1, 1),
    gazeY: clamp(pose.gazeY + eyePitch * g, -1, 1),
  };
}
