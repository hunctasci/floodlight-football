/**
 * City League — static city configuration (single source of truth).
 *
 * 8 Turkish cities, original Floodlight branding only. No real clubs,
 * logos, kits or copyrighted branding. Colors + geometric badges are
 * original and gameplay-neutral (identity/meta only, never stats).
 *
 * Pure module: safe for the Cloudflare Worker AND the browser client.
 * Validation must use this source, never scattered string literals.
 */

export const CITIES = [
  {
    code: 'IST',
    name: 'İstanbul',
    short: 'IST',
    colors: { primary: '#E63946', secondary: '#F1FA8C' },
    badge: 'crescent',
  },
  {
    code: 'ANK',
    name: 'Ankara',
    short: 'ANK',
    colors: { primary: '#F4A261', secondary: '#264653' },
    badge: 'sun',
  },
  {
    code: 'IZM',
    name: 'İzmir',
    short: 'IZM',
    colors: { primary: '#2A9D8F', secondary: '#E9C46A' },
    badge: 'wave',
  },
  {
    code: 'BUR',
    name: 'Bursa',
    short: 'BUR',
    colors: { primary: '#606C38', secondary: '#DDA15E' },
    badge: 'peak',
  },
  {
    code: 'TRA',
    name: 'Trabzon',
    short: 'TRA',
    colors: { primary: '#457B9D', secondary: '#A8DADC' },
    badge: 'anchor',
  },
  {
    code: 'RIZ',
    name: 'Rize',
    short: 'RIZ',
    colors: { primary: '#1D3557', secondary: '#90BE6D' },
    badge: 'leaf',
  },
  {
    code: 'ADA',
    name: 'Adana',
    short: 'ADA',
    colors: { primary: '#E76F51', secondary: '#F4A259' },
    badge: 'flame',
  },
  {
    code: 'ANT',
    name: 'Antalya',
    short: 'ANT',
    colors: { primary: '#F4A259', secondary: '#0077B6' },
    badge: 'tide',
  },
] as const;

export type CityCode = (typeof CITIES)[number]['code'];

export interface CityDef {
  readonly code: CityCode;
  readonly name: string;
  readonly short: string;
  readonly colors: { readonly primary: string; readonly secondary: string };
  readonly badge: string;
}

const CODE_SET: ReadonlySet<string> = new Set(CITIES.map((c) => c.code));

export function isValidCityCode(v: unknown): v is CityCode {
  return typeof v === 'string' && CODE_SET.has(v);
}

export function getCity(code: string): CityDef | null {
  const found = (CITIES as readonly CityDef[]).find((c) => c.code === code);
  return found ?? null;
}

export function cityName(code: string): string {
  return getCity(code)?.name ?? code;
}

export function cityShort(code: string): string {
  return getCity(code)?.short ?? code;
}
