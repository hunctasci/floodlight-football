/**
 * One match clock for solo and online play.
 *
 * The simulation advances in fixed 1/60s ticks. Rendering frequency must
 * never determine gameplay speed: callers feed elapsed *render* time into
 * `push()`, which returns how many simulation ticks are due — capped so a
 * stall can never avalanche into seconds of catch-up debt.
 *
 * Online callers additionally gate each tick on network input availability;
 * unused due-ticks are simply dropped next frame (the accumulator does not
 * grow without bound — see MAX_DEBT_S).
 */
export const TICK_DT = 1 / 60;
/** Hard cap on simulation work per render frame (~66ms at 60Hz sim). */
export const MAX_CATCH_UP = 4;
/** Debt beyond this is discarded: after a major stall we rebase instead of
 *  fast-forwarding through seconds of stale simulation. */
export const MAX_DEBT_S = 0.25;

export class SimulationClock {
  private acc = 0;

  /** Feed elapsed real seconds; returns ticks due this frame (0..MAX_CATCH_UP). */
  push(elapsedSec: number): number {
    if (!(elapsedSec > 0) || !Number.isFinite(elapsedSec)) return 0;
    this.acc = Math.min(this.acc + elapsedSec, MAX_DEBT_S);
    const due = Math.floor(this.acc / TICK_DT);
    const n = Math.min(due, MAX_CATCH_UP);
    this.acc -= n * TICK_DT;
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  /** True debt still waiting (for diagnostics, not for stepping). */
  get debt(): number {
    return this.acc;
  }

  reset() {
    this.acc = 0;
  }
}
