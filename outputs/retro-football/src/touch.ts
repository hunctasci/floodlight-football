/** DOM-free touch input core (unit-testable). The DOM layer in main.ts feeds
 * touch/pointer events into a TouchState; main.ts merges its sets with the
 * keyboard sets so the sim sees one unified input namespace (KeyboardEvent.code). */

export interface TouchState {
  down: Set<string>;
  pressed: Set<string>;
  released: Set<string>;
  /** Joystick vector, already dead-zoned and normalized to length <= 1. */
  stickX: number;
  stickZ: number;
  usingTouch: boolean;
}

export function createTouchState(): TouchState {
  return { down: new Set(), pressed: new Set(), released: new Set(), stickX: 0, stickZ: 0, usingTouch: false };
}

export function touchDown(t: TouchState, code: string) {
  if (!t.down.has(code)) t.pressed.add(code);
  t.down.add(code);
  t.usingTouch = true;
}

export function touchUp(t: TouchState, code: string) {
  t.released.add(code);
  t.down.delete(code);
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

/** End-of-frame: edges are consumed, held buttons persist. Mirrors main.ts keyboard handling. */
export function clearTouchEdges(t: TouchState) { t.pressed.clear(); t.released.clear(); }

export function resetTouch(t: TouchState) {
  t.down.clear(); t.pressed.clear(); t.released.clear();
  t.stickX = 0; t.stickZ = 0;
}

/** Button code map for the on-screen match controls. */
export const TOUCH_BUTTONS = {
  shoot: 'KeyD',
  pass: 'KeyS',
  through: 'KeyW',
  cross: 'KeyA',
  sprint: 'KeyE',
  switch: 'KeyQ',
  pause: 'Escape',
  camera: 'KeyC',
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
