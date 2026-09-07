/**
 * Canonical gameplay tuning constants.
 * Relocated verbatim from engine.ts — values are frozen for the upcoming
 * gameplay pass. Do not retune here.
 *
 * Grouped aliases below are read/navigation conveniences only; they reference
 * the same TUNING object, never duplicate literals.
 */
export const TUNING: {
  speed: number;
  sprint: number;
  jog: number;
  acceleration: number;
  deceleration: number;
  turn: number;
  pass: number;
  through: number;
  shot: number;
  tackle: number;
  slideTackle: number;
  keeperSpeed: number;
  controlRadius: number;
  receiverRadius: number;
  keeperReach: number;
  keeperDiveReach: number;
} = {
  speed: 7.4,
  sprint: 10.2,
  jog: 4.2,
  acceleration: 22,
  deceleration: 29,
  turn: 17,
  pass: 19,
  through: 25,
  shot: 28,
  tackle: 1.9,
  slideTackle: 2.45,
  keeperSpeed: 6.8,
  controlRadius: 1.55,
  receiverRadius: 2.3,
  keeperReach: 1.7,
  keeperDiveReach: 2.4,
};

export type Tuning = typeof TUNING;

export const PLAYER_TUNING = {
  speed: TUNING.speed,
  sprint: TUNING.sprint,
  jog: TUNING.jog,
  acceleration: TUNING.acceleration,
  deceleration: TUNING.deceleration,
  turn: TUNING.turn,
};

export const PASS_TUNING = {
  pass: TUNING.pass,
  through: TUNING.through,
};

export const SHOT_TUNING = {
  shot: TUNING.shot,
};

export const KEEPER_TUNING = {
  keeperSpeed: TUNING.keeperSpeed,
  keeperReach: TUNING.keeperReach,
  keeperDiveReach: TUNING.keeperDiveReach,
};

export const TACKLE_TUNING = {
  tackle: TUNING.tackle,
  slideTackle: TUNING.slideTackle,
};
