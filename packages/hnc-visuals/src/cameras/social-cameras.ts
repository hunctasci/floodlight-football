/**
 * Canonical HNC social cameras — single source for portrait football lenses.
 *
 * Previously: packages/social-video owned tuned 9:16 lenses (presetLens +
 * faceoffCameraAt) while packages/reels invented its own coordinates in
 * cameras/registry.ts. This module ports/shares the proven mathematics so
 * Reel semantic IDs (football-broadcast, ball-follow, keeper-close, ...)
 * derive from proven HNC camera behaviour instead of raw invented numbers.
 *
 * Reel callers still use semantic IDs only — never raw coordinates.
 */

export interface HncLens {
  pos: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  fov: number;
}

export interface HncCameraAnchor {
  ball: { x: number; y: number; z: number };
  actor?: { x: number; z: number };
  keeper?: { x: number; z: number };
  goalX?: number;
  lateral?: number;
}

export type HncSocialCameraPreset =
  | 'broadcast-high'
  | 'broadcast-wide'
  | 'broadcast-medium'
  | 'high-sideline'
  | 'far-touchline'
  | 'wide-goal'
  | 'cross-follow'
  | 'attack-wide'
  | 'sideline-wide'
  | 'behind-attack'
  | 'striker-low'
  | 'winger-close'
  | 'keeper-close'
  | 'faceoff-low'
  | 'celebration-close'
  | 'touchline-run'
  | 'low-sideline'
  | 'ball-follow'
  | 'behind-runner'
  | 'ball-near-lens'
  | 'header-impact'
  | 'shot-impact'
  | 'keeper-glove'
  | 'crossbar-angle'
  | 'goal-net'
  | 'crowd-low'
  | 'behind-supporters'
  | 'behind-goal-net'
  | 'inside-goal'
  | 'keeper-shoulder'
  | 'striker-shoulder'
  | 'ground-ball'
  | 'corner-flag'
  | 'top-down-box'
  | 'reaction-defender'
  | 'reaction-keeper'
  | 'reaction-crowd'
  | 'goalpost-side'
  | 'crossbar-under'
  | 'duel-chase'
  | 'ball-chase'
  | 'player-portrait'
  | 'boot-ball'
  | 'keeper-eyes'
  | 'reaction-scorer';

const GOAL_X = 46;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Proven portrait lens table — ported verbatim from
 * packages/social-video/src/cameras/presets.ts presetLens().
 */
