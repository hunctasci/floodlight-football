/**
 * Semantic camera presets. Stories reference `camera: 'close-reaction'`;
 * positions/FOV/pathing live here. All motion derives from absolute frame.
 *
 * Football presets derive from the proven HNC social-camera mathematics
 * (@floodlight/hnc-visuals, ported verbatim from packages/social-video).
 * Office/graphics presets keep the Reel Factory's tuned room composition.
 * Raw coordinates never reach callers — only semantic IDs.
 */
import { hncFaceoffCameraAt, hncReelCameraBase } from '@floodlight/hnc-visuals';

export const CAMERA_PRESET_IDS = [
  'wide-establish',
  'medium-two-shot',
  'close-reaction',
  'low-hero',
  'dramatic-push',
  'over-shoulder',
  'desk-left-close',
  'desk-right-close',
  'football-broadcast',
  'football-goal',
  'football-faceoff',
  'ball-follow',
  'keeper-close',
  'celebration-close',
  'ball-near-lens',
  'reaction-crowd',
  'reaction-keeper',
  'reaction-scorer',
  'graphics-static',
] as const;

export type CameraPresetId = (typeof CAMERA_PRESET_IDS)[number];

export interface CameraPose {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

export interface CameraPresetDef {
  id: CameraPresetId;
  description: string;
  /** Base pose; animated presets interpolate around it by frame progress. */
  pose: CameraPose;
  /** Optional push-in target (dramatic-push etc.). */
  pushTo?: CameraPose;
}

function lensToPose(lens: { pos: { x: number; y: number; z: number }; look: { x: number; y: number; z: number }; fov: number }): CameraPose {
  return {
    pos: [lens.pos.x, lens.pos.y, lens.pos.z],
    look: [lens.look.x, lens.look.y, lens.look.z],
    fov: lens.fov,
  };
}

// Static bases for ball-anchored football presets at the centre anchor.
// Per-frame ball-follow offsets are applied in ReelComposition (same layering
// as before) — the bases below are the proven social coordinates, not
// invented numbers.
function footballBase(id: string): CameraPose {
  return lensToPose(hncReelCameraBase(id));
}

const V: Record<CameraPresetId, CameraPresetDef> = {
  'wide-establish': {
    id: 'wide-establish',
    description: 'Office wide establishing shot',
    pose: { pos: [0, 2.6, 9.5], look: [0, 1.1, -0.5], fov: 55 },
  },
  'medium-two-shot': {
    id: 'medium-two-shot',
    description: 'Two coworkers at opposite desks',
    pose: { pos: [0, 1.9, 7.2], look: [0, 1.1, -0.3], fov: 52 },
  },
  'close-reaction': {
    id: 'close-reaction',
    description: 'Comedic close reaction (side-eye)',
    pose: { pos: [-1.7, 1.6, 2.2], look: [-1.9, 1.25, 0], fov: 38 },
  },
  'low-hero': {
    id: 'low-hero',
    description: 'Low heroic angle',
    pose: { pos: [0, 0.7, 3.4], look: [0, 1.4, 0], fov: 42 },
  },
  'dramatic-push': {
    id: 'dramatic-push',
    description: 'Push-in toward confrontation',
    pose: { pos: [0, 1.8, 4.4], look: [0, 1.2, 0], fov: 44 },
    pushTo: { pos: [0, 1.7, 2.9], look: [0, 1.2, 0], fov: 38 },
  },
  'over-shoulder': {
    id: 'over-shoulder',
    description: 'Over-shoulder at monitor',
    pose: { pos: [1.2, 1.9, 1.6], look: [2.0, 1.1, -0.6], fov: 40 },
  },
  'desk-left-close': {
    id: 'desk-left-close',
    description: 'Close on left desk worker',
    pose: { pos: [-1.9, 1.7, 1.8], look: [-2.0, 1.15, -0.4], fov: 38 },
  },
  'desk-right-close': {
    id: 'desk-right-close',
    description: 'Close on right desk worker',
    pose: { pos: [1.9, 1.7, 1.8], look: [2.0, 1.15, -0.4], fov: 38 },
  },
  // Proven HNC social lenses (broadcast-wide @ centre, behind-goal-net,
  // faceoff-low, ball-follow, keeper-close, celebration-close, ...).
  'football-broadcast': {
    id: 'football-broadcast',
    description: 'Broadcast-wide football view (proven social lens, follows ball)',
    pose: footballBase('football-broadcast'),
  },
  'football-goal': {
    id: 'football-goal',
    description: 'Behind-goal payoff angle (proven social lens)',
    pose: footballBase('football-goal'),
  },
  'football-faceoff': {
    id: 'football-faceoff',
    description: 'Low faceoff dolly (proven Catmull-Rom social lens)',
    pose: lensToPose(hncFaceoffCameraAt(0, 1)),
    pushTo: lensToPose(hncFaceoffCameraAt(1, 1)),
  },
  'ball-follow': {
    id: 'ball-follow',
    description: 'Ball-following action cam (proven social lens)',
    pose: footballBase('ball-follow'),
  },
  'keeper-close': {
    id: 'keeper-close',
    description: 'Keeper reaction close (proven social lens)',
    pose: footballBase('keeper-close'),
  },
  'celebration-close': {
    id: 'celebration-close',
    description: 'Winner celebration close (proven social lens)',
    pose: footballBase('celebration-close'),
  },
  'ball-near-lens': {
    id: 'ball-near-lens',
    description: 'Ball-near-lens insert (proven social lens)',
    pose: footballBase('ball-near-lens'),
  },
  'reaction-crowd': {
    id: 'reaction-crowd',
    description: 'Crowd reaction (proven social lens)',
    pose: footballBase('reaction-crowd'),
  },
  'reaction-keeper': {
    id: 'reaction-keeper',
    description: 'Beaten-keeper despair (proven social lens)',
    pose: footballBase('reaction-keeper'),
  },
  'reaction-scorer': {
    id: 'reaction-scorer',
    description: 'Scorer celebration closeup (proven social lens)',
    pose: footballBase('reaction-scorer'),
  },
  'graphics-static': {
    id: 'graphics-static',
    description: 'Static graphics camera (no 3D motion)',
    pose: { pos: [0, 1.6, 5], look: [0, 1.2, 0], fov: 40 },
  },
};

export function getCameraPreset(id: string): CameraPresetDef {
  const def = (V as Record<string, CameraPresetDef>)[id];
  if (!def) throw new Error(`Unknown camera preset: ${id} (supported: ${CAMERA_PRESET_IDS.join(', ')})`);
  return def;
}

function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    pos: [l(a.pos[0], b.pos[0]), l(a.pos[1], b.pos[1]), l(a.pos[2], b.pos[2])],
    look: [l(a.look[0], b.look[0]), l(a.look[1], b.look[1]), l(a.look[2], b.look[2])],
    fov: l(a.fov, b.fov),
  };
}

/**
 * Evaluate a camera preset at an absolute shot-local frame. Deterministic:
 * same (preset, localFrame, duration) always yields the same pose.
 * football-faceoff uses the proven Catmull-Rom dolly; other push presets
 * ease between pose/pushTo.
 */
export function evaluateCamera(presetId: string, localFrame: number, durationInFrames: number): CameraPose {
  const def = getCameraPreset(presetId);
  if (presetId === 'football-faceoff' && durationInFrames > 1) {
    // Proven Catmull-Rom dolly (seconds = frames @ 30fps, the Reel default).
    const time = Math.max(0, localFrame) / 30;
    const duration = Math.max(1, durationInFrames) / 30;
    return lensToPose(hncFaceoffCameraAt(time, duration));
  }
  if (!def.pushTo || durationInFrames <= 1) return def.pose;
  const t = Math.min(1, Math.max(0, localFrame / Math.max(1, durationInFrames - 1)));
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return lerpPose(def.pose, def.pushTo, eased);
}
