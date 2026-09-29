/**
 * World registry (pure). Adding a world: a `<id>.world.ts` definition here +
 * its scene component in render/worlds.tsx.
 */
import { BREAKROOM_WORLD } from './breakroom/breakroom.world';
import { FOOTBALL_WORLD } from './football/football.world';
import { OFFICE_WORLD } from './office/office.world';
import { PHONE_WORLD } from './phone/phone.world';
import { STUDIO_WORLD } from './studio/studio.world';
import { TITLE_WORLD } from './title/title.world';
import type { WorldDef } from './types';

export const WORLDS: Record<string, WorldDef> = {
  football: FOOTBALL_WORLD,
  office: OFFICE_WORLD,
  studio: STUDIO_WORLD,
  phone: PHONE_WORLD,
  title: TITLE_WORLD,
  breakroom: BREAKROOM_WORLD,
};

export const WORLD_IDS = Object.keys(WORLDS);

export function getWorld(id: string): WorldDef {
  const w = WORLDS[id];
  if (!w) throw new Error(`Unknown world "${id}" (known: ${WORLD_IDS.join(', ')})`);
  return w;
}
