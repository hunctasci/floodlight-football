import type { ResolvedVideoSpec } from '../schema';
import {
  attackGoalOverlayPlan, crossbarOverlayPlan, crossHeaderOverlayPlan, faceoffOverlayPlan, keeperOverlayPlan,
} from './presets';
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
  switch (spec.scene) {
    case 'attack-goal':
      return frozen(attackGoalOverlayPlan(args));
    case 'cross-header-goal':
      return frozen(crossHeaderOverlayPlan(args));
    case 'crossbar-chaos':
      return frozen(crossbarOverlayPlan(args));
    case 'keeper-disaster':
      return frozen(keeperOverlayPlan(args));
    case 'faceoff':
    default:
      return frozen(faceoffOverlayPlan(args));
  }
}

function frozen(plan: OverlayPlanEntry[]): OverlayPlanEntry[] {
  return Object.freeze(plan.map((entry) => Object.freeze(entry))) as OverlayPlanEntry[];
}
