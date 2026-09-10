import {
  parseFrameIndex, resolveVideoSpec, type RawVideoInput, type ResolvedVideoSpec, type SocialSceneId,
} from './schema';
import type { SocialFormatId } from './config';
import type { MatchState } from '../../../apps/game/src/types';
import type { SocialActorPose, SocialCameraPose, SocialEffects } from '../../../apps/game/src/renderer';
import type { SocialCrowdState } from '../../../apps/game/src/render/crowd';
import {
  compileFaceoffTimeline, evaluateFaceoffFrame, faceoffFrameToRenderInput,
  type FaceoffTimelineData, type SocialFrameDescription,
} from './scenes/faceoff';
import {
  attackGoalFrameToRenderInput, compileAttackGoalTimeline, evaluateAttackGoalFrame,
  type AttackGoalFrameDescription, type AttackGoalTimelineData,
} from './scenes/attack-goal';
import {
  compileCrossHeaderTimeline, crossHeaderFrameToRenderInput, evaluateCrossHeaderFrame,
  type CrossHeaderFrameDescription, type CrossHeaderTimelineData,
} from './scenes/cross-header-goal';
import {
  compileCrossbarTimeline, crossbarFrameToRenderInput, evaluateCrossbarFrame,
  type CrossbarFrameDescription, type CrossbarTimelineData,
} from './scenes/crossbar-chaos';
import {
  compileKeeperTimeline, evaluateKeeperFrame, keeperFrameToRenderInput,
  type KeeperFrameDescription, type KeeperTimelineData,
} from './scenes/keeper-disaster';
import { compileOverlayPlan } from './overlays/compile';
import { evaluateOverlayFrame } from './overlays/evaluate';
import type { OverlayFrameDescription, OverlayPlanEntry } from './overlays/types';

export type { SocialFrameDescription } from './scenes/faceoff';
export type { AttackGoalFrameDescription } from './scenes/attack-goal';
export type { CrossHeaderFrameDescription } from './scenes/cross-header-goal';
export type { CrossbarFrameDescription } from './scenes/crossbar-chaos';
export type { KeeperFrameDescription } from './scenes/keeper-disaster';
export type { EvaluatedOverlay, OverlayFrameDescription, OverlayKind, OverlayPlanEntry } from './overlays/types';

/** Any scene's evaluated frame: narrowed by the `scene` discriminant. */
export type SceneFrameDescription =
  | SocialFrameDescription
  | AttackGoalFrameDescription
  | CrossHeaderFrameDescription
  | CrossbarFrameDescription
  | KeeperFrameDescription;

/**
 * Compiled deterministic timeline: plain data, no THREE objects, no browser.
 * Pipeline: SocialVideoSpec → compileVideo() → CompiledSocialVideo →
 * evaluateFrame(frame) → SceneFrameDescription → sceneFrameToRenderInput()
 * → GameRenderer.renderSocial() → PNG, plus evaluateOverlays(frame) →
 * OverlayFrameDescription → renderOverlays(...) → HTML/CSS layers.
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
  readonly overlaysMode: ResolvedVideoSpec['overlays'];
  readonly headline: ResolvedVideoSpec['headline'];
  readonly secondary: ResolvedVideoSpec['secondary'];
  readonly cta: ResolvedVideoSpec['cta'];
  readonly faceoff: FaceoffTimelineData;
  /** Staging payload for the attack-goal scene (null for other scenes). */
  readonly attackGoal: AttackGoalTimelineData | null;
  /** Staging payloads for the arcade scenes (null for other scenes). */
  readonly crossHeader: CrossHeaderTimelineData | null;
  readonly crossbar: CrossbarTimelineData | null;
  readonly keeper: KeeperTimelineData | null;
  /** Semantic overlay plan: WHEN overlays appear (HOW lives in CSS/DOM). */
  readonly overlayPlan: OverlayPlanEntry[];
}

/** Compile raw agent/CLI input into a deterministic timeline. Pure. */
export function compileVideo(input: RawVideoInput): CompiledSocialVideo {
  const resolved: ResolvedVideoSpec = resolveVideoSpec(input);
  if (resolved.template !== undefined) {
    throw new Error('Use compileTemplate for template specs, not compileVideo.');
  }
  if (resolved.scene !== 'faceoff' && resolved.scene !== 'attack-goal'
    && resolved.scene !== 'cross-header-goal' && resolved.scene !== 'crossbar-chaos'
    && resolved.scene !== 'keeper-disaster') {
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
    overlaysMode: resolved.overlays,
    headline: resolved.headline,
    secondary: resolved.secondary,
    cta: resolved.cta,
    faceoff: compileFaceoffTimeline(resolved),
    attackGoal: resolved.scene === 'attack-goal' ? compileAttackGoalTimeline(resolved) : null,
    crossHeader: resolved.scene === 'cross-header-goal' ? compileCrossHeaderTimeline(resolved) : null,
    crossbar: resolved.scene === 'crossbar-chaos' ? compileCrossbarTimeline(resolved) : null,
    keeper: resolved.scene === 'keeper-disaster' ? compileKeeperTimeline(resolved) : null,
    overlayPlan: compileOverlayPlan(resolved),
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
  if (compiled.scene === 'cross-header-goal') {
    if (!compiled.crossHeader) throw new Error('Missing cross-header-goal staging');
    return evaluateCrossHeaderFrame({
      data: compiled.crossHeader,
      home: compiled.home,
      away: compiled.away,
      seed: compiled.seed,
      frame,
      fps: compiled.fps,
      duration: compiled.duration,
    });
  }
  if (compiled.scene === 'crossbar-chaos') {
    if (!compiled.crossbar) throw new Error('Missing crossbar-chaos staging');
    return evaluateCrossbarFrame({
      data: compiled.crossbar,
      home: compiled.home,
      away: compiled.away,
      seed: compiled.seed,
      frame,
      fps: compiled.fps,
      duration: compiled.duration,
    });
  }
  if (compiled.scene === 'keeper-disaster') {
    if (!compiled.keeper) throw new Error('Missing keeper-disaster staging');
    return evaluateKeeperFrame({
      data: compiled.keeper,
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

/**
 * Evaluate the overlay layer for one frame. Pure random-access function of
 * (compiled, frame): absolute DOM state, no CSS animations, no wall clocks.
 */
export function evaluateOverlays(compiled: CompiledSocialVideo, frame: number): OverlayFrameDescription {
  parseFrameIndex(frame, compiled.totalFrames, compiled.fps, compiled.duration);
  return evaluateOverlayFrame(compiled.overlayPlan, frame, compiled.fps);
}

/** Final dumb-renderer input for any scene (no timeline left in it). */
export interface SocialRenderInput {
  state: MatchState;
  camera: SocialCameraPose;
  clock: number;
  pose: SocialActorPose[];
  effects?: SocialEffects;
  /** Supporter choreography staged by the scene; omitted = static crowd. */
  crowd?: SocialCrowdState;
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
  if (desc.scene === 'cross-header-goal') {
    return crossHeaderFrameToRenderInput(desc, compiled.home, compiled.away);
  }
  if (desc.scene === 'crossbar-chaos') {
    return crossbarFrameToRenderInput(desc, compiled.home, compiled.away);
  }
  if (desc.scene === 'keeper-disaster') {
    return keeperFrameToRenderInput(desc, compiled.home, compiled.away);
  }
  return { ...faceoffFrameToRenderInput(desc, compiled.home, compiled.away), effects: undefined };
}

/** Deterministic zero-padded frame filename (6 digits, PNG only for now). */
export function frameFilename(frame: number): string {
  return `${String(frame).padStart(6, '0')}.png`;
}
