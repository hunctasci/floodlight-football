import * as THREE from 'three';
import { HNC_PITCH, createHncPlayerVisual, type HncPlayerVisual } from '@floodlight/hnc-visuals';
import { CURRENT_GOLD, CURRENT_TUNED, CURRENT_WHITE } from '../../../packages/reels/src/effects/current.ts';
import { getCountry } from '../../../apps/game/src/city-league/countries.ts';
import type { ChoreoActor } from '../../../packages/reels/src/worlds/football/choreography.ts';
import { sampleFootballMoment } from '../../../packages/reels/src/worlds/football/choreography.ts';
import { applyChoreoActor } from '../../../packages/reels/src/worlds/football/pose.ts';
import { playerRoles, playerTag } from './interchange.ts';

/**
 * Pose tracks — the ONE motion truth for Blender plates.
 *
 * A plate never re-implements poses in Python: every frame, the canonical
 * `applyChoreoActor` (the same call the Remotion football world makes) poses
 * a canonical HNC player, and the local TRS of every export-named node
 * (`TR09.Leg.R`…, see interchange.ts) is recorded in HNC/glTF space. Blender
 * converts with the importer's per-node rule and keyframes the imported
 * objects. World-space probes let Blender prove it reproduced the pose.
 */

export interface PlateActor {
  country: string;
  number: number;
  keeper?: boolean;
  /** Choreography role (index in the moment's roles) … */
  roleIndex?: number;
  /** … or a hand-directed actor for non-match plates (portraits). */
  actor?: (t: number) => ChoreoActor;
}

export interface PlateSpec {
  id: string;
  /** Frames at 60 fps; plate frame n (1-based) is shown on shot-local frame n-1. */
  frames: number;
  /** Moment clock over the plate (linear, like a beat clock) … */
  moment?: string;
  clock?: { from: number; to: number };
  actors: PlateActor[];
  /** Include the canonical ball, posed from the choreography (or a fixed point). */
  ball?: boolean | { x: number; y: number; z: number };
  /** Subtract this ground point (HNC x, z) from every position: centre a portrait on the origin. */
  recentre?: { x: number; z: number };
  /** Static canonical props (exported asset ids, e.g. 'hnc-goal'), world-placed. */
  props?: string[];
  /** Blender builder (tools/blender/py/hnc_blender/plates_*.py). */
  builder: string;
  /** Free data for the builder (colours, framing). */
  look?: Record<string, unknown>;
}

type TRS = number[]; // px py pz qx qy qz qw sx sy sz (HNC/glTF space)

export interface PoseTrackFile {
  schema: 'hnc-pose-track/1';
  plate: string;
  builder: string;
  fps: number;
  frames: number;
  momentTimes: number[];
  look: Record<string, unknown>;
  /** Current palette + canonical pitch dimensions (Blender never hand-types them). */
  palette: Record<string, string>;
  pitch: typeof HNC_PITCH;
  props: string[];
  actors: { tag: string; asset: string; root: string; nodes: Record<string, TRS[]>; probes: Record<string, number[][]> }[];
  ball?: { root: string; frames: TRS[] };
}

const FPS = 60;
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function trs(o: THREE.Object3D, recentre?: { x: number; z: number }): TRS {
  const p = o.position.clone();
  if (recentre) {
    p.x -= recentre.x;
    p.z -= recentre.z;
  }
  return [p.x, p.y, p.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z].map(r6);
}

function assetOf(a: PlateActor): string {
  return `hnc-player-${a.country.toLowerCase()}-${String(a.number).padStart(2, '0')}${a.keeper ? '-keeper' : ''}`;
}

function visualOf(a: PlateActor): HncPlayerVisual {
  const c = getCountry(a.country);
  if (!c) throw new Error(`unknown country ${a.country}`);
  return createHncPlayerVisual({ id: a.number, number: a.number, primary: c.colors.primary, secondary: c.colors.secondary, keeper: !!a.keeper });
}

export function momentTimeOf(spec: PlateSpec, frame: number): number {
  if (!spec.clock) return (frame - 1) / FPS;
  return spec.clock.from + ((spec.clock.to - spec.clock.from) * (frame - 1)) / spec.frames;
}

export function bakePlate(spec: PlateSpec): PoseTrackFile {
  const times = Array.from({ length: spec.frames }, (_, i) => momentTimeOf(spec, i + 1));
  const actors = spec.actors.map((a) => {
    const v = visualOf(a);
    const tag = playerTag(a.country, a.number);
    const roles = playerRoles(v, tag);
    const nodes: Record<string, TRS[]> = {};
    const probes: Record<string, number[][]> = { [`${tag}.Head`]: [], [`${tag}.Boot.R`]: [] };
    for (const [, role] of roles) nodes[role.name] = [];
    for (const t of times) {
      const actor = a.actor ? a.actor(t) : sampleFootballMoment(spec.moment ?? 'meridian', t).actors[a.roleIndex ?? 0];
      applyChoreoActor(v, actor, t);
      v.root.updateMatrixWorld(true);
      for (const [obj, role] of roles) nodes[role.name].push(trs(obj, obj === v.root ? spec.recentre : undefined));
      for (const [obj, role] of roles) {
        if (!probes[role.name]) continue;
        const w = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
        if (spec.recentre) {
          w.x -= spec.recentre.x;
          w.z -= spec.recentre.z;
        }
        probes[role.name].push([r6(w.x), r6(w.y), r6(w.z)]);
      }
    }
    const root = roles.get(v.root)!.name;
    return { tag, asset: assetOf(a), root, nodes, probes };
  });
  let ball: PoseTrackFile['ball'];
  if (spec.ball) {
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    ball = {
      root: 'HNC_Ball',
      frames: times.map((t) => {
        const c = typeof spec.ball === 'object' ? undefined : sampleFootballMoment(spec.moment ?? 'meridian', t);
        const b = typeof spec.ball === 'object' ? spec.ball : { ...c!.ball, y: Math.max(0.25, c!.ball.y) };
        // Same rotation rule as the football world: explicit spin, else the game's rolling rule.
        if (c?.ballSpin) e.set(c.ballSpin.x, c.ballSpin.y, c.ballSpin.z);
        else e.set(b.z * 2, 0, -b.x * 2);
        q.setFromEuler(e);
        const x = b.x - (spec.recentre?.x ?? 0);
        const z = b.z - (spec.recentre?.z ?? 0);
        return [x, b.y, z, q.x, q.y, q.z, q.w, 1, 1, 1].map(r6);
      }),
    };
  }
  return {
    schema: 'hnc-pose-track/1',
    plate: spec.id,
    builder: spec.builder,
    fps: FPS,
    frames: spec.frames,
    momentTimes: times.map(r6),
    look: spec.look ?? {},
    palette: { ...CURRENT_TUNED, gold: CURRENT_GOLD, white: CURRENT_WHITE },
    pitch: HNC_PITCH,
    props: spec.props ?? [],
    actors,
    ball,
  };
}
