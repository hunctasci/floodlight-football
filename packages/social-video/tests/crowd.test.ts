import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROWD_GOAL_JUMP,
  CROWD_IDLE_MAX,
  CROWD_MAX_X,
  CROWD_MIN_X,
  CROWD_WAVE_AMPLITUDE,
  crowdFanOffset,
  fanSection,
  hash01,
  waveCenterX,
  waveDirection,
  waveResponse,
  type SocialCrowdState,
} from '../../../apps/game/src/render/crowd.ts';
import { evaluateAttackCrowd } from '../src/scenes/attack-goal.ts';
import { evaluateFaceoffCrowd } from '../src/scenes/faceoff.ts';
import { evaluateAttackGoalFrame } from '../src/scenes/attack-goal.ts';
import { compileVideo, evaluateFrame } from '../src/timeline.ts';
import { compileTemplate } from '../src/templates/compile.ts';
import { evaluateTemplateFrame } from '../src/templates/evaluate.ts';

const idle = (extra: Partial<SocialCrowdState> = {}): SocialCrowdState => ({
  mood: 'idle', intensity: 0.2, time: 1.0, seed: 42, moodTime: 1.0, ...extra,
});

// ---------------------------------------------------------------------------
// Pure helpers: deterministic, bounded, seed-driven
// ---------------------------------------------------------------------------

test('hash01 is deterministic and stays in [0, 1)', () => {
  for (const [n, seed] of [[0, 42], [7, 42], [1234, 7], [99, 0xffffffff]] as const) {
    const a = hash01(n, seed);
    assert.ok(a >= 0 && a < 1, `in range (got ${a})`);
    assert.equal(hash01(n, seed), a, 'same inputs → same value');
  }
  assert.notEqual(hash01(0, 42), hash01(1, 42), 'distinct fans differ');
});

test('wave direction derives from the seed (same seed, same direction)', () => {
  assert.equal(waveDirection(42), waveDirection(42));
  assert.equal(waveDirection(42), 1, 'even seed runs left → right');
  assert.equal(waveDirection(43), -1, 'odd seed runs right → left');
});

test('wave centre travels across the stand and wraps deterministically', () => {
  const a = waveCenterX(0, 42);
  const b = waveCenterX(1.0, 42);
  assert.ok(b > a, `left → right progresses (${a.toFixed(1)} → ${b.toFixed(1)})`);
  const ra = waveCenterX(0, 43);
  const rb = waveCenterX(1.0, 43);
  assert.ok(rb < ra, 'odd seed travels right → left');
  assert.equal(waveCenterX(0.5, 42), waveCenterX(0.5, 42), 'random-access stable');
  for (const t of [0, 0.7, 2.0, 5.0]) {
    const c = waveCenterX(t, 42);
    assert.ok(c >= CROWD_MIN_X - 11 && c <= CROWD_MAX_X + 11, `centre near the stand at t=${t} (got ${c})`);
  }
});

test('wave response peaks at the centre and decays', () => {
  assert.equal(waveResponse(10, 10), 1, 'peak is exactly 1');
  assert.ok(waveResponse(20, 10) < 0.4, 'one sigma out is small');
  assert.ok(waveResponse(45, 10) < 0.02, 'far fans stay seated');
  assert.ok(waveResponse(-40, 10) >= 0, 'bounded below');
});

// ---------------------------------------------------------------------------
// Per-fan offsets: amplitude budgets per mood
// ---------------------------------------------------------------------------

test('idle motion is subtle and bounded', () => {
  for (const index of [0, 1, 17, 300, 629]) {
    const o = crowdFanOffset({ x: -20 + index * 0.1, row: index % 8, index }, idle({ time: index * 0.37 }));
    assert.ok(Math.abs(o.dy) <= CROWD_IDLE_MAX, `idle |dy| small (got ${o.dy})`);
    assert.equal(o.dz, 0);
    assert.equal(o.sy, 1);
  }
});

test('anticipation rises clearly above idle', () => {
  const fan = { x: 5, row: 3, index: 100 };
  const up = crowdFanOffset(fan, { mood: 'anticipation', intensity: 1, time: 3.4, seed: 42, moodTime: 0.4 });
  assert.ok(up.dy > 0.3, `supporters stand (${up.dy})`);
  assert.ok(up.dz > 0, 'lean toward the pitch');
  assert.ok(up.sy > 1, 'slight stretch');
});

