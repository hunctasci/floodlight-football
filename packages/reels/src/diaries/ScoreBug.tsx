import React from 'react';
import type { ScoreBugSpec, TimedShot } from './edit';
import { DIARY_TYPE } from './type';

/** Which broadcast score the bug shows at `frame` (episode clock), or null when hidden. */
export function scoreBugText(shots: TimedShot[], fps: number, bug: ScoreBugSpec, frame: number): string | null {
  const shot = shots.find((s) => frame >= s.from && frame < s.from + s.frames);
  if (!shot || bug.hideOn.includes(shot.id)) return null;
  const flip = shots.find((s) => s.id === bug.flip.shot);
  if (!flip) throw new Error(`scoreBug.flip.shot ${bug.flip.shot} not in the cut`);
  return frame >= flip.from + Math.round(bug.flip.at * fps) ? bug.after : bug.before;
}

/** Top-left TV score bug: the commentator's on-screen identity (broadcast, not diary). */
export const ScoreBug: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      top: 120,
      left: 54,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontFamily: DIARY_TYPE.display,
      fontWeight: 600,
      fontSize: 40,
      letterSpacing: 2,
      color: '#fff',
      background: '#0b1d33e6',
      padding: '8px 18px',
      borderRadius: 8,
      borderLeft: '8px solid #e30a17',
    }}
  >
    <span style={{ width: 12, height: 12, borderRadius: 6, background: '#e30a17' }} />
    {text}
  </div>
);
