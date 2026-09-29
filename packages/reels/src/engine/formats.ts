/**
 * Output formats. Every lens is authored for 9:16; other aspect ratios keep
 * the same HORIZONTAL field of view (a centred crop of the portrait framing),
 * so subjects keep their on-screen width and nothing is re-staged per format.
 * Safe areas keep text clear of platform chrome.
 */

export type FormatId = 'reel' | 'story' | 'portrait' | 'square';

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FormatDef {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  /** Insets (px) that platform UI may cover. */
  safe: SafeArea;
}

export const FORMATS: Record<FormatId, FormatDef> = {
  reel: { id: 'reel', label: '9:16 Reel / TikTok / Short', width: 1080, height: 1920, safe: { top: 230, bottom: 400, left: 70, right: 130 } },
  story: { id: 'story', label: '9:16 Story', width: 1080, height: 1920, safe: { top: 250, bottom: 290, left: 70, right: 70 } },
  portrait: { id: 'portrait', label: '4:5 feed post', width: 1080, height: 1350, safe: { top: 70, bottom: 90, left: 70, right: 70 } },
  square: { id: 'square', label: '1:1 feed post', width: 1080, height: 1080, safe: { top: 60, bottom: 60, left: 60, right: 60 } },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

export function isFormatId(v: unknown): v is FormatId {
  return typeof v === 'string' && v in FORMATS;
}

const DESIGN_ASPECT = 9 / 16;

/** Vertical FOV that keeps a 9:16 lens's horizontal FOV at `aspect` (w/h). */
export function fitVerticalFov(fov: number, aspect: number): number {
  const half = (fov * Math.PI) / 360;
  return (Math.atan((Math.tan(half) * DESIGN_ASPECT) / aspect) * 360) / Math.PI;
}
