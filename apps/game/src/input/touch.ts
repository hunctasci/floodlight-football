/** DOM-free touch input core (unit-testable). The DOM layer in main.ts feeds
 * touch/pointer events into a TouchState; input.ts merges its sets with the
 * keyboard sets so the sim sees one unified input namespace (KeyboardEvent.code).
 *
 * Canonical location is input/touch.ts; src/touch.ts re-exports it for
 * backwards compatibility with existing tests.
 */

export interface TouchState {
  down: Set<string>;
  pressed: Set<string>;
  released: Set<string>;
  /** Joystick vector, already dead-zoned and normalized to length <= 1. */
  stickX: number;
  stickZ: number;
  usingTouch: boolean;
  /** Shot aim from dragging on the SHOOT control (goal-local U/V). */
  aimU: number;
  aimV: number;
}

export function createTouchState(): TouchState {
  return { down: new Set(), pressed: new Set(), released: new Set(), stickX: 0, stickZ: 0, usingTouch: false, aimU: 0, aimV: 0 };
}

export function touchDown(t: TouchState, code: string) {
  if (!t.down.has(code)) {
    t.pressed.add(code);
    if (code === TOUCH_BUTTONS.shoot) { t.aimU = 0; t.aimV = 0; }
  }
  t.down.add(code);
  t.usingTouch = true;
}

export function touchUp(t: TouchState, code: string) {
  t.released.add(code);
  t.down.delete(code);
  t.usingTouch = true;
  // Keep placement until the simulation consumes the release edge.
}

/** Drag offset on the SHOOT control, in px from the touch start. */
export function setShootAim(t: TouchState, dx: number, dy: number) {
  t.aimU = Math.max(-1, Math.min(1, dx / 96));
  t.aimV = Math.max(0, Math.min(1, -dy / 96));
  t.usingTouch = true;
}

/** Raw joystick displacement in [-1,1]; applies dead-zone and normalization. */
export function setStick(t: TouchState, x: number, z: number) {
  const n = Math.hypot(x, z);
  if (n < 0.15) { t.stickX = 0; t.stickZ = 0; return; }
  const m = Math.min(1, n);
  t.stickX = (x / (n || 1)) * m;
  t.stickZ = (z / (n || 1)) * m;
  if (m > 0) t.usingTouch = true;
}

export function releaseStick(t: TouchState) { t.stickX = 0; t.stickZ = 0; }

/**
 * Analog sprint (arcade): pushing the stick to its rim sprints,
 * no sprint button needed. Hysteresis: enter at ~0.92, stay until below
 * ~0.82, so steering near the rim never flickers. Pass the previous result
 * (`wasSprint`) back in each frame.
 */
export function stickSprint(t: TouchState, wasSprint = false): boolean {
  const m = Math.hypot(t.stickX, t.stickZ);
  return m > (wasSprint ? 0.82 : 0.92);
}

/** End-of-frame: edges are consumed, held buttons persist. Mirrors keyboard handling. */
export function clearTouchEdges(t: TouchState) {
  if (t.released.has(TOUCH_BUTTONS.shoot) && !t.down.has(TOUCH_BUTTONS.shoot)) {
    t.aimU = 0; t.aimV = 0;
  }
  t.pressed.clear(); t.released.clear();
}

export function resetTouch(t: TouchState) {
  t.down.clear(); t.pressed.clear(); t.released.clear();
  t.stickX = 0; t.stickZ = 0; t.aimU = 0; t.aimV = 0;
}

/** Button code map for the on-screen match controls: the arcade cluster
 *  (PASS / LONG / SHOOT) plus a mini SWITCH. Codes match the keyboard
 *  (KeyS/KeyA/KeyK/KeyQ) so the sim sees one unified namespace.
 *  W is a keyboard alias for LONG; sprint lives on the joystick rim;
 *  lead passes come from holding PASS. */
export const TOUCH_BUTTONS = {
  shoot: 'KeyK',
  pass: 'KeyS',
  long: 'KeyA',
  switch: 'KeyQ',
} as const;

/** Menu navigation pad codes (arrows + confirm/back). */
export const TOUCH_MENU = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  ok: 'Enter',
  back: 'Escape',
} as const;
