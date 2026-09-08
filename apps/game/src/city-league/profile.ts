/**
 * City League guest profile — local persistence (ADR-004, no signup).
 *
 * Profile: { clientId, displayName, cityCode, citySeasonKey }
 * - clientId: opaque guest UUID, minted once, kept on this device.
 * - displayName: 3–16 chars, trimmed + sanitized, not globally unique.
 * - cityCode: one of CITIES; locked to citySeasonKey for the weekly season.
 * - citySeasonKey: season the city was chosen in (lock scope).
 *
 * Storage: localStorage JSON (`floodlight.city-profile`) + legacy sync
 * (`floodlight-client-id`, `floodlight-name`) so existing code keeps working.
 * Pure validators are DOM-free and unit-tested; only get/save touch storage.
 */

import { migrateCityCode } from './countries';
import { isValidCityCode, type CityCode } from './cities';

export interface CityProfile {
  clientId: string;
  displayName: string;
  cityCode: CityCode;
  /** Season the city was locked in (getCurrentSeasonKey at choice time). */
  citySeasonKey: string;
}

export const PROFILE_KEY = 'floodlight.city-profile';
const LEGACY_ID_KEY = 'floodlight-client-id';
const LEGACY_NAME_KEY = 'floodlight-name';

/** Guest identity: uuid-style hex/dashes, 8–64 chars (ADR-004). */
export const CLIENT_ID_RE = /^[0-9a-f-]{8,64}$/i;

export function isValidClientId(v: unknown): v is string {
  return typeof v === 'string' && CLIENT_ID_RE.test(v);
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mint a fresh persistent guest id: UUID when available, hex fallback. */
export function makePersistentClientId(): string {
  try {
    const g = globalThis as Record<string, unknown>;
    const c = g.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* fall through */
  }
  try {
    return randomHex(16);
  } catch {
    return `${Date.now().toString(16)}${Math.floor(Math.random() * 0xffffffff).toString(16)}`.slice(0, 16);
  }
}

/**
 * Sanitize a nickname: trim, collapse inner whitespace, strip controls and
 * angle brackets (HTML-safe), keep Turkish/diacritics. Returns null when the
 * result is not 3–16 chars.
 */
export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 16) return null;
  return s;
}

export function isValidDisplayName(v: unknown): boolean {
  return sanitizeDisplayName(v) !== null;
}

type Store = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

function storage(): Store | null {
  try {
    const g = globalThis as Record<string, unknown>;
    const ls = g.localStorage as Store | undefined;
    if (ls && typeof ls.getItem === 'function') return ls;
    return null;
  } catch {
    return null;
  }
}

function parseProfile(raw: string | null): CityProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!isValidClientId(v.clientId)) return null;
    const name = sanitizeDisplayName(v.displayName);
    if (!name) return null;
    v.cityCode = migrateCityCode(v.cityCode);
    if (!isValidCityCode(v.cityCode)) return null;
    if (typeof v.citySeasonKey !== 'string' || !/^\d{4}-W\d{2}$/.test(v.citySeasonKey)) return null;
    return {
      clientId: v.clientId as string,
      displayName: name,
      cityCode: v.cityCode as CityCode,
      citySeasonKey: v.citySeasonKey as string,
    };
  } catch {
    return null;
  }
}

/** Returning player profile, or null when onboarding is required. */
export function getProfile(): CityProfile | null {
  const store = storage();
  if (!store) return null;
  try {
    return parseProfile(store.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

/** True when a stored, valid profile exists (returning player bypasses onboarding). */
export function hasProfile(): boolean {
  return getProfile() !== null;
}

export interface SaveProfileInput {
  displayName: string;
  cityCode: string;
  /** Current season key (server value preferred; client helper as fallback). */
  seasonKey: string;
  /** Existing profile to preserve clientId + enforce the season lock. */
  existing?: CityProfile | null;
}

/**
 * Validate + persist a profile. Enforces the weekly city lock: when an
 * existing profile's citySeasonKey equals the current season, the city
 * cannot change until next season (historical rows keep their snapshots).
 * Throws an Error with a player-safe message on invalid input.
 */
export function saveProfile(input: SaveProfileInput): CityProfile {
  const name = sanitizeDisplayName(input.displayName);
  if (!name) throw new Error('NAME MUST BE 3–16 CHARACTERS');
  if (!isValidCityCode(input.cityCode)) throw new Error('PICK YOUR COUNTRY');
  if (!/^\d{4}-W\d{2}$/.test(input.seasonKey)) throw new Error('SEASON UNAVAILABLE — TRY AGAIN');

  const existing = input.existing ?? getProfile();
  if (existing && existing.citySeasonKey === input.seasonKey && existing.cityCode !== input.cityCode) {
    throw new Error('COUNTRY IS LOCKED FOR THIS SEASON');
  }

  const profile: CityProfile = {
    clientId: existing && isValidClientId(existing.clientId) ? existing.clientId : makePersistentClientId(),
    displayName: name,
    cityCode: input.cityCode,
    citySeasonKey: input.seasonKey,
  };

  const store = storage();
  if (store) {
    try {
      store.setItem(PROFILE_KEY, JSON.stringify(profile));
      // Legacy sync: existing league/client code reads these keys.
      store.setItem(LEGACY_ID_KEY, profile.clientId);
      store.setItem(LEGACY_NAME_KEY, profile.displayName);
    } catch {
      /* private mode: in-memory profile still returned */
    }
  }
  // Lazily sync legacy id for callers that read it directly.
  try {
    const g = globalThis as Record<string, unknown>;
    void g;
  } catch {
    /* ignore */
  }
  return profile;
}

/** True when the profile's city cannot change this season. */
export function isCityLocked(profile: CityProfile, currentSeasonKey: string): boolean {
  return profile.citySeasonKey === currentSeasonKey;
}

/** Change city only at a new season; returns the updated profile. */
export function changeCity(profile: CityProfile, nextCity: string, currentSeasonKey: string): CityProfile {
  if (!isValidCityCode(nextCity)) throw new Error('PICK YOUR COUNTRY');
  if (isCityLocked(profile, currentSeasonKey)) throw new Error('COUNTRY IS LOCKED FOR THIS SEASON');
  return saveProfile({
    displayName: profile.displayName,
    cityCode: nextCity,
    seasonKey: currentSeasonKey,
    existing: profile,
  });
}

export function clearProfileForTests(): void {
  try {
    storage()?.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
