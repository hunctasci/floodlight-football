import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sampleAnimation, sampleCrossfade } from '../src/animation/sample-animation';
import { getAnimation } from '../src/animation/animation-registry';

describe('animation', () => {
  it('looping clips wrap local time', () => {
    const def = getAnimation('typing');
    const fps = 30;
    const clipFrames = Math.round(def.duration * fps);
    const a = sampleAnimation('typing', clipFrames + 5, fps, 0);
    const b = sampleAnimation('typing', 5, fps, 0);
    assert.equal(a.localTime, b.localTime);
  });
  it('one-shots finish and stay done', () => {
    const def = getAnimation('side-eye');
    const done = sampleAnimation('side-eye', Math.round(def.duration * 30) + 100, 30, 0);
    assert.equal(done.done, true);
    assert.equal(done.progress, 1);
  });
  it('crossfade mix derives from absolute frame', () => {
    const m1 = sampleCrossfade('typing', 'side-eye', 100, 30, 100, 12);
    const m2 = sampleCrossfade('typing', 'side-eye', 100, 30, 100, 12);
    assert.equal(m1.mix, m2.mix);
    assert.equal(m1.mix, 0.5);
  });
});
