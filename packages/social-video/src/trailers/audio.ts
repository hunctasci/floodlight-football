import { AUDIO_SAMPLE_RATE, compileAudioPlan } from '../audio/compile';
import type { AudioEvent, CompiledAudio, MixDuck } from '../audio/types';
import type { CompiledTrailerSegment } from './types';

/**
 * Trailer audio: ONE continuous global ambience bed + source SFX excerpts
 * shifted into global time. Scene ambience beds are dropped (never
 * overlapped); ducks shift with their events. Visual and audio excerpts share
 * the same source mapping, so they stay in sync by construction.
 */

export interface TrailerAudioInput {
  seed: number;
  shots: readonly CompiledTrailerSegment[];
  totalDuration: number;
}

/** Global time for a source-local event time inside a shot segment. */
export function trailerEventTime(
  seg: Pick<CompiledTrailerSegment, 'start' | 'srcStart' | 'rate'>,
  srcTime: number,
): number {
  return seg.start + (srcTime - seg.srcStart) / seg.rate;
}

function shiftEvents(
  events: readonly AudioEvent[],
  seg: CompiledTrailerSegment,
  totalDuration: number,
): AudioEvent[] {
  const out: AudioEvent[] = [];
  for (const e of events) {
    if (e.type === 'ambience') continue; // single global bed owns ambience
    if (e.type === 'sting') continue; // trailer owns the single brand sting
    if (e.time < seg.srcStart || e.time >= seg.srcEnd) continue; // outside excerpt
    const t = trailerEventTime(seg, e.time);
    if (t < seg.start - 1e-9 || t >= seg.end || t >= totalDuration) continue;
    out.push({ ...e, time: t });
  }
  return out;
}

function shiftDucks(
  ducks: readonly MixDuck[] | undefined,
  seg: CompiledTrailerSegment,
  totalDuration: number,
): MixDuck[] {
  if (!ducks) return [];
  const out: MixDuck[] = [];
  for (const d of ducks) {
    // Keep ducks whose window intersects the excerpt (micro-silence just
    // before an impact often starts slightly before srcStart).
    if (d.end <= seg.srcStart || d.start >= seg.srcEnd) continue;
    const start = seg.start + (Math.max(d.start, seg.srcStart) - seg.srcStart) / seg.rate;
    const end = seg.start + (Math.min(d.end, seg.srcEnd) - seg.srcStart) / seg.rate;
    if (!(end > start) || start >= totalDuration || end <= 0) continue;
    out.push({ ...d, start: Math.max(0, start), end: Math.min(end, totalDuration) });
  }
  return out;
}

export function compileTrailerAudio(input: TrailerAudioInput): CompiledAudio {
  const events: AudioEvent[] = [
    { type: 'ambience', time: 0, duration: input.totalDuration, intensity: 0.5 },
  ];
  const ducks: MixDuck[] = [];
  for (let s = 0; s < input.shots.length; s++) {
    const seg = input.shots[s];
    const plan = compileAudioPlan({
      scene: seg.source,
      seed: input.seed,
      duration: seg.video.duration,
      attackTeam: seg.video.attackTeam,
      attackStyle: seg.video.attackStyle,
      home: seg.video.home,
      away: seg.video.away,
      // Salt per shot: excerpts of the same scene pick different
      // deterministic crowd variants (still same spec → same).
      assetSalt: s + 1,
    });
    events.push(...shiftEvents(plan.events, seg, input.totalDuration));
    ducks.push(...shiftDucks(plan.ducks, seg, input.totalDuration));
  }
  // Single brand sting at the payoff (trailer owns it; scene stings dropped).
  // (No explicit kickoff whistle: the boot/ball excerpt already carries the
  // scene's own whistle at ~0.77s — a second one would flam.)
  events.push({
    type: 'sting',
    time: Math.max(0, input.totalDuration - 0.9),
    duration: 0.8,
    intensity: 0.9,
  });
  events.sort((a, b) => a.time - b.time);
  ducks.sort((a, b) => a.start - b.start);
  return Object.freeze({
    sampleRate: AUDIO_SAMPLE_RATE,
    duration: input.totalDuration,
    events: Object.freeze(events),
    ducks: Object.freeze(ducks),
  });
}
