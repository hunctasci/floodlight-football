import { hncPresetLens } from '@floodlight/hnc-visuals';
import { momentTimeAt } from '../../animation/time-ramp';
import type { Shot } from '../../engine/timeline/types';
import type { Subject, WorldDef } from '../types';
import { v3 } from '../types';
import { clamp01, sceneFx, smooth01, type SceneShots } from '../events';
import { FOOTBALL_MOMENT_IDS, MOMENT_BEATS, MOMENT_LENGTH, MOMENT_ROLES, sampleFootballMoment, type ChoreoActor, type ChoreoFrame } from './choreography';
import { CAMERA_MOVE_IDS, cameraMoveLag, evaluateCameraMove, evaluateReelLens, isCameraMoveId, REEL_LENS_IDS, type LensAnchors } from './lenses';

/**
 * football — the canonical HNC stadium (hnc-visuals) with a deterministic
 * choreography (`set.moment`). Cast members play choreography roles
 * (`set.roles: { striker: 'hero', rival: 'rival' }`): they lend the role their
 * country kit, number and skin, and become camera subjects under their own id.
 *
 * Beats carry world clocks (moment seconds). Unset clocks chain: each beat
 * continues where the previous one stopped, so coverage of one action cuts
 * continuously.
 */

export type FootballLightId = 'day' | 'night' | 'dawn' | 'horror';
export const FOOTBALL_LIGHT_IDS: FootballLightId[] = ['day', 'night', 'dawn', 'horror'];

export function footballLight(set: Record<string, unknown>): FootballLightId {
  return FOOTBALL_LIGHT_IDS.includes(set.light as FootballLightId) ? (set.light as FootballLightId) : 'day';
}

/**
 * Stadium light level at a frame (pure): `lights-out` stutters the banks to
 * black across its window; `lights-up` strikes them back bank by bank. A scene
 * whose first light event is `lights-up` starts dark. Returns the overall
 * level and a per-floodlight-head level (stagger).
 */
export function footballLightLevel(tl: SceneShots | undefined, shot: Shot, frame: number): { level: number; heads: number[] } {
  const evs = [...sceneFx(tl, shot, 'lights-out'), ...sceneFx(tl, shot, 'lights-up')].sort((a, b) => a.start - b.start);
  const started = evs.filter((e) => frame >= e.start);
  const last = started[started.length - 1];
  const k = typeof shot.set.floodLevel === 'number' ? Math.min(1, Math.max(0, shot.set.floodLevel)) : 1;
  const all = (v: number) => ({ level: v * k, heads: [v, v, v, v].map((h) => h * k) });
  if (!last) return all(evs[0]?.type === 'lights-up' ? 0 : 1);
  const p = clamp01((frame - last.start) / Math.max(1, last.end - last.start));
  if (last.type === 'lights-out') {
    // Two stutters, then gone (bank 0 last: the key light dies at the end).
    const stutter = p < 0.2 ? 0.35 : p < 0.35 ? 1 : p < 0.5 ? 0.15 : p < 0.62 ? 0.7 : 0;
    return { level: stutter * k, heads: [p < 0.62 ? stutter : 0, p < 0.2 ? 1 : 0, p < 0.35 ? 1 : 0, p < 0.5 ? 0.6 : 0].map((h) => h * k) };
  }
  const heads = [0, 1, 2, 3].map((i) => (p >= 0.12 + i * 0.16 ? k : 0));
  return { level: smooth01(p / 0.7) * k, heads };
}

export function footballMoment(set: Record<string, unknown>): string {
  return typeof set.moment === 'string' ? set.moment : 'hero-attack';
}

export function footballRoles(set: Record<string, unknown>): Record<string, string> {
  return (set.roles ?? {}) as Record<string, string>;
}

