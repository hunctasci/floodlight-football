import { momentTimeAt } from '../animation/time-ramp';
import { sampleFootballMoment, type ChoreoFrame } from '../football/adapter/choreography';
import type { ShotSpec } from './types';

/**
 * Moment time of a shot at an absolute frame: the shot's moment clock when it
 * has one, otherwise legacy shot-local time over the shot's own duration.
 */
export function shotMomentTime(shot: ShotSpec, frame: number, fps: number): { time: number; length: number } {
  const local = frame - shot.startFrame;
  if (shot.momentClock) {
    return { time: momentTimeAt(shot.momentClock, local, shot.durationInFrames), length: shot.momentClock.length };
  }
  const length = shot.durationInFrames / fps;
  return { time: Math.min(length, Math.max(0, local / fps)), length };
}

/** Choreography of a football shot at an absolute frame (undefined off-pitch). */
export function sampleShotChoreo(shot: ShotSpec, frame: number, fps: number): ChoreoFrame | undefined {
  if (!shot.footballMoment) return undefined;
  const { time, length } = shotMomentTime(shot, frame, fps);
  return sampleFootballMoment(shot.footballMoment, time, length, shot.attackingTeam !== 'away');
}

/** Choreography at an explicit moment time (lagged camera anchors, trails). */
export function sampleShotChoreoAt(shot: ShotSpec, time: number, fps: number): ChoreoFrame | undefined {
  if (!shot.footballMoment) return undefined;
  const length = shot.momentClock?.length ?? shot.durationInFrames / fps;
  return sampleFootballMoment(shot.footballMoment, time, length, shot.attackingTeam !== 'away');
}
