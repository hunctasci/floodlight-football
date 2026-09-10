import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileStory } from '../src/director/compile-story';
import { validateProductionReel } from '../src/reel/validate';
import { parseTemplateInput } from '../src/reel/schema';

describe('render smoke (no browser)', () => {
  it('office-rivalry compiles to 1080x1920 with valid timeline', () => {
    const { spec, plan } = compileStory(
      parseTemplateInput({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 42, fps: 30, footballMoment: 'crossbar-chaos' }),
    );
    assert.equal(plan.width, 1080);
    assert.equal(plan.height, 1920);
    assert.equal(plan.totalFrames, 480);
    const errors = validateProductionReel(spec, plan).filter((i) => i.level === 'error');
    assert.deepEqual(errors, []);
  });
  it('country-rivalry compiles to 1080x1920 with valid timeline', () => {
    const { spec, plan } = compileStory(
      parseTemplateInput({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 42, fps: 30, footballMoment: 'attack-goal' }),
    );
    assert.equal(plan.width, 1080);
    assert.equal(plan.height, 1920);
    assert.equal(plan.totalFrames, Math.round(15.5 * 30));
    const errors = validateProductionReel(spec, plan).filter((i) => i.level === 'error');
    assert.deepEqual(errors, []);
  });
});
