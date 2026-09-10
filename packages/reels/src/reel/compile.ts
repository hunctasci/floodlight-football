import type { ReelSpec, ShotPlan, ShotSpec, TemplateInput } from './types';
import { formatSize } from './presets';

/**
 * StoryCompiler: TemplateInput -> ReelSpec -> ShotPlan.
 * Pure and deterministic. Creative decisions (cameras, anchors, transitions,
 * captions) live here; stories never carry coordinates or asset paths.
 */

export function compileTemplate(input: TemplateInput): ReelSpec {
  if (input.template === 'country-rivalry') return compileCountryRivalry(input);
  return compileOfficeRivalry(input);
}

function baseBranding(cta?: string) {
  return {
    league: 'HNC LEAGUE',
    site: 'hncleague.com',
    logoAsset: 'hnc-logo',
    showLogo: true,
  };
}

export function compileCountryRivalry(input: TemplateInput): ReelSpec {
  const seed = input.seed ?? 42;
  const fps = input.fps ?? 30;
  const home = input.home;
  const away = input.away;
  const headline = input.headline ?? 'EVERY WIN COUNTS';
  const cta = input.cta ?? 'PLAY FOR YOUR COUNTRY';
  const moment = input.footballMoment ?? 'attack-goal';
  void fps;
  return {
    id: `country-rivalry-${home.toLowerCase()}-${away.toLowerCase()}-${seed}`,
    format: 'instagram-reel',
    fps: input.fps ?? 30,
    durationInSeconds: 15.5,
    seed,
    theme: { mood: input.mood ?? 'hype' },
    cast: [
      { id: 'home-striker', model: 'hnc-footballer', country: home, role: 'footballer', anchor: 'faceoff-home' },
      { id: 'away-striker', model: 'hnc-footballer', country: away, role: 'footballer', anchor: 'faceoff-away' },
    ],
    stages: [
      { id: 'stadium', kind: 'football', asset: 'hnc-stadium' },
      { id: 'graphics', kind: 'graphics-only' },
    ],
    beats: [
      {
        type: 'hook',
        duration: 3.0,
        content: {
          stage: 'stadium',
          camera: 'football-faceoff',
          footballMoment: 'faceoff',
          home,
          away,
          graphics: [
            { kind: 'versus', data: { home, away }, startFrame: 0, durationInFrames: 90 },
            { kind: 'headline', text: 'PICK A SIDE', preset: 'impact', startFrame: 0, durationInFrames: 60 },
          ],
          audio: [{ cue: 'crowd-gasp', startFrame: 0 }],
        },
      },
      {
        type: 'payoff',
        duration: 9.5,
        content: {
          stage: 'stadium',
          camera: 'football-broadcast',
          footballMoment: moment,
          home,
          away,
          attackingTeam: 'home',
          graphics: [{ kind: 'goal-banner', data: { home, away }, startFrame: 0, durationInFrames: 60 }],
          audio: [
            { cue: 'kick', startFrame: 30 },
            { cue: 'shot', startFrame: 150 },
            { cue: 'goal-roar', startFrame: 170 },
          ],
        },
      },
      {
        type: 'cta',
        duration: 3.0,
        content: {
          stage: 'graphics',
          camera: 'graphics-static',
          graphics: [
            { kind: 'cta', text: cta, startFrame: 0, durationInFrames: 90 },
            { kind: 'brand', startFrame: 0, durationInFrames: 90 },
          ],
          audio: [{ cue: 'brand-sting', startFrame: 0 }],
        },
      },
    ],
    audio: { ducking: true },
    captions: {
      preset: 'sports',
      cues: [{ text: headline, startFrame: 0, durationInFrames: 60, preset: 'sports' }],
    },
    branding: { ...baseBranding(cta), site: 'hncleague.com' },
  };
}

