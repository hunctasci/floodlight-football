import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { HNC_BRAND } from '../graphics/branding';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Reusable short-form hook — first 1–1.5 s. Big headline, optional prompt,
 * animated entrance, no logo-first intro. Frame 0 is already moving (the
 * thumbnail frame), voice joins at ~0.05–0.15 s (see ShortFilm audio).
 */
export const ShortHook: React.FC<{ headline: string; subline?: string }> = ({ headline, subline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 19, stiffness: 260, mass: 0.7 } });
  const t = frame / fps;
  // Subtle continuous motion so frame 0 is never static.
  const drift = 1 + 0.015 * Math.sin(t * 6);
  const rise = interpolate(enter, [0, 1], [46, 0]);
  return (
    <div style={{ position: 'absolute', top: 300, left: 56, right: 56, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          opacity: enter,
          transform: `translateY(${rise}px) scale(${drift})`,
          background: '#ffffff',
          borderRadius: 22,
          padding: '26px 36px',
          textAlign: 'center',
          boxShadow: '0 14px 50px #0009',
          maxWidth: 968,
        }}
      >
        <div style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", fontWeight: 600, fontSize: 96, lineHeight: 0.98, letterSpacing: 2, color: '#101b31' }}>
          {headline}
        </div>
        {subline ? (
          <div style={{ marginTop: 12, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600, fontSize: 38, letterSpacing: 1, color: '#5a5a5a' }}>
            {subline}
          </div>
        ) : null}
        <div style={{ height: 6, width: 140 * enter, background: HNC_BRAND.colors.red, margin: '18px auto 0', borderRadius: 3 }} />
      </div>
    </div>
  );
};
