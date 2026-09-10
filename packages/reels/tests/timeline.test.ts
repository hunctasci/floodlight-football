import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileShotPlan, compileOfficeRivalry, compileCountryRivalry } from '../src/reel/compile';

describe('timeline', () => {
  it('office beats compile to expected frame count', () => {
    const spec = compileOfficeRivalry({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 42, fps: 30 });
    const plan = compileShotPlan(spec);
    assert.equal(plan.totalFrames, Math.round(16 * 30));
    assert.equal(plan.shots.length, spec.beats.length);
  });
  it('sequences tile without gaps or overlaps', () => {
    const spec = compileCountryRivalry({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 7 });
    const plan = compileShotPlan(spec);
    let cursor = 0;
    for (const shot of plan.shots) {
      assert.equal(shot.startFrame, cursor);
      cursor += shot.durationInFrames;
    }
    assert.equal(cursor, plan.totalFrames);
  });
  it('60fps doubles frame count for the same duration', () => {
    const a = compileShotPlan(compileOfficeRivalry({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 1, fps: 30 }));
    const b = compileShotPlan(compileOfficeRivalry({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 1, fps: 60 }));
    assert.equal(b.totalFrames, a.totalFrames * 2);
  });
});
