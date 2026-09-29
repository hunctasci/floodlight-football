/**
 * Semantic sound cues. Content asks for `tension-rise` or `goal-roar`; this
 * registry decides where the sound comes from:
 *
 *   game   — the game's own arcade synth recipes (apps/game/src/audio), replayed
 *            offline by packages/social-video (kick, shot, goal sting...)
 *   social — sketch sounds synthesised here (audio/social-synth.ts): office
 *            room tone, typing, notification ping, riser, bloom, zip...
 *   file   — real CC0 stadium recordings (assets/SOURCES.md provenance)
 *
 * `hush` is a mix directive, not a sound: beds dip under it (comedic pause).
 */
export type CueSource = 'game' | 'social' | 'file' | 'mix';
export type Bus = 'ambience' | 'crowd' | 'foreground' | 'music';

export interface CueDef {
  summary: string;
  source: CueSource;
  bus: Bus;
  /** Game recipe (social-video AudioEventType) or social recipe id. */
  recipe?: string;
  /** Public-relative file (source 'file'). */
  file?: string;
  /** Natural length (s); beds default to their span. */
  length: number;
  /** Beds loop to fill their span. */
  bed?: boolean;
}

const game = (recipe: string, summary: string, length = 0.25): CueDef => ({ summary, source: 'game', bus: 'foreground', recipe, length });
const social = (summary: string, length: number, bus: Bus = 'foreground', bed = false): CueDef => ({ summary, source: 'social', bus, length, bed });
const file = (f: string, summary: string, length: number, bus: Bus = 'crowd', bed = false): CueDef => ({ summary, source: 'file', bus, file: `assets/audio/crowd/${f}`, length, bed });

export const CUES: Record<string, CueDef> = {
  // Football (game recipes)
  kick: game('kick', 'Kick / touch'),
  pass: game('kick', 'Pass'),
  shot: game('shot', 'Driven shot'),
  cross: game('cross', 'Whipped cross'),
  header: game('header', 'Header thump'),
  crossbar: game('crossbar', 'Crossbar clang', 0.6),
  'keeper-save': game('save', 'Glove save'),
  clearance: game('clearance', 'Clearance'),
  whistle: game('whistle', 'Referee whistle'),
  whoosh: game('whoosh', 'Air rush'),
  impact: game('impact', 'Low cinematic sweetener'),
  poof: game('impact', 'Cloud-puff poof'),
  'goal-sting': game('goal', 'Game goal SFX (noise wash + rising saw)', 0.7),
  'brand-sting': game('sting', 'HNC sonic logo (3-note arcade motif)', 0.6),
  // Stadium (CC0 recordings)
  'crowd-bed': file('stadium-bed-01.wav', 'Stadium crowd bed', 12, 'ambience', true),
  'stadium-reveal': file('stadium-bed-02.wav', 'Stadium swell on reveal', 6),
  'crowd-gasp': file('anticipation-01.wav', 'Crowd rising OOOH (peaks ~1.85s)', 1.85),
  anticipation: file('anticipation-02.wav', 'Pre-shot rise', 3),
  'goal-roar': file('goal-roar-01.wav', 'Goal eruption', 6),
  celebration: file('goal-roar-02.wav', 'Celebration tail', 6),
  disappointment: file('disappointment-01.wav', 'Miss groan', 3),
  // Rooms (social synth beds)
  'office-tone': social('Office room tone: HVAC air + fluorescent hum', 1, 'ambience', true),
  'studio-tone': social('Studio room tone: low hum + air', 1, 'ambience', true),
  'room-tone': social('Quiet room tone', 1, 'ambience', true),
  buzz: social('Fluorescent tube buzz (120 Hz)', 1, 'ambience', true),
  // Sketch foley + UI (social synth)
  typing: social('Keyboard typing burst', 1.2),
  clack: social('Object set down on a desk', 0.2),
  slam: social('Palms slam a desk', 0.35),
  chair: social('Chair roll / creak', 0.5),
  notification: social('Phone push notification ping', 0.5),
  'message-in': social('Chat bubble pop (incoming)', 0.25),
  'message-out': social('Chat send whoop', 0.25),
  pop: social('UI pop', 0.15),
  swipe: social('UI swipe', 0.25),
  tick: social('Clock tick', 0.08),
  'tension-rise': social('Tension riser (rises across its duration)', 1.5, 'music'),
  heartbeat: social('Two low heartbeat thumps', 0.8, 'music'),
  'record-scratch': social('Record scratch (comedic stop)', 0.45),
  flicker: social('Electrical flicker: buzz stutters + relay clunks', 0.9),
  bloom: social('Reverse swell into white (peaks at its end)', 0.35, 'music'),
  boom: social('Sub drop boom', 1.2, 'music'),
  zip: social('Fast rising zip (zoom-through)', 0.3),
  glitch: social('Digital glitch chirps', 0.3),
  'news-sting': social('Broadcast news stinger (brass-like chord hits)', 1.4, 'music'),
  'news-bed': social('Newsroom pulse bed (ticking synth)', 1, 'music', true),
  // Mix directive
  hush: { summary: 'Duck ambience/crowd/music beds for its duration (comedic silence)', source: 'mix', bus: 'music', length: 0.6 },
};

export const CUE_IDS = Object.keys(CUES);

export function getCue(id: string): CueDef {
  const c = CUES[id];
  if (!c) throw new Error(`Unknown sound cue "${id}"`);
  return c;
}
