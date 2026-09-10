import { getCountry } from '../../../../apps/game/src/city-league/countries';
import type { AttackTeam } from '../schema';
import type { OverlayPlanEntry, VersusPayload } from './types';

/**
 * Default overlay presets: scene-owned timing + default copy. The overlay
 * renderer owns HOW each kind looks; this file owns WHEN semantic overlays
 * appear and WHAT their default text is.
 */

export const DEFAULT_FACEOFF_HEADLINE = 'PICK A SIDE';
export const DEFAULT_ATTACK_HEADLINE = 'EVERY WIN COUNTS';
export const DEFAULT_CTA = 'PLAY FOR YOUR COUNTRY';
export const BRAND_DOMAIN = 'hncleague.com';

function versusPayload(home: string, away: string, layout: VersusPayload['layout']): VersusPayload {
  const h = getCountry(home);
  const a = getCountry(away);
  if (!h || !a) throw new Error(`Unknown country code: ${!h ? home : away}`);
  return {
    homeCode: home,
    awayCode: away,
    homeName: h.name.toUpperCase(),
    awayName: a.name.toUpperCase(),
    homeFlag: h.flag,
    awayFlag: a.flag,
    layout,
  };
}

/** Uppercase via the default locale. Note: canonical "Türkiye" becomes
 *  "TÜRKIYE" (dotless I) — deterministic English uppercasing, not tr-TR
 *  (which would corrupt names like Brazil → BRAZİL). */
export function goalText(attackCode: string): string {
  const c = getCountry(attackCode);
  const name = (c?.name ?? attackCode).toUpperCase();
  return `${name} SCORES!`;
}

export interface PresetArgs {
  home: string;
  away: string;
  attackTeam: AttackTeam;
  headline?: string;
  secondary?: string;
  cta?: string;
}

/**
 * Faceoff (4s default): let the stadium establish, then the rivalry title,
 * then a strong hero headline. No brand layer — the end frame stays a clean
 * rivalry composition. Trailing overlays hold past the clip end (end: 99, as
 * in the scene tracks) so the final frame never catches a fade-out.
 */
export function faceoffOverlayPlan(args: PresetArgs): OverlayPlanEntry[] {
  return [
    { kind: 'versus', start: 0.25, end: 1.8, versus: versusPayload(args.home, args.away, 'stacked') },
    {
      kind: 'headline',
      start: 2.7,
      end: 99,
      text: args.headline ?? DEFAULT_FACEOFF_HEADLINE,
      ...(args.secondary !== undefined ? { secondary: args.secondary } : {}),
    },
  ];
}

/**
 * Attack-goal (6s default): compact context strip, explosive goal message at
 * the strike, celebration headline, then CTA + branding as the end card.
 */
export function attackGoalOverlayPlan(args: PresetArgs): OverlayPlanEntry[] {
  const scorer = args.attackTeam === 'home' ? args.home : args.away;
  return [
    { kind: 'versus', start: 0.0, end: 1.4, versus: versusPayload(args.home, args.away, 'strip') },
    { kind: 'goal', start: 3.65, end: 4.35, text: goalText(scorer) },
    {
      kind: 'headline',
      start: 4.7,
      end: 5.45,
      text: args.headline ?? DEFAULT_ATTACK_HEADLINE,
      ...(args.secondary !== undefined ? { secondary: args.secondary } : {}),
    },
    { kind: 'cta', start: 5.35, end: 99, text: args.cta ?? DEFAULT_CTA },
    { kind: 'brand', start: 5.35, end: 99 },
  ];
}
