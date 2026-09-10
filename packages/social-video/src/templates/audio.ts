import { AUDIO_SAMPLE_RATE, compileAudioPlan } from '../audio/compile';
import type { AttackTeam, AttackStyle } from '../schema';
import type { AudioEvent, CompiledAudio } from '../audio/types';
import type { TemplateSegmentDef } from './presets';

/**
 * Template audio composition: ONE continuous global ambience bed plus the
 * scenes' event SFX shifted into global time. Scene ambience beds are
 * dropped (never overlapped) so the cut has no volume jump; a crowd tail
 * carries the goal swell into the outro instead of stopping at the cut.
 */

export interface TemplateAudioInput {
  home: string;
  away: string;
  seed: number;
  attackTeam: AttackTeam;
  attackStyle: AttackStyle;
  segments: readonly TemplateSegmentDef[];
  totalDuration: number;
}

function shiftEvents(events: readonly AudioEvent[], dt: number, totalDuration: number): AudioEvent[] {
  return events
    .filter((e) => e.type !== 'ambience')
    .map((e) => ({ ...e, time: e.time + dt }))
    .filter((e) => e.time < totalDuration);
}

export function compileTemplateAudio(input: TemplateAudioInput): CompiledAudio {
  const events: AudioEvent[] = [
    { type: 'ambience', time: 0, duration: input.totalDuration, intensity: 0.5 },
  ];
  for (const seg of input.segments) {
    if (seg.kind === 'outro') continue;
    const plan = compileAudioPlan({
      scene: seg.scene,
      seed: input.seed,
      duration: seg.localDuration,
      attackTeam: input.attackTeam,
      attackStyle: input.attackStyle,
      home: input.home,
      away: input.away,
    });
    events.push(...shiftEvents(plan.events, seg.start, input.totalDuration));
  }
  const outro = input.segments.find((s) => s.kind === 'outro');
  if (outro) {
    events.push({
      type: 'crowd',
      time: outro.start,
      duration: Math.min(2.0, outro.duration),
      intensity: 0.45,
    });
  }
  events.sort((a, b) => a.time - b.time);
  return Object.freeze({
    sampleRate: AUDIO_SAMPLE_RATE,
    duration: input.totalDuration,
    events: Object.freeze(events),
  });
}
