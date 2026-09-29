import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAssetManifest } from '../src/assets/validate';
import { getAsset } from '../src/assets/registry';

describe('assets', () => {
  it('manifest has no duplicates or relative escapes', () => {
    const errors = validateAssetManifest().filter((i) => i.level === 'error');
    assert.deepEqual(errors, []);
  });
  it('the brand badge and the CC0 crowd clips are registered', () => {
    for (const id of ['hnc-logo', 'stadium-bed-01', 'goal-roar-01', 'anticipation-01']) assert.ok(getAsset(id), id);
  });
});
