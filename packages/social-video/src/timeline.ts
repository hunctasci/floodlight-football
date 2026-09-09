import {
  parseFrameIndex, resolveVideoSpec, type RawVideoInput, type ResolvedVideoSpec, type SocialSceneId,
} from './schema';
import type { SocialFormatId } from './config';
import {
  compileFaceoffTimeline, evaluateFaceoffFrame, type FaceoffTimelineData, type SocialFrameDescription,
} from './scenes/faceoff';

export type { SocialFrameDescription } from './scenes/faceoff';

/**
 * Compiled deterministic timeline: plain data, no THREE objects, no browser.
 * Pipeline: SocialVideoSpec → compileVideo() → CompiledSocialVideo →
 * evaluateFrame(frame) → SocialFrameDescription → renderSocial() → PNG.
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
  /** Scene staging payload (faceoff is the only scene for now). */
  readonly faceoff: FaceoffTimelineData;
}

/** Compile raw agent/CLI input into a deterministic timeline. Pure. */
export function compileVideo(input: RawVideoInput): CompiledSocialVideo {
  const resolved: ResolvedVideoSpec = resolveVideoSpec(input);
  if (resolved.scene !== 'faceoff') {
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
    faceoff: compileFaceoffTimeline(resolved),
  });
}

/**
 * Evaluate one frame. Pure random-access function of (compiled, frame):
 * frame 75 renders identically with or without prior evaluations.
 * Throws a clear error for out-of-range indices.
 */
export function evaluateFrame(compiled: CompiledSocialVideo, frame: number): SocialFrameDescription {
  parseFrameIndex(frame, compiled.totalFrames, compiled.fps, compiled.duration);
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

/** Deterministic zero-padded frame filename (6 digits, PNG only for now). */
export function frameFilename(frame: number): string {
  return `${String(frame).padStart(6, '0')}.png`;
}
