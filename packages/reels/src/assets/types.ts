export type AssetType =
  | 'character'
  | 'environment'
  | 'prop'
  | 'animation'
  | 'texture'
  | 'audio'
  | 'video'
  | 'image';

export interface AssetManifestEntry {
  id: string;
  type: AssetType;
  /** Path relative to packages/reels/public/assets (no raw paths in ReelSpecs). */
  file: string;
  /** True when the binary is committed; false = placeholder to download later. */
  bundled: boolean;
  proceduralFallback?: string;
  source?: string;
  author?: string;
  license?: string;
  attributionRequired?: boolean;
  tags?: string[];
  anchors?: string[];
  metadata?: Record<string, unknown>;
}
