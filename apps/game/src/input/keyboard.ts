/**
 * Keyboard device state (DOM-free, unit-testable).
 * Owns down/pressed/released sets and the blocked-key list.
 * Browser listeners stay in main.ts (app orchestration); this module never
 * touches window/document so the simulation stays DOM-free.
 * Future 2v2 note: each human controller will get its own KeyboardState +
 * TouchState pair feeding one InputFrame; see docs/architecture.md.
 */

export interface KeyboardState {
  down: Set<string>;
  pressed: Set<string>;
  released: Set<string>;
}

export function createKeyboardState(): KeyboardState {
  return { down: new Set(), pressed: new Set(), released: new Set() };
}

/** Keys the game consumes; main.ts preventDefaults these (never the chat box). */
export const BLOCKED_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyC',
  'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'Space',
  'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'Escape', 'KeyM',
];

export function isBlockedKey(code: string): boolean {
  return BLOCKED_KEYS.includes(code);
}

export function keyDown(kb: KeyboardState, code: string): void {
  if (!kb.down.has(code)) kb.pressed.add(code);
  kb.down.add(code);
}

export function keyUp(kb: KeyboardState, code: string): void {
  kb.released.add(code);
  kb.down.delete(code);
}

/** End-of-frame: edges are consumed, held keys persist. Mirrors touch handling. */
export function clearKeyboardEdges(kb: KeyboardState): void {
  kb.pressed.clear();
  kb.released.clear();
}

export function resetKeyboard(kb: KeyboardState): void {
  kb.down.clear();
  kb.pressed.clear();
  kb.released.clear();
}
