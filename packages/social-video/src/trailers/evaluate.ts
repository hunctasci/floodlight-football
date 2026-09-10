import { parseFrameIndex } from '../schema';
import { evaluateFaceoffFrame } from '../scenes/faceoff';
import { evaluateAttackGoalFrame } from '../scenes/attack-goal';
import { evaluateCrossHeaderFrame } from '../scenes/cross-header-goal';
import { evaluateCrossbarFrame } from '../scenes/crossbar-chaos';
import { evaluateKeeperFrame } from '../scenes/keeper-disaster';
import { evaluateOverlayFrame } from '../overlays/evaluate';
import type { OverlayFrameDescription } from '../overlays/types';
import { CAMERA_MOTION, presetLens, isFiniteLens } from '../cameras/presets';
import { lerp, segmentProgress } from '../timeline/math';
import { sceneFrameToRenderInput, type SceneFrameDescription, type SocialRenderInput } from '../timeline';
import type { CompiledTrailer, CompiledTrailerSegment, TrailerActorRef } from './types';

/**
 * Trailer frame evaluation: global frame → active shot → source-local time →
 * existing scene evaluators (choreography reused, never duplicated) → optional
 * camera override → render input. Random-access and deterministic.
 */

export interface TrailerFrameResult {
  input: SocialRenderInput;
  overlays: OverlayFrameDescription;
  segment: CompiledTrailerSegment;
  /** Source-local time in seconds (for source-identity checks). */
  localTime: number;
  /** Source-local frame index evaluated. */
  localFrame: number;
}

/** Active shot for a global time ([start, end); last shot covers endpoint). */
export function trailerSegmentAtTime(tpl: CompiledTrailer, time: number): CompiledTrailerSegment {
  let active = tpl.shots[tpl.shots.length - 1];
  for (const seg of tpl.shots) {
    if (time >= seg.start) active = seg;
    else break;
  }
  return active;
}

/** Source-local time for a global time inside a shot segment. */
export function trailerLocalTime(seg: CompiledTrailerSegment, globalTime: number): number {
  const t = Math.min(Math.max(globalTime, seg.start), seg.end);
  return seg.srcStart + (t - seg.start) * seg.rate;
}

/** Source-local frame index (deterministic, clamped to the source video). */
export function trailerLocalFrame(
  tpl: CompiledTrailer, seg: CompiledTrailerSegment, frame: number,
): number {
  const globalTime = frame / tpl.fps;
  const local = trailerLocalTime(seg, globalTime);
  const total = seg.video.totalFrames;
  return Math.min(total - 1, Math.max(0, Math.round(local * tpl.fps)));
}

function evaluateSourceScene(
  tpl: CompiledTrailer,
  seg: CompiledTrailerSegment,
  localFrame: number,
): SceneFrameDescription {
  const v = seg.video;
  switch (seg.source) {
    case 'faceoff':
      return evaluateFaceoffFrame({
        data: v.faceoff, home: v.home, away: v.away,
        frame: localFrame, fps: tpl.fps, duration: v.duration,
      });
    case 'attack-goal':
      if (!v.attackGoal) throw new Error('Missing attack-goal staging');
      return evaluateAttackGoalFrame({
        data: v.attackGoal, home: v.home, away: v.away, seed: v.seed,
        frame: localFrame, fps: tpl.fps, duration: v.duration,
      });
    case 'cross-header-goal':
      if (!v.crossHeader) throw new Error('Missing cross-header-goal staging');
      return evaluateCrossHeaderFrame({
        data: v.crossHeader, home: v.home, away: v.away, seed: v.seed,
        frame: localFrame, fps: tpl.fps, duration: v.duration,
      });
    case 'crossbar-chaos':
      if (!v.crossbar) throw new Error('Missing crossbar-chaos staging');
      return evaluateCrossbarFrame({
        data: v.crossbar, home: v.home, away: v.away, seed: v.seed,
        frame: localFrame, fps: tpl.fps, duration: v.duration,
      });
    case 'keeper-disaster':
      if (!v.keeper) throw new Error('Missing keeper-disaster staging');
      return evaluateKeeperFrame({
        data: v.keeper, home: v.home, away: v.away, seed: v.seed,
        frame: localFrame, fps: tpl.fps, duration: v.duration,
      });
  }
}

function actorAnchor(desc: SceneFrameDescription, ref: TrailerActorRef | undefined): { x: number; z: number } | undefined {
  const full = actorAnchorFull(desc, ref);
  return full ? { x: full.x, z: full.z } : undefined;
}

