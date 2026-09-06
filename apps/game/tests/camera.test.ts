import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA_MODES, celebrationMove, computeCamera, easeInOut, followFocus, goalCineShot, goalCineVariant, menuOrbitPos, scorerTeam, type CameraMode, type GoalCineVariant } from '../src/renderer.ts';
import { FIELD } from '../src/types.ts';

const ASPECTS = [0.5, 0.75, 1.33, 1.78, 2.4];
// Folding phones, square windows, ultrawide monitors.
const EXTREME_ASPECTS = [0.4, 0.6, 3.0, 4.0];
// Goal mouths, corners, and touchlines — where framing used to break.
const EDGE_SPOTS: Array<[number, number]> = [
  [46, 0], [-46, 0], [46, 4.4], [-46, -4.4],
  [46, 29], [-46, 29], [46, -29], [-46, -29],
  [40, 25], [-40, -25], [0, 29], [0, -29], [30, 10], [0, 0],
];
const SPOTS: Array<[number, number]> = [[0, 0], [40, 25], [-40, -25], [46, 29], [-46, -29], [0, 29], [20, -29]];

function ndc(mode: CameraMode, aspect: number, focusX: number, focusZ: number, x: number, z: number) {
  const f = computeCamera(mode, aspect, focusX, focusZ);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const cam = new THREE.PerspectiveCamera(f.fov, safeAspect, 0.1, 500);
  cam.position.copy(f.pos); cam.lookAt(f.look); cam.updateMatrixWorld();
  return new THREE.Vector3(x, 0.5, z).project(cam);
}

test('three camera modes exist in broadcast-first order', () => {
  assert.deepEqual(CAMERA_MODES, ['broadcast', 'tactic', 'close']);
});

test('portrait windows pull the lens back vs landscape', () => {
  for (const mode of CAMERA_MODES) {
    const portrait = computeCamera(mode, 0.5, 0, 0).pos;
    const wide = computeCamera(mode, 1.78, 0, 0).pos;
    assert.ok(portrait.y > wide.y && portrait.z > wide.z, `${mode} zooms out in portrait`);
  }
});

for (const mode of CAMERA_MODES) {
  test(`${mode}: ball stays on screen and clear of the bottom HUD strip`, () => {
    for (const aspect of ASPECTS) for (const [bx, bz] of SPOTS) {
      // Worst case: follow focus sits right on the ball near a line.
      const p = ndc(mode, aspect, bx, bz, bx, bz);
      assert.ok(Math.abs(p.x) < 0.9, `${mode} a=${aspect} ball=(${bx},${bz}) x=${p.x.toFixed(2)}`);
      assert.ok(p.y > -0.55 && p.y < 0.95, `${mode} a=${aspect} ball=(${bx},${bz}) y=${p.y.toFixed(2)} (strip zone)`);
    }
  });

  test(`${mode}: near touchline stays inside the frame at the ball`, () => {
    // Only meaningful when play is actually near that line: no follow-cam is
    // expected to show the far touchline from the centre circle.
    const nearLine = SPOTS.filter(([, bz]) => Math.abs(bz) > 18);
    assert.ok(nearLine.length > 0);
    for (const aspect of ASPECTS) for (const [bx, bz] of nearLine) {
      const lineZ = Math.sign(bz || 1) * 29;
      const p = ndc(mode, aspect, bx, bz, bx, lineZ);
      assert.ok(Math.abs(p.x) <= 1 && p.y >= -1 && p.y <= 1,
        `${mode} a=${aspect} touchline under ball=(${bx},${bz}) -> (${p.x.toFixed(2)},${p.y.toFixed(2)})`);
    }
  });

  test(`${mode}: extreme screens keep goal mouths and corners framed`, () => {
    for (const aspect of EXTREME_ASPECTS) for (const [bx, bz] of EDGE_SPOTS) {
      const f = followFocus(bx, bz, bx, bz);
      const p = ndc(mode, aspect, f.x, f.z, bx, bz);
      assert.ok(Math.abs(p.x) < 0.95, `${mode} a=${aspect} edge=(${bx},${bz}) x=${p.x.toFixed(2)}`);
      assert.ok(p.y > -0.6 && p.y < 1, `${mode} a=${aspect} edge=(${bx},${bz}) y=${p.y.toFixed(2)}`);
    }
  });

  test(`${mode}: lens stays above the pitch with a sane fov`, () => {
    for (const aspect of [...ASPECTS, ...EXTREME_ASPECTS]) {
      const f = computeCamera(mode, aspect, 0, 0);
      assert.ok(f.pos.y > 10, `${mode} a=${aspect} height=${f.pos.y.toFixed(1)}`);
      assert.ok(f.fov >= 30 && f.fov <= 60, `${mode} fov=${f.fov}`);
      assert.equal(f.look.z, 2.5, 'look bias clears the bottom HUD strip');
    }
  });
}

