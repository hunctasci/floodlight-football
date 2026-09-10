import { ATTACK_GOAL_BEATS } from '../scenes/attack-goal';
import { CROSS_HEADER_BEATS } from '../scenes/cross-header-goal';
import { CROSSBAR_BEATS } from '../scenes/crossbar-chaos';
import { KEEPER_BEATS } from '../scenes/keeper-disaster';
import type { ResolvedVideoSpec } from '../schema';
import type { AudioEvent, CompiledAudio, MixDuck } from './types';

/** Offline render sample rate: 48 kHz 16-bit PCM (mono legacy + stereo mix). */
export const AUDIO_SAMPLE_RATE = 48000;

type PlanInput = Pick<ResolvedVideoSpec, 'scene' | 'seed' | 'duration' | 'attackTeam' | 'attackStyle' | 'home' | 'away'>;

function event(
  type: AudioEvent['type'], time: number, duration: number, intensity: number,
  extra?: Partial<AudioEvent>,
): AudioEvent {
  return { type, time, duration, intensity, ...extra };
}

/**
 * Micro-silence duck: dip crowd+ambience (+music when present) for leadMs
 * before an impact so the contact explodes out of a pocket of quiet.
 * Short-form sports editing: 50–120 ms, never a literal long mute.
 */
function microSilence(at: number, leadMs = 90, depthDb = 14): MixDuck[] {
  const lead = leadMs / 1000;
  const start = Math.max(0, at - lead);
  return [
    { bus: 'crowd', start, end: at, depthDb },
    { bus: 'ambience', start, end: at, depthDb: Math.min(depthDb, 10) },
    { bus: 'music', start, end: at, depthDb: Math.min(depthDb, 8) },
  ];
}

/** Pre-impact anticipation dip: music/crowd ease down as tension rises. */
function anticipationDip(start: number, end: number, depthDb = 2.5): MixDuck[] {
  if (!(end > start)) return [];
  return [
    { bus: 'music', start, end, depthDb },
    { bus: 'ambience', start, end, depthDb: depthDb + 0.5 },
  ];
}

/**
 * Compile the deterministic semantic audio plan for a resolved spec. Pure:
 * same spec → same events. Timings anchor to the scene's canonical beat
 * constants (never duplicated magic numbers); events past the clip duration
 * are dropped so short test renders stay valid.
 *
 * Mix philosophy per football moment: anticipation riser → pre-impact dip +
 * 50–120 ms micro-silence → layered contact (kick/header/bar/save + sub
 * sweetener + whoosh where apt) → crowd eruption dominant → brand sting.
 */
