import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSpec, resolveSpec } from '../src/schema.ts';

test('spec defaults: format=reel, seed=42', () => {
  const spec = resolveSpec({ scene: 'faceoff', home: 'TR', away: 'GR' });
  assert.equal(spec.scene, 'faceoff');
  assert.equal(spec.home, 'TR');
  assert.equal(spec.away, 'GR');
  assert.equal(spec.format, 'reel');
  assert.equal(spec.seed, 42);
  assert.equal(spec.width, 1080);
  assert.equal(spec.height, 1920);
  assert.equal(spec.pixelRatio, 1);
});

test('invalid country codes fail with a useful error', () => {
  assert.throws(() => resolveSpec({ home: 'XX', away: 'GR' }), /Unknown country code: XX/);
  assert.throws(() => resolveSpec({ home: 'TR', away: 'ZZ' }), /Unknown country code: ZZ/);
  assert.throws(() => resolveSpec({ home: 'tr', away: 'GR' }), /Unknown country code: tr/);
});

test('missing countries fail instead of falling back to arbitrary colours', () => {
  assert.throws(() => resolveSpec({ home: undefined, away: 'GR' }), /Unknown country code/);
  assert.throws(() => resolveSpec({ home: 'TR' }), /Unknown country code/);
});

test('unknown scene fails with a useful error', () => {
  assert.throws(() => resolveSpec({ scene: 'goal-party', home: 'TR', away: 'GR' }), /Unknown scene: goal-party/);
});

test('unknown format and bad seeds fail clearly', () => {
  assert.throws(() => resolveSpec({ home: 'TR', away: 'GR', format: 'square' }), /Unknown format: square/);
  assert.throws(() => resolveSpec({ home: 'TR', away: 'GR', seed: -1 }), /Invalid seed/);
  assert.throws(() => resolveSpec({ home: 'TR', away: 'GR', seed: 1.5 }), /Invalid seed/);
  assert.throws(() => resolveSpec({ home: 'TR', away: 'GR', seed: 'abc' }), /Invalid seed/);
});

test('seed 0 and string seeds are accepted deterministically', () => {
  assert.equal(resolveSpec({ home: 'TR', away: 'GR', seed: 0 }).seed, 0);
  assert.equal(resolveSpec({ home: 'TR', away: 'GR', seed: '7' }).seed, 7);
});

test('compiling the same spec twice gives the same resolved description', () => {
  const input = { scene: 'faceoff', home: 'TR', away: 'GR', seed: 42 };
  assert.equal(JSON.stringify(compileSpec(input)), JSON.stringify(compileSpec(input)));
  assert.deepEqual(compileSpec(input), resolveSpec(input));
});
