/**
 * Semantic animation registry. Stories use ids (`side-eye`, `celebrate`);
 * durations/looping/easing live here, never filenames.
 */

export const ANIMATION_IDS = [
  'idle',
  'typing',
  'sitting-idle',
  'sitting',
  'office-idle',
  'stand',
  'stand-up',
  'walk',
  'run',
  'point',
  'pointing',
  'celebrate',
  'smug-celebrate',
  'angry',
  'side-eye',
  'facepalm',
  'shrug',
  'coffee-drink',
  'kick',
  'dribble',
  'tackle',
  'goal-celebration',
] as const;

export type AnimationId = (typeof ANIMATION_IDS)[number];

export interface AnimationDef {
  id: AnimationId;
  /** Natural clip length in seconds (procedural approximation). */
  duration: number;
  loop: boolean;
  assetId?: string;
  description: string;
}

export const ANIMATIONS: Record<AnimationId, AnimationDef> = {
  idle: { id: 'idle', duration: 2.0, loop: true, assetId: 'anim-idle', description: 'Relaxed breathing loop' },
  typing: { id: 'typing', duration: 1.2, loop: true, assetId: 'anim-typing', description: 'Seated typing loop' },
  'sitting-idle': { id: 'sitting-idle', duration: 2.4, loop: true, assetId: 'anim-sitting-idle', description: 'Seated breathing' },
  sitting: { id: 'sitting', duration: 2.4, loop: true, description: 'Seated HNC office pose' },
  'office-idle': { id: 'office-idle', duration: 2.0, loop: true, description: 'Standing office idle (HNC character)' },
  stand: { id: 'stand', duration: 1.0, loop: true, description: 'Standing idle' },
  'stand-up': { id: 'stand-up', duration: 0.8, loop: false, description: 'Rise from chair' },
  walk: { id: 'walk', duration: 1.0, loop: true, description: 'Walk cycle' },
  run: { id: 'run', duration: 0.7, loop: true, description: 'Run cycle' },
  point: { id: 'point', duration: 0.9, loop: false, description: 'Smug point at screen' },
  pointing: { id: 'pointing', duration: 0.9, loop: false, description: 'HNC pointing (office rivalry)' },
  celebrate: { id: 'celebrate', duration: 1.4, loop: false, assetId: 'anim-celebrate', description: 'Smug celebration' },
  'smug-celebrate': { id: 'smug-celebrate', duration: 1.4, loop: false, description: 'HNC smug celebration (office)' },
  angry: { id: 'angry', duration: 1.0, loop: false, assetId: 'anim-angry', description: 'Angry lean-in' },
  'side-eye': { id: 'side-eye', duration: 1.0, loop: false, assetId: 'anim-side-eye', description: 'Slow comedic side-eye' },
  facepalm: { id: 'facepalm', duration: 1.1, loop: false, description: 'Facepalm despair' },
  shrug: { id: 'shrug', duration: 0.8, loop: false, description: 'Shrug' },
  'coffee-drink': { id: 'coffee-drink', duration: 1.2, loop: false, description: 'HNC coffee sip (office)' },
  kick: { id: 'kick', duration: 0.6, loop: false, description: 'Football kick' },
  dribble: { id: 'dribble', duration: 1.0, loop: true, description: 'Dribble loop' },
  tackle: { id: 'tackle', duration: 0.7, loop: false, description: 'Tackle' },
  'goal-celebration': { id: 'goal-celebration', duration: 2.0, loop: false, description: 'Arms-up goal celebration' },
};

export function getAnimation(id: string): AnimationDef {
  const def = (ANIMATIONS as Record<string, AnimationDef>)[id];
  if (!def) throw new Error(`Unknown animation id: ${id} (supported: ${ANIMATION_IDS.join(', ')})`);
  return def;
}
