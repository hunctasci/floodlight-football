import type { AudioEvent, AudioEventType } from '../../../social-video/src/audio/types';
import { getAudioCue, type AudioCueId } from './registry';
import type { ShotPlan } from '../reel/types';

/**
 * Procedural cue -> arcade synth event. The synth itself is social-video's
 * offline renderer, which replays the game's own WebAudio recipes
 * (apps/game/src/audio/audio.ts) deterministically — reused, not rebuilt.
 * Cues without a recipe stay silent, exactly as before.
 */
const SYNTH: Partial<Record<AudioCueId, AudioEventType>> = {
  kick: 'kick',
  pass: 'kick',
  shot: 'shot',
  cross: 'cross',
  header: 'header',
  crossbar: 'crossbar',
  'keeper-save': 'save',
  clearance: 'clearance',
  whoosh: 'whoosh',
  poof: 'impact',
  impact: 'impact',
  'goal-sting': 'goal',
  'brand-sting': 'sting',
};

/** Global-time synth events for every procedural cue in the plan. Pure. */
export function compileSfxEvents(plan: ShotPlan): AudioEvent[] {
  const out: AudioEvent[] = [];
  for (const shot of plan.shots) {
    for (const c of shot.audio ?? []) {
      const def = getAudioCue(c.cue);
      const type = SYNTH[def.id];
      if (!def.procedural || !type) continue;
      out.push({
        type,
        time: (shot.startFrame + c.startFrame) / plan.fps,
        duration: (c.durationInFrames ?? Math.round(plan.fps * 0.25)) / plan.fps,
        intensity: c.volume ?? 1,
      });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Public-relative path of a spec's rendered SFX stem. */
export function sfxStemPath(specId: string): string {
  return `generated/${specId}-sfx.wav`;
}
