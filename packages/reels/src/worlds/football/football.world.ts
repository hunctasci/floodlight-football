import { hncPresetLens } from '@floodlight/hnc-visuals';
import { momentTimeAt } from '../../animation/time-ramp';
import type { Shot } from '../../engine/timeline/types';
import type { Subject, WorldDef } from '../types';
import { v3 } from '../types';
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
  return sampleFootballMoment(footballMoment(shot.set), shotMomentTime(shot, frame, fps) - lagSeconds);
}

function anchorsOf(c: ChoreoFrame): LensAnchors {
  const ground = { x: c.ball.x, z: c.ball.z };
  return {
    ball: c.ball,
    hero: c.anchors?.hero ?? ground,
    rival: c.anchors?.rival ?? ground,
    keeper: c.anchors?.keeper ?? { x: 43.4, z: 0 },
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
    roles: 'Cast id per role, e.g. { striker: "hero", rival: "rival" } (hero-attack roles: striker, rival, keeper, mate, holder)',
  },
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
