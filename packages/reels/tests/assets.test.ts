import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAssetManifest } from '../src/assets/validate';
import { ASSET_MANIFEST } from '../src/assets/manifest';
import { getAsset } from '../src/assets/registry';

describe('assets', () => {
  it('manifest has no duplicates or relative escapes', () => {
    const errors = validateAssetManifest().filter((i) => i.level === 'error');
    assert.deepEqual(errors, []);
  });
  it('placeholder ids for the office pipeline exist', () => {
    for (const id of ['office-worker-male-01', 'office-modern-01', 'office-desk-01', 'anim-side-eye']) {
      assert.ok(getAsset(id), id);
    }
  });
  it('manifest covers required placeholder families', () => {
    const ids = new Set(ASSET_MANIFEST.map((a) => a.id));
    for (const id of ['office-worker-female-01', 'coffee-machine-01', 'anim-typing', 'anim-celebrate', 'hnc-logo']) {
      assert.ok(ids.has(id), id);
    }
  });
});
