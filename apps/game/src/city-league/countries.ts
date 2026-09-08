import { COUNTRY_COLORS } from './country-colors';
/** ISO 3166-1 country/territory identities shared by browser and Worker. */
const CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(' ');
const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const COUNTRIES = CODES.map((code) => ({
  code, name: names.of(code) ?? code, short: code,
  flag: [...code].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join(''),
  colors: { primary: COUNTRY_COLORS[code]?.[0] ?? '#ffffff', secondary: COUNTRY_COLORS[code]?.[1] ?? '#151515' }, badge: 'flag',
})).sort((a, b) => a.name.localeCompare(b.name, 'en'));
export type CountryCode = string;
export type CountryDef = (typeof COUNTRIES)[number];
const codes = new Set(CODES);
export function isValidCountryCode(v: unknown): v is CountryCode {
  return typeof v === 'string' && codes.has(v);
}
export function getCountry(code: string): CountryDef | null {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
export const countryName = (code: string): string => getCountry(code)?.name ?? code;
export const countryShort = (code: string): string => getCountry(code)?.short ?? code;
/** Preserve existing Turkish players when upgrading from the city league. */
export function migrateCityCode(code: unknown): unknown {
  return typeof code === 'string' && ['IST','ANK','IZM','BUR','TRA','RIZ','ADA','ANT'].includes(code) ? 'TR' : code;
}
