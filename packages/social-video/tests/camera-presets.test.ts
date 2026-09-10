import test from 'node:test';
import assert from 'node:assert/strict';
import { presetLens, isFiniteLens, assertShotTable, type SocialCameraPreset } from '../src/cameras/presets.ts';
import { insideFrame, projectToNdc, REEL_ASPECT } from '../src/cameras/project.ts';
import { CROSS_HEADER_SHOTS } from '../src/scenes/cross-header-goal.ts';
import { CROSSBAR_SHOTS } from '../src/scenes/crossbar-chaos.ts';
import { KEEPER_SHOTS } from '../src/scenes/keeper-disaster.ts';
import { ATTACK_SHOTS } from '../src/scenes/attack-goal.ts';

/**
 * Camera math guards for the readable broadcast vocabulary. These prove what
 * the lens actually SHOWS in the 9:16 viewport: the ball inside the useful
 * frame, the goal inside the frame during final-third attacks, finite
 * positions/targets and bounded FOVs. Deliberately not exact-pixel tests —
 * margins reflect "readable composition", not golden pixels.
 */

const GOAL = { x: 46, y: 2.44, z: 0 };

interface Anchor {
  name: string;
  ball: { x: number; y: number; z: number };
  /** Whether the goal is expected inside the frame at this anchor. */
  goalInView: boolean;
}

const ANCHORS: Anchor[] = [
  { name: 'midfield', ball: { x: 20, y: 0.3, z: 5 }, goalInView: false },
  { name: 'final-third', ball: { x: 38, y: 0.6, z: 2 }, goalInView: true },
  { name: 'goal-mouth', ball: { x: 43.5, y: 1.5, z: 1.5 }, goalInView: true },
];

/** Readable broadcast/geography vocabulary introduced for social pacing. */
const READABLE_PRESETS: SocialCameraPreset[] = [
  'broadcast-wide',
  'broadcast-medium',
  'high-sideline',
  'far-touchline',
  'wide-goal',
  'cross-follow',
  'ball-follow',
];

/**
 * Anchors where each preset is MEANT to be used. wide-goal is a goal-area
 * camera (header setups, rebounds, keeper errors) — it is never pointed at
 * midfield play, so midfield ball-in-frame is not a requirement for it.
 */
const PRESET_ANCHORS: Partial<Record<SocialCameraPreset, Anchor[]>> = {
  'broadcast-wide': ANCHORS,
  'broadcast-medium': ANCHORS,
  'high-sideline': ANCHORS,
  'far-touchline': ANCHORS,
  'wide-goal': ANCHORS.filter((a) => a.name !== 'midfield'),
  'cross-follow': ANCHORS,
  'ball-follow': ANCHORS,
};

for (const preset of READABLE_PRESETS) {
  test(`${preset}: finite lens, bounded FOV, sane position`, () => {
    for (const anchor of ANCHORS) {
      const lens = presetLens(preset, { ball: anchor.ball, goalX: 46, lateral: 0 });
      assert.ok(isFiniteLens(lens), `${preset}@${anchor.name} finite`);
      assert.ok(lens.fov >= 40 && lens.fov <= 65, `${preset}@${anchor.name} fov ${lens.fov} bounded`);
      assert.ok(lens.pos.y > 0.5 && lens.pos.y < 40, `${preset}@${anchor.name} height sane`);
      assert.ok(Math.abs(lens.pos.x) < 75 && Math.abs(lens.pos.z) < 50, `${preset}@${anchor.name} inside stadium`);
    }
  });

  test(`${preset}: ball stays inside the useful 9:16 frame`, () => {
    for (const anchor of PRESET_ANCHORS[preset] ?? ANCHORS) {
      const lens = presetLens(preset, { ball: anchor.ball, goalX: 46, lateral: 0 });
      const ndc = projectToNdc(lens, anchor.ball, REEL_ASPECT);
      assert.ok(insideFrame(ndc, 0.95), `${preset}@${anchor.name} ball ndc (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`);
    }
  });

  test(`${preset}: goal visible during final-third attacks`, () => {
    for (const anchor of ANCHORS) {
      const lens = presetLens(preset, { ball: anchor.ball, goalX: 46, lateral: 0 });
      const ndc = projectToNdc(lens, GOAL, REEL_ASPECT);
      if (anchor.goalInView) {
        assert.ok(insideFrame(ndc, 1.0), `${preset}@${anchor.name} goal ndc (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`);
      }
    }
  });
}

test('seed lateral offsets never push the ball out of the frame', () => {
  for (const preset of READABLE_PRESETS) {
    for (const lateral of [-0.5, -0.2, 0, 0.2, 0.5]) {
      const anchor = ANCHORS[1];
      const lens = presetLens(preset, { ball: anchor.ball, goalX: 46, lateral });
      const ndc = projectToNdc(lens, anchor.ball, REEL_ASPECT);
      assert.ok(insideFrame(ndc, 0.98), `${preset} lateral ${lateral} keeps ball in frame`);
    }
  }
});

test('wide-goal keeps the whole box readable through a rebound path', () => {
  // The crossbar rebound: bar → apex → fall → land. Ball, bar and goal must
  // all stay inside one held composition (the comedy readability test).
  const path = [
    { x: 45.8, y: 2.8, z: 1.0 },
    { x: 44.2, y: 5.4, z: 0.9 },
    { x: 42.6, y: 7.4, z: 0.85 },
    { x: 41.0, y: 3.2, z: 0.8 },
    { x: 40.0, y: 0.6, z: 0.8 },
  ];
  for (const ball of path) {
    const lens = presetLens('wide-goal', { ball, goalX: 46, lateral: 0 });
    assert.ok(insideFrame(projectToNdc(lens, ball, REEL_ASPECT), 0.95), `ball at y=${ball.y} in frame`);
    assert.ok(insideFrame(projectToNdc(lens, GOAL, REEL_ASPECT), 1.0), `goal in frame at y=${ball.y}`);
    assert.ok(insideFrame(projectToNdc(lens, { x: 45.8, y: 2.8, z: 1.0 }, REEL_ASPECT), 1.0), `bar in frame at y=${ball.y}`);
  }
});

test('shot tables validate: tiled, positive, non-empty', () => {
  for (const table of [CROSS_HEADER_SHOTS, CROSSBAR_SHOTS, KEEPER_SHOTS, ATTACK_SHOTS]) {
    assertShotTable(table);
  }
});
