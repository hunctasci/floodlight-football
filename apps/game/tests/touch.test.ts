import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchState, touchDown, touchUp, setStick, releaseStick, clearTouchEdges, resetTouch, stickSprint, TOUCH_BUTTONS } from '../src/touch.ts';
import { touchButtonLabels } from '../src/ui/touch-controls.ts';

test('button press fires edge once while held', () => {
  const t = createTouchState();
  touchDown(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.pressed.has(TOUCH_BUTTONS.shoot) && t.down.has(TOUCH_BUTTONS.shoot));
  clearTouchEdges(t);
  touchDown(t, TOUCH_BUTTONS.shoot); // still held: no new edge
  assert.ok(!t.pressed.has(TOUCH_BUTTONS.shoot) && t.down.has(TOUCH_BUTTONS.shoot));
  touchUp(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.released.has(TOUCH_BUTTONS.shoot) && !t.down.has(TOUCH_BUTTONS.shoot));
  clearTouchEdges(t);
  assert.ok(!t.released.has(TOUCH_BUTTONS.shoot));
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
  touchDown(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.down.has(TOUCH_BUTTONS.shoot) && !t.released.has(TOUCH_BUTTONS.shoot));
  clearTouchEdges(t);
  assert.ok(t.down.has(TOUCH_BUTTONS.shoot), 'hold persists across frames');
  touchUp(t, TOUCH_BUTTONS.shoot);
  assert.ok(t.released.has(TOUCH_BUTTONS.shoot) && !t.down.has(TOUCH_BUTTONS.shoot));
});

test('menu codes round-trip through the same sets', () => {
  const t = createTouchState();
  for (const code of ['ArrowUp', 'ArrowLeft', 'Enter', 'Escape']) touchDown(t, code);
  assert.ok(t.pressed.has('Enter') && t.down.has('ArrowLeft'));
  resetTouch(t);
  assert.equal(t.down.size, 0); assert.equal(t.pressed.size, 0);
  assert.equal(t.stickX, 0); assert.equal(t.usingTouch, true);
});

test('analog sprint engages only at the stick rim', () => {
  const t = createTouchState();
  setStick(t, 0.45, 0); assert.equal(stickSprint(t), false, 'half pull jogs');
  setStick(t, 0.6, 0.6); assert.equal(stickSprint(t), false, '0.85 diagonal still jogs');
  setStick(t, 0, 1); assert.equal(stickSprint(t), true, 'rim push sprints');
  setStick(t, 3, 4); assert.equal(stickSprint(t), true, 'overdrag clamps to rim, still sprint');
  releaseStick(t); assert.equal(stickSprint(t), false, 'released stick never sprints');
});

test('FIFA cluster codes match the keyboard (KeyS/KeyA/KeyW/KeyK)', () => {
  assert.equal(TOUCH_BUTTONS.pass, 'KeyS');
  assert.equal(TOUCH_BUTTONS.cross, 'KeyA');
  assert.equal(TOUCH_BUTTONS.thru, 'KeyW');
  assert.equal(TOUCH_BUTTONS.shoot, 'KeyK');
  assert.equal(TOUCH_BUTTONS.switch, 'KeyQ');
});

test('FIFA labels swap offense/defense with PlayStation shapes', () => {
  const off = touchButtonLabels(true);
  assert.equal(off.pass.main, 'PASS');
  assert.equal(off.cross.main, 'CROSS');
  assert.equal(off.thru.main, 'THRU');
  assert.equal(off.shoot.main, 'SHOOT');
  const def = touchButtonLabels(false);
  assert.equal(def.pass.main, 'CONTAIN');
  assert.equal(def.cross.main, 'SLIDE');
  assert.equal(def.thru.main, 'RUSH');
  assert.equal(def.shoot.main, 'TACKLE');
  assert.equal(def.pass.sub, 'X');
  assert.equal(def.cross.sub, '□');
  assert.equal(def.thru.sub, '△');
  assert.equal(def.shoot.sub, '○');
});