export function hncPresetLens(preset: HncSocialCameraPreset, a: HncCameraAnchor): HncLens {
  const b = a.ball;
  const gx = a.goalX ?? GOAL_X;
  const L = a.lateral ?? 0;
  switch (preset) {
    case 'broadcast-high': return { pos: { x: b.x - 4 + L, y: 10.5, z: b.z + 12.5 }, look: { x: b.x + 2.5, y: 0.7, z: b.z - 2 }, fov: 52 };
    case 'broadcast-wide': return { pos: { x: b.x - 10 + L, y: 12.5, z: b.z + 16 }, look: { x: b.x + 4, y: 0.5, z: b.z - 3 }, fov: 58 };
    case 'broadcast-medium': return { pos: { x: b.x - 5 + L, y: 8.5, z: b.z + 12 }, look: { x: b.x + 2.5, y: 0.8, z: b.z - 1.5 }, fov: 53 };
    case 'high-sideline': return { pos: { x: b.x - 11 + L, y: 15, z: b.z + 18 }, look: { x: b.x + 3.5, y: 0.4, z: b.z - 2 }, fov: 50 };
    case 'far-touchline': return { pos: { x: b.x - 1 + L, y: 7, z: b.z + 22 }, look: { x: b.x + 1.5, y: 0.8, z: b.z - 1 }, fov: 52 };
    case 'wide-goal': return { pos: { x: b.x - 9 + L, y: 10.5, z: b.z + 12 }, look: { x: b.x + 5, y: 1.4, z: b.z * 0.5 }, fov: 58 };
    case 'cross-follow': return { pos: { x: b.x - 9.5 + L, y: 6.5, z: b.z + 11.5 }, look: { x: b.x + 2.5, y: 1.5, z: b.z - 1 }, fov: 54 };
    case 'attack-wide': return { pos: { x: b.x + L, y: 9, z: b.z + 13 }, look: { x: b.x + 3, y: 0.7, z: b.z - 2 }, fov: 54 };
    case 'sideline-wide': return { pos: { x: b.x + L, y: 8, z: b.z + 16 }, look: { x: b.x, y: 0.8, z: b.z }, fov: 52 };
    case 'behind-attack': return { pos: { x: b.x - 9 + L, y: 5, z: b.z + 4 }, look: { x: b.x + 4, y: 1, z: b.z }, fov: 53 };
    case 'striker-low': return { pos: { x: b.x - 3.4 + L, y: 1.7, z: b.z + 5.4 }, look: { x: b.x + 1, y: 1.5, z: b.z - 0.5 }, fov: 50 };
    case 'winger-close': return { pos: { x: b.x + 3 + L, y: 3.2, z: b.z + 7.5 }, look: { x: b.x, y: 1, z: b.z }, fov: 50 };
    case 'keeper-close': {
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 4.5 + L, y: 2.4, z: k.z + 5.5 }, look: { x: k.x, y: 1, z: k.z }, fov: 50 };
    }
    case 'faceoff-low': return { pos: { x: 0 + L, y: 2.6, z: 8.6 }, look: { x: 0, y: 1.25, z: -2.2 }, fov: 52 };
    case 'celebration-close': return { pos: { x: b.x - 3 + L, y: 3.4, z: b.z + 12 }, look: { x: b.x + 1, y: 1.1, z: b.z }, fov: 52 };
    case 'touchline-run': return { pos: { x: b.x - 2 + L, y: 2.2, z: b.z + 9 }, look: { x: b.x + 3, y: 1, z: b.z - 1 }, fov: 54 };
    case 'low-sideline': return { pos: { x: b.x - 4 + L, y: 1.9, z: b.z + 8 }, look: { x: b.x + 2.5, y: 1, z: b.z - 1 }, fov: 53 };
    case 'ball-follow': return { pos: { x: b.x - 8 + L, y: 4.5, z: b.z + 9.5 }, look: { x: b.x + 2.5, y: 1.1, z: b.z - 1 }, fov: 53 };
    case 'behind-runner': {
      const r = a.actor ?? { x: b.x - 2, z: b.z };
      return { pos: { x: r.x - 3 + L, y: 2.6, z: r.z + 4.5 }, look: { x: r.x + 4, y: 1.1, z: r.z }, fov: 54 };
    }
    case 'ball-near-lens': return { pos: { x: b.x - 2.5 + L, y: b.y + 0.6, z: b.z + 3.2 }, look: { x: b.x + 1, y: b.y, z: b.z - 1 }, fov: 55 };
    case 'header-impact': return { pos: { x: b.x - 4.2 + L, y: 2.4, z: b.z + 6.2 }, look: { x: b.x + 0.6, y: 1.7, z: b.z - 0.4 }, fov: 50 };
    case 'shot-impact': return { pos: { x: b.x - 6 + L, y: 3.4, z: b.z + 7 }, look: { x: b.x + 2, y: 1.1, z: b.z - 1 }, fov: 52 };
    case 'keeper-glove': return { pos: { x: b.x + 3.5 + L * 0.3, y: b.y + 1.2, z: b.z + 2.5 }, look: { x: b.x, y: b.y, z: b.z }, fov: 50 };
    case 'crossbar-angle': return { pos: { x: 38 + L, y: 3.0, z: 8 }, look: { x: gx, y: 2.5, z: 1 }, fov: 50 };
    case 'goal-net': return { pos: { x: gx + 4 + L * 0.3, y: 2.4, z: 6 }, look: { x: gx, y: 1.2, z: 0 }, fov: 50 };
    case 'crowd-low': return { pos: { x: b.x * 0.3 + L, y: 2.0, z: -18 }, look: { x: 0, y: 4.5, z: -34 }, fov: 54 };
    case 'behind-supporters': return { pos: { x: 0 + L, y: 5.2, z: -38 }, look: { x: b.x * 0.4, y: 1, z: 10 }, fov: 52 };
    case 'behind-goal-net': return { pos: { x: gx + 5 + L * 0.3, y: 2.6, z: 3 }, look: { x: gx - 8, y: 1.2, z: 0 }, fov: 50 };
    case 'inside-goal': return { pos: { x: gx + 1.6, y: 1.6, z: 0 }, look: { x: gx - 14, y: 1.2, z: 0 }, fov: 58 };
    case 'keeper-shoulder': {
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 1.6 + L, y: 2.3, z: k.z + 2.6 }, look: { x: k.x + 8, y: 0.9, z: k.z - 1 }, fov: 50 };
    }
    case 'striker-shoulder': {
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      return { pos: { x: s.x - 2 + L, y: 2.4, z: s.z + 3 }, look: { x: gx, y: 1.4, z: 0 }, fov: 50 };
    }
    case 'ground-ball': return { pos: { x: b.x - 3 + L, y: 1.1, z: b.z + 4.2 }, look: { x: b.x + 2, y: 0.5, z: b.z }, fov: 52 };
    case 'corner-flag': return { pos: { x: b.x - 5 + L, y: 2.2, z: b.z + 6 }, look: { x: gx, y: 1.6, z: 0 }, fov: 52 };
    case 'top-down-box': return { pos: { x: 34 + L, y: 26, z: 2 }, look: { x: 40, y: 0, z: 0 }, fov: 46 };
    case 'reaction-defender': {
      const d = a.actor ?? { x: b.x - 4, z: b.z + 2 };
      return { pos: { x: d.x - 1.5 + L, y: 2.2, z: d.z + 4.2 }, look: { x: d.x, y: 1.3, z: d.z }, fov: 48 };
    }
    case 'reaction-keeper': {
      const k = a.keeper ?? { x: gx - 2.4, z: 0 };
      return { pos: { x: k.x + 4.2 + L, y: 2.2, z: k.z + 1.8 }, look: { x: k.x, y: 1.0, z: k.z }, fov: 48 };
    }
    case 'reaction-crowd': return { pos: { x: 6 + L, y: 3.4, z: -24 }, look: { x: -6, y: 3.6, z: -34 }, fov: 50 };
    case 'goalpost-side': return { pos: { x: gx - 1 + L, y: 2.2, z: 7.5 }, look: { x: gx, y: 2.2, z: 0 }, fov: 48 };
    case 'crossbar-under': return { pos: { x: gx - 3 + L, y: 1.2, z: 2 }, look: { x: gx, y: 3.4, z: 0.5 }, fov: 52 };
    case 'duel-chase': return { pos: { x: b.x - 3.6 + L, y: 1.7, z: b.z + 4.4 }, look: { x: b.x + 2.2, y: 1.3, z: b.z - 0.5 }, fov: 57 };
    case 'ball-chase': return { pos: { x: b.x - 3.4 + L, y: b.y + 1.5, z: b.z + 2.8 }, look: { x: b.x + 2.5, y: 1.0, z: b.z - 0.6 }, fov: 56 };
    case 'player-portrait': {
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      const dx = b.x - s.x, dz = b.z - s.z;
      const dl = Math.hypot(dx, dz) || 1;
      const fx = dx / dl, fz = dz / dl;
      const px = -fz, pz = fx;
      return {
        pos: { x: s.x + fx * 3.4 + px * 2.3 + L, y: 2.4, z: s.z + fz * 3.4 + pz * 2.3 },
        look: { x: s.x, y: 1.3, z: s.z },
        fov: 52,
      };
    }
    case 'boot-ball': return { pos: { x: b.x - 1.8 + L, y: 0.7, z: b.z + 2.6 }, look: { x: b.x + 0.4, y: 0.35, z: b.z - 0.4 }, fov: 52 };
    case 'keeper-eyes': {
      const k = a.keeper ?? { x: gx - 2.7, z: 0 };
      return { pos: { x: k.x - 2.6 + L, y: 2.0, z: k.z + 3.4 }, look: { x: k.x, y: 1.5, z: k.z - 0.4 }, fov: 47 };
    }
    case 'reaction-scorer': {
      const s = a.actor ?? { x: b.x - 1, z: b.z };
      return { pos: { x: s.x - 2.0 + L, y: 2.2, z: s.z + 4.0 }, look: { x: s.x + 0.4, y: 1.3, z: s.z - 0.3 }, fov: 50 };
    }
  }
}

