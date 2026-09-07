import * as THREE from 'three';
import { FIELD, type TeamId } from '../types';

export type CameraMode = 'broadcast' | 'tactic' | 'close';
export const CAMERA_MODES: CameraMode[] = ['broadcast', 'tactic', 'close'];
export const CAMERA_LABELS: Record<CameraMode, string> = {
  broadcast: 'BROADCAST',
  tactic: 'TACTICAL',
  close: 'CLOSE-UP',
};
export interface CameraFrame {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

/**
 * Pure framing math (unit-testable): where the lens should sit for a mode,
 * aspect ratio and pitch focus. The look target is biased a few metres toward
 * the camera side (+z) so play renders above the bottom HUD strip instead of
 * sliding underneath it on short or high-DPI windows.
 */
export function computeCamera(mode: CameraMode, aspect: number, focusX: number, focusZ: number): CameraFrame {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const preset = {
    broadcast: { dx: -6, dy: 30, dz: 36, fov: 40 },
    tactic: { dx: 0, dy: 56, dz: 34, fov: 46 },
    close: { dx: -4, dy: 19, dz: 23, fov: 42 },
  }[mode];
  // Portrait windows need the lens farther back to keep a useful horizontal
  // slice; very wide-but-short windows need a touch more height for the near
  // touchline to clear the bottom UI.
  let fit = Math.max(1, 1.32 / safeAspect);
  if (safeAspect > 2.2) fit *= 1 + (safeAspect - 2.2) * 0.3;
  return {
    pos: new THREE.Vector3(focusX + preset.dx * fit, preset.dy * fit, focusZ + preset.dz * fit),
    look: new THREE.Vector3(focusX, 0, focusZ + 2.5),
    fov: preset.fov,
  };
}

/** Smoothstep easing shared by all cinematics (0→0, 1→1, monotonic). */
export function easeInOut(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** Follow focus from ball + controlled player, clamped so the lens never leaves the stadium. */
export function followFocus(ballX: number, ballZ: number, cpX: number, cpZ: number): { x: number; z: number } {
  return {
    x: THREE.MathUtils.clamp(ballX * 0.8 + cpX * 0.2, -36, 36),
    z: THREE.MathUtils.clamp(ballZ * 0.85 + cpZ * 0.15, -22, 22),
  };
}

export type GoalCineVariant = 0 | 1 | 2;

/**
 * Goal-cinematic variety picker: pure function of where the goal went in,
 * so the same goal frames identically on both lockstep peers and in tests.
 */
export function goalCineVariant(side: number, ballX: number, ballZ: number): GoalCineVariant {
  const k = Math.abs(Math.floor(ballX) + Math.floor(ballZ) * 3 + (side >= 0 ? 1 : 0));
  return (k % 3) as GoalCineVariant;
}

/**
 * Goal-cinematic end poses. All three park INSIDE the stadium bowl — behind
 * the net but short of the end stands, low at the corner, or low on the
 * (stand-free) near touchline — so the lens never travels through concrete.
 */
export function goalCineShot(
  variant: GoalCineVariant,
  side: number,
  ballX: number,
  ballZ: number,
): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const s = side >= 0 ? 1 : -1;
  const bz = THREE.MathUtils.clamp(ballZ * 0.4, -8, 8);
  const cz = ballZ >= 0 ? 1 : -1;
  if (variant === 1) {
    return {
      pos: new THREE.Vector3(s * 38, 3.4, cz * 26),
      look: new THREE.Vector3(s * (FIELD.halfLength - 2), 1.5, 0),
    };
  }
  if (variant === 2) {
    return {
      pos: new THREE.Vector3(THREE.MathUtils.clamp(ballX * 0.4, -20, 20), 4.2, 24),
      look: new THREE.Vector3(s * (FIELD.halfLength - 2), 1.2, 0),
    };
  }
  return {
    pos: new THREE.Vector3(s * (FIELD.halfLength + 3), 5.5, bz + cz * 7),
    look: new THREE.Vector3(s * (FIELD.halfLength - 2), 1.2, 0),
  };
}

/**
 * Which team just scored, read from the scoreboard delta (null = no goal).
 * The renderer tracks this itself so celebrations need no engine changes.
 */
export function scorerTeam(prev: readonly number[], score: readonly number[]): TeamId | null {
  if (score[0] > prev[0]) return 0;
  if (score[1] > prev[1]) return 1;
  return null;
}

/** Celebration move per player: 0 jump with arms up, 1 spin, 2 lean-back. Keepers always jump. */
export function celebrationMove(playerIndex: number, keeper: boolean): 0 | 1 | 2 {
  return keeper ? 0 : ((playerIndex % 3) as 0 | 1 | 2);
}

/** Menu showcase orbit position for an angle (constant radius/height). */
export function menuOrbitPos(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * 58, 26, Math.cos(angle) * 58);
}
