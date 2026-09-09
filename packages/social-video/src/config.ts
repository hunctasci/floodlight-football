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

export function formatSize(format: SocialFormatId): { width: number; height: number; pixelRatio: number } {
  return SOCIAL_FORMATS[format];
}
