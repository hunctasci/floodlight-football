/**
 * Curated external-audio library (CLIENT-SAFE: pure, no node:fs).
 *
 * Variant selection is `hash(seed + eventType + eventIndex)`, so the same
 * seed always picks the same sample. Scene/choreography code
 * (`compile.ts`, bundled into the browser harness) may only import from
 * here — filesystem access (manifest loading, file resolution) lives in
 * `manifest-fs.ts`, which is Node-only (mixer + tests + CLI).
 */

export type AudioCategory =
  | 'stadium'
  | 'crowd'
  | 'kick'
  | 'header'
  | 'post'
  | 'save'
  | 'whistle'
  | 'whoosh'
  | 'impact'
  | 'transition'
  | 'celebration'
  | 'music';

export type AudioSource = 'mixkit' | 'pixabay' | 'freesound';

export interface AudioAsset {
  id: string;
  file: string;
  category: AudioCategory;
  source: AudioSource;
  sourcePage: string;
  creator?: string;
  license: string;
  attributionRequired: boolean;
  downloadedAt: string;
  bundled?: boolean;
  title?: string;
  usage?: string;
}

export interface AudioManifest {
  version: number;
  notes?: string;
  licensePolicy?: {
    allowed?: string[];
    allowedWithAttribution?: string[];
    rejected?: string[];
  };
  assets: AudioAsset[];
}

const REJECTED_LICENSE = /(BY-NC|NONCOMMERCIAL|NON-COMMERCIAL)/i;

/** For tests: validate an in-memory manifest without touching disk. */
export function validateAudioManifest(manifest: AudioManifest): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const a of manifest.assets) {
    if (!a.id) errors.push('asset missing id');
    if (ids.has(a.id)) errors.push(`duplicate asset id: ${a.id}`);
    ids.add(a.id);
    if (!a.file) errors.push(`asset ${a.id}: missing file`);
    if (!a.sourcePage || !/^https?:\/\//.test(a.sourcePage)) {
      errors.push(`asset ${a.id}: sourcePage must be an http(s) URL`);
    }
    if (!a.license) errors.push(`asset ${a.id}: missing license`);
    if (REJECTED_LICENSE.test(a.license)) {
      errors.push(`asset ${a.id}: NC license rejected for promotional content (${a.license})`);
    }
    if (!['mixkit', 'pixabay', 'freesound'].includes(a.source)) {
      errors.push(`asset ${a.id}: unknown source ${a.source}`);
    }
    if (a.source === 'freesound' && /BY-NC/i.test(a.license)) {
      errors.push(`asset ${a.id}: Freesound NC license must never be used`);
    }
  }
  return errors;
}

/**
 * Deterministic variant picker: hash(seed, eventType, eventIndex) →
 * variants[index]. Same inputs always yield the same sample; no RNG calls.
 */
export function selectVariantId(
  seed: number,
  eventType: string,
  eventIndex: number,
  variantIds: readonly string[],
): string {
  if (variantIds.length === 0) throw new Error('selectVariantId: empty variant pool');
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of eventType) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  h = (Math.imul(h ^ (eventIndex >>> 0), 0x85ebca6b) >>> 0) || 1;
  // Final avalanche (xorshift-ish) so adjacent indices decorrelate.
  // NOTE: bitwise ^ yields int32 (may be negative), so the final index must
  // coerce back to uint32 — otherwise h % length can be -1 and the lookup
  // returns undefined for some seeds (latent until crowd pools hit them).
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return variantIds[(h >>> 0) % variantIds.length];
}

/** Variants available per semantic event (manifest ids, bundled-or-not). */
export const VARIANT_POOLS: Record<string, readonly string[]> = {
  kick: ['kick-pass-01', 'kick-pass-02'],
  shot: ['kick-shot-01', 'kick-shot-02'],
  cross: ['kick-pass-01', 'kick-pass-02'],
  clearance: ['kick-shot-01', 'kick-pass-01'],
  header: ['header-thump-01', 'header-thump-02'],
  crossbar: ['post-clang-01', 'post-clang-02'],
  save: ['save-catch-01'],
  goalSmall: ['goal-cheer-small-01'],
  goalLarge: ['goal-cheer-large-01', 'goal-cheer-massive-02'],
  goalMassive: ['goal-cheer-massive-01', 'goal-cheer-massive-02'],
  whoosh: ['whoosh-fast-01', 'whoosh-short-01'],
  impact: ['impact-sub-01'],
  whistle: ['whistle-long-01'],
  // Real Freesound CC0 crowd pools (assets/audio/crowd/, see SOURCES.md).
  // compile.ts assigns these deterministically per event occurrence; mix.ts
  // resolves them to bundled WAVs and falls back to procedural + warning.
  bed: ['stadium-bed-01', 'stadium-bed-02'],
  anticipationRise: ['anticipation-01', 'anticipation-02'],
  goalRoar: ['goal-roar-01', 'goal-roar-02', 'goal-roar-03'],
  disappointment: ['disappointment-01'],
};

/** Default real-crowd pool per sample-backed event type (mixer fallback). */
export const CROWD_POOL_BY_TYPE: Record<string, string> = {
  ambience: 'bed',
  anticipation: 'anticipationRise',
  goal: 'goalRoar',
  crowd: 'goalRoar',
  disappointment: 'disappointment',
};

/** Preferred asset id for one event occurrence (deterministic). */
export function preferredAssetId(
  seed: number,
  eventType: string,
  eventIndex: number,
): string | null {
  const pool = VARIANT_POOLS[eventType];
  if (!pool) return null;
  return selectVariantId(seed, eventType, eventIndex, pool);
}
