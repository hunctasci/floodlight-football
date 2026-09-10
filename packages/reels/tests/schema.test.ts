import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCountry, parseFps, parseSeed, parseTemplateId, validateReelSpec, ReelSpecError } from '../src/reel/schema';
import { compileOfficeRivalry } from '../src/reel/compile';

describe('reel schema', () => {
  it('accepts valid template ids', () => {
    assert.equal(parseTemplateId('office-rivalry'), 'office-rivalry');
    assert.equal(parseTemplateId('country-rivalry'), 'country-rivalry');
  });
  it('rejects unknown template ids', () => {
    assert.throws(() => parseTemplateId('nope'), ReelSpecError);
  });
  it('rejects invalid country codes', () => {
    assert.throws(() => parseCountry('XX'), ReelSpecError);
    assert.equal(parseCountry('TR'), 'TR');
  });
  it('rejects invalid fps', () => {
    assert.throws(() => parseFps(24), ReelSpecError);
    assert.equal(parseFps(60), 60);
  });
  it('rejects invalid duration', () => {
    const spec = compileOfficeRivalry({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 1 });
    assert.throws(() => validateReelSpec({ ...spec, durationInSeconds: 0 }), ReelSpecError);
  });
  it('rejects bad seed', () => {
    assert.throws(() => parseSeed(-1), ReelSpecError);
    assert.throws(() => parseSeed(2 ** 32), ReelSpecError);
  });
  it('accepts a compiled office spec', () => {
    const spec = compileOfficeRivalry({ template: 'office-rivalry', home: 'TR', away: 'GR', seed: 42 });
    validateReelSpec(spec);
  });
});
