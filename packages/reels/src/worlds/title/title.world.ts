import type { WorldDef } from '../types';

/**
 * title — HNC-branded 2D plate for end cards, typography pieces and graphic
 * beats (World Table, brand reveal). Themes reuse the game's menu backdrop.
 */
export const TITLE_WORLD: WorldDef = {
  id: 'title',
  kind: '2d',
  summary: 'HNC-branded plate (menu backdrop, pitch-line motif) for typography and end cards.',
  params: { theme: 'night | pitch | gold (default night)' },
  marks: {},
  props: {},
  lights: {},
  surfaces: {},
  lensIds: [],
  validateSet(set) {
    return set.theme !== undefined && !['night', 'pitch', 'gold'].includes(String(set.theme)) ? [`unknown theme "${String(set.theme)}"`] : [];
  },
  surfaceRect(id, _shot, _frame, height) {
    return id === 'screen' ? { x: 0, y: 0, w: 1080, h: height } : undefined;
  },
};