test('goal eruption: scoring section jumps, conceding section does not', () => {
  const scoring: SocialCrowdState = { mood: 'goal', intensity: 1, time: 4.0, seed: 42, scoringTeam: 0, moodTime: 0.35 };
  const jump = crowdFanOffset({ x: -20, row: 2, index: 50 }, scoring);
  assert.ok(jump.dy > CROWD_GOAL_JUMP * 0.5, `scoring side erupts (${jump.dy})`);
  const grief = crowdFanOffset({ x: 20, row: 2, index: 51 }, scoring);
  assert.ok(grief.dy < 0.05, `conceding side never jumps (got ${grief.dy})`);
  assert.ok(grief.dy < 0, 'conceding side drops');
  // Mirrored matchup: away scoring flips the sections.
  const awayScores: SocialCrowdState = { ...scoring, scoringTeam: 1 };
  assert.ok(crowdFanOffset({ x: 20, row: 2, index: 51 }, awayScores).dy > 0.5, 'away section erupts');
  assert.ok(crowdFanOffset({ x: -20, row: 2, index: 50 }, awayScores).dy < 0, 'home section drops');
});

test('goal rows cascade deterministically (staggered eruption)', () => {
  const state: SocialCrowdState = { mood: 'goal', intensity: 1, time: 4.0, seed: 42, scoringTeam: 0, moodTime: 0.2 };
  const r0 = crowdFanOffset({ x: -20, row: 0, index: 10 }, state);
  const r2 = crowdFanOffset({ x: -20, row: 2, index: 12 }, state);
  assert.notEqual(r0.dy.toFixed(4), r2.dy.toFixed(4), 'rows respond at different phases');
  assert.equal(crowdFanOffset({ x: -20, row: 0, index: 10 }, state).dy, r0.dy, 'same inputs → same bounce');
});

test('offset evaluation is random-access and pure', () => {
  const fan = { x: -33.75, row: 5, index: 400 };
  const state: SocialCrowdState = { mood: 'wave', intensity: 1, time: 1.6, seed: 7, moodTime: 0.8 };
  const direct = crowdFanOffset(fan, state);
  for (const other of [0, 3, 7]) crowdFanOffset({ x: other, row: 0, index: other }, idle());
  assert.deepEqual(crowdFanOffset(fan, state), direct);
});

test('fan sections split the stand into home (left) and away (right)', () => {
  assert.equal(fanSection(-49), 0);
  assert.equal(fanSection(-0.01), 0);
  assert.equal(fanSection(0), 1);
  assert.equal(fanSection(49), 1);
});

// ---------------------------------------------------------------------------
// Scene choreography: WHEN/WHY owned by scene code
// ---------------------------------------------------------------------------

test('faceoff crowd: quiet establishment, then a Mexican wave', () => {
  assert.equal(evaluateFaceoffCrowd(0.2, 42).mood, 'idle');
  assert.equal(evaluateFaceoffCrowd(0.79, 42).mood, 'idle');
  const wave = evaluateFaceoffCrowd(1.6, 42);
  assert.equal(wave.mood, 'wave');
  assert.equal(wave.intensity, 1);
  assert.equal(evaluateFaceoffCrowd(2.39, 42).mood, 'wave', 'wave holds through the intro cut');
});

test('attack crowd: idle → anticipation → eruption → settling celebration', () => {
  assert.equal(evaluateAttackCrowd(1.0, 42, 0).mood, 'idle');
  const early = evaluateAttackCrowd(4.2, 42, 0);
  assert.equal(early.mood, 'anticipation');
  const peak = evaluateAttackCrowd(5.2, 42, 0);
  assert.equal(peak.mood, 'anticipation');
  assert.ok(peak.intensity > early.intensity, 'anticipation builds toward the shot');
  const goal = evaluateAttackCrowd(6.2, 42, 0);
  assert.equal(goal.mood, 'goal');
  assert.equal(goal.scoringTeam, 0, 'home attack erupts the home section');
  assert.equal(evaluateAttackCrowd(6.2, 42, 1).scoringTeam, 1, 'away attack mirrors');
  const late = evaluateAttackCrowd(12.0, 42, 0);
  assert.equal(late.mood, 'goal', 'outro keeps celebrating behind the branding');
  assert.ok(late.intensity < goal.intensity && late.intensity >= 0.4, `celebration settles (${late.intensity})`);
});

