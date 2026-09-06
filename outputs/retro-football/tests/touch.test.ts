import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchState, touchDown, touchUp, setStick, releaseStick, clearTouchEdges, resetTouch, TOUCH_BUTTONS } from '../src/touch.ts';

test('button press fires edge once while held', () => {
  const t = createTouchState();
  touchDown(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.pressed.has('KeyD') && t.down.has('KeyD'));
  clearTouchEdges(t);
  touchDown(t, TOUCH_BUTTONS.shoot); // still held: no new edge
  assert.ok(!t.pressed.has('KeyD') && t.down.has('KeyD'));
  touchUp(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.released.has('KeyD') && !t.down.has('KeyD'));
  clearTouchEdges(t);
  assert.ok(!t.released.has('KeyD'));
});

test('joystick dead-zones and normalizes', () => {
  const t = createTouchState();
  setStick(t, 0.05, 0.05);
  assert.equal(t.stickX, 0); assert.equal(t.stickZ, 0);
  setStick(t, 3, 4);
  assert.ok(Math.abs(t.stickX - 0.6) < 1e-9 && Math.abs(t.stickZ - 0.8) < 1e-9);
  setStick(t, 0, 2); // clamped to unit length
  assert.ok(Math.hypot(t.stickX, t.stickZ) <= 1 + 1e-9);
  releaseStick(t);
  assert.equal(t.stickX, 0); assert.equal(t.stickZ, 0);
});

test('shoot hold/release flow for charged shots', () => {
  const t = createTouchState();
  touchDown(t, 'KeyD');
  assert.ok(t.down.has('KeyD') && !t.released.has('KeyD'));
  clearTouchEdges(t);
  assert.ok(t.down.has('KeyD'), 'hold persists across frames');
  touchUp(t, 'KeyD');
  assert.ok(t.released.has('KeyD') && !t.down.has('KeyD'));
});

test('menu codes round-trip through the same sets', () => {
  const t = createTouchState();
  for (const code of ['ArrowUp', 'ArrowLeft', 'Enter', 'Escape']) touchDown(t, code);
  assert.ok(t.pressed.has('Enter') && t.down.has('ArrowLeft'));
  resetTouch(t);
  assert.equal(t.down.size, 0); assert.equal(t.pressed.size, 0);
  assert.equal(t.stickX, 0); assert.equal(t.usingTouch, true);
});
