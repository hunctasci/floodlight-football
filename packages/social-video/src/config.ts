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
  'attack-goal': 6,
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