/** Reel semantic ID → proven social preset (single mapping table). */
export const HNC_REEL_TO_SOCIAL: Record<string, HncSocialCameraPreset> = {
  'football-broadcast': 'broadcast-wide',
  'football-faceoff': 'faceoff-low',
  'football-goal': 'behind-goal-net',
  'ball-follow': 'ball-follow',
  'keeper-close': 'keeper-close',
  'celebration-close': 'celebration-close',
  'ball-near-lens': 'ball-near-lens',
  'reaction-crowd': 'reaction-crowd',
  'reaction-keeper': 'reaction-keeper',
  'reaction-scorer': 'reaction-scorer',
};

/**
 * Evaluate a Reel football camera ID at a default anchor (ball at centre).
 * Deterministic static base; the Reel rig adds ball-follow + push motion on
 * top (same layering as before, but from proven coordinates).
 */
export function hncReelCameraBase(
  reelId: string,
  anchor?: HncCameraAnchor,
): HncLens {
  const preset = HNC_REEL_TO_SOCIAL[reelId];
  const a: HncCameraAnchor = anchor ?? { ball: { x: 0, y: 0.25, z: 0 } };
  if (!preset) throw new Error(`Unknown canonical reel camera: ${reelId}`);
  return hncPresetLens(preset, a);
}

