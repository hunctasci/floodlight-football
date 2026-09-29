import type { AssetManifestEntry } from './types';

/**
 * Asset manifest: the ONLY place that maps semantic asset ids to files.
 * ReelSpecs reference `asset: 'office-modern-01'`, never filesystem paths.
 * Procedural placeholders keep every template renderable before binaries land.
 */
export const ASSET_MANIFEST: AssetManifestEntry[] = [
  // Characters, worlds and props are procedural HNC geometry (hnc-visuals +
  // worlds/*): no third-party 3D binaries. Licensed props slot in here with
  // provenance (scripts/import-glb.ts, assets/SOURCES.md).
  // Brand
  { id: 'hnc-logo', type: 'image', file: 'brand/hnc-retro-v2.png', bundled: true, proceduralFallback: 'procedural-hnc-logo', source: 'apps/game/public/icons/hnc-retro-v2.png', license: 'HNC internal', tags: ['brand'] },
  // Audio: real Freesound CC0 crowd recordings, single-sourced from
  // packages/social-video via the public/assets/audio/crowd symlink.
  // Provenance: packages/social-video/assets/audio/SOURCES.md.
  { id: 'stadium-bed-01', type: 'audio', file: 'audio/crowd/stadium-bed-01.wav', bundled: true, source: 'https://freesound.org/people/BeeProductive/sounds/395592/', author: 'BeeProductive', license: 'CC0 1.0', attributionRequired: false, tags: ['stadium', 'ambience'] },
  { id: 'stadium-bed-02', type: 'audio', file: 'audio/crowd/stadium-bed-02.wav', bundled: true, source: 'https://freesound.org/people/BeeProductive/sounds/395592/', author: 'BeeProductive', license: 'CC0 1.0', attributionRequired: false, tags: ['stadium', 'ambience'] },
  { id: 'anticipation-01', type: 'audio', file: 'audio/crowd/anticipation-01.wav', bundled: true, source: 'https://freesound.org/people/D.jones/sounds/528799/', author: 'D.jones', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'anticipation'] },
  { id: 'anticipation-02', type: 'audio', file: 'audio/crowd/anticipation-02.wav', bundled: true, source: 'https://freesound.org/people/ckater/sounds/353418/', author: 'ckater', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'anticipation'] },
  { id: 'goal-roar-01', type: 'audio', file: 'audio/crowd/goal-roar-01.wav', bundled: true, source: 'https://freesound.org/people/D.jones/sounds/528799/', author: 'D.jones', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'celebration'] },
  { id: 'goal-roar-02', type: 'audio', file: 'audio/crowd/goal-roar-02.wav', bundled: true, source: 'https://freesound.org/people/ckater/sounds/353418/', author: 'ckater', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'celebration'] },
  { id: 'goal-roar-03', type: 'audio', file: 'audio/crowd/goal-roar-03.wav', bundled: true, source: 'https://freesound.org/people/ckater/sounds/353418/', author: 'ckater', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'celebration'] },
  { id: 'disappointment-01', type: 'audio', file: 'audio/crowd/disappointment-01.wav', bundled: true, source: 'https://freesound.org/people/ckater/sounds/353418/', author: 'ckater', license: 'CC0 1.0', attributionRequired: false, tags: ['crowd', 'groan'] },
];

export const ASSET_IDS = ASSET_MANIFEST.map((a) => a.id);
