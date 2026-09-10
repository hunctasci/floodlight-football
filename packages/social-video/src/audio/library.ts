import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Curated external-audio library.
 *
 * Every production SFX first consults `assets/audio/manifest.json`. When a
 * bundled file is present it is the preferred layer; when it is absent (the
 * default checkout — binaries are NOT committed) the deterministic
 * procedural HNC synth in `mix.ts` renders the same semantic event instead.
 * Production never fails because one optional asset is absent.
 *
 * Determinism: variant selection is `hash(seed + eventType + eventIndex)`,
 * so the same seed always picks the same sample.
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

export function manifestDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../assets/audio');
}

export function manifestPath(): string {
  return path.join(manifestDir(), 'manifest.json');
}

let cached: AudioManifest | null = null;

export function loadAudioManifest(): AudioManifest {
  if (cached) return cached;
  const raw = readFileSync(manifestPath(), 'utf8');
  cached = JSON.parse(raw) as AudioManifest;
  return cached;
}

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

/** Absolute path of a bundled asset file, or null when not downloaded. */
export function resolveAssetFile(asset: AudioAsset): string | null {
  const p = path.join(manifestDir(), asset.file);
  return existsSync(p) ? p : null;
}

/** All bundled (downloaded) files, for diagnostics. */
export function bundledAssets(): AudioAsset[] {
  return loadAudioManifest().assets.filter((a) => resolveAssetFile(a) !== null);
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
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return variantIds[h % variantIds.length];
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

/** True when the preferred asset is actually bundled on disk. */
export function hasBundledAsset(seed: number, eventType: string, eventIndex: number): boolean {
  const id = preferredAssetId(seed, eventType, eventIndex);
  if (!id) return false;
  const asset = loadAudioManifest().assets.find((a) => a.id === id);
  return asset ? resolveAssetFile(asset) !== null : false;
}
