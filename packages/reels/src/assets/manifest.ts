import type { AssetManifestEntry } from './types';

/**
 * Asset manifest: the ONLY place that maps semantic asset ids to files.
 * ReelSpecs reference `asset: 'office-modern-01'`, never filesystem paths.
 * Procedural placeholders keep every template renderable before binaries land.
 */
export const ASSET_MANIFEST: AssetManifestEntry[] = [
  // Characters (procedural until licensed GLBs land — see assets/SOURCES.md)
  { id: 'office-worker-male-01', type: 'character', file: 'characters/office-worker-male-01.glb', bundled: false, proceduralFallback: 'procedural-office-worker', license: 'TBD (do not ship yet)', tags: ['office', 'male'] },
  { id: 'office-worker-male-02', type: 'character', file: 'characters/office-worker-male-02.glb', bundled: false, proceduralFallback: 'procedural-office-worker', license: 'TBD (do not ship yet)', tags: ['office', 'male'] },
  { id: 'office-worker-female-01', type: 'character', file: 'characters/office-worker-female-01.glb', bundled: false, proceduralFallback: 'procedural-office-worker', license: 'TBD (do not ship yet)', tags: ['office', 'female'] },
  { id: 'office-worker-female-02', type: 'character', file: 'characters/office-worker-female-02.glb', bundled: false, proceduralFallback: 'procedural-office-worker', license: 'TBD (do not ship yet)', tags: ['office', 'female'] },
  { id: 'hnc-footballer', type: 'character', file: 'characters/hnc-footballer.glb', bundled: false, proceduralFallback: 'procedural-hnc-footballer', tags: ['football'] },
  // Environments
  { id: 'office-modern-01', type: 'environment', file: 'environments/office-modern-01.glb', bundled: false, proceduralFallback: 'procedural-office', tags: ['office'], anchors: ['desk-left', 'desk-right', 'coffee-machine', 'meeting-table', 'door', 'manager', 'window'] },
  { id: 'hnc-stadium', type: 'environment', file: 'environments/hnc-stadium.glb', bundled: false, proceduralFallback: 'procedural-hnc-stadium', tags: ['football', 'stadium'] },
  // Props
  { id: 'office-desk-01', type: 'prop', file: 'props/office-desk-01.glb', bundled: false, proceduralFallback: 'procedural-desk', tags: ['office'] },
  { id: 'office-chair-01', type: 'prop', file: 'props/office-chair-01.glb', bundled: false, proceduralFallback: 'procedural-chair', tags: ['office'] },
  { id: 'office-monitor-01', type: 'prop', file: 'props/office-monitor-01.glb', bundled: false, proceduralFallback: 'procedural-monitor', tags: ['office'] },
  { id: 'office-laptop-01', type: 'prop', file: 'props/office-laptop-01.glb', bundled: false, proceduralFallback: 'procedural-laptop', tags: ['office'] },
  { id: 'coffee-cup-01', type: 'prop', file: 'props/coffee-cup-01.glb', bundled: false, proceduralFallback: 'procedural-mug', tags: ['office'] },
  { id: 'coffee-machine-01', type: 'prop', file: 'props/coffee-machine-01.glb', bundled: false, proceduralFallback: 'procedural-coffee-machine', tags: ['office'] },
  // Animations (semantic ids; files land with Mixamo-compatible GLBs)
  { id: 'anim-idle', type: 'animation', file: 'animations/idle.glb', bundled: false, tags: ['loop'] },
  { id: 'anim-typing', type: 'animation', file: 'animations/typing.glb', bundled: false, tags: ['office', 'loop'] },
  { id: 'anim-sitting-idle', type: 'animation', file: 'animations/sitting-idle.glb', bundled: false, tags: ['office', 'loop'] },
  { id: 'anim-celebrate', type: 'animation', file: 'animations/celebrate.glb', bundled: false, tags: ['emotion'] },
  { id: 'anim-side-eye', type: 'animation', file: 'animations/side-eye.glb', bundled: false, tags: ['emotion', 'comedy'] },
  { id: 'anim-angry', type: 'animation', file: 'animations/angry.glb', bundled: false, tags: ['emotion'] },
  // Brand
  { id: 'hnc-logo', type: 'image', file: 'brand/hnc-logo.png', bundled: false, proceduralFallback: 'procedural-hnc-logo', source: 'apps/game/public/icons/hnc-retro-v2.png', license: 'HNC internal', tags: ['brand'] },
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
