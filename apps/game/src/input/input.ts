import type { InputFrame } from '../types';
import type { KeyboardState } from './keyboard';
import { stickSprint, type TouchState } from './touch';

/**
 * Unified input layer: raw browser device state -> simulation InputFrame.
 *
 * Desktop: WASD/arrows move+aim, Shift/E sprint, Space pass (tap = to feet,
 * hold = into space), mouse hold/drag aims the shot and release fires it,
 * Q switches. Arrows are full aliases of WASD so old muscle memory survives.
 *
 * Touch: left stick moves (rim = sprint), PASS / SHOOT / SWITCH buttons.
 * Aim on touch comes from dragging on the SHOOT control (fed through the
 * same aimU/aimV fields by the DOM layer).
 *
 * shootWasDown / passWasDown (cross-device action state) live with the
 * caller, not in device state — release edges fire when neither device
 * holds the button anymore. Pure function of device state + previous
 * hold state; no DOM. All axes are quantized to the wire representation
 * so solo and online simulate bit-identical frames.
 */

export interface InputCarry {
  shootWasDown: boolean;
  passWasDown: boolean;
  stickSprintOn: boolean;
}

export interface AimInput {
  aimU: number;
  aimV: number;
}

const Q1 = (v: number) => Math.round(v * 100) / 100;

export function buildInputFrame(
  kb: KeyboardState,
  touch: TouchState,
  shootWasDown: boolean,
  extra?: Partial<InputCarry> & { aim?: AimInput },
): { frame: InputFrame; shootWasDown: boolean; passWasDown: boolean; stickSprint: boolean } {
  const hit = (k: string) => kb.pressed.has(k) || touch.pressed.has(k);
  const held = (k: string) => kb.down.has(k) || touch.down.has(k);

  // WASD primary, arrows alias. Screen mapping: +x right, +z down-screen.
  let x =
    (held('KeyD') || held('ArrowRight') ? 1 : 0) -
    (held('KeyA') || held('ArrowLeft') ? 1 : 0) +
    touch.stickX;
  let z =
    (held('KeyS') || held('ArrowDown') ? 1 : 0) -
    (held('KeyW') || held('ArrowUp') ? 1 : 0) +
    touch.stickZ;
  const n = Math.hypot(x, z);
  if (n > 1) {
    x /= n;
    z /= n;
  }
  // Stick sprint latches: enter at the rim, release below it (hysteresis).
  const stickOn = stickSprint(touch, extra?.stickSprintOn ?? false);
  // Space is the pass button (S is move-down in WASD); KeyJ stays as a
  // legacy alias with no movement conflict.
  const passDown = held('Space') || held('KeyJ');
  const passHit = hit('Space') || hit('KeyJ');
  const passWasDown = extra?.passWasDown ?? false;
  const sh = held('MouseL') || held('KeyK');
  // Shot aim: mouse drag wins, else the SHOOT-control drag on touch.
  const aim = extra?.aim ?? (touch.aimU !== 0 || touch.aimV !== 0 ? { aimU: touch.aimU, aimV: touch.aimV } : undefined);
  const frame: InputFrame = {
    x: Q1(x),
    z: Q1(z),
    sprint: held('ShiftLeft') || held('ShiftRight') || held('KeyE') || stickOn,
    pass: passHit,
    passHeld: passDown,
    passReleased:
      kb.released.has('Space') ||
      kb.released.has('KeyJ') ||
      touch.released.has('Space') ||
      touch.released.has('KeyJ') ||
      (!passDown && passWasDown),
    // Legacy dedicated buttons: no longer produced. Hold-PASS derives lead
    // passes and SHOOT selects long restarts inside the sim.
    through: false,
    cross: false,
    shootPressed: hit('MouseL') || hit('KeyK'),
    shootHeld: sh,
    shootReleased:
      kb.released.has('MouseL') ||
      kb.released.has('KeyK') ||
      touch.released.has('KeyK') ||
      (!sh && shootWasDown),
    switchPlayer: hit('KeyQ'),
    aimU: Q1(aim?.aimU ?? 0),
    aimV: Q1(aim?.aimV ?? 0),
  };
  return { frame, shootWasDown: sh, passWasDown: passDown, stickSprint: stickOn };
}

/** Consume per-frame edges on both devices (held buttons persist). */
export function clearInputEdges(kb: KeyboardState, touch: TouchState): void {
  kb.pressed.clear();
  kb.released.clear();
  touch.pressed.clear();
  touch.released.clear();
}
