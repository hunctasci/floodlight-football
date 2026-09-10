import { ATTACK_GOAL_BEATS } from '../scenes/attack-goal';
import type { ResolvedVideoSpec } from '../schema';
import type { AudioEvent, CompiledAudio } from './types';

/** Offline render sample rate: mono 48 kHz 16-bit PCM. */
export const AUDIO_SAMPLE_RATE = 48000;

type PlanInput = Pick<ResolvedVideoSpec, 'scene' | 'seed' | 'duration' | 'attackTeam' | 'attackStyle' | 'home' | 'away'>;

function event(type: AudioEvent['type'], time: number, duration: number, intensity: number): AudioEvent {
  return { type, time, duration, intensity };
}

/**
 * Compile the deterministic semantic audio plan for a resolved spec. Pure:
 * same spec → same events. Timings anchor to the scene's canonical beat
 * constants (never duplicated magic numbers); events past the clip duration
 * are dropped so short test renders stay valid.
 */
export function compileAudioPlan(spec: PlanInput): CompiledAudio {
  const events: AudioEvent[] = [];
  if (spec.scene === 'attack-goal') {
    const B = ATTACK_GOAL_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5));
    events.push(event('kick', B.pass1Start, 0.1, 0.8));
    events.push(event('kick', B.carryEnd, 0.1, 0.9));
    events.push(event('shot', B.shotStart, 0.25, 1));
    events.push(event('goal', B.shotEnd, 0.8, 1));
    events.push(event('crowd', B.shotEnd, 2.0, 1));
    events.push(event('crowd', B.celebStart, Math.max(0.25, spec.duration - B.celebStart), 0.8));
  } else {
    events.push(event('ambience', 0, spec.duration, 0.5));
    if (spec.duration > 0.4) events.push(event('whistle', 0.15, 0.25, 0.6));
  }
  const kept = events.filter((e) => e.time < spec.duration);
  return Object.freeze({
    sampleRate: AUDIO_SAMPLE_RATE,
    duration: spec.duration,
    events: Object.freeze(kept),
  });
}
