import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyboardState, keyDown, keyUp, clearKeyboardEdges, BLOCKED_KEYS } from '../src/input/keyboard.ts';
import {
  createTouchState,
  touchDown,
  touchUp,
  setStick,
  clearTouchEdges,
  stickSprint,
  TOUCH_BUTTONS,
} from '../src/input/touch.ts';
import { buildInputFrame } from '../src/input/input.ts';

function kbWith(...codes: string[]) {
  const kb = createKeyboardState();
  for (const c of codes) keyDown(kb, c);
  return kb;
}

// Freeze the keyboard/touch -> InputFrame contract. Future 2v2 multi-controller
// work must preserve these semantics per controller stream.
test('arrows move; WASD are actions, never movement', () => {
  const touch = createTouchState();
  let r = buildInputFrame(kbWith('ArrowRight'), touch, false);
  assert.equal(r.frame.x, 1);
  assert.equal(r.frame.z, 0);
  r = buildInputFrame(kbWith('ArrowRight', 'ArrowUp'), touch, false);
  const n = Math.hypot(r.frame.x, r.frame.z);
  // Wire quantization keeps half-a-percent accuracy, not exact unity.
  assert.ok(Math.abs(n - 1) < 0.02, `diagonal normalized (n=${n})`);
  r = buildInputFrame(kbWith('ArrowLeft'), touch, false);
  assert.equal(r.frame.x, -1);
  // WASD must not move anyone: they are the FIFA action cluster.
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const f = buildInputFrame(kbWith(k), touch, false).frame;
    assert.equal(f.x, 0, `${k} does not move`);
    assert.equal(f.z, 0, `${k} does not move`);
  }
});

test('arcade action cluster: Space switch, S pass, W/A long, D shoot', () => {
  const touch = createTouchState();
  assert.equal(buildInputFrame(kbWith('Space'), touch, false).frame.switchPlayer, true);
  assert.equal(buildInputFrame(kbWith('KeyQ'), touch, false).frame.switchPlayer, true);
  assert.equal(buildInputFrame(kbWith('KeyS'), touch, false).frame.pass, true);
  assert.equal(buildInputFrame(kbWith('KeyJ'), touch, false).frame.pass, true);
  assert.equal(buildInputFrame(kbWith('KeyW'), touch, false).frame.long, true);
  assert.equal(buildInputFrame(kbWith('KeyA'), touch, false).frame.long, true);
  assert.equal(buildInputFrame(kbWith('KeyK'), touch, false).frame.shootPressed, true);
  assert.equal(buildInputFrame(kbWith('KeyD'), touch, false).frame.shootPressed, true);
  assert.equal(buildInputFrame(kbWith('MouseL'), touch, false).frame.shootPressed, true);
  // Sprint lives on E/Shift/stick only — W/A are the long-pass button.
  assert.equal(buildInputFrame(kbWith('KeyW'), touch, false).frame.sprint, false);
  assert.equal(buildInputFrame(kbWith('KeyE'), touch, false).frame.sprint, true);
});

test('sprint from Shift/E or stick rim', () => {
  const touch = createTouchState();
  assert.equal(buildInputFrame(kbWith('ShiftLeft'), touch, false).frame.sprint, true);
  assert.equal(buildInputFrame(kbWith('ShiftRight'), touch, false).frame.sprint, true);
  assert.equal(buildInputFrame(kbWith('KeyE'), touch, false).frame.sprint, true);
  const kb = createKeyboardState();
  const t2 = createTouchState();
  setStick(t2, 0, 1);
  assert.equal(stickSprint(t2), true);
  assert.equal(buildInputFrame(kb, t2, false).frame.sprint, true);
  const t3 = createTouchState();
  setStick(t3, 0.45, 0);
  assert.equal(buildInputFrame(kb, t3, false).frame.sprint, false);
});

test('stick sprint hysteresis: rim latches until the pull relaxes', () => {
  const kb = createKeyboardState();
  const t = createTouchState();
  setStick(t, 0, 1);
  let r = buildInputFrame(kb, t, false, {});
  assert.equal(r.stickSprint, true);
  // Ease back to 0.85: still sprinting (above the 0.82 release line).
  setStick(t, 0, 0.85);
  r = buildInputFrame(kb, t, false, { stickSprintOn: r.stickSprint });
  assert.equal(r.stickSprint, true, 'latch holds through minor relaxation');
  setStick(t, 0, 0.7);
  r = buildInputFrame(kb, t, false, { stickSprintOn: r.stickSprint });
  assert.equal(r.stickSprint, false, 'release below 0.82 drops sprint');
});

