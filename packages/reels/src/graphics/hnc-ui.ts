/**
 * HNC game UI tokens, mirrored from the game's own CSS so trailer graphics
 * speak the in-game HUD / menu language (not a generic motion template).
 *
 * Sources: apps/game/src/style.css (.scoreboard, .message, .cinebar,
 * .eyebrow, .panel) and apps/game/src/ui/menu.css (.stadium-screen tokens).
 * Sizes here are scaled for a 1080px-wide portrait frame.
 */
export const HNC_UI = {
  navy: '#101b31',
  cream: '#f8efdb',
  gold: '#f7bf30',
  orange: '#e96137',
  ink: '#0c1824',
  surface: '#122636',
  line: '#354b58',
  muted: '#b1c0c7',
  display: "Impact, 'Arial Black', sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  body: 'system-ui, sans-serif',
  /** Campaign type system (autumn 2026) — system faces rendered by the Mac renderer. */
  headline: "'Futura', 'Avenir Next Condensed', Impact, sans-serif",
  cinema: "'Didot', 'Bodoni 72', Georgia, serif",
  broadcast: "'DIN Condensed', 'Avenir Next Condensed', Impact, sans-serif",
  horror: "'Bodoni 72', Didot, Georgia, serif",
  typewriter: "'American Typewriter', 'Courier New', monospace",
  red: '#e30a17',
  /** .ui text-shadow (2px 2px 0 navy) at portrait scale. */
  hardShadow: '5px 5px 0 #101b31',
  /** .stadium-screen backdrop over the live stadium. */
  menuBackdrop: 'linear-gradient(110deg, #08141bea, #0b1d27c9 65%, #0b1d2799)',
} as const;

/** 1080x1920 platform-safe area (clear of Reels/TikTok chrome). */
export const SAFE = {
  top: 230,
  bottom: 1920 - 400,
  left: 70,
  right: 1080 - 130,
} as const;

