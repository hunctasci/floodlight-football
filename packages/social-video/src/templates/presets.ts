import type { AttackTeam } from '../schema';
import type { OverlayPlanEntry } from '../overlays/types';

/**
 * Production template segment tables. The template owns WHEN segments play;
 * scene compilers/evaluators are reused untouched with scene-local timing.
 *
 * country-rivalry-reel (15.5s): faceoff intro slice → full attack-goal (9.5s
 * readable cut) → celebration continuation outro. Boundaries sit on exact
 * 30fps frames (90, 375) so local-frame mapping is bit-exact at the default
 * frame rate; other rates round to the nearest local frame (deterministic,
 * ≤½ frame).
 */

export interface TemplateSegmentDef {
  kind: 'scene' | 'outro';
  /** Global start in seconds. */
  start: number;
  /** Global length in seconds. */
  duration: number;
  /** Scene implementation reused for this segment. */
  scene: 'faceoff' | 'attack-goal';
  /**
   * Duration handed to the scene evaluators (the scene believes its own
   * clock). Faceoff plays a compressed 3.0s arc; attack plays its full 9.5s;
   * the outro continues attack evaluation past 9.5s for living celebration.
   */
  localDuration: number;
}

/** Production segment table for country-rivalry-reel. */
export function countryRivalrySegments(): TemplateSegmentDef[] {
  return [
    { kind: 'scene', scene: 'faceoff', start: 0, duration: 3.0, localDuration: 3.0 },
    { kind: 'scene', scene: 'attack-goal', start: 3.0, duration: 9.5, localDuration: 9.5 },
    { kind: 'outro', scene: 'attack-goal', start: 12.5, duration: 3.0, localDuration: 9.5 },
  ];
}

export function templateTableDuration(segments: TemplateSegmentDef[]): number {
  return segments.reduce((end, s) => Math.max(end, s.start + s.duration), 0);
}

/** Total production duration (15.5s for country-rivalry-reel). */
export function countryRivalryDuration(): number {
  return templateTableDuration(countryRivalrySegments());
}

export function templateDuration(template: 'country-rivalry-reel'): number {
  switch (template) {
    case 'country-rivalry-reel':
      return countryRivalryDuration();
  }
}

export interface TemplateCopyArgs {
  home: string;
  away: string;
  attackTeam: AttackTeam;
  headline?: string;
  secondary?: string;
  cta?: string;
}

/**
 * Shift overlay entries into global template time. Pure.
 */
export function shiftOverlayPlan(plan: readonly OverlayPlanEntry[], dt: number): OverlayPlanEntry[] {
  return plan.map((e) => ({ ...e, start: e.start + dt, end: e.end + dt }));
}
