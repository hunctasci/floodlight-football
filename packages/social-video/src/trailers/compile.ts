import { compileVideo } from '../timeline';
import { DEFAULT_CTA, BRAND_DOMAIN } from '../overlays/presets';
import { getCountry } from '../../../../apps/game/src/city-league/countries';
import type { OverlayPlanEntry, VersusPayload } from '../overlays/types';
import type { CompiledTrailer, TrailerId, TrailerShotDef } from './types';
import { WORLD_LEAGUE_HERO_DURATION, worldLeagueHeroShots } from './presets';
import { compileTrailerAudio } from './audio';
import { resolveTrailerSpec, type RawTrailerInput, type ResolvedTrailerSpec } from '../schema';

function versusPayload(home: string, away: string, layout: VersusPayload['layout']): VersusPayload {
  const h = getCountry(home);
  const a = getCountry(away);
  if (!h || !a) throw new Error(`Unknown country code: ${!h ? home : away}`);
  return {
    homeCode: home, awayCode: away,
    homeName: h.name.toUpperCase(), awayName: a.name.toUpperCase(),
    homeFlag: h.flag, awayFlag: a.flag, layout,
  };
}

/**
 * Trailer-global overlay plan. The game is the ad for the first 15s: only
 * the hook, two matchup cards, three concept lines, then the end card.
 */
export function trailerOverlayPlan(
  countries: readonly [string, string, string, string, string, string],
  overlaysMode: string,
): OverlayPlanEntry[] {
  if (overlaysMode === 'none') return [];
  const [tr, gr, br, ar, de, fr] = countries;
  void de;
  void fr;
  const entries: OverlayPlanEntry[] = [
    { kind: 'headline', start: 0.0, end: 0.55, text: 'PICK YOUR COUNTRY.' },
    { kind: 'versus', start: 6.20, end: 6.90, versus: versusPayload(br, ar, 'strip') },
    { kind: 'versus', start: 9.00, end: 9.60, versus: versusPayload(de, fr, 'strip') },
    { kind: 'headline', start: 13.20, end: 13.85, text: 'PICK A COUNTRY' },
    { kind: 'headline', start: 13.85, end: 14.50, text: 'WIN 1V1 MATCHES' },
    { kind: 'headline', start: 14.50, end: 15.20, text: 'CLIMB THE WORLD LEAGUE' },
    { kind: 'cta', start: 16.15, end: 99, text: DEFAULT_CTA },
    { kind: 'brand', start: 16.15, end: 99 },
  ];
  void tr;
  void gr;
  void BRAND_DOMAIN;
  return Object.freeze(entries.map((e) => Object.freeze(e))) as OverlayPlanEntry[];
}

const SOURCE_LOCAL_DURATION: Record<TrailerShotDef['source'], number> = {
  faceoff: 4,
  'attack-goal': 9.5,
  'cross-header-goal': 8,
  'crossbar-chaos': 9.5,
  'keeper-disaster': 10.5,
};

/**
 * Compile a trailer spec into a deterministic global timeline. Pure: same
 * input → same shots, overlays and audio. Source scene videos are compiled
 * once per (scene, matchup) and shared across shots.
 */
export function compileTrailerFromResolved(resolved: ResolvedTrailerSpec): CompiledTrailer {
  const trailer: TrailerId = resolved.trailer;
  if (trailer !== 'world-league-hero') throw new Error(`Unsupported trailer: ${String(trailer)}`);
  const shots = worldLeagueHeroShots();
  const duration = WORLD_LEAGUE_HERO_DURATION;
  const [c0h, c0a, c1h, c1a, c2h, c2a] = resolved.countries;
  const matchups = [
    { home: c0h, away: c0a },
    { home: c1h, away: c1a },
    { home: c2h, away: c2a },
  ] as const;

  const videoCache = new Map<string, ReturnType<typeof compileVideo>>();
  const videoFor = (scene: TrailerShotDef['source'], matchup: 0 | 1 | 2) => {
    const key = `${scene}|${matchup}`;
    let v = videoCache.get(key);
    if (!v) {
      const m = matchups[matchup];
      v = compileVideo({
        scene: scene as 'faceoff',
        home: m.home, away: m.away,
        format: resolved.format, seed: resolved.seed,
        fps: resolved.fps, duration: SOURCE_LOCAL_DURATION[scene],
        attackTeam: 'home', attackStyle: 'central', overlays: 'none',
      });
      videoCache.set(key, v);
    }
    return v;
  };

  const segments = shots.map((s) => {
    const segDur = s.end - s.start;
    const srcDur = s.srcEnd - s.srcStart;
    return Object.freeze({
      ...s,
      duration: segDur,
      srcDuration: srcDur,
      rate: srcDur / segDur,
      video: videoFor(s.source, s.matchup),
    });
  });

  const audio = compileTrailerAudio({
    seed: resolved.seed,
    shots: segments,
    totalDuration: duration,
  });

  return Object.freeze({
    trailer,
    countries: resolved.countries,
    format: resolved.format,
    seed: resolved.seed,
    width: resolved.width,
    height: resolved.height,
    pixelRatio: resolved.pixelRatio,
    fps: resolved.fps,
    duration,
    totalFrames: Math.round(duration * resolved.fps),
    attackTeam: resolved.attackTeam,
    attackStyle: resolved.attackStyle,
    overlaysMode: resolved.overlays,
    shots: Object.freeze(segments),
    overlayPlan: trailerOverlayPlan(resolved.countries, resolved.overlays),
    audio,
  });
}

export function compileTrailer(input: RawTrailerInput): CompiledTrailer {
  return compileTrailerFromResolved(resolveTrailerSpec(input));
}
