import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCountry, isValidCountryCode } from '../../../apps/game/src/city-league/countries';
import { countryColors, countryName } from '../src/football/data/countries';
import { compileCountryRivalry } from '../src/reel/compile';
import { validateProductionReel } from '../src/reel/validate';
import { compileShotPlan } from '../src/reel/compile';

describe('country integration', () => {
  it('uses the canonical game country source (no duplicated list)', () => {
    assert.ok(isValidCountryCode('TR'));
    assert.ok(isValidCountryCode('GR'));
    assert.ok(!isValidCountryCode('XX'));
    assert.equal(getCountry('TR')?.name, countryName('TR'));
  });
  it('kit colours match the canonical source', () => {
    assert.equal(countryColors('TR').primary, getCountry('TR')?.colors.primary);
  });
  it('country-rivalry validates clean', () => {
    const spec = compileCountryRivalry({ template: 'country-rivalry', home: 'TR', away: 'GR', seed: 42 });
    const plan = compileShotPlan(spec);
    const errors = validateProductionReel(spec, plan).filter((i) => i.level === 'error');
    assert.deepEqual(errors, []);
  });
});
