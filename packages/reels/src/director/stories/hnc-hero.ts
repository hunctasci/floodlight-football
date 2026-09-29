import { frameAtMomentTime, type MomentClockSpec } from '../../animation/time-ramp';
import { HERO_ATTACK, HERO_TOUCHES } from '../../football/adapter/moments/hero-attack';
import type { AudioCueSpec, BeatContentSpec, BeatSpec, ReelSpec, TemplateInput } from '../../reel/types';

/**
 * hnc-hero — HNC League hero trailer (9:16, 60fps, 12s).
 *
 * One continuous `hero-attack` choreography covered by ten shots:
 * dark hook -> faceoff -> burst -> leading duel -> approach -> wind-up + shot
 * (speed ramp) -> reverse-angle goal -> celebration -> World Table climb ->
 * brand card. Moment clocks share boundaries, so every cut stays inside one
 * physical action; cuts land on actions (touch, hurdle landing, net impact).
 * All effect / audio / graphic timing derives from HERO_ATTACK beats.
 */

const LENGTH = HERO_ATTACK.length;
const clock = (from: number, to: number, ramp?: MomentClockSpec['ramp']): MomentClockSpec => ({ from, to, length: LENGTH, ramp });

/** Coverage: beat type, screen seconds, moment window, semantic camera move. */
const COVERAGE = {
  hook: { type: 'hook', duration: 1.0, clock: clock(0, 1.0), camera: 'ball-rise-reveal' },
  faceoff: { type: 'tension', duration: 1.5, clock: clock(1.0, HERO_ATTACK.kickoff), camera: 'faceoff-depth-push' },
  burst: { type: 'escalation', duration: 1.05, clock: clock(HERO_ATTACK.kickoff, 3.55), camera: 'runner-burst' },
  duel: { type: 'escalation', duration: 1.2, clock: clock(3.55, 4.75), camera: 'runner-lead' },
  approach: { type: 'escalation', duration: 0.75, clock: clock(4.75, 5.5), camera: 'runner-approach' },
  shot: { type: 'payoff', duration: 1.3, clock: clock(5.5, HERO_ATTACK.goalLine, 'anticipation-snap'), camera: 'striker-windup' },
  goal: { type: 'payoff', duration: 0.4, clock: clock(HERO_ATTACK.goalLine, 6.9), camera: 'net-reverse' },
  celebration: { type: 'reaction', duration: 1.4, clock: clock(6.9, 8.3), camera: 'scorer-push' },
  league: { type: 'leaderboard', duration: 1.6, clock: clock(8.3, 9.9), camera: 'crane-out' },
  brand: { type: 'brand', duration: 1.8, clock: clock(9.9, 11.7), camera: 'stadium-drift' },
} as const satisfies Record<string, { type: BeatSpec['type']; duration: number; clock: MomentClockSpec; camera: string }>;

type ShotName = keyof typeof COVERAGE;
const ORDER = Object.keys(COVERAGE) as ShotName[];

/** Illustrative World Table (promo values, not live standings). */
function worldTableRows(home: string, away: string): { code: string; points: number }[] {
  const others = ['BR', 'DE', 'JP', 'AR', 'FR'].filter((c) => c !== home && c !== away).slice(0, 3);
  return [
    { code: away, points: 41 },
    { code: home, points: 39 },
    { code: others[0], points: 37 },
    { code: others[1], points: 36 },
    { code: others[2], points: 34 },
  ];
}

