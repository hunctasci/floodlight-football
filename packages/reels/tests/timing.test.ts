import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAt, type TimingContext } from '../src/engine/spec/timing';

const beats = new Map([
  ['intro', { id: 'intro', start: 0, duration: 30 }],
  ['side-eye', { id: 'side-eye', start: 30, duration: 60 }],
  ['touch', { id: 'touch', start: 90, duration: 30 }],
]);
const ctx: TimingContext = {
  fps: 30,
  beat: beats.get('side-eye')!,
  beats,
  momentBeats: { contact: 6.1, 'touch-1': 2.7 },
  momentFrame: (t) => (t >= 2 && t <= 7 ? Math.round(100 + (t - 2) * 30) : undefined),
};

describe('timing grammar', () => {
  it('seconds, frames, percentages and edges are beat-relative', () => {
    assert.equal(resolveAt(undefined, ctx), 30);
    assert.equal(resolveAt(undefined, ctx, 'end'), 90);
    assert.equal(resolveAt(0.5, ctx), 45);
    assert.equal(resolveAt('0.5', ctx), 45);
    assert.equal(resolveAt('6f', ctx), 36);
    assert.equal(resolveAt('50%', ctx), 60);
    assert.equal(resolveAt('end-0.2', ctx), 84);
    assert.equal(resolveAt('start+3f', ctx), 33);
  });
  it('references other beats, including ids with dashes', () => {
    assert.equal(resolveAt('intro.end', ctx), 30);
    assert.equal(resolveAt('touch', ctx), 90);
    assert.equal(resolveAt('side-eye@50%', ctx), 60);
    assert.equal(resolveAt('side-eye.end-3f', ctx), 87);
    assert.equal(resolveAt('touch+0.1', ctx), 93);
  });
  it('resolves world-clock beats and raw times, names with dashes first', () => {
    assert.equal(resolveAt('moment:contact', ctx), 223);
    assert.equal(resolveAt('moment:touch-1', ctx), 121);
    assert.equal(resolveAt('moment:touch-1+2f', ctx), 123);
    assert.equal(resolveAt('moment:6.1-0.1', ctx), 220);
    assert.throws(() => resolveAt('moment:nope', ctx), /Unknown moment beat/);
    assert.throws(() => resolveAt('moment:9', ctx), /not covered/);
    assert.throws(() => resolveAt('mystery', ctx), /Unparseable/);
  });
});
