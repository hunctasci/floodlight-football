import { ASSET_MANIFEST } from './manifest';

const byId = new Map(ASSET_MANIFEST.map((a) => [a.id, a]));

/** Semantic lookup: stories use ids, never paths. */
export function getAsset(id: string) {
  const entry = byId.get(id);
  if (!entry) throw new Error(`Unknown asset id: ${id}`);
  return entry;
}

export function hasAsset(id: string): boolean {
  return byId.has(id);
}

/** Public URL for a bundled asset (Remotion staticFile-compatible). */
export function assetPublicPath(id: string): string {
  const entry = getAsset(id);
  return `assets/${entry.file}`;
}

export function bundledAssets() {
  return ASSET_MANIFEST.filter((a) => a.bundled);
}

export function placeholderAssets() {
  return ASSET_MANIFEST.filter((a) => !a.bundled);
}
