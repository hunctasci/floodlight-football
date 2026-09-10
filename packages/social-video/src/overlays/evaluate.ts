import { clamp01, lerp, smoothstep } from '../timeline/math';
import type { EvaluatedOverlay, OverlayFrameDescription, OverlayKind, OverlayPlanEntry } from './types';

/**
 * Pure overlay timeline evaluation: absolute DOM state from (plan, frame).
 * No CSS animations, no Date.now(), no rAF elapsed time — frame 90 renders
 * correctly when requested directly with no prior frames.
 */

const KIND_FADE: Record<OverlayKind, { in: number; out: number }> = {
  versus: { in: 0.25, out: 0.25 },
  headline: { in: 0.3, out: 0.3 },
  goal: { in: 0.12, out: 0.2 },
  cta: { in: 0.25, out: 0.25 },
  brand: { in: 0.25, out: 0.25 },
};

/** Eased 0→1→0 visibility window for [start, end) with eased edges. */
export function fadeInOut(time: number, start: number, end: number, fadeIn: number, fadeOut: number): number {
  if (time < start || time >= end) return 0;
  const a = clamp01((time - start) / fadeIn);
  const b = clamp01((end - time) / fadeOut);
  return smoothstep(Math.min(a, b));
}

/** Slide-up entrance: +distance px below, settling to 0 during fade-in. */
export function slideIn(time: number, start: number, fadeIn: number, distance = 30): number {
  return lerp(distance, 0, smoothstep(clamp01((time - start) / fadeIn)));
}

/**
 * Goal punch: scale 0.65 → 1.12 quickly, then settle to 1.0 and hold.
 * Pure function of elapsed time within the window.
 */
export function punchScale(elapsed: number): number {
  if (elapsed < 0) return 0.65;
  if (elapsed < 0.15) return lerp(0.65, 1.12, smoothstep(elapsed / 0.15));
  if (elapsed < 0.35) return lerp(1.12, 1.0, smoothstep((elapsed - 0.15) / 0.2));
  return 1.0;
}

function evaluateEntry(entry: OverlayPlanEntry, time: number): EvaluatedOverlay | null {
  if (time < entry.start || time >= entry.end) return null;
  const fade = KIND_FADE[entry.kind];
  if (entry.kind === 'goal') {
    const elapsed = time - entry.start;
    const scale = punchScale(elapsed);
    return {
      kind: entry.kind,
      ...(entry.text !== undefined ? { text: entry.text } : {}),
      opacity: fadeInOut(time, entry.start, entry.end, fade.in, fade.out),
      scale,
      translateX: 0,
      translateY: slideIn(time, entry.start, fade.in, 18),
      emphasis: Math.max(0, scale - 1),
    };
  }
  return {
    kind: entry.kind,
    ...(entry.text !== undefined ? { text: entry.text } : {}),
    ...(entry.secondary !== undefined ? { secondary: entry.secondary } : {}),
    ...(entry.versus !== undefined ? { versus: entry.versus } : {}),
    opacity: fadeInOut(time, entry.start, entry.end, fade.in, fade.out),
    scale: 1,
    translateX: 0,
    translateY: slideIn(time, entry.start, fade.in),
    emphasis: 0,
  };
}

/**
 * Evaluate every active overlay at `frame`. Pure random-access function of
 * (plan, frame, fps): evaluating frame 170 directly deep-equals evaluating
 * it after any other sequence of frames.
 */
export function evaluateOverlayFrame(
  plan: readonly OverlayPlanEntry[],
  frame: number,
  fps: number,
): OverlayFrameDescription {
  const time = frame / fps;
  const overlays: EvaluatedOverlay[] = [];
  for (const entry of plan) {
    const evaluated = evaluateEntry(entry, time);
    if (evaluated) overlays.push(Object.freeze(evaluated) as EvaluatedOverlay);
  }
  return Object.freeze({ frame, time, overlays: Object.freeze(overlays) }) as OverlayFrameDescription;
}
