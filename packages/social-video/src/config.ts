/**
 * Social export formats. Semantic ids only — agents never pass raw pixels.
 * `reel` is the only format for V1 (TikTok / Reels / Shorts).
 */
export const SOCIAL_FORMATS = {
  reel: { width: 1080, height: 1920, pixelRatio: 1 },
} as const;

export type SocialFormatId = keyof typeof SOCIAL_FORMATS;

export const DEFAULT_FORMAT: SocialFormatId = 'reel';
export const DEFAULT_SCENE = 'faceoff';
export const DEFAULT_SEED = 42;
export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION = 4;

/** Scene-level default clip lengths: each scene paces its own beats. */
export const SCENE_DEFAULT_DURATION = {
  faceoff: 4,
  'attack-goal': 9.5,
  'cross-header-goal': 8,
  'crossbar-chaos': 9.5,
  'keeper-disaster': 10.5,
} as const;

/**
 * Recommended production frame rates. High-action scenes (driven shots,
 * 1:1 ball-follow cameras, keeper dives) strobe at 30fps — the ball covers
 * 1m+ per frame with no motion blur — and read clearly smoother at 60fps.
 * Quiet intros (faceoff) are fine at 30.
 */
export const SCENE_RECOMMENDED_FPS = {
  faceoff: 30,
  'attack-goal': 60,
  'cross-header-goal': 60,
  'crossbar-chaos': 60,
  'keeper-disaster': 60,
} as const;

/** Supported frame rates (integer FPS). */
export const MIN_FPS = 24;
export const MAX_FPS = 60;

/** Supported clip lengths in seconds (upper bound keeps sequences sane). */
export const MIN_DURATION = 0;
export const MAX_DURATION = 30;

export function formatSize(format: SocialFormatId): { width: number; height: number; pixelRatio: number } {
  return SOCIAL_FORMATS[format];
}