function actorAnchorFull(
  desc: SceneFrameDescription, ref: TrailerActorRef | undefined,
): { x: number; z: number; fx: number; fz: number } | undefined {
  if (!ref || ref.kind === 'ball') return undefined;
  if (desc.scene === 'faceoff') {
    if (ref.kind === 'faceoff-home') return { x: desc.home.x, z: desc.home.z, fx: desc.home.facingX, fz: desc.home.facingZ };
    if (ref.kind === 'faceoff-away') return { x: desc.away.x, z: desc.away.z, fx: desc.away.facingX, fz: desc.away.facingZ };
    return undefined;
  }
  const actors = namedActors(desc);
  if (actors.length === 0) return undefined;
  const toFull = (a: NamedActor): { x: number; z: number; fx: number; fz: number } => ({
    x: a.x, z: a.z,
    fx: (a as { facingX?: number }).facingX ?? 1,
    fz: (a as { facingZ?: number }).facingZ ?? 0,
  });
  if (ref.kind === 'keeper') {
    const k = actors.find((a) => a.keeper) ?? actors[actors.length - 1];
    return toFull(k);
  }
  if (ref.kind === 'scene-index') {
    return toFull(actors[Math.min(ref.index, actors.length - 1)]);
  }
  return undefined;
}

function keeperAnchor(desc: SceneFrameDescription): { x: number; z: number } | undefined {
  if (desc.scene === 'faceoff') return undefined;
  const actors = (desc as { actors?: { x: number; z: number; keeper?: boolean }[] }).actors;
  const k = actors?.find((a) => a.keeper);
  return k ? { x: k.x, z: k.z } : undefined;
}

interface NamedActor {
  x: number;
  z: number;
  keeper?: boolean;
  name?: string;
}

function namedActors(desc: SceneFrameDescription): NamedActor[] {
  if (desc.scene === 'faceoff') return [];
  return (desc as { actors?: NamedActor[] }).actors ?? [];
}

/**
 * Defender-aware side flip for duel lenses (header-impact, striker-low,
 * reaction-scorer): the staged defender challenges on one side of the
 * ball/striker line, and a fixed-side camera can end up staring at his back
 * (seed-dependent). Shooting from the opposite side keeps the striker's face
 * and the ball readable with the defender as contest, not a wall. Pure
 * function of the evaluated world state — deterministic, random-access.
 */
function defenderFlipSide(desc: SceneFrameDescription, refZ: number): 1 | -1 {
  const defender = namedActors(desc).find((a) => !a.keeper && (a.name ?? '').includes('Defender'));
  if (!defender) return 1;
  return defender.z > refZ ? -1 : 1;
}

function lateralFor(seg: CompiledTrailerSegment): number {
  const v = seg.video;
  if (v.faceoff) return v.faceoff.cameraLateral;
  if (seg.source === 'attack-goal' && v.attackGoal) return v.attackGoal.cameraLateral;
  if (seg.source === 'cross-header-goal' && v.crossHeader) return v.crossHeader.cameraLateral;
  if (seg.source === 'crossbar-chaos' && v.crossbar) return v.crossbar.cameraLateral;
  if (seg.source === 'keeper-disaster' && v.keeper) return v.keeper.cameraLateral;
  return 0;
}

/**
 * Gentle deterministic push/pull for in-place shots (portraits, reactions):
 * pure function of segment progress — random-access safe. Tracking shots
 * ride the ball and bypass this.
 */
function pushedLens(
  seg: CompiledTrailerSegment,
  globalTime: number,
  lens: SceneFrameDescription['camera'],
): SceneFrameDescription['camera'] {
  if (!isFiniteLens(lens)) throw new Error(`Non-finite trailer lens: ${seg.id}`);
  if (seg.camera === 'source') return lens;
  const motion = CAMERA_MOTION[seg.camera];
  if (motion === 'tracking') return lens;
  const p = segmentProgress(globalTime, seg.start, seg.end);
  if (motion === 'pull-back') {
    const pull = p * 0.08;
    return {
      pos: { x: lerp(lens.pos.x, lens.look.x, -pull), y: lens.pos.y + pull * 4, z: lerp(lens.pos.z, lens.look.z, -pull) },
      look: { ...lens.look },
      fov: lens.fov + p * 1.5,
    };
  }
  const push = p * 0.07;
  return {
    pos: { x: lerp(lens.pos.x, lens.look.x, push), y: lerp(lens.pos.y, lens.look.y, push * 0.6), z: lerp(lens.pos.z, lens.look.z, push) },
    look: { ...lens.look },
    fov: lens.fov - p * 1.5,
  };
}

/**
 * Camera override: rebuild the lens from the evaluated world state (ball +
 * actor anchors) via the semantic preset vocabulary. The world state is
 * untouched — only the lens changes. A gentle deterministic push-in applies
 * to in-place (non-tracking) shots so portraits never read frozen; tracking
 * shots ride the ball and need no synthetic motion.
 */
