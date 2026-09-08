/**
 * City League weekly seasons — single source of truth.
 *
 * - Week: Monday 00:00 Europe/Istanbul → next Monday 00:00 (7 days).
 * - Europe/Istanbul is a fixed UTC+3 (Turkey abolished DST in 2016), so the
 *   boundary is computed with a constant offset — no Intl/tz database needed
 *   in Workers or headless tests.
 * - seasonKey format: `YYYY-Www` (ISO week of the Istanbul Monday).
 * - The Worker's season value is authoritative; the client uses the same
 *   pure helpers only for display/countdown. Leaderboard queries always use
 *   the server-computed key.
 *
 * Pure module: no DOM, no imports, safe for Worker + browser + Node tests.
 */

/** Fixed Europe/Istanbul offset (UTC+3, no DST). */
export const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;
export const SEASON_MS = 7 * 24 * 3600 * 1000;

export interface SeasonInfo {
  key: string;
  startsAt: number;
  endsAt: number;
}

function istanbulWall(nowMs: number): { y: number; m: number; d: number; weekday: number } {
  const d = new Date(nowMs + ISTANBUL_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** UTC instant of the Monday 00:00 Istanbul that starts the season containing nowMs. */
export function getCurrentSeasonStart(nowMs: number = Date.now()): number {
  const wall = istanbulWall(nowMs);
  const daysSinceMonday = (wall.weekday + 6) % 7;
  const mondayMidnightIstAsUtc = Date.UTC(wall.y, wall.m, wall.d) - daysSinceMonday * 86400_000;
  return mondayMidnightIstAsUtc - ISTANBUL_OFFSET_MS;
}

export function getCurrentSeasonEnd(nowMs: number = Date.now()): number {
  return getCurrentSeasonStart(nowMs) + SEASON_MS;
}

/** ISO week-year for a UTC date that already represents an Istanbul wall date. */
function isoWeekOfIstanbulDate(y: number, m: number, day: number): { year: number; week: number } {
  // Work purely in UTC: treat the Istanbul wall date as a UTC calendar date.
  const date = new Date(Date.UTC(y, m, day));
  // Monday=0 … Sunday=6
  const dayNum = (date.getUTCDay() + 6) % 7;
  // Thursday of this week decides the ISO year.
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() - dayNum + 3);
  const isoYear = thursday.getUTCFullYear();
  // Week 1 contains Jan 4th.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(week1Monday.getUTCDate() - jan4DayNum);
  const diffDays = Math.floor((thursday.getTime() - week1Monday.getTime()) / 86400_000);
  return { year: isoYear, week: 1 + Math.floor(diffDays / 7) };
}

/** `2026-W38` style key for the season containing nowMs. */
export function getCurrentSeasonKey(nowMs: number = Date.now()): string {
  const start = getCurrentSeasonStart(nowMs);
  // Istanbul wall date of the Monday start.
  const wall = new Date(start + ISTANBUL_OFFSET_MS);
  return seasonKeyForDate(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
}

/** Key for an explicit Istanbul wall date (used by getCurrentSeasonKey + tests). */
export function seasonKeyForDate(y: number, m: number, day: number): string {
  const { year, week } = isoWeekOfIstanbulDate(y, m, day);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getSeasonInfo(nowMs: number = Date.now()): SeasonInfo {
  const startsAt = getCurrentSeasonStart(nowMs);
  return { key: getCurrentSeasonKey(nowMs), startsAt, endsAt: startsAt + SEASON_MS };
}

/** True when nowMs is inside [startsAt, endsAt). */
export function isInSeason(nowMs: number, startsAt: number, endsAt: number): boolean {
  return nowMs >= startsAt && nowMs < endsAt;
}

/** Short display label: `SEASON 2026-W38 · SEP 14–20`. */
export function seasonDisplayLabel(info: SeasonInfo): string {
  const fmt = (ms: number): string => {
    const d = new Date(ms + ISTANBUL_OFFSET_MS);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  return `SEASON ${info.key} · ${fmt(info.startsAt)}–${fmt(info.endsAt - 1)}`;
}
