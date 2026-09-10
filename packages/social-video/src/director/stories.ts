import type { StoryPlan, StorySpec } from './types';

/**
 * StoryCompiler: semantic StorySpec → DirectedShot plan + scene binding.
 *
 * Each story reuses one proven scene implementation (no new physics), but
 * gets its own hook, duration, shot grammar, hero frame, audio cues and
 * reaction choreography. Shot boundaries sit ON events (contacts, reveals,
 * reactions) — never fixed intervals. Total 6–12s per story.
 */

const DEFAULT_SEED: Record<StorySpec['story'], number> = {
  'last-second-winner': 7,
  'crossbar-chaos': 21,
  'keeper-disaster': 9,
  'impossible-cross': 33,
  'crowd-knew': 51,
};

function shot(
  start: number, end: number,
  purpose: StoryPlan['shots'][number]['purpose'],
  camera: StoryPlan['shots'][number]['camera'],
  beat: StoryPlan['shots'][number]['beat'],
  label: string,
): StoryPlan['shots'][number] {
  return { start, end, purpose, camera, beat, label };
}

export function compileStory(input: StorySpec): StoryPlan {
  const seed = input.story === undefined ? 42 : (input.seed ?? DEFAULT_SEED[input.story]);
  switch (input.story) {
    case 'last-second-winner': {
      const duration = 8;
      return {
        story: input.story, scene: 'cross-header-goal',
        home: input.home, away: input.away, seed,
        mood: input.mood ?? 'dramatic', fps: 60, duration,
        headline: input.headline ?? '3 SECONDS LEFT.',
        cta: input.cta,
        shots: [
          shot(0.0, 0.6, 'geography', 'attack-wide', 'hook', 'tight graphic + wide attacking field'),
          shot(0.6, 1.3, 'speed', 'touchline-run', 'setup', 'low touchline tracking winger'),
          shot(1.3, 1.35, 'impact', 'shot-impact', 'tension', 'cross-contact cut'),
          shot(1.35, 1.9, 'speed', 'ball-near-lens', 'tension', 'ball-near-lens'),
          shot(1.9, 2.5, 'geography', 'attack-wide', 'tension', 'goal-mouth wide, crowd rises'),
          shot(2.5, 2.85, 'character', 'striker-low', 'tension', 'striker 3/4 low, slow breath'),
          shot(2.85, 3.0, 'impact', 'header-impact', 'payoff', 'HEADER — micro-silence → THUMP'),
          shot(3.0, 3.4, 'character', 'keeper-close', 'payoff', 'keeper desperate dive'),
          shot(3.4, 3.8, 'reveal', 'inside-goal', 'payoff', 'inside/behind goal, net bulge'),
          shot(3.8, 4.5, 'reaction', 'reaction-crowd', 'reaction', 'Turkey supporters erupt'),
          shot(4.5, 5.2, 'reaction', 'celebration-close', 'reaction', 'scorer close celebration'),
          shot(5.2, 8.0, 'character', 'celebration-close', 'brand', 'HNC badge + CTA hold'),
        ],
        heroFrame: { time: 2.62, description: 'striker suspended, defender challenging, keeper set, ball 20cm from head, crowd behind' },
        audioCues: ['stadium bed', 'tension riser', 'cross kick (left)', 'air whoosh', 'crowd OOOH', 'micro-duck 100ms', 'header THUMP + sub', 'keeper glove whoosh', 'goal roar L3', 'brand sting'],
        reaction: 'Turkey supporters erupt / Greece supporters collapse / scorer closeup',
      };
    }
    case 'crossbar-chaos': {
      const duration = 6;
      return {
        story: input.story, scene: 'crossbar-chaos',
        home: input.home, away: input.away, seed,
        mood: input.mood ?? 'chaos', fps: 60, duration,
        headline: input.headline ?? 'HOW DID THIS END IN A GOAL?',
        cta: input.cta,
        shots: [
          shot(0.0, 0.9, 'geography', 'attack-wide', 'hook', 'establish shot, Brazil buildup'),
          shot(0.9, 1.6, 'character', 'striker-low', 'setup', 'shooter low angle'),
          shot(1.6, 2.0, 'impact', 'crossbar-angle', 'payoff', 'CLANG hero frame (under-bar)'),
          shot(2.0, 2.6, 'reaction', 'reaction-keeper', 'reaction', 'keeper looking upward, lost'),
          shot(2.6, 3.0, 'reaction', 'reaction-defender', 'reaction', 'defender hands-on-head'),
          shot(3.0, 3.4, 'reveal', 'top-down-box', 'tension', 'top-down reveal, ball descending'),
          shot(3.4, 3.85, 'impact', 'shot-impact', 'payoff', 'attacker volley'),
          shot(3.85, 4.3, 'reveal', 'behind-goal-net', 'payoff', 'goal-net'),
          shot(4.3, 5.0, 'reaction', 'reaction-crowd', 'reaction', 'supporters erupt (second)'),
          shot(5.0, 5.4, 'reaction', 'reaction-keeper', 'reaction', 'keeper despair'),
          shot(5.4, 6.0, 'character', 'celebration-close', 'brand', 'HNC branding'),
        ],
        heroFrame: { time: 1.6, description: 'ball striking bar, keeper underneath, supporters frozen' },
        audioCues: ['shot', 'CLANG + sub', 'false-dawn eruption', 'gasp/anticipation hang', 'volley THUMP', 'goal roar L2', 'sting'],
        reaction: 'keeper looks up lost → defender hands-on-head → double eruption',
      };
    }
    case 'keeper-disaster': {
      const duration = 6;
      return {
        story: input.story, scene: 'keeper-disaster',
        home: input.home, away: input.away, seed,
        mood: input.mood ?? 'comedy', fps: 60, duration,
        headline: input.headline ?? 'BRO...',
        cta: input.cta,
        shots: [
          shot(0.0, 0.7, 'character', 'striker-low', 'hook', 'hook + attacker winding up'),
          shot(0.7, 1.15, 'speed', 'ball-follow', 'tension', 'shot + keeper dive'),
          shot(1.15, 1.5, 'impact', 'keeper-glove', 'payoff', 'glove hero impact'),
          shot(1.5, 2.2, 'character', 'keeper-close', 'reaction', 'brief keeper hero shot'),
          shot(2.2, 2.55, 'speed', 'ground-ball', 'tension', 'keeper recovery + bad clearance'),
          shot(2.55, 2.75, 'geography', 'attack-wide', 'tension', 'wide REVEAL: attacker alone'),
          shot(2.75, 3.0, 'impact', 'shot-impact', 'payoff', 'first-time hit'),
          shot(3.0, 3.35, 'reveal', 'behind-goal-net', 'payoff', 'goal'),
          shot(3.35, 3.9, 'reaction', 'reaction-crowd', 'reaction', 'crowd/scorer eruption'),
          shot(3.9, 4.5, 'reaction', 'reaction-keeper', 'reaction', 'keeper kneeling despair closeup'),
          shot(4.5, 6.0, 'character', 'celebration-close', 'brand', 'brand hold'),
        ],
        heroFrame: { time: 1.15, description: 'keeper full extension, ball on glove, crowd rising' },
        audioCues: ['shot', 'glove thud + whoosh', 'brief home eruption', 'clearance punt (dry, no juice)', 'instant shot', 'goal roar', 'sting'],
        reaction: 'keeper kneels closeup (0.45s+) + crowd contrast home/away',
      };
    }
    case 'impossible-cross': {
      const duration = 6;
      return {
        story: input.story, scene: 'cross-header-goal',
        home: input.home, away: input.away, seed,
        mood: input.mood ?? 'hype', fps: 60, duration,
        headline: input.headline ?? "THERE'S NO WAY 😭",
        cta: input.cta,
        shots: [
          shot(0.0, 0.8, 'geography', 'corner-flag', 'hook', 'winger nearly at corner'),
          shot(0.8, 1.3, 'character', 'behind-runner', 'setup', 'behind winger, absurd curl begins'),
          shot(1.3, 1.7, 'speed', 'ball-follow', 'tension', 'side tracking the curve'),
          shot(1.7, 2.0, 'speed', 'ball-near-lens', 'tension', 'ball passes close to camera'),
          shot(2.0, 2.5, 'reveal', 'top-down-box', 'tension', 'top-down: the curve revealed'),
          shot(2.5, 2.85, 'geography', 'attack-wide', 'tension', 'goal-mouth, keeper comes out'),
          shot(2.85, 3.0, 'impact', 'header-impact', 'payoff', 'diving header redirect'),
          shot(3.0, 3.6, 'reveal', 'inside-goal', 'payoff', 'ball changes direction → goal'),
          shot(3.6, 4.4, 'reaction', 'reaction-crowd', 'reaction', 'eruption'),
          shot(4.4, 6.0, 'character', 'celebration-close', 'brand', 'brand hold'),
        ],
        heroFrame: { time: 1.85, description: 'ball mid-curve past lens, keeper caught, striker launching' },
        audioCues: ['cross kick', 'extended air whoosh', 'crowd OOOH builds', 'micro-duck', 'header THUMP', 'goal roar L2', 'sting'],
        reaction: 'keeper stranded + crowd eruption + scorer dive celebration',
      };
    }
    case 'crowd-knew': {
      const duration = 8;
      return {
        story: input.story, scene: 'attack-goal',
        home: input.home, away: input.away, seed,
        mood: input.mood ?? 'hype', fps: 60, duration,
        headline: input.headline ?? 'THE CROWD KNEW.',
        cta: input.cta,
        shots: [
          shot(0.0, 1.0, 'reaction', 'crowd-low', 'hook', 'far stand close/low, wave moving, flags'),
          shot(1.0, 1.8, 'reaction', 'behind-supporters', 'setup', 'wave crest match-cut'),
          shot(1.8, 2.6, 'geography', 'attack-wide', 'setup', 'match reveal, fast attack'),
          shot(2.6, 3.15, 'speed', 'touchline-run', 'tension', 'carrier sprint, everyone rises'),
          shot(3.15, 3.65, 'impact', 'shot-impact', 'payoff', 'shot'),
          shot(3.65, 4.3, 'reveal', 'behind-goal-net', 'payoff', 'goal'),
          shot(4.3, 5.2, 'reaction', 'reaction-crowd', 'reaction', 'same crowd now exploding'),
          shot(5.2, 8.0, 'character', 'celebration-close', 'brand', 'celebration + brand hold'),
        ],
        heroFrame: { time: 4.0, description: 'same stand from the hook, now mid-eruption, scorer below' },
        audioCues: ['wave bed', 'anticipation rise', 'shot', 'goal roar L2', 'sting'],
        reaction: 'hook crowd ↔ payoff crowd: same sections, idle→eruption',
      };
    }
    default:
      throw new Error(`Unknown story: ${(input as StorySpec).story}`);
  }
}

