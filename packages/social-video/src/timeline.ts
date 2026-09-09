import {
  parseFrameIndex, resolveVideoSpec, type RawVideoInput, type ResolvedVideoSpec, type SocialSceneId,
} from './schema';
import type { SocialFormatId } from './config';
import type { MatchState } from '../../../apps/game/src/types';
import type { SocialActorPose, SocialCameraPose, SocialEffects } from '../../../apps/game/src/renderer';
import {
  compileFaceoffTimeline, evaluateFaceoffFrame, faceoffFrameToRenderInput,
  type FaceoffTimelineData, type SocialFrameDescription,
} from './scenes/faceoff';
import {
  attackGoalFrameToRenderInput, compileAttackGoalTimeline, evaluateAttackGoalFrame,
  type AttackGoalFrameDescription, type AttackGoalTimelineData,
} from './scenes/attack-goal';

export type { SocialFrameDescription } from './scenes/faceoff';
export type { AttackGoalFrameDescription } from './scenes/attack-goal';

/** Any scene's evaluated frame: narrowed by the `scene` discriminant. */
export type SceneFrameDescription = SocialFrameDescription | AttackGoalFrameDescription;

/**
 * Compiled deterministic timeline: plain data, no THREE objects, no browser.
 * Pipeline: SocialVideoSpec → compileVideo() → CompiledSocialVideo →
 * evaluateFrame(frame) → SceneFrameDescription → sceneFrameToRenderInput()
 * → GameRenderer.renderSocial() → PNG.
 */
export interface CompiledSocialVideo {
  readonly scene: SocialSceneId;
  readonly home: string;
  readonly away: string;
  readonly format: SocialFormatId;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly fps: number;
  readonly duration: number;
  readonly totalFrames: number;
  readonly attackTeam: ResolvedVideoSpec['attackTeam'];
  readonly attackStyle: ResolvedVideoSpec['attackStyle'];
  readonly faceoff: FaceoffTimelineData;
  /** Staging payload for the attack-goal scene (null for other scenes). */
  readonly attackGoal: AttackGoalTimelineData | null;
}

/** Compile raw agent/CLI input into a deterministic timeline. Pure. */
export function compileVideo(input: RawVideoInput): CompiledSocialVideo {
  const resolved: ResolvedVideoSpec = resolveVideoSpec(input);
  if (resolved.scene !== 'faceoff' && resolved.scene !== 'attack-goal') {
    throw new Error(`Unsupported scene: ${resolved.scene}`);
  }
  return Object.freeze({
    scene: resolved.scene,
    home: resolved.home,
    away: resolved.away,
    format: resolved.format,
    seed: resolved.seed,
    width: resolved.width,
    height: resolved.height,
    pixelRatio: resolved.pixelRatio,
    fps: resolved.fps,
    duration: resolved.duration,
    totalFrames: resolved.totalFrames,
    attackTeam: resolved.attackTeam,
    attackStyle: resolved.attackStyle,
    faceoff: compileFaceoffTimeline(resolved),
    attackGoal: resolved.scene === 'attack-goal' ? compileAttackGoalTimeline(resolved) : null,
  });
}

/**
 * Evaluate one frame. Pure random-access function of (compiled, frame):
 * frame 75 renders identically with or without prior evaluations.
 * Throws a clear error for out-of-range indices.
 */
export function evaluateFrame(compiled: CompiledSocialVideo, frame: number): SceneFrameDescription {
  parseFrameIndex(frame, compiled.totalFrames, compiled.fps, compiled.duration);
  if (compiled.scene === 'attack-goal') {
    if (!compiled.attackGoal) throw new Error('Missing attack-goal staging');
    return evaluateAttackGoalFrame({
      data: compiled.attackGoal,
      home: compiled.home,
      away: compiled.away,
      seed: compiled.seed,
      frame,
      fps: compiled.fps,
      duration: compiled.duration,
    });
  }
  if (compiled.scene !== 'faceoff') {
    throw new Error(`Unsupported scene: ${compiled.scene}`);
  }
  return evaluateFaceoffFrame({
    data: compiled.faceoff,
    home: compiled.home,
    away: compiled.away,
    frame,
    fps: compiled.fps,
    duration: compiled.duration,
  });
}

/** Final dumb-renderer input for any scene (no timeline left in it). */
export interface SocialRenderInput {
  state: MatchState;
  camera: SocialCameraPose;
  clock: number;
  pose: SocialActorPose[];
  effects?: SocialEffects;
}

/**
 * Map an evaluated frame description onto renderer input. The renderer only
 * ever sees this — never specs, seeds, frames or beats.
 */
export function sceneFrameToRenderInput(
  compiled: CompiledSocialVideo,
  desc: SceneFrameDescription,
): SocialRenderInput {
  if (desc.scene === 'attack-goal') {
    return attackGoalFrameToRenderInput(desc, compiled.home, compiled.away);
  }
  return { ...faceoffFrameToRenderInput(desc, compiled.home, compiled.away), effects: undefined };
}

/** Deterministic zero-padded frame filename (6 digits, PNG only for now). */
export function frameFilename(frame: number): string {
  return `${String(frame).padStart(6, '0')}.png`;
}
