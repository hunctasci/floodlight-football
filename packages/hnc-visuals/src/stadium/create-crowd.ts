import * as THREE from 'three';
import {
  END_STAND_ROWS,
  FAR_STAND_ROWS,
  HNC_CROWD_COLORS,
  endStandFanY,
  farStandFanY,
  farStandFanZ,
  isStandAisle,
} from './constants.ts';

export interface HncCrowdSpot {
  x: number;
  y: number;
  z: number;
  row: number;
  origColor: string;
}

export interface HncCrowdBase extends HncCrowdSpot {
  mesh: THREE.InstancedMesh;
  i: number;
  index: number;
}

export interface HncCrowdResult {
  group: THREE.Group;
  meshes: THREE.InstancedMesh[];
  base: HncCrowdBase[];
}

/**
 * Canonical crowd: seven instanced colour blocks (lively mosaic, no draw-call
 * explosion). Fans stand ON stepped terraces (never inside concrete).
 * Verbatim placement from GameRenderer.buildStands().
 */
export function createHncCrowd(): HncCrowdResult {
  const group = new THREE.Group();
  group.name = 'hnc-crowd';
  const box = new THREE.BoxGeometry(1.05, 0.72, 0.55);
  const fanSpots: { pos: THREE.Vector3; row: number }[][] = HNC_CROWD_COLORS.map(() => []);

  for (let x = -49; x <= 49; x += 1.25) {
    if (isStandAisle(x)) continue;
    for (let r = 0; r < FAR_STAND_ROWS; r++) {
      const color = Math.abs((x * 5 + r * 3) | 0) % HNC_CROWD_COLORS.length;
      fanSpots[color].push({ pos: new THREE.Vector3(x, farStandFanY(r), farStandFanZ(r)), row: r });
    }
  }
  for (const side of [1, -1] as const) {
    for (let z = -28; z <= 28; z += 1.25) {
      if (isStandAisle(z)) continue;
      for (let r = 0; r < END_STAND_ROWS; r++) {
        const color = Math.abs((z * 5 + r * 3 + side * 7) | 0) % HNC_CROWD_COLORS.length;
        fanSpots[color].push({
          pos: new THREE.Vector3(side * (51.1 + r * 1.1), endStandFanY(r), z),
          row: r,
        });
      }
    }
  }

  const matrix = new THREE.Matrix4();
  const meshes: THREE.InstancedMesh[] = [];
  const base: HncCrowdBase[] = [];
  fanSpots.forEach((spots, color) => {
    const crowd = new THREE.InstancedMesh(
      box,
      new THREE.MeshBasicMaterial({ color: HNC_CROWD_COLORS[color] }),
      spots.length,
    );
    spots.forEach((spot, i) => {
      matrix.makeTranslation(spot.pos.x, spot.pos.y, spot.pos.z);
      crowd.setMatrixAt(i, matrix);
      base.push({
        mesh: crowd,
        i,
        index: base.length,
        x: spot.pos.x,
        y: spot.pos.y,
        z: spot.pos.z,
        row: spot.row,
        origColor: HNC_CROWD_COLORS[color],
      });
    });
    crowd.instanceMatrix.needsUpdate = true;
    meshes.push(crowd);
    group.add(crowd);
  });
  return { group, meshes, base };
}

// --- Shared deterministic crowd helpers (re-exported for game + reels) ---