test('scene frame descriptions carry crowd state deterministically', () => {
  const compiled = compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 9.5 });
  const a = evaluateFrame(compiled, 180);
  const b = evaluateFrame(compiled, 180);
  assert.deepEqual(a, b);
  if (a.scene !== 'attack-goal') assert.fail('expected attack-goal');
  assert.equal(a.crowd.mood, 'goal', 'frame 180 (6.0s) erupts just after the strike');
  const ante = evaluateFrame(compiled, 160);
  if (ante.scene !== 'attack-goal') assert.fail('expected attack-goal');
  assert.equal(ante.crowd.mood, 'anticipation', 'frame 160 (5.33s) anticipates the strike');
  const goal = evaluateAttackGoalFrame({ data: compiled.attackGoal!, home: 'TR', away: 'GR', seed: 42, frame: 200, fps: 30, duration: 9.5 });
  assert.equal(goal.crowd.mood, 'goal');
});

test('template outro crowd keeps celebrating behind the end card', () => {
  const tpl = compileTemplate({ template: 'country-rivalry-reel', home: 'TR', away: 'GR', seed: 42, fps: 30 });
  const wave = evaluateTemplateFrame(tpl, 48);
  assert.equal(wave.input.crowd?.mood, 'wave', 'faceoff intro waves');
  const danger = evaluateTemplateFrame(tpl, 225);
  assert.equal(danger.input.crowd?.mood, 'anticipation', 'attack danger rises');
  const eruption = evaluateTemplateFrame(tpl, 276);
  assert.equal(eruption.input.crowd?.mood, 'goal', 'goal erupts');
  assert.equal(eruption.input.crowd?.scoringTeam, 0, 'home TR section erupts');
  const outro = evaluateTemplateFrame(tpl, 405);
  assert.equal(outro.input.crowd?.mood, 'goal');
  assert.ok((outro.input.crowd?.intensity ?? 1) < 0.7, 'outro settles but stays alive');
  // Random access: last frame deep-equals after other evaluations.
  const direct = evaluateTemplateFrame(tpl, 464);
  for (const f of [0, 48, 225, 276, 405]) evaluateTemplateFrame(tpl, f);
  assert.deepEqual(evaluateTemplateFrame(tpl, 464), direct);
});

test('wave amplitude is exaggerated enough to read on mobile', () => {
  const peak = crowdFanOffset(
    { x: waveCenterX(0.8, 42, 4), row: 4, index: 200 },
    { mood: 'wave', intensity: 1, time: 1.6, seed: 42, moodTime: 0.8 },
  );
  assert.ok(peak.dy > CROWD_WAVE_AMPLITUDE * 0.9, `wave hump is large (${peak.dy})`);
  assert.ok(peak.dy > 10 * CROWD_IDLE_MAX, 'wave dwarfs idle motion');
});

test('wave rows cascade: front row fires first, back rows lag', () => {
  const state = (moodTime: number): SocialCrowdState => ({ mood: 'wave', intensity: 1, time: 1.6, seed: 42, moodTime });
  // Row 0 peaks at the undelayed centre; row 7 peaks ~140ms later.
  assert.equal(waveCenterX(0.8, 42, 0), waveCenterX(0.8, 42), 'row 0 keeps the legacy centre');
  assert.notEqual(waveCenterX(0.8, 42, 7).toFixed(3), waveCenterX(0.8, 42, 0).toFixed(3), 'back rows lag');
  const front = crowdFanOffset({ x: waveCenterX(0.8, 42, 0), row: 0, index: 200 }, state(0.8));
  const back = crowdFanOffset({ x: waveCenterX(0.8, 42, 0), row: 7, index: 201 }, state(0.8));
  assert.ok(front.dy > back.dy + 0.2, `front row leads (${front.dy.toFixed(2)} vs ${back.dy.toFixed(2)})`);
  assert.equal(crowdFanOffset({ x: 5, row: 3, index: 100 }, state(0.8)).dy,
    crowdFanOffset({ x: 5, row: 3, index: 100 }, state(0.8)).dy, 'random-access stable');
});