export function compileOfficeRivalry(input: TemplateInput): ReelSpec {
  const seed = input.seed ?? 42;
  const fps = input.fps ?? 30;
  const home = input.home;
  const away = input.away;
  const headline = input.headline ?? 'WHEN YOUR COWORKER SUPPORTS THE WRONG COUNTRY';
  const cta = input.cta ?? 'YOUR COUNTRY NEEDS YOU';
  const moment = input.footballMoment ?? 'crossbar-chaos';
  void fps;
  return {
    id: `office-rivalry-${home.toLowerCase()}-${away.toLowerCase()}-${seed}`,
    format: 'instagram-reel',
    fps: input.fps ?? 30,
    durationInSeconds: 16.0,
    seed,
    theme: { mood: 'comedy' },
    cast: [
      { id: 'home-worker', model: 'office-worker-male-01', country: home, role: 'office-worker', anchor: 'desk-left', animation: 'typing' },
      { id: 'away-worker', model: 'office-worker-male-02', country: away, role: 'office-worker', anchor: 'desk-right', animation: 'typing' },
    ],
    stages: [
      { id: 'office', kind: 'office', asset: 'office-modern-01' },
      { id: 'stadium', kind: 'football', asset: 'hnc-stadium' },
      { id: 'graphics', kind: 'graphics-only' },
    ],
    beats: [
      {
        type: 'hook',
        duration: 0.8,
        content: {
          stage: 'office',
          camera: 'wide-establish',
          actors: [
            { actor: 'home-worker', anchor: 'desk-left', animation: 'typing' },
            { actor: 'away-worker', anchor: 'desk-right', animation: 'typing' },
          ],
          graphics: [{ kind: 'headline', text: headline, preset: 'meme', startFrame: 0, durationInFrames: 24 }],
          audio: [{ cue: 'office-ambience', startFrame: 0, durationInFrames: 24 }],
        },
      },
      {
        type: 'setup',
        duration: 2.0,
        content: {
          stage: 'office',
          camera: 'medium-two-shot',
          actors: [
            { actor: 'home-worker', anchor: 'desk-left', animation: 'typing' },
            { actor: 'away-worker', anchor: 'desk-right', animation: 'typing' },
          ],
          audio: [{ cue: 'typing', startFrame: 0 }],
        },
      },
      {
        type: 'reveal',
        duration: 1.2,
        content: {
          stage: 'office',
          camera: 'desk-right-close',
          actors: [{ actor: 'away-worker', anchor: 'desk-right', animation: 'celebrate' }],
          graphics: [{ kind: 'leaderboard', data: { home, away, leader: away }, startFrame: 0, durationInFrames: 36 }],
          audio: [{ cue: 'tension-rise', startFrame: 0 }],
        },
      },
      {
        type: 'reaction',
        duration: 1.0,
        content: {
          stage: 'office',
          camera: 'close-reaction',
          actors: [{ actor: 'home-worker', anchor: 'desk-left', animation: 'side-eye' }],
          graphics: [{ kind: 'caption', text: '* slow side-eye *', preset: 'meme', startFrame: 0, durationInFrames: 30 }],
          audio: [{ cue: 'record-scratch', startFrame: 0 }],
        },
      },
      {
        type: 'escalation',
        duration: 0.8,
        content: {
          stage: 'office',
          camera: 'dramatic-push',
          actors: [
            { actor: 'home-worker', anchor: 'desk-left', animation: 'angry' },
            { actor: 'away-worker', anchor: 'desk-right', animation: 'celebrate' },
          ],
          audio: [{ cue: 'tension-rise', startFrame: 0 }],
        },
      },
      {
        type: 'transition',
        duration: 0.7,
        content: {
          stage: 'office',
          camera: 'dramatic-push',
          transitionOut: { type: 'cloud-puff', durationInFrames: 21, intensity: 1 },
          audio: [
            { cue: 'poof', startFrame: 0 },
            { cue: 'whoosh', startFrame: 4 },
          ],
          effects: [{ type: 'screen-shake', intensity: 0.5, startFrame: 8, durationInFrames: 13 }],
        },
      },
      {
        type: 'payoff',
        duration: 6.3,
        content: {
          stage: 'stadium',
          camera: 'football-broadcast',
          footballMoment: moment,
          home,
          away,
          attackingTeam: 'home',
          audio: [
            { cue: 'stadium-reveal', startFrame: 0 },
            { cue: 'kick', startFrame: 20 },
            { cue: 'crossbar', startFrame: 120 },
            { cue: 'goal-roar', startFrame: 150 },
          ],
        },
      },
      {
        type: 'punchline',
        duration: 1.2,
        content: {
          stage: 'stadium',
          camera: 'celebration-close',
          footballMoment: moment,
          home,
          away,
          graphics: [{ kind: 'caption', text: 'WORK IS GOING TO BE AWKWARD TOMORROW', preset: 'meme', startFrame: 0, durationInFrames: 36 }],
          effects: [{ type: 'freeze-frame', startFrame: 0, durationInFrames: 12 }],
          audio: [{ cue: 'celebration', startFrame: 0 }],
        },
      },
      {
        type: 'cta',
        duration: 2.0,
        content: {
          stage: 'graphics',
          camera: 'graphics-static',
          graphics: [
            { kind: 'cta', text: cta, startFrame: 0, durationInFrames: 60 },
            { kind: 'brand', startFrame: 0, durationInFrames: 60 },
          ],
          audio: [{ cue: 'brand-sting', startFrame: 0 }],
        },
      },
    ],
    audio: { ducking: true },
    captions: {
      preset: 'meme',
      cues: [
        { text: 'WORK IS GOING TO BE AWKWARD TOMORROW', startFrame: 384, durationInFrames: 36, preset: 'meme' },
      ],
    },
    branding: baseBranding(cta),
  };
}

/** Convert beats (seconds) into concrete shots (frames). Pure. */
export function compileShotPlan(spec: ReelSpec): ShotPlan {
  const { width, height } = formatSize(spec.format);
  const totalFrames = Math.round(spec.durationInSeconds * spec.fps);
  const shots: ShotSpec[] = [];
  let cursor = 0;
  spec.beats.forEach((beat, i) => {
    const durationInFrames = Math.round(beat.duration * spec.fps);
    const c = beat.content ?? {};
    shots.push({
      id: `shot-${i}-${beat.type}`,
      stage: c.stage ?? spec.stages?.[0]?.id ?? 'graphics',
      startFrame: cursor,
      durationInFrames,
      camera: c.camera,
      actors: c.actors,
      overlays: c.graphics,
      transitionIn: c.transitionIn ?? (i > 0 ? undefined : undefined),
      transitionOut: c.transitionOut,
      effects: c.effects,
      audio: c.audio,
      footballMoment: c.footballMoment,
      home: c.home,
      away: c.away,
      attackingTeam: c.attackingTeam,
    });
    cursor += durationInFrames;
  });
  // Fix rounding drift on the last shot so the plan always covers totalFrames.
  if (shots.length > 0) {
    const drift = totalFrames - cursor;
    shots[shots.length - 1].durationInFrames += drift;
  }
  return { specId: spec.id, fps: spec.fps, totalFrames, width, height, seed: spec.seed, shots };
}
