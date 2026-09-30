/**
 * World registry (pure). Adding a world: a `<id>.world.ts` definition here +
 * its scene component in render/worlds.tsx.
 */
import { APARTMENT_WORLD } from './apartment/apartment.world';
import { BREAKROOM_WORLD } from './breakroom/breakroom.world';
import { CAFE_WORLD } from './cafe/cafe.world';
import { ROOFTOP_WORLD } from './rooftop/rooftop.world';
import { STAGE_WORLD } from './stage/stage.world';
import { CORRIDOR_WORLD } from './corridor/corridor.world';
import { FOOTBALL_WORLD } from './football/football.world';
import { OFFICE_WORLD } from './office/office.world';
import { PHONE_WORLD } from './phone/phone.world';
import { STUDIO_WORLD } from './studio/studio.world';
import { TITLE_WORLD } from './title/title.world';
import { PLATE_WORLD } from './plate/plate.world';
import type { WorldDef } from './types';

export const WORLDS: Record<string, WorldDef> = {
  football: FOOTBALL_WORLD,
  office: OFFICE_WORLD,
  studio: STUDIO_WORLD,
  phone: PHONE_WORLD,
  title: TITLE_WORLD,
  breakroom: BREAKROOM_WORLD,
  corridor: CORRIDOR_WORLD,
  apartment: APARTMENT_WORLD,
  cafe: CAFE_WORLD,
  rooftop: ROOFTOP_WORLD,
  stage: STAGE_WORLD,
  plate: PLATE_WORLD,
};

export const WORLD_IDS = Object.keys(WORLDS);

export function getWorld(id: string): WorldDef {
  const w = WORLDS[id];
  if (!w) throw new Error(`Unknown world "${id}" (known: ${WORLD_IDS.join(', ')})`);
  return w;
}
