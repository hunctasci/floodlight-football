import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROWD_HALF_HEIGHT,
  END_STAND_ROWS,
  FAR_STAND_BASE_TOP,
  FAR_STAND_RISE,
  FAR_STAND_ROWS,
  endStandFanY,
  endStandTerraceTop,
  farStandFanY,
  farStandFanZ,
  farStandTerraceTop,
  isStandAisle,
} from '../../../apps/game/src/renderer.ts';
import {
  CROWD_WAVE_AMPLITUDE,
  crowdFanOffset,
  type SocialCrowdState,
} from '../../../apps/game/src/render/crowd.ts';

// ---------------------------------------------------------------------------
// Visible tribune shape: stepped terraces, low fascia, fans ON the concrete.
// ---------------------------------------------------------------------------

test('far stand has a stepped terrace profile with real depth', () => {
  assert.ok(FAR_STAND_ROWS >= 4 && FAR_STAND_ROWS <= 8, `4-8 terrace rows (got ${FAR_STAND_ROWS})`);
  for (let r = 0; r < FAR_STAND_ROWS - 1; r++) {
    assert.ok(farStandTerraceTop(r + 1) > farStandTerraceTop(r), `row ${r + 1} rises above row ${r}`);
    assert.ok(farStandFanZ(r + 1) < farStandFanZ(r), `row ${r + 1} sits deeper than row ${r}`);
  }
  const depth = farStandFanZ(0) - farStandFanZ(FAR_STAND_ROWS - 1);
  assert.ok(depth > 4, `terraces have visible depth (${depth.toFixed(1)}m)`);
});

test('front fascia stays small (never a giant wall)', () => {
  // The fascia top must sit at or below the first terrace top: ~1.1-1.5m
  // visual height, so several rows of supporters stay visible above it.
  assert.ok(FAR_STAND_BASE_TOP <= 1.5, `first terrace top is low (${FAR_STAND_BASE_TOP}m)`);
  assert.ok(FAR_STAND_BASE_TOP >= 0.8, `stand does not float (${FAR_STAND_BASE_TOP}m)`);
});

test('supporter base positions sit above the visible terrace surface', () => {
  for (let r = 0; r < FAR_STAND_ROWS; r++) {
    const clearance = farStandFanY(r) - farStandTerraceTop(r);
    assert.ok(Math.abs(clearance - CROWD_HALF_HEIGHT) < 1e-9,
      `row ${r}: fan base rests on the step (clearance ${clearance.toFixed(2)}m)`);
    assert.ok(clearance > 0, `row ${r}: never embedded in concrete`);
  }
  for (let r = 0; r < END_STAND_ROWS; r++) {
    assert.ok(endStandFanY(r) - endStandTerraceTop(r) > 0, `end row ${r} above concrete`);
  }
});

test('stand aisles split sections without swallowing the crowd', () => {
  assert.ok(isStandAisle(0), 'centre aisle marks the home/away section split');
  assert.ok(!isStandAisle(10), 'regular seats are not aisles');
  assert.ok(!isStandAisle(-10), 'regular seats are not aisles');
  assert.ok(isStandAisle(26) && isStandAisle(-26), 'side aisles exist');
});

test('terrace rise is climbable and readable (no towering steps)', () => {
  assert.ok(FAR_STAND_RISE >= 0.4 && FAR_STAND_RISE <= 0.8, `rise ${FAR_STAND_RISE}m`);
});

// ---------------------------------------------------------------------------
// Crowd transforms: finite, bounded, deterministic.
// ---------------------------------------------------------------------------

const moods: SocialCrowdState['mood'][] = ['idle', 'anticipation', 'wave', 'goal', 'disbelief'];

test('crowd transforms stay finite across moods, rows and sections', () => {
  for (const mood of moods) {
    for (const row of [0, 3, 7]) {
      for (const x of [-40, -0.5, 0.5, 40]) {
        for (const scoringTeam of [0, 1, undefined] as const) {
          const o = crowdFanOffset(
            { x, row, index: Math.abs(Math.round(x * 7 + row * 131)) },
            { mood, intensity: 1, time: 2.5, seed: 42, scoringTeam, moodTime: 0.6 },
          );
          assert.ok(Number.isFinite(o.dy) && Number.isFinite(o.dz) && Number.isFinite(o.sy),
            `${mood} row ${row} x ${x} is finite`);
        }
      }
    }
  }
});

test('wave displacement stays bounded (exaggerated but never absurd)', () => {
  for (let i = 0; i < 200; i++) {
    const o = crowdFanOffset(
      { x: -49 + (i * 0.49), row: i % 8, index: i },
      { mood: 'wave', intensity: 1, time: i * 0.13, seed: 42, moodTime: i * 0.05 },
    );
    assert.ok(o.dy <= CROWD_WAVE_AMPLITUDE + 0.1, `wave bounded (got ${o.dy})`);
    assert.ok(o.dy >= -0.1, `wave never inverts (got ${o.dy})`);
  }
});
