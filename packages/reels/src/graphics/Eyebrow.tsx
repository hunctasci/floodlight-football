import React from 'react';
import { interpolate } from 'remotion';
import { HNC_UI, SAFE } from './hnc-ui';

/**
 * Minimal brand mark (game `.eyebrow`: gold mono, wide tracking). Tracking
 * tightens as it fades in — a quiet "lights on" signature, not a logo intro.
 */
export const Eyebrow: React.FC<{ frame: number; text: string; at: number; exitAt: number }> = ({ frame, text, at, exitAt }) => {
  const fadeIn = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [exitAt - 10, exitAt], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = fadeIn * fadeOut;
  if (opacity <= 0) return null;
  const tracking = interpolate(fadeIn, [0, 1], [0.6, 0.34]);
  return (
    <div style={{ position: 'absolute', top: SAFE.top + 70, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity }}>
      <div
        style={{
          fontFamily: HNC_UI.mono,
          fontWeight: 800,
          fontSize: 46,
          letterSpacing: `${tracking}em`,
          color: HNC_UI.gold,
          textShadow: HNC_UI.hardShadow,
          paddingLeft: `${tracking}em`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
