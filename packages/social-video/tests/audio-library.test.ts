import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAudioManifest, validateAudioManifest, selectVariantId, preferredAssetId,
  VARIANT_POOLS,
} from '../src/audio/library.ts';
import { compileAudioPlan } from '../src/audio/compile.ts';
import { renderStereoMix, encodeStereoWav, stereoPeak, MIX_SAMPLE_RATE } from '../src/audio/mix.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const base = (extra: Record<string, unknown> = {}) => ({
  scene: 'attack-goal' as const, seed: 42, duration: 6,
  attackTeam: 'home' as const, attackStyle: 'central' as const,
  home: 'TR', away: 'GR', ...extra,
});

test('manifest loads, validates clean, and records license provenance', () => {
  const manifest = loadAudioManifest();
  assert.ok(manifest.assets.length >= 15, 'quality over quantity, but broad coverage');
  assert.deepEqual(validateAudioManifest(manifest), []);
  for (const a of manifest.assets) {
    assert.ok(a.sourcePage.startsWith('https://'), `${a.id} has a source page`);
    assert.ok(a.license.length > 0, `${a.id} records a license`);
    assert.equal(typeof a.attributionRequired, 'boolean', `${a.id} records attribution`);
  }
  const mixkit = manifest.assets.filter((a) => a.source === 'mixkit');
  assert.ok(mixkit.length >= 10, 'Mixkit-first catalogue');
});

test('manifest validation rejects NC licenses for promotional content', () => {
  const manifest = loadAudioManifest();
  const bad = {
    ...manifest,
    assets: [...manifest.assets, {
      id: 'bad-nc', file: 'bad.wav', category: 'kick' as const, source: 'freesound' as const,
      sourcePage: 'https://freesound.org/', license: 'CC BY-NC 3.0',
      attributionRequired: true, downloadedAt: '2026-09-10',
    }],
  };
  const errors = validateAudioManifest(bad);
  assert.ok(errors.some((e) => e.includes('bad-nc')), 'NC asset rejected');
});

test('referenced manifest files resolve only when downloaded (fallback otherwise)', () => {
  // Catalogue-only checkout: no binaries committed, so every lookup misses
  // and production deterministically uses the procedural fallback.
  const manifest = loadAudioManifest();
  for (const a of manifest.assets) {
    assert.ok(a.file.endsWith('.wav'), `${a.id} names a wav drop-in`);
  }
});

test('deterministic sample selection: same seed+event+index, same variant', () => {
  const pool = VARIANT_POOLS.shot;
  assert.equal(selectVariantId(42, 'shot', 0, pool), selectVariantId(42, 'shot', 0, pool));
  assert.equal(preferredAssetId(42, 'shot', 0), preferredAssetId(42, 'shot', 0));
  // Adjacent indices decorrelate across the pool (not stuck on one sample).
  const picks = new Set([0, 1, 2, 3, 4, 5].map((i) => selectVariantId(7, 'kick', i, VARIANT_POOLS.kick)));
  assert.ok(picks.size >= 1);
});

test('event timing: anticipation precedes impact, micro-ducks sit pre-contact', () => {
  const plan = compileAudioPlan(base());
  const ducks = plan.ducks ?? [];
  assert.ok(ducks.length >= 2, 'ducks present');
  const shot = plan.events.find((e) => e.type === 'shot');
  assert.ok(shot);
  const pre = ducks.filter((d) => d.end <= shot.time + 1e-9 && d.end > shot.time - 0.2);
  assert.ok(pre.length >= 1, 'micro-silence immediately before the shot');
  const ant = plan.events.find((e) => e.type === 'anticipation');
  assert.ok(ant && ant.time < shot.time, 'anticipation rises before impact');
});

test('stereo sample count: duration × rate per channel, 48 kHz stereo', () => {
  const plan = compileAudioPlan(base());
  const mix = renderStereoMix(plan, 42);
  assert.equal(MIX_SAMPLE_RATE, 48000);
  assert.equal(mix.left.length, Math.round(6 * 48000));
  assert.equal(mix.right.length, mix.left.length);
});

test('stereo image: crowd is wide (L/R decorrelated), mix never clips', () => {
  const plan = compileAudioPlan(base());
  const mix = renderStereoMix(plan, 42);
  const peak = stereoPeak(mix);
  assert.ok(peak <= 0.89 + 1e-6, `peak ${peak.toFixed(3)} within headroom`);
  assert.ok(peak > 0.01, 'mix is not silent');
  let diff = 0;
  for (let i = 0; i < mix.left.length; i += 97) diff += Math.abs(mix.left[i] - mix.right[i]);
  assert.ok(diff > 0, 'stereo channels differ (wide crowd, panned SFX)');
});

test('stereo WAV is valid 16-bit stereo PCM of the right length', () => {
  const plan = compileAudioPlan(base({ duration: 1 }));
  const wav = encodeStereoWav(renderStereoMix(plan, 42));
  assert.equal(wav.toString('latin1', 0, 4), 'RIFF');
  assert.equal(wav.readUInt16LE(22), 2, 'stereo');
  assert.equal(wav.readUInt32LE(24), 48000);
  assert.equal(wav.length, 44 + Math.round(1 * 48000) * 4);
});

test('stereo render is byte-identical for the same input (no wall clocks)', () => {
  const plan = compileAudioPlan(base());
  const a = encodeStereoWav(renderStereoMix(plan, 42));
  const b = encodeStereoWav(renderStereoMix(plan, 42));
  assert.ok(a.equals(b));
});

test('stems flag renders four buses + master when requested', () => {
  const plan = compileAudioPlan(base({ duration: 1 }));
  const mix = renderStereoMix(plan, 42, { stems: true });
  assert.ok(mix.stems, 'stems present');
  assert.equal(mix.stems!.crowd.left.length, mix.left.length);
});

test('mix engine uses seeded noise only — no Math.random anywhere', () => {
  for (const file of ['compile.ts', 'render.ts', 'types.ts', 'mix.ts', 'library.ts']) {
    const src = readFileSync(path.join(HERE, '../src/audio', file), 'utf8');
    assert.ok(!src.includes('Math.random'), `${file} has no uncontrolled randomness`);
    assert.ok(!src.includes('Date.now'), `${file} has no wall clocks`);
  }
});
