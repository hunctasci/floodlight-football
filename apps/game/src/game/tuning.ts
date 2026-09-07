/**
 * Canonical gameplay tuning constants (P0 rebuild values).
 *
 * Movement: 7.4 m/s run, 1.24x sprint, ~143ms to 95% speed, ~120ms stop.
 * Ball control: discrete touches every 120ms, 0.9m jog / 1.5m sprint touch,
 * 0.8m acquisition, 1.8m control envelope — no magnets, no immunity.
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
  touchGap: number;
  touchJog: number;
  touchSprint: number;
  acquire: number;
  envelope: number;
  keeperBody: number;
  keeperHand: number;
  keeperDiveSpeed: number;
  keeperReact: number;
  tackleFoot: number;
  tackleFootR: number;
  slideSweepR: number;
  slideActive: number;
  slideTotal: number;
} = {
  speed: 7.4,
  sprint: 9.2,
  jog: 4.2,
  acceleration: 21,
  deceleration: 25,
  turn: 17,
  pass: 19,
  through: 25,
  shot: 28,
  tackle: 1.9,
  slideTackle: 2.45,
  keeperSpeed: 4.5,
  controlRadius: 1.55,
  receiverRadius: 2.3,
  keeperReach: 1.7,
  keeperDiveReach: 2.4,
  touchGap: .12,
  touchJog: .9,
  touchSprint: 1.5,
  acquire: .8,
  envelope: 1.8,
  keeperBody: .65,
  keeperHand: .55,
  keeperDiveSpeed: 6.5,
  keeperReact: .2,
  tackleFoot: .9,
  tackleFootR: .55,
  slideSweepR: .6,
  slideActive: .45,
  slideTotal: .75,
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
