import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transitionCoverage, transitionSwapFrame } from '../src/transitions/registry';
import { cloudLayout } from '../src/transitions/cloud-puff';

describe('transitions', () => {
  it('cloud-puff reaches full coverage and holds through the swap', () => {
    const dur = 24;
    const mid = transitionCoverage('cloud-puff', Math.floor(dur * 0.5), dur);
    assert.ok(mid >= 0.99, `mid coverage ${mid}`);
    const swap = transitionSwapFrame('cloud-puff', dur);
    assert.ok(transitionCoverage('cloud-puff', swap, dur) >= 0.95, 'swap occurs under cover');
    assert.equal(transitionCoverage('cloud-puff', 0, dur), 0);
  });
  it('cloud layout is deterministic per seed', () => {
    assert.deepEqual(cloudLayout(42, 'k', 8, 1080, 1920), cloudLayout(42, 'k', 8, 1080, 1920));
    assert.notDeepEqual(cloudLayout(42, 'k', 8, 1080, 1920), cloudLayout(43, 'k', 8, 1080, 1920));
  });
});
