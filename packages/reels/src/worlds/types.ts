/**
 * World contract (pure half). A world declares WHERE things are — marks the
 * cast can occupy, props / lights / screens the camera can aim at, its own
 * named lenses — plus its parameters and default ambience. Rendering lives in
 * the world's scene component (render/worlds.tsx maps id → component).
 *
 * Nothing here imports React, so the director, camera, QA linter and tests
 * all evaluate worlds in Node.
 */
import type { CastMember, Shot, Timeline } from '../engine/timeline/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Lens {
  pos: Vec3;
  look: Vec3;
  fov: number;
}

export interface Mark {
  x: number;
  z: number;
  /** Yaw: 0 faces +z. */
  facing: number;
  posture: 'sit' | 'stand';
}

export interface PropDef {
  pos: Vec3;
  /** Preferred direction from the prop toward a macro camera. */
  view?: Vec3;
  /** Rough size (m) — macro lenses frame it. */
  size?: number;
  summary?: string;
}

/** A flat screen in the world (monitor, studio wall, phone) that can show content. */
export interface SurfaceDef {
  center: Vec3;
  width: number;
  height: number;
  /** Yaw of the screen's outward normal (0 faces +z). */
  yaw: number;
  /** Default painter (render/screens.ts). */
  content?: string;
}

/** Anything a camera or a gaze can target. */
export interface Subject {
  kind: 'actor' | 'prop' | 'light' | 'surface' | 'ball';
  /** Ground point (actors) or centre. */
  pos: Vec3;
  /** Head / focus point. */
  head: Vec3;
  facing: number;
  /** Keep-out radius for "lens inside the subject" QA. */
  radius: number;
}

export interface WorldLensContext {
  shot: Shot;
  frame: number;
  fps: number;
  subject: (id: string) => Subject | undefined;
}

export interface WorldDef {
  id: string;
  kind: '3d' | '2d';
  summary: string;
  /** Documented `set` parameters. */
  params: Record<string, string>;
  marks: Record<string, Mark>;
  props: Record<string, PropDef>;
  lights: Record<string, Vec3>;
  surfaces: Record<string, SurfaceDef>;
  /** Default looks for cast without one in this world. */
  defaultLook?: string;
  /** Ambience bed cue (auto-added under the world's shots). */
  ambience?: string;
  /** World effects this world interprets (e.g. office: lights-flicker). */
  effects?: string[];
  /** World-specific lenses / moves (lens ids beyond the generic set). */
  lensIds: readonly string[];
  lens?: (id: string, ctx: WorldLensContext) => Lens | undefined;
  /** Parameter validation; returns human-readable problems. */
  validateSet?: (set: Record<string, unknown>, cast: Record<string, CastMember>) => string[];
  /** Cast subjects driven by the world itself (football choreography). */
  castSubjects?: (shot: Shot, frame: number, fps: number, timeline: Pick<Timeline, 'cast'>) => Record<string, Subject> | undefined;
  /** Extra world subjects at a frame (ball, keeper...). */
  dynamicSubjects?: (shot: Shot, frame: number, fps: number, tl?: Pick<Timeline, 'shots'>) => Record<string, Subject>;
  /** Named world-clock beats for `moment:` times. */
  momentBeats?: (set: Record<string, unknown>) => Record<string, number>;
  /** World clock length (seconds) for clocked beats. */
  clockLength?: (set: Record<string, unknown>) => number;
  /** 2D worlds: rect (design px, 1080-wide frame) of a surface, for zoom-through. */
  surfaceRect?: (id: string, shot: Shot, frame: number, height: number) => { x: number; y: number; w: number; h: number } | undefined;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
