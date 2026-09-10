/**
 * Semantic audio cues. Stories use cue ids (`goal-roar`, `poof`);
 * files/mixing live in the audio system, never in stories.
 */

export const AUDIO_CUE_IDS = [
  'office-ambience',
  'typing',
  'chair',
  'coffee-machine',
  'tension-rise',
  'record-scratch',
  'poof',
  'whoosh',
  'stadium-reveal',
  'pass',
  'kick',
  'shot',
  'cross',
  'header',
  'crossbar',
  'keeper-save',
  'clearance',
  'crowd-gasp',
  'crowd-bed',
  'goal-roar',
  'celebration',
  'disappointment',
  'anticipation',
  'brand-sting',
] as const;

export type AudioCueId = (typeof AUDIO_CUE_IDS)[number];

export interface AudioCueDef {
  id: AudioCueId;
  /** Preferred bundled file (reused social-video crowd assets) or procedural. */
  file?: string;
  procedural: boolean;
  bus: 'crowd' | 'ambience' | 'foreground' | 'music';
  description: string;
}

/**
 * Reuses the proven social-video catalogue where bundled:
 * crowd beds / roars / anticipation / disappointment are real Freesound CC0
 * recordings (see packages/social-video/assets/audio/SOURCES.md).
 * Arcade impacts stay procedural by design (HNC identity).
 */
export const AUDIO_CUES: Record<AudioCueId, AudioCueDef> = {
  'office-ambience': { id: 'office-ambience', procedural: true, bus: 'ambience', description: 'Quiet office room tone' },
  typing: { id: 'typing', procedural: true, bus: 'foreground', description: 'Keyboard typing' },
  chair: { id: 'chair', procedural: true, bus: 'foreground', description: 'Chair creak' },
  'coffee-machine': { id: 'coffee-machine', procedural: true, bus: 'foreground', description: 'Coffee machine' },
  'tension-rise': { id: 'tension-rise', procedural: true, bus: 'music', description: 'Comedic tension riser' },
  'record-scratch': { id: 'record-scratch', procedural: true, bus: 'foreground', description: 'Record scratch sting' },
  poof: { id: 'poof', procedural: true, bus: 'foreground', description: 'Cloud-poof impact' },
  whoosh: { id: 'whoosh', procedural: true, bus: 'foreground', description: 'Transition whoosh' },
  'stadium-reveal': { id: 'stadium-reveal', file: 'crowd/stadium-bed-01.wav', procedural: false, bus: 'crowd', description: 'Stadium bed swell on reveal' },
  pass: { id: 'pass', procedural: true, bus: 'foreground', description: 'Pass kick' },
  kick: { id: 'kick', procedural: true, bus: 'foreground', description: 'Kick impact' },
  shot: { id: 'shot', procedural: true, bus: 'foreground', description: 'Driven shot' },
  cross: { id: 'cross', procedural: true, bus: 'foreground', description: 'Cross contact' },
  header: { id: 'header', procedural: true, bus: 'foreground', description: 'Header thump' },
  crossbar: { id: 'crossbar', procedural: true, bus: 'foreground', description: 'Metallic crossbar clang' },
  'keeper-save': { id: 'keeper-save', procedural: true, bus: 'foreground', description: 'Glove save thud' },
  clearance: { id: 'clearance', procedural: true, bus: 'foreground', description: 'Clearance kick' },
  'crowd-gasp': { id: 'crowd-gasp', file: 'crowd/anticipation-01.wav', procedural: false, bus: 'crowd', description: 'Crowd anticipation rise' },
  'crowd-bed': { id: 'crowd-bed', file: 'crowd/stadium-bed-01.wav', procedural: false, bus: 'ambience', description: 'Looped stadium bed' },
  'goal-roar': { id: 'goal-roar', file: 'crowd/goal-roar-01.wav', procedural: false, bus: 'crowd', description: 'Goal eruption' },
  celebration: { id: 'celebration', file: 'crowd/goal-roar-02.wav', procedural: false, bus: 'crowd', description: 'Celebration tail' },
  disappointment: { id: 'disappointment', file: 'crowd/disappointment-01.wav', procedural: false, bus: 'crowd', description: 'Miss groan' },
  anticipation: { id: 'anticipation', file: 'crowd/anticipation-02.wav', procedural: false, bus: 'crowd', description: 'Pre-shot rise' },
  'brand-sting': { id: 'brand-sting', procedural: true, bus: 'foreground', description: 'HNC sonic logo sting' },
};

export function getAudioCue(id: string): AudioCueDef {
  const def = (AUDIO_CUES as Record<string, AudioCueDef>)[id];
  if (!def) throw new Error(`Unknown audio cue: ${id} (supported: ${AUDIO_CUE_IDS.join(', ')})`);
  return def;
}
