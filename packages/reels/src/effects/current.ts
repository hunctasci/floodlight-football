/**
 * THE CURRENT — colour identity of each nation's energy (pure, Node-safe).
 * Tuned nations first (the anime tribute's two sides); every other country
 * derives its Current from its canonical kit primary, lifted toward light so
 * it reads as energy, not cloth. Blender plates use the same values.
 */
import { countryColors, isValidCountryCode } from '../cast/countries';

export const CURRENT_TUNED: Record<string, string> = {
  TR: '#ff2a3d',
  GR: '#3fa9ff',
};

export const CURRENT_GOLD = '#ffc233';
export const CURRENT_WHITE = '#fff6ec';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Mix two hex colours (t = 0 → a, 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Current colour for a country code, a `#hex`, or `gold`. */
export function currentColor(ref: string | undefined): string {
  if (!ref) return CURRENT_WHITE;
  if (ref.startsWith('#')) return ref;
  if (ref === 'gold') return CURRENT_GOLD;
  if (CURRENT_TUNED[ref]) return CURRENT_TUNED[ref];
  if (!isValidCountryCode(ref)) return CURRENT_WHITE;
  // Kit primary lifted toward white: energy, not fabric.
  return mixHex(countryColors(ref).primary, '#ffffff', 0.28);
}

/** `rgba()` of a hex colour. */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** [r, g, b] in 0..1 (shader uniforms). */
export function rgb01(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r / 255, g / 255, b / 255];
}
