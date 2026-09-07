import type { InputFrame } from '../types';
import type { KeyboardState } from './keyboard';
import { stickSprint, type TouchState } from './touch';

/**
 * Unified input layer: raw browser device state -> simulation InputFrame.
 *
 * FIFA PC (arrow-keys) layout: arrows move/aim, S pass, W through, A
 * cross/lob, D shoot, E/Shift sprint, Q/Space switch. Legacy J/L/I/K aliases
 * kept so old muscle memory still works. Touch joystick vector is merged in
 * so mobile plays the identical sim.
 *
 * shootWasDown (cross-device action state) lives here, not in keyboard
 * state — release edges fire when neither device holds shoot anymore.
 * Pure function of (keyboard, touch, previous shootHeld); no DOM.
 *
 * Future 2v2 note: each human controller gets its own (KeyboardState,
 * TouchState, shootWasDown) triple producing one InputFrame per tick; the
 * sim already accepts (input, peerInput) and will extend to four frames.
 * See docs/architecture.md.
 */
export function buildInputFrame(
  kb: KeyboardState,
  touch: TouchState,
  shootWasDown: boolean,
): { frame: InputFrame; shootWasDown: boolean } {
  const hit = (k: string) => kb.pressed.has(k) || touch.pressed.has(k);
  const held = (k: string) => kb.down.has(k) || touch.down.has(k);

  let x = (held('ArrowRight') ? 1 : 0) - (held('ArrowLeft') ? 1 : 0) + touch.stickX;
  let z = (held('ArrowDown') ? 1 : 0) - (held('ArrowUp') ? 1 : 0) + touch.stickZ;
  const n = Math.hypot(x, z);
  if (n > 1) {
    x /= n;
    z /= n;
  }
  const sh = held('KeyD') || held('KeyK');
  const frame: InputFrame = {
    x,
    z,
    sprint: held('ShiftLeft') || held('ShiftRight') || held('KeyE') || stickSprint(touch),
    pass: hit('KeyS') || hit('KeyJ'),
    through: hit('KeyW') || hit('KeyL'),
    cross: hit('KeyA') || hit('KeyI'),
    shootPressed: hit('KeyD') || hit('KeyK'),
    shootHeld: sh,
    shootReleased:
      kb.released.has('KeyD') ||
      kb.released.has('KeyK') ||
      touch.released.has('KeyD') ||
      (!sh && shootWasDown),
    switchPlayer: hit('Space') || hit('KeyQ'),
  };
  return { frame, shootWasDown: sh };
}

/** Consume per-frame edges on both devices (held buttons persist). */
export function clearInputEdges(kb: KeyboardState, touch: TouchState): void {
  kb.pressed.clear();
  kb.released.clear();
  touch.pressed.clear();
  touch.released.clear();
}
