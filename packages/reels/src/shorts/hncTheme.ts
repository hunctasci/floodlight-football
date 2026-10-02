import { HNC_BRAND } from '../graphics/branding';

/**
 * HNC short-form editorial theme — extends HNC_BRAND, never a second system.
 *
 * Retro soul (match programme / scoreboard / ticket), modern motion
 * discipline: Barlow Condensed display + Inter support (both OFL, vendored),
 * hard decisive moves (snaps, wipes, flips — no SaaS bounce, no VHS filter).
 * Football-comedy episodes (THE GROUP CHAT) use this for entry/outro; the
 * chat UI itself stays contemporary/mobile-native for contrast.
 */
export const HNC = {
  ...HNC_BRAND.colors,
  paper: '#fbfaf6',
  ink: '#101b31',
  muted: '#6b6a66',
  board: '#0b1d33',
  /** Display face (OFL). */
  display: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  /** Supporting sans (OFL). */
  text: "'Inter', system-ui, sans-serif",
  /** 1080x1920 safe margins: top platform chrome, right TikTok rail, captions. */
  margin: { top: 170, side: 72, bottom: 620 },
  /** Editorial type scale (px @1080x1920). */
  type: { hero: 208, connector: 64, prompt: 56, micro: 30, kicker: 34 },
  /** Thin score-line rules. */
  rule: 4,
  /** Heavy decisive spring (card slam / ticket punch). */
  slam: { damping: 24, stiffness: 420, mass: 0.8 },
} as const;

export type HncVariant = 'programme' | 'scoreboard' | 'ticket';