export function compileHncHero(input: TemplateInput): ReelSpec {
  const seed = input.seed ?? 42;
  const fps = input.fps ?? 60;
  const { home, away } = input;
  const f = (seconds: number) => Math.round(seconds * fps);

  // Global start frame + length of every shot (same rounding as compileShotPlan).
  const start = {} as Record<ShotName, number>;
  const len = {} as Record<ShotName, number>;
  ORDER.reduce((acc, name) => {
    start[name] = acc;
    len[name] = f(COVERAGE[name].duration);
    return acc + len[name];
  }, 0);
  /** Shot-local frame at which a shot's clock reaches a moment beat. */
  const beatFrame = (name: ShotName, momentTime: number) => frameAtMomentTime(COVERAGE[name].clock, momentTime, len[name]);

  const contact = beatFrame('shot', HERO_ATTACK.contact); // inside the speed ramp
  const netHit = beatFrame('goal', HERO_ATTACK.netHit);
  const goalFrame = start.goal + netHit;
  const lightsFull = Math.round(len.hook * 0.56); // LightsOn full-power frame
  const tableIn = start.league + 6;

  const eyebrow = { kind: 'eyebrow' as const, text: 'HNC LEAGUE', data: { at: lightsFull, exitAt: start.faceoff + f(0.75) } };
  const board = (extra: Record<string, unknown> = {}) => ({
    kind: 'scoreboard' as const,
    data: { before: [0, 0], after: [1, 0], clock: "2ND 89'", flipAt: goalFrame, ...extra },
  });
  const goalCall = { kind: 'goal-call' as const, text: 'GOAL!', data: { at: goalFrame, exitAt: start.celebration + f(0.55), sub: "89' · LATE WINNER" } };

  const content: Record<ShotName, BeatContentSpec> = {
    hook: {
      effects: [{ type: 'lights-on', startFrame: 0, durationInFrames: len.hook }],
      graphics: [eyebrow],
      audio: [{ cue: 'crowd-bed', startFrame: 0, volume: 0.55 }],
    },
    faceoff: {
      // Game cinebars close in on the stand-off and snap open on the burst.
      effects: [{ type: 'cinebars', startFrame: 0, durationInFrames: len.faceoff }],
      graphics: [eyebrow, board({ enterAt: start.faceoff + f(0.3) })],
    },
    burst: { graphics: [board()] },
    duel: { graphics: [board()] },
    approach: { graphics: [board()] },
    shot: {
      effects: [
        { type: 'impact-burst', startFrame: contact, intensity: 1 },
        { type: 'impact-shake', startFrame: contact, durationInFrames: len.shot - contact, intensity: 0.9 },
        { type: 'zoom-punch', startFrame: contact, durationInFrames: len.shot - contact, intensity: 0.8 },
        { type: 'ball-trail', startFrame: contact + 1, durationInFrames: len.shot - contact - 1 },
      ],
      graphics: [board()],
      // Rising "OOOH" (1.85s file) pre-rolls from earlier shots to peak on contact.
      audio: [{ cue: 'crowd-gasp', startFrame: contact - f(1.85), volume: 0.8 }],
    },
    goal: {
      effects: [
        { type: 'ball-trail', startFrame: 0, durationInFrames: netHit + 1 },
        { type: 'impact-shake', startFrame: netHit, intensity: 1.3 },
        { type: 'zoom-punch', startFrame: netHit, intensity: 1 },
      ],
      graphics: [board(), goalCall],
      audio: [{ cue: 'goal-roar', startFrame: netHit, volume: 0.8 }],
    },
    // The HUD has done its job at the flip; the scorer gets a clean frame.
    celebration: {
      graphics: [goalCall],
      audio: [{ cue: 'celebration', startFrame: f(0.6), volume: 0.4 }],
    },
    league: {
      effects: [{ type: 'stadium-grade', startFrame: 0, intensity: 0.9 }],
      graphics: [
        {
          kind: 'world-table',
          data: {
            rows: worldTableRows(home, away),
            hero: home,
            gain: 3,
            enterAt: tableIn,
            climbAt: tableIn + f(0.75),
            exitAt: start.brand,
            lines: ['YOUR COUNTRY.', 'YOUR LEAGUE.'],
          },
        },
      ],
    },
    brand: {
      // Starts "already in" so the grade carries over the cut.
      effects: [{ type: 'stadium-grade', startFrame: -f(0.4), durationInFrames: len.brand + f(0.4), intensity: 1 }],
      graphics: [
        {
          kind: 'brand-reveal',
          data: { at: start.brand - 3, words: ['PLAY.', 'WIN.', 'CLIMB.'], site: 'hncleague.com', footer: 'RETRO FOOTBALL. REAL RIVALRIES.' },
        },
      ],
    },
  };

  // Procedural SFX (rendered into one stem with the game's synth recipes),
  // each placed in whichever shot's clock owns that moment instant.
  const sfx = Object.fromEntries(ORDER.map((n) => [n, [] as AudioCueSpec[]])) as Record<ShotName, AudioCueSpec[]>;
  const cueAt = (momentTime: number, cue: string, volume: number) => {
    const name = ORDER.find((n) => momentTime >= COVERAGE[n].clock.from && momentTime < COVERAGE[n].clock.to);
    if (name) sfx[name].push({ cue, startFrame: beatFrame(name, momentTime), volume });
  };
  // Floodlight banks striking (LightsOn bank frames 16% / 36% / 56%).
  for (const k of [0.16, 0.36, 0.56]) sfx.hook.push({ cue: 'impact', startFrame: Math.round(len.hook * k), volume: 3.4 });
  for (const t of HERO_TOUCHES) cueAt(t, 'kick', 1.6);
  cueAt(HERO_ATTACK.slide, 'whoosh', 1.4);
  cueAt(COVERAGE.duel.clock.from - 0.04, 'whoosh', 2);
  cueAt(COVERAGE.approach.clock.from - 0.04, 'whoosh', 2);
  cueAt(HERO_ATTACK.contact, 'shot', 3);
  cueAt(HERO_ATTACK.contact, 'impact', 3.5);
  cueAt(HERO_ATTACK.goalLine - 0.04, 'whoosh', 2.2);
  cueAt(HERO_ATTACK.netHit, 'impact', 4);
  cueAt(HERO_ATTACK.netHit, 'goal-sting', 2.2);
  sfx.league.push({ cue: 'whoosh', startFrame: 6, volume: 1.2 });
  sfx.brand.push({ cue: 'brand-sting', startFrame: 15, volume: 3 }); // on the first word

  const beats: BeatSpec[] = ORDER.map((name) => ({
    type: COVERAGE[name].type,
    duration: COVERAGE[name].duration,
    content: {
      stage: 'stadium',
      footballMoment: 'hero-attack',
      home,
      away,
      attackingTeam: 'home',
      momentClock: COVERAGE[name].clock,
      camera: COVERAGE[name].camera,
      ...content[name],
      audio: [...(content[name].audio ?? []), ...sfx[name]],
    },
  }));

  return {
    id: `hnc-hero-${home.toLowerCase()}-${away.toLowerCase()}-${seed}`,
    format: 'instagram-reel',
    fps: fps as 30 | 60,
    durationInSeconds: Math.round(ORDER.reduce((a, n) => a + COVERAGE[n].duration, 0) * 1000) / 1000,
    seed,
    theme: { mood: input.mood ?? 'hype' },
    stages: [{ id: 'stadium', kind: 'football', asset: 'hnc-stadium' }],
    beats,
    audio: { ducking: true, sfxStem: true },
    branding: { league: 'HNC LEAGUE', site: 'hncleague.com', logoAsset: 'hnc-logo', showLogo: true },
  };
}
