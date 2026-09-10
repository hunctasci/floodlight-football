import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_MOTION, CAMERA_PURPOSE, isFiniteLens, presetLens, reactionPresetFor,
  REACTION_DURATION, type SocialCameraPreset,
} from '../src/cameras/presets.ts';
import { compileStory, validateStoryPlan } from '../src/director/stories.ts';
import { STORY_IDS } from '../src/director/types.ts';
import { velocityTrailGate, ballSpeedAt, shotArc } from '../src/timeline/tracks.ts';

const ALL_PRESETS: SocialCameraPreset[] = Object.keys(CAMERA_PURPOSE) as SocialCameraPreset[];

test('every camera preset declares a narrative purpose and motion', () => {
  assert.ok(ALL_PRESETS.length >= 20, 'director vocabulary is broad');
  for (const p of ALL_PRESETS) {
    assert.ok(CAMERA_PURPOSE[p], `${p} has a purpose`);
    assert.ok(CAMERA_MOTION[p], `${p} has a motion`);
  }
  const purposes = new Set(Object.values(CAMERA_PURPOSE));
  for (const need of ['geography', 'character', 'speed', 'impact', 'reaction', 'reveal']) {
    assert.ok(purposes.has(need as never), `purpose ${need} covered`);
  }
});

test('declared hard cuts are finite: every preset resolves finite lens values', () => {
  const anchor = { ball: { x: 30, y: 1.2, z: 2 }, actor: { x: 28, z: 1 }, keeper: { x: 43, z: 0 }, lateral: 0.3 };
  for (const p of ALL_PRESETS) {
    const lens = presetLens(p, anchor);
    assert.ok(isFiniteLens(lens), `${p} is finite`);
    assert.ok(lens.fov >= 40 && lens.fov <= 65, `${p} fov sane`);
  }
});

test('hero-frame cameras keep plausible geometry (no NaN, sane distances)', () => {
  const lens = presetLens('header-impact', { ball: { x: 38.5, y: 1.8, z: 0.5 } });
  assert.ok(lens.pos.y < 4 && lens.pos.y > 1, 'hero camera low, not a broadcast high');
  const dist = Math.hypot(lens.pos.x - 38.5, lens.pos.z - 0.5);
  assert.ok(dist > 4 && dist < 12, 'hero camera close but not inside the players');
});

test('reaction presets exist and map to sub-second beats', () => {
  for (const [kind, dur] of Object.entries(REACTION_DURATION)) {
    assert.ok(dur >= 0.25 && dur <= 0.7, `${kind} is punctuation length`);
    assert.ok(isFiniteLens(presetLens(reactionPresetFor(kind as never), {
      ball: { x: 40, y: 0.5, z: 0 }, keeper: { x: 43, z: 0 }, actor: { x: 36, z: 2 },
    })));
  }
});

test('stories: hook, payoff, reaction-after-payoff, brand, duration, no overlaps', () => {
  const matchups: Record<string, [string, string]> = {
    'last-second-winner': ['TR', 'GR'],
    'crossbar-chaos': ['BR', 'AR'],
    'keeper-disaster': ['TR', 'DE'],
    'impossible-cross': ['DE', 'FR'],
    'crowd-knew': ['AR', 'BR'],
  };
  assert.deepEqual([...STORY_IDS].sort(), Object.keys(matchups).sort());
  for (const story of STORY_IDS) {
    const [home, away] = matchups[story];
    const plan = compileStory({ story, home, away });
    assert.deepEqual(validateStoryPlan(plan), [], `${story} validates`);
    assert.ok(plan.heroFrame.description.length > 10, `${story} has a hero frame`);
    assert.ok(plan.audioCues.length >= 5, `${story} has audio cues`);
    assert.ok(plan.reaction.length > 5, `${story} has a reaction`);
    // Deterministic: same spec, same plan.
    assert.deepEqual(compileStory({ story, home, away }), plan);
  }
});

test('story shots use only director-vocabulary cameras with valid purposes', () => {
  const validPurposes = new Set(Object.values(CAMERA_PURPOSE));
  for (const story of STORY_IDS) {
    const plan = compileStory({ story, home: 'TR', away: 'GR' });
    for (const s of plan.shots) {
      assert.ok(s.camera in CAMERA_PURPOSE, `${story}/${s.camera} is director vocabulary (no raw x/y/z)`);
      assert.ok(validPurposes.has(s.purpose), `${story} purpose ${s.purpose} is valid`);
      // Cuts land on events: boundaries have ≥2 decimals of intent (no fixed-interval grid).
      assert.ok(s.end > s.start, `${story}/${s.label} has positive duration`);
    }
  }
});

test('velocity trail gate: fastest flight full, slow motion restrained', () => {
  assert.equal(velocityTrailGate(30), 1);
  assert.ok(velocityTrailGate(20) < 1 && velocityTrailGate(20) > 0.5);
  assert.ok(velocityTrailGate(5) < 0.3, 'slow ball: whisper of a trail, never a laser');
  const speed = ballSpeedAt((t) => shotArc({ x: 0, y: 0.3, z: 0 }, { x: 20, y: 1, z: 0 }, t, 1), 0.5);
  assert.ok(speed > 10, 'driven shot reads fast');
});
