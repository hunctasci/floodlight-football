import { getCountry, isValidCountryCode } from '../../../../../apps/game/src/city-league/countries';

/**
 * Canonical HNC country access for the Reel Factory.
 * NEVER duplicate the country list — always go through the game source.
 */
export { getCountry, isValidCountryCode };

export function countryName(code: string): string {
  return getCountry(code)?.name ?? code;
}

export function countryFlag(code: string): string {
  return getCountry(code)?.flag ?? code;
}

export function countryColors(code: string): { primary: string; secondary: string } {
  const c = getCountry(code);
  return { primary: c?.colors.primary ?? '#ffffff', secondary: c?.colors.secondary ?? '#151515' };
}