/** Moment seconds of a football shot at an absolute frame. */
export function shotMomentTime(shot: Shot, frame: number, fps: number): number {
  const local = frame - shot.start;
  const length = MOMENT_LENGTH[footballMoment(shot.set)] ?? 12;
  if (!shot.clock) return Math.min(length, Math.max(0, local / fps));
  return momentTimeAt({ ...shot.clock, length, ramp: shot.clock.ramp as never }, local, shot.duration);
}

export function shotChoreo(shot: Shot, frame: number, fps: number, lagSeconds = 0): ChoreoFrame {
  const t = shotMomentTime(shot, frame, fps) - lagSeconds;
  const c = sampleFootballMoment(footballMoment(shot.set), t);
  return typeof shot.set.dropBall === 'number' ? withDropBall(c, t, shot.set.dropBall) : c;
}

/**
 * Referee's drop ball: before moment time `land` the ball falls (real gravity)
 * onto its resting spot, then settles in two shrinking bounces.
 */
function withDropBall(c: ChoreoFrame, t: number, land: number): ChoreoFrame {
  const R = 0.25;
  if (t >= land + 0.9) return c;
  const b = c.ball;
  if (t < land) {
    const y = R + 0.5 * 9.81 * (land - t) ** 2;
    return { ...c, ball: { ...b, y }, ballHidden: y > 16 || c.ballHidden, ballSpin: { x: t * 3, y: t * 1.3, z: 0 } };
  }
  const dt = t - land;
  // Bounces: 0.55 s (peak ~0.37 m) then 0.28 s (peak ~0.1 m).
  const hop = dt < 0.55 ? 0.37 * Math.sin(Math.PI * (dt / 0.55)) : dt < 0.83 ? 0.1 * Math.sin(Math.PI * ((dt - 0.55) / 0.28)) : 0;
  return { ...c, ball: { ...b, y: R + hop } };
}

function anchorsOf(c: ChoreoFrame): LensAnchors {
  const ground = { x: c.ball.x, z: c.ball.z };
  return {
    ball: c.ball,
    hero: c.anchors?.hero ?? ground,
    rival: c.anchors?.rival ?? ground,
    keeper: c.anchors?.keeper ?? { x: 43.4, z: 0 },
    heroLift: c.anchors?.heroLift ?? 0,
  };
}

/** Head from the choreographed pose: sliding / fallen / diving heads are near the grass. */
function actorSubject(a: ChoreoActor): Subject {
  const act = a.pose?.action;
  const low = act === 'slide' || act === 'fallen' ? 0.55 : act === 'dive' ? 0.7 : 1.7;
  const reach = act === 'slide' || act === 'fallen' ? 1.0 : 0;
  const head = v3(a.x + Math.sin(a.facing) * reach, low, a.z + Math.cos(a.facing) * reach);
  return { kind: 'actor', pos: v3(a.x, 0, a.z), head, facing: a.facing, radius: 0.5 };
}

const FLOODLIGHTS = {
  floodlight: v3(58, 20.4, -38),
  'floodlight-near': v3(58, 20.4, 38),
  'floodlight-home': v3(-58, 20.4, -38),
  'floodlight-home-near': v3(-58, 20.4, 38),
};

