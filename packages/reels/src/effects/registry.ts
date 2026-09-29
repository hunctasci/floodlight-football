/**
 * Effect vocabulary (pure). Layer says who interprets it:
 *   camera  — camera/evaluate.ts (shake, zoom punch)
 *   screen  — render/ShotFx.tsx (2D grades, bursts, trails, bars)
 *   world   — the world scene (office lights flicker, coworkers turn)
 */
export interface EffectDef {
  summary: string;
  layer: 'camera' | 'screen' | 'world';
  /** Worlds that understand a world effect. */
  worlds?: string[];
}

export const EFFECTS: Record<string, EffectDef> = {
  'impact-shake': { summary: 'Sharp decaying camera jolt from `at`', layer: 'camera' },
  'zoom-punch': { summary: 'FOV punch-in that relaxes out', layer: 'camera' },
  'impact-burst': { summary: 'Flash + ring + rays at the ball (football) or frame centre, ~1/6s', layer: 'screen' },
  'ball-trail': { summary: 'Projected trail of the ball’s recent path', layer: 'screen' },
  'lights-on': { summary: 'Floodlight banks strike on out of darkness', layer: 'screen' },
  cinebars: { summary: 'The game’s cinematic bars ease in, snap out', layer: 'screen' },
  'stadium-grade': { summary: 'The game menu backdrop over the picture (end-card plate)', layer: 'screen' },
  flash: { summary: 'White flash decaying from `at`', layer: 'screen' },
  vignette: { summary: 'Soft dark vignette', layer: 'screen' },
  'speed-lines': { summary: 'Radial anime speed lines', layer: 'screen' },
  'rival-grade': { summary: 'Tense cold grade + vignette (escalation)', layer: 'screen' },
  'freeze-grade': { summary: 'Desaturated freeze-frame look with film border', layer: 'screen' },
  confetti: { summary: 'Falling confetti in HNC colours', layer: 'screen' },
  'lights-flicker': { summary: 'Fluorescent lights stutter and buzz', layer: 'world', worlds: ['office'] },
  'lights-surge': { summary: 'Fluorescent lights surge to white (into a light-bloom)', layer: 'world', worlds: ['office'] },
  'coworkers-look': { summary: 'Background coworkers turn to stare at the pod', layer: 'world', worlds: ['office'] },
};

export const EFFECT_IDS = Object.keys(EFFECTS);
