import { ATTACK_GOAL_BEATS } from '../scenes/attack-goal';
import { CROSS_HEADER_BEATS } from '../scenes/cross-header-goal';
import { CROSSBAR_BEATS } from '../scenes/crossbar-chaos';
import { KEEPER_BEATS } from '../scenes/keeper-disaster';
import type { AttackTeam, ResolvedVideoSpec } from '../schema';
import type { AudioEvent, CompiledAudio, MixDuck } from './types';
import { preferredAssetId } from './library';

/** Offline render sample rate: 48 kHz 16-bit PCM (mono legacy + stereo mix). */
export const AUDIO_SAMPLE_RATE = 48000;

/**
 * Human reaction delay: the real crowd eruption starts ~80 ms AFTER the ball
 * crosses the line (50–130 ms tuning window). Roar-carrying events are
 * compiled at goalTime + GOAL_ROAR_DELAY so the response feels seen, not
 * pre-fired. At 60 fps that is ~5 frames.
 */
export const GOAL_ROAR_DELAY = 0.08;

/** Pre-goal contrast dip: how far ahead the bed eases down, and how deep. */
const GOAL_DUCK_LEAD = 0.22;
const GOAL_DUCK_DB = 6;

/** Subtle stereo seat for the eruption: scoring stand vs opposite stand. */
const SCORING_PAN = 0.15;

type PlanInput = Pick<ResolvedVideoSpec, 'scene' | 'seed' | 'duration' | 'attackTeam' | 'attackStyle' | 'home' | 'away'> & {
  /**
   * Salt mixed into deterministic asset selection so montage segments that
   * recompile the same scene (template/trailer excerpts) pick different
   * crowd variants while staying deterministic. Default 0.
   */
  assetSalt?: number;
};

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

/**
 * Pre-goal contrast dip: the stadium bed eases down ~220 ms before the goal
 * and releases exactly when the real roar starts (goalTime + reaction
 * delay), so the eruption feels huge without clipping. Subtle by design —
 * presence dips, never a mute.
 */
