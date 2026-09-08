/** Compatibility names for existing network packets and D1 columns.
 * Values now contain ISO country codes, never city codes.
 */
export { COUNTRIES as CITIES, isValidCountryCode as isValidCityCode,
  getCountry as getCity, countryName as cityName, countryShort as cityShort,
  type CountryCode as CityCode, type CountryDef as CityDef } from './countries';
