import { getAnimation } from './animation-registry';
import { applyEasing, type EasingId } from './easing';

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
 * Procedural pose channels for placeholder actors (deterministic sine-based
 * motion driven by absolute localTime, not accumulated state).
 */
export function proceduralPose(animationId: string, localTime: number): {
  bob: number;
  lean: number;
  armLift: number;
  headYaw: number;
} {
  const t = localTime;
  switch (animationId) {
    case 'typing':
      return { bob: Math.sin(t * 9) * 0.015, lean: 0.12, armLift: 0.9 + Math.sin(t * 9) * 0.06, headYaw: 0 };
    case 'celebrate':
    case 'goal-celebration': {
      const k = Math.min(1, t / 0.5);
      return { bob: Math.abs(Math.sin(t * 8)) * 0.12 * k, lean: -0.08, armLift: 2.4 * k, headYaw: 0 };
    }
    case 'side-eye': {
      const k = Math.min(1, t / 0.7);
      return { bob: 0, lean: 0.06 * k, armLift: 0.1, headYaw: 0.65 * k };
    }
    case 'angry':
      return { bob: Math.sin(t * 12) * 0.02, lean: 0.22, armLift: 0.5, headYaw: 0.15 };
    case 'point':
      return { bob: 0, lean: 0.1, armLift: 1.4, headYaw: 0.2 };
    case 'facepalm':
      return { bob: -0.03, lean: 0.18, armLift: 2.2, headYaw: -0.3 };
    case 'kick': {
      const k = Math.sin(Math.min(1, t / 0.6) * Math.PI);
      return { bob: 0.05 * k, lean: 0.15 * k, armLift: 0.4, headYaw: 0 };
    }
    default:
      return { bob: Math.sin(t * 2.2) * 0.02, lean: 0.02, armLift: 0.08, headYaw: 0 };
  }
}
