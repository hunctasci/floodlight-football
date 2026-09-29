/**
 * Transition vocabulary (pure). A transition joins two shots: it owns a window
 * around the cut, may render both shots at once (overlap), may move both
 * cameras (whip), and brings its own default sounds.
 *
 *   lead     fraction of the window before the cut
 *   overlap  incoming shot renders under/inside the outgoing one
 *   from/to  subject roles it needs (light-bloom: lights; zoom-through: surface)
 */
export interface TransitionDef {
  summary: string;
  duration: number;
  lead: number;
  overlap: boolean;
  from?: 'light' | 'surface';
  to?: 'light';
  sounds: { cue: string; at: 'start' | 'cut'; volume?: number }[];
}

export const TRANSITIONS: Record<string, TransitionDef> = {
  cut: { summary: 'Hard cut', duration: 0, lead: 0.5, overlap: false, sounds: [] },
  'match-cut': { summary: 'Hard cut between matched framings (same lens, new world)', duration: 0, lead: 0.5, overlap: false, sounds: [] },
  flash: { summary: 'White flash across the cut', duration: 0.2, lead: 0.5, overlap: false, sounds: [{ cue: 'impact', at: 'cut', volume: 1.5 }] },
  dip: { summary: 'Dip to black', duration: 0.5, lead: 0.5, overlap: false, sounds: [] },
  'light-bloom': {
    summary: 'A light in the outgoing shot blows out to white; the frame resolves from a light in the incoming shot',
    duration: 0.6,
    lead: 0.5,
    overlap: false,
    from: 'light',
    to: 'light',
    sounds: [
      { cue: 'bloom', at: 'start', volume: 1.4 },
      { cue: 'impact', at: 'cut', volume: 2.6 },
    ],
  },
  'whip-pan': { summary: 'Both cameras whip sideways; the cut hides in the blur', duration: 0.34, lead: 0.5, overlap: false, sounds: [{ cue: 'whoosh', at: 'start', volume: 2 }] },
  'zoom-through': {
    summary: 'Push into a screen (phone notification, monitor, studio wall): the next shot is inside it',
    duration: 0.55,
    lead: 0,
    overlap: true,
    from: 'surface',
    sounds: [{ cue: 'zip', at: 'cut', volume: 1.6 }],
  },
  wipe: { summary: 'A dark foreground shape sweeps the lens and reveals the next shot behind it', duration: 0.4, lead: 0.5, overlap: true, sounds: [{ cue: 'whoosh', at: 'start', volume: 1.6 }] },
  'cloud-puff': {
    summary: 'Cartoon cloud puff hides the swap (tie flies off, ball appears)',
    duration: 0.7,
    lead: 0.5,
    overlap: false,
    sounds: [
      { cue: 'poof', at: 'start' },
      { cue: 'whoosh', at: 'cut' },
    ],
  },
  glitch: { summary: 'Broadcast glitch: RGB slices tear across the cut', duration: 0.3, lead: 0.5, overlap: false, sounds: [{ cue: 'glitch', at: 'start', volume: 1.2 }] },
};

export const TRANSITION_IDS = Object.keys(TRANSITIONS);

export function getTransition(id: string): TransitionDef {
  const t = TRANSITIONS[id];
  if (!t) throw new Error(`Unknown transition "${id}" (known: ${TRANSITION_IDS.join(', ')})`);
  return t;
}

/** 0 → 1 progress through a transition window (clamped). */
export function transitionProgress(frame: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (frame - start) / Math.max(1, end - start)));
}
