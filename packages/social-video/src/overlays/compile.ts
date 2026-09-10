import type { ResolvedVideoSpec } from '../schema';
import { attackGoalOverlayPlan, faceoffOverlayPlan } from './presets';
import type { OverlayPlanEntry } from './types';

/**
 * Compile the semantic overlay plan for a resolved video spec. Pure:
 * the same spec always yields the same plan. Scene code decides WHEN
 * overlays appear; `render-dom.ts` decides HOW each kind looks.
 */
export function compileOverlayPlan(
  spec: Pick<ResolvedVideoSpec, 'scene' | 'home' | 'away' | 'attackTeam' | 'overlays' | 'headline' | 'secondary' | 'cta'>,
): OverlayPlanEntry[] {
  if (spec.overlays === 'none') return [];
  const args = {
    home: spec.home,
    away: spec.away,
    attackTeam: spec.attackTeam,
    headline: spec.headline,
    secondary: spec.secondary,
    cta: spec.cta,
  };
  const plan = spec.scene === 'attack-goal' ? attackGoalOverlayPlan(args) : faceoffOverlayPlan(args);
  return Object.freeze(plan.map((entry) => Object.freeze(entry))) as OverlayPlanEntry[];
}
