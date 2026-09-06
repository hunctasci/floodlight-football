import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA_MODES, computeCamera, type CameraMode } from '../src/renderer.ts';

const ASPECTS = [0.5, 0.75, 1.33, 1.78, 2.4];
const SPOTS: Array<[number, number]> = [[0, 0], [40, 25], [-40, -25], [46, 29], [-46, -29], [0, 29], [20, -29]];

function ndc(mode: CameraMode, aspect: number, focusX: number, focusZ: number, x: number, z: number) {
  const f = computeCamera(mode, aspect, focusX, focusZ);
  const cam = new THREE.PerspectiveCamera(f.fov, aspect, 0.1, 500);
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
}
