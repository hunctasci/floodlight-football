/**
 * Looks — what a cast member wears in a scene. Every look is the canonical
 * HNC body with a wardrobe from @floodlight/hnc-visuals; identity (skin from
 * the shirt number, country colours) is untouched, so the office worker and
 * the #9 are visibly the same person.
 */
import type { HncWardrobeId } from '@floodlight/hnc-visuals';

export interface LookDef {
  wardrobe: HncWardrobeId;
  summary: string;
  /** Kit-type looks carry the back number and stripe. */
  kit?: boolean;
  keeper?: boolean;
}

export const LOOKS: Record<string, LookDef> = {
  kit: { wardrobe: 'footballer', kit: true, summary: 'Country football kit with back number' },
  'keeper-kit': { wardrobe: 'goalkeeper', kit: true, keeper: true, summary: 'Goalkeeper kit' },
  office: { wardrobe: 'office-worker', summary: 'Shirt + tie in the character accent colour, ID badge' },
  'office-formal': { wardrobe: 'office-worker-formal', summary: 'Blazer, navy tie' },
  'office-casual': { wardrobe: 'office-worker-casual', summary: 'Teal shirt, no tie' },
  manager: { wardrobe: 'manager', summary: 'Dark blazer, blue tie, gold badge (the boss)' },
  suit: { wardrobe: 'suit', summary: 'News anchor suit, accent tie' },
  commentator: { wardrobe: 'commentator', summary: 'Suit + broadcast headset' },
  fan: { wardrobe: 'fan', summary: 'Replica country shirt + scarf' },
  referee: { wardrobe: 'referee', summary: 'Referee black' },
  hoodie: { wardrobe: 'hoodie', summary: 'Hoodie in the accent colour' },
  tee: { wardrobe: 'tee', summary: 'At home: plain tee in the accent colour, jeans' },
  'kit-trousers': { wardrobe: 'kit-trousers', kit: true, summary: 'Mid-change: country shirt with the back number over office trousers' },
};

export const LOOK_IDS = Object.keys(LOOKS);

export function getLook(id: string): LookDef {
  const l = LOOKS[id];
  if (!l) throw new Error(`Unknown look "${id}"`);
  return l;
}
