import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { random01, rng } from '../src/utils/rng';
import { sampleFootballMoment } from '../src/football/adapter/choreography';
import { evaluateCamera } from '../src/cameras/registry';
import { sampleAnimation } from '../src/animation/sample-animation';

describe('determinism', () => {
  it('keyed rng is stable and key-isolated', () => {
    assert.equal(random01(42, 'cloud-puff-4'), random01(42, 'cloud-puff-4'));
    // Different keys diverge (overwhelmingly likely).
    assert.notEqual(random01(42, 'a'), random01(42, 'b'));
    // Unrelated keys do not shift each other: stream-per-key.
    const r1 = rng(42, 'stable-key')();
    random01(42, 'unrelated-addition');
    assert.equal(rng(42, 'stable-key')(), r1);
  });
  it('same spec+seed+frame gives same football choreography', () => {
    const a = sampleFootballMoment('crossbar-chaos', 5.0, 6.3, true);
    const b = sampleFootballMoment('crossbar-chaos', 5.0, 6.3, true);
    assert.deepEqual(a, b);
  });
  it('same camera preset+frame gives same pose', () => {
    assert.deepEqual(evaluateCamera('dramatic-push', 12, 24), evaluateCamera('dramatic-push', 12, 24));
  });
  it('animation sampling is absolute (no frame history)', () => {
    const direct = sampleAnimation('side-eye', 300, 30, 280);
    const again = sampleAnimation('side-eye', 300, 30, 280);
    assert.deepEqual(direct, again);
    // Rendering frame 300 needs only arithmetic, not frames 0..299.
    assert.equal(direct.localTime, (300 - 280) / 30);
  });
});
