import React from 'react';
import { interpolate, spring } from 'remotion';
import { HNC_UI } from './hnc-ui';

/**
 * The game's goal message (style.css .message: Impact, gold, 0.05em
 * tracking, navy hard shadow, small mono subline) — punched in on the goal
 * impact, anchored to a global frame so it survives the cut to celebration.
 */
export const GoalCall: React.FC<{
  frame: number;
  fps: number;
  text: string;
  sub?: string;
  at: number;
  exitAt: number;
}> = ({ frame, fps, text, sub, at, exitAt }) => {
  const since = frame - at;
  if (since < 0 || frame >= exitAt + 12) return null;
  const punch = spring({ frame: since, fps, config: { damping: 11, stiffness: 260, mass: 0.7 } });
  const scale = interpolate(punch, [0, 1], [2.4, 1]);
  const out = interpolate(frame, [exitAt, exitAt + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subIn = interpolate(since, [8, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 390,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: Math.min(1, punch * 2) * out,
        transform: `scale(${scale * (0.92 + 0.08 * out)})`,
      }}
    >
      <div
        style={{
          fontFamily: HNC_UI.display,
          fontSize: 230,
          lineHeight: 0.9,
          letterSpacing: '0.05em',
          color: HNC_UI.gold,
          textShadow: `10px 10px 0 ${HNC_UI.navy}`,
          WebkitTextStroke: `4px ${HNC_UI.navy}`,
        }}
      >
        {text}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 26,
            fontFamily: HNC_UI.mono,
            fontSize: 30,
            letterSpacing: '0.1em',
            color: '#fff',
            textShadow: HNC_UI.hardShadow,
            opacity: subIn,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
