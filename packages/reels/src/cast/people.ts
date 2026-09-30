/**
 * The recurring HNC universe — persistent people.
 *
 * A person is a fixed identity (country + shirt number → skin, kit, back
 * number, flag) plus a name and a home wardrobe. Specs cast them by id
 * (`cast: { hero: { person: 'emre' } }`), so Emre is the same face in the
 * apartment, the office, the café and the tunnel, and a future campaign can
 * bring anyone back without re-deriving their look. Per-spec fields still
 * override (a scene look, an accent), identity fields never drift.
 */
import type { CastSpec } from '../engine/spec/types';

export interface PersonDef {
  name: string;
  country: string;
  number: number;
  /** Everyday look outside football. */
  look?: string;
  accent?: string;
  /** Who they are in the universe (docs only). */
  bio: string;
}

export const PEOPLE: Record<string, PersonDef> = {
  emre: { name: 'Emre', country: 'TR', number: 9, look: 'office', bio: 'Türkiye #9. The campaign protagonist: office worker, café regular, striker when it matters.' },
  lucas: { name: 'Lucas', country: 'BE', number: 4, look: 'office', accent: '#f4c20d', bio: 'Belgium #4. Emre’s desk-neighbour and coffee-machine nemesis (Coffee Machine Incident, Rematch).' },
  nikos: { name: 'Nikos', country: 'GR', number: 4, look: 'office', bio: 'Greece #4. Emre’s original rival (first-generation demos, the group chat).' },
  kaan: { name: 'Kaan', country: 'TR', number: 8, look: 'suit', accent: '#c8102e', bio: 'HNC Sports Desk anchor. Treats the World Table as the biggest story on Earth.' },
  giulia: { name: 'Giulia', country: 'IT', number: 6, look: 'office-casual', bio: 'Italy #6. Late-shift coworker with a stream behind her spreadsheet.' },
  yuki: { name: 'Yuki', country: 'JP', number: 11, look: 'office-formal', bio: 'Japan #11. One earbud in, always.' },
  mateo: { name: 'Mateo', country: 'AR', number: 10, look: 'office', bio: 'Argentina #10. Refreshes the score faster than he types.' },
  boss: { name: 'The Boss', country: 'GB', number: 3, look: 'manager', bio: 'Walks through the office at exactly the wrong moment.' },
  keeper: { name: 'The Keeper', country: 'XX', number: 1, look: 'keeper-kit', bio: 'Stands on the line of the empty stadium at midnight. Does not blink.' },
  petros: { name: 'Petros', country: 'GR', number: 1, look: 'keeper-kit', bio: 'Greece #1, Nikos’s keeper. Owns BLACKOUT: he grounds a shot’s Current and the stadium lights die with it (HNC: The Current).' },
};

export const PERSON_IDS = Object.keys(PEOPLE);

/** Merge a cast entry with its person (spec fields win, except identity). */
export function resolveCastSpec(c: CastSpec): CastSpec & { country: string; number: number } {
  if (!c.person) return c as CastSpec & { country: string; number: number };
  const p = PEOPLE[c.person];
  if (!p) throw new Error(`Unknown person "${c.person}" (known: ${PERSON_IDS.join(', ')})`);
  return { name: p.name, look: p.look, accent: p.accent, ...c, country: p.country, number: p.number };
}
