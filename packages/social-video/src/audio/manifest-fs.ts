import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preferredAssetId, type AudioAsset, type AudioManifest } from './library';

/**
 * Node-only manifest/filesystem access for the audio pipeline.
 *
 * NEVER import this from client-bundled modules (scene code, compile.ts,
 * harness): the static node:fs import breaks the browser harness boot
 * (Vite externalizes node builtins and throws on access). Scene code uses
 * the pure `library.ts`; only the Node mixer (`mix.ts`), tests and CLI
 * touch this module.
 */

void preferredAssetId;

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

/** Absolute path of a bundled asset file, or null when not downloaded. */
export function resolveAssetFile(asset: AudioAsset): string | null {
  const p = path.join(manifestDir(), asset.file);
  return existsSync(p) ? p : null;
}

/** All bundled (downloaded) files, for diagnostics. */
export function bundledAssets(): AudioAsset[] {
  return loadAudioManifest().assets.filter((a) => resolveAssetFile(a) !== null);
}

/** True when the preferred asset is actually bundled on disk. */
export function hasBundledAsset(seed: number, eventType: string, eventIndex: number): boolean {
  // Lazy to keep this module's static graph fs-only (no cycle risk).
  const { preferredAssetId } = require('./library') as typeof import('./library');
  const id = preferredAssetId(seed, eventType, eventIndex);
  if (!id) return false;
  const asset = loadAudioManifest().assets.find((a) => a.id === id);
  return asset ? resolveAssetFile(asset) !== null : false;
}