export const FOOTBALL_WORLD: WorldDef = {
  id: 'football',
  kind: '3d',
  summary: 'Canonical HNC stadium with a deterministic choreography; cast mapped onto roles.',
  params: {
    moment: `Choreography id (${FOOTBALL_MOMENT_IDS.join(', ')})`,
    roles: 'Cast id per role, e.g. { striker: "hero", rival: "rival" } (roles per moment: see Moments below)',
    light: 'day | night | dawn | horror (default day: the canonical game rig)',
    crowd: 'full | empty (default full)',
    dropBall: 'Moment second the ball lands from a referee drop (falls from above before it)',
    tifo: 'Country code of a cloth tifo over the far terraces (e.g. "TR")',
    home: 'Home country when no cast plays a home role (default TR)',
    away: 'Away country when no cast plays an away role (default GR); kits resolve clashes with the game rule',
    floodTint: 'Hex colour the floodlights carry (e.g. a nation’s Current after a re-light); heads, beams and halos',
    crowdLight: '"follow": the (unlit) crowd dims with the floodlights during lights-out (default: stays lit)',
    floodLevel: '0..1 overall floodlight level for a moodier night (default 1)',
  },
  effects: ['lights-out', 'lights-up', 'aura', 'current-lines', 'crowd-current'],
  marks: {},
  props: {
    'goal-away': { pos: v3(46, 1.3, 0), size: 2.5, summary: 'Goal the striker attacks' },
    'centre-spot': { pos: v3(0, 0.1, 0), size: 0.6 },
  },
  lights: FLOODLIGHTS,
  surfaces: {},
  defaultLook: 'kit',
  ambience: 'crowd-bed',
  lensIds: [...new Set(['wide', ...CAMERA_MOVE_IDS, ...REEL_LENS_IDS])],
  lens(id, ctx) {
    const u = Math.min(1, Math.max(0, (ctx.frame - ctx.shot.start) / Math.max(1, ctx.shot.duration)));
    if (isCameraMoveId(id)) {
      return evaluateCameraMove(id, u, anchorsOf(shotChoreo(ctx.shot, ctx.frame, ctx.fps, cameraMoveLag(id))));
    }
    const c = shotChoreo(ctx.shot, ctx.frame, ctx.fps);
    if (id === 'wide') return hncPresetLens('broadcast-wide', { ball: c.ball });
    return evaluateReelLens(id, anchorsOf(c));
  },
  validateSet(set, cast) {
    const out: string[] = [];
    const moment = footballMoment(set);
    if (set.light !== undefined && !FOOTBALL_LIGHT_IDS.includes(set.light as FootballLightId)) out.push(`unknown light "${String(set.light)}" (known: ${FOOTBALL_LIGHT_IDS.join(', ')})`);
    if (set.crowd !== undefined && set.crowd !== 'full' && set.crowd !== 'empty') out.push('crowd must be full | empty');
    if (!FOOTBALL_MOMENT_IDS.includes(moment)) out.push(`unknown moment "${moment}" (known: ${FOOTBALL_MOMENT_IDS.join(', ')})`);
    const roles = MOMENT_ROLES[moment] ?? [];
    for (const [role, castId] of Object.entries(footballRoles(set))) {
      if (!roles.includes(role)) out.push(`unknown role "${role}" for ${moment} (roles: ${roles.join(', ')})`);
      if (!cast[castId]) out.push(`role "${role}" maps to unknown cast member "${castId}"`);
    }
    return out;
  },
  castSubjects(shot, frame, fps) {
    const c = shotChoreo(shot, frame, fps);
    const roles = MOMENT_ROLES[footballMoment(shot.set)] ?? [];
    const out: Record<string, Subject> = {};
    for (const [role, castId] of Object.entries(footballRoles(shot.set))) {
      const a = c.actors[roles.indexOf(role)];
      if (a) out[castId] = actorSubject(a);
    }
    return out;
  },
  dynamicSubjects(shot, frame, fps) {
    const c = shotChoreo(shot, frame, fps);
    const roles = MOMENT_ROLES[footballMoment(shot.set)] ?? [];
    const out: Record<string, Subject> = {
      ball: { kind: 'ball', pos: v3(c.ball.x, 0, c.ball.z), head: v3(c.ball.x, c.ball.y, c.ball.z), facing: 0, radius: 0.3 },
    };
    roles.forEach((role, i) => {
      if (c.actors[i]) out[role] = actorSubject(c.actors[i]);
    });
    return out;
  },
  momentBeats: (set) => MOMENT_BEATS[footballMoment(set)] ?? {},
  clockLength: (set) => MOMENT_LENGTH[footballMoment(set)] ?? 12,
};
