import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATTACK_GOAL_BEATS } from '../src/scenes/attack-goal.ts';
import { CROSS_HEADER_BEATS } from '../src/scenes/cross-header-goal.ts';
import { CROSSBAR_BEATS } from '../src/scenes/crossbar-chaos.ts';
import { KEEPER_BEATS } from '../src/scenes/keeper-disaster.ts';
import { AUDIO_SAMPLE_RATE, compileAudioPlan, GOAL_ROAR_DELAY } from '../src/audio/compile.ts';
import {
  CROWD_POOL_BY_TYPE, preferredAssetId,
  selectVariantId, VARIANT_POOLS,
} from '../src/audio/library.ts';
import { loadAudioManifest, resolveAssetFile } from '../src/audio/manifest-fs.ts';
import { decodeWav } from '../src/audio/samples.ts';
import { encodeStereoWav, renderStereoMix, stereoPeak } from '../src/audio/mix.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CROWD_DIR = path.join(HERE, '../assets/audio/crowd');

const base = (extra: Record<string, unknown> = {}) => ({
  scene: 'attack-goal' as const, seed: 42, duration: 9.5,
  attackTeam: 'home' as const, attackStyle: 'central' as const,
  home: 'TR', away: 'GR', ...extra,
});

const EXPECTED_CLIPS = [
  'stadium-bed-01.wav', 'stadium-bed-02.wav',
  'anticipation-01.wav', 'anticipation-02.wav',
  'goal-roar-01.wav', 'goal-roar-02.wav', 'goal-roar-03.wav',
  'disappointment-01.wav',
];

// ---------------------------------------------------------------------------
// Deterministic asset selection (same seed+type+index → same file, always)
// ---------------------------------------------------------------------------

test('crowd resolver: same seed+pool+index always picks the same asset', () => {
  for (const pool of ['bed', 'anticipationRise', 'goalRoar', 'disappointment']) {
    for (let i = 0; i < 6; i++) {
      assert.equal(preferredAssetId(42, pool, i), preferredAssetId(42, pool, i));
      assert.equal(preferredAssetId(7, pool, i), preferredAssetId(7, pool, i));
    }
  }
  // Three roar variants actually rotate across occurrences/seeds.
  const roars = new Set(
    [0, 1, 2, 3, 4, 5].flatMap((i) => [42, 7, 99].map((s) => preferredAssetId(s, 'goalRoar', i))),
  );
  assert.ok(roars.size >= 2, `roar variants rotate (got ${[...roars].join(',')})`);
});