test('touch buttons emit the same codes as keyboard', () => {
  const kb = createKeyboardState();
  const touch = createTouchState();
  touchDown(touch, TOUCH_BUTTONS.shoot);
  let r = buildInputFrame(kb, touch, false);
  assert.equal(r.frame.shootPressed, true);
  assert.equal(r.frame.shootHeld, true);
  clearTouchEdges(touch);
  // Still held: pressed edge gone, held persists.
  r = buildInputFrame(kb, touch, r.shootWasDown);
  assert.equal(r.frame.shootPressed, false);
  assert.equal(r.frame.shootHeld, true);
  touchUp(touch, TOUCH_BUTTONS.shoot);
  r = buildInputFrame(kb, touch, r.shootWasDown);
  assert.equal(r.frame.shootReleased, true);
  assert.equal(r.frame.shootHeld, false);
});

test('touch arcade cluster matches the keyboard codes (KeyS/KeyA)', () => {
  const kb = createKeyboardState();
  let touch = createTouchState();
  touchDown(touch, TOUCH_BUTTONS.pass);
  assert.equal(buildInputFrame(kb, touch, false).frame.pass, true);
  touch = createTouchState();
  touchDown(touch, TOUCH_BUTTONS.long);
  assert.equal(buildInputFrame(kb, touch, false).frame.long, true);
  assert.equal(TOUCH_BUTTONS.pass, 'KeyS');
  assert.equal(TOUCH_BUTTONS.long, 'KeyA');
});

test('touch stick merges with keyboard and normalizes', () => {
  const kb = kbWith('ArrowRight');
  const touch = createTouchState();
  setStick(touch, 1, 0);
  const r = buildInputFrame(kb, touch, false);
  const n = Math.hypot(r.frame.x, r.frame.z);
  assert.ok(n <= 1 + 0.02, 'merged vector normalized');
  assert.ok(r.frame.x > 0.9, 'merged direction preserved');
});

test('shoot hold/release flow across devices (shootWasDown unified)', () => {
  const kb = createKeyboardState();
  const touch = createTouchState();
  // Press K on keyboard.
  keyDown(kb, 'KeyK');
  let r = buildInputFrame(kb, touch, false);
  assert.equal(r.frame.shootPressed, true);
  assert.equal(r.frame.shootHeld, true);
  assert.equal(r.shootWasDown, true);
  clearKeyboardEdges(kb);
  // Hold: no new edge, still held.
  r = buildInputFrame(kb, touch, r.shootWasDown);
  assert.equal(r.frame.shootPressed, false);
  assert.equal(r.frame.shootHeld, true);
  assert.equal(r.frame.shootReleased, false);
  // Release: edge fires once via released set AND via shootWasDown fallback.
  keyUp(kb, 'KeyK');
  r = buildInputFrame(kb, touch, r.shootWasDown);
  assert.equal(r.frame.shootReleased, true);
  assert.equal(r.shootWasDown, false);
  clearKeyboardEdges(kb);
  r = buildInputFrame(kb, touch, r.shootWasDown);
  assert.equal(r.frame.shootReleased, false, 'release edge fires once');
});

test('pass hold/release flow (passWasDown unified)', () => {
  const kb = createKeyboardState();
  const touch = createTouchState();
  keyDown(kb, 'KeyS');
  let r = buildInputFrame(kb, touch, false, {});
  assert.equal(r.frame.pass, true);
  assert.equal(r.frame.passHeld, true);
  assert.equal(r.passWasDown, true);
  clearKeyboardEdges(kb);
  r = buildInputFrame(kb, touch, false, { passWasDown: r.passWasDown });
  assert.equal(r.frame.pass, false, 'press edge fires once');
  assert.equal(r.frame.passHeld, true, 'hold persists');
  keyUp(kb, 'KeyS');
  r = buildInputFrame(kb, touch, false, { passWasDown: r.passWasDown });
  assert.equal(r.frame.passReleased, true);
  clearKeyboardEdges(kb);
  r = buildInputFrame(kb, touch, false, { passWasDown: false });
  assert.equal(r.frame.passReleased, false, 'release edge fires once');
});

test('keyboard edge semantics: press fires once while held', () => {
  const kb = createKeyboardState();
  const touch = createTouchState();
  keyDown(kb, 'KeyS');
  assert.equal(buildInputFrame(kb, touch, false).frame.pass, true);
  clearKeyboardEdges(kb);
  keyDown(kb, 'KeyS'); // still held: no new edge
  assert.equal(buildInputFrame(kb, touch, false).frame.pass, false);
});

test('axes and aim are quantized to the wire representation', () => {
  const touch = createTouchState();
  const r = buildInputFrame(kbWith('ArrowRight'), touch, false, { aim: { aimU: 0.3333, aimV: 0.6666 } });
  assert.equal(r.frame.aimU, 0.33);
  assert.equal(r.frame.aimV, 0.67);
});

test('blocked keys cover gameplay inputs', () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'Enter', 'Escape', 'KeyM']) {
    assert.ok(BLOCKED_KEYS.includes(k), `${k} blocked`);
  }
});