export function compileAudioPlan(spec: PlanInput): CompiledAudio {
  const events: AudioEvent[] = [];
  const ducks: MixDuck[] = [];
  if (spec.scene === 'attack-goal') {
    const B = ATTACK_GOAL_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5));
    events.push(event('kick', B.pass1Start, 0.1, 0.8, { pan: -0.2 }));
    events.push(event('kick', B.carryEnd, 0.1, 0.9, { pan: 0.15 }));
    events.push(event('anticipation', B.carryEnd, Math.max(0.2, B.shotStart - B.carryEnd), 0.8));
    events.push(event('whoosh', B.shotStart, 0.15, 0.7, { pan: 0 }));
    events.push(event('shot', B.shotStart, 0.25, 1, { pan: 0 }));
    events.push(event('impact', B.shotStart, 0.25, 0.6));
    events.push(event('goal', B.shotEnd, 0.8, 1));
    events.push(event('impact', B.shotEnd, 0.3, 0.7));
    events.push(event('crowd', B.shotEnd, 2.0, 1));
    events.push(event('crowd', B.celebStart, Math.max(0.25, spec.duration - B.celebStart), 0.8));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...anticipationDip(B.carryEnd, B.shotStart));
    ducks.push(...microSilence(B.shotStart, 90));
    ducks.push(...microSilence(B.shotEnd, 70, 10));
  } else if (spec.scene === 'cross-header-goal') {
    const B = CROSS_HEADER_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5));
    events.push(event('kick', 0.5, 0.1, 0.7, { pan: -0.3 }));
    events.push(event('anticipation', 0.6, Math.max(0.2, B.crossContact - 0.6), 0.6));
    events.push(event('cross', B.crossContact, 0.15, 1, { pan: -0.35 }));
    events.push(event('whoosh', (B.crossContact + B.contact) / 2, 0.3, 0.55, { pan: 0 }));
    events.push(event('crowd', B.crossContact, 1.2, 0.5));
    events.push(event('anticipation', B.crossContact, Math.max(0.2, B.contact - B.crossContact), 0.9));
    events.push(event('header', B.contact, 0.2, 1));
    events.push(event('impact', B.contact, 0.25, 0.7));
    events.push(event('goal', 3.05, 0.8, 1));
    events.push(event('impact', 3.05, 0.3, 0.7));
    events.push(event('crowd', 3.05, 2.2, 1));
    events.push(event('crowd', B.celebStart, Math.max(0.25, spec.duration - B.celebStart), 0.8));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...anticipationDip(B.crossContact, B.contact));
    ducks.push(...microSilence(B.contact, 100));
    ducks.push(...microSilence(3.05, 70, 10));
  } else if (spec.scene === 'crossbar-chaos') {
    const B = CROSSBAR_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5));
    events.push(event('anticipation', 0.3, Math.max(0.2, B.shotStart - 0.3), 0.6));
    events.push(event('shot', B.shotStart, 0.25, 1));
    events.push(event('whoosh', B.shotStart, 0.15, 0.6));
    events.push(event('crossbar', B.barHit, 0.7, 1));
    events.push(event('impact', B.barHit, 0.3, 0.8));
    events.push(event('crowd', B.barHit, 0.5, 0.9));
    events.push(event('crowd', 1.95, 1.6, 0.4));
    events.push(event('anticipation', 2.6, Math.max(0.2, B.volleyContact - 2.6), 0.85));
    events.push(event('whoosh', B.volleyContact - 0.1, 0.15, 0.5));
    events.push(event('header', B.volleyContact, 0.2, 1));
    events.push(event('impact', B.volleyContact, 0.25, 0.7));
    events.push(event('goal', 3.8, 0.8, 1));
    events.push(event('impact', 3.8, 0.3, 0.75));
    events.push(event('crowd', 3.8, 2.0, 1));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...microSilence(B.barHit, 80, 12));
    ducks.push(...anticipationDip(2.6, B.volleyContact));
    ducks.push(...microSilence(B.volleyContact, 90));
    ducks.push(...microSilence(3.8, 70, 10));
  } else if (spec.scene === 'keeper-disaster') {
    const B = KEEPER_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5));
    events.push(event('anticipation', 0.2, Math.max(0.2, B.shotStart - 0.2), 0.65));
    events.push(event('shot', B.shotStart, 0.25, 1));
    events.push(event('whoosh', B.saveMoment - 0.08, 0.14, 0.6));
    events.push(event('save', B.saveMoment, 0.2, 1));
    events.push(event('impact', B.saveMoment, 0.25, 0.65));
    events.push(event('crowd', B.saveMoment, 0.8, 0.7));
    events.push(event('clearance', B.holdBallEnd, 0.12, 0.9, { pan: 0.2 }));
    events.push(event('anticipation', B.holdBallEnd, Math.max(0.15, B.clearanceEnd - B.holdBallEnd), 0.5));
    events.push(event('shot', B.clearanceEnd, 0.25, 1));
    events.push(event('impact', B.clearanceEnd, 0.25, 0.6));
    events.push(event('goal', 2.9, 0.8, 1));
    events.push(event('impact', 2.9, 0.3, 0.7));
    events.push(event('crowd', 2.9, 2.2, 1));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...microSilence(B.saveMoment, 80, 12));
    ducks.push(...microSilence(B.clearanceEnd, 80));
    ducks.push(...microSilence(2.9, 70, 10));
  } else {
    events.push(event('ambience', 0, spec.duration, 0.5));
    if (spec.duration > 0.4) events.push(event('whistle', 0.15, 0.25, 0.6));
  }
  const keptEvents = events.filter((e) => e.time < spec.duration);
  const keptDucks = ducks.filter((d) => d.start < spec.duration && d.end > 0);
  return Object.freeze({
    sampleRate: AUDIO_SAMPLE_RATE,
    duration: spec.duration,
    events: Object.freeze(keptEvents),
    ducks: Object.freeze(keptDucks),
  });
}
