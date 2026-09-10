import { getAnimation } from './animation-registry';
import { applyEasing, type EasingId } from './easing';
import { hncProceduralPose } from '@floodlight/hnc-visuals';

/**
 * ABSOLUTE animation sampling. Pose at a Remotion frame derives from
 * (frame, fps, clipStartFrame) — never from mixer.update(delta) accumulation.
 * Rendering frame 300 never requires frames 0..299.
 */

export interface SampledAnimation {
  /** Local clip time in seconds (looped when the clip loops). */
  localTime: number;
  /** 0..1 progress through the current play (1 = finished for one-shots). */
  progress: number;
  /** Eased blend weight 0..1 for cross-fades (derived from frame). */
  weight: number;
  done: boolean;
}

export function sampleAnimation(
  animationId: string,
  frame: number,
  fps: number,
  clipStartFrame = 0,
  easing: EasingId = 'ease-in-out',
): SampledAnimation {
  const def = getAnimation(animationId);
  const clipFrames = Math.max(1, Math.round(def.duration * fps));
  const elapsed = Math.max(0, frame - clipStartFrame);
  if (def.loop) {
    const localFrame = elapsed % clipFrames;
    return {
      localTime: localFrame / fps,
      progress: clipFrames <= 1 ? 1 : localFrame / clipFrames,
      weight: 1,
      done: false,
    };
  }
  const t = Math.min(1, elapsed / clipFrames);
  return {
    localTime: Math.min(def.duration, elapsed / fps),
    progress: t,
    weight: applyEasing(easing, t),
    done: t >= 1,
  };
}

/**
 * Cross-fade blend between two clips, weights derived from absolute frame.
 * fadeFrames around switchFrame; before = A only, after = B only.
 */
export function sampleCrossfade(
  fromId: string,
  toId: string,
  frame: number,
  fps: number,
  switchFrame: number,
  fadeFrames: number,
  fromStartFrame = 0,
  toStartFrame = 0,
): { from: SampledAnimation; to: SampledAnimation; mix: number } {
  const from = sampleAnimation(fromId, frame, fps, fromStartFrame);
  const to = sampleAnimation(toId, frame, fps, toStartFrame);
  const half = Math.max(1, fadeFrames / 2);
  const mix = Math.min(1, Math.max(0, (frame - (switchFrame - half)) / Math.max(1, fadeFrames)));
  return { from, to, mix };
}

/**
 * Procedural pose channels — thin wrapper around the canonical HNC pose
 * language (@floodlight/hnc-visuals). Kept for backwards compatibility;
 * new code should use hncProceduralPose / applyHncProceduralPose directly.
 */
export function proceduralPose(animationId: string, localTime: number): {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
} {
  const p = hncProceduralPose(animationId, localTime);
  return { bob: p.bob, lean: p.lean, armLift: p.armLift, headYaw: p.headYaw };
}