test('invalid aspects fall back to 16:9 instead of producing NaN frames', () => {
  for (const mode of CAMERA_MODES) for (const bad of [0, -2, NaN, Infinity]) {
    const f = computeCamera(mode, bad, 0, 0);
    const ref = computeCamera(mode, 16 / 9, 0, 0);
    for (const v of [f.pos.x, f.pos.y, f.pos.z, f.look.x, f.look.z]) assert.ok(Number.isFinite(v));
    assert.ok(f.pos.equals(ref.pos) && f.look.equals(ref.look), `${mode} aspect=${bad} falls back`);
  }
});

test('fit has no jump at the portrait/wide thresholds', () => {
  for (const mode of CAMERA_MODES) {
    for (const edge of [1.32, 2.2]) {
      const a = computeCamera(mode, edge - 0.01, 0, 0).pos;
      const b = computeCamera(mode, edge + 0.01, 0, 0).pos;
      assert.ok(a.distanceTo(b) < 2, `${mode} edge=${edge} jump=${a.distanceTo(b).toFixed(3)}m`);
    }
  }
});

test('followFocus clamps the lens inside the stadium', () => {
  assert.deepEqual(followFocus(0, 0, 0, 0), { x: 0, z: 0 });
  const corner = followFocus(46, 29, 46, 29);
  assert.ok(corner.x <= 36 && corner.z <= 22, `corner clamps to (${corner.x},${corner.z})`);
  const far = followFocus(-100, -100, -100, -100);
  assert.deepEqual(far, { x: -36, z: -22 });
});

test('easeInOut spans 0..1 monotonically', () => {
  assert.equal(easeInOut(0), 0); assert.equal(easeInOut(1), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-9);
  assert.equal(easeInOut(-3), 0); assert.equal(easeInOut(7), 1);
  let prev = -Infinity;
  for (let k = 0; k <= 1.001; k += 0.05) { const v = easeInOut(k); assert.ok(v >= prev); prev = v; }
});

test('menu orbit holds constant radius and height', () => {
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2]) {
    const p = menuOrbitPos(a);
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - 58) < 1e-9, `angle=${a} radius=${Math.hypot(p.x, p.z)}`);
    assert.equal(p.y, 26);
  }
});

test('goal cinematic shots stay inside the bowl and frame the mouth', () => {
  const variants: GoalCineVariant[] = [0, 1, 2];
  for (const variant of variants) for (const side of [1, -1]) for (const ballX of [-40, -10, 10, 40]) for (const ballZ of [-29, -8, 0, 8, 29]) {
    const end = goalCineShot(variant, side, ballX, ballZ);
    const s = side >= 0 ? 1 : -1;
    // Inside the bowl: short of the end stands (|x|<50), clear of the far
    // stand (z>-30), low enough to feel close (y<=8).
    assert.ok(Math.abs(end.pos.x) <= 49.5, `v=${variant} x=${end.pos.x}`);
    assert.ok(end.pos.z >= -27 && end.pos.z <= 27, `v=${variant} z=${end.pos.z}`);
    assert.ok(end.pos.y >= 2 && end.pos.y <= 8, `v=${variant} y=${end.pos.y}`);
    // The mouth must project inside the frame from the end pose (fov 38).
    const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 500);
    cam.position.copy(end.pos); cam.lookAt(end.look); cam.updateMatrixWorld();
    const mouth = new THREE.Vector3(s * FIELD.halfLength, 1.4, 0).project(cam);
    assert.ok(Math.abs(mouth.x) < 0.9 && mouth.y > -0.9 && mouth.y < 0.9,
      `v=${variant} side=${side} ball=(${ballX},${ballZ}) mouth at (${mouth.x.toFixed(2)},${mouth.y.toFixed(2)})`);
  }
});

test('goal cinematic variant picker is deterministic and uses all three', () => {
  assert.equal(goalCineVariant(1, 10, 5), goalCineVariant(1, 10, 5));
  const seen = new Set<GoalCineVariant>();
  for (let x = -45; x <= 45; x += 3) for (let z = -28; z <= 28; z += 3) {
    const v = goalCineVariant(x >= 0 ? 1 : -1, x, z);
    assert.ok(v === 0 || v === 1 || v === 2);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('scorerTeam reads the scoreboard delta; celebration moves vary', () => {
  assert.equal(scorerTeam([0, 0], [1, 0]), 0);
  assert.equal(scorerTeam([1, 0], [1, 1]), 1);
  assert.equal(scorerTeam([2, 1], [2, 1]), null);
  assert.equal(scorerTeam([0, 0], [0, 0]), null);
  assert.equal(celebrationMove(3, true), 0, 'keepers always jump');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => celebrationMove(i, false)), [0, 1, 2, 0, 1, 2]);
});