export function hncHash01(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function hncFanSection(x: number): 0 | 1 {
  return x < 0 ? 0 : 1;
}

export type HncCrowdMood = 'idle' | 'anticipation' | 'wave' | 'goal' | 'disbelief';

export interface HncCrowdState {
  mood: HncCrowdMood;
  intensity: number;
  time: number;
  seed: number;
  scoringTeam?: 0 | 1;
  moodTime: number;
}

/**
 * Per-supporter offset — verbatim port of crowdFanOffset() so reels and the
 * game share one implementation (previously duplicated logic lived in two
 * packages; the game owned crowd.ts, reels owned a wave approximation).
 */
export function hncCrowdFanOffset(
  fan: { x: number; row: number; index: number },
  state: HncCrowdState,
): { dy: number; dz: number; sy: number } {
  const intensity = Math.min(1, Math.max(0, state.intensity));
  const phase = hncHash01(fan.index, state.seed) * Math.PI * 2;
  const t = state.time;
  switch (state.mood) {
    case 'idle': {
      const jitter = (hncHash01(fan.index * 7 + 1, state.seed) - 0.5) * 0.03;
      return { dy: Math.sin(t * 1.4 + phase) * 0.035 + jitter, dz: 0, sy: 1 };
    }
    case 'anticipation':
      return {
        dy: 0.38 * intensity + Math.sin(t * 3.1 + phase) * 0.07 * intensity,
        dz: 0.18 * intensity,
        sy: 1 + 0.06 * intensity,
      };
    case 'wave': {
      const span = 98 + 20;
      const p = ((((state.moodTime * 0.45) % 1.2) + 1.2) % 1.2) / 1.2;
      const dir = (state.seed >>> 0) % 2 === 0 ? 1 : -1;
      const from = dir === 1 ? -49 - 10 : 49 + 10;
      const to = dir === 1 ? 49 + 10 : -49 - 10;
      void span;
      const center = from + (to - from) * p - fan.row * 0.02 * (to - from) * 0.0;
      // NOTE: row delay is applied via moodTime offset upstream to keep this
      // a pure function; the wave hump itself is Gaussian sigma=10.
      const d = (fan.x - center) / 10;
      const r = Math.exp(-d * d);
      return {
        dy: r * 1.45 * intensity + Math.sin(t * 1.4 + phase) * 0.03,
        dz: r * 0.1 * intensity,
        sy: 1 + r * 0.32 * intensity,
      };
    }
    case 'goal': {
      const scoring = state.scoringTeam;
      if (scoring !== undefined && hncFanSection(fan.x) !== scoring) {
        return {
          dy: -0.24 * intensity + Math.sin(t * 1.1 + phase) * 0.02,
          dz: -0.12 * intensity,
          sy: 1 - 0.06 * intensity,
        };
      }
      const bounce = Math.abs(Math.sin(state.moodTime * 7 + fan.row * 0.9 + phase * 0.3));
      const amp = scoring === undefined ? 0.6 : 1.0;
      return {
        dy: (0.3 + bounce * 1.0 * amp) * intensity,
        dz: 0.12 * intensity,
        sy: 1 + 0.12 * intensity * bounce,
      };
    }
    case 'disbelief': {
      const stagger = Math.sin(t * 0.9 + phase + fan.x * 0.05) * 0.02;
      return { dy: -0.2 * intensity + stagger, dz: -0.1 * intensity, sy: 1 - 0.05 * intensity };
    }
  }
}

/** Apply section tint (home left / away right) — verbatim game behaviour. */
export function hncApplySectionTint(
  base: HncCrowdBase[],
  meshes: THREE.InstancedMesh[],
  homeColor: string,
  awayColor: string,
): void {
  const c = new THREE.Color();
  for (const b of base) {
    const isFar = Math.abs(b.x) < 50;
    if (!isFar) {
      c.set(b.origColor);
      b.mesh.setColorAt(b.i, c);
      continue;
    }
    const side = hncFanSection(b.x);
    const teamHex = side === 0 ? homeColor : awayColor;
    const h = hncHash01(b.index * 3 + 7, 11);
    if (h < 0.62) {
      c.set(teamHex);
      c.offsetHSL(0, (hncHash01(b.index, 5) - 0.5) * 0.1, (hncHash01(b.index, 9) - 0.5) * 0.12);
    } else if (h < 0.8) {
      c.set(hncHash01(b.index, 13) < 0.5 ? '#f3ede0' : '#1d3346');
    } else {
      c.set(b.origColor);
    }
    b.mesh.setColorAt(b.i, c);
  }
  for (const mesh of meshes) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/** Rewrite crowd matrices from an evaluated crowd state (social choreography). */
export function hncApplyCrowdState(base: HncCrowdBase[], state: HncCrowdState): void {
  const seen = new Set<THREE.InstancedMesh>();
  for (const b of base) {
    const o = hncCrowdFanOffset({ x: b.x, row: b.row, index: b.index }, state);
    const isEnd = Math.abs(b.x) > 50;
    const s = isEnd ? 0.85 : 1;
    _p.set(b.x + (isEnd ? Math.sign(b.x) * 0.6 : 0), b.y + o.dy, b.z + o.dz);
    _q.identity();
    _s.set(s, o.sy * s, s);
    _m.compose(_p, _q, _s);
    b.mesh.setMatrixAt(b.i, _m);
    seen.add(b.mesh);
  }
  for (const mesh of seen) mesh.instanceMatrix.needsUpdate = true;
}
