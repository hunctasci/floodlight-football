/**
 * Display uppercase that respects Turkish. Plain toUpperCase() / CSS
 * `text-transform: uppercase` in an English locale turns "Türkiye" into
 * "TÜRKIYE" (dotless I) — a typo in the brand's home market. Words carrying
 * Turkish letters use Turkish casing (i → İ); everything else English casing
 * (Italy → ITALY). `lang: 'tr'` forces Turkish for a whole Turkish line.
 */
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

export function upper(text: string, lang?: 'tr' | 'en'): string {
  if (lang === 'tr') return text.toLocaleUpperCase('tr');
  return text.replace(/[^\s]+/g, (w) => (TURKISH.test(w) ? w.toLocaleUpperCase('tr') : w.toUpperCase()));
}
