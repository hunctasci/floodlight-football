/**
 * In-world screen content ids (monitors, studio walls). Painters live in
 * render/screens.ts (canvas 2D → texture, so screens are lit/occluded like
 * any other surface); this list is pure so worlds and validation can use it.
 */
export const SCREEN_CONTENT_IDS = ['hnc-news', 'breaking', 'world-table', 'hnc-live', 'hnc-logo', 'spreadsheet', 'off'];
