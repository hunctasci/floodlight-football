import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTACK_GOAL_BEATS } from '../src/scenes/attack-goal.ts';
import { AUDIO_SAMPLE_RATE, compileAudioPlan } from '../src/audio/compile.ts';
import { encodeWav, renderAudioSamples, renderAudioToWav } from '../src/audio/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const attackGoal = (extra: Record<string, unknown> = {}) =>
  compileAudioPlan({
    scene: 'attack-goal', seed: 42, duration: 6, attackTeam: 'home', attackStyle: 'central', home: 'TR', away: 'GR', ...extra,
  });

const near = (actual: number, expected: number, tol = 0.02): boolean => Math.abs(actual - expected) <= tol;

test('attack-goal audio events anchor to the canonical scene beats', () => {
  const plan = attackGoal();
  const at = (type: string) => plan.events.filter((e) => e.type === type).map((e) => e.time);
  assert.ok(at('ambience').some((t) => t === 0), 'ambience starts at 0');
  assert.ok(at('kick').some((t) => near(t, ATTACK_GOAL_BEATS.pass1Start)), `pass kick at ${ATTACK_GOAL_BEATS.pass1Start}s`);
  assert.ok(at('kick').some((t) => near(t, ATTACK_GOAL_BEATS.carryEnd)), `final-pass kick at ${ATTACK_GOAL_BEATS.carryEnd}s`);
  assert.ok(at('shot').some((t) => near(t, ATTACK_GOAL_BEATS.shotStart)), `shot at ${ATTACK_GOAL_BEATS.shotStart}s`);
  assert.ok(at('goal').some((t) => near(t, ATTACK_GOAL_BEATS.shotEnd)), `goal at ${ATTACK_GOAL_BEATS.shotEnd}s`);
  assert.ok(at('crowd').length >= 1, 'celebration crowd present');
  const kinds = new Set(plan.events.map((e) => e.type));
  assert.ok(kinds.has('ambience') && kinds.has('kick') && kinds.has('shot') && kinds.has('goal') && kinds.has('crowd'));
});

test('faceoff audio stays minimal: ambience plus an identity whistle', () => {
  const plan = compileAudioPlan({
    scene: 'faceoff', seed: 42, duration: 4, attackTeam: 'home', attackStyle: 'central', home: 'TR', away: 'GR',
  });
  const kinds = plan.events.map((e) => e.type).sort();
  assert.deepEqual(kinds, ['ambience', 'whistle']);
});

test('events past the clip duration are dropped (short test renders stay valid)', () => {
  const plan = attackGoal({ duration: 0.5 });
  assert.ok(plan.events.length >= 1, 'ambience survives');
  for (const e of plan.events) assert.ok(e.time < 0.5, `${e.type} at ${e.time}s is inside the clip`);
  assert.ok(!plan.events.some((e) => e.type === 'shot'), 'no shot in a 0.5s clip');
});

test('audio compilation is deterministic', () => {
  assert.deepEqual(attackGoal(), attackGoal());
  assert.deepEqual(
    compileAudioPlan({ scene: 'faceoff', seed: 7, duration: 4, attackTeam: 'home', attackStyle: 'central', home: 'BR', away: 'AR' }),
    compileAudioPlan({ scene: 'faceoff', seed: 7, duration: 4, attackTeam: 'home', attackStyle: 'central', home: 'BR', away: 'AR' }),
  );
});

test('rendered sample count follows duration × sampleRate exactly', () => {
  assert.equal(renderAudioSamples(attackGoal(), 42).length, Math.round(6 * AUDIO_SAMPLE_RATE));
  assert.equal(renderAudioSamples(attackGoal({ duration: 0.5 }), 42).length, Math.round(0.5 * AUDIO_SAMPLE_RATE));
  assert.equal(AUDIO_SAMPLE_RATE, 48000);
});

test('WAV output is byte-identical for the same input (seeded noise, no wall clocks)', () => {
  const a = renderAudioToWav(attackGoal(), 42);
  const b = renderAudioToWav(attackGoal(), 42);
  assert.ok(a.equals(b), 'identical bytes across renders');
  assert.ok(a.length > 1000, 'non-trivial payload');
});

test('WAV is a valid 16-bit mono PCM file of the right length', () => {
  const wav = renderAudioToWav(attackGoal({ duration: 1 }), 42);
  assert.equal(wav.toString('latin1', 0, 4), 'RIFF');
  assert.equal(wav.toString('latin1', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1, 'PCM format');
  assert.equal(wav.readUInt16LE(22), 1, 'mono');
  assert.equal(wav.readUInt32LE(24), 48000, 'sample rate');
  assert.equal(wav.readUInt16LE(34), 16, 'bits per sample');
  assert.equal(wav.length, 44 + Math.round(1 * 48000) * 2);
});

test('rendered mix never clips (conservative normalization)', () => {
  const samples = renderAudioSamples(attackGoal(), 42);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.89 + 1e-6, `peak ${peak.toFixed(3)} within headroom`);
  assert.ok(peak > 0.01, 'mix is not silent');
});

test('audio synthesis uses seeded noise only — no Math.random anywhere', () => {
  for (const file of ['compile.ts', 'render.ts', 'types.ts']) {
    const src = readFileSync(path.join(HERE, '../src/audio', file), 'utf8');
    assert.ok(!src.includes('Math.random'), `${file} has no uncontrolled randomness`);
    assert.ok(!src.includes('Date.now'), `${file} has no wall clocks`);
  }
  assert.ok(encodeWav(new Float32Array([0, 0.5, -0.5]), 48000).length === 44 + 3 * 2);
});
