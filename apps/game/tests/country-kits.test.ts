import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES } from '../src/city-league/countries.ts';
import { countryTeams } from '../src/city-league/kits.ts';
test('every country has a valid kit; Türkiye and Brazil wear national colors', () => {
  for (const c of COUNTRIES) {
    assert.match(c.colors.primary, /^#[a-f0-9]{6}$/i);
    assert.match(c.colors.secondary, /^#[a-f0-9]{6}$/i);
    assert.equal(countryTeams(c.code, 'BR')[0].short, c.code);
  }
  const [tr,br] = countryTeams('TR','BR');
  assert.equal(tr.color, '#e30a17'); assert.equal(br.color, '#ffdf00');
});
test('similar shirts receive a deterministic away kit', () => {
  const [home,away] = countryTeams('TR','CH');
  assert.notEqual(home.color, away.color);
  assert.deepEqual(countryTeams('TR','CH'), [home,away]);
});
