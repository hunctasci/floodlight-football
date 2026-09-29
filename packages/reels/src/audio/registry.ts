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
export type CueSource = 'game' | 'social' | 'file' | 'filtered' | 'mix';
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
const filtered = (summary: string, length: number, bus: Bus = 'crowd', bed = false): CueDef => ({ summary, source: 'filtered', bus, length, bed });
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
  // Stadium heard through something (low-passed recordings, audio/filtered.ts)
  'crowd-distant': filtered('Stadium far away through an apartment wall', 4, 'ambience', true),
  'crowd-muffled': filtered('Stadium behind a tunnel door (muffled bed)', 4, 'ambience', true),
  'crowd-opening': filtered('Muffled stadium that opens up across the cue (walking out of a tunnel)', 4, 'crowd'),
  'roar-muffled': filtered('A goal roar through the walls', 5),
  'roar-opening': filtered('A roar that opens from muffled to full', 5),
  // Campaign foley (social synth)
  footsteps: social('Footsteps on a hard floor (walk cadence across the cue)', 2),
  'footsteps-tunnel': social('Studs on concrete in a tunnel (reverberant)', 2),
  'machine-grind': social('Coffee grinder burr', 1.1),
  'machine-hiss': social('Espresso machine steam hiss (unnecessarily dramatic)', 1.4),
  'machine-beep': social('Machine ready beep-beep', 0.4),
  'cup-set': social('Cup set down on a counter / saucer', 0.2),
  'cup-scrape': social('Cup dragged across a hard counter', 0.5),
  'cup-hit': social('Paper cup hits the floor', 0.3),
  'ceramic-spin': social('Espresso cup rattling round on its saucer', 1.2),
  'spoon-clink': social('Spoon against a small cup', 0.3),
  sip: social('A small sip', 0.4),
  'ball-land': social('Ball lands on grass (thud)', 0.35),
  'ball-roll': social('Ball rolling on grass / floor', 1.5),
  blinds: social('Venetian blinds rattling shut', 0.9),
  drawer: social('Drawer slides shut (thunk)', 0.5),
  door: social('Door closing softly', 0.6),
  knuckles: social('Knuckle crack (two pops)', 0.5),
  cloth: social('Clothing rustle', 0.4),
  'phone-buzz': social('Phone vibrating on a hard surface', 0.8),
  'dramatic-sting': social('Orchestral stab (brass + timpani) — melodrama', 1.6, 'music'),
  'horror-drone': social('Low horror drone with a slow beating', 4, 'music', true),
  'horror-hit': social('Horror stinger (low boom + dissonant screech)', 1.5, 'music'),
  wind: social('Morning wind, gusting', 4, 'ambience', true),
  'flag-flap': social('Cloth flag flapping in the wind', 2),
  'pad-swell': social('Warm restrained pad (slow swell, major)', 4, 'music'),
  'piano-note': social('A single soft piano-like note', 2, 'music'),
  heartbeat2: social('Slow heartbeat (loops across its duration)', 3, 'music'),
  'stomp-clap': social('Crowd stomp-stomp-clap rhythm (grows across the cue)', 4, 'crowd'),
  'breaking-alarm': social('Breaking-news alarm stab (escalating)', 0.9, 'music'),
  'riser-long': social('Long cinematic riser into a cut', 3, 'music'),
  'sub-hit': social('Deep sub hit on a cut to white', 1.5, 'music'),
  crash: social('Ball smashes into a machine: metal crunch, glass, rattle', 1.2),
  'tv-off': social('CRT/TV switching off (click + fading whine)', 0.6),
  'remote-click': social('Remote control button click', 0.1),
  // Mix directive
  hush: { summary: 'Duck ambience/crowd/music beds for its duration (comedic silence)', source: 'mix', bus: 'music', length: 0.6 },
};

export const CUE_IDS = Object.keys(CUES);

export function getCue(id: string): CueDef {
  const c = CUES[id];
  if (!c) throw new Error(`Unknown sound cue "${id}"`);
  return c;
}