function overrideLens(
  seg: CompiledTrailerSegment,
  desc: SceneFrameDescription,
  globalTime: number,
): SceneFrameDescription['camera'] {
  if (seg.camera === 'source') return desc.camera;
  const ball = desc.ball;
  const anchor = actorAnchor(desc, seg.actor);
  const keeper = keeperAnchor(desc);
  const lateral = lateralFor(seg);
  // Tribune lenses look ALONG the stand (see below).
  if (
    seg.camera === 'reaction-crowd'
    || seg.camera === 'crowd-low'
    || seg.camera === 'behind-supporters'
  ) {
    // Tribune oblique: the shared into-the-stand presets park the lens among
    // the supporter blocks (giant cubes) and tilt up into the unlit roof.
    // The trailer instead looks DOWN along the stepped tribune from above:
    // blocks/steps recede with real depth, the wave reads top-down, the
    // roof stays out of frame, boards + pitch anchor the bottom.
    const cx = ball.x * 0.2 + lateral;
    return pushedLens(seg, globalTime, {
      pos: { x: cx, y: 7.5, z: -15 },
      look: { x: cx - 7, y: 1.0, z: -31 },
      fov: 50,
    });
  }
  // Duel lenses pick the defender-clear side (see defenderFlipSide).
  if (seg.camera === 'header-impact') {
    // Front-side hero: the striker faces downfield (+x) at contact, so a
    // behind-side lens frames only his number with the ball eclipsed behind
    // his shoulder. From the goal side his face + the ball at his head read
    // together, the beaten defender stays in frame as contest (opposite
    // side), and the far tribune sits behind. The keeper gets the very next
    // shot (s14) instead of crowding this one.
    const side = defenderFlipSide(desc, ball.z);
    return pushedLens(seg, globalTime, {
      pos: { x: ball.x + 2.8 + lateral, y: 2.3, z: ball.z + side * 3.0 },
      look: { x: ball.x - 0.5, y: 1.6, z: ball.z },
      fov: 48,
    });
  }
  if (seg.camera === 'striker-low') {
    const side = defenderFlipSide(desc, ball.z);
    return pushedLens(seg, globalTime, {
      pos: { x: ball.x - 3.4 + lateral, y: 1.7, z: ball.z + side * 5.4 },
      look: { x: ball.x + 1, y: 1.5, z: ball.z - side * 0.5 },
      fov: 50,
    });
  }
  if (seg.camera === 'reaction-scorer') {
    // Celebration front: the scorer turns to the crowd, so the camera leads
    // with his facing (plus a 3/4 offset) — never his back. The beaten
    // defender loiters nearby, so the lateral side is picked AWAY from him:
    // otherwise his back fills the foreground (he faces the goal, we would
    // catch him from behind). Pure world-state function, still deterministic.
    const full = actorAnchorFull(desc, seg.actor);
    if (full) {
      const fl = Math.hypot(full.fx, full.fz) || 1;
      const fx = full.fx / fl, fz = full.fz / fl;
      const px = -fz, pz = fx;
      const defender = namedActors(desc).find((a) => !a.keeper && (a.name ?? '').includes('Defender'));
      let s = 1;
      if (defender) {
        const dx = defender.x - full.x, dz = defender.z - full.z;
        if (px * dx + pz * dz > 0) s = -1;
      }
      return pushedLens(seg, globalTime, {
        pos: { x: full.x + fx * 2.6 + px * 1.6 * s + lateral, y: 2.2, z: full.z + fz * 2.6 + pz * 1.6 * s },
        look: { x: full.x, y: 1.3, z: full.z },
        fov: 50,
      });
    }
    if (anchor) {
      const side = defenderFlipSide(desc, anchor.z);
      return pushedLens(seg, globalTime, {
        pos: { x: anchor.x - 2.0 + lateral, y: 2.2, z: anchor.z + side * 4.0 },
        look: { x: anchor.x + 0.4, y: 1.3, z: anchor.z - side * 0.3 },
        fov: 50,
      });
    }
  }
  const lens = presetLens(seg.camera, {
    ball: { x: ball.x, y: ball.y, z: ball.z },
    ...(anchor ? { actor: anchor } : {}),
    ...(keeper ? { keeper } : {}),
    goalX: 46,
    lateral,
  });
  return pushedLens(seg, globalTime, lens);
}

/**
 * Evaluate one global trailer frame. Pure random-access function of
 * (compiled, frame): shot cuts are hard (no interpolation between lenses).
 */
export function evaluateTrailerFrame(tpl: CompiledTrailer, frame: number): TrailerFrameResult {
  parseFrameIndex(frame, tpl.totalFrames, tpl.fps, tpl.duration);
  const globalTime = frame / tpl.fps;
  const seg = trailerSegmentAtTime(tpl, globalTime);
  const localFrame = trailerLocalFrame(tpl, seg, frame);
  const localTime = localFrame / tpl.fps;
  const desc = evaluateSourceScene(tpl, seg, localFrame);
  const camera = overrideLens(seg, desc, globalTime);
  const withCam = { ...desc, camera } as SceneFrameDescription;
  return {
    input: sceneFrameToRenderInput(seg.video, withCam),
    overlays: evaluateOverlayFrame(tpl.overlayPlan, frame, tpl.fps),
    segment: seg,
    localTime,
    localFrame,
  };
}
