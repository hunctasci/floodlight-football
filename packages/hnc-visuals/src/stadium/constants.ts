/**
 * Canonical stadium dimensions — verbatim from apps/game/src/renderer.ts.
 *
 * Visible far-stand terrace geometry (social + game share one stadium).
 * The old stand was a single 9m concrete box with fans embedded inside it,
 * so low social cameras saw a giant blue wall with one strip of heads.
 * The new stand is a stepped terrace: a low fascia (~1.1m) plus 8 risers.
 * Fans stand ON the steps (base = terrace top + half fan height).
 */

export const FAR_STAND_ROWS = 8;
export const FAR_STAND_BASE_TOP = 1.3;
export const FAR_STAND_RISE = 0.55;
/** Fan z of row 0 (front row), each row 1.1m deeper. */
export const FAR_STAND_BASE_Z = -31.9;
export const FAR_STAND_ROW_DEPTH = 1.1;
export const END_STAND_ROWS = 5;
/** Half height of the crowd box (1.05 x 0.72 x 0.55): base sits 0.36 above the step. */
export const CROWD_HALF_HEIGHT = 0.36;

/** Canonical pitch constants (mirror FIELD where relevant). */
export const HNC_PITCH = {
  apronW: 120,
  apronH: 84,
  pitchW: 94,
  pitchH: 60,
  halfLength: 46,
  halfWidth: 29,
  goalHalfWidth: 4.4,
  goalHeight: 2.8,
  penaltyLength: 14,
  penaltyHalfWidth: 15,
  goalAreaLength: 5,
  goalAreaHalfWidth: 7,
  penaltySpotDist: 11,
  arcRadius: 5.5,
} as const;

/** Canonical crowd palette (7 instanced colour blocks). */
export const HNC_CROWD_COLORS = [
  '#f8cc54',
  '#ec5a61',
  '#5fcddd',
  '#f3ede0',
  '#514b91',
  '#ff9a3d',
  '#7ee08a',
] as const;

export function farStandTerraceTop(row: number): number {
  return FAR_STAND_BASE_TOP + row * FAR_STAND_RISE;
}
export function farStandFanY(row: number): number {
  return farStandTerraceTop(row) + CROWD_HALF_HEIGHT;
}
export function farStandFanZ(row: number): number {
  return FAR_STAND_BASE_Z - row * FAR_STAND_ROW_DEPTH;
}
export function endStandTerraceTop(row: number): number {
  return FAR_STAND_BASE_TOP + row * FAR_STAND_RISE;
}
export function endStandFanY(row: number): number {
  return endStandTerraceTop(row) + CROWD_HALF_HEIGHT;
}
/** Centre aisle (section split home/away) + two side aisles. */
export function isStandAisle(x: number): boolean {
  return Math.abs(x) < 0.9 || Math.abs(Math.abs(x) - 26) < 0.7;
}
