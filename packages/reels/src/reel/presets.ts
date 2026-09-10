import type { ReelFormat } from './types';

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const SUPPORTED_FPS = [30, 60] as const;
export const MIN_DURATION = 1;
export const MAX_DURATION = 60;
export const DEFAULT_FPS = 30;
export const DEFAULT_FORMAT: ReelFormat = 'instagram-reel';

export function formatSize(format: ReelFormat): { width: number; height: number } {
  void format;
  return { width: REEL_WIDTH, height: REEL_HEIGHT };
}
