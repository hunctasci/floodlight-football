/**
 * City League standings — pure calculation (single source of truth).
 *
 * Only these count:
 *   status = confirmed
 *   home_city_code != away_city_code
 *   season_key = active season
 *
 * Excluded: pending/disputed/abandoned, same-city friendlies, other seasons.
 * Practice never produces match rows. Verified country bot matches count.
 *
 * Ranking: points → goal difference → goals scored → wins → city code
 * (deterministic final tie-break).
 */

import { CITIES, type CityCode } from './cities';

export type CityMatchStatus = 'pending' | 'confirmed' | 'disputed' | 'abandoned';

export interface CityMatchInput {
  seasonKey: string;
  status: CityMatchStatus;
  homeCityCode: string;
  awayCityCode: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface CityStanding {
  rank: number;
  cityCode: CityCode;
  cityName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  winRate: number;
}

export function computeCityStandings(matches: CityMatchInput[], seasonKey: string): CityStanding[] {
  const rows = new Map<CityCode, Omit<CityStanding, 'rank' | 'goalDifference' | 'winRate'>>();
  for (const c of CITIES) {
    rows.set(c.code, {
      cityCode: c.code,
      cityName: c.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'confirmed') continue;
    if (m.seasonKey !== seasonKey) continue;
    if (m.homeCityCode === m.awayCityCode) continue;
    const h = rows.get(m.homeCityCode as CityCode);
    const a = rows.get(m.awayCityCode as CityCode);
    if (!h || !a) continue;
    if (m.homeScore === null || m.awayScore === null) continue;
    if (!Number.isInteger(m.homeScore) || !Number.isInteger(m.awayScore)) continue;
    if (m.homeScore < 0 || m.homeScore > 99 || m.awayScore < 0 || m.awayScore > 99) continue;

    h.played++;
    a.played++;
    h.goalsFor += m.homeScore;
    h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore;
    a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.wins++;
      h.points += 3;
      a.losses++;
    } else if (m.homeScore < m.awayScore) {
      a.wins++;
      a.points += 3;
      h.losses++;
    } else {
      h.draws++;
      a.draws++;
      h.points++;
      a.points++;
    }
  }

  const sorted = [...rows.values()]
    .map((r) => ({
      ...r,
      goalDifference: r.goalsFor - r.goalsAgainst,
      winRate: r.played === 0 ? 0 : r.wins / r.played,
      rank: 0,
    }))
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.goalDifference - x.goalDifference ||
        y.goalsFor - x.goalsFor ||
        y.wins - x.wins ||
        x.cityCode.localeCompare(y.cityCode),
    );
  sorted.forEach((r, i) => {
    r.rank = i + 1;
  });
  return sorted;
}

/** Rank (1-based) of one city inside an already computed table, or null. */
export function rankOf(standings: CityStanding[], cityCode: string): number | null {
  const row = standings.find((r) => r.cityCode === cityCode);
  return row ? row.rank : null;
}
