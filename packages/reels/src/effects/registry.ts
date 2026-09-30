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
  'shade-top': { summary: 'Dark gradient from the top edge (type legibility over bright plates)', layer: 'screen' },
  'shade-bottom': { summary: 'Dark gradient from the bottom edge (type legibility over bright plates)', layer: 'screen' },
  'speed-lines': { summary: 'Radial anime speed lines', layer: 'screen' },
  'rival-grade': { summary: 'Tense cold grade + vignette (escalation)', layer: 'screen' },
  'freeze-grade': { summary: 'Desaturated freeze-frame look with film border', layer: 'screen' },
  confetti: { summary: 'Falling confetti in HNC colours', layer: 'screen' },
  'lights-flicker': { summary: 'Fluorescent lights stutter and buzz', layer: 'world', worlds: ['office', 'breakroom'] },
  'lights-surge': { summary: 'Fluorescent lights surge to white (into a light-bloom)', layer: 'world', worlds: ['office', 'breakroom'] },
  'cup-slide': { summary: 'The last cup slides toward one side (intensity -1 left / +1 right); persists', layer: 'world', worlds: ['breakroom'] },
  'cup-tip': { summary: 'The cup tips off the counter edge and falls to the floor (gravity); persists', layer: 'world', worlds: ['breakroom'] },
  'cup-take': { summary: 'The cup leaves the counter (someone holds it now); persists', layer: 'world', worlds: ['breakroom'] },
  'blinds-close': { summary: 'Blinds drop and close across the window; persists', layer: 'world', worlds: ['breakroom'] },
  'machine-brew': { summary: 'Coffee machine brews: steam plumes for the window', layer: 'world', worlds: ['breakroom'] },
  'drawer-close': { summary: 'A counter drawer slides shut', layer: 'world', worlds: ['breakroom'] },
  'lights-out': { summary: 'Stadium floodlights stutter and die (scene stays dark until lights-up)', layer: 'world', worlds: ['football'] },
  'lights-up': { summary: 'Floodlights strike back bank by bank (first in a scene: the scene starts dark)', layer: 'world', worlds: ['football'] },
  'stadium-morph': { summary: 'The office becomes a stadium: pitch floor, floodlight panels, night walls, crowd-colour partitions, everyone a fan (persists)', layer: 'world', worlds: ['office'] },
  'ball-roll': { summary: 'A ball rolls out of the dark hallway and settles (persists)', layer: 'world', worlds: ['apartment'] },
  'phone-wake': { summary: 'The phone on the table lights up with a push (persists)', layer: 'world', worlds: ['apartment'] },
  'scarf-in': { summary: 'The folded scarf is in the moving box (persists)', layer: 'world', worlds: ['apartment'] },
  'remote-down': { summary: 'The remote is back on the table (persists)', layer: 'world', worlds: ['apartment'] },
  'room-shift': { summary: 'The lamp fades; cold floodlight pours through the window (persists)', layer: 'world', worlds: ['apartment'] },
  'cup-turn': { summary: 'The espresso turns on its saucer, slow then ~2 rev/s (keeps spinning after)', layer: 'world', worlds: ['cafe'] },
  ripple: { summary: 'Concentric ripples cross the crema (an impact from somewhere else)', layer: 'world', worlds: ['cafe'] },
  'espresso-take': { summary: 'The espresso leaves the saucer (in someone’s hand now; persists)', layer: 'world', worlds: ['cafe'] },
  dawn: { summary: 'The sky moves from blue hour to a red sunrise (persists)', layer: 'world', worlds: ['rooftop'] },
  'buzz-shake': { summary: 'The picture jitters like a phone vibrating in the hand (2D worlds)', layer: 'world', worlds: ['phone', 'title'] },
  'floor-table': { summary: 'The studio floor lights up as a giant World Table on a pitch (persists)', layer: 'world', worlds: ['studio'] },
  'coworkers-look': { summary: 'Background coworkers turn to stare at the pod', layer: 'world', worlds: ['office'] },
  // THE CURRENT (anime tribute) — reusable energy / anime-grammar modules.
  aura: { summary: 'Current aura shell hugging a player (`on`: cast id; intensity 0.3 spark · 0.7 surge · 1 full) + rising motes; colour = country', layer: 'world', worlds: ['football'] },
  'current-lines': { summary: 'The pitch lines carry a Current: a glowing front flows from the ends (props.home / props.away: true; props.speed m/s; props.from: ends | hero)', layer: 'world', worlds: ['football'] },
  'crowd-current': { summary: 'Thousands of lights come on in one end (props.side: home | away), pulsing (props.bpm)', layer: 'world', worlds: ['football'] },
  'impact-frame': { summary: 'Anime impact frames: 2–4 inverted ink frames + focus lines on contact (`at`)', layer: 'screen' },
  'focus-lines': { summary: 'Manga concentration lines converging on a subject (`on`, default ball) or the frame centre', layer: 'screen' },
  shockwave: { summary: 'Ground shockwave ring (+ flash) expanding from a subject (`on`, default ball) at `at`; colour props.color', layer: 'screen' },
  'plasma-trail': { summary: 'Charged ball trail: white core, country-coloured edge, sparks (props.color: country code or hex)', layer: 'screen' },
  'ground-trail': { summary: 'A glowing mark on the grass along a subject’s path (`on`) over props.fromAt..props.untilAt (crescent cut, undertow wave)', layer: 'screen' },
  slice: { summary: 'MERIDIAN: the picture splits along the ball’s flight line, halves offset, a light seam', layer: 'screen' },
  chroma: { summary: 'Chromatic split (RGB offset) decaying from `at` — the biggest impacts only', layer: 'screen' },
  motes: { summary: 'Floating Current motes drifting up (props.color, props.fall: true to drift down)', layer: 'screen' },
  'light-pulse': { summary: 'Coloured light pulses from the top of frame on the beat (props.color, props.bpm)', layer: 'screen' },
};

export const EFFECT_IDS = Object.keys(EFFECTS);