/** Validate a compiled plan (tests + CLI storyboard guardrails). */
export function validateStoryPlan(plan: StoryPlan): string[] {
  const errors: string[] = [];
  if (plan.shots.length === 0) errors.push('story has no shots');
  const beats = plan.shots.map((s) => s.beat);
  if (!beats.includes('hook')) errors.push('story has no hook');
  if (!beats.includes('payoff')) errors.push('story has no payoff');
  if (!beats.includes('reaction')) errors.push('reaction must follow payoff');
  if (!beats.includes('brand')) errors.push('branding must appear near end');
  const payoffIdx = beats.indexOf('payoff');
  const reactionIdx = beats.indexOf('reaction');
  if (payoffIdx >= 0 && reactionIdx >= 0 && reactionIdx < payoffIdx) {
    errors.push('reaction must follow payoff, not precede it');
  }
  for (let i = 0; i < plan.shots.length; i++) {
    const s = plan.shots[i];
    if (!(s.end > s.start)) errors.push(`shot ${i} has non-positive duration`);
    if (i > 0 && s.start < plan.shots[i - 1].end - 1e-9) errors.push(`shot ${i} overlaps previous shot`);
  }
  const last = plan.shots[plan.shots.length - 1];
  if (last && Math.abs(last.end - plan.duration) > 1e-9) errors.push('shots must cover the global duration exactly');
  if (plan.heroFrame.time < 0 || plan.heroFrame.time > plan.duration) errors.push('hero frame outside duration');
  if (!(plan.duration >= 5 && plan.duration <= 12)) errors.push('story duration must be 5–12s');
  return errors;
}