function goalDuck(goalTime: number): MixDuck[] {
  const start = Math.max(0, goalTime - GOAL_DUCK_LEAD);
  const end = goalTime + GOAL_ROAR_DELAY;
  if (!(end > start)) return [];
  return [
    { bus: 'crowd', start, end, depthDb: GOAL_DUCK_DB },
    { bus: 'ambience', start, end, depthDb: GOAL_DUCK_DB },
    { bus: 'music', start, end, depthDb: 4 },
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

function scoringPan(attackTeam: AttackTeam): number {
  return attackTeam === 'away' ? SCORING_PAN : -SCORING_PAN;
}

/**
 * Compile the deterministic semantic audio plan for a resolved spec. Pure:
 * same spec → same events. Timings anchor to the scene's canonical beat
 * constants (never duplicated magic numbers); events past the clip duration
 * are dropped so short test renders stay valid.
 *
 * Mix philosophy per football moment: real anticipation rise → pre-impact
 * dip + 50–120 ms micro-silence → layered arcade contact (kick/header/bar/
 * save + sub sweetener + whoosh where apt, all procedural and unchanged) →
 * 80 ms human reaction delay → REAL crowd eruption dominant → real
 * celebration tail → brand sting.
 *
 * Scene code decides WHAT/WHEN/INTENSITY (including which deterministic
 * crowd variant via assetId); the mixer decides HOW it sounds (gain/pan/
 * fades/looping). Events without an assetId still resolve to a real sample
 * in the mixer through the default pool — assetId only pins the variant.
 */
export function compileAudioPlan(spec: PlanInput): CompiledAudio {
  const events: AudioEvent[] = [];
  const ducks: MixDuck[] = [];
  const effSeed = ((spec.seed + (spec.assetSalt ?? 0) * 7919) >>> 0);
  const taken: Record<string, number> = {};
  const take = (pool: string): string => {
    const index = taken[pool] ?? 0;
    taken[pool] = index + 1;
    const id = preferredAssetId(effSeed, pool, index);
    if (!id) throw new Error(`compileAudioPlan: unknown crowd pool "${pool}"`);
    return id;
  };
  const pan = scoringPan(spec.attackTeam);
  if (spec.scene === 'attack-goal') {
    const B = ATTACK_GOAL_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5, { assetId: take('bed') }));
    events.push(event('kick', B.pass1Start, 0.1, 0.8, { pan: -0.2 }));
    events.push(event('kick', B.carryEnd, 0.1, 0.9, { pan: 0.15 }));
    events.push(event('anticipation', B.carryEnd, Math.max(0.2, B.shotStart - B.carryEnd), 0.8, { assetId: take('anticipationRise') }));
    events.push(event('whoosh', B.shotStart, 0.15, 0.7, { pan: 0 }));
    events.push(event('shot', B.shotStart, 0.25, 1, { pan: 0 }));
    events.push(event('impact', B.shotStart, 0.25, 0.6));
    events.push(event('impact', B.shotEnd, 0.3, 0.7));
    // One real eruption voice: onset + sustained cheering carry the whole
    // celebration (truncated at the clip end), so no stacked crowd layers.
    events.push(event('goal', B.shotEnd + GOAL_ROAR_DELAY, 4.2, 1, { assetId: take('goalRoar'), pan }));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...anticipationDip(B.carryEnd, B.shotStart));
    ducks.push(...microSilence(B.shotStart, 90));
    ducks.push(...goalDuck(B.shotEnd));
  } else if (spec.scene === 'cross-header-goal') {
    const B = CROSS_HEADER_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5, { assetId: take('bed') }));
    events.push(event('kick', B.passStart, 0.1, 0.7, { pan: -0.3 }));
    events.push(event('anticipation', B.passEnd, Math.max(0.2, B.crossContact - B.passEnd), 0.6, { assetId: take('anticipationRise') }));
    events.push(event('cross', B.crossContact, 0.15, 1, { pan: -0.35 }));
    events.push(event('whoosh', (B.crossContact + B.contact) / 2, 0.3, 0.55, { pan: 0 }));
    events.push(event('crowd', B.crossContact, 1.2, 0.5, { assetId: take('goalRoar'), pan }));
    events.push(event('anticipation', B.crossContact, Math.max(0.2, B.contact - B.crossContact), 0.9, { assetId: take('anticipationRise') }));
    events.push(event('header', B.contact, 0.2, 1));
    events.push(event('impact', B.contact, 0.25, 0.7));
    events.push(event('impact', B.headerEnd, 0.3, 0.7));
    // One real eruption voice: onset + sustained cheering carry the whole
    // celebration (truncated at the clip end), so no stacked crowd layers.
    events.push(event('goal', B.headerEnd + GOAL_ROAR_DELAY, 4.2, 1, { assetId: take('goalRoar'), pan }));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...anticipationDip(B.crossContact, B.contact));
    ducks.push(...microSilence(B.contact, 100));
    ducks.push(...goalDuck(B.headerEnd));
  } else if (spec.scene === 'crossbar-chaos') {
    const B = CROSSBAR_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5, { assetId: take('bed') }));
    events.push(event('anticipation', 0.4, Math.max(0.2, B.shotStart - 0.4), 0.6, { assetId: take('anticipationRise') }));
    events.push(event('shot', B.shotStart, 0.25, 1));
    events.push(event('whoosh', B.shotStart, 0.15, 0.6));
    events.push(event('crossbar', B.barHit, 0.7, 1));
    events.push(event('impact', B.barHit, 0.3, 0.8));
    events.push(event('crowd', B.barHit + GOAL_ROAR_DELAY, 0.5, 0.9, { assetId: take('goalRoar'), pan }));
    events.push(event('disappointment', B.barHit + 0.35, 1.2, 0.8, { assetId: take('disappointment'), pan }));
    events.push(event('crowd', 4.85, 1.6, 0.4, { assetId: take('goalRoar'), pan }));
    events.push(event('anticipation', 5.6, Math.max(0.2, B.volleyContact - 5.6), 0.85, { assetId: take('anticipationRise') }));
    events.push(event('whoosh', B.volleyContact - 0.1, 0.15, 0.5));
    events.push(event('header', B.volleyContact, 0.2, 1));
    events.push(event('impact', B.volleyContact, 0.25, 0.7));
    events.push(event('impact', 7.4, 0.3, 0.75));
    // One real eruption voice for the winner (the false-dawn gasp + groan
    // above already spent the first emotional peak).
    events.push(event('goal', 7.4 + GOAL_ROAR_DELAY, 4.2, 1, { assetId: take('goalRoar'), pan }));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...microSilence(B.barHit, 80, 12));
    ducks.push(...anticipationDip(5.6, B.volleyContact));
    ducks.push(...microSilence(B.volleyContact, 90));
    ducks.push(...goalDuck(7.4));
  } else if (spec.scene === 'keeper-disaster') {
    const B = KEEPER_BEATS;
    events.push(event('ambience', 0, spec.duration, 0.5, { assetId: take('bed') }));
    events.push(event('anticipation', 0.3, Math.max(0.2, B.shotStart - 0.3), 0.65, { assetId: take('anticipationRise') }));
    events.push(event('shot', B.shotStart, 0.25, 1));
    events.push(event('whoosh', B.saveMoment - 0.08, 0.14, 0.6));
    events.push(event('save', B.saveMoment, 0.2, 1));
    events.push(event('impact', B.saveMoment, 0.25, 0.65));
    events.push(event('crowd', B.saveMoment + GOAL_ROAR_DELAY, 0.8, 0.7, { assetId: take('goalRoar'), pan }));
    events.push(event('clearance', B.clearanceKick, 0.12, 0.9, { pan: 0.2 }));
    events.push(event('anticipation', B.clearanceKick, Math.max(0.15, B.clearanceEnd - B.clearanceKick), 0.5, { assetId: take('anticipationRise') }));
    events.push(event('shot', B.shot2Start, 0.25, 1));
    events.push(event('impact', B.shot2Start, 0.25, 0.6));
    events.push(event('impact', B.instantShotEnd, 0.3, 0.7));
    // One real eruption voice: the opposite stand explodes while the keeper
    // despairs (truncated at the clip end).
    events.push(event('goal', B.instantShotEnd + GOAL_ROAR_DELAY, 4.2, 1, { assetId: take('goalRoar'), pan }));
    events.push(event('sting', Math.max(0, spec.duration - 0.7), 0.6, 0.8));
    ducks.push(...microSilence(B.saveMoment, 80, 12));
    ducks.push(...microSilence(B.shot2Start, 80));
    ducks.push(...goalDuck(B.instantShotEnd));
  } else {
    events.push(event('ambience', 0, spec.duration, 0.5, { assetId: take('bed') }));
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
