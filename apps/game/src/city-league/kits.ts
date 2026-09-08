import { getCountry } from './countries';
import type { Team } from '../types';
function team(code: string): Team {
  const c = getCountry(code);
  if (!c) throw new Error('Unknown country');
  return { name: c.name, short: c.code, city: c.name, color: c.colors.primary, secondary: c.colors.secondary };
}
function distance(a: string, b: string): number {
  return Math.hypot(...[1,3,5].map(i => parseInt(a.slice(i,i+2),16)-parseInt(b.slice(i,i+2),16)));
}
/** Country identities are cosmetic. Both peers derive the same kits; away
 * changes to its trim or a light/dark alternate when shirts would clash. */
export function countryTeams(home: string, away: string): [Team, Team] {
  const a = team(home), b = team(away);
  if (distance(a.color, b.color) < 125) {
    const candidates = [b.secondary, '#ffffff', '#151515'];
    b.color = candidates.find(c => distance(a.color,c) >= 180) ?? '#ffffff';
  }
  return [a,b];
}