test('crowd resolver never yields undefined (uint32 index regression)', () => {
  for (let seed = 0; seed < 300; seed++) {
    for (const pool of Object.keys(VARIANT_POOLS)) {
      const ids = VARIANT_POOLS[pool];
      for (let i = 0; i < 4; i++) {
        const v = selectVariantId(seed, pool, i, ids);
        assert.equal(typeof v, 'string', `seed ${seed} pool ${pool} index ${i}`);
        assert.ok((ids as readonly string[]).includes(v));
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Runtime asset metadata: 48 kHz stereo PCM WAV, bundled on disk
// ---------------------------------------------------------------------------

test('all runtime crowd WAVs exist, decode, and are 48kHz stereo PCM', () => {
  const onDisk = readdirSync(CROWD_DIR).filter((f) => f.endsWith('.wav')).sort();
  assert.deepEqual(onDisk, [...EXPECTED_CLIPS].sort());
  for (const file of EXPECTED_CLIPS) {
    const decoded = decodeWav(readFileSync(path.join(CROWD_DIR, file)));
    assert.equal(decoded.sampleRate, 48000, `${file} sample rate`);
    assert.ok(decoded.channels >= 2, `${file} stereo`);
    assert.equal(decoded.left.length, decoded.right.length, `${file} channel lengths match`);
    assert.ok(decoded.left.length > 48000, `${file} non-trivial length`);
    let peak = 0;
    for (let i = 0; i < decoded.left.length; i += 7) {
      peak = Math.max(peak, Math.abs(decoded.left[i]), Math.abs(decoded.right[i]));
    }
    assert.ok(peak > 0.01, `${file} not silent`);
    assert.ok(peak <= 1.0, `${file} no clipped source`);
  }
});

test('manifest crowd entries are bundled CC0 with source pages', () => {
  const manifest = loadAudioManifest();
  for (const pool of Object.values(CROWD_POOL_BY_TYPE)) {
    for (const id of VARIANT_POOLS[pool]) {
      const asset = manifest.assets.find((a) => a.id === id);
      assert.ok(asset, `manifest lists ${id}`);
      assert.ok(asset.sourcePage.startsWith('https://freesound.org/'), `${id} Freesound page`);
      assert.ok(/CC0/i.test(asset.license), `${id} CC0 licensed`);
      assert.ok(resolveAssetFile(asset) !== null, `${id} bundled on disk`);
    }
  }
});

// ---------------------------------------------------------------------------
// Goal sound design: reaction delay, pre-goal duck, anticipation first
// ---------------------------------------------------------------------------

function goalImpactAndRoar(scene: string, duration: number): { impact: number; roar: number } {
  const plan = compileAudioPlan({ ...base(), scene: scene as 'attack-goal', duration });
  const impacts = plan.events.filter((e) => e.type === 'impact').map((e) => e.time);
  const roars = plan.events.filter((e) => e.type === 'goal').map((e) => e.time);
  assert.ok(roars.length >= 1, `${scene} has a goal roar`);
  // Roar follows its nearest impact (the goal-line crossing).
  let best = { impact: NaN, roar: roars[0] };
  let bestGap = Infinity;
  for (const roar of roars) {
    for (const impact of impacts) {
      const gap = roar - impact;
      if (gap >= 0 && gap < bestGap) best = { impact, roar }, bestGap = gap;
    }
  }
  assert.ok(Number.isFinite(best.impact), `${scene} roar has a preceding impact`);
  return best;
}

test('goal roar starts AFTER the goal impact within 50–130ms (all action scenes)', () => {
  const scenes: Array<[string, number]> = [
    ['attack-goal', 9.5], ['cross-header-goal', 8], ['crossbar-chaos', 9.5], ['keeper-disaster', 10.5],
  ];
  for (const [scene, duration] of scenes) {
    const { impact, roar } = goalImpactAndRoar(scene, duration);
    const gap = roar - impact;
    assert.ok(gap >= 0.05 && gap <= 0.13, `${scene}: roar gap ${Math.round(gap * 1000)}ms`);
  }
  assert.equal(GOAL_ROAR_DELAY, 0.08);
});

test('goal roar carries a real bundled asset id (never bare procedural)', () => {
  for (const [scene, duration] of [['attack-goal', 9.5], ['cross-header-goal', 8], ['crossbar-chaos', 9.5], ['keeper-disaster', 10.5]] as const) {
    const plan = compileAudioPlan({ ...base(), scene, duration });
    for (const e of plan.events.filter((e) => e.type === 'goal')) {
      assert.ok(e.assetId?.startsWith('goal-roar-'), `${scene}: ${e.assetId}`);
      assert.ok(resolveAssetFile(loadAudioManifest().assets.find((a) => a.id === e.assetId)!) !== null);
    }
  }
});

test('anticipation rises BEFORE every major impact', () => {
  const plan = compileAudioPlan(base());
  const shot = plan.events.find((e) => e.type === 'shot')!;
  const ant = plan.events.filter((e) => e.type === 'anticipation');
  assert.ok(ant.length >= 1 && ant.every((a) => a.time < shot.time), 'anticipation precedes the shot');
  assert.ok(ant.some((a) => a.assetId?.startsWith('anticipation-')), 'real anticipation asset assigned');
  const cross = compileAudioPlan({ ...base(), scene: 'cross-header-goal', duration: 8 });
  const header = cross.events.find((e) => e.type === 'header')!;
  assert.ok(cross.events.filter((e) => e.type === 'anticipation').every((a) => a.time < header.time));
});

test('pre-goal duck dips the bed just before the eruption (contrast, not mute)', () => {
  const plan = compileAudioPlan(base());
  const roar = plan.events.find((e) => e.type === 'goal')!;
  const ducks = (plan.ducks ?? []).filter((d) => d.end <= roar.time + 1e-9 && d.end > roar.time - 0.3);
  assert.ok(ducks.some((d) => d.bus === 'ambience' || d.bus === 'crowd'), 'bed dips before the roar');
  for (const d of ducks) assert.ok(d.depthDb <= 10, `duck is subtle (-${d.depthDb}dB)`);
});

test('crossbar chaos: groan follows the clang, second wave builds to the goal', () => {
  const plan = compileAudioPlan({ ...base(), scene: 'crossbar-chaos', duration: 9.5 });
  const bar = CROSSBAR_BEATS.barHit;
  const groan = plan.events.find((e) => e.type === 'disappointment');
  assert.ok(groan, 'disappointment event present');
  assert.ok(groan.time > bar && groan.time < bar + 1.0, 'groan reacts to the bar');
  assert.equal(groan.assetId, 'disappointment-01');
  const secondAnt = plan.events.filter((e) => e.type === 'anticipation' && e.time > 5.0);
  assert.ok(secondAnt.length >= 1, 'second anticipation wave before the volley');
});

test('keeper disaster: save gets a real crowd reaction before the mistake', () => {
  const plan = compileAudioPlan({ ...base(), scene: 'keeper-disaster', duration: 10.5 });
  const saveCheer = plan.events.find((e) => e.type === 'crowd' && e.time > KEEPER_BEATS.saveMoment);
  assert.ok(saveCheer && saveCheer.time < KEEPER_BEATS.saveMoment + 0.5, 'crowd reacts to the save');
  assert.ok(saveCheer.assetId?.startsWith('goal-roar-'), 'save reaction is a real recording');
});

test('eruption leans toward the scoring stand (subtle, never hard-panned)', () => {
  const home = compileAudioPlan(base());
  const away = compileAudioPlan({ ...base(), attackTeam: 'away' });
  for (const e of [...home.events, ...away.events].filter((e) => e.type === 'goal' || e.type === 'crowd')) {
    assert.ok(e.pan !== undefined && Math.abs(e.pan) <= 0.25, `subtle pan (${e.pan})`);
  }
  assert.ok(home.events.find((e) => e.type === 'goal')!.pan! < 0, 'home scores left');
  assert.ok(away.events.find((e) => e.type === 'goal')!.pan! > 0, 'away scores right');
});

// ---------------------------------------------------------------------------
// Determinism: same spec → same assets, gains, pans, bytes
// ---------------------------------------------------------------------------

test('same spec compiles to identical asset choices, gains and pans', () => {
  assert.deepEqual(compileAudioPlan(base()), compileAudioPlan(base()));
  assert.deepEqual(
    compileAudioPlan({ ...base(), scene: 'crossbar-chaos', duration: 9.5, seed: 7 }),
    compileAudioPlan({ ...base(), scene: 'crossbar-chaos', duration: 9.5, seed: 7 }),
  );
});

test('different seeds can choose different crowd variants', () => {
  const variants = new Set(
    [42, 7, 99, 1234].map((s) => compileAudioPlan({ ...base(), seed: s }).events.find((e) => e.type === 'goal')!.assetId),
  );
  assert.ok(variants.size >= 2, `seeds rotate roars (got ${[...variants].join(',')})`);
});

test('stereo mix is byte-identical for the same plan+seed (real crowd, no clocks)', () => {
  const plan = compileAudioPlan(base());
  const a = encodeStereoWav(renderStereoMix(plan, 42));
  const b = encodeStereoWav(renderStereoMix(plan, 42));
  assert.ok(a.equals(b));
});

test('real-crowd mix uses bundled recordings: no fallback warnings', () => {
  for (const [scene, duration] of [['attack-goal', 9.5], ['cross-header-goal', 8], ['crossbar-chaos', 9.5], ['keeper-disaster', 10.5], ['faceoff', 4]] as const) {
    const plan = compileAudioPlan({ ...base(), scene, duration });
    const mix = renderStereoMix(plan, 42);
    assert.deepEqual(mix.warnings ?? [], [], `${scene} renders fully real`);
  }
});

// ---------------------------------------------------------------------------
// Mix properties: stereo, duration-exact, no clipping, finite
// ---------------------------------------------------------------------------

test('final mix is stereo 48kHz with exact duration × rate frames', () => {
  for (const duration of [4, 8, 9.5, 10.5, 15.5, 17.6]) {
    const plan = compileAudioPlan({ ...base(), duration });
    const mix = renderStereoMix(plan, 42);
    assert.equal(mix.sampleRate, 48000);
    assert.equal(mix.left.length, Math.round(duration * AUDIO_SAMPLE_RATE));
    assert.equal(mix.right.length, mix.left.length);
  }
});

test('real-crowd mix never clips and stays finite (beds loop, roars stack)', () => {
  for (const [scene, duration] of [['attack-goal', 9.5], ['crossbar-chaos', 9.5], ['keeper-disaster', 10.5]] as const) {
    const plan = compileAudioPlan({ ...base(), scene, duration });
    const mix = renderStereoMix(plan, 42);
    const peak = stereoPeak(mix);
    assert.ok(peak <= 0.89 + 1e-6, `${scene} peak ${peak.toFixed(3)} within headroom`);
    assert.ok(peak > 0.05, `${scene} mix is alive (peak ${peak.toFixed(3)})`);
    for (let i = 0; i < mix.left.length; i += 131) {
      assert.ok(Number.isFinite(mix.left[i]) && Number.isFinite(mix.right[i]), `${scene} finite @${i}`);
    }
  }
});

test('bed loops past its 15s asset without a seam click (17.6s trailer bed)', () => {
  const plan = compileAudioPlan({ ...base(), scene: 'faceoff', duration: 17.6 });
  const mix = renderStereoMix(plan, 42);
  // Max sample-to-sample jump anywhere (including the ~15s loop joint) stays
  // at natural crowd levels — no hard-cut transient.
  let jump = 0;
  for (let i = 1; i < mix.left.length; i += 1) {
    jump = Math.max(jump, Math.abs(mix.left[i] - mix.left[i - 1]));
  }
  assert.ok(jump < 0.2, `loop joint click-free (max jump ${jump.toFixed(3)})`);
});

// ---------------------------------------------------------------------------
// Procedural fallback: explicit warning, never silent; A/B mode differs
// ---------------------------------------------------------------------------

test('missing crowd file falls back procedurally with an explicit warning', () => {
  const plan = compileAudioPlan(base());
  const broken = {
    ...plan,
    events: plan.events.map((e, i) => (i === 0 ? { ...e, assetId: 'no-such-crowd-asset' } : e)),
  };
  const mix = renderStereoMix(broken, 42);
  assert.ok((mix.warnings ?? []).length >= 1, 'fallback is reported');
  assert.ok((mix.warnings ?? []).some((w) => w.includes('no-such-crowd-asset')), 'names the asset');
  assert.ok(mix.left.length === Math.round(9.5 * 48000), 'fallback still renders full length');
});

test('procedural crowd mode renders the legacy synth (A/B comparison path)', () => {
  const plan = compileAudioPlan(base());
  const real = encodeStereoWav(renderStereoMix(plan, 42, { crowdMode: 'real' }));
  const synth = encodeStereoWav(renderStereoMix(plan, 42, { crowdMode: 'procedural' }));
  assert.ok(!real.equals(synth), 'real vs procedural differ audibly');
  const again = encodeStereoWav(renderStereoMix(plan, 42, { crowdMode: 'procedural' }));
  assert.ok(synth.equals(again), 'procedural path stays deterministic');
});

// ---------------------------------------------------------------------------
// Hygiene: no uncontrolled randomness in the new audio path
// ---------------------------------------------------------------------------

test('crowd audio path uses seeded determinism only', () => {
  for (const file of ['compile.ts', 'mix.ts', 'library.ts', 'samples.ts', 'types.ts']) {
    const src = readFileSync(path.join(HERE, '../src/audio', file), 'utf8');
    assert.ok(!src.includes('Math.random'), `${file} has no uncontrolled randomness`);
    assert.ok(!src.includes('Date.now'), `${file} has no wall clocks`);
  }
});

test('unused scene-beat imports stay honest (guard against beat drift)', () => {
  assert.equal(typeof ATTACK_GOAL_BEATS.shotEnd, 'number');
  assert.equal(typeof CROSS_HEADER_BEATS.headerEnd, 'number');
  assert.equal(typeof CROSSBAR_BEATS.barHit, 'number');
  assert.equal(typeof KEEPER_BEATS.instantShotEnd, 'number');
});