/**
 * Faceoff dolly as a pure function of time — ported verbatim from
 * faceoffCameraAt() (Catmull-Rom through wide → medium → tight).
 */
export function hncFaceoffCameraAt(time: number, duration: number, lateral = 0): HncLens {
  interface Key { at: number; pos: { x: number; y: number; z: number }; look: { x: number; y: number; z: number }; fov: number }
  const keys: [Key, Key, Key] = [
    { at: 0, pos: { x: 0, y: 3.9, z: 11.6 }, look: { x: 0, y: 0.9, z: -3.0 }, fov: 56 },
    { at: 0.5, pos: { x: 0, y: 3.4, z: 10.5 }, look: { x: 0, y: 1.0, z: -3.0 }, fov: 55 },
    { at: 1, pos: { x: 0, y: 2.6, z: 8.6 }, look: { x: 0, y: 1.25, z: -2.2 }, fov: 52 },
  ];
  const d = duration > 0 ? duration : 1;
  const k = Math.min(Math.max(time / d, 0), 1);
  const [aK, bK, cK] = keys;
  const cr = (v0: number, v1: number, v2: number, v3: number, u: number): number => {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * v1 + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 + (-v0 + 3 * v1 - 3 * v2 + v3) * u3);
  };
  const seg = k < bK.at
    ? { p0: aK, p1: aK, p2: bK, p3: cK, u: k / bK.at }
    : { p0: aK, p1: bK, p2: cK, p3: cK, u: (k - bK.at) / (cK.at - bK.at) };
  const { p0, p1, p2, p3, u } = seg;
  const fov = k < bK.at
    ? lerp(aK.fov, bK.fov, smoothstep(k / bK.at))
    : lerp(bK.fov, cK.fov, smoothstep((k - bK.at) / (cK.at - bK.at)));
  return {
    pos: {
      x: cr(p0.pos.x, p1.pos.x, p2.pos.x, p3.pos.x, u) + lateral,
      y: cr(p0.pos.y, p1.pos.y, p2.pos.y, p3.pos.y, u),
      z: cr(p0.pos.z, p1.pos.z, p2.pos.z, p3.pos.z, u),
    },
    look: {
      x: cr(p0.look.x, p1.look.x, p2.look.x, p3.look.x, u) + lateral * 0.3,
      y: cr(p0.look.y, p1.look.y, p2.look.y, p3.look.y, u),
      z: cr(p0.look.z, p1.look.z, p2.look.z, p3.look.z, u),
    },
    fov,
  };
}

export function hncIsFiniteLens(lens: HncLens): boolean {
  return [lens.pos.x, lens.pos.y, lens.pos.z, lens.look.x, lens.look.y, lens.look.z, lens.fov]
    .every((v) => Number.isFinite(v));
}
