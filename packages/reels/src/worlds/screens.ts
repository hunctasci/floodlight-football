/**
 * In-world screen content ids (monitors, studio walls). Painters live in
 * render/screens.ts (canvas 2D → texture, so screens are lit/occluded like
 * any other surface); this list is pure so worlds and validation can use it.
 */
export const SCREEN_CONTENT_IDS = [
  'hnc-news', 'breaking', 'world-table', 'hnc-live', 'hnc-logo', 'spreadsheet', 'off',
  'machine-ready', 'machine-rematch', 'machine-round-2', 'machine-out', 'machine-broken',
  'stream-hidden', 'score-refresh', 'stream-full', 'black', 'your-match', 'phone-lock', 'tv-slate',
];
